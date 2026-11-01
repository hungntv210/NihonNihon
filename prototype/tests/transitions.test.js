const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../transitions.js');

const log = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
T.EFFECTS.fake = { build: () => log.push('build'), cover: async () => { log.push('cover'); }, reveal: async () => { log.push('reveal'); } };
T.EFFECTS.slow = { build() {}, cover: () => wait(30), reveal: async () => {} };
T.EFFECTS.boom = { build() {}, cover: async () => { throw new Error('boom'); }, reveal: async () => {} };

const counter = () => { const f = () => { f.calls++; }; f.calls = 0; return f; };
function setup(reduced) {
  const layer = { innerHTML: 'x', getBoundingClientRect: () => ({ width: 390, height: 720 }) };
  const content = { animateCalls: 0, animate() { this.animateCalls++; return { finished: Promise.resolve() }; } };
  const runner = T.create({ layer, content, reducedMotion: () => reduced, stepped: () => false });
  return { layer, content, runner };
}

test('gán hiệu ứng theo khoảnh khắc', () => {
  assert.equal(T.forMoment('area'), 'shoji'); assert.equal(T.forMoment('lesson'), 'noren');
  assert.equal(T.forMoment('day-done'), 'sakura'); assert.equal(T.forMoment('level-up'), 'sakura');
  assert.equal(T.forMoment('mock-result'), 'sensu'); assert.equal(T.forMoment('khac'), 'shoji'); assert.equal(T.forMoment(), 'shoji');
});
test('shouldAnimate', () => {
  assert.equal(T.shouldAnimate({ reducedMotion: true }), false);
  assert.equal(T.shouldAnimate({ reducedMotion: false }), true);
});
test('đủ bốn hiệu ứng', () => assert.deepEqual(['noren','sakura','sensu','shoji'].every((k) => typeof T.EFFECTS[k].cover === 'function'), true));
test('thứ tự build → cover → swap → reveal, lớp phủ được xoá', async () => {
  const { layer, runner } = setup(false); log.length = 0;
  const r = await runner.run('fake', () => log.push('swap'));
  assert.deepEqual(log, ['build','cover','swap','reveal']); assert.equal(r.mode, 'full'); assert.equal(layer.innerHTML, '');
});
test('đang chạy thì lần bấm sau bị bỏ qua', async () => {
  const { runner } = setup(false); const swapA = counter(), swapB = counter();
  const a = runner.run('slow', swapA); assert.equal(runner.busy, true);
  const b = await runner.run('fake', swapB);
  assert.equal(b.mode, 'skipped'); assert.equal(swapB.calls, 0); await a; assert.equal(runner.busy, false);
});
test('hiệu ứng ném lỗi vẫn đổi màn và xoá lớp phủ', async () => {
  const { layer, runner } = setup(false); const swap = counter();
  const r = await runner.run('boom', swap); assert.equal(r.mode, 'error'); assert.equal(swap.calls, 1); assert.equal(layer.innerHTML, ''); assert.equal(runner.busy, false);
});
test('giảm chuyển động chỉ mờ chuyển', async () => {
  const { content, runner } = setup(true); const swap = counter();
  const r = await runner.run('shoji', swap); assert.equal(r.mode, 'reduced'); assert.equal(swap.calls, 1); assert.equal(content.animateCalls, 2);
});
