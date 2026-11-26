import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { seedDemo } from '../tools/seed-demo.ts';
import {
  MAX_CLIP_TAGS,
  furiganaToKana,
  normalizeClipTags,
  normalizeRoadmapWeek,
  parseFuriganaNotationStrict,
  parsePositionedFurigana,
  roadmapWeekInfo,
  sliceFuriganaRange,
  validateFuriganaNotation,
} from '../src/app/(study)/shadowing/auto-meta-model.ts';
import {
  analyzeClipMetadata,
  buildSentenceFurigana,
  loadShadowingTokenizer,
} from '../src/app/(study)/shadowing/auto-meta-server.ts';
import {
  validateClipDraft,
} from '../src/app/(study)/shadowing/clip-maker-model.ts';
import {
  listUserShadowingClips,
  readUserClipStore,
} from '../src/app/(study)/shadowing/clip-maker-store.ts';
import { handleShadowingClipsAnalyzePost } from '../src/app/api/shadowing/clips/analyze/handler.ts';
import { handleShadowingClipsPost } from '../src/app/api/shadowing/clips/handler.ts';
import { allocateRoadmap, type CatalogItem } from '../src/app/(study)/today-roadmap/model.ts';
import { readRoadmapCatalog } from '../src/app/(study)/today-roadmap/repository.ts';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-auto-meta-'));
}

function makeWebmBytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(72));
  bytes.set([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81], 0);
  bytes.fill(0x22, 8);
  return bytes;
}

test('auto-meta-model validates furigana notation, tags, roadmap weeks, and token slicing', () => {
  const valid = validateFuriganaNotation('学生は本を見ます。', '{学生|がくせい}は{本|ほん}を{見|み}ます。');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value, '{学生|がくせい}は{本|ほん}を{見|み}ます。');
    assert.equal(furiganaToKana(valid.value!), 'がくせいはほんをみます。');
  }

  // Mismatched base text, malformed braces, empty reading
  assert.equal(validateFuriganaNotation('学生は本を見ます。', '{学校|がっこう}は{本|ほん}を{見|み}ます。').ok, false);
  assert.equal(validateFuriganaNotation('学生', '{学生|がくせい').ok, false);
  assert.equal(validateFuriganaNotation('学生', '{学生|}').ok, false);
  assert.equal(validateFuriganaNotation('学生', '学生}').ok, false);
  assert.equal(validateFuriganaNotation('学生', null).ok, true);
  assert.equal(validateFuriganaNotation('学生', '   ').ok, true);

  // Positioned slicing
  const pos = parsePositionedFurigana('学生は本を見ます。', '{学生|がくせい}は{本|ほん}を{見|み}ます。');
  assert.ok(pos);
  assert.deepEqual(sliceFuriganaRange(pos!, 0, 2), [{ text: '学生', reading: 'がくせい' }]);
  assert.deepEqual(sliceFuriganaRange(pos!, 3, 4), [{ text: '本', reading: 'ほん' }]);
  assert.deepEqual(sliceFuriganaRange(pos!, 5, 8), [{ text: '見', reading: 'み' }, { text: 'ます' }]);

  // Tags normalization
  const manyTags = Array.from({ length: 20 }, (_, i) => `tag-${i + 1}`);
  assert.equal(normalizeClipTags(manyTags).length, MAX_CLIP_TAGS);
  assert.deepEqual(normalizeClipTags([' N5 ', 'n5', '  trợ   từ ', '', 'a'.repeat(50)]), ['N5', 'trợ từ']);

  // Roadmap week normalization
  assert.equal(normalizeRoadmapWeek(1), 1);
  assert.equal(normalizeRoadmapWeek('87'), 87);
  assert.equal(normalizeRoadmapWeek(0), null);
  assert.equal(normalizeRoadmapWeek(88), null);
  assert.equal(normalizeRoadmapWeek(12.5), null);
  assert.equal(normalizeRoadmapWeek(''), null);
  assert.equal(roadmapWeekInfo(1)?.level, 'N5');
  assert.equal(roadmapWeekInfo(20)?.level, 'N4');
  assert.equal(roadmapWeekInfo(40)?.level, 'N3');
  assert.equal(roadmapWeekInfo(87)?.level, 'N2');
  assert.equal(roadmapWeekInfo(88), null);
});

