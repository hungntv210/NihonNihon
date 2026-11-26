import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedDemo } from '../tools/seed-demo.ts';
import {
  MAX_CLIP_UPLOAD_BYTES,
  MAX_SUBTITLE_BYTES,
  adjustSegmentBoundary,
  buildSegmentsFromPlainText,
  buildSegmentsFromSubtitles,
  clampClipRange,
  isSafeStoredMediaName,
  parseAss,
  parseSrt,
  parseSubtitleFile,
  parseYoutubeLink,
  parseYoutubeVideoId,
  splitJapaneseSentences,
  validateClipDraft,
  validateUploadInput,
} from '../src/app/(study)/shadowing/clip-maker-model.ts';
import {
  createUserFileClip,
  createUserYoutubeClip,
  deleteUserClip,
  listUserShadowingClips,
  resolveSafeMediaPath,
  resolveUserClipMedia,
} from '../src/app/(study)/shadowing/clip-maker-store.ts';
import { listShadowingClips, privateClipMedia } from '../src/app/(study)/shadowing/clips.ts';
import {
  handleShadowingClipsDelete,
  handleShadowingClipsGet,
  handleShadowingClipsPost,
  type ShadowingClipsHandlerDeps,
} from '../src/app/api/shadowing/clips/handler.ts';

function makeTempEnv(t: { after: (fn: () => void) => void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-clip-maker-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const dbFile = path.join(dir, 'demo.sqlite');
  seedDemo(dbFile);
  const storePath = path.join(dir, 'private', 'shadowing-clips.json');
  const mediaDir = path.join(dir, 'private', 'shadowing-media');
  return { dir, dbFile, storePath, mediaDir };
}

function demoWebmBytes(): Buffer {
  return fs.readFileSync(path.resolve('src/app/(study)/shadowing/demo.webm'));
}

test('SRT parser handles BOM, CRLF, HTML tags, dot/comma ms, and collects malformed block errors', () => {
  const srt = [
    '\uFEFF1',
    '00:00:01,250 --> 00:00:03,500',
    '<i>おはようございます。</i>',
    '',
    '2',
    '00:00:04.5 --> 00:00:07.05 align:center',
    '今日はいい天気ですね。',
    '散歩しましょう！',
    '',
    '3',
    '00:75:00,000 --> 00:75:02,000',
    'Invalid minutes',
    '',
    '4',
    '00:00:10,000 --> 00:00:09,000',
    'Reversed timestamp',
    '',
    '5',
    'not a timestamp line',
    'Broken block',
    '',
    '6',
    '00:00:11,000 --> 00:00:12,000',
    '<b></b>',
  ].join('\r\n');

  const res = parseSrt(srt);
  assert.equal(res.format, 'srt');
  assert.equal(res.cues.length, 2);
  assert.deepEqual(res.cues[0], { startMs: 1250, endMs: 3500, text: 'おはようございます。', speaker: null });
  assert.deepEqual(res.cues[1], {
    startMs: 4500,
    endMs: 7050,
    text: '今日はいい天気ですね。\n散歩しましょう！',
    speaker: null,
  });
  assert.equal(res.errors.length, 4);

  const empty = parseSubtitleFile('empty.srt', '   \n  ');
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.code, 'SUBTITLE_EMPTY');

  const broken = parseSubtitleFile('broken.srt', 'garbage\nwithout timestamps');
  assert.equal(broken.ok, false);
  if (!broken.ok) assert.equal(broken.code, 'INVALID_SUBTITLE_FORMAT');

  const oversized = parseSubtitleFile('huge.srt', 'a'.repeat(MAX_SUBTITLE_BYTES + 1));
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.code, 'SUBTITLE_TOO_LARGE');
});

