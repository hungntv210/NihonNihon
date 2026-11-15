import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fixture} from './helpers.ts';
import {createBackup,restoreBackup,validateBackup,saveDailyBackup} from '../src/core/backup.ts';
import {copyVerifiedArchive,verifyArchive} from '../tools/home-backup.ts';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function setup(t:Parameters<typeof fixture>[0]){
 const f=fixture(t),root=path.dirname(f.file);process.env.NIHON_DB_PATH=f.file;process.env.NIHON_DB_ROLE='snapshot';
 for(const k of ['NIHON_JLPT_PATH','NIHON_BACKUP_DIR','NIHON_SETTINGS_PATH','NIHON_ROADMAP_PATH','NIHON_RECORDINGS_DIR'])delete process.env[k];
 const dir=path.join(root,'private/jlpt-daily');fs.mkdirSync(dir,{recursive:true});return {...f,root,dir};
}
function bank(dir:string){
 const db=new DatabaseSync(path.join(dir,'approved.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA foreign_keys=ON;
 CREATE TABLE approved_questions(id TEXT PRIMARY KEY,payload TEXT NOT NULL,receipt TEXT NOT NULL);
 CREATE TABLE approved_schedule(date TEXT NOT NULL,position INTEGER NOT NULL,question_id TEXT NOT NULL UNIQUE REFERENCES approved_questions(id),PRIMARY KEY(date,position));`);
 for(let i=0;i<11;i++)db.prepare('INSERT INTO approved_questions VALUES(?,?,?)').run('fixture-'+i,JSON.stringify({stem:'自作の例 '+i}),JSON.stringify({reviewer:'tester',origin:'draft_roadmap'}));
 db.exec("INSERT INTO approved_schedule VALUES('2026-11-15',0,'fixture-0')");return db;
}
const rows=(db:DatabaseSync)=>({questions:db.prepare('SELECT * FROM approved_questions ORDER BY id').all(),schedule:db.prepare('SELECT * FROM approved_schedule ORDER BY date,position').all()});
test('same daily archive restores eleven approved questions, WAL schedule and attempts into an isolated app root',async t=>{
 const source=setup(t),live=bank(source.dir);const expected=rows(live);
 const attempts=Buffer.from(JSON.stringify({version:1,attempts:[{date:'2026-11-15',questionId:'fixture-0',type:'reading',choice:1,correct:false,cardId:'fixture-card'}]}));
 fs.writeFileSync(path.join(source.dir,'attempts.json'),attempts);
 assert.ok(fs.existsSync(path.join(source.dir,'approved.sqlite-wal')));
 const archive=await saveDailyBackup(new Date('2026-11-15T12:00:00Z'));
 const copied=copyVerifiedArchive(archive,path.join(source.root,'outside-project'),path.join(source.root,'project'));
 assert.equal(verifyArchive(copied.file).jlptFiles,2);const bytes=fs.readFileSync(copied.file),a=validateBackup(bytes);
 const restored=setup(t);await restoreBackup(bytes);
 const db=new DatabaseSync(path.join(restored.dir,'approved.sqlite'),{readOnly:true});try{assert.deepEqual(rows(db),expected);}finally{db.close();}
 for(const entry of a.files.filter(f=>f.name.startsWith('jlpt/')))assert.equal(sha(fs.readFileSync(path.join(restored.dir,path.basename(entry.name)))),entry.sha256);
 assert.deepEqual(fs.readFileSync(path.join(restored.dir,'attempts.json')),attempts);
 assert.deepEqual(rows(live),expected);assert.deepEqual(fs.readFileSync(path.join(source.dir,'attempts.json')),attempts);live.close();
 assert.equal(fs.existsSync(path.join(restored.dir,'write.lock')),false);
});
test('legacy backup preserves current JLPT; marked empty snapshot removes newer JLPT and rejects tampering',async t=>{
 const {dir}=setup(t),empty=await createBackup(),legacy=JSON.parse(empty.toString());delete legacy.jlptIncluded;
 const db=bank(dir);db.close();const attempts=path.join(dir,'attempts.json');fs.writeFileSync(attempts,JSON.stringify({version:1,attempts:[]}));
 await restoreBackup(Buffer.from(JSON.stringify(legacy)));assert.ok(fs.existsSync(path.join(dir,'approved.sqlite')));
 const full=await createBackup(),corrupt=JSON.parse(full.toString());corrupt.files.find((f:{name:string})=>f.name==='jlpt/approved.sqlite').bytes='AAAA';assert.throws(()=>validateBackup(Buffer.from(JSON.stringify(corrupt))),/INTEGRITY/);
 await restoreBackup(empty);assert.equal(fs.existsSync(path.join(dir,'approved.sqlite')),false);assert.equal(fs.existsSync(attempts),false);
});
test('backup waits for the answer lock and upgrades an existing daily archive without overwriting it',async t=>{
 const {root,dir}=setup(t),legacy=JSON.parse((await createBackup()).toString());delete legacy.jlptIncluded;
 const daily=path.join(root,'backups/2026-11-15.json'),old=JSON.stringify(legacy);fs.writeFileSync(daily,old);
 const db=bank(dir);db.close();const lock=path.join(dir,'write.lock');fs.writeFileSync(lock,'');
 const waiting=createBackup();setTimeout(()=>fs.unlinkSync(lock),80);await waiting;
 const upgraded=await saveDailyBackup(new Date('2026-11-15T12:00:00Z'));
 assert.match(upgraded,/-jlpt-v1.json$/);assert.equal(fs.readFileSync(daily,'utf8'),old);assert.equal(validateBackup(fs.readFileSync(upgraded)).jlptIncluded,true);assert.equal(await saveDailyBackup(new Date('2026-11-15T12:00:00Z')),upgraded);
});
