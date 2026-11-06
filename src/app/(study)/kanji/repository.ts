import type { DatabaseSync } from 'node:sqlite';
import { selectedTranslation, type Translation } from '../../../core/content.ts';

export type KanjiFilters = {
  q: string;
  level: string;
  strokes: number | null;
  radicals: string[];
  page: number;
};
export type KanjiSummary = {
  id: string;
  character: string;
  level: string;
  strokes: number | null;
  radical: string | null;
  onyomi: string[];
  kunyomi: string[];
  english: string[];
  meaning: Translation | null;
  hanViet: Translation | null;
  alternatives: string[];
};
export type KanjiDetail = KanjiSummary & {
  grade: number | null;
  frequency: number | null;
  nanori: string[];
  components: string[];
  meaningId: string | null;
  hanVietId: string | null;
  related: {
    id: string;
    word: string;
    reading: string;
    level: string;
    english: string[];
    meaning: Translation | null;
    studied: boolean;
  }[];
  strokePaths: { number: number; path: string }[];
  strokeSource: { name: string; license: string; url: string } | null;
};
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const strings = (value: unknown): string[] => {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
};
export function foldSearch(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[à-ỹ]/gu, (c) => c.normalize('NFD').replace(/\p{M}/gu, ''))
    .replace(/đ/g, 'd')
    .replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
