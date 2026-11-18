import {maintenanceActive} from '../../../core/backup.ts';
import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {hash,validateQuestion,requireValue,plusDays,type Source,type Question,type Bank,type Audit} from './model.ts';
import {validateIndependent} from './independent-qa.ts';

export type ApprovedInput={questions:Question[];audit:Audit[];sourceWeek:string;sourceHashes:Record<string,string>;sourceSha256:string;model:string;verifierModel:string;reviewer:string};
export function openStore(directory:string){
 fs.mkdirSync(directory,{recursive:true});const db=new DatabaseSync(path.join(directory,'approved.sqlite'),{timeout:5000});
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS approved_questions(id TEXT PRIMARY KEY, payload TEXT NOT NULL, receipt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS approved_schedule(date TEXT NOT NULL, position INTEGER NOT NULL, question_id TEXT NOT NULL UNIQUE REFERENCES approved_questions(id), PRIMARY KEY(date,position));`);
 return db;
}
export function validateApproved(input:ApprovedInput,catalog:Source[]){
 requireValue(input.reviewer==='tester'&&input.questions.length===11&&input.audit.length===11&&/^[a-f0-9]{64}$/.test(input.sourceSha256)&&input.model!==input.verifierModel,'TESTER_APPROVED_ELEVEN_REQUIRED');
 const seen:Question[]=[];
 for(let index=0;index<input.questions.length;index++){
  const q=input.questions[index],validated=validateQuestion(q,catalog,input.sourceWeek,'N5',seen);requireValue(q.id===validated.id&&q.fingerprint===validated.fingerprint,'QUESTION_ID_CHANGED');
  requireValue(input.sourceHashes[q.targetId]===catalog.find(s=>s.id===q.targetId)?.hash,'SOURCE_CHANGED');validateIndependent([{...input.audit[index],index:0}],[q]);seen.push(q);
 }
 return seen;
}
export function importApproved(input:ApprovedInput,catalog:Source[],directory:string){
 const seen=validateApproved(input,catalog);
 const receipt={referenceCatalog:catalog,approvedAt:new Date().toISOString(),origin:'draft_roadmap',status:'approved',reviewer:input.reviewer,sourceWeek:input.sourceWeek,sourceHashes:input.sourceHashes,sourceSha256:input.sourceSha256,model:input.model,verifierModel:input.verifierModel};
 const db=openStore(directory);let inserted=0;try{
  db.exec('BEGIN IMMEDIATE');for(const q of seen){const old=db.prepare('SELECT payload,receipt FROM approved_questions WHERE id=?').get(q.id);if(old){requireValue(hash(JSON.parse(String(old.payload)))===hash(q)&&JSON.parse(String(old.receipt)).sourceSha256===input.sourceSha256,'APPROVED_QUESTION_CONFLICT');continue;}
   db.prepare('INSERT INTO approved_questions VALUES(?,?,?)').run(q.id,JSON.stringify(q),JSON.stringify({...receipt,audit:input.audit[seen.indexOf(q)],contentHash:hash(q)}));inserted++;
  }db.exec('COMMIT');return {inserted,total:Number(db.prepare('SELECT count(*) n FROM approved_questions').get()!.n),source:'draft_roadmap',reviewer:'tester'};
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
}
export function approvedBank(date:string,week:string,level:string,catalog:Source[],directory:string):Bank|null{
 requireValue(!maintenanceActive(),'MAINTENANCE');
 if(level!=='N5'||!fs.existsSync(path.join(directory,'approved.sqlite')))return null;
 const db=openStore(directory);try{
  db.exec('BEGIN IMMEDIATE');
  const existing=Number(db.prepare('SELECT count(*) n FROM approved_schedule WHERE date=?').get(date)!.n);
  const dated=db.prepare("SELECT 1 FROM approved_schedule s JOIN approved_questions q ON q.id=s.question_id WHERE s.date=? AND json_extract(q.receipt,'$.reviewer')='tester-claude' LIMIT 1").get(date);
  const fresh=dated?[]:db.prepare("SELECT id FROM approved_questions WHERE json_extract(receipt,'$.reviewer') = 'tester' AND id NOT IN (SELECT question_id FROM approved_schedule) ORDER BY rowid LIMIT ?").all(10-existing);
  for(const [i,q]of fresh.entries())db.prepare('INSERT INTO approved_schedule VALUES(?,?,?)').run(date,existing+i,q.id);
  const rows=db.prepare('SELECT q.payload,q.receipt,s.position FROM approved_schedule s JOIN approved_questions q ON q.id=s.question_id WHERE s.date=? ORDER BY s.position').all(date);
  const questions:Question[]=[],audits:Audit[]=[];let receipt:any;
  for(const row of rows){const raw=JSON.parse(String(row.payload));receipt=JSON.parse(String(row.receipt));if(receipt.reviewer==='tester-claude'){requireValue(raw.version===2&&receipt.origin==='draft_roadmap'&&receipt.status==='approved'&&receipt.approvedOn==='2026-11-18'&&['2026-11-16','2026-11-23'].includes(week)&&receipt.sourceWeek===week&&date>=week&&date<=plusDays(week,6)&&raw.date===date&&receipt.contentHash===hash(raw)&&catalog.some(s=>s.id===raw.targetId&&s.hash===raw.sourceHash),'INVALID_DATED_APPROVAL');questions.push({...raw,position:Number(row.position)});audits.push(receipt.audit.solver);continue;}requireValue(receipt.origin==='draft_roadmap'&&receipt.status==='approved'&&receipt.reviewer==='tester'&&receipt.contentHash===hash(raw),'INVALID_APPROVED_RECEIPT');
   const original=validateQuestion(raw,receipt.referenceCatalog??catalog,receipt.sourceWeek,'N5');requireValue(receipt.sourceHashes[raw.targetId]===catalog.find(s=>s.id===raw.targetId)?.hash,'SOURCE_CHANGED');validateIndependent([{...receipt.audit,index:0}],[original]);
   questions.push({...original,date,day:Math.round((Date.parse(date)-Date.parse(week))/86400000),position:Number(row.position),id:hash({approved:raw.id,date}).slice(0,32)});audits.push({...receipt.audit,index:questions.length-1});
  }
  db.exec('COMMIT');
  return {version:1,week,level:'N5',generatedAt:'approved-local-import',model:receipt?.model??'approved',verifierModel:receipt?.verifierModel??'approved',promptHash:'approved-draft',auditPromptHash:'tester-approved',sourceHashes:receipt?.sourceHashes??{},questions,audit:audits,approval:{origin:'draft_roadmap',reviewer:receipt?.reviewer??'tester'}};
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
}
