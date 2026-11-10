import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {sha,hash,need,privateWrite} from './core.mjs';
import {openDatabase,applyPlan} from './store.mjs';
import {assertDiskSpace} from './disk-space.mjs';
import {canonicalReading} from './learning-quality.mjs';
// A small, provenance-bearing import plan; never reruns unrelated content selection.
export async function runCorrectionImport({dbPath,correctionsPath,reportPath,backupDirectory,takeBackup=true,verifiedBackupPath}){
 const input=JSON.parse(fs.readFileSync(correctionsPath,'utf8'));need(['owner','tester'].includes(input.reviewer)&&input.reason&&Array.isArray(input.rows)&&input.rows.length,'Reviewed correction metadata required');
 const db=openDatabase(dbPath),checksum=sha(input),source_id='mt:manual',release_id=source_id+':'+input.reviewer+':'+checksum,startedAt=new Date().toISOString();
 try{
  const plan={runId:randomUUID(),startedAt,sources:new Map(),releases:new Map(),items:new Map(),rows:{vocab:[],grammar:[],kanji:[]},clipIds:[],translations:new Map(),replaceScopes:[],retireKinds:[],report:{owner_corrections:true,count:input.rows.length}};
  plan.sources.set(source_id,{source_id,name:'Reviewed correction',url:'local://owner',license:'Private owner correction',attribution:'Project owner',usage_scope:'private_only'});
  plan.releases.set(release_id,{release_id,source_id,version:checksum,checksum,artifact_url:'local://reviewed/'+checksum,retrieved_at:startedAt,license:'Private reviewed correction',attribution:input.reviewer,manifest_json:JSON.stringify({model:'manual',reviewer:input.reviewer,reason:input.reason,provenance:input.provenance??null,checksum})});
  let compoundResults,compoundConfig,compoundRelease;
  if(input.compound_profile_manifest){const manifest=JSON.parse(fs.readFileSync(input.compound_profile_manifest)),mt=manifest.mt,file=manifest.sources.find(s=>s.source_id===mt.source_id)?.files.find(f=>f.format==='mt-results');need(mt.source_id==='mt:google-gemini'&&mt.model==='gemini-3.5-flash-lite'&&file,'Invalid compound provider profile');const resultsPath=path.resolve(path.dirname(input.compound_profile_manifest),file.path);need(hash(fs.readFileSync(resultsPath))===file.sha256,'Compound result checksum mismatch');compoundResults=new Map(JSON.parse(fs.readFileSync(resultsPath)).map(row=>[row.request_id,row.output]));compoundConfig=mt;compoundRelease=mt.source_id+':config:'+sha(mt).slice(0,32);plan.releases.set(compoundRelease,{release_id:compoundRelease,source_id:mt.source_id,version:mt.model+':'+mt.prompt_version,checksum:sha(mt),artifact_url:'local://mt/'+sha(mt),retrieved_at:startedAt,license:'Google Gemini API terms',attribution:'Google Gemini',manifest_json:JSON.stringify(mt)});}
  const seen=new Set();
  for(const rawPatch of input.rows){
   const patch={...rawPatch,text_vi:typeof rawPatch.text_vi==='string'?rawPatch.text_vi.normalize('NFC').trim():rawPatch.text_vi};
   need(patch.item_id&&['han_viet','meaning','formation','notes','text'].includes(patch.field)&&patch.text_vi?.trim()&&patch.reason&&Object.hasOwn(patch,'expected_translation_id'),'Invalid correction');
   const key=patch.item_id+':'+patch.field;need(!seen.has(key),'Duplicate correction');seen.add(key);
   const item=db.prepare('SELECT source_hash,is_active FROM content_items WHERE item_id=?').get(patch.item_id);need(item?.is_active,'Correction item missing');
   const selected=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND field=? AND status='selected'").get(patch.item_id,patch.field);
   const old=patch.expected_translation_id?db.prepare('SELECT * FROM vi_translations WHERE translation_id=? AND item_id=? AND field=?').get(patch.expected_translation_id,patch.item_id,patch.field):{translation_id:null,text_vi:null,base_content_hash:patch.base_content_hash,context_json:'{}'};need(old&&old.base_content_hash===item.source_hash&&(patch.expected_translation_id||!selected||JSON.parse(selected.context_json).supersedes_translation_id===null),'Correction base mismatch');
   if(patch.field==='han_viet'){const candidates=JSON.parse(old.context_json).candidate_readings??[old.text_vi];need(candidates.map(canonicalReading).includes(patch.text_vi),'Correction outside candidate set');}
   const translation_id='tr:'+sha({checksum,key,text:patch.text_vi});
   const context={...JSON.parse(old.context_json),owner_correction:true,model:'manual',reviewer:input.reviewer,supersedes_translation_id:old.translation_id,reason:patch.reason,...(patch.field==='han_viet'?{candidate_readings:(JSON.parse(old.context_json).candidate_readings??[old.text_vi]).map(canonicalReading),reading_aliases:{'uỷ':'ủy'},canonical_reading:patch.text_vi,selection_method:'owner_correction'}:{})};
   if(patch.field==='han_viet'&&context.mt_output&&!patch.compound_request_id){const before=JSON.parse(old.context_json),index=before.candidate_readings?.findIndex(r=>canonicalReading(r)===patch.text_vi);context.prior_mt_output=before.mt_output;context.mt_output={...before.mt_output,text_vi:patch.text_vi,candidate_id:before.candidate_ids?.[index]??before.mt_output.candidate_id};context.reading_reviewer=input.reviewer;}
   if(patch.compound_request_id){const output=compoundResults?.get(patch.compound_request_id);need(output&&patch.field==='han_viet'&&patch.text_vi===old.text_vi&&canonicalReading(output.text_vi)===canonicalReading(old.text_vi)&&output.compound.word===context.mt_output?.compound.word&&output.compound.reading===context.mt_output.compound.reading,'Compound update changed reading or word');context.mt_output={...context.mt_output,meaning:output.meaning};context.evidence={...context.evidence,meaning:output.meaning};context.compound_meaning_provenance={source_id:compoundConfig.source_id,release_id:compoundRelease,model:compoundConfig.model,prompt_version:compoundConfig.prompt_version,prompt_sha256:compoundConfig.prompt_sha256,request_id:patch.compound_request_id};}
   plan.translations.set(translation_id,{translation_id,item_id:patch.item_id,field:patch.field,text_vi:patch.text_vi.normalize('NFC'),method:'machine',source_id,release_id,source_record_key:key,base_content_hash:item.source_hash,status:'selected',needs_refresh:0,match_method:'machine_context',created_at:startedAt,context_json:JSON.stringify(context)});
  }
  if(!takeBackup){need(verifiedBackupPath&&fs.existsSync(verifiedBackupPath),'A verified backup is required');const backup=new DatabaseSync(verifiedBackupPath,{readOnly:true});try{need(backup.prepare('PRAGMA quick_check').get().quick_check==='ok'&&backup.prepare("SELECT 1 FROM sqlite_schema WHERE name='source_releases'").get(),'Invalid backup');}finally{backup.close();}}
  assertDiskSpace('import',{dbPath});const result=await applyPlan(db,plan,{dbPath,backupDirectory,takeBackup});
  const report={...plan.report,...result,release_id,model:'manual',reviewer:input.reviewer,db_committed:true};privateWrite(reportPath,JSON.stringify(report,null,2));return report;
 }finally{db.close();}
}
