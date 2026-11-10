import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args,need,loadArtifacts,privateWrite } from './core.mjs';
import { parseArtifacts } from './adapters.mjs';
import { buildPlan } from './plan.mjs';
import { openDatabase,applyPlan } from './store.mjs';
export {runCorrectionImport} from './owner-corrections.mjs';
export {runGlyphVariantImport} from './glyph-variant-waivers.mjs';

export async function runImport({manifestPath,dbPath,reportPath,requestsPath,requireComplete=false,backupDirectory,auditSources,takeBackup=true,beforeApply=()=>{},translationScope}) {
  need(manifestPath&&dbPath&&reportPath,'Usage: --manifest FILE --db FILE --report FILE [--requests FILE] [--require-complete]');
  requestsPath??=path.join(path.dirname(reportPath),'requests.json');
  const outputs=[dbPath,reportPath,requestsPath].map(p=>path.resolve(p));
  need(new Set(outputs).size===outputs.length&&!outputs.includes(path.resolve(manifestPath)),'Output paths must be distinct from each other and manifest');
  const loaded=await loadArtifacts(manifestPath);
  need(!loaded.artifacts.some(a=>outputs.includes(a.local)),'An output path would overwrite a source artifact');
  const data=parseArtifacts(loaded),db=openDatabase(dbPath);
  try {
    const plan=buildPlan(loaded,data,db);
    if(translationScope){
      need(Array.isArray(translationScope.itemIds)&&translationScope.itemIds.length&&Array.isArray(translationScope.fields)&&translationScope.fields.length,'Invalid translation repair scope');
      const ids=new Set(translationScope.itemIds),fields=new Set(translationScope.fields);for(const id of ids){const current=db.prepare('SELECT source_hash,is_active FROM content_items WHERE item_id=?').get(id);need(current?.is_active&&plan.items.get(id)?.source_hash===current.source_hash,'Repair source hash mismatch');}
      plan.translations=new Map([...plan.translations].filter(([,r])=>ids.has(r.item_id)&&fields.has(r.field)&&(!translationScope.onlyMissing||!db.prepare("SELECT 1 FROM vi_translations WHERE item_id=? AND field=? AND status='selected' AND needs_refresh=0 AND base_content_hash=?").get(r.item_id,r.field,r.base_content_hash))));
      for(const [id]of plan.sources){const old=db.prepare('SELECT * FROM data_sources WHERE source_id=?').get(id);if(old)plan.sources.set(id,old);}
      plan.items.clear();for(const rows of Object.values(plan.rows))rows.length=0;plan.supplementRows={};plan.replaceScopes=[];plan.retireKinds=[];plan.clipIds=[];
      plan.report.translation_repair_scope={item_count:ids.size,fields:[...fields],only_missing:!!translationScope.onlyMissing,planned_translations:plan.translations.size};
    }
    privateWrite(requestsPath,JSON.stringify({version:1,requests:plan.requests},null,2)+'\n');
    if(requireComplete&&!plan.report.data_complete) {
      privateWrite(reportPath,JSON.stringify({...plan.report,db_committed:false},null,2)+'\n');
      throw Error('Incomplete data: report/requests written, no content applied. Supply missing artifacts or MT results and rerun.');
    }
    beforeApply();const {backupPath}=await applyPlan(db,plan,{dbPath,backupDirectory,auditSources,takeBackup});
    const report={...plan.report,db_committed:true,backup_path:backupPath};
    privateWrite(reportPath,JSON.stringify(report,null,2)+'\n');
    return report;
  } finally {db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const a=args(['manifest','db','report','requests','require-complete']);
    const result=await runImport({manifestPath:a.manifest,dbPath:a.db,reportPath:a.report || 'data/reports/import.json',requestsPath:a.requests,requireComplete:a['require-complete']});
    console.log(JSON.stringify({run_id:result.run_id,counts:result.counts,data_complete:result.data_complete,han_viet:result.han_viet.status,acceptance_status:result.acceptance_status}));
  } catch(error){console.error(error.message);process.exitCode=1;}
}
