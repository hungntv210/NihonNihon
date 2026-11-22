import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seedDemo } from '../tools/seed-demo.ts';
import { kanjiDetail, kanjiDictVnOriginalMeaning } from '../src/app/(study)/kanji/repository.ts';
import { newLessonKanji } from '../src/app/(study)/vocab/lesson/kanji/model.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { KanjiCardBody } = await import('../src/app/(study)/vocab/lesson/kanji/card-body.tsx');

function setupKanjiFixture(t: test.TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-kanji-hvgoc-'));
  const dbPath = path.join(dir, 'demo.sqlite');
  seedDemo(dbPath);
  const db = new DatabaseSync(dbPath);
  t.after(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('kanjidictvn','KanjiDictVN','https://example.invalid','Test','KanjiDictVN','private_only'),('mt:test-kanji','Google Gemini','https://example.invalid','Test','MT','private_only')",
  ).run();
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('kdv-r1','kanjidictvn','1',?,'local://kdv','2026-11-22','Test','KanjiDictVN','{}'),('mt-r1','mt:test-kanji','1',?,'local://mt','2026-11-22','Test','MT','{\"model\":\"test\",\"prompt_version\":\"v1\"}')",
  ).run('a'.repeat(64), 'b'.repeat(64));

  const kanjis = db
    .prepare(
      `SELECT k.character, i.item_id, i.source_hash
       FROM kanji k
       JOIN content_items i USING(item_id)
       WHERE i.is_active=1
       ORDER BY k.character
       LIMIT 3`,
    )
    .all() as { character: string; item_id: string; source_hash: string }[];
  assert.ok(kanjis.length >= 3, 'demo DB must seed at least 3 kanji');

  return { db, kanjis };
}

test('case 1: KanjiDictVN original meaning is returned alongside primary Hán Việt and Japanese meaning, with Báo sai button', (t) => {
  const { db, kanjis } = setupKanjiFixture(t);
  const target = kanjis[0];

  db.prepare(
    `INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
     VALUES
       ('hv-primary',?,'han_viet','nhật','han_viet','kanjidictvn','kdv-r1','hv1',?,'selected','codepoint','2026-11-22'),
       ('m-jp',?,'meaning','ngày; mặt trời','machine','mt:test-kanji','mt-r1','m-jp',?,'selected','machine_context','2026-11-22'),
       ('kdv-m-1',?,'meaning','mặt trời, ban ngày (gốc Hán)','dictionary','kanjidictvn','kdv-r1','m-kdv-1',?,'candidate','codepoint','2026-11-22')`,
  ).run(
    target.item_id,
    target.source_hash,
    target.item_id,
    target.source_hash,
    target.item_id,
    target.source_hash,
  );

  const detail = kanjiDetail(db, target.character);
  assert.ok(detail);
  // Primary Hán Việt & primary Japanese meaning remain completely unchanged
  assert.equal(detail.hanViet?.text, 'nhật');
  assert.equal(detail.meaning?.text, 'ngày; mặt trời');
  // Original Hán Việt meaning from KanjiDictVN is resolved with its translationId
  assert.equal(detail.hanVietOriginalMeaning?.translationId, 'kdv-m-1');
  assert.equal(detail.hanVietOriginalMeaning?.text, 'mặt trời, ban ngày (gốc Hán)');
  assert.equal(detail.hanVietOriginalMeaning?.sourceId, 'kanjidictvn');

  const lessons = newLessonKanji(db, 20);
  const lessonItem = lessons.find((item) => item.id === target.item_id);
  assert.ok(lessonItem);
  assert.equal(lessonItem.hanVietOriginalMeaning?.translationId, 'kdv-m-1');

  const html = renderToStaticMarkup(createElement(KanjiCardBody, { item: lessonItem }));
  assert.match(html, /Hán Việt gốc:/);
  assert.match(html, /mặt trời, ban ngày \(gốc Hán\)/);
  assert.match(html, /KanjiDictVN/);
  assert.match(html, /Báo sai/);
});

