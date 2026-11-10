import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {hash,sha,need,privateWrite} from './core.mjs';
export const WAIVER_PREFIX='tester-accepted waiver: ';
export const findingCode=f=>f.reason.split(':')[0];
export const findingHash=f=>sha({translation_id:f.translation_id,field:f.field,current:f.current,proposed:f.proposed??null,reason:f.reason});
export function applyWaivers(db,findings){
 if(!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='translation_reports'").get())return findings;
 const records=new Map();
 for(const r of db.prepare("SELECT translation_id,reason FROM translation_reports WHERE status='resolved' AND reason LIKE ?").all(WAIVER_PREFIX+'%'))try{const w=JSON.parse(r.reason.slice(WAIVER_PREFIX.length));if(w.reviewer==='tester'&&/^[0-9a-f]{64}$/.test(w.decision_sha256)&&w.finding_sha256)records.set(r.translation_id+':'+w.finding_sha256,w);}catch{}
 return findings.map(f=>{const w=records.get(f.translation_id+':'+findingHash(f));if(!w)return {...f,review_required:f.severity==='review_required'};const row=db.prepare('SELECT text_vi,base_content_hash FROM vi_translations WHERE translation_id=?').get(f.translation_id);return row&&hash(row.text_vi)===w.text_sha256&&row.base_content_hash===w.base_content_hash?{...f,severity:'waived',review_required:false,disposition:'tester-accepted waiver',waiver:w}:{...f,review_required:f.severity==='review_required'};});
}
export function recordTesterWaivers({dbPath,findings,decisionPath,reportPath,expected={too_few_meanings:12,compound_dictionary_candidate_mismatch:3}}){
 const bytes=fs.readFileSync(decisionPath),decision=bytes.toString('utf8');need(Object.keys(expected).every(code=>decision.includes(code)),'Decision file does not cover requested waiver codes');
 const chosen=findings.filter(f=>Object.hasOwn(expected,findingCode(f))),counts=Object.fromEntries(Object.keys(expected).map(code=>[code,chosen.filter(f=>findingCode(f)===code).length]));need(Object.keys(expected).every(code=>counts[code]===expected[code]),'Waiver count mismatch');
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 try{
  const before=sha(db.prepare('SELECT translation_id,text_vi,status,base_content_hash FROM vi_translations ORDER BY translation_id').all()),records=[];db.exec('BEGIN IMMEDIATE');
  try{for(const f of chosen){const t=db.prepare("SELECT * FROM vi_translations WHERE translation_id=? AND status='selected'").get(f.translation_id);need(t&&t.text_vi===f.current,'Waiver target changed');const waiver={type:'tester-accepted waiver',reviewer:'tester',code:findingCode(f),finding_sha256:findingHash(f),decision_path:decisionPath,decision_sha256:hash(bytes),base_content_hash:t.base_content_hash,text_sha256:hash(t.text_vi),observed_reason:f.reason,recorded_at:new Date().toISOString()};const report_id='waiver:'+sha({translation_id:f.translation_id,finding:waiver.finding_sha256,decision:waiver.decision_sha256});db.prepare("INSERT OR IGNORE INTO translation_reports(report_id,translation_id,reason,reported_at,status) VALUES(?,?,?,?,'resolved')").run(report_id,f.translation_id,WAIVER_PREFIX+JSON.stringify(waiver),waiver.recorded_at);records.push({report_id,translation_id:f.translation_id,kanji:f.kanji,...waiver});}
   need(before===sha(db.prepare('SELECT translation_id,text_vi,status,base_content_hash FROM vi_translations ORDER BY translation_id').all()),'Waiver must not alter translations');db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  const report={counts,records,translations_unchanged:true};privateWrite(reportPath,JSON.stringify(report,null,2));return report;
 }finally{db.close();}
}
