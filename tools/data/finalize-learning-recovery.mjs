import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';import {parseArgs} from 'node:util';
import {publicPlan,validateResults,validateTerminology} from './mt-gemini.mjs';
import {compoundAssessment} from './learning-quality.mjs';import {auditLearning} from './learning-audit.mjs';
import {importCampaign} from './translation-campaign.mjs';import {need,sha,hash,privateWrite} from './core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>privateWrite(p,JSON.stringify(v,null,2)+'\n'),key=r=>sha({task:r.task,input:r.input});
export async function finalizeLearningRecovery({configPath,directory}){
 const cfg=read(configPath),campaign=cfg.directory,root=path.resolve(directory),statusPath=path.join(campaign,'status.json'),status=read(statusPath),completedPath=path.join(campaign,'learning-completed.json'),completed=read(completedPath),revalidated=[],manualPool=[];
 if(fs.existsSync(path.join(campaign,'campaign.lock'))){const lock=read(path.join(campaign,'campaign.lock'));let alive=true;try{process.kill(lock.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}need(!alive,'Worker still active; finalization requires idle worker');}
 const quotaBefore=hash(fs.readFileSync(cfg.learning.state_path));let data;
 for(const profile of cfg.accepted_profiles.filter(p=>path.basename(p.manifestPath)==='recovery-manifest.json')){
  const manifest=read(profile.manifestPath),dir=path.dirname(profile.manifestPath),auditFile=path.join(dir,'recovery-audit.json'),audit=read(auditFile);data=await publicPlan(profile.manifestPath,{cache:true});const requests=new Map(data.requests.map(r=>[r.request_id,r])),file=manifest.sources.find(s=>s.source_id===manifest.mt.source_id).files.find(f=>f.format==='mt-results'),resultsPath=path.resolve(dir,file.path),results=read(resultsPath);
  for(const m of read(path.join(dir,'manual-review.json')))manualPool.push({...m,audit});
  for(const attempt of [...audit].reverse())for(const rejected of attempt.rejected??[]){
   const request=requests.get(rejected.request_id);if(!request||request.task!=='han_viet'||revalidated.some(r=>r.request_id===request.request_id))continue;
   const existing=results.find(r=>r.request_id===request.request_id);if(!existing&&!status.learning.manual_review?.some(r=>r.context_key===key(request)))continue;
   const check=compoundAssessment(rejected.output,request.input,data.dictionaryReadings);if(check.issues.length||check.flags.length)continue;
   const row={request_id:request.request_id,output:rejected.output};validateResults([row],[request]);validateTerminology([row],[request]);need(attempt.http_status===200,'Cached response must be from a real successful call');if(existing&&sha(existing.output)!==sha(row.output))continue;
   if(!existing){results.push(row);completed.push({row,request,model:manifest.mt.model,manifest:profile.manifestPath,results:resultsPath});status.learning.done++;status.learning.deferred=status.learning.deferred.filter(k=>k!==key(request));status.learning.manual_review=status.learning.manual_review.filter(r=>r.context_key!==key(request));}
   revalidated.push({request_id:request.request_id,character:request.input.character,output:row.output,model:manifest.mt.model,previously_accepted:!!existing,source_audit:auditFile,source_audit_sha256:hash(fs.readFileSync(auditFile)),dictionary_evidence:data.dictionaryReadings.get(row.output.compound.word),reason:'Vietnamese word attested in pinned dictionary; no new AI call'});
  }
  if(revalidated.some(r=>r.source_audit===auditFile&&!r.previously_accepted)){write(resultsPath,results);file.sha256=hash(fs.readFileSync(resultsPath));write(profile.manifestPath,manifest);}
 }
 need(data,'Recovery profiles missing');write(path.join(root,'cached-revalidation.json'),revalidated);
 if(revalidated.some(r=>!r.previously_accepted))await importCampaign({...cfg.import,directory:root,profiles:[...cfg.accepted_profiles,...['sentences-primary','sentences-backup','learning'].map(role=>({manifestPath:path.join(campaign,role+'-manifest.json')}))]});
 write(completedPath,completed);status.learning.complete=status.learning.done===status.learning.total;status.learning.awaiting_manual_review=status.learning.manual_review.length>0;status.updated_at=new Date().toISOString();write(statusPath,status);
 const manual=status.learning.manual_review.map(m=>{const found=[...manualPool].reverse().find(r=>key(r.request)===m.context_key);const rejected=[...found?.audit??[]].reverse().flatMap(a=>a.rejected??[]).find(r=>r.request_id===m.request_id);return {...m,kanji:found?.request.input.character,english:found?.request.input.meanings_en,last_output:rejected?.output};});
 write(path.join(root,'manual-review.json'),manual);
 const db=new DatabaseSync(cfg.import.dbPath,{readOnly:true});let audit,corrections;
 try{audit=auditLearning(db,data.dictionaryReadings);need(db.prepare('PRAGMA quick_check').get().quick_check==='ok'&&!db.prepare('PRAGMA foreign_key_check').all().length,'DB integrity failed');corrections=Number(db.prepare("SELECT count(*) n FROM vi_translations WHERE status='selected' AND source_id='mt:manual' AND json_extract(context_json,'$.owner_correction')=1").get().n);}finally{db.close();}
 write(path.join(root,'audit-review.json'),audit);const esc=v=>String(v??'Cần duyệt tay').replaceAll('|','\\|').replaceAll('\n',' ');
 privateWrite(path.join(root,'audit-review.md'),'# Duyệt trước khi sửa hàng loạt\n\n| Kanji | Trường | Hiện tại | Đề xuất | Lý do |\n|---|---|---|---|---|\n'+audit.map(r=>'| '+[r.kanji,r.field,r.current,r.proposed,r.reason].map(esc).join(' | ')+' |').join('\n'));
 privateWrite(path.join(root,'manual-review.md'),'# Mục chưa được nhập, chờ tester\n\n| Kanji | Nghĩa Anh | Kết quả cuối | Lý do |\n|---|---|---|---|\n'+manual.map(r=>'| '+[r.kanji,r.english?.join('; '),r.last_output?.text_vi,r.reason].map(esc).join(' | ')+' |').join('\n'));
 write(path.join(root,'retranslate-han-viet.json'),{approval_required:true,requests:data.requests.filter(r=>r.task==='han_viet'&&audit.some(a=>a.item_id===r.input.item_id&&a.reason==='compound_meaning_not_vietnamese'))});
 need(hash(fs.readFileSync(cfg.learning.state_path))===quotaBefore,'Offline revalidation must not modify quota');
 const recoveryProfiles=new Set(cfg.accepted_profiles.filter(p=>path.basename(p.manifestPath)==='recovery-manifest.json').map(p=>path.resolve(p.manifestPath)));
 const summary={learning_complete:status.learning.complete,done:status.learning.done,total:status.learning.total,recovered:completed.filter(r=>r.manifest&&recoveryProfiles.has(path.resolve(r.manifest))).length,manual:manual.length,corrected_fields:corrections,audit_rows:audit.length,cached_revalidated:revalidated.length,finalization_api_calls:0,review:path.join(root,'audit-review.md'),manual_review:path.join(root,'manual-review.md'),deletions:[]};write(path.join(root,'summary.json'),summary);fs.appendFileSync(path.join(campaign,'monitor-actions.jsonl'),JSON.stringify({time:status.updated_at,action:'finalize_owner_recovery',...summary})+'\n');return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {values}=parseArgs({options:{config:{type:'string'},directory:{type:'string'}}});console.log(JSON.stringify(await finalizeLearningRecovery({configPath:values.config,directory:values.directory})));}
