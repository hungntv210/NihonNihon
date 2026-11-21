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

type Quota={day:string;count:number;blockedUntil?:number};
const dayMs=86_400_000;
const nextUtcDay=(now:number)=>(Math.floor(now/dayMs)+1)*dayMs;
const quotaDay=(now:number)=>new Date(now).toISOString().slice(0,10);
function withQuota(file:string,provider:FreeProvider,change:(entry:Quota,now:number)=>void){
 withStoreLock(path.dirname(file),()=>{
  const ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{models:{}};
  const providers=ledger.providers??={};
  const now=Date.now(),day=quotaDay(now);
  const entry:Quota=providers[provider]??={day,count:0};
  if(entry.day!==day){entry.day=day;entry.count=0;}
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
 const date=value?Date.parse(value):NaN;
 return Number.isFinite(date)&&date>now?date:now+30_000;
}

export function freeCompletion(config:{provider:FreeProvider;model:string;key:string;ledger:string;timeoutMs:number;maxOutputTokens:number;groqFreeTier?:boolean;fetcher?:typeof fetch}){
 const {provider,model,key,ledger,fetcher=fetch}=config;
 const router=provider==='openrouter';
 requireValue(router?/^[\w.-]+\/[\w.-]+:free$/u.test(model):[freeModels.groqSolver,freeModels.groqReview].some(id=>id===model),
  router?'OPENROUTER_FREE_MODEL_REQUIRED':'GROQ_MODEL_NOT_ALLOWED');
 requireValue(key&&(router||config.groqFreeTier===true),'FREE_PROVIDER_NOT_ENABLED');
 const base=router?'https://openrouter.ai/api/v1':'https://api.groq.com/openai/v1';
 const headers={authorization:'Bearer '+key,'content-type':'application/json'};
 const cap=router?50:200;
 const check=(entry:Quota,now:number)=>{
  requireValue(entry.count<cap,'FREE_PROVIDER_DAILY_BUDGET_REACHED');
  requireValue((entry.blockedUntil??0)<=now,'FREE_PROVIDER_RATE_LIMITED');
 };
 const block=(until:number)=>withQuota(ledger,provider,entry=>{entry.blockedUntil=Math.max(entry.blockedUntil??0,until);});
 return async(prompt:string,payload:unknown,schema:unknown)=>{
  withQuota(ledger,provider,check);
  if(router){
   const response=await fetcher(base+'/key',{headers,signal:AbortSignal.timeout(config.timeoutMs),redirect:'error'});
   if(response.status===429)block(retryUntil(response.headers,Date.now()));
   requireValue(response.ok,'OPENROUTER_KEY_HTTP_'+response.status);
   const keyInfo=(await response.json()).data;
   requireValue(keyInfo&&(keyInfo.limit_remaining===null||
    (typeof keyInfo.limit_remaining==='number'&&keyInfo.limit_remaining>=0)),'OPENROUTER_INVALID_KEY_LIMIT');
  }
  withQuota(ledger,provider,(entry,now)=>{check(entry,now);entry.count++;});
  const response=await fetcher(base+'/chat/completions',{
   method:'POST',headers,signal:AbortSignal.timeout(config.timeoutMs),redirect:'error',
   body:JSON.stringify({
    model,temperature:0,max_completion_tokens:config.maxOutputTokens,
    ...(router?{provider:{max_price:{prompt:0,completion:0,request:0},require_parameters:true}}:{}),
    messages:[{role:'system',content:prompt+' Return a JSON object with a single "result" field matching this schema: '+JSON.stringify(schema)},
     {role:'user',content:JSON.stringify(payload)}],
    response_format:{type:'json_object'},
   }),
  });
  const now=Date.now();
  const until=Math.max(router?0:groqRateLimitUntil(response.headers,now),
   response.status===429?retryUntil(response.headers,now):0);
  if(until>now)block(until);
  requireValue(response.ok,'FREE_PROVIDER_HTTP_'+response.status);
  const choice=(await response.json()).choices?.[0];
  requireValue(choice?.finish_reason==='stop'&&typeof choice.message?.content==='string','FREE_PROVIDER_OUTPUT_INCOMPLETE');
  const json=JSON.parse(choice.message.content);
  requireValue(json&&typeof json==='object'&&Object.hasOwn(json,'result'),'FREE_PROVIDER_INVALID_OUTPUT');
  return json.result as unknown;
 };
}
