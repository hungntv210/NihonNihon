import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {need,privateWrite,stable} from './core.mjs';

async function checksum(file){const digest=createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);return digest.digest('hex');}
function verify(db){need(db.prepare('PRAGMA integrity_check').get().integrity_check==='ok','Database integrity failed');need(!db.prepare('PRAGMA foreign_key_check').all().length,'Foreign keys failed');}
function unchangedData(db){
 const digest=createHash('sha256'),counts={};
 for(const {name}of db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'import_runs' ORDER BY name").all()){
  const quote=s=>'"'+s.replaceAll('"','""')+'"',keys=db.prepare('PRAGMA table_info('+quote(name)+')').all().filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>quote(c.name));need(keys.length,'Cannot fingerprint a table without a primary key');
  counts[name]=0;digest.update(name+'\n');for(const row of db.prepare('SELECT * FROM '+quote(name)+' ORDER BY '+keys.join(',')).iterate()){digest.update(stable(row)+'\n');counts[name]++;}
 }
 return {counts,sha256:digest.digest('hex')};
}
export async function compactKanjiVGAudit({dbPath,backupDirectory,reportPath}){
 const file=path.resolve(dbPath),directory=path.resolve(backupDirectory);need(fs.existsSync(file),'Missing database');need(path.resolve(reportPath)!==file,'Report would overwrite database');
 let db=new DatabaseSync(file);try{verify(db);}finally{db.close();}
 const before={bytes:fs.statSync(file).size,sha256:await checksum(file)};
 fs.mkdirSync(directory,{recursive:true});need(!fs.lstatSync(directory).isSymbolicLink(),'Unsafe backup directory');
 const copy=path.join(directory,'batch-before-audit-'+randomUUID()+'.sqlite');fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);
 const copyHash=await checksum(copy);need(copyHash===before.sha256&&await checksum(file)===before.sha256,'Backup checksum mismatch or database changed');
 const backupDB=new DatabaseSync(copy,{readOnly:true});try{verify(backupDB);}finally{backupDB.close();}
 const report={started_at:new Date().toISOString(),database:file,backup:{path:copy,sha256:copyHash,integrity:'ok'},before,deletions:[],status:'BACKUP_VERIFIED'};
 const save=()=>privateWrite(reportPath,JSON.stringify(report,null,2)+'\n');save();
 db=new DatabaseSync(file);
 try{
  const invariant=unchangedData(db),schema=stable(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
  const duplicateIds=db.prepare("SELECT run_id,release_id FROM (SELECT run_id,release_id,row_number() OVER (PARTITION BY release_id ORDER BY CASE status WHEN 'committed' THEN 0 ELSE 1 END,started_at,run_id) AS n FROM import_runs WHERE source_id='kanjivg') WHERE n>1").all();
  const otherAudit=()=>{const h=createHash('sha256');for(const row of db.prepare("SELECT * FROM import_runs WHERE source_id<>'kanjivg' ORDER BY run_id").iterate())h.update(stable(row)+'\n');return h.digest('hex');};
  const otherBefore=otherAudit();report.before.kanjivg_audit_rows=db.prepare("SELECT count(*) n FROM import_runs WHERE source_id='kanjivg'").get().n;
  db.exec('BEGIN IMMEDIATE');try{const remove=db.prepare("DELETE FROM import_runs WHERE run_id=? AND source_id='kanjivg'");for(const row of duplicateIds)remove.run(row.run_id);need(unchangedData(db).sha256===invariant.sha256&&otherAudit()===otherBefore,'Data changed outside duplicate KanjiVG audit');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  report.deletions=duplicateIds.map(r=>({table:'import_runs',source_id:'kanjivg',...r}));report.status='DEDUPLICATED';save();
  db.exec('VACUUM');verify(db);need(unchangedData(db).sha256===invariant.sha256&&otherAudit()===otherBefore,'Data changed during VACUUM');need(stable(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all())===schema,'Schema changed');
  report.after={bytes:fs.statSync(file).size,kanjivg_audit_rows:db.prepare("SELECT count(*) n FROM import_runs WHERE source_id='kanjivg'").get().n,integrity:'ok',non_audit_data_unchanged:true,other_audit_unchanged:true};report.status='COMPLETE';report.finished_at=new Date().toISOString();save();return report;
 }catch(e){report.status='FAILED_CHECK_BACKUP';save();throw e;}finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values:a}=parseArgs({options:{db:{type:'string'},'backup-directory':{type:'string'},report:{type:'string'}}});need(a.db&&a['backup-directory']&&a.report,'--db --backup-directory --report required; stop workers first');
 const report=await compactKanjiVGAudit({dbPath:a.db,backupDirectory:a['backup-directory'],reportPath:a.report});console.log(JSON.stringify({status:report.status,before:report.before.bytes,after:report.after.bytes,deleted_rows:report.deletions.length,backup:report.backup.path}));
}
