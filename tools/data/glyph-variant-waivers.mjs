import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {sha,stable,need,privateWrite} from './core.mjs';
import {openDatabase,applyPlan} from './store.mjs';
import {assertDiskSpace} from './disk-space.mjs';

export const GLYPH_WAIVER='glyph_variant_jouyou2010';
const approved=new Map([['僅',12],['謎',16],['遜',13],['遡',13],['餅',14],['餌',14]]);

// Original OpenJLPT payload/hash stays intact; only the displayed count is reviewed.
export function glyphStrokeOverride(db,{item_id,source_hash,character,original_strokes,paths}){
 if(!db)return null;
 const previous=db.prepare('SELECT field_sources FROM content_items WHERE item_id=?').get(item_id),context=JSON.parse(previous?.field_sources??'{}').stroke_override;
 if(!context)return null;
 need(context.waiver===GLYPH_WAIVER&&context.reviewer==='tester'&&context.base_content_hash===source_hash&&context.openjlpt_strokes===original_strokes&&approved.get(character)===original_strokes,'Stale or invalid glyph waiver');
 const release=db.prepare('SELECT checksum,manifest_json FROM source_releases WHERE release_id=? AND source_id=?').get(context.release_id,'mt:manual'),review=JSON.parse(release?.manifest_json??'{}');
 need(review.model==='manual'&&review.reviewer==='tester'&&review.waiver===GLYPH_WAIVER&&release.checksum===context.decision_sha256,'Missing glyph waiver provenance');
 paths??=db.prepare("SELECT stroke_no no,release_id FROM kanji_strokes WHERE kanji_id=? AND variant='' ORDER BY stroke_no").all(item_id);
 const numbers=paths.map(p=>p.no).sort((a,b)=>a-b);
 need(paths.length===original_strokes+1&&context.kanjivg_strokes===paths.length&&numbers.every((n,i)=>n===i+1)&&paths.every(p=>p.release_id===context.kanjivg_release_id),'Glyph waiver no longer matches KanjiVG paths');
 const vg=db.prepare('SELECT checksum FROM source_releases WHERE source_id=? AND release_id=?').get('kanjivg',context.kanjivg_release_id);need(vg?.checksum===context.kanjivg_sha256,'KanjiVG waiver checksum changed');
 return context;
}

export async function runGlyphVariantImport({dbPath,correctionsPath,reportPath,backupDirectory}){
 const input=JSON.parse(fs.readFileSync(correctionsPath,'utf8'));need(input.reviewer==='tester'&&input.waiver===GLYPH_WAIVER&&input.reason&&input.provenance&&Array.isArray(input.rows)&&input.rows.length,'Tester glyph waiver metadata required');
 const db=openDatabase(dbPath),checksum=sha(input),release_id='mt:manual:glyph:'+checksum,startedAt=new Date().toISOString(),seen=new Set();
 try{
  const source=db.prepare("SELECT * FROM data_sources WHERE source_id='mt:manual'").get()??{source_id:'mt:manual',name:'Reviewed correction',url:'local://tester',license:'Private reviewed correction',attribution:'Tester',usage_scope:'private_only'};
  const release={release_id,source_id:'mt:manual',version:checksum,checksum,artifact_url:'local://reviewed/'+checksum,retrieved_at:startedAt,license:'Private reviewed correction',attribution:'tester',manifest_json:stable({model:'manual',reviewer:'tester',waiver:GLYPH_WAIVER,reason:input.reason,provenance:input.provenance,checksum})};
  const plan={runId:randomUUID(),startedAt,sources:new Map([['mt:manual',source]]),releases:new Map([[release_id,release]]),items:new Map(),rows:{vocab:[],grammar:[],kanji:[]},clipIds:[],translations:new Map(),replaceScopes:[],retireKinds:[],glyphOverrides:[],report:{glyph_waiver:GLYPH_WAIVER,reviewer:'tester',count:input.rows.length}};
  for(const row of input.rows){need(!seen.has(row.item_id),'Duplicate glyph waiver');seen.add(row.item_id);
   const item=db.prepare("SELECT i.*,k.character,k.strokes FROM content_items i JOIN kanji k USING(item_id) WHERE item_id=? AND is_active=1").get(row.item_id);need(item&&approved.get(item.character)===row.openjlpt_strokes&&item.source_hash===row.base_content_hash,'Glyph waiver source mismatch');
   const paths=db.prepare("SELECT stroke_no,release_id FROM kanji_strokes WHERE kanji_id=? AND variant='' ORDER BY stroke_no").all(row.item_id),count=paths.length;need(count===row.openjlpt_strokes+1&&row.kanjivg_strokes===count&&paths.every((p,i)=>p.stroke_no===i+1&&p.release_id===row.kanjivg_release_id),'Glyph waiver path mismatch');
   const vg=db.prepare("SELECT checksum FROM source_releases WHERE source_id='kanjivg' AND release_id=?").get(row.kanjivg_release_id);need(vg?.checksum===row.kanjivg_sha256,'Glyph waiver artifact mismatch');
   const fields=JSON.parse(item.field_sources),old=fields.stroke_override;need(item.strokes===row.openjlpt_strokes||(item.strokes===count&&old?.release_id===release_id),'Glyph count changed since review');
   const context={waiver:GLYPH_WAIVER,reviewer:'tester',model:'manual',source_id:'mt:manual',release_id,decision_sha256:checksum,base_content_hash:item.source_hash,openjlpt_strokes:row.openjlpt_strokes,kanjivg_strokes:count,kanjivg_release_id:row.kanjivg_release_id,kanjivg_sha256:vg.checksum,reason:input.reason};
   plan.glyphOverrides.push({item_id:row.item_id,base_content_hash:item.source_hash,expected_strokes:item.strokes,expected_field_sources:item.field_sources,strokes:count,field_sources:stable({...fields,stroke_override:context})});
  }
  assertDiskSpace('snapshot',{dbPath});assertDiskSpace('import',{dbPath});const result=await applyPlan(db,plan,{dbPath,backupDirectory});
  const report={...plan.report,...result,release_id,db_committed:true};privateWrite(reportPath,JSON.stringify(report,null,2)+'\n');return report;
 }finally{db.close();}
}
