import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../../../../tests/helpers.ts';
import { enqueueCard } from '../../../core/review.ts';
import { foldSearch, parseFilters, filterUrl, searchKanji, kanjiDetail } from './repository.ts';
import { reportKanjiTranslation } from './reporting.ts';

function syntheticTranslations(db: ReturnType<typeof fixture>['db']) {
  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:kanji-test','Synthetic test provider','https://example.invalid','Synthetic test only','Synthetic test','private_only')",
  ).run();
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('kanji-test-release','mt:kanji-test','1',?,'local://synthetic','2026-11-06','Synthetic test only','Synthetic test',?)",
  ).run(
    'a'.repeat(64),
    JSON.stringify({ model: 'synthetic-model', prompt_version: 'synthetic-prompt' }),
  );
  const id = String(db.prepare("SELECT item_id FROM kanji WHERE character='日'").get()!.item_id),
    hash = String(
      db.prepare('SELECT source_hash FROM content_items WHERE item_id=?').get(id)!.source_hash,
    );
  function add(
    key: string,
    field: string,
    text: string,
    status = 'candidate',
    method = 'machine',
    context = '{}',
  ) {
    db.prepare(
      "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,context_json,created_at) VALUES(?,?,?,?,?,'mt:kanji-test','kanji-test-release',?,?,?,'machine_context',?,'2026-11-06')",
    ).run(key, id, field, text, method, key, hash, status, context);
  }
  return { id, hash, add };
}

