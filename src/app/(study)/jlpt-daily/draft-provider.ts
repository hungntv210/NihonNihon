import {geminiProvider} from './generate-week.ts';
import type {Provider} from './generation.ts';
import {requireValue,hash} from './model.ts';

type Profile=Parameters<typeof geminiProvider>[0];
export type DraftAttempt={at:string;phase:'generate'|'verify';model:string;attempt:number;status:'ok'|'error';error?:string;outputHash?:string};
// This retry chain is offline-draft only; the app's learned-content gate is unchanged.
export function draftProvider(profiles:Profile[],ledger:string,key:string,options:{
 fetcher?:typeof fetch;sleep?:(ms:number)=>Promise<void>;
 onAttempt?:(event:DraftAttempt,payload:unknown,output?:unknown)=>void;
}={}):Provider{
 requireValue(profiles.length>0&&profiles.every(p=>p.model===p.verifierModel),'EXPLICIT_DRAFT_MODEL_CHAIN_REQUIRED');
 const providers=profiles.map(p=>geminiProvider(p,ledger,key,options.fetcher));
 let current=0;
 return async(phase,prompt,payload,schema)=>{
  for(;current<providers.length;current++){
   for(let attempt=0;attempt<3;attempt++){
    try{
     const output=await providers[current](phase,prompt,payload,schema);
     options.onAttempt?.({at:new Date().toISOString(),phase,model:profiles[current].model,attempt:attempt+1,status:'ok',outputHash:hash(output)},payload,output);
     return output;
    }catch(e){
     const error=(e instanceof Error?e.message:String(e)).replaceAll(key,'[REDACTED]').replace(/AIza[\w-]+/g,'[REDACTED]');
     options.onAttempt?.({at:new Date().toISOString(),phase,model:profiles[current].model,attempt:attempt+1,status:'error',error},payload);
     // Quota, schema and QA failures must never be hidden by a retry/fallback.
     if(!/^AI_HTTP_503:/.test(error))throw Error(error);
     if(attempt<2)await (options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))([30000,60000][attempt]);
     else if(current===providers.length-1)throw Error(error);
    }
   }
  }
  throw Error('DRAFT_MODELS_EXHAUSTED');
 };
}
