import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { fixture } from './helpers.ts';
import { selectedTranslation, type Translation } from '../src/core/content.ts';
import { createSession, hashPassword, SESSION_COOKIE } from '../src/core/session.ts';
import { proxy } from '../src/proxy.ts';
import { reportQueue, searchAllKinds } from '../src/app/(study)/common-tools/repository.ts';
import { lookupWord } from '../src/app/(study)/common-tools/lookup.ts';
import {
  DEFAULT_REPORT_REASON,
  markTranslationReport,
} from '../src/app/(study)/common-tools/report-store.ts';
import {
  handleReportPost,
  type ReportHandlerDeps,
} from '../src/app/(study)/common-tools/report-handler.ts';
import { ReportViButton } from '../src/app/(study)/common-tools/report-vi-button.tsx';
import { searchKanji, kanjiDetail } from '../src/app/(study)/kanji/repository.ts';
import { listGrammar, getGrammar } from '../src/app/(study)/grammar/repository.ts';
import { listVocabNotebook } from '../src/app/(study)/vocab/notebook/data.ts';
import { newLessonKanji } from '../src/app/(study)/vocab/lesson/kanji/model.ts';
import { KanjiCardBody, KanjiWordBody } from '../src/app/(study)/vocab/lesson/kanji/card-body.tsx';
import { session as srsSession } from '../src/app/(study)/srs/repository.ts';
import { scheduler } from '../src/app/(study)/srs/model.ts';

function makeDeps(file: string, overrides: Partial<ReportHandlerDeps> = {}): ReportHandlerDeps {
  return {
    isAuthenticated: async () => true,
    sameOriginCheck: () => true,
    readBody: async (request) => request.text(),
    dbPath: file,
    now: () => new Date('2026-11-22T09:00:00.000Z'),
    ...overrides,
  };
}

function makeTranslation(translationId: string, text: string): Translation {
  return {
    translationId,
    text,
    sourceId: 'src-test',
    sourceName: 'Test Source',
    releaseId: 'rel-test',
    method: 'dictionary',
    model: null,
    promptVersion: null,
    autoSelected: false,
  };
}

function seedSyntheticTranslations(db: ReturnType<typeof fixture>['db'], vocabId: string) {
  const getItem = db.prepare(
    'SELECT item_id, source_id, release_id, source_hash FROM content_items WHERE item_id=?',
  );
  const insertVi = db.prepare(
    `INSERT INTO vi_translations(
       translation_id, item_id, field, text_vi, method, source_id, release_id,
       source_record_key, base_content_hash, status, match_method, created_at
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'selected', 'word', '2026-11-22T00:00:00.000Z')`,
  );

  const vocabRow = getItem.get(vocabId) as Record<string, string>;
  insertVi.run(
    'tr-vocab-meaning',
    vocabRow.item_id,
    'meaning',
    'học sinh',
    'dictionary',
    vocabRow.source_id,
    vocabRow.release_id,
    'vocab-meaning',
    vocabRow.source_hash,
  );

  const kanjiId = String(
    (db.prepare("SELECT item_id FROM kanji WHERE character='学'").get() as { item_id: string })
      .item_id,
  );
  const kanjiRow = getItem.get(kanjiId) as Record<string, string>;
  insertVi.run(
    'tr-kanji-hv',
    kanjiRow.item_id,
    'han_viet',
    'HỌC',
    'han_viet',
    kanjiRow.source_id,
    kanjiRow.release_id,
    'kanji-hv',
    kanjiRow.source_hash,
  );
  insertVi.run(
    'tr-kanji-meaning',
    kanjiRow.item_id,
    'meaning',
    'học tập',
    'dictionary',
    kanjiRow.source_id,
    kanjiRow.release_id,
    'kanji-meaning',
    kanjiRow.source_hash,
  );

  const grammarId = String(
    (db.prepare('SELECT item_id FROM grammar ORDER BY item_id LIMIT 1').get() as { item_id: string })
      .item_id,
  );
  const grammarRow = getItem.get(grammarId) as Record<string, string>;
  insertVi.run(
    'tr-grammar-meaning',
    grammarRow.item_id,
    'meaning',
    'trợ từ chủ đề',
    'machine',
    grammarRow.source_id,
    grammarRow.release_id,
    'grammar-meaning',
    grammarRow.source_hash,
  );

  return {
    vocabId,
    kanjiId,
    grammarId,
    ids: {
      vocabMeaning: 'tr-vocab-meaning',
      kanjiHv: 'tr-kanji-hv',
      kanjiMeaning: 'tr-kanji-meaning',
      grammarMeaning: 'tr-grammar-meaning',
    },
  };
}

