const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'tokens.css'), 'utf8');
const v = (name) => {
  const m = css.match(new RegExp(name + ': *(#[0-9A-Fa-f]{6})'));
  assert.ok(m, `thiếu biến ${name}`);
  return m[1];
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('chữ trên nền đạt 4,5:1', () => {
  for (const [fg, bg] of [['--ink','--bg'],['--ink','--paper'],['--ink','--mint'],['--ink','--sky'],['--ink','--kaki'],['--ink','--gold'],['--ink','--gold-pale'],['--ink','--blue-pale']])
    assert.ok(ratio(v(fg), v(bg)) >= 4.5, `${fg} trên ${bg}`);
  for (const bg of ['--forest','--blue','--terra']) assert.ok(ratio('#FFFFFF', v(bg)) >= 4.5, `trắng trên ${bg}`);
});
test('thanh tiến độ forest trên mint đạt 3:1', () => assert.ok(ratio(v('--forest'), v('--mint')) >= 3));

test('bảng màu mới: chữ và chú thích đạt 4,5:1', () => {
  const design = fs.readFileSync(path.join(__dirname, '..', 'nihon.css'), 'utf8');
  const token = (name) => [...design.matchAll(new RegExp(name + ': *(#[0-9A-Fa-f]{6})', 'g'))].at(-1)[1];
  for (const [fg, bg] of [['--text', '--ground'], ['--muted', '--ground'], ['--muted', '--surface'], ['--faint', '--surface'], ['--primary-ink', '--primary']])
    assert.ok(ratio(token(fg), token(bg)) >= 4.5, `${fg} trên ${bg}`);
  assert.ok(ratio('#DFE7D9', '#284F40') >= 4.5, 'chú thích trên khung học');
});
test('giá trị khớp spec', () => {
  assert.equal(v('--ink'), '#24332D'); assert.equal(v('--kaki'), '#E8956A'); assert.equal(v('--blue'), '#2F5D86');
  assert.equal(v('--gold'), '#D6B45C'); assert.equal(v('--terra'), '#A64B38'); assert.equal(v('--bg'), '#F4F5F2');
});
