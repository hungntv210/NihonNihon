import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { backup, DatabaseSync } from 'node:sqlite';
import { databasePath } from './config.ts';
import { DEFAULT_PREFERENCES, newLessonsLocked, validatePreferences } from './preferences.ts';
const MAX = 128 * 1024 * 1024;
type Entry = { name:string; bytes:string; sha256:string };
type Archive = { version:1; createdAt:string; files:Entry[]; jlptIncluded?:true };
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function backupPaths() {
 const db=databasePath(), root=path.dirname(db);
 // Explicit opt-in is required for a separately supplied snapshot, never a G0 worker database.
 if(path.basename(db)!=='demo.sqlite' && process.env.NIHON_DB_ROLE!=='snapshot') throw Error('BACKUP_REQUIRES_G1_SNAPSHOT');
 const paths = {db,root,jlpt:path.resolve(process.env.NIHON_JLPT_PATH||path.join(root,'private','jlpt-daily')),backups:path.resolve(process.env.NIHON_BACKUP_DIR||path.join(root,'backups')),recordings:path.resolve(process.env.NIHON_RECORDINGS_DIR||path.join(root,'recordings')),settings:path.resolve(process.env.NIHON_SETTINGS_PATH||path.join(root,'settings.json')),roadmap:path.resolve(process.env.NIHON_ROADMAP_PATH||path.join(root,'private','today-roadmap.json')),lookupSentences:path.resolve(process.env.NIHON_LOOKUP_CONTEXT_PATH||path.join(root,'private','lookup-sentences.json')),shadowingHistory:path.resolve(process.env.NIHON_SHADOWING_HISTORY_PATH||path.join(root,'private','shadowing-history.json')),lock:path.join(root,'maintenance.lock')};
 for(const key of ['backups','recordings','settings','roadmap','lookupSentences','shadowingHistory','jlpt'] as const){const relative=path.relative(root,paths[key]);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('PRIVATE_PATH_OUTSIDE_G1_ROOT');if(fs.existsSync(paths[key])&&fs.lstatSync(paths[key]).isSymbolicLink())throw Error('SYMLINK_FORBIDDEN');}
 for(const target of [paths.jlpt,paths.lookupSentences,paths.shadowingHistory])for(let cursor=target;cursor!==root;cursor=path.dirname(cursor)){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('SYMLINK_FORBIDDEN');}
 return paths;
}
export function maintenanceActive() { return fs.existsSync(path.join(path.dirname(databasePath()),'maintenance.lock')); }
export function lessonAccessLocked() {
 const root=path.dirname(databasePath()),settings=path.resolve(process.env.NIHON_SETTINGS_PATH||path.join(root,'settings.json')),roadmap=path.resolve(process.env.NIHON_ROADMAP_PATH||path.join(root,'private','today-roadmap.json'));
 try {const p=fs.existsSync(settings)?validatePreferences(JSON.parse(fs.readFileSync(settings,'utf8'))):DEFAULT_PREFERENCES;
 const progress=fs.existsSync(roadmap)?JSON.parse(fs.readFileSync(roadmap,'utf8')):{version:1,shadow:[],activity:[],activeTask:null,shortDays:[]};validateRoadmap(progress);return newLessonsLocked(p,progress.shadow);
 }catch{return true;}
}
function walk(directory:string, prefix='recordings/'):Entry[] {
 if(!fs.existsSync(directory))return [];
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{if(entry.isSymbolicLink())throw Error('SYMLINK_FORBIDDEN');const file=path.join(directory,entry.name);if(entry.isDirectory())return walk(file,prefix+entry.name+'/');if(!entry.isFile())throw Error('INVALID_RECORDING');const b=fs.readFileSync(file);return [{name:prefix+entry.name,bytes:b.toString('base64'),sha256:digest(b)}];});
}
function checkDatabase(file:string) {const db=new DatabaseSync(file,{readOnly:true});try {if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('FOREIGN_KEY_VIOLATION');if(db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('DATABASE_CORRUPT');for(const table of ['content_items','srs_cards','srs_reviews'])if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))throw Error('INVALID_SCHEMA');}finally{db.close();}}
export function checkJlptDatabase(file:string){const db=new DatabaseSync(file,{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('INVALID_JLPT_DATABASE');for(const [table,columns]of [['approved_questions',['id','payload','receipt']],['approved_schedule',['date','position','question_id']]] as const){const actual=db.prepare('PRAGMA table_info('+table+')').all().map(r=>r.name);if(JSON.stringify(actual)!==JSON.stringify(columns))throw Error('INVALID_JLPT_SCHEMA');}}finally{db.close();}}
function validateAttempts(bytes:Buffer){const state=JSON.parse(bytes.toString('utf8'));if(state.version!==1||!Array.isArray(state.attempts)||state.attempts.length>50000)throw Error('INVALID_JLPT_ATTEMPTS');for(const a of state.attempts)if(!a||typeof a.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||typeof a.questionId!=='string'||!a.questionId||typeof a.type!=='string'||!Number.isInteger(a.choice)||a.choice<0||a.choice>3||typeof a.correct!=='boolean'||!(a.cardId===null||typeof a.cardId==='string'))throw Error('INVALID_JLPT_ATTEMPTS');}
async function withJlptLock<T>(p:ReturnType<typeof backupPaths>,action:()=>Promise<T>){fs.mkdirSync(p.jlpt,{recursive:true});const lock=path.join(p.jlpt,'write.lock');let fd:number|undefined;for(let n=0;n<40;n++){try{fd=fs.openSync(lock,'wx',0o600);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,50));}}if(fd===undefined)throw Error('STORE_BUSY');try{return await action();}finally{fs.closeSync(fd);fs.unlinkSync(lock);}}
export async function createBackup():Promise<Buffer>{const p=backupPaths();return withJlptLock(p,()=>createBackupUnlocked(p));}
async function createBackupUnlocked(p:ReturnType<typeof backupPaths>):Promise<Buffer> {
 fs.mkdirSync(p.backups,{recursive:true});
 const snapshot=path.join(p.backups,randomUUID()+'.sqlite'),jlptSnapshot=path.join(p.backups,randomUUID()+'.sqlite');
 try {const db=new DatabaseSync(p.db,{readOnly:true});try{await backup(db,snapshot);}finally{db.close();}checkDatabase(snapshot);
 const file=(name:string,f:string)=>{const b=fs.readFileSync(f);return {name,bytes:b.toString('base64'),sha256:digest(b)};};
 const files=[file('database.sqlite',snapshot),...walk(p.recordings),...([['settings.json',p.settings],['roadmap.json',p.roadmap],['lookup-sentences.json',p.lookupSentences],['shadowing-history.json',p.shadowingHistory]] as const).filter(([,target])=>fs.existsSync(target)).map(([name,target])=>{if(!fs.statSync(target).isFile())throw Error('INVALID_BACKUP_FILE');return file(name,target);})];
 for(const name of ['approved.sqlite','attempts.json']){const source=path.join(p.jlpt,name);if(!fs.existsSync(source))continue;if(fs.lstatSync(source).isSymbolicLink()||!fs.statSync(source).isFile())throw Error('INVALID_JLPT_FILE');if(name==='approved.sqlite'){const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,jlptSnapshot);}finally{db.close();}checkJlptDatabase(jlptSnapshot);files.push(file('jlpt/'+name,jlptSnapshot));}else{validateAttempts(fs.readFileSync(source));files.push(file('jlpt/'+name,source));}}
 const result=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),jlptIncluded:true,files}));if(result.length>MAX)throw Error('BACKUP_TOO_LARGE');return result;
 }finally{if(fs.existsSync(snapshot))fs.unlinkSync(snapshot);if(fs.existsSync(jlptSnapshot))fs.unlinkSync(jlptSnapshot);}
}
function safeRecordingPath(name:string){return name.startsWith('recordings/')&&name.split('/').slice(1).every(part=>part.length>0&&part.length<=255&&part!=='.'&&part!=='..'&&!/[\x00-\x1f<>:"\\|?*]/.test(part)&&!/[. ]$/.test(part)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));}
function isBackupBase64(value: string) {
 if (value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) return false;
 const padding = value.indexOf('=');
 return padding === -1 || padding === value.length - 1 ||
  (padding === value.length - 2 && value.endsWith('=='));
}
export function validateBackup(bytes:Buffer):Archive {
 if(bytes.length>MAX)throw Error('BACKUP_TOO_LARGE');const a=JSON.parse(bytes.toString('utf8')) as Archive;
 if(a.version!==1||!Array.isArray(a.files)||!a.files.length||a.files.length>10000||typeof a.createdAt!=='string')throw Error('INVALID_BACKUP');
 const seen=new Set<string>();let total=0;
 for(const f of a.files){if(typeof f.name!=='string'||!( ['database.sqlite','settings.json','roadmap.json','lookup-sentences.json','shadowing-history.json','jlpt/approved.sqlite','jlpt/attempts.json'].includes(f.name)||safeRecordingPath(f.name))||seen.has(f.name)||typeof f.bytes!=='string'||!isBackupBase64(f.bytes))throw Error('INVALID_BACKUP_PATH');seen.add(f.name);const b=Buffer.from(f.bytes,'base64');total+=b.length;if(total>MAX||digest(b)!==f.sha256)throw Error('BACKUP_INTEGRITY');}
 if(a.jlptIncluded!==undefined&&a.jlptIncluded!==true||a.files.some(f=>f.name.startsWith('jlpt/'))&&a.jlptIncluded!==true)throw Error('INVALID_JLPT_MARKER');
 for(const f of a.files)if(f.name==='jlpt/attempts.json')validateAttempts(Buffer.from(f.bytes,'base64'));
 if(!seen.has('database.sqlite'))throw Error('DATABASE_MISSING');
 for(const f of a.files){if(f.name==='settings.json')validatePreferences(JSON.parse(Buffer.from(f.bytes,'base64').toString('utf8')));if(f.name==='roadmap.json')validateRoadmap(JSON.parse(Buffer.from(f.bytes,'base64').toString('utf8')));if(f.name==='lookup-sentences.json')validateLookupSentences(Buffer.from(f.bytes,'base64'));if(f.name==='shadowing-history.json')validateShadowingHistory(Buffer.from(f.bytes,'base64'));}
 return a;
}
export function pruneDailyBackups(now=new Date()) {
 const {backups}=backupPaths(),today=now.toISOString().slice(0,10);
 if(!fs.existsSync(backups))return [];
 const daily=fs.readdirSync(backups,{withFileTypes:true}).filter(entry=>{
  if(!entry.isFile()||!/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))return false;
  const date=entry.name.slice(0,10),time=Date.parse(date+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date&&date<=today;
 }).map(entry=>entry.name).sort((a,b)=>b.localeCompare(a));
 const week=(name:string)=>{const date=new Date(name.slice(0,10)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);};
 const keep=new Set(daily.slice(0,14)),weeks=new Set([...keep].map(week));let weekly=0;
 for(const name of daily.slice(14)){const bucket=week(name);if(weekly<4&&!weeks.has(bucket)){keep.add(name);weeks.add(bucket);weekly++;}}
 const removed:string[]=[];
 for(const name of daily){
  if(keep.has(name))continue;
  const target=path.resolve(backups,name);
  if(path.dirname(target)!==path.resolve(backups))throw Error('UNSAFE_BACKUP_CLEANUP');
  try{if(fs.lstatSync(target).isFile()){fs.unlinkSync(target);removed.push(name);}}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 return removed;
}
export async function saveDailyBackup(now=new Date()) {
 const p=backupPaths();fs.mkdirSync(p.backups,{recursive:true});let file=path.join(p.backups,now.toISOString().slice(0,10)+'.json');
 if(fs.existsSync(file)){let complete=false;try{complete=validateBackup(fs.readFileSync(file)).jlptIncluded===true;}catch{}if(!complete)file=file.replace(/\.json$/,'-jlpt-v1.json');}
 if(fs.existsSync(file)){pruneDailyBackups(now);return file;}
 const bytes=await createBackup(),tmp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,bytes,{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}pruneDailyBackups(now);return file;
}
function validateRoadmap(value:unknown) {
 const v=value as Record<string,unknown>;
 const date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 if(!v||typeof v!=='object'||v.version!==1||!['review','new','grammar','jlpt','shadow','weekly',null].includes(v.activeTask as string|null))throw Error('INVALID_ROADMAP');
 for(const key of ['activity','shortDays'])if(!Array.isArray(v[key])||v[key].length>10000||v[key].some(x=>!date(x)))throw Error('INVALID_ROADMAP');
 if(!Array.isArray(v.shadow)||v.shadow.length>10000)throw Error('INVALID_ROADMAP');
 for(const row of v.shadow){const r=row as Record<string,unknown>;if(!r||!date(r.date)||!['regular','makeup'].includes(String(r.kind))||r.method!=='manual'||!Number.isInteger(r.minutes)||Number(r.minutes)<(r.kind==='makeup'?25:15)||Number(r.minutes)>180||!Array.isArray(r.clips)||r.clips.length<(r.kind==='makeup'?2:1)||r.clips.length>2||new Set(r.clips).size!==r.clips.length||r.clips.some(x=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('INVALID_ROADMAP');}
}
function validateLookupSentences(bytes:Buffer) {
 if(bytes.length>2_000_000)throw Error('INVALID_LOOKUP_SENTENCES');
 let parsed:unknown;
 try{parsed=JSON.parse(bytes.toString('utf8'));}catch{throw Error('INVALID_LOOKUP_SENTENCES');}
 const v=parsed as Record<string,unknown>;
 if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==1||!v.entries||typeof v.entries!=='object'||Array.isArray(v.entries))throw Error('INVALID_LOOKUP_SENTENCES');
 const pairs=Object.entries(v.entries as Record<string,unknown>);
 if(pairs.length>50000)throw Error('INVALID_LOOKUP_SENTENCES');
 for(const [key,row] of pairs){
  if(!key||key.length>256||key==='__proto__'||key==='constructor'||key==='prototype'||!row||typeof row!=='object'||Array.isArray(row))throw Error('INVALID_LOOKUP_SENTENCES');
  const e=row as Record<string,unknown>;
  if(typeof e.cardId!=='string'||!e.cardId||e.cardId.length>256||e.cardId!==key||typeof e.itemId!=='string'||!e.itemId||e.itemId.length>256||typeof e.sentenceJa!=='string'||!e.sentenceJa.trim()||e.sentenceJa.length>500||!(e.sentenceVi===null||(typeof e.sentenceVi==='string'&&e.sentenceVi.length<=500))||!(e.sourceClipId===null||(typeof e.sourceClipId==='string'&&e.sourceClipId.length<=128))||typeof e.savedAt!=='string'||!e.savedAt||e.savedAt.length>64||!Number.isFinite(Date.parse(e.savedAt)))throw Error('INVALID_LOOKUP_SENTENCES');
 }
}
function validateShadowingHistory(bytes:Buffer) {
 if(bytes.length>2_000_000)throw Error('INVALID_SHADOWING_HISTORY');
 let parsed:unknown;
 try{parsed=JSON.parse(bytes.toString('utf8'));}catch{throw Error('INVALID_SHADOWING_HISTORY');}
 const v=parsed as Record<string,unknown>;
 const safeAudio=(x:unknown)=>typeof x==='string'&&/^shadowing\/[a-zA-Z0-9._-]{1,120}\.(webm|m4a|ogg)$/.test(x);
 const safeMime=(x:unknown)=>x==='audio/webm'||x==='audio/mp4'||x==='audio/ogg';
 if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==1||!Array.isArray(v.turns)||v.turns.length>10000||!v.pinned||typeof v.pinned!=='object'||Array.isArray(v.pinned))throw Error('INVALID_SHADOWING_HISTORY');
 for(const row of v.turns){
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('INVALID_SHADOWING_HISTORY');
  const t=row as Record<string,unknown>;
  if(typeof t.id!=='string'||!t.id||t.id.length>128||typeof t.clipId!=='string'||!t.clipId||t.clipId.length>256||!(t.segmentId===null||(typeof t.segmentId==='string'&&t.segmentId.length>0&&t.segmentId.length<=256))||typeof t.practicedAt!=='string'||t.practicedAt.length>64||!Number.isFinite(Date.parse(t.practicedAt))||typeof t.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!Number.isSafeInteger(t.durationMs)||Number(t.durationMs)<0||Number(t.durationMs)>3_600_000||!Number.isSafeInteger(t.recordedSegments)||Number(t.recordedSegments)<0||Number(t.recordedSegments)>500||!Number.isSafeInteger(t.totalSegments)||Number(t.totalSegments)<0||Number(t.totalSegments)>500||!(t.audioFile===null||safeAudio(t.audioFile))||!(t.audioMime===null||safeMime(t.audioMime))||!(t.audioBytes===null||(Number.isSafeInteger(t.audioBytes)&&Number(t.audioBytes)>0&&Number(t.audioBytes)<=2*1024*1024)))throw Error('INVALID_SHADOWING_HISTORY');
 }
 const clipPairs=Object.entries(v.pinned as Record<string,unknown>);
 if(clipPairs.length>500)throw Error('INVALID_SHADOWING_HISTORY');
 for(const [clipId,segMap] of clipPairs){
  if(!clipId||clipId.length>256||clipId==='__proto__'||clipId==='constructor'||clipId==='prototype'||!segMap||typeof segMap!=='object'||Array.isArray(segMap))throw Error('INVALID_SHADOWING_HISTORY');
  const segPairs=Object.entries(segMap as Record<string,unknown>);
  if(segPairs.length>200)throw Error('INVALID_SHADOWING_HISTORY');
  for(const [segId,pin] of segPairs){
   if(!segId||segId.length>256||segId==='__proto__'||segId==='constructor'||segId==='prototype'||!pin||typeof pin!=='object'||Array.isArray(pin))throw Error('INVALID_SHADOWING_HISTORY');
   const e=pin as Record<string,unknown>;
   if(typeof e.id!=='string'||!e.id||e.id.length>128||e.clipId!==clipId||e.segmentId!==segId||typeof e.pinnedAt!=='string'||e.pinnedAt.length>64||!Number.isFinite(Date.parse(e.pinnedAt))||!Number.isSafeInteger(e.durationMs)||Number(e.durationMs)<=0||Number(e.durationMs)>60_000||!safeAudio(e.audioFile)||!safeMime(e.audioMime)||!Number.isSafeInteger(e.audioBytes)||Number(e.audioBytes)<=0||Number(e.audioBytes)>2*1024*1024)throw Error('INVALID_SHADOWING_HISTORY');
  }
 }
}
function removePrivate(target:string,root:string){const relative=path.relative(path.resolve(root),path.resolve(target));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('UNSAFE_CLEANUP');fs.rmSync(target,{recursive:true,force:true});}
export async function restoreBackup(bytes:Buffer){const p=backupPaths();return withJlptLock(p,()=>restoreBackupUnlocked(bytes,p));}
async function restoreBackupUnlocked(bytes:Buffer,p:ReturnType<typeof backupPaths>) {
 const a=validateBackup(bytes),stage=path.join(p.root,'.restore-'+randomUUID());fs.mkdirSync(stage,{recursive:true});
 let locked=false,committed=false,rollbackFailed=false,db:DatabaseSync|undefined;const replaced:{target:string;old:string;had:boolean}[]=[];
 try {
  for(const f of a.files){const file=path.join(stage,f.name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(f.bytes,'base64'),{mode:0o600});}checkDatabase(path.join(stage,'database.sqlite'));if(fs.existsSync(path.join(stage,'jlpt/approved.sqlite')))checkJlptDatabase(path.join(stage,'jlpt/approved.sqlite'));
  const current=new DatabaseSync(p.db,{readOnly:true});const incoming=new DatabaseSync(path.join(stage,'database.sqlite'),{readOnly:true});try{const schema=(db:DatabaseSync)=>JSON.stringify(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());if(schema(current)!==schema(incoming))throw Error('SCHEMA_MISMATCH');}finally{current.close();incoming.close();}
  fs.writeFileSync(p.lock,new Date().toISOString(),{flag:'wx',mode:0o600});locked=true;
  const safety=await createBackupUnlocked(p);fs.writeFileSync(path.join(p.backups,'before-restore-'+Date.now()+'.json'),safety,{flag:'wx',mode:0o600});
  db=new DatabaseSync(p.db,{timeout:5000});db.prepare('ATTACH DATABASE ? AS restored').run(path.join(stage,'database.sqlite'));
  db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON');
  const tables=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));
  const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';
  for(const table of tables)db.exec('DELETE FROM main.'+quote(table));
  for(const table of tables)db.exec('INSERT INTO main.'+quote(table)+' SELECT * FROM restored.'+quote(table));
  if(db.prepare('PRAGMA main.foreign_key_check').all().length)throw Error('FOREIGN_KEY_VIOLATION');
  const mappings=[['recordings',p.recordings],['settings.json',p.settings],['roadmap.json',p.roadmap],['lookup-sentences.json',p.lookupSentences],['shadowing-history.json',p.shadowingHistory],...(a.jlptIncluded?['approved.sqlite','attempts.json','approved.sqlite-wal','approved.sqlite-shm'].map(name=>['jlpt/'+name,path.join(p.jlpt,name)]):[])];
  for(const [name,target] of mappings){const old=target+'.pre-restore-'+randomUUID(),had=fs.existsSync(target);if(had)fs.renameSync(target,old);replaced.push({target,old,had});const next=path.join(stage,name);if(fs.existsSync(next)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(next,target);}}
  db.exec('COMMIT');committed=true;
 }catch(error){try{db?.exec('ROLLBACK');}catch{}const failures:unknown[]=[];for(const r of [...replaced].reverse()){try{if(fs.existsSync(r.target))removePrivate(r.target,p.root);if(r.had)fs.renameSync(r.old,r.target);}catch(failure){rollbackFailed=true;failures.push(failure);}}if(failures.length)throw new AggregateError([error,...failures],'RESTORE_ROLLBACK_FAILED_RECOVERY_FILES_RETAINED');throw error;}
 finally{db?.close();if(committed)for(const r of replaced){if(fs.existsSync(r.old))removePrivate(r.old,p.root);}if(!rollbackFailed)removePrivate(stage,p.root);if(locked)fs.unlinkSync(p.lock);}
}
