import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { sha,hash,stable,need,now,itemId,keyFor,nonempty } from './core.mjs';
import { jmdictForms } from './adapters.mjs';
import { RULE,createMT,selectHanViet,compoundEvidence,readingGroups,canonical } from './han-viet.mjs';

const src=a=>({source_id:a.source.source_id,release_id:a.release_id});
const kana=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCodePoint(c.codePointAt(0)-0x60));
export function buildPlan(loaded,data,db) {
  const plan={runId:randomUUID(),startedAt:now(),manifestHash:loaded.manifestHash,sources:new Map(),releases:new Map(),items:new Map(),translations:new Map(),rows:Object.fromEntries(['vocab','kanji','grammar','sentences','vocab_forms','item_sentences','kanji_vocab','media_assets','clip_segments'].map(t=>[t,[]])),supplementRows:{},replaceScopes:[],retireKinds:[],clipIds:[],warnings:[],requests:[]};
  const add=(table,row,keys)=>(plan.rows[table]??=[]).push({row,keys});
  const supplemental=(table,row,keys)=>{(plan.supplementRows[table]??=[]).push({row,keys});};
  for(const a of loaded.artifacts) {
    const s=a.source;
    plan.sources.set(s.source_id,{source_id:s.source_id,name:s.name,url:s.url,license:s.license,version:s.version,imported_at:plan.startedAt,checksum:sha(s.files.map(f=>({format:f.format,sha256:f.sha256}))),attribution:s.attribution,usage_scope:s.usage_scope});
    plan.releases.set(a.release_id,{release_id:a.release_id,source_id:s.source_id,version:s.version,checksum:a.file.sha256,artifact_url:a.file.url || pathToFileURL(a.local).href,retrieved_at:a.file.retrieved_at || plan.startedAt,license:s.license,attribution:s.attribution,manifest_json:stable({format:a.file.format,encoding:a.file.encoding || 'utf-8',compression:a.file.compression || null,level:a.file.level || null})});
  }
  const mt=createMT(loaded,data,db);
  for(const release of mt.releases)plan.releases.set(release.release_id,{...release,retrieved_at:plan.startedAt});
  function content(id,kind,key,row,a,extra={}) {
    const record={item_id:id,kind,source_key:String(key),...src(a),source_hash:sha(row),field_sources:stable(extra),is_active:1};
    const existing=plan.items.get(id);
    need(!existing || existing.source_hash===record.source_hash,`Conflicting content for ${id}`);
    if(!existing)plan.items.set(id,record);
    return plan.items.get(id);
  }
  function translation(id,field,value,reference,method,match,key,context={},selected=true) {
    need(nonempty(value),'Empty Vietnamese translation'); const text_vi=value.normalize('NFC');
    const item=plan.items.get(id); need(item,'Translation refers to missing item');
    const base_content_hash=item.source_hash;
    const translation_id='tr:'+sha({id,field,text_vi,...reference,key,base_content_hash,decision:field==='han_viet'?context:null});
    const row={translation_id,item_id:id,field,text_vi,method,match_method:match,...reference,source_record_key:key,base_content_hash,status:selected?'selected':'candidate',needs_refresh:0,context_json:stable(context),created_at:plan.startedAt};
    plan.translations.set(translation_id,row);return row;
  }
  function hasCurrent(id,field) {
    return db?.prepare("SELECT 1 FROM vi_translations WHERE item_id=? AND field=? AND status='selected' AND needs_refresh=0 AND base_content_hash=?").get(id,field,plan.items.get(id).source_hash);
  }
  function machine(id,field,input) {
    const current=hasCurrent(id,field);
    const result=mt.ask('translate',{item_id:id,field,base_hash:plan.items.get(id).source_hash,...input},out=>{
      need(out && nonempty(out.text_vi),'MT text_vi is required');
      need(out.text_vi===out.text_vi.normalize('NFC'),'MT text must normalize to NFC');
    },{allowRequest:!current});
    if(!result)return !!current;
    for(const [i,value] of [result,...result.alternatives??[]].entries())translation(id,field,value.output.text_vi,{source_id:value.source.source_id,release_id:value.release.release_id},'machine','machine_context',value.request_id,{request_id:value.request_id,mt_output:value.output,input},i===0);
    return true;
  }
  const seenSentences=new Set(), missingAttribution=[];
  function sentence(example,a) {
    const detail=example.tatoeba_id?data.tatoeba.get(example.tatoeba_id):null;
    if(detail)need(detail.lang==='jpn' && detail.text===example.ja,'Tatoeba Japanese sentence differs from OpenJLPT snapshot');
    const id=example.tatoeba_id?`tatoeba:sentence:${example.tatoeba_id}`:`openjlpt:sentence:${sha(example.ja)}`;
    const owner=detail?.a || a;
    const author=detail?.author || (example.tatoeba_id?'Tatoeba contributor not resolved':a.source.attribution);
    if(example.tatoeba_id && !detail?.author)missingAttribution.push(id);
    const record={text_ja:example.ja,text_en:example.en,furigana_notation:example.furigana || null,tatoeba_ja_id:example.tatoeba_id || null,author_attribution:author};
    if(example.furigana)need(example.furigana.replace(/\{([^|{}]+)\|[^{}]+\}/g,'$1')===example.ja,'Furigana does not reconstruct sentence');
    const old=plan.items.get(id);
    if(old) {const prior=plan.rows.sentences.find(r=>r.row.item_id===id).row;need(prior.text_ja===record.text_ja && prior.text_en===record.text_en,'Conflicting sentence translations; resolve upstream before import');}
    else {content(id,'sentence',example.tatoeba_id || sha(example.ja),record,owner,{examples:src(a)});add('sentences',{item_id:id,...record},['item_id']);}
    if(!seenSentences.has(id)) {
      seenSentences.add(id);
      const vi=[...(data.links.get(example.tatoeba_id) || [])].map(i=>data.tatoeba.get(i)).filter(r=>r?.lang==='vie'&&nonempty(r.author));
      if(vi.length)for(const [i,v]of vi.entries())translation(id,'text',v.text,src(v.a),'tatoeba','tatoeba_link',String(v.id),{japanese_id:example.tatoeba_id,vietnamese_id:v.id,author:v.author,license:v.a.source.license,direct_link:true},i===0);
      else machine(id,'text',{ja:example.ja,en:example.en,reading:null});
    }
    return id;
  }
  for(const kind of ['vocab','kanji','grammar']) for(const [id,{row:r,a}]of data[kind]) {
    content(id,kind,keyFor(kind,r),r,a,{upstream:{...src(a),jmdict_id:r.jmdict_id || null}});
    if(kind==='vocab') {
      add('vocab',{item_id:id,word:r.word,reading:r.reading,romaji:r.romaji,level:r.level,meanings_en:stable(r.meanings),pos:stable(r.pos || []),jmdict_id:r.jmdict_id ?? null},['item_id']);
      for(const [form_kind,forms] of [['writing',r.other_forms || []],['reading',r.other_readings || []]])for(const form of new Set(forms))add('vocab_forms',{item_id:id,form_kind,form,...src(a)},['item_id','form_kind','form']);
      const forms=[...new Set([...r.other_forms || [],...jmdictForms(r,data.jmdict.get(r.jmdict_id))])];
      for(const form of forms)if(!(r.other_forms || []).includes(form))add('vocab_forms',{item_id:id,form_kind:'writing',form,...src(data.jmdict.get(r.jmdict_id).a)},['item_id','form_kind','form']);
      let matched=false;
      if(!data.ambiguous.has(r.word)) for(const word of [r.word,...forms]) {
        if(data.ambiguous.has(word))continue;
        const records=data.javi.get(word) || [];
        if(records.length===1){const v=records[0];translation(id,'meaning',v.meaning,src(v.a),'dictionary',word===r.word?'word':'jmdict_form',v.key,{matched_word:word,reading:r.reading,source_reading_available:false});matched=true;break;}
      }
      if(!matched)machine(id,'meaning',{word:r.word,reading:r.reading,meanings_en:r.meanings,pos:r.pos || [],examples:r.examples || [],reason:data.ambiguous.has(r.word)?'ambiguous_headword':'dictionary_unresolved'});
    } else if(kind==='kanji') {
      add('kanji',{item_id:id,character:r.character,level:r.level,strokes:r.strokes,grade:r.grade,frequency_rank:r.freq,radical:r.radical,radical_number:r.radical_number,onyomi:stable(r.onyomi),kunyomi:stable(r.kunyomi),nanori:stable(r.nanori || []),meanings_en:stable(r.meanings),supplementary:r.supplementary?1:0},['item_id']);
      machine(id,'meaning',{character:r.character,meanings_en:r.meanings});
    } else {
      add('grammar',{item_id:id,pattern:r.pattern,reading:r.reading ?? null,romaji:r.romaji,level:r.level,meaning_en:r.meaning,formation_en:r.formation,notes_en:r.notes ?? null,tags:stable(r.tags)},['item_id']);
      for(const [field,value]of [['meaning',r.meaning],['formation',r.formation],['notes',r.notes]])if(value)machine(id,field,{pattern:r.pattern,en:value,examples:r.examples});
    }
    for(const [i,ex]of (r.examples || []).entries()) {
      const sentence_id=sentence(ex,a);
      if(!plan.rows.item_sentences.some(e=>e.row.item_id===id && e.row.sentence_id===sentence_id))add('item_sentences',{item_id:id,sentence_id,position:i,...src(a)},['item_id','sentence_id']);
    }
  }
  const hvResults=new Map();
  for(const [id,{row:r}]of data.kanji) {
    const japaneseCompounds=data.allVocab.filter(e=>e.row.word.includes(r.character)).map(e=>({word:e.row.word,reading:e.row.reading,meaning:e.row.meanings,...src(e.a)}));
    const result=selectHanViet({character:r.character,item_id:id,base_hash:plan.items.get(id).source_hash,entries:data.hv.get(r.character),compounds:compoundEvidence(r.character,data),japaneseCompounds,unihan:data.unihan.get(r.character),unihanAvailable:loaded.artifacts.some(a=>a.file.format==='unihan'),mt});
    hvResults.set(id,result);
    for(const group of result.groups) {
      const ref=group.refs[0], selected=result.chosen?.id===group.id && !result.ai;
      translation(id,'han_viet',group.reading,src(ref.a),'han_viet','codepoint',`${r.character}|${group.reading}`,selected?result.context:{canonical_reading:group.reading,raw_readings:group.raw_readings,alias_rules_version:'hv-alias-1',source_records:group.refs.map(r=>({key:r.key,...src(r.a)}))},selected);
    }
    if(result.ai)for(const [i,ai]of [result.ai,...result.ai.alternatives??[]].entries()){const group=result.groups.find(g=>g.id===ai.output.candidate_id);translation(id,'han_viet',group.reading,{source_id:ai.source.source_id,release_id:ai.release.release_id},'machine','machine_context',ai.request_id,{...result.context,canonical_reading:group.reading,request_id:ai.request_id,mt_output:ai.output,evidence:ai.output},i===0);}
    for(const [vid,{row:v}]of data.vocab)if((r.words || []).includes(v.word))add('kanji_vocab',{kanji_id:id,vocab_id:vid,...src(data.kanji.get(id).a)},['kanji_id','vocab_id']);
  }
  // Compose word Han Viet only when the Japanese reading can be all-On and each syllable is resolved.
  for(const [id,{row:v}]of data.vocab) {
    const chars=Array.from(v.word); if(!chars.length || !chars.every(c=>data.kanji.has(`openjlpt:kanji:U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`)))continue;
    let positions=new Set([0]);
    for(const c of chars) {const k=[...data.kanji.values()].find(e=>e.row.character===c).row;const next=new Set();for(const p of positions)for(const on of k.onyomi){const s=kana(on).replace(/[-.]/g,'');if(s && kana(v.reading).startsWith(s,p))next.add(p+s.length);}positions=next;}
    if(!positions.has(kana(v.reading).length))continue;
    const resolved=chars.map(c=>{
      const groups=readingGroups(c,data.hv.get(c)).groups;
      if(groups.length===1)return groups[0];
      const proof=new Set(compoundEvidence(c,data).filter(e=>e.compound_key===`${v.word}\0${v.reading}`).map(e=>e.reading));
      return proof.size===1?groups.find(g=>g.reading===[...proof][0]):null;
    });
    if(resolved.every(Boolean))translation(id,'han_viet',resolved.map(g=>g.reading).join(' '),src(resolved[0].refs[0].a),'han_viet','word_reading','compose:'+id,{word:v.word,reading:v.reading,all_on:true,source_records:resolved.flatMap(g=>g.refs.map(r=>({key:r.key,...src(r.a)})))});
  }
  const kanjiByChar=new Map([...data.kanji].map(([id,e])=>[e.row.character,id]));
  const lookupWords=new Set([...data.vocab.values()].flatMap(e=>[e.row.word,...e.row.other_forms || []]));
  for(const e of data.furigana)if(lookupWords.has(e.row.text))supplemental('word_furigana',{word:e.row.text,reading:e.row.reading,segments:stable(e.row.furigana),...src(e.a)},['word','reading','source_id']);
  for(const e of data.components)if(kanjiByChar.has(e.character))for(const component of new Set(e.parts))supplemental('kanji_components',{kanji_id:kanjiByChar.get(e.character),component,...src(e.a)},['kanji_id','component','source_id']);
  const pathGroups=new Map();
  for(const e of data.strokes)if(kanjiByChar.has(e.character)) {
    const id=kanjiByChar.get(e.character),key=`${id}:${e.variant}`;if(!pathGroups.has(key))pathGroups.set(key,[]);pathGroups.get(key).push(e);
    supplemental('kanji_strokes',{kanji_id:id,variant:e.variant,stroke_no:e.no,path_d:e.path,...src(e.a)},['kanji_id','variant','stroke_no']);
  }
  for(const entries of pathGroups.values()) {const nos=entries.map(e=>e.no).sort((a,b)=>a-b);need(nos.every((n,i)=>n===i+1),'Duplicate or non-contiguous KanjiVG strokes');}
  for(const table of ['word_furigana','kanji_components','kanji_strokes']) {
    const formats={word_furigana:'jmdict-furigana',kanji_components:'kradfile',kanji_strokes:'kanjivg'};
    const sourceIds=[...new Set(loaded.artifacts.filter(a=>a.file.format===formats[table]).map(a=>a.source.source_id))];
    if(table==='word_furigana') {for(const r of plan.supplementRows[table] || [])add(table,r.row,r.keys);delete plan.supplementRows[table];}
    else if(sourceIds.length)plan.replaceScopes.push([table,'kanji_id',[...data.kanji.keys()],sourceIds]);
  }
  for(const {row:c,a}of data.clips) {
    const checksum=sha(c), release_id=`user-media:clip:${c.id}:${checksum}`;
    plan.releases.set(release_id,{release_id,source_id:'user-media',version:`${c.id}:${checksum}`,checksum,artifact_url:`local://clips/${encodeURIComponent(c.id)}/${checksum}/manifest.json`,retrieved_at:plan.startedAt,license:a.source.license,attribution:a.source.attribution,manifest_json:stable(c)});
    const origin={...a,release_id}, id=`user-media:clip:${c.id}`;
    content(id,'clip',c.id,c,origin);plan.clipIds.push(id);
    let storage_ref='youtube:'+c.origin.video_id;
    if(c.origin.kind==='file') {storage_ref=path.resolve(path.dirname(a.local),c.origin.path);need(fs.existsSync(storage_ref)&&hash(fs.readFileSync(storage_ref))===c.origin.sha256,'Clip file missing or checksum mismatch');}
    add('media_assets',{asset_id:'asset:'+sha(id),item_id:id,asset_kind:'video',storage_ref,...src(origin),attribution:c.origin.attribution || a.source.attribution,license:c.origin.license || a.source.license,private_only:1},['asset_id']);
    for(const [i,s]of c.segments.entries()) {
      const sid=`user-media:sentence:${c.id}:${s.id}`;
      content(sid,'sentence',`${c.id}:${s.id}`,{ja:s.ja,en:s.en || null},origin);
      add('sentences',{item_id:sid,text_ja:s.ja,text_en:s.en || null,furigana_notation:s.furigana || null,tatoeba_ja_id:null,author_attribution:c.origin.attribution || a.source.attribution},['item_id']);
      add('clip_segments',{clip_id:id,position:i,sentence_id:sid,start_ms:s.start_ms,end_ms:s.end_ms,...src(origin)},['clip_id','position']);
      machine(sid,'text',{ja:s.ja,en:s.en || null});
    }
  }
  plan.requests=[...mt.requests.values()];
  for(const kind of loaded.manifest.retire_complete_kinds || []) {
    need(['vocab','kanji','grammar'].includes(kind) && !loaded.manifest.cohort,'Retirement is forbidden for partial/cohort imports');
    need(new Set([...data[kind].values()].map(e=>e.row.level)).size===5 && loaded.manifest.complete_counts?.[kind]===data[kind].size,'Retirement requires all five levels and pinned complete count');plan.retireKinds.push(kind);
  }
  const hasTranslation=(id,field)=>[...plan.translations.values()].some(r=>r.item_id===id&&r.field===field&&r.status==='selected') || !!hasCurrent(id,field);
  const missing={meanings:[],sentence_translations:[],han_viet:[],strokes:[],attribution:[...new Set(missingAttribution)]};
  for(const [id,item]of plan.items) {
    if(['vocab','kanji','grammar'].includes(item.kind)&&!hasTranslation(id,'meaning'))missing.meanings.push(id);
    if(item.kind==='sentence'&&!hasTranslation(id,'text'))missing.sentence_translations.push(id);
  }
  const hv={kanji_total:data.kanji.size,multi_before_alias:0,multi_after_alias:0,variants_collapsed_kanji:0,primary_selected:0,selection_method_counts:{single_after_normalization:0,cvdict_compound:0,unihan_match:0,ai_fallback:0},unihan_status_counts:{},cvdict_evidence_counts:{only_one_supported:0,unique_max_ge_2:0},outside_candidate_set:0};
  for(const [id,result]of hvResults) {
    if(result.before>1)hv.multi_before_alias++;if(result.groups.length>1)hv.multi_after_alias++;if(result.before>result.groups.length)hv.variants_collapsed_kanji++;
    hv.unihan_status_counts[result.unihanStatus]=(hv.unihan_status_counts[result.unihanStatus] || 0)+1;
    if(result.chosen){hv.primary_selected++;hv.selection_method_counts[result.method]++;if(result.method==='cvdict_compound')hv.cvdict_evidence_counts[result.context.evidence.rule]++;}
    else missing.han_viet.push(id);
    const expected=data.kanji.get(id).row.strokes, paths=pathGroups.get(id+':') || [];
    if(!paths.length || (expected!=null && paths.length!==expected))missing.strokes.push(id);
  }
  hv.primary_coverage=hv.kanji_total?hv.primary_selected/hv.kanji_total*100:0;
  Object.assign(hv,{unresolved:missing.han_viet.length,missing_readings:[...hvResults.values()].filter(r=>!r.groups.length).length,multiple_selected:0,missing_selection_method:0,invalid_evidence:0});
  hv.status=hv.kanji_total>0&&hv.primary_selected===hv.kanji_total?'PASS':'INCOMPLETE';
  const counts={vocab:data.vocab.size,kanji:data.kanji.size,grammar:data.grammar.size,clips:data.clips.length,sentences:plan.rows.sentences.length};
  const expected=loaded.manifest.expected_counts || {};
  const countsMatch=Object.entries(expected).every(([k,n])=>counts[k]===n);
  plan.report={run_id:plan.runId,started_at:plan.startedAt,manifest_hash:loaded.manifestHash,profile:loaded.manifest.profile || 'custom',acceptance_status:'NOT_RUN',data_complete:countsMatch&&Object.values(missing).every(v=>v.length===0)&&hv.status==='PASS'&&plan.requests.length===0,counts,expected_counts:expected,counts_match:countsMatch,han_viet:hv,missing,mt:{...mt.stats,pending_requests:plan.requests.length},sources:[...plan.sources.keys()],schema:'Draft 0.2',selection_rule:RULE,warnings:data.warnings};
  return plan;
}
