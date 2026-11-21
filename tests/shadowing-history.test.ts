import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fixture } from './helpers.ts';
import type { Clip } from '../src/app/(study)/shadowing/clip-model.ts';
import {
  formatHistoryDate,
  formatHistoryTime,
  summarizeAllClips,
  summarizeClipHistory,
} from '../src/app/(study)/shadowing/history-model.ts';
import {
  pinBestRecording,
  pruneShadowingHistory,
  readPinnedAudio,
  readShadowingHistory,
  recordShadowingTurn,
  unpinBestRecording,
} from '../src/app/(study)/shadowing/history-store.ts';
import {
  handleShadowingHistoryDelete,
  handleShadowingHistoryGet,
  handleShadowingHistoryPost,
  type ShadowingHistoryHandlerDeps,
} from '../src/app/api/shadowing/history/handler.ts';
import { createBackup, restoreBackup, validateBackup } from '../src/core/backup.ts';
import { hashPassword } from '../src/core/session.ts';
import { proxy } from '../src/proxy.ts';

const TEST_CLIPS: Clip[] = [
  {
    id: 'clip-alpha',
    title: 'Alpha clip',
    level: 'N5',
    topic: 'Greetings',
    duration: 10,
    attribution: 'Fixture',
    license: 'Test fixture',
    isDemo: false,
    mediaUrl: '/shadowing/media',
    youtubeId: null,
    start: 0,
    end: 10,
    segments: [
      { id: 'seg-1', start: 0, end: 5, ja: 'おはようございます。', kana: null, speaker: null, vi: 'Chào buổi sáng.' },
      { id: 'seg-2', start: 5, end: 10, ja: 'お元気ですか。', kana: null, speaker: null, vi: 'Bạn khỏe không?' },
    ],
  },
  {
    id: 'clip-beta',
    title: 'Beta clip',
    level: 'N4',
    topic: 'Travel',
    duration: 8,
    attribution: 'Fixture',
    license: 'Test fixture',
    isDemo: false,
    mediaUrl: '/shadowing/media',
    youtubeId: null,
    start: 0,
    end: 8,
    segments: [{ id: 'b-1', start: 0, end: 8, ja: '駅はどこですか。', kana: null, speaker: null, vi: 'Nhà ga ở đâu?' }],
  },
];

function makeDeps(
  root: string,
  overrides: Partial<ShadowingHistoryHandlerDeps> = {},
): ShadowingHistoryHandlerDeps {
  return {
    isAuthenticated: async () => true,
    sameOriginCheck: () => true,
    clips: () => TEST_CLIPS,
    historyPath: path.join(root, 'private', 'shadowing-history.json'),
    recordingsDir: path.join(root, 'recordings'),
    timeZone: 'Asia/Ho_Chi_Minh',
    ...overrides,
  };
}

test('shadowing history records turns newest-first with per-clip counts and latest practice date', (t) => {
  const { file } = fixture(t);
  const root = path.dirname(file);
  const historyPath = path.join(root, 'private', 'shadowing-history.json');
  const recordingsDir = path.join(root, 'recordings');

  const t1 = new Date('2026-11-10T02:00:00Z'); // 09:00 Asia/Ho_Chi_Minh (2026-11-10)
  const t2 = new Date('2026-11-12T10:30:00Z'); // 17:30 Asia/Ho_Chi_Minh (2026-11-12)
  const t3 = new Date('2026-11-11T05:15:00Z'); // 12:15 Asia/Ho_Chi_Minh (2026-11-11, inserted out of order)

  const r1 = recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    durationMs: 4200,
    recordedSegments: 1,
    totalSegments: 2,
    now: t1,
  });
  const r2 = recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-2',
    durationMs: 5100,
    recordedSegments: 2,
    totalSegments: 2,
    now: t2,
  });
  const r3 = recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    durationMs: 3900,
    recordedSegments: 1,
    totalSegments: 2,
    now: t3,
  });
  recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-beta',
    segmentId: 'b-1',
    durationMs: 6000,
    recordedSegments: 1,
    totalSegments: 1,
    now: t1,
  });

  const store = readShadowingHistory(historyPath);
  const all = summarizeAllClips(
    store,
    TEST_CLIPS.map((c) => c.id),
  );
  const alpha = all['clip-alpha'];
  assert.equal(alpha.totalTurns, 3);
  assert.equal(alpha.lastPracticedDate, '2026-11-12');
  assert.equal(alpha.lastPracticedAt, t2.toISOString());
  assert.deepEqual(
    alpha.turns.map((turn) => turn.id),
    [r2.turn.id, r3.turn.id, r1.turn.id],
    'turns must be ordered newest-first regardless of insertion order',
  );
  assert.equal(all['clip-beta'].totalTurns, 1);
  assert.equal(all['clip-beta'].lastPracticedDate, '2026-11-10');
  assert.equal(formatHistoryDate('2026-11-12'), '12/11/2026');
  assert.match(formatHistoryTime(t2.toISOString(), 'Asia/Ho_Chi_Minh'), /17:30 · 12\/11\/2026/);
});

