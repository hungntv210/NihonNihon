import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runImport } from '../../tools/data/import.mjs';
import { loadArtifacts } from '../../tools/data/core.mjs';
import { parseArtifacts } from '../../tools/data/adapters.mjs';
import { buildPlan } from '../../tools/data/plan.mjs';
import { openDatabase,applyPlan } from '../../tools/data/store.mjs';
import { fixture } from './helpers.mjs';

test('same dictionary source and match promotes new release while preserving old text',async t=>{
  const f=fixture(t);f.source('bunchaway-javi','javi-csv','vi.csv','日,nghĩa cũ\n');f.save();await runImport(f);
  f.write('vi.csv','日,nghĩa mới\n');f.save();await runImport(f);
  const db=f.open(),rows=db.prepare("SELECT text_vi,status,needs_refresh FROM vi_translations WHERE method='dictionary' ORDER BY text_vi").all();
  assert.equal(rows.find(r=>r.text_vi==='nghĩa mới').status,'selected');
  assert.equal(rows.find(r=>r.text_vi==='nghĩa cũ').status,'needs_review');assert.equal(rows.find(r=>r.text_vi==='nghĩa cũ').needs_refresh,1);
  await runImport(f);assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE method='dictionary'").get().n,2);
});

test('an unresolved kanji decision retires a previous primary without deleting history',async t=>{
  const f=fixture(t);await runImport(f);f.write('hv.json',[['日','nhật niết','','',[],{}]]);f.save();await runImport(f);
  const db=f.open();assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE field='han_viet' AND status='selected'").get().n,0);
  assert.equal(db.prepare("SELECT needs_refresh FROM vi_translations WHERE field='han_viet' AND text_vi='nhật' AND status='needs_review'").get().needs_refresh,1);
});

