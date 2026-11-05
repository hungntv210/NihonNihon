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
