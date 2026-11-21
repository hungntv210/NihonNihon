import type { DatabaseSync } from 'node:sqlite';
import { selectedTranslation, type ContentKind, type Translation } from '../../../core/content.ts';
import { detailHref, normalize, searchContent } from './repository.ts';
import type {
  LookupItem,
  LookupMatchSource,
  LookupResponse,
  SavedLookupSentence,
} from './lookup-popup-model.ts';

type SearchItem = ReturnType<typeof searchContent>['items'][number];

const KIND_PRIORITY: Record<ContentKind, number> = {
  vocab: 0,
  kanji: 1,
  grammar: 2,
};

const KANJI_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;

export function isDisallowedMeaningSource(translation: Translation | null): boolean {
  if (!translation) return false;
  return /kanjidict/i.test(translation.sourceId) || /kanjidict/i.test(translation.sourceName);
}

export function sanitizeMeaning(translation: Translation | null): Translation | null {
  return isDisallowedMeaningSource(translation) ? null : translation;
}

function extractUniqueKanji(value: string): string[] {
  const matches = value.match(KANJI_CHAR_RE);
  return matches ? [...new Set(matches)] : [];
}

function stripGrammarDecorations(pattern: string): string {
  return pattern
    .replace(/^[\u301C\uFF5E~]+/u, '')
    .replace(/[\uFF08(][^\uFF09)]*[\uFF09)]$/u, '')
    .trim();
}

function formatKanjiReading(raw: string): string {
  // repository.ts stores kanji reading as JSON_ARRAY(onyomi) || ' ' || JSON_ARRAY(kunyomi)
  const parts: string[] = [];
  const matches = raw.match(/\[[^\]]*\]/g);
  if (matches && matches.length > 0) {
    for (const chunk of matches) {
      try {
        const parsed = JSON.parse(chunk);
        if (Array.isArray(parsed)) {
          const joined = parsed
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
            .join('\u30FB');
          if (joined) parts.push(joined);
        }
      } catch {
        // ignore malformed chunk
      }
    }
    if (parts.length > 0) return parts.join(' / ');
  }
  return raw.trim();
}

function lookupKanjiHanViet(
  db: DatabaseSync,
  word: string,
): { character: string; hanViet: Translation }[] {
  const chars = extractUniqueKanji(word);
  if (!chars.length) return [];
  const stmt = db.prepare(
    `SELECT i.item_id id FROM content_items i JOIN kanji k USING(item_id) WHERE i.is_active=1 AND k.character=? LIMIT 1`,
  );
  const results: { character: string; hanViet: Translation }[] = [];
  for (const character of chars) {
    const row = stmt.get(character);
    if (!row) continue;
    const hv = selectedTranslation(db, String(row.id), 'han_viet');
    if (hv) results.push({ character, hanViet: hv });
  }
  return results;
}

function loadVocabByForm(db: DatabaseSync, form: string): SearchItem[] {
  const rows = db
    .prepare(
      `SELECT i.item_id id, v.word title, v.reading, v.level, v.meanings_en english, s.name source
       FROM vocab_forms f
       JOIN content_items i ON i.item_id=f.item_id
       JOIN vocab v ON v.item_id=f.item_id
       JOIN data_sources s ON s.source_id=i.source_id
       WHERE i.is_active=1 AND f.form=?
       ORDER BY v.level, v.word, i.item_id
       LIMIT 6`,
    )
    .all(form);
  return rows.map((r) => {
    const id = String(r.id);
    const title = String(r.title);
    return {
      id,
      kind: 'vocab' as const,
      title,
      reading: String(r.reading),
      level: String(r.level),
      english: JSON.parse(String(r.english)) as string[],
      sourceName: String(r.source),
      meaning: selectedTranslation(db, id, 'meaning'),
      hanViet: selectedTranslation(db, id, 'han_viet'),
      href: detailHref('vocab', id, title),
    };
  });
}

