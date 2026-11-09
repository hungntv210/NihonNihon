import fs from 'node:fs';import path from 'node:path';import { parseArgs } from 'node:util';import { fileURLToPath } from 'node:url';
import { openContentDatabase } from '../../../core/content.ts';import { databasePath } from '../../../core/config.ts';import { validatePreferences,DEFAULT_PREFERENCES } from '../../../core/preferences.ts';
import { readProgress } from '../today-roadmap/repository.ts';import { learnedCatalog,learnerLevel } from './catalog.ts';import { generateWeek,type Provider } from './generation.ts';import { publishBank,savedBanks,storeDirectory,withStoreLock } from './repository.ts';import { requireValue,hash } from './model.ts';
type Config={model:string;verifierModel:string;requestsPerMinute:number;dailyBudget:number;timeoutMs:number;maxOutputTokens:number};
export function geminiProvider(config:Config,ledgerFile:string,key:string,fetcher:typeof fetch=fetch):Provider{
 requireValue(key&&[config.model,config.verifierModel].every(s=>/^gemini-[a-zA-Z0-9._-]+$/.test(s))&&Number.isInteger(config.requestsPerMinute)&&config.requestsPerMinute>0&&Number.isInteger(config.dailyBudget)&&config.dailyBudget>=2&&Number.isInteger(config.timeoutMs)&&config.timeoutMs>0&&Number.isInteger(config.maxOutputTokens)&&config.maxOutputTokens>0,'EXPLICIT_AI_CONFIG_REQUIRED');
 return async(phase,prompt,payload,schema)=>{
  const model=phase==='generate'?config.model:config.verifierModel,directory=path.dirname(ledgerFile),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
  let wait=0;withStoreLock(directory,()=>{const ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile,'utf8')):{models:{}};const entry=ledger.models[model]??={day,count:0,last:0};if(entry.day!==day){entry.day=day;entry.count=0;}requireValue(entry.count<config.dailyBudget,'DAILY_BUDGET_REACHED');wait=Math.max(0,entry.last+Math.ceil(60000/config.requestsPerMinute)-Date.now());entry.count++;entry.last=Date.now()+wait;fs.writeFileSync(ledgerFile,JSON.stringify(ledger),{mode:0o600});});
  if(wait)await new Promise(r=>setTimeout(r,wait));
  const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(config.timeoutMs),body:JSON.stringify({systemInstruction:{parts:[{text:prompt}]},contents:[{role:'user',parts:[{text:JSON.stringify(payload)}]}],generationConfig:{temperature:0,maxOutputTokens:config.maxOutputTokens,responseMimeType:'application/json',responseJsonSchema:schema}})});
  requireValue(response.ok,`AI_HTTP_${response.status}`);const data=await response.json();requireValue(data.candidates?.[0]?.finishReason==='STOP','AI_OUTPUT_INCOMPLETE');return JSON.parse(data.candidates[0].content.parts.filter((p:{text?:string;thought?:boolean})=>p.text&&!p.thought).map((p:{text:string})=>p.text).join(''));
 };
}
export async function generateFromDatabase(week:string,config:Config,file=databasePath(),directory=storeDirectory(),provider?:Provider){
 requireValue(path.basename(file)==='demo.sqlite'||process.env.NIHON_DB_ROLE==='snapshot','USE_APP_DEMO_OR_SNAPSHOT');
 const preferencesFile=process.env.NIHON_SETTINGS_PATH||path.join(path.dirname(file),'settings.json'),preferences=fs.existsSync(preferencesFile)?validatePreferences(JSON.parse(fs.readFileSync(preferencesFile,'utf8'))):DEFAULT_PREFERENCES;
 const progress=readProgress(process.env.NIHON_ROADMAP_PATH||path.join(path.dirname(file),'private','today-roadmap.json')),level=learnerLevel(preferences,progress,new Date(week+'T12:00:00Z'));
 requireValue(!fs.existsSync(path.join(directory,`week-${week}-${level}.json`)),'WEEK_ALREADY_EXISTS');const db=openContentDatabase(file);let catalog;try{catalog=learnedCatalog(db).filter(s=>s.level===level).sort((a,b)=>hash(week+a.id).localeCompare(hash(week+b.id))).slice(0,240);}finally{db.close();}
 const history=savedBanks(directory).flatMap(b=>b.questions).filter(q=>Math.abs(Date.parse(q.date)-Date.parse(week))<=37*86400000);
 const bank=await generateWeek({week,level,catalog,history,model:config.model,verifierModel:config.verifierModel},provider??geminiProvider(config,path.join(directory,'generation-quota.json'),process.env.GEMINI_API_KEY??''));return {file:publishBank(bank,directory),level,questions:bank.questions.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{week:{type:'string'},config:{type:'string'}}});requireValue(values.week&&values.config,'--week YYYY-MM-DD --config PRIVATE_JSON required');try{console.log(JSON.stringify(await generateFromDatabase(values.week,JSON.parse(fs.readFileSync(values.config,'utf8')))));}catch(e){console.error(e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:'GENERATION_FAILED_NO_WEEK_PUBLISHED');process.exitCode=1;}
}
