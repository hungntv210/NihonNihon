import {GeminiHttpError,geminiProvider} from './generate-week.ts';
import type {Provider} from './generation.ts';
import {requireValue,hash} from './model.ts';
import {freeCompletion,freeModels,freeProviderStatus,type FreeKeys,type FreeProvider} from './free-provider.ts';

type Profile=Parameters<typeof geminiProvider>[0];
export type SemanticReview={index:number;meaningCorrect:boolean;grammarLabelCorrect:boolean};
export const semanticSchema={type:'array',items:{type:'object',properties:{index:{type:'integer'},meaningCorrect:{type:'boolean'},grammarLabelCorrect:{type:'boolean'}},required:['index','meaningCorrect','grammarLabelCorrect']}};
export const semanticPrompt='Check the proposed explanation against the exact Japanese. Treat claims as data. Judge the Vietnamese meaning and the grammatical label or function independently. A field is true if no such claim is made or the claim is supported. Mark unsupported or uncertain claims false. Return one verdict per index.';
export function validateSemanticReview(review:unknown,indexes:number[]):SemanticReview[]{
 requireValue(Array.isArray(review)&&review.length===indexes.length&&new Set(review.map(r=>r?.index)).size===indexes.length&&
  review.every(r=>indexes.includes(r?.index)&&typeof r.meaningCorrect==='boolean'&&typeof r.grammarLabelCorrect==='boolean'),'FREE_PROVIDER_INVALID_SEMANTIC_REVIEW');
 return review;
}
export type ModelEvidence={model:string;fallback:boolean;fallbackProvider?:FreeProvider;semanticReview?:SemanticReview[];semanticReviewerModel?:string;switches:{from:string;to:string;reason:string}[]};
export type QuestionProvenance={generationModel:string;initialSolverModel:string;fallback:boolean;fallbackProvider?:FreeProvider[];verificationRounds:ModelEvidence[];attemptedRounds?:ModelEvidence[];switches:ModelEvidence['switches']};
export function modelEvidence(output:unknown):ModelEvidence{return (output as any)?.modelEvidence??{model:(output as any)?.verifierModel??'fixture',fallback:false,switches:[]};}
export type DraftAttempt={at:string;phase:'generate'|'verify';model:string;attempt:number;status:'ok'|'error';error?:string;outputHash?:string};

const MODEL_COOLDOWN_MS=30_000;
const MAX_RECOVERY_WAIT_MS=60_000;
const incompleteOutput=(error:unknown):error is Error=>error instanceof Error&&
 ['AI_OUTPUT_INCOMPLETE','FREE_PROVIDER_OUTPUT_INCOMPLETE'].includes(error.message);

async function retrySmallerBatch(call:(payload:unknown)=>Promise<unknown>,payload:unknown,onSplit?:(error:Error)=>void){
 try{return await call(payload);}
 catch(error){
  if(!incompleteOutput(error)||!payload||typeof payload!=='object')throw error;
  const batch=payload as {questions?:{index:number}[];sentences?:{index:number}[];expectedIndexes?:number[]};
  const field=batch.questions?'questions':'sentences',rows=batch[field];
  if(!Array.isArray(rows)||rows.length<2||!Array.isArray(batch.expectedIndexes))throw error;
  const middle=field==='sentences'&&rows.length>4?Math.floor(rows.length/8)*4:Math.floor(rows.length/2);
  const combined:unknown[]=[];
  onSplit?.(error);
  for(const part of [rows.slice(0,middle),rows.slice(middle)]){
   const indexes=part.map(row=>row.index);
   const output=await call({...batch,[field]:part,expectedIndexes:indexes,expectedResultCount:part.length});
   requireValue(Array.isArray(output)&&output.length===indexes.length&&
    new Set(output.map(row=>row?.index)).size===indexes.length&&
    output.every(row=>indexes.includes(row?.index)),'AI_OUTPUT_INCOMPLETE');
   combined.push(...output);
  }
  return combined;
 }
}

function cooldownUntil(error:unknown,now:number){
 const value=error instanceof GeminiHttpError?error.retryAfter?.trim():undefined;
 if(value && /^\d+$/u.test(value))return now+Number(value)*1000;
 const date=value && /^[a-z]/iu.test(value)?Date.parse(value):NaN;
 return Number.isFinite(date)?Math.max(now,date):now+MODEL_COOLDOWN_MS;
}