test('server-side kuromoji generates accurate furigana across multi-reading kanji without wrapping okurigana', async () => {
  const tokenizer = await loadShadowingTokenizer();
  assert.ok(tokenizer, 'kuromoji tokenizer must load offline from installed package');

  const cases: { ja: string; expected: string; expectedKana: string }[] = [
    {
      ja: '銀行に行きます。',
      expected: '{銀行|ぎんこう}に{行|い}きます。',
      expectedKana: 'ぎんこうにいきます。',
    },
    {
      ja: '今日と毎日と日曜日。',
      expected: '{今日|きょう}と{毎日|まいにち}と{日曜日|にちようび}。',
      expectedKana: 'きょうとまいにちとにちようび。',
    },
    {
      ja: '先生と学生が生まれます。',
      expected: '{先生|せんせい}と{学生|がくせい}が{生|う}まれます。',
      expectedKana: 'せんせいとがくせいがうまれます。',
    },
    {
      ja: '何を食べますか。',
      expected: '{何|なに}を{食|た}べますか。',
      expectedKana: 'なにをたべますか。',
    },
    {
      ja: '何人ですか。',
      expected: '{何|なん}{人|にん}ですか。',
      expectedKana: 'なんにんですか。',
    },
    {
      ja: '来年の春に来ます。',
      expected: '{来年|らいねん}の{春|はる}に{来|き}ます。',
      expectedKana: 'らいねんのはるにきます。',
    },
    {
      ja: '食べ物がおいしいです。',
      expected: '{食|た}べ{物|もの}がおいしいです。',
      expectedKana: 'たべものがおいしいです。',
    },
    {
      ja: '一人で行きました。',
      expected: '{一人|ひとり}で{行|い}きました。',
      expectedKana: 'ひとりでいきました。',
    },
    {
      ja: '二人で話します。',
      expected: '{二人|ふたり}で{話|はな}します。',
      expectedKana: 'ふたりではなします。',
    },
    {
      ja: '十一人です。',
      expected: '{十|じゅう}{一|いち}{人|にん}です。',
      expectedKana: 'じゅういちにんです。',
    },
  ];

  for (const tc of cases) {
    const res = buildSentenceFurigana(tc.ja, tokenizer);
    assert.equal(res.furigana, tc.expected, `furigana mismatch for ${tc.ja}`);
    assert.equal(res.kana, tc.expectedKana, `kana mismatch for ${tc.ja}`);
    assert.ok(parseFuriganaNotationStrict(tc.ja, res.furigana), `notation must reconstruct ${tc.ja}`);
    assert.equal(/[\u3400-\u9fff]/.test(res.kana), false, `kana must not contain kanji for ${tc.ja}`);
  }
});

