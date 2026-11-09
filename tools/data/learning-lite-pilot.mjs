import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {parseArgs} from 'node:util';
import {prepare,publicPlan,runGemini} from './mt-gemini.mjs';import {acceptedCampaignCache,pendingCampaignRequests} from './translation-campaign.mjs';import {randomSample} from './campaign-review.mjs';import {need,privateWrite} from './core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>privateWrite(p,JSON.stringify(v,null,2)+'\n');
export function renderLearningReview(id,rows){
 const esc=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n','<br>');
 return '# '+id+'\n\nChưa duyệt; mẫu ngẫu nhiên. Chưa nhập DB.\n\n| # | Kanji / Nhật | Âm Hán Việt | Anh nguồn | Nghĩa Việt | Nguồn / model | Căn cứ |\n| --- | --- | --- | --- | --- | --- | --- |\n'+rows.map((r,i)=>`| ${i+1} | ${esc(r.request.input.character??r.request.input.word??r.request.input.ja)} | ${esc(r.request.task==='han_viet'?r.output.text_vi:'')} | ${esc((r.request.input.meanings_en??[]).join(', '))} | ${esc(r.output.meaning??r.output.text_vi)} | mt:google-gemini / ${r.model} | ${esc(r.output.reason??'')} |`).join('\n')+'\n';
}
export function pilotRequests(requests,cache,mode='mixed'){const pending=pendingCampaignRequests(requests,cache.sentenceDone,cache.learningDone);if(mode==='meaning'){const rows=pending.filter(r=>r.task==='translate'&&r.input.field==='meaning'&&r.input.character);need(rows.length>=60,'Need60 pending kanji meanings');return rows.slice(0,60);}const hv=pending.filter(r=>r.task==='han_viet'),other=pending.filter(r=>r.task==='translate'&&r.input.field!=='text');need(hv.length>=20&&other.length>=40,'Pilot needs at least20 pending Han Viet and40 other learning requests');return [...hv.slice(0,20),...other.slice(0,40)];}
export function learningSample(rows,mode='mixed'){const unique=items=>randomSample(items.map(r=>({...r,ja:r.row.request_id})),items.length);let sample;if(mode==='meaning'){need(rows.length>=30,'Need30 accepted meanings for review');sample=unique(rows).slice(0,30);}else{const hv=rows.filter(r=>r.request.task==='han_viet'),other=rows.filter(r=>r.request.task!=='han_viet');need(hv.length>=10&&other.length>=20,'Need10 accepted Han Viet and20 other items for review');sample=[...unique(hv).slice(0,10),...unique(other).slice(0,20)];}return sample.map(r=>({request_id:r.row.request_id,request:r.request,output:r.row.output,model:r.model,manifest:r.manifest}));}
export async function learningLitePilot({configPath,directory,ai,mode='mixed'}){
 need(['mixed','meaning'].includes(mode),'Unsupported pilot mode');
 const cfg=read(configPath),root=path.resolve(directory);need(!fs.existsSync(root),'Use a new private pilot directory');fs.mkdirSync(root,{recursive:true});
 const live=path.resolve(cfg.directory),base=path.join(live,'learning-manifest.json'),profiles=[];
 for(const [role,previous]of [['primary',cfg.sentence_primary],['backup',cfg.sentence_backup]]){
  const config={...previous,name:'learning-lite',route:mode==='meaning'?'meaning':'learning',prompt_version:'gemini-vi-hv-7',...(mode==='meaning'?{prompt_variant:'lite-meaning-1',kanji_meaning_qa:true}:{}),batch_size:30,timeout_ms:120000,thinking_level:'low',mixed_tasks:true,max_compounds_sent:12,max_api_attempts:3,state_path:path.resolve(previous.state_path)};delete config.fallback_model;
  const p={config,manifestPath:path.join(root,role+'-manifest.json'),requestsPath:path.join(root,role+'-requests.json'),resultsPath:path.join(root,role+'-results.json')};await prepare({manifestPath:base,config,outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});p.requests=(await publicPlan(p.manifestPath,{cache:true})).requests;profiles.push(p);
 }
 const cache=await acceptedCampaignCache({...cfg,accepted_profiles:[...cfg.accepted_profiles??[],{manifestPath:base}]});const wanted=pilotRequests(profiles[0].requests,cache,mode),accepted=[],rejected=[],runs=[],audit=[];
 for(let batch=0;batch<2;batch++){
  const original=wanted.slice(batch*30,(batch+1)*30),done=new Set(),deferred=new Set();
  for(const p of profiles){const key=r=>JSON.stringify({task:r.task,input:r.input}),byKey=new Map(p.requests.map(r=>[key(r),r])),tasks=original.filter(r=>!done.has(key(r))&&!deferred.has(key(r))).map(r=>byKey.get(key(r)));if(!tasks.length)break;
   write(p.requestsPath,{version:1,requests:tasks});const result=await runGemini({...p,ai,limit:tasks.length,batchSize:30,maxCalls:3,onAttempt:a=>{const event={batch:batch+1,model:a.model,http_status:a.http_status,error_message:a.error_message??null,validation_error:a.validation_error??null,rejected:a.rejected??[]};audit.push(event);write(path.join(root,'audit.json'),audit);console.log(JSON.stringify(event));}});runs.push({batch:batch+1,...result});write(path.join(root,'runs.json'),runs);
   const byId=new Map(tasks.map(r=>[r.request_id,r]));for(const row of read(p.resultsPath)){const request=byId.get(row.request_id);if(request&&!done.has(key(request))){done.add(key(request));accepted.push({request,row,model:p.config.model,manifest:p.manifestPath});}}
   for(const row of result.rejected??[]){const request=byId.get(row.request_id);deferred.add(key(request));rejected.push({request,model:p.config.model,...row});}
  }
 }
 write(path.join(root,'accepted.json'),accepted);write(path.join(root,'rejected.json'),rejected);
 const sampleId=mode==='meaning'?'review-learning-0002':'review-learning-0001',rows=learningSample(accepted,mode);write(path.join(root,sampleId+'.json'),{version:1,sample_id:sampleId,rows});write(path.join(root,sampleId+'.feedback.json'),{version:1,sample_id:sampleId,results:rows.map(r=>({request_id:r.request_id,severity:null,note:''}))});
 privateWrite(path.join(root,sampleId+'.md'),renderLearningReview(sampleId,rows));
 const report={status:'review_required',batches:2,requested:60,requested_han_viet:wanted.filter(r=>r.task==='han_viet').length,accepted:accepted.length,rejected:rejected.length,review:path.join(root,sampleId+'.md'),db_imported:false};write(path.join(root,'pilot-report.json'),report);return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {values}=parseArgs({options:{config:{type:'string'},directory:{type:'string'},mode:{type:'string'}}});console.log(JSON.stringify(await learningLitePilot({configPath:values.config,directory:values.directory,mode:values.mode})));}
