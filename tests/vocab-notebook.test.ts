import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { fixture } from './helpers.ts';
import { openContentDatabase } from '../src/core/content.ts';
import { enqueueCard } from '../src/core/review.ts';
import { createSession, hashPassword, SESSION_COOKIE } from '../src/core/session.ts';
import { saveLookupItemToSrs } from '../src/app/(study)/common-tools/lookup-store.ts';
import { syntheticClip } from '../src/app/(study)/shadowing/clip-model.ts';
import {
  formatNotebookDate,
  listVocabNotebook,
  loadShadowingClipCatalog,
  notebookUrl,
  parseNotebookSource,
  resolveClipLink,
} from '../src/app/(study)/vocab/notebook/data.ts';
import { proxy } from '../src/proxy.ts';

function pickVocabIds(db: ReturnType<typeof fixture>['db'], count: number): string[] {
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
}

test('vocab notebook sorts newest-first, filters by source, and formats dates in Asia/Ho_Chi_Minh', (t) => {
  const { db, file } = fixture(t);
  const [clipId, lookupId, srsId] = pickVocabIds(db, 3);
  const contextPath = path.join(path.dirname(file), 'lookup-sentences.json');
  const demoSegment = syntheticClip.segments[1];

  // 1. Saved from shadowing clip at 09:00 UTC
  saveLookupItemToSrs({
    dbPath: file,
    contextPath,
    itemId: clipId,
    sentenceJa: demoSegment.ja,
    sentenceVi: demoSegment.vi,
    sourceClipId: syntheticClip.id,
    now: new Date('2026-11-21T09:00:00.000Z'),
  });

  // 2. Saved from lookup without clip at 11:30 UTC (newest)
  saveLookupItemToSrs({
    dbPath: file,
    contextPath,
    itemId: lookupId,
    sentenceJa: '私は学生です。',
    sentenceVi: null,
    sourceClipId: null,
    now: new Date('2026-11-21T11:30:00.000Z'),
  });

  // 3. Added directly to SRS with an earlier review timestamp than card.updated_at (oldest)
  const srsCard = enqueueCard(file, srsId, 'recognition', new Date('2026-11-21T12:00:00.000Z'));
  db.prepare(
    `INSERT INTO srs_reviews(review_id, card_id, rating, reviewed_at, elapsed_ms, scheduler_version)
     VALUES('rev-oldest', ?, 3, '2026-11-20T05:00:00.000Z', 1200, 'fsrs-5')`,
  ).run(srsCard.cardId);

  const roDb = openContentDatabase(file);
  try {
    const all = listVocabNotebook(roDb, { contextPath, youtubeFile: '' });
    assert.equal(all.total, 3);
    assert.equal(all.filteredTotal, 3);
    assert.equal(all.source, 'all');
    assert.deepEqual(all.counts, { all: 3, clip: 1, lookup: 1, jlpt: 0, srs: 1 });
    assert.deepEqual(
      all.items.map((item) => [item.id, item.source]),
      [
        [lookupId, 'lookup'],
        [clipId, 'clip'],
        [srsId, 'srs'],
      ],
    );

    const clipEntry = all.items.find((item) => item.id === clipId)!;
    assert.equal(clipEntry.sentenceJa, demoSegment.ja);
    assert.equal(clipEntry.sentenceVi, demoSegment.vi);
    assert.equal(clipEntry.clipHref, `/shadowing?clip=demo&segment=${demoSegment.id}`);
    assert.equal(clipEntry.segmentNumber, 2);

    const lookupEntry = all.items.find((item) => item.id === lookupId)!;
    assert.equal(lookupEntry.sentenceJa, '私は学生です。');
    assert.equal(lookupEntry.clipHref, null);

    const srsEntry = all.items.find((item) => item.id === srsId)!;
    assert.equal(srsEntry.sentenceJa, null);
    assert.equal(srsEntry.addedAt, '2026-11-20T05:00:00.000Z');
    assert.equal(formatNotebookDate(srsEntry.addedAt), '20/11/2026');
    assert.equal(formatNotebookDate('2026-11-21T18:30:00.000Z'), '22/11/2026');

    // Filter by each source
    const clipOnly = listVocabNotebook(roDb, { source: 'clip', contextPath, youtubeFile: '' });
    assert.equal(clipOnly.total, 3);
    assert.equal(clipOnly.filteredTotal, 1);
    assert.equal(clipOnly.items[0].id, clipId);

    const lookupOnly = listVocabNotebook(roDb, { source: 'lookup', contextPath, youtubeFile: '' });
    assert.equal(lookupOnly.filteredTotal, 1);
    assert.equal(lookupOnly.items[0].id, lookupId);

    const srsOnly = listVocabNotebook(roDb, { source: 'srs', contextPath, youtubeFile: '' });
    assert.equal(srsOnly.filteredTotal, 1);
    assert.equal(srsOnly.items[0].id, srsId);

    // Query parser & URL helper
    assert.equal(parseNotebookSource(undefined), 'all');
    assert.equal(parseNotebookSource('reader'), 'all');
    assert.equal(parseNotebookSource('jlpt'), 'jlpt');
    assert.equal(parseNotebookSource('clip'), 'clip');
    assert.equal(parseNotebookSource(['lookup', 'srs']), 'lookup');
    assert.equal(notebookUrl('all'), '/vocab/notebook');
    assert.equal(notebookUrl('clip'), '/vocab/notebook?source=clip');
    assert.equal(notebookUrl('jlpt'), '/vocab/notebook?source=jlpt');
  } finally {
    roDb.close();
  }
});

