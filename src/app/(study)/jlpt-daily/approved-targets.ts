import {DatabaseSync} from 'node:sqlite';import {requireValue} from './model.ts';
// Append pinned public OpenJLPT rows only; never overwrite content or learner state.
export function copyApprovedTargets(snapshot:DatabaseSync,file:string,ids:string[]){
 const app=new DatabaseSync(file,{timeout:5000});let inserted=0;
 const copy=(table:string,key:string,value:string)=>{
  const row=snapshot.prepare(`SELECT * FROM "${table}" WHERE "${key}"=?`).get(value);requireValue(row,'MISSING_PINNED_SOURCE');
  const old=app.prepare(`SELECT * FROM "${table}" WHERE "${key}"=?`).get(value);if(old){if(table==='source_releases')requireValue(old.source_id===row.source_id&&old.checksum===row.checksum,'RELEASE_CONFLICT');return;}
  const cols=app.prepare(`PRAGMA table_info("${table}")`).all().map(r=>String(r.name));requireValue(cols.every(c=>Object.hasOwn(row,c)),'SOURCE_SCHEMA_MISMATCH');
  app.prepare(`INSERT INTO "${table}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c]));
 };
 try{app.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');for(const id of new Set(ids)){
  const row=snapshot.prepare('SELECT * FROM content_items WHERE item_id=?').get(id);requireValue(row?.source_id==='openjlpt'&&['vocab','grammar'].includes(String(row.kind)),'PUBLIC_TARGET_REQUIRED');
  const old=app.prepare('SELECT source_hash FROM content_items WHERE item_id=?').get(id);if(old){requireValue(old.source_hash===row.source_hash,'SOURCE_CHANGED');continue;}
  copy('data_sources','source_id',String(row.source_id));copy('source_releases','release_id',String(row.release_id));copy('content_items','item_id',id);copy(String(row.kind),'item_id',id);inserted++;
 }requireValue(!app.prepare('PRAGMA foreign_key_check').all().length,'TARGET_IMPORT_FOREIGN_KEYS');app.exec('COMMIT');return inserted;
 }catch(e){try{app.exec('ROLLBACK');}catch{}throw e;}finally{app.close();}
}