test('pinning best recording persists audio for replay, replaces old pin file, and unpinning deletes file', async (t) => {
  const { file } = fixture(t);
  const root = path.dirname(file);
  const deps = makeDeps(root, { now: () => new Date('2026-11-15T08:00:00Z') });

  const firstBytes = Buffer.from('WEBM-FIRST-TAKE-PAYLOAD-0123456789');
  const form1 = new FormData();
  form1.set('clipId', 'clip-alpha');
  form1.set('segmentId', 'seg-2');
  form1.set('durationMs', '3400');
  form1.set('audioMime', 'audio/webm;codecs=opus');
  form1.set('audio', new Blob([firstBytes], { type: 'audio/webm;codecs=opus' }), 'take.webm');

  const pinRes1 = await handleShadowingHistoryPost(
    new Request('http://localhost/api/shadowing/history', { method: 'POST', body: form1 }),
    deps,
  );
  assert.equal(pinRes1.status, 200);
  assert.equal(pinRes1.headers.get('cache-control'), 'private, no-store');
  assert.equal(pinRes1.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  const data1 = (await pinRes1.json()) as {
    pin: { id: string; audioFile: string; audioMime: string; durationMs: number };
    summary: { pinned: Record<string, { id: string }> };
  };
  assert.equal(data1.pin.audioMime, 'audio/webm');
  assert.equal(data1.pin.durationMs, 3400);
  assert.equal(data1.summary.pinned['seg-2'].id, data1.pin.id);

  const firstDiskPath = path.join(deps.recordingsDir, data1.pin.audioFile);
  assert.equal(fs.existsSync(firstDiskPath), true);

  // Replay full audio (200) and partial byte range (206) + invalid range (416)
  const audioUrl = `http://localhost/api/shadowing/history?audio=${encodeURIComponent(data1.pin.id)}&clip=clip-alpha&segment=seg-2`;
  const fullRes = await handleShadowingHistoryGet(new Request(audioUrl), deps);
  assert.equal(fullRes.status, 200);
  assert.equal(fullRes.headers.get('content-type'), 'audio/webm');
  assert.equal(fullRes.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await fullRes.arrayBuffer()), firstBytes);

  const rangeRes = await handleShadowingHistoryGet(
    new Request(audioUrl, { headers: { range: 'bytes=0-9' } }),
    deps,
  );
  assert.equal(rangeRes.status, 206);
  assert.equal(rangeRes.headers.get('content-range'), `bytes 0-9/${firstBytes.length}`);
  assert.deepEqual(Buffer.from(await rangeRes.arrayBuffer()), firstBytes.subarray(0, 10));

  const badRange = await handleShadowingHistoryGet(
    new Request(audioUrl, { headers: { range: 'bytes=99999-' } }),
    deps,
  );
  assert.equal(badRange.status, 416);

  // Replace pin on same segment: old file must be removed, new file kept
  const secondBytes = Buffer.from('WEBM-BETTER-TAKE-999999');
  const form2 = new FormData();
  form2.set('clipId', 'clip-alpha');
  form2.set('segmentId', 'seg-2');
  form2.set('durationMs', '4100');
  form2.set('audioMime', 'audio/webm');
  form2.set('audio', new Blob([secondBytes], { type: 'audio/webm' }), 'take2.webm');
  const pinRes2 = await handleShadowingHistoryPost(
    new Request('http://localhost/api/shadowing/history', { method: 'POST', body: form2 }),
    deps,
  );
  assert.equal(pinRes2.status, 200);
  const data2 = (await pinRes2.json()) as { pin: { id: string; audioFile: string } };
  assert.notEqual(data2.pin.id, data1.pin.id);
  assert.equal(fs.existsSync(firstDiskPath), false, 'replaced pin audio file should be cleaned up');
  const secondDiskPath = path.join(deps.recordingsDir, data2.pin.audioFile);
  assert.equal(fs.existsSync(secondDiskPath), true);

  // Unpin via DELETE removes metadata and deletes audio file
  const delRes = await handleShadowingHistoryDelete(
    new Request('http://localhost/api/shadowing/history?clip=clip-alpha&segment=seg-2', {
      method: 'DELETE',
    }),
    deps,
  );
  assert.equal(delRes.status, 200);
  const delBody = (await delRes.json()) as { removed: boolean; summary: { pinned: Record<string, unknown> } };
  assert.equal(delBody.removed, true);
  assert.deepEqual(delBody.summary.pinned, {});
  assert.equal(fs.existsSync(secondDiskPath), false, 'unpinned audio file must be deleted');
  assert.equal(
    readPinnedAudio({
      historyPath: deps.historyPath,
      recordingsDir: deps.recordingsDir,
      clipId: 'clip-alpha',
      segmentId: 'seg-2',
    }),
    null,
  );
});

