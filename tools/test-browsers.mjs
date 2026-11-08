import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

async function runCheck(file, fixtureRoot, log) {
  const timeout = Number(process.env.BROWSER_CHECK_TIMEOUT_MS ?? 180000);
  if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 180000) throw Error('Invalid browser timeout');
  const fd = fs.openSync(log, 'w');
  try {
    const child = spawn(process.execPath, ['--import', 'tsx', file], {
      detached: process.platform !== 'win32', stdio: ['ignore', fd, fd],
      env: { ...process.env, NIHON_BROWSER_FIXTURE_ROOT: fixtureRoot },
    });
    return await new Promise(resolve => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        if (process.platform === 'win32') {
          const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8' });
          fs.writeSync(fd, `\nTIMEOUT process tree: ${killed.stdout ?? ''}${killed.stderr ?? ''}`);
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') fs.writeSync(fd, String(error)); }
        }
      }, timeout);
      child.once('error', error => { clearTimeout(timer);fs.writeSync(fd, String(error));resolve({ ok: false, timedOut }); });
      child.once('close', code => { clearTimeout(timer);resolve({ ok: code === 0 && !timedOut, timedOut }); });
    });
  } finally { fs.closeSync(fd); }
}

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
    const log = path.join(directory, `${index + 1}-${path.basename(path.dirname(file))}.log`);
    const base = path.resolve('.tmp');fs.mkdirSync(base, { recursive: true });
    const fixtures = fs.mkdtempSync(path.join(base, 'browser-suite-'));
    let result;
    try { result = await runCheck(file, fixtures, log); }
    finally {
      if (path.dirname(path.resolve(fixtures)) !== base) throw Error('Unsafe browser fixture cleanup');
      fs.rmSync(fixtures, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    const { ok, timedOut } = result;
    results.push({ file, start, end: new Date().toISOString(), ok, timedOut, log });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${file} (${log})`);
    if (!ok) console.error(fs.readFileSync(log, 'utf8').split('\n').slice(-25).join('\n'));
  }
  fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(results, null, 2) + '\n');
  if (results.some(result => !result.ok)) process.exitCode = 1;
}
