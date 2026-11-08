import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {runGemini,prepare,settings,quotaDay,nextPacificReset,validateResults,publicPlan,PROMPT_VERSION} from './mt-gemini.mjs';
import {inspectBatch,summarizeGate} from './translation-gate.mjs';
import {stratifiedSample} from './review-sample.mjs';
import {privateWrite,sha,hash,need} from './core.mjs';
import {runImport} from './import.mjs';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>privateWrite(p,JSON.stringify(v,null,2)+'\n');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const context=r=>sha({task:r.task,input:r.input});

// Accepted files retain their original request IDs, prompt and model releases.
export async function acceptedProfileRows(profiles){
 const rows=[];
 for(const p of profiles){
  const manifest=read(p.manifestPath),mt=manifest.mt,file=manifest.sources.find(s=>s.source_id===mt.source_id)?.files.find(f=>f.format==='mt-results');need(file,'Missing accepted MT artifact');
  const results=path.resolve(path.dirname(p.manifestPath),file.path);need(hash(fs.readFileSync(results))===file.sha256,'Accepted result checksum mismatch');
  const requests=new Map((await publicPlan(p.manifestPath,{cache:true})).requests.map(r=>[r.request_id,r]));
  for(const row of read(results)){const request=requests.get(row.request_id);need(request,'Accepted output has unknown provenance');validateResults([row],[request]);rows.push({row,request,model:mt.model,manifest:p.manifestPath,results});}
 }
 return rows;
}
export function pendingCampaignRequests(requests,sentenceDone,learningDone){
 return requests.filter(r=>r.task==='translate'&&r.input.field==='text'?!sentenceDone.has(r.input.ja.normalize('NFC')):!learningDone.has(context(r)));
}

export async function acceptedCampaignCache(cfg){
 const sentenceDone=new Map(),learningDone=new Map(),acceptedProfiles=cfg.accepted_profiles??[];
  for(const row of read(cfg.sentence_cache))sentenceDone.set(row.ja.normalize('NFC'),row);
  const oldQueue=new Map(read(cfg.learning_cache.requests).requests.map(r=>[r.request_id,r]));
  const legacyManifest=cfg.learning_cache.manifest?read(cfg.learning_cache.manifest):cfg.import?.baseManifest?read(cfg.import.baseManifest):null;
  const legacyConfigs=[legacyManifest?.mt,...legacyManifest?.mt_profiles??[]].filter(Boolean);
  for(const row of read(cfg.learning_cache.results)){const request=oldQueue.get(row.request_id);need(request,'Unknown learning cache request');const mt=legacyConfigs.find(c=>request.mt_release_id===`${c.source_id}:config:${sha(c).slice(0,32)}`);learningDone.set(context(request),{row,request,model:mt?.model??null,mt_config:mt??null,manifest:cfg.learning_cache.manifest??cfg.import?.baseManifest??null,legacy:true});}

  for(const v of await acceptedProfileRows(acceptedProfiles)){if(v.request.task==='translate'&&v.request.input.field==='text')sentenceDone.set(v.request.input.ja.normalize('NFC'),{ja:v.request.input.ja,request_id:v.row.request_id,output:v.row.output,model:v.model,manifest:v.manifest});else learningDone.set(context(v.request),{...v,legacy:true});}

 return {sentenceDone,learningDone};
}

