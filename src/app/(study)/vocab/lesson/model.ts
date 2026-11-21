import type { DatabaseSync } from 'node:sqlite';
import {
  newVocabulary,
  parseFurigana,
  vocabularyDetail,
  type Example,
  type Segment,
  type Vocabulary,
} from '../data.ts';

export const MAX_LESSON_EXAMPLES = 2;

export type LessonExample = Example & {
  segments: Segment[];
};

export type LessonWord = Vocabulary & {
  examples: LessonExample[];
};

export function selectLessonExamples(
  examples: readonly Example[],
  limit = MAX_LESSON_EXAMPLES,
): LessonExample[] {
  const max = Math.max(0, Math.floor(limit));
  if (max === 0) return [];
  const seen = new Set<string>();
  const selected: LessonExample[] = [];
  for (const example of examples) {
    if (selected.length >= max) break;
    if (!example.japanese.trim() || seen.has(example.id)) continue;
    seen.add(example.id);
    selected.push({
      ...example,
      segments: parseFurigana(example.furigana, example.japanese),
    });
  }
  return selected;
}

export function newLessonVocabulary(db: DatabaseSync): LessonWord[] {
  return newVocabulary(db).map((word) => {
    const detail = vocabularyDetail(db, word.id);
    return {
      ...word,
      examples: selectLessonExamples(detail?.examples ?? []),
    };
  });
}
