import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './helpers.ts';
import { tokenizeJapaneseSentence, tokenizeClipSegments } from '../src/app/(study)/common-tools/tokenize.ts';
import { lookupWord, isDisallowedMeaningSource } from '../src/app/(study)/common-tools/lookup.ts';
import {
  handleLookupGet,
  handleLookupPost,
  type LookupHandlerDeps,
} from '../src/app/(study)/common-tools/lookup-handler.ts';
import {
  readLookupSentenceStore,
  saveLookupItemToSrs,
} from '../src/app/(study)/common-tools/lookup-store.ts';
import {
  fallbackSegmentTokens,
  formatLookupKind,
  formatLookupSourceLabel,
  resolveFocusTrapTarget,
} from '../src/app/(study)/common-tools/lookup-popup-model.ts';
import { hydrate, scheduler } from '../src/app/(study)/srs/model.ts';

function makeDeps(
  file: string,
  contextPath: string,
  overrides: Partial<LookupHandlerDeps> = {},
): LookupHandlerDeps {
  return {
    isAuthenticated: async () => true,
    sameOriginCheck: () => true,
    readBody: async (request) => request.text(),
    dbPath: file,
    contextPath,
    now: () => new Date('2026-11-21T10:00:00.000Z'),
    ...overrides,
  };
}

test('server tokenizer segments Japanese sentences with lemmas and preserves exact text', async () => {
  const sentences = [
    '今日はいい天気ですね。',
    '私は学生です。',
    '毎朝パンを食べました。',
  ];
  for (const sentence of sentences) {
    const tokens = await tokenizeJapaneseSentence(sentence);
    assert.equal(tokens.map((t) => t.surface).join(''), sentence);
    assert.ok(tokens.length >= 3, `expected multiple tokens for ${sentence}`);
    const period = tokens.at(-1)!;
    assert.equal(period.surface, '。');
    assert.equal(period.clickable, false);
  }

  const eatTokens = await tokenizeJapaneseSentence('毎朝パンを食べました。');
  const tabe = eatTokens.find((t) => t.surface === '食べ');
  assert.ok(tabe, 'expected 食べ token from kuromoji');
  assert.equal(tabe.base, '食べる');
  assert.equal(tabe.clickable, true);

  const segments = await tokenizeClipSegments([
    { id: 's1', start: 0, end: 3, ja: '今日はいい天気ですね。', kana: 'きょうはいいてんきですね。', speaker: null, vi: 'Hôm nay trời đẹp nhỉ.' },
  ]);
  assert.ok(segments[0].tokens && segments[0].tokens.length > 0);
  assert.ok(segments[0].kanaTokens && segments[0].kanaTokens.length > 0);
});

