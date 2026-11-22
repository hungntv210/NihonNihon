import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seedDemo } from '../tools/seed-demo.ts';
import { openContentDatabase } from '../src/core/content.ts';
import { enqueueCard } from '../src/core/review.ts';
import { parseYoutubeClip, syntheticClip, type Clip } from '../src/app/(study)/shadowing/clip-model.ts';
import { youtubeFixture } from '../src/app/(study)/shadowing/youtube-fixture.ts';
import {
  clipSourceLabel,
  computeClipMeta,
  computeKnownWordPercent,
  computeSpeechRate,
  countSpokenCharacters,
  formatKnownWordPercent,
  formatSpeechRate,
} from '../src/app/(study)/shadowing/clip-meta.ts';
import {
  buildClipMetaMap,
  loadKnownVocabTerms,
} from '../src/app/(study)/shadowing/clip-meta-server.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { ShadowingLibrary } = await import('../src/app/(study)/shadowing/library.tsx');

test('clip metadata computes sentence count and speech rate (chars/s excluding punctuation and spaces)', () => {
  // Demo clip: 9 + 10 + 10 = 29 spoken Japanese chars over 9s => 3.2 chars/s
  assert.equal(countSpokenCharacters('おはようございます。'), 9);
  assert.equal(countSpokenCharacters('今日は いい天気ですね！？'), 10);
  assert.equal(countSpokenCharacters('コーヒー、人々。'), 6);

  const demoMeta = computeClipMeta(syntheticClip, null);
  assert.equal(demoMeta.title, syntheticClip.title);
  assert.equal(demoMeta.sourceLabel, 'Demo');
  assert.equal(demoMeta.level, 'N5');
  assert.equal(demoMeta.topic, 'Thử thao tác');
  assert.equal(demoMeta.sentenceCount, 3);
  assert.equal(demoMeta.speechRateCharsPerSec, 3.2);
  assert.equal(formatSpeechRate(demoMeta.speechRateCharsPerSec), '3.2 ký tự/s');

  // YouTube fixture: 3 segments x 3 kana chars = 9 chars over 3 x 3s = 9s => 1.0 chars/s
  const ytClip = parseYoutubeClip(youtubeFixture);
  const ytMeta = computeClipMeta(ytClip, null);
  assert.equal(ytMeta.sentenceCount, 3);
  assert.equal(ytMeta.speechRateCharsPerSec, 1.0);
  assert.equal(ytMeta.sourceLabel, 'YouTube · Original synthetic fixture');

  // Empty / zero-duration edge cases degrade cleanly to null -> "—"
  assert.equal(computeSpeechRate([]), null);
  assert.equal(computeSpeechRate([{ ja: '。。。', start: 0, end: 2 }]), null);
  assert.equal(computeSpeechRate([{ ja: 'あいう', start: 2, end: 2 }]), null);
  assert.equal(formatSpeechRate(null), '—');
});

test('known word percentage returns null ("—") when user has 0 cards, and exact % when cards exist', () => {
  const tokenizedClip: Clip = {
    ...syntheticClip,
    id: 'tokenized-test',
    segments: [
      {
        id: 's1',
        start: 0,
        end: 4,
        ja: '学生は学校へ行きます。',
        kana: 'がくせいはがっこうへいきます。',
        speaker: null,
        vi: 'Học sinh đi đến trường.',
        tokens: [
          { surface: '学生', clickable: true },
          { surface: 'は', clickable: true },
          { surface: '学校', clickable: true },
          { surface: 'へ', clickable: true },
          { surface: '行き', base: '行く', clickable: true },
          { surface: 'ます', clickable: true },
          { surface: '。', clickable: false },
        ],
      },
      {
        id: 's2',
        start: 4,
        end: 8,
        ja: '学生は元気です。',
        kana: 'がくせいはげんきです。',
        speaker: null,
        vi: 'Học sinh khỏe.',
        tokens: [
          // Duplicate '学生' and 'は' should be deduplicated across the clip
          { surface: '学生', clickable: true },
          { surface: 'は', clickable: true },
          { surface: '元気', clickable: true },
          { surface: 'です', clickable: true },
          { surface: '。', clickable: false },
        ],
      },
    ],
  };

  // 0 cards -> null -> "—"
  assert.equal(computeKnownWordPercent(tokenizedClip.segments, null), null);
  assert.equal(computeKnownWordPercent(tokenizedClip.segments, new Set()), null);
  assert.equal(formatKnownWordPercent(null), '—');

  // Unique clickable words: 学生, は, 学校, へ, 行く(行き), ます, 元気, です (8 unique)
  // User has cards, none in clip -> 0%
  assert.equal(computeKnownWordPercent(tokenizedClip.segments, new Set(['猫'])), 0);
  assert.equal(formatKnownWordPercent(0), '0%');

  // Matches surface ('学生'), base/lemma ('行く' matching surface '行き'), and another ('元気') -> 3/8 = 38%
  assert.equal(
    computeKnownWordPercent(tokenizedClip.segments, new Set(['学生', '行く', '元気'])),
    38,
  );
  assert.equal(formatKnownWordPercent(38), '38%');

  // All 8 unique words known -> 100%
  assert.equal(
    computeKnownWordPercent(
      tokenizedClip.segments,
      new Set(['学生', 'は', '学校', 'へ', '行く', 'ます', '元気', 'です']),
    ),
    100,
  );
});

