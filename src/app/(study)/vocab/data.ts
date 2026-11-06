import type { DatabaseSync } from 'node:sqlite';
import { selectedTranslation, type Translation } from '../../../core/content.ts';

export type Vocabulary = {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  level: string;
  english: string[];
  pos: string[];
  meaning: Translation | null;
  meaningId: string | null;
  hanViet: Translation | null;
  hanVietId: string | null;
  sourceName: string;
  queued: boolean;
  otherReadings: { id: string; reading: string }[];
};
export type Search = { q: string; level: string; saved: boolean; page: number };
export type Example = {
  id: string;
  japanese: string;
  english: string | null;
  furigana: string | null;
  translation: Translation | null;
  translationId: string | null;
};
export type Segment = { text: string; reading?: string };
export type VocabularyDetail = Vocabulary & {
  examples: Example[];
  kanji: { id: string; character: string }[];
  segments: Segment[];
};
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const PAGE_SIZE = 12;

export function normalizeSearch(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/gu, 'd')
    .normalize('NFC')
    .replace(/[ァ-ヶ]/gu, (c) => String.fromCodePoint(c.charCodeAt(0) - 0x60));
}
export function searchParams(input: Record<string, string | string[] | undefined>): Search {
  const one = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '');
  const page = Number(one('page'));
  return {
    q: one('q').normalize('NFC').trim().slice(0, 100),
    level: levels.includes(one('level')) ? one('level') : '',
    saved: one('saved') === '1',
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1,
  };
}
export function vocabularyUrl(search: Search, page = search.page) {
  const params = new URLSearchParams();
  if (search.q) params.set('q', search.q);
  if (search.level) params.set('level', search.level);
  if (search.saved) params.set('saved', '1');
  if (page > 1) params.set('page', String(page));
  return '/vocab' + (params.size ? '?' + params : '');
}
function translation(db: DatabaseSync, itemId: string, field: 'meaning' | 'han_viet' | 'text') {
  const value = selectedTranslation(db, itemId, field);
  const row = value
    ? db
        .prepare(
          `SELECT t.translation_id FROM vi_translations t JOIN content_items i USING(item_id)
    WHERE t.item_id=? AND t.field=? AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash
      AND i.is_active=1 AND t.source_id=? AND t.release_id=? AND t.text_vi=?`,
        )
        .get(itemId, field, value.sourceId, value.releaseId, value.text)
    : null;
  return { value, id: row ? String(row.translation_id) : null };
}
function vocabulary(db: DatabaseSync, r: Record<string, unknown>): Vocabulary {
  const id = String(r.item_id),
    meaning = translation(db, id, 'meaning'),
    hv = translation(db, id, 'han_viet');
  const hvContext = hv.id
    ? JSON.parse(
        String(
          db.prepare('SELECT context_json FROM vi_translations WHERE translation_id=?').get(hv.id)!
            .context_json,
        ),
      )
    : null;
  const allOn =
    hvContext?.all_on === true && hvContext.word === r.word && hvContext.reading === r.reading;
  return {
    id,
    word: String(r.word),
    reading: String(r.reading),
    romaji: String(r.romaji),
    level: String(r.level),
    english: JSON.parse(String(r.meanings_en)),
    pos: JSON.parse(String(r.pos)),
    meaning: meaning.value,
    meaningId: meaning.id,
    hanViet: allOn ? hv.value : null,
    hanVietId: allOn ? hv.id : null,
    sourceName: String(r.source_name),
    queued: Boolean(r.queued),
    otherReadings: db
      .prepare(
        `SELECT v.item_id,v.reading FROM vocab v JOIN content_items i USING(item_id) WHERE v.word=? AND v.reading<>? AND i.is_active=1 ORDER BY v.reading,v.item_id`,
      )
      .all(String(r.word), String(r.reading))
      .map((v) => ({ id: String(v.item_id), reading: String(v.reading) })),
  };
}
const select = `SELECT v.*,s.name source_name,EXISTS(SELECT 1 FROM srs_cards c WHERE c.item_id=v.item_id) queued
  FROM vocab v JOIN content_items i USING(item_id) JOIN data_sources s ON s.source_id=i.source_id`;

