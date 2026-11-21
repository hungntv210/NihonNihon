import test,{type TestContext} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {draftProvider,modelEvidence,semanticSchema,validateSemanticReview,type DraftAttempt} from './draft-provider.ts';
import {freeCompletion,freeModels,freeProviderStatus,groqRateLimitUntil,readFreeKeys} from './free-provider.ts';
import {verifyDeterministic} from './v2-verifier.ts';
import {choiceSentence} from './independent-qa.ts';
import type {V2Question} from './deterministic.ts';
const primary={model:'gemini-3.6-flash',verifierModel:'gemini-3.6-flash',requestsPerMinute:60000000,dailyBudget:200,timeoutMs:1000,maxOutputTokens:100};
const fallback={...primary,model:'gemini-4-carbon',verifierModel:'gemini-4-carbon'};
function setup(t:{after:(fn:()=>void)=>void}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-draft-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'quota.json');}
const success=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'[]'}]}}]});
const freeSuccess=(result:unknown=[])=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({result})}}]});
test('Qwen reviews the proposed meaning and grammar separately from the blind payload',async t=>{
 const claim={index:0,type:'grammar',sentence:'fixture sentence',explanation:'Đề xuất'};
 const review=[{index:0,meaningCorrect:false,grammarLabelCorrect:true}];
 const seen:unknown[]=[];
 const provider=draftProvider([primary],setup(t),'fake',{freeKeys:{groq:'fake',groqFreeTier:true},fetcher:async(url,init)=>{
  if(String(url).includes('googleapis'))return new Response(null,{status:429});
  const body=JSON.parse(String(init?.body));
  assert.equal(body.model,seen.length===0?freeModels.groqSolver:freeModels.groqReview);
  seen.push(JSON.parse(body.messages[1].content));
  if(seen.length===1)return freeSuccess();
  assert.ok(body.messages[0].content.includes(JSON.stringify(semanticSchema)));
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({result:review})}}]});
 }});
 const output=await provider('verify','',{blind:true},{},{openjlptOnly:true,semanticReview:[claim]});
 assert.deepEqual(seen,[{blind:true},{claims:[claim]}]);
 assert.deepEqual(modelEvidence(output).semanticReview,review);
});
test('semantic review rejects incorrect types, omitted indexes and duplicate indexes',()=>{
 const verdict={index:0,meaningCorrect:true,grammarLabelCorrect:false};
 for(const bad of [{result:[verdict]},[],[null],[{...verdict,meaningCorrect:'true'}],[{...verdict,index:1}],[{index:0,meaningCorrect:true}]]){
  assert.throws(()=>validateSemanticReview(bad,[0]),/FREE_PROVIDER_INVALID_SEMANTIC_REVIEW/);
 }
 assert.throws(()=>validateSemanticReview([verdict,verdict],[0,1]),/FREE_PROVIDER_INVALID_SEMANTIC_REVIEW/);
 assert.deepEqual(validateSemanticReview([verdict],[0]),[verdict]);
});
test('OpenRouter rejects every model without the free suffix before using the network',t=>{
 const fetcher=async()=>{assert.fail('non-free model must never reach fetch');};
 for(const model of ['google/gemma-4-31b-it','openrouter/auto','openrouter/free','google/gemma-4-31b-it:free ']){
  assert.throws(()=>freeCompletion({...primary,provider:'openrouter',model,key:'fake',ledger:setup(t),fetcher}),/OPENROUTER_FREE_MODEL_REQUIRED/);
 }
});
test('Groq quota is shared across both models and preserves the Gemini ledger',async t=>{
 const {start}=fakeClock(t),ledger=setup(t),day=start.toISOString().slice(0,10);
 fs.writeFileSync(ledger,JSON.stringify({models:{[primary.model]:{day,count:11,last:0}},providers:{groq:{day,count:199}}}));
 let calls=0;
 const config={...primary,provider:'groq' as const,key:'fake',groqFreeTier:true,ledger,fetcher:async()=>{calls++;return freeSuccess();}};
 await freeCompletion({...config,model:freeModels.groqSolver})('',{},{});
 await assert.rejects(freeCompletion({...config,model:freeModels.groqReview})('',{},{}),/FREE_PROVIDER_DAILY_BUDGET_REACHED/);
 assert.equal(calls,1);
 assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).models[primary.model].count,11);
});
test('OpenRouter checks the key before completion and enforces 50 completions until UTC midnight',async t=>{
 const {start}=fakeClock(t),ledger=setup(t),day=start.toISOString().slice(0,10),paths:string[]=[];
 fs.writeFileSync(ledger,JSON.stringify({models:{},providers:{openrouter:{day,count:49}}}));
 const complete=freeCompletion({...primary,provider:'openrouter',model:freeModels.openrouter,key:'fake',ledger,fetcher:async(url,init)=>{
  const pathname=new URL(String(url)).pathname;
  paths.push(pathname);
  if(pathname.endsWith('/key'))return Response.json({data:{limit_remaining:0}});
  assert.equal(JSON.parse(String(init?.body)).provider.max_price.completion,0);
  return freeSuccess();
 }});
 await complete('',{},{});
 await assert.rejects(complete('',{},{}),/FREE_PROVIDER_DAILY_BUDGET_REACHED/);
 assert.deepEqual(paths,['/api/v1/key','/api/v1/chat/completions']);
 t.mock.timers.tick(4*3600000);
 await complete('',{},{});
 assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).providers.openrouter.count,1);
});
test('Groq rate-limit headers block both Groq models until the longest exhausted window resets',async t=>{
 const {start}=fakeClock(t),ledger=setup(t),headers=new Headers({'x-ratelimit-remaining-requests':'0','x-ratelimit-reset-requests':'2m59.56s','x-ratelimit-remaining-tokens':'0','x-ratelimit-reset-tokens':'7.66s'});
 assert.equal(groqRateLimitUntil(headers,+start),+start+179560);
 assert.equal(groqRateLimitUntil(new Headers(),+start),0);
 let calls=0;
 const config={...primary,provider:'groq' as const,key:'fake',groqFreeTier:true,ledger,fetcher:async()=>{
  calls++;
  return new Response(freeSuccess().body,{headers});
 }};
 await freeCompletion({...config,model:freeModels.groqSolver})('',{},{});
 await assert.rejects(freeCompletion({...config,model:freeModels.groqReview})('',{},{}),/FREE_PROVIDER_RATE_LIMITED/);
 assert.equal(calls,1);
});
test('missing keys are reported and Groq requires free-tier confirmation',t=>{
 assert.deepEqual(freeProviderStatus(readFreeKeys(setup(t))),{groq:'MISSING_GROQ_API_KEY',openrouter:'MISSING_OPENROUTER_API_KEY'});
 assert.equal(freeProviderStatus({groq:'fake'}).groq,'GROQ_FREE_TIER_UNCONFIRMED');
 assert.throws(()=>freeCompletion({...primary,provider:'groq',model:freeModels.groqSolver,key:'fake',ledger:setup(t)}),/FREE_PROVIDER_NOT_ENABLED/);
});
test('Gemini 429 falls through to Groq and Groq 429 switches to OpenRouter without retrying',async t=>{
 const requests:string[]=[],ledger=setup(t);
 const provider=draftProvider([primary],ledger,'fake',{freeKeys:{groq:'fake',groqFreeTier:true,openrouter:'fake'},sleep:async()=>assert.fail('free fallback should be immediate'),fetcher:async(url,init)=>{
  const {hostname,pathname}=new URL(String(url));
  requests.push(init?.body&&hostname!=='generativelanguage.googleapis.com'?JSON.parse(String(init.body)).model:hostname+pathname);
  if(hostname==='generativelanguage.googleapis.com'||hostname==='api.groq.com')return new Response(null,{status:429,headers:{'Retry-After':'90'}});
  return pathname.endsWith('/key')?Response.json({data:{limit_remaining:null}}):freeSuccess();
 }});
 const output=await provider('verify','',{},{},{openjlptOnly:true});
 assert.equal(modelEvidence(output).fallbackProvider,'openrouter');
 assert.equal(modelEvidence(output).model,freeModels.openrouter);
 assert.deepEqual(requests.slice(1),[freeModels.groqSolver,'openrouter.ai/api/v1/key',freeModels.openrouter]);
 const counts=JSON.parse(fs.readFileSync(ledger,'utf8')).providers;
 assert.equal(counts.groq.count,1);
 assert.equal(counts.openrouter.count,1);
});
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
 const unavailable=draftProvider([primary,fallback],ledger,'secret',{fetcher:async()=>{calls++;return new Response('busy',{status:503,headers:{'Retry-After':'61'}});},sleep:async ms=>{waits.push(ms);}});
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

