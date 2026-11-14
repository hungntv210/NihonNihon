import test from 'node:test';import assert from 'node:assert/strict';import {strictDraftIssues} from './hard-qa.ts';import {choiceSentence,independentPayload,validateIndependent,independentProvider} from './independent-qa.ts';import type {Question} from './model.ts';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const q={type:'context',stem:'これは（　）です。',choices:['百','千','万','十'],correct:0,explanation:'Đáp án 1.',day:0,position:0,targetId:'openjlpt:vocab:fixture',order:[],starSlot:0,id:'f',fingerprint:'f',date:'2026-11-16'} as Question;
const lexicon=new Set(['これ','は','です','百']);
test('strict draft rejects explanation numbers, misplaced order syntax, leaks and unattested words',()=>{
 assert.deepEqual(strictDraftIssues(q,lexicon),[]);
 for(const explanation of ['Đáp án 2.','Đáp án ２.','đáp án thứ hai','lựa chọn số 3.','正解：4'])assert.ok(strictDraftIssues({...q,explanation},lexicon).includes('EXPLANATION_ANSWER_NUMBER'));
 for(const explanation of ['Thứ tự: 1→2→3→4','★=1'])assert.ok(strictDraftIssues({...q,explanation},lexicon).includes('ORDER_EXPLANATION_ON_OTHER_TYPE'));
 for(const type of ['reading','spelling','context','synonym','usage'] as const)assert.ok(strictDraftIssues({...q,type,stem:'百'},lexicon).includes('CORRECT_CHOICE_IN_STEM'));
 assert.ok(strictDraftIssues({...q,stem:'ひとりがくぶん'},lexicon).some(i=>i.startsWith('UNATTESTED_WORD:')));
});
test('independent solve hides key/explanation and rejects wrong solve, unnatural or false knowledge despite positive legacy flags',()=>{
 const rows=independentPayload([q]);assert.ok(!('correct' in rows[0]));assert.ok(!('explanation' in rows[0]));
 const a={optionGrades:q.choices.map((_,choiceIndex)=>({choiceIndex,completedSentence:choiceSentence(q,choiceIndex),candidateOrder:[],grammatical:true,formCorrect:true,natural:choiceIndex===0,meaningFits:choiceIndex===0,acceptable:choiceIndex===0,reason:'fixture evidence'})),index:0,independentAnswer:0,natural:true,knowledgeCorrect:true,possibleAnswers:[0],sameType:true,plausible:true,levelMatch:true,learnedOnly:true,original:true,explanationCorrect:true};
 assert.equal(validateIndependent([a],[q]).length,1);
 for(const change of [{independentAnswer:1},{natural:false},{knowledgeCorrect:false}])assert.throws(()=>validateIndependent([{...a,...change}],[q]),/INDEPENDENT_SOLVE_REJECTED|OPTION_KEY_NOT_ACCEPTABLE/);
});
test('verifier always uses a different actual model, even after generation fallback',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-independent-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const base={requestsPerMinute:60000000,dailyBudget:400,timeoutMs:1000,maxOutputTokens:100};const profiles=['gemini-3.5-flash-lite','gemini-3.1-flash-lite'].map(model=>({...base,model,verifierModel:model}));let calls=0;const actual:string[]=[];
 const provider=independentProvider(profiles,path.join(dir,'ledger.json'),'fake',{sleep:async()=>{},fetcher:async url=>{calls++;return calls<=3?new Response('busy',{status:503}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'[]'}]}}]});},onAttempt:e=>{if(e.status==='ok')actual.push(e.model);}});
 await provider('generate','',{},{});await provider('verify','',{},{});assert.deepEqual(actual,['gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
});
