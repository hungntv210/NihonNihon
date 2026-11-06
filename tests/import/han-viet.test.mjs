import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readingGroups,selectHanViet} from '../../tools/data/han-viet.mjs';
import {runImport} from '../../tools/data/import.mjs';
import {fixture} from './helpers.mjs';

const a={source:{source_id:'kanjidictvn'},release_id:'test-release'};
const entries=raw=>[{raw,key:'synthetic:1',a}];
function select(raw,extra={}) {return selectHanViet({character:'日',entries:entries(raw),mt:{ask:()=>null},item_id:'test',base_hash:'a'.repeat(64),...extra});}

test('NFC and whole-syllable aliases collapse variants without removing other accents',()=>{
  const r=readingGroups('日',entries('nhựt nhật NHƠN nhân sanh sinh tí tý a á'.normalize('NFD')));
  assert.deepEqual(r.groups.map(g=>g.reading),['nhật','nhân','sinh','tý','a','á']);
  const s=select('nhựt nhật');assert.equal(s.method,'single_after_normalization');assert.equal(s.chosen.reading,'nhật');
  assert.deepEqual(s.context.raw_readings,['nhựt','nhật']);
});
test('CVDICT requires >=2 distinct compounds even for the only supported reading',()=>{
  assert.equal(select('a á',{compounds:[{reading:'á',compound_key:'one'}]}).chosen,null);
  assert.equal(select('a á',{compounds:[{reading:'á',compound_key:'one'}],unihan:{raw:'a',key:'test',a},unihanAvailable:true}).method,'unihan_match');
  assert.equal(select('a á',{compounds:[{reading:'á',compound_key:'one'},{reading:'á',compound_key:'two'}]}).chosen.reading,'á');
  const enough=select('a á',{compounds:[{reading:'a',compound_key:'one'},{reading:'a',compound_key:'two'},{reading:'á',compound_key:'three'}]});
  assert.equal(enough.method,'cvdict_compound');assert.equal(enough.chosen.reading,'a');assert.equal(enough.context.evidence.rule,'unique_max_ge_2');
  const tied=select('a á',{compounds:[{reading:'a',compound_key:'one'},{reading:'a',compound_key:'one'},{reading:'á',compound_key:'two'}]});
  assert.equal(tied.chosen,null);
});
test('Unihan chooses only a unique intersection, never its first reading',()=>{
  const unique=select('a á',{unihan:{raw:'ngoài Á',key:'U+test',a},unihanAvailable:true});
  assert.equal(unique.method,'unihan_match');assert.equal(unique.chosen.reading,'á');
  const ambiguous=select('a á',{unihan:{raw:'á a',key:'U+test',a},unihanAvailable:true});assert.equal(ambiguous.chosen,null);assert.equal(ambiguous.unihanStatus,'ambiguous');
  assert.equal(select('a á').unihanStatus,'not_available');
  assert.equal(select('a á',{unihanAvailable:true}).unihanStatus,'missing');
  assert.equal(select('a á',{unihan:{raw:'khác',key:'U+test',a},unihanAvailable:true}).unihanStatus,'no_match');
});
test('ordered selection does not call later steps for one candidate or a CVDICT decision',()=>{
  const mt={ask(){throw Error('Should not call AI');}};
  assert.equal(select('nhựt nhật',{mt}).method,'single_after_normalization');
  assert.equal(select('a á',{mt,compounds:[{reading:'a',compound_key:'word'},{reading:'a',compound_key:'second'}]}).method,'cvdict_compound');
});
test('AI: rejects out-of-list reading, retries valid output, persists separate MT provenance and report target',async t=>{
  const f=fixture(t);f.write('hv.json',[['日','nhật niết','','',[],{}]]);f.save();await runImport(f);
  const requests=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests;
  const hv=requests.find(r=>r.task==='han_viet');assert.ok(hv);
  const evidence={candidate_id:hv.input.candidates[0].id,reason:'Synthetic explanation',meaning:'Synthetic meaning',compound:{word:'日本',reading:'にほん'},evidence_origin:'model-generated',references:[]};
  f.write('mt.json',requests.flatMap(r=>r.task==='han_viet'?[{request_id:r.request_id,output:{...evidence,candidate_id:'not-allowed'}},{request_id:r.request_id,output:evidence}]:[{request_id:r.request_id,output:{text_vi:'Nghĩa thử'}}]));f.save();
  const report=await runImport({...f,requireComplete:true});
  assert.equal(report.han_viet.selection_method_counts.ai_fallback,1);assert.equal(report.han_viet.outside_candidate_set,0);assert.equal(report.mt.invalid_outputs,1);
  const db=f.open(),primary=db.prepare("SELECT * FROM vi_translations WHERE field='han_viet' AND item_id LIKE 'openjlpt:kanji:%' AND status='selected'").get();
  assert.equal(primary.source_id,'mt:test');assert.equal(primary.method,'machine');assert.equal(JSON.parse(primary.context_json).selection_method,'ai_fallback');
  assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE field='han_viet' AND status='candidate'").get().n,2);
  db.prepare('INSERT INTO translation_reports VALUES (?,?,?,?,?)').run('report-test',primary.translation_id,'Âm chưa phù hợp','2026-11-05','open');
  const again=await runImport(f);assert.ok(again.mt.cache_hits>0);assert.equal(again.mt.pending_requests,0);
});
test('invalid AI evidence and fabricated input references leave the kanji unresolved',async t=>{
  const f=fixture(t);f.write('hv.json',[['日','nhật niết','','',[],{}]]);f.save();await runImport(f);
  const requests=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests;
  f.write('mt.json',requests.map(r=>({request_id:r.request_id,output:r.task==='han_viet'?{candidate_id:r.input.candidates[0].id,reason:'test',meaning:'test',compound:{word:'偽',reading:'にせ'},evidence_origin:'input',references:[{source_id:'fabricated',release_id:'fake'}]}:{text_vi:'Nghĩa thử'}})));f.save();
  const report=await runImport(f);assert.equal(report.han_viet.status,'INCOMPLETE');assert.equal(report.han_viet.primary_selected,0);assert.equal(report.han_viet.unresolved,1);
});