function sortByKind(items: SearchItem[]): SearchItem[] {
  return [...items].sort(
    (a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.level.localeCompare(b.level),
  );
}

export function lookupWord(
  db: DatabaseSync,
  rawQuery: string,
  rawBase?: string | null,
  savedSentenceLookup?: (itemId: string) => SavedLookupSentence | null,
): LookupResponse {
  const query = rawQuery.normalize('NFC').trim().slice(0, 160);
  const normalizedBase = rawBase ? rawBase.normalize('NFC').trim().slice(0, 160) : '';
  const base = normalizedBase && normalizedBase !== query ? normalizedBase : null;

  if (!query) {
    return { query: '', base: null, found: false, item: null, alternatives: [] };
  }

  const srsCheck = db.prepare('SELECT 1 FROM srs_cards WHERE item_id=? LIMIT 1');
  const decorate = (entry: SearchItem, matchedBy: LookupMatchSource): LookupItem => {
    const meaning = sanitizeMeaning(entry.meaning);
    const hanViet = entry.hanViet;
    const kanjiHanViet =
      entry.kind === 'vocab' && !hanViet ? lookupKanjiHanViet(db, entry.title) : [];
    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      reading: entry.kind === 'kanji' ? formatKanjiReading(entry.reading) : entry.reading,
      level: entry.level,
      english: entry.english,
      sourceName: entry.sourceName,
      meaning,
      hanViet,
      kanjiHanViet,
      href: entry.href,
      cardType: 'recognition',
      inSrs: Boolean(srsCheck.get(entry.id)),
      savedSentence: savedSentenceLookup?.(entry.id) ?? null,
      matchedBy,
    };
  };

  const candidates: { entry: SearchItem; matchedBy: LookupMatchSource }[] = [];
  const seenIds = new Set<string>();
  const pushAll = (entries: SearchItem[], matchedBy: LookupMatchSource) => {
    for (const entry of sortByKind(entries)) {
      if (seenIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      candidates.push({ entry, matchedBy });
    }
  };

  const searchTerms: { term: string; isLemma: boolean }[] = [
    ...(base ? [{ term: base, isLemma: true }] : []),
    { term: query, isLemma: false },
  ];

  for (const { term, isLemma } of searchTerms) {
    const termNorm = normalize(term);
    const found = searchContent(db, term, 1).items;

    // 1. Exact title match (vocab/kanji/grammar)
    const exactTitle = found.filter(
      (item) =>
        item.title === term ||
        (item.kind === 'grammar' && stripGrammarDecorations(item.title) === term),
    );
    pushAll(exactTitle, isLemma ? 'lemma' : 'exact');

    // 2. Alternate vocab writing forms (vocab_forms)
    const formMatches = loadVocabByForm(db, term);
    pushAll(formMatches, 'form');

    // 3. Exact reading match
    const exactReading = found.filter(
      (item) => item.kind !== 'kanji' && item.reading && normalize(item.reading) === termNorm,
    );
    pushAll(exactReading, 'reading');

    // 4. Broad search match when query has >= 2 chars and no exact match yet
    if (candidates.length === 0 && term.length >= 2 && found.length > 0) {
      pushAll(found.slice(0, 4), 'search');
    }
  }

  // 5. Constituent kanji fallback when a multi-kanji word is not yet in the vocabulary snapshot
  if (candidates.length === 0) {
    const kanjiChars = extractUniqueKanji(base ?? query);
    for (const ch of kanjiChars) {
      const kanjiMatches = searchContent(db, ch, 1).items.filter(
        (item) => item.kind === 'kanji' && item.title === ch,
      );
      pushAll(kanjiMatches, 'kanji_fallback');
    }
  }

  if (candidates.length === 0) {
    return { query, base, found: false, item: null, alternatives: [] };
  }

  const [primary, ...rest] = candidates;
  return {
    query,
    base,
    found: true,
    item: decorate(primary.entry, primary.matchedBy),
    alternatives: rest.slice(0, 3).map((c) => decorate(c.entry, c.matchedBy)),
  };
}
