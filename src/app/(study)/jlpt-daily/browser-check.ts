import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { hashPassword } from '../../../core/session.ts';
import { localClock,weekStart } from '../today-roadmap/model.ts';
import { fixtureCatalog,fixtureBank } from './fixture.ts';
import { publishBank,readState } from './repository.ts';

const reports=path.resolve('data/reports/jlpt-daily');fs.mkdirSync(reports,{recursive:true});
const base=path.resolve(process.env.NIHON_BROWSER_FIXTURE_ROOT||'.tmp');fs.mkdirSync(base,{recursive:true});
const directory=fs.mkdtempSync(path.join(base,'jlpt-browser-')),dbFile=path.join(directory,'demo.sqlite'),store=path.join(directory,'jlpt');
const catalog=fixtureCatalog(dbFile),date=localClock(new Date()).date,week=weekStart(date);
fs.writeFileSync(path.join(directory,'settings.json'),JSON.stringify({startDate:week,eveningTime:'00:00'}));
const port=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p));});});
const origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:origin,NIHON_DB_PATH:dbFile,NIHON_DB_ROLE:'snapshot',NIHON_JLPT_PATH:store,NIHON_SETTINGS_PATH:path.join(directory,'settings.json'),NIHON_ROADMAP_PATH:path.join(directory,'roadmap.json'),GEMINI_API_KEY:'',NIHON_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:randomBytes(32).toString('hex'),NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let log='',browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
function cleanup(){child.kill();if(path.dirname(path.resolve(directory))!==base)throw Error('UNSAFE_FIXTURE_CLEANUP');fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
process.on('SIGTERM',()=>{cleanup();process.exit(143);});
try{
 let ready=false;for(let n=0;n<150;n++){if(child.exitCode!==null)throw Error(log);try{if((await fetch(origin+'/robots.txt',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,log);
 assert.equal((await fetch(origin+'/jlpt-daily',{redirect:'manual'})).status,307);
 const chrome=process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'');
 browser=await chromium.launch({headless:true,...(chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{})});
 const context=await browser.newContext();assert.equal((await context.request.post(origin+'/api/session',{headers:{origin},form:{password},maxRedirects:0})).status(),303);
 assert.equal((await context.request.post(origin+'/jlpt-daily/answer',{headers:{origin:'https://untrusted.invalid'},data:{questionId:'fake',choice:0}})).status(),403);
 const page=await context.newPage(),errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});
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
  const chosen=i===0?(questions[i].correct+1)%4:questions[i].correct;
  await page.getByRole('radio').nth(chosen).check();await page.getByRole('button',{name:'Kiểm tra đáp án'}).click();await page.getByRole('status').waitFor();
  await page.getByText(questions[i].explanation,{exact:true}).waitFor();
  if(i===0){await page.getByText('Đã thêm câu sai vào SRS.',{exact:true}).waitFor();const replay=await context.request.post(origin+'/jlpt-daily/answer',{headers:{origin},data:{questionId:questions[0].id,choice:questions[0].correct}});assert.equal((await replay.json()).correct,false);await page.reload();}
  else await page.getByRole('button',{name:i===9?'Xem kết quả':'Câu tiếp theo',exact:true}).click();
 }
 await page.getByRole('heading',{name:'9 / 10 câu đúng'}).waitFor();await page.screenshot({path:path.join(reports,'result-mobile.png'),fullPage:true});await page.reload();await page.getByRole('heading',{name:'9 / 10 câu đúng'}).waitFor();
 assert.equal(readState(store).attempts.length,10);const db=new DatabaseSync(dbFile,{readOnly:true});try{assert.ok(db.prepare("SELECT 1 FROM srs_cards WHERE item_id=? AND card_type<>'recognition'").get(questions[0].targetId));}finally{db.close();}
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);console.log('JLPT browser PASS: auth, CSRF, alias, empty week, desktop/mobile, 10 answers, last explanation, resume, SRS, idempotency, no external API.');
}finally{await browser?.close();fs.writeFileSync(path.join(reports,'server.log'),log);cleanup();}
