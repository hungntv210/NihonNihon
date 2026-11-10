import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {prepare,runGemini,publicPlan} from './mt-gemini.mjs';
import {importCampaign} from './translation-campaign.mjs';
import {sha,need,privateWrite} from './core.mjs';
import {auditLearning} from './learning-audit.mjs';
import {normalizeGrammar} from './learning-quality.mjs';
import {runCorrectionImport} from './import.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>privateWrite(p,JSON.stringify(v,null,2)+'\n'),key=r=>sha({task:r.task,input:r.input});
export async function recoverDeferred(requests,{attempt,done=new Set(),manual=[],save=()=>{}}){
 for(let round=1;round<=2;round++)for(let i=0;i<requests.length;i+=10){const batch=requests.slice(i,i+10).filter(r=>!done.has(r.request_id)&&!manual.some(m=>m.request_id===r.request_id));if(!batch.length)continue;const result=await attempt(batch,round);for(const id of result.accepted??[])done.add(id);if(round===2)for(const r of batch)if(!done.has(r.request_id))manual.push({request_id:r.request_id,request:r,reason:result.rejected?.find(x=>x.request_id===r.request_id)?.reason??result.status??'unresolved_after_two_attempts'});save({done:[...done],manual,round});if(['daily_limit','api_error','rate_limited'].includes(result.status))return {done,manual,blocked:result.status};}
 return {done,manual};
}
export async function runLearningRecovery({configPath,directory,task}){
 const cfg=read(configPath),campaign=path.resolve(cfg.directory),root=path.resolve(directory),status=read(path.join(campaign,'status.json'));
 if(fs.existsSync(path.join(campaign,'campaign.lock'))){const lock=read(path.join(campaign,'campaign.lock'));let alive=true;try{process.kill(lock.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}need(!alive,'Worker still active; do not interrupt');}
 need(cfg.learning.model==='gemini-3.5-flash-lite'&&cfg.disable_probe,'Recovery requires approved Lite model and disabled probe');
 if(fs.existsSync(path.join(root,'summary.json'))&&!read(path.join(root,'summary.json')).blocked)return read(path.join(root,'summary.json'));
 const all=(await publicPlan(path.join(campaign,'learning-manifest.json'),{cache:true})).requests,deferred=new Set(status.learning.deferred??[]);let requests=all.filter(r=>deferred.has(key(r)));
 need(requests.length===deferred.size,'Deferred queue mismatch');
 if(task){need(task==='han_viet','Only approved task filter is han_viet');requests=requests.filter(r=>r.task===task);}
 fs.mkdirSync(root,{recursive:true});const lock=path.join(root,'recovery.lock'),fd=fs.openSync(lock,'wx');
 try{
 const files={manifestPath:path.join(root,'recovery-manifest.json'),requestsPath:path.join(root,'recovery-requests.json'),resultsPath:path.join(root,'recovery-results.json')};
 const config={...cfg.learning,max_api_attempts:1,prompt_variant:fs.existsSync(files.manifestPath)?read(files.manifestPath).mt.config.promptVariant:'lite-meaning-2'};
 if(!fs.existsSync(files.manifestPath))await prepare({manifestPath:cfg.learning_base,config,outputManifest:files.manifestPath,requestsPath:files.requestsPath,resultsPath:files.resultsPath});
 const approved=await publicPlan(files.manifestPath,{cache:true}),byContext=new Map(approved.requests.map(r=>[key(r),r]));const pending=requests.map(r=>{const match=byContext.get(key(r));need(match,'Deferred public provenance missing');return match;});
 const stateFile=path.join(root,'recovery-state.json'),state=fs.existsSync(stateFile)?read(stateFile):{done:[],manual:[]};const auditFile=path.join(root,'recovery-audit.json'),audit=fs.existsSync(auditFile)?read(auditFile):[];
 const result=await recoverDeferred(pending,{done:new Set(read(files.resultsPath).map(r=>r.request_id)),manual:state.manual,save:s=>write(stateFile,s),attempt:async(batch,round)=>{
  write(files.requestsPath,{version:1,requests:batch});const response=await runGemini({...files,config,statePath:cfg.learning.state_path,batchSize:10,limit:10,maxCalls:1,meaningRecoveryAttempt:round,onAttempt:e=>{audit.push({...e,recovery_round:round});write(auditFile,audit);}});
  return {...response,accepted:read(files.resultsPath).map(r=>r.request_id)};
 }});
 write(path.join(root,'manual-review.json'),result.manual);
 if(result.blocked){write(path.join(root,'summary.json'),{learning_complete:false,blocked:result.blocked,manual:result.manual.length});return {blocked:result.blocked};}
 const profiles=[...cfg.accepted_profiles,...['sentences-primary','sentences-backup','learning'].map(role=>({manifestPath:path.join(campaign,role+'-manifest.json')})),{manifestPath:files.manifestPath}];
 await importCampaign({...cfg.import,directory:root,profiles,flags:audit.flatMap(a=>(a.flagged??[]).map(({request_id,reason})=>({request_id,reason})))});
 const db=new DatabaseSync(cfg.import.dbPath,{readOnly:true});let auditRows,patches;
 try{
  auditRows=auditLearning(db,approved.dictionaryReadings);write(path.join(root,'audit-review.json'),auditRows);
  privateWrite(path.join(root,'audit-review.md'),'# Cần tester duyệt trước sửa hàng loạt\n\n| Kanji | Trường | Hiện tại | Đề xuất | Lý do |\n|---|---|---|---|---|\n'+auditRows.map(r=>[r.kanji,r.field,r.current,r.proposed??'Cần duyệt tay',r.reason].map(s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ')).join(' | ')).map(s=>'| '+s+' |').join('\n'));
  write(path.join(root,'retranslate-han-viet.json'),{approval_required:true,requests:all.filter(r=>auditRows.some(a=>a.item_id===r.input.item_id&&a.reason==='compound_meaning_not_vietnamese'))});
  const targets={委:{han_viet:'ủy'},抱:{han_viet:'bão'},吸:{meaning:null}};
  patches=db.prepare("SELECT k.character,t.* FROM kanji k JOIN vi_translations t USING(item_id) WHERE t.status='selected' AND k.character IN ('委','抱','吸')").all().flatMap(r=>{if(!Object.hasOwn(targets[r.character],r.field))return [];const text=targets[r.character][r.field]??r.text_vi.replace(/(?<!\p{L})bút(?!\p{L})/gu,'mút');return text===r.text_vi?[]:[{item_id:r.item_id,field:r.field,text_vi:text,expected_translation_id:r.translation_id,reason:'Explicit owner correction 2026-11-10'}];});
  for(const r of db.prepare("SELECT t.* FROM grammar g JOIN vi_translations t USING(item_id) WHERE t.status='selected'").all()){const text=normalizeGrammar(r.text_vi);if(text!==r.text_vi)patches.push({item_id:r.item_id,field:r.field,text_vi:text,expected_translation_id:r.translation_id,reason:'Owner glossary: thể từ điển'});}
 }finally{db.close();}
 const correctionsPath=path.join(root,'owner-corrections.json');write(correctionsPath,{reviewer:'owner',reason:'Explicit corrections and grammar terminology requested 2026-11-10',rows:patches});
 if(patches.length)await runCorrectionImport({dbPath:cfg.import.dbPath,correctionsPath,reportPath:path.join(root,'owner-import-report.json'),backupDirectory:path.join(root,'backups')});
 const acceptedByContext=new Map(read(files.resultsPath).map(r=>[key(approved.requests.find(q=>q.request_id===r.request_id)),r]));
 const acceptedOriginal=requests.filter(r=>acceptedByContext.has(key(r))),oldComplete=read(path.join(campaign,'learning-completed.json'));
 for(const r of acceptedOriginal){const row=acceptedByContext.get(key(r));oldComplete.push({request:approved.requests.find(q=>q.request_id===row.request_id),row,model:config.model,manifest:files.manifestPath,results:files.resultsPath});}
 write(path.join(campaign,'learning-completed.json'),oldComplete);const current=read(path.join(campaign,'status.json'));current.learning.done+=acceptedOriginal.length;current.learning.deferred=current.learning.deferred.filter(k=>!acceptedOriginal.some(r=>key(r)===k));current.learning.complete=current.learning.done===current.learning.total;current.learning.manual_review=[...(current.learning.manual_review??[]).filter(r=>!requests.some(q=>key(q)===r.context_key)),...result.manual.map(r=>({request_id:r.request_id,context_key:key(r.request),reason:r.reason}))];current.learning.awaiting_manual_review=current.learning.manual_review.length>0;current.updated_at=new Date().toISOString();write(path.join(campaign,'status.json'),current);
 const nextConfig=read(configPath);if(!nextConfig.accepted_profiles.some(p=>path.resolve(p.manifestPath)===files.manifestPath)){nextConfig.accepted_profiles.push({manifestPath:files.manifestPath});write(configPath,nextConfig);}
 fs.appendFileSync(path.join(campaign,'monitor-actions.jsonl'),JSON.stringify({time:current.updated_at,action:'owner_deferred_recovery',accepted:acceptedOriginal.length,manual:result.manual.length,corrections:patches.length,model:config.model,deletions:[]})+'\n');
 const check=new DatabaseSync(cfg.import.dbPath,{readOnly:true});try{need(check.prepare('PRAGMA quick_check').get().quick_check==='ok'&&!check.prepare('PRAGMA foreign_key_check').all().length,'DB integrity failed');}finally{check.close();}
 const report={learning_complete:current.learning.complete,done:current.learning.done,total:current.learning.total,recovered:acceptedOriginal.length,manual:current.learning.manual_review.length,corrections:patches.length,audit_rows:auditRows.length,review:path.join(root,'audit-review.json'),manual_review:path.join(root,'manual-review.json'),deletions:[lock]};write(path.join(root,'summary.json'),report);return report;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {values}=parseArgs({options:{config:{type:'string'},directory:{type:'string'},task:{type:'string'}}});console.log(JSON.stringify(await runLearningRecovery({configPath:values.config,directory:values.directory,task:values.task})));}