test('ASS parser maps custom Format columns, preserves commas in Text, strips override tags, and rejects malformed ASS', () => {
  const ass = [
    '\uFEFF[Script Info]',
    'Title: Test',
    '',
    '[Events]',
    'Format: Layer, Start, End, Name, Text',
    'Comment: 0,0:00:00.00,0:00:01.00,Note,Skip this comment',
    'Dialogue: 0,0:00:01.20,0:00:03.50,先生,{\\an8\\i1}こんにちは、\\N元気ですか？',
    'Dialogue: 0,0:00:04.00,0:00:06.25,生徒,はい, 元気です！',
    'Dialogue: 0,0:00:07.00,0:00:06.00,生徒,Invalid reversed',
    'Dialogue: 0,0:00:08.00,bad,生徒,Invalid time',
    'Dialogue: 0,0:00:09.00',
    'Dialogue: 0,0:00:09.00,0:00:10.00,生徒,{\\pos(10,10)}',
  ].join('\r\n');

  const parsed = parseAss(ass);
  assert.equal(parsed.format, 'ass');
  assert.equal(parsed.cues.length, 2);
  assert.deepEqual(parsed.cues[0], {
    startMs: 1200,
    endMs: 3500,
    text: 'こんにちは、\n元気ですか？',
    speaker: '先生',
  });
  assert.deepEqual(parsed.cues[1], {
    startMs: 4000,
    endMs: 6250,
    text: 'はい, 元気です！',
    speaker: '生徒',
  });
  assert.equal(parsed.errors.length, 4);

  const missingEvents = parseSubtitleFile('bad.ass', '[Script Info]\nTitle: No events');
  assert.equal(missingEvents.ok, false);
  if (!missingEvents.ok) assert.equal(missingEvents.code, 'INVALID_SUBTITLE_FORMAT');

  const missingFormat = parseSubtitleFile('no-fmt.ass', '[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,こんにちは。');
  assert.equal(missingFormat.ok, false);
  if (!missingFormat.ok) assert.equal(missingFormat.code, 'INVALID_SUBTITLE_FORMAT');
});

test('auto sentence splitting splits on 。！？, quotes, and builds ordered non-overlapping segments', () => {
  assert.deepEqual(
    splitJapaneseSentences('「おはよう！」元気ですか？今日はいい天気ですね。本当！？すごい！！'),
    ['「おはよう！」', '元気ですか？', '今日はいい天気ですね。', '本当！？', 'すごい！！'],
  );

  const fromSubtitles = buildSegmentsFromSubtitles(
    [
      { startMs: 0, endMs: 4000, text: 'おはようございます。元気ですか？', speaker: '先生' },
      { startMs: 3500, endMs: 7000, text: 'はい！元気です。', speaker: '生徒' },
      { startMs: 12000, endMs: 15000, text: '範囲外の文。', speaker: null },
    ],
    500,
    9000,
    { autoSplit: true },
  );
  assert.equal(fromSubtitles.length, 4);
  for (let i = 0; i < fromSubtitles.length; i++) {
    const seg = fromSubtitles[i];
    assert.ok(seg.startMs >= 500, `seg ${i} start in clip`);
    assert.ok(seg.endMs <= 9000, `seg ${i} end in clip`);
    assert.ok(seg.startMs < seg.endMs, `seg ${i} start < end`);
    if (i > 0) assert.ok(seg.startMs >= fromSubtitles[i - 1].endMs, `seg ${i} non-overlapping`);
  }
  assert.equal(fromSubtitles[0].ja, 'おはようございます。');
  assert.equal(fromSubtitles[1].ja, '元気ですか？');
  assert.equal(fromSubtitles[2].ja, 'はい！');
  assert.equal(fromSubtitles[3].ja, '元気です。');

  const fromPlain = buildSegmentsFromPlainText('一文目です。二文目ですか？三文目！', 1000, 10000);
  assert.equal(fromPlain.length, 3);
  assert.equal(fromPlain[0].startMs, 1000);
  assert.equal(fromPlain[2].endMs, 10000);
  assert.equal(fromPlain[0].endMs, fromPlain[1].startMs);
  assert.equal(fromPlain[1].endMs, fromPlain[2].startMs);
});

