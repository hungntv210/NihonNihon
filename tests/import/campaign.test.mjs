import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {prepare,runGemini,settings,PROMPT,PROMPT_V4,PROMPT_V5,PROMPT_V6_INITIAL,PROMPT_V6,promptFor} from '../../tools/data/mt-gemini.mjs';
import {rotateCampaign,acceptedCampaignCache,pendingCampaignRequests,importCampaign} from '../../tools/data/translation-campaign.mjs';
import {hash} from '../../tools/data/core.mjs';
const config={model:'gemini-test',prompt_version:'gemini-vi-hv-4',requests_per_minute:10,requests_per_day:20,daily_budget:17,max_output_tokens:4096};
const read=p=>JSON.parse(fs.readFileSync(p));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v));

test('v7 derives directly from v4 with one subject-pronoun rule and immutable earlier prompts',async()=>{
 assert.ok(PROMPT.startsWith(PROMPT_V4));assert.ok(!PROMPT.startsWith(PROMPT_V5));assert.equal((PROMPT.match(/Subject-pronoun rule:/g)??[]).length,1);assert.match(PROMPT,/only when that subject is explicitly present in reference_en/);assert.ok(!PROMPT.includes('Do not add a subject'));assert.ok(!PROMPT.includes('Owner clarification'));
 const current=settings({...config,prompt_version:'gemini-vi-hv-7'});assert.equal(current.prompt_sha256,hash(PROMPT));assert.equal(current.config.publicEnglishGlosses,true);assert.deepEqual(current.config.supersedes_prompt_versions,[]);
 const {properNamesEnabled,assertSentenceQuality}=await import('../../tools/data/translation-gate.mjs');
 const requests=[{request_id:'name',task:'translate',input:{ja:'キートンは来た。'}}],bad=[{request_id:'name',output:{text_vi:'Keaton đã đến.'}}];
 for(const version of ['gemini-vi-hv-6','gemini-vi-hv-7','gemini-vi-hv-8']){assert.equal(properNamesEnabled(version),true);assert.throws(()=>assertSentenceQuality(bad,requests,version),/quality gate/);}
 assert.equal(properNamesEnabled('gemini-vi-hv-5'),false);
});

test('v5 preserves all v4 glossary rules and pins historical prompt hashes separately',()=>{
 assert.ok(PROMPT_V5.startsWith(PROMPT_V4));assert.match(PROMPT_V5,/Do not add a subject/);assert.match(PROMPT_V5,/恐縮/);assert.match(PROMPT_V5,/xin lỗi vì làm phiền/);
 assert.equal(settings(config).prompt_sha256,hash(PROMPT_V4));assert.equal(promptFor(config).text,PROMPT_V4);
 const next=settings({...config,prompt_version:'gemini-vi-hv-5'});assert.equal(next.prompt_sha256,hash(PROMPT_V5));assert.deepEqual(next.config.supersedes_prompt_versions,[]);
 const original=settings({...config,prompt_version:'gemini-vi-hv-6'});assert.equal(original.prompt_sha256,hash(PROMPT_V6_INITIAL));assert.ok(!original.config.promptRevision);
 const v6=settings({...config,prompt_version:'gemini-vi-hv-6',prompt_revision:2});assert.ok(PROMPT_V6.startsWith(PROMPT_V5));assert.equal(v6.prompt_sha256,hash(PROMPT_V6));assert.notEqual(v6.prompt_sha256,original.prompt_sha256);assert.equal(v6.config.promptRevision,2);assert.notEqual(v6.prompt_sha256,next.prompt_sha256);assert.deepEqual(v6.config.supersedes_prompt_versions,[]);assert.match(PROMPT_V6,/longest matching/);assert.match(PROMPT_V6,/proper names/);assert.match(PROMPT_V6,/unspecified full glass/);assert.match(PROMPT_V6,/～ませんか/);assert.match(PROMPT_V6,/～てきた/);assert.match(PROMPT_V6,/～ていく/);assert.match(PROMPT_V6,/subject pronoun supported by reference_en is acceptable/);
 assert.throws(()=>settings({...config,prompt_version:'unknown'}),/Unsupported/);
});

