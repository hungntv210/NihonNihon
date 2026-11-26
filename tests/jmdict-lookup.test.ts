import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { seedDemo } from '../tools/seed-demo.ts';
// @ts-expect-error ESM CLI/library module without separate .d.ts
import { importJmdict, sha256File } from '../tools/import-jmdict.mjs';
import { openContentDatabase } from '../src/core/content.ts';
import { enqueueCard } from '../src/core/review.ts';
import {
  JMDICT_ATTRIBUTION,
  JMDICT_LEVEL_LABEL,
  TU_DIEN_VI_ATTRIBUTION,
  getJmdictEntryById,
  lookupJmdictExact,
  searchJmdict,
} from '../src/core/jmdict.ts';
import { lookupWord } from '../src/app/(study)/common-tools/lookup.ts';
import { formatLookupSourceLabel } from '../src/app/(study)/common-tools/lookup-popup-model.ts';
import { handleLookupGet, handleLookupPost } from '../src/app/(study)/common-tools/lookup-handler.ts';
import { rebuildSearchIndex, searchAllKinds } from '../src/app/(study)/common-tools/repository.ts';
import { session as srsSession } from '../src/app/(study)/srs/repository.ts';
import { scheduler as srsScheduler } from '../src/app/(study)/srs/model.ts';

const SAMPLE_JMDICT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JMdict created: 2026-11-26 -->
<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY v5r "Godan verb with 'ru' ending">
]>
<JMdict>
<entry>
  <ent_seq>1207600</ent_seq>
  <k_ele><keb>学生</keb><ke_pri>ichi1</ke_pri></k_ele>
  <r_ele><reb>がくせい</reb><re_pri>ichi1</re_pri></r_ele>
  <sense>
    <pos>&n;</pos>
    <gloss>student (esp. a university student)</gloss>
  </sense>
</entry>
<entry>
  <ent_seq>1465820</ent_seq>
  <k_ele><keb>日誌</keb><ke_pri>news1</ke_pri></k_ele>
  <r_ele><reb>にっし</reb><re_pri>news1</re_pri></r_ele>
  <sense>
    <pos>&n;</pos>
    <gloss>diary</gloss>
    <gloss>journal</gloss>
    <gloss>log</gloss>
  </sense>
</entry>
<entry>
  <ent_seq>1589350</ent_seq>
  <k_ele><keb>図書館</keb><ke_pri>ichi1</ke_pri></k_ele>
  <r_ele><reb>としょかん</reb><re_pri>ichi1</re_pri></r_ele>
  <sense>
    <pos>&n;</pos>
    <gloss>library</gloss>
  </sense>
</entry>
<entry>
  <ent_seq>1601234</ent_seq>
  <k_ele><keb>微風</keb></k_ele>
  <r_ele><reb>びふう</reb></r_ele>
  <sense>
    <pos>&n;</pos>
    <gloss>gentle breeze</gloss>
    <gloss>light wind</gloss>
  </sense>