test('GET /api/common-tools/lookup enforces auth, no Set-Cookie, hit/miss, and read-only DB', async (t) => {
  const { db, file, itemId } = fixture(t);
  const contextPath = path.join(path.dirname(file), 'lookup-sentences.json');

  // 1. Unauthenticated -> 401, no Set-Cookie
  const unauth = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=' + encodeURIComponent('学生')),
    makeDeps(file, contextPath, { isAuthenticated: async () => false }),
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauth.headers.get('set-cookie'), null);
  assert.equal(unauth.headers.get('cache-control'), 'private, no-store');

  // 2. Empty query -> 400
  const empty = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=%20%20'),
    makeDeps(file, contextPath),
  );
  assert.equal(empty.status, 400);
  assert.equal(empty.headers.get('set-cookie'), null);

  // 3. Exact vocab hit
  const hitRes = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=' + encodeURIComponent('学生')),
    makeDeps(file, contextPath),
  );
  assert.equal(hitRes.status, 200);
  assert.equal(hitRes.headers.get('set-cookie'), null);
  const hit = await hitRes.json();
  assert.equal(hit.found, true);
  assert.equal(hit.item.id, itemId);
  assert.equal(hit.item.title, '学生');
  assert.equal(hit.item.reading, 'がくせい');
  assert.equal(hit.item.level, 'N5');
  assert.deepEqual(hit.item.english, ['student']);
  assert.equal(hit.item.sourceName, 'OpenJLPT');
  assert.equal(hit.item.inSrs, false);

  // 4. Conjugated surface + lemma base hit
  const lemmaRes = await handleLookupGet(
    new Request(
      'http://127.0.0.1:3000/api/common-tools/lookup?q=' +
        encodeURIComponent('食べ') +
        '&base=' +
        encodeURIComponent('食べる'),
    ),
    makeDeps(file, contextPath),
  );
  const lemma = await lemmaRes.json();
  assert.equal(lemma.found, true);
  assert.equal(lemma.item.title, '食べる');
  assert.equal(lemma.item.reading, 'たべる');
  assert.equal(lemma.item.matchedBy, 'lemma');

  // 5. Constituent kanji fallback when compound not in demo vocab
  const kanjiFallbackRes = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=' + encodeURIComponent('今日')),
    makeDeps(file, contextPath),
  );
  const kanjiFallback = await kanjiFallbackRes.json();
  assert.equal(kanjiFallback.found, true);
  assert.equal(kanjiFallback.item.kind, 'kanji');
  assert.equal(kanjiFallback.item.title, '日');
  assert.equal(kanjiFallback.item.matchedBy, 'kanji_fallback');
  assert.ok(kanjiFallback.item.reading.includes('ニチ'));

  // 6. Miss
  const missRes = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=' + encodeURIComponent('存在しない語')),
    makeDeps(file, contextPath),
  );
  assert.equal(missRes.status, 200);
  assert.equal(missRes.headers.get('set-cookie'), null);
  const miss = await missRes.json();
  assert.equal(miss.found, false);
  assert.equal(miss.item, null);
  assert.deepEqual(miss.alternatives, []);

  // 7. Read-only guarantee: viewing/looking up NEVER writes srs_cards or context store
  const cardCount = Number(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n);
  assert.equal(cardCount, 0);
  assert.equal(fs.existsSync(contextPath), false);
});

test('lookup returns valid Vietnamese meaning + Hán Việt provenance and NEVER uses KanjiDictVN for meaning', (t) => {
  const { db, itemId } = fixture(t);
  const vocabRow = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!;
  const kanjiRow = db
    .prepare("SELECT i.* FROM content_items i JOIN kanji k USING(item_id) WHERE k.character='学'")
    .get()!;

  // Seed KanjiDictVN data source + release
  const fakeChecksum = 'a'.repeat(64);
  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,version,checksum,attribution,usage_scope) VALUES('kanjidictvn','KanjiDictVN','https://example.invalid','MIT','1',?,'KanjiDictVN','redistributable')",
  ).run(fakeChecksum);
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('kanjidictvn:v1','kanjidictvn','1',?,'https://example.invalid','2026-11-21','MIT','KanjiDictVN','{}')",
  ).run(fakeChecksum);

  // KanjiDictVN for han_viet IS allowed; KanjiDictVN for meaning MUST be excluded!
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('kdv-hv',?,'han_viet','HỌC','han_viet','kanjidictvn','kanjidictvn:v1','U+5B66',?,'selected','codepoint','2026-11-21')",
  ).run(kanjiRow.item_id, kanjiRow.source_hash);
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('kdv-meaning',?,'meaning','nghĩa sai từ KanjiDictVN','dictionary','kanjidictvn','kanjidictvn:v1','U+5B66',?,'selected','codepoint','2026-11-21')",
  ).run(kanjiRow.item_id, kanjiRow.source_hash);

  const kanjiLookup = lookupWord(db, '学');
  assert.equal(kanjiLookup.found, true);
  assert.equal(kanjiLookup.item!.hanViet?.text, 'HỌC');
  assert.equal(kanjiLookup.item!.hanViet?.sourceName, 'KanjiDictVN');
  assert.equal(kanjiLookup.item!.meaning, null, 'KanjiDictVN meaning must NEVER be returned');
  assert.equal(isDisallowedMeaningSource({
    text: 'x',
    sourceId: 'kanjidictvn',
    sourceName: 'KanjiDictVN',
    releaseId: 'r',
    method: 'dictionary',
    model: null,
    promptVersion: null,
    autoSelected: false,
  }), true);

  // Valid dictionary/machine Vietnamese meaning on vocab IS returned, plus constituent kanji Hán Việt
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('vocab-vi',?,'meaning','học sinh, sinh viên','dictionary','openjlpt',?,'v-gakusei',?,'selected','word','2026-11-21')",
  ).run(itemId, vocabRow.release_id, vocabRow.source_hash);

  const vocabLookup = lookupWord(db, '学生');
  assert.equal(vocabLookup.found, true);
  assert.equal(vocabLookup.item!.meaning?.text, 'học sinh, sinh viên');
  assert.equal(vocabLookup.item!.meaning?.method, 'dictionary');
  assert.equal(vocabLookup.item!.kanjiHanViet.length, 1);
  assert.equal(vocabLookup.item!.kanjiHanViet[0].character, '学');
  assert.equal(vocabLookup.item!.kanjiHanViet[0].hanViet.text, 'HỌC');
});

