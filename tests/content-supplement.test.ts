import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { readContentSupplement } from '../src/core/content-supplement.ts';
import { selectedCatalogTranslation, selectedTranslation } from '../src/core/content.ts';
import { getGrammar } from '../src/app/(study)/grammar/repository.ts';
import { findVocabulary, vocabularyDetail } from '../src/app/(study)/vocab/data.ts';
import { searchContent } from '../src/app/(study)/common-tools/repository.ts';
import { kanjiDetail } from '../src/app/(study)/kanji/repository.ts';
import { fixture } from './helpers.ts';

const hash = '1'.repeat(64);
const provenance = { sourceId: 'test', sourceName: 'Fixture', releaseId: '1', method: 'machine' };

test('reviewed vocabulary meanings replace only the matching active sense in details and search', (t) => {
  const { db, file, itemId } = fixture(t);
  const item = db.prepare('SELECT source_hash,release_id FROM content_items WHERE item_id=?').get(itemId)!;
  const translationId = 'reviewed-meaning-original';
  db.prepare(`INSERT INTO vi_translations
    (translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
    VALUES(?,?,'meaning','Nghĩa lệch','dictionary','openjlpt',?,'fixture',?,'selected','word','2026-11-06')`)
    .run(translationId, itemId, item.release_id, item.source_hash);
  db.exec("INSERT INTO translation_reports VALUES('fixture-report','reviewed-meaning-original','Fixture','2026-11-06','open')");
  const directory = path.join(path.dirname(file), 'private');
  const supplementFile = path.join(directory, 'g1-content-supplement.json');
  fs.mkdirSync(directory);
  const write = (sourceHash: unknown) => fs.writeFileSync(supplementFile, JSON.stringify({ version: 1, items: {
    [itemId]: { hash: sourceHash, reviewedMeaning: {
      text: 'Nghĩa chuẩn', sourceName: 'Fixture review', sourceId: 'fixture-review', releaseId: '1', url: 'https://example.org/',
    } },
  } }));
  const search = (q: string) => findVocabulary(db, { q, level: '', saved: false, page: 1 }).total;
  assert.equal(searchContent(db, 'Nghĩa lệch').total, 1);
  write(item.source_hash);
  assert.equal(selectedTranslation(db, itemId, 'meaning')?.method, 'editorial');
  assert.equal(selectedCatalogTranslation(db, itemId, 'meaning')?.translationId, translationId);
  assert.equal(vocabularyDetail(db, itemId)?.meaning?.text, 'Nghĩa chuẩn');
  assert.equal(vocabularyDetail(db, itemId)?.meaningId, null);
  assert.equal(search('Nghĩa chuẩn'), 1);
  assert.equal(search('Nghĩa lệch'), 0);
  assert.equal(searchContent(db, 'Nghĩa chuẩn').total, 1);
  assert.equal(searchContent(db, 'Nghĩa lệch').total, 0);
  write(hash);
  assert.equal(vocabularyDetail(db, itemId)?.meaningId, translationId);
  assert.equal(searchContent(db, 'Nghĩa lệch').total, 1);
  assert.equal(db.prepare("SELECT status FROM translation_reports WHERE report_id='fixture-report'").get()?.status, 'open');
});