export function findVocabulary(db: DatabaseSync, search: Search) {
  db.function('nihon_vocab_search', { deterministic: true }, (value) =>
    normalizeSearch(String(value ?? '')),
  );
  const clauses = ['i.is_active=1'],
    args: (string | number)[] = [];
  if (search.level) {
    clauses.push('v.level=?');
    args.push(search.level);
  }
  if (search.saved) clauses.push('EXISTS(SELECT 1 FROM srs_cards c WHERE c.item_id=v.item_id)');
  if (search.q) {
    clauses.push(
      `instr(nihon_vocab_search(v.word||' '||v.reading||' '||v.romaji||' '||v.meanings_en||' '||coalesce((SELECT t.text_vi FROM vi_translations t WHERE t.item_id=v.item_id AND t.field='meaning' AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash),'')),?)>0`,
    );
    args.push(normalizeSearch(search.q));
  }
  const where = ' WHERE ' + clauses.join(' AND '),
    total = Number(
      db
        .prepare('SELECT count(*) n FROM vocab v JOIN content_items i USING(item_id)' + where)
        .get(...args)!.n,
    ),
    pages = Math.max(1, Math.ceil(total / PAGE_SIZE)),
    page = Math.min(search.page, pages);
  const rows = db
    .prepare(
      select +
        where +
        ` ORDER BY CASE v.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END,v.item_id LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return {
    items: rows.map((r) => vocabulary(db, r)),
    total,
    pages,
    page,
    search: { ...search, page },
  };
}

export function newVocabulary(db: DatabaseSync) {
  return db
    .prepare(
      select +
        ` WHERE i.is_active=1 AND NOT EXISTS(SELECT 1 FROM srs_cards c WHERE c.item_id=v.item_id) ORDER BY CASE v.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END,v.item_id LIMIT 5`,
    )
    .all()
    .map((r) => vocabulary(db, r));
}

export function parseFurigana(notation: string | null, japanese: string): Segment[] {
  if (!notation) return [{ text: japanese }];
  const segments: Segment[] = [];
  let end = 0;
  for (const match of notation.matchAll(/\{([^{}|]+)\|([^{}|]+)\}/gu)) {
    if (match.index! > end) segments.push({ text: notation.slice(end, match.index) });
    segments.push({ text: match[1], reading: match[2] });
    end = match.index! + match[0].length;
  }
  if (end < notation.length) segments.push({ text: notation.slice(end) });
  return segments.length && segments.map((s) => s.text).join('') === japanese
    ? segments
    : [{ text: japanese }];
}
export function wordSegments(raw: string | null, word: string, reading: string): Segment[] {
  if (raw) {
    try {
      const values = JSON.parse(raw);
      if (Array.isArray(values)) {
        const result = values.map((v) =>
          typeof v === 'string'
            ? { text: v }
            : v && typeof v.ruby === 'string' && typeof v.rt === 'string'
              ? { text: v.ruby, reading: v.rt }
              : null,
        );
        if (result.every(Boolean) && result.map((v) => v!.text).join('') === word)
          return result as Segment[];
      }
    } catch {}
  }
  return [
    { text: word, ...(word !== reading && /[\p{Script=Han}]/u.test(word) ? { reading } : {}) },
  ];
}
export function vocabularyDetail(db: DatabaseSync, id: string): VocabularyDetail | null {
  if (!id || id.length > 256) return null;
  const row = db.prepare(select + ' WHERE v.item_id=? AND i.is_active=1').get(id);
  if (!row) return null;
  const item = vocabulary(db, row),
    furigana = db
      .prepare(
        'SELECT segments FROM word_furigana WHERE word=? AND reading=? ORDER BY source_id LIMIT 1',
      )
      .get(item.word, item.reading);
  const examples = db
    .prepare(
      `SELECT s.* FROM item_sentences x JOIN sentences s ON s.item_id=x.sentence_id JOIN content_items i ON i.item_id=s.item_id WHERE x.item_id=? AND i.is_active=1 ORDER BY x.position LIMIT 4`,
    )
    .all(id)
    .map((r) => {
      const vi = translation(db, String(r.item_id), 'text');
      return {
        id: String(r.item_id),
        japanese: String(r.text_ja),
        english: r.text_en == null ? null : String(r.text_en),
        furigana: r.furigana_notation == null ? null : String(r.furigana_notation),
        translation: vi.value,
        translationId: vi.id,
      };
    });
  const kanji = [...new Set([...item.word].filter((c) => /\p{Script=Han}/u.test(c)))].flatMap(
    (character) => {
      const r = db
        .prepare(
          'SELECT k.item_id FROM kanji k JOIN content_items i USING(item_id) WHERE k.character=? AND i.is_active=1',
        )
        .get(character);
      return r ? [{ id: String(r.item_id), character }] : [];
    },
  );
  return {
    ...item,
    examples,
    kanji,
    segments: wordSegments(furigana ? String(furigana.segments) : null, item.word, item.reading),
  };
}