function fakeClock(t:TestContext){
 const start=new Date('2026-11-19T20:00:00Z');
 t.mock.timers.enable({apis:['Date'],now:start});
 const waits:number[]=[];
 const sleep=async(ms:number)=>{waits.push(ms);t.mock.timers.tick(ms);};
 return {start,waits,sleep};
}

test('503 across the chain recovers after the default cooldown and charges every attempt',async t=>{
 const {waits,sleep}=fakeClock(t),ledger=setup(t),models:string[]=[];
 const provider=draftProvider([primary,fallback],ledger,'secret',{sleep,fetcher:async url=>{
  models.push(String(url).split('/models/')[1].split(':')[0]);
  return models.length<=2?new Response(null,{status:503}):success();
 }});
 assert.deepEqual(await provider('verify','',{},{}),[]);
 assert.deepEqual(models,[primary.model,fallback.model,primary.model]);
 assert.deepEqual(waits,[30_000]);
 const counts=JSON.parse(fs.readFileSync(ledger,'utf8')).models;
 assert.equal(counts[primary.model].count,2);
 assert.equal(counts[fallback.model].count,1);
});

test('429 honors Retry-After in seconds and HTTP-date across calls',async t=>{
 const {start,waits,sleep}=fakeClock(t),models:string[]=[];
 const provider=draftProvider([primary,fallback],setup(t),'secret',{sleep,fetcher:async url=>{
  const model=String(url).split('/models/')[1].split(':')[0];
  models.push(model);
  if(models.length===1)return new Response(null,{status:429,headers:{'Retry-After':'45'}});
  if(models.length===2)return new Response(null,{status:429,headers:{'Retry-After':new Date(+start+40_000).toUTCString()}});
  return success();
 }});
 const result=await provider('verify','',{},{});assert.deepEqual(result,[]);
 assert.deepEqual(models,[primary.model,fallback.model,fallback.model]);
 assert.deepEqual(waits,[40_000]);
 await provider('verify','',{},{},{excludeModels:[fallback.model]});
 assert.deepEqual(models,[primary.model,fallback.model,fallback.model,primary.model]);
 assert.deepEqual(waits,[40_000,5_000]);
});

