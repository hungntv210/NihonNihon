import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {draftProvider,type DraftAttempt} from './draft-provider.ts';
const primary={model:'gemini-3.5-flash-lite',verifierModel:'gemini-3.5-flash-lite',requestsPerMinute:60000000,dailyBudget:400,timeoutMs:1000,maxOutputTokens:100};
const fallback={...primary,model:'gemini-3.1-flash-lite',verifierModel:'gemini-3.1-flash-lite'};
function setup(t:{after:(fn:()=>void)=>void}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-draft-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'quota.json');}
const success=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'[]'}]}}]});
test('503 backs off 30/60/120 seconds then stays on fallback, records actual model and charges every attempt',async t=>{
 const ledger=setup(t),waits:number[]=[],events:DraftAttempt[]=[],models:string[]=[];
 const provider=draftProvider([primary,fallback],ledger,'secret',{sleep:async ms=>{waits.push(ms);},onAttempt:e=>{events.push(e);},fetcher:async url=>{models.push(String(url));return models.length<=3?new Response('busy secret',{status:503}):success();}});
 assert.deepEqual(await provider('generate','',{},{}),[]);await provider('verify','',{},{});
 assert.deepEqual(waits,[30000,60000,120000]);assert.equal(models.length,5);assert.ok(models.slice(0,3).every(m=>m.includes(primary.model)));assert.ok(models.slice(3).every(m=>m.includes(fallback.model)));
 assert.equal(events[3].model,fallback.model);assert.equal(events[4].phase,'verify');assert.ok(events[0].error?.includes('[REDACTED]'));assert.ok(!JSON.stringify(events).includes('busy secret'));
 const counts=JSON.parse(fs.readFileSync(ledger,'utf8')).models;assert.equal(counts[primary.model].count,3);assert.equal(counts[fallback.model].count,2);
});
test('429 and local daily budget stop immediately without switching models',async t=>{
 const ledger=setup(t);let calls=0;const provider=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return new Response('quota',{status:429});},sleep:async()=>{assert.fail('quota must not retry');}});
 await assert.rejects(provider('generate','',{},{}),/AI_HTTP_429/);assert.equal(calls,1);
 const quota=draftProvider([{...primary,dailyBudget:2},fallback],ledger,'secret',{fetcher:async()=>{calls++;return success();}});
 await quota('generate','',{},{});await assert.rejects(quota('generate','',{},{}),/DAILY_BUDGET_REACHED/);assert.equal(calls,2);
});
test('both models unavailable stop after four calls and incomplete/schema output is never rescued as accepted',async t=>{
 const ledger=setup(t);let calls=0;const waits:number[]=[];
 const unavailable=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return new Response('busy',{status:503});},sleep:async ms=>{waits.push(ms);}});
 await assert.rejects(unavailable('generate','',{},{}),/AI_HTTP_503/);assert.equal(calls,4);assert.deepEqual(waits,[30000,60000,120000]);
 const broken=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return Response.json({candidates:[{finishReason:'MAX_TOKENS'}]});}});
 await assert.rejects(broken('generate','',{},{}),/AI_OUTPUT_INCOMPLETE/);assert.equal(calls,5);
});
test('a failed network fetch following a 503 resumes within the same request budget',async t=>{
 const ledger=setup(t),waits:number[]=[];let calls=0;
 const provider=draftProvider([primary],ledger,'secret',{sleep:async ms=>{waits.push(ms);},fetcher:async()=>{
  calls++;if(calls===1)return new Response('busy',{status:503});if(calls===2)throw new TypeError('fetch failed');return success();
 }});
 assert.deepEqual(await provider('verify','',{},{}),[]);assert.deepEqual(waits,[30000,60000]);
 assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).models[primary.model].count,3);
});
