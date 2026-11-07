import type { DatabaseSync } from 'node:sqlite';
import { toHiragana, toRomaji } from 'wanakana';
import { selectedTranslation, type ContentKind } from '../../../core/content.ts';

export function normalize(value: string) {
  return toHiragana(value.normalize('NFC').toLowerCase(), {passRomaji:true}).normalize('NFD').replace(/[\u0300-\u036f]/gu, '').replace(/đ/gu, 'd').normalize('NFC');
}
export function detailHref(kind: ContentKind, id: string, title: string) {
  return `/${kind}/${encodeURIComponent(kind === 'kanji' ? title : id)}`;
}
const contentSql = `SELECT i.item_id id,i.kind,v.word title,v.reading,v.romaji,v.level,v.meanings_en english,s.name source FROM content_items i JOIN vocab v USING(item_id) JOIN data_sources s ON s.source_id=i.source_id WHERE i.is_active=1
 UNION ALL SELECT i.item_id,i.kind,k.character,k.onyomi||' '||k.kunyomi,'',k.level,k.meanings_en,s.name FROM content_items i JOIN kanji k USING(item_id) JOIN data_sources s ON s.source_id=i.source_id WHERE i.is_active=1
 UNION ALL SELECT i.item_id,i.kind,g.pattern,coalesce(g.reading,''),g.romaji,g.level,json_array(g.meaning_en),s.name FROM content_items i JOIN grammar g USING(item_id) JOIN data_sources s ON s.source_id=i.source_id WHERE i.is_active=1`;
export function searchContent(db: DatabaseSync, input: string, pageInput = 1) {
  const q = input.normalize('NFC').trim().slice(0,160), needle = normalize(q), page = Number.isSafeInteger(pageInput) && pageInput > 0 ? Math.min(pageInput,100000) : 1;
  // shortcut: normalized scan without schema changes; introduce an approved index when measured snapshot latency requires it.
  db.function('common_match', { deterministic:true,varargs:true }, (...values) => values.some(v => normalize(String(v ?? '')).includes(needle) || normalize(toRomaji(String(v ?? ''))).includes(needle)) ? 1 : 0);
  const sql = `WITH content AS (${contentSql}) SELECT c.* FROM content c WHERE common_match(c.title,c.reading,c.romaji,c.english)=1 OR EXISTS(SELECT 1 FROM vi_translations t JOIN content_items i ON i.item_id=t.item_id WHERE t.item_id=c.id AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash AND i.is_active=1 AND common_match(t.text_vi)=1)`;
  const total = Number(db.prepare(`SELECT count(*) n FROM (${sql})`).get()!.n);
  const items = db.prepare(`${sql} ORDER BY level,kind,title,id LIMIT ? OFFSET ?`).all(24,(page-1)*24).map(r => {
    const kind = String(r.kind) as ContentKind, id=String(r.id), title=String(r.title);
    return { id,kind,title,reading:String(r.reading),level:String(r.level),english:JSON.parse(String(r.english)) as string[],sourceName:String(r.source),meaning:selectedTranslation(db,id,'meaning'),hanViet:selectedTranslation(db,id,'han_viet'),href:detailHref(kind,id,title) };
  });
  return { q,page,total,items };
}
export function reportQueue(db: DatabaseSync) {
  return db.prepare(`SELECT t.translation_id,t.item_id,t.field,t.text_vi,t.method,t.status,t.needs_refresh,t.base_content_hash=i.source_hash current_hash,i.is_active,i.kind,coalesce(v.word,k.character,g.pattern,s.text_ja,i.source_key) title,d.name source,r.manifest_json,
    p.report_id,p.reason,p.reported_at,
    coalesce(v.word,k.character,g.pattern) detail_title
    FROM vi_translations t JOIN content_items i USING(item_id) JOIN data_sources d ON d.source_id=t.source_id JOIN source_releases r ON r.release_id=t.release_id AND r.source_id=t.source_id
    LEFT JOIN vocab v USING(item_id) LEFT JOIN kanji k USING(item_id) LEFT JOIN grammar g USING(item_id) LEFT JOIN sentences s USING(item_id)
    LEFT JOIN translation_reports p ON p.translation_id=t.translation_id AND p.status='open'
    WHERE p.report_id IS NOT NULL OR t.status='needs_review' OR t.needs_refresh=1
    ORDER BY p.reported_at DESC,t.translation_id LIMIT 300`).all().map(r => {
      const manifest=JSON.parse(String(r.manifest_json));
      return { id:String(r.report_id ?? r.translation_id),title:String(r.title),text:String(r.text_vi),field:String(r.field),method:String(r.method),source:String(r.source),model:typeof manifest.model==='string'?manifest.model:null,reason:r.reason?String(r.reason):'Bản dịch được gắn cờ trong dữ liệu',date:r.reported_at?String(r.reported_at):null,status:String(r.status),stale:!r.current_hash||Boolean(r.needs_refresh)||!r.is_active,href:r.detail_title?detailHref(String(r.kind) as ContentKind,String(r.item_id),String(r.detail_title)):null };
    });
}
export function progressData(db: DatabaseSync, timeZone: string, now = new Date()) {
  const date = (d:Date) => new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const days=Array.from({length:14},(_,i)=>({date:date(new Date(now.getTime()-(13-i)*86400000)),count:0}));
  const reviews=db.prepare('SELECT reviewed_at,rating FROM srs_reviews WHERE reviewed_at>=? AND reviewed_at<=?').all(new Date(now.getTime()-15*86400000).toISOString(),now.toISOString());
  for(const r of reviews) { const day=days.find(d=>d.date===date(new Date(String(r.reviewed_at))));if(day)day.count++; }
  const coverage=db.prepare(`SELECT i.kind,count(*) total,count(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM srs_cards c WHERE c.item_id=i.item_id) THEN i.item_id END) saved,count(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM srs_cards c JOIN srs_reviews r USING(card_id) WHERE c.item_id=i.item_id) THEN i.item_id END) reviewed FROM content_items i WHERE i.is_active=1 AND i.kind IN ('vocab','kanji','grammar') GROUP BY i.kind`).all().map(r=>({kind:String(r.kind),total:Number(r.total),saved:Number(r.saved),reviewed:Number(r.reviewed)}));
  return {days,coverage,totalReviews:Number(db.prepare('SELECT count(*) n FROM srs_reviews').get()!.n),due:Number(db.prepare('SELECT count(*) n FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1 AND c.due_at<=?').get(now.toISOString())!.n)};
}
