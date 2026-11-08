import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { hashPassword } from '../../../core/session.ts';

const base = path.resolve(process.env.NIHON_BROWSER_FIXTURE_ROOT || '.tmp');
fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'app-')),
  dbPath = path.join(directory, 'app.sqlite');
seedDemo(dbPath);
const port = await new Promise<number>((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No test port');
    const p = address.port;
    server.close(() => resolve(p));
  });
});
const origin = `http://127.0.0.1:${port}`,
  password = randomBytes(24).toString('base64url');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
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
  },
);
let log = '';
child.stdout.on('data', (b) => {
  log += b;
});
child.stderr.on('data', (b) => {
  log += b;
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const request = (url: string, options: RequestInit = {}) =>
  fetch(origin + url, { redirect: 'manual', ...options });
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw Error('Test server exited: ' + log);
    try {
      if ((await request('/robots.txt')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, 'Server became ready');
  for (const url of [
    '/',
    '/vocab',
    '/kanji',
    '/grammar',
    '/srs',
    '/sources',
    '/missing',
    '/vocab.json',
    '/?_rsc=test',
  ]) {
    const r = await request(url);
    assert.equal(r.status, 307, url);
    assert.ok(r.headers.get('location')?.endsWith('/login'), url);
    assert.match(r.headers.get('cache-control') ?? '', /no-store/);
    assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/);
  }
  assert.equal((await request('/api/review/cards')).status, 401);
  assert.equal(
    (
      await request('/sources', {
        headers: { 'x-middleware-subrequest': 'proxy:proxy:proxy:proxy:proxy' },
      })
    ).status,
    307,
  );
  assert.equal(
    (
      await request('/api/session', {
        method: 'POST',
        headers: { origin: 'https://untrusted.invalid' },
        body: new URLSearchParams({ password }),
      })
    ).status,
    403,
  );
  const wrong = await request('/api/session', {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({ password: 'incorrect-synthetic-password' }),
  });
  assert.equal(wrong.status, 303);
  assert.equal(wrong.headers.get('set-cookie'), null);
  const login = await request('/api/session', {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({ password }),
  });
  assert.equal(login.status, 303);
  const setCookie = login.headers.get('set-cookie')!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=strict/i);
  const cookie = setCookie.split(';')[0];
  assert.equal((await request('/', { headers: { cookie } })).status, 200);
  assert.equal(
    (
      await request('/api/review/cards', {
        method: 'POST',
        headers: {
          cookie,
          origin: 'https://untrusted.invalid',
          'content-type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/api/review/cards', {
        method: 'POST',
        headers: { cookie, origin, 'content-type': 'application/json' },
        body: '{',
      })
    ).status,
    400,
  );
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const itemId = String(db.prepare("SELECT item_id FROM vocab WHERE word='学生'").get()!.item_id);
  db.close();
  const options = {
    method: 'POST',
    headers: { cookie, origin, 'content-type': 'application/json' },
    body: JSON.stringify({ itemId, cardType: 'recognition' }),
  };
  const first = await request('/api/review/cards', options),
    second = await request('/api/review/cards', options);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  const a = await first.json(),
    b = await second.json();
  assert.equal(a.cardId, b.cardId);
  assert.equal(
    (
      await request('/api/review/cards', {
        ...options,
        body: JSON.stringify({ itemId: 'missing', cardType: 'recognition' }),
      })
    ).status,
    404,
  );
  const robots = await (await request('/robots.txt')).text();
  assert.match(robots, /Disallow: \//);
  const chrome =
    process.env.CHROME_PATH ??
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined);
  browser = await chromium.launch({
    headless: true,
    ...(chrome && fs.existsSync(chrome) ? { executablePath: chrome } : {}),
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    outside: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== origin) outside.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/');
  assert.ok(page.url().endsWith('/login'));
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mở góc học tập' }).click();
  await page.waitForURL(origin + '/');
  await page.getByRole('heading', { name: 'Chào bạn, cùng học nhé.' }).waitFor();
  await page.evaluate(async () => {
    await document.fonts.load('16px "Be Vietnam Pro"', 'Ộ Ệ Ờ Ữ Ỹ Đ');
    await document.fonts.load('32px "Shippori Mincho"', '働 返 直 骨');
    await document.fonts.ready;
  });
  assert.ok(
    await page.evaluate(() => document.fonts.check('16px "Be Vietnam Pro"', 'Ộ Ệ Ờ Ữ Ỹ Đ')),
  );
  assert.ok(
    await page.evaluate(() => document.fonts.check('32px "Shippori Mincho"', '働 返 直 骨')),
  );
  const reports = 'data/reports';
  fs.mkdirSync(reports, { recursive: true });
  await page.screenshot({ path: path.join(reports, 'foundation-desktop.png'), fullPage: true });
  for (const url of ['/vocab', '/kanji', '/grammar', '/srs', '/sources']) {
    await page.goto(origin + url);
    assert.equal(await page.locator('main h1').count(), 1);
    assert.ok(!(await page.getByText('Chưa thể mở góc học tập.', { exact: true }).count()));
  }
  await page.goto(origin + '/vocab');
  await page.getByRole('button', { name: 'Thêm vào ôn' }).first().click();
  await page.getByRole('button', { name: 'Đã thêm ✓' }).waitFor();
  assert.ok(await page.getByRole('status').filter({ hasText: 'Thẻ đã ở trong hàng ôn.' }).count());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/');
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: path.join(reports, 'foundation-mobile.png'), fullPage: true });
  await page.goto(origin + "/srs?mode=quick");
  await page.getByRole("button",{name:"Hiện đáp án"}).waitFor();
  await context.setOffline(true);
  await page.getByRole("button",{name:"Hiện đáp án"}).click();
  await page.getByRole("button",{name:/^Được/}).click();
  await page.getByText(/1 lượt chờ đồng bộ/).waitFor();
  await page.screenshot({path:path.join(reports,"srs-offline.png"),fullPage:true});
  await context.setOffline(false);
  await page.getByText(/0 lượt chờ đồng bộ/).waitFor();
  const history = new DatabaseSync(dbPath,{readOnly:true});
  const review = history.prepare("SELECT * FROM srs_reviews").get()!;
  assert.equal(history.prepare("SELECT count(*) n FROM srs_reviews").get()!.n,1);
  const replay = {reviewId:review.review_id,cardId:review.card_id,rating:review.rating,reviewedAt:review.reviewed_at,elapsedMs:review.elapsed_ms,baseUpdatedAt:""};
  const receipt = await request("/srs/review",{method:"POST",headers:{cookie,origin,"content-type":"application/json"},body:JSON.stringify(replay)});
  assert.equal(receipt.status,200);assert.equal((await receipt.json()).duplicate,true);
  assert.equal(history.prepare("SELECT count(*) n FROM srs_reviews").get()!.n,1);history.close();
  await page.goto(origin + "/");
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main');
  await page.getByRole('button', { name: 'Đăng xuất' }).filter({ visible: true }).click();
  await page.waitForURL(origin + '/login');
  await page.goto(origin + '/sources');
  assert.ok(page.url().endsWith('/login'));
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
  const result = {
    status: 'PASS',
    checks: [
      'all pages require login',
      'DAL-backed content',
      'CSRF',
      'signed cookie',
      'robots/noindex',
      'idempotent queue',
      'local fonts',
      'desktop/mobile',
      'no browser errors',
    ],
    demo: 'OpenJLPT only',
    screenshots: ['foundation-desktop.png', 'foundation-mobile.png'],
  };
  fs.writeFileSync(path.join(reports, 'foundation-check.json'), JSON.stringify(result, null, 2));
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
