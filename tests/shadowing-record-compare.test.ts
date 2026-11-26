import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const {
  IDLE_ALTERNATING,
  WAVEFORM_BARS,
  advanceAlternating,
  buildAlternatingQueue,
  computeWaveformPeaks,
  currentAlternatingStep,
  describeAlternatingStep,
  formatDurationRatio,
  formatMicError,
  mixChannelsToMono,
  normalizePeaks,
  pauseAlternating,
  resumeAlternating,
  slicePcmRange,
  startAlternating,
  stopAlternating,
  wholeClipMaxRecordMs,
} = await import('../src/app/(study)/shadowing/record-compare.ts');
const { WaveformCompare } = await import('../src/app/(study)/shadowing/waveform-compare.tsx');
const { ShadowingPlayer } = await import('../src/app/(study)/shadowing/player.tsx');
const { syntheticClip } = await import('../src/app/(study)/shadowing/clip-model.ts');

test('alternating queue orders original -> user -> next sentence and filters invalid indices', () => {
  const queue = buildAlternatingQueue(4, [2, 0, 2, -1, 4, 1.5, NaN]);
  assert.deepEqual(queue, [
    { kind: 'segment', segmentIndex: 0, source: 'original' },
    { kind: 'segment', segmentIndex: 0, source: 'user' },
    { kind: 'segment', segmentIndex: 2, source: 'original' },
    { kind: 'segment', segmentIndex: 2, source: 'user' },
  ]);

  const fromSecond = buildAlternatingQueue(4, [0, 1, 3], { startFrom: 1 });
  assert.deepEqual(fromSecond, [
    { kind: 'segment', segmentIndex: 1, source: 'original' },
    { kind: 'segment', segmentIndex: 1, source: 'user' },
    { kind: 'segment', segmentIndex: 3, source: 'original' },
    { kind: 'segment', segmentIndex: 3, source: 'user' },
  ]);

  assert.deepEqual(buildAlternatingQueue(3, [], { hasWholeTake: true }), [
    { kind: 'whole', source: 'original' },
    { kind: 'whole', source: 'user' },
  ]);

  assert.deepEqual(buildAlternatingQueue(3, [], { hasWholeTake: false }), []);
});

test('alternating playback state machine handles order, pause, resume, completion and stop', () => {
  assert.deepEqual(startAlternating([]), IDLE_ALTERNATING);
  assert.equal(currentAlternatingStep(IDLE_ALTERNATING), null);

  const steps = buildAlternatingQueue(3, [0, 2]);
  let state = startAlternating(steps);
  assert.equal(state.status, 'playing');
  assert.equal(state.index, 0);
  assert.deepEqual(currentAlternatingStep(state), { kind: 'segment', segmentIndex: 0, source: 'original' });
  assert.equal(
    describeAlternatingStep(currentAlternatingStep(state)!, state.index, state.steps.length),
    'Đang phát xen kẽ (1/4): Câu 1 — câu gốc.',
  );

  // Pause preserves current step and ignores advance until resumed.
  state = pauseAlternating(state);
  assert.equal(state.status, 'paused');
  assert.equal(state.index, 0);
  assert.deepEqual(advanceAlternating(state), state);

  state = resumeAlternating(state);
  assert.equal(state.status, 'playing');
  assert.equal(state.index, 0);

  // Advance through user voice -> next sentence original -> next sentence user -> completed.
  state = advanceAlternating(state);
  assert.deepEqual(currentAlternatingStep(state), { kind: 'segment', segmentIndex: 0, source: 'user' });
  assert.equal(
    describeAlternatingStep(currentAlternatingStep(state)!, state.index, state.steps.length),
    'Đang phát xen kẽ (2/4): Câu 1 — giọng của bạn.',
  );

  state = advanceAlternating(state);
  assert.deepEqual(currentAlternatingStep(state), { kind: 'segment', segmentIndex: 2, source: 'original' });

  state = advanceAlternating(state);
  assert.deepEqual(currentAlternatingStep(state), { kind: 'segment', segmentIndex: 2, source: 'user' });

  state = advanceAlternating(state);
  assert.equal(state.status, 'completed');
  assert.equal(currentAlternatingStep(state), null);
  assert.deepEqual(advanceAlternating(state), state);

  // Stop resets cleanly from any state.
  const mid = advanceAlternating(startAlternating(steps));
  assert.deepEqual(stopAlternating(), IDLE_ALTERNATING);
  assert.equal(mid.index, 1);

  assert.equal(
    describeAlternatingStep({ kind: 'whole', source: 'user' }, 1, 2),
    'Đang phát xen kẽ (2/2): Cả clip — giọng của bạn.',
  );
});