</entry>
</JMdict>
`;

const SAMPLE_VI_CSV = [
  '"学生","[n] học sinh, sinh viên"',
  '"日誌","[n] nhật ký, sổ ghi chép\n[v] ghi nhật ký hằng ngày"',
  '"図書館","[n] thư viện"',
].join('\n');

const SAMPLE_JMDICT_JSON = JSON.stringify({
  version: '3.6.1',
  dictDate: '2026-11-26',
  words: [
    {
      id: '2000100',
      kanji: [{ text: '珈琲', common: true }],
      kana: [{ text: 'コーヒー', common: true }],
      sense: [
        {
          partOfSpeech: ['n'],
          gloss: [{ lang: 'eng', text: 'coffee' }],
        },
      ],
    },
  ],
});

function createFixtureDir(t: test.TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-jmdict-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function setupAppAndJmdict(t: test.TestContext, options?: { includeVi?: boolean }) {
  const dir = createFixtureDir(t);
  const appDbPath = path.join(dir, 'app.sqlite');
  seedDemo(appDbPath);

  // Add Hán Việt for 日 so constituent kanji lookup is verifiable on 日誌
  const appDb = new DatabaseSync(appDbPath);
  try {
    const kanjiRow = appDb
      .prepare(
        `SELECT i.item_id, i.source_hash FROM content_items i
         JOIN kanji k USING(item_id) WHERE k.character='日' LIMIT 1`,
      )
      .get() as { item_id: string; source_hash: string } | undefined;
    assert.ok(kanjiRow, 'demo seed should contain kanji 日');
    const checksum = 'c'.repeat(64);
    appDb
      .prepare(
        `INSERT INTO data_sources(source_id,name,url,license,version,checksum,attribution,usage_scope)
         VALUES('kanjidictvn-test','KanjiDictVN','https://example.invalid','MIT','1',?,'KanjiDictVN','redistributable')`,
      )
      .run(checksum);
    appDb
      .prepare(
        `INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json)
         VALUES('kvn-1','kanjidictvn-test','1',?,'local://test','2026-11-26','MIT','KanjiDictVN','{}')`,
      )
      .run(checksum);
    appDb
      .prepare(
        `INSERT INTO vi_translations(
          translation_id,item_id,field,text_vi,method,source_id,release_id,
          source_record_key,base_content_hash,status,match_method,created_at
        ) VALUES('hv-nhat',?,'han_viet','NHẬT','han_viet','kanjidictvn-test','kvn-1','U+65E5',?,'selected','codepoint','2026-11-26')`,
      )
      .run(kanjiRow.item_id, kanjiRow.source_hash);
  } finally {
    appDb.close();
  }

  const jmdictGz = path.join(dir, 'JMdict_e.gz');
  fs.writeFileSync(jmdictGz, zlib.gzipSync(Buffer.from(SAMPLE_JMDICT_XML, 'utf8')));

  let viCsvPath: string | undefined;
  if (options?.includeVi !== false) {
    viCsvPath = path.join(dir, 'tu-dien-nhat-viet.csv');
    fs.writeFileSync(viCsvPath, SAMPLE_VI_CSV, 'utf8');
  }

  const jmdictDbPath = path.join(dir, 'private', 'jmdict.sqlite');
  const summary = importJmdict({
    jmdictPath: jmdictGz,
    viPath: viCsvPath,
    targetPath: jmdictDbPath,
    expectedJmdictSha256: sha256File(jmdictGz),
    expectedViSha256: viCsvPath ? sha256File(viCsvPath) : undefined,
  });

  return { dir, appDbPath, jmdictDbPath, jmdictGz, viCsvPath, summary };
}

test('import-jmdict verifies SHA-256, guards app DB, supports XML/JSON, and is idempotent', (t) => {
  const { dir, appDbPath, jmdictDbPath, jmdictGz, viCsvPath, summary } = setupAppAndJmdict(t);

  assert.equal(summary.mode, 'apply');
  assert.equal(summary.version, '2026-11-26');
  assert.equal(summary.parsedEntries, 4);
  assert.equal(summary.inserted, 4);
  assert.equal(summary.updated, 0);
  assert.equal(summary.viMatchedCount, 3);
  assert.equal(summary.totalEntries, 4);

  // SHA-256 mismatch is rejected
  assert.throws(
    () =>
      importJmdict({
        jmdictPath: jmdictGz,
        targetPath: jmdictDbPath,
        expectedJmdictSha256: '0'.repeat(64),
      }),
    /JMDICT_SHA256_MISMATCH/,
  );
  assert.throws(
    () =>
      importJmdict({
        jmdictPath: jmdictGz,
        viPath: viCsvPath,
        targetPath: jmdictDbPath,
        expectedViSha256: 'f'.repeat(64),
      }),
    /VI_SHA256_MISMATCH/,
  );

  // Refuses to target demo.sqlite or active NIHON_DB_PATH
  assert.throws(
    () =>
      importJmdict({
        jmdictPath: jmdictGz,
        targetPath: path.join(dir, 'demo.sqlite'),
      }),
    /REFUSING_TO_OVERWRITE_APP_DB/,
  );
  const prevEnv = process.env.NIHON_DB_PATH;
  process.env.NIHON_DB_PATH = appDbPath;
  try {
    assert.throws(
      () =>
        importJmdict({
          jmdictPath: jmdictGz,
          targetPath: appDbPath,
        }),
      /REFUSING_TO_OVERWRITE_APP_DB/,
    );
  } finally {
    if (prevEnv === undefined) delete process.env.NIHON_DB_PATH;
    else process.env.NIHON_DB_PATH = prevEnv;
  }

  // Dry-run does not create target file
  const dryTarget = path.join(dir, 'dry-should-not-exist.sqlite');
  const dry = importJmdict({
    jmdictPath: jmdictGz,
    viPath: viCsvPath,
    targetPath: dryTarget,
    dryRun: true,
  });
  assert.equal(dry.mode, 'dry-run');
  assert.equal(dry.parsedEntries, 4);
  assert.equal(fs.existsSync(dryTarget), false);

  // Idempotent second run produces 0 new inserts and exact same table/FTS counts
  const inspectCounts = () => {
    const db = new DatabaseSync(jmdictDbPath, { readOnly: true });
    try {
      return {
        entries: Number(db.prepare('SELECT count(*) c FROM jmdict_entries').get()!.c),
        forms: Number(db.prepare('SELECT count(*) c FROM jmdict_forms').get()!.c),
        fts: Number(db.prepare('SELECT count(*) c FROM jmdict_fts').get()!.c),
      };
    } finally {
      db.close();
    }
  };
  const before = inspectCounts();
  const second = importJmdict({
    jmdictPath: jmdictGz,
    viPath: viCsvPath,
    targetPath: jmdictDbPath,
  });
  const after = inspectCounts();
  assert.equal(second.inserted, 0);
  assert.equal(second.updated, 4);
  assert.equal(second.totalEntries, 4);
  assert.deepEqual(after, before);

  // Also supports jmdict-simplified JSON input
  const jsonFile = path.join(dir, 'jmdict-simplified.json');
  const jsonTarget = path.join(dir, 'jmdict-json.sqlite');
  fs.writeFileSync(jsonFile, SAMPLE_JMDICT_JSON, 'utf8');
  const jsonRes = importJmdict({ jmdictPath: jsonFile, targetPath: jsonTarget });
  assert.equal(jsonRes.parsedEntries, 1);
  assert.equal(jsonRes.version, '2026-11-26');
  const coffee = lookupJmdictExact(jsonTarget, ['珈琲']);
  assert.ok(coffee);
  assert.equal(coffee.items.length, 1);
  assert.equal(coffee.items[0].word, '珈琲');
  assert.equal(coffee.items[0].reading, 'コーヒー');
  assert.deepEqual(coffee.items[0].meaningsEn, ['coffee']);
});

test('lookupWord prioritizes JLPT over JMdict, falls back to JMdict + tu-dien-nhat-viet, and labels EN-only', (t) => {
  const { appDbPath, jmdictDbPath } = setupAppAndJmdict(t);
  const db = openContentDatabase(appDbPath);
  try {
    // 1. Word in BOTH JLPT (demo.sqlite) and JMdict -> JLPT takes priority
    const jlptHit = lookupWord(db, '学生', '学生', undefined, { jmdictPath: jmdictDbPath });
    assert.equal(jlptHit.found, true);
    assert.ok(jlptHit.item);
    assert.notEqual(jlptHit.item.matchedBy, 'jmdict');
    assert.equal(jlptHit.item.outsideJlpt, undefined);
    assert.equal(jlptHit.item.level, 'N5');

    // 2. Outside-JLPT word WITH tu-dien-nhat-viet meaning + constituent kanji Hán Việt
    const viHit = lookupWord(db, '日誌', '日誌', undefined, { jmdictPath: jmdictDbPath });
    assert.equal(viHit.found, true);
    assert.ok(viHit.item);
    assert.equal(viHit.item.id, 'jmdict:vocab:1465820');
    assert.equal(viHit.item.matchedBy, 'jmdict');
    assert.equal(viHit.item.outsideJlpt, true);
    assert.equal(viHit.item.level, JMDICT_LEVEL_LABEL);
    assert.equal(viHit.item.reading, 'にっし');
    assert.ok(viHit.item.meaning);
    assert.equal(viHit.item.meaning.sourceId, TU_DIEN_VI_ATTRIBUTION.sourceId);
    assert.equal(viHit.item.meaning.sourceName, TU_DIEN_VI_ATTRIBUTION.name);
    assert.match(viHit.item.meaning.text, /nhật ký/i);
    assert.equal(
      formatLookupSourceLabel(viHit.item.meaning, viHit.item.sourceName),
      'Từ điển · tu-dien-nhat-viet',
    );
    assert.equal(formatLookupSourceLabel(null, viHit.item.sourceName), 'EN · JMdict');
    assert.equal(viHit.item.sourceName, JMDICT_ATTRIBUTION.name);
    assert.deepEqual(viHit.item.english, ['diary', 'journal', 'log']);
    assert.equal(viHit.item.kanjiHanViet.length, 1);
    assert.equal(viHit.item.kanjiHanViet[0].character, '日');
    assert.equal(viHit.item.kanjiHanViet[0].hanViet.text, 'NHẬT');

    // 3. Outside-JLPT word WITHOUT tu-dien-nhat-viet match -> EN · JMdict fallback
    const enOnly = lookupWord(db, '微風', '微風', undefined, { jmdictPath: jmdictDbPath });
    assert.equal(enOnly.found, true);
    assert.ok(enOnly.item);
    assert.equal(enOnly.item.id, 'jmdict:vocab:1601234');
    assert.equal(enOnly.item.matchedBy, 'jmdict');
    assert.equal(enOnly.item.outsideJlpt, true);
    assert.equal(enOnly.item.meaning, null);
    assert.deepEqual(enOnly.item.english, ['gentle breeze', 'light wind']);
    assert.equal(
      formatLookupSourceLabel(enOnly.item.meaning, enOnly.item.sourceName),
      'EN · JMdict',
    );

    // 4. Word not found in JLPT or JMdict
    const missing = lookupWord(db, 'ほげふがぴよ', null, undefined, { jmdictPath: jmdictDbPath });
    assert.equal(missing.found, false);
    assert.equal(missing.item, null);
    assert.deepEqual(missing.alternatives, []);

    // 5. Invalid / malformed inputs never throw
    for (const bad of ['', '   ', '日誌\0drop', '"foo" OR * (bar) NEAR/3', '---+++***']) {
      const res = lookupWord(db, bad, null, undefined, { jmdictPath: jmdictDbPath });
      assert.equal(res.found, false, `unexpected match for malformed input: ${JSON.stringify(bad)}`);
      assert.equal(res.item, null);
    }
  } finally {
    db.close();
  }
});

test('searchAllKinds ranks outside-JLPT after JLPT, deduplicates openjlpt, and supports VI accent-free + romaji', (t) => {
  const { appDbPath, jmdictDbPath } = setupAppAndJmdict(t);
  const db = openContentDatabase(appDbPath);
  try {
    // JLPT word 学生 appears in vocab and is deduplicated from outsideJlpt
    const jlptSearch = searchAllKinds(db, '学生', { dbFile: appDbPath, jmdictPath: jmdictDbPath });
    assert.ok(jlptSearch.groups.vocab.total >= 1);
    assert.equal(
      jlptSearch.groups.outsideJlpt.items.some((item) => item.title === '学生'),
      false,
    );

    // Outside-JLPT search by accent-free Vietnamese ("thu vien" -> 図書館)
    const viSearch = searchAllKinds(db, 'thu vien', {
      dbFile: appDbPath,
      jmdictPath: jmdictDbPath,
    });
    assert.equal(viSearch.groups.outsideJlpt.total, 1);
    assert.equal(viSearch.groups.outsideJlpt.items[0].title, '図書館');
    assert.equal(viSearch.groups.outsideJlpt.items[0].level, JMDICT_LEVEL_LABEL);
    assert.equal(viSearch.groups.outsideJlpt.items[0].outsideJlpt, true);
    assert.equal(viSearch.groups.outsideJlpt.items[0].meaning?.sourceName, 'tu-dien-nhat-viet');

    // Outside-JLPT search by romaji ("toshokan" -> 図書館)
    const romajiSearch = searchAllKinds(db, 'toshokan', {
      dbFile: appDbPath,
      jmdictPath: jmdictDbPath,
    });
    assert.equal(romajiSearch.groups.outsideJlpt.total, 1);
    assert.equal(romajiSearch.groups.outsideJlpt.items[0].id, 'jmdict:vocab:1589350');

    // Outside-JLPT search by English gloss ("gentle breeze" -> 微風, EN-only)
    const enSearch = searchAllKinds(db, 'gentle breeze', {
      dbFile: appDbPath,
      jmdictPath: jmdictDbPath,
    });
    assert.equal(enSearch.groups.outsideJlpt.total, 1);
    assert.equal(enSearch.groups.outsideJlpt.items[0].title, '微風');
    assert.equal(enSearch.groups.outsideJlpt.items[0].meaning, null);

    // Malformed FTS5 query returns empty safely
    const badSearch = searchAllKinds(db, '"foo" OR * (bar)', {
      dbFile: appDbPath,
      jmdictPath: jmdictDbPath,
    });
    assert.equal(badSearch.groups.outsideJlpt.total, 0);
    const directMalformed = searchJmdict(jmdictDbPath, '""((()))\0');
    assert.equal(directMalformed.total, 0);
  } finally {
    db.close();
  }
});

test('outside-JLPT word can be added to SRS with original sentence, maintains FK integrity, and does not pollute JLPT index', async (t) => {
  const { dir, appDbPath, jmdictDbPath } = setupAppAndJmdict(t);
  const contextPath = path.join(dir, 'lookup-sentences.json');

  const deps = {
    isAuthenticated: async () => true,
    sameOriginCheck: () => true,
    readBody: async (req: Request) => req.text(),
    dbPath: appDbPath,
    contextPath,
    jmdictPath: jmdictDbPath,
    now: () => new Date('2026-11-26T12:00:00.000Z'),
  };

  // GET /api/common-tools/lookup rejects NUL query
  const badGet = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=abc%00def'),
    deps,
  );
  assert.equal(badGet.status, 400);

  // GET returns JMdict entry for 日誌
  const getRes = await handleLookupGet(
    new Request('http://127.0.0.1:3000/api/common-tools/lookup?q=%E6%97%A5%E8%AA%8C'),
    deps,
  );
  assert.equal(getRes.status, 200);
  const payload = (await getRes.json()) as {
    found: boolean;
    item: { id: string; outsideJlpt?: boolean };
  };
  assert.equal(payload.found, true);
  assert.equal(payload.item.id, 'jmdict:vocab:1465820');
  assert.equal(payload.item.outsideJlpt, true);

  // POST adds outside-JLPT word to SRS with original sentence
  const postReq = new Request('http://127.0.0.1:3000/api/common-tools/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: 'jmdict:vocab:1465820',
      cardType: 'recognition',
      sentenceJa: '毎日日誌をつける。',
      sentenceVi: 'Viết nhật ký mỗi ngày.',
    }),
  });
  const postRes = await handleLookupPost(postReq, deps);
  assert.equal(postRes.status, 201);
  const saved = (await postRes.json()) as { created: boolean; cardId: string };
  assert.equal(saved.created, true);
  assert.ok(saved.cardId);

  // Repeat POST is idempotent (status 200, created: false)
  const repeatReq = new Request('http://127.0.0.1:3000/api/common-tools/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: 'jmdict:vocab:1465820',
      cardType: 'recognition',
      sentenceJa: '旅行の日誌を読んだ。',
    }),
  });
  const repeatRes = await handleLookupPost(repeatReq, deps);
  assert.equal(repeatRes.status, 200);
  const repeated = (await repeatRes.json()) as { created: boolean; cardId: string };
  assert.equal(repeated.created, false);
  assert.equal(repeated.cardId, saved.cardId);

  // Also test direct enqueueCard (used by AddToReview on /common-tools/search) on EN-only entry 微風
  const direct = enqueueCard(
    appDbPath,
    'jmdict:vocab:1601234',
    'recognition',
    new Date('2026-11-26T12:00:00.000Z'),
    jmdictDbPath,
  );
  assert.equal(direct.created, true);

  const db = new DatabaseSync(appDbPath);
  try {
    // Foreign keys are completely valid
    const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
    assert.deepEqual(fkErrors, []);

    // SRS session loads both materialized outside-JLPT cards cleanly
    const engine = await srsScheduler();
    const study = srsSession(db, engine, 'full', new Date('2026-11-26T12:05:00.000Z'));
    const nisshiCard = study.cards.find((c) => c.itemId === 'jmdict:vocab:1465820');
    assert.ok(nisshiCard, '日誌 should appear in SRS due queue');
    assert.equal(nisshiCard.title, '日誌');
    assert.equal(nisshiCard.reading, 'にっし');
    assert.ok(nisshiCard.vietnamese);
    assert.equal(nisshiCard.vietnamese.sourceName, 'tu-dien-nhat-viet');

    const bifuuCard = study.cards.find((c) => c.itemId === 'jmdict:vocab:1601234');
    assert.ok(bifuuCard, '微風 should appear in SRS due queue');
    assert.equal(bifuuCard.title, '微風');
    assert.equal(bifuuCard.vietnamese, null);
    assert.equal(bifuuCard.english, 'gentle breeze; light wind');

    // Rebuilding JLPT FTS5 index excludes materialized jmdict items from JLPT groups
    rebuildSearchIndex(db);
    const afterSearch = searchAllKinds(db, '日誌', { dbFile: appDbPath, jmdictPath: jmdictDbPath });
    assert.equal(afterSearch.groups.vocab.total, 0);
    assert.equal(afterSearch.groups.outsideJlpt.total, 1);
    assert.equal(afterSearch.groups.outsideJlpt.items[0].id, 'jmdict:vocab:1465820');

    // Verify entry getter rejects invalid IDs safely
    assert.equal(getJmdictEntryById(jmdictDbPath, 'jmdict:vocab:bad'), null);
    assert.equal(getJmdictEntryById(jmdictDbPath, 'jmdict:vocab:9999999'), null);
  } finally {
    db.close();
  }
});
