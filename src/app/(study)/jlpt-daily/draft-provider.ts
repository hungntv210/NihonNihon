import {GeminiHttpError,geminiProvider} from './generate-week.ts';
import type {Provider} from './generation.ts';
import {requireValue,hash} from './model.ts';

type Profile=Parameters<typeof geminiProvider>[0];
export type ModelEvidence={model:string;fallback:boolean;switches:{from:string;to:string;reason:string}[]};
export type QuestionProvenance={generationModel:string;initialSolverModel:string;fallback:boolean;verificationRounds:ModelEvidence[];attemptedRounds?:ModelEvidence[];switches:ModelEvidence['switches']};
export function modelEvidence(output:unknown):ModelEvidence{return (output as any)?.modelEvidence??{model:(output as any)?.verifierModel??'fixture',fallback:false,switches:[]};}
export type DraftAttempt={at:string;phase:'generate'|'verify';model:string;attempt:number;status:'ok'|'error';error?:string;outputHash?:string};

const MODEL_COOLDOWN_MS=30_000;
const MAX_RECOVERY_WAIT_MS=60_000;

function cooldownUntil(error:unknown,now:number){
 const value=error instanceof GeminiHttpError?error.retryAfter?.trim():undefined;
 if(value && /^\d+$/u.test(value))return now+Number(value)*1000;
 const date=value && /^[a-z]/iu.test(value)?Date.parse(value):NaN;
 return Number.isFinite(date)?Math.max(now,date):now+MODEL_COOLDOWN_MS;
}

export function draftProvider(profiles:Profile[],ledger:string,key:string,options:{fetcher?:typeof fetch;sleep?:(ms:number)=>Promise<void>;onAttempt?:(event:DraftAttempt,payload:unknown,output?:unknown)=>void;}={}):Provider{
 requireValue(profiles.length>0&&new Set(profiles.map(p=>p.model)).size===profiles.length&&profiles.every(p=>p.model===p.verifierModel&&!/lite|nano/iu.test(p.model)),'EXPLICIT_NON_LITE_MODEL_CHAIN_REQUIRED');
 const cap=Math.min(200,...profiles.map(p=>p.dailyBudget)),providers=profiles.map(p=>geminiProvider({...p,dailyBudget:Math.min(p.dailyBudget,200),sharedDailyBudget:cap},ledger,key,options.fetcher));
 const sleep=options.sleep??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 const cooldowns=profiles.map(()=>0);
 let current=0;const switches:ModelEvidence['switches']=[];
 return async(phase,prompt,payload,schema,routing)=>{
  const eligible=profiles.map((_,i)=>i).filter(i=>!routing?.excludeModels?.includes(profiles[i].model));requireValue(eligible.length,'NO_DIFFERENT_VERIFIER');
  const order=routing?.excludeModels?.length?eligible:[...eligible.filter(i=>i>=current),...eligible.filter(i=>i<current)];
  let previous:{index:number;reason:string}|undefined;
  for(const recovery of [false,true]){
   if(recovery){
    const wait=Math.min(...order.map(index=>cooldowns[index]))-Date.now();
    if(wait>MAX_RECOVERY_WAIT_MS)break;
    if(wait>0)await sleep(wait);
   }
   for(const index of order){
    if(cooldowns[index]>Date.now())continue;
    if(previous&&previous.index!==index)switches.push({from:profiles[previous.index].model,to:profiles[index].model,reason:previous.reason});
    for(let attempt=1;attempt<=2;attempt++)try{
     const output=await providers[index](phase,prompt,payload,schema);
     if(!routing?.excludeModels?.length)current=index;
     const evidence:ModelEvidence={model:profiles[index].model,fallback:index>0,switches:structuredClone(switches)};
     if(output&&typeof output==='object'){Object.defineProperty(output,'modelEvidence',{value:evidence});Object.defineProperty(output,'verifierModel',{value:evidence.model});}
     options.onAttempt?.({at:new Date().toISOString(),phase,model:evidence.model,attempt,status:'ok',outputHash:hash(output)},payload,output);return output;
    }catch(e){
     const error=(e instanceof Error?e.message:String(e)).replaceAll(key,'[REDACTED]').replace(/AIza[\w-]+/g,'[REDACTED]');
     options.onAttempt?.({at:new Date().toISOString(),phase,model:profiles[index].model,attempt,status:'error',error},payload);
     const overload=e instanceof GeminiHttpError&&(e.status===503||e.status===429),temporary=e instanceof Error&&e.name==='TimeoutError'||e instanceof TypeError&&e.message==='fetch failed';
     if(!overload&&!temporary)throw Error(error);
     previous={index,reason:overload?error.split(':')[0]:e instanceof Error?e.name:'NETWORK_ERROR'};
     if(overload||attempt===2){
      cooldowns[index]=Math.max(cooldowns[index],cooldownUntil(e,Date.now()));
      break;
     }
     await sleep(MODEL_COOLDOWN_MS);
    }
   }
  }
  throw Error('DRAFT_MODELS_EXHAUSTED');
 };
}
