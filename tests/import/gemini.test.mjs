import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from './helpers.mjs';
import {prepare,runGemini,settings,validateResults} from '../../tools/data/mt-gemini.mjs';
const config={model:'gemini-test',requests_per_minute:10,requests_per_day:100,daily_budget:5,max_output_tokens:4096};
async function setup(t){const f=fixture(t);f.vocab.splice(0,1,...Array.from({length:25},(_,i)=>({...f.vocab[0],id:String(i+1).padStart(10,'0'),word:'公開'+i,examples:[]})));f.write('vocab.json',f.vocab);f.save();
const options={config,manifestPath:f.dir+'/gemini.json',requestsPath:f.dir+'/gemini-requests.json',resultsPath:f.dir+'/results.json',statePath:f.dir+'/quota.json'};
await prepare({manifestPath:f.manifestPath,config,outputManifest:options.manifestPath,requestsPath:options.requestsPath,resultsPath:options.resultsPath});return {f,options};}
const fake=response=>({models:{generateContent:response}});
const output=params=>JSON.parse(params.contents).map(r=>({request_id:r.request_id,output:{text_vi:'tiếng Việt'}}));

test('Gemini pilot sends at most 20 verified public requests, normalizes NFC, pins output, resumes',async t=>{
const {f,options}=await setup(t);let count=0;
const queue=JSON.parse(fs.readFileSync(options.requestsPath));queue.requests.push({request_id:'private',task:'translate',input:{item_id:'user-media:sentence:secret',ja:'private subtitle'}});fs.writeFileSync(options.requestsPath,JSON.stringify(queue));
const ai=fake(async p=>{count++;assert.equal(p.config.responseMimeType,'application/json');assert.ok(p.config.responseJsonSchema);assert.equal(p.config.httpOptions.retryOptions.attempts,1);assert.ok(!p.contents.includes('private subtitle'));return {text:JSON.stringify(output(p))};});
const first=await runGemini({...options,ai});assert.equal(first.sent,20);assert.equal(first.blocked_private_or_unverified,1);assert.equal(count,1);
const rows=JSON.parse(fs.readFileSync(options.resultsPath));assert.ok(rows.every(r=>r.output.text_vi===r.output.text_vi.normalize('NFC')));
let clock=Date.now();const second=await runGemini({...options,ai,now:()=>clock,sleep:async n=>{clock+=n;}});assert.equal(second.already_completed,20);assert.ok(second.sent>0);
assert.equal((await runGemini({...options,ai})).sent,0);
});

test('Gemini rejects tampered public payloads and wrong model configuration before sending',async t=>{
const {options}=await setup(t),queue=JSON.parse(fs.readFileSync(options.requestsPath));queue.requests[0].input.word='private replacement';fs.writeFileSync(options.requestsPath,JSON.stringify(queue));
const report=await runGemini({...options,ai:fake(async p=>({text:JSON.stringify(output(p))}))});assert.equal(report.blocked_private_or_unverified,1);
await assert.rejects(()=>runGemini({...options,config:{...config,model:'gemini-other'}}),/mismatch/);
assert.throws(()=>settings({model:'gemini-test'}),/Real rate limit/);
});

test('Gemini 429 backs off and daily quota stops without retrying or losing checkpoint',async t=>{
const {options}=await setup(t);let clock=Date.now(),calls=0;const pauses=[];
const ai=fake(async p=>{calls++;if(calls===1)throw {status:429,message:'per-minute retryDelay: 12s'};return {text:JSON.stringify(output(p))};});
const report=await runGemini({...options,ai,now:()=>clock,sleep:async n=>{pauses.push(n);clock+=n;}});assert.equal(report.sent,20);assert.ok(pauses.some(n=>n>=12000));
let dailyCalls=0;const daily=fake(async()=>{dailyCalls++;throw {status:429,message:'GenerateRequestsPerDay quota'};});
assert.equal((await runGemini({...options,ai:daily,now:()=>clock,sleep:async n=>{clock+=n;}})).status,'daily_limit');
assert.equal((await runGemini({...options,ai:daily,now:()=>clock})).status,'daily_limit');assert.equal(dailyCalls,1);
});

