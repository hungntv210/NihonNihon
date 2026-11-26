import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readContentSupplement } from '../src/core/content-supplement.ts';
import { getGrammar } from '../src/app/(study)/grammar/repository.ts';
import { correctOrder, grammarPractice } from '../src/app/(study)/grammar/practice.ts';
import { Furigana } from '../src/app/(study)/grammar/furigana.tsx';
import { fixture } from './helpers.ts';

const id = 'openjlpt:grammar:o';
const hash = '1'.repeat(64);
const common = {
  japanese: '本を読みました。', furigana: '{本|ほん}を{読|よ}みました。',
  english: 'I read a book.', vietnamese: 'Tôi đã đọc sách.', explanation: 'を đánh dấu tân ngữ.',
  attribution: 'Fixture', provenance: { sourceId: 'test', sourceName: 'Fixture', releaseId: '1', method: 'machine' },
};
const choice = {
  ...common, id: 'g1:exercise:' + '2'.repeat(64), kind: 'choice', start: 1, end: 2, answer: 'を',
  choices: [{ text: 'を', correct: true }, ...['のを', 'をに', 'をは'].map((text) => ({ text, correct: false }))],
};
const ordering = {
  ...common, id: 'g1:exercise:' + '3'.repeat(64), kind: 'ordering',
  prefix: '本', pieces: ['を', '読み', 'まし', 'た'], suffix: '。',
};

test('grammar supplement rejects bad answer keys, duplicated choices, malformed ruby and wrong order', (t) => {
  const { file } = fixture(t);
  const output = path.join(path.dirname(file), 'grammar.json');
  const invalidRows = [
    { ...choice, choices: choice.choices.map((c) => ({ ...c, correct: false })) },
    { ...choice, choices: choice.choices.map((c) => ({ ...c, correct: true })) },
    { ...choice, choices: [{ text: 'に', correct: true }, ...choice.choices.slice(1)] },
    { ...choice, choices: [choice.choices[0], ...choice.choices.slice(1, 3), { text: ' を ', correct: false }] },
    { ...choice, choices: choice.choices.slice(0, 3) },
    { ...choice, start: 0 },
    { ...choice, furigana: '{本|ほん}を{読|よ}みます。' },
    { ...choice, furigana: '{本|ほん}を{読み|よみ}ました。' },
    { ...ordering, pieces: ['読み', 'を', 'まし', 'た'] },
    { ...ordering, pieces: ['を', '読み', 'まし', 'を'] },
    { ...ordering, suffix: '！' },
  ];
  for (const [index, row] of invalidRows.entries()) {
    fs.writeFileSync(output, JSON.stringify({ version: 1, items: { [id]: { hash, exercises: [row] } } }));
    assert.throws(() => readContentSupplement(output), /Invalid G1 content supplement item/, 'case ' + index);
  }
  fs.writeFileSync(output, JSON.stringify({ version: 1, items: { [id]: { hash, exercises: [choice, choice] } } }));
  assert.throws(() => readContentSupplement(output), /Duplicate G1 supplement exercise/);
});

test('matching grammar hash supplies practice and marks an example across its ruby and kana', (t) => {
  const { db, file } = fixture(t);
  const output = path.join(path.dirname(file), 'grammar.json');
  fs.writeFileSync(output, JSON.stringify({ version: 1, items: {
    [id]: { hash, exercises: [choice, ordering], examples: [{
      ...common, id: 'g1:sentence:' + '4'.repeat(64), highlights: [{ start: 2, end: 7 }],
    }] },
  } }));
  const supplement = readContentSupplement(output);
  assert.deepEqual(getGrammar(db, id, supplement)!.exercises, []);
  db.prepare('UPDATE content_items SET source_hash=? WHERE item_id=?').run(hash, id);
  const grammar = getGrammar(db, id, supplement)!;
  const practice = grammarPractice(grammar.pattern, grammar.examples, ['〜に', '〜は'], grammar.exercises);
  assert.equal(practice.choices[0].promptFurigana, '{本|ほん}＿＿{読|よ}みました。');
  assert.equal(practice.choices[0].vietnamese, common.vietnamese);
  assert.equal(practice.choices[0].explanation, common.explanation);
  assert.ok(correctOrder(practice.ordering[0], [0, 1, 2, 3]));
  assert.ok(!correctOrder(practice.ordering[0], [1, 0, 2, 3]));
  const row = grammar.examples.find((e) => e.highlights)!;
  const html = renderToStaticMarkup(createElement(Furigana, {
    japanese: row.japanese, notation: row.furigana, highlights: row.highlights,
  }));
  assert.match(html, /<mark><ruby>読.*<rt>よ<\/rt>.*<\/ruby><\/mark><mark>みました<\/mark>/u);
});
