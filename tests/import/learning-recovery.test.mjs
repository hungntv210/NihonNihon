import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture} from './helpers.mjs';import {runImport,runCorrectionImport} from '../../tools/data/import.mjs';
import {compoundAssessment,normalizeGrammar,canonicalReading} from '../../tools/data/learning-quality.mjs';
import {promptFor,settings} from '../../tools/data/mt-gemini.mjs';
import {kanjiMeaningAssessment} from '../../tools/data/kanji-meaning-qa.mjs';
import {recoverDeferred} from '../../tools/data/recover-learning.mjs';
import {manualLearningTerminal} from '../../tools/data/translation-campaign.mjs';
import {sha} from '../../tools/data/core.mjs';
import {DatabaseSync} from 'node:sqlite';import {auditLearning} from '../../tools/data/learning-audit.mjs';
test('full audit uses DB dictionary readings and flags untranslated kanji meanings',()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec('CREATE TABLE kanji(item_id,character,meanings_en);CREATE TABLE vocab(item_id,word);CREATE TABLE vi_translations(translation_id,item_id,field,text_vi,method,status,context_json);');
 db.prepare('INSERT INTO kanji VALUES(?,?,?)').run('k','委','["committee"]');db.prepare('INSERT INTO vocab VALUES(?,?)').run('v','委員');
 const insert=db.prepare('INSERT INTO vi_translations VALUES(?,?,?,?,?,?,?)');insert.run('hv','k','han_viet','uy','machine','selected',JSON.stringify({candidate_readings:['uy','uỷ'],mt_output:{text_vi:'uy',compound:{word:'委員'},meaning:'ủy viên'}}));insert.run('en','k','meaning','committee','machine','selected','{}');insert.run('dict','v','meaning','Ủy viên, thành viên của ủy ban','dictionary','selected','{}');
 const rows=auditLearning(db);assert.ok(rows.some(r=>r.kanji==='委'&&r.proposed==='ủy'));assert.ok(rows.some(r=>r.field==='meaning'&&r.reason==='meaning_language_review_required'));
 }finally{db.close();}
});
test('manual-review terminal queue stops instead of spinning or declaring translation complete',()=>{
 const r={task:'translate',input:{character:'日'}};assert.equal(manualLearningTerminal([r],[{context_key:sha(r)}]),true);assert.equal(manualLearningTerminal([r],[]),false);assert.equal(manualLearningTerminal([],[{context_key:sha(r)}]),false);
});
test('deferred recovery uses batches of ten, preserves good rows and terminates failures after two attempts',async()=>{
 const requests=Array.from({length:35},(_,i)=>({request_id:String(i)})),calls=[];
 const result=await recoverDeferred(requests,{attempt:async(batch,round)=>{calls.push({ids:batch.map(r=>r.request_id),round});assert.ok(batch.length<=10);return {status:'partial_output',accepted:batch.filter(r=>Number(r.request_id)<30).map(r=>r.request_id),rejected:batch.map(r=>({request_id:r.request_id,reason:'too_few_meanings'}))};}});
 assert.equal(result.done.size,30);assert.equal(result.manual.length,5);assert.equal(calls.length,5);assert.ok(calls.at(-1).ids.every(id=>Number(id)>=30));
});
test('limited English senses exception is only available after two recovery attempts',()=>{
 const input={character:'自',field:'meaning',meanings_en:['self','self','own']};
 for(const recoveryAttempt of [0,1])assert.ok(kanjiMeaningAssessment({text_vi:'bản thân'},input,[],{recoveryAttempt}).issues.length);
 const allowed=kanjiMeaningAssessment({text_vi:'bản thân'},input,[],{recoveryAttempt:2});assert.equal(allowed.issues.length,0);assert.ok(allowed.flags.length);
 assert.ok(kanjiMeaningAssessment({text_vi:'bản thân'},{...input,meanings_en:['one','two','three']},[],{recoveryAttempt:2}).issues.length);
});
test('compound QA rejects English, flags dictionary candidate mismatch and keeps uncertainty explicit',()=>{
 const input={character:'委',candidates:[{reading:'uy'},{reading:'ủy'}],compounds:[{word:'委員',meaning:['committee member']}]},dictionary=new Map([['委員',['ủy viên']]]);
 assert.deepEqual(compoundAssessment({compound:{word:'委員'},meaning:'committee member',text_vi:'uy'},input,dictionary).issues,['compound_meaning_not_vietnamese']);
 const checked=compoundAssessment({compound:{word:'委員'},meaning:'ủy viên',text_vi:'uy'},input,dictionary);assert.equal(checked.issues.length,0);assert.equal(checked.flags[0].proposed,'ủy');
 assert.equal(compoundAssessment({compound:{word:'委員'},meaning:'ủy viên',text_vi:'ủy'},input,dictionary).flags.length,0);
 assert.equal(compoundAssessment({compound:{word:'委員'},meaning:'ủy viên',text_vi:'uy'},input,new Map()).flags.length,0);
 assert.equal(normalizeGrammar('Dùng THỂ NGUYÊN MẪU và thể nguyên mẫu.'),'Dùng thể từ điển và thể từ điển.');
 assert.equal(canonicalReading('uỷ'),'ủy');assert.notEqual(canonicalReading('đọc'),canonicalReading('độc'));
 const shoulder={compound:{word:'肩'},meaning:'vai',text_vi:'kiên'};
 assert.equal(compoundAssessment(shoulder,{candidates:[]},new Map([['肩',['vai']]])).issues.length,0);
 assert.ok(compoundAssessment({...shoulder,meaning:'shoulder'},{candidates:[]},new Map([['肩',['vai']]])).issues.length);
});
test('new Lite prompt explicitly translates compound meanings and pins a distinct prompt hash',()=>{
 const config={model:'gemini-test',requests_per_minute:15,requests_per_day:500,daily_budget:450,max_output_tokens:4096,prompt_variant:'lite-meaning-2'};
 assert.match(promptFor(config).text,/meaning and reason MUST be Vietnamese/);assert.match(promptFor(config).text,/thể từ điển/);assert.notEqual(settings(config).prompt_sha256,settings({...config,prompt_variant:'lite-meaning-1'}).prompt_sha256);
});
test('owner corrections import provenance, replace selection, preserve old text and survive later imports',async t=>{
 const f=fixture(t);await runImport(f);f.answerRequests();await runImport(f);
 const db=f.open(),old=db.prepare("SELECT * FROM vi_translations WHERE field='han_viet' AND status='selected'").get(),file=f.dir+'/corrections.json';
 f.write('corrections.json',{reviewer:'owner',reason:'Owner test',rows:[{item_id:old.item_id,field:'han_viet',text_vi:old.text_vi,expected_translation_id:old.translation_id,reason:'Verified correction'}]});
 const options={dbPath:f.dbPath,correctionsPath:file,reportPath:f.dir+'/owner-report.json',backupDirectory:f.dir+'/backups'};
 await runCorrectionImport(options);const row=db.prepare("SELECT t.*,r.manifest_json FROM vi_translations t JOIN source_releases r USING(release_id) WHERE t.item_id=? AND t.field='han_viet' AND t.status='selected'").get(old.item_id);
 assert.equal(JSON.parse(row.manifest_json).model,'manual');assert.equal(JSON.parse(row.context_json).reviewer,'owner');assert.equal(db.prepare('SELECT text_vi FROM vi_translations WHERE translation_id=?').get(old.translation_id).text_vi,old.text_vi);
 await runImport(f);assert.equal(db.prepare("SELECT translation_id FROM vi_translations WHERE item_id=? AND field='han_viet' AND status='selected'").get(old.item_id).translation_id,row.translation_id);
 await runCorrectionImport(options);
 const bad=JSON.parse(fs.readFileSync(file));bad.rows[0].text_vi='outside';f.write('corrections.json',bad);await assert.rejects(runCorrectionImport(options),/candidate set/);
});
