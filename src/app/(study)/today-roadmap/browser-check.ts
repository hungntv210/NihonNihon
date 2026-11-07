import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { hashPassword } from '../../../core/session.ts';
const reports=path.resolve('data/reports/today-roadmap');fs.mkdirSync(reports,{recursive:true});
const directory=fs.mkdtempSync(path.join(reports,'browser-')),dbPath=path.join(directory,'demo.sqlite');seedDemo(dbPath);
const port=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p));});});
const origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:origin,NIHON_DB_PATH:dbPath,NIHON_ROADMAP_PATH:'',NIHON_SETTINGS_PATH:'',NIHON_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:randomBytes(32).toString('hex'),NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
fs.writeFileSync(path.join(directory,'settings.json'),JSON.stringify({eveningTime:'23:59'}));
let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try {
 let ready=false;for(let i=0;i<150;i++){try {if((await fetch(origin+'/robots.txt')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,log);
 assert.equal((await fetch(origin+'/today-roadmap',{redirect:'manual'})).status,307);
 const chrome=process.env.CHROME_PATH ?? (process.platform==='win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '');
 browser=await chromium.launch({headless:true,...(chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{})});const context=await browser.newContext();
 const login=await context.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0});assert.equal(login.status(),303);
 const rejected=await context.request.post(origin+'/today-roadmap/progress',{headers:{origin:'https://untrusted.invalid'},data:{action:'done'}});assert.equal(rejected.status(),403);
 const invalid=await context.request.post(origin+'/today-roadmap/progress',{headers:{origin},data:{action:'shadow',confirmed:true,kind:'makeup',minutes:24,clips:['a','b']}});assert.equal(invalid.status(),400);
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:950});await page.goto(origin+'/today-roadmap');await page.getByRole('heading',{name:'Ôn nhanh',exact:true}).waitFor();
 assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth),false,`overflow at ${width}`);
 assert.equal(await page.locator('summary').count(),87);
 await page.screenshot({path:path.join(directory,`${width}.png`),fullPage:false});
 }
 assert.equal(await page.getByRole('button',{name:'Bắt đầu →',exact:true}).count(),0);
 fs.writeFileSync(path.join(directory,'settings.json'),JSON.stringify({eveningTime:'00:00'}));await page.reload();await page.getByRole('heading',{name:'Buổi tối, dành chút thời gian cho mình.'}).waitFor();
 await page.screenshot({path:path.join(directory,'evening-mobile.png'),fullPage:false});
 await page.locator('section[aria-labelledby="evening-title"]').screenshot({path:path.join(directory,'evening-tasks-mobile.png')});
 await page.locator('#shadow').screenshot({path:path.join(directory,'shadow-mobile.png')});
 await page.getByRole('button',{name:'Tối nay chỉ có 20 phút'}).click();await page.getByRole('button',{name:'Đã chọn tối 20 phút'}).waitFor();
 await page.getByLabel('Số phút đã luyện').fill('25');await page.getByLabel('Clip 1').fill('Synthetic browser check clip');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Ghi nhận buổi đã luyện'}).click();await page.getByText('Shadowing tuần này · 1/2').waitFor();
 await page.reload();await page.getByText('Shadowing tuần này · 1/2').waitFor();
 const duplicate=await context.request.post(origin+'/today-roadmap/progress',{headers:{origin},data:{action:'shadow',confirmed:true,kind:'regular',minutes:25,clips:['Synthetic browser check clip']}});assert.equal(duplicate.status(),400);
 assert.equal(fs.existsSync(path.join(directory,'private','today-roadmap.json')),true);assert.deepEqual(errors,[]);console.log(`Today browser checks passed: desktop/mobile, 87 weeks, 20-minute plan, manual shadow persistence, invalid makeup, CSRF, duplicate. Artifacts ${directory}`);
} finally {await browser?.close();child.kill();fs.writeFileSync(path.join(directory,'server.log'),log);}