test('analyzeClipMetadata suggests deterministic OpenJLPT tags and 87-week roadmap offline and ignores JMdict rows', async () => {
  const dir = makeTempDir();
  const dbFile = path.join(dir, 'test.sqlite');
  const origFetch = globalThis.fetch;
  try {
    seedDemo(dbFile);

    // Inject multi-level OpenJLPT items (N4 + N3) AND a JMdict N1 decoy row that MUST be ignored.
    const db = new DatabaseSync(dbFile);
    try {
      const openReleaseRow = db
        .prepare(`SELECT release_id FROM source_releases WHERE source_id='openjlpt' LIMIT 1`)
        .get() as { release_id: string };
      const openRelease = openReleaseRow.release_id;
      const hash64 = 'a'.repeat(64);

      db.prepare(
        `INSERT INTO data_sources(source_id,name,url,license,version,checksum,attribution,usage_scope)
         VALUES('jmdict','JMdict','https://example.invalid','CC-BY-SA-4.0','1.0',?,'EDRDG','redistributable')`,
      ).run(hash64);
      db.prepare(
        `INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json)
         VALUES('jmdict:test','jmdict','1.0',?,'https://example.invalid','2026-11-20T00:00:00Z','CC-BY-SA-4.0','EDRDG','{}')`,
      ).run(hash64);

      const insItem = db.prepare(
        `INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)`,
      );
      insItem.run('jmdict:vocab:taberu-decoy', 'vocab', 'jmdict', 'taberu-decoy', 'jmdict:test', hash64);
      insItem.run('openjlpt:vocab:n4-shiken', 'vocab', 'openjlpt', 'n4-shiken', openRelease, hash64);
      insItem.run('openjlpt:vocab:n3-keiken', 'vocab', 'openjlpt', 'n3-keiken', openRelease, hash64);
      insItem.run('openjlpt:grammar:n3-youni', 'grammar', 'openjlpt', 'n3-youni', openRelease, hash64);
      insItem.run('openjlpt:kanji:n3-kei', 'kanji', 'openjlpt', 'n3-kei', openRelease, hash64);

      const insVocab = db.prepare(
        `INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id) VALUES(?,?,?,?,?,?,?,?)`,
      );
      insVocab.run('jmdict:vocab:taberu-decoy', '食べる', 'たべる', 'taberu', 'N1', '["to eat (decoy)"]', '["verb"]', null);
      insVocab.run('openjlpt:vocab:n4-shiken', '試験', 'しけん', 'shiken', 'N4', '["exam"]', '["noun"]', null);
      insVocab.run('openjlpt:vocab:n3-keiken', '経験', 'けいけん', 'keiken', 'N3', '["experience"]', '["noun"]', null);

      db.prepare(
        `INSERT INTO grammar(item_id,pattern,reading,romaji,level,meaning_en,formation_en,notes_en,tags)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      ).run(
        'openjlpt:grammar:n3-youni',
        '〜ようにする',
        null,
        'you ni suru',
        'N3',
        'make sure to',
        'V + ようにする',
        null,
        '["effort","emphasis"]',
      );

      db.prepare(
        `INSERT INTO kanji(item_id,character,level,strokes,grade,frequency_rank,radical,radical_number,onyomi,kunyomi,nanori,meanings_en)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        'openjlpt:kanji:n3-kei',
        '経',
        'N3',
        11,
        5,
        80,
        null,
        null,
        '["ケイ"]',
        '["へ.る"]',
        '[]',
        '["pass through"]',
      );
    } finally {
      db.close();
    }

    // Enforce zero external requests during analysis
    globalThis.fetch = (() => {
      throw new Error('EXTERNAL_FETCH_FORBIDDEN');
    }) as typeof fetch;

    const startDate = '2026-11-02';

    // 1. N5 clip: must NOT pick N1 from JMdict decoy on 食べる
    const n5Sentences = ['学生は本を食べます。', '新しい学校へ行きます。'];
    const n5First = await analyzeClipMetadata(n5Sentences, { dbFile, startDate });
    const n5Second = await analyzeClipMetadata(n5Sentences, { dbFile, startDate });
    assert.deepEqual(n5First, n5Second, 'analysis must be deterministic across repeated calls');
    assert.equal(n5First.machineTranslationAvailable, false);
    assert.equal(n5First.suggestedLevel, 'N5');
    assert.ok(n5First.suggestedTags.includes('N5'));
    assert.ok(!n5First.suggestedTags.includes('N1'), 'JMdict decoy must never leak into OpenJLPT tags');
    assert.ok(n5First.suggestedWeek !== null && n5First.suggestedWeek >= 1 && n5First.suggestedWeek <= 12);
    assert.ok(n5First.suggestedWeekReason && n5First.suggestedWeekReason.includes(`Tuần ${n5First.suggestedWeek}`));
    assert.equal(n5First.segments[0].furigana, '{学生|がくせい}は{本|ほん}を{食|た}べます。');

    // 2. N3 clip: must match N3 level, grammar pattern tag, and exact N3 week from allocateRoadmap
    const n3Sentences = ['毎日試験のために経験を積むようにする。'];
    const n3Res = await analyzeClipMetadata(n3Sentences, { dbFile, startDate });
    assert.equal(n3Res.suggestedLevel, 'N3');
    assert.ok(n3Res.suggestedTags.includes('N3'));
    assert.ok(n3Res.suggestedTags.includes('〜ようにする'));
    assert.ok(n3Res.suggestedTags.includes('nhấn mạnh'));

    // Verify suggestedWeek matches allocateRoadmap for N3 items
    const verifyDb = new DatabaseSync(dbFile);
    const expectedN3Weeks = new Set<number>();
    try {
      const cmp = (a: CatalogItem, b: CatalogItem) => (a.id < b.id ? -1 : Number(a.id > b.id));
      const allocated = allocateRoadmap(readRoadmapCatalog(verifyDb), startDate, cmp);
      for (const wk of allocated) {
        if (wk.items.some((it) => it.id === 'openjlpt:grammar:n3-youni' || it.id === 'openjlpt:vocab:n3-keiken')) {
          expectedN3Weeks.add(wk.week);
        }
      }
    } finally {
      verifyDb.close();
    }
    assert.ok(n3Res.suggestedWeek !== null && expectedN3Weeks.has(n3Res.suggestedWeek));
    assert.ok(n3Res.suggestedWeek! >= 36 && n3Res.suggestedWeek! <= 57);
  } finally {
    globalThis.fetch = origFetch;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('client files never import kuromoji or server-only auto-meta modules', () => {
  const clientFiles = [
    'src/app/(study)/shadowing/clip-maker.tsx',
    'src/app/(study)/shadowing/library.tsx',
    'src/app/(study)/shadowing/player.tsx',
    'src/app/(study)/shadowing/auto-meta-model.ts',
    'src/app/(study)/shadowing/clip-maker-model.ts',
  ];
  for (const rel of clientFiles) {
    const src = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.equal(/\bkuromoji\b/.test(src), false, `${rel} must not reference kuromoji`);
    assert.equal(/auto-meta-server/.test(src), false, `${rel} must not import auto-meta-server`);
    assert.equal(/node:sqlite/.test(src), false, `${rel} must not import node:sqlite`);
    assert.equal(/today-roadmap\/repository/.test(src), false, `${rel} must not import roadmap repository`);
  }
});

test('analyze API handler enforces auth, same-origin, validation, and returns offline results', async () => {
  const dir = makeTempDir();
  const dbFile = path.join(dir, 'demo.sqlite');
  try {
    seedDemo(dbFile);

    // Unauthenticated -> 401 + private, no-store + no Set-Cookie
    const unauth = await handleShadowingClipsAnalyzePost(
      new Request('http://127.0.0.1/api/shadowing/clips/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: ['学生は本を見ます。'] }),
      }),
      {
        isAuthenticated: async () => false,
        sameOriginCheck: () => true,
        dbFile,
        startDate: '2026-11-02',
      },
    );
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get('cache-control'), 'private, no-store');
    assert.equal(unauth.headers.get('set-cookie'), null);

    // Cross-origin -> 403
    const badOrigin = await handleShadowingClipsAnalyzePost(
      new Request('http://127.0.0.1/api/shadowing/clips/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: ['学生は本を見ます。'] }),
      }),
      {
        isAuthenticated: async () => true,
        sameOriginCheck: () => false,
        dbFile,
        startDate: '2026-11-02',
      },
    );
    assert.equal(badOrigin.status, 403);

    // Empty sentences -> 400
    const empty = await handleShadowingClipsAnalyzePost(
      new Request('http://127.0.0.1/api/shadowing/clips/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: [] }),
      }),
      {
        isAuthenticated: async () => true,
        sameOriginCheck: () => true,
        dbFile,
        startDate: '2026-11-02',
      },
    );
    assert.equal(empty.status, 400);

    // Oversized body -> 413
    const huge = await handleShadowingClipsAnalyzePost(
      new Request('http://127.0.0.1/api/shadowing/clips/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: ['あ'.repeat(70_000)] }),
      }),
      {
        isAuthenticated: async () => true,
        sameOriginCheck: () => true,
        dbFile,
        startDate: '2026-11-02',
      },
    );
    assert.equal(huge.status, 413);

    // Valid request -> 200
    const ok = await handleShadowingClipsAnalyzePost(
      new Request('http://127.0.0.1/api/shadowing/clips/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: ['学生は本を見ます。', '新しい学校へ行きます。'] }),
      }),
      {
        isAuthenticated: async () => true,
        sameOriginCheck: () => true,
        dbFile,
        startDate: '2026-11-02',
      },
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'private, no-store');
    assert.equal(ok.headers.get('set-cookie'), null);
    const body = (await ok.json()) as {
      segments: { ja: string; furigana: string; kana: string }[];
      suggestedLevel: string | null;
      suggestedTags: string[];
      suggestedWeek: number | null;
      machineTranslationAvailable: boolean;
    };
    assert.equal(body.segments.length, 2);
    assert.equal(body.segments[0].furigana, '{学生|がくせい}は{本|ほん}を{見|み}ます。');
    assert.equal(body.suggestedLevel, 'N5');
    assert.ok(body.suggestedTags.includes('N5'));
    assert.ok(body.suggestedWeek !== null && body.suggestedWeek >= 1 && body.suggestedWeek <= 12);
    assert.equal(body.machineTranslationAvailable, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('clip persistence preserves user-edited furigana, tags, roadmapWeek and remains backward-compatible with v1 clips', async () => {
  const dir = makeTempDir();
  const storePath = path.join(dir, 'shadowing-clips.json');
  const mediaDir = path.join(dir, 'shadowing-media');
  try {
    // Reject invalid furigana or out-of-range roadmap week in draft validation
    const badFuri = validateClipDraft({
      kind: 'youtube',
      title: 'Bad furi',
      durationMs: 20_000,
      clipStartMs: 0,
      clipEndMs: 10_000,
      youtubeUrlOrId: 'dQw4w9WgXcQ',
      segments: [{ id: 's1', startMs: 0, endMs: 5000, ja: '学生です。', furigana: '{学校|がっこう}です。' }],
    });
    assert.equal(badFuri.ok, false);
    if (!badFuri.ok) assert.equal(badFuri.code, 'INVALID_SEGMENT_FURIGANA');

    const badWeek = validateClipDraft({
      kind: 'youtube',
      title: 'Bad week',
      roadmapWeek: 99,
      durationMs: 20_000,
      clipStartMs: 0,
      clipEndMs: 10_000,
      youtubeUrlOrId: 'dQw4w9WgXcQ',
      segments: [{ id: 's1', startMs: 0, endMs: 5000, ja: '学生です。' }],
    });
    assert.equal(badWeek.ok, false);
    if (!badWeek.ok) assert.equal(badWeek.code, 'INVALID_ROADMAP_WEEK');

    const deps = {
      isAuthenticated: async () => true,
      sameOriginCheck: () => true,
      storePath,
      mediaDir,
      whisperAvailable: false,
    };

    // 1. Save file clip with user-edited furigana, edited tags, and manually selected roadmapWeek
    const form = new FormData();
    form.set('file', new Blob([makeWebmBytes()], { type: 'video/webm' }), 'sample.webm');
    form.set('mime', 'video/webm');
    form.set(
      'metadata',
      JSON.stringify({
        title: 'Clip tự sửa meta',
        level: 'N4',
        topic: 'Trường học',
        tags: ['N4', 'hội thoại tự thêm'],
        roadmapWeek: 18,
        durationMs: 15_000,
        clipStartMs: 0,
        clipEndMs: 10_000,
        segments: [
          {
            id: 's1',
            startMs: 0,
            endMs: 5_000,
            ja: '今日はいい天気ですね。',
            furigana: '{今日|きょう}はいい{天気|てんき}ですね。',
          },
          {
            id: 's2',
            startMs: 5_000,
            endMs: 10_000,
            ja: '学生は本を見ます。',
            furigana: '{学生|がくせい}は{本|ほん}を{見|み}ます。',
            vi: 'Học sinh xem sách.',
          },
        ],
      }),
    );

    const fileRes = await handleShadowingClipsPost(
      new Request('http://127.0.0.1/api/shadowing/clips', { method: 'POST', body: form }),
      deps,
    );
    assert.equal(fileRes.status, 201);

    // 2. Save YouTube clip with edited furigana/tags/week
    const ytRes = await handleShadowingClipsPost(
      new Request('http://127.0.0.1/api/shadowing/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'youtube',
          title: 'YouTube tự sửa meta',
          level: 'N5',
          topic: 'Lớp học',
          tags: ['N5', 'ghi chú riêng'],
          roadmapWeek: 7,
          durationMs: 30_000,
          clipStartMs: 2_000,
          clipEndMs: 12_000,
          youtubeUrlOrId: 'https://youtu.be/abcDEF12345',
          segments: [
            {
              id: 'y1',
              startMs: 2_000,
              endMs: 12_000,
              ja: '学校へ行きます。',
              furigana: '{学校|がっこう}へ{行|い}きます。',
            },
          ],
        }),
      }),
      deps,
    );
    assert.equal(ytRes.status, 201);

    // Reload from disk and verify exact persistence
    const stored = readUserClipStore(storePath);
    assert.equal(stored.clips.length, 2);
    assert.deepEqual(stored.clips[0].tags, ['N4', 'hội thoại tự thêm']);
    assert.equal(stored.clips[0].roadmapWeek, 18);
    assert.equal(stored.clips[0].segments[0].furigana, '{今日|きょう}はいい{天気|てんき}ですね。');
    assert.equal(stored.clips[0].segments[0].kana, 'きょうはいいてんきですね。');

    const playable = listUserShadowingClips(undefined, storePath);
    assert.equal(playable.length, 2);
    assert.deepEqual(playable[0].tags, ['N4', 'hội thoại tự thêm']);
    assert.equal(playable[0].roadmapWeek, 18);
    assert.equal(playable[0].segments[0].furigana, '{今日|きょう}はいい{天気|てんき}ですね。');
    assert.equal(playable[0].segments[0].kana, 'きょうはいいてんきですね。');
    assert.deepEqual(playable[1].tags, ['N5', 'ghi chú riêng']);
    assert.equal(playable[1].roadmapWeek, 7);
    assert.equal(playable[1].segments[0].furigana, '{学校|がっこう}へ{行|い}きます。');

    // 3. Backward-compatibility: strip tags, roadmapWeek, and furigana from stored JSON as in PR #115
    const rawJson = JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
      version: 1;
      clips: Record<string, unknown>[];
    };
    delete rawJson.clips[1].tags;
    delete rawJson.clips[1].roadmapWeek;
    for (const seg of rawJson.clips[1].segments as Record<string, unknown>[]) {
      delete seg.furigana;
    }
    fs.writeFileSync(storePath, JSON.stringify(rawJson, null, 2));

    const legacyPlayable = listUserShadowingClips(undefined, storePath);
    assert.equal(legacyPlayable.length, 2);
    assert.deepEqual(legacyPlayable[1].tags, []);
    assert.equal(legacyPlayable[1].roadmapWeek, null);
    assert.equal(legacyPlayable[1].segments[0].furigana, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
