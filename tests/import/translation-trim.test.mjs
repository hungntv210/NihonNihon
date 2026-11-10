import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from './helpers.mjs';
import {runImport,runCorrectionImport} from '../../tools/data/import.mjs';

test('normal importer trims every translation field before identity generation and keeps internal whitespace',async t=>{
 const f=fixture(t);f.grammar[0].notes='Synthetic notes';f.write('grammar.json',f.grammar);f.save();await runImport(f);f.answerRequests();
 const rows=JSON.parse(fs.readFileSync(f.dir+'/mt.json','utf8')).map(r=>({...r,output:{text_vi:' \n nghĩa  tiếng Việt thử nghiệm \t '}}));f.write('mt.json',rows);f.save();await runImport(f);
 const db=f.open(),before=db.prepare('SELECT translation_id,text_vi FROM vi_translations ORDER BY translation_id').all();
 assert.deepEqual(new Set(db.prepare('SELECT DISTINCT field FROM vi_translations').all().map(r=>r.field)),new Set(['han_viet','meaning','text','formation','notes']));
 assert.ok(before.every(r=>r.text_vi===r.text_vi.trim()&&r.text_vi===r.text_vi.normalize('NFC')));assert.ok(before.some(r=>r.text_vi==='nghĩa  tiếng Việt thử nghiệm'));
 f.write('mt.json',rows.map(r=>({...r,output:{text_vi:r.output.text_vi.trim()}})));f.save();await runImport(f);assert.deepEqual(db.prepare('SELECT translation_id,text_vi FROM vi_translations ORDER BY translation_id').all(),before);
});
test('reviewed sentence whitespace repair uses the provenance importer and preserves its previous text',async t=>{
 const f=fixture(t);await runImport(f);f.answerRequests();await runImport(f);const db=f.open(),old=db.prepare("SELECT * FROM vi_translations WHERE field='text' AND status='selected'").get();
 f.write('sentence-trim.json',{reviewer:'tester',reason:'Owner-authorized trim for every field',rows:[{item_id:old.item_id,field:'text',text_vi:' \n'+old.text_vi+'\t ',expected_translation_id:old.translation_id,reason:'Whitespace normalization'}]});
 await runCorrectionImport({dbPath:f.dbPath,correctionsPath:f.dir+'/sentence-trim.json',reportPath:f.dir+'/sentence-trim-report.json'});
 const selected=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND field='text' AND status='selected'").get(old.item_id);assert.equal(selected.text_vi,old.text_vi);assert.equal(selected.source_id,'mt:manual');assert.equal(JSON.parse(selected.context_json).reviewer,'tester');assert.equal(db.prepare('SELECT text_vi FROM vi_translations WHERE translation_id=?').get(old.translation_id).text_vi,old.text_vi);
});
test('replay preserves pre-trim history after reviewed replacement without a natural-key collision',async t=>{
 const f=fixture(t);await runImport(f);f.answerRequests();await runImport(f);const db=f.open(),old=db.prepare("SELECT * FROM vi_translations WHERE field='text' AND status='selected'").get();
 // A database written before trim was introduced has a different ID and padded text.
 db.prepare('UPDATE vi_translations SET translation_id=?,text_vi=? WHERE translation_id=?').run('legacy-padded',' '+old.text_vi+' ',old.translation_id);
 await assert.rejects(()=>runImport(f),/Selected legacy whitespace requires a provenance correction/);
 assert.equal(db.prepare("SELECT status FROM vi_translations WHERE translation_id='legacy-padded'").get().status,'selected');
 f.write('legacy-repair.json',{reviewer:'tester',reason:'Approved whitespace cleanup',rows:[{item_id:old.item_id,field:'text',text_vi:old.text_vi,expected_translation_id:'legacy-padded',reason:'Trim without rewriting history'}]});
 await runCorrectionImport({dbPath:f.dbPath,correctionsPath:f.dir+'/legacy-repair.json',reportPath:f.dir+'/legacy-report.json'});
 const before=db.prepare('SELECT * FROM vi_translations ORDER BY translation_id').all();await runImport(f);await runImport(f);assert.deepEqual(db.prepare('SELECT * FROM vi_translations ORDER BY translation_id').all(),before);
});
test('tester correction trims meaning and Han-Viet before IDs and candidate checks, preserving old text',async t=>{
 const f=fixture(t);await runImport(f);f.answerRequests();await runImport(f);const db=f.open(),selected=db.prepare("SELECT * FROM vi_translations WHERE item_id='openjlpt:kanji:U+65E5' AND status='selected'").all();
 assert.equal(selected.length,2);const original=selected.map(r=>({...r})),input={reviewer:'tester',reason:'Whitespace correction',rows:selected.map(r=>({item_id:r.item_id,field:r.field,text_vi:' \n'+(r.field==='han_viet'?r.text_vi:'nghĩa đã duyệt').normalize('NFD')+'\t ',expected_translation_id:r.translation_id,reason:'Tester supplied value'}))};
 f.write('corrections.json',input);const options={dbPath:f.dbPath,correctionsPath:f.dir+'/corrections.json',reportPath:f.dir+'/correction-report.json'};await runCorrectionImport(options);
 const after=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND status='selected' ORDER BY field").all(selected[0].item_id);assert.ok(after.every(r=>r.text_vi===r.text_vi.trim()&&r.text_vi===r.text_vi.normalize('NFC')&&JSON.parse(r.context_json).reviewer==='tester'));
 for(const r of original)assert.equal(db.prepare('SELECT text_vi FROM vi_translations WHERE translation_id=?').get(r.translation_id).text_vi,r.text_vi);
 await runCorrectionImport(options);assert.deepEqual(db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND status='selected' ORDER BY field").all(selected[0].item_id),after);
});
