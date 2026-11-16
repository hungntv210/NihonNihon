import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {chromium,type Page} from 'playwright';
import {hashPassword} from '../../../core/session.ts';
import {fixtureCatalog,fixtureBank} from '../jlpt-daily/fixture.ts';
import {publishBank} from '../jlpt-daily/repository.ts';

const artifacts=path.resolve('data/private/wasoku-phase3');fs.mkdirSync(artifacts,{recursive:true});
const base=path.resolve('.tmp');fs.mkdirSync(base,{recursive:true});
const fixture=fs.mkdtempSync(path.join(process.env.NIHON_BROWSER_FIXTURE_ROOT||base,'appearance-'));
const chrome=process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'');
const browser=await chromium.launch({headless:true,...(chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{})});
const results:unknown[]=[];
async function appearance(page:Page,label:string){
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.documentElement.getAnimations().every(a=>a.playState!=='running'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow');
 await page.evaluate(()=>document.fonts.load('24px VT323','ỘỆỜỮỸĐ'));
 assert.ok(await page.evaluate(()=>document.fonts.check('24px VT323','ỘỆỜỮỸĐ')));
 const violations=await page.evaluate<string[]>(String.raw`(()=>{
  const rgba=(s)=>{const n=s.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [n[0],n[1],n[2],n[3]??1]};
  const luminance=(c)=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
  const failures=[];
  for(const el of Array.from(document.querySelectorAll('body *'))){
   const control=el.matches('input:not([type=checkbox],[type=radio],[type=file]),textarea,select');
   if(el.closest('svg,script,style,canvas')||(!control&&!Array.from(el.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()))||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
   const color=rgba(getComputedStyle(el).color);let current=el,bg;
   while(current){const value=rgba(getComputedStyle(current).backgroundColor);if(value[3]>=.99){bg=value;break}current=current.parentElement}
   if(!bg)continue;const ratio=(fg)=>{const [a,b]=[luminance(fg),luminance(bg)].sort((x,y)=>y-x);return (a+.05)/(b+.05)};
   if(ratio(color)<4.5)failures.push(el.tagName+'.'+el.className+' '+(el.textContent||'').trim().slice(0,50)+' '+ratio(color).toFixed(2));
   if(control&&el.getAttribute('placeholder')){const color=rgba(getComputedStyle(el,'::placeholder').color);if(ratio(color)<4.5)failures.push('placeholder '+el.getAttribute('placeholder')+' '+ratio(color).toFixed(2))}
  }return failures;
 })()`);
 assert.deepEqual(violations,[],label+' contrast');
}
try{
 for(const [period,iso]of [['morning','2026-11-15T00:30:00Z'],['day','2026-11-15T06:30:00Z'],['sunset','2026-11-15T10:45:00Z'],['night','2026-11-15T13:30:00Z']]){
  const folder=path.join(fixture,period);fs.mkdirSync(folder);const db=path.join(folder,'demo.sqlite'),catalog=fixtureCatalog(db),store=path.join(folder,'jlpt');
  publishBank(await fixtureBank(catalog,'2026-11-09'),store);
  // Existing synthetic plumbing fixtures only; no production data or AI requests.
  fs.writeFileSync(path.join(folder,'today.json'),JSON.stringify({version:1,shadow:[{date:'2026-11-15',kind:'makeup',minutes:25,clips:['fixture-1','fixture-2'],method:'manual'}],activity:[],activeTask:null,shortDays:[]}));
  const connection=new DatabaseSync(db);
  connection.exec("UPDATE srs_cards SET due_at='2026-11-14T00:00:00.000Z',updated_at='2026-11-14T00:00:00.000Z'");
  const word=String(connection.prepare('SELECT item_id FROM vocab ORDER BY item_id LIMIT 1').get()!.item_id),kanji=String(connection.prepare('SELECT character FROM kanji ORDER BY character LIMIT 1').get()!.character),grammar=String(connection.prepare('SELECT item_id FROM grammar ORDER BY item_id LIMIT 1').get()!.item_id);connection.close();
  const port=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const n=(s.address() as {port:number}).port;s.close(()=>resolve(n))})});
  const origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex');
  const child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('tools/ui-test-clock.mjs')).href,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',NIHON_UI_CLOCK_FIXTURE:iso,NIHON_DB_PATH:db,NIHON_DB_ROLE:'snapshot',NIHON_SETTINGS_PATH:path.join(folder,'settings.json'),NIHON_ROADMAP_PATH:path.join(folder,'today.json'),NIHON_JLPT_PATH:store,NIHON_BACKUP_DIR:path.join(folder,'backups'),NIHON_RECORDINGS_DIR:path.join(folder,'recordings'),APP_ORIGIN:origin,NIHON_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:randomBytes(32).toString('hex'),GEMINI_API_KEY:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const context=await browser.newContext(),page=await context.newPage(),errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url())});
  try{
   let ready=false;for(let n=0;n<150;n++){try{if((await fetch(origin+'/robots.txt')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}assert.ok(ready,log);
   for(const width of [390,1440]){await page.setViewportSize({width,height:1050});await page.goto(origin+'/login');await page.getByRole('heading',{name:'Đăng nhập',exact:true}).waitFor();await appearance(page,`${period}/${width}/login`);await page.screenshot({path:path.join(artifacts,`${period}-${width}-login.png`)});}
   assert.equal((await context.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0})).status(),303);
   const first=await context.request.get(origin+'/today-roadmap');assert.ok((await first.text()).includes(`data-time="${period}"`),'theme must be in server HTML before hydration');
   const routes=['/today-roadmap','/','/srs?mode=quick','/shadowing','/vocab','/kanji','/grammar','/jlpt-daily','/settings','/sources','/common-tools','/common-tools/search?q=学','/common-tools/reports','/common-tools/progress','/vocab/lesson','/vocab/'+encodeURIComponent(word),'/kanji/'+encodeURIComponent(kanji),'/grammar/'+encodeURIComponent(grammar)];
   for(const width of [390,1440])for(const [index,route]of routes.entries()){
    await page.setViewportSize({width,height:1050});const response=await page.goto(origin+route);assert.equal(response?.status(),200,route);await page.locator('main h1').waitFor();
    assert.equal(await page.locator('main h1').count(),1,route+' functional h1');assert.equal(await page.locator('html').getAttribute('data-time'),period);
    await appearance(page,`${period}/${width}/${route}`);
    if(route==='/'||route==='/today-roadmap'){await page.locator('[data-pixel-viewport][data-ready=true]').waitFor();assert.equal(await page.locator('[data-pixel-scene]').getAttribute('data-pixel-scene'),route==='/'?'home-tokyo':'roadmap-journey');}
    if(route==='/today-roadmap'){
     const map=page.getByLabel('Bản đồ lộ trình 87 tuần');assert.equal(await map.getByRole('button').count(),87);
     assert.equal(await page.locator('summary').count(),87);await map.getByRole('button',{name:/Tuần 36 ·/}).click();assert.equal(await page.locator('#week-36').getAttribute('open'),'');
     await page.screenshot({path:path.join(artifacts,`${period}-${width}-roadmap.png`)});await page.evaluate(()=>scrollTo(0,0));
    }
    if(route==='/jlpt-daily'){await page.getByRole('radio').first().check();await appearance(page,`${period}/${width}/jlpt-selected`);}
    if(width===390&&route==='/today-roadmap'){await page.getByRole('button',{name:'Tất cả',exact:true}).click();for(const label of ['Từ vựng','Ngữ pháp','Tiến độ','Cài đặt'])assert.ok(await page.getByRole('dialog').getByRole('link',{name:label,exact:true}).isVisible());await page.getByRole('button',{name:'Đóng',exact:true}).click()}
    const name=index===0?'':route==='/'?'-home':route.startsWith('/srs')?'-srs':route==='/shadowing'?'-shadowing':'-route'+index;
    await page.screenshot({path:path.join(artifacts,`${period}-${width}${name}.png`)});results.push({period,width,route,contrast:true,overflow:false});
   }
   await page.goto(origin+'/srs?mode=quick');for(let n=0;n<15;n++){await page.getByRole('button',{name:'Hiện đáp án',exact:true}).click();await page.getByRole('button',{name:/^Được/}).click()}
   await page.getByRole('heading',{name:'Xong một phiên nhỏ.',exact:true}).waitFor();await page.getByText(/0 lượt chờ đồng bộ/).waitFor();
   await page.goto(origin+'/settings');await page.getByLabel('Chuyển động',{exact:false}).uncheck();await page.getByRole('button',{name:'Lưu cài đặt',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu cài đặt.'}).waitFor();
   await page.goto(origin+'/today-roadmap');assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
   await page.locator('[data-pixel-viewport][data-ready=true]').waitFor();assert.equal(await page.locator('[data-pixel-viewport]').evaluate(el=>(el as HTMLElement & {pixelEngine:{raf:number}}).pixelEngine.raf),0);
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('[data-pixel-viewport]').evaluate(el=>(el as HTMLElement & {pixelEngine:{raf:number}}).pixelEngine.raf),0);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  }finally{await context.close();child.kill();fs.writeFileSync(path.join(artifacts,`${period}-server.log`),log)}
 }
 fs.writeFileSync(path.join(artifacts,'checks.json'),JSON.stringify(results,null,2));console.log('Appearance: server period, 4 themes x 2 widths x 19 screens, text/control contrast, no overflow/external requests, roadmap, 15-card SRS, all-menu, local fonts and reduced motion PASS. '+artifacts);
}finally{await browser.close()}