test('timing validation enforces start < end, non-overlap, clip bounds, and safe boundary adjustments', () => {
  const baseDraft = {
    kind: 'file' as const,
    title: 'Bài thử mốc thời gian',
    level: 'N5',
    topic: 'Kiểm thử',
    durationMs: 20_000,
    clipStartMs: 1_000,
    clipEndMs: 16_000,
    segments: [
      { id: 's1', startMs: 1_000, endMs: 5_000, ja: 'あいう。' },
      { id: 's2', startMs: 5_000, endMs: 10_000, ja: 'かきく。' },
      { id: 's3', startMs: 10_500, endMs: 15_500, ja: 'さしす。' },
    ],
  };
  assert.equal(validateClipDraft(baseDraft).ok, true);

  // start >= end
  const equalBounds = validateClipDraft({
    ...baseDraft,
    segments: [{ id: 's1', startMs: 2000, endMs: 2000, ja: 'あ。' }],
  });
  assert.equal(equalBounds.ok, false);
  if (!equalBounds.ok) assert.equal(equalBounds.code, 'SEGMENT_START_NOT_BEFORE_END');

  const reversed = validateClipDraft({
    ...baseDraft,
    segments: [{ id: 's1', startMs: 4000, endMs: 2000, ja: 'あ。' }],
  });
  assert.equal(reversed.ok, false);
  if (!reversed.ok) assert.equal(reversed.code, 'SEGMENT_START_NOT_BEFORE_END');

  // overlap
  const overlap = validateClipDraft({
    ...baseDraft,
    segments: [
      { id: 's1', startMs: 1000, endMs: 5000, ja: 'あ。' },
      { id: 's2', startMs: 4999, endMs: 8000, ja: 'い。' },
    ],
  });
  assert.equal(overlap.ok, false);
  if (!overlap.ok) assert.equal(overlap.code, 'SEGMENT_OVERLAP');

  // out of clip bounds
  const beforeClip = validateClipDraft({
    ...baseDraft,
    segments: [{ id: 's1', startMs: 999, endMs: 3000, ja: 'あ。' }],
  });
  assert.equal(beforeClip.ok, false);
  if (!beforeClip.ok) assert.equal(beforeClip.code, 'SEGMENT_OUT_OF_BOUNDS');

  const afterClip = validateClipDraft({
    ...baseDraft,
    segments: [{ id: 's1', startMs: 12000, endMs: 16001, ja: 'あ。' }],
  });
  assert.equal(afterClip.ok, false);
  if (!afterClip.ok) assert.equal(afterClip.code, 'SEGMENT_OUT_OF_BOUNDS');

  // clip end > durationMs
  const beyondDuration = validateClipDraft({ ...baseDraft, clipEndMs: 20_001 });
  assert.equal(beyondDuration.ok, false);
  if (!beyondDuration.ok) assert.equal(beyondDuration.code, 'INVALID_CLIP_BOUNDS');

  // clip span > 60s
  const tooLongSpan = validateClipDraft({
    ...baseDraft,
    durationMs: 90_000,
    clipStartMs: 0,
    clipEndMs: 60_001,
  });
  assert.equal(tooLongSpan.ok, false);
  if (!tooLongSpan.ok) assert.equal(tooLongSpan.code, 'INVALID_CLIP_RANGE');

  // Boundary clamping never overlaps neighbors or exits clip bounds
  const adjustedOverlap = adjustSegmentBoundary(baseDraft.segments, 1, 'startMs', 2000, 1000, 16000);
  assert.equal(adjustedOverlap[1].startMs, 5000);
  const adjustedEnd = adjustSegmentBoundary(baseDraft.segments, 1, 'endMs', 12000, 1000, 16000);
  assert.equal(adjustedEnd[1].endMs, 10500);
  const adjustedMinLen = adjustSegmentBoundary(baseDraft.segments, 1, 'endMs', 5010, 1000, 16000);
  assert.equal(adjustedMinLen[1].endMs, 5100);

  assert.deepEqual(clampClipRange(-500, 90_000, 120_000), { clipStartMs: 0, clipEndMs: 60_000 });
});

