import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {openStore,approvedBank} from './approved-store.ts';
import {hash,type Source} from './model.ts';

function datedFixture(t: test.TestContext, {
 date='2026-11-18', week='2026-11-16', approvedOn='2026-11-18', sourceWeek=week, contentHash,
}: {date?:string;week?:string;approvedOn?:string;sourceWeek?:string;contentHash?:string}={}){

 const root=path.resolve('.tmp');fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'dated-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const db=openStore(dir);
 const q={version:2,id:'fixture-question',date,targetId:'fixture-word',sourceHash:'fixture-hash',type:'reading'};
 const receipt={reviewer:'tester-claude',origin:'draft_roadmap',status:'approved',approvedOn,sourceWeek,contentHash:contentHash??hash(q),audit:{solver:{}}};
 db.prepare('INSERT INTO approved_questions VALUES(?,?,?)').run(q.id,JSON.stringify(q),JSON.stringify(receipt));
 db.prepare('INSERT INTO approved_schedule VALUES(?,?,?)').run(date,0,q.id);
 db.close();
 const catalog=[{id:q.targetId,hash:q.sourceHash}] as Source[];
 return {date,week,catalog,dir};
}

test('dated approval stays on its assigned day and cannot consume legacy or future questions',t=>{
 const {date,week,catalog,dir}=datedFixture(t);
 assert.equal(approvedBank(date,week,'N5',catalog,dir)?.questions.length,1);
 assert.equal(approvedBank('2026-11-19',week,'N5',catalog,dir)?.questions.length,0);
 assert.throws(()=>approvedBank(date,'2026-11-23','N5',catalog,dir),/INVALID_DATED_APPROVAL/);
 assert.throws(()=>approvedBank(date,week,'N5',[],dir),/INVALID_DATED_APPROVAL/);
});

const allowed = [
 {week:'2026-11-23',date:'2026-11-29',approvedOn:'2026-11-18'},
 {week:'2026-11-30',date:'2026-11-30',approvedOn:'2026-11-30'},
 {week:'2026-11-30',date:'2026-12-06',approvedOn:'2026-11-28'},
];
for(const dates of allowed){
 test('serves dated approval on '+dates.date,t=>{
  const {date,week,catalog,dir}=datedFixture(t,dates);
  assert.equal(approvedBank(date,week,'N5',catalog,dir)?.questions.length,1);
 });
}

const rejected = {
 'wrong source week':{sourceWeek:'2026-11-23'},
 'date outside week':{date:'2026-11-23'},
 'approval after the serving date':{approvedOn:'2026-11-19'},
 'invalid approval date':{approvedOn:'2026-11-00'},
 'wrong content hash':{contentHash:'mismatch'},
 'week starting on Tuesday':{week:'2026-11-17'},
 'invalid week date':{week:'2026-11-00'},
 'invalid serving date':{date:'2026-11-018'},
};
for(const [reason,overrides] of Object.entries(rejected)){
 test('rejects dated approval with '+reason,t=>{
  const {date,week,catalog,dir}=datedFixture(t,overrides);
  assert.throws(()=>approvedBank(date,week,'N5',catalog,dir),/INVALID_DATED_APPROVAL/);
 });
}
