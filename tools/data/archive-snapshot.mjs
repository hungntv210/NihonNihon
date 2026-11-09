import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {need,privateWrite} from './core.mjs';

async function checksum(file){const digest=createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);return digest.digest('hex');}
export async function copyVerifiedSnapshot(source,destinationDirectory){
 const file=path.resolve(source),directory=path.resolve(destinationDirectory),destination=path.join(directory,path.basename(file));need(file!==destination,'Archive would overwrite its source');
 const stat=fs.lstatSync(file);need(stat.isFile()&&!stat.isSymbolicLink(),'Unsafe snapshot source');
 fs.mkdirSync(directory,{recursive:true});need(!fs.lstatSync(directory).isSymbolicLink(),'Unsafe archive directory');
 const sha256=await checksum(file);
 if(fs.existsSync(destination)){need(fs.lstatSync(destination).isFile()&&!fs.lstatSync(destination).isSymbolicLink(),'Unsafe archive target');need(await checksum(destination)===sha256,'Existing archive differs; nothing overwritten');}
 else fs.copyFileSync(file,destination,fs.constants.COPYFILE_EXCL);
 need(await checksum(destination)===sha256&&await checksum(file)===sha256,'Snapshot changed or archive checksum mismatch');
 const db=new DatabaseSync(destination,{readOnly:true});try{need(db.prepare('PRAGMA integrity_check').get().integrity_check==='ok'&&!db.prepare('PRAGMA foreign_key_check').all().length,'Archive integrity failed');}finally{db.close();}
 fs.writeFileSync(destination+'.sha256',sha256+'  '+path.basename(file)+'\n');
 return {source:file,destination,sha256,bytes:stat.size,integrity:'ok'};
}
export async function archiveFirstSnapshot({directory,source,destinationDirectory}){
 const root=path.resolve(directory),file=path.resolve(source),indexFile=path.join(root,'campaign-backups.json'),backupDir=path.join(root,'backups'),archiveFile=path.join(root,'archived-snapshots.json');
 need(path.dirname(file)===backupDir&&!fs.lstatSync(backupDir).isSymbolicLink(),'Snapshot is outside the campaign backup directory');
 const index=JSON.parse(fs.readFileSync(indexFile,'utf8'));need(index[0]===path.basename(file),'Only the registered first snapshot may be archived');
 const result=await copyVerifiedSnapshot(file,destinationDirectory),archives=fs.existsSync(archiveFile)?JSON.parse(fs.readFileSync(archiveFile,'utf8')):[];
 privateWrite(archiveFile,JSON.stringify([...archives.filter(a=>a.source!==file),{...result,role:'first',at:new Date().toISOString()}],null,2)+'\n');
 privateWrite(indexFile,JSON.stringify(index.filter(name=>name!==path.basename(file)),null,2)+'\n');
 need(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Source changed before removal');fs.unlinkSync(file);
 fs.appendFileSync(path.join(root,'backup-deletions.jsonl'),JSON.stringify({at:new Date().toISOString(),file,archive:result.destination,sha256:result.sha256,bytes:result.bytes,reason:'verified_archive_to_D'})+'\n');
 return {...result,source_removed:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values:a}=parseArgs({options:{campaign:{type:'string'},source:{type:'string'},destination:{type:'string'}}});need(a.campaign&&a.source&&a.destination,'--campaign --source --destination required');console.log(JSON.stringify(await archiveFirstSnapshot({directory:a.campaign,source:a.source,destinationDirectory:a.destination})));
}