export function parseFilters(params: Record<string, string | string[] | undefined>): KanjiFilters {
  const first = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
  };
  const rawRadicals = params.radical,
    radicals = [
      ...new Set(
        (Array.isArray(rawRadicals) ? rawRadicals : rawRadicals ? [rawRadicals] : []).filter(
          (v) => [...v].length === 1,
        ),
      ),
    ].slice(0, 8);
  const strokeText = first('strokes'),
    strokes =
      /^\d{1,2}$/.test(strokeText) && Number(strokeText) > 0 && Number(strokeText) <= 64
        ? Number(strokeText)
        : null;
  return {
    q: first('q').normalize('NFC').trim().slice(0, 80),
    level: levels.includes(first('level')) ? first('level') : '',
    strokes,
    radicals,
    page: /^\d{1,6}$/.test(first('page')) ? Math.max(1, Math.min(99999, Number(first('page')))) : 1,
  };
}
export function filterUrl(filters: KanjiFilters, changes: Partial<KanjiFilters> = {}) {
  const value = { ...filters, ...changes },
    params = new URLSearchParams();
  if (value.q) params.set('q', value.q);
  if (value.level) params.set('level', value.level);
  if (value.strokes) params.set('strokes', String(value.strokes));
  for (const radical of value.radicals) params.append('radical', radical);
  if (value.page > 1) params.set('page', String(value.page));
  return '/kanji' + (params.size ? '?' + params.toString() : '');
}
function mapKanji(db: DatabaseSync, row: Record<string, unknown>): KanjiSummary {
  const id = String(row.item_id),
    hanViet = selectedTranslation(db, id, 'han_viet');
  const alternatives = db
    .prepare(
      `SELECT DISTINCT t.text_vi FROM vi_translations t JOIN content_items i USING(item_id)
    WHERE t.item_id=? AND t.field='han_viet' AND t.status IN ('selected','candidate') AND t.needs_refresh=0
      AND t.base_content_hash=i.source_hash AND i.is_active=1 ORDER BY t.text_vi`,
    )
    .all(id)
    .map((r) => String(r.text_vi).normalize('NFC'))
    .filter((v) => v.toLocaleLowerCase('vi') !== hanViet?.text.toLocaleLowerCase('vi'));
  return {
    id,
    character: String(row.character),
    level: String(row.level),
    strokes: row.strokes == null ? null : Number(row.strokes),
    radical: row.radical == null ? null : String(row.radical),
    onyomi: strings(row.onyomi),
    kunyomi: strings(row.kunyomi),
    english: strings(row.meanings_en),
    meaning: selectedTranslation(db, id, 'meaning'),
    hanViet,
    alternatives,
  };
}
export function searchKanji(db: DatabaseSync, filters: KanjiFilters, pageSize = 18) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw Error('Invalid page size');
  db.function('kanji_fold', { deterministic: true }, (value) => foldSearch(String(value ?? '')));
  const where = ['i.is_active=1'],
    args: (string | number)[] = [];
  if (filters.level) {
    where.push('k.level=?');
    args.push(filters.level);
  }
  if (filters.strokes) {
    where.push('k.strokes=?');
    args.push(filters.strokes);
  }
  for (const radical of filters.radicals) {
    where.push(
      '(k.radical=? OR EXISTS(SELECT 1 FROM kanji_components kc WHERE kc.kanji_id=k.item_id AND kc.component=?))',
    );
    args.push(radical, radical);
  }
  for (const term of filters.q.split(/\s+/u).filter(Boolean).slice(0, 8)) {
    const like = '%' + foldSearch(term).replace(/[\\%_]/g, '\\$&') + '%';
    where.push(`(kanji_fold(k.character||' '||coalesce(k.radical,'')||' '||k.onyomi||' '||k.kunyomi||' '||k.meanings_en) LIKE ? ESCAPE '\\'
      OR EXISTS(SELECT 1 FROM vi_translations t WHERE t.item_id=k.item_id AND t.field IN ('meaning','han_viet')
        AND (t.status='selected' OR (t.field='han_viet' AND t.status='candidate')) AND t.needs_refresh=0
        AND t.base_content_hash=i.source_hash AND kanji_fold(t.text_vi) LIKE ? ESCAPE '\\'))`);
    args.push(like, like);
  }
  const from = 'FROM kanji k JOIN content_items i USING(item_id) WHERE ' + where.join(' AND ');
  const total = Number(db.prepare('SELECT count(*) total ' + from).get(...args)?.total ?? 0),
    pages = Math.max(1, Math.ceil(total / pageSize)),
    page = Math.min(filters.page, pages);
  const rows = db
    .prepare(
      'SELECT k.* ' +
        from +
        ` ORDER BY CASE k.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END,coalesce(k.frequency_rank,999999),k.character LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, (page - 1) * pageSize);
  const radicals = db
    .prepare(
      `SELECT DISTINCT component FROM (SELECT k.radical component FROM kanji k JOIN content_items i USING(item_id) WHERE i.is_active=1
    UNION SELECT kc.component FROM kanji_components kc JOIN content_items i ON i.item_id=kc.kanji_id WHERE i.is_active=1) WHERE component IS NOT NULL AND component<>'' ORDER BY component`,
    )
    .all()
    .map((r) => String(r.component));
  return { items: rows.map((row) => mapKanji(db, row)), total, page, pages, radicals };
}
function translationId(db: DatabaseSync, id: string, field: string): string | null {
  const row = db
    .prepare(
      `SELECT t.translation_id FROM vi_translations t JOIN content_items i USING(item_id) WHERE t.item_id=? AND t.field=?
    AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash AND i.is_active=1`,
    )
    .get(id, field);
  return row ? String(row.translation_id) : null;
}
export function kanjiDetail(db: DatabaseSync, character: string): KanjiDetail | null {
  try { character = decodeURIComponent(character).normalize('NFC'); } catch { return null; }
  if ([...character].length !== 1) return null;
  const row = db
    .prepare(
      'SELECT k.* FROM kanji k JOIN content_items i USING(item_id) WHERE k.character=? AND i.is_active=1',
    )
    .get(character.normalize('NFC'));
  if (!row) return null;
  const item = mapKanji(db, row),
    id = item.id;
  const related = db
    .prepare(
      `SELECT DISTINCT v.*,EXISTS(SELECT 1 FROM srs_cards sc WHERE sc.item_id=v.item_id) studied FROM vocab v JOIN content_items i USING(item_id)
    WHERE i.is_active=1 AND (EXISTS(SELECT 1 FROM kanji_vocab kv WHERE kv.kanji_id=? AND kv.vocab_id=v.item_id) OR instr(v.word,?)>0)
    ORDER BY studied DESC,(v.level=?) DESC,CASE v.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END,v.word LIMIT 8`,
    )
    .all(id, character, item.level)
    .map((v) => ({
      id: String(v.item_id),
      word: String(v.word),
      reading: String(v.reading),
      level: String(v.level),
      english: strings(v.meanings_en),
      meaning: selectedTranslation(db, String(v.item_id), 'meaning'),
      studied: Boolean(v.studied),
    }));
  const variant = db
    .prepare(
      "SELECT variant FROM kanji_strokes WHERE kanji_id=? ORDER BY (variant='') DESC,variant LIMIT 1",
    )
    .get(id)?.variant;
  const strokes =
    variant == null
      ? []
      : db
          .prepare(
            'SELECT stroke_no,path_d FROM kanji_strokes WHERE kanji_id=? AND variant=? ORDER BY stroke_no',
          )
          .all(id, variant);
  const source =
    variant == null
      ? null
      : db
          .prepare(
            `SELECT s.name,s.url,r.license FROM kanji_strokes k JOIN data_sources s USING(source_id)
    JOIN source_releases r ON r.release_id=k.release_id AND r.source_id=k.source_id WHERE k.kanji_id=? AND k.variant=? ORDER BY k.stroke_no LIMIT 1`,
          )
          .get(id, variant);
  return {
    ...item,
    grade: row.grade == null ? null : Number(row.grade),
    frequency: row.frequency_rank == null ? null : Number(row.frequency_rank),
    nanori: strings(row.nanori),
    components: db
      .prepare(
        'SELECT DISTINCT component FROM kanji_components WHERE kanji_id=? ORDER BY component',
      )
      .all(id)
      .map((r) => String(r.component)),
    meaningId: translationId(db, id, 'meaning'),
    hanVietId: translationId(db, id, 'han_viet'),
    related,
    strokePaths: strokes.map((s) => ({ number: Number(s.stroke_no), path: String(s.path_d) })),
    strokeSource: source
      ? { name: String(source.name), url: String(source.url), license: String(source.license) }
      : null,
  };
}