test('case 2: kanji without KanjiDictVN meaning returns null and hides the Hán Việt gốc line completely', (t) => {
  const { db, kanjis } = setupKanjiFixture(t);
  const target = kanjis[1];

  // Insert only han_viet from kanjidictvn + Japanese meaning from MT (no kanjidictvn meaning row)
  db.prepare(
    `INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
     VALUES
       ('hv-only',?,'han_viet','nhất','han_viet','kanjidictvn','kdv-r1','hv-only',?,'selected','codepoint','2026-11-22'),
       ('m-mt-only',?,'meaning','một','machine','mt:test-kanji','mt-r1','m-mt',?,'selected','machine_context','2026-11-22')`,
  ).run(target.item_id, target.source_hash, target.item_id, target.source_hash);

  const detail = kanjiDetail(db, target.character);
  assert.ok(detail);
  assert.equal(detail.hanViet?.text, 'nhất');
  assert.equal(detail.meaning?.text, 'một');
  assert.equal(detail.hanVietOriginalMeaning, null);

  const lessons = newLessonKanji(db, 20);
  const lessonItem = lessons.find((item) => item.id === target.item_id);
  assert.ok(lessonItem);
  assert.equal(lessonItem.hanVietOriginalMeaning, null);

  const html = renderToStaticMarkup(createElement(KanjiCardBody, { item: lessonItem }));
  assert.doesNotMatch(html, /Hán Việt gốc:/);
});

test('case 3: multiple KanjiDictVN meaning rows prefer selected over candidate, else earliest translation_id candidate', (t) => {
  const { db, kanjis } = setupKanjiFixture(t);
  const multiCandidate = kanjis[0];
  const withSelected = kanjis[1];

  // Kanji A: multiple candidate rows + one rejected/needs_review -> must pick earliest translation_id among candidates
  db.prepare(
    `INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
     VALUES
       ('kdv-00-rejected',?,'meaning','nghĩa bị loại','dictionary','kanjidictvn','kdv-r1','r0',?,'rejected','codepoint','2026-11-22'),
       ('kdv-02-cand',?,'meaning','nghĩa ứng viên 2','dictionary','kanjidictvn','kdv-r1','r2',?,'candidate','codepoint','2026-11-22'),
       ('kdv-01-cand',?,'meaning','nghĩa ứng viên 1','dictionary','kanjidictvn','kdv-r1','r1',?,'candidate','codepoint','2026-11-22')`,
  ).run(
    multiCandidate.item_id,
    multiCandidate.source_hash,
    multiCandidate.item_id,
    multiCandidate.source_hash,
    multiCandidate.item_id,
    multiCandidate.source_hash,
  );

  const pickedCandidate = kanjiDictVnOriginalMeaning(db, multiCandidate.item_id);
  assert.equal(pickedCandidate?.translationId, 'kdv-01-cand');
  assert.equal(pickedCandidate?.text, 'nghĩa ứng viên 1');

  // Kanji B: candidate with lexicographically smaller translation_id AND a selected row -> must prefer selected
  db.prepare(
    `INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
     VALUES
       ('kdv-a-cand',?,'meaning','nghĩa ứng viên A','dictionary','kanjidictvn','kdv-r1','ra',?,'candidate','codepoint','2026-11-22'),
       ('kdv-z-sel',?,'meaning','nghĩa đã chọn Z','dictionary','kanjidictvn','kdv-r1','rz',?,'selected','codepoint','2026-11-22')`,
  ).run(
    withSelected.item_id,
    withSelected.source_hash,
    withSelected.item_id,
    withSelected.source_hash,
  );

  const pickedSelected = kanjiDictVnOriginalMeaning(db, withSelected.item_id);
  assert.equal(pickedSelected?.translationId, 'kdv-z-sel');
  assert.equal(pickedSelected?.text, 'nghĩa đã chọn Z');
});
