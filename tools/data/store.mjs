import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync,backup } from 'node:sqlite';
import { need,now,sha } from './core.mjs';

const schema=fs.readFileSync(new URL('../../docs/data/schema.draft.sql',import.meta.url),'utf8');
const allowed=new Set(['data_sources','source_releases','import_runs','content_items','vocab','vocab_forms','kanji','grammar','sentences','item_sentences','kanji_vocab','word_furigana','kanji_components','kanji_strokes','vi_translations','media_assets','clip_segments']);
export function openDatabase(file) {
  if(file!==':memory:')fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all();
  if(!tables.length)db.exec(schema);
  else {
    need(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='source_releases'").get(),'Not a Nihon Nihon database');
    need(db.prepare('PRAGMA table_info(source_releases)').all().some(c=>c.name==='manifest_json'),'Database requires Draft 0.2 schema; automatic migration is not supported');
    need([0,2].includes(db.prepare('PRAGMA user_version').get().user_version),'Unknown database schema version');
  }
  return db;
}
function put(db,table,row,keys,ignore=false) {
  need(allowed.has(table),'Unknown import table');
  const columns=Object.keys(row),valid=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
  need(columns.every(c=>valid.has(c)) && keys.every(k=>columns.includes(k)),'Unknown/missing row columns');
  const update=columns.filter(c=>!keys.includes(c)).map(c=>`${c}=excluded.${c}`).join(',');
  db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(${keys.join(',')}) DO ${ignore || !update?'NOTHING':`UPDATE SET ${update}`}`).run(...columns.map(c=>row[c]));
}
export async function applyPlan(db,plan,{dbPath=':memory:',backupDirectory}={}) {
  let backupPath=null;
  if(dbPath!==':memory:' && db.prepare('SELECT count(*) n FROM content_items').get().n>0) {
    const dir=backupDirectory || path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});
    backupPath=path.join(dir,`before-${Date.now()}-${sha(plan.runId).slice(0,8)}.sqlite`);
    await backup(db,backupPath);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const row of plan.sources.values())put(db,'data_sources',row,['source_id']);
    for(const row of plan.releases.values())put(db,'source_releases',row,['release_id'],true);
    // Immutable releases are reused; their retrieval time is not rewritten on reruns.
    for(const row of plan.items.values()) {
      put(db,'content_items',row,['item_id']);
      db.prepare('UPDATE vi_translations SET needs_refresh=1 WHERE item_id=? AND base_content_hash<>?').run(row.item_id,row.source_hash);
    }
    for(const [table,parents,column] of [
      ['item_sentences',[...plan.rows.vocab,...plan.rows.grammar].map(r=>r.row.item_id),'item_id'],
      ['vocab_forms',plan.rows.vocab.map(r=>r.row.item_id),'item_id'],
      ['kanji_vocab',plan.rows.kanji.map(r=>r.row.item_id),'kanji_id'],
      ['clip_segments',plan.clipIds,'clip_id'],
    ])for(const id of parents)db.prepare(`DELETE FROM ${table} WHERE ${column}=?`).run(id);
    for(const [table,records]of Object.entries(plan.rows))for(const {row,keys} of records)put(db,table,row,keys);
    for(const [table,column,ids,sourceIds] of plan.replaceScopes) {
      // Scoped replacement removes outdated imported links/paths, never user progress.
      for(const id of ids)for(const sid of sourceIds)db.prepare(`DELETE FROM ${table} WHERE ${column}=? AND source_id=?`).run(id,sid);
      for(const {row,keys}of plan.supplementRows[table] || [])put(db,table,row,keys);
    }
    for(const original of plan.translations.values()) {
      const row={...original};
      const previous=db.prepare("SELECT * FROM vi_translations WHERE item_id=? AND field=? AND status='selected'").get(row.item_id,row.field);
      const same=db.prepare('SELECT * FROM vi_translations WHERE translation_id=?').get(row.translation_id);
      if(same) {
        need(same.text_vi===row.text_vi && same.base_content_hash===row.base_content_hash,'Translation ID collision');
        if(row.status!=='selected')continue;
      }
      if(row.status==='selected' && previous && previous.translation_id!==row.translation_id) {
        if(row.field!=='han_viet' && !previous.needs_refresh)row.status='candidate';
        else db.prepare("UPDATE vi_translations SET status='needs_review' WHERE translation_id=?").run(previous.translation_id);
      }
      put(db,'vi_translations',row,['translation_id'],true);
      if(same && row.status==='selected' && (!previous || previous.translation_id!==row.translation_id))
        db.prepare("UPDATE vi_translations SET status='selected',needs_refresh=0 WHERE translation_id=?").run(row.translation_id);
    }
    // Retirement must be explicitly scoped to a complete imported kind, never a small batch.
    for(const kind of plan.retireKinds) {
      const imported=new Set([...plan.items.values()].filter(r=>r.source_id==='openjlpt'&&r.kind===kind).map(r=>r.item_id));
      for(const row of db.prepare('SELECT item_id FROM content_items WHERE source_id=? AND kind=?').all('openjlpt',kind))
        if(!imported.has(row.item_id))db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(row.item_id);
    }
    need(db.prepare('PRAGMA foreign_key_check').all().length===0,'Foreign key check failed');
    for(const r of db.prepare('SELECT text_vi FROM vi_translations').all())need(r.text_vi===r.text_vi.normalize('NFC'),'Non-NFC Vietnamese text in database');
    for(const row of plan.releases.values())put(db,'import_runs',{run_id:`${plan.runId}:${row.release_id}`,source_id:row.source_id,release_id:row.release_id,started_at:plan.startedAt,finished_at:now(),status:'committed',report_json:JSON.stringify(plan.report)},['run_id']);
    db.exec('PRAGMA user_version=2; COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
  return {backupPath};
}
