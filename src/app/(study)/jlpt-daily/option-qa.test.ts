import test from 'node:test';import assert from 'node:assert/strict';import {baseStem,draftCollisionIssues} from './hard-qa.ts';import {choiceSentence,validateOptionGrades} from './independent-qa.ts';import type {Question,Source} from './model.ts';
const q={type:'context',stem:'せんせいにしつもんを（　）',choices:['取る','する','読む','書く'],correct:1,explanation:'fixture',day:0,position:0,targetId:'openjlpt:vocab:f',order:[],starSlot:0,id:'f',fingerprint:'f',date:'2026-11-16'} as Question;
function audit(question=q){return {independentAnswer:question.correct,possibleAnswers:[question.correct],optionGrades:question.choices.map((_,choiceIndex)=>({choiceIndex,completedSentence:choiceSentence(question,choiceIndex),candidateOrder:[],grammatical:true,formCorrect:true,natural:choiceIndex===question.correct,meaningFits:choiceIndex===question.correct,acceptable:choiceIndex===question.correct,reason:'collocation/form evidence'}))};}
test('four filled sentences must exactly use all choices and admit only stored key',()=>{
 const a=audit();assert.doesNotThrow(()=>validateOptionGrades(a,q));assert.equal(a.optionGrades[1].completedSentence,'せんせいにしつもんをする');
 const ambiguous=structuredClone(a);Object.assign(ambiguous.optionGrades[0],{natural:true,meaningFits:true,acceptable:true});assert.throws(()=>validateOptionGrades(ambiguous,q),/OPTION_ACCEPTANCE_NOT_UNIQUE/);
 assert.throws(()=>validateOptionGrades({...a,optionGrades:a.optionGrades.slice(1)},q),/INCOMPLETE/);
 assert.throws(()=>validateOptionGrades(a,{...q,correct:0}),/OPTION_KEY_NOT_ACCEPTABLE/);
 const wrongForm={...q,stem:'ほんを（　）ください',choices:['並べる','取る','する','読む'],correct:0};const form=audit(wrongForm);Object.assign(form.optionGrades[0],{formCorrect:false,acceptable:false});assert.throws(()=>validateOptionGrades(form,wrongForm),/OPTION_ACCEPTANCE_NOT_UNIQUE/);
 const rewritten=structuredClone(form);rewritten.optionGrades[0].completedSentence='ほんを並べてください';assert.throws(()=>validateOptionGrades(rewritten,wrongForm),/OPTION_SENTENCE_MISMATCH/);
});
test('option/stem word overlap and base-stem duplicates fail including bracket/space/gap variants',()=>{
 assert.equal(baseStem('【明日】 （　） です。'),baseStem('明日＿です。'));
 assert.ok(draftCollisionIssues({...q,stem:'取るは（　）です'},[],[]).includes('OPTION_WORD_IN_STEM'));
 assert.ok(draftCollisionIssues({...q,stem:'明日＿です。'},[{...q,stem:'【明日】 （　）です。'}],[]).includes('DUPLICATE_BASE_STEM'));
 const source={id:q.targetId,title:'一日'} as Source;assert.ok(draftCollisionIssues({...q,type:'spelling'},[{...q,type:'reading',stem:'別の文'}],[source]).includes('READING_SPELLING_SAME_WORD'));
});
