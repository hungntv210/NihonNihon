import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../../../../tests/helpers.ts';
import {
  findVocabulary,
  vocabularyDetail,
  searchParams,
  normalizeSearch,
  wordSegments,
  parseFurigana,
  newVocabulary,
  vocabularyUrl,
} from './data.ts';
import { reportTranslation } from './report-data.ts';
import { enqueueCard } from '../../../core/review.ts';

test('vocab search accepts kana/romaji/English, accent-free Vietnamese, levels and queued filter', (t) => {
  const { db, file, itemId } = fixture(t),
    base = searchParams({});
  assert.equal(findVocabulary(db, { ...base, q: 'がくせい' }).items[0].word, '学生');
  assert.equal(findVocabulary(db, { ...base, q: 'ガクセイ' }).items[0].word, '学生');
  assert.equal(findVocabulary(db, { ...base, q: 'gakusei' }).items[0].id, itemId);
  assert.equal(findVocabulary(db, { ...base, q: 'student' }).items[0].id, itemId);
  assert.equal(findVocabulary(db, { ...base, level: 'N2' }).total, 0);
  assert.equal(findVocabulary(db, { ...base, saved: true }).total, 0);
  enqueueCard(file, itemId, 'recognition');
  assert.equal(findVocabulary(db, { ...base, saved: true }).items[0].id, itemId);
  const release = String(
      db.prepare('SELECT release_id FROM content_items WHERE item_id=?').get(itemId)!.release_id,
    ),
    hash = String(
      db.prepare('SELECT source_hash FROM content_items WHERE item_id=?').get(itemId)!.source_hash,
    );
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('test-translation',?,'meaning','Sinh viên đại học','dictionary','openjlpt',?,'synthetic',?,'selected','word','2026-11-06')",
  ).run(itemId, release, hash);
  assert.equal(findVocabulary(db, { ...base, q: 'sinh vien dai hoc' }).items[0].id, itemId);
  db.prepare(
    "UPDATE vi_translations SET needs_refresh=1 WHERE translation_id='test-translation'",
  ).run();
  assert.equal(findVocabulary(db, { ...base, q: 'sinh vien dai hoc' }).total, 0);
  assert.equal(normalizeSearch('ガ'), 'が');
  assert.notEqual(normalizeSearch('が'), normalizeSearch('か'));
});
test('vocab queries preserve same-word reading identity, literal SQL punctuation and active content', (t) => {
  const { db, itemId } = fixture(t),
    r = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!;
  db.prepare(
    'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
  ).run(
    'synthetic-other-reading',
    'vocab',
    r.source_id,
    'synthetic-other',
    r.release_id,
    r.source_hash,
  );
  db.prepare(
    "INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en) VALUES('synthetic-other-reading','学生','がくしょう','gakusho','N2','[\"synthetic alternative\"]')",
  ).run();
  const detail = vocabularyDetail(db, itemId)!;
  assert.equal(detail.otherReadings[0].id, 'synthetic-other-reading');
  assert.ok(detail.english.includes('student'));
  assert.notDeepEqual(detail.english, vocabularyDetail(db, 'synthetic-other-reading')!.english);
  assert.ok(detail.kanji.some((k) => k.character === '学'));
  assert.equal(findVocabulary(db, searchParams({ q: "' OR 1=1 --" })).total, 0);
  assert.equal(findVocabulary(db, searchParams({ q: '%' })).total, 0);
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(itemId);
  assert.equal(vocabularyDetail(db, itemId), null);
  assert.equal(vocabularyDetail(db, 'missing'), null);
});
test('pagination is stable and new-word lesson can find unqueued words beyond the first page', (t) => {
  const { db, file, itemId } = fixture(t),
    i = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!,
    v = db.prepare('SELECT * FROM vocab WHERE item_id=?').get(itemId)!;
  for (let n = 0; n < 20; n++) {
    const id = 'synthetic-' + String(n).padStart(3, '0');
    db.prepare(
      'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
    ).run(id, 'vocab', i.source_id, id, i.release_id, i.source_hash);
    db.prepare(
      'INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en) VALUES(?,?,?,?,?,?)',
    ).run(id, '語' + n, v.reading, v.romaji, 'N5', v.meanings_en);
  }
  const first = findVocabulary(db, searchParams({})),
    second = findVocabulary(db, searchParams({ page: '2' }));
  assert.equal(first.items.length, 12);
  assert.equal(second.items.length, 12);
  assert.equal(first.total, 28);
  assert.ok(first.items.every((a) => !second.items.some((b) => b.id === a.id)));
  assert.equal(findVocabulary(db, searchParams({ page: '999' })).page, 3);
  for (const r of [...first.items, ...second.items]) enqueueCard(file, r.id, 'recognition');
  assert.equal(newVocabulary(db).length, 4);
  assert.ok(newVocabulary(db).every((r) => !r.queued));
  assert.equal(searchParams({ page: 'NaN', level: 'N0' }).page, 1);
  assert.equal(searchParams({ page: '-2', level: 'N0' }).level, '');
  assert.match(vocabularyUrl(searchParams({ q: '学生', level: 'N5', saved: '1' }), 2), /page=2/);
});
test('furigana is accepted only when it reconstructs Japanese exactly', () => {
  assert.deepEqual(parseFurigana('{私|わたし}は{学生|がくせい}です。', '私は学生です。'), [
    { text: '私', reading: 'わたし' },
    { text: 'は' },
    { text: '学生', reading: 'がくせい' },
    { text: 'です。' },
  ]);
  assert.deepEqual(parseFurigana('{別|べつ}です。', '日です。'), [{ text: '日です。' }]);
  assert.deepEqual(
    wordSegments('[{"ruby":"学","rt":"がく"},{"ruby":"生","rt":"せい"}]', '学生', 'がくせい'),
    [
      { text: '学', reading: 'がく' },
      { text: '生', reading: 'せい' },
    ],
  );
  assert.deepEqual(wordSegments('invalid', '学生', 'がくせい'), [
    { text: '学生', reading: 'がくせい' },
  ]);
});
test('word examples read their own selected translation without leaking another word context', (t) => {
  const { db, file, itemId } = fixture(t),
    sentence = db
      .prepare(
        "SELECT s.item_id,s.text_ja,s.text_en,s.furigana_notation,i.release_id,i.source_hash FROM sentences s JOIN content_items i USING(item_id) WHERE s.text_ja='私は学生です。'",
      )
      .get()!;
  db.prepare(
    "INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,0,'openjlpt',?)",
  ).run(itemId, sentence.item_id, sentence.release_id);
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('sentence-vi',?,'text','Tôi là sinh viên.','machine','openjlpt',?,'synthetic',?,'selected','machine_context','2026-11-06')",
  ).run(sentence.item_id, sentence.release_id, sentence.source_hash);
  const example = vocabularyDetail(db, itemId)!.examples[0];
  assert.equal(example.japanese, '私は学生です。');
  assert.equal(example.translation!.text, 'Tôi là sinh viên.');
  assert.equal(example.translationId, 'sentence-vi');
  assert.equal(
    parseFurigana(example.furigana, example.japanese)
      .map((s) => s.text)
      .join(''),
    example.japanese,
  );
  assert.ok(reportTranslation(file, itemId, 'sentence-vi', 'Ví dụ cần kiểm tra lại').created);
  const other = String(
    db.prepare('SELECT item_id FROM vocab WHERE item_id<>? LIMIT 1').get(itemId)!.item_id,
  );
  assert.throws(
    () => reportTranslation(file, other, 'sentence-vi', 'Không thuộc từ đang xem'),
    /NOT_FOUND/,
  );
});
test('word Han Viet requires G0 all-On evidence matching this exact reading', (t) => {
  const { db, itemId } = fixture(t),
    r = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!;
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('word-hv',?,'han_viet','học sinh','han_viet','openjlpt',?,'synthetic',?,'selected','word_reading','2026-11-06')",
  ).run(itemId, r.release_id, r.source_hash);
  assert.equal(vocabularyDetail(db, itemId)!.hanViet, null);
  db.prepare("UPDATE vi_translations SET context_json=? WHERE translation_id='word-hv'").run(
    JSON.stringify({ all_on: true, word: '学生', reading: 'がくしょう' }),
  );
  assert.equal(vocabularyDetail(db, itemId)!.hanViet, null);
  db.prepare("UPDATE vi_translations SET context_json=? WHERE translation_id='word-hv'").run(
    JSON.stringify({ all_on: true, word: '学生', reading: 'がくせい' }),
  );
  assert.equal(vocabularyDetail(db, itemId)!.hanViet!.text, 'học sinh');
});
test('reporting accepts only the current selected translation related to this word and keeps schema intact', (t) => {
  const { db, file, itemId } = fixture(t),
    row = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!,
    schema = db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all();
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('reportable',?,'meaning','Sinh viên','dictionary','openjlpt',?,'synthetic',?,'selected','word','2026-11-06')",
  ).run(itemId, row.release_id, row.source_hash);
  const first = reportTranslation(
      file,
      itemId,
      'reportable',
      'Nghĩa cần đối chiếu.'.normalize('NFD'),
    ),
    second = reportTranslation(file, itemId, 'reportable', 'Nghĩa cần đối chiếu.');
  assert.ok(first.created);
  assert.ok(!second.created);
  assert.equal(first.reportId, second.reportId);
  assert.equal(db.prepare('SELECT count(*) n FROM translation_reports').get()!.n, 1);
  assert.equal(
    db.prepare("SELECT status FROM vi_translations WHERE translation_id='reportable'").get()!
      .status,
    'selected',
  );
  assert.throws(
    () => reportTranslation(file, 'missing', 'reportable', 'Lý do không hợp lệ'),
    /NOT_FOUND/,
  );
  assert.throws(() => reportTranslation(file, itemId, 'reportable', '1234'), /INVALID/);
  db.prepare(
    "UPDATE vi_translations SET status='needs_review' WHERE translation_id='reportable'",
  ).run();
  assert.throws(
    () => reportTranslation(file, itemId, 'reportable', 'Bản cũ không được nhận'),
    /NOT_FOUND/,
  );
  assert.deepEqual(db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all(), schema);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
