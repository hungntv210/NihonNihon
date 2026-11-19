import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {draftProvider,type DraftAttempt} from './draft-provider.ts';
const primary={model:'gemini-3.6-flash',verifierModel:'gemini-3.6-flash',requestsPerMinute:60000000,dailyBudget:200,timeoutMs:1000,maxOutputTokens:100};
const fallback={...primary,model:'gemini-4-carbon',verifierModel:'gemini-4-carbon'};
function setup(t:{after:(fn:()=>void)=>void}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-draft-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'quota.json');}
const success=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'[]'}]}}]});
test('503 switches immediately, stays on fallback, records actual model and charges every attempt',async t=>{
 const ledger=setup(t),waits:number[]=[],events:DraftAttempt[]=[],models:string[]=[];
 const provider=draftProvider([primary,fallback],ledger,'secret',{sleep:async ms=>{waits.push(ms);},onAttempt:e=>{events.push(e);},fetcher:async url=>{models.push(String(url));return models.length===1?new Response('busy secret',{status:503}):success();}});
 assert.deepEqual(await provider('generate','',{},{}),[]);await provider('verify','',{},{});
 assert.deepEqual(waits,[]);assert.equal(models.length,3);assert.ok(models[0].includes(primary.model));assert.ok(models.slice(1).every(m=>m.includes(fallback.model)));
 assert.equal(events[1].model,fallback.model);assert.equal(events[2].phase,'verify');assert.ok(events[0].error?.includes('[REDACTED]'));assert.ok(!JSON.stringify(events).includes('busy secret'));
 const counts=JSON.parse(fs.readFileSync(ledger,'utf8')).models;assert.equal(counts[primary.model].count,1);assert.equal(counts[fallback.model].count,2);
});
test('429 switches but local shared daily budget stops without another HTTP request',async t=>{
 const ledger=setup(t);let calls=0;const provider=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return calls===1?new Response('quota',{status:429}):success();},sleep:async()=>{assert.fail('HTTP overload switches without a sleep');}});
 await provider('generate','',{},{});assert.equal(calls,2);
 const quota=draftProvider([{...primary,dailyBudget:2},fallback],ledger,'secret',{fetcher:async()=>{calls++;return success();}});
 await assert.rejects(quota('generate','',{},{}),/SHARED_DAILY_BUDGET_REACHED/);assert.equal(calls,2);
});
test('exhausted chain stops after each model, and incomplete/schema output is never rescued',async t=>{
 const ledger=setup(t);let calls=0;const waits:number[]=[];
 const unavailable=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return new Response('busy',{status:503});},sleep:async ms=>{waits.push(ms);}});
 await assert.rejects(unavailable('generate','',{},{}),/DRAFT_MODELS_EXHAUSTED/);assert.equal(calls,2);assert.deepEqual(waits,[]);
 const broken=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return Response.json({candidates:[{finishReason:'MAX_TOKENS'}]});}});
 await assert.rejects(broken('generate','',{},{}),/AI_OUTPUT_INCOMPLETE/);assert.equal(calls,3);
});
test('repeated timeouts switch after one bounded retry without increasing the timeout',async t=>{
 const ledger=setup(t),waits:number[]=[];let calls=0;
 const provider=draftProvider([primary,fallback],ledger,'secret',{sleep:async ms=>{waits.push(ms);},fetcher:async()=>{
  calls++;if(calls<=2)throw new DOMException('timeout','TimeoutError');return success();
 }});
 assert.deepEqual(await provider('verify','',{},{}),[]);assert.deepEqual(waits,[30000]);
 assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).models[primary.model].count,2);
});
test('200-call budget is shared across models and cross-verification calls, and Lite cannot enter the chain',async t=>{
 const ledger=setup(t),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());fs.writeFileSync(ledger,JSON.stringify({models:{[primary.model]:{day,count:199,last:0}}}));let calls=0;
 const provider=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return new Response('busy',{status:503});}});
 await assert.rejects(provider('verify','',{},{}),/SHARED_DAILY_BUDGET_REACHED/);assert.equal(calls,1);
 assert.throws(()=>draftProvider([{...primary,model:'gemini-fixture-lite',verifierModel:'gemini-fixture-lite'}],ledger,'secret'),/NON_LITE/);
 await assert.rejects(provider('verify','',{}, {},{excludeModels:[primary.model,fallback.model]}),/NO_DIFFERENT_VERIFIER/);assert.equal(calls,1);
});
