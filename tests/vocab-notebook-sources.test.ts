import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import { seedDemo } from '../tools/seed-demo.ts';
// @ts-expect-error ESM CLI/library module without separate .d.ts
import { importJmdict, sha256File } from '../tools/import-jmdict.mjs';
import { openContentDatabase } from '../src/core/content.ts';
import { enqueueCard } from '../src/core/review.ts';
import { createBackup, restoreBackup, validateBackup } from '../src/core/backup.ts';
import { JMDICT_ATTRIBUTION, JMDICT_LEVEL_LABEL, TU_DIEN_VI_ATTRIBUTION } from '../src/core/jmdict.ts';
import {
  handleLookupGet,
  handleLookupPost,
  type LookupHandlerDeps,
} from '../src/app/(study)/common-tools/lookup-handler.ts';
import {
  readLookupSentenceStore,
  saveLookupItemToNotebook,
  saveLookupItemToSrs,
} from '../src/app/(study)/common-tools/lookup-store.ts';
import { syntheticClip } from '../src/app/(study)/shadowing/clip-model.ts';
import { listVocabNotebook, resolveJlptLink } from '../src/app/(study)/vocab/notebook/data.ts';

const SAMPLE_JMDICT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JMdict created: 2026-11-26 -->
<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
]>
<JMdict>
<entry>
  <ent_seq>1465820</ent_seq>
  <k_ele><keb>日誌</keb><ke_pri>news1</ke_pri></k_ele>
  <r_ele><reb>にっし</reb><re_pri>news1</re_pri></r_ele>
  <sense>
    <pos>&n;</pos>
    <gloss>diary</gloss>
    <gloss>journal</gloss>
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
<entry>
  <ent_seq>1705555</ent_seq>
  <k_ele><keb>余韻</keb></k_ele>
  <r_ele><reb>よいん</reb></r_ele>
  <sense>
    <pos>&n;</pos>
    <gloss>reverberation</gloss>
    <gloss>lingering resonance</gloss>
  </sense>
