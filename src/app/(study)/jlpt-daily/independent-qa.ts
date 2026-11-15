import {draftProvider} from './draft-provider.ts';
import {auditSchema,VERIFY_PROMPT,type Provider} from './generation.ts';
import {validateAudit,requireValue,type Question,type Audit} from './model.ts';
import {orderedSentence} from './hard-qa.ts';
export function provenanceRows(phase:'generate'|'verify',payload:unknown,output:unknown){
 const rows=phase==='generate'?output:(payload as {questions?:unknown})?.questions;
 return Array.isArray(rows)?rows:[]; // isolated sentence audit has no question array
}
const optionGradeSchema={type:'object',properties:{choiceIndex:{type:'integer'},completedSentence:{type:'string'},candidateOrder:{type:'array',items:{type:'integer'}},grammatical:{type:'boolean'},formCorrect:{type:'boolean'},natural:{type:'boolean'},meaningFits:{type:'boolean'},acceptable:{type:'boolean'},reason:{type:'string'}},required:['choiceIndex','completedSentence','candidateOrder','grammatical','formCorrect','natural','meaningFits','acceptable','reason'],additionalProperties:false};
export function choiceSentence(q:Question,index:number,order:number[]=[]){
 if(q.type==='order')return orderedSentence({...q,order});
 const gap=/（\s*）|\(\s*\)|＿+|_+/u;
 if(gap.test(q.stem))return q.stem.replace(gap,q.choices[index]);
 if(['reading','spelling'].includes(q.type))return q.stem.replace(/【[^【】]+】/u,q.choices[index]);
 return q.stem+' → '+q.choices[index];
}
export function validateOptionGrades(a:any,q:Question){
 requireValue(Array.isArray(a.optionGrades)&&a.optionGrades.length===4&&new Set(a.optionGrades.map((g:any)=>g.choiceIndex)).size===4,'OPTION_GRADES_INCOMPLETE');
 const accepted:number[]=[];
 for(const g of a.optionGrades){
  requireValue(Number.isInteger(g.choiceIndex)&&g.choiceIndex>=0&&g.choiceIndex<4&&Array.isArray(g.candidateOrder),'OPTION_GRADE_INDEX');
  if(q.type==='order')requireValue(g.candidateOrder.length===4&&new Set(g.candidateOrder).size===4&&g.candidateOrder.every((i:number)=>Number.isInteger(i)&&i>=0&&i<4)&&g.candidateOrder[q.starSlot]===g.choiceIndex,'OPTION_ORDER_RECONSTRUCTION');
  else requireValue(g.candidateOrder.length===0,'UNEXPECTED_OPTION_ORDER');
  requireValue(g.completedSentence===choiceSentence(q,g.choiceIndex,g.candidateOrder)&&typeof g.reason==='string'&&g.reason.trim().length>0,'OPTION_SENTENCE_MISMATCH');
  requireValue(['grammatical','formCorrect','natural','meaningFits','acceptable'].every(k=>typeof g[k]==='boolean'),'OPTION_GRADE_FLAGS');
  const pass=g.grammatical&&g.formCorrect&&g.natural&&g.meaningFits;
  requireValue(g.acceptable===pass,'OPTION_GRADE_CONTRADICTION');if(pass)accepted.push(g.choiceIndex);
 }
 requireValue(accepted.length===1,'OPTION_ACCEPTANCE_NOT_UNIQUE');
 requireValue(accepted[0]===q.correct&&a.independentAnswer===accepted[0]&&a.possibleAnswers?.length===1&&a.possibleAnswers[0]===accepted[0],'OPTION_KEY_NOT_ACCEPTABLE');
}
export const independentPrompt=VERIFY_PROMPT+' Solve independently: the saved key and explanation are deliberately hidden. Return independentAnswer (0..3), natural and knowledgeCorrect. Reject invented words, incorrect readings, unnatural sentences and contradictions with context. All three must be independently established; uncertainty is rejection.';
export const independentSchema={...auditSchema,items:{...auditSchema.items,properties:{...auditSchema.items.properties,optionGrades:{type:'array',minItems:4,maxItems:4,items:optionGradeSchema},independentAnswer:{type:'integer'},natural:{type:'boolean'},knowledgeCorrect:{type:'boolean'}},required:[...auditSchema.items.required,'independentAnswer','natural','knowledgeCorrect','optionGrades']}};
export function independentPayload(questions:Question[]){return questions.map(({correct,explanation,order,targetId,...q},index)=>({...q,index,...(q.type!=='order'?{candidateSentences:q.choices.map((_,i)=>choiceSentence({...q,targetId,correct,explanation,order},i))}:{})}));}
export function validateIndependent(rows:unknown,questions:Question[]){
 requireValue(Array.isArray(rows),'INCOMPLETE_SEMANTIC_QA');
 for(const a of rows){requireValue(a&&questions[a.index],'INVALID_QA_INDEX');validateOptionGrades(a,questions[a.index]);validateOptionGrades({...a,optionGrades:a.isolatedOptionGrades},questions[a.index]);requireValue(a.independentAnswer===questions[a.index].correct&&a.natural===true&&a.knowledgeCorrect===true,'INDEPENDENT_SOLVE_REJECTED');}
 return validateAudit(rows,questions);
}
export async function reviewIndependently(provider:Provider,questions:Question[],catalog:unknown){
 if(questions.some(q=>q.type==='order')&&questions.some(q=>q.type!=='order')){
  const merged:any[]=[];for(const order of [false,true]){const entries=questions.map((q,index)=>({q,index})).filter(e=>(e.q.type==='order')===order);const rows=await reviewIndependently(provider,entries.map(e=>e.q),catalog);merged.push(...rows.map(a=>({...a,index:entries[a.index].index})));}return merged;
 }
 const isOrder=questions.every(q=>q.type==='order');
 const schema={...independentSchema,minItems:questions.length,maxItems:questions.length,items:{...independentSchema.items,properties:{...independentSchema.items.properties,optionGrades:{...independentSchema.items.properties.optionGrades,items:{...optionGradeSchema,properties:{...optionGradeSchema.properties,candidateOrder:{...optionGradeSchema.properties.candidateOrder,minItems:isOrder?4:0,maxItems:isOrder?4:0}}}}}}};
 const blind=await provider('verify',independentPrompt+' For EACH of the four choices, insert the EXACT choice without conjugating or fixing it. Grade the resulting whole sentence: grammatical, formCorrect, natural, meaningFits, acceptable (AND of all four), with a specific reason. Return exactly four optionGrades indexed0..3 and the exact supplied candidateSentences. For each order choice consider ALL six permutations of the remaining three fragments. Mark acceptable if ANY is valid; show the best candidate, never cherry-pick a bad permutation. Return a permutation placing that choice at starSlot: return candidateOrder and the complete reconstructed sentence. Other types candidateOrder=[]. A task without a gap/marker uses stem + " → " + choice. Reject if two or more choices work, if none work, or the claimed choice is unnatural/wrong tense/form/collocation. Do not assume distractors are wrong. possibleAnswers must list ALL acceptable choices. The explanation is withheld: explanationCorrect is provisional until the separate explanation audit.',{catalog,questions:independentPayload(questions)},schema);
 requireValue(Array.isArray(blind)&&blind.length===questions.length&&new Set(blind.map(a=>a.index)).size===questions.length&&blind.every(a=>Number.isInteger(a.index)&&a.index>=0&&a.index<questions.length),'INVALID_QA_INDEX');
 const candidates=blind.flatMap(a=>questions[a.index].choices.map((_,choiceIndex)=>{
  const q=questions[a.index],grade=a.optionGrades?.find((g:any)=>g.choiceIndex===choiceIndex),candidateOrder=q.type==='order'?grade?.candidateOrder??[]:[];
  return {questionIndex:a.index,choiceIndex,candidateOrder,completedSentence:choiceSentence(q,choiceIndex,candidateOrder),task:q.type};
 }));
 const isolated=await provider('verify','Judge each completed Japanese sentence independently. No target word, expected intent, key or other alternatives is provided. Do not invent missing context. A grammatical and natural statement is acceptable even if it expresses a different meaning from an unstated target (e.g. desire vs identification/negation). Tense/polarity alternatives are valid unless EXPLICIT context rules them out. Check collocations and EXACT supplied verb forms, including required te-form before kudasai. Do not conjugate or repair the sentence. For reading/spelling assess the completed reading/writing in its supplied task. Return grammatical,formCorrect,natural,meaningFits and a specific reason for every supplied index.',{sentences:candidates.map((c,index)=>({index,task:c.task,completedSentence:c.completedSentence}))},{type:'array',minItems:candidates.length,maxItems:candidates.length,items:{type:'object',properties:{index:{type:'integer'},grammatical:{type:'boolean'},formCorrect:{type:'boolean'},natural:{type:'boolean'},meaningFits:{type:'boolean'},reason:{type:'string'}},required:['index','grammatical','formCorrect','natural','meaningFits','reason'],additionalProperties:false}});
 requireValue(Array.isArray(isolated)&&isolated.length===candidates.length&&new Set(isolated.map(a=>a.index)).size===candidates.length&&isolated.every(a=>Number.isInteger(a.index)&&a.index>=0&&a.index<candidates.length),'INVALID_ISOLATED_QA_INDEX');
 const explanations=await provider('verify',VERIFY_PROMPT+' Check the explanation against the actual sentence and saved choice; do not rewrite anything.',{catalog,questions:questions.map((q,index)=>({...q,index}))},{...auditSchema,minItems:questions.length,maxItems:questions.length});
 requireValue(Array.isArray(explanations)&&explanations.length===questions.length&&new Set(explanations.map(a=>a.index)).size===questions.length&&explanations.every(a=>Number.isInteger(a.index)&&a.index>=0&&a.index<questions.length),'INVALID_QA_INDEX');
 return blind.map(a=>{const b=explanations.find(b=>b.index===a.index);let pass=true;try{validateAudit([{...b,index:0}],[questions[a.index]]);}catch{pass=false;}const isolatedOptionGrades=candidates.flatMap((c,index)=>{if(c.questionIndex!==a.index)return [];const grade=isolated.find(g=>g.index===index);return [{...c,...grade,acceptable:grade.grammatical===true&&grade.formCorrect===true&&grade.natural===true&&grade.meaningFits===true}];});return {...a,isolatedOptionGrades,explanationCorrect:a.explanationCorrect===true&&pass};});
}
export function independentProvider(profiles:Parameters<typeof draftProvider>[0],ledger:string,key:string,options:Parameters<typeof draftProvider>[3]={}):Provider{
 let generator=profiles[0].model;
 const wrapped={...options,onAttempt:(e:Parameters<NonNullable<typeof options.onAttempt>>[0],p:unknown,o?:unknown)=>{if(e.phase==='generate'&&e.status==='ok')generator=e.model;options.onAttempt?.(e,p,o);}};
 const generate=draftProvider(profiles,ledger,key,wrapped),verifiers=new Map<string,Provider>();
 return async(phase,prompt,payload,schema)=>{
  if(phase==='generate')return generate(phase,prompt,payload,schema);
  const eligible=profiles.filter(p=>p.model!==generator);requireValue(eligible.length,'DIFFERENT_VERIFIER_REQUIRED');
  if(!verifiers.has(generator))verifiers.set(generator,draftProvider(eligible,ledger,key,wrapped));
  return verifiers.get(generator)!(phase,prompt,payload,schema);
 };
}