test('Gemini output rejects foreign IDs, missing evidence and out-of-list HV candidates',()=>{
const requests=[{request_id:'hv',task:'han_viet',input:{candidates:[{id:'x',reading:'nhật'}],compounds:[]}}];
const row={request_id:'hv',output:{text_vi:'nhật',candidate_id:'x',compound:{word:'日本',reading:'にほん'},meaning:'Nhật Bản',reason:'test',evidence_origin:'model-generated',references:[]}};
assert.equal(validateResults([row],requests).length,1);assert.throws(()=>validateResults([{...row,request_id:'other'}],requests));
assert.throws(()=>validateResults([{...row,output:{...row.output,candidate_id:'outside'}}],requests));
assert.throws(()=>validateResults([{...row,output:{text_vi:'nhật'}}],requests));
assert.throws(()=>validateResults([{...row,output:{...row.output,evidence_origin:'input'}}],requests));
});

test('Interactions enforces JSON schema, thinking, routing, and retries invalid JSON',async t=>{
 const {options}=await setup(t);const c={...config,api:'interactions',thinking_level:'medium',route:'learning',min_interval_ms:13000,tokens_per_minute:250000};
 const manifest=JSON.parse(fs.readFileSync(options.manifestPath));manifest.mt=settings(c);fs.writeFileSync(options.manifestPath,JSON.stringify(manifest));
 const {publicPlan}=await import('../../tools/data/mt-gemini.mjs');const plan=await publicPlan(options.manifestPath);fs.writeFileSync(options.requestsPath,JSON.stringify({version:1,requests:plan.requests}));
 let clock=Date.now(),calls=0;const pauses=[];
 const ai={interactions:{create:async(p,opts)=>{calls++;assert.equal(p.store,false);assert.equal(p.generation_config.thinking_level,'medium');assert.equal(p.response_format.mime_type,'application/json');assert.ok(p.response_format.schema);assert.equal(opts.maxRetries,0);const batch=JSON.parse(p.input);assert.ok(batch.every(r=>r.input.field!=='text'));
 if(calls===2)throw {statusCode:503,message:'temporarily unavailable'};return {output_text:calls===1?'bad JSON':JSON.stringify(batch.map(r=>({request_id:r.request_id,output:{text_vi:'Nghĩa thử'}})))};}}};
 const result=await runGemini({...options,config:c,ai,sleep:async n=>{pauses.push(n);clock+=n;},now:()=>clock});
 assert.equal(result.sent,20);assert.equal(result.invalid_outputs,1);assert.equal(calls,3);assert.ok(pauses.reduce((n,v)=>n+v,0)>=13000);
});

test('quota resumes on the next Pacific date and aliases share model identity',async t=>{
 const {options}=await setup(t);let clock=Date.parse('2026-11-06T07:55:00Z');let calls=0;
 const ai=fake(async p=>{calls++;return {text:JSON.stringify(output(p))};});
 const c={...config,daily_budget:1};await runGemini({...options,config:c,ai,now:()=>clock});
 assert.equal((await runGemini({...options,config:c,ai,now:()=>clock})).status,'daily_limit');
 clock=Date.parse('2026-11-06T08:05:00Z');const r=await runGemini({...options,config:c,ai,now:()=>clock});assert.ok(r.sent>0);assert.equal(calls,2);
 assert.equal(settings({...config,model:'models/gemini-test'}).model,'gemini-test');
});

test('503 stops after at most three calls, with waits in the 30-60 second range',async t=>{
 const {options}=await setup(t);let clock=Date.now(),calls=0;const pauses=[];
 const result=await runGemini({...options,config:{...config,max_api_attempts:4},limit:1,ai:fake(async()=>{calls++;throw {status:503};}),now:()=>clock,random:()=>0.5,sleep:async ms=>{pauses.push(ms);clock+=ms;}});
 assert.equal(calls,3);assert.equal(result.status,'api_error');assert.equal(result.error_status,503);assert.deepEqual(pauses,[32500,60000]);
});