test('selectedTranslation and all route repositories propagate translationId on Vietnamese lines', async (t) => {
  const { db, itemId } = fixture(t);
  const seeded = seedSyntheticTranslations(db, itemId);

  const vocabMeaning = selectedTranslation(db, seeded.vocabId, 'meaning');
  assert.equal(vocabMeaning?.translationId, seeded.ids.vocabMeaning);

  // Search results (vocab, kanji, grammar)
  const searchVocab = searchAllKinds(db, '学生', { youtubeFile: '' });
  const vocabHit = searchVocab.groups.vocab.items.find((i) => i.id === seeded.vocabId);
  assert.equal(vocabHit?.meaning?.translationId, seeded.ids.vocabMeaning);

  const searchK = searchAllKinds(db, '学', { youtubeFile: '' });
  const kanjiHit = searchK.groups.kanji.items.find((i) => i.title === '学');
  assert.equal(kanjiHit?.hanViet?.translationId, seeded.ids.kanjiHv);
  assert.equal(kanjiHit?.meaning?.translationId, seeded.ids.kanjiMeaning);

  // Lookup popup payload (vocab meaning + kanjiHanViet)
  const lookup = lookupWord(db, '学生');
  assert.equal(lookup.found, true);
  assert.equal(lookup.item?.meaning?.translationId, seeded.ids.vocabMeaning);
  const gakuHv = lookup.item?.kanjiHanViet.find((k) => k.character === '学');
  assert.equal(gakuHv?.hanViet.translationId, seeded.ids.kanjiHv);

  // Kanji list & detail (including related vocab)
  const kanjiList = searchKanji(db, { q: '学', level: '', strokes: null, radicals: [], page: 1 });
  const gakuItem = kanjiList.items.find((k) => k.character === '学');
  assert.equal(gakuItem?.hanViet?.translationId, seeded.ids.kanjiHv);
  assert.equal(gakuItem?.meaning?.translationId, seeded.ids.kanjiMeaning);

  const detail = kanjiDetail(db, '学');
  assert.ok(detail);
  const relatedGakusei = detail.related.find((w) => w.id === seeded.vocabId);
  assert.equal(relatedGakusei?.meaning?.translationId, seeded.ids.vocabMeaning);

  // Grammar list & detail
  const grammarList = listGrammar(db);
  const grammarItem = grammarList.items.find((g) => g.id === seeded.grammarId);
  assert.equal(grammarItem?.meaningVi?.translationId, seeded.ids.grammarMeaning);
  assert.equal(grammarItem?.meaningVi?.id, seeded.ids.grammarMeaning);

  const grammarDet = getGrammar(db, seeded.grammarId);
  assert.equal(grammarDet?.meaningVi?.translationId, seeded.ids.grammarMeaning);

  // Kanji lesson
  const lessonKanji = newLessonKanji(db, 10);
  const lessonGaku = lessonKanji.find((k) => k.character === '学');
  assert.equal(lessonGaku?.hanViet?.translationId, seeded.ids.kanjiHv);
  assert.equal(lessonGaku?.meaning?.translationId, seeded.ids.kanjiMeaning);

  // Vocab notebook & SRS review session
  db.prepare(
    `INSERT INTO srs_cards(card_id, item_id, card_type, state_json, scheduler_version, due_at, updated_at)
     VALUES('card-report-test', ?, 'recognition', '{"status":"new"}', 'pending:g1/srs', '2026-11-22T00:00:00.000Z', '2026-11-22T00:00:00.000Z')`,
  ).run(seeded.vocabId);

  const notebook = listVocabNotebook(db);
  const nbEntry = notebook.items.find((entry) => entry.id === seeded.vocabId);
  assert.equal(nbEntry?.meaning?.translationId, seeded.ids.vocabMeaning);

  const engine = await scheduler();
  const srs = srsSession(db, engine, 'full', new Date('2026-11-22T12:00:00.000Z'));
  const srsCard = srs.cards.find((c) => c.itemId === seeded.vocabId);
  assert.equal(srsCard?.vietnamese?.translationId, seeded.ids.vocabMeaning);
});