test('persistent overload gets exactly one recovery sweep',async t=>{
 const {waits,sleep}=fakeClock(t);let calls=0;
 const provider=draftProvider([primary,fallback],setup(t),'secret',{sleep,fetcher:async()=>{
  calls++;
  return new Response(null,{status:503});
 }});
 await assert.rejects(provider('verify','',{},{}),/DRAFT_MODELS_EXHAUSTED/);
 assert.equal(calls,4);
 assert.deepEqual(waits,[30_000]);
});

test('the shared ledger cap blocks network calls in the recovery sweep',async t=>{
 const {waits,sleep}=fakeClock(t),ledger=setup(t);
 fs.writeFileSync(ledger,JSON.stringify({models:{[primary.model]:{day:'2026-11-19',count:198,last:0}}}));
 let calls=0;
 const provider=draftProvider([primary,fallback],ledger,'secret',{sleep,fetcher:async()=>{
  calls++;
  return new Response(null,{status:503});
 }});
 await assert.rejects(provider('verify','',{},{}),/SHARED_DAILY_BUDGET_REACHED/);
 assert.equal(calls,2);
 assert.deepEqual(waits,[30_000]);
});

const roleFixture:V2Question={version:2,mode:'draft_roadmap',id:'roles-fixture',date:'2026-11-30',
 day:0,position:0,fingerprint:'fixture',type:'reading',targetId:'fixture',sourceHash:'fixture',
 stem:'[fixture]',choices:['one','two','three','four'],correct:0,order:[],starSlot:0,explanation:'Authored fixture',distractors:[]};