test('POST /api/common-tools/lookup saves to SRS with original sentence ONLY when explicitly triggered', async (t) => {
  const { db, file, itemId } = fixture(t);
  const contextPath = path.join(path.dirname(file), 'lookup-sentences.json');

  // Unauthenticated POST -> 401, nothing saved
  const unauth = await handleLookupPost(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, sentenceJa: '私は学生です。' }),
    }),
    makeDeps(file, contextPath, { isAuthenticated: async () => false }),
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauth.headers.get('set-cookie'), null);

  // Cross-origin POST -> 403, nothing saved
  const crossOrigin = await handleLookupPost(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, sentenceJa: '私は学生です。' }),
    }),
    makeDeps(file, contextPath, { sameOriginCheck: () => false }),
  );
  assert.equal(crossOrigin.status, 403);

  // Missing original sentence -> 400, nothing saved
  const missingSentence = await handleLookupPost(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, sentenceJa: '   ' }),
    }),
    makeDeps(file, contextPath),
  );
  assert.equal(missingSentence.status, 400);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n), 0);

  // Explicit save click -> 201, writes srs_cards + lookup-sentences.json
  const firstSave = await handleLookupPost(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        cardType: 'recognition',
        sentenceJa: '私は学生です。',
        sentenceVi: 'Tôi là học sinh.',
        sourceClipId: 'demo',
      }),
    }),
    makeDeps(file, contextPath),
  );
  assert.equal(firstSave.status, 201);
  assert.equal(firstSave.headers.get('set-cookie'), null);
  const saved = await firstSave.json();
  assert.equal(saved.created, true);
  assert.equal(saved.sentence.sentenceJa, '私は学生です。');
  assert.equal(saved.sentence.sentenceVi, 'Tôi là học sinh.');
  assert.equal(saved.sentence.sourceClipId, 'demo');

  // Verify SQLite row stays 100% compatible with SRS hydrate() (no schema/state_json breakage)
  const checkDb = new DatabaseSync(file, { readOnly: true });
  try {
    const row = checkDb
      .prepare('SELECT card_id, item_id, card_type, state_json, scheduler_version, due_at, updated_at FROM srs_cards WHERE item_id=?')
      .get(itemId)!;
    assert.equal(String(row.state_json), '{"status":"new"}');
    assert.equal(String(row.scheduler_version), 'pending:g1/srs');
    const engine = await scheduler();
    const memory = hydrate(
      {
        cardId: String(row.card_id),
        stateJson: String(row.state_json),
        schedulerVersion: String(row.scheduler_version),
        dueAt: String(row.due_at),
        updatedAt: String(row.updated_at),
      },
      engine,
    );
    assert.equal(memory.reps, 0);
  } finally {
    checkDb.close();
  }

  // Verify persisted sentence store
  const store = readLookupSentenceStore(contextPath);
  assert.equal(store.entries[saved.cardId].sentenceJa, '私は学生です。');
  assert.equal(store.entries[saved.cardId].sentenceVi, 'Tôi là học sinh.');

  // Second save click on same item -> 200 deduplicated card, updated sentence
  const secondSave = saveLookupItemToSrs({
    dbPath: file,
    contextPath,
    itemId,
    cardType: 'recognition',
    sentenceJa: '学生が本を読みます。',
    sentenceVi: null,
    sourceClipId: 'clip-2',
    now: new Date('2026-11-21T10:05:00.000Z'),
  });
  assert.equal(secondSave.created, false);
  assert.equal(secondSave.cardId, saved.cardId);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n), 1);
  assert.equal(readLookupSentenceStore(contextPath).entries[saved.cardId].sentenceJa, '学生が本を読みます。');

  // Subsequent GET reflects inSrs=true and savedSentence
  const afterGet = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=' + encodeURIComponent('学生')),
    makeDeps(file, contextPath),
  );
  const afterData = await afterGet.json();
  assert.equal(afterData.item.inSrs, true);
  assert.equal(afterData.item.savedSentence.sentenceJa, '学生が本を読みます。');
});

