import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function discoverBrowserChecks(root) {
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name === 'browser-check.ts')
    .map(entry => path.join(entry.parentPath, entry.name)).sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = discoverBrowserChecks('src/app');
  if (!files.length) throw Error('No browser-check.ts files found');
  const directory = path.resolve('data/reports/browser-suite');
  fs.mkdirSync(directory, { recursive: true });
  const results = [];
  for (const [index, file] of files.entries()) {
    const start = new Date().toISOString();
    const result = spawnSync(process.execPath, ['--import', 'tsx', file], {
      encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    });
    const log = path.join(directory, `${index + 1}-${path.basename(path.dirname(file))}.log`);
    fs.writeFileSync(log, (result.stdout ?? '') + (result.stderr ?? '') + (result.error ? String(result.error) : ''));
    const ok = result.status === 0 && !result.error;
    results.push({ file, start, end: new Date().toISOString(), ok, log });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${file} (${log})`);
    if (!ok) console.error(fs.readFileSync(log, 'utf8').split('\n').slice(-25).join('\n'));
  }
  fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(results, null, 2) + '\n');
  if (results.some(result => !result.ok)) process.exitCode = 1;
}
