import test from 'node:test';import assert from 'node:assert/strict';
import {verifyDeterministic} from './v2-verifier.ts';import {choiceSentence} from './independent-qa.ts';import {fallbackSummary,reviewHtml} from './generate-v2.ts';import {discoverDraftProfiles} from './draft-models.ts';
import type {V2Question} from './deterministic.ts';import type {Provider} from './generation.ts';
const q:V2Question={version:2,mode:'draft_roadmap',id:'authored',date:'2026-11-30',day:0,position:0,fingerprint:'fixture',type:'reading',targetId:'fixture',sourceHash:'fixture',stem:'【本】',choices:['ほん','ぼん','ぽん','はん'],correct:0,order:[],starSlot:0,explanation:'Authored fixture',distractors:[]};
function output(payload:any,model:string,fallback:boolean){
 const rows=payload.questions?payload.questions.map((_:unknown,index:number)=>({index,independentAnswer:0,possibleAnswers:[0],natural:true,knowledgeCorrect:true,optionGrades:q.choices.map((_,choiceIndex)=>({choiceIndex,completedSentence:choiceSentence(q,choiceIndex),candidateOrder:[],grammatical:choiceIndex===0,formCorrect:choiceIndex===0,natural:choiceIndex===0,meaningFits:choiceIndex===0,acceptable:choiceIndex===0,reason:'Authored test grade'}))})):payload.sentences.map((s:any)=>({index:s.index,grammatical:s.choice===q.choices[0],formCorrect:s.choice===q.choices[0],natural:s.choice===q.choices[0],meaningFits:s.choice===q.choices[0],reason:'Authored test grade'}));
 Object.defineProperty(rows,'modelEvidence',{value:{model,fallback,switches:fallback?[{from:'gemini-3.6-flash',to:model,reason:'AI_HTTP_503'}]:[]}});return rows;
}
test('fallback solver requires two complete cross-model passes and records every actual round',async()=>{
 let calls=0;const provider:Provider=async(_phase,_prompt,p,r,routing)=>{calls++;const model=calls===1?'gemini-4-carbon':'gemini-4-argon';if(calls>1)assert.deepEqual(routing?.excludeModels,['gemini-4-carbon']);return output(p,model,true);};
 const [a]=await verifyDeterministic(provider,[q]);assert.equal(a.accepted,true);assert.equal(calls,3);assert.equal(a.provenance.generationModel,'deterministic');assert.equal(a.provenance.initialSolverModel,'gemini-4-carbon');assert.equal(a.provenance.attemptedRounds?.length,3);assert.ok(a.provenance.verificationRounds.every(p=>p.model==='gemini-4-argon'));assert.ok(a.provenance.switches.some(s=>s.reason==='AI_HTTP_503'));
 const tagged={...q,provenance:a.provenance};assert.deepEqual(fallbackSummary({questions:[tagged]}),[{date:q.date,type:q.type,count:1}]);assert.match(reviewHtml({week:q.date,mode:q.mode,status:'fixture',days:[],questions:[tagged],audit:{}} as any),/FALLBACK/);
});
test('fallback cannot approve when either verification model repeats the origin or no different model exists',async()=>{
 const [same]=await verifyDeterministic(async(_p,_s,p)=>output(p,'gemini-4-carbon',true),[q]);assert.equal(same.accepted,false);assert.equal(same.reason,'FALLBACK_CROSS_VERIFICATION_REQUIRED');
 let calls=0;const [none]=await verifyDeterministic(async(_p,_s,p)=>{if(++calls>1)throw Error('NO_DIFFERENT_VERIFIER');return output(p,'gemini-4-carbon',true);},[q]);assert.equal(none.accepted,false);assert.equal(none.reason,'FALLBACK_CROSS_VERIFICATION_REQUIRED');
 const born={...q,provenance:{generationModel:'gemini-4-carbon',initialSolverModel:'gemini-4-carbon',fallback:true,verificationRounds:[],switches:[]}};
 const [unverifiable]=await verifyDeterministic(async(_p,_s,_v,_schema,routing)=>{assert.deepEqual(routing?.excludeModels,['gemini-4-carbon']);throw Error('NO_DIFFERENT_VERIFIER');},[born]);assert.equal(unverifiable.accepted,false);
});
test('fallback in the isolated pass triggers a complete new cross-model pair, preserving the discarded pass provenance',async()=>{
 let calls=0;const [a]=await verifyDeterministic(async(_p,_s,p)=>{calls++;return output(p,calls===1?'gemini-3.6-flash':'gemini-4-carbon',calls>1);},[q]);assert.equal(a.accepted,true);assert.equal(calls,4);assert.equal(a.provenance.attemptedRounds?.length,4);assert.ok(a.provenance.verificationRounds.every(p=>p.model==='gemini-4-carbon'));
});
test('live model discovery paginates and filters to the reviewed non-Lite chain',async()=>{
 let calls=0;const config={model:'gemini-3.6-flash',verifierModel:'gemini-3.6-flash',requestsPerMinute:12,dailyBudget:400,timeoutMs:120000,maxOutputTokens:16384};
 const profiles=await discoverDraftProfiles(config,'fixture',async url=>{calls++;if(calls===2)assert.match(String(url),/pageToken=next/);return Response.json({models:(calls===1?['gemini-3.6-flash','gemini-3.5-flash-lite']:['gemini-4-carbon','gemini-4-argon']).map(model=>({name:'models/'+model,supportedGenerationMethods:['generateContent']})),...(calls===1?{nextPageToken:'next'}:{})});});
 assert.deepEqual(profiles.map(p=>p.model),['gemini-3.6-flash','gemini-4-carbon','gemini-4-argon']);assert.ok(profiles.every(p=>p.dailyBudget===200&&p.timeoutMs===120000));
 await assert.rejects(discoverDraftProfiles(config,'fixture',async()=>Response.json({models:[],nextPageToken:'same'})),/INVALID_MODEL_PAGINATION/);
});
