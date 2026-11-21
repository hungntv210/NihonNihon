import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {requireValue} from './model.ts';
import {withStoreLock} from './repository.ts';

export const freeModels={
 groqSolver:'openai/gpt-oss-120b',
 groqReview:'qwen/qwen3.8-27b',
 openrouter:'google/gemma-4-31b-it:free',
} as const;
export type FreeProvider='groq'|'openrouter';
export type FreeKeys={groq?:string;groqFreeTier?:boolean;openrouter?:string};

export function readFreeKeys(file=path.resolve('.env.local')):FreeKeys{
 if(!fs.existsSync(file))return {};
 const env=parseEnv(fs.readFileSync(file,'utf8'));
 return {groq:env.GROQ_API_KEY?.trim(),groqFreeTier:env.GROQ_FREE_TIER==='true',openrouter:env.OPENROUTER_API_KEY?.trim()};
}

export function freeProviderStatus(keys:FreeKeys){
 return {groq:!keys.groq?'MISSING_GROQ_API_KEY':!keys.groqFreeTier?'GROQ_FREE_TIER_UNCONFIRMED':'enabled',
  openrouter:keys.openrouter?'enabled':'MISSING_OPENROUTER_API_KEY'};
}

type Quota={day:string;count:number;blockedUntil?:number;modelBlockedUntil?:Record<string,number>;tokenResetAt?:number};
const dayMs=86_400_000;
const nextUtcDay=(now:number)=>(Math.floor(now/dayMs)+1)*dayMs;
const quotaDay=(now:number)=>new Date(now).toISOString().slice(0,10);
function withQuota(file:string,provider:FreeProvider,change:(entry:Quota,now:number)=>void,clock=Date.now){
 withStoreLock(path.dirname(file),()=>{
  const ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{models:{}};
  const providers=ledger.providers??={};
  const now=clock(),day=quotaDay(now);
  const entry:Quota=providers[provider]??={day,count:0};
  if(entry.day!==day){entry.day=day;entry.count=0;delete entry.tokenResetAt;}
  change(entry,now);
  const tmp=file+'.free-provider.tmp';
  fs.writeFileSync(tmp,JSON.stringify(ledger),{mode:0o600});
  fs.renameSync(tmp,file);
 });
}

function duration(value:string|null):number|undefined{
 if(!value||! /^(?:\d+(?:\.\d+)?(?:ms|h|m|s))+$/u.test(value))return undefined;
 const units={h:3600000,m:60000,s:1000,ms:1};
 return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/gu)]
  .reduce((sum,[,n,unit])=>sum+Number(n)*units[unit as keyof typeof units],0);
}

export function groqRateLimitUntil(headers:Headers,now:number){
 const exhausted=(kind:'requests'|'tokens',otherwise:number)=>{
  const remaining=headers.get('x-ratelimit-remaining-'+kind);
  return remaining!==null&&remaining.trim()!==''&&Number(remaining)===0
   ?now+(duration(headers.get('x-ratelimit-reset-'+kind))??otherwise):0;
 };
 return Math.max(exhausted('requests',nextUtcDay(now)-now),exhausted('tokens',60_000));
}


