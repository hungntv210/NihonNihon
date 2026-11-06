import { DatabaseSync } from 'node:sqlite';

export type ContentKind = 'vocab' | 'kanji' | 'grammar';
export type TranslationField = 'meaning' | 'formation' | 'notes' | 'text' | 'han_viet';
export type Translation = {
  text: string;
  sourceId: string;
  sourceName: string;
  releaseId: string;
  method: string;
  model: string | null;
  promptVersion: string | null;
  autoSelected: boolean;
};
export type Content = {
  id: string;
  kind: ContentKind;
  title: string;
  reading: string | null;
  level: string;
  english: string[];
  vietnamese: Translation | null;
  sourceName: string;
};
const tables = { vocab: 'vocab', kanji: 'kanji', grammar: 'grammar' } as const;

export function openContentDatabase(file: string) {
  const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
  db.exec('PRAGMA query_only=ON; PRAGMA foreign_keys=ON;');
  return db;
}

export function selectedTranslation(
  db: DatabaseSync,
  itemId: string,
  field: TranslationField,
): Translation | null {
  const row = db
    .prepare(
      `SELECT t.text_vi, t.source_id, t.release_id, t.method, t.context_json,
      s.name, r.manifest_json FROM vi_translations t
    JOIN content_items i ON i.item_id=t.item_id JOIN data_sources s ON s.source_id=t.source_id
    JOIN source_releases r ON r.release_id=t.release_id AND r.source_id=t.source_id
    WHERE t.item_id=? AND t.field=? AND t.status='selected' AND t.needs_refresh=0
      AND t.base_content_hash=i.source_hash AND i.is_active=1`,
    )
    .get(itemId, field);
  if (!row) return null;
  const manifest = JSON.parse(String(row.manifest_json)),
    context = JSON.parse(String(row.context_json));
  return {
    text: String(row.text_vi).normalize('NFC'),
    sourceId: String(row.source_id),
    sourceName: String(row.name),
    releaseId: String(row.release_id),
    method: String(row.method),
    model: typeof manifest.model === 'string' ? manifest.model : null,
    promptVersion: typeof manifest.prompt_version === 'string' ? manifest.prompt_version : null,
    autoSelected: context.selection_method === 'ai_fallback',
  };
}

export function listContent(db: DatabaseSync, kind: ContentKind, limit = 12): Content[] {
  if (!Object.hasOwn(tables, kind) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid content query');
  const rows = db
    .prepare(
      `SELECT c.*, s.name source_name FROM ${tables[kind]} c
    JOIN content_items i USING(item_id) JOIN data_sources s ON s.source_id=i.source_id
    WHERE i.is_active=1 ORDER BY CASE c.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END, c.item_id LIMIT ?`,
    )
    .all(limit);
  return rows.map((r) => ({
    id: String(r.item_id),
    kind,
    title: String(r.word ?? r.character ?? r.pattern),
    reading: r.reading == null ? null : String(r.reading),
    level: String(r.level),
    english: kind === 'grammar' ? [String(r.meaning_en)] : JSON.parse(String(r.meanings_en)),
    vietnamese: selectedTranslation(db, String(r.item_id), 'meaning'),
    sourceName: String(r.source_name),
  }));
}

export function contentSummary(db: DatabaseSync) {
  const counts = { vocab: 0, kanji: 0, grammar: 0, review: 0 };
  for (const kind of ['vocab', 'kanji', 'grammar'] as const)
    counts[kind] = Number(
      db.prepare('SELECT count(*) n FROM content_items WHERE kind=? AND is_active=1').get(kind)
        ?.n ?? 0,
    );
  counts.review = Number(
    db
      .prepare(
        'SELECT count(*) n FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1',
      )
      .get()?.n ?? 0,
  );
  return counts;
}

export function contentSources(db: DatabaseSync) {
  return db
    .prepare(
      `SELECT DISTINCT s.source_id id, s.name, s.url, s.license, s.attribution FROM data_sources s
    WHERE EXISTS(SELECT 1 FROM content_items i WHERE i.source_id=s.source_id AND i.is_active=1)
      OR EXISTS(SELECT 1 FROM vi_translations t WHERE t.source_id=s.source_id AND t.status='selected')
    ORDER BY s.name`,
    )
    .all()
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      url: String(r.url),
      license: String(r.license),
      attribution: String(r.attribution),
    }));
}
