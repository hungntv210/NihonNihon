import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {seedDemo} from '../../../../tools/seed-demo.ts';
import {hashPassword} from '../../../core/session.ts';

const artifacts=path.resolve('data/private/wasoku-phase1');fs.mkdirSync(artifacts,{recursive:true});
const base=path.resolve('.tmp');fs.mkdirSync(base,{recursive:true});
const fixture=fs.mkdtempSync(path.join(process.env.NIHON_BROWSER_FIXTURE_ROOT||base,'appearance-'));
const chrome=process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'');
const browser=await chromium.launch({headless:true,...(chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{})});
const results:unknown[]=[];
try{
 for(const [period,iso]of [['morning','2026-11-15T00:30:00Z'],['day','2026-11-15T06:30:00Z'],['sunset','2026-11-15T10:45:00Z'],['night','2026-11-15T13:30:00Z']]){
  const folder=path.join(fixture,period);fs.mkdirSync(folder);const db=path.join(folder,'demo.sqlite');seedDemo(db);
  const port=await new Promise<number>(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const n=(server.address() as {port:number}).port;server.close(()=>resolve(n))})});
  const origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex');
  const child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('tools/ui-test-clock.mjs')).href,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',NIHON_UI_CLOCK_FIXTURE:iso,NIHON_DB_PATH:db,NIHON_DB_ROLE:'snapshot',NIHON_SETTINGS_PATH:path.join(folder,'settings.json'),NIHON_ROADMAP_PATH:path.join(folder,'today.json'),NIHON_BACKUP_DIR:path.join(folder,'backups'),NIHON_RECORDINGS_DIR:path.join(folder,'recordings'),APP_ORIGIN:origin,NIHON_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:randomBytes(32).toString('hex'),NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const context=await browser.newContext(),page=await context.newPage(),errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:'))external.push(r.url())});
  try{
   let ready=false;for(let n=0;n<150;n++){try{if((await fetch(origin+'/robots.txt')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}assert.ok(ready,log);
   assert.equal((await context.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0})).status(),303);
   const first=await context.request.get(origin+'/today-roadmap'),initialHTML=await first.text();assert.ok(initialHTML.includes(`data-time="${period}"`),`theme must be in server HTML before hydration: ${first.status()} ${initialHTML.match(/<html[^>]*>/)?.[0]}`);
   for(const width of [390,1440]){
    await page.setViewportSize({width,height:1050});await page.goto(origin+'/today-roadmap');await page.getByRole('heading',{name:'Ôn nhanh',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.documentElement.getAnimations().every(a=>a.playState!=='running'));
    assert.equal(await page.locator('html').getAttribute('data-time'),period);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${period}/${width} overflow`);
    assert.ok(await page.evaluate(()=>document.fonts.check('24px VT323','ỘỆỜỮỸĐ')));
    assert.ok(await page.locator('.town-art svg').getAttribute('preserveAspectRatio')==='xMidYMid slice');
    const violations=await page.evaluate<string[]>(String.raw`(()=>{
     const rgba=(s)=>{const n=s.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [n[0],n[1],n[2],n[3]??1]};
     const luminance=(c)=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
     const failures=[];
     for(const el of Array.from(document.querySelectorAll('body *'))){if(el.closest('svg,script,style,canvas')||!Array.from(el.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
      const color=rgba(getComputedStyle(el).color);let current=el,bg;
      while(current){const value=rgba(getComputedStyle(current).backgroundColor);if(value[3]>=.99){bg=value;break}current=current.parentElement}
      if(!bg)continue;const [a,b]=[luminance(color),luminance(bg)].sort((x,y)=>y-x),ratio=(a+.05)/(b+.05);if(ratio<4.5)failures.push(el.tagName+'.'+el.className+' '+el.textContent?.trim().slice(0,65)+' '+ratio.toFixed(2)+' fg='+color.join(',')+' bg='+bg.join(','));
     }return failures;
    })()`);
    assert.deepEqual(violations,[],`contrast ${period}/${width}`);
    if(width===390){await page.getByRole('button',{name:'Tất cả',exact:true}).click();for(const label of ['Từ vựng','Ngữ pháp','Tiến độ','Cài đặt'])assert.ok(await page.getByRole('dialog').getByRole('link',{name:label,exact:true}).isVisible());await page.getByRole('button',{name:'Đóng',exact:true}).click()}
    await page.screenshot({path:path.join(artifacts,`${period}-${width}.png`),fullPage:false});results.push({period,width,contrast:true,overflow:false});
   }
   await page.goto(origin+'/settings');await page.getByLabel('Chuyển động',{exact:false}).uncheck();await page.getByRole('button',{name:'Lưu cài đặt',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu cài đặt.'}).waitFor();
   await page.goto(origin+'/today-roadmap');assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
   assert.equal(await page.locator('.cloud-bank').evaluate(el=>getComputedStyle(el).animationName),'none');
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.town-train').evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  }finally{await context.close();child.kill();fs.writeFileSync(path.join(artifacts,`${period}-server.log`),log)}
 }
 fs.writeFileSync(path.join(artifacts,'checks.json'),JSON.stringify(results,null,2));console.log('Appearance: server period, 4 themes × 2 widths, contrast, no overflow, Japanese scene, all-menu, persisted/reduced motion PASS. '+artifacts);
}finally{await browser.close()}