test('private supplement fills missing values only when the active source hash matches', (t) => {
  const { db, file, itemId } = fixture(t);
  const output = path.join(path.dirname(file), 'supplement.json');
  const grammar = db.prepare('SELECT g.item_id FROM grammar g JOIN item_sentences l USING(item_id) LIMIT 1').get()!;
  const grammarId = String(grammar.item_id);
  const example = getGrammar(db, grammarId)!.examples[0];
  const kanji = db.prepare('SELECT item_id,character FROM kanji LIMIT 1').get()!;
  const kanjiId = String(kanji.item_id);
  const character = String(kanji.character);

  db.prepare('UPDATE vocab SET pos=? WHERE item_id=?').run('[]', itemId);
  db.prepare('DELETE FROM item_sentences WHERE item_id=?').run(itemId);
  db.prepare("DELETE FROM vi_translations WHERE (item_id=? AND field='text') OR (item_id=? AND field='han_viet')")
    .run(example.id, kanjiId);
  const update = db.prepare('UPDATE content_items SET source_hash=? WHERE item_id=?');
  for (const id of [itemId, example.id, kanjiId]) update.run(hash, id);
  const items = {
    [itemId]: { hash, pos: ['n'], examples: [{
      id: 'g1:sentence:' + '2'.repeat(64),
      japanese: '学生です。', furigana: '{学生|がくせい}です。', english: 'I am a student.',
      vietnamese: 'Tôi là học sinh.', attribution: 'Fixture', provenance,
    }] },
    [example.id]: { hash, vietnamese: { text: 'Nghĩa ví dụ', provenance } },
    [kanjiId]: { hash, readingNote: { text: 'Ghi chú', sourceName: 'Fixture', url: 'https://example.org/' } },
  };
  fs.writeFileSync(output, JSON.stringify({ version: 1, items }));
  const supplement = readContentSupplement(output);
  assert.equal(vocabularyDetail(db, itemId)!.examples.length, 0);
  const vocab = vocabularyDetail(db, itemId, supplement)!;
  assert.deepEqual(vocab.pos, ['n']);
  assert.equal(vocab.examples[0].translation?.sourceName, 'Fixture');
  assert.equal(vocab.examples[0].translationId, null);
  assert.equal(getGrammar(db, grammarId, supplement)!.examples[0].vietnamese?.text, 'Nghĩa ví dụ');
  assert.equal(kanjiDetail(db, character, supplement)!.readingNote?.sourceName, 'Fixture');
  update.run('3'.repeat(64), itemId);
  assert.equal(vocabularyDetail(db, itemId, supplement)!.examples.length, 0);
  assert.deepEqual(vocabularyDetail(db, itemId, supplement)!.pos, []);
  assert.equal(readContentSupplement(output + '.absent').size, 0);

  items[itemId].examples![0].furigana = '学生です。';
  fs.writeFileSync(output, JSON.stringify({ version: 1, items }));
  assert.throws(() => readContentSupplement(output), /Invalid G1 content supplement item/);
});

test('report counts zero gaps on complete content and never prints example text', (t) => {
  const { db, file } = fixture(t);
  db.exec("UPDATE content_items SET is_active=0 WHERE kind IN ('vocab','kanji','grammar')");
  const vocab = db.prepare('SELECT item_id FROM vocab LIMIT 1').get()!;
  const vocabId = String(vocab.item_id);
  db.prepare('UPDATE content_items SET is_active=1,source_hash=? WHERE item_id=?').run(hash,vocabId);
  db.prepare('UPDATE vocab SET level=?,pos=? WHERE item_id=?').run('N5', '[]', vocabId);
  db.prepare('DELETE FROM item_sentences WHERE item_id=?').run(vocabId);

  const grammarId = 'openjlpt:grammar:o';
  db.prepare("UPDATE grammar SET level=CASE WHEN item_id=? THEN 'N5' ELSE 'N1' END").run(grammarId);
  db.prepare("UPDATE content_items SET is_active=1 WHERE kind='grammar'").run();
  const grammarSentences = db.prepare(
    'SELECT sentence_id FROM item_sentences WHERE item_id=? ORDER BY position',
  ).all(grammarId);
  assert.equal(grammarSentences.length, 3);
  const examplePatches: Record<string, unknown> = {};
  for (const [index, row] of grammarSentences.entries()) {
    const japanese = ['わたしはあさにパンをたべます。', 'きょうはうちでほんをよみます。', 'いもうとはこうえんでえをかきます。'][index];
    db.prepare('UPDATE sentences SET text_ja=?,furigana_notation=? WHERE item_id=?').run(japanese, japanese, row.sentence_id);
    db.prepare('UPDATE content_items SET source_hash=? WHERE item_id=?').run(hash, row.sentence_id);
    examplePatches[String(row.sentence_id)] = { hash, vietnamese: { text: 'Nghĩa mẫu', provenance } };
  }
  const output = path.join(path.dirname(file), 'report-supplement.json');
  const privateText = 'Riêng tư kiểm thử';
  fs.writeFileSync(output, JSON.stringify({ version: 1, items: {
    ...examplePatches,
    [vocabId]: { hash, pos: ['n'], examples: [{
      id: 'g1:sentence:' + '4'.repeat(64), japanese: 'はい。', furigana: 'はい。', english: 'Yes.',
      vietnamese: privateText, attribution: 'Fixture', provenance,
    }] },
  } }));
  const run = (...args: string[]) => execFileSync(process.execPath,
    ['--disable-warning=ExperimentalWarning', 'tools/report-content-gaps.mjs', file, ...args], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(run()).vocab, { total: 1, missingPos: 1, noExamples: 1, noCompleteExample: 1,
    examples: 0, missingNotation: 0, missingFurigana: 0 });
  const stdout = run(output);
  assert.ok(!stdout.includes(privateText));
  const totals = JSON.parse(stdout);
  assert.deepEqual(totals.vocab, { total: 1, missingPos: 0, noExamples: 0, noCompleteExample: 0,
    examples: 1, missingNotation: 0, missingFurigana: 0 });
  const { total, examples, choiceQuestions, orderingQuestions, ...grammarGaps } = totals.grammar;
  assert.equal(total, 1);
  assert.equal(examples, 3);
  assert.equal(choiceQuestions, 3);
  assert.equal(orderingQuestions, 3);
  assert.ok(Object.values(grammarGaps).every((n) => n === 0));
  assert.ok(Object.values(totals.kanji).every((n) => n === 0));
});

