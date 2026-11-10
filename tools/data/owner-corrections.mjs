import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {sha,need,privateWrite} from './core.mjs';
import {openDatabase,applyPlan} from './store.mjs';
import {assertDiskSpace} from './disk-space.mjs';
import {canonicalReading} from './learning-quality.mjs';
// A small, provenance-bearing import plan; never reruns unrelated content selection.
export async function runCorrectionImport({dbPath,correctionsPath,reportPath,backupDirectory}){
 const input=JSON.parse(fs.readFileSync(correctionsPath,'utf8'));need(input.reviewer==='owner'&&input.reason&&Array.isArray(input.rows)&&input.rows.length,'Owner correction metadata required');
 const db=openDatabase(dbPath),checksum=sha(input),source_id='mt:manual',release_id=source_id+':owner:'+checksum,startedAt=new Date().toISOString();
 try{
  const plan={runId:randomUUID(),startedAt,sources:new Map(),releases:new Map(),items:new Map(),rows:{vocab:[],grammar:[],kanji:[]},clipIds:[],translations:new Map(),replaceScopes:[],retireKinds:[],report:{owner_corrections:true,count:input.rows.length}};
  plan.sources.set(source_id,{source_id,name:'Owner-reviewed correction',url:'local://owner',license:'Private owner correction',attribution:'Project owner',usage_scope:'private_only'});
  plan.releases.set(release_id,{release_id,source_id,version:checksum,checksum,artifact_url:'local://owner/'+checksum,retrieved_at:startedAt,license:'Private owner correction',attribution:'Project owner',manifest_json:JSON.stringify({model:'manual',reviewer:'owner',reason:input.reason,checksum})});
  const seen=new Set();
  for(const patch of input.rows){
   need(patch.item_id&&['han_viet','meaning','formation','notes'].includes(patch.field)&&patch.text_vi?.trim()&&patch.reason&&patch.expected_translation_id,'Invalid correction');
   const key=patch.item_id+':'+patch.field;need(!seen.has(key),'Duplicate correction');seen.add(key);
   const item=db.prepare('SELECT source_hash,is_active FROM content_items WHERE item_id=?').get(patch.item_id);need(item?.is_active,'Correction item missing');
   const old=db.prepare('SELECT * FROM vi_translations WHERE translation_id=? AND item_id=? AND field=?').get(patch.expected_translation_id,patch.item_id,patch.field);need(old&&old.base_content_hash===item.source_hash,'Correction base mismatch');
   if(patch.field==='han_viet'){const candidates=JSON.parse(old.context_json).candidate_readings??[old.text_vi];need(candidates.map(canonicalReading).includes(patch.text_vi),'Correction outside candidate set');}
   const translation_id='tr:'+sha({checksum,key,text:patch.text_vi});
   plan.translations.set(translation_id,{translation_id,item_id:patch.item_id,field:patch.field,text_vi:patch.text_vi.normalize('NFC'),method:'machine',source_id,release_id,source_record_key:key,base_content_hash:item.source_hash,status:'selected',needs_refresh:0,match_method:'machine_context',created_at:startedAt,context_json:JSON.stringify({...JSON.parse(old.context_json),owner_correction:true,model:'manual',reviewer:'owner',supersedes_translation_id:old.translation_id,reason:patch.reason,...(patch.field==='han_viet'?{candidate_readings:(JSON.parse(old.context_json).candidate_readings??[old.text_vi]).map(canonicalReading),reading_aliases:{'uỷ':'ủy'},canonical_reading:patch.text_vi,selection_method:'owner_correction'}:{})})});
  }
  assertDiskSpace('import',{dbPath});const result=await applyPlan(db,plan,{dbPath,backupDirectory});
  const report={...plan.report,...result,release_id,model:'manual',reviewer:'owner',db_committed:true};privateWrite(reportPath,JSON.stringify(report,null,2));return report;
 }finally{db.close();}
}
