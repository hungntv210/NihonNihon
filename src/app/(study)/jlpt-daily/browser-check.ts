import {approvedFixture} from './approved-fixture.ts';import {importApproved,approvedBank} from './approved-store.ts';import {plusDays} from './model.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { hashPassword } from '../../../core/session.ts';
import { localClock,weekStart } from '../today-roadmap/model.ts';
import { fixtureCatalog,fixtureBank } from './fixture.ts';
import { publishBank,readState } from './repository.ts';

const reports=path.resolve('data/reports/jlpt-daily');fs.mkdirSync(reports,{recursive:true});
const base=path.resolve(process.env.NIHON_BROWSER_FIXTURE_ROOT||'.tmp');fs.mkdirSync(base,{recursive:true});
const directory=fs.mkdtempSync(path.join(base,'jlpt-browser-')),dbFile=path.join(directory,'demo.sqlite'),store=path.join(directory,'jlpt');
const catalog=fixtureCatalog(dbFile),instant='2026-11-16T13:00:00Z',date=localClock(new Date(instant)).date,week=weekStart(date);
const fixtureDb=new DatabaseSync(dbFile);fixtureDb.exec("UPDATE srs_cards SET due_at='2027-01-01T00:00:00Z'; UPDATE srs_reviews SET reviewed_at='2026-11-15T13:00:00Z'");fixtureDb.close();
fs.writeFileSync(path.join(directory,'settings.json'),JSON.stringify({startDate:week,eveningTime:'00:00'}));
const port=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p));});});
const origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex');
const environment:NodeJS.ProcessEnv={...process.env,NODE_ENV:'production',APP_ORIGIN:origin,NIHON_DB_PATH:dbFile,NIHON_DB_ROLE:'snapshot',NIHON_JLPT_PATH:store,NIHON_JLPT_OFFICIAL_PATH:path.join(directory,'official'),NIHON_SETTINGS_PATH:path.join(directory,'settings.json'),NIHON_ROADMAP_PATH:path.join(directory,'roadmap.json'),GEMINI_API_KEY:'',NIHON_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:randomBytes(32).toString('hex'),NEXT_TELEMETRY_DISABLED:'1'};
function server(clock:string){return spawn(process.execPath,['--import','./tools/ui-test-clock.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...environment,NIHON_UI_CLOCK_FIXTURE:clock},stdio:['ignore','pipe','pipe']});}
let child=server(instant);
let log='',browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
function cleanup(){child.kill();if(path.dirname(path.resolve(directory))!==base)throw Error('UNSAFE_FIXTURE_CLEANUP');fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
process.on('SIGTERM',()=>{cleanup();process.exit(143);});
try{
 let ready=false;for(let n=0;n<150;n++){if(child.exitCode!==null)throw Error(log);try{if((await fetch(origin+'/login',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,log);
 assert.equal((await fetch(origin+'/jlpt-daily',{redirect:'manual'})).status,307);
 const chrome=process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'');
 browser=await chromium.launch({headless:true,...(chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{})});
 const context=await browser.newContext();assert.equal((await context.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0})).status(),303);
 assert.equal((await context.request.post(origin+'/jlpt-daily/answer',{headers:{origin:'https://untrusted.invalid'},data:{questionId:'fake',choice:0}})).status(),403);
 const page=await context.newPage(),errors:string[]=[],external:string[]=[];await page.clock.setFixedTime(new Date(instant));page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});
 const offDir=environment.NIHON_JLPT_OFFICIAL_PATH!;
 assert.equal((await context.request.get(origin+'/jlpt-daily/official')).status(),404);
 fs.mkdirSync(offDir);
 const fixture=JSON.stringify([{id:'N5V-1',number:1,section:'V',level:'N5',key:2,page:1,asset:'N5V-1.png'}]);
 fs.writeFileSync(path.join(offDir,'bank.json'),fixture);
 fs.writeFileSync(path.join(offDir,'approval.json'),JSON.stringify({enabled:true,reviewer:'fixture',sha256:createHash('sha256').update(fixture).digest('hex')}));
 fs.writeFileSync(path.join(offDir,'N5V-1.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHncNcAAAAASUVORK5CYII=','base64'));
 await page.goto(origin+'/jlpt-daily/official?level=N5');
 await page.getByRole('radio',{name:'2',exact:true}).check();
 await page.getByRole('button',{name:'Chấm bài'}).click();
 await page.waitForFunction(()=>document.body.innerText.includes('Từ vựng 1/1'));
 await page.goto(origin+'/jlpt');await page.getByRole('heading',{name:'Bài tuần này chưa sẵn'}).waitFor();assert.ok(page.url().endsWith('/jlpt-daily'));
 const bank=await fixtureBank(catalog,week);publishBank(bank,store);const questions=bank.questions.filter(q=>q.date===date);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:950});await page.reload();await page.getByRole('button',{name:'Kiểm tra đáp án'}).waitFor();
  assert.equal(await page.getByRole('radio').count(),4);assert.ok(await page.getByRole('button',{name:'Kiểm tra đáp án'}).isDisabled());
  assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth),false,`overflow at ${width}`);
  await page.screenshot({path:path.join(reports,`${width}.png`),fullPage:true});
 }
 const outOfOrder=await context.request.post(origin+'/jlpt-daily/answer',{headers:{origin},data:{questionId:questions[1].id,choice:0}});assert.equal(outOfOrder.status(),409);
 for(let i=0;i<10;i++){
  const chosen=i===0||i===5?(questions[i].correct+1)%4:questions[i].correct;
  await page.getByRole('radio').nth(chosen).check();await page.getByRole('button',{name:'Kiểm tra đáp án'}).click();await page.getByRole('status').waitFor();
  await page.getByText(questions[i].explanation,{exact:true}).waitFor();
  if(i===0){await page.getByText('Đã thêm câu sai vào SRS.',{exact:true}).waitFor();const replay=await context.request.post(origin+'/jlpt-daily/answer',{headers:{origin},data:{questionId:questions[0].id,choice:questions[0].correct}});assert.equal((await replay.json()).correct,false);await page.reload();}
  else await page.getByRole('button',{name:i===9?'Xem kết quả':'Câu tiếp theo',exact:true}).click();
 }
 await page.getByRole('heading',{name:'8 / 10 câu đúng'}).waitFor();await page.screenshot({path:path.join(reports,'result-mobile.png'),fullPage:true});await page.reload();await page.getByRole('heading',{name:'8 / 10 câu đúng'}).waitFor();
 assert.equal(readState(store).attempts.length,10);const db=new DatabaseSync(dbFile,{readOnly:true});try{assert.ok(db.prepare("SELECT 1 FROM srs_cards WHERE item_id=? AND card_type<>'recognition'").get(questions[0].targetId));}finally{db.close();}

 // All edits here are confined to this disposable browser fixture.
 fs.renameSync(path.join(store,'week-'+week+'-N5.json'),path.join(store,'normal-week.archived'));
 importApproved(await approvedFixture(catalog,week),catalog,store);
 const yesterday=plusDays(date,-1);approvedBank(yesterday,weekStart(yesterday),'N5',catalog,store);
 const single=approvedBank(date,week,'N5',catalog,store)!;assert.equal(single.questions.length,1);
 await page.reload();await page.getByText('1 câu đang có',{exact:true}).waitFor();await page.getByText(/draft_roadmap/).waitFor();
 await page.getByText('Hôm nay có 1/10 câu đã duyệt. Bạn có thể làm số câu đang có.',{exact:true}).waitFor();
 await page.getByRole('radio').nth(single.questions[0].correct).check();await page.getByRole('button',{name:'Kiểm tra đáp án',exact:true}).click();await page.getByRole('status').waitFor();await page.getByRole('button',{name:'Xem kết quả',exact:true}).click();await page.getByRole('heading',{name:'1 / 1 câu đúng',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'1 / 1 câu đúng',exact:true}).waitFor();
 const approvedDb=new DatabaseSync(path.join(store,'approved.sqlite'));try{approvedDb.prepare('UPDATE approved_schedule SET date=? WHERE date=?').run(plusDays(date,-2),date);}finally{approvedDb.close();}
 await page.reload();await page.getByRole('heading',{name:'Hôm nay chưa có thêm câu mới',exact:true}).waitFor();assert.equal(await page.getByRole('radio').count(),0);await page.getByText('0 câu đang có',{exact:true}).waitFor();
 // Both server and browser use the same Vietnam day. Only the two mistaken
 // cards become due the following day; grammar cloze must be usable, too.
 await page.goto(origin+'/srs?mode=full');await page.getByRole('heading',{name:'Chưa có thẻ đến hạn.',exact:true}).waitFor();
 const checkDb=new DatabaseSync(dbFile,{readOnly:true});let wrong:string[];try{wrong=checkDb.prepare("SELECT card_id FROM srs_cards WHERE card_type IN ('reading','cloze')").all().map(r=>String(r.card_id));assert.equal(wrong.length,2);}finally{checkDb.close();}
 await new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.kill();});
 const tomorrow='2026-11-17T13:01:00Z';child=server(tomorrow);child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 let nextReady=false;for(let n=0;n<150;n++){if(child.exitCode!==null)throw Error(log);try{if((await fetch(origin+'/login',{signal:AbortSignal.timeout(2000)})).ok){nextReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(nextReady,log);
 await page.clock.setFixedTime(new Date(tomorrow));assert.equal((await context.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0})).status(),303);await page.goto(origin+'/srs?mode=full');
 const reviewed:string[]=[];for(let n=0;n<2;n++){try{await page.waitForFunction(ids=>{const id=document.querySelector('[data-srs-card]:not([aria-hidden])')?.getAttribute('data-srs-card');return !!id&&ids.includes(id);},wrong.filter(id=>!reviewed.includes(id)));reviewed.push((await page.locator('[data-srs-card]:not([aria-hidden])').getAttribute('data-srs-card'))!);await page.getByRole('button',{name:'Hiện đáp án',exact:true}).click();await page.getByRole('button',{name:/^Được/}).click();}catch(e){await page.screenshot({path:path.join(reports,'next-day-failure.png'),fullPage:true});fs.writeFileSync(path.join(reports,'next-day-failure.json'),JSON.stringify({n,wrong,reviewed,html:await page.locator('main').innerHTML(),storage:await page.evaluate(()=>({...localStorage}))},null,2));throw e;}}
 await page.getByRole('heading',{name:'Xong một phiên nhỏ.',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[data-srs-session]')?.textContent?.includes('0 lượt chờ đồng bộ'));
 assert.deepEqual(new Set(reviewed),new Set(wrong));assert.deepEqual(external,[]);assert.deepEqual(errors,[]);console.log('JLPT browser PASS: fixed server/browser clocks, shortage counts, auth/CSRF, 10 answers, resume, reading + grammar mistakes actually reviewed in next-day SRS, idempotency, no external API.');
}finally{await browser?.close();fs.writeFileSync(path.join(reports,'server.log'),log);cleanup();}
