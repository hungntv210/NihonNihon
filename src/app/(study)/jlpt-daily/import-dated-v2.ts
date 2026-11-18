import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {backup, DatabaseSync} from 'node:sqlite';
import {parseArgs} from 'node:util';
import {openStore} from './approved-store.ts';
import {copyApprovedTargets} from './approved-targets.ts';
import {contextAt} from './v2-data.ts';
import {validateV2,type V2Question} from './deterministic.ts';
import {validateOptionGrades} from './independent-qa.ts';
import {hash,requireValue,type Question} from './model.ts';
import {savedBanks,withStoreLock} from './repository.ts';

const {values:a}=parseArgs({options:Object.fromEntries(['input','app','snapshot','store','receipt'].map(k=>[k,{type:'string' as const}]))});
const arg=(k:string)=>{const v=a[k];requireValue(typeof v==='string'&&v.length,k+' required');return path.resolve(v);};
const directory=arg('input'),app=arg('app'),frozen=arg('snapshot'),store=arg('store');
const weeks=['2026-11-16','2026-11-23'];
const selection=JSON.parse(fs.readFileSync(path.join(directory,'pre-import-review.json'),'utf8'));
const pin=JSON.parse(fs.readFileSync(arg('receipt'),'utf8'));
const digest=createHash('sha256');
for await(const chunk of fs.createReadStream(frozen))digest.update(chunk);
requireValue(pin.read_only&&pin.sha256===digest.digest('hex')&&path.resolve(pin.path)===frozen&&frozen!==app,'FROZEN_RECEIPT_MISMATCH');
const source=new DatabaseSync(frozen,{readOnly:true}),learning=new DatabaseSync(app,{readOnly:true}),db=openStore(store);
try{
 const pending:{q:V2Question;receipt:string}[]=[];
 const history:Question[]=savedBanks(store).flatMap(b=>b.questions);
 for(const row of db.prepare('SELECT payload,receipt FROM approved_questions').all()){
  const q=JSON.parse(String(row.payload)),r=JSON.parse(String(row.receipt));
  if(r.reviewer!=='tester-claude')history.push({...q,date:'2026-11-18'});
 }
 const retained=new Set<string>(selection.retainedIds);
 const excluded=new Set<string>(selection.excluded.map((x:{id:string})=>x.id));
 for(const [i,week]of weeks.entries()){
  const bytes=fs.readFileSync(path.join(directory,'bank-'+week+'.json')),bank=JSON.parse(bytes.toString()),sha=createHash('sha256').update(bytes).digest('hex');
  requireValue(bank.mode==='draft_roadmap'&&bank.week===week&&bank.snapshotHash===pin.sha256&&sha===selection.sourceSHA256[i],'BANK_CHANGED');
  for(const day of bank.days){
   const c=contextAt(source,learning,day.date,'draft_roadmap');
   for(const q of bank.questions.filter((v:Question)=>v.date===day.date)){
    requireValue(retained.has(q.id)!==excluded.has(q.id),'MISSING_REVIEW_DECISION');
    if(!retained.has(q.id))continue;
    validateV2(q,c,history);
    const audit=bank.audit[q.id];
    requireValue(audit.accepted&&audit.solver.natural&&audit.solver.knowledgeCorrect,'UNVERIFIED');
    validateOptionGrades(audit.solver,q);
    validateOptionGrades({...audit.solver,optionGrades:audit.isolatedOptionGrades},q);
    pending.push({q,receipt:JSON.stringify({reviewer:'tester-claude',origin:'draft_roadmap',status:'approved',approvedOn:'2026-11-18',sourceWeek:week,sourceSha256:sha,snapshotSha256:pin.sha256,contentHash:hash(q),audit,waiver:{weeks,reason:'Owner approved publishing actual daily count and type mix after ambiguity review, including days without grammar.'}})});
    history.push(q);
   }
  }
 }
 requireValue(pending.length===retained.size&&new Set(pending.map(r=>r.q.id)).size===pending.length,'REVIEW_COVERAGE');
 const stamp=Date.now();
 await backup(learning,path.join(store,'before-v2-content-'+stamp+'.sqlite'));
 await backup(db,path.join(store,'before-v2-approved-'+stamp+'.sqlite'));
 copyApprovedTargets(source,app,pending.map(r=>r.q.targetId));
 withStoreLock(store,()=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const {q,receipt}of pending){
    const existing=db.prepare('SELECT payload,receipt FROM approved_questions WHERE id=?').get(q.id);
    if(existing){requireValue(existing.payload===JSON.stringify(q)&&existing.receipt===receipt,'APPROVAL_CONFLICT');continue;}
    db.prepare('INSERT INTO approved_questions VALUES(?,?,?)').run(q.id,JSON.stringify(q),receipt);
    if(q.date<'2026-11-18')continue;
    const position=Number(db.prepare('SELECT coalesce(max(position),-1)+1 n FROM approved_schedule WHERE date=?').get(q.date)!.n);
    db.prepare('INSERT INTO approved_schedule VALUES(?,?,?)').run(q.date,position,q.id);
   }
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 });
 console.log(JSON.stringify({approved:pending.length,excluded:excluded.size}));
}finally{db.close();learning.close();source.close();}
