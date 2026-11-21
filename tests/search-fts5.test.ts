import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { toRomaji } from 'wanakana';
import { fixture } from './helpers.ts';
import { openContentDatabase, selectedTranslation, type ContentKind } from '../src/core/content.ts';
import {
  FTS5_TOKENIZER,
  detailHref,
  normalize,
  rebuildSearchIndex,
  resolveSearchIndexPath,
  searchContent,
} from '../src/app/(study)/common-tools/repository.ts';
import { CONTENT_SQL } from '../src/app/(study)/common-tools/fts5.ts';

function legacySearchContent(db: DatabaseSync, input: string, pageInput = 1) {
  const q = input.normalize('NFC').trim().slice(0, 160);
  const needle = normalize(q);
  const page = Number.isSafeInteger(pageInput) && pageInput > 0 ? Math.min(pageInput, 100000) : 1;
  db.function('legacy_common_match', { deterministic: true, varargs: true }, (...values) =>
    values.some(
      (v) =>
        normalize(String(v ?? '')).includes(needle) ||
        normalize(toRomaji(String(v ?? ''))).includes(needle),
    )
      ? 1
      : 0,
  );
  const sql = `WITH content AS (${CONTENT_SQL}) SELECT c.* FROM content c WHERE legacy_common_match(c.title,c.reading,c.romaji,c.english)=1 OR EXISTS(SELECT 1 FROM vi_translations t JOIN content_items i ON i.item_id=t.item_id WHERE t.item_id=c.id AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash AND i.is_active=1 AND legacy_common_match(t.text_vi)=1)`;
  const total = Number(db.prepare(`SELECT count(*) n FROM (${sql})`).get()!.n);
  const items = db
    .prepare(`${sql} ORDER BY level,kind,title,id LIMIT ? OFFSET ?`)
    .all(24, (page - 1) * 24)
    .map((r) => {
      const kind = String(r.kind) as ContentKind;
      const id = String(r.id);
      const title = String(r.title);
      return {
        id,
        kind,
        title,
        reading: String(r.reading),
        level: String(r.level),
        english: JSON.parse(String(r.english)) as string[],
        sourceName: String(r.source),
        meaning: selectedTranslation(db, id, 'meaning'),
        hanViet: selectedTranslation(db, id, 'han_viet'),
        href: detailHref(kind, id, title),
      };
    });
  return { q, page, total, items };
}

test('FTS5 search matches legacy scan exactly across kanji, kana, romaji, Vietnamese, Hán Việt and edge inputs', (t) => {
  const { db, itemId } = fixture(t);
  const item = db.prepare('SELECT release_id, source_hash FROM content_items WHERE item_id=?').get(itemId)!;
  db.prepare(
    `INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
     VALUES('fts-hv',?,'han_viet','Học sinh đại học','han_viet','openjlpt',?,'k1',?,'selected','codepoint','2026-11-21'),
           ('fts-mean',?,'meaning','sinh viên làm việc chăm chỉ','dictionary','openjlpt',?,'k2',?,'selected','word','2026-11-21'),
           ('fts-cand',?,'notes','bản dịch nháp chưa chọn','machine','openjlpt',?,'k3',?,'candidate','machine_context','2026-11-21')`,
  ).run(itemId, item.release_id, item.source_hash, itemId, item.release_id, item.source_hash, itemId, item.release_id, item.source_hash);

  const queries = [
    '',
    '学',
    '学生',
    'が',
    'か',
    'がく',
    'がくせい',
    'ガクセイ',
    'gakusei',
    'kusei',
    'student',
    'hoc sinh',
    'học sinh',
    'HỌC SINH ĐẠI HỌC'.normalize('NFD'),
    'dai hoc',
    'đại học',
    'lam viec',
    'làm việc',
    'chăm chỉ',
    'cham chi',
    'bản dịch nháp',
    '%',
    '_',
    "' OR 1=1--",
    'student OR school',
    '"student"',
    'a*b',
    'not-found-anywhere-xyz',
  ];

  for (const q of queries) {
    const fts = searchContent(db, q, 1);
    const legacy = legacySearchContent(db, q, 1);
    assert.deepEqual(fts, legacy, `parity mismatch for query ${JSON.stringify(q)}`);
  }

  // Also verify pagination parity on empty query
  assert.deepEqual(searchContent(db, '', 2), legacySearchContent(db, '', 2));
  assert.deepEqual(searchContent(db, '', -5), legacySearchContent(db, '', -5));
});

