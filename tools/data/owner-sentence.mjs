import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {hash,sha,need,privateWrite} from './core.mjs';
import {publicPlan,validateResults,validateTerminology} from './mt-gemini.mjs';
import {assertSentenceQuality} from './translation-gate.mjs';
import {acceptedCampaignCache,importCampaign} from './translation-campaign.mjs';
import {writeReviewCheckpoint} from './campaign-review.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>privateWrite(p,JSON.stringify(v,null,2)+'\n');
export async function ownerSentence({configPath,directory,ja,text_vi,reviewer}){
 need(reviewer==='owner','Explicit owner review required');const cfg=read(configPath),root=path.resolve(directory);need(!fs.existsSync(root),'Use a new private directory');
 const baseFile=path.join(path.resolve(cfg.directory),'sentences-primary-manifest.json'),base=read(baseFile);fs.mkdirSync(root,{recursive:true});
 for(const s of base.sources)for(const f of s.files)f.path=path.relative(root,path.resolve(path.dirname(baseFile),f.path));
 base.sources=base.sources.filter(s=>!s.source_id.startsWith('mt:'));delete base.mt_profiles;
 base.mt={source_id:'mt:manual',model:'manual',reviewer,prompt_version:'owner-reviewed-1',prompt_sha256:hash('Owner supplied translation; unchanged glossary and sentence QA'),max_attempts:1,config:{sentence_key:'ja-nfc-v1',route:'sentences'}};
 const resultsPath=path.join(root,'manual-results.json'),manifestPath=path.join(root,'manual-manifest.json');
 base.sources.push({source_id:'mt:manual',name:'Owner-reviewed manual translation',url:'local://owner',license:'Private owner translation',version:'1',attribution:'Owner',usage_scope:'private_only',files:[{path:'manual-results.json',format:'mt-results',sha256:hash('[]\n')}]});
 privateWrite(resultsPath,'[]\n');write(manifestPath,base);
 const request=(await publicPlan(manifestPath)).requests.find(r=>r.task==='translate'&&r.input.field==='text'&&r.input.ja===ja.normalize('NFC'));need(request,'Sentence is not in the public source plan');
 const row={request_id:request.request_id,output:{text_vi:text_vi.normalize('NFC')}};
 validateResults([row],[request]);validateTerminology([row],[request]);assertSentenceQuality([row],[request],'gemini-vi-hv-7');
 write(resultsPath,[row]);base.sources.at(-1).files[0].sha256=hash(fs.readFileSync(resultsPath));write(manifestPath,base);
 const profiles=[...cfg.accepted_profiles??[],...['sentences-primary','sentences-backup','learning'].map(role=>({manifestPath:path.join(path.resolve(cfg.directory),role+'-manifest.json')})),{manifestPath}];
 const flagsFile=path.join(cfg.directory,'translation-flags.json');const imported=await importCampaign({...cfg.import,profiles,directory:cfg.directory,flags:fs.existsSync(flagsFile)?read(flagsFile):[]});
 need(imported.db_committed,'Manual import did not commit');
 cfg.accepted_profiles=[...cfg.accepted_profiles??[],{manifestPath}];write(configPath,cfg);
 const cache=await acceptedCampaignCache(cfg);for(const role of ['sentences-primary','sentences-backup']){
  const m=path.join(cfg.directory,role+'-manifest.json'),manifest=read(m),file=manifest.sources.find(s=>s.source_id===manifest.mt.source_id).files.find(f=>f.format==='mt-results');const byId=new Map((await publicPlan(m,{cache:true})).requests.map(r=>[r.request_id,r]));
  for(const r of read(path.resolve(path.dirname(m),file.path))){const req=byId.get(r.request_id);if(req?.input.field==='text')cache.sentenceDone.set(req.input.ja,{ja:req.input.ja,request_id:r.request_id,output:r.output,model:manifest.mt.model,manifest:m});}
 }
 const rows=[...cache.sentenceDone.values()],stateFile=path.join(cfg.directory,'status.json'),state=read(stateFile);
 const all=(await publicPlan(baseFile,{cache:true})).requests.filter(r=>r.task==='translate'&&r.input.field==='text');need(all.every(r=>cache.sentenceDone.has(r.input.ja)),'Other sentences still missing');
 state.sentences.done=rows.length;state.sentences.complete=true;state.sentences.deferred=(state.sentences.deferred??[]).filter(v=>v!==ja);
 const review=writeReviewCheckpoint({directory:cfg.directory,state:state.sentences,rows,provenance:read(cfg.sentence_provenance),force:true});need(!review?.paused,'Previous review still pending');
 state.updated_at=new Date().toISOString();write(path.join(cfg.directory,'sentences-completed.json'),rows);write(stateFile,state);
 privateWrite(path.join(cfg.directory,'monitor-actions.jsonl'),fs.readFileSync(path.join(cfg.directory,'monitor-actions.jsonl'),'utf8')+JSON.stringify({at:state.updated_at,action:'owner_sentence_import',request_id:row.request_id,model:'manual',reviewer,manifestPath,review:review?.sample_id})+'\n');
 return {imported:true,model:'manual',reviewer,sentences:rows.length,review:review?.sample_id,manifestPath};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:Object.fromEntries(['config','directory','ja','text-vi','reviewer'].map(k=>[k,{type:'string'}]))});console.log(JSON.stringify(await ownerSentence({configPath:values.config,directory:values.directory,ja:values.ja,text_vi:values['text-vi'],reviewer:values.reviewer})));
}