test('server loader handles 0 SRS cards cleanly ("—") and counts active SRS + notebook vocab cards', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-clip-meta-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, 'demo.sqlite');
  const contextPath = path.join(dir, 'lookup-sentences.json');
  seedDemo(dbPath);

  const sampleClip: Clip = {
    ...syntheticClip,
    id: 'db-test-clip',
    segments: [
      {
        id: 'seg-1',
        start: 0,
        end: 4,
        ja: '日本と学生。',
        kana: 'にほんとがくせい。',
        speaker: null,
        vi: 'Nhật Bản và học sinh.',
        tokens: [
          { surface: '日本', clickable: true },
          { surface: 'と', clickable: true },
          { surface: '学生', clickable: true },
          { surface: '。', clickable: false },
        ],
      },
    ],
  };

  // Fresh demo DB has 0 SRS cards and no lookup file -> must return empty set and null ("—") without error
  assert.equal(loadKnownVocabTerms(dbPath, contextPath).size, 0);
  const emptyMap = buildClipMetaMap([sampleClip], dbPath, contextPath);
  assert.equal(emptyMap[sampleClip.id].knownWordPercent, null);
  assert.equal(formatKnownWordPercent(emptyMap[sampleClip.id].knownWordPercent), '—');

  // Add one vocab item via SRS card and a second vocab item via saved lookup notebook store
  const db = openContentDatabase(dbPath);
  let firstVocab: { item_id: string; word: string; reading: string };
  let secondVocab: { item_id: string; word: string; reading: string };
  try {
    const rows = db
      .prepare(
        `SELECT v.item_id, v.word, v.reading
         FROM vocab v
         JOIN content_items i USING(item_id)
         WHERE i.is_active=1
         ORDER BY v.item_id
         LIMIT 2`,
      )
      .all() as { item_id: string; word: string; reading: string }[];
    assert.ok(rows.length >= 2, 'demo DB must seed at least 2 vocab items');
    [firstVocab, secondVocab] = rows;
  } finally {
    db.close();
  }

  enqueueCard(dbPath, firstVocab.item_id, 'recognition');
  fs.writeFileSync(
    contextPath,
    JSON.stringify({
      version: 1,
      entries: {
        'card-saved-2': {
          cardId: 'card-saved-2',
          itemId: secondVocab.item_id,
          sentenceJa: secondVocab.word,
          sentenceVi: null,
          sourceClipId: sampleClip.id,
          savedAt: '2026-11-22T03:00:00.000Z',
        },
      },
    }),
  );

  const terms = loadKnownVocabTerms(dbPath, contextPath);
  assert.ok(terms.has(firstVocab.word.normalize('NFC')));
  assert.ok(terms.has(firstVocab.reading.normalize('NFC')));
  assert.ok(terms.has(secondVocab.word.normalize('NFC')));

  const matchedClip: Clip = {
    ...sampleClip,
    id: 'db-matched-clip',
    segments: [
      {
        id: 'seg-m1',
        start: 0,
        end: 5,
        ja: `${firstVocab.word}、${secondVocab.reading}、未知語。`,
        kana: null,
        speaker: null,
        vi: null,
        tokens: [
          { surface: firstVocab.word, clickable: true },
          { surface: '、', clickable: false },
          { surface: secondVocab.reading, clickable: true },
          { surface: '、', clickable: false },
          { surface: '未知語', clickable: true },
          { surface: '。', clickable: false },
        ],
      },
    ],
  };

  const filledMap = buildClipMetaMap([matchedClip], dbPath, contextPath);
  // 2 of 3 unique clickable words known -> 67%
  assert.equal(filledMap[matchedClip.id].knownWordPercent, 67);
  assert.equal(filledMap[matchedClip.id].sentenceCount, 1);
  assert.ok((filledMap[matchedClip.id].speechRateCharsPerSec ?? 0) > 0);
});

test('ShadowingLibrary renders all 7 metadata fields per clip card and formats source labels safely', () => {
  const privateClip: Clip = {
    ...syntheticClip,
    id: 'private:erin-demo',
    title: 'Clip mẫu riêng',
    level: 'N4',
    topic: 'Hội thoại hằng ngày',
    isDemo: false,
    attribution: 'Nguồn thử nghiệm',
    youtubeId: null,
  };
  assert.equal(clipSourceLabel(privateClip), 'Nguồn thử nghiệm');
  assert.equal(
    clipSourceLabel({ isDemo: false, youtubeId: null, attribution: '   ' }),
    'Tư liệu riêng',
  );

  const html = renderToStaticMarkup(
    createElement(ShadowingLibrary, {
      clips: [syntheticClip, privateClip],
      metaByClip: {
        [syntheticClip.id]: computeClipMeta(syntheticClip, null),
        [privateClip.id]: {
          ...computeClipMeta(privateClip, null),
          knownWordPercent: 75,
        },
      },
    }),
  );

  // All 7 fields visible for demo clip (0 cards -> "—")
  assert.match(html, /Nhịp thử · 3 đoạn/);
  assert.match(html, /Nguồn: Demo/);
  assert.match(html, />N5</);
  assert.match(html, /Chủ đề: Thử thao tác/);
  assert.match(html, /3 câu/);
  assert.match(html, /Tốc độ: 3\.2 ký tự\/s/);
  assert.match(html, /Từ đã biết: —/);

  // All 7 fields visible for private clip with knownWordPercent
  assert.match(html, /Clip mẫu riêng/);
  assert.match(html, /Nguồn: Nguồn thử nghiệm/);
  assert.match(html, />N4</);
  assert.match(html, /Chủ đề: Hội thoại hằng ngày/);
  assert.match(html, /Từ đã biết: 75%/);
});