test('FTS5 uses trigram virtual table in sidecar DB without mutating source G0 DB and rebuilds idempotently', (t) => {
  const { file } = fixture(t);

  const shaBefore = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const ro = openContentDatabase(file);
  try {
    const schemaBefore = JSON.stringify(
      ro.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
    );

    const first = rebuildSearchIndex(ro);
    assert.equal(first.tokenizer, FTS5_TOKENIZER);
    assert.equal(first.rebuilt, true);
    assert.ok(first.indexedCount > 0);
    assert.equal(first.indexPath, resolveSearchIndexPath(ro));

    const second = rebuildSearchIndex(ro);
    assert.equal(second.rebuilt, false);
    assert.equal(second.indexedCount, first.indexedCount);
    assert.equal(second.stamp, first.stamp);

    const forced = rebuildSearchIndex(ro, { force: true });
    assert.equal(forced.rebuilt, true);
    assert.equal(forced.indexedCount, first.indexedCount);

    // Confirm real FTS5 virtual table & query plan in sidecar
    const sidecar = new DatabaseSync(first.indexPath, { readOnly: true });
    try {
      const ftsDef = sidecar
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='search_fts'")
        .get() as { sql?: string } | undefined;
      assert.ok(ftsDef?.sql?.includes('USING fts5'), 'search_fts must be an FTS5 virtual table');
      assert.ok(ftsDef?.sql?.includes('trigram'), 'search_fts must use trigram tokenizer');

      const plan = sidecar
        .prepare('EXPLAIN QUERY PLAN SELECT i.id FROM search_fts f JOIN search_items i ON i.rowid=f.rowid WHERE f.search_text MATCH ?')
        .all('"gakusei"')
        .map((r) => String(r.detail))
        .join(' | ');
      assert.match(plan, /VIRTUAL TABLE INDEX/, `expected FTS5 virtual table index scan, got: ${plan}`);
    } finally {
      sidecar.close();
    }

    // Search works on read-only openContentDatabase() connection
    const res = searchContent(ro, 'gakusei');
    assert.ok(res.total >= 1);
    assert.ok(res.items.some((i) => i.title === '学生'));

    // Source G0 DB must remain byte-for-byte identical
    const schemaAfter = JSON.stringify(
      ro.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
    );
    assert.equal(schemaAfter, schemaBefore);
    const shaAfter = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(shaAfter, shaBefore);
  } finally {
    ro.close();
  }
});

test('FTS5 sidecar recovers from corruption, tracks cross-connection updates, and supports :memory: mode', (t) => {
  const { db, file, itemId } = fixture(t);

  // Initial build + query
  const indexPath = resolveSearchIndexPath(db);
  assert.ok(searchContent(db, 'gakusei').total >= 1);
  assert.ok(fs.existsSync(indexPath));

  // Corrupt sidecar and verify self-healing rebuild
  fs.writeFileSync(indexPath, 'not-a-valid-sqlite-database');
  const recovered = searchContent(db, 'gakusei');
  assert.ok(recovered.items.some((i) => i.id === itemId));

  // Cross-connection mutation detection (write via db, read via fresh readOnly openContentDatabase)
  const item = db.prepare('SELECT release_id, source_hash FROM content_items WHERE item_id=?').get(itemId)!;
  db.prepare(
    `INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
     VALUES('fts-cross',?,'meaning','người học tiếng nhật đặc biệt','dictionary','openjlpt',?,'k-cross',?,'selected','word','2026-11-21')`,
  ).run(itemId, item.release_id, item.source_hash);

  const ro = openContentDatabase(file);
  try {
    assert.equal(searchContent(ro, 'nguoi hoc tieng nhat dac biet').total, 1);

    // :memory: index option works idempotently
    const mem1 = rebuildSearchIndex(ro, { indexPath: ':memory:' });
    assert.equal(mem1.indexPath, ':memory:');
    assert.equal(mem1.rebuilt, true);
    const mem2 = rebuildSearchIndex(ro, { indexPath: ':memory:' });
    assert.equal(mem2.rebuilt, false);
    assert.equal(searchContent(ro, 'nguoi hoc tieng nhat dac biet', 1, { indexPath: ':memory:' }).total, 1);
  } finally {
    ro.close();
  }

  // Ensure sidecar sits in private/ sibling directory
  assert.equal(path.basename(path.dirname(indexPath)), 'private');
});