test('retention pruning drops expired unpinned turns and stale unpinned files while preserving pinned best takes', (t) => {
  const { file } = fixture(t);
  const root = path.dirname(file);
  const historyPath = path.join(root, 'private', 'shadowing-history.json');
  const recordingsDir = path.join(root, 'recordings');

  const ancientDate = new Date('2026-05-01T10:00:00Z'); // > 180 days before Nov 2026
  const recentDate = new Date('2026-11-18T10:00:00Z');
  const now = new Date('2026-11-20T10:00:00Z');

  // Pin a best recording back in May (180+ days old)
  const pinnedPayload = Buffer.from('ANCIENT-PINNED-BEST-AUDIO');
  const pinnedResult = pinBestRecording({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    durationMs: 2800,
    audioBytes: pinnedPayload,
    audioMime: 'audio/webm',
    now: ancientDate,
  });
  const pinnedFull = path.join(recordingsDir, pinnedResult.pin.audioFile);
  fs.utimesSync(pinnedFull, ancientDate, ancientDate);

  // Create an old unpinned audio file inside recordings/shadowing/
  const staleUnpinned = path.join(recordingsDir, 'shadowing', 'unpinned-old.webm');
  fs.writeFileSync(staleUnpinned, 'old unpinned take');
  fs.utimesSync(staleUnpinned, ancientDate, ancientDate);

  // Record an expired turn (45 days old) and a recent turn (2 days old)
  recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    durationMs: 3000,
    recordedSegments: 1,
    totalSegments: 2,
    now: new Date('2026-10-01T10:00:00Z'),
  });
  recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-2',
    durationMs: 3500,
    recordedSegments: 2,
    totalSegments: 2,
    now: recentDate,
  });

  // Explicitly run pruning at `now`
  const before = readShadowingHistory(historyPath);
  // Inject an expired turn with an unpinned audio file to ensure pruneShadowingHistory cleans it
  const expiredTurnAudio = path.join(recordingsDir, 'shadowing', 'expired-turn.webm');
  fs.writeFileSync(expiredTurnAudio, 'expired audio');
  fs.utimesSync(expiredTurnAudio, ancientDate, ancientDate);
  before.turns.push({
    id: 'expired-turn-id',
    clipId: 'clip-alpha',
    segmentId: 'seg-2',
    practicedAt: ancientDate.toISOString(),
    date: '2026-05-01',
    durationMs: 2500,
    recordedSegments: 1,
    totalSegments: 2,
    audioFile: 'shadowing/expired-turn.webm',
    audioMime: 'audio/webm',
    audioBytes: 13,
  });

  const pruned = pruneShadowingHistory(before, { recordingsDir, now });
  assert.ok(pruned.prunedTurns >= 1, 'expired unpinned turn must be pruned');
  assert.equal(pruned.store.turns.length, 1, 'only the recent turn remains');
  assert.equal(pruned.store.turns[0].date, '2026-11-18');
  assert.equal(fs.existsSync(staleUnpinned), false, 'stale unpinned file must be removed');
  assert.equal(fs.existsSync(expiredTurnAudio), false, 'expired turn unpinned file must be removed');

  // Pinned recording and its audio file MUST survive untouched
  assert.ok(pruned.store.pinned['clip-alpha']?.['seg-1'], 'pinned metadata survives retention pruning');
  assert.equal(fs.existsSync(pinnedFull), true, 'pinned audio file survives retention pruning');
  assert.deepEqual(fs.readFileSync(pinnedFull), pinnedPayload);
});