test('fallback retries only unfinished contexts and records the actual model for every result',async t=>{
 const {f,options}=await setup(t);const {runChain}=await import('../../tools/data/mt-gemini-chain.mjs');const backup={...config,model:'gemini-backup',max_api_attempts:1};
 const second={config:backup,manifestPath:f.dir+'/backup-manifest.json',requestsPath:f.dir+'/backup-requests.json',resultsPath:f.dir+'/backup-results.json'};
 await prepare({config:backup,manifestPath:f.manifestPath,outputManifest:second.manifestPath,requestsPath:second.requestsPath,resultsPath:second.resultsPath});
 let clock=Date.now(),primaryCalls=0;const received=[];
 const ai=fake(async p=>{received.push({model:p.model,items:JSON.parse(p.contents)});if(p.model===config.model&&++primaryCalls===2)throw {status:503};return {text:JSON.stringify(output(p))};});
 const report=await runChain({profiles:[{...options,config:{...config,max_api_attempts:1}},second],limit:22,statePath:options.statePath,reportPath:f.dir+'/chain-report.json',ai,now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(report.remaining,0);assert.equal(report.results.filter(r=>r.model===config.model).length,20);assert.equal(report.results.filter(r=>r.model===backup.model).length,2);
 assert.equal(received.at(-1).items.length,2);assert.notEqual(received[1].items[0].request_id,received[2].items[0].request_id);
 assert.equal(JSON.parse(fs.readFileSync(second.manifestPath)).mt.model,backup.model);
 assert.equal(JSON.parse(fs.readFileSync(second.resultsPath)).length,2);
});

test('disabled model makes no API call even when invoked directly',async t=>{
 const {options}=await setup(t);const r=await runGemini({...options,config:{...config,enabled:false},ai:fake(async()=>{throw Error('Must not call');})});assert.equal(r.status,'model_disabled');assert.equal(r.calls,0);
});

test('mixed translation and Han Viet tasks share one API call with strict per-task validation',async t=>{
 const {f,options}=await setup(t);f.write('hv.json',[['日','nhật niết','','',[],{}]]);f.save();
 const configMixed={...config,mixed_tasks:true,api:'interactions',max_api_attempts:1};
 const paths={manifestPath:f.dir+'/mixed-manifest.json',requestsPath:f.dir+'/mixed-queue.json',resultsPath:f.dir+'/mixed-output.json'};
 await prepare({manifestPath:f.manifestPath,config:configMixed,outputManifest:paths.manifestPath,requestsPath:paths.requestsPath,resultsPath:paths.resultsPath});
 const q=JSON.parse(fs.readFileSync(paths.requestsPath));q.requests=[q.requests.find(r=>r.task==='translate'),q.requests.find(r=>r.task==='han_viet')];fs.writeFileSync(paths.requestsPath,JSON.stringify(q));let calls=0;
 const ai={interactions:{create:async p=>{calls++;assert.equal(p.response_format.schema.items.anyOf.length,2);return {output_text:JSON.stringify(JSON.parse(p.input).map(r=>({request_id:r.request_id,output:r.task==='translate'?{text_vi:'nghĩa thử'}:{text_vi:r.input.candidates[0].reading,candidate_id:r.input.candidates[0].id,compound:{word:'日本',reading:'にほん'},meaning:'Nhật Bản',reason:'test',evidence_origin:'model-generated',references:[]}})))};}}};
 const result=await runGemini({...paths,config:configMixed,statePath:f.dir+'/mixed-state.json',limit:2,ai});assert.equal(calls,1);assert.equal(result.sent,2);
});

test('terminology validation rejects cảm cúm and flattened humble speech',async()=>{
 const {validateTerminology}=await import('../../tools/data/mt-gemini.mjs');const q=[{request_id:'cold',task:'translate',input:{ja:'風邪は伝染する。'}},{request_id:'visit',task:'translate',input:{ja:'明日伺います。'}}];
 assert.throws(()=>validateTerminology([{request_id:'cold',output:{text_vi:'Cảm cúm lây truyền.'}}],q),/influenza/);assert.throws(()=>validateTerminology([{request_id:'visit',output:{text_vi:'Ngày mai tôi sẽ đến.'}}],q),/Humble/);
 validateTerminology([{request_id:'cold',output:{text_vi:'Bệnh cảm có thể lây.'}},{request_id:'visit',output:{text_vi:'Ngày mai tôi xin phép đến.'}}],q);
});

test('global call cap stops before another request and audits every response',async t=>{
 const {options}=await setup(t);let calls=0;const attempts=[];const result=await runGemini({...options,limit:25,maxCalls:1,ai:fake(async p=>{calls++;return {text:JSON.stringify(output(p))};}),onAttempt:r=>attempts.push(r)});
 assert.equal(calls,1);assert.equal(result.calls,1);assert.equal(result.status,'request_limit');assert.equal(result.sent,20);assert.equal(attempts.length,1);assert.equal(attempts[0].http_status,200);
});