test('POST /api/common-tools/reports marks translation without modifying vi_translations and is idempotent', async (t) => {
  const { db, file, itemId } = fixture(t);
  const seeded = seedSyntheticTranslations(db, itemId);

  const beforeSnapshot = JSON.stringify(
    db.prepare('SELECT * FROM vi_translations ORDER BY translation_id').all(),
  );

  const translationId = seeded.ids.vocabMeaning;

  // First click -> 201 Created
  const res1 = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ translationId }),
    }),
    makeDeps(file),
  );
  assert.equal(res1.status, 201);
  assert.equal(res1.headers.get('set-cookie'), null);
  assert.equal(res1.headers.get('cache-control'), 'private, no-store');
  assert.equal(res1.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  const body1 = (await res1.json()) as { reportId: string; translationId: string; created: boolean };
  assert.equal(body1.created, true);
  assert.equal(body1.translationId, translationId);
  assert.ok(body1.reportId.length > 0);

  // Verify DB row & reportQueue visibility
  const rowsAfterFirst = db
    .prepare(
      'SELECT report_id, translation_id, reason, status FROM translation_reports WHERE translation_id=?',
    )
    .all(translationId) as Array<Record<string, unknown>>;
  assert.equal(rowsAfterFirst.length, 1);
  assert.equal(rowsAfterFirst[0].report_id, body1.reportId);
  assert.equal(rowsAfterFirst[0].reason, DEFAULT_REPORT_REASON);
  assert.equal(rowsAfterFirst[0].status, 'open');

  const queue = reportQueue(db);
  assert.ok(
    queue.some((q) => q.id === body1.reportId && q.reason === DEFAULT_REPORT_REASON),
    'marked line should appear in /common-tools/reports queue',
  );

  // Second click (duplicate) -> 200 OK, idempotent, still exactly 1 row!
  const res2 = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ translationId }),
    }),
    makeDeps(file, { now: () => new Date('2026-11-22T09:05:00.000Z') }),
  );
  assert.equal(res2.status, 200);
  const body2 = (await res2.json()) as { reportId: string; translationId: string; created: boolean };
  assert.equal(body2.created, false);
  assert.equal(body2.reportId, body1.reportId);

  const countAfterSecond = Number(
    db
      .prepare('SELECT count(*) n FROM translation_reports WHERE translation_id=?')
      .get(translationId)!.n,
  );
  assert.equal(countAfterSecond, 1, 'duplicate click must not create a second report row');

  // Verify marking works across kanji & grammar too, and is idempotent
  for (const id of [seeded.ids.kanjiHv, seeded.ids.kanjiMeaning, seeded.ids.grammarMeaning]) {
    const marked = markTranslationReport(file, id);
    assert.equal(marked.created, true, `should mark ${id}`);
    const dup = markTranslationReport(file, id);
    assert.equal(dup.created, false, `repeat mark on ${id} should be idempotent`);
    assert.equal(dup.reportId, marked.reportId);
  }

  // Verify vi_translations was NEVER mutated
  const afterSnapshot = JSON.stringify(
    db.prepare('SELECT * FROM vi_translations ORDER BY translation_id').all(),
  );
  assert.equal(afterSnapshot, beforeSnapshot, 'marking a report must never modify vi_translations');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('POST /api/common-tools/reports blocks unauthenticated, CSRF, invalid, and stale requests', async (t) => {
  const { db, file, itemId } = fixture(t);
  const seeded = seedSyntheticTranslations(db, itemId);
  const validId = seeded.ids.vocabMeaning;

  // 1. Unauthenticated -> 401, no Set-Cookie
  const unauth = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ translationId: validId }),
    }),
    makeDeps(file, { isAuthenticated: async () => false }),
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauth.headers.get('set-cookie'), null);
  assert.equal(unauth.headers.get('cache-control'), 'private, no-store');

  // 2. Cross-origin CSRF -> 403
  const csrf = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ translationId: validId }),
    }),
    makeDeps(file, { sameOriginCheck: () => false }),
  );
  assert.equal(csrf.status, 403);
  assert.equal(csrf.headers.get('set-cookie'), null);

  // 3. Body too large -> 413
  const tooLarge = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      body: '{}',
    }),
    makeDeps(file, {
      readBody: async () => {
        throw new Error('BODY_TOO_LARGE');
      },
    }),
  );
  assert.equal(tooLarge.status, 413);

  // 4. Invalid JSON / missing translationId / short custom reason -> 400
  const badJson = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      body: 'not-json',
    }),
    makeDeps(file),
  );
  assert.equal(badJson.status, 400);

  const missingId = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      body: JSON.stringify({ translationId: '   ' }),
    }),
    makeDeps(file),
  );
  assert.equal(missingId.status, 400);

  const shortReason = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      body: JSON.stringify({ translationId: validId, reason: 'ab' }),
    }),
    makeDeps(file),
  );
  assert.equal(shortReason.status, 400);

  // 5. Unknown / stale / non-selected translation -> 404
  const unknown = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      body: JSON.stringify({ translationId: 'does-not-exist' }),
    }),
    makeDeps(file),
  );
  assert.equal(unknown.status, 404);

  db.prepare('UPDATE vi_translations SET needs_refresh=1 WHERE translation_id=?').run(validId);
  const stale = await handleReportPost(
    new Request('http://127.0.0.1:3000/api/common-tools/reports', {
      method: 'POST',
      body: JSON.stringify({ translationId: validId }),
    }),
    makeDeps(file),
  );
  assert.equal(stale.status, 404);

  // Confirm 0 rows written by any rejected request
  assert.equal(
    Number(db.prepare('SELECT count(*) n FROM translation_reports').get()!.n),
    0,
    'rejected requests must not write any report rows',
  );
});

