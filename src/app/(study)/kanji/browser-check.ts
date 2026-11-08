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
const directory = fs.mkdtempSync(path.join(base, 'kanji-browser-')),
  database = path.join(directory, 'sample.sqlite');
seedDemo(database);
const db = new DatabaseSync(database),
  day = db
    .prepare(
      "SELECT i.item_id,i.source_hash,i.release_id FROM content_items i JOIN kanji k USING(item_id) WHERE k.character='日'",
    )
    .get()!;
// Synthetic translations/stroke geometry exercise loaded-data paths without private dictionaries.
db.prepare(
  "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:browser-test','Synthetic browser fixture','https://example.invalid','Synthetic test only','Synthetic fixture','private_only')",
).run();
db.prepare(
  "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('browser-release','mt:browser-test','1',?,'local://test','2026-11-06','Synthetic test only','Synthetic test',?)",
).run('c'.repeat(64), JSON.stringify({ model: 'synthetic-model', prompt_version: 'browser-test' }));
for (const [id, field, text, status] of [
  ['primary', 'han_viet', 'nhật', 'selected'],
  ['alternative', 'han_viet', 'niết', 'candidate'],
  ['meaning', 'meaning', 'ngày; mặt trời', 'selected'],
])
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,context_json,created_at) VALUES(?,?,?,?,'machine','mt:browser-test','browser-release',?,?,?,'machine_context',?,'2026-11-06')",
  ).run(
    id,
    String(day.item_id),
    field,
    text,
    id,
    String(day.source_hash),
    status,
    JSON.stringify({ selection_method: field === 'han_viet' ? 'ai_fallback' : undefined }),
  );
for (const [i, geometry] of [
  'M25 20L25 90',
  'M25 20L80 20L80 90',
  'M25 55L80 55',
  'M25 90L80 90',
].entries())
  db.prepare(
    "INSERT INTO kanji_strokes(kanji_id,stroke_no,path_d,source_id,release_id) VALUES(?,?,?,'mt:browser-test','browser-release')",
  ).run(String(day.item_id), i + 1, geometry);
db.close();
const port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const a = server.address();
      if (!a || typeof a === 'string') throw Error();
      const n = a.port;
      server.close(() => resolve(n));
    });
  }),
  origin = `http://127.0.0.1:${port}`,
  password = randomBytes(24).toString('hex');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      APP_ORIGIN: origin,
      NIHON_DB_PATH: database,
      NIHON_PASSWORD_HASH: hashPassword(password),
      SESSION_SECRET: randomBytes(32).toString('hex'),
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
child.stdout.on('data', (v) => (logs += v));
child.stderr.on('data', (v) => (logs += v));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try {
      if ((await fetch(origin + '/robots.txt')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  assert.equal((await fetch(origin + '/kanji/日', { redirect: 'manual' })).status, 307);
  assert.equal(
    (await fetch(origin + '/kanji/report', { method: 'POST', body: '{}', redirect: 'manual' }))
      .status,
    307,
  );
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
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/login');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mở góc học tập' }).click();
  await page.waitForURL(origin + '/');
  await page.goto(origin + '/kanji');
  await page.getByRole('searchbox', { name: 'Tìm kanji', exact: true }).fill('mat troi');
  await page.getByRole('button', { name: 'Tìm chữ' }).click();
  await page.waitForURL(/q=mat/);
  assert.equal(await page.locator('main article').count(), 1);
  await page.getByRole('link', { name: 'Xem chữ 日', exact: true }).click();
  await page.getByRole('heading', { name: 'Chữ 日', exact: true }).waitFor();
  assert.ok(await page.getByText('Tự chọn', { exact: true }).count());
  assert.ok(await page.getByText('Âm khác: niết', { exact: true }).count());
  assert.ok(await page.getByText(/synthetic-model/).count());
  await page.getByRole('button', { name: 'Về đầu', exact: true }).click();
  await page.getByText('0/4 nét', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Từng nét', exact: true }).click();
  await page.getByText('1/4 nét', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Phát lại', exact: true }).click();
  await page.getByText('4/4 nét', { exact: true }).waitFor();
  await page
    .getByLabel('Mẹo nhớ của riêng bạn', { exact: true })
    .fill('Mẹo nhớ kiểm thử Ộ Ữ'.normalize('NFD'));
  await page.getByRole('button', { name: 'Lưu mẹo nhớ' }).click();
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLTextAreaElement>('#kanji-memo')?.value === 'Mẹo nhớ kiểm thử Ộ Ữ',
  );
  await page.getByText('Báo sai âm Hán Việt', { exact: true }).click();
  await page.getByLabel('Điểm nào chưa đúng?', { exact: true }).first().fill('Báo cáo kiểm thử');
  await page.getByRole('button', { name: 'Gửi báo cáo', exact: true }).first().click();
  await page.getByText('Đã ghi nhận để kiểm tra lại bản dịch.', { exact: true }).waitFor();
  assert.equal(
    (
      await context.request.post(origin + '/kanji/report', {
        headers: { origin: 'https://untrusted.invalid' },
        data: { translationId: 'primary', reason: 'Wrong origin' },
      })
    ).status(),
    403,
  );
  const reports = 'data/reports';
  fs.mkdirSync(reports, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: reports + '/kanji-detail-desktop.png', fullPage: true });
  await page.goto(origin + '/kanji/学');
  await page.getByText('Chưa có dữ liệu nét viết cho chữ này.', { exact: false }).waitFor();
  assert.ok(
    await page
      .getByText('Chưa có âm Hán Việt chính trong dữ liệu hiện tại.', { exact: true })
      .count(),
  );
  assert.ok((await page.locator('a[href^="/vocab/"]').count()) > 0);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/kanji', '/kanji/日', '/kanji/学']) {
    await page.goto(origin + route);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      route,
    );
  }
  await page.goto(origin + '/kanji/日');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: reports + '/kanji-detail-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Thêm vào ôn', exact: true }).click();
  await page.getByRole('button', { name: 'Đã thêm ✓', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  const check = new DatabaseSync(database, { readOnly: true });
  assert.equal(check.prepare('SELECT count(*) n FROM translation_reports').get()!.n, 1);
  assert.equal(check.prepare('PRAGMA foreign_key_check').all().length, 0);
  check.close();
  const result = {
    status: 'PASS',
    checks: [
      'authenticated detail/report',
      'accent-insensitive search',
      'primary/alternative HV and model label',
      'stroke step/replay reduced-motion',
      'device memo NFC',
      'report persistence/CSRF',
      'missing-data states',
      'related links',
      '390px no overflow',
      'add to review',
    ],
    fixture: 'OpenJLPT sample plus isolated synthetic translations/strokes',
    screenshots: ['kanji-detail-desktop.png', 'kanji-detail-mobile.png'],
  };
  fs.writeFileSync(reports + '/kanji-feature-check.json', JSON.stringify(result, null, 2));
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
