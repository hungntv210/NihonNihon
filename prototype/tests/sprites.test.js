const test = require('node:test');
const assert = require('node:assert/strict');
const Sprites = require('../sprites.js');
test('năm mascot đều 16 cột, đúng số hàng', () => {
  for (const n of ['ball','cat','shiba','penguin']) { const r = Sprites.rects(n); assert.equal(r.w, 16); assert.equal(r.h, 16); }
  const s = Sprites.rects('seal'); assert.equal(s.w, 16); assert.equal(s.h, 18);
});
test('mỗi màn có đúng một mascot', () => assert.deepEqual(Object.keys(Sprites.MASCOT).sort(), ['jlpt','kanji','on-tap','shadowing','trang-chu']));
test('hàng ngắn được đệm, branch rộng bằng hàng dài nhất', () => assert.equal(Sprites.rects('branch').w, Math.max(...Sprites.GRIDS.branch.map((r) => r.length))));
test('chỉ vẽ ký tự có màu, đúng màu', () => {
  const r = Sprites.rects('dpetal'); assert.equal(r.rects.length, 12); assert.ok(r.rects.every((x) => x.fill === Sprites.PAL[Sprites.GRIDS.dpetal[x.y][x.x]]));
});
test('mèo đen trắng không có màu cam', () => assert.ok(!Sprites.rects('cat').rects.some((x) => x.fill === '#E8956A')));
test('tên lạ ném lỗi', () => assert.throws(() => Sprites.rects('capybara'), /Unknown sprite: capybara/));
