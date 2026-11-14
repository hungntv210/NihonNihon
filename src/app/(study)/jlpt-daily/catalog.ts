import type { DatabaseSync } from 'node:sqlite';
import { allocateRoadmap,todayPlan,type Progress } from '../today-roadmap/model.ts';
import type { StudyPreferences } from '../../../core/preferences.ts';
import type { Source,Level } from './model.ts';
export function learnerLevel(preferences:StudyPreferences,progress:Progress,now:Date):Level{
 const plan=todayPlan(progress,preferences,now,0);return allocateRoadmap([],preferences.startDate)[plan.week-1].level as Level;
}
export function sourceCatalog(db:DatabaseSync):Source[]{
 const rows=db.prepare(`SELECT i.item_id id,i.kind,i.source_hash hash,v.level,v.word title,v.reading,v.meanings_en english,v.pos FROM content_items i JOIN vocab v USING(item_id) WHERE i.is_active=1 AND i.source_id='openjlpt'
 UNION ALL SELECT i.item_id,i.kind,i.source_hash,k.level,k.character,COALESCE(json_extract(k.onyomi,'$[0]'),json_extract(k.kunyomi,'$[0]')),k.meanings_en,'[]' FROM content_items i JOIN kanji k USING(item_id) WHERE i.is_active=1 AND i.source_id='openjlpt'
 UNION ALL SELECT i.item_id,i.kind,i.source_hash,g.level,g.pattern,g.reading,json_array(g.meaning_en),'[]' FROM content_items i JOIN grammar g USING(item_id) WHERE i.is_active=1 AND i.source_id='openjlpt'`).all();
 return rows.map(r=>({id:String(r.id),kind:r.kind as Source['kind'],level:r.level as Level,title:String(r.title),reading:r.reading==null?null:String(r.reading),english:JSON.parse(String(r.english)),pos:JSON.parse(String(r.pos)),hash:String(r.hash)}));
}
export function learnedCatalog(db:DatabaseSync):Source[]{const learned=new Set(db.prepare('SELECT DISTINCT c.item_id FROM srs_cards c JOIN srs_reviews r USING(card_id)').all().map(r=>String(r.item_id)));return sourceCatalog(db).filter(r=>learned.has(r.id));}