test('offline v5 rotation excludes every accepted context, retains releases and carries quota holds',async t=>{
 const f=fixture(t),oldRoot=path.join(f.dir,'old'),newRoot=path.join(f.dir,'v5');fs.mkdirSync(oldRoot);
 const profiles={};let clock=Date.now();
 for(const [role,route]of [['sentences-primary','sentences'],['sentences-backup','sentences'],['learning','learning']]){
  const prefix=path.join(oldRoot,role),c={...config,route,state_path:path.join(f.dir,route+'-quota.json')};
  const p={config:c,manifestPath:prefix+'-manifest.json',requestsPath:prefix+'-requests.json',resultsPath:prefix+'-results.json'};
  await prepare({manifestPath:f.manifestPath,config:c,outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});
  if(role!=='sentences-backup')await runGemini({...p,limit:1,ai:{models:{generateContent:async params=>({text:JSON.stringify(JSON.parse(params.contents).map(r=>({request_id:r.request_id,output:{text_vi:'Bản dịch đã nhận'}})))})}},now:()=>clock,sleep:async ms=>{clock+=ms;}});
  profiles[role]=p;
 }
 const cache=path.join(f.dir,'cache.json'),q=path.join(f.dir,'cache-requests.json');write(cache,[]);write(q,{version:1,requests:[]});
 const cfg={directory:oldRoot,sentence_base:f.manifestPath,learning_base:f.manifestPath,sentence_cache:cache,learning_cache:{requests:q,results:cache},sentence_primary:profiles['sentences-primary'].config,sentence_backup:profiles['sentences-backup'].config,learning:profiles.learning.config,probe:{...config,model:'gemini-probe',state_path:path.join(f.dir,'probe-quota.json')}};
 const state={sentences:{hold_day:'2026-11-07',reviews:[{sample_id:'review-0001',from_count:0,to_count:1}]},learning:{finished_day:'2026-11-07'},probe:{started:true,result:{status:'api_error',error_status:503}}};write(path.join(oldRoot,'status.json'),state);
 const sample={version:1,sample_id:'review-0001',rows:[{request_id:'sample'}]},feedback={version:1,sample_id:'review-0001',results:[{request_id:'sample',severity:null,note:''}]};write(path.join(oldRoot,'review-0001.json'),sample);write(path.join(oldRoot,'review-0001.feedback.json'),feedback);fs.writeFileSync(path.join(oldRoot,'review-0001.md'),'Unreviewed sample');
 const cfgPath=path.join(f.dir,'config.json'),outputConfig=path.join(f.dir,'v5-config.json');write(cfgPath,cfg);
 const untouched=[cfgPath,path.join(oldRoot,'status.json'),...Object.values(profiles).flatMap(p=>[p.manifestPath,p.resultsPath]),...new Set(Object.values(profiles).map(p=>p.config.state_path))];
 const before=untouched.map(p=>hash(fs.readFileSync(p)));
 const report=await rotateCampaign({configPath:cfgPath,outputConfig,directory:newRoot,promptVersion:'gemini-vi-hv-5'});
 assert.deepEqual(untouched.map(p=>hash(fs.readFileSync(p))),before);assert.equal(report.counts.sentences.cached,1);assert.equal(report.counts.sentences.pending,0);assert.equal(report.counts.learning.cached,1);assert.equal(report.accepted_contexts_queued,0);
 const next=read(outputConfig),cached=await acceptedCampaignCache(next);assert.equal(cached.sentenceDone.size,1);assert.equal(cached.learningDone.size,1);
 for(const role of Object.keys(profiles)){
  const queue=read(path.join(newRoot,role+'-requests.json')).requests;
  assert.deepEqual(pendingCampaignRequests(queue,cached.sentenceDone,cached.learningDone),queue);
  assert.equal(read(path.join(newRoot,role+'-manifest.json')).mt.prompt_version,'gemini-vi-hv-5');
  assert.deepEqual(read(path.join(newRoot,role+'-results.json')),[]);
 }
 const checkpoint=read(path.join(newRoot,'status.json'));assert.equal(checkpoint.sentences.hold_day,state.sentences.hold_day);assert.equal(checkpoint.learning.finished_day,state.learning.finished_day);assert.deepEqual(checkpoint.probe,state.probe);assert.deepEqual(report.quota_paths,[cfg.sentence_primary.state_path,cfg.sentence_backup.state_path,cfg.learning.state_path,cfg.probe.state_path]);
 assert.deepEqual(read(path.join(newRoot,'review-0001.feedback.json')),feedback);assert.equal(fs.readFileSync(path.join(newRoot,'review-0001.md'),'utf8'),'Unreviewed sample');
 const imports=[...next.accepted_profiles,...Object.keys(profiles).map(role=>({manifestPath:path.join(newRoot,role+'-manifest.json')}))];
 await importCampaign({baseManifest:profiles['sentences-primary'].manifestPath,profiles:imports,directory:newRoot,dbPath:f.dbPath});
 const db=f.open(),rows=db.prepare("SELECT r.manifest_json,t.status FROM vi_translations t JOIN source_releases r USING(release_id) WHERE t.method='machine'").all();
 assert.equal(rows.length,2);assert.ok(rows.every(r=>JSON.parse(r.manifest_json).prompt_version==='gemini-vi-hv-4'));assert.ok(rows.every(r=>r.status==='selected'));
 await assert.rejects(()=>rotateCampaign({configPath:cfgPath,outputConfig,directory:newRoot}),/already exist/);
 const v6Root=path.join(f.dir,'v6'),v6Config=path.join(f.dir,'v6-config.json');
 const second=await rotateCampaign({configPath:outputConfig,outputConfig:v6Config,directory:v6Root});
 assert.equal(second.prompt_version,'gemini-vi-hv-7');assert.equal(second.accepted_contexts_queued,0);assert.equal(second.counts.sentences.cached,1);assert.deepEqual(read(path.join(v6Root,'status.json')).probe,state.probe);
 assert.equal(read(path.join(v6Root,'sentences-primary-manifest.json')).mt.prompt_version,'gemini-vi-hv-7');assert.deepEqual(untouched.map(p=>hash(fs.readFileSync(p))),before);
});
