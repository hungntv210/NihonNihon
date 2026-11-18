import type {DatabaseSync} from 'node:sqlite';
import {sourceCatalog} from './catalog.ts';
import {selectedTranslation,type Translation} from '../../../core/content.ts';
import {allocateRoadmap,defaults} from '../today-roadmap/model.ts';
import {hash,type Source,type Level,requireValue} from './model.ts';
export type LearningMode='srs'|'draft_roadmap';
export type V2Source=Source&{vietnamese:Translation|null;on:string[];kun?:string[]};
export type Example={id:string;targetId:string;text:string;english:string;notation:string|null;sourceId:string;releaseId:string;attribution:string};
export type V2Context={mode:LearningMode;date:string;level:Level;catalog:V2Source[];dictionary:Source[];examples:Example[];knownKanji:string[]};
export function contextAt(content:DatabaseSync,learning:DatabaseSync,date:string,mode:LearningMode,start=defaults.startDate,level:Level='N5'):V2Context{
 const all=sourceCatalog(content),allowed=new Set<string>();
 if(mode==='srs')for(const row of learning.prepare('SELECT DISTINCT c.item_id FROM srs_cards c JOIN srs_reviews r USING(card_id) WHERE r.reviewed_at<=?').all(new Date(date+'T23:59:59.999+07:00').toISOString()))allowed.add(String(row.item_id));
 else{
  const ranks=new Map(content.prepare('SELECT item_id,frequency_rank FROM kanji').all().map(r=>[String(r.item_id),r.frequency_rank==null?null:Number(r.frequency_rank)]));
  for(const week of allocateRoadmap(all.map(s=>({...s,frequency:ranks.get(s.id)??null})),start)){
   const days=Math.floor((Date.parse(date)-Date.parse(week.date))/86400000)+1;if(days<=0)continue;
   for(const kind of ['vocab','kanji','grammar']){const items=week.items.filter(s=>s.kind===kind);for(const s of items.slice(0,Math.ceil(items.length*Math.min(7,days)/7)))allowed.add(s.id);}
  }
 }
 const catalog=all.filter(s=>allowed.has(s.id)&&s.level===level).map(s=>({...s,vietnamese:selectedTranslation(content,s.id,'meaning'),kun:s.kind==='kanji'?JSON.parse(String(content.prepare('SELECT kunyomi FROM kanji WHERE item_id=?').get(s.id)!.kunyomi)):[],on:s.kind==='kanji'?JSON.parse(String(content.prepare('SELECT onyomi FROM kanji WHERE item_id=?').get(s.id)!.onyomi)):[]}));
 const examples=content.prepare(`SELECT s.item_id id,l.item_id targetId,s.text_ja text,COALESCE(s.text_en,'') english,s.furigana_notation notation,l.source_id sourceId,l.release_id releaseId,s.author_attribution attribution FROM sentences s JOIN content_items i USING(item_id) JOIN item_sentences l ON l.sentence_id=s.item_id WHERE i.is_active=1 AND l.source_id IN ('openjlpt','tatoeba') ORDER BY l.item_id,l.position`).all().filter(r=>allowed.has(String(r.targetId))).map(r=>({id:String(r.id),targetId:String(r.targetId),text:String(r.text),english:String(r.english),notation:r.notation==null?null:String(r.notation),sourceId:String(r.sourceId),releaseId:String(r.releaseId),attribution:String(r.attribution)}));
 return {mode,date,level,catalog,dictionary:all.filter(s=>s.level===level),examples,knownKanji:[...new Set(catalog.flatMap(s=>[...s.title,...s.reading??'']).filter(ch=>/\p{Script=Han}/u.test(ch)))]};
}
const han=(s:string)=>[...s].filter(c=>/\p{Script=Han}/u.test(c));
export function safeExample(example:Example,context:V2Context):string|null{
 const known=new Set(context.knownKanji);if(han(example.text).every(c=>known.has(c)))return example.text.normalize('NFC');
 let text=example.text;
 if(example.notation&&example.notation.replace(/\{([^{}|]+)\|([^{}|]+)\}/gu,'$1')===example.text){text=example.notation.replace(/\{([^{}|]+)\|([^{}|]+)\}/gu,(_m,base,reading)=>han(base).every(c=>known.has(c))?base:reading);}
 for(const s of [...context.dictionary].filter(s=>s.kind==='vocab'&&s.reading&&/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(s.reading)).sort((a,b)=>b.title.length-a.title.length))if(han(s.title).some(c=>!known.has(c)))text=text.replaceAll(s.title,s.reading!);
 return han(text).every(c=>known.has(c))?text.normalize('NFC'):null;
}
export function exampleEvidence(q:{example?:Example;sentence?:string},context:V2Context){
 requireValue(q.example&&q.example.sourceId&&q.example.releaseId,'EXAMPLE_SOURCE_REQUIRED');
 const original=context.examples.find(e=>e.id===q.example!.id&&e.targetId===q.example!.targetId);requireValue(original&&hash(original)===hash(q.example)&&safeExample(original,context)===q.sentence,'EXAMPLE_SOURCE_CHANGED');
}