test('kanji search normalizes Vietnamese accents and width, preserves Japanese voicing, validates filters', () => {
  assert.equal(foldSearch('ĐỘNG'), 'dong');
  assert.equal(foldSearch('ﾆﾁ'), 'にち');
  assert.notEqual(foldSearch('ガ'), foldSearch('カ'));
  const filters = parseFilters({
    q: '  ĐỘNG  ',
    level: 'unknown',
    strokes: '100',
    page: '-7',
    radical: ['日', '日', '月', 'invalid'],
  });
  assert.equal(filters.q, 'ĐỘNG');
  assert.equal(filters.level, '');
  assert.equal(filters.strokes, null);
  assert.equal(filters.page, 1);
  assert.deepEqual(filters.radicals, ['日', '月']);
  assert.ok(filterUrl(filters, { page: 2 }).includes('page=2'));
});
test('catalog reads demo without promoting missing translations and paginates stable results', (t) => {
  const { db } = fixture(t),
    all = searchKanji(db, parseFilters({}), 2);
  assert.equal(all.total, 4);
  assert.equal(all.pages, 2);
  assert.equal(all.items.length, 2);
  assert.ok(all.items.every((k) => k.hanViet === null && k.meaning === null));
  const second = searchKanji(db, parseFilters({ page: '999' }), 2);
  assert.equal(second.page, 2);
  assert.equal(new Set([...all.items, ...second.items].map((k) => k.id)).size, 4);
  assert.equal(searchKanji(db, parseFilters({ q: 'ニチ' })).items[0].character, '日');
  assert.equal(searchKanji(db, parseFilters({ q: "%' OR 1=1 --" })).total, 0);
  assert.equal(searchKanji(db, parseFilters({ q: '%' })).total, 0);
  assert.equal(searchKanji(db, parseFilters({ level: 'N1' })).total, 0);
});
test('search combines radicals/components, exact strokes and level while ignoring inactive items', (t) => {
  const { db } = fixture(t),
    day = kanjiDetail(db, '日')!,
    release = String(
      db.prepare('SELECT release_id FROM content_items WHERE item_id=?').get(day.id)!.release_id,
    );
  db.prepare(
    "INSERT INTO kanji_components(kanji_id,component,source_id,release_id) VALUES(?,'月','openjlpt',?)",
  ).run(day.id, release);
  assert.equal(
    searchKanji(db, parseFilters({ radical: ['日', '月'], strokes: '4', level: 'N5' })).items[0]
      .character,
    '日',
  );
  assert.equal(searchKanji(db, parseFilters({ radical: ['日', '木'] })).total, 0);
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(day.id);
  assert.equal(searchKanji(db, parseFilters({ q: 'ニチ' })).total, 0);
  assert.equal(kanjiDetail(db, '日'), null);
});
test('Han Viet primary is only selected, alternatives stay distinct and AI provenance is retained', (t) => {
  const { db } = fixture(t),
    { id, add } = syntheticTranslations(db);
  add('candidate', 'han_viet', 'nhật');
  let item = kanjiDetail(db, '日')!;
  assert.equal(item.hanViet, null);
  assert.deepEqual(item.alternatives, ['nhật']);
  add(
    'primary',
    'han_viet',
    'nhật',
    'selected',
    'machine',
    JSON.stringify({ selection_method: 'ai_fallback' }),
  );
  add('other', 'han_viet', 'niết');
  add('rejected', 'han_viet', 'không được hiện', 'rejected');
  add('meaning', 'meaning', 'ngày; mặt trời', 'selected');
  item = kanjiDetail(db, '日')!;
  assert.equal(item.hanViet!.text, 'nhật');
  assert.equal(item.hanViet!.autoSelected, true);
  assert.equal(item.hanViet!.model, 'synthetic-model');
  assert.equal(item.hanViet!.promptVersion, 'synthetic-prompt');
  assert.deepEqual(item.alternatives, ['niết']);
  assert.equal(item.hanVietId, 'primary');
  assert.equal(item.meaningId, 'meaning');
  assert.equal(searchKanji(db, parseFilters({ q: 'mat troi' })).items[0].id, id);
  db.prepare("UPDATE vi_translations SET needs_refresh=1 WHERE translation_id='primary'").run();
  assert.equal(kanjiDetail(db, '日')!.hanViet, null);
  db.prepare('UPDATE content_items SET source_hash=? WHERE item_id=?').run('b'.repeat(64), id);
  assert.equal(kanjiDetail(db, '日')!.alternatives.length, 0);
  assert.equal(kanjiDetail(db, '日')!.meaning, null);
});
test('details return actual readings, studied related words first and canonical ordered stroke variant', (t) => {
  const { db, file, itemId } = fixture(t);
  enqueueCard(file, itemId, 'recognition');
  const school = kanjiDetail(db, '学')!;
  assert.equal(school.related[0].word, '学生');
  assert.ok(school.related[0].studied);
  assert.ok(school.onyomi.length > 0);
  assert.equal(kanjiDetail(db, 'unknown'), null);
  const day = kanjiDetail(db, '日')!,
    release = String(
      db.prepare('SELECT release_id FROM content_items WHERE item_id=?').get(day.id)!.release_id,
    ),
    insert = db.prepare(
      "INSERT INTO kanji_strokes(kanji_id,variant,stroke_no,path_d,source_id,release_id) VALUES(?,?,?,?,'openjlpt',?)",
    );
  insert.run(day.id, 'other', 1, 'M0 0 L9 9', release);
  insert.run(day.id, '', 2, 'M20 10 L20 90', release);
  insert.run(day.id, '', 1, 'M10 10 L10 90', release);
  const detail = kanjiDetail(db, '日')!;
  assert.deepEqual(
    detail.strokePaths.map((p) => p.number),
    [1, 2],
  );
  assert.equal(detail.strokePaths[0].path, 'M10 10 L10 90');
  assert.equal(detail.strokeSource!.name, 'OpenJLPT');
});
test('reports are NFC, idempotent and reject stale/candidate translations without changing schema', (t) => {
  const { db, file } = fixture(t),
    { add } = syntheticTranslations(db);
  add('candidate', 'meaning', 'Synthetic candidate');
  add('selected', 'meaning', 'Synthetic selected', 'selected');
  const schema = db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all();
  assert.throws(() => reportKanjiTranslation(file, 'candidate', 'Nghĩa chưa đúng'), /STALE/);
  assert.throws(() => reportKanjiTranslation(file, 'selected', 'x'), /INVALID/);
  assert.throws(() => reportKanjiTranslation(file, 'selected', 'x'.repeat(501)), /INVALID/);
  const first = reportKanjiTranslation(file, 'selected', 'Nghĩa chưa đúng'.normalize('NFD')),
    second = reportKanjiTranslation(file, 'selected', 'Nghĩa chưa đúng');
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.reportId, second.reportId);
  assert.equal(
    db.prepare('SELECT reason FROM translation_reports').get()!.reason,
    'Nghĩa chưa đúng',
  );
  assert.deepEqual(db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all(), schema);
  db.prepare("UPDATE vi_translations SET needs_refresh=1 WHERE translation_id='selected'").run();
  assert.throws(() => reportKanjiTranslation(file, 'selected', 'Nghĩa khác'), /STALE/);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