test('proxy blocks unauthenticated POST /api/common-tools/reports with 401 and allows authenticated', async (t) => {
  const prevSecret = process.env.SESSION_SECRET;
  const prevHash = process.env.NIHON_PASSWORD_HASH;
  const prevOrigin = process.env.APP_ORIGIN;
  const secret = 'b'.repeat(64);
  process.env.SESSION_SECRET = secret;
  process.env.NIHON_PASSWORD_HASH = await hashPassword('test-password-123');
  process.env.APP_ORIGIN = 'http://127.0.0.1:3000';
  t.after(() => {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevHash === undefined) delete process.env.NIHON_PASSWORD_HASH;
    else process.env.NIHON_PASSWORD_HASH = prevHash;
    if (prevOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = prevOrigin;
  });

  const unauthReq = new NextRequest('http://127.0.0.1:3000/api/common-tools/reports', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3000' },
  });
  const unauthRes = await proxy(unauthReq);
  assert.equal(unauthRes.status, 401);
  assert.equal(unauthRes.headers.get('set-cookie'), null);

  const token = await createSession(secret);
  const authReq = new NextRequest('http://127.0.0.1:3000/api/common-tools/reports', {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:3000',
      cookie: `${SESSION_COOKIE}=${token}`,
    },
  });
  const authRes = await proxy(authReq);
  assert.equal(authRes.status, 200);
});

test('ReportViButton renders one-click mark button without edit inputs, and hides when Vietnamese is absent', () => {
  const defaultBtn = renderToStaticMarkup(
    React.createElement(ReportViButton, { translationId: 'tr-vocab-1' }),
  );
  assert.match(defaultBtn, /data-report-translation="tr-vocab-1"/);
  assert.match(defaultBtn, /class="quiet-button"/);
  assert.match(defaultBtn, />Báo sai</);
  assert.doesNotMatch(defaultBtn, /<textarea|<input/i, 'mark-only button must not require editing');

  const labeledBtn = renderToStaticMarkup(
    React.createElement(ReportViButton, { translationId: 'tr-hv-1', label: 'Hán Việt' }),
  );
  assert.match(labeledBtn, /data-report-translation="tr-hv-1"/);
  assert.match(labeledBtn, />Báo sai Hán Việt</);

  // Kanji lesson card with Vietnamese vs without Vietnamese
  const withVi = renderToStaticMarkup(
    React.createElement(KanjiCardBody, {
      item: {
        id: 'k-1',
        character: '日',
        level: 'N5',
        strokes: 4,
        radical: '日',
        onyomi: ['ニチ'],
        kunyomi: ['ひ'],
        english: ['day', 'sun'],
        hanViet: makeTranslation('tr-kanji-hv', 'NHẬT'),
        meaning: makeTranslation('tr-kanji-meaning', 'ngày, mặt trời'),
        alternatives: [],
        words: [],
      },
    }),
  );
  assert.match(withVi, /data-report-translation="tr-kanji-hv"/);
  assert.match(withVi, /data-report-translation="tr-kanji-meaning"/);

  const withoutVi = renderToStaticMarkup(
    React.createElement(KanjiCardBody, {
      item: {
        id: 'k-2',
        character: '学',
        level: 'N5',
        strokes: 8,
        radical: '子',
        onyomi: ['ガク'],
        kunyomi: ['まな.ぶ'],
        english: ['study'],
        hanViet: null,
        meaning: null,
        alternatives: [],
        words: [],
      },
    }),
  );
  assert.doesNotMatch(
    withoutVi,
    /data-report-translation=/,
    'English-only kanji card must not render Báo sai button',
  );

  // Kanji lesson related word with Vietnamese vs without Vietnamese
  const wordWithVi = renderToStaticMarkup(
    React.createElement(KanjiWordBody, {
      index: 0,
      word: {
        id: 'v-1',
        word: '学生',
        reading: 'がくせい',
        level: 'N5',
        english: ['student'],
        meaning: makeTranslation('tr-word-1', 'học sinh'),
        studied: false,
      },
    }),
  );
  assert.match(wordWithVi, /data-report-translation="tr-word-1"/);

  const wordWithoutVi = renderToStaticMarkup(
    React.createElement(KanjiWordBody, {
      index: 0,
      word: {
        id: 'v-2',
        word: '日本',
        reading: 'にほん',
        level: 'N5',
        english: ['Japan'],
        meaning: null,
        studied: false,
      },
    }),
  );
  assert.doesNotMatch(
    wordWithoutVi,
    /data-report-translation=/,
    'English-only related word must not render Báo sai button',
  );
});