</entry>
</JMdict>
`;

const SAMPLE_VI_CSV = [
  '"日誌","[n] nhật ký, sổ ghi chép"',
  '"余韻","[n] dư âm, dư vị"',
].join('\n');

function setupFixture(t: test.TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-notebook-sources-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  const appDbPath = path.join(dir, 'demo.sqlite');
  seedDemo(appDbPath);

  const jmdictGz = path.join(dir, 'JMdict_e.gz');
  fs.writeFileSync(jmdictGz, zlib.gzipSync(Buffer.from(SAMPLE_JMDICT_XML, 'utf8')));
  const viCsv = path.join(dir, 'tu-dien-nhat-viet.csv');
  fs.writeFileSync(viCsv, SAMPLE_VI_CSV, 'utf8');

  const jmdictDbPath = path.join(dir, 'private', 'jmdict.sqlite');
  importJmdict({
    jmdictPath: jmdictGz,
    viPath: viCsv,
    targetPath: jmdictDbPath,
    expectedJmdictSha256: sha256File(jmdictGz),
    expectedViSha256: sha256File(viCsv),
  });

  const contextPath = path.join(dir, 'private', 'lookup-sentences.json');
  return { dir, appDbPath, jmdictDbPath, contextPath };
}

function makeDeps(options: {
  authenticated?: boolean;
  dbPath: string;
  contextPath: string;
  jmdictPath?: string;
  now?: Date;
}): LookupHandlerDeps {
  return {
    isAuthenticated: async () => options.authenticated ?? true,
    sameOriginCheck: () => true,
    readBody: (request) => request.text(),
    dbPath: options.dbPath,
    contextPath: options.contextPath,
    jmdictPath: options.jmdictPath,
    now: options.now ? () => options.now! : undefined,
  };
}

function pickActiveVocabIds(appDbPath: string, count: number): string[] {
  const db = new DatabaseSync(appDbPath, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `SELECT v.item_id FROM vocab v
         JOIN content_items i USING(item_id)
         WHERE i.is_active=1
         ORDER BY v.item_id
         LIMIT ?`,
      )
      .all(count);
    assert.ok(rows.length >= count, `expected at least ${count} active vocab items`);
    return rows.map((row) => String(row.item_id));
  } finally {
    db.close();
  }
}

function countTableRows(appDbPath: string, sql: string): number {
  const db = new DatabaseSync(appDbPath, { readOnly: true });
  try {
    const row = db.prepare(sql).get() as { n: number };
    return Number(row.n);
  } finally {
    db.close();
  }
}

test('saving from jlpt source records sentence + link and exposes Đề thi filter accurately', async (t) => {
  const { appDbPath, jmdictDbPath, contextPath } = setupFixture(t);
  const [jlptNotebookOnlyId, jlptSrsId] = pickActiveVocabIds(appDbPath, 2);

  // 1. Notebook-only save via POST handler from JLPT question (no SRS card forced)
  const postRes = await handleLookupPost(
    new NextRequest('http://localhost/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId: jlptNotebookOnlyId,
        sentenceJa: '明日の会議は十時に始まります。',
        sourceKind: 'jlpt',
        jlptDate: '2026-11-26',
        jlptQuestionId: 'q-vocab-01',
        jlptQuestionNumber: 2,
        notebookOnly: true,
      }),
    }),
    makeDeps({
      dbPath: appDbPath,
      jmdictPath: jmdictDbPath,
      contextPath,
      now: new Date('2026-11-26T08:00:00.000Z'),
    }),
  );
  assert.equal(postRes.status, 201);
  const postBody = (await postRes.json()) as {
    created: boolean;
    notebookOnly: boolean;
    cardId: string;
    sentence: {
      sourceKind?: string;
      jlptDate?: string;
      jlptQuestionId?: string;
      jlptQuestionNumber?: number;
    };
  };
  assert.equal(postBody.created, true);
  assert.equal(postBody.notebookOnly, true);
  assert.equal(postBody.cardId, `notebook:${jlptNotebookOnlyId}`);
  assert.equal(postBody.sentence.sourceKind, 'jlpt');
  assert.equal(postBody.sentence.jlptDate, '2026-11-26');
  assert.equal(postBody.sentence.jlptQuestionId, 'q-vocab-01');
  assert.equal(postBody.sentence.jlptQuestionNumber, 2);
  assert.equal(countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM srs_cards'), 0);

  // 2. SRS save from JLPT question (still classified as jlpt source)
  saveLookupItemToSrs({
    dbPath: appDbPath,
    jmdictPath: jmdictDbPath,
    contextPath,
    itemId: jlptSrsId,
    sentenceJa: '駅の前で友達を待っています。',
    sentenceVi: null,
    sourceClipId: null,
    sourceKind: 'jlpt',
    jlptDate: '2026-11-25',
    jlptQuestionId: 'q-grammar-03',
    jlptQuestionNumber: 4,
    now: new Date('2026-11-26T09:00:00.000Z'),
  });
  assert.equal(countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM srs_cards'), 1);

  const roDb = openContentDatabase(appDbPath);
  try {
    const jlptOnly = listVocabNotebook(roDb, {
      source: 'jlpt',
      contextPath,
      jmdictPath: jmdictDbPath,
      youtubeFile: '',
    });
    assert.equal(jlptOnly.total, 2);
    assert.equal(jlptOnly.filteredTotal, 2);
    assert.deepEqual(jlptOnly.counts, { all: 2, clip: 0, lookup: 0, jlpt: 2, srs: 0 });
    assert.deepEqual(
      jlptOnly.items.map((item) => ({
        id: item.id,
        source: item.source,
        sentenceJa: item.sentenceJa,
        jlptDate: item.jlptDate,
        jlptQuestionNumber: item.jlptQuestionNumber,
        jlptHref: item.jlptHref,
      })),
      [
        {
          id: jlptSrsId,
          source: 'jlpt',
          sentenceJa: '駅の前で友達を待っています。',
          jlptDate: '2026-11-25',
          jlptQuestionNumber: 4,
          jlptHref: '/jlpt-daily?date=2026-11-25&q=q-grammar-03',
        },
        {
          id: jlptNotebookOnlyId,
          source: 'jlpt',
          sentenceJa: '明日の会議は十時に始まります。',
          jlptDate: '2026-11-26',
          jlptQuestionNumber: 2,
          jlptHref: '/jlpt-daily?date=2026-11-26&q=q-vocab-01',
        },
      ],
    );

    // Date-only, question-only, & invalid date link helper checks
    assert.equal(resolveJlptLink('2026-11-26', null, null)?.href, '/jlpt-daily?date=2026-11-26');
    assert.equal(
      resolveJlptLink('2026-11-26', 'q 1', 2)?.href,
      '/jlpt-daily?date=2026-11-26&q=q+1',
    );
    assert.equal(resolveJlptLink('not-a-date', 'q1', null)?.href, '/jlpt-daily?q=q1');
    assert.equal(resolveJlptLink('not-a-date', null, null), null);
  } finally {
    roDb.close();
  }
});

test('outside-JLPT JMdict words enter notebook without forcing SRS cards or JLPT vocab rows', async (t) => {
  const { appDbPath, jmdictDbPath, contextPath } = setupFixture(t);
  const initialVocabCount = countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM vocab');
  const initialContentCount = countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM content_items');

  // 1. JMdict word WITH Vietnamese meaning and original sentence (source: lookup)
  const resWithSentence = await handleLookupPost(
    new NextRequest('http://localhost/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId: 'jmdict:vocab:1465820',
        sentenceJa: '毎日の学習日誌を付けています。',
        sourceKind: 'lookup',
        notebookOnly: true,
      }),
    }),
    makeDeps({
      dbPath: appDbPath,
      jmdictPath: jmdictDbPath,
      contextPath,
      now: new Date('2026-11-26T10:00:00.000Z'),
    }),
  );
  assert.equal(resWithSentence.status, 201);

  // 2. JMdict EN-only word WITHOUT original sentence (source: lookup)
  const resNoSentence = await handleLookupPost(
    new NextRequest('http://localhost/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId: 'jmdict:vocab:1601234',
        sourceKind: 'lookup',
        notebookOnly: true,
      }),
    }),
    makeDeps({
      dbPath: appDbPath,
      jmdictPath: jmdictDbPath,
      contextPath,
      now: new Date('2026-11-26T10:05:00.000Z'),
    }),
  );
  assert.equal(resNoSentence.status, 201);

  // 3. JMdict word saved from JLPT question (source: jlpt)
  const resFromJlpt = await handleLookupPost(
    new NextRequest('http://localhost/api/common-tools/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId: 'jmdict:vocab:1705555',
        sentenceJa: '音楽の余韻が心に残った。',
        sourceKind: 'jlpt',
        jlptDate: '2026-11-26',
        jlptQuestionId: 'q-reading-05',
        jlptQuestionNumber: 5,
        notebookOnly: true,
      }),
    }),
    makeDeps({
      dbPath: appDbPath,
      jmdictPath: jmdictDbPath,
      contextPath,
      now: new Date('2026-11-26T10:10:00.000Z'),
    }),
  );
  assert.equal(resFromJlpt.status, 201);

  // CRITICAL: Zero SRS cards created and zero JMdict rows materialized into JLPT app DB
  assert.equal(countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM srs_cards'), 0);
  assert.equal(countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM vocab'), initialVocabCount);
  assert.equal(countTableRows(appDbPath, 'SELECT COUNT(*) AS n FROM content_items'), initialContentCount);
  assert.equal(
    countTableRows(appDbPath, "SELECT COUNT(*) AS n FROM content_items WHERE item_id LIKE 'jmdict:%'"),
    0,
  );

  const roDb = openContentDatabase(appDbPath);
  try {
    const view = listVocabNotebook(roDb, {
      contextPath,
      jmdictPath: jmdictDbPath,
      youtubeFile: '',
    });
    assert.equal(view.total, 3);
    assert.deepEqual(view.counts, { all: 3, clip: 0, lookup: 2, jlpt: 1, srs: 0 });

    const yoin = view.items.find((item) => item.id === 'jmdict:vocab:1705555')!;
    assert.equal(yoin.word, '余韻');
    assert.equal(yoin.reading, 'よいん');
    assert.equal(yoin.level, JMDICT_LEVEL_LABEL);
    assert.equal(yoin.source, 'jlpt');
    assert.equal(yoin.jlptHref, '/jlpt-daily?date=2026-11-26&q=q-reading-05');
    assert.equal(yoin.sentenceJa, '音楽の余韻が心に残った。');
    assert.equal(yoin.href, `/common-tools/search?q=${encodeURIComponent('余韻')}`);
    assert.ok(yoin.meaning);
    assert.match(yoin.meaning.text, /dư âm/);
    assert.equal(yoin.meaning.sourceName, TU_DIEN_VI_ATTRIBUTION.name);

    const bifuu = view.items.find((item) => item.id === 'jmdict:vocab:1601234')!;
    assert.equal(bifuu.word, '微風');
    assert.equal(bifuu.level, JMDICT_LEVEL_LABEL);
    assert.equal(bifuu.source, 'lookup');
    assert.equal(bifuu.sentenceJa, null);
    assert.equal(bifuu.meaning, null);
    assert.deepEqual(bifuu.english, ['gentle breeze', 'light wind']);
    assert.equal(bifuu.sourceName, JMDICT_ATTRIBUTION.name);

    const nisshi = view.items.find((item) => item.id === 'jmdict:vocab:1465820')!;
    assert.equal(nisshi.word, '日誌');
    assert.equal(nisshi.source, 'lookup');
    assert.equal(nisshi.sentenceJa, '毎日の学習日誌を付けています。');
    assert.ok(nisshi.meaning);
    assert.match(nisshi.meaning.text, /nhật ký/);

    // Fallback when jmdict.sqlite is unavailable still renders saved snapshot cleanly
    const fallbackView = listVocabNotebook(roDb, {
      contextPath,
      jmdictPath: path.join(path.dirname(jmdictDbPath), 'missing-jmdict.sqlite'),
      youtubeFile: '',
    });
    assert.equal(fallbackView.total, 3);
    const fallbackNisshi = fallbackView.items.find((item) => item.id === 'jmdict:vocab:1465820')!;
    assert.equal(fallbackNisshi.word, '日誌');
    assert.equal(fallbackNisshi.reading, 'にっし');
    assert.ok(fallbackNisshi.meaning);
    assert.match(fallbackNisshi.meaning.text, /nhật ký/);
  } finally {
    roDb.close();
  }
});

test('filtering and counts work accurately across all 4 sources (clip, lookup, jlpt, srs)', (t) => {
  const { appDbPath, jmdictDbPath, contextPath } = setupFixture(t);
  const [clipId, lookupId, jlptId, srsId] = pickActiveVocabIds(appDbPath, 4);
  const seg = syntheticClip.segments[0];

  // 1. clip
  saveLookupItemToSrs({
    dbPath: appDbPath,
    contextPath,
    itemId: clipId,
    sentenceJa: seg.ja,
    sentenceVi: seg.vi,
    sourceClipId: syntheticClip.id,
    now: new Date('2026-11-26T01:00:00.000Z'),
  });

  // 2. lookup (JMdict notebook-only)
  saveLookupItemToNotebook({
    dbPath: appDbPath,
    jmdictPath: jmdictDbPath,
    contextPath,
    itemId: 'jmdict:vocab:1465820',
    sentenceJa: '旅の日誌を読む。',
    sourceKind: 'lookup',
    now: new Date('2026-11-26T02:00:00.000Z'),
  });

  // 3. lookup (JLPT vocab via SRS lookup)
  saveLookupItemToSrs({
    dbPath: appDbPath,
    contextPath,
    itemId: lookupId,
    sentenceJa: '日本語を勉強します。',
    sentenceVi: null,
    sourceClipId: null,
    now: new Date('2026-11-26T03:00:00.000Z'),
  });

  // 4. jlpt (notebook-only)
  saveLookupItemToNotebook({
    dbPath: appDbPath,
    contextPath,
    itemId: jlptId,
    sentenceJa: 'この問題はとても大切です。',
    sourceKind: 'jlpt',
    jlptDate: '2026-11-26',
    jlptQuestionId: 'q-1',
    jlptQuestionNumber: 1,
    now: new Date('2026-11-26T04:00:00.000Z'),
  });

  // 5. srs (direct enqueue, no lookup entry)
  enqueueCard(appDbPath, srsId, 'recognition', new Date('2026-11-26T05:00:00.000Z'));

  const roDb = openContentDatabase(appDbPath);
  try {
    const all = listVocabNotebook(roDb, { contextPath, jmdictPath: jmdictDbPath, youtubeFile: '' });
    assert.equal(all.total, 5);
    assert.equal(all.filteredTotal, 5);
    assert.deepEqual(all.counts, { all: 5, clip: 1, lookup: 2, jlpt: 1, srs: 1 });

    for (const [source, expectedIds] of [
      ['clip', [clipId]],
      ['lookup', [lookupId, 'jmdict:vocab:1465820']],
      ['jlpt', [jlptId]],
      ['srs', [srsId]],
    ] as const) {
      const filtered = listVocabNotebook(roDb, {
        source,
        contextPath,
        jmdictPath: jmdictDbPath,
        youtubeFile: '',
      });
      assert.equal(filtered.total, 5);
      assert.equal(filtered.filteredTotal, expectedIds.length);
      assert.deepEqual(filtered.counts, { all: 5, clip: 1, lookup: 2, jlpt: 1, srs: 1 });
      assert.deepEqual(
        filtered.items.map((item) => item.id),
        expectedIds,
      );
    }
  } finally {
    roDb.close();
  }
});

test('legacy v1 lookup-sentences.json reads safely and passes full backup/restore with new jlpt and JMdict entries', async (t) => {
  const { dir, appDbPath, jmdictDbPath, contextPath } = setupFixture(t);
  const [legacyClipId, legacyLookupId, newJlptId] = pickActiveVocabIds(appDbPath, 3);

  const clipCard = enqueueCard(appDbPath, legacyClipId, 'recognition', new Date('2026-11-20T08:00:00.000Z'));
  const lookupCard = enqueueCard(appDbPath, legacyLookupId, 'recognition', new Date('2026-11-20T09:00:00.000Z'));

  // Write strict legacy v1 JSON containing only the original 6 fields per entry
  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.writeFileSync(
    contextPath,
    JSON.stringify(
      {
        version: 1,
        entries: {
          [clipCard.cardId]: {
            cardId: clipCard.cardId,
            itemId: legacyClipId,
            sentenceJa: syntheticClip.segments[0].ja,
            sentenceVi: syntheticClip.segments[0].vi,
            sourceClipId: syntheticClip.id,
            savedAt: '2026-11-20T08:05:00.000Z',
          },
          [lookupCard.cardId]: {
            cardId: lookupCard.cardId,
            itemId: legacyLookupId,
            sentenceJa: '古いデータも安全に読めます。',
            sentenceVi: null,
            sourceClipId: null,
            savedAt: '2026-11-20T09:05:00.000Z',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  // Append new JLPT + JMdict notebook-only entries onto the legacy store
  saveLookupItemToNotebook({
    dbPath: appDbPath,
    contextPath,
    itemId: newJlptId,
    sentenceJa: 'テストの文章です。',
    sourceKind: 'jlpt',
    jlptDate: '2026-11-26',
    jlptQuestionId: 'q-legacy-check',
    jlptQuestionNumber: 3,
    now: new Date('2026-11-26T06:00:00.000Z'),
  });
  saveLookupItemToNotebook({
    dbPath: appDbPath,
    jmdictPath: jmdictDbPath,
    contextPath,
    itemId: 'jmdict:vocab:1601234',
    sentenceJa: null,
    sourceKind: 'lookup',
    now: new Date('2026-11-26T06:30:00.000Z'),
  });

  // Verify legacy + new entries coexist in readLookupSentenceStore
  const stored = readLookupSentenceStore(contextPath);
  assert.equal(Object.keys(stored.entries).length, 4);

  // Run real createBackup -> validateBackup -> wipe -> restoreBackup cycle
  const prevEnv = {
    NIHON_DB_PATH: process.env.NIHON_DB_PATH,
    NIHON_LOOKUP_CONTEXT_PATH: process.env.NIHON_LOOKUP_CONTEXT_PATH,
    NIHON_BACKUP_DIR: process.env.NIHON_BACKUP_DIR,
    NIHON_RECORDINGS_DIR: process.env.NIHON_RECORDINGS_DIR,
    NIHON_SETTINGS_PATH: process.env.NIHON_SETTINGS_PATH,
    NIHON_ROADMAP_PATH: process.env.NIHON_ROADMAP_PATH,
    NIHON_SHADOWING_HISTORY_PATH: process.env.NIHON_SHADOWING_HISTORY_PATH,
    NIHON_JLPT_PATH: process.env.NIHON_JLPT_PATH,
  };
  process.env.NIHON_DB_PATH = appDbPath;
  process.env.NIHON_LOOKUP_CONTEXT_PATH = contextPath;
  process.env.NIHON_BACKUP_DIR = path.join(dir, 'backups');
  process.env.NIHON_RECORDINGS_DIR = path.join(dir, 'recordings');
  process.env.NIHON_SETTINGS_PATH = path.join(dir, 'settings.json');
  process.env.NIHON_ROADMAP_PATH = path.join(dir, 'private', 'today-roadmap.json');
  process.env.NIHON_SHADOWING_HISTORY_PATH = path.join(dir, 'private', 'shadowing-history.json');
  process.env.NIHON_JLPT_PATH = path.join(dir, 'private', 'jlpt-daily');
  t.after(() => {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const archiveBytes = await createBackup();
  const parsedArchive = validateBackup(archiveBytes);
  assert.ok(parsedArchive.files.some((f) => f.name === 'lookup-sentences.json'));

  // Wipe lookup-sentences.json then restore from backup
  fs.unlinkSync(contextPath);
  assert.equal(fs.existsSync(contextPath), false);

  await restoreBackup(archiveBytes);
  assert.equal(fs.existsSync(contextPath), true);

  const roDb = openContentDatabase(appDbPath);
  try {
    const restored = listVocabNotebook(roDb, {
      contextPath,
      jmdictPath: jmdictDbPath,
      youtubeFile: '',
    });
    assert.equal(restored.total, 4);
    assert.deepEqual(restored.counts, { all: 4, clip: 1, lookup: 2, jlpt: 1, srs: 0 });
    assert.equal(
      restored.items.find((i) => i.id === legacyClipId)?.source,
      'clip',
    );
    assert.equal(
      restored.items.find((i) => i.id === legacyLookupId)?.sentenceJa,
      '古いデータも安全に読めます。',
    );
    assert.equal(
      restored.items.find((i) => i.id === newJlptId)?.jlptHref,
      '/jlpt-daily?date=2026-11-26&q=q-legacy-check',
    );
    assert.equal(
      restored.items.find((i) => i.id === 'jmdict:vocab:1601234')?.sentenceJa,
      null,
    );
  } finally {
    roDb.close();
  }
});

test('GET /api/common-tools/lookup?tokenize=... enforces auth/validation and tokenizes Japanese sentences', async (t) => {
  const { appDbPath, contextPath } = setupFixture(t);

  // 1. Unauthenticated -> 401
  const unauthRes = await handleLookupGet(
    new NextRequest('http://localhost/api/common-tools/lookup?tokenize=%E6%97%A5%E6%9C%AC%E8%AA%9E'),
    makeDeps({ authenticated: false, dbPath: appDbPath, contextPath }),
  );
  assert.equal(unauthRes.status, 401);

  // 2. Empty tokenize -> 400
  const emptyRes = await handleLookupGet(
    new NextRequest('http://localhost/api/common-tools/lookup?tokenize=%20%20'),
    makeDeps({ authenticated: true, dbPath: appDbPath, contextPath }),
  );
  assert.equal(emptyRes.status, 400);

  // 3. Valid sentence -> 200 with kuromoji tokens and lemma base
  const okRes = await handleLookupGet(
    new NextRequest(
      `http://localhost/api/common-tools/lookup?tokenize=${encodeURIComponent('毎日日本語を勉強しています。')}`,
    ),
    makeDeps({ authenticated: true, dbPath: appDbPath, contextPath }),
  );
  assert.equal(okRes.status, 200);
  assert.equal(okRes.headers.get('cache-control'), 'private, no-store');
  const body = (await okRes.json()) as {
    tokens: Array<{ surface: string; base: string; clickable: boolean }>;
  };
  assert.ok(Array.isArray(body.tokens) && body.tokens.length >= 4);
  assert.equal(
    body.tokens.map((tok) => tok.surface).join(''),
    '毎日日本語を勉強しています。',
  );
  assert.ok(body.tokens.some((tok) => tok.surface === '日本語' && tok.clickable));
});

test('jlpt-daily/practice.tsx and jlpt-lookup-stem.tsx never import server-only modules into client bundle', () => {
  for (const rel of [
    'src/app/(study)/jlpt-daily/practice.tsx',
    'src/app/(study)/common-tools/jlpt-lookup-stem.tsx',
  ]) {
    const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]kuromoji['"]/);
    assert.doesNotMatch(src, /from\s+['"]node:sqlite['"]/);
    assert.doesNotMatch(src, /from\s+['"].*common-tools\/repository/);
    assert.doesNotMatch(src, /from\s+['"].*common-tools\/lookup-store/);
  }
});
