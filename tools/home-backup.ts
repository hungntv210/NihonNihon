import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { saveDailyBackup, validateBackup } from '../src/core/backup.ts';

export function verifyArchive(file: string) {
  const archive=validateBackup(fs.readFileSync(file));
  const base=path.resolve(os.tmpdir()),temporary=fs.mkdtempSync(path.join(base,'nihon-restore-check-'));
  let db:DatabaseSync|undefined;
  try {
    const snapshot=path.join(temporary,'check.sqlite');
    fs.writeFileSync(snapshot,Buffer.from(archive.files.find(f=>f.name==='database.sqlite')!.bytes,'base64'),{mode:0o600});
    db=new DatabaseSync(snapshot,{readOnly:true});
    if(db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('INVALID_DATABASE');
    for(const table of ['content_items','srs_cards','srs_reviews'])if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))throw Error('INVALID_SCHEMA');
    return {integrity:'ok',files:archive.files.length};
  } finally {
    db?.close();
    if(path.dirname(path.resolve(temporary))!==base)throw Error('UNSAFE_TEMP_CLEANUP');
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}
const checksum=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function copyVerifiedArchive(source:string,directory:string,project=process.cwd()) {
  const destination=path.resolve(directory),relative=path.relative(path.resolve(project),destination);
  if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('BACKUP_DESTINATION_INSIDE_PROJECT');
  verifyArchive(source);
  fs.mkdirSync(destination,{recursive:true});
  const hash=checksum(source),name=path.basename(source),target=path.join(destination,name);
  if(fs.existsSync(target)){
    if(checksum(target)!==hash)throw Error('EXISTING_COPY_DIFFERS');
    verifyArchive(target);return {file:target,sha256:hash,integrity:'ok'};
  }
  const temporary=target+'.'+randomUUID()+'.tmp';
  try {
    fs.copyFileSync(source,temporary,fs.constants.COPYFILE_EXCL);
    if(checksum(temporary)!==hash)throw Error('COPY_HASH_MISMATCH');
    verifyArchive(temporary);fs.renameSync(temporary,target);
    return {file:target,sha256:hash,integrity:'ok'};
  } finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,target]=process.argv.slice(2);
  if(mode==='verify'&&target)console.log(JSON.stringify(verifyArchive(path.resolve(target))));
  else if(mode==='copy'&&target)console.log(JSON.stringify(copyVerifiedArchive(await saveDailyBackup(),target)));
  else throw Error('Usage: home-backup.ts copy DESTINATION | verify ARCHIVE');
}
