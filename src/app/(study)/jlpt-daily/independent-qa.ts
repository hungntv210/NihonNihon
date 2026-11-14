import {draftProvider} from './draft-provider.ts';
import {auditSchema,VERIFY_PROMPT,type Provider} from './generation.ts';
import {validateAudit,requireValue,type Question,type Audit} from './model.ts';
export const independentPrompt=VERIFY_PROMPT+' Solve independently: the saved key and explanation are deliberately hidden. Return independentAnswer (0..3), natural and knowledgeCorrect. Reject invented words, incorrect readings, unnatural sentences and contradictions with context. All three must be independently established; uncertainty is rejection.';
export const independentSchema={...auditSchema,items:{...auditSchema.items,properties:{...auditSchema.items.properties,independentAnswer:{type:'integer'},natural:{type:'boolean'},knowledgeCorrect:{type:'boolean'}},required:[...auditSchema.items.required,'independentAnswer','natural','knowledgeCorrect']}};
export function independentPayload(questions:Question[]){return questions.map(({correct,explanation,...q},index)=>({...q,index}));}
export function validateIndependent(rows:unknown,questions:Question[]){
 requireValue(Array.isArray(rows),'INCOMPLETE_SEMANTIC_QA');
 for(const a of rows){requireValue(a&&questions[a.index]&&a.independentAnswer===questions[a.index].correct&&a.natural===true&&a.knowledgeCorrect===true,'INDEPENDENT_SOLVE_REJECTED');}
 return validateAudit(rows,questions);
}
export async function reviewIndependently(provider:Provider,questions:Question[],catalog:unknown){
 const blind=await provider('verify',independentPrompt+' The explanation is withheld: explanationCorrect is provisional until the separate explanation audit.',{catalog,questions:independentPayload(questions)},{...independentSchema,minItems:questions.length,maxItems:questions.length});
 requireValue(Array.isArray(blind)&&blind.length===questions.length&&new Set(blind.map(a=>a.index)).size===questions.length&&blind.every(a=>Number.isInteger(a.index)&&a.index>=0&&a.index<questions.length),'INVALID_QA_INDEX');
 const explanations=await provider('verify',VERIFY_PROMPT+' Check the explanation against the actual sentence and saved choice; do not rewrite anything.',{catalog,questions:questions.map((q,index)=>({...q,index}))},{...auditSchema,minItems:questions.length,maxItems:questions.length});
 requireValue(Array.isArray(explanations)&&explanations.length===questions.length&&new Set(explanations.map(a=>a.index)).size===questions.length&&explanations.every(a=>Number.isInteger(a.index)&&a.index>=0&&a.index<questions.length),'INVALID_QA_INDEX');
 return blind.map(a=>{const b=explanations.find(b=>b.index===a.index);let pass=true;try{validateAudit([{...b,index:0}],[questions[a.index]]);}catch{pass=false;}return {...a,explanationCorrect:a.explanationCorrect===true&&pass};});
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
