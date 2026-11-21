import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seedDemo } from '../tools/seed-demo.ts';
import { enqueueCard } from '../src/core/review.ts';
import { seedPrivateClipFixture } from '../src/app/(study)/shadowing/private-fixture.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { syntheticClip } = await import('../src/app/(study)/shadowing/clip-model.ts');
const { resolveShadowingSelection } = await import('../src/app/(study)/shadowing/query.ts');
const {
  PLAYBACK_SPEEDS,
  DEFAULT_PLAYBACK_SPEED,
  SHADOW_PAUSE_FACTOR,
  shadowPauseDurationMs,
  isEditableTarget,
  resolveShadowingShortcut,
  toggleLoopLimit,
  addShadowingClipToSrs,
} = await import('../src/app/(study)/shadowing/controls.ts');
const { ShadowingPlayer } = await import('../src/app/(study)/shadowing/player.tsx');
const { ShadowingLibrary } = await import('../src/app/(study)/shadowing/library.tsx');

const secondClip = {
  ...syntheticClip,
  id: 'clip-erin-1',
  title: 'Clip phụ',
  isDemo: false,
  mediaUrl: '/shadowing/media?clip=clip-erin-1',
  segments: [
    { ...syntheticClip.segments[0], id: 'seg-a', start: 1, end: 3.5 },
    { ...syntheticClip.segments[1], id: 'seg-b', start: 3.5, end: 6.2 },
    { ...syntheticClip.segments[2], id: 'seg-c', start: 6.2, end: 9 },
  ],
};

test('playback speeds include 1.2x while preserving existing options and 0.75x default', () => {
  assert.deepEqual([...PLAYBACK_SPEEDS], [0.5, 0.75, 1, 1.2, 1.25]);
  assert.equal(DEFAULT_PLAYBACK_SPEED, 0.75);
  assert.equal(SHADOW_PAUSE_FACTOR, 1.2);
  assert.equal(shadowPauseDurationMs({ start: 0, end: 3 }), 3600);
  assert.equal(shadowPauseDurationMs({ start: 1.5, end: 4 }), 3000);
  assert.equal(shadowPauseDurationMs({ start: 5, end: 5 }), 0);
  assert.equal(shadowPauseDurationMs({ start: 6, end: 4 }), 0);

  const html = renderToStaticMarkup(createElement(ShadowingPlayer, { clip: syntheticClip }));
  assert.match(html, /<option value="1\.2">1\.2×<\/option>/);
  assert.match(html, /<option value="0\.75" selected="">0\.75×<\/option>/);
  assert.match(html, /Dừng nói theo ×1\.2/);
  assert.match(html, /Thêm câu vào SRS/);
  assert.match(html, /aria-label="Phím tắt máy tính"/);
});

test('desktop shortcuts map Space, ArrowLeft, ArrowRight, R, L and ignore editable targets', () => {
  const body = { tagName: 'BODY', isContentEditable: false };
  assert.equal(resolveShadowingShortcut({ key: ' ', code: 'Space', target: body }), 'toggle-play');
  assert.equal(
    resolveShadowingShortcut({ key: ' ', code: 'Space', repeat: true, target: body }),
    null,
  );
  assert.equal(resolveShadowingShortcut({ key: 'ArrowLeft', target: body }), 'prev-segment');
  assert.equal(resolveShadowingShortcut({ key: 'ArrowRight', target: body }), 'next-segment');
  assert.equal(resolveShadowingShortcut({ key: 'r', target: body }), 'replay-segment');
  assert.equal(resolveShadowingShortcut({ key: 'R', target: body }), 'replay-segment');
  assert.equal(resolveShadowingShortcut({ key: 'l', target: body }), 'toggle-loop');
  assert.equal(resolveShadowingShortcut({ key: 'L', target: body }), 'toggle-loop');
  assert.equal(resolveShadowingShortcut({ key: 'l', repeat: true, target: body }), null);
  assert.equal(resolveShadowingShortcut({ key: 'x', target: body }), null);

  assert.equal(resolveShadowingShortcut({ key: 'r', ctrlKey: true, target: body }), null);
  assert.equal(resolveShadowingShortcut({ key: 'r', metaKey: true, target: body }), null);
  assert.equal(resolveShadowingShortcut({ key: 'ArrowLeft', altKey: true, target: body }), null);
  assert.equal(resolveShadowingShortcut({ key: ' ', defaultPrevented: true, target: body }), null);

  const editableTargets = [
    { tagName: 'INPUT' },
    { tagName: 'textarea' },
    { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true },
    { tagName: 'DIV', getAttribute: (name: string) => (name === 'contenteditable' ? 'true' : null) },
    { tagName: 'DIV', getAttribute: (name: string) => (name === 'contenteditable' ? '' : null) },
    { tagName: 'SPAN', parentElement: { tagName: 'DIV', isContentEditable: true } },
    { tagName: 'SPAN', closest: () => ({ tagName: 'DIV' }) },
  ];
  for (const target of editableTargets) {
    assert.equal(isEditableTarget(target), true);
    for (const key of [' ', 'ArrowLeft', 'ArrowRight', 'r', 'l']) {
      assert.equal(resolveShadowingShortcut({ key, target }), null);
    }
  }

  assert.deepEqual(toggleLoopLimit(1, 1), { limit: 0, remembered: 1 });
  assert.deepEqual(toggleLoopLimit(0, 1), { limit: 1, remembered: 1 });
  assert.deepEqual(toggleLoopLimit(3, 1), { limit: 0, remembered: 3 });
  assert.deepEqual(toggleLoopLimit(0, 3), { limit: 3, remembered: 3 });
});

