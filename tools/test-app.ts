import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { seedDemo } from './seed-demo.ts';
import { hashPassword } from '../src/core/session.ts';

const base = path.resolve('.tmp');
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
      NIHON_DB_ROLE: 'snapshot',
      NIHON_SETTINGS_PATH: path.join(directory,'settings.json'),
      NIHON_ROADMAP_PATH: path.join(directory,'today-roadmap.json'),
      NIHON_RECORDINGS_DIR: path.join(directory,'recordings'),
      NIHON_BACKUP_DIR: path.join(directory,'backups'),
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
  fetch(origin + url, { redirect: 'manual', signal:AbortSignal.timeout(10000), ...options });
try {
  let ready = false,lastReady='';
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw Error('Test server exited: ' + log);
    try {
      const health=await request('/robots.txt');lastReady=health.status+':'+await health.text();if (health.ok) {
        ready = true;
        break;
      }
    } catch(error) {lastReady=String(error);}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, 'Server became ready: '+log+' last response: '+lastReady);
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
  console.log('app gate: protected navigation passed');
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
  const settings=await request('/api/settings',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({startDate:'2026-10-01'})});assert.equal(settings.status,200);
  assert.equal((await request('/vocab/lesson',{headers:{cookie}})).status,423,'new lesson gate enforced at the existing route');assert.equal((await request('/srs',{headers:{cookie}})).status,200,'shadowing gate never blocks SRS');
  assert.equal((await request('/api/settings',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({eveningTime:'20:00'})})).status,200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'settings.json'),'utf8')).eveningTime,'20:00');
  fs.writeFileSync(path.join(directory,'maintenance.lock'),'isolated test');
  assert.equal((await request('/api/review/cards',options)).status,503,'maintenance gate blocks writes');fs.unlinkSync(path.join(directory,'maintenance.lock'));
  const downloaded=await request('/api/backup',{headers:{cookie}});assert.equal(downloaded.status,200);const archive=await downloaded.text();assert.ok(JSON.parse(archive).files.some((f:{name:string})=>f.name==='settings.json'));
  assert.equal((await request('/api/backup',{method:'POST',headers:{cookie,origin,'content-type':'application/octet-stream'},body:archive})).status,200,'backup download restores through authenticated API');
  const chrome =
    process.env.CHROME_PATH ??
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined);
  console.log('app gate: HTTP auth/CSRF/queue passed');
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
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== origin) outside.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  console.log('app gate: browser navigation');
  await page.goto(origin + '/');
  assert.ok(page.url().endsWith('/login'));
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mở góc học tập' }).click();
  await page.waitForURL(origin + '/');
  await page.getByRole('heading', { name: 'Chào bạn, cùng học nhé.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async()=>{await document.fonts.load('16px "Be Vietnam Pro"','Ộ Ệ Ờ Ữ Ỹ Đ');await document.fonts.load('32px "Shippori Mincho"','働 返 直 骨');});
  assert.ok(
    await page.evaluate(() => document.fonts.check('16px "Be Vietnam Pro"', 'Ộ Ệ Ờ Ữ Ỹ Đ')),
  );
  assert.ok(
    await page.evaluate(() => document.fonts.check('32px "Shippori Mincho"', '働 返 直 骨')),
  );
  assert.ok(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('Subset.woff2'))),'self-hosted subsets actually loaded');
  const reports = 'data/reports';
  fs.mkdirSync(reports, { recursive: true });
  await page.screenshot({ path: path.join(reports, 'foundation-desktop.png'), fullPage: true });
  const globalSearch=page.getByRole('search',{name:'Tìm trong thư viện'});
  assert.equal(await globalSearch.getAttribute('action'),'/common-tools/search');
  assert.equal(await page.getByRole('navigation',{name:'Công cụ học tập'}).getByRole('link',{name:'Shadowing'}).getAttribute('href'),'/shadowing');
  await page.route('**/common-tools/search?*',route=>route.fulfill({contentType:'text/html',body:'<h1>Synthetic search destination</h1>'}));
  await globalSearch.getByRole('searchbox').fill('hán việt 働');
  await globalSearch.getByRole('button',{name:'Tìm',exact:true}).click();
  await page.getByRole('heading',{name:'Synthetic search destination'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/common-tools/search');
  assert.equal(new URL(page.url()).searchParams.get('q'),'hán việt 働');
  await page.unroute('**/common-tools/search?*');
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
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main');
  console.log('app gate: starting cold offline check');
  await page.goto(origin+'/settings');
  await page.getByText('Tải trang để học ngoại tuyến', {exact:true}).click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),undefined,{timeout:30000});
  await page.getByLabel('Mật khẩu đăng nhập',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Bật tải ngoại tuyến',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Đã bật bản sao mã hóa'}).waitFor();
  await page.goto(origin+'/sources');
  await page.goto(origin+'/srs?mode=quick');
  await page.getByRole('button',{name:'Hiện đáp án',exact:true}).waitFor();
  const beforeDB=new DatabaseSync(dbPath,{readOnly:true}),beforeReviews=Number(beforeDB.prepare('SELECT count(*) n FROM srs_reviews').get()?.n);beforeDB.close();
  await page.waitForTimeout(300);
  const cached=await page.evaluate(async()=>{const cache=await caches.open('nihon-private-v1'),response=await cache.match(location.href);return Boolean(response)&&!(await response!.text()).includes('学生');});
  assert.ok(cached,'SRS navigation cached encrypted');
  console.log('app gate: disconnecting and stopping worker');
  await context.setOffline(true);
  const cdp=await context.newCDPSession(page);await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');await cdp.detach();
  console.log('app gate: disconnected');
  await page.goto(origin+'/srs?mode=quick');
  console.log('app gate: offline shell navigated');
  await page.getByRole('heading',{name:'Mở khóa ngoại tuyến',exact:true}).waitFor();
  console.log('app gate: unlock shell visible');
  await page.getByLabel('Mật khẩu ngoại tuyến').fill('wrong-password');
  await page.getByRole('button',{name:'Mở trang đã lưu'}).click();
  await page.getByRole('status').filter({hasText:'Mật khẩu không đúng'}).waitFor();
  console.log('app gate: wrong password rejected');
  await page.getByLabel('Mật khẩu ngoại tuyến').fill(password);
  await page.getByRole('button',{name:'Mở trang đã lưu'}).click();
  console.log('app gate: offline unlocked');
  await page.getByRole('button',{name:'Hiện đáp án',exact:true}).click();
  await page.getByRole('button',{name:/^Được/}).click();
  await page.getByRole('status').filter({hasText:'Đã lưu lượt ôn trên thiết bị.'}).waitFor();
  console.log('app gate: offline review queued');
  await context.setOffline(false);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>!document.body.textContent?.includes('1 lượt chờ đồng bộ'),undefined,{timeout:30000}).catch(async error=>{console.error('SRS reconnect state:',await page.locator('main').innerText());throw error;});
  const reviewed=new DatabaseSync(dbPath,{readOnly:true});assert.equal(Number(reviewed.prepare('SELECT count(*) n FROM srs_reviews').get()?.n),beforeReviews+1,'exactly one cold offline review synchronized');reviewed.close();
  await page.goto(origin+'/sources');
  await page.getByRole('button', { name: 'Đăng xuất' }).filter({ visible: true }).click();
  await page.waitForURL(origin + '/login');
  await page.goto(origin + '/sources');
  assert.ok(page.url().endsWith('/login'));
  assert.equal(await page.evaluate(async()=>{if(!await caches.has('nihon-private-v1'))return 0;return (await (await caches.open('nihon-private-v1')).keys()).length;}),0,'logout removes offline page/proof entries');
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
      'shared search GET routing and feature entry links (synthetic destination; feature backend tested separately)',
      'encrypted cold offline SRS password unlock',
      'offline review outbox reconnect synchronization',
      'logout clears private offline cache',
      'settings persist and lesson gate preserves SRS access',
      'authenticated backup download and restore',
      'maintenance blocks writes',
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
