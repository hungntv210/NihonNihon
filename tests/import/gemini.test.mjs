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
