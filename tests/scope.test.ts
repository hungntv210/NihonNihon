import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
test('route guard allows owned files and rejects moving a shared file into the route', (t) => {
  const base = path.resolve('.tmp');
  fs.mkdirSync(base, { recursive: true });
  const directory = fs.mkdtempSync(path.join(base, 'scope-'));
  t.after(() => {
    assert.equal(path.dirname(directory), base);
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim(),
    commit = () => {
      git('add', '.');
      git(
        '-c',
        'user.name=Synthetic Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'synthetic scope fixture',
      );
    };
  git('init', '-b', 'master');
  fs.writeFileSync(path.join(directory, 'shared.txt'), 'shared');
  commit();
  const initial = git('rev-parse', 'HEAD');
  const route = path.join(directory, 'src/app/(study)/vocab');
  fs.mkdirSync(route, { recursive: true });
  fs.writeFileSync(path.join(route, 'own component.tsx'), 'owned');
  commit();
  const script = path.resolve('tools/check-route-scope.mjs'),
    check = () =>
      spawnSync(process.execPath, [script, initial, 'vocab'], { cwd: directory, encoding: 'utf8' });
  assert.equal(check().status, 0);
  fs.renameSync(path.join(directory, 'shared.txt'), path.join(route, 'moved.txt'));
  commit();
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /shared\.txt/);
});