test('waveform peak computation handles synthetic PCM, stereo downmix, slicing and normalization', () => {
  // 8 samples split into 4 buckets of 2 samples each: peaks [0.2, 0.8, 0.5, 0]
  const pcm = new Float32Array([0.1, 0.2, -0.8, 0.3, 0.5, -0.4, 0, 0]);
  assert.deepEqual(computeWaveformPeaks(pcm, 4), [0.2, 0.8, 0.5, 0]);
  assert.deepEqual(computeWaveformPeaks(pcm, 4, { normalize: true }), [0.25, 1, 0.625, 0]);

  // Non-finite samples ignored and values above 1 clamped.
  const noisy = [Number.NaN, 1.8, Number.POSITIVE_INFINITY, -0.4];
  assert.deepEqual(computeWaveformPeaks(noisy, 2), [1, 0.4]);

  // Silent PCM stays all zeros after normalization (no NaN).
  const silent = new Float32Array(32);
  assert.deepEqual(computeWaveformPeaks(silent, 4, { normalize: true }), [0, 0, 0, 0]);
  assert.deepEqual(normalizePeaks([]), []);
  assert.deepEqual(computeWaveformPeaks([], 4), [0, 0, 0, 0]);
  assert.deepEqual(computeWaveformPeaks(pcm, 0), []);

  // Multi-channel mono mix averages channels.
  const mono = mixChannelsToMono([new Float32Array([1, -1, 0.5, 0]), new Float32Array([0, 1, 0.5, -0.5])]);
  assert.deepEqual([...mono], [0.5, 0, 0.5, -0.25]);
  assert.equal(mixChannelsToMono([]).length, 0);

  // Slicing a 10s signal at 100 Hz between 2.5s and 5.0s selects samples [250, 500).
  const range = slicePcmRange(1000, 100, 2.5, 5.0);
  assert.deepEqual(range, { startSample: 250, endSample: 500 });
  const ramp = new Float32Array(1000);
  for (let i = 250; i < 500; i++) ramp[i] = (i - 250) / 500; // peak near 0.498
  const sliced = computeWaveformPeaks(ramp, 2, { ...range });
  assert.ok(sliced[0] > 0.24 && sliced[0] < 0.26);
  assert.ok(sliced[1] > 0.49 && sliced[1] <= 0.5);

  assert.equal(formatDurationRatio(2.2, 2.0), 110);
  assert.equal(formatDurationRatio(0, 2.0), null);
  assert.equal(formatDurationRatio(2.0, 0), null);
});

test('whole-clip max duration and Vietnamese microphone error messages cover hardware failures', () => {
  assert.equal(wholeClipMaxRecordMs(15), 60_000);
  assert.equal(wholeClipMaxRecordMs(50), 75_000);
  assert.equal(wholeClipMaxRecordMs(120), 120_000);

  assert.match(formatMicError({ name: 'NotAllowedError' }), /Chưa có quyền micro/);
  assert.match(formatMicError({ name: 'PermissionDeniedError' }), /Chưa có quyền micro/);
  assert.match(formatMicError({ name: 'NotFoundError' }), /Không tìm thấy micro/);
  assert.match(formatMicError({ name: 'NotReadableError' }), /Micro đang bận hoặc bị hỏng/);
  assert.match(formatMicError({ name: 'OverconstrainedError' }), /không hỗ trợ cấu hình ghi âm/);
  assert.match(formatMicError(new Error('unknown')), /Không mở được micro/);
});

test('ShadowingPlayer and WaveformCompare render whole-clip, alternating and overlaid waveform UI', () => {
  const playerHtml = renderToStaticMarkup(createElement(ShadowingPlayer, { clip: syntheticClip }));
  assert.match(playerHtml, />Ghi âm câu 1</);
  assert.match(playerHtml, />Ghi âm cả clip</);
  assert.match(playerHtml, />Phát xen kẽ</);

  const orig = Array.from({ length: WAVEFORM_BARS }, (_, i) => (i % 2 === 0 ? 0.8 : 0.3));
  const user = Array.from({ length: WAVEFORM_BARS }, (_, i) => (i % 2 === 0 ? 0.6 : 0.9));
  const waveHtml = renderToStaticMarkup(
    createElement(WaveformCompare, {
      title: 'Sóng âm xếp chồng · Câu 1',
      originalPeaks: orig,
      userPeaks: user,
      originalSeconds: 3,
      userSeconds: 3.3,
    }),
  );
  assert.match(waveHtml, /Sóng âm xếp chồng · Câu 1/);
  assert.match(waveHtml, /Độ dài 110% so với gốc/);
  assert.equal((waveHtml.match(/data-wave="original"/g) ?? []).length, WAVEFORM_BARS);
  assert.equal((waveHtml.match(/data-wave="user"/g) ?? []).length, WAVEFORM_BARS);

  const ytHtml = renderToStaticMarkup(
    createElement(WaveformCompare, {
      title: 'Sóng âm xếp chồng · Câu 1',
      originalPeaks: null,
      userPeaks: user,
      originalSeconds: 3,
      userSeconds: 2.7,
      originalUnavailableNote: 'Clip YouTube nhúng không trích xuất được âm thanh gốc.',
    }),
  );
  assert.equal((ytHtml.match(/data-wave="original"/g) ?? []).length, 0);
  assert.equal((ytHtml.match(/data-wave="user"/g) ?? []).length, WAVEFORM_BARS);
  assert.match(ytHtml, /Clip YouTube nhúng không trích xuất được âm thanh gốc/);
});
