import fs from 'node:fs';
import path from 'node:path';
import { databasePath } from './config.ts';
import type { Translation } from './content.ts';

type Provenance = { sourceId: string; sourceName: string; releaseId: string; method: 'machine' | 'tatoeba'; model?: string };
export type SupplementExample = {
  id: string;
  japanese: string;
  english: string;
  furigana: string;
  vietnamese: string;
  attribution: string;
  provenance: Provenance;
};
type ReadingNote = { text: string; sourceName: string; url: string };
export type SupplementItem = {
  hash: string;
  pos?: string[];
  readingNote?: ReadingNote;
  examples?: SupplementExample[];
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
    && provenance(x.provenance) && supplementFuriganaMatches(x.japanese, x.furigana);
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
  const ids = new Set<string>(), sentences = new Set<string>();
  for (const [id, x] of Object.entries(input.items)) {
    if (!object(x) || typeof x.hash !== 'string' || !/^[a-f0-9]{64}$/.test(x.hash)
      || (x.pos !== undefined && (!Array.isArray(x.pos) || !x.pos.length || !x.pos.every(text)))
      || (x.readingNote !== undefined && !readingNote(x.readingNote))
      || (x.examples !== undefined && (!Array.isArray(x.examples) || !x.examples.every(example)))
      || (x.furigana !== undefined && (!text(x.furigana)
        || !supplementFuriganaMatches(x.furigana.replace(/\{([^{}|]+)\|[^{}|]+\}/gu, '$1'), x.furigana)))
      || (x.vietnamese !== undefined && (!object(x.vietnamese) || !text(x.vietnamese.text) || !provenance(x.vietnamese.provenance))))
      throw new Error('Invalid G1 content supplement item');
    const entry = x as SupplementItem;
    for (const row of entry.examples ?? []) {
      const normalized = normalizeSupplementSentence(row.japanese);
      if (ids.has(row.id) || sentences.has(normalized)) throw new Error('Duplicate G1 supplement example');
      ids.add(row.id);
      sentences.add(normalized);
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
