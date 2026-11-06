import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { hashPassword } from '../../../core/session.ts';

// Run from the repository root after npm run build:
// npx tsx "src/app/(study)/grammar/browser-check.ts"
const base = path.resolve('.tmp');
fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'grammar-browser-'));
const dbPath = path.join(directory, 'app.sqlite');
seedDemo(dbPath);
const port = await new Promise<number>((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    server.close(() => resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString('base64url');
const child = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port),
], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    APP_ORIGIN: origin,
    NIHON_DB_PATH: dbPath,
    NIHON_PASSWORD_HASH: hashPassword(password),
    SESSION_SECRET: randomBytes(32).toString('hex'),
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (chunk) => { log += chunk; });
child.stderr.on('data', (chunk) => { log += chunk; });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw Error('Server exited: ' + log);
    try {
      if ((await fetch(origin + '/robots.txt')).ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Production server became ready');
  const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  browser = await chromium.launch({
    headless: true,
    ...(chrome && fs.existsSync(chrome) ? { executablePath: chrome } : {}),
  });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin + '/grammar');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mở góc học tập' }).click();
  await page.waitForURL(origin + '/');
  const clicks: { viewport: number; source: string; href: string; pattern: string }[] = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await page.goto(origin + '/grammar');
    const entries = await page.locator('main article .card-heading a').evaluateAll((links) =>
      links.map((link) => ({ href: link.getAttribute('href')!, pattern: link.textContent!.trim() })),
    );
    assert.equal(entries.length, 3, 'All public fixture listing links are covered');
    for (const entry of entries) {
      await page.goto(origin + '/grammar');
      assert.match(entry.href, /^\/grammar\/openjlpt%3Agrammar%3A/);
      await page.locator('main article .card-heading a').filter({ hasText: entry.pattern }).click();
      await page.waitForURL(origin + entry.href);
      await page.getByRole('heading', { level: 1, name: entry.pattern, exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Ý nghĩa', exact: true }).waitFor();
      clicks.push({ viewport: width, source: 'listing', ...entry });
      const related = await page.locator('section[aria-labelledby="related-title"] a').evaluateAll((links) =>
        links.map((link) => ({ href: link.getAttribute('href')!, pattern: link.querySelector('[lang="ja"]')!.textContent!.trim() })),
      );
      assert.equal(related.length, 2, 'Fixture group links are covered');
      for (const target of related) {
        // Return via the real listing link before clicking each related-group link.
        await page.goto(origin + '/grammar');
        await page.locator('main article .card-heading a').filter({ hasText: entry.pattern }).click();
        await page.waitForURL(origin + entry.href);
        assert.match(target.href, /^\/grammar\/openjlpt%3Agrammar%3A/);
        await page.locator('section[aria-labelledby="related-title"] a')
          .filter({ hasText: target.pattern }).click();
        await page.waitForURL(origin + target.href);
        await page.getByRole('heading', { level: 1, name: target.pattern, exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Cách nối', exact: true }).waitFor();
        clicks.push({ viewport: width, source: 'related', ...target });
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
  }
  assert.equal((await page.goto(origin + '/grammar/wa'))?.status(), 200);
  await page.getByRole('heading', { level: 1, name: '〜は', exact: true }).waitFor();
  for (const segment of ['%', '%GG', '%E0%A4%A', 'openjlpt%253Agrammar%253Awa']) {
    assert.equal((await page.goto(origin + '/grammar/' + segment))?.status(), 404, segment);
  }
  assert.deepEqual(errors, []);
  const result = { status: 'PASS', clicks, shortId: 'PASS', malformedIds: '404', browserErrors: errors };
  fs.mkdirSync('data/reports', { recursive: true });
  fs.writeFileSync('data/reports/grammar-browser-check.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  child.kill();
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once('exit', () => resolve());
  });
  assert.equal(path.dirname(directory), base);
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
