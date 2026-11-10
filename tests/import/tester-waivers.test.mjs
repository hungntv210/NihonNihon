import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture} from './helpers.mjs';import {runImport} from '../../tools/data/import.mjs';import {recordTesterWaivers,applyWaivers} from '../../tools/data/tester-waivers.mjs';
test('tester waiver keeps text and selection, is idempotent and invalidates when content changes',async t=>{
 const f=fixture(t);await runImport(f);const db=f.open(),row=db.prepare("SELECT * FROM vi_translations WHERE status='selected'").get(),finding={kanji:'日',translation_id:row.translation_id,field:row.field,current:row.text_vi,proposed:null,reason:'too_few_meanings: expected >=3, got 2',severity:'review_required'};
 f.write('decisions.md','Tester: too_few_meanings accepted');const options={dbPath:f.dbPath,findings:[finding],decisionPath:f.dir+'/decisions.md',reportPath:f.dir+'/waivers.json',expected:{too_few_meanings:1}};
 recordTesterWaivers(options);recordTesterWaivers(options);assert.equal(db.prepare('SELECT count(*) n FROM translation_reports').get().n,1);assert.equal(db.prepare('SELECT text_vi FROM vi_translations WHERE translation_id=?').get(row.translation_id).text_vi,row.text_vi);
 const applied=applyWaivers(db,[finding])[0];assert.equal(applied.review_required,false);assert.equal(applied.disposition,'tester-accepted waiver');assert.match(applied.waiver.decision_sha256,/^[a-f0-9]{64}$/);
 db.prepare('UPDATE vi_translations SET base_content_hash=? WHERE translation_id=?').run('b'.repeat(64),row.translation_id);assert.equal(applyWaivers(db,[finding])[0].review_required,true);
 assert.equal(JSON.parse(fs.readFileSync(options.reportPath)).translations_unchanged,true);
});
test('waiver refuses an unexpected cohort or a finding not authorized by the decision',async t=>{
 const f=fixture(t);await runImport(f);f.write('decision.md','too_few_meanings');
 assert.throws(()=>recordTesterWaivers({dbPath:f.dbPath,findings:[],decisionPath:f.dir+'/decision.md',reportPath:f.dir+'/out.json',expected:{too_few_meanings:12}}),/count mismatch/);
 assert.throws(()=>recordTesterWaivers({dbPath:f.dbPath,findings:[],decisionPath:f.dir+'/decision.md',reportPath:f.dir+'/out.json',expected:{other:1}}),/does not cover/);
});
