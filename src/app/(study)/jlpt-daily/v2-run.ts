import {candidates,validateV2,dailyMix,supportedTypes,type V2Question} from './deterministic.ts';
import {hash,requireValue,type Question} from './model.ts';
import type {V2Context} from './v2-data.ts';
import type {Provider} from './generation.ts';
import {verifyDeterministic,verifierHash} from './v2-verifier.ts';
export type V2Run={version:2;mode:V2Context['mode'];week:string;inputHash:string;status:string;questions:V2Question[];audit:Record<string,unknown>;rejected:{id:string;date:string;type:string;reason:string}[];statistics:{hard:Record<string,number>;attempted:Record<string,number>;accepted:Record<string,number>;rejected:Record<string,number>};days:{date:string;count:number;mix:boolean}[]};
const increment=(map:Record<string,number>,key:string)=>map[key]=(map[key]??0)+1;
export async function runDeterministic(contexts:V2Context[],history:Question[],options:{provider?:Provider;noVerifier?:boolean;supplement?:boolean;seed?:V2Run;checkpoint?:(r:V2Run)=>void}){
 requireValue(contexts.length===7&&contexts.every(c=>c.mode===contexts[0].mode),'SEVEN_DAY_CONTEXT_REQUIRED');
 requireValue(options.provider||options.noVerifier,'VERIFIER_REQUIRED');const inputHash=hash({contexts,history,verifierHash,supplement:!!options.supplement}),run:V2Run=options.seed??{version:2,mode:contexts[0].mode,week:contexts[0].date,inputHash,status:'running',questions:[],audit:{},rejected:[],statistics:{hard:{},attempted:{},accepted:{},rejected:{}},days:[]};
 requireValue(run.inputHash===inputHash,'RESUME_CONTEXT_CHANGED');const used=new Set([...run.questions,...run.rejected].map(q=>q.id));
 const checkpoint=()=>{run.days=contexts.map(c=>{const rows=run.questions.filter(q=>q.date===c.date);return{date:c.date,count:rows.length,mix:dailyMix(rows)};});options.checkpoint?.(structuredClone(run));};
 const pools=contexts.map(candidates);run.statistics.hard={};for(const pool of pools)for(const[reason,n]of Object.entries(pool.rejected))run.statistics.hard[reason]=(run.statistics.hard[reason]??0)+n;
 for(const [day,c]of contexts.entries()){
  const baseline=options.supplement?history.filter(q=>q.date===c.date):[];const pool=pools[day];
  const existing=run.questions.filter(q=>q.date===c.date);let rounds=0;
  while(baseline.length+existing.length<10&&rounds++<pool.questions.length+1){
   const selected:V2Question[]=[],weeklyTypes=new Set(run.questions.map(q=>q.type));
   for(let position=baseline.length+existing.length;position<10;position++){
    const daily=[...baseline,...existing,...selected],types=new Set(daily.map(q=>q.type));const missingGrammar=!daily.some(q=>['grammar','order'].includes(q.type));const needed=missingGrammar?(!weeklyTypes.has('order')?'order':'grammar'):position===0?(!weeklyTypes.has('order')?'order':'grammar'):position===1?'reading':position===2?'spelling':supportedTypes[position%supportedTypes.length];
    const ordered=[...pool.questions].sort((a,b)=>Number(b.type===needed)-Number(a.type===needed)||Number(types.has(a.type))-Number(types.has(b.type))||hash(c.date+a.id).localeCompare(hash(c.date+b.id)));
    let next:V2Question|undefined;for(const q of ordered){if(options.supplement&&!['grammar','order'].includes(q.type)||daily.filter(other=>other.type===q.type).length>=3||used.has(q.id)||daily.length===9&&(missingGrammar&&!['grammar','order'].includes(q.type)||types.size<3&&types.has(q.type)))continue;try{validateV2(q,c,[...history,...run.questions,...selected]);next=q;break;}catch{/* history collision: try another source/slot */}}
    if(!next)break;used.add(next.id);selected.push({...next,day,position});weeklyTypes.add(next.type);
   }
   if(!selected.length)break;
   try{
    const audits=options.noVerifier?selected.map(q=>({id:q.id,accepted:true,reason:'',fixtureOnly:true})):await verifyDeterministic(options.provider!,selected);
    for(const q of selected){increment(run.statistics.attempted,q.type);const audit=audits.find(a=>a.id===q.id)!;run.audit[q.id]=audit;if(audit.accepted){q.position=baseline.length+existing.length;existing.push(q);run.questions.push(q);increment(run.statistics.accepted,q.type);}else{run.rejected.push({id:q.id,date:c.date,type:q.type,reason:audit.reason});increment(run.statistics.rejected,audit.reason);}}
   }catch(e){for(const q of selected)used.delete(q.id);run.status='stopped:'+(e instanceof Error?e.message.split(':')[0]:'VERIFIER_ERROR');checkpoint();return run;}
   checkpoint();
  }
 }
 checkpoint();const types=new Set(run.questions.map(q=>q.type));run.status=options.noVerifier?'unverified_fixture':run.days.every(d=>d.mix)&&['reading','spelling','grammar','order'].every(t=>types.has(t as any))?'ready_for_tester':'partial_data_or_qa';checkpoint();return run;
}
