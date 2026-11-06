import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
test('all nine G1 documents reference the current interface and drop retired interface references', () => {
  const files = fs.readdirSync('docs/features').filter((f) => /^g1-.*\.md$/.test(f));
  assert.equal(files.length, 9);
  for (const f of files) {
    const body = fs.readFileSync('docs/features/' + f, 'utf8'),
      line = body.split('\n').find((l) => l.startsWith('- **Giao diện:**'));
    assert.ok(line?.includes('docs/interface-redesign.md'), f);
    assert.ok(!/8-bit|8bit|VT323/.test(body), f);
  }
});
