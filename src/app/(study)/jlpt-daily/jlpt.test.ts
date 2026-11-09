import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fixtureCatalog,fixtureDrafts,fixtureAudit,fixtureBank } from './fixture.ts';
import { validateDrafts,validateAudit,plusDays,type Bank } from './model.ts';
import { learnedCatalog,learnerLevel } from './catalog.ts';
import { generateWeek } from './generation.ts';
import { geminiProvider } from './generate-week.ts';
import { publishBank,readBank,gradeAnswer,readState,dailyView } from './repository.ts';
import { DEFAULT_PREFERENCES } from '../../../core/preferences.ts';
import { emptyProgress } from '../today-roadmap/model.ts';
const week='2026-11-09';
function setup(t:{after:(fn:()=>void)=>void}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-jlpt-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const file=path.join(directory,'demo.sqlite'),catalog=fixtureCatalog(file);return {directory,file,catalog};
}
test('JLPT generates a complete original week with separate generation and QA passes',async t=>{
 const {catalog}=setup(t),drafts=fixtureDrafts(catalog),calls:string[]=[];
 const bank=await generateWeek({week,level:'N5',catalog,history:[],model:'fixture',verifierModel:'verifier'},async(phase,prompt,payload,schema)=>{calls.push(phase);assert.ok(prompt.length&&payload&&schema);return phase==='generate'?drafts:fixtureAudit(drafts);});
 assert.deepEqual(calls,['generate','verify']);assert.equal(bank.questions.length,70);assert.equal(new Set(bank.questions.map(q=>q.type)).size,8);
 for(let day=0;day<7;day++)assert.equal(bank.questions.filter(q=>q.date===plusDays(week,day)).length,10);
 assert.equal(bank.model,'fixture');assert.equal(bank.verifierModel,'verifier');assert.match(bank.promptHash,/^[a-f0-9]{64}$/);
});
test('JLPT rejects missing/duplicate slots, wrong levels, unlearned sources and kanji',t=>{
 const {catalog}=setup(t),drafts=fixtureDrafts(catalog);
 assert.throws(()=>validateDrafts(drafts.slice(1),catalog,week,'N5'),/SEVENTY/);
 for(const [change,error] of [
  [(a:typeof drafts)=>{a[1].position=0;},/DUPLICATE/],
  [(a:typeof drafts)=>{a[0].targetId='private:item';},/SOURCE_NOT_LEARNED/],
  [(a:typeof drafts)=>{a[0].stem+='鬱';},/UNLEARNED_KANJI/],
  [(a:typeof drafts)=>{a[0].choices[1]=a[0].choices[0];},/DISTINCT/],
  [(a:typeof drafts)=>{a[0].correct=1;},/READING_EVIDENCE/],
 ] as const){const altered=structuredClone(drafts);change(altered);assert.throws(()=>validateDrafts(altered,catalog,week,'N5'),error);}
 assert.throws(()=>validateDrafts(drafts,catalog,week,'N4'),/WRONG_LEVEL/);
});
test('JLPT rejects ambiguous answers, implausible distractors and incomplete semantic audit',t=>{
 const {catalog}=setup(t),drafts=fixtureDrafts(catalog),questions=validateDrafts(drafts,catalog,week,'N5'),audit=fixtureAudit(drafts);
 assert.throws(()=>validateAudit(audit.slice(1),questions),/INCOMPLETE/);
 const ambiguous=structuredClone(audit);ambiguous[0].possibleAnswers=[0,1];assert.throws(()=>validateAudit(ambiguous,questions),/REJECTED/);
 for(const key of ['sameType','plausible','levelMatch','learnedOnly','original','explanationCorrect'] as const){const rejected=structuredClone(audit);rejected[0][key]=false;assert.throws(()=>validateAudit(rejected,questions),/REJECTED/);}
});
test('JLPT enforces thirty-day repeats both before generation and atomically at publish',async t=>{
 const {catalog,directory}=setup(t),bank=await fixtureBank(catalog,week);publishBank(bank,directory);
 assert.throws(()=>publishBank(bank,directory),/ALREADY_EXISTS/);
 assert.throws(()=>validateDrafts(fixtureDrafts(catalog),catalog,'2026-11-16','N5',bank.questions),/THIRTY_DAYS/);
 const duplicate=await fixtureBank(catalog,'2026-11-16');assert.throws(()=>publishBank(duplicate,directory),/THIRTY_DAYS/);
 assert.equal(fs.existsSync(path.join(directory,'week-2026-11-16-N5.json')),false);
 assert.equal(validateDrafts(fixtureDrafts(catalog),catalog,'2026-12-21','N5',bank.questions).length,70);
});
test('JLPT failed independent QA never publishes and source refresh invalidates a saved bank',async t=>{
 const {catalog,directory}=setup(t),drafts=fixtureDrafts(catalog);
 await assert.rejects(generateWeek({week,level:'N5',catalog,history:[],model:'fake',verifierModel:'fake'},async phase=>phase==='generate'?drafts:[]),/INCOMPLETE/);
 assert.equal(fs.existsSync(path.join(directory,`week-${week}-N5.json`)),false);
 publishBank(await fixtureBank(catalog,week),directory);const changed=structuredClone(catalog);changed[0].hash='changed';assert.throws(()=>readBank(week,'N5',changed,directory),/SOURCE_CHANGED/);
});
test('JLPT server grading persists first answers, resumes and queues errors through existing SRS',async t=>{
 const {catalog,directory,file}=setup(t),bank=await fixtureBank(catalog,week);publishBank(bank,directory);
 const day={date:week,week,level:'N5' as const},options={directory,dbFile:file,now:new Date('2026-11-09T13:00:00Z')};
 const before=dailyView(bank,week,readState(directory));assert.equal(before.done,0);assert.equal('correct' in before.questions[0],false);assert.equal(before.questions[0].answer,null);
 assert.throws(()=>gradeAnswer({questionId:bank.questions[1].id,choice:0},day,catalog,options),/OUT_OF_ORDER/);
 assert.throws(()=>gradeAnswer({questionId:bank.questions[10].id,choice:0},day,catalog,options),/INVALID_ANSWER/);
 const first=gradeAnswer({questionId:bank.questions[0].id,choice:1},day,catalog,options);assert.equal(first.correct,false);assert.ok(first.cardId);
 const replay=gradeAnswer({questionId:bank.questions[0].id,choice:0},day,catalog,options);assert.equal(replay.correct,false);assert.equal(replay.replayed,true);assert.equal(readState(directory).attempts.length,1);
 const db=new DatabaseSync(file);try{const card=db.prepare('SELECT item_id,card_type,due_at FROM srs_cards WHERE card_id=?').get(first.cardId!);assert.equal(card?.item_id,bank.questions[0].targetId);assert.equal(card?.card_type,'reading');assert.equal(card?.due_at,'2026-11-10T13:00:00.000Z');}finally{db.close();}
 for(const q of bank.questions.slice(1,10))gradeAnswer({questionId:q.id,choice:q.correct},day,catalog,options);
 const view=dailyView(bank,week,readState(directory));assert.equal(view.done,10);assert.equal(view.score,9);assert.equal(view.questions[9].answer?.explanation,bank.questions[9].explanation);
});
test('JLPT failed SRS write does not record success; learned means actually reviewed',async t=>{
 const {catalog,directory,file}=setup(t),bank=await fixtureBank(catalog,week);publishBank(bank,directory);
 assert.throws(()=>gradeAnswer({questionId:bank.questions[0].id,choice:1},{date:week,week,level:'N5'},catalog,{directory,enqueue:()=>{throw Error('WRITE_FAILED');}}),/WRITE_FAILED/);assert.equal(readState(directory).attempts.length,0);
 const db=new DatabaseSync(file);try{db.exec('DELETE FROM srs_reviews');assert.equal(learnedCatalog(db).length,0);}finally{db.close();}
 assert.equal(learnerLevel({...DEFAULT_PREFERENCES,startDate:week},emptyProgress(),new Date(week+'T12:00:00Z')),'N5');
 assert.equal(learnerLevel({...DEFAULT_PREFERENCES,startDate:week},emptyProgress(),new Date('2027-02-08T12:00:00Z')),'N4');
});
test('JLPT offline Gemini provider uses explicit schema/model and a conservative Pacific quota ledger',async t=>{
 const {directory}=setup(t),ledger=path.join(directory,'quota.json'),config={model:'gemini-fixture',verifierModel:'gemini-verifier',requestsPerMinute:60,dailyBudget:2,timeoutMs:1000,maxOutputTokens:1000};
 let calls=0;const provider=geminiProvider(config,ledger,'test-not-a-key',(async(url,options)=>{calls++;assert.match(String(url),/gemini-fixture:generateContent$/);const body=JSON.parse(String(options?.body));assert.equal(body.generationConfig.responseMimeType,'application/json');assert.deepEqual(body.generationConfig.responseJsonSchema,{type:'array'});return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'[]'}]}}]}));}) as typeof fetch);
 assert.deepEqual(await provider('generate','original',{}, {type:'array'}),[]);assert.equal(calls,1);
 const data=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(data.models['gemini-fixture'].day,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date()));data.models['gemini-fixture'].count=2;fs.writeFileSync(ledger,JSON.stringify(data));await assert.rejects(provider('generate','original',{},{}),/DAILY_BUDGET/);assert.equal(calls,1);
 const fail=geminiProvider({...config,model:'gemini-error'},ledger,'test',async()=>new Response('',{status:503}));await assert.rejects(fail('generate','',{},{}),/AI_HTTP_503/);
});
