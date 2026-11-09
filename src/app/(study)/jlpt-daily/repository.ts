import fs from 'node:fs';import path from 'node:path';import { randomUUID } from 'node:crypto';
import { databasePath } from '../../../core/config.ts';import { enqueueCard,type CardType } from '../../../core/review.ts';
import { type Source,type Bank,type Question,type Level,validateDrafts,validateAudit,requireValue,plusDays } from './model.ts';
export type Attempt={date:string;questionId:string;type:string;choice:number;correct:boolean;cardId:string|null};
type State={version:1;attempts:Attempt[]};
export const storeDirectory=()=>path.resolve(process.env.NIHON_JLPT_PATH||path.join(path.dirname(databasePath()),'private','jlpt-daily'));
const read=(file:string,max=8_000_000)=>{requireValue(fs.statSync(file).size<=max,'STORE_TOO_LARGE');return JSON.parse(fs.readFileSync(file,'utf8'));};
export function readState(directory=storeDirectory()):State{try{const state=read(path.join(directory,'attempts.json'));requireValue(state.version===1&&Array.isArray(state.attempts)&&state.attempts.length<=50000,'INVALID_STATE');return state as State;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,attempts:[]};throw e;}}
export function savedBanks(directory=storeDirectory()):Bank[]{if(!fs.existsSync(directory))return [];return fs.readdirSync(directory).filter(n=>/^week-\d{4}-\d{2}-\d{2}-N[1-5]\.json$/.test(n)).map(n=>read(path.join(directory,n)) as Bank);}
export function readBank(week:string,level:Level,catalog:Source[],directory=storeDirectory()):Bank|null{
 const file=path.join(directory,`week-${week}-${level}.json`);if(!fs.existsSync(file))return null;const bank=read(file) as Bank;
 requireValue(bank.version===1&&bank.week===week&&bank.level===level&&typeof bank.model==='string'&&typeof bank.verifierModel==='string','INVALID_BANK');
 const sources=new Map(catalog.map(s=>[s.id,s.hash]));requireValue(Object.entries(bank.sourceHashes).every(([id,value])=>sources.get(id)===value),'SOURCE_CHANGED_OR_UNLEARNED');
 const questions=validateDrafts(bank.questions,catalog,week,level);validateAudit(bank.audit,questions);return {...bank,questions};
}
export function withStoreLock<T>(directory:string,action:()=>T):T{
 fs.mkdirSync(directory,{recursive:true});let fd:number;try{fd=fs.openSync(path.join(directory,'write.lock'),'wx',0o600);}catch{throw Error('STORE_BUSY');}
 try{return action();}finally{fs.closeSync(fd);fs.unlinkSync(path.join(directory,'write.lock'));}
}
function atomic(file:string,value:unknown){const temporary=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temporary,JSON.stringify(value),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}}
export function publishBank(bank:Bank,directory=storeDirectory()){
 return withStoreLock(directory,()=>{const file=path.join(directory,`week-${bank.week}-${bank.level}.json`);requireValue(!fs.existsSync(file),'WEEK_ALREADY_EXISTS');const history=savedBanks(directory).flatMap(b=>b.questions);requireValue(!bank.questions.some(q=>history.some(old=>old.fingerprint===q.fingerprint&&Math.abs(Date.parse(q.date)-Date.parse(old.date))<=30*86400000)),'REPEATED_WITHIN_THIRTY_DAYS');atomic(file,bank);return file;});
}
export function gradeAnswer(input:{questionId:string;choice:number},day:{date:string;week:string;level:Level},catalog:Source[],options:{directory?:string;dbFile?:string;now?:Date;enqueue?:(id:string,type:CardType,now:Date)=>{cardId:string}}={}){
 const directory=options.directory??storeDirectory();return withStoreLock(directory,()=>{
  const bank=readBank(day.week,day.level,catalog,directory);requireValue(bank,'NO_PREGENERATED_WEEK');const questions=bank.questions.filter(q=>q.date===day.date),question=questions.find(q=>q.id===input.questionId);requireValue(question&&Number.isInteger(input.choice)&&input.choice>=0&&input.choice<4,'INVALID_ANSWER');
  const state=readState(directory),old=state.attempts.find(a=>a.date===day.date&&a.questionId===question.id);
  if(old)return answerView(question,old,true);
  const current=questions.find(q=>!state.attempts.some(a=>a.date===day.date&&a.questionId===q.id));requireValue(current?.id===question.id,'ANSWER_OUT_OF_ORDER');
  const correct=input.choice===question.correct;let cardId:string|null=null;
  if(!correct){const type:CardType=question.type==='reading'?'reading':['grammar','order','paragraph'].includes(question.type)?'cloze':'recall',due=new Date((options.now??new Date()).getTime()+86400000);cardId=(options.enqueue??((id,t,now)=>enqueueCard(options.dbFile??databasePath(),id,t,now)))(question.targetId,type,due).cardId;}
  const attempt:Attempt={date:day.date,questionId:question.id,type:question.type,choice:input.choice,correct,cardId};state.attempts.push(attempt);atomic(path.join(directory,'attempts.json'),state);return answerView(question,attempt,false);
 });
}
function answerView(question:Question,attempt:Attempt,replayed:boolean){return {questionId:question.id,choice:attempt.choice,correct:attempt.correct,correctIndex:question.correct,explanation:question.explanation,cardId:attempt.cardId,replayed};}
export function dailyView(bank:Bank,date:string,state:State){
 const questions=bank.questions.filter(q=>q.date===date),attempts=state.attempts.filter(a=>a.date===date&&questions.some(q=>q.id===a.questionId));
 return {date,level:bank.level,model:bank.model,done:attempts.length,total:questions.length,score:attempts.filter(a=>a.correct).length,weaknesses:Object.fromEntries([...new Set(attempts.map(a=>a.type))].map(type=>[type,{total:attempts.filter(a=>a.type===type).length,wrong:attempts.filter(a=>a.type===type&&!a.correct).length}])),questions:questions.map(q=>({id:q.id,type:q.type,stem:q.stem,choices:q.choices,answer:attempts.find(a=>a.questionId===q.id)?answerView(q,attempts.find(a=>a.questionId===q.id)!,true):null}))};
}