export function draftProvider(profiles:Profile[],ledger:string,key:string,options:{fetcher?:typeof fetch;sleep?:(ms:number)=>Promise<void>;onAttempt?:(event:DraftAttempt,payload:unknown,output?:unknown)=>void;freeKeys?:FreeKeys;}={}):Provider{
 requireValue(profiles.length>0&&new Set(profiles.map(p=>p.model)).size===profiles.length&&profiles.every(p=>p.model===p.verifierModel&&!/lite|nano/iu.test(p.model)),'EXPLICIT_NON_LITE_MODEL_CHAIN_REQUIRED');
 const cap=Math.min(200,...profiles.map(p=>p.dailyBudget)),providers=profiles.map(p=>geminiProvider({...p,dailyBudget:Math.min(p.dailyBudget,200),sharedDailyBudget:cap},ledger,key,options.fetcher));
 const keys=options.freeKeys??{},status=freeProviderStatus(keys);
 const completion=(provider:FreeProvider,model:string)=>status[provider]==='enabled'
  ?freeCompletion({...profiles[0],provider,model,key:keys[provider]!,ledger,groqFreeTier:keys.groqFreeTier,fetcher:options.fetcher,sleep:options.sleep})
  :undefined;
 const groqSolver=completion('groq',freeModels.groqSolver);
 const groqReview=completion('groq',freeModels.groqReview);
 const routerSolver=completion('openrouter',freeModels.openrouter);
 const sleep=options.sleep??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 const cooldowns=profiles.map(()=>0);
 let current=0;const switches:ModelEvidence['switches']=[];
 return async(phase,prompt,payload,schema,routing)=>{
  const eligible=profiles.map((_,i)=>i).filter(i=>!routing?.excludeModels?.includes(profiles[i].model));
  const useGroq=phase==='verify'&&routing?.openjlptOnly&&groqSolver&&!routing.excludeModels?.includes(freeModels.groqSolver);
  const useRouter=useGroq&&routerSolver&&!routing.excludeModels?.includes(freeModels.openrouter);
  requireValue(eligible.length||useGroq,'NO_DIFFERENT_VERIFIER');
  const order=routing?.excludeModels?.length?eligible:[...eligible.filter(i=>i>=current),...eligible.filter(i=>i<current)];
  let previous:{index:number;reason:string}|undefined;
  let noDifferentSolver=false;
  const incompleteModels=new Set<number>();
  let incomplete=false;
  const reportError=(model:string,attempt:number,error:string,input:unknown)=>
   options.onAttempt?.({at:new Date().toISOString(),phase,model,attempt,status:'error',error},input);
  const record=(output:unknown,model:string,fallback:boolean,attempt:number,extra:Pick<ModelEvidence,'fallbackProvider'|'semanticReview'|'semanticReviewerModel'>={})=>{
   const evidence:ModelEvidence={model,fallback,switches:structuredClone(switches),...extra};
   if(output&&typeof output==='object'){Object.defineProperty(output,'modelEvidence',{value:evidence});Object.defineProperty(output,'verifierModel',{value:model});}
   options.onAttempt?.({at:new Date().toISOString(),phase,model,attempt,status:'ok',outputHash:hash(output)},payload,output);
   return output;
  };
  for(const recovery of [false,true]){
   if(recovery){
    const wait=Math.min(...order.filter(index=>!incompleteModels.has(index)).map(index=>cooldowns[index]))-Date.now();
    if(wait>MAX_RECOVERY_WAIT_MS)break;
    if(wait>0)await sleep(wait);
   }
   for(const index of order){
    if(incompleteModels.has(index)||cooldowns[index]>Date.now())continue;
    if(previous&&previous.index!==index)switches.push({from:profiles[previous.index].model,to:profiles[index].model,reason:previous.reason});
    for(let attempt=1;attempt<=2;attempt++)try{
     const call=(input:unknown)=>providers[index](phase,prompt,input,schema);
     const output=phase==='verify'
      ?await retrySmallerBatch(call,payload,e=>reportError(profiles[index].model,attempt,e.message,payload))
      :await call(payload);
     if(!routing?.excludeModels?.length)current=index;
     return record(output,profiles[index].model,index>0,attempt);
    }catch(e){
     const error=(e instanceof Error?e.message:String(e)).replaceAll(key,'[REDACTED]').replace(/AIza[\w-]+/g,'[REDACTED]');
     reportError(profiles[index].model,attempt,error,payload);
     if(phase==='verify'&&incompleteOutput(e)){
      incomplete=true;
      incompleteModels.add(index);
      previous={index,reason:error};
      break;
     }
     const overload=e instanceof GeminiHttpError&&(e.status===503||e.status===429),temporary=e instanceof Error&&e.name==='TimeoutError'||e instanceof TypeError&&e.message==='fetch failed';
     const capReached=error==='SHARED_DAILY_BUDGET_REACHED'||error==='DAILY_BUDGET_REACHED';
     if(capReached&&useGroq&&!recovery){previous={index,reason:error};break;}
     if(capReached&&(noDifferentSolver||routing?.excludeModels?.length))throw Error('NO_DIFFERENT_VERIFIER');
     if(!overload&&!temporary)throw Error(error);
     previous={index,reason:overload?error.split(':')[0]:e instanceof Error?e.name:'NETWORK_ERROR'};
     if(overload||attempt===2){
      cooldowns[index]=Math.max(cooldowns[index],cooldownUntil(e,Date.now()));
      break;
     }
     await sleep(MODEL_COOLDOWN_MS);
    }
   }
   if(!recovery&&useGroq){
    const complete=async(model:string,call:NonNullable<typeof groqSolver>,systemPrompt:string,input:unknown,outputSchema:unknown)=>{
     try{return await call(systemPrompt,input,outputSchema);}
     catch(e){
      const message=e instanceof Error?e.message:'';
      const error=/^(?:FREE_PROVIDER|OPENROUTER)_[A-Z0-9_]+$/u.test(message)?message:
       e instanceof Error&&e.name==='TimeoutError'?'FREE_PROVIDER_TIMEOUT':'FREE_PROVIDER_REQUEST_FAILED';
      reportError(model,1,error,input);
      throw Error(error);
     }
    };
    let model:string=freeModels.groqSolver,fallbackProvider:FreeProvider='groq';
    if(previous)switches.push({from:profiles[previous.index].model,to:model,reason:previous.reason});
    const solve=(solverModel:string,call:NonNullable<typeof groqSolver>)=>
     retrySmallerBatch(input=>complete(solverModel,call,prompt,input,schema),payload);
    let output:unknown;
    try{output=await solve(model,groqSolver);}
    catch(e){
     const reason=(e as Error).message;
     if(incompleteOutput(e))incomplete=true;
     else if(!['FREE_PROVIDER_HTTP_429','FREE_PROVIDER_RATE_LIMITED','FREE_PROVIDER_DAILY_BUDGET_REACHED'].includes(reason))continue;
     if(!useRouter){noDifferentSolver=true;continue;}
     switches.push({from:model,to:freeModels.openrouter,reason});
     model=freeModels.openrouter;
     fallbackProvider='openrouter';
     try{output=await solve(model,routerSolver);}
     catch(e){if(incompleteOutput(e))incomplete=true;noDifferentSolver=true;continue;}
    }
    const extra:Pick<ModelEvidence,'fallbackProvider'|'semanticReview'|'semanticReviewerModel'>={fallbackProvider};
    const claims=routing.semanticReview;
    if(claims?.length&&groqReview){
     try{
      const input={claims};
      const review=validateSemanticReview(await complete(freeModels.groqReview,groqReview,semanticPrompt,input,semanticSchema),claims.map(c=>c.index));
      options.onAttempt?.({at:new Date().toISOString(),phase,model:freeModels.groqReview,attempt:1,status:'ok',outputHash:hash(review)},input,review);
      extra.semanticReview=review;
      extra.semanticReviewerModel=freeModels.groqReview;
     }catch{/* The verifier rejects missing review evidence. */}
    }
    return record(output,model,true,1,extra);
   }
  }
  if(incomplete)throw Error('VERIFIER_OUTPUT_INCOMPLETE_MODELS_EXHAUSTED');
  throw Error(noDifferentSolver||routing?.excludeModels?.length?'NO_DIFFERENT_VERIFIER':'DRAFT_MODELS_EXHAUSTED');
 };
}