function retryUntil(headers:Headers,now:number){
 const value=headers.get('retry-after');
 if(value&&/^\d+$/u.test(value))return now+Number(value)*1000;
 const date=value&&/^[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/iu.test(value)?Date.parse(value):NaN;
 return Number.isFinite(date)?Math.max(date,now):undefined;
}

export function rateLimitHeaders(headers:Headers){
 const safe:Record<string,string>={};
 const retry=headers.get('retry-after');
 if(retry&&retryUntil(headers,0)!==undefined)safe['retry-after']=retry;
 for(const kind of ['requests','tokens'])for(const field of ['limit','remaining','reset']){
  const name='x-ratelimit-'+field+'-'+kind,value=headers.get(name);
  if(value&&(field==='reset'?duration(value)!==undefined:/^\d+$/u.test(value)))safe[name]=value;
 }
 return safe;
}

const MAX_PACING_MS=60_000;
export function freeCompletion(config:{provider:FreeProvider;model:string;key:string;ledger:string;timeoutMs:number;maxOutputTokens:number;groqFreeTier?:boolean;fetcher?:typeof fetch;sleep?:(ms:number)=>Promise<void>;now?:()=>number}){
 const {provider,model,key,ledger,fetcher=fetch,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}=config;
 const router=provider==='openrouter';
 requireValue(router?/^[\w.-]+\/[\w.-]+:free$/u.test(model):[freeModels.groqSolver,freeModels.groqReview].some(id=>id===model),
  router?'OPENROUTER_FREE_MODEL_REQUIRED':'GROQ_MODEL_NOT_ALLOWED');
 requireValue(key&&(router||config.groqFreeTier===true),'FREE_PROVIDER_NOT_ENABLED');
 const base=router?'https://openrouter.ai/api/v1':'https://api.groq.com/openai/v1';
 const headers={authorization:'Bearer '+key,'content-type':'application/json'};
 const cap=router?50:200;
 const update=(change:(entry:Quota,at:number)=>void)=>withQuota(ledger,provider,change,now);
 const checkCap=(entry:Quota)=>requireValue(entry.count<cap,'FREE_PROVIDER_DAILY_BUDGET_REACHED');
 const blockedUntil=(entry:Quota)=>Math.max(entry.blockedUntil??0,entry.modelBlockedUntil?.[model]??0,entry.tokenResetAt??0);
 const block=(until:number,shared:boolean)=>update(entry=>{
  if(shared)entry.blockedUntil=Math.max(entry.blockedUntil??0,until);
  else {const blocked=entry.modelBlockedUntil??={};blocked[model]=Math.max(blocked[model]??0,until);}
 });
 const pace=async()=>{
  let wait=0;
  update((entry,at)=>{
   checkCap(entry);
   wait=Math.max(0,blockedUntil(entry)-at);
   requireValue(wait<=MAX_PACING_MS,'FREE_PROVIDER_RATE_LIMITED');
  });
  if(wait>0)await sleep(wait);
 };
 return async(prompt:string,payload:unknown,schema:unknown)=>{
  const body=JSON.stringify({
   model,temperature:0,max_completion_tokens:config.maxOutputTokens,
   ...(router?{provider:{max_price:{prompt:0,completion:0,request:0},require_parameters:true}}:{}),
   messages:[{role:'system',content:prompt+' Return a JSON object with a single "result" field matching this schema: '+JSON.stringify(schema)},
    {role:'user',content:JSON.stringify(payload)}],
   response_format:{type:'json_object'},
  });
  const tries=router?2:3;
  for(let attempt=1;attempt<=tries;attempt++){
   await pace();
   if(router){
    const response=await fetcher(base+'/key',{headers,signal:AbortSignal.timeout(config.timeoutMs),redirect:'error'});
    if(response.status===429){
     const at=now(),reset=retryUntil(response.headers,at);
     block(reset??at+30_000,true);
     if(reset!==undefined&&reset-at<=MAX_PACING_MS&&attempt<tries)continue;
    }
    requireValue(response.ok,'OPENROUTER_KEY_HTTP_'+response.status);
    const keyInfo=(await response.json()).data;
    requireValue(keyInfo&&(keyInfo.limit_remaining===null||
     (typeof keyInfo.limit_remaining==='number'&&keyInfo.limit_remaining>=0)),'OPENROUTER_INVALID_KEY_LIMIT');
   }
   update((entry,at)=>{
    checkCap(entry);
    requireValue(blockedUntil(entry)<=at,'FREE_PROVIDER_RATE_LIMITED');
    entry.count++;
   });
   const response=await fetcher(base+'/chat/completions',{
    method:'POST',headers,signal:AbortSignal.timeout(config.timeoutMs),redirect:'error',body,
   });
   const at=now(),exhausted=router?0:groqRateLimitUntil(response.headers,at);
   if(response.status===429){
    const tokenReset=duration(response.headers.get('x-ratelimit-reset-tokens'));
    const requestReset=duration(response.headers.get('x-ratelimit-reset-requests'));
    const indicated=retryUntil(response.headers,at);
    const reset=exhausted>at?Math.max(exhausted,indicated??0):indicated??
     (!router&&tokenReset!==undefined?at+tokenReset:!router&&requestReset!==undefined?at+requestReset:undefined);
    block(reset??at+30_000,router||exhausted>at);
    if(reset!==undefined&&reset-at<=MAX_PACING_MS&&attempt<tries)continue;
   }else if(exhausted>at)block(exhausted,true);
   requireValue(response.ok,'FREE_PROVIDER_HTTP_'+response.status);
   const data=await response.json();
   if(!router){
    // Estimate the next completion from the last successful request's actual usage.
    const rawRemaining=response.headers.get('x-ratelimit-remaining-tokens');
    const remaining=rawRemaining!==null&&/^\d+$/u.test(rawRemaining)?Number(rawRemaining):undefined;
    const estimate=data.usage?.total_tokens,reset=duration(response.headers.get('x-ratelimit-reset-tokens'));
    if(remaining!==undefined&&Number.isSafeInteger(estimate)&&estimate>remaining&&reset!==undefined){
     update(entry=>{entry.tokenResetAt=Math.max(entry.tokenResetAt??0,at+reset);});
    }
   }
   const choice=data.choices?.[0];
   requireValue(choice?.finish_reason==='stop'&&typeof choice.message?.content==='string','FREE_PROVIDER_OUTPUT_INCOMPLETE');
   const json=JSON.parse(choice.message.content);
   requireValue(json&&typeof json==='object'&&Object.hasOwn(json,'result'),'FREE_PROVIDER_INVALID_OUTPUT');
   return json.result as unknown;
  }
  throw Error('FREE_PROVIDER_HTTP_429');
 };
}