test('real SQLite import: NFC, stable IDs, examples, paths, counts, and honest acceptance status',async t=>{
  const f=fixture(t);let report=await runImport(f);
  assert.equal(report.acceptance_status,'NOT_RUN');assert.equal(report.data_complete,false);
  assert.equal(report.han_viet.primary_coverage,100);assert.equal(report.han_viet.multi_before_alias,1);assert.equal(report.han_viet.multi_after_alias,0);
  assert.ok(f.answerRequests()>0);
  const requests=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests;
  const formation=requests.find(r=>r.input.field==='formation').request_id;
  const answers=JSON.parse(fs.readFileSync(f.dir+'/mt.json','utf8'));
  f.write('mt.json',answers.filter(r=>r.request_id!==formation));f.save();
  await assert.rejects(()=>runImport({...f,requireComplete:true}),/Incomplete data/);
  const partial=JSON.parse(fs.readFileSync(f.reportPath,'utf8'));assert.equal(partial.mt.pending_requests,1);assert.equal(partial.data_complete,false);
  f.write('mt.json',answers);f.save();report=await runImport({...f,requireComplete:true});assert.equal(report.data_complete,true);
  const db=f.open();
  assert.equal(db.prepare('SELECT item_id FROM vocab').get().item_id,'openjlpt:vocab:1111111111');
  assert.equal(db.prepare('SELECT count(*) n FROM kanji_strokes').get().n,4);
  assert.equal(db.prepare('SELECT count(*) n FROM item_sentences').get().n,2);
  for(const r of db.prepare('SELECT text_vi FROM vi_translations').all())assert.equal(r.text_vi,r.text_vi.normalize('NFC'));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('reruns reuse MT cache, preserve cards/reviews, and flag translations on changed source',async t=>{
  const f=fixture(t);await runImport(f);f.answerRequests();await runImport(f);
  let db=f.open();
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO srs_cards VALUES ('card','openjlpt:vocab:1111111111','recall','{\"stability\":3}','test','2026-11-06','2026-11-05'); INSERT INTO srs_reviews VALUES ('review','card',3,'2026-11-05',100,'test')");
  const card=db.prepare('SELECT * FROM srs_cards').get(),review=db.prepare('SELECT * FROM srs_reviews').get(),translation=db.prepare("SELECT * FROM vi_translations WHERE item_id='openjlpt:vocab:1111111111' AND field='meaning'").get();
  const counts=db.prepare('SELECT count(*) n FROM vi_translations').get().n;db.close();
  const rerun=await runImport(f);assert.equal(rerun.mt.pending_requests,0);assert.ok(fs.existsSync(rerun.backup_path));
  db=f.open();assert.equal(db.prepare('SELECT count(*) n FROM vi_translations').get().n,counts);db.close();
  f.vocab[0].meanings=['corrected source'];f.write('vocab.json',f.vocab);f.save();await runImport(f);
  db=f.open();
  assert.deepEqual(db.prepare('SELECT * FROM srs_cards').get(),card);assert.deepEqual(db.prepare('SELECT * FROM srs_reviews').get(),review);
  const after=db.prepare('SELECT * FROM vi_translations WHERE translation_id=?').get(translation.translation_id);
  assert.equal(after.text_vi,translation.text_vi);assert.equal(after.needs_refresh,1);
});

test('checksum/schema/retirement failures do not replace existing content',async t=>{
  const f=fixture(t);await runImport(f);
  f.vocab[0].word='改';fs.writeFileSync(f.dir+'/vocab.json',JSON.stringify(f.vocab));
  await assert.rejects(()=>runImport(f),/Checksum/);
  f.vocab[0].level='N0';f.write('vocab.json',f.vocab);f.save();await assert.rejects(()=>runImport(f),/Invalid OpenJLPT/);
  f.vocab[0].level='N5';f.write('vocab.json',f.vocab);f.manifest.retire_complete_kinds=['vocab'];f.manifest.cohort={vocab_ids:['1111111111']};f.save();
  await assert.rejects(()=>runImport(f),/Retirement/);
  const db=f.open();assert.equal(db.prepare('SELECT word FROM vocab').get().word,'日');
});

test('transaction failure rolls back source changes and scoped child replacement',async t=>{
  const f=fixture(t);await runImport(f);
  const db=f.track(openDatabase(f.dbPath));
  const before=db.prepare('SELECT * FROM content_items ORDER BY item_id').all();
  db.exec("CREATE TRIGGER reject_vocab BEFORE UPDATE ON vocab BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  f.vocab[0].meanings=['changed'];f.write('vocab.json',f.vocab);f.save();
  const loaded=await loadArtifacts(f.manifestPath),plan=buildPlan(loaded,parseArtifacts(loaded),db);
  await assert.rejects(()=>applyPlan(db,plan),/synthetic failure/);
  assert.deepEqual(db.prepare('SELECT * FROM content_items ORDER BY item_id').all(),before);
  assert.equal(db.prepare('SELECT count(*) n FROM item_sentences').get().n,2);
});

test('ambiguous headwords stay unresolved even when only one reading is in the cohort',async t=>{
  const f=fixture(t);f.vocab=[{...f.vocab[0],word:'方',reading:'かた'},{...f.vocab[0],id:'2222222222',word:'方',reading:'ほう'}];
  f.write('vocab.json',f.vocab);f.source('bunchaway-javi','javi-csv','vi.csv','方,nghĩa không có cách đọc\n');f.manifest.cohort={vocab_ids:['1111111111']};f.save();
  await runImport(f);
  const req=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests.find(r=>r.input.item_id==='openjlpt:vocab:1111111111'&&r.input.field==='meaning');
  assert.equal(req.input.reason,'ambiguous_headword');
  const db=f.open();assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE method='dictionary'").get().n,0);
});

test('CSV quoting/newlines and JMdict reading/sense restrictions resolve kana-only forms',async t=>{
  const f=fixture(t);Object.assign(f.vocab[0],{word:'かな',reading:'かな',romaji:'kana',meanings:['synthetic'],jmdict_id:1000001});f.write('vocab.json',f.vocab);
  f.source('jmdict','jmdict','jmdict.xml','<JMdict><entry><ent_seq>1000001</ent_seq><k_ele><keb>漢字</keb></k_ele><k_ele><keb>仮名</keb></k_ele><r_ele><reb>かな</reb><re_restr>漢字</re_restr></r_ele><sense><stagk>漢字</stagk><gloss>synthetic</gloss></sense></entry></JMdict>');
  f.source('bunchaway-javi','javi-csv','vi.csv','"仮名","sai cách đọc"\n"漢字","nghĩa có dấu phẩy,\nvà xuống dòng"\n');f.save();await runImport(f);
  const db=f.open();const tr=db.prepare("SELECT * FROM vi_translations WHERE item_id='openjlpt:vocab:1111111111' AND field='meaning' AND status='selected'").get();
  assert.equal(tr.match_method,'jmdict_form');assert.match(tr.text_vi,/phẩy,\nvà/);
});

test('private clips retain sentence UUIDs and reject invalid timing/media without applying',async t=>{
  const f=fixture(t);const clips=[{id:'clip1',title:'Synthetic clip',duration_ms:2000,origin:{kind:'youtube',video_id:'aaaaaaaaaaa'},segments:[{id:'sentence1',ja:'練習です。',start_ms:0,end_ms:2000}]}];
  f.source('user-media','user-clips','clips.json',clips);f.manifest.expected_counts.clips=1;f.save();await runImport(f);
  let db=f.open();assert.equal(db.prepare('SELECT sentence_id FROM clip_segments').get().sentence_id,'user-media:sentence:clip1:sentence1');db.close();
  clips[0].segments[0].end_ms=3000;f.write('clips.json',clips);f.save();await assert.rejects(()=>runImport(f),/segment times/);
  db=f.open();assert.equal(db.prepare('SELECT end_ms FROM clip_segments').get().end_ms,2000);
});

test('require-complete writes an honest incomplete report without applying staged rows',async t=>{
  const f=fixture(t);await assert.rejects(()=>runImport({...f,requireComplete:true}),/Incomplete data/);
  const report=JSON.parse(fs.readFileSync(f.reportPath,'utf8'));assert.equal(report.db_committed,false);assert.equal(report.acceptance_status,'NOT_RUN');
  const db=f.open();assert.equal(db.prepare('SELECT count(*) n FROM content_items').get().n,0);
});

test('multiple pinned MT profiles import all model alternatives and preserve provenance on rerun',async t=>{
 const f=fixture(t);await runImport(f);f.answerRequests();
 const {sha}=await import('../../tools/data/core.mjs');const first=f.manifest.mt,second={...first,model:'synthetic-second'};
 const requests=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests;
 const release='mt:test:config:'+sha(second).slice(0,32);
 f.manifest.sources.find(s=>s.source_id==='mt:test').files[0].mt_config_sha256=sha(first);
 f.source('mt:test','mt-results','second.json',requests.map(r=>({request_id:sha({task:r.task,input:r.input,release}),output:{text_vi:'Bản dịch model thứ hai'}})),{mt_config_sha256:sha(second)});
 f.manifest.mt_profiles=[first,second];f.save();await runImport(f);
 const db=f.open(),rows=db.prepare("SELECT t.*,json_extract(r.manifest_json,'$.model') model FROM vi_translations t JOIN source_releases r USING(release_id) WHERE method='machine'").all();
 assert.equal(rows.length,requests.length*2);assert.equal(rows.filter(r=>r.model===second.model).length,requests.length);assert.ok(rows.filter(r=>r.model===second.model).every(r=>r.status==='candidate'));
 await runImport(f);assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE method='machine'").get().n,rows.length);
});

test('NFC Japanese sentence dedupe translates once and fans out across distinct sentence IDs',async t=>{
 const f=fixture(t);f.manifest.mt.config={sentence_key:'ja-nfc-v1'};
 f.vocab[0].examples=[{ja:'カ\u3099',en:'first English',tatoeba_id:1001}];f.grammar[0].examples=[{ja:'ガ',en:'different English',tatoeba_id:1002}];
 f.write('vocab.json',f.vocab);f.write('grammar.json',f.grammar);f.save();await runImport(f);
 const requests=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests.filter(r=>r.input.field==='text');assert.equal(requests.length,1);assert.equal(requests[0].input.ja,'ガ');assert.equal(requests[0].input.en,undefined);
 f.answerRequests();await runImport(f);const rows=f.open().prepare("SELECT item_id,text_vi,source_record_key FROM vi_translations WHERE field='text'").all();assert.equal(rows.length,2);assert.equal(rows[0].text_vi,rows[1].text_vi);assert.equal(rows[0].source_record_key,rows[1].source_record_key);
});

test('prompt upgrade explicitly supersedes v1 translations without changing old text',async t=>{
 const f=fixture(t);f.manifest.mt.prompt_version='gemini-vi-hv-1';f.save();await runImport(f);const initial=JSON.parse(fs.readFileSync(f.requestsPath,'utf8')).requests;f.answerRequests();await runImport(f);
 const old=f.open().prepare("SELECT * FROM vi_translations WHERE method='machine' AND field='meaning' AND item_id LIKE 'openjlpt:vocab:%'").get();
 const {sha}=await import('../../tools/data/core.mjs');const {canonicalMTInput}=await import('../../tools/data/han-viet.mjs');f.manifest.mt={...f.manifest.mt,prompt_version:'gemini-vi-hv-2',config:{sentence_key:'ja-nfc-v1',supersedes_prompt_versions:['gemini-vi-hv-1']}};
 const release='mt:test:config:'+sha(f.manifest.mt).slice(0,32);f.source('mt:test','mt-results','v2.json',initial.map(r=>({request_id:sha({task:r.task,input:canonicalMTInput(r.task,r.input,f.manifest.mt),release}),output:{text_vi:'Sinh viên'}})));f.save();await runImport(f);
 const db=f.open(),current=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND field='meaning' AND status='selected'").get(old.item_id);assert.equal(current.text_vi,'Sinh viên');assert.notEqual(current.translation_id,old.translation_id);const previous=db.prepare('SELECT * FROM vi_translations WHERE translation_id=?').get(old.translation_id);assert.equal(previous.text_vi,old.text_vi);assert.equal(previous.status,'needs_review');assert.equal(previous.needs_refresh,1);
});
