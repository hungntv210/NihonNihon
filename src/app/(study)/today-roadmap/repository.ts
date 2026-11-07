import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { databasePath } from '../../../core/config.ts';
import { emptyProgress, validDate, tasks, type Progress, type CatalogItem } from './model.ts';
export function roadmapPath() { return path.resolve(process.env.NIHON_ROADMAP_PATH || path.join(path.dirname(databasePath()), 'private', 'today-roadmap.json')); }
export function validateProgress(value: unknown): Progress {
  const p = value as Progress;
  if (!p || p.version !== 1 || !Array.isArray(p.activity) || !Array.isArray(p.shortDays) || !Array.isArray(p.shadow) || p.activity.length > 10000 || p.shadow.length > 10000 || p.shortDays.length > 10000 || !p.activity.every(validDate) || !p.shortDays.every(validDate) || (p.activeTask !== null && !(typeof p.activeTask === 'string' && Object.hasOwn(tasks, p.activeTask)))) throw Error('INVALID_PROGRESS');
  for (const s of p.shadow) if (!s || !validDate(s.date) || !['regular', 'makeup'].includes(s.kind) || s.method !== 'manual' || !Number.isInteger(s.minutes) || s.minutes < (s.kind === 'makeup' ? 25 : 15) || s.minutes > 180 || !Array.isArray(s.clips) || s.clips.length < (s.kind === 'makeup' ? 2 : 1) || s.clips.length > 2 || !s.clips.every(c => typeof c === 'string' && c.trim().length >= 1 && c.length <= 256) || new Set(s.clips).size !== s.clips.length) throw Error('INVALID_PROGRESS');
  return p;
}
export function readProgress(file = roadmapPath()): Progress {
  try { if (fs.statSync(file).size > 2_000_000) throw Error('INVALID_PROGRESS');return validateProgress(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyProgress();throw error; }
}
// Synchronous read-modify-write avoids lost updates within the single Node server.
export function updateProgress(file: string, change: (progress: Progress) => Progress) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = file + '.lock';let descriptor: number;
  try { descriptor = fs.openSync(lock, 'wx', 0o600); } catch { throw Error('PROGRESS_BUSY'); }
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    const next = validateProgress(change(readProgress(file)));
    fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
    return next;
  } finally { fs.closeSync(descriptor);fs.unlinkSync(lock);if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
export function roadmapData(db: DatabaseSync, now = new Date()) {
  const due = Number(db.prepare(`SELECT count(*) n FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1 AND i.kind IN ('vocab','kanji') AND c.card_type='recognition' AND c.due_at<=?`).get(now.toISOString())!.n);
  const items = db.prepare(`SELECT i.item_id id,i.kind,v.level,v.word title,NULL frequency FROM content_items i JOIN vocab v USING(item_id) WHERE i.is_active=1 AND i.source_id='openjlpt'
    UNION ALL SELECT i.item_id,i.kind,k.level,k.character,k.frequency_rank FROM content_items i JOIN kanji k USING(item_id) WHERE i.is_active=1 AND i.source_id='openjlpt'
    UNION ALL SELECT i.item_id,i.kind,g.level,g.pattern,NULL FROM content_items i JOIN grammar g USING(item_id) WHERE i.is_active=1 AND i.source_id='openjlpt'`).all() as unknown as CatalogItem[];
  const clips = db.prepare("SELECT item_id id,source_key title FROM content_items WHERE kind='clip' AND is_active=1 ORDER BY item_id LIMIT 20").all().map(r => ({ id: String(r.id), title: String(r.title) }));
  const saved = db.prepare(`SELECT DISTINCT i.item_id id FROM content_items i JOIN srs_cards c USING(item_id) WHERE i.is_active=1`).all().map(r => String(r.id));
  return { due, items: items.map(item => ({ ...item })), clips, saved };
}

