import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';import {fileURLToPath} from 'node:url';import {geminiProvider} from './generate-week.ts';
import type {DatabaseSync} from 'node:sqlite';
import {allocateRoadmap} from '../today-roadmap/model.ts';import {roadmapData} from '../today-roadmap/repository.ts';
import {sourceCatalog} from './catalog.ts';import {openContentDatabase} from '../../../core/content.ts';
import {GENERATE_PROMPT,VERIFY_PROMPT,questionSchema,auditSchema,type Provider} from './generation.ts';
import {validateDrafts,validateDayDrafts,validateAudit,requireValue,questionTypes,hash,type Source,type Question,type Audit,type Draft,validateQuestion} from './model.ts';

import {plainJapanese,spellingNeighbor} from './hard-qa.ts';

export const DRAFT_MODE='draft_roadmap' as const;
export function roadmapDraftCatalog(db:DatabaseSync,startDate='2026-11-02'){
 const allowed=new Set(allocateRoadmap(roadmapData(db).items,startDate).slice(0,2).flatMap(w=>w.items.map(i=>i.id)));
 return sourceCatalog(db).filter(s=>s.level==='N5'&&allowed.has(s.id));
}
const generationPrompt=GENERATE_PROMPT.replace('Produce exactly7 days times10 questions, day0..6/position0..9,','Produce ONLY the supplied slots. Preserve each supplied day/position/type.').replaceAll('learned','roadmap-approved draft')+' Supplied targetId/choices/correct are source-grounded recommendations; reproduce them and write the original stem/explanation. Never conjugate the answer to hide a mismatch: design a gap accepting its dictionary form. Use only bare Japanese answerTitle values, and kana for story context except marked reading target. For grammar gaps choose a sentence accepting the exact supplied surface. Repair only requested positions. For synonym, ask for the word matching a simple kana definition. NO silent corrections will be made to your answer key or options.';
const verificationPrompt=VERIFY_PROMPT.replaceAll('learned','roadmap-approved draft')+' This is mode=draft_roadmap, NOT evidence of SRS learning. The legacy learnedOnly field means strictly within the supplied roadmap-approved catalog. Never claim actual review history.';
export const draftPromptHashes={generate:hash({prompt:generationPrompt,planning:'hard-qa-source-options-v2'}),verify:hash(verificationPrompt)};
const schemaFor=(schema:typeof questionSchema|typeof auditSchema,count:number)=>({...schema,minItems:count,maxItems:count});
function draftSchema(count:number,_knownKanji:string[],_catalog:Source[]){return schemaFor(questionSchema,count);}
export function draftSlots(day:number,catalog:Source[]){return Array.from({length:10},(_,position)=>{
 const type=questionTypes[(day*10+position)%questionTypes.length],grammar=['grammar','order','paragraph'].includes(type);
 const choicesFor=(s:Source)=>[...new Set(catalog.filter(o=>o.id!==s.id&&o.level===s.level&&(type==='spelling'?spellingNeighbor(s,o):o.kind===s.kind&&(grammar||o.pos[0]===s.pos[0]))).map(o=>type==='reading'?o.reading:plainJapanese(o.title)).filter((v):v is string=>!!v&&v!==(type==='reading'?s.reading:plainJapanese(s.title))&&!/[\p{Script=Latin}〜～~()（）]/u.test(v)))];
 const pool=catalog.filter(s=>(grammar?s.kind==='grammar':s.kind==='vocab'&&(type!=='reading'&&type!=='spelling'||/\p{Script=Han}/u.test(s.title)))&&choicesFor(s).length>=3);
 requireValue(pool.length>0,'INSUFFICIENT_DRAFT_OPTIONS');const source=pool[(day*10+position)%pool.length],answer=type==='reading'?source.reading:plainJapanese(source.title),options=choicesFor(source).sort((a,b)=>hash(day+':'+position+a).localeCompare(hash(day+':'+position+b))).slice(0,3);
 requireValue(answer,'INSUFFICIENT_DRAFT_OPTIONS');const correct=(day+position)%4;options.splice(correct,0,answer);return {day,position,type,targetId:source.id,...(type==='order'?{}:{choices:options,correct})};
 });}
