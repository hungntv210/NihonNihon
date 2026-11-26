import fs from 'node:fs';
import path from 'node:path';
import { databasePath } from './config.ts';
import type { Translation } from './content.ts';

type Provenance = { sourceId: string; sourceName: string; releaseId: string; method: 'machine' | 'tatoeba'; model?: string };
export type Highlight = { start: number; end: number };
export type SupplementExample = {
  id: string;
  japanese: string;
  english: string;
  furigana: string;
  vietnamese: string;
  attribution: string;
  provenance: Provenance;
  highlights?: Highlight[];
};
type ExerciseText = Omit<SupplementExample, 'highlights'> & { explanation: string };
export type SupplementExercise = ExerciseText & (
  | { kind: 'choice'; start: number; end: number; answer: string; choices: { text: string; correct: boolean }[] }
  | { kind: 'ordering'; prefix: string; suffix: string; pieces: string[] }
);
type ReadingNote = { text: string; sourceName: string; url: string };
export type SupplementItem = {
  hash: string;
  pos?: string[];
  readingNote?: ReadingNote;
  examples?: SupplementExample[];
  exercises?: SupplementExercise[];
  furigana?: string;
  vietnamese?: { text: string; provenance: Provenance };
};
export type ContentSupplement = ReadonlyMap<string, SupplementItem>;
type JsonObject = Record<string, unknown>;
const object = (x: unknown): x is JsonObject => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const provenance = (x: unknown): x is Provenance =>
  object(x) && text(x.sourceId) && text(x.sourceName) && text(x.releaseId)
  && (x.method === 'machine' || x.method === 'tatoeba') && (x.model === undefined || text(x.model));

const readingNote = (x: unknown): x is ReadingNote =>
  object(x) && text(x.text) && text(x.sourceName) && typeof x.url === 'string'
  && URL.canParse(x.url) && new URL(x.url).protocol === 'https:';

function example(x: unknown): x is SupplementExample {
  return object(x) && typeof x.id === 'string' && /^g1:sentence:[a-f0-9]{64}$/.test(x.id)
    && text(x.japanese) && text(x.english) && text(x.furigana) && text(x.vietnamese)
    && text(x.attribution) && !/not\s+resolved/iu.test(x.attribution)
    && provenance(x.provenance) && supplementFuriganaMatches(x.japanese, x.furigana)
    && (x.highlights === undefined || validHighlights(x.japanese, x.highlights));
}

function validHighlights(japanese: string, ranges: unknown): ranges is Highlight[] {
  return Array.isArray(ranges) && ranges.length > 0 && ranges.every((range, i) =>
    object(range) && Number.isInteger(range.start) && Number.isInteger(range.end)
    && Number(range.start) >= (i ? ranges[i - 1].end : 0)
    && Number(range.start) < Number(range.end) && Number(range.end) <= japanese.length);
}

function exercise(x: unknown): x is SupplementExercise {
  if (!object(x) || typeof x.id !== 'string' || !/^g1:exercise:[a-f0-9]{64}$/.test(x.id)
    || !text(x.japanese) || !text(x.english) || !text(x.vietnamese) || !text(x.explanation)
    || !text(x.furigana) || !supplementFuriganaMatches(x.japanese, x.furigana)
    || !text(x.attribution) || !provenance(x.provenance)) return false;
  if (x.kind === 'choice') {
    if (!validHighlights(x.japanese, [{ start: x.start, end: x.end }])
      || !text(x.answer) || x.japanese.slice(Number(x.start), Number(x.end)) !== x.answer
      || !Array.isArray(x.choices) || x.choices.length !== 4
      || !x.choices.every((c) => object(c) && text(c.text) && typeof c.correct === 'boolean')) return false;
    const choices = x.choices as { text: string; correct: boolean }[];
    return new Set(choices.map((c) => c.text.normalize('NFKC').trim())).size === 4
      && choices.filter((c) => c.correct).length === 1
      && choices.some((c) => c.correct && c.text === x.answer);
  }
  if (x.kind !== 'ordering' || typeof x.prefix !== 'string' || typeof x.suffix !== 'string'
    || !Array.isArray(x.pieces) || x.pieces.length !== 4 || !x.pieces.every(text)
    || new Set(x.pieces.map((s) => s.normalize('NFKC').trim())).size !== 4) return false;
  // A single reconstructing permutation is structural; grammatical uniqueness still needs editorial review.
  const pieces = x.pieces as string[];
  const orders = (parts: string[]): string[] => parts.length === 0 ? ['']
    : parts.flatMap((part, i) => orders(parts.filter((_, j) => i !== j)).map((rest) => part + rest));
  return x.prefix + pieces.join('') + x.suffix === x.japanese
    && orders(pieces).filter((s) => x.prefix + s + x.suffix === x.japanese).length === 1;
}

