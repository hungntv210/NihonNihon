import type { DatabaseSync } from 'node:sqlite';
import type { Translation } from '../../../../../core/content.ts';
import { kanjiDetail, type KanjiDetail } from '../../../kanji/repository.ts';

export const MAX_KANJI_LESSON_ITEMS = 5;
export const MAX_KANJI_LESSON_WORDS = 3;

export type KanjiLessonWord = KanjiDetail['related'][number];

export type LessonKanji = {
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
  words: KanjiLessonWord[];
};

export function isKanjiDictVn(translation: Translation | null): boolean {
  if (!translation) return false;
  return /kanjidictvn/i.test(translation.sourceId) || /kanjidictvn/i.test(translation.sourceName);
}

export function safeKanjiMeaning(meaning: Translation | null): Translation | null {
  return isKanjiDictVn(meaning) ? null : meaning;
}

export function selectKanjiLessonWords(
  related: readonly KanjiLessonWord[],
  kanjiLevel: string,
  character: string,
  limit = MAX_KANJI_LESSON_WORDS,
): KanjiLessonWord[] {
  const max = Math.max(0, Math.floor(limit));
  if (max === 0) return [];
  const seen = new Set<string>();
  const valid: KanjiLessonWord[] = [];
  for (const word of related) {
    if (!word.word.trim() || seen.has(word.id)) continue;
    if (character && !word.word.includes(character)) continue;
    seen.add(word.id);
    valid.push(word);
  }
  const sameLevel = valid.filter((word) => word.level === kanjiLevel);
  const otherLevel = valid.filter((word) => word.level !== kanjiLevel);
  return [...sameLevel, ...otherLevel].slice(0, max);
}

export function newLessonKanji(
  db: DatabaseSync,
  limit = MAX_KANJI_LESSON_ITEMS,
): LessonKanji[] {
  const max = Math.max(0, Math.min(20, Math.floor(limit)));
  if (max === 0) return [];
  const rows = db
    .prepare(
      `SELECT k.character FROM kanji k JOIN content_items i USING(item_id)
       WHERE i.is_active=1 AND NOT EXISTS(SELECT 1 FROM srs_cards c WHERE c.item_id=k.item_id)
       ORDER BY CASE k.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 WHEN 'N2' THEN 3 ELSE 4 END,
                coalesce(k.frequency_rank,999999), k.character
       LIMIT ?`,
    )
    .all(max);
  const items: LessonKanji[] = [];
  for (const row of rows) {
    const detail = kanjiDetail(db, String(row.character));
    if (!detail) continue;
    items.push({
      id: detail.id,
      character: detail.character,
      level: detail.level,
      strokes: detail.strokes,
      radical: detail.radical,
      onyomi: detail.onyomi,
      kunyomi: detail.kunyomi,
      english: detail.english,
      meaning: safeKanjiMeaning(detail.meaning),
      hanViet: detail.hanViet,
      alternatives: detail.alternatives,
      words: selectKanjiLessonWords(detail.related, detail.level, detail.character),
    });
  }
  return items;
}