test('vocabulary audit counts unannotated linked examples and requires a matching sentence hash', (t) => {
  const { db, file, itemId } = fixture(t);
  const example = db.prepare('SELECT sentence_id FROM item_sentences LIMIT 1').get()!;
  db.prepare('DELETE FROM item_sentences WHERE item_id=?').run(itemId);
  db.prepare('UPDATE sentences SET text_ja=?,furigana_notation=NULL WHERE item_id=?')
    .run('本です。', example.sentence_id);
  db.prepare('UPDATE content_items SET source_hash=? WHERE item_id=?').run(hash, example.sentence_id);
  db.prepare('INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) SELECT ?,item_id,0,source_id,release_id FROM content_items WHERE item_id=?')
    .run(itemId, example.sentence_id);
  db.prepare("UPDATE content_items SET is_active=(item_id=?) WHERE kind='vocab'").run(itemId);
  const output = path.join(path.dirname(file), 'vocab-ruby.json');
  const run = (sourceHash: string) => {
    fs.writeFileSync(output, JSON.stringify({ version: 1, items: {
      [String(example.sentence_id)]: { hash: sourceHash, furigana: '{本|ほん}です。' },
    } }));
    return JSON.parse(execFileSync(process.execPath,
      ['tools/report-content-gaps.mjs', file, output], { encoding: 'utf8' })).vocab;
  };
  assert.equal(run('3'.repeat(64)).missingNotation, 1);
  assert.equal(run('3'.repeat(64)).missingFurigana, 1);
  assert.equal(run(hash).missingNotation, 0);
  assert.equal(run(hash).missingFurigana, 0);
  assert.equal(vocabularyDetail(db, itemId, readContentSupplement(output))!.examples[0].furigana, '{本|ほん}です。');
});

test('supplement rejects okurigana inside ruby, mismatched text and unresolved attribution', (t) => {
  const { file, itemId } = fixture(t);
  const output = path.join(path.dirname(file), 'ruby.json');
  const example = {
    id: 'g1:sentence:' + '6'.repeat(64),
    japanese: '本を読む。',
    furigana: '{本|ほん}を{読|よ}む。',
    english: 'I read a book.',
    vietnamese: 'Tôi đọc sách.',
    attribution: 'Tatoeba #123 (CC BY 2.0 FR)',
    provenance,
  };
  const load = (overrides = {}, patch = example.furigana) => {
    fs.writeFileSync(output, JSON.stringify({ version: 1, items: {
      [itemId]: { hash, examples: [{ ...example, ...overrides }] },
      'openjlpt:sentence:fixture': { hash, furigana: patch },
    } }));
    return readContentSupplement(output);
  };
  assert.equal(load().get(itemId)?.examples?.[0].furigana, example.furigana);
  assert.throws(() => load({ furigana: '{本|ほん}を{読む|よむ}。' }), /Invalid G1 content supplement item/);
  assert.throws(() => load({}, '{本|ほん}を{読む|よむ}。'), /Invalid G1 content supplement item/);
  assert.throws(() => load({ furigana: '{本|ほん}を{読|よ}。' }), /Invalid G1 content supplement item/);
  assert.throws(() => load({ attribution: 'Tatoeba contributor not resolved' }), /Invalid G1 content supplement item/);
});