test('clip resolver links exact clip and segment for demo & private clips and avoids broken links for missing clips', (t) => {
  const { db, file } = fixture(t);

  // Insert an active private user-media clip with 2 valid segments (10s..60s clip window)
  const checksum = '0'.repeat(64);
  const manifest = JSON.stringify({
    title: 'Clip thử nghiệm riêng tư',
    level: 'N5',
    topic: 'Chào hỏi',
    duration_ms: 15000,
    clip_start_ms: 0,
    clip_end_ms: 12000,
    origin: {
      kind: 'file',
      attribution: 'Clip tự ghi âm',
      license: 'Private use only',
      sha256: checksum,
    },
    segments: [
      { id: 'seg-a', start_ms: 0, end_ms: 5000, ja: 'おはようございます。', vi: 'Chào buổi sáng.' },
      { id: 'seg-b', start_ms: 5000, end_ms: 11000, ja: 'ありがとうございます。', vi: 'Cảm ơn bạn.' },
    ],
  });
  db.prepare(
    `INSERT OR IGNORE INTO data_sources(source_id, name, url, license, attribution, usage_scope)
     VALUES('user-media', 'User-supplied media', 'local://user-media', 'Private', 'Private clip', 'private_only')`,
  ).run();
  db.prepare(
    `INSERT INTO source_releases(release_id, source_id, version, checksum, artifact_url, retrieved_at, license, attribution, manifest_json)
     VALUES('rel-priv-clip', 'user-media', '1', ?, 'local://clip-1', '2026-11-21T00:00:00Z', 'Private', 'Private clip', ?)`,
  ).run(checksum, manifest);
  db.prepare(
    `INSERT INTO content_items(item_id, kind, source_id, source_key, release_id, source_hash, is_active)
     VALUES('priv-clip-1', 'clip', 'user-media', 'priv-clip-1', 'rel-priv-clip', ?, 1)`,
  ).run(checksum);
  db.prepare(
    `INSERT INTO media_assets(asset_id, item_id, asset_kind, storage_ref, source_id, release_id, attribution, license, private_only)
     VALUES('asset-priv-1', 'priv-clip-1', 'video', 'private/demo.mp4', 'user-media', 'rel-priv-clip', 'Private clip', 'Private', 1)`,
  ).run();

  const roDb = openContentDatabase(file);
  try {
    const catalog = loadShadowingClipCatalog(roDb, '');
    const firstDemo = syntheticClip.segments[0];
    const demoMatch = resolveClipLink(catalog, syntheticClip.id, firstDemo.ja);
    assert.deepEqual(demoMatch, {
      href: `/shadowing?clip=${syntheticClip.id}&segment=${firstDemo.id}`,
      clipTitle: syntheticClip.title,
      segmentNumber: 1,
    });

    const demoFallback = resolveClipLink(catalog, syntheticClip.id, 'Câu không khớp phụ đề.');
    assert.equal(demoFallback?.href, '/shadowing?clip=demo');
    assert.equal(demoFallback?.segmentNumber, null);

    const privateMatch = resolveClipLink(catalog, 'priv-clip-1', 'ありがとうございます。');
    assert.deepEqual(privateMatch, {
      href: '/shadowing?clip=priv-clip-1&segment=seg-b',
      clipTitle: 'Clip thử nghiệm riêng tư',
      segmentNumber: 2,
    });

    // Missing or deleted clip produces null (never a broken link)
    assert.equal(resolveClipLink(catalog, 'deleted-clip-404', 'おはようございます。'), null);
    assert.equal(resolveClipLink(catalog, null, 'おはようございます。'), null);
  } finally {
    roDb.close();
  }
});

