import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {hash} from '../../tools/data/core.mjs';
import {fixture} from './helpers.mjs';import {runImport,runCorrectionImport} from '../../tools/data/import.mjs';
import {reviewedVietnameseShort} from '../../tools/data/learning-audit.mjs';
import {meaningOnlyBatch,expandCompoundMeaning} from '../../tools/data/compound-meaning-profile.mjs';
import {compoundAssessment,dictionaryGlosses} from '../../tools/data/learning-quality.mjs';
test('unaccented Vietnamese sense lists require dictionary evidence for every sense',()=>{
 const output={compound:{word:'回る'},meaning:'xoay, quay',text_vi:'hồi'},dictionary=new Map([['回る',['xoay','quay']]]);
 assert.deepEqual(compoundAssessment(output,{candidates:[]},dictionary).issues,[]);
 assert.ok(compoundAssessment({...output,meaning:'xoay, turn'},{candidates:[]},dictionary).issues.length);
 const numbered=dictionaryGlosses('1. Quay, xoay\n2. Đi quanh; đi vòng quanh');
 assert.deepEqual(numbered,['Quay','xoay','Đi quanh','đi vòng quanh']);
 assert.deepEqual(compoundAssessment(output,{candidates:[]},new Map([['回る',numbered]])).issues,[]);
});
test('reviewed short Vietnamese forms no longer raise language flags, English stays suspect',()=>{
 for(const text of ['ba','tay','tre','tai','nghe','vai','mua','xe','nhanh mau','nam','hoa','NHANH, MAU'])assert.equal(reviewedVietnameseShort(text),true,text);
 for(const text of ['committee','shoulder','buy a car',''])assert.equal(reviewedVietnameseShort(text),false,text);
});
test('meaning-only provider cannot change the selected reading, word or compound reading',()=>{
 const request={request_id:'r',task:'han_viet',input:{item_id:'i',candidates:[{id:'one',reading:'tỉ'},{id:'two',reading:'bì'}]}},fixed=new Map([['i',{reading:'tỉ',output:{text_vi:'bì',candidate_id:'two',compound:{word:'比較',reading:'ひかく'},meaning:'comparison',reason:'historical',evidence_origin:'model-generated',references:[]}}]]);
 const input=meaningOnlyBatch([request],fixed);assert.equal(input[0].task,'translate');assert.equal(input[0].input.en,'comparison');assert.equal('candidates' in input[0].input,false);
 const output=expandCompoundMeaning({request_id:'r',output:{text_vi:'so sánh'}},request,fixed);assert.equal(output.text_vi,'tỉ');assert.equal(output.candidate_id,'one');assert.deepEqual(output.compound,fixed.get('i').output.compound);assert.equal(output.meaning,'so sánh');
 assert.throws(()=>meaningOnlyBatch([request],new Map()),/Fixed reading/);
});
test('tester provenance can insert a missing meaning with pinned base and survive reruns',async t=>{
 const f=fixture(t);await runImport(f);const db=f.open(),item=db.prepare("SELECT * FROM content_items WHERE kind='kanji'").get(),old=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND field='han_viet' AND status='selected'").get(item.item_id);
 const correctionsPath=f.dir+'/tester.json';f.write('tester.json',{reviewer:'tester',reason:'Approved fixture decision',provenance:{sha256:'a'.repeat(64)},rows:[{item_id:item.item_id,field:'meaning',text_vi:'ngày, mặt trời',expected_translation_id:null,base_content_hash:item.source_hash,reason:'Tester accepted missing translation'},{item_id:item.item_id,field:'han_viet',text_vi:old.text_vi,expected_translation_id:old.translation_id,reason:'Tester confirms reading'}]});
 const options={dbPath:f.dbPath,correctionsPath,reportPath:f.dir+'/tester-report.json',backupDirectory:f.dir+'/backups'};await runCorrectionImport(options);await runCorrectionImport(options);
 let rows=db.prepare("SELECT t.*,r.manifest_json FROM vi_translations t JOIN source_releases r USING(release_id) WHERE t.item_id=? AND t.status='selected'").all(item.item_id);assert.equal(rows.length,2);assert.ok(rows.every(r=>JSON.parse(r.manifest_json).reviewer==='tester'));assert.equal(rows.find(r=>r.field==='meaning').text_vi,'ngày, mặt trời');
 await runImport(f);rows=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND status='selected'").all(item.item_id);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.source_id==='mt:manual'));
});
test('compound import retains reviewed text and records Gemini provenance only for the meaning',async t=>{
 const f=fixture(t);await runImport(f);const db=f.open(),old=db.prepare("SELECT * FROM vi_translations WHERE field='han_viet' AND status='selected'").get(),output={text_vi:old.text_vi,candidate_id:'fixture',compound:{word:'日本',reading:'にほん'},meaning:'Nhật Bản',reason:'fixture',evidence_origin:'model-generated',references:[]};
 const context={...JSON.parse(old.context_json),candidate_readings:[old.text_vi,'viết'],mt_output:{...output,meaning:'Japan'}};db.prepare('UPDATE vi_translations SET context_json=? WHERE translation_id=?').run(JSON.stringify(context),old.translation_id);
 db.prepare("INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:google-gemini','Fixture','https://example.invalid','test','test','private_only')").run();
 f.write('compound-results.json',[{request_id:'r',output}]);f.write('compound-manifest.json',{mt:{source_id:'mt:google-gemini',model:'gemini-3.5-flash-lite',prompt_version:'fixture',prompt_sha256:'a'.repeat(64)},sources:[{source_id:'mt:google-gemini',files:[{format:'mt-results',path:'compound-results.json',sha256:hash(fs.readFileSync(f.dir+'/compound-results.json'))}]}]});
 const value={reviewer:'tester',reason:'Only translate compound meaning',compound_profile_manifest:f.dir+'/compound-manifest.json',rows:[{item_id:old.item_id,field:'han_viet',text_vi:old.text_vi,expected_translation_id:old.translation_id,compound_request_id:'r',reason:'Retain fixed reading'}]};f.write('evidence.json',value);
 await runCorrectionImport({dbPath:f.dbPath,correctionsPath:f.dir+'/evidence.json',reportPath:f.dir+'/evidence-report.json'});const selected=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND field='han_viet' AND status='selected'").get(old.item_id),now=JSON.parse(selected.context_json);assert.equal(selected.text_vi,old.text_vi);assert.equal(now.mt_output.meaning,'Nhật Bản');assert.equal(now.reviewer,'tester');assert.equal(now.compound_meaning_provenance.model,'gemini-3.5-flash-lite');
 value.rows[0].text_vi='viết';f.write('evidence.json',value);await assert.rejects(runCorrectionImport({dbPath:f.dbPath,correctionsPath:f.dir+'/evidence.json',reportPath:f.dir+'/bad-report.json'}),/Compound update changed/);
});