const flags=(correct:boolean)=>({grammatical:correct,formCorrect:correct,natural:correct,meaningFits:correct});
function roleProvider(t:TestContext,config:{geminiCap?:boolean;groqLimit?:'model'|'shared';router?:boolean;
 reject?:'meaningCorrect'|'grammarLabelCorrect';reviewMissing?:boolean;groqError?:number}={}){
 const ledger=setup(t),seen:string[]=[];
 if(config.geminiCap){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
  fs.writeFileSync(ledger,JSON.stringify({models:{[primary.model]:{day,count:200,last:0}}}));
 }
 const provider=draftProvider([primary],ledger,'fake',{
  freeKeys:{groq:'fake',groqFreeTier:true,...(config.router?{openrouter:'fake'}:{})},
  sleep:async()=>assert.fail('fallback must not wait'),
  fetcher:async(url,init)=>{
   const {hostname,pathname}=new URL(String(url));
   if(hostname==='generativelanguage.googleapis.com'){
    seen.push('Gemini');
    return new Response(null,{status:429,headers:{'Retry-After':'90'}});
   }
   if(pathname.endsWith('/key')){
    seen.push('OpenRouter key');
    return Response.json({data:{limit_remaining:null}});
   }
   const body=JSON.parse(String(init?.body)),payload=JSON.parse(body.messages[1].content);
   const role=payload.claims?'semantic':payload.questions?'blind':'isolated';
   seen.push(body.model+':'+role);
   if(body.model===freeModels.groqSolver&&(config.groqLimit||config.groqError)){
    return new Response(null,{status:config.groqError??429,headers:{'Retry-After':'90',
     ...(config.groqLimit==='shared'?{'x-ratelimit-remaining-requests':'0','x-ratelimit-reset-requests':'90s'}:{})}});
   }
   if(role==='semantic'){
    assert.equal(body.model,freeModels.groqReview);
    assert.deepEqual(Object.keys(payload),['claims']);
    return freeSuccess(config.reviewMissing?[]:[{index:0,meaningCorrect:config.reject!=='meaningCorrect',
     grammarLabelCorrect:config.reject!=='grammarLabelCorrect'}]);
   }
   assert.notEqual(body.model,freeModels.groqReview);
   assert.ok(!JSON.stringify(payload).includes(roleFixture.explanation));
   return freeSuccess(role==='blind'?[{index:0,independentAnswer:0,possibleAnswers:[0],natural:true,knowledgeCorrect:true,
    optionGrades:roleFixture.choices.map((_,choiceIndex)=>({choiceIndex,completedSentence:choiceSentence(roleFixture,choiceIndex),
     candidateOrder:[],...flags(choiceIndex===0),acceptable:choiceIndex===0,reason:'Fixture'}))}]
    :payload.sentences.map(({index}:{index:number})=>({index,...flags(index===0),reason:'Fixture'})));
  },
 });
 return {provider,seen};
}
const groqRoleCalls=[freeModels.groqSolver+':blind',freeModels.groqSolver+':isolated',freeModels.groqReview+':semantic'];
for(const geminiCap of [true,false]){
 test('Gemini '+(geminiCap?'at 200 calls':'HTTP 429')+' uses GPT-OSS for both passes and Qwen only for semantic review',async t=>{
  const {provider,seen}=roleProvider(t,{geminiCap});
  const question={...roleFixture,provenance:{generationModel:primary.model,initialSolverModel:'none',
   fallback:false,verificationRounds:[],switches:[]}};
  const [row]=await verifyDeterministic(provider,[question]);
  assert.equal(row.accepted,true);
  assert.deepEqual(row.models,{solver:freeModels.groqSolver,isolated:freeModels.groqSolver});
  assert.deepEqual(seen,geminiCap?groqRoleCalls:['Gemini',...groqRoleCalls]);
 });
}
for(const reject of ['meaningCorrect','grammarLabelCorrect'] as const){
 test('Qwen rejection of '+reject+' fails closed',async t=>{
  const {provider,seen}=roleProvider(t,{geminiCap:true,reject});
  const [row]=await verifyDeterministic(provider,[roleFixture]);
  assert.equal(row.accepted,false);
  assert.equal(row.reason,'FALLBACK_SEMANTIC_REVIEW_REJECTED');
  assert.deepEqual(seen,groqRoleCalls);
 });
}
test('GPT-OSS cannot verify a draft it generated',async t=>{
 const {provider,seen}=roleProvider(t,{});
 const born={...roleFixture,provenance:{generationModel:freeModels.groqSolver,initialSolverModel:'none',
  fallback:true,verificationRounds:[],switches:[]}};
 await assert.rejects(provider('verify','',{},{},{openjlptOnly:true,excludeModels:[primary.model,freeModels.groqSolver]}),
  /NO_DIFFERENT_VERIFIER/);
 const [row]=await verifyDeterministic(provider,[born]);
 assert.equal(row.accepted,false);
 assert.equal(row.reason,'FALLBACK_CROSS_VERIFICATION_REQUIRED');
 assert.deepEqual(seen,['Gemini']);
});
test('GPT-OSS HTTP 429 promotes OpenRouter only to solver and preserves Qwen as reviewer',async t=>{
 const {provider,seen}=roleProvider(t,{geminiCap:true,groqLimit:'model',router:true});
 const [row]=await verifyDeterministic(provider,[roleFixture]);
 assert.equal(row.accepted,true);
 assert.deepEqual(row.models,{solver:freeModels.openrouter,isolated:freeModels.openrouter});
 assert.deepEqual(seen,[freeModels.groqSolver+':blind','OpenRouter key',freeModels.openrouter+':blind',
  'OpenRouter key',freeModels.openrouter+':isolated',freeModels.groqReview+':semantic']);
});
test('Groq HTTP 429 without another solver rejects without asking Qwen to solve',async t=>{
 const {provider,seen}=roleProvider(t,{geminiCap:true,groqLimit:'model'});
 const [row]=await verifyDeterministic(provider,[roleFixture]);
 assert.equal(row.accepted,false);
 assert.equal(row.reason,'FALLBACK_CROSS_VERIFICATION_REQUIRED');
 assert.deepEqual(seen,[freeModels.groqSolver+':blind']);
});
test('shared Groq rate limits preserve the review guard when OpenRouter solves',async t=>{
 const {provider,seen}=roleProvider(t,{geminiCap:true,groqLimit:'shared',router:true});
 const [row]=await verifyDeterministic(provider,[roleFixture]);
 assert.equal(row.accepted,false);
 assert.equal(row.reason,'FALLBACK_SEMANTIC_REVIEW_REJECTED');
 assert.deepEqual(seen,[freeModels.groqSolver+':blind','OpenRouter key',freeModels.openrouter+':blind',
  'OpenRouter key',freeModels.openrouter+':isolated']);
});
test('missing Qwen verdict fails closed without sending claims to another provider',async t=>{
 const {provider,seen}=roleProvider(t,{geminiCap:true,reviewMissing:true,router:true});
 const [row]=await verifyDeterministic(provider,[roleFixture]);
 assert.equal(row.accepted,false);
 assert.equal(row.reason,'FALLBACK_SEMANTIC_REVIEW_REJECTED');
 assert.deepEqual(seen,groqRoleCalls);
});
test('Groq server errors do not activate OpenRouter',async t=>{
 const {provider,seen}=roleProvider(t,{groqError:503,router:true});
 await assert.rejects(provider('verify','',{},{},{openjlptOnly:true}),/DRAFT_MODELS_EXHAUSTED/);
 assert.deepEqual(seen,['Gemini',freeModels.groqSolver+':isolated']);
});