// Offline rotation: never edit accepted artifacts, quota ledgers, or the old checkpoint.
export async function rotateCampaign({configPath,outputConfig,directory,promptVersion=PROMPT_VERSION}){
 const cfg=read(configPath),oldRoot=path.resolve(cfg.directory),root=path.resolve(directory);
 need(root!==oldRoot&&!fs.existsSync(root)&&!fs.existsSync(outputConfig),'Rotation outputs already exist');
 need(!fs.existsSync(path.join(oldRoot,'campaign.lock')),'Stop worker and verify stale lock before rotation');
 const state=read(path.join(oldRoot,'status.json'));
 const next={...cfg,directory,accepted_profiles:[...cfg.accepted_profiles??[],...['sentences-primary','sentences-backup','learning'].map(role=>({manifestPath:path.join(cfg.directory,role+'-manifest.json')}))]};
 for(const role of ['sentence_primary','sentence_backup','learning','probe'])next[role]={...cfg[role],prompt_version:promptVersion};
 const {sentenceDone,learningDone}=await acceptedCampaignCache(next);fs.mkdirSync(root,{recursive:true});
 const counts={sentences:{cached:sentenceDone.size},learning:{cached:learningDone.size}};
 for(const [role,key,base]of [['sentences-primary','sentence_primary','sentence_base'],['sentences-backup','sentence_backup','sentence_base'],['learning','learning','learning_base']]){
  const prefix=path.join(root,role),p={config:next[key],manifestPath:prefix+'-manifest.json',requestsPath:prefix+'-requests.json',resultsPath:prefix+'-results.json'};
  await prepare({config:p.config,manifestPath:next[base],outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});
  const full=read(p.requestsPath).requests.filter(r=>p.config.route==='sentences'?r.task==='translate'&&r.input.field==='text':r.task==='han_viet'||r.input.field!=='text');
  const pending=pendingCampaignRequests(full,sentenceDone,learningDone);write(p.requestsPath,{version:1,requests:pending});
  const c=counts[p.config.route];c.total=full.length;c.pending=pending.length;need(c.total-c.pending===c.cached,'Accepted cache is outside campaign source plan');
 }
 state.rotated_from=cfg.directory;state.prompt_version=promptVersion;delete state.status;delete state.stopping;delete state.error;
 state.sentences={...state.sentences,done:counts.sentences.cached};state.learning={...state.learning,done:counts.learning.cached};
 write(path.join(root,'status.json'),state);write(path.join(root,'sentences-completed.json'),[...sentenceDone.values()]);write(path.join(root,'learning-completed.json'),[...learningDone.values()]);
 const report={prompt_version:promptVersion,counts,accepted_profiles:next.accepted_profiles,quota_paths:['sentence_primary','sentence_backup','learning','probe'].map(k=>next[k].state_path),holds:{sentences:state.sentences.hold_day,learning:state.learning.finished_day,probe_started:state.probe.started},accepted_contexts_queued:0};
 write(path.join(root,'rotation-report.json'),report);write(outputConfig,next);return report;
}

export async function importCampaign({baseManifest,profiles,directory,dbPath}){
 const manifest=read(baseManifest),base=path.dirname(path.resolve(baseManifest)),root=path.resolve(directory);
 // Keep the manifest beside its base: raw record keys include these relative paths.
 const configs=new Map([manifest.mt,...manifest.mt_profiles??[]].filter(Boolean).map(c=>[sha(c),c]));
 const source=manifest.sources.find(s=>s.source_id==='mt:google-gemini');need(source,'Missing Gemini source');
 for(const f of source.files)if(f.format==='mt-results')f.mt_config_sha256??=sha(manifest.mt);
 for(const p of profiles){const m=read(p.manifestPath),c=m.mt;configs.set(sha(c),c);const file=m.sources.find(s=>s.source_id===c.source_id).files.find(f=>f.format==='mt-results');
  const local=path.resolve(path.dirname(p.manifestPath),file.path);need(hash(fs.readFileSync(local))===file.sha256,'Campaign result checksum mismatch');
  source.files.push({...file,path:path.relative(base,local),mt_config_sha256:sha(c)});
 }
 // The approved campaign covers every public N2–N5 record, not just the pilot cohort.
 manifest.cohort={};manifest.mt=read(profiles.find(p=>read(p.manifestPath).mt.config.route==='learning')?.manifestPath??profiles[0].manifestPath).mt;
 // Profile order preserves accepted output priority; unchanged fields keep their release.
 manifest.mt_profiles=[...new Map([...profiles.map(p=>read(p.manifestPath).mt),...configs.values()].map(c=>[sha(c),c])).values()];
 const manifestPath=path.join(base,path.basename(root)+'-import-manifest.json');need(manifestPath!==path.resolve(baseManifest),'Import would overwrite base manifest');write(manifestPath,manifest);
 return runImport({manifestPath,dbPath,reportPath:path.join(root,'import-report.json'),requestsPath:path.join(root,'remaining-requests.json')});
}