test('backup create, validate, and restore includes shadowing-history.json and pinned audio and rejects tampering', async (t) => {
  const { file } = fixture(t);
  const root = path.dirname(file);
  const savedEnv = { ...process.env };
  t.after(() => {
    for (const k of [
      'NIHON_DB_PATH',
      'NIHON_DB_ROLE',
      'NIHON_SETTINGS_PATH',
      'NIHON_ROADMAP_PATH',
      'NIHON_SHADOWING_HISTORY_PATH',
      'NIHON_RECORDINGS_DIR',
      'NIHON_BACKUP_DIR',
    ]) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  process.env.NIHON_DB_PATH = file;
  process.env.NIHON_DB_ROLE = 'snapshot';
  for (const k of [
    'NIHON_SETTINGS_PATH',
    'NIHON_ROADMAP_PATH',
    'NIHON_SHADOWING_HISTORY_PATH',
    'NIHON_RECORDINGS_DIR',
    'NIHON_BACKUP_DIR',
  ]) {
    delete process.env[k];
  }

  const historyPath = path.join(root, 'private', 'shadowing-history.json');
  const recordingsDir = path.join(root, 'recordings');

  recordShadowingTurn({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    durationMs: 4400,
    recordedSegments: 1,
    totalSegments: 2,
    now: new Date('2026-11-19T09:00:00Z'),
  });
  const audioPayload = Buffer.from('PINNED-BACKUP-AUDIO-BYTES');
  const { pin } = pinBestRecording({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    durationMs: 2600,
    audioBytes: audioPayload,
    audioMime: 'audio/webm',
    now: new Date('2026-11-19T09:01:00Z'),
  });

  const archiveBytes = await createBackup();
  const archive = validateBackup(archiveBytes);
  assert.ok(
    archive.files.some((entry) => entry.name === 'shadowing-history.json'),
    'backup must contain shadowing-history.json',
  );
  assert.ok(
    archive.files.some((entry) => entry.name === `recordings/${pin.audioFile}`),
    'backup must contain pinned shadowing audio file',
  );

  // Reject tampered / invalid shadowing-history.json in backup archive
  const tampered = structuredClone(archive);
  const badHistory = Buffer.from(JSON.stringify({ version: 99, turns: 'nope', pinned: {} }));
  const idx = tampered.files.findIndex((entry) => entry.name === 'shadowing-history.json');
  tampered.files[idx] = {
    name: 'shadowing-history.json',
    bytes: badHistory.toString('base64'),
    sha256: createHash('sha256').update(badHistory).digest('hex'),
  };
  assert.throws(() => validateBackup(Buffer.from(JSON.stringify(tampered))));

  // Mutate history & delete pin locally, then restore from backup
  unpinBestRecording({ historyPath, recordingsDir, clipId: 'clip-alpha', segmentId: 'seg-1' });
  fs.writeFileSync(historyPath, JSON.stringify({ version: 1, turns: [], pinned: {} }));
  assert.equal(summarizeClipHistory(readShadowingHistory(historyPath), 'clip-alpha').totalTurns, 0);

  await restoreBackup(archiveBytes);

  const restoredStore = readShadowingHistory(historyPath);
  const restoredSummary = summarizeClipHistory(restoredStore, 'clip-alpha');
  assert.equal(restoredSummary.totalTurns, 1);
  assert.equal(restoredSummary.pinned['seg-1']?.id, pin.id);
  const restoredAudio = readPinnedAudio({
    historyPath,
    recordingsDir,
    clipId: 'clip-alpha',
    segmentId: 'seg-1',
    pinId: pin.id,
  });
  assert.ok(restoredAudio, 'restored pinned audio must be readable');
  assert.deepEqual(restoredAudio.bytes, audioPayload);

  // Legacy backup archive without shadowing-history.json remains valid and restores cleanly
  const legacyArchive = structuredClone(archive);
  legacyArchive.files = legacyArchive.files.filter((entry) => entry.name !== 'shadowing-history.json');
  const legacyBytes = Buffer.from(JSON.stringify(legacyArchive));
  assert.doesNotThrow(() => validateBackup(legacyBytes));
  await restoreBackup(legacyBytes);
  assert.equal(fs.existsSync(historyPath), false, 'restoring legacy backup without history removes stale history');
});

test('shadowing history API and proxy enforce auth, same-origin, and private no-store headers', async (t) => {
  const { file } = fixture(t);
  const root = path.dirname(file);

  const unauthDeps = makeDeps(root, { isAuthenticated: async () => false });
  const getUnauth = await handleShadowingHistoryGet(
    new Request('http://localhost/api/shadowing/history'),
    unauthDeps,
  );
  assert.equal(getUnauth.status, 401);
  assert.equal(getUnauth.headers.get('cache-control'), 'private, no-store');
  assert.equal(getUnauth.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(getUnauth.headers.get('set-cookie'), null);

  const postUnauth = await handleShadowingHistoryPost(
    new Request('http://localhost/api/shadowing/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'turn', clipId: 'clip-alpha', durationMs: 1000 }),
    }),
    unauthDeps,
  );
  assert.equal(postUnauth.status, 401);
  assert.equal(postUnauth.headers.get('cache-control'), 'private, no-store');

  const delUnauth = await handleShadowingHistoryDelete(
    new Request('http://localhost/api/shadowing/history?clip=clip-alpha&segment=seg-1', {
      method: 'DELETE',
    }),
    unauthDeps,
  );
  assert.equal(delUnauth.status, 401);
  assert.equal(delUnauth.headers.get('cache-control'), 'private, no-store');

  // Cross-origin POST & DELETE rejected with 403
  const crossOriginDeps = makeDeps(root, { sameOriginCheck: () => false });
  const postCross = await handleShadowingHistoryPost(
    new Request('http://localhost/api/shadowing/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.invalid' },
      body: JSON.stringify({ action: 'turn', clipId: 'clip-alpha', durationMs: 1000 }),
    }),
    crossOriginDeps,
  );
  assert.equal(postCross.status, 403);
  assert.equal(postCross.headers.get('cache-control'), 'private, no-store');

  const delCross = await handleShadowingHistoryDelete(
    new Request('http://localhost/api/shadowing/history?clip=clip-alpha&segment=seg-1', {
      method: 'DELETE',
      headers: { origin: 'https://evil.invalid' },
    }),
    crossOriginDeps,
  );
  assert.equal(delCross.status, 403);
  assert.equal(delCross.headers.get('cache-control'), 'private, no-store');

  // Next proxy redirects /shadowing (307) and rejects /api/shadowing/history (401) when unauthenticated
  const prevHash = process.env.NIHON_PASSWORD_HASH;
  const prevSecret = process.env.SESSION_SECRET;
  const prevOrigin = process.env.APP_ORIGIN;
  t.after(() => {
    if (prevHash === undefined) delete process.env.NIHON_PASSWORD_HASH;
    else process.env.NIHON_PASSWORD_HASH = prevHash;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = prevOrigin;
  });
  process.env.NIHON_PASSWORD_HASH = hashPassword('test-password-123');
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.APP_ORIGIN = 'http://localhost:3000';

  const pageRedirect = proxy(new NextRequest('http://localhost:3000/shadowing'));
  assert.equal(pageRedirect.status, 307);
  assert.equal(pageRedirect.headers.get('cache-control'), 'private, no-store');
  assert.equal(pageRedirect.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const apiUnauth = proxy(new NextRequest('http://localhost:3000/api/shadowing/history'));
  assert.equal(apiUnauth.status, 401);
  assert.equal(apiUnauth.headers.get('cache-control'), 'private, no-store');
  assert.equal(apiUnauth.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});
