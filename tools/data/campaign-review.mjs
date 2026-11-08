import fs from 'node:fs';
import path from 'node:path';
import {randomInt} from 'node:crypto';
import {privateWrite,sha,need} from './core.mjs';
import {openDatabase} from './store.mjs';

export function randomSample(rows,count=30,choose=randomInt){
 const unique=[...new Map(rows.map(r=>[r.ja.normalize('NFC'),r])).values()];
 for(let i=unique.length-1;i>0;i--){const j=choose(i+1);[unique[i],unique[j]]=[unique[j],unique[i]];}
 return unique.slice(0,count);
}
export function writeReviewCheckpoint({directory,state,rows,provenance,force=false,choose}){
 const cursor=state.review_cursor??rows.length,delta=rows.length-cursor;if(delta<500&&!(force&&delta>0))return null;
 const sampleId='review-'+String((state.reviews?.length??0)+1).padStart(4,'0');
 const sample=randomSample(rows.slice(Math.max(0,rows.length-Math.max(delta,30))),30,choose).map(r=>({...r,level:provenance[r.ja]?.level??null,en:provenance[r.ja]?.english??[],vi:r.output.text_vi}));
 const record={version:1,sample_id:sampleId,from_count:cursor,to_count:rows.length,rows:sample};
 const save=(suffix,value)=>privateWrite(path.join(directory,sampleId+suffix),JSON.stringify(value,null,2)+'\n');
 save('.json',record);save('.feedback.json',{version:1,sample_id:sampleId,results:sample.map(r=>({request_id:r.request_id,severity:null,note:''}))});
 const esc=v=>String(v).replaceAll('|','\\|').replaceAll('\n','<br>');
 privateWrite(path.join(directory,sampleId+'.md'),`# ${sampleId} — ${cursor} → ${rows.length}\n\nMẫu ngẫu nhiên; chưa được duyệt nghĩa. Điền severity null/ok/minor/major trong ${sampleId}.feedback.json. Worker dừng khi số major / tổng mẫu > 10%, kể cả phản hồi chưa điền hết.\n\n| Cấp | Nhật | Anh nguồn | Việt | Model |\n| --- | --- | --- | --- | --- |\n`+sample.map(r=>`| ${r.level??''} | ${esc(r.ja)} | ${esc(r.en.join(' / '))} | ${esc(r.vi)} | ${r.model} |`).join('\n')+'\n');
 (state.reviews??=[]).push({sample_id:sampleId,from_count:cursor,to_count:rows.length});state.review_cursor=rows.length;return record;
}
export function reviewFeedback(sample,feedback){
 need(feedback.version===1&&feedback.sample_id===sample.sample_id&&Array.isArray(feedback.results),'Invalid review feedback');
 const expected=new Set(sample.rows.map(r=>r.request_id)),seen=new Set(),flags=[];let reviewed=0,major=0;
 need(feedback.results.length===expected.size,'Review feedback count mismatch');
 for(const row of feedback.results){need(expected.has(row.request_id)&&!seen.has(row.request_id),'Unknown/duplicate review request');seen.add(row.request_id);need([null,'ok','minor','major'].includes(row.severity),'Invalid review severity');need(typeof row.note==='string','Invalid review note');if(row.severity!==null)reviewed++;
  if(row.severity==='major')major++;if(['minor','major'].includes(row.severity))flags.push({request_id:row.request_id,reason:`${sample.sample_id}: ${row.severity}: ${row.note.trim()||'Cần xem lại bản dịch'}`});
 }
 return {reviewed,total:expected.size,major,major_percent:100*major/expected.size,pause:major/expected.size>0.1,flags};
}
export function applyTranslationFlags(dbPath,flags){
 if(!flags.length)return 0;const db=openDatabase(dbPath);let count=0;
 try{db.exec('BEGIN IMMEDIATE');for(const flag of flags){need(typeof flag.request_id==='string'&&typeof flag.reason==='string'&&flag.reason.trim(),'Invalid translation review flag');
  const translations=db.prepare("SELECT translation_id FROM vi_translations WHERE source_id='mt:google-gemini' AND method='machine' AND source_record_key=?").all(flag.request_id);
  need(translations.length,'Review request has not been imported');
  for(const {translation_id}of translations)count+=db.prepare("INSERT OR IGNORE INTO translation_reports (report_id,translation_id,reason,reported_at,status) VALUES (?,?,?,?,'open')").run('campaign:'+sha({translation_id,reason:flag.reason}),translation_id,flag.reason.normalize('NFC'),new Date().toISOString()).changes;
 }db.exec('COMMIT');return count;}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
}
