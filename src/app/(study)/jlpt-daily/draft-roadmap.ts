import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';import {fileURLToPath} from 'node:url';import {reviewIndependently,independentProvider,independentPayload,independentPrompt,independentSchema,validateIndependent} from './independent-qa.ts';
import type {DatabaseSync} from 'node:sqlite';
import {allocateRoadmap} from '../today-roadmap/model.ts';import {roadmapData} from '../today-roadmap/repository.ts';
import {sourceCatalog} from './catalog.ts';import {openContentDatabase} from '../../../core/content.ts';
import {GENERATE_PROMPT,VERIFY_PROMPT,questionSchema,auditSchema,type Provider} from './generation.ts';
import {validateDrafts,validateDayDrafts,validateAudit,requireValue,questionTypes,hash,type Source,type Question,type Audit,type Draft,validateQuestion} from './model.ts';

import {draftCollisionIssues,strictDraftIssues,plainJapanese,spellingNeighbor,readingDistractors,samePartOfSpeech} from './hard-qa.ts';

export const DRAFT_MODE='draft_roadmap' as const;
export function roadmapDraftCatalog(db:DatabaseSync,startDate='2026-11-02'){
 const allowed=new Set(allocateRoadmap(roadmapData(db).items,startDate).slice(0,2).flatMap(w=>w.items.map(i=>i.id)));
 return sourceCatalog(db).filter(s=>s.level==='N5'&&allowed.has(s.id));
}
const generationPrompt=GENERATE_PROMPT.replace('Produce exactly7 days times10 questions, day0..6/position0..9,','Produce ONLY the supplied slots. Preserve each supplied day/position/type.').replaceAll('learned','roadmap-approved draft')+' Supplied targetId/choices/correct are source-grounded recommendations; reproduce them and write the original stem/explanation. Never conjugate the answer to hide a mismatch: design a gap accepting its dictionary form. Use only bare Japanese answerTitle values, and kana for story context except marked reading target. For grammar gaps choose a sentence accepting the exact supplied surface. Repair only requested positions. For synonym, ask for the word matching a simple kana definition. NO silent corrections will be made to your answer key or options. Each stem must admit exactly ONE of the four exact surfaces. Make each distractor clearly wrong in grammar, required verb form, collocation or meaning in THIS sentence, not merely less likely. Check all four filled sentences before returning. Never print any option word already in the stem; never reuse a base sentence or a reading/spelling target.';
const verificationPrompt=VERIFY_PROMPT.replaceAll('learned','roadmap-approved draft')+' This is mode=draft_roadmap, NOT evidence of SRS learning. The legacy learnedOnly field means strictly within the supplied roadmap-approved catalog. Never claim actual review history.';
export const draftPromptHashes={generate:hash({prompt:generationPrompt,planning:'four-filled-options-v5'}),verify:hash(independentPrompt)};
const schemaFor=(schema:typeof questionSchema|typeof auditSchema,count:number)=>({...schema,minItems:count,maxItems:count});
function draftSchema(count:number,_knownKanji:string[],_catalog:Source[]){return schemaFor(questionSchema,count);}
export function draftSlots(day:number,catalog:Source[]){return Array.from({length:10},(_,position)=>{
 const type=questionTypes[(day*10+position)%questionTypes.length],grammar=['grammar','order','paragraph'].includes(type);
 const choicesFor=(s:Source)=>type==='reading'?readingDistractors(s,catalog):[...new Set(catalog.filter(o=>o.id!==s.id&&o.level===s.level&&(type==='spelling'?spellingNeighbor(s,o):o.kind===s.kind&&(grammar||samePartOfSpeech(s,o)))).map(o=>plainJapanese(o.title)).filter(v=>!!v&&v!==plainJapanese(s.title)&&!/[\p{Script=Latin}〜～~()（）]/u.test(v)))];
 const pool=catalog.filter(s=>(grammar?s.kind==='grammar':s.kind==='vocab'&&(type!=='reading'&&type!=='spelling'||/\p{Script=Han}/u.test(s.title)))&&choicesFor(s).length>=3);
 requireValue(pool.length>0,'INSUFFICIENT_DRAFT_OPTIONS');const source=pool[(day*10+position)%pool.length],answer=type==='reading'?source.reading:plainJapanese(source.title),options=choicesFor(source).sort((a,b)=>hash(day+':'+position+a).localeCompare(hash(day+':'+position+b))).slice(0,3);
 requireValue(answer,'INSUFFICIENT_DRAFT_OPTIONS');const correct=(day+position)%4;options.splice(correct,0,answer);return {day,position,type,targetId:source.id,...(type==='order'?{}:{choices:options,correct})};
 });}
