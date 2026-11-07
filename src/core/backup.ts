import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { backup, DatabaseSync } from 'node:sqlite';
import { databasePath } from './config.ts';
import { DEFAULT_PREFERENCES, newLessonsLocked, validatePreferences } from './preferences.ts';
const MAX = 128 * 1024 * 1024;
type Entry = { name:string; bytes:string; sha256:string };
type Archive = { version:1; createdAt:string; files:Entry[] };
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function backupPaths() {
 const db=databasePath(), root=path.dirname(db);
 // Explicit opt-in is required for a separately supplied snapshot, never a G0 worker database.
 if(path.basename(db)!=='demo.sqlite' && process.env.NIHON_DB_ROLE!=='snapshot') throw Error('BACKUP_REQUIRES_G1_SNAPSHOT');
 const paths = {db,root,backups:path.resolve(process.env.NIHON_BACKUP_DIR||path.join(root,'backups')),recordings:path.resolve(process.env.NIHON_RECORDINGS_DIR||path.join(root,'recordings')),settings:path.resolve(process.env.NIHON_SETTINGS_PATH||path.join(root,'settings.json')),roadmap:path.resolve(process.env.NIHON_ROADMAP_PATH||path.join(root,'private','today-roadmap.json')),lock:path.join(root,'maintenance.lock')};
 for(const key of ['backups','recordings','settings','roadmap'] as const){const relative=path.relative(root,paths[key]);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('PRIVATE_PATH_OUTSIDE_G1_ROOT');if(fs.existsSync(paths[key])&&fs.lstatSync(paths[key]).isSymbolicLink())throw Error('SYMLINK_FORBIDDEN');}
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
export async function createBackup():Promise<Buffer> {
 const p=backupPaths(); fs.mkdirSync(p.backups,{recursive:true});
 const snapshot=path.join(p.backups,randomUUID()+'.sqlite');
 try {const db=new DatabaseSync(p.db,{readOnly:true});try{await backup(db,snapshot);}finally{db.close();}checkDatabase(snapshot);
 const file=(name:string,f:string)=>{const b=fs.readFileSync(f);return {name,bytes:b.toString('base64'),sha256:digest(b)};};
 const files=[file('database.sqlite',snapshot),...walk(p.recordings),...(['settings','roadmap'] as const).filter(k=>fs.existsSync(p[k])).map(k=>file(k+'.json',p[k]))];
 const result=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),files}));if(result.length>MAX)throw Error('BACKUP_TOO_LARGE');return result;
 }finally{if(fs.existsSync(snapshot))fs.unlinkSync(snapshot);}
}
function safeRecordingPath(name:string){return name.startsWith('recordings/')&&name.split('/').slice(1).every(part=>part.length>0&&part.length<=255&&part!=='.'&&part!=='..'&&!/[\x00-\x1f<>:"\\|?*]/.test(part)&&!/[. ]$/.test(part)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));}
export function validateBackup(bytes:Buffer):Archive {
 if(bytes.length>MAX)throw Error('BACKUP_TOO_LARGE');const a=JSON.parse(bytes.toString('utf8')) as Archive;
 if(a.version!==1||!Array.isArray(a.files)||!a.files.length||a.files.length>10000||typeof a.createdAt!=='string')throw Error('INVALID_BACKUP');
 const seen=new Set<string>();let total=0;
 for(const f of a.files){if(typeof f.name!=='string'||!( ['database.sqlite','settings.json','roadmap.json'].includes(f.name)||safeRecordingPath(f.name))||seen.has(f.name)||typeof f.bytes!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.bytes))throw Error('INVALID_BACKUP_PATH');seen.add(f.name);const b=Buffer.from(f.bytes,'base64');total+=b.length;if(total>MAX||digest(b)!==f.sha256)throw Error('BACKUP_INTEGRITY');}
 if(!seen.has('database.sqlite'))throw Error('DATABASE_MISSING');
 for(const f of a.files){if(f.name==='settings.json')validatePreferences(JSON.parse(Buffer.from(f.bytes,'base64').toString('utf8')));if(f.name==='roadmap.json')validateRoadmap(JSON.parse(Buffer.from(f.bytes,'base64').toString('utf8')));}
 return a;
}
export async function saveDailyBackup(now=new Date()) {
 const p=backupPaths();fs.mkdirSync(p.backups,{recursive:true});const file=path.join(p.backups,now.toISOString().slice(0,10)+'.json');
 if(fs.existsSync(file))return file;
 const bytes=await createBackup(),tmp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,bytes,{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}return file;
}
function validateRoadmap(value:unknown) {
 const v=value as Record<string,unknown>;
 const date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 if(!v||typeof v!=='object'||v.version!==1||!['review','new','grammar','jlpt','shadow','weekly',null].includes(v.activeTask as string|null))throw Error('INVALID_ROADMAP');
 for(const key of ['activity','shortDays'])if(!Array.isArray(v[key])||v[key].length>10000||v[key].some(x=>!date(x)))throw Error('INVALID_ROADMAP');
 if(!Array.isArray(v.shadow)||v.shadow.length>10000)throw Error('INVALID_ROADMAP');
 for(const row of v.shadow){const r=row as Record<string,unknown>;if(!r||!date(r.date)||!['regular','makeup'].includes(String(r.kind))||r.method!=='manual'||!Number.isInteger(r.minutes)||Number(r.minutes)<(r.kind==='makeup'?25:15)||Number(r.minutes)>180||!Array.isArray(r.clips)||r.clips.length<(r.kind==='makeup'?2:1)||r.clips.length>2||new Set(r.clips).size!==r.clips.length||r.clips.some(x=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('INVALID_ROADMAP');}
}
function removePrivate(target:string,root:string){const relative=path.relative(path.resolve(root),path.resolve(target));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('UNSAFE_CLEANUP');fs.rmSync(target,{recursive:true,force:true});}
export async function restoreBackup(bytes:Buffer) {
 const a=validateBackup(bytes),p=backupPaths(),stage=path.join(p.root,'.restore-'+randomUUID());fs.mkdirSync(stage,{recursive:true});
 let locked=false,committed=false,rollbackFailed=false,db:DatabaseSync|undefined;const replaced:{target:string;old:string;had:boolean}[]=[];
 try {
  for(const f of a.files){const file=path.join(stage,f.name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(f.bytes,'base64'),{mode:0o600});}checkDatabase(path.join(stage,'database.sqlite'));
  const current=new DatabaseSync(p.db,{readOnly:true});const incoming=new DatabaseSync(path.join(stage,'database.sqlite'),{readOnly:true});try{const schema=(db:DatabaseSync)=>JSON.stringify(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());if(schema(current)!==schema(incoming))throw Error('SCHEMA_MISMATCH');}finally{current.close();incoming.close();}
  fs.writeFileSync(p.lock,new Date().toISOString(),{flag:'wx',mode:0o600});locked=true;
  const safety=await createBackup();fs.writeFileSync(path.join(p.backups,'before-restore-'+Date.now()+'.json'),safety,{flag:'wx',mode:0o600});
  db=new DatabaseSync(p.db,{timeout:5000});db.prepare('ATTACH DATABASE ? AS restored').run(path.join(stage,'database.sqlite'));
  db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON');
  const tables=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));
  const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';
  for(const table of tables)db.exec('DELETE FROM main.'+quote(table));
  for(const table of tables)db.exec('INSERT INTO main.'+quote(table)+' SELECT * FROM restored.'+quote(table));
  if(db.prepare('PRAGMA main.foreign_key_check').all().length)throw Error('FOREIGN_KEY_VIOLATION');
  const mappings=[['recordings',p.recordings],['settings.json',p.settings],['roadmap.json',p.roadmap]];
  for(const [name,target] of mappings){const old=target+'.pre-restore-'+randomUUID(),had=fs.existsSync(target);if(had)fs.renameSync(target,old);replaced.push({target,old,had});const next=path.join(stage,name);if(fs.existsSync(next)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(next,target);}}
  db.exec('COMMIT');committed=true;
 }catch(error){try{db?.exec('ROLLBACK');}catch{}const failures:unknown[]=[];for(const r of [...replaced].reverse()){try{if(fs.existsSync(r.target))removePrivate(r.target,p.root);if(r.had)fs.renameSync(r.old,r.target);}catch(failure){rollbackFailed=true;failures.push(failure);}}if(failures.length)throw new AggregateError([error,...failures],'RESTORE_ROLLBACK_FAILED_RECOVERY_FILES_RETAINED');throw error;}
 finally{db?.close();if(committed)for(const r of replaced){if(fs.existsSync(r.old))removePrivate(r.old,p.root);}if(!rollbackFailed)removePrivate(stage,p.root);if(locked)fs.unlinkSync(p.lock);}
}