test('every Vietnamese line surface across common-tools, vocab, kanji, grammar, and SRS wires Báo sai', () => {
  const wiredFiles: Array<{ file: string; markers: RegExp[] }> = [
    {
      file: 'src/app/(study)/common-tools/search/page.tsx',
      markers: [
        /item\.hanViet\.translationId[\s\S]*?<ReportViButton/,
        /item\.meaning\?\.translationId[\s\S]*?<ReportViButton/,
      ],
    },
    {
      file: 'src/app/(study)/common-tools/lookup-popup.tsx',
      markers: [
        /activeItem\.hanViet\.translationId[\s\S]*?<ReportViButton/,
        /entry\.hanViet\.translationId[\s\S]*?<ReportViButton/,
        /activeItem\.meaning\.translationId[\s\S]*?<ReportViButton/,
      ],
    },
    {
      file: 'src/app/(study)/vocab/page.tsx',
      markers: [/item\.meaningId[\s\S]*?<ReportTranslation/],
    },
    {
      file: 'src/app/(study)/vocab/[id]/page.tsx',
      markers: [
        /item\.meaningId[\s\S]*?<ReportTranslation/,
        /item\.hanVietId[\s\S]*?<ReportTranslation/,
        /example\.translationId[\s\S]*?<ReportTranslation/,
      ],
    },
    {
      file: 'src/app/(study)/vocab/lesson/example-body.tsx',
      markers: [
        /example\.translationId[\s\S]*?<ReportTranslation/,
        /item\.meaningId[\s\S]*?<ReportTranslation/,
      ],
    },
    {
      file: 'src/app/(study)/vocab/notebook/page.tsx',
      markers: [/entry\.meaning\?\.translationId[\s\S]*?<ReportViButton/],
    },
    {
      file: 'src/app/(study)/vocab/lesson/kanji/card-body.tsx',
      markers: [
        /item\.hanViet\?\.translationId[\s\S]*?<ReportViButton/,
        /item\.meaning\?\.translationId[\s\S]*?<ReportViButton/,
        /word\.meaning\?\.translationId[\s\S]*?<ReportViButton/,
      ],
    },
    {
      file: 'src/app/(study)/kanji/page.tsx',
      markers: [
        /item\.hanViet\?\.translationId[\s\S]*?<ReportViButton/,
        /item\.meaning\?\.translationId[\s\S]*?<ReportViButton/,
      ],
    },
    {
      file: 'src/app/(study)/kanji/[character]/page.tsx',
      markers: [
        /item\.hanVietId[\s\S]*?<ReportForm/,
        /item\.meaningId[\s\S]*?<ReportForm/,
        /<article className=\{styles\.word\}[\s\S]*?word\.meaning\?\.translationId[\s\S]*?<ReportViButton/,
      ],
    },
    {
      file: 'src/app/(study)/grammar/page.tsx',
      markers: [/meaningId && <ReportViButton/],
    },
    {
      file: 'src/app/(study)/grammar/[id]/page.tsx',
      markers: [
        /value\.id && <ReportForm/,
        /noteViId && <ReportViButton/,
        /<article className=\{styles\.relatedCard\}[\s\S]*?relatedMeaningId && <ReportViButton/,
      ],
    },
    {
      file: 'src/app/(study)/srs/review-session.tsx',
      markers: [
        /online&&card\.hanViet\.translationId&&<ReportViButton/,
        /online&&card\.vietnamese\?\.translationId&&<ReportViButton/,
      ],
    },
  ];

  for (const { file, markers } of wiredFiles) {
    const source = fs.readFileSync(path.resolve(file), 'utf8');
    for (const marker of markers) {
      assert.match(source, marker, `${file} should wire ${marker}`);
    }
  }
});