type DaySeed={questions:Draft[];audit:Audit[]};
export async function generateDraftDay({week,day,catalog,history=[],seed,onCheckpoint=()=>{}}:{week:string;day:number;catalog:Source[];history?:Question[];seed?:DaySeed;onCheckpoint?:(value:unknown)=>void},provider:Provider){
 const slots=draftSlots(day,catalog),knownKanji=[...new Set(catalog.flatMap(s=>[...s.title,...s.reading??'']).filter(c=>/\p{Script=Han}/u.test(c)))];
 const publicCatalog=catalog.map(s=>({...s,answerTitle:plainJapanese(s.title)}));
 const accepted=new Map<number,Question>(),audits=new Map<number,Audit>(),raws=new Map<number,Draft>(),reasons=new Map<number,string>();
 const rejectedAttempts:{round:number;positions:number[]}[]=[],hardRejected:{round:number;position:number;reason:string}[]=[];
 let repairs=0;
 const checkpoint=()=>onCheckpoint({mode:DRAFT_MODE,day,questions:[...accepted.values()].sort((a,b)=>a.position-b.position),audit:[...audits.entries()].sort(([a],[b])=>a-b).map(([,a],index)=>({...a,index})),rejected:[...reasons].map(([position,reason])=>({position,reason,raw:raws.get(position)})),repairs});
 async function assess(rows:unknown,expected:number[],round:number,priorAudit?:Audit[]){
  requireValue(Array.isArray(rows)&&rows.length===expected.length&&new Set(rows.map((q:Draft)=>q.position)).size===expected.length&&rows.every((q:Draft)=>expected.includes(q.position)),'REPAIR_CHANGED_ACCEPTED_SLOT');
  const pending:Question[]=[];
  for(const raw of rows as Draft[]){raws.set(raw.position,raw);try{
   requireValue(raw.day===day&&raw.type===slots[raw.position].type,'SLOT_TYPE_MISMATCH');
   const q=validateQuestion(raw,catalog,week,'N5',[...history,...accepted.values(),...pending]);
   if(priorAudit){const old=priorAudit.find(a=>a.index===raw.position);if(old){try{validateAudit([{...old,index:0}],[q]);accepted.set(q.position,q);audits.set(q.position,old);reasons.delete(q.position);continue;}catch{ /* recheck a previous semantic reject */ }}}
   pending.push(q);reasons.delete(raw.position);
  }catch(e){const reason=e instanceof Error?e.message:'INVALID_QUESTION';reasons.set(raw.position,reason);hardRejected.push({round,position:raw.position,reason});}}
  checkpoint();
  if(pending.length){const checked=await provider('verify',verificationPrompt,{mode:DRAFT_MODE,level:'N5',catalog:publicCatalog,questions:pending},schemaFor(auditSchema,pending.length));
   requireValue(Array.isArray(checked)&&checked.length===pending.length,'INCOMPLETE_SEMANTIC_QA');const seen=new Set<number>();
   for(const a of checked as Audit[]){requireValue(Number.isInteger(a.index)&&a.index>=0&&a.index<pending.length&&!seen.has(a.index),'INVALID_QA_INDEX');seen.add(a.index);const q=pending[a.index];try{validateAudit([{...a,index:0}],[q]);accepted.set(q.position,q);audits.set(q.position,a);reasons.delete(q.position);}catch{reasons.set(q.position,'SEMANTIC_QA_REJECTED');}}
  }
  checkpoint();
 }
 const payload=(positions:number[])=>({mode:DRAFT_MODE,week,day,level:'N5',roadmapWeeks:[1,2],knownKanji,slots:slots.filter(s=>positions.includes(s.position)),repairPositions:positions,catalog:publicCatalog,rejectionReasons:Object.fromEntries(reasons),history:[...history,...accepted.values()].map(q=>q.stem)});
 const positions=slots.map(s=>s.position);
 if(seed)await assess(seed.questions,positions,0,seed.audit);
 else await assess(await provider('generate',generationPrompt,payload(positions),schemaFor(questionSchema,10)),positions,0);
 while(accepted.size<10&&repairs<2){const bad=positions.filter(p=>!accepted.has(p));rejectedAttempts.push({round:repairs,positions:bad});const next=await provider('generate',generationPrompt,payload(bad),schemaFor(questionSchema,bad.length));repairs++;await assess(next,bad,repairs);}
 const rejectedPositions=positions.filter(p=>!accepted.has(p));if(rejectedPositions.length)rejectedAttempts.push({round:repairs,positions:rejectedPositions});
 const questions=[...accepted.values()].sort((a,b)=>a.position-b.position),audit=questions.map((q,index)=>({...audits.get(q.position)!,index}));
 if(!rejectedPositions.length){validateDayDrafts(questions,catalog,week,'N5',day,history);validateAudit(audit,questions);}
 return {mode:DRAFT_MODE,day,questions,audit,repairs,rejectedAttempts,hardRejected,rejectedPositions,rejected:[...reasons].map(([position,reason])=>({position,reason,raw:raws.get(position)})),accepted:rejectedPositions.length===0};
}

