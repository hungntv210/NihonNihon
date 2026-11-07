import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { hashPassword, SESSION_COOKIE } from '../../../core/session.ts';

// Run after the production build; all additional content is synthetic test data.
const base = path.resolve('.tmp');
fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'common-browser-')),
  file = path.join(directory, 'app.sqlite');
seedDemo(file);
const db = new DatabaseSync(file),
  word = db
    .prepare("SELECT i.* FROM content_items i JOIN vocab v USING(item_id) WHERE v.word='学生'")
    .get()!,
  itemId = String(word.item_id);
const sentence = db
  .prepare(
    "SELECT s.*,i.source_hash FROM sentences s JOIN content_items i USING(item_id) WHERE s.text_ja='私は学生です。'",
  )
  .get()!;
db.prepare(
  "INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,0,'openjlpt',?)",
).run(itemId, sentence.item_id, word.release_id);
db.prepare(
  "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:synthetic','Synthetic test provider','https://example.invalid','Synthetic test only','Synthetic test','private_only')",
).run();
db.prepare(
  "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('synthetic-release','mt:synthetic','1',?,'local://synthetic','2026-11-06','Synthetic test only','Synthetic test',?)",
).run('b'.repeat(64), JSON.stringify({ model: 'gemini-synthetic', prompt_version: 'test-only' }));
const insert = db.prepare(
  "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES(?,?,?,?,'machine','mt:synthetic','synthetic-release','test',?,'selected','machine_context','2026-11-06')",
);
insert.run('test-word', itemId, 'meaning', 'Sinh viên', word.source_hash);
insert.run('test-example', sentence.item_id, 'text', 'Tôi là sinh viên.', sentence.source_hash);
db.close();
const port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const selected = address.port;
      server.close(() => resolve(selected));
    });
  }),
  origin = `http://127.0.0.1:${port}`,
  password = randomBytes(24).toString('base64url');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      APP_ORIGIN: origin,
      NIHON_DB_PATH: file,
      NIHON_PASSWORD_HASH: hashPassword(password),
      SESSION_SECRET: randomBytes(32).toString('hex'),
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let output = '';
child.stdout.on('data', (b) => (output += b));
child.stderr.on('data', (b) => (output += b));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready=false;
  for(let n=0;n<150;n++) {
    if(child.exitCode!==null)throw Error(output);
    try { if((await fetch(origin+'/robots.txt')).ok){ready=true;break;} }catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  assert.ok(ready);
  const login=await fetch(origin+'/api/session',{method:'POST',headers:{origin},body:new URLSearchParams({password}),redirect:'manual'});
  assert.equal(login.status,303);
  const cookie=login.headers.get('set-cookie')!.split(';')[0],cookieValue=cookie.slice(cookie.indexOf('=')+1);
  for(const route of ['','/search','/reports','/progress','/settings'])assert.equal((await fetch(origin+'/common-tools'+route,{redirect:'manual'})).status,307);
  const chrome=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
  browser=await chromium.launch({headless:true,...(chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:SESSION_COOKIE,value:cookieValue,url:origin}]);
  const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  const reports=path.resolve('data/reports');fs.mkdirSync(reports,{recursive:true});
  await page.goto(origin+'/common-tools/search');
  await page.getByLabel('Nội dung cần tìm').fill('sinh vien');
  await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
  await page.waitForURL(/q=/);
  assert.equal(await page.locator('article.content-card').count(),1);
  assert.ok(await page.getByText(/gemini-synthetic/).count());
  await page.getByRole('button',{name:'Thêm vào ôn',exact:true}).click();
  await page.getByRole('button',{name:'Đã thêm ✓',exact:true}).waitFor();
  await page.getByRole('link',{name:'学生',exact:true}).click();
  await page.waitForURL(origin+'/vocab/'+encodeURIComponent(itemId));
  await page.getByRole('button',{name:'Báo sai',exact:true}).first().click();
  await page.getByLabel('Điểm cần sửa').fill('Báo sai kiểm thử công cụ chung');
  await page.getByRole('button',{name:'Gửi báo sai'}).click();
  await page.getByText('Đã ghi nhận báo sai. Bản dịch hiện tại được giữ để đối chiếu.',{exact:true}).waitFor();
  await page.goto(origin+'/common-tools/reports');
  assert.ok(await page.getByText('Báo sai kiểm thử công cụ chung',{exact:true}).count());
  assert.ok(await page.getByText(/gemini-synthetic/).count());
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    for(const route of ['','/search?q=sinh+vien','/reports','/progress','/settings']) {
      await page.goto(origin+'/common-tools'+route);
      await page.locator('main h1').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' '+width);
      await page.screenshot({path:path.join(reports,'common-'+(route.split('?')[0].slice(1)||'hub')+'-'+width+'.png'),fullPage:true});
    }
  }
  assert.deepEqual(errors,[]);
  const result={status:'PASS',widths:[1440,390],checks:['all routes require login','accent-free selected MT search','actual model provenance','enqueue card','canonical detail link','report persisted through owner route and visible in queue','all five pages no horizontal overflow'],errors};
  fs.writeFileSync(path.join(reports,'common-tools-browser-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {
  await browser?.close();child.kill();
  await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});
  assert.equal(path.dirname(directory),base);fs.rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
