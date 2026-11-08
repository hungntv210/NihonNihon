import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { hashPassword } from '../../../core/session.ts';

const base = path.resolve('.tmp'); fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'shadowing-'));
const dbPath = path.join(directory, 'demo.sqlite'); seedDemo(dbPath);
const port = await new Promise<number>(resolve => {
  const server = createServer(); server.listen(0, '127.0.0.1', () => { const address = server.address(); assert.ok(address && typeof address !== 'string'); server.close(() => resolve(address.port)); });
});
const origin = `http://127.0.0.1:${port}`, password = randomBytes(24).toString('hex');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, APP_ORIGIN: origin, NIHON_DB_PATH: dbPath, NIHON_DB_ROLE: 'snapshot', NIHON_PASSWORD_HASH: hashPassword(password), SESSION_SECRET: randomBytes(32).toString('hex'), NIHON_SETTINGS_PATH: path.join(directory, 'settings.json'), NIHON_ROADMAP_PATH: path.join(directory, 'roadmap.json'), NIHON_RECORDINGS_DIR: path.join(directory, 'recordings'), NIHON_BACKUP_DIR: path.join(directory, 'backups'), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let log = ''; child.stdout.on('data', data => log += data); child.stderr.on('data', data => log += data);
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let checks = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(origin + '/robots.txt')).ok) { ready = true; break; } } catch { /* server booting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, log);
  console.log('shadowing: server ready; auth and media ranges');
  for (const route of ['/shadowing', '/shadowing/media']) assert.equal((await fetch(origin + route, { redirect: 'manual' })).status, 307);
  checks++;
  browser = await chromium.launch({ headless: true, ...(chrome && fs.existsSync(chrome) ? { executablePath: chrome } : { channel: 'chromium' }), args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  await context.addInitScript('globalThis.__name = (value) => value');
  const login = await context.request.post(origin + '/api/session', { headers: { origin }, form: { password }, maxRedirects: 0 });
  assert.equal(login.status(), 303);
  const partial = await context.request.get(origin + '/shadowing/media', { headers: { range: 'bytes=0-31' } });
  assert.equal(partial.status(), 206); assert.equal((await partial.body()).length, 32); assert.match(partial.headers()['content-range'], /^bytes 0-31\//);
  assert.equal((await context.request.get(origin + '/shadowing/media', { headers: { range: 'bytes=999999999-' } })).status(), 416); checks++;
  const page = await context.newPage(), errors: string[] = [], outside: string[] = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin) && !request.url().startsWith('blob:')) outside.push(request.url()); });
  await page.goto(origin + '/shadowing');
  await page.getByRole('heading', { name: 'Shadowing', exact: true }).waitFor();
  await page.getByText('Bản thử tương tác · không phải tư liệu luyện nói', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('video')!.readyState >= 2);
  assert.ok(await page.locator('video').evaluate(media => (media as HTMLVideoElement).duration >= 8.9 && (media as HTMLVideoElement).duration <= 9.1)); checks++;
  console.log('shadowing: native clip playback and loops');
  await page.getByLabel('Tốc độ', { exact: true }).selectOption('1.25');
  await page.getByRole('button', { name: 'Phát cả clip', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0.3);
  assert.equal(await page.locator('video').evaluate(media => (media as HTMLVideoElement).playbackRate), 1.25);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  assert.ok(await page.locator('video').evaluate(media => (media as HTMLVideoElement).paused)); checks++;
  await page.getByRole('button', { name: /Câu 2.*3.0–6.0s/ }).click();
  await page.getByLabel('Lặp đoạn', { exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Nghe lại đoạn', exact: true }).click();
  await page.getByText(/Đã phát 3 lượt/).waitFor({ timeout: 20000 });
  assert.ok(await page.locator('video').evaluate(media => { const video = media as HTMLVideoElement; return video.paused && video.currentTime >= 5.9 && video.currentTime < 6.5; })); checks++;
  await page.getByLabel('Lặp đoạn', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Nghe lại đoạn', exact: true }).click();
  await page.getByText(/Đã phát 1 lượt/).waitFor();
  assert.ok(await page.locator('video').evaluate(media => !(media as HTMLVideoElement).paused));
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click(); checks++;
  await page.getByLabel('Phụ đề', { exact: true }).selectOption('ja');
  assert.equal(await page.getByLabel('Phụ đề mẫu', { exact: true }).locator('[lang=vi]').count(), 0);
  await page.getByLabel('Phụ đề', { exact: true }).selectOption('vi');
  assert.equal(await page.getByLabel('Phụ đề mẫu', { exact: true }).locator('[lang=ja]').count(), 0);
  await page.getByLabel('Phụ đề', { exact: true }).selectOption('off');
  await page.getByText('Đã ẩn phụ đề', { exact: true }).waitFor(); checks++;
  console.log('shadowing: native microphone, replay, download, cleanup');
  // Inspect actual native tracks and blob revocations rather than mocking MediaRecorder.
  await page.evaluate(() => {
    const state = window as typeof window & { shadowTracks: MediaStreamTrack[]; shadowRevoked: string[] };
    state.shadowTracks = []; state.shadowRevoked = [];
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { try { const stream = await get(constraints); state.shadowTracks.push(...stream.getTracks()); return stream; } catch(error) { (state as typeof state & { shadowMediaError:string }).shadowMediaError=String(error);throw error; } };
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { state.shadowRevoked.push(url); revoke(url); };
  });
  await page.getByRole('button', { name: 'Ghi âm câu 2', exact: true }).click();
  try { await page.getByRole('button', { name: 'Dừng ghi âm', exact: true }).waitFor(); }
  catch(error) { console.error('Native microphone diagnostics:',await page.evaluate(()=>({status:[...document.querySelectorAll('[role=status]')].map(x=>x.textContent),captureError:(window as typeof window & {shadowMediaError?:string}).shadowMediaError,recorder:typeof MediaRecorder,formats:['audio/webm;codecs=opus','audio/mp4','audio/webm'].map(type=>({type,supported:typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(type)}))})));throw error; }
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Dừng ghi âm', exact: true }).click();
  await page.getByRole('link', { name: 'Tải bản ghi', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => (window as typeof window & { shadowTracks: MediaStreamTrack[] }).shadowTracks.every(track => track.readyState === 'ended')));
  const audio = page.getByLabel('Nghe lại giọng của bạn', { exact: true });
  await audio.evaluate(async media => { await (media as HTMLAudioElement).play(); });
  await page.waitForFunction(() => document.querySelector('audio')!.currentTime > 0.1);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: 'Tải bản ghi' }).click(); const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^shadowing-demo-cau-2\.(webm|m4a)$/); checks++;
  await page.getByRole('button', { name: 'Ghi âm câu 2', exact: true }).click(); await page.getByRole('button', { name: 'Dừng ghi âm' }).waitFor(); await page.waitForTimeout(500); await page.getByRole('button', { name: 'Dừng ghi âm' }).click();
  await page.getByRole('link', { name: 'Tải bản ghi' }).waitFor();
  assert.equal(await page.evaluate(() => (window as typeof window & { shadowRevoked: string[] }).shadowRevoked.length), 1);
  await page.getByRole('button', { name: 'Xóa bản ghi', exact: true }).click();
  assert.equal(await page.evaluate(() => (window as typeof window & { shadowRevoked: string[] }).shadowRevoked.length), 2); checks++;
  const cdp = await context.newCDPSession(page);
  const { targetInfo: { browserContextId } } = await cdp.send('Target.getTargetInfo');
  await cdp.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin, browserContextId });
  await page.getByRole('button', { name: 'Ghi âm câu 2', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Chưa có quyền micro' }).waitFor(); checks++;
  await cdp.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin, browserContextId });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  fs.mkdirSync('data/reports', { recursive: true }); await page.screenshot({ path: 'data/reports/shadowing-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 }); await page.screenshot({ path: 'data/reports/shadowing-desktop.png', fullPage: true }); checks++;
  // React unmount while recording must release the actual microphone track.
  await page.getByRole('button', { name: 'Ghi âm câu 2' }).click(); await page.getByRole('button', { name: 'Dừng ghi âm' }).waitFor();
  await page.getByRole('link', { name: 'Hôm nay', exact: true }).first().click();
  await page.waitForURL(origin + '/today-roadmap');
  await page.waitForFunction(() => (window as typeof window & { shadowTracks: MediaStreamTrack[] }).shadowTracks.every(track => track.readyState === 'ended'));
  assert.ok(await page.evaluate(() => (window as typeof window & { shadowTracks: MediaStreamTrack[] }).shadowTracks.every(track => track.readyState === 'ended'))); checks++;
  assert.deepEqual(errors, []); assert.deepEqual(outside, []); checks++;
  const result = { status: 'PASS', passed: checks, total: checks, media: 'public synthetic canvas + tones only', microphone: 'native MediaRecorder with Chrome fake device; real hardware not verified', noExternalRequests: true };
  fs.writeFileSync('data/reports/shadowing-check.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  await browser?.close(); child.kill();
  await new Promise<void>(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', () => resolve()); });
  assert.equal(path.dirname(directory), base); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
