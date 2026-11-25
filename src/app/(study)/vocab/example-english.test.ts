import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from '../../../../tests/helpers.ts';
import { vocabularyDetail } from './data.ts';
import { ExampleEnglish } from './example-english.tsx';

test('ExampleEnglish renders English inline for machine translations and inside details for tatoeba', () => {
  const machineHtml = renderToStaticMarkup(
    React.createElement(ExampleEnglish, {
      english: 'I am a student.',
      method: 'machine',
      originalClassName: 'orig-class',
      detailsClassName: 'details-class',
    }),
  );
  assert.equal(machineHtml, '<p lang="en" class="orig-class">I am a student.</p>');
  assert.ok(!machineHtml.includes('<details'));
  assert.ok(!machineHtml.includes('Xem câu Anh gốc'));

  const tatoebaHtml = renderToStaticMarkup(
    React.createElement(ExampleEnglish, {
      english: 'I am a student.',
      method: 'tatoeba',
      originalClassName: 'orig-class',
      detailsClassName: 'details-class',
    }),
  );
  assert.equal(
    tatoebaHtml,
    '<details class="details-class"><summary>Xem câu Anh gốc</summary><p lang="en">I am a student.</p></details>',
  );
});

test('ExampleEnglish renders nothing when English text is null, empty, or whitespace-only', () => {
  for (const method of ['machine', 'tatoeba']) {
    for (const english of [null, '', '   ']) {
      const html = renderToStaticMarkup(
        React.createElement(ExampleEnglish, {
          english,
          method,
          originalClassName: 'orig-class',
          detailsClassName: 'details-class',
        }),
      );
      assert.equal(
        html,
        '',
        `expected empty output for method=${method}, english=${JSON.stringify(english)}`,
      );
    }
  }
});

test('vocab detail examples distinguish machine, tatoeba, and missing English text from DB rows', (t) => {
  const { db, itemId } = fixture(t);
  const wordItem = db
    .prepare('SELECT source_id, release_id FROM content_items WHERE item_id=?')
    .get(itemId)!;

  const insertItem = db.prepare(
    'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
  );
  const insertSentence = db.prepare(
    'INSERT INTO sentences(item_id,text_ja,text_en,furigana_notation,author_attribution) VALUES(?,?,?,?,?)',
  );
  const insertLink = db.prepare(
    'INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,?,?,?)',
  );
  const insertVi = db.prepare(
    `INSERT INTO vi_translations(
      translation_id,item_id,field,text_vi,method,source_id,release_id,
      source_record_key,base_content_hash,status,match_method,created_at
    ) VALUES(?,?,'text',?,?,?,?,'synthetic',?,'selected','machine_context','2026-11-25')`,
  );

  const cases = [
    {
      id: 'synthetic-ex-machine',
      ja: '私は学生です。',
      en: 'I am a student.',
      vi: 'Tôi là học sinh.',
      method: 'machine',
      pos: 0,
    },
    {
      id: 'synthetic-ex-tatoeba',
      ja: '学生がいます。',
      en: 'There is a student.',
      vi: 'Có một học sinh.',
      method: 'tatoeba',
      pos: 1,
    },
    {
      id: 'synthetic-ex-tatoeba-no-en',
      ja: '学生ですか。',
      en: null,
      vi: 'Bạn là học sinh phải không?',
      method: 'tatoeba',
      pos: 2,
    },
    {
      id: 'synthetic-ex-machine-no-en',
      ja: '学生ですよ。',
      en: null,
      vi: 'Là học sinh đấy.',
      method: 'machine',
      pos: 3,
    },
  ];

  for (const c of cases) {
    const hash = String(c.pos + 1).repeat(64);
    insertItem.run(c.id, 'sentence', wordItem.source_id, c.id, wordItem.release_id, hash);
    insertSentence.run(c.id, c.ja, c.en, null, 'Synthetic test');
    insertLink.run(itemId, c.id, c.pos, wordItem.source_id, wordItem.release_id);
    insertVi.run('vi-' + c.id, c.id, c.vi, c.method, wordItem.source_id, wordItem.release_id, hash);
  }

  const detail = vocabularyDetail(db, itemId)!;
  assert.equal(detail.examples.length, 4);

  const rendered = detail.examples.map((ex) => ({
    id: ex.id,
    html:
      ex.translation && ex.english
        ? renderToStaticMarkup(
            React.createElement(ExampleEnglish, {
              english: ex.english,
              method: ex.translation.method,
              originalClassName: 'orig',
              detailsClassName: 'det',
            }),
          )
        : '',
  }));

  assert.equal(rendered[0].html, '<p lang="en" class="orig">I am a student.</p>');
  assert.equal(
    rendered[1].html,
    '<details class="det"><summary>Xem câu Anh gốc</summary><p lang="en">There is a student.</p></details>',
  );
  assert.equal(rendered[2].html, '');
  assert.equal(rendered[3].html, '');
});

test('vocab/[id]/page.tsx guards example.english and passes translation.method to ExampleEnglish', () => {
  const pageSource = fs.readFileSync(
    path.resolve('src/app/(study)/vocab/[id]/page.tsx'),
    'utf8',
  );
  assert.match(pageSource, /\{example\.english\s*&&\s*\(\s*<ExampleEnglish/);
  assert.match(pageSource, /method=\{example\.translation\.method\}/);
  assert.doesNotMatch(pageSource, /<summary>Xem câu Anh gốc<\/summary>/);
});
