import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { hashPassword } from '../../../core/session.ts';
import {updateProgress,readProgress} from '../today-roadmap/repository.ts';
import {localClock} from '../today-roadmap/model.ts';
import {practiceSessionKey} from './practice-store.ts';
import {SESSION_COOKIE} from '../../../core/session.ts';
import {youtubeFixture} from './youtube-fixture.ts';
import {seedPrivateClipFixture} from './private-fixture.ts';

const base = path.resolve(process.env.NIHON_BROWSER_FIXTURE_ROOT || '.tmp'); fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'shadowing-'));
const dbPath = path.join(directory, 'demo.sqlite'); seedDemo(dbPath);
const privateFixture=seedPrivateClipFixture(dbPath,directory);
const youtubeFile=path.join(directory,'youtube.json');fs.writeFileSync(youtubeFile,JSON.stringify(youtubeFixture));
const port = await new Promise<number>(resolve => {
  const server = createServer(); server.listen(0, '127.0.0.1', () => { const address = server.address(); assert.ok(address && typeof address !== 'string'); server.close(() => resolve(address.port)); });
});
const origin = `http://127.0.0.1:${port}`, password = randomBytes(24).toString('hex');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, APP_ORIGIN: origin, NIHON_DB_PATH: dbPath, NIHON_YOUTUBE_CLIP_PATH: youtubeFile, NIHON_DB_ROLE: 'snapshot', NIHON_PASSWORD_HASH: hashPassword(password), SESSION_SECRET: randomBytes(32).toString('hex'), NIHON_SETTINGS_PATH: path.join(directory, 'settings.json'), NIHON_ROADMAP_PATH: path.join(directory, 'roadmap.json'), NIHON_RECORDINGS_DIR: path.join(directory, 'recordings'), NIHON_BACKUP_DIR: path.join(directory, 'backups'), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
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
  assert.equal(partial.headers()['content-length'],'32');assert.equal(partial.headers()['transfer-encoding'],undefined);
  assert.equal(partial.status(), 206); assert.equal((await partial.body()).length, 32); assert.match(partial.headers()['content-range'], /^bytes 0-31\//);
  assert.equal((await context.request.get(origin + '/shadowing/media', { headers: { range: 'bytes=999999999-' } })).status(), 416); checks++;
  const page = await context.newPage(), errors: string[] = [], outside: string[] = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin) && !request.url().startsWith('blob:')) outside.push(request.url()); });
  await page.goto(origin + '/shadowing');
  await page.getByRole('heading', { name: 'Shadowing', exact: true }).waitFor();
  let embedReferer='';await page.route('https://www.youtube-nocookie.com/embed/**',route=>{embedReferer=route.request().headers()['referer'];return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic player</title>'});});
  await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:`window.YT={Player:function(element,options){let time=0,playing=false;const frame=element;const player={destroy(){frame.remove()},getCurrentTime(){if(playing)time+=.25;return time},pauseVideo(){playing=false;options.events.onStateChange({data:2})},playVideo(){playing=true;options.events.onStateChange({data:1})},seekTo(value){time=value},setPlaybackRate(){}};setTimeout(()=>options.events.onReady(),0);return player}};window.onYouTubeIframeAPIReady();`}));
  await page.getByRole('button',{name:/YouTube tổng hợp/}).click();
  await page.getByText('Original synthetic fixture · Original synthetic fixture',{exact:true}).waitFor();
  assert.equal(await page.locator('iframe[src*="youtube"]').count(),0);assert.equal(outside.length,0);
  assert.match(await page.getByLabel('Phụ đề mẫu',{exact:true}).innerText(),/あいう。/);checks++;
  const embedded=page.waitForResponse(r=>r.url().startsWith('https://www.youtube-nocookie.com/embed/'));await page.getByRole('button',{name:'Mở trình phát YouTube',exact:true}).click();await embedded;await page.getByText('Trình phát YouTube đã sẵn sàng. Chọn câu hoặc phát cả clip.',{exact:true}).waitFor();
  assert.equal(await page.locator('iframe').count(),1);assert.equal(await page.locator('iframe').getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');assert.equal(embedReferer,origin+'/');
  assert.equal(outside.length,2);assert.ok(outside.includes('https://www.youtube.com/iframe_api'));assert.ok(outside.some(url=>url.startsWith('https://www.youtube-nocookie.com/embed/testVideo01?')));outside.length=0;
  await page.getByRole('button',{name:'Nghe lại đoạn',exact:true}).click();await page.getByText(/Đã phát 1 lượt/).waitFor();assert.equal(await page.locator('[aria-current="true"][data-active="true"]').count(),0);checks++;
  await page.getByLabel('Kho clip').getByRole('button').first().click();
  await page.getByText('Bản thử tương tác · không phải tư liệu luyện nói', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('video')!.readyState >= 2);
  assert.ok(await page.locator('video').evaluate(media => (media as HTMLVideoElement).duration >= 8.9 && (media as HTMLVideoElement).duration <= 9.1)); checks++;
  const demoDuration=await page.locator('video').evaluate(media=>(media as HTMLVideoElement).duration);
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
  console.log('shadowing: synthetic private clip, kana, speaker and authenticated byte range');
  const clipUrl='/shadowing/media?clip='+encodeURIComponent(privateFixture.id);
  assert.equal((await fetch(origin+clipUrl,{redirect:'manual'})).status,307);
  const privateBytes=await context.request.get(origin+clipUrl,{headers:{range:'bytes=0-31'}});assert.equal(privateBytes.status(),206);assert.equal((await privateBytes.body()).length,32);assert.equal(privateBytes.headers()['content-length'],'32');assert.equal(privateBytes.headers()['transfer-encoding'],undefined);for(const range of ['bytes=0-1','bytes=0-']){const r=await context.request.get(origin+clipUrl,{headers:{range}});assert.equal(r.status(),206);assert.equal(Number(r.headers()['content-length']),(await r.body()).length);assert.match(r.headers()['content-range'],/^bytes 0-/);assert.equal(r.headers()['transfer-encoding'],undefined);}const full=await context.request.get(origin+clipUrl);assert.equal(full.status(),200);assert.equal(Number(full.headers()['content-length']),(await full.body()).length);assert.equal((await context.request.get(origin+clipUrl,{headers:{range:'bytes=999999999-'}})).status(),416);checks++;
  await page.getByRole('button',{name:/Clip riêng tổng hợp/}).click();
  await page.waitForFunction(()=>document.querySelector('video')!.readyState>=2);
  assert.equal(await page.getByLabel('Phụ đề',{exact:true}).inputValue(),'kana');assert.match(await page.getByLabel('Phụ đề mẫu',{exact:true}).innerText(),/先生.*あ。/s);checks++;
  const privateDuration=await page.locator('video').evaluate(m=>(m as HTMLVideoElement).duration);
  assert.ok(Math.abs(privateDuration-2*demoDuration)<0.001);assert.ok(privateDuration>=privateFixture.metadata.clip_end_ms/1000);
  await page.getByRole('button',{name:'Phát cả clip',exact:true}).click();
  await page.locator('video').evaluate(m=>{(m as HTMLVideoElement).currentTime=4.1;});
  await page.waitForFunction(()=>document.querySelector('video')!.currentTime>=10&&document.querySelector('video')!.currentTime<11);
  await page.locator('video').evaluate(m=>{(m as HTMLVideoElement).currentTime=17.8;});
  await page.waitForFunction(()=>document.querySelector('video')!.paused&&Math.abs(document.querySelector('video')!.currentTime-17.5)<0.05);
  await page.locator('video').evaluate(m=>{(m as HTMLVideoElement).currentTime=0;});await page.waitForFunction(()=>Math.abs(document.querySelector('video')!.currentTime-0.5)<0.05);checks++;
  await page.getByRole('button',{name:/Câu 2.*2.5–4.0s/}).click();await page.getByLabel('Tốc độ',{exact:true}).selectOption('1');await page.getByLabel('Lặp đoạn',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Nghe lại đoạn',exact:true}).click();
  await page.waitForFunction(()=>Boolean(document.querySelector('[aria-current="true"][data-active="true"]')));await page.getByText(/Đã phát 1 lượt/).waitFor();assert.ok(await page.locator('video').evaluate(m=>(m as HTMLVideoElement).paused));checks++;
  await page.getByLabel('Tốc độ',{exact:true}).selectOption('0.75');assert.equal(await page.locator('video').evaluate(m=>(m as HTMLVideoElement).playbackRate),0.75);
  for(const index of [0,1]){await page.getByRole('button',{name:new RegExp(`Câu ${index+1}.*${index?'2.5–4.0':'1.0–2.5'}s`)}).click();await page.getByRole('button',{name:`Ghi âm câu ${index+1}`,exact:true}).click();await page.getByRole('button',{name:'Dừng ghi âm',exact:true}).waitFor();await page.waitForTimeout(450);await page.getByRole('button',{name:'Dừng ghi âm',exact:true}).click();await page.getByRole('link',{name:'Tải bản ghi',exact:true}).waitFor();}
  await page.getByText(/Đã ghi 2\/6 câu/).waitFor();checks++;
  // React unmount while recording must release the actual microphone track.
  await page.getByRole('button', { name: 'Ghi âm câu 2' }).click(); await page.getByRole('button', { name: 'Dừng ghi âm' }).waitFor();
  await page.getByRole('link', { name: 'Hôm nay', exact: true }).first().click();
  await page.waitForURL(origin + '/today-roadmap');
  await page.waitForFunction(() => (window as typeof window & { shadowTracks: MediaStreamTrack[] }).shadowTracks.every(track => track.readyState === 'ended'));
  assert.ok(await page.evaluate(() => (window as typeof window & { shadowTracks: MediaStreamTrack[] }).shadowTracks.every(track => track.readyState === 'ended'))); checks++;
  // Original synthetic fixture + controllable Safari-like media, no private footage.
  await page.goto(origin+'/shadowing');await page.getByRole('button',{name:/Clip riêng tổng hợp/}).click();
  await page.locator('video').evaluate(media=>{const v=media as HTMLVideoElement;v.pause();const fake={time:16,pending:0,seeking:false,paused:true,writes:0,gesture:false};Object.defineProperties(v,{currentTime:{configurable:true,get:()=>fake.time,set:(n:number)=>{fake.writes++;if(fake.writes>15)throw Error('seek loop');fake.pending=n;fake.seeking=true;v.dispatchEvent(new Event('seeking'));v.dispatchEvent(new Event('timeupdate'));}},seeking:{configurable:true,get:()=>fake.seeking},paused:{configurable:true,get:()=>fake.paused}});v.play=()=>{fake.gesture=navigator.userActivation.isActive;fake.paused=false;v.dispatchEvent(new Event('play'));v.dispatchEvent(new Event('timeupdate'));return Promise.resolve();};v.pause=()=>{fake.paused=true;v.dispatchEvent(new Event('pause'));};Object.assign(window,{safariMedia:fake});});
  await page.getByRole('button',{name:'Phát cả clip',exact:true}).click();
  await page.evaluate(()=>{const f=(window as any).safariMedia,v=document.querySelector('video')!;if(!f.gesture||f.writes!==1)throw Error('play lost user gesture or sought during seeking');f.time=f.pending-.142;f.seeking=false;v.dispatchEvent(new Event('seeked'));for(let i=0;i<10;i++)v.dispatchEvent(new Event('timeupdate'));if(f.writes!==1||f.paused)throw Error('keyframe seek feedback loop');f.time=17.51;v.dispatchEvent(new Event('timeupdate'));if(!f.paused)throw Error('whole clip failed to stop');});checks++;
  await page.getByRole('button',{name:/Câu 1.*1.0–2.5s/}).click();
  await page.evaluate(()=>{const f=(window as any).safariMedia,v=document.querySelector('video')!;const writes=f.writes;v.dispatchEvent(new Event('loadedmetadata'));if(f.writes!==writes)throw Error('metadata overwrote pending sentence');f.time=f.pending-.142;f.seeking=false;v.dispatchEvent(new Event('seeked'));v.dispatchEvent(new Event('loadedmetadata'));if(f.writes!==writes)throw Error('metadata overwrote selected sentence');});
  await page.getByRole('button',{name:'Nghe lại đoạn',exact:true}).click();
  await page.evaluate(()=>{const f=(window as any).safariMedia,v=document.querySelector('video')!;f.time=16;for(let i=0;i<5;i++)v.dispatchEvent(new Event('timeupdate'));});await page.getByText(/Đã phát 0 lượt/).waitFor();
  await page.evaluate(()=>{const f=(window as any).safariMedia,v=document.querySelector('video')!;f.time=f.pending-.142;f.seeking=false;v.dispatchEvent(new Event('seeked'));f.time=1.2;v.dispatchEvent(new Event('timeupdate'));f.time=2.48;v.dispatchEvent(new Event('timeupdate'));});await page.getByText(/Đã phát 1 lượt/).waitFor();assert.equal(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused),true);checks++;
  fs.rmSync(youtubeFile);await page.goto(origin+'/shadowing');assert.equal(await page.getByRole('button',{name:/YouTube tổng hợp/}).count(),0);await page.getByRole('heading',{name:'Shadowing',exact:true}).waitFor();checks++;
  // Seed only synthetic metadata at14m59s; production has no accelerated-clock or bypass endpoint.
  const authCookie=(await context.cookies()).find(c=>c.name===SESSION_COOKIE)!;const practiceKey=practiceSessionKey(authCookie.value),date=localClock(new Date()).date,progressFile=path.join(directory,'roadmap.json');
  await page.goto(origin+'/today-roadmap');
  updateProgress(progressFile,p=>{p.shadow=p.shadow.filter(s=>s.date!==date);p.shadowSessions??={};p.shadowSessions[practiceKey+':'+date]={practiceMs:899000,lastAt:Date.now(),clients:{},recordings:{[privateFixture.id]:Object.fromEntries(privateFixture.metadata.segments.map(s=>[s.id,Math.ceil((s.end_ms-s.start_ms)*.7)]))}};return p;});
  const bodies:Record<string,unknown>[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/shadowing/progress'))bodies.push(r.postDataJSON());});
  const forbidden=await context.request.post(origin+'/shadowing/progress',{headers:{origin:'https://untrusted.invalid'},data:{client_id:randomBytes(18).toString('hex'),seq:0,active_ms:0}});assert.equal(forbidden.status(),403);
  const audioRejected=await context.request.post(origin+'/shadowing/progress',{headers:{origin},data:{client_id:'11111111-1111-4111-8111-111111111111',seq:0,active_ms:0,audio:'forbidden'}});assert.equal(audioRejected.status(),400);
  await page.goto(origin+'/shadowing');await page.getByRole('button',{name:/Clip riêng tổng hợp/}).click();await page.getByRole('button',{name:'Phát cả clip',exact:true}).click();await page.getByText('Đã ghi nhận buổi shadowing hôm nay.',{exact:true}).waitFor();
  const saved=readProgress(progressFile);assert.equal(saved.shadow.filter(s=>s.date===date).length,1);assert.equal(saved.shadow.find(s=>s.date===date)!.method,'automatic');assert.ok(bodies.length>0);for(const body of bodies)assert.ok(Object.keys(body).every(k=>['client_id','seq','active_ms','recording'].includes(k)));checks++;
  await page.reload();await page.getByRole('button',{name:/Clip riêng tổng hợp/}).click();await page.getByText('Đã ghi nhận buổi shadowing hôm nay.',{exact:true}).waitFor();assert.equal(readProgress(progressFile).shadow.filter(s=>s.date===date).length,1);
  const other=await browser.newContext();await other.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0});const separate=await other.request.get(origin+'/shadowing/progress');assert.equal((await separate.json()).practiceMs,0);await other.close();
  await page.goto(origin+'/today-roadmap');const count=new Set(saved.shadow.filter(s=>s.kind==='regular').map(s=>s.date)).size;await page.getByText('Shadowing tuần này · '+count+'/2',{exact:true}).waitFor();checks++;
  assert.deepEqual(errors, []); assert.deepEqual(outside, []); checks++;
  const result = { status: 'PASS', passed: checks, total: checks, media: 'public synthetic canvas + tones only; six private-fixture kana/speakers, no Erin in CI', microphone: 'native MediaRecorder with Chrome fake device; real hardware not verified', noExternalRequests: true };
  fs.writeFileSync('data/reports/shadowing-check.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  await browser?.close(); child.kill();
  await new Promise<void>(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', () => resolve()); });
  assert.equal(path.dirname(directory), base); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

