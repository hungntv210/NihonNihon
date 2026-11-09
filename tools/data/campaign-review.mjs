import fs from 'node:fs';
import path from 'node:path';
import {randomInt} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {privateWrite,sha,need} from './core.mjs';
import {openDatabase} from './store.mjs';
import {quotaDay} from './mt-gemini.mjs';
import {assertDiskSpace} from './disk-space.mjs';

export function randomSample(rows,count=30,choose=randomInt){
 const unique=[...new Map(rows.map(r=>[r.ja.normalize('NFC'),r])).values()];
 for(let i=unique.length-1;i>0;i--){const j=choose(i+1);[unique[i],unique[j]]=[unique[j],unique[i]];}
 return unique.slice(0,count);
}
export function knownSourceReleases(dbPath,manifest){
 if(!fs.existsSync(dbPath)||!fs.statSync(dbPath).size)return false;
 // Allow SQLite to recover a rollback journal left by an interrupted import.
 const db=new DatabaseSync(dbPath);
 try{const lookup=db.prepare('SELECT 1 FROM source_releases WHERE release_id=? AND checksum=?');return manifest.sources.filter(s=>!s.source_id.startsWith('mt:')).every(s=>s.files.every(f=>{
  const id=`${s.source_id}:${sha({version:s.version,sha256:f.sha256,format:f.format,level:f.level??null,variant:f.variant??null,encoding:f.encoding||'utf-8',compression:f.compression||null}).slice(0,32)}`;
  return !!lookup.get(id,f.sha256);
 }));}finally{db.close();}
}
export function writeReviewCheckpoint({directory,state,rows,provenance,force=false,choose}){
 const cursor=state.review_cursor??rows.length,delta=rows.length-cursor;if(delta<500&&!(force&&delta>0))return null;
 const pending=pendingReviewAtCheckpoint({directory,state,count:rows.length,force});if(pending)return {paused:true,...pending};
 const sampleId='review-'+String((state.reviews?.length??0)+1).padStart(4,'0');
 const sample=randomSample(rows.slice(Math.max(0,rows.length-Math.max(delta,30))),30,choose).map(r=>({...r,level:provenance[r.ja]?.level??null,en:provenance[r.ja]?.english??[],vi:r.output.text_vi}));
 const record={version:1,sample_id:sampleId,from_count:cursor,to_count:rows.length,rows:sample};
 const save=(suffix,value)=>privateWrite(path.join(directory,sampleId+suffix),JSON.stringify(value,null,2)+'\n');
 save('.json',record);save('.feedback.json',{version:1,sample_id:sampleId,results:sample.map(r=>({request_id:r.request_id,severity:null,note:''}))});
 const esc=v=>String(v).replaceAll('|','\\|').replaceAll('\n','<br>');
 privateWrite(path.join(directory,sampleId+'.md'),`# ${sampleId} — ${cursor} → ${rows.length}\n\nMẫu ngẫu nhiên; chưa được duyệt nghĩa. Điền severity null/ok/minor/major trong ${sampleId}.feedback.json. Worker dừng khi số major / tổng mẫu > 10%, kể cả phản hồi chưa điền hết.\n\n| Cấp | Nhật | Anh nguồn | Việt | Model |\n| --- | --- | --- | --- | --- |\n`+sample.map(r=>`| ${r.level??''} | ${esc(r.ja)} | ${esc(r.en.join(' / '))} | ${esc(r.vi)} | ${r.model} |`).join('\n')+'\n');
 (state.reviews??=[]).push({sample_id:sampleId,from_count:cursor,to_count:rows.length});state.review_cursor=rows.length;return record;
}
export function pendingReviewAtCheckpoint({directory,state,count,force=false}){
 if(count-(state.review_cursor??count)<500&&!force)return null;const previous=state.reviews?.at(-1);if(!previous)return null;
 const read=suffix=>JSON.parse(fs.readFileSync(path.join(directory,previous.sample_id+suffix),'utf8'));
 const feedback=reviewFeedback(read('.json'),read('.feedback.json'));
 if(feedback.pause)return {sample_id:previous.sample_id,reason:'major_errors',...feedback};
 if(feedback.reviewed<feedback.total)return {sample_id:previous.sample_id,reason:'previous_review_incomplete',reviewed:feedback.reviewed,total:feedback.total};return null;
}
export async function waitForReview(check,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),stopped=()=>false,onPending=()=>{}}={}){
 while(!stopped()){
  const pending=await check();if(!pending)return !stopped();onPending(pending);
  if(pending.reason!=='previous_review_incomplete')return false;
  await sleep(60000);
 }return false;
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
function archivedSnapshot(root,name){
 const file=path.join(root,'archived-snapshots.json');if(!fs.existsSync(file))return null;
 const archives=JSON.parse(fs.readFileSync(file,'utf8')),first=archives.filter(a=>name?a.source===path.join(root,'backups',name):a.role==='first');need(first.length<=1,'Multiple snapshot archives');if(!first.length)return null;
 const entry=first[0];need(path.isAbsolute(entry.destination)&&path.dirname(entry.source)===path.join(root,'backups')&&/^[a-f0-9]{64}$/.test(entry.sha256),'Invalid archived snapshot receipt');
 need(fs.existsSync(entry.destination),'Archived first snapshot is missing');const stat=fs.lstatSync(entry.destination);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===entry.bytes,'Archived first snapshot changed');return entry;
}
export function retainCampaignBackups(directory,currentFile){
 if(!currentFile)return;const root=path.resolve(directory),backupDir=path.join(root,'backups'),index=path.join(root,'campaign-backups.json');
 need(!fs.lstatSync(backupDir).isSymbolicLink(),'Unsafe campaign backup directory');
 need(path.dirname(path.resolve(currentFile))===backupDir,'Backup is outside campaign directory');
 const names=[...new Set([...(fs.existsSync(index)?JSON.parse(fs.readFileSync(index,'utf8')):[]),path.basename(currentFile)])];
 need(names.every(name=>/^(?:before-\d+-[a-f0-9]{8}|quota-\d{4}-\d{2}-\d{2})\.sqlite$/.test(name)),'Invalid campaign backup name');
 const existing=names.filter(name=>fs.existsSync(path.join(backupDir,name)));
 const archived=archivedSnapshot(root),keep=new Set([...(archived?[]:[existing[0]]),...existing.slice(-1)]);
 for(const name of existing)if(!keep.has(name)){const file=path.join(backupDir,name),stat=fs.lstatSync(file);need(stat.isFile()&&!stat.isSymbolicLink(),'Unsafe campaign backup file');fs.unlinkSync(file);fs.appendFileSync(path.join(root,'backup-deletions.jsonl'),JSON.stringify({at:new Date().toISOString(),file,bytes:stat.size,reason:'keep_first_and_latest'})+'\n');}
 privateWrite(index,JSON.stringify(existing.filter(name=>keep.has(name)),null,2)+'\n');
}
export async function ensureDailyCampaignSnapshot(directory,dbPath,timestamp=Date.now(),checkDisk=assertDiskSpace){
 if(!fs.existsSync(dbPath))return {path:null,created:false};
 checkDisk('snapshot',{dbPath});
 const root=path.resolve(directory),backupDir=path.join(root,'backups'),index=path.join(root,'campaign-backups.json'),day=quotaDay(timestamp),daysFile=path.join(root,'quota-snapshot-days.json');
 fs.mkdirSync(backupDir,{recursive:true});need(!fs.lstatSync(backupDir).isSymbolicLink(),'Unsafe campaign backup directory');
 const days=fs.existsSync(daysFile)?JSON.parse(fs.readFileSync(daysFile,'utf8')):{};
 const validName=name=>/^(?:before-\d+-[a-f0-9]{8}|quota-\d{4}-\d{2}-\d{2})\.sqlite$/.test(name);
 const remember=name=>{days[day]=name;privateWrite(daysFile,JSON.stringify(days,null,2)+'\n');};
 if(days[day]){need(validName(days[day]),'Invalid daily snapshot receipt');const file=path.join(backupDir,days[day]);if(!fs.existsSync(file)){const archived=archivedSnapshot(root,days[day]);if(archived)return {path:archived.destination,created:false,day};}need(fs.existsSync(file)&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Recorded daily snapshot is missing or unsafe; no second snapshot created');retainCampaignBackups(root,file);return {path:file,created:false,day};}
 const registered=fs.existsSync(index)?JSON.parse(fs.readFileSync(index,'utf8')):[];
 for(const name of [...registered].reverse()){need(/^(?:before-\d+-[a-f0-9]{8}|quota-\d{4}-\d{2}-\d{2})\.sqlite$/.test(name),'Invalid campaign backup name');const priorDay=name.startsWith('quota-')?name.slice(6,16):quotaDay(Number(/^before-(\d+)-/.exec(name)[1]));
  if(priorDay===day&&fs.existsSync(path.join(backupDir,name))){const file=path.join(backupDir,name);need(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Unsafe campaign backup file');remember(name);retainCampaignBackups(root,file);return {path:file,created:false,day};}
 }
 const file=path.join(backupDir,`quota-${day}.sqlite`);
 if(fs.existsSync(file))need(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Unsafe daily snapshot file');
 if(!fs.existsSync(file)){checkDisk('snapshot',{dbPath});const db=openDatabase(dbPath);try{await backup(db,file);}finally{db.close();}}
 const check=new DatabaseSync(file,{readOnly:true});try{need(check.prepare('PRAGMA integrity_check').get().integrity_check==='ok'&&!check.prepare('PRAGMA foreign_key_check').all().length,'Invalid daily snapshot');need(check.prepare("SELECT 1 FROM sqlite_schema WHERE name='source_releases'").get(),'Not a Nihon snapshot');}finally{check.close();}
 remember(path.basename(file));retainCampaignBackups(root,file);return {path:file,created:true,day};
}