export function repairEvidence(raw:Draft|undefined,catalog:Source[],reason:string){
 const allowedKanji=[...new Set(catalog.flatMap(s=>[...s.title,...s.reading??'']).filter(c=>/\p{Script=Han}/u.test(c)))];
 const source=catalog.find(s=>s.id===raw?.targetId);
 return {reason,allowedKanji,violatingKanji:[...new Set([...(raw?.stem??''),...(raw?.choices.join('')??'')].filter(c=>/\p{Script=Han}/u.test(c)&&!allowedKanji.includes(c)))],...((reason.includes('SPELLING_MARKED_KANA')||raw?.type==='spelling')?{rule:'stem must contain the exact marker 【'+(source?.reading??'source.reading')+'】; source.reading must be kana; the ENTIRE stem allows only Hiragana, Katakana, punctuation, symbols, numbers, whitespace and ー; no kanji or Latin.'}:{})};
}
export const draftPassOrder=()=>Array.from({length:6},(_,pass)=>Array.from({length:7},(_,day)=>({pass,day}))).flat();
export type DaySeed={questions:Draft[];audit:Audit[];rejected?:{position:number;reason:string;raw?:Draft}[];repairCounts?:Record<number,number>};
export async function generateDraftDay({week,day,catalog,history=[],seed,lexicon,repairLimit=2,onCheckpoint=()=>{}}:{week:string;day:number;catalog:Source[];history?:Question[];seed?:DaySeed;lexicon?:ReadonlySet<string>;repairLimit?:number;onCheckpoint?:(value:unknown)=>void},provider:Provider){
 const slots=draftSlots(day,catalog),knownKanji=[...new Set(catalog.flatMap(s=>[...s.title,...s.reading??'']).filter(c=>/\p{Script=Han}/u.test(c)))];
 const publicCatalog=catalog.map(s=>({...s,answerTitle:plainJapanese(s.title)}));
 const accepted=new Map<number,Question>(),audits=new Map<number,Audit>(),raws=new Map<number,Draft>(),reasons=new Map<number,string>();
 const rejectedAttempts:{round:number;positions:number[]}[]=[],hardRejected:{round:number;position:number;reason:string}[]=[],semanticRejected:{round:number;position:number;reason:string}[]=[];
 let repairs=0;const repairCounts={...seed?.repairCounts};requireValue(Number.isInteger(repairLimit)&&repairLimit>=0&&repairLimit<=5,"INVALID_REPAIR_LIMIT");for(const r of seed?.rejected??[]){if(r.raw)raws.set(r.position,r.raw);reasons.set(r.position,r.reason);}
 const checkpoint=()=>onCheckpoint({mode:DRAFT_MODE,day,questions:[...accepted.values()].sort((a,b)=>a.position-b.position),audit:[...audits.entries()].sort(([a],[b])=>a-b).map(([position,a])=>({...a,index:position})),rejected:[...reasons].map(([position,reason])=>({position,reason,raw:raws.get(position)})),hardRejected,semanticRejected,repairCounts,repairs});
 async function assess(rows:unknown,expected:number[],round:number,priorAudit?:Audit[]){
  requireValue(Array.isArray(rows)&&rows.length===expected.length&&new Set(rows.map((q:Draft)=>q.position)).size===expected.length&&rows.every((q:Draft)=>expected.includes(q.position)),'REPAIR_CHANGED_ACCEPTED_SLOT');
  const pending:Question[]=[];
  for(const raw of rows as Draft[]){raws.set(raw.position,raw);try{
   requireValue(raw.day===day&&raw.type===slots[raw.position].type,'SLOT_TYPE_MISMATCH');
   const q=validateQuestion(raw,catalog,week,'N5',[...history,...accepted.values(),...pending]);if(lexicon){const issues=[...strictDraftIssues(q,lexicon),...draftCollisionIssues(q,[...history,...accepted.values(),...pending],catalog)];requireValue(!issues.length,'STRICT_QA_'+issues.join(','));}
   if(priorAudit){const old=priorAudit.find(a=>a.index===raw.position);if(old){try{(lexicon?validateIndependent:validateAudit)([{...old,index:0}],[q]);accepted.set(q.position,q);audits.set(q.position,old);reasons.delete(q.position);continue;}catch{ /* recheck a previous semantic reject */ }}}
   pending.push(q);reasons.delete(raw.position);
  }catch(e){const reason=e instanceof Error?e.message:'INVALID_QUESTION';reasons.set(raw.position,reason);hardRejected.push({round,position:raw.position,reason});}}
  checkpoint();
  if(pending.length){const checked=lexicon?await reviewIndependently(provider,pending,publicCatalog):await provider('verify',lexicon?independentPrompt:verificationPrompt,{mode:DRAFT_MODE,level:'N5',catalog:publicCatalog,questions:lexicon?independentPayload(pending):pending.map((q,index)=>({...q,index}))},lexicon?{...independentSchema,minItems:pending.length,maxItems:pending.length}:schemaFor(auditSchema,pending.length));
   requireValue(Array.isArray(checked)&&checked.length===pending.length,'INCOMPLETE_SEMANTIC_QA');const seen=new Set<number>();
   for(const a of checked as Audit[]){requireValue(Number.isInteger(a.index)&&a.index>=0&&a.index<pending.length&&!seen.has(a.index),'INVALID_QA_INDEX');seen.add(a.index);const q=pending[a.index];try{(lexicon?validateIndependent:validateAudit)([{...a,index:0}],[q]);accepted.set(q.position,q);audits.set(q.position,a);reasons.delete(q.position);}catch(e){const reason=lexicon?'SEMANTIC_QA_REJECTED:'+(e instanceof Error?e.message:'INVALID_AUDIT'):'SEMANTIC_QA_REJECTED';reasons.set(q.position,reason);semanticRejected.push({round,position:q.position,reason});}}
  }
  checkpoint();
 }
 const payload=(positions:number[])=>({mode:DRAFT_MODE,week,day,level:'N5',roadmapWeeks:[1,2],knownKanji,slots:slots.filter(s=>positions.includes(s.position)),repairPositions:positions,catalog:publicCatalog,rejectionReasons:Object.fromEntries(positions.map(position=>[position,repairEvidence(raws.get(position),catalog,reasons.get(position)??'MISSING_POSITION')])),history:[...history,...accepted.values()].map(q=>q.stem)});
 const positions=slots.map(s=>s.position);
 if(seed){requireValue(seed.questions.length<=10,'INVALID_DRAFT_SEED');await assess(seed.questions,seed.questions.map(q=>q.position),0,seed.audit);}
 else await assess(await provider('generate',generationPrompt,payload(positions),schemaFor(questionSchema,10)),positions,0);
 while(accepted.size<10&&repairs<repairLimit){const bad=positions.filter(p=>!accepted.has(p)&&(repairCounts[p]??0)<5);if(!bad.length)break;for(const p of bad)repairCounts[p]=(repairCounts[p]??0)+1;checkpoint();rejectedAttempts.push({round:repairs,positions:bad});const next=await provider('generate',generationPrompt,payload(bad),schemaFor(questionSchema,bad.length));repairs++;await assess(next,bad,repairs);}
 const rejectedPositions=positions.filter(p=>!accepted.has(p));if(rejectedPositions.length)rejectedAttempts.push({round:repairs,positions:rejectedPositions});
 const questions=[...accepted.values()].sort((a,b)=>a.position-b.position),audit=questions.map((q,index)=>({...audits.get(q.position)!,index}));
 if(!rejectedPositions.length){validateDayDrafts(questions,catalog,week,'N5',day,history);validateAudit(audit,questions);}
 return {mode:DRAFT_MODE,day,questions,audit,repairs,rejectedAttempts,hardRejected,semanticRejected,repairCounts,rejectedPositions,rejected:[...reasons].map(([position,reason])=>({position,reason,raw:raws.get(position)})),accepted:rejectedPositions.length===0};
}