export async function runCampaign(configPath){
 const cfg=read(configPath),root=path.resolve(cfg.directory);fs.mkdirSync(root,{recursive:true});
 const lock=path.join(root,'campaign.lock'),fd=fs.openSync(lock,'wx',0o600);
 const statusPath=path.join(root,'status.json'),state=fs.existsSync(statusPath)?read(statusPath):{started_at:new Date().toISOString(),sentences:{},learning:{},probe:{}};
 const save=()=>{state.updated_at=new Date().toISOString();write(statusPath,state);};
 const auditPath=path.join(root,'audit.json'),audit=fs.existsSync(auditPath)?read(auditPath):[];let stopping=false;
 fs.writeFileSync(fd,JSON.stringify({pid:process.pid,started_at:state.started_at}));
 const stop=()=>{stopping=true;state.stopping=true;save();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 const emit=value=>console.log(JSON.stringify(value));
 for(const [role,entry]of [['learning',state.learning.last_result],['probe',state.probe.result]])if(entry)emit({event:'checkpoint_result',role,model:entry.model??state.probe.model,status:entry.status,error_status:entry.error_status??null});
 async function profile(role,base,config){
  const prefix=path.join(root,role),p={config,manifestPath:prefix+'-manifest.json',requestsPath:prefix+'-requests.json',resultsPath:prefix+'-results.json'};
  if(!fs.existsSync(p.manifestPath))await prepare({config,manifestPath:base,outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});
  need(sha(read(p.manifestPath).mt)===sha(settings(config)),'Prepared profile mismatch');
  p.requests=(await publicPlan(p.manifestPath,{cache:true})).requests;
  return p;
 }
 async function call(p,batch,size,maxCalls){
  write(p.requestsPath,{version:1,requests:batch});
  const result=await runGemini({...p,limit:batch.length,batchSize:size,maxCalls,validateOutput:(rows,requests)=>{
   if(p.config.route==='sentences'){const qa=inspectBatch(JSON.stringify(rows),requests,{properNames:p.config.prompt_version==='gemini-vi-hv-6'});need(!qa.items.length,'Sentence quality gate');}
  },onAttempt:a=>{
   emit({event:'api_attempt',role:p.config.route,model:a.model,call:a.call,http_status:a.http_status,error_kind:a.error_kind??null,validation_error:a.validation_error??null});
   audit.push({model:a.model,http_status:a.http_status,error_kind:a.error_kind??null,validation_error:a.validation_error??null,request_ids:a.requests.map(r=>r.request_id),qa:a.http_status===200&&p.config.route==='sentences'?inspectBatch(a.text,a.requests,{properNames:p.config.prompt_version==='gemini-vi-hv-6'}):null});
   write(path.join(root,'audit.json'),audit);
   if(a.validation_error){write(path.join(root,'rejected-'+p.config.model+'.json'),{model:a.model,reason:a.validation_error,requests:a.requests,response:a.text});}
  }});
  emit({role:p.config.route,model:p.config.model,sent:result.sent,calls:result.calls,status:result.status,error_status:result.error_status});
  return result;
 }
 const resultRows=p=>{const byId=new Map(p.requests.map(r=>[r.request_id,r]));return read(p.resultsPath).map(row=>({row,request:byId.get(row.request_id),model:p.config.model,manifest:p.manifestPath,results:p.resultsPath}));};
 const sentenceDone=new Map(),learningDone=new Map();
 try{
  const acceptedProfiles=cfg.accepted_profiles??[];
  const cached=await acceptedCampaignCache(cfg);for(const [k,v]of cached.sentenceDone)sentenceDone.set(k,v);for(const [k,v]of cached.learningDone)learningDone.set(k,v);
  const primary=await profile('sentences-primary',cfg.sentence_base,cfg.sentence_primary);
  const backup=await profile('sentences-backup',cfg.sentence_base,cfg.sentence_backup);
  const learning=await profile('learning',cfg.learning_base,cfg.learning);
  const profiles=[...acceptedProfiles,primary,backup,learning];
  const allSentences=primary.requests.filter(r=>r.task==='translate'&&r.input.field==='text');
  const allLearning=learning.requests.filter(r=>r.task==='han_viet'||r.input.field!=='text');
  need(new Set(allSentences.map(r=>r.input.ja)).size===allSentences.length,'Sentence queue is not deduplicated');
  for(const p of [primary,backup])for(const v of resultRows(p))if(v.request)sentenceDone.set(v.request.input.ja,{ja:v.request.input.ja,request_id:v.row.request_id,output:v.row.output,model:v.model,manifest:v.manifest});
  for(const v of resultRows(learning))if(v.request)learningDone.set(context(v.request),v);
  const sentOrder=read(cfg.sentence_order).requests,rank=new Map(sentOrder.map((r,i)=>[r.input.ja,i]));allSentences.sort((a,b)=>(rank.get(a.input.ja)??1e9)-(rank.get(b.input.ja)??1e9));
  state.sentences={...state.sentences,total:allSentences.length,done:sentenceDone.size};delete state.stopping;delete state.error;delete state.status;
  state.learning={...state.learning,total:allLearning.length,done:learningDone.size,not_before:cfg.learning_not_before};save();
  async function sentenceLoop(){
   while(!stopping){
    const day=quotaDay(Date.now()),pending=pendingCampaignRequests(allSentences,sentenceDone,learningDone);if(!pending.length){state.sentences.complete=true;save();return;}
    const deferred=state.sentences.deferred_day===day?new Set(state.sentences.deferred??[]):new Set();const ready=pending.filter(r=>!deferred.has(r.input.ja));
    if(state.sentences.hold_day===day||!ready.length){await sleep(Math.min(60000,nextPacificReset()-Date.now()+1000));continue;}
    const batch=ready.slice(0,30);let good=false,last;
    for(const p of [primary,backup]){
     if(stopping)return;const byJa=new Map(p.requests.map(r=>[r.input.ja,r])),tasks=batch.map(r=>byJa.get(r.input.ja));need(tasks.every(Boolean),'Fallback source mismatch');
     const result=await call(p,tasks,30,p===primary?1:3);last=result;
     for(const v of resultRows(p))if(v.request)sentenceDone.set(v.request.input.ja,{ja:v.request.input.ja,request_id:v.row.request_id,output:v.row.output,model:v.model,manifest:v.manifest});
     if(batch.every(r=>sentenceDone.has(r.input.ja))){good=true;break;}
     if(result.status!=='daily_limit')await sleep(5000);
    }
    state.sentences.done=sentenceDone.size;write(path.join(root,'sentences-completed.json'),[...sentenceDone.values()]);
    if(!good){if(last.status==='invalid_output'){state.sentences.deferred_day=day;state.sentences.deferred=[...deferred,...batch.map(r=>r.input.ja)];}else state.sentences.hold_day=day;}
    state.sentences.validation_failures=audit.filter(a=>[cfg.sentence_primary.model,cfg.sentence_backup.model].includes(a.model)&&a.validation_error).length;
    state.sentences.gate=summarizeGate(audit.filter(a=>a.qa||a.model===cfg.sentence_primary.model||a.model===cfg.sentence_backup.model),sentenceDone.size);save();
   }
  }
  async function learningLoop(){
   while(!stopping){
    const now=Date.now();if(now<Date.parse(cfg.learning_not_before)){state.learning.waiting_for_reset=true;save();await sleep(Math.min(60000,Date.parse(cfg.learning_not_before)-now));continue;}
    state.learning.waiting_for_reset=false;const day=quotaDay(now);
    if(!state.probe.started){
     const probe=await profile('probe38',cfg.learning_base,cfg.probe);const task=probe.requests.find(r=>r.task==='han_viet')??probe.requests.find(r=>r.input.field!=='text');
     state.probe={started:true,day,model:cfg.probe.model};save();
     state.probe.result=await call(probe,[task],20,1);save();
    }
    const pending=pendingCampaignRequests(allLearning,sentenceDone,learningDone);if(!pending.length){state.learning.complete=true;save();return;}
    if(state.learning.finished_day===day){await sleep(Math.min(60000,nextPacificReset()-now+1000));continue;}
    const deferred=state.learning.deferred_day===day?new Set(state.learning.deferred??[]):new Set(),ready=pending.filter(r=>!deferred.has(context(r)));
    if(!ready.length){state.learning.finished_day=day;save();continue;}
    const hv=ready.filter(r=>r.task==='han_viet'),other=ready.filter(r=>r.task!=='han_viet');const batch=[...hv.slice(0,20),...other.slice(0,60-Math.min(20,hv.length))];if(batch.length<60)batch.push(...hv.slice(20,20+60-batch.length));
    const result=await call(learning,batch,60,3);
    for(const v of resultRows(learning))if(v.request)learningDone.set(context(v.request),v);
    state.learning={...state.learning,done:learningDone.size,last_result:result};
    if(result.status==='invalid_output'){state.learning.deferred_day=day;state.learning.deferred=[...deferred,...batch.map(context)];}
    else if(result.status!=='complete')state.learning.finished_day=day;
    write(path.join(root,'learning-completed.json'),[...learningDone.values()]);save();
   }
  }
  const fail=error=>{stopping=true;state.error='Job failed; no raw API error logged';save();throw error;};
  const outcomes=await Promise.allSettled([sentenceLoop().catch(fail),learningLoop().catch(fail)]);
  if(outcomes.some(r=>r.status==='rejected')){state.status='blocked';save();return state;}
  if(stopping){state.status='stopped';save();return state;}
  need(state.sentences.complete&&state.learning.complete,'Campaign not complete');
  const storedQA=inspectBatch(JSON.stringify(allSentences.map(r=>({request_id:r.request_id,output:sentenceDone.get(r.input.ja).output}))),allSentences);
  state.sentences.stored_gate=storedQA;need(!storedQA.items.length&&!storedQA.schema_invalid&&!storedQA.missing,'Stored sentence QA failed');save();
  const provenance=read(cfg.sentence_provenance),oldJa=new Set(read(cfg.sentence_cache).map(r=>r.ja)),pool=[...sentenceDone.values()].filter(r=>!oldJa.has(r.ja)).map(r=>({level:provenance[r.ja].level,ja:r.ja,en:provenance[r.ja].english.join(' / '),vi:r.output.text_vi,model:r.model,request_id:r.request_id}));
  const sample=stratifiedSample(pool);write(path.join(root,'review-30-sentences.json'),sample);
  const hv=[...learningDone.values()].filter(v=>v.request.task==='han_viet'&&!v.legacy).slice(0,10);need(hv.length===10,'Need ten AI fallback examples');write(path.join(root,'review-10-han-viet.json'),hv);
  const esc=s=>String(s).replaceAll('|','\\|').replaceAll('\n','<br>');
  privateWrite(path.join(root,'review.md'),'# Translation campaign review\n\n| Level | Japanese | English | Vietnamese | Model | QA |\n| --- | --- | --- | --- | --- | --- |\n'+sample.map(r=>`| ${r.level} | ${esc(r.ja)} | ${esc(r.en)} | ${esc(r.vi)} | ${r.model} | Không phát hiện cờ |`).join('\n')+'\n\n## 10 ai_fallback\n\n| Kanji | Reading | Compound | Meaning | Evidence | Model |\n| --- | --- | --- | --- | --- | --- |\n'+hv.map(v=>`| ${v.request.input.character} | ${esc(v.row.output.text_vi)} | ${esc(v.row.output.compound.word)} | ${esc(v.row.output.meaning)} | ${esc(v.row.output.reason)} | ${v.model} |`).join('\n'));
  if(cfg.import){const probePath=path.join(root,'probe38-manifest.json');if(fs.existsSync(probePath))profiles.push({manifestPath:probePath});state.import=await importCampaign({...cfg.import,directory:root,profiles});save();}
  state.status='complete';save();emit({complete:true,sentences:sentenceDone.size,learning:learningDone.size,review:path.join(root,'review.md')});return state;
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {values:a}=parseArgs({options:{config:{type:'string'}}});need(a.config,'--config FILE required');const result=await runCampaign(a.config);if(result.status==='blocked')process.exitCode=1;}catch{console.error('Campaign stopped; checkpoint retained; no raw API error logged');process.exitCode=1;}
}
