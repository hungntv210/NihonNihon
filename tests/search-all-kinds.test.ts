import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fixture } from './helpers.ts';
import { createSession, hashPassword, SESSION_COOKIE } from '../src/core/session.ts';
import {
  SEARCH_GROUP_LIMIT,
  clipSentenceHref,
  searchAllKinds,
} from '../src/app/(study)/common-tools/repository.ts';
import { listShadowingClips } from '../src/app/(study)/shadowing/clips.ts';
import { resolveShadowingSelection } from '../src/app/(study)/shadowing/query.ts';
import { seedPrivateClipFixture } from '../src/app/(study)/shadowing/private-fixture.ts';
import { proxy } from '../src/proxy.ts';

function sha256(label: string): string {
  return createHash('sha256').update(label).digest('hex');
}

function ensureTestSource(db: ReturnType<typeof fixture>['db']) {
  db.prepare(
    `INSERT OR IGNORE INTO data_sources(source_id,name,url,license,version,attribution,usage_scope)
     VALUES('test-all-kinds','Synthetic Search Source','local://search-test','MIT','1','Synthetic','private_only')`,
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json)
     VALUES('rel-all-kinds','test-all-kinds','1',?,'local://search-test','2026-11-21','MIT','Synthetic','{}')`,
  ).run('a'.repeat(64));
}

function seedPrivateClipWithSegments(
  db: ReturnType<typeof fixture>['db'],
  directory: string,
  clipId: string,
  segments: Array<{ id: string; ja: string; kana: string; vi: string; speaker?: string }>,
) {
  const media = path.join(directory, `${clipId.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`);
  const bytes = fs.readFileSync(path.resolve('src/app/(study)/shadowing/demo.webm'));
  fs.writeFileSync(media, bytes);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const release = `rel-${clipId}`;
  const stepMs = 1500;
  const clipStartMs = 500;
  const clipEndMs = clipStartMs + Math.max(segments.length * stepMs, 12000);
  const durationMs = clipEndMs + 1000;
  const metadata = {
    id: clipId,
    title: `Clip ${clipId}`,
    level: 'N5',
    topic: 'Kiểm thử tìm kiếm',
    duration_ms: durationMs,
    clip_start_ms: clipStartMs,
    clip_end_ms: clipEndMs,
    origin: {
      kind: 'file',
      path: media,
      sha256: checksum,
      attribution: 'Synthetic test fixture',
      license: 'Private use',
    },
    segments: segments.map((s, idx) => ({
      id: s.id,
      ja: s.ja,
      kana: s.kana,
      vi: s.vi,
      speaker: s.speaker ?? '先生',
      start_ms: clipStartMs + idx * stepMs,
      end_ms: clipStartMs + (idx + 1) * stepMs,
    })),
  };

  db.prepare(
    `INSERT OR IGNORE INTO data_sources(source_id,name,url,license,version,attribution,usage_scope)
     VALUES('user-media','Synthetic private media','local://fixture','Private use','1','Synthetic','private_only')`,
  ).run();
  db.prepare(
    `INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json)
     VALUES(?,'user-media','fixture',?,'local://fixture','2026-11-21','Private use','Synthetic',?)`,
  ).run(release, checksum, JSON.stringify(metadata));
  db.prepare(
    `INSERT INTO content_items(item_id,kind,source_key,source_id,release_id,source_hash,is_active)
     VALUES(?,'clip',?,'user-media',?,?,1)`,
  ).run(clipId, clipId, release, checksum);
  db.prepare(
    `INSERT INTO media_assets(asset_id,item_id,asset_kind,storage_ref,source_id,release_id,attribution,license,private_only)
     VALUES(?,?,'video',?,'user-media',?,'Synthetic','Private use',1)`,
  ).run(`asset-${clipId}`, clipId, media, release);

  return { media, release };
}

test('searchAllKinds returns all 4 groups with NFKC, kana, romaji, and accent-free matching', (t) => {
  const { db, file } = fixture(t);
  const directory = path.dirname(file);
  ensureTestSource(db);

  // Seed one extra vocab, kanji, grammar, and clip sentence sharing a distinctive marker "天" / "天気"
  db.prepare(
    `INSERT INTO content_items(item_id,kind,source_key,source_id,release_id,source_hash,is_active)
     VALUES('v-tenki','vocab','tenki','test-all-kinds','rel-all-kinds',?,1),
           ('k-ten','kanji','天','test-all-kinds','rel-all-kinds',?,1),
           ('g-tenki','grammar','天気〜','test-all-kinds','rel-all-kinds',?,1)`,
  ).run(sha256('v-tenki'), sha256('k-ten'), sha256('g-tenki'));
  db.prepare(
    `INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id)
     VALUES('v-tenki','天気','てんき','tenki','N5','["weather"]','["noun"]',NULL)`,
  ).run();
  db.prepare(
    `INSERT INTO kanji(item_id,character,level,strokes,onyomi,kunyomi,nanori,meanings_en)
     VALUES('k-ten','天','N5',4,'["テン"]','["あま"]','[]','["heaven","weather"]')`,
  ).run();
  db.prepare(
    `INSERT INTO grammar(item_id,pattern,reading,romaji,level,meaning_en,formation_en,notes_en,tags)
     VALUES('g-tenki','天気ですね','てんきですね','tenkidesune','N5','nice weather expression','','','[]')`,
  ).run();

  const res = searchAllKinds(db, '天', { youtubeFile: '' });
  assert.ok(res.groups.vocab.items.some((i) => i.id === 'v-tenki'), 'vocab group has 天気');
  assert.ok(res.groups.kanji.items.some((i) => i.id === 'k-ten'), 'kanji group has 天');
  assert.ok(res.groups.grammar.items.some((i) => i.id === 'g-tenki'), 'grammar group has 天気ですね');
  assert.ok(
    res.groups.clipSentences.items.some(
      (hit) => hit.clipId === 'demo' && hit.segmentId === 'demo-1' && hit.ja.includes('天気'),
    ),
    'clipSentences group has demo clip sentence containing 天気',
  );
  assert.equal(
    res.total,
    res.groups.vocab.total +
      res.groups.kanji.total +
      res.groups.grammar.total +
      res.groups.clipSentences.total,
  );

  // NFKC: fullwidth ASCII and halfwidth katakana match both DB items and clip sentences
  const fullwidth = searchAllKinds(db, 'ｇａｋｕｓｅｉ', { youtubeFile: '' });
  assert.ok(fullwidth.groups.vocab.items.some((i) => i.title === '学生'));

  const halfwidthKana = searchAllKinds(db, 'ｵﾊﾖｳ', { youtubeFile: '' });
  assert.ok(
    halfwidthKana.groups.clipSentences.items.some(
      (hit) => hit.clipId === 'demo' && hit.segmentId === 'demo-0',
    ),
    'halfwidth katakana matches demo clip sentence via NFKC',
  );

  // Romaji and accent-free Vietnamese match clip sentences
  const romajiClip = searchAllKinds(db, 'ohayou', { youtubeFile: '' });
  assert.ok(romajiClip.groups.clipSentences.items.some((hit) => hit.segmentId === 'demo-0'));

  const accentFreeVi = searchAllKinds(db, 'chao buoi sang', { youtubeFile: '' });
  assert.ok(accentFreeVi.groups.clipSentences.items.some((hit) => hit.segmentId === 'demo-0'));

  // Verify private clip + NFKC fullwidth in clip text
  seedPrivateClipWithSegments(db, directory, 'user-media:clip:nfkc-demo', [
    { id: 'seg-a', ja: 'Ｎ５のテストです。', kana: 'えぬごのてすとです。', vi: 'Bài kiểm tra N5.' },
  ]);
  const nfkcClip = searchAllKinds(db, 'n5', { youtubeFile: '' });
  assert.ok(
    nfkcClip.groups.clipSentences.items.some(
      (hit) => hit.clipId === 'user-media:clip:nfkc-demo' && hit.segmentId === 'seg-a',
    ),
  );
});

test('searchAllKinds caps each of the 4 groups at 10 items while reporting exact totals', (t) => {
  const { db, file } = fixture(t);
  const directory = path.dirname(file);
  ensureTestSource(db);

  const count = 12;
  const kanjiChars = ['亜', '哀', '挨', '愛', '曖', '悪', '握', '圧', '扱', '宛', '嵐', '安'];
  for (let i = 0; i < count; i++) {
    const pad = String(i).padStart(2, '0');
    db.prepare(
      `INSERT INTO content_items(item_id,kind,source_key,source_id,release_id,source_hash,is_active)
       VALUES(?,'vocab',?,'test-all-kinds','rel-all-kinds',?,1),
             (?,'kanji',?,'test-all-kinds','rel-all-kinds',?,1),
             (?,'grammar',?,'test-all-kinds','rel-all-kinds',?,1)`,
    ).run(
      `cap-v-${pad}`,
      `cap-v-${pad}`,
      sha256(`hv-${pad}`),
      `cap-k-${pad}`,
      `cap-k-${pad}`,
      sha256(`hk-${pad}`),
      `cap-g-${pad}`,
      `cap-g-${pad}`,
      sha256(`hg-${pad}`),
    );
    db.prepare(
      `INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id)
       VALUES(?,?,?,'capmarker','N5','["capmarker term"]','["noun"]',NULL)`,
    ).run(`cap-v-${pad}`, `共通語${pad}`, `きょうつうご${pad}`);
    db.prepare(
      `INSERT INTO kanji(item_id,character,level,strokes,onyomi,kunyomi,nanori,meanings_en)
       VALUES(?,?,'N5',8,'["キョウ"]','["とも"]','[]','["capmarker kanji"]')`,
    ).run(`cap-k-${pad}`, kanjiChars[i]);
    db.prepare(
      `INSERT INTO grammar(item_id,pattern,reading,romaji,level,meaning_en,formation_en,notes_en,tags)
       VALUES(?,?,?,'capmarker grammar','N5','capmarker pattern','','','[]')`,
    ).run(`cap-g-${pad}`, `〜共通${pad}`, `きょうつう${pad}`);
  }

  seedPrivateClipWithSegments(
    db,
    directory,
    'user-media:clip:cap-twelve',
    Array.from({ length: count }, (_, i) => ({
      id: `cap-seg-${i}`,
      ja: `capmarker の例文 ${i + 1} です。`,
      kana: `れいぶん ${i + 1}`,
      vi: `Câu mẫu capmarker số ${i + 1}.`,
    })),
  );

  const res = searchAllKinds(db, 'capmarker', { youtubeFile: '' });
  assert.equal(SEARCH_GROUP_LIMIT, 10);
  assert.equal(res.limitPerKind, 10);
  assert.equal(res.groups.vocab.total, count);
  assert.equal(res.groups.vocab.items.length, 10);
  assert.equal(res.groups.kanji.total, count);
  assert.equal(res.groups.kanji.items.length, 10);
  assert.equal(res.groups.grammar.total, count);
  assert.equal(res.groups.grammar.items.length, 10);
  assert.equal(res.groups.clipSentences.total, count);
  assert.equal(res.groups.clipSentences.items.length, 10);
  assert.equal(res.total, count * 4);
});

test('clip sentence links resolve to exact shadowing segment and exclude deleted/inactive clips', (t) => {
  const { db, file } = fixture(t);
  const directory = path.dirname(file);

  // 1. Seed a real private clip using shadowing private-fixture + a YouTube clip descriptor
  const priv = seedPrivateClipFixture(file, directory);
  const youtubeFile = path.join(directory, 'youtube-clip.json');
  const youtubeClip = {
    id: 'yt-search-demo',
    title: 'YouTube Chào Hỏi',
    level: 'N5',
    topic: 'Giao tiếp',
    duration_ms: 30000,
    clip_start_ms: 1000,
    clip_end_ms: 21000,
    origin: {
      kind: 'youtube',
      video_id: 'dQw4w9WgXcQ',
      attribution: 'Synthetic YouTube fixture',
      license: 'Test only',
    },
    subtitle_sources: {
      ja: 'YouTube ja manual',
      vi: 'YouTube vi manual',
    },
    segments: [
      { id: 'yt-0', ja: 'はじめまして。', kana: 'はじめまして。', vi: 'Rất vui được gặp bạn.', start_ms: 1000, end_ms: 5000 },
      { id: 'yt-1', ja: '図書館で勉強します。', kana: 'としょかんでべんきょうします。', vi: 'Tôi học ở thư viện.', start_ms: 5000, end_ms: 12000 },
      { id: 'yt-2', ja: 'また明日会いましょう。', kana: 'またあしたあいましょう。', vi: 'Hẹn gặp lại ngày mai.', start_ms: 12000, end_ms: 20000 },
    ],
  };
  fs.writeFileSync(youtubeFile, JSON.stringify(youtubeClip));

  const activeClips = listShadowingClips(file, youtubeFile);

  // Demo clip link resolves to exact segment index 1 (demo-1)
  const demoRes = searchAllKinds(db, 'いい天気', { youtubeFile });
  const demoHit = demoRes.groups.clipSentences.items.find((h) => h.clipId === 'demo');
  assert.ok(demoHit);
  assert.equal(demoHit.href, clipSentenceHref('demo', 'demo-1'));
  assert.equal(demoHit.href, '/shadowing?clip=demo&segment=demo-1');
  const demoUrl = new URL(demoHit.href, 'http://localhost');
  assert.deepEqual(
    resolveShadowingSelection(activeClips, {
      clip: demoUrl.searchParams.get('clip') ?? undefined,
      segment: demoUrl.searchParams.get('segment') ?? undefined,
    }),
    { clipId: 'demo', segmentIndex: 1 },
  );

  // YouTube clip link resolves to exact segment index 1 (yt-1)
  const ytRes = searchAllKinds(db, '図書館', { youtubeFile });
  const ytHit = ytRes.groups.clipSentences.items.find((h) => h.clipId === 'yt-search-demo');
  assert.ok(ytHit);
  assert.equal(ytHit.href, '/shadowing?clip=yt-search-demo&segment=yt-1');
  assert.equal(ytHit.segmentNumber, 2);
  const ytUrl = new URL(ytHit.href, 'http://localhost');
  assert.deepEqual(
    resolveShadowingSelection(activeClips, {
      clip: ytUrl.searchParams.get('clip') ?? undefined,
      segment: ytUrl.searchParams.get('segment') ?? undefined,
    }),
    { clipId: 'yt-search-demo', segmentIndex: 1 },
  );

  // Private clip link resolves to exact segment index 5 (synthetic-5: 'か。')
  const privRes = searchAllKinds(db, 'か。', { youtubeFile });
  const privHit = privRes.groups.clipSentences.items.find((h) => h.clipId === priv.id);
  assert.ok(privHit);
  assert.equal(
    privHit.href,
    `/shadowing?clip=${encodeURIComponent(priv.id)}&segment=synthetic-5`,
  );
  const privUrl = new URL(privHit.href, 'http://localhost');
  assert.deepEqual(
    resolveShadowingSelection(activeClips, {
      clip: privUrl.searchParams.get('clip') ?? undefined,
      segment: privUrl.searchParams.get('segment') ?? undefined,
    }),
    { clipId: priv.id, segmentIndex: 5 },
  );

  // 2. Inactive private clip (is_active=0) must NOT produce any result or broken link
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(priv.id);
  const inactiveRes = searchAllKinds(db, 'か。', { youtubeFile });
  assert.equal(
    inactiveRes.groups.clipSentences.items.some((h) => h.clipId === priv.id),
    false,
    'inactive clip must be excluded',
  );

  // 3. Re-activate clip in DB but delete its media file on disk -> must NOT produce broken link
  db.prepare('UPDATE content_items SET is_active=1 WHERE item_id=?').run(priv.id);
  fs.unlinkSync(priv.media);
  const missingMediaRes = searchAllKinds(db, 'か。', { youtubeFile });
  assert.equal(
    missingMediaRes.groups.clipSentences.items.some((h) => h.clipId === priv.id),
    false,
    'clip with deleted media file must be excluded',
  );

  // 4. Deleted YouTube descriptor file -> must NOT produce any result or broken link
  fs.unlinkSync(youtubeFile);
  const deletedYtRes = searchAllKinds(db, '図書館', { youtubeFile });
  assert.equal(
    deletedYtRes.groups.clipSentences.items.some((h) => h.clipId === 'yt-search-demo'),
    false,
    'deleted YouTube clip must be excluded',
  );
});

test('/common-tools/search enforces authentication (307) and private no-store cache headers', () => {
  const prevHash = process.env.NIHON_PASSWORD_HASH;
  const prevSecret = process.env.SESSION_SECRET;
  const secret = 's'.repeat(64);
  process.env.NIHON_PASSWORD_HASH = hashPassword('test-password-only');
  process.env.SESSION_SECRET = secret;
  try {
    const unauth = proxy(new NextRequest('http://localhost:3000/common-tools/search?q=gakusei'));
    assert.equal(unauth.status, 307);
    assert.equal(new URL(unauth.headers.get('location')!).pathname, '/login');
    assert.equal(unauth.headers.get('cache-control'), 'private, no-store');
    assert.equal(unauth.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

    const token = createSession(secret, Date.now());
    const auth = proxy(
      new NextRequest('http://localhost:3000/common-tools/search?q=gakusei', {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    assert.equal(auth.status, 200);
    assert.equal(auth.headers.get('cache-control'), 'private, no-store');
    assert.equal(auth.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  } finally {
    if (prevHash === undefined) delete process.env.NIHON_PASSWORD_HASH;
    else process.env.NIHON_PASSWORD_HASH = prevHash;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  }
});
