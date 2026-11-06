const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lessons.js');

test('tìm từ bằng nghĩa không dấu, kana và chữ Hán', () => {
  assert.equal(L.filterWords('xac nhan', '', false, [])[0].word, '確認');
  assert.equal(L.filterWords('うかがう', '', false, [])[0].id, 'v1');
  assert.equal(L.filterWords('伺う', '', false, [])[0].id, 'v1');
  assert.equal(L.filterWords('<script>', '', false, []).length, 0);
});
test('bộ lọc cấp độ và từ đã lưu cùng áp dụng', () => {
  assert.deepEqual(L.filterWords('', 'N3', true, ['v1', 'v4']).map(v => v.id), ['v1']);
  assert.deepEqual(L.filterWords('', '', true, []), []);
});
test('khôi phục tiến độ hỏng, trùng lặp và dữ liệu lạ', () => {
  const empty = { saved: [], grammar: [], reading: [], conversation: [] };
  for (const raw of [null, 'oops', 'null', '[]', '{}']) assert.deepEqual(L.readProgress(raw), empty);
  assert.deepEqual(L.readProgress('{"saved":["v1","v1","bad"],"grammar":["g2"],"reading":"r1","conversation":["c2"]}'), { saved: ['v1'], grammar: ['g2'], reading: [], conversation: ['c2'] });
});
test('câu hỏi có đáp án hợp lệ và giải thích', () => {
  for (const lesson of [...L.grammar, ...L.readings]) {
    assert.ok(lesson.questions.length >= 2);
    for (const q of lesson.questions) {
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
      assert.ok(q.why.length > 10);
      assert.equal(new Set(q.options).size, q.options.length);
    }
  }
  for (const c of L.conversations) {
    assert.ok(c.steps.length >= 3);
    for (const step of c.steps) assert.ok(step.options[step.answer] && step.jp && step.vi && step.why);
  }
});