test('deep-link query resolves valid clip and segment and falls back safely on invalid values', () => {
  const clips = [syntheticClip, secondClip];

  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'clip-erin-1', segment: '2' }), {
    clipId: 'clip-erin-1',
    segmentIndex: 1,
  });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'clip-erin-1', segment: 'seg-c' }), {
    clipId: 'clip-erin-1',
    segmentIndex: 2,
  });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: ['clip-erin-1'], segment: ['3'] }), {
    clipId: 'clip-erin-1',
    segmentIndex: 2,
  });

  assert.deepEqual(resolveShadowingSelection(clips, {}), { clipId: 'demo', segmentIndex: 0 });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'unknown', segment: '2' }), {
    clipId: 'demo',
    segmentIndex: 1,
  });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'clip-erin-1', segment: '0' }), {
    clipId: 'clip-erin-1',
    segmentIndex: 0,
  });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'clip-erin-1', segment: '-3' }), {
    clipId: 'clip-erin-1',
    segmentIndex: 0,
  });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'clip-erin-1', segment: '99' }), {
    clipId: 'clip-erin-1',
    segmentIndex: 0,
  });
  assert.deepEqual(resolveShadowingSelection(clips, { clip: 'clip-erin-1', segment: 'abc' }), {
    clipId: 'clip-erin-1',
    segmentIndex: 0,
  });
  assert.deepEqual(resolveShadowingSelection([], { clip: 'demo', segment: '1' }), {
    clipId: '',
    segmentIndex: 0,
  });

  const html = renderToStaticMarkup(
    createElement(ShadowingLibrary, {
      clips,
      initialClipId: 'clip-erin-1',
      initialSegment: 1,
    }),
  );
  assert.match(html, /<h2>Clip phụ<\/h2>/);
  assert.match(html, /Câu 2 · Đã phát 0 lượt/);
});

test('add shadowing clip to SRS reuses enqueueCard without creating duplicate cards', async (t) => {
  const base = path.resolve('.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'shadowing-srs-'));
  t.after(() => {
    assert.equal(path.dirname(dir), base);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  const dbPath = path.join(dir, 'demo.sqlite');
  seedDemo(dbPath);
  const privateClip = seedPrivateClipFixture(dbPath, dir);

  const first = enqueueCard(dbPath, privateClip.id, 'shadow', new Date('2026-11-21T08:00:00Z'));
  assert.equal(first.created, true);
  const second = enqueueCard(dbPath, privateClip.id, 'shadow', new Date('2026-11-21T08:05:00Z'));
  assert.equal(second.created, false);
  assert.equal(second.cardId, first.cardId);

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const countRow = db
      .prepare("SELECT count(*) AS n FROM srs_cards WHERE item_id = ? AND card_type = 'shadow'")
      .get(privateClip.id) as { n: number };
    assert.equal(countRow.n, 1);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    db.close();
  }

  const requests: Array<{ url: string; body: string }> = [];
  const createResult = await addShadowingClipToSrs(privateClip.id, async (url, init) => {
    requests.push({ url: String(url), body: String(init?.body ?? '') });
    return new Response(JSON.stringify({ cardId: first.cardId, created: true }), { status: 201 });
  });
  assert.equal(createResult.status, 'added');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/review/cards');
  assert.deepEqual(JSON.parse(requests[0].body), { itemId: privateClip.id, cardType: 'shadow' });

  const duplicateResult = await addShadowingClipToSrs(privateClip.id, async () => {
    return new Response(JSON.stringify({ cardId: first.cardId, created: false }), { status: 200 });
  });
  assert.equal(duplicateResult.status, 'duplicate');
  assert.match(duplicateResult.message, /đã có trong thẻ ôn/i);

  const unsupportedResult = await addShadowingClipToSrs('demo', async () => {
    return new Response(JSON.stringify({ error: 'Nội dung hoặc loại thẻ không hợp lệ.' }), {
      status: 404,
    });
  });
  assert.equal(unsupportedResult.status, 'unsupported');

  const unauthResult = await addShadowingClipToSrs(privateClip.id, async () => {
    return new Response(null, { status: 401 });
  });
  assert.equal(unauthResult.status, 'unauthorized');

  const errorResult = await addShadowingClipToSrs(privateClip.id, async () => {
    throw new Error('offline');
  });
  assert.equal(errorResult.status, 'error');
});
