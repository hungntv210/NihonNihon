import fs from 'node:fs';import path from 'node:path';import {parseArgs} from 'node:util';import {fileURLToPath} from 'node:url';
import {runGemini,publicPlan,settings,validateResults,routeMatches} from './mt-gemini.mjs';
import {need,sha,stable,privateWrite} from './core.mjs';
const contextKey=r=>sha({task:r.task,input:r.input});
export async function runChain({profiles,limit=20,reportPath,...runtime}){
 need(Array.isArray(profiles)&&profiles.length&&Number.isInteger(limit)&&limit>0,'Profiles and positive limit required');
 const plans=[];const completed=new Map();
 for(const p of profiles){const config=p.config??JSON.parse(fs.readFileSync(p.configPath,'utf8'));const mt=settings(config);need(stable(JSON.parse(fs.readFileSync(p.manifestPath,'utf8')).mt)===stable(mt),'Profile manifest mismatch');const plan=await publicPlan(p.manifestPath),requests=plan.requests.filter(r=>routeMatches(r,config.route));
 const byId=new Map(requests.map(r=>[r.request_id,r]));const results=JSON.parse(fs.readFileSync(p.resultsPath,'utf8'));
 validateResults(results,results.map(r=>{need(byId.has(r.request_id),'Unknown result provenance');return byId.get(r.request_id);}));
 for(const row of results)completed.set(contextKey(byId.get(row.request_id)),{model:mt.model,request_id:row.request_id,results_path:p.resultsPath});
 plans.push({p,config,mt,requests});}
 const wanted=plans[0].requests.filter(r=>!completed.has(contextKey(r))).slice(0,limit).map(contextKey),runs=[];
 const save=()=>{const report={runs,results:wanted.filter(k=>completed.has(k)).map(k=>({...completed.get(k),context_key:k})),remaining:wanted.filter(k=>!completed.has(k)).length};if(reportPath)privateWrite(reportPath,JSON.stringify(report,null,2));return report;};
 for(const {p,config,mt,requests} of plans){const remaining=new Set(wanted.filter(k=>!completed.has(k)));if(!remaining.size)break;
 if(p.enabled===false){runs.push({model:mt.model,status:'skipped_unavailable',calls:0});save();continue;}
 const queue=requests.filter(r=>remaining.has(contextKey(r)));if(!queue.length)continue;
 // Every model has its own request IDs, release, manifest and output artifact.
 privateWrite(p.requestsPath,JSON.stringify({version:1,requests:queue},null,2));
 const result=await runGemini({...runtime,...p,config,limit:queue.length});runs.push(result);
 const byId=new Map(requests.map(r=>[r.request_id,r]));for(const row of JSON.parse(fs.readFileSync(p.resultsPath,'utf8')))if(byId.has(row.request_id))completed.set(contextKey(byId.get(row.request_id)),{model:mt.model,request_id:row.request_id,results_path:p.resultsPath});save();
 if(!['complete','api_error','daily_limit','rate_limited','model_disabled'].includes(result.status))break;
 }
 return save();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {values:a}=parseArgs({options:{profiles:{type:'string'},limit:{type:'string'},report:{type:'string'}}});need(a.profiles,'--profiles FILE required');console.log(JSON.stringify(await runChain({profiles:JSON.parse(fs.readFileSync(a.profiles,'utf8')),limit:Number(a.limit??20),reportPath:a.report})));}catch{console.error('Gemini fallback stopped; no raw API error logged');process.exitCode=1;}
}