test('upload validation enforces size cap, allowed MIME, magic bytes, and blocks path traversal', (t) => {
  const webm = demoWebmBytes();
  assert.equal(validateUploadInput({ mime: 'video/webm;codecs=vp8,opus', size: webm.length, bytes: webm }).ok, true);

  // Empty
  const empty = validateUploadInput({ mime: 'video/webm', size: 0, bytes: new Uint8Array(0) });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.code, 'EMPTY_UPLOAD');

  // Oversized
  const oversized = validateUploadInput({
    mime: 'video/webm',
    size: MAX_CLIP_UPLOAD_BYTES + 1,
    bytes: webm,
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.code, 'UPLOAD_TOO_LARGE');

  // Disallowed MIME
  for (const badMime of ['text/html', 'application/javascript', 'image/svg+xml', 'video/x-msvideo']) {
    const res = validateUploadInput({ mime: badMime, size: webm.length, bytes: webm });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, 'UNSUPPORTED_MEDIA_MIME');
  }

  // Spoofed signature (HTML claiming to be video/mp4)
  const htmlBytes = Buffer.from('<!doctype html><script>alert(1)</script>');
  const spoofed = validateUploadInput({ mime: 'video/mp4', size: htmlBytes.length, bytes: htmlBytes });
  assert.equal(spoofed.ok, false);
  if (!spoofed.ok) assert.equal(spoofed.code, 'MEDIA_SIGNATURE_MISMATCH');

  // Valid magic bytes for MP4, OGG, WAV, MP3
  const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const ogg = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
  const wav = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
  const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);
  assert.equal(validateUploadInput({ mime: 'video/mp4', size: mp4.length, bytes: mp4 }).ok, true);
  assert.equal(validateUploadInput({ mime: 'audio/x-m4a', size: mp4.length, bytes: mp4 }).ok, true);
  assert.equal(validateUploadInput({ mime: 'audio/ogg', size: ogg.length, bytes: ogg }).ok, true);
  assert.equal(validateUploadInput({ mime: 'audio/wav', size: wav.length, bytes: wav }).ok, true);
  assert.equal(validateUploadInput({ mime: 'audio/mpeg', size: mp3.length, bytes: mp3 }).ok, true);

  // Path traversal & unsafe media names
  const { mediaDir } = makeTempEnv(t);
  for (const badPath of [
    '../secret.mp4',
    '..\\secret.mp4',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    'sub/clip-12345678.mp4',
    'clip-12345678.mp4\0.jpg',
    'CON.mp4',
    'clip-../../evil.webm',
    'arbitrary-user-name.mp4',
  ]) {
    assert.equal(isSafeStoredMediaName(badPath), false, badPath);
    assert.throws(() => resolveSafeMediaPath(mediaDir, badPath), /INVALID_MEDIA_PATH/);
  }
  const safeName = 'clip-11111111-2222-4333-8444-555555555555.webm';
  assert.equal(isSafeStoredMediaName(safeName), true);
  assert.equal(path.dirname(resolveSafeMediaPath(mediaDir, safeName)), path.resolve(mediaDir));
});