test('popup client model handles focus trap, source labels, fallback segmentation, and zero server-only imports', () => {
  // Focus trap wrap-around logic
  assert.equal(resolveFocusTrapTarget(0, 0, false), null);
  assert.equal(resolveFocusTrapTarget(3, 2, false), 0);
  assert.equal(resolveFocusTrapTarget(3, -1, false), 0);
  assert.equal(resolveFocusTrapTarget(3, 1, false), null);
  assert.equal(resolveFocusTrapTarget(3, 0, true), 2);
  assert.equal(resolveFocusTrapTarget(3, -1, true), 2);
  assert.equal(resolveFocusTrapTarget(3, 2, true), null);

  // Kind & source labels
  assert.equal(formatLookupKind('vocab'), 'Từ vựng');
  assert.equal(formatLookupKind('kanji'), 'Kanji');
  assert.equal(formatLookupKind('grammar'), 'Ngữ pháp');
  assert.equal(formatLookupSourceLabel(null, 'OpenJLPT'), 'Bản Anh · OpenJLPT');
  assert.equal(
    formatLookupSourceLabel({
      text: 'học sinh',
      sourceId: 'openjlpt',
      sourceName: 'JMdict',
      releaseId: 'r1',
      method: 'machine',
      model: 'gemini-2.5',
      promptVersion: null,
      autoSelected: false,
    }),
    'Dịch máy · JMdict · gemini-2.5',
  );
  assert.equal(
    formatLookupSourceLabel({
      text: 'HỌC',
      sourceId: 'kanjidictvn',
      sourceName: 'KanjiDictVN',
      releaseId: 'r1',
      method: 'han_viet',
      model: null,
      promptVersion: null,
      autoSelected: true,
    }),
    'Tự chọn · KanjiDictVN',
  );

  // Fallback token segmentation preserves text and marks punctuation non-clickable
  const tokens = fallbackSegmentTokens('今日はいい天気ですね。');
  assert.equal(tokens.map((t) => t.surface).join(''), '今日はいい天気ですね。');
  assert.equal(tokens.at(-1)!.clickable, false);
  assert.equal(tokens[0].clickable, true);

  // Static guard: client files must never import kuromoji, node:sqlite, or repository.ts
  for (const rel of [
    'src/app/(study)/common-tools/lookup-popup.tsx',
    'src/app/(study)/common-tools/lookup-popup-model.ts',
    'src/app/(study)/shadowing/player.tsx',
  ]) {
    const code = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.doesNotMatch(code, /kuromoji|node:sqlite|better-sqlite|repository\.ts/, `forbidden import in ${rel}`);
  }
});
