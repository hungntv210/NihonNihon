import { nfc,sha,nonempty,need,itemId } from './core.mjs';

export const RULE='HV-1.2', ALIAS_VERSION='hv-alias-1';
const aliases = new Map([['nhựt','nhật'],['nhơn','nhân'],['sanh','sinh'],['tí','tý']]);
export const canonical = s => aliases.get(s.normalize('NFC').toLowerCase()) || s.normalize('NFC').toLowerCase();
export function readingGroups(character,entries=[]) {
  const before=new Set(), groups=new Map();
  for(const entry of entries) for(const token of entry.raw.normalize('NFC').toLowerCase().split(/\s+/u).filter(Boolean)) {
    before.add(token); const value=canonical(token);
    if(!groups.has(value))groups.set(value,{id:'hv:'+sha({character,value}).slice(0,24),reading:value,raw_readings:[],refs:[]});
    const group=groups.get(value); if(!group.raw_readings.includes(token))group.raw_readings.push(token);
    if(!group.refs.some(r=>r.key===entry.key && r.a.release_id===entry.a.release_id)) group.refs.push(entry);
  }
  return {before:before.size,groups:[...groups.values()]};
}
export function canonicalMTInput(task,input,config){
 if(task==='translate'&&input.field==='text'&&config?.config?.sentence_key==='ja-nfc-v1'&&/^(?:tatoeba:sentence:|openjlpt:sentence:|ja:sentence:)/.test(input.item_id)){
 const ja=input.ja.normalize('NFC');return {item_id:'ja:sentence:'+sha(ja),field:'text',base_hash:sha({ja}),ja,reading:null};}
 return input;
}
export function createMT(loaded,data,db) {
  if(loaded.manifest.mt_profiles){
    const configs=loaded.manifest.mt_profiles;need(Array.isArray(configs)&&configs.length&&new Set(configs.map(sha)).size===configs.length,'Invalid MT profiles');
    for(const a of loaded.artifacts.filter(a=>a.file.format==='mt-results'))need(configs.some(c=>c.source_id===a.source.source_id&&sha(c)===a.file.mt_config_sha256),'MT artifact requires a matching pinned profile');
    const engines=configs.map(config=>createMT({...loaded,manifest:{...loaded.manifest,mt_profiles:undefined,mt:config}},data,db));
    const requests=new Map();
    return {source:engines[0].source,release:engines[0].release,releases:engines.flatMap(e=>e.releases),requests,
      get stats(){return engines.reduce((sum,e)=>{for(const k of Object.keys(sum))sum[k]+=e.stats[k];return sum;},{cache_hits:0,invalid_outputs:0,attempts:0});},
      ask(task,input,validate,options={}){const found=[],seen=new Set();
        for(const engine of engines){const r=engine.ask(task,input,validate);if(r)for(const v of [r,...r.alternatives??[]]){const key=sha({release:v.release.release_id,request:v.request_id,output:v.output});if(!seen.has(key)){seen.add(key);found.push(v);}}}
        if(found.length)return {...found[0],alternatives:found.slice(1)};
        if(options.allowRequest!==false){const route=task==='translate'&&input.field==='text'?'sentences':'learning',index=configs.findIndex(c=>c.config?.route===route&&!configs.some(other=>other.source_id===c.source_id&&other.config?.route===route&&other.config?.supersedes_prompt_versions?.includes(c.prompt_version))),engine=engines[index<0?0:index];const id=sha({task,input:canonicalMTInput(task,input,configs[index<0?0:index]),release:engine.release?.release_id??null});requests.set(id,engine.requests.get(id));}return null;
      }};
  }
  const requests=new Map(), stats={cache_hits:0,invalid_outputs:0,attempts:0};
  const config=loaded.manifest.mt;
  let source=null,release=null;
  if(config) {
    source=loaded.manifest.sources.find(s=>s.source_id===config.source_id);
    need(source && source.source_id.startsWith('mt:') && !source.source_id.includes('<'),'MT source must be a configured provider');
    for(const k of ['model','prompt_version','prompt_sha256'])need(nonempty(config[k]),`MT ${k} required`);
    need(/^[0-9a-f]{64}$/.test(config.prompt_sha256),'Invalid prompt hash');
    need(Number.isInteger(config.max_attempts ?? 2) && (config.max_attempts ?? 2)>=1 && (config.max_attempts ?? 2)<=5,'MT max_attempts must be 1..5');
    const checksum=sha(config);
    release={release_id:`${source.source_id}:config:${checksum.slice(0,32)}`,source_id:source.source_id,version:`${config.model}:${config.prompt_version}`,checksum,artifact_url:`local://mt/${checksum}/manifest.json`,license:source.license,attribution:source.attribution,manifest_json:JSON.stringify(config)};
  }
  // Index once per immutable import plan instead of scanning every result for every field.
  const responsesByRequest=new Map(),cachedByRequest=new Map();
  for(const response of data.responses)if(response.a.source.source_id===source?.source_id&&(!response.a.file.mt_config_sha256||response.a.file.mt_config_sha256===release?.checksum)){const id=response.row.request_id;if(!responsesByRequest.has(id))responsesByRequest.set(id,[]);responsesByRequest.get(id).push(response);}
  if(release&&db)for(const row of db.prepare("SELECT context_json FROM vi_translations WHERE method='machine' AND release_id=? AND needs_refresh=0 ORDER BY created_at").all(release.release_id)){const context=JSON.parse(row.context_json);if(!cachedByRequest.has(context.request_id))cachedByRequest.set(context.request_id,context.mt_output);}
  function ask(task,input,validate,options={}) {
    input=canonicalMTInput(task,input,config);
    const found=[];
    const request_id=sha({task,input,release:release?.release_id ?? null});
    if(cachedByRequest.has(request_id)){const output=cachedByRequest.get(request_id);try{validate(output);stats.cache_hits++;found.push({output,request_id,source,release});}catch{/* Source context changed; revalidate before reuse. */}}
    const attempts=(responsesByRequest.get(request_id)??[]).slice(0,config?.max_attempts ?? 2);
    for(const attempt of attempts) {
      stats.attempts++;
      try { const output=nfc(attempt.row.output);validate(output);if(!found.some(r=>sha(r.output)===sha(output)))found.push({output,request_id,source,release}); }
      catch { stats.invalid_outputs++; }
    }
    if(found.length)return {...found[0],alternatives:found.slice(1)};
    if(options.allowRequest!==false)requests.set(request_id,{request_id,task,mt_release_id:release?.release_id ?? null,input,reason:!config?'provider_not_configured':attempts.length?'invalid_output':'result_not_supplied'});
    return null;
  }
  return {source,release,releases:release?[release]:[],requests,stats,ask};
}

