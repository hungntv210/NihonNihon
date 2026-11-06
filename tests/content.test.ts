import fs from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.ts';
import {
  contentSummary,
  contentSources,
  listContent,
  openContentDatabase,
  selectedTranslation,
} from '../src/core/content.ts';
import { seedDemo } from '../tools/seed-demo.ts';

test('demo contains only OpenJLPT content, no machine translations or private-source data', (t) => {
  const { db, file } = fixture(t);
  assert.deepEqual(contentSummary(db), { vocab: 8, kanji: 4, grammar: 3, review: 0 });
  assert.deepEqual(
    contentSources(db).map((s) => s.id),
    ['openjlpt'],
  );
  assert.equal(db.prepare('SELECT count(*) n FROM vi_translations').get()!.n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM media_assets').get()!.n, 0);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.throws(() => seedDemo(file), /refusing/);
});
test('content reader opens SQLite read-only and returns stable typed IDs and English fallback', (t) => {
  const { file } = fixture(t),
    db = openContentDatabase(file);
  try {
    const items = listContent(db, 'vocab');
    assert.equal(items.length, 8);
    assert.ok(
      items.every(
        (i) => i.id.startsWith('openjlpt:vocab:') && i.vietnamese === null && i.english.length,
      ),
    );
    assert.throws(() => db.exec('DELETE FROM vocab'), /readonly|read.only/i);
    assert.throws(() => listContent(db, 'vocab', 100000));
    assert.throws(() => listContent(db, 'srs_cards' as never));
  } finally {
    db.close();
  }
});
test('selected translation includes the actual model and ignores candidates, stale content and inactive items', (t) => {
  const { db, itemId } = fixture(t),
    hash = String(
      db.prepare('SELECT source_hash FROM content_items WHERE item_id=?').get(itemId)!.source_hash,
    );
  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:test','Synthetic provider','https://example.invalid','Synthetic test','Synthetic test','private_only')",
  ).run();
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('test-release','mt:test','1',?,'local://synthetic','2026-11-06','Synthetic test','Synthetic test',?)",
  ).run('b'.repeat(64), JSON.stringify({ model: 'gemini-synthetic', prompt_version: 'test-4' }));
  const insert = db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES(?,?,'meaning',?,'machine','mt:test','test-release',?, ?,?,'machine_context','2026-11-06')",
  );
  insert.run('candidate', itemId, 'Không được hiển thị', 'candidate', hash, 'candidate');
  assert.equal(selectedTranslation(db, itemId, 'meaning'), null);
  insert.run('selected', itemId, 'Sinh viên', 'selected', hash, 'selected');
  const vi = selectedTranslation(db, itemId, 'meaning')!;
  assert.equal(vi.text, 'Sinh viên');
  assert.equal(vi.sourceId, 'mt:test');
  assert.equal(vi.sourceName, 'Synthetic provider');
  assert.equal(vi.model, 'gemini-synthetic');
  assert.equal(vi.promptVersion, 'test-4');
  assert.equal(
    listContent(db, 'vocab').find((i) => i.id === itemId)!.vietnamese!.text,
    'Sinh viên',
  );
  db.prepare("UPDATE vi_translations SET needs_refresh=1 WHERE translation_id='selected'").run();
  assert.equal(selectedTranslation(db, itemId, 'meaning'), null);
  db.prepare(
    "UPDATE vi_translations SET needs_refresh=0,base_content_hash=? WHERE translation_id='selected'",
  ).run('f'.repeat(64));
  assert.equal(selectedTranslation(db, itemId, 'meaning'), null);
  db.prepare("UPDATE vi_translations SET base_content_hash=? WHERE translation_id='selected'").run(
    hash,
  );
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(itemId);
  assert.equal(selectedTranslation(db, itemId, 'meaning'), null);
});
test('schema copied into foundation matches the G0 specification git blob without edits', () => {
  const bytes = Buffer.from(
    fs.readFileSync('docs/data/schema.draft.sql', 'utf8').replaceAll('\r\n', '\n'),
  );
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(gitBlob, '0991ee1553ab652410d9d2aeba04a1d48613690a');
});
