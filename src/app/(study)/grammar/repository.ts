import type { DatabaseSync } from 'node:sqlite';
import { selectedTranslation, type Translation, type TranslationField } from '../../../core/content.ts';

export const pageSize = 12;
export const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type GrammarTranslation = Translation & { id: string | null };
export type GrammarSummary = { id: string; pattern: string; romaji: string; level: string; meaningEn: string; meaningVi: GrammarTranslation | null; tags: string[] };
export type Example = { id: string; japanese: string; english: string | null; furigana: string | null; vietnamese: GrammarTranslation | null; attribution: string };
export type GrammarDetail = GrammarSummary & { formationEn: string; formationVi: GrammarTranslation | null; notesEn: string | null; notesVi: GrammarTranslation | null; examples: Example[]; related: GrammarSummary[]; clips: { id: string; position: number }[] };
type Row = Record<string, unknown>;
export const fold = (s: string) => s.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').replaceAll('đ', 'd').replaceAll('Đ', 'D').toLowerCase();
const tags = (value: unknown) => { try { const v = JSON.parse(String(value)); return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []; } catch { return []; } };
export const grammarId = (id: string) => id.includes(':') ? id : `openjlpt:grammar:${id}`;
export const grammarHref = (id: string) => '/grammar/' + encodeURIComponent(id);

export function translation(db: DatabaseSync, id: string, field: TranslationField): GrammarTranslation | null {
  const value = selectedTranslation(db, id, field); if (!value) return null;
  const row = db.prepare(`SELECT t.translation_id,t.text_vi FROM vi_translations t JOIN content_items i USING(item_id)
    WHERE t.item_id=? AND t.field=? AND t.status='selected' AND t.needs_refresh=0
      AND t.base_content_hash=i.source_hash AND i.is_active=1 AND t.release_id=?`).get(id, field, value.releaseId);
  return { ...value, id: row && String(row.text_vi).normalize('NFC') === value.text ? String(row.translation_id) : null };
}
function summary(db: DatabaseSync, row: Row): GrammarSummary {
  return { id: String(row.item_id), pattern: String(row.pattern), romaji: String(row.romaji), level: String(row.level), meaningEn: String(row.meaning_en), meaningVi: translation(db, String(row.item_id), 'meaning'), tags: tags(row.tags) };
}
export function listGrammar(db: DatabaseSync, input: { q?: string; level?: string; page?: string } = {}) {
  const q = (input.q ?? '').normalize('NFC').trim().slice(0, 160), level = levels.includes(input.level as typeof levels[number]) ? input.level! : '';
  db.function('grammar_fold', { deterministic: true }, value => fold(String(value ?? '')));
  const where = `i.is_active=1 AND (?='' OR g.level=?) AND (?='' OR instr(grammar_fold(g.pattern||' '||g.romaji||' '||g.meaning_en||' '||coalesce(t.text_vi,'')),?)>0)`;
  const from = `FROM grammar g JOIN content_items i USING(item_id) LEFT JOIN vi_translations t ON t.item_id=g.item_id AND t.field='meaning' AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash`;
  const parameters = [level, level, q, fold(q)];
  const total = Number(db.prepare(`SELECT count(*) n ${from} WHERE ${where}`).get(...parameters)!.n), pages = Math.max(1, Math.ceil(total / pageSize));
  const requested = /^\d+$/.test(input.page ?? '') ? Number(input.page) : 1, page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  const rows = db.prepare(`SELECT g.* ${from} WHERE ${where} ORDER BY CASE g.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END,g.item_id LIMIT ? OFFSET ?`).all(...parameters, pageSize, (page - 1) * pageSize);
  return { q, level, page, pages, total, items: rows.map(row => summary(db, row)) };
}
export function getGrammar(db: DatabaseSync, key: string): GrammarDetail | null {
  if (!key || key.length > 256) return null;
  const row = db.prepare('SELECT g.* FROM grammar g JOIN content_items i USING(item_id) WHERE g.item_id=? AND i.is_active=1').get(grammarId(key));
  if (!row) return null;
  const base = summary(db, row), id = base.id;
  const examples = db.prepare(`SELECT s.* FROM item_sentences l JOIN sentences s ON s.item_id=l.sentence_id JOIN content_items i ON i.item_id=s.item_id WHERE l.item_id=? AND i.is_active=1 ORDER BY l.position LIMIT 50`).all(id).map(r => ({ id: String(r.item_id), japanese: String(r.text_ja), english: r.text_en == null ? null : String(r.text_en), furigana: r.furigana_notation == null ? null : String(r.furigana_notation), vietnamese: translation(db, String(r.item_id), 'text'), attribution: String(r.author_attribution) }));
  const related = db.prepare(`SELECT DISTINCT g.* FROM grammar g JOIN content_items i USING(item_id),json_each(g.tags) t WHERE g.item_id<>? AND i.is_active=1 AND t.value IN (SELECT value FROM json_each(?)) ORDER BY g.level,g.item_id LIMIT 4`).all(id, JSON.stringify(base.tags)).map(r => summary(db, r));
  const clips = db.prepare(`SELECT DISTINCT c.clip_id,c.position FROM clip_segments c JOIN item_sentences l ON l.sentence_id=c.sentence_id JOIN content_items i ON i.item_id=c.clip_id WHERE l.item_id=? AND i.is_active=1 ORDER BY c.clip_id,c.position LIMIT 12`).all(id).map(r => ({ id: String(r.clip_id), position: Number(r.position) }));
  return { ...base, formationEn: String(row.formation_en), formationVi: translation(db, id, 'formation'), notesEn: row.notes_en == null ? null : String(row.notes_en), notesVi: translation(db, id, 'notes'), examples, related, clips };
}
