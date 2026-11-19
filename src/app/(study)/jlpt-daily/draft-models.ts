import {requireValue} from './model.ts';
import type {geminiProvider} from './generate-week.ts';
// Primary is owner-selected; fallback order is a quality policy, not a JLPT benchmark.
export const draftModelOrder=['gemini-3.6-flash','gemini-4-carbon','gemini-4-argon','gemini-4-hydrogen','gemini-3.8-flash'] as const;
export async function discoverDraftProfiles(config:Parameters<typeof geminiProvider>[0],key:string,fetcher:typeof fetch=fetch){
 requireValue(key&&config.model===draftModelOrder[0]&&config.verifierModel===config.model,'PRIMARY_36_REQUIRED');
 const available=new Set<string>();let page='';const seen=new Set<string>();
 do{
  requireValue(!seen.has(page)&&seen.size<20,'INVALID_MODEL_PAGINATION');seen.add(page);
  const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models'+(page?'?pageToken='+encodeURIComponent(page):''),{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(config.timeoutMs)});
  requireValue(response.ok,'MODEL_LIST_HTTP_'+response.status);const body=await response.json();requireValue(Array.isArray(body.models),'INVALID_MODEL_LIST');
  for(const m of body.models)if(m.supportedGenerationMethods?.includes('generateContent'))available.add(String(m.name).replace(/^models\//u,''));page=body.nextPageToken??'';
 }while(page);
 requireValue(available.has(draftModelOrder[0]),'PRIMARY_MODEL_UNAVAILABLE');
 return draftModelOrder.filter(model=>available.has(model)).map(model=>({...config,model,verifierModel:model,dailyBudget:Math.min(config.dailyBudget,200)}));
}