test('YouTube link parser extracts 11-char ID and timestamp without downloading anything', () => {
  assert.deepEqual(parseYoutubeLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'), {
    videoId: 'dQw4w9WgXcQ',
    startSeconds: 90,
  });
  assert.deepEqual(parseYoutubeLink('https://youtu.be/abcDEF_1234?t=45'), {
    videoId: 'abcDEF_1234',
    startSeconds: 45,
  });
  assert.equal(parseYoutubeVideoId('https://www.youtube-nocookie.com/embed/abcDEF-1234'), 'abcDEF-1234');
  assert.equal(parseYoutubeVideoId('https://m.youtube.com/shorts/abcDEF-1234'), 'abcDEF-1234');
  assert.equal(parseYoutubeVideoId('abcDEF-1234'), 'abcDEF-1234');
  assert.equal(parseYoutubeVideoId('https://evil.invalid/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYoutubeVideoId('javascript:alert(1)'), null);
  assert.equal(parseYoutubeVideoId('too-short'), null);
});

test('private store & API handler enforce auth/CSRF, persist file & YouTube clips, verify SHA-256, and clean up on delete', async (t) => {
  const { dir, dbFile, storePath, mediaDir } = makeTempEnv(t);
  const webm = demoWebmBytes();

  const makeDeps = (overrides: Partial<ShadowingClipsHandlerDeps> = {}): ShadowingClipsHandlerDeps => ({
    isAuthenticated: async () => true,
    sameOriginCheck: () => true,
    dbFile,
    storePath,
    mediaDir,
    whisperAvailable: false,
    ...overrides,
  });

  // Unauthenticated requests blocked with 401, private no-store, no Set-Cookie
  const unauthGet = await handleShadowingClipsGet(
    new Request('http://127.0.0.1/api/shadowing/clips'),
    makeDeps({ isAuthenticated: async () => false }),
  );
  assert.equal(unauthGet.status, 401);
  assert.equal(unauthGet.headers.get('cache-control'), 'private, no-store');
  assert.equal(unauthGet.headers.get('set-cookie'), null);

  const unauthPost = await handleShadowingClipsPost(
    new Request('http://127.0.0.1/api/shadowing/clips', { method: 'POST', body: '{}' }),
    makeDeps({ isAuthenticated: async () => false }),
  );
  assert.equal(unauthPost.status, 401);

  // Cross-origin blocked with 403
  const csrfPost = await handleShadowingClipsPost(
    new Request('http://127.0.0.1/api/shadowing/clips', { method: 'POST', body: '{}' }),
    makeDeps({ sameOriginCheck: () => false }),
  );
  assert.equal(csrfPost.status, 403);

  // Upload a valid file clip via multipart/form-data
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(webm)], { type: 'video/webm' }), '../../evil-user-filename.webm');
  form.set('mime', 'video/webm');
  form.set(
    'metadata',
    JSON.stringify({
      title: 'Clip tự tạo từ tệp',
      level: 'N5',
      topic: 'Chào hỏi',
      durationMs: 9000,
      clipStartMs: 0,
      clipEndMs: 9000,
      segments: [
        { id: 's1', startMs: 0, endMs: 4500, ja: 'おはようございます。', vi: 'Chào buổi sáng.' },
        { id: 's2', startMs: 4500, endMs: 9000, ja: 'いい天気ですね。', vi: 'Trời đẹp quá.' },
      ],
    }),
  );
  const filePost = await handleShadowingClipsPost(
    new Request('http://127.0.0.1/api/shadowing/clips', { method: 'POST', body: form }),
    makeDeps(),
  );
  assert.equal(filePost.status, 201);
  const fileJson = (await filePost.json()) as { clip: { id: string; mediaUrl: string; youtubeId: string | null } };
  assert.ok(fileJson.clip.id.startsWith('user-clip:'));
  assert.equal(fileJson.clip.youtubeId, null);
  assert.equal(fileJson.clip.mediaUrl, `/shadowing/media?clip=${encodeURIComponent(fileJson.clip.id)}`);
  assert.ok(!JSON.stringify(fileJson).includes(dir), 'never leak filesystem path to client');

  // Verify stored media filename ignores user traversal filename & resolves through privateClipMedia
  const mediaFiles = fs.readdirSync(mediaDir);
  assert.equal(mediaFiles.length, 1);
  assert.match(mediaFiles[0], /^clip-[a-f0-9-]+\.webm$/);
  const resolved = await privateClipMedia(fileJson.clip.id, dbFile);
  assert.equal(resolved.mime, 'video/webm');
  assert.equal(resolved.size, webm.length);

  // Reject spoofed file via API with 415
  const badForm = new FormData();
  badForm.set('file', new Blob([Buffer.from('<html>not mp4</html>')], { type: 'video/mp4' }), 'fake.mp4');
  badForm.set('mime', 'video/mp4');
  badForm.set(
    'metadata',
    JSON.stringify({
      title: 'Fake',
      durationMs: 9000,
      clipStartMs: 0,
      clipEndMs: 9000,
      segments: [{ id: 's1', startMs: 0, endMs: 9000, ja: 'あ。' }],
    }),
  );
  const spoofedRes = await handleShadowingClipsPost(
    new Request('http://127.0.0.1/api/shadowing/clips', { method: 'POST', body: badForm }),
    makeDeps(),
  );
  assert.equal(spoofedRes.status, 415);

  // Create YouTube clip via JSON — no file downloaded into mediaDir
  const ytRes = await handleShadowingClipsPost(
    new Request('http://127.0.0.1/api/shadowing/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'youtube',
        title: 'Clip YouTube tự tạo',
        level: 'N4',
        topic: 'Hội thoại',
        durationMs: 120_000,
        clipStartMs: 10_000,
        clipEndMs: 30_000,
        youtubeUrlOrId: 'https://www.youtube.com/watch?v=testClip001&t=10s',
        segments: [
          { id: 'y1', startMs: 10_000, endMs: 20_000, ja: 'はじめまして。' },
          { id: 'y2', startMs: 20_000, endMs: 30_000, ja: 'よろしくお願いします。' },
        ],
      }),
    }),
    makeDeps(),
  );
  assert.equal(ytRes.status, 201);
  const ytJson = (await ytRes.json()) as { clip: { id: string; mediaUrl: string | null; youtubeId: string | null } };
  assert.equal(ytJson.clip.youtubeId, 'testClip001');
  assert.equal(ytJson.clip.mediaUrl, null);
  assert.equal(fs.readdirSync(mediaDir).length, 1, 'YouTube clip must never download media files');

  // Both clips are listed in Shadowing library
  const allClips = listShadowingClips(dbFile, path.join(dir, 'no-youtube-fixture.json'));
  assert.ok(allClips.some((c) => c.id === fileJson.clip.id));
  assert.ok(allClips.some((c) => c.id === ytJson.clip.id && c.youtubeId === 'testClip001'));

  // Tampered private media fails SHA-256 verification
  fs.appendFileSync(resolved.path, 'tampered');
  await assert.rejects(() => resolveUserClipMedia(fileJson.clip.id, dbFile, storePath, mediaDir), /HASH_MISMATCH/);

  // Delete cleans up both record and private file
  const delRes = await handleShadowingClipsDelete(
    new Request(`http://127.0.0.1/api/shadowing/clips?id=${encodeURIComponent(fileJson.clip.id)}`, {
      method: 'DELETE',
    }),
    makeDeps(),
  );
  assert.equal(delRes.status, 200);
  assert.equal(fs.readdirSync(mediaDir).length, 0);
  assert.equal(listUserShadowingClips(dbFile, storePath).length, 1);

  // Direct store helpers sanity check
  const directYt = createUserYoutubeClip({
    draft: {
      title: 'Direct YT',
      durationMs: 30_000,
      clipStartMs: 0,
      clipEndMs: 15_000,
      youtubeUrlOrId: 'youtu.be/testClip002'.replace('youtu.be/', 'https://youtu.be/'),
      segments: [{ id: 'd1', startMs: 0, endMs: 15_000, ja: 'テストです。' }],
    },
    dbFile,
    storePath,
  });
  assert.equal(directYt.clip.youtubeId, 'testClip002');
  assert.equal(deleteUserClip({ id: directYt.clip.id, dbFile, storePath, mediaDir }), true);

  const directFile = createUserFileClip({
    draft: {
      title: 'Direct File',
      durationMs: 9000,
      clipStartMs: 0,
      clipEndMs: 9000,
      segments: [{ id: 'f1', startMs: 0, endMs: 9000, ja: 'テスト。' }],
    },
    bytes: webm,
    mime: 'video/webm',
    dbFile,
    storePath,
    mediaDir,
  });
  assert.ok(directFile.record.mediaFile && isSafeStoredMediaName(directFile.record.mediaFile));
});
