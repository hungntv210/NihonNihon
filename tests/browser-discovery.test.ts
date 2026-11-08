import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error CLI JavaScript module has no declaration file.
import { discoverBrowserChecks } from '../tools/test-browsers.mjs';
test('browser suite discovers every nested route check without an allowlist', t => {
  const base = path.resolve('.tmp');fs.mkdirSync(base,{recursive:true});
  const directory = fs.mkdtempSync(path.join(base,'browser-discovery-'));
  t.after(()=>{assert.equal(path.dirname(directory),base);fs.rmSync(directory,{recursive:true,force:true});});
  for(const route of ['new-route','nested/another']) {const folder=path.join(directory,route);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'browser-check.ts'),'');}
  fs.writeFileSync(path.join(directory,'browser-check.ts.bak'),'');
  assert.deepEqual(discoverBrowserChecks(directory),['nested/another','new-route'].map(route=>path.join(directory,route,'browser-check.ts')));
});