test('vocab notebook handles empty states, stays strictly read-only, and excludes inactive or non-vocab items', (t) => {
  const { db, file } = fixture(t);
  const [activeId, inactiveId] = pickVocabIds(db, 2);
  const missingContextPath = path.join(path.dirname(file), 'private', 'lookup-sentences.json');

  const roDb = openContentDatabase(file);
  try {
    // 1. Completely empty state; missing lookup store must NOT be created
    const empty = listVocabNotebook(roDb, { contextPath: missingContextPath, youtubeFile: '' });
    assert.equal(empty.total, 0);
    assert.equal(empty.filteredTotal, 0);
    assert.deepEqual(empty.counts, { all: 0, clip: 0, lookup: 0, jlpt: 0, srs: 0 });
    assert.equal(fs.existsSync(missingContextPath), false);

    // 2. Add one active vocab to SRS, deactivate another vocab with SRS card, and add a kanji card to SRS
    enqueueCard(file, activeId, 'recognition', new Date('2026-11-21T08:00:00.000Z'));
    enqueueCard(file, inactiveId, 'recognition', new Date('2026-11-21T09:00:00.000Z'));
    db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(inactiveId);

    const kanjiRow = db
      .prepare("SELECT item_id FROM content_items WHERE kind='kanji' AND is_active=1 LIMIT 1")
      .get();
    if (kanjiRow) {
      enqueueCard(file, String(kanjiRow.item_id), 'recognition', new Date('2026-11-21T10:00:00.000Z'));
    }

    const result = listVocabNotebook(roDb, { contextPath: missingContextPath, youtubeFile: '' });
    assert.equal(result.total, 1);
    assert.deepEqual(
      result.items.map((item) => item.id),
      [activeId],
    );
    assert.equal(fs.existsSync(missingContextPath), false);

    // 3. Filter with zero matches preserves total count
    const emptyClipFilter = listVocabNotebook(roDb, {
      source: 'clip',
      contextPath: missingContextPath,
      youtubeFile: '',
    });
    assert.equal(emptyClipFilter.total, 1);
    assert.equal(emptyClipFilter.filteredTotal, 0);
    assert.deepEqual(emptyClipFilter.items, []);
  } finally {
    roDb.close();
  }
});

test('/vocab/notebook requires authenticated session and sets private no-store headers via proxy', (t) => {
  const prevSecret = process.env.SESSION_SECRET;
  const prevHash = process.env.NIHON_PASSWORD_HASH;
  const secret = 'test-notebook-secret-'.repeat(3);
  process.env.SESSION_SECRET = secret;
  process.env.NIHON_PASSWORD_HASH = hashPassword('synthetic-notebook-password');
  t.after(() => {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevHash === undefined) delete process.env.NIHON_PASSWORD_HASH;
    else process.env.NIHON_PASSWORD_HASH = prevHash;
  });

  // Unauthenticated request -> redirected to /login with private, no-store
  const unauthReq = new NextRequest('http://localhost:3000/vocab/notebook?source=clip');
  const unauthRes = proxy(unauthReq);
  assert.equal(unauthRes.status, 307);
  assert.equal(new URL(unauthRes.headers.get('location')!).pathname, '/login');
  assert.equal(unauthRes.headers.get('cache-control'), 'private, no-store');
  assert.equal(unauthRes.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  // Authenticated request -> allowed with private, no-store
  const token = createSession(secret);
  const authReq = new NextRequest('http://localhost:3000/vocab/notebook?source=clip', {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
  const authRes = proxy(authReq);
  assert.equal(authRes.status, 200);
  assert.equal(authRes.headers.get('cache-control'), 'private, no-store');
  assert.equal(authRes.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});
