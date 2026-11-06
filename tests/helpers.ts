import fs from 'node:fs';
import path from 'node:path';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seedDemo } from '../tools/seed-demo.ts';
export function fixture(t: TestContext) {
  const base = path.resolve('.tmp');
  fs.mkdirSync(base, { recursive: true });
  const directory = fs.mkdtempSync(path.join(base, 'test-')),
    file = path.join(directory, 'sample.sqlite');
  seedDemo(file);
  const db = new DatabaseSync(file);
  t.after(() => {
    db.close();
    assert.equal(path.dirname(directory), base);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const itemId = String(db.prepare("SELECT item_id FROM vocab WHERE word='学生'").get()!.item_id);
  return { db, file, itemId };
}