export async function generateRoadmapDraft({snapshotPath,receiptPath,week,directory,model,provider,initialSeed,modelChain,onDay=()=>{}}:{snapshotPath:string;receiptPath:string;week:string;directory:string;model:string;provider:Provider;initialSeed?:DaySeed;modelChain?:string[];onDay?:(value:unknown)=>void}){
 const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));requireValue(receipt.read_only===true&&path.resolve(receipt.path)===path.resolve(snapshotPath),'FROZEN_SNAPSHOT_RECEIPT_REQUIRED');
 const checksum=createHash('sha256');for await(const bytes of fs.createReadStream(snapshotPath))checksum.update(bytes);requireValue(checksum.digest('hex')===receipt.sha256,'SNAPSHOT_HASH_CHANGED');
 requireValue((fs.statSync(snapshotPath).mode&0o222)===0,'SNAPSHOT_MUST_BE_READ_ONLY');fs.mkdirSync(directory,{recursive:true});
 const db=openContentDatabase(snapshotPath);let catalog:Source[];let lexicon:Set<string>;try{lexicon=new Set(sourceCatalog(db).filter(s=>s.kind!=="kanji").flatMap(s=>[plainJapanese(s.title),s.reading??""]).filter(Boolean));catalog=roadmapDraftCatalog(db);requireValue(catalog.some(s=>s.kind==='vocab')&&catalog.some(s=>s.kind==='grammar'),'EMPTY_ROADMAP_DRAFT_CATALOG');}finally{db.close();}
 const metadata={mode:DRAFT_MODE,week,level:'N5',roadmapWeeks:[1,2],learningEvidence:'roadmap_only_not_srs',answerEvidence:'hard-qa-source-options-v3 before independent semantic QA',snapshotSha256:receipt.sha256,model,verifierModel:model,...(modelChain?{modelIsPlan:true,modelChain,actualModelEvidence:'provider-attempts.jsonl; question-provenance.json'}:{}),promptHashes:draftPromptHashes,sourceHashes:Object.fromEntries(catalog.map(s=>[s.id,s.hash])),appPublished:false};
 const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});if(fs.existsSync(path.join(directory,'metadata.json')))requireValue(hash(JSON.parse(fs.readFileSync(path.join(directory,'metadata.json'),'utf8')))===hash(metadata),'DRAFT_RESUME_CONTEXT_CHANGED');write('metadata.json',metadata);
 const all:Question[]=[],audits:Audit[]=[];let rejects=0;const days=new Map<number,any>();for(let d=0;d<7;d++){const f=path.join(directory,`draft-day-${d+1}.json`);if(fs.existsSync(f))days.set(d,JSON.parse(fs.readFileSync(f,"utf8")));}
 for(const {pass,day} of draftPassOrder()){
  all.splice(0,all.length,...[...days.entries()].filter(([d])=>d!==day).flatMap(([,r])=>r.questions));
  const file=path.join(directory,`draft-day-${day+1}.json`),checkpointFile=path.join(directory,`checkpoint-day-${day+1}.json`);
  const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):undefined;
  let checkpoint=fs.existsSync(checkpointFile)?JSON.parse(fs.readFileSync(checkpointFile,'utf8')):undefined;
  const seed:DaySeed|undefined=checkpoint??(saved?{questions:saved.questions,rejected:saved.rejected,repairCounts:saved.repairCounts,audit:saved.audit.map((a:Audit)=>({...a,index:saved.questions[a.index].position}))}:day===0?initialSeed:undefined);
  let result;
  try{result=saved?.accepted?saved:await generateDraftDay({week,day,catalog,history:all,seed,lexicon,repairLimit:pass===0?0:1,onCheckpoint:value=>{checkpoint=value;write(`checkpoint-day-${day+1}.json`,value);}},provider);}
  catch(e){const error=e instanceof Error?e.message:'DRAFT_FAILED';const questions=all.length+(checkpoint?.questions.length??seed?.questions.length??0);write('status.json',{...metadata,status:/DAILY_BUDGET_REACHED|AI_HTTP_429:/.test(error)?'quota_stopped':'api_stopped',completedDays:day,questions,error});throw e;}
  days.set(day,result);write(`draft-day-${day+1}.json`,{...result,status:result.accepted?'complete':'partial'});rejects+=result.semanticRejected?.length??0;
  all.push(...result.questions);all.sort((a,b)=>a.day-b.day||a.position-b.position);
  write('status.json',{...metadata,status:'running',pass,questions:all.length,completedDays:[...days.values()].filter(r=>r.accepted).length,semanticRejectedAcrossAttempts:rejects});
  if(!result.accepted)continue;
  validateDayDrafts(result.questions,catalog,week,'N5',day,all.filter(q=>q.day!==day));validateAudit(result.audit,result.questions);
  if(day===0){const sample={...metadata,questions:all.slice(0,10)};write('review-first-day.json',sample);fs.writeFileSync(path.join(directory,'review-first-day.md'),'# JLPT draft_roadmap — chưa đưa vào app\n\n|Ngày|Nhật|Lựa chọn|Đáp án|Giải thích|\n|---|---|---|---|---|\n'+sample.questions.map(q=>`|${q.date}|${q.stem.replaceAll('|','/')}|${q.choices.join(' / ')}|${q.correct+1}|${q.explanation.replaceAll('|','/')}|`).join('\n'));}onDay({completedDays:day+1,questions:all.length});
 }
 if(all.length<70){write('status.json',{...metadata,status:'partial',questions:all.length,completedDays:[...days.values()].filter(r=>r.accepted).length,rejectedByDay:[...days].map(([day,r])=>({day,rejected:r.rejected,repairCounts:r.repairCounts}))});return {completed:false,questions:all.length};}
 audits.push(...[...days.entries()].sort(([a],[b])=>a-b).flatMap(([day,r])=>r.audit.map((a:Audit)=>({...a,index:a.index+day*10}))));
 validateDrafts(all,catalog,week,'N5');validateAudit(audits,all);write('draft-week.json',{...metadata,questions:all,audit:audits});const sample=[...all].sort((a,b)=>hash(week+a.id+'review').localeCompare(hash(week+b.id+'review'))).slice(0,30);write('review-sample.json',{...metadata,questions:sample});fs.writeFileSync(path.join(directory,'review-sample.md'),'# JLPT draft_roadmap — 30 câu, chờ tester, chưa đưa vào app\n\nModel: '+model+'\n\n|Ngày|Nhật|Lựa chọn|Đáp án|Giải thích|\n|---|---|---|---|---|\n'+sample.map(q=>`|${q.date}|${q.stem.replaceAll('|','/')}|${q.choices.join(' / ')}|${q.correct+1}|${q.explanation.replaceAll('|','/')}|`).join('\n'));write('review.feedback.json',{mode:DRAFT_MODE,results:all.map(q=>({id:q.id,severity:null,note:''}))});write('status.json',{...metadata,status:'awaiting_tester_review',completedDays:7,questions:70,semanticRejectedAcrossAttempts:rejects});return {completed:true,questions:70};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {values:v}=parseArgs({options:Object.fromEntries(['snapshot','receipt','week','config','output','seed'].map(k=>[k,{type:'string' as const}]))});requireValue(v.snapshot&&v.receipt&&v.week&&v.config&&v.output,'--snapshot --receipt --week --config --output required');const privateRoot=path.resolve('data/private'),relative=path.relative(privateRoot,path.resolve(v.output));requireValue(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'OUTPUT_MUST_BE_PRIVATE');
  const config=JSON.parse(fs.readFileSync(v.config,'utf8')),profiles=[config,...config.fallbacks??[]];fs.mkdirSync(v.output,{recursive:true});
  const provenanceFile=path.join(v.output,'question-provenance.json'),provenance:Record<string,unknown>=fs.existsSync(provenanceFile)?JSON.parse(fs.readFileSync(provenanceFile,'utf8')):{};
  let initialSeed:DaySeed|undefined;
  if(v.seed){const seed=JSON.parse(fs.readFileSync(v.seed,'utf8')),receipt=JSON.parse(fs.readFileSync(v.receipt,'utf8'));requireValue(seed.mode===DRAFT_MODE&&seed.week===v.week&&seed.snapshotSha256===receipt.sha256&&hash(seed.promptHashes)===hash(draftPromptHashes),'DRAFT_SEED_CONTEXT_CHANGED');initialSeed={questions:seed.questions,audit:seed.audit,rejected:seed.rejected,repairCounts:seed.repairCounts};for(const q of seed.questions)provenance[`${q.day}:${q.position}`]={retained:true,model:seed.model,questionHash:hash(q)};}
  const provider=independentProvider(profiles,config.ledgerFile??path.join(privateRoot,'jlpt-quota.json'),process.env.GEMINI_API_KEY??'',{onAttempt:(event,payload,output)=>{
   fs.appendFileSync(path.join(v.output!,'provider-attempts.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});console.log(JSON.stringify(event));
   if(event.status==='ok'){fs.writeFileSync(path.join(v.output!,`response-${Date.now()}-${event.phase}.json`),JSON.stringify({event,payload,output},null,2)+'\n',{mode:0o600});const rows=event.phase==='generate'?output:(payload as {questions:Draft[]}).questions;for(const q of rows as Draft[]){const slot=`${q.day}:${q.position}`;provenance[slot]={...(provenance[slot]??{}),[event.phase+'Model']:event.model,[event.phase+'Hash']:hash(q)};}fs.writeFileSync(provenanceFile,JSON.stringify(provenance,null,2)+'\n',{mode:0o600});}
  }});
  console.log(JSON.stringify(await generateRoadmapDraft({snapshotPath:v.snapshot,receiptPath:v.receipt,week:v.week,directory:v.output,model:config.model,modelChain:profiles.map(p=>p.model),initialSeed,provider,onDay:value=>console.log(JSON.stringify(value))})));
 }catch(e){console.error(e instanceof Error?e.message:'DRAFT_FAILED');process.exitCode=1;}
}