test('multi-model pending requests retain the correct sentence or learning route',async()=>{
 const {createMT}=await import('../../tools/data/han-viet.mjs');const {sha}=await import('../../tools/data/core.mjs');
 const base={source_id:'mt:test',prompt_version:'1',prompt_sha256:'a'.repeat(64)},lite={...base,model:'lite',config:{route:'sentences'}},flash={...base,model:'flash',config:{route:'learning'}};
 const mt=createMT({manifest:{sources:[{source_id:'mt:test',license:'test',attribution:'test'}],mt_profiles:[lite,flash]},artifacts:[]},{responses:[]},null);
 mt.ask('translate',{item_id:'sentence',field:'text'},()=>{});mt.ask('han_viet',{item_id:'kanji'},()=>{});
 const requests=[...mt.requests.values()];assert.equal(requests[0].mt_release_id,'mt:test:config:'+sha(lite).slice(0,32));assert.equal(requests[1].mt_release_id,'mt:test:config:'+sha(flash).slice(0,32));
});

test('multiple profiles prefer upgraded sentence prompt and dedupe NFC aliases in pending queue',async()=>{
 const {createMT}=await import('../../tools/data/han-viet.mjs');const {sha}=await import('../../tools/data/core.mjs');
 const old={source_id:'mt:test',model:'lite',prompt_version:'1',prompt_sha256:'a'.repeat(64),config:{route:'sentences'}},current={...old,prompt_version:'2',config:{route:'sentences',sentence_key:'ja-nfc-v1',supersedes_prompt_versions:['1']}};
 const mt=createMT({manifest:{sources:[{source_id:'mt:test',license:'test',attribution:'test'}],mt_profiles:[old,current]},artifacts:[]},{responses:[]},null);
 mt.ask('translate',{item_id:'tatoeba:sentence:1',field:'text',base_hash:'old',ja:'カ\u3099',en:'first'},()=>{});mt.ask('translate',{item_id:'openjlpt:sentence:2',field:'text',base_hash:'other',ja:'ガ',en:'second'},()=>{});
 assert.equal(mt.requests.size,1);assert.equal([...mt.requests.values()][0].mt_release_id,'mt:test:config:'+sha(current).slice(0,32));
});