export async function generateRoadmapDraft({snapshotPath,receiptPath,week,directory,model,provider,onDay=()=>{}}:{snapshotPath:string;receiptPath:string;week:string;directory:string;model:string;provider:Provider;onDay?:(value:unknown)=>void}){
 const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));requireValue(receipt.read_only===true&&path.resolve(receipt.path)===path.resolve(snapshotPath),'FROZEN_SNAPSHOT_RECEIPT_REQUIRED');
 const checksum=createHash('sha256');for await(const bytes of fs.createReadStream(snapshotPath))checksum.update(bytes);requireValue(checksum.digest('hex')===receipt.sha256,'SNAPSHOT_HASH_CHANGED');
 requireValue((fs.statSync(snapshotPath).mode&0o222)===0,'SNAPSHOT_MUST_BE_READ_ONLY');fs.mkdirSync(directory,{recursive:true});
 const db=openContentDatabase(snapshotPath);let catalog:Source[];try{catalog=roadmapDraftCatalog(db);requireValue(catalog.some(s=>s.kind==='vocab')&&catalog.some(s=>s.kind==='grammar'),'EMPTY_ROADMAP_DRAFT_CATALOG');}finally{db.close();}
 const metadata={mode:DRAFT_MODE,week,level:'N5',roadmapWeeks:[1,2],learningEvidence:'roadmap_only_not_srs',answerEvidence:'hard-qa-source-options-v2 before independent semantic QA',snapshotSha256:receipt.sha256,model,verifierModel:model,promptHashes:draftPromptHashes,sourceHashes:Object.fromEntries(catalog.map(s=>[s.id,s.hash])),appPublished:false};
 const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});if(fs.existsSync(path.join(directory,'metadata.json')))requireValue(hash(JSON.parse(fs.readFileSync(path.join(directory,'metadata.json'),'utf8')))===hash(metadata),'DRAFT_RESUME_CONTEXT_CHANGED');write('metadata.json',metadata);
 const all:Question[]=[],audits:Audit[]=[];let rejects=0;
 for(let day=0;day<7;day++){const file=path.join(directory,`draft-day-${day+1}.json`),result=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):await generateDraftDay({week,day,catalog,history:all},provider);
  write(`draft-day-${day+1}.json`,result);rejects+=result.rejectedAttempts.reduce((n:number,r:{positions:number[]})=>n+r.positions.length,0);if(!result.accepted){write('status.json',{...metadata,status:'needs_tester_review',completedDays:day,semanticRejectedAcrossAttempts:rejects,rejectedPositions:result.rejectedPositions});return {completed:false,completedDays:day};}
  validateDayDrafts(result.questions,catalog,week,'N5',day,all);validateAudit(result.audit,result.questions);all.push(...result.questions);audits.push(...result.audit.map((a:Audit)=>({...a,index:a.index+day*10})));write('status.json',{...metadata,status:'running',completedDays:day+1,questions:all.length,semanticRejectedAcrossAttempts:rejects});
  if(day===0){const sample={...metadata,questions:all.slice(0,10)};write('review-first-day.json',sample);fs.writeFileSync(path.join(directory,'review-first-day.md'),'# JLPT draft_roadmap — chưa đưa vào app\n\n|Ngày|Nhật|Lựa chọn|Đáp án|Giải thích|\n|---|---|---|---|---|\n'+sample.questions.map(q=>`|${q.date}|${q.stem.replaceAll('|','/')}|${q.choices.join(' / ')}|${q.correct+1}|${q.explanation.replaceAll('|','/')}|`).join('\n'));}onDay({completedDays:day+1,questions:all.length});
 }
 validateDrafts(all,catalog,week,'N5');validateAudit(audits,all);write('draft-week.json',{...metadata,questions:all,audit:audits});const sample=[...all].sort((a,b)=>hash(week+a.id+'review').localeCompare(hash(week+b.id+'review'))).slice(0,30);write('review-sample.json',{...metadata,questions:sample});fs.writeFileSync(path.join(directory,'review-sample.md'),'# JLPT draft_roadmap — 30 câu, chờ tester, chưa đưa vào app\n\nModel: '+model+'\n\n|Ngày|Nhật|Lựa chọn|Đáp án|Giải thích|\n|---|---|---|---|---|\n'+sample.map(q=>`|${q.date}|${q.stem.replaceAll('|','/')}|${q.choices.join(' / ')}|${q.correct+1}|${q.explanation.replaceAll('|','/')}|`).join('\n'));write('review.feedback.json',{mode:DRAFT_MODE,results:all.map(q=>({id:q.id,severity:null,note:''}))});write('status.json',{...metadata,status:'awaiting_tester_review',completedDays:7,questions:70,semanticRejectedAcrossAttempts:rejects});return {completed:true,questions:70};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {values:v}=parseArgs({options:Object.fromEntries(['snapshot','receipt','week','config','output'].map(k=>[k,{type:'string' as const}]))});requireValue(v.snapshot&&v.receipt&&v.week&&v.config&&v.output,'--snapshot --receipt --week --config --output required');const privateRoot=path.resolve('data/private'),relative=path.relative(privateRoot,path.resolve(v.output));requireValue(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'OUTPUT_MUST_BE_PRIVATE');const config=JSON.parse(fs.readFileSync(v.config,'utf8'));console.log(JSON.stringify(await generateRoadmapDraft({snapshotPath:v.snapshot,receiptPath:v.receipt,week:v.week,directory:v.output,model:config.model,provider:geminiProvider(config,path.join(privateRoot,'jlpt-quota.json'),process.env.GEMINI_API_KEY??''),onDay:value=>console.log(JSON.stringify(value))})));}catch(e){console.error(e instanceof Error?e.message:'DRAFT_FAILED');process.exitCode=1;}
}
