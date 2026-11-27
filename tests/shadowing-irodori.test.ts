import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { seedDemo } from '../tools/seed-demo.ts';
import {
  IRODORI_CLIP_PREFIX,
  IRODORI_LICENSE,
  detectAudioDurationMs,
  formatIrodoriReport,
  importIrodoriDirectory,
  mapIrodoriLevel,
  parseWebVtt,
} from '../src/app/(study)/shadowing/irodori-importer.ts';
import {
  listShadowingClips,
  privateClipMedia,
} from '../src/app/(study)/shadowing/clips.ts';
import { computeClipMeta } from '../src/app/(study)/shadowing/clip-meta.ts';
import { buildClipMetaMap } from '../src/app/(study)/shadowing/clip-meta-server.ts';
import {
  shadowingCustomClipsPath,
  shadowingMediaDir,
} from '../src/app/(study)/shadowing/clip-maker-store.ts';
import { parseIrodoriCliArgs } from '../tools/import-irodori.ts';

function makeSyntheticWav(durationSec: number): Buffer {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 8;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const dataSize = Math.round(durationSec * byteRate);
  const buf = Buffer.alloc(44 + dataSize, 0x80);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

function makeSyntheticMp3(durationSec: number): Buffer {
  const frameLen = 417;
  const frames = Math.max(1, Math.round((durationSec * 1000) / 26.12245));
  const buf = Buffer.alloc(frames * frameLen, 0);
  for (let i = 0; i < frames; i++) {
    const offset = i * frameLen;
    buf[offset] = 0xff;
    buf[offset + 1] = 0xfb;
    buf[offset + 2] = 0x90;
    buf[offset + 3] = 0x00;
  }
  return buf;
}

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function populateSyntheticIrodoriTree(root: string): void {
  const a1Dir = path.join(root, 'A1', '01-chao-hoi');
  fs.mkdirSync(a1Dir, { recursive: true });
  fs.writeFileSync(path.join(a1Dir, 'L01-01.wav'), makeSyntheticWav(15));
  fs.writeFileSync(
    path.join(a1Dir, 'L01-01.srt'),
    [
      '1',
      '00:00:00,500 --> 00:00:04,500',
      'おはようございます。はじめまして。',
      '',
      '2',
      '00:00:05,000 --> 00:00:09,500',
      'わたしはベトナムから来ました。',
      '',
      '3',
      '00:00:10,000 --> 00:00:14,500',
      'どうぞよろしくお願いします。',
      '',
    ].join('\n'),
    'utf8',
  );

  const a21Dir = path.join(root, 'A2-1', '03-di-tau');
  fs.mkdirSync(a21Dir, { recursive: true });
  fs.writeFileSync(path.join(a21Dir, 'L03-01.mp3'), makeSyntheticMp3(16));
  fs.writeFileSync(
    path.join(a21Dir, 'L03-01.vtt'),
    [
      'WEBVTT',
      '',
      'NOTE synthetic irodori test',
      '',
      '00:00.500 --> 00:05.000 align:start',
      'すみません、この電車は東京へ行きますか。',
      '',
      '00:05.500 --> 00:10.500',
      'はい、次の駅で乗り換えてください。',
      '',
      '00:11.000 --> 00:15.500',
      'ありがとうございます。助かりました。',
      '',
    ].join('\n'),
    'utf8',
  );

  const a22Dir = path.join(root, 'A2-2', '08-benh-vien');
  fs.mkdirSync(a22Dir, { recursive: true });
  fs.writeFileSync(path.join(a22Dir, 'L08-02.wav'), makeSyntheticWav(14));
  fs.writeFileSync(
    path.join(a22Dir, 'L08-02.json'),
    JSON.stringify(
      {
        title: 'Khám bệnh ở phòng khám',
        topic: 'Sức khỏe',
        tags: ['suc-khoe', 'doi-song'],
        roadmapWeek: 24,
        segments: [
          {
            startMs: 500,
            endMs: 4500,
            ja: 'きのうから頭が痛いです。',
            vi: 'Từ hôm qua tôi bị đau đầu.',
            speaker: 'A',
          },
          {
            startMs: 5000,
            endMs: 9500,
            ja: '熱はありますか。',
            vi: 'Bạn có bị sốt không?',
            speaker: 'B',
          },
          {
            startMs: 10000,
            endMs: 13500,
            ja: '少し熱があります。',
            vi: 'Tôi hơi sốt một chút.',
            speaker: 'A',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const b1Dir = path.join(root, 'B1');
  fs.mkdirSync(b1Dir, { recursive: true });
  fs.writeFileSync(path.join(b1Dir, 'B1-01.wav'), makeSyntheticWav(18));
  fs.writeFileSync(
    path.join(b1Dir, 'B1-01.txt'),
    [
      '会議の時間を変更したいのですが、よろしいでしょうか。',
      '来週の火曜日の午後なら空いています。',
      'では、その時間で調整いたします。',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(b1Dir, 'manifest.json'),
    JSON.stringify(
      {
        clips: [
          {
            id: 'b1-meeting-change',
            level: 'B1',
            title: 'Đổi lịch họp công ty',
            topic: 'Công việc',
            audio: 'B1-01.wav',
            subtitle: 'B1-01.txt',
            tags: ['cong-viec'],
            roadmapWeek: 50,
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
}

test('mapIrodoriLevel maps CEFR A1/A2/B1 books to JLPT N5-N3', () => {
  assert.equal(mapIrodoriLevel('A1')?.jlpt, 'N5');
  assert.equal(mapIrodoriLevel('starter')?.cefr, 'A1');
  assert.equal(mapIrodoriLevel('A2-1')?.jlpt, 'N4');
  assert.equal(mapIrodoriLevel('A2-1')?.book, 'A2-1');
  assert.equal(mapIrodoriLevel('A2-2')?.jlpt, 'N4');
  assert.equal(mapIrodoriLevel('A2-2')?.book, 'A2-2');
  assert.equal(mapIrodoriLevel('A2')?.jlpt, 'N4');
  assert.equal(mapIrodoriLevel('elementary 2')?.book, 'A2-2');
  assert.equal(mapIrodoriLevel('B1')?.jlpt, 'N3');
  assert.equal(mapIrodoriLevel('intermediate')?.cefr, 'B1');
  assert.equal(mapIrodoriLevel('C2'), null);
  assert.equal(mapIrodoriLevel(''), null);
});

test('parseWebVtt parses WebVTT cues with settings, hours, and NOTE blocks', () => {
  const vtt = [
    'WEBVTT',
    '',
    'NOTE ignored block',
    'still ignored',
    '',
    '1',
    '00:00:01.000 --> 00:00:04.250 line:80%',
    '<v A>おはようございます。</v>',
    '',
    '00:05.000 --> 00:09.500',
    '元気ですか。',
  ].join('\n');
  const parsed = parseWebVtt(vtt);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.cues.length, 2);
  assert.equal(parsed.cues[0]!.startMs, 1000);
  assert.equal(parsed.cues[0]!.endMs, 4250);
  assert.equal(parsed.cues[0]!.text, 'おはようございます。');
  assert.equal(parsed.cues[1]!.startMs, 5000);
  assert.equal(parsed.cues[1]!.endMs, 9500);
});

test('detectAudioDurationMs computes duration for synthetic WAV and MP3', () => {
  const wavMs = detectAudioDurationMs('audio/wav', makeSyntheticWav(15));
  assert.equal(wavMs, 15000);
  const mp3Ms = detectAudioDurationMs('audio/mpeg', makeSyntheticMp3(16));
  assert.ok(mp3Ms !== null && mp3Ms >= 15500 && mp3Ms <= 16500, `unexpected mp3Ms=${mp3Ms}`);
});

test('importIrodoriDirectory --dry-run reports counts per level and writes 0 files', async () => {
  const tmp = makeTempDir('nihon-irodori-dry-');
  try {
    const srcDir = path.join(tmp, 'irodori');
    const dbFile = path.join(tmp, 'app.sqlite');
    const storePath = shadowingCustomClipsPath(dbFile);
    const mediaDir = shadowingMediaDir(dbFile);
    populateSyntheticIrodoriTree(srcDir);

    const report = await importIrodoriDirectory({
      dir: srcDir,
      dryRun: true,
      dbFile,
      storePath,
      mediaDir,
    });

    assert.equal(report.dryRun, true);
    assert.equal(report.totals.errors, 0, JSON.stringify(report.errors));
    assert.equal(report.totals.discovered, 4);
    assert.equal(report.totals.valid, 4);
    assert.equal(report.byLevel.A1.count, 1);
    assert.equal(report.byLevel.A1.jlpt, 'N5');
    assert.equal(report.byLevel.A2.count, 2);
    assert.equal(report.byLevel.A2.jlpt, 'N4');
    assert.equal(report.byLevel.B1.count, 1);
    assert.equal(report.byLevel.B1.jlpt, 'N3');
    assert.ok(report.clips.every((c) => c.status === 'dry-run'));

    assert.equal(fs.existsSync(storePath), false);
    assert.equal(fs.existsSync(mediaDir), false);

    const formatted = formatIrodoriReport(report);
    assert.match(formatted, /DRY-RUN/);
    assert.match(formatted, /A1 -> N5: 1 clip/);
    assert.match(formatted, /A2 -> N4: 2 clip/);
    assert.match(formatted, /B1 -> N3: 1 clip/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('importIrodoriDirectory imports idempotently, updates cleanly, and exposes all 7 metadata fields + SHA-256 media', async () => {
  const tmp = makeTempDir('nihon-irodori-real-');
  try {
    const srcDir = path.join(tmp, 'irodori');
    const dbFile = path.join(tmp, 'demo.sqlite');
    seedDemo(dbFile);
    const storePath = shadowingCustomClipsPath(dbFile);
    const mediaDir = shadowingMediaDir(dbFile);
    populateSyntheticIrodoriTree(srcDir);

    const first = await importIrodoriDirectory({
      dir: srcDir,
      dryRun: false,
      dbFile,
      storePath,
      mediaDir,
    });
    assert.equal(first.totals.errors, 0, JSON.stringify(first.errors));
    assert.equal(first.totals.created, 4);
    assert.equal(first.totals.updated, 0);
    assert.equal(first.totals.unchanged, 0);

    const second = await importIrodoriDirectory({
      dir: srcDir,
      dryRun: false,
      dbFile,
      storePath,
      mediaDir,
    });
    assert.equal(second.totals.errors, 0);
    assert.equal(second.totals.created, 0);
    assert.equal(second.totals.updated, 0);
    assert.equal(second.totals.unchanged, 4);

    const jsonPath = path.join(srcDir, 'A2-2', '08-benh-vien', 'L08-02.json');
    const sidecar = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    sidecar.title = 'Khám bệnh ở phòng khám (đã cập nhật)';
    fs.writeFileSync(jsonPath, JSON.stringify(sidecar, null, 2), 'utf8');

    const third = await importIrodoriDirectory({
      dir: srcDir,
      dryRun: false,
      dbFile,
      storePath,
      mediaDir,
    });
    assert.equal(third.totals.errors, 0);
    assert.equal(third.totals.updated, 1);
    assert.equal(third.totals.unchanged, 3);

    const allClips = listShadowingClips(dbFile);
    const irodoriClips = allClips.filter((c) => c.id.startsWith(IRODORI_CLIP_PREFIX));
    assert.equal(irodoriClips.length, 4);

    const levels = new Set(irodoriClips.map((c) => c.level));
    assert.deepEqual(levels, new Set(['N5', 'N4', 'N3']));

    const metaMap = buildClipMetaMap(irodoriClips, dbFile);
    for (const clip of irodoriClips) {
      assert.equal(clip.license, IRODORI_LICENSE);
      assert.ok(clip.attribution.startsWith('IRODORI '), `bad attribution: ${clip.attribution}`);
      assert.ok(clip.tags && clip.tags.includes('IRODORI'), `missing IRODORI tag on ${clip.id}`);

      const media = await privateClipMedia(clip.id, dbFile);
      assert.ok(media, `missing privateClipMedia for ${clip.id}`);
      assert.ok(media.path.startsWith(mediaDir), `media not under mediaDir: ${media.path}`);
      assert.equal(media.path.includes(`${path.sep}public${path.sep}`), false);

      const meta = metaMap[clip.id]!;
      assert.ok(meta, `missing meta for ${clip.id}`);
      assert.ok(meta.title.length > 0);
      assert.ok(meta.sourceLabel.startsWith('IRODORI '));
      assert.ok(['N5', 'N4', 'N3'].includes(meta.level));
      assert.ok(meta.topic.length > 0 && meta.topic !== '—');
      assert.equal(meta.sentenceCount, clip.segments.length);
      assert.ok(meta.sentenceCount >= 3);
      assert.ok(
        meta.speechRateCharsPerSec !== null && meta.speechRateCharsPerSec > 0,
        `missing speechRate on ${clip.id}`,
      );
      assert.equal(meta.knownWordPercent, null);

      const withKnown = computeClipMeta(clip, new Set(['おはよう', '電車', '頭', '会議', '時間']));
      assert.ok(
        withKnown.knownWordPercent !== null &&
          withKnown.knownWordPercent >= 0 &&
          withKnown.knownWordPercent <= 100,
      );
    }

    const b1Clip = irodoriClips.find((c) => c.level === 'N3');
    assert.ok(b1Clip, 'expected N3 clip from B1');
    assert.equal(b1Clip.roadmapWeek, 50);
    assert.ok(
      b1Clip.segments.some((seg) => seg.furigana && seg.furigana.includes('{')),
      'expected offline furigana markup on B1 kanji sentences',
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});

test('importIrodoriDirectory supports --level filtering and rejects traversal, bad magic, missing transcript, and missing dir', async () => {
  const tmp = makeTempDir('nihon-irodori-sec-');
  try {
    const missing = await importIrodoriDirectory({
      dir: path.join(tmp, 'does-not-exist'),
      dryRun: true,
    });
    assert.equal(missing.totals.errors, 1);
    assert.equal(missing.errors[0]!.code, 'IRODORI_DIR_NOT_FOUND');

    const srcDir = path.join(tmp, 'bad-irodori');
    const a1Dir = path.join(srcDir, 'A1');
    fs.mkdirSync(a1Dir, { recursive: true });

    const outsideWav = path.join(tmp, 'outside.wav');
    fs.writeFileSync(outsideWav, makeSyntheticWav(12));

    fs.writeFileSync(path.join(a1Dir, 'fake.mp3'), 'not an mp3 file at all', 'utf8');
    fs.writeFileSync(path.join(a1Dir, 'fake.txt'), 'テストです。\n二番目の文です。', 'utf8');

    fs.writeFileSync(path.join(a1Dir, 'notext.wav'), makeSyntheticWav(12));

    fs.writeFileSync(
      path.join(srcDir, 'manifest.json'),
      JSON.stringify({
        clips: [
          {
            id: 'escape-attempt',
            level: 'A1',
            title: 'Traversal test',
            audio: '../outside.wav',
            segments: [{ startMs: 500, endMs: 11500, ja: 'テストです。' }],
          },
        ],
      }),
      'utf8',
    );

    const badReport = await importIrodoriDirectory({
      dir: srcDir,
      dryRun: true,
      autoMeta: false,
    });
    const codes = new Set(badReport.errors.map((e) => e.code));
    assert.ok(codes.has('PATH_OUTSIDE_IRODORI_ROOT'), `expected PATH_OUTSIDE_IRODORI_ROOT in ${[...codes]}`);
    assert.ok(codes.has('MEDIA_SIGNATURE_MISMATCH'), `expected MEDIA_SIGNATURE_MISMATCH in ${[...codes]}`);
    assert.ok(codes.has('MISSING_TRANSCRIPT'), `expected MISSING_TRANSCRIPT in ${[...codes]}`);
    assert.equal(badReport.totals.valid, 0);

    const multiDir = path.join(tmp, 'multi');
    populateSyntheticIrodoriTree(multiDir);
    const filtered = await importIrodoriDirectory({
      dir: multiDir,
      dryRun: true,
      levels: ['A1', 'B1'],
      autoMeta: false,
    });
    assert.equal(filtered.totals.errors, 0);
    assert.equal(filtered.totals.valid, 2);
    assert.equal(filtered.byLevel.A1.count, 1);
    assert.equal(filtered.byLevel.A2.count, 0);
    assert.equal(filtered.byLevel.B1.count, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI parseIrodoriCliArgs and tools/import-irodori.ts --dry-run --json work offline', () => {
  const parsed = parseIrodoriCliArgs([
    '--dir',
    'data/private/irodori',
    '--dry-run',
    '--level',
    'A1,A2-2',
    '--no-auto-meta',
    '--json',
  ]);
  assert.equal(parsed.dir, 'data/private/irodori');
  assert.equal(parsed.dryRun, true);
  assert.deepEqual(parsed.levels, ['A1', 'A2']);
  assert.equal(parsed.autoMeta, false);
  assert.equal(parsed.json, true);

  assert.throws(() => parseIrodoriCliArgs(['--level', 'N99']));
  assert.throws(() => parseIrodoriCliArgs(['--unknown-flag']));

  const tmp = makeTempDir('nihon-irodori-cli-');
  try {
    const srcDir = path.join(tmp, 'irodori');
    populateSyntheticIrodoriTree(srcDir);

    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'tools/import-irodori.ts', '--dry-run', '--json', '--no-auto-meta'],
      {
        cwd: process.cwd(),
        env: { ...process.env, NIHON_IRODORI_DIR: srcDir },
        encoding: 'utf8',
      },
    );
    const json = JSON.parse(stdout);
    assert.equal(json.dryRun, true);
    assert.equal(json.totals.valid, 4);
    assert.equal(json.byLevel.A1.count, 1);
    assert.equal(json.byLevel.A2.count, 2);
    assert.equal(json.byLevel.B1.count, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('static guard: IRODORI importer and CLI perform zero network calls', () => {
  const files = [
    path.resolve('src/app/(study)/shadowing/irodori-importer.ts'),
    path.resolve('tools/import-irodori.ts'),
  ];
  const forbidden = /\b(fetch\s*\(|node:https?|https?\.request|https?\.get|axios|got\(|curl|wget)\b/i;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    assert.equal(
      forbidden.test(src),
      false,
      `Network call or download reference found in ${path.basename(file)}`,
    );
  }
});
