import {backup} from 'node:sqlite';import {copyApprovedTargets} from './approved-targets.ts';import {roadmapDraftCatalog} from './draft-roadmap.ts';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';import {fileURLToPath} from 'node:url';
import {openContentDatabase} from '../../../core/content.ts';import {databasePath} from '../../../core/config.ts';
import {sourceCatalog} from './catalog.ts';import {hash,requireValue,type Question,type Audit} from './model.ts';import {validateApproved,importApproved,type ApprovedInput} from './approved-store.ts';import {storeDirectory} from './repository.ts';
export function approvedBundle(file:string):ApprovedInput{
 requireValue(path.resolve(file).replaceAll('\\','/').toLowerCase().includes('/data/private/'),'PRIVATE_INPUT_REQUIRED');
 const bytes=fs.readFileSync(file);requireValue(bytes.length<8_000_000,'INPUT_TOO_LARGE');const input=JSON.parse(bytes.toString('utf8')),directory=path.dirname(file),metadata=JSON.parse(fs.readFileSync(path.join(directory,'metadata.json'),'utf8'));
 requireValue(input.draft===true&&input.available===11&&input.questions?.length===11&&metadata.mode==='draft_roadmap'&&metadata.appPublished===false,'EXACT_APPROVED_DRAFT_REQUIRED');
 const accepted=new Map<string,{q:Question;a:Audit}>();for(let day=1;day<=7;day++){const result=JSON.parse(fs.readFileSync(path.join(directory,`draft-day-${day}.json`),'utf8'));for(const [i,q]of (result.questions as Question[]).entries())accepted.set(q.id,{q,a:result.audit[i]});}
 requireValue(accepted.size===11&&new Set(input.questions.map((q:Question)=>q.id)).size===11,'ACCEPTED_SET_MISMATCH');
 const audit=input.questions.map((q:Question,index:number)=>{const evidence=accepted.get(q.id);requireValue(evidence&&hash(evidence.q)===hash(q),'QUESTION_NOT_IN_ACCEPTED_SET');return {...evidence.a,index};});
 const events=['attempts.jsonl','provider-attempts.jsonl'].flatMap(name=>{const f=path.join(directory,name);return fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)):[];});
 const models=(phase:string)=>[...new Set(events.filter(e=>e.phase===phase&&e.status==='ok').map(e=>e.model as string))];const generated=models('generate'),verified=models('verify');requireValue(generated.length===1&&verified.length===1&&generated[0]!==verified[0],'UNAMBIGUOUS_ACTUAL_MODELS_REQUIRED');
 return {questions:input.questions,audit,sourceWeek:metadata.week,sourceHashes:metadata.sourceHashes,sourceSha256:createHash('sha256').update(bytes).digest('hex'),model:generated[0],verifierModel:verified[0],reviewer:'tester'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{input:{type:'string'},db:{type:'string'},store:{type:'string'},reviewer:{type:'string'},snapshot:{type:'string'}}});requireValue(values.input&&values.reviewer==='tester','--input PRIVATE_REVIEW_JSON --reviewer tester required');
 requireValue(values.snapshot,'--snapshot FROZEN_SQLITE required');
 const bundle=approvedBundle(values.input),snapshot=values.snapshot,receipt=JSON.parse(fs.readFileSync(snapshot+'.json','utf8')),metadata=JSON.parse(fs.readFileSync(path.join(path.dirname(values.input),'metadata.json'),'utf8'));
 const digest=createHash('sha256');for await(const chunk of fs.createReadStream(snapshot))digest.update(chunk);requireValue(receipt.read_only===true&&digest.digest('hex')===receipt.sha256&&receipt.sha256===metadata.snapshotSha256,'FROZEN_RECEIPT_MISMATCH');
 const db=openContentDatabase(snapshot),target=values.db??databasePath(),directory=values.store??storeDirectory();try{const catalog=roadmapDraftCatalog(db);validateApproved(bundle,catalog);fs.mkdirSync(directory,{recursive:true});const main=openContentDatabase(target);requireValue(path.resolve(target)!==path.resolve(snapshot),'DO_NOT_WRITE_FROZEN');const backupPath=path.join(directory,'before-approved-import-'+Date.now()+'.sqlite');try{await backup(main,backupPath);}finally{main.close();}
 const targetsInserted=copyApprovedTargets(db,target,bundle.questions.map(q=>q.targetId));const result=importApproved(bundle,catalog,directory);fs.writeFileSync(path.join(directory,'import-receipt.json'),JSON.stringify({...result,targetsInserted,snapshotSha256:receipt.sha256,inputSha256:bundle.sourceSha256,backupPath},null,2));console.log(JSON.stringify({...result,targetsInserted}));}finally{db.close();}
}
