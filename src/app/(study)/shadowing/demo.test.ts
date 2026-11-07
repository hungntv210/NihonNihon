import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, mediaRange, segmentAt, shouldRepeat } from './demo.ts';
test('synthetic timeline selects exact boundaries without overlapping sentences', () => {
  assert.deepEqual([0, 2.99, 3, 5.99, 6, 8.99, 9, -1].map(segmentAt), [0, 0, 1, 1, 2, 2, -1, -1]);
  assert.equal(demo.segments.at(-1)?.end, demo.duration);
});
test('repeat count includes the first playback and zero means unlimited', () => {
  assert.equal(shouldRepeat(1, 1), false);
  assert.equal(shouldRepeat(2, 3), true);
  assert.equal(shouldRepeat(3, 3), false);
  assert.equal(shouldRepeat(9999, 0), true);
});
test('media handler supports bounded, open-ended and suffix byte requests', () => {
  assert.equal(mediaRange(null, 100), null);
  assert.deepEqual(mediaRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(mediaRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(mediaRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(mediaRange('bytes=90-200', 100), { start: 90, end: 99 });
  for (const range of ['bytes=100-', 'bytes=9-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'other=0-1', 'bytes=99999999999999999999-']) assert.throws(() => mediaRange(range, 100));
});