export function furiganaMatches(japanese: string, notation: string) {
  if (!notation) return false;
  const gaps = notation.replace(/\{([^{}|]+)\|([\p{Script=Hiragana}\p{Script=Katakana}ー・]+)\}/gu, '');
  return !/[{}|\p{Script=Han}]/u.test(gaps)
    && notation.replace(/\{([^{}|]+)\|([^{}|]+)\}/gu, '$1') === japanese;
}

function supplementFuriganaMatches(japanese: string, notation: string) {
  return !/\{[^{}|]*[\p{Script=Hiragana}\p{Script=Katakana}?]\|/u.test(notation)
    && furiganaMatches(japanese, notation);
}

export function readContentSupplement(file = path.join(path.dirname(databasePath()), 'private', 'g1-content-supplement.json')): ContentSupplement {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
    throw error;
  }
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('Invalid G1 content supplement JSON');
  }
  if (!object(input) || input.version !== 1 || !object(input.items))
    throw new Error('Invalid G1 content supplement');
  const result = new Map<string, SupplementItem>();
  const ids = new Set<string>(), sentences = new Set<string>(), exerciseSentences = new Set<string>();
  for (const [id, x] of Object.entries(input.items)) {
    if (!object(x) || typeof x.hash !== 'string' || !/^[a-f0-9]{64}$/.test(x.hash)
      || (x.pos !== undefined && (!Array.isArray(x.pos) || !x.pos.length || !x.pos.every(text)))
      || (x.readingNote !== undefined && !readingNote(x.readingNote))
      || (x.examples !== undefined && (!Array.isArray(x.examples) || !x.examples.every(example)))
      || (x.exercises !== undefined && (!Array.isArray(x.exercises) || !x.exercises.every(exercise)))
      || (x.furigana !== undefined && (!text(x.furigana)
        || !supplementFuriganaMatches(x.furigana.replace(/\{([^{}|]+)\|[^{}|]+\}/gu, '$1'), x.furigana)))
      || (x.vietnamese !== undefined && (!object(x.vietnamese) || !text(x.vietnamese.text) || !provenance(x.vietnamese.provenance))))
      throw new Error('Invalid G1 content supplement item: ' + id);
    const entry = x as SupplementItem;
    for (const row of entry.examples ?? []) {
      const normalized = normalizeSupplementSentence(row.japanese);
      if (ids.has(row.id) || sentences.has(normalized)) throw new Error('Duplicate G1 supplement example');
      ids.add(row.id);
      sentences.add(normalized);
    }
    for (const row of entry.exercises ?? []) {
      const key = row.kind + ':' + normalizeSupplementSentence(row.japanese);
      if (ids.has(row.id) || exerciseSentences.has(key)) throw new Error('Duplicate G1 supplement exercise');
      ids.add(row.id);
      exerciseSentences.add(key);
    }
    result.set(id, entry);
  }
  return result;
}

export function normalizeSupplementSentence(sentence: string) {
  return sentence.normalize('NFKC').replace(/[\p{P}\s]/gu, '');
}

export function supplementFor(supplement: ContentSupplement, id: string, hash: unknown) {
  const entry = supplement.get(id);
  return entry?.hash === hash ? entry : undefined;
}

export function supplementTranslation(text: string, source: Provenance): Translation {
  return {
    text, sourceId: source.sourceId, sourceName: source.sourceName, releaseId: source.releaseId,
    method: source.method, model: source.model ?? null, promptVersion: null, autoSelected: false,
  };
}

export function supplementSentence(
  supplement: ContentSupplement,
  row: { id: string; hash: unknown; japanese: string; furigana: string | null },
  hasVietnamese: boolean,
) {
  const entry = supplementFor(supplement, row.id, row.hash);
  const furigana = entry?.furigana && !furiganaMatches(row.japanese, row.furigana ?? '')
    && supplementFuriganaMatches(row.japanese, entry.furigana) ? entry.furigana : row.furigana;
  const vi = !hasVietnamese && entry?.vietnamese
    ? supplementTranslation(entry.vietnamese.text, entry.vietnamese.provenance)
    : null;
  return { furigana, vi };
}

export function supplementExamples(entry: SupplementItem | undefined, originals: readonly string[]) {
  const baseSentences = new Set(originals.map(normalizeSupplementSentence));
  return (entry?.examples ?? []).filter((row) => !baseSentences.has(normalizeSupplementSentence(row.japanese)));
}
