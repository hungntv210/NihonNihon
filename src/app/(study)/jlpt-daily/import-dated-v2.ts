import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {backup, DatabaseSync} from 'node:sqlite';
import {parseArgs} from 'node:util';
import {localClock,validDate,weekStart} from '../today-roadmap/model.ts';
import {approvedHistory,openStore,validDatedServiceDate,validDatedWeek} from './approved-store.ts';
import {copyApprovedTargets} from './approved-targets.ts';
import {contextAt} from './v2-data.ts';
import {validateV2,type V2Question} from './deterministic.ts';
import {validateOptionGrades} from './independent-qa.ts';
import {hash,requireValue,type Question} from './model.ts';
import {savedBanks,withStoreLock} from './repository.ts';

const {values:a}=parseArgs({options:{
 input:{type:'string'},app:{type:'string'},snapshot:{type:'string'},store:{type:'string'},receipt:{type:'string'},
 week:{type:'string',multiple:true},
}});
const weeks=a.week;
requireValue(weeks?.length&&weeks.every(validDatedWeek)&&new Set(weeks).size===weeks.length,'VALID_MONDAY_WEEKS_REQUIRED');
const arg=(k:Exclude<keyof typeof a,'week'>)=>{const v=a[k];requireValue(typeof v==='string'&&v.length,k+' required');return path.resolve(v);};
const directory=arg('input'),app=arg('app'),frozen=arg('snapshot'),store=arg('store');
const approvedOn=localClock(new Date()).date;
const selection=JSON.parse(fs.readFileSync(path.join(directory,'pre-import-review.json'),'utf8'));
requireValue(selection.sourceSHA256.length===weeks.length,'REVIEW_WEEK_COUNT');
const pin=JSON.parse(fs.readFileSync(arg('receipt'),'utf8'));
const digest=createHash('sha256');
for await(const chunk of fs.createReadStream(frozen))digest.update(chunk);
requireValue(pin.read_only&&pin.sha256===digest.digest('hex')&&path.resolve(pin.path)===frozen&&frozen!==app,'FROZEN_RECEIPT_MISMATCH');
const source=new DatabaseSync(frozen,{readOnly:true}),learning=new DatabaseSync(app,{readOnly:true}),db=openStore(store);
try{
 const pending:{q:V2Question;receipt:{sourceWeek:string;[key:string]:unknown}}[]=[];
 const loadHistory=()=>[...savedBanks(store).flatMap(b=>b.questions),...approvedHistory(db)];
 const history=loadHistory(),historyHash=hash(history);
 const findExisting=db.prepare('SELECT payload,receipt FROM approved_questions WHERE id=?');
 const sameApproval=(payload:unknown,storedReceipt:unknown,q:V2Question,receipt:Record<string,unknown>)=>{
  const old=JSON.parse(String(storedReceipt));
  return payload===JSON.stringify(q)&&validDate(old.approvedOn)&&hash({...old,approvedOn})===hash(receipt);
 };
 const retained=new Set<string>(selection.retainedIds);
 const excluded=new Set<string>(selection.excluded.map((x:{id:string})=>x.id));
 for(const [i,week]of weeks.entries()){
  const bytes=fs.readFileSync(path.join(directory,'bank-'+week+'.json')),bank=JSON.parse(bytes.toString()),sha=createHash('sha256').update(bytes).digest('hex');
  requireValue(bank.mode==='draft_roadmap'&&bank.week===week&&bank.snapshotHash===pin.sha256&&sha===selection.sourceSHA256[i],'BANK_CHANGED');
  for(const day of bank.days){
   requireValue(validDate(day.date)&&weekStart(day.date)===week,'INVALID_DATED_APPROVAL');
   const c=contextAt(source,learning,day.date,'draft_roadmap');
   for(const q of bank.questions.filter((v:Question)=>v.date===day.date)){
    requireValue(retained.has(q.id)!==excluded.has(q.id),'MISSING_REVIEW_DECISION');
    if(!retained.has(q.id))continue;
    const audit=bank.audit[q.id];
    requireValue(audit.accepted&&audit.solver.natural&&audit.solver.knowledgeCorrect,'UNVERIFIED');
    validateOptionGrades(audit.solver,q);
    validateOptionGrades({...audit.solver,optionGrades:audit.isolatedOptionGrades},q);
    const receipt={reviewer:'tester-claude',origin:'draft_roadmap',status:'approved',approvedOn,
     sourceWeek:week,sourceSha256:sha,snapshotSha256:pin.sha256,contentHash:hash(q),audit,
     waiver:{weeks,reason:'Owner approved publishing actual daily count and type mix after ambiguity review, including days without grammar.'}};
    const existing=findExisting.get(q.id);
    if(existing)requireValue(sameApproval(existing.payload,existing.receipt,q,receipt),'APPROVAL_CONFLICT');
    validateV2(q,c,existing?history.filter(old=>old.id!==q.id):history);
    if(!existing)history.push(q);
    pending.push({q,receipt});
   }
  }
 }
 requireValue(pending.length===retained.size&&new Set(pending.map(r=>r.q.id)).size===pending.length,'REVIEW_COVERAGE');
 const stamp=Date.now();
 await backup(learning,path.join(store,'before-v2-content-'+stamp+'.sqlite'));
 await backup(db,path.join(store,'before-v2-approved-'+stamp+'.sqlite'));
 withStoreLock(store,()=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   requireValue(hash(loadHistory())===historyHash,'APPROVAL_HISTORY_CHANGED');
   copyApprovedTargets(source,app,pending.map(r=>r.q.targetId));
   for(const {q,receipt}of pending){
    const existing=findExisting.get(q.id);
    if(existing){
     requireValue(sameApproval(existing.payload,existing.receipt,q,receipt),'APPROVAL_CONFLICT');
     continue;
    }
    db.prepare('INSERT INTO approved_questions VALUES(?,?,?)').run(q.id,JSON.stringify(q),JSON.stringify(receipt));
    if(!validDatedServiceDate(q.date,receipt.sourceWeek,approvedOn))continue;
    const position=Number(db.prepare('SELECT coalesce(max(position),-1)+1 n FROM approved_schedule WHERE date=?').get(q.date)!.n);
    db.prepare('INSERT INTO approved_schedule VALUES(?,?,?)').run(q.date,position,q.id);
   }
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 });
 console.log(JSON.stringify({approved:pending.length,excluded:excluded.size}));
}finally{db.close();learning.close();source.close();}