export function selectHanViet({character,entries,compounds=[],japaneseCompounds=[],unihan=null,unihanAvailable=false,mt,item_id,base_hash}) {
  const normalized=readingGroups(character,entries), groups=normalized.groups;
  const trace=[], allowed=groups.map(g=>g.reading);
  const base={candidate_readings:allowed,candidate_ids:groups.map(g=>g.id),raw_readings:[...new Set(groups.flatMap(g=>g.raw_readings))],alias_rules_version:ALIAS_VERSION,selection_rule_version:RULE};
  let chosen=null,method=null,evidence=null,ai=null,unihanStatus='not_attempted';
  if(groups.length===1) {chosen=groups[0];method='single_after_normalization';evidence={remaining_candidates:1,source_records:chosen.refs.map(r=>({source_id:r.a.source.source_id,release_id:r.a.release_id,key:r.key}))};}
  trace.push({step:1,result:chosen?'selected':groups.length?'multiple':'missing_readings'});
  const counts=Object.fromEntries(groups.map(g=>[g.reading,new Set()]));
  if(!chosen && groups.length>1) {
    for(const c of compounds) if(counts[c.reading])counts[c.reading].add(c.compound_key);
    const ranked=groups.map(g=>({g,count:counts[g.reading].size})).sort((a,b)=>b.count-a.count);
    const supported=ranked.filter(r=>r.count>0);
    if(ranked[0].count>=2 && ranked[0].count>ranked[1].count) {
      chosen=ranked[0].g;method='cvdict_compound';
      evidence={rule:supported.length===1?'only_one_supported':'unique_max_ge_2',counts:Object.fromEntries(ranked.map(r=>[r.g.reading,r.count])),compounds:compounds.filter(c=>c.reading===chosen.reading)};
    }
    trace.push({step:2,result:chosen?'selected':'insufficient_or_tied',counts:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v.size]))});
  }
  if(!chosen && groups.length>1) {
    const intersect=unihan? [...new Set(unihan.raw.split(/\s+/u).filter(Boolean).map(canonical))].filter(s=>allowed.includes(s)) : [];
    unihanStatus=!unihanAvailable?'not_available':!unihan?'missing':intersect.length===1?'unique_match':intersect.length?'ambiguous':'no_match';
    if(intersect.length===1) {chosen=groups.find(g=>g.reading===intersect[0]);method='unihan_match';evidence={raw:unihan.raw,normalized:intersect,source_id:unihan.a.source.source_id,release_id:unihan.a.release_id,key:unihan.key};}
    trace.push({step:3,result:unihanStatus});
  }
  if(!chosen && groups.length>1) {
    const input={item_id,character,base_hash,rule:RULE,alias_version:ALIAS_VERSION,candidates:groups.map(g=>({id:g.id,reading:g.reading})),compounds:[...japaneseCompounds,...compounds.map(c=>({word:c.word,reading:c.japanese_reading,meaning:c.meaning,source_id:c.source_id,release_id:c.release_id}))],selection_trace:trace};
    ai=mt.ask('han_viet',input,output=>{
      need(output && groups.some(g=>g.id===output.candidate_id),'AI reading outside candidate set');
      need(nonempty(output.reason) && nonempty(output.meaning) && output.compound && nonempty(output.compound.word) && nonempty(output.compound.reading),'AI evidence is required');
      need(['input','model-generated'].includes(output.evidence_origin),'AI evidence origin required');
      need(Array.isArray(output.references),'AI references must be an array');
      if(output.evidence_origin==='input')need(input.compounds.some(c=>c.word===output.compound.word && c.reading===output.compound.reading),'Fabricated input compound');
      for(const ref of output.references)need(input.compounds.some(c=>c.source_id===ref.source_id && c.release_id===ref.release_id),'Fabricated AI source');
    });
    if(ai) {chosen=groups.find(g=>g.id===ai.output.candidate_id);method='ai_fallback';evidence=ai.output;}
    trace.push({step:4,result:chosen?'selected':'unresolved'});
  }
  const context=chosen?{...base,canonical_reading:chosen.reading,selection_method:method,selection_trace:trace,evidence,unihan_check:{status:unihanStatus},...(ai?{request_id:ai.request_id,mt_output:ai.output}:{})}:null;
  return {...normalized,chosen,method,context,ai,trace,unihanStatus};
}

export function compoundEvidence(character,data) {
  const evidence=[];
  for(const {row:v,a} of data.allVocab) {
    for(const word of new Set([v.word,...v.other_forms || []])) {
      if(!word.includes(character) || Array.from(word).length<2)continue;
      for(const entry of data.cvdict.get(word) || []) for(const gloss of entry.glosses) {
        const syllables=gloss.trim().normalize('NFC').toLowerCase().split(/\s+/u).map(canonical), chars=Array.from(word);
        if(syllables.length!==chars.length || !chars.every((c,i)=>readingGroups(c,data.hv.get(c)).groups.some(g=>g.reading===syllables[i])))continue;
        const readings=new Set(chars.flatMap((c,i)=>c===character?[syllables[i]]:[])); if(readings.size!==1)continue;
        evidence.push({compound_key:`${v.word}\0${v.reading}`,compound_id:itemId('vocab',v),word,japanese_reading:v.reading,meaning:v.meanings,reading:[...readings][0],source_id:entry.a.source.source_id,release_id:entry.a.release_id,source_record_key:entry.key,gloss,via_openjlpt_release:a.release_id});
      }
    }
  }
  return evidence;
}
