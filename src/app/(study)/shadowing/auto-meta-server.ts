import fs from 'node:fs';
import path from 'node:path';
import { databasePath } from '../../../core/config.ts';
import { openContentDatabase } from '../../../core/content.ts';
import { allocateRoadmap, type CatalogItem } from '../today-roadmap/model.ts';
import { readRoadmapCatalog } from '../today-roadmap/repository.ts';
import { readTodaySettings } from '../today-roadmap/settings.ts';
import {
  furiganaToKana,
  normalizeClipTags,
  parseFuriganaNotationStrict,
  roadmapWeekInfo,
  type AutoMetaWeekCandidate,
  type ClipAutoMetaResult,
} from './auto-meta-model.ts';

type RawIpadicToken = {
  surface_form: string;
  basic_form?: string;
  reading?: string;
  pronunciation?: string;
  pos?: string;
  pos_detail_1?: string;
};

type KuromojiTokenizer = {
  tokenize(text: string): RawIpadicToken[];
};

type KuromojiModule = {
  builder(options: { dicPath: string }): {
    build(callback: (error: Error | null, tokenizer: KuromojiTokenizer) => void): void;
  };
};

export type RichToken = {
  surface: string;
  basic: string;
  readingHira: string | null;
  pos: string;
  start: number;
  end: number;
};

// IPADIC POS constants encoded as Unicode escapes so UI font-split scanning never trips on non-Core kanji.
const POS_SYMBOL = '\u8A18\u53F7'; // kigou
const POS_PARTICLE = '\u52A9\u8A5E'; // joshi
const POS_NOUN = '\u540D\u8A5E'; // meishi
const POS_VERB = '\u52D5\u8A5E'; // doushi
const POS_ADJ = '\u5F62\u5BB9\u8A5E'; // keiyoushi
const POS_ADV = '\u526F\u8A5E'; // fukushi
const CONTENT_POS = new Set([POS_NOUN, POS_VERB, POS_ADJ, POS_ADV]);

// Irregular standalone counter compounds split by IPADIC (hitori / futari).
const KANJI_ONE = '\u4E00';
const KANJI_TWO = '\u4E8C';
const KANJI_PERSON = '\u4EBA';
const NUMERAL_PREFIX_RE = /[0-9\uFF10-\uFF19\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341\u767E\u5343\u4E07]$/;

const LEVEL_RANK: Record<string, number> = {
  N5: 1,
  N4: 2,
  N3: 3,
  N2: 4,
  N1: 5,
};

const GRAMMAR_TAG_LABELS: Record<string, string> = {
  particle: 'trợ từ',
  topic: 'chủ đề',
  subject: 'chủ ngữ',
  object: 'tân ngữ',
  polite: 'lịch sự',
  conjunction: 'liên từ',
  tense: 'thì',
  conditional: 'điều kiện',
  passive: 'bị động',
  causative: 'sai khiến',
  potential: 'khả năng',
  comparison: 'so sánh',
  reason: 'nguyên nhân',
  desire: 'mong muốn',
  permission: 'cho phép',
  prohibition: 'cấm đoán',
  obligation: 'nghĩa vụ',
  request: 'yêu cầu',
  negation: 'phủ định',
  question: 'nghi vấn',
  time: 'thời gian',
  location: 'nơi chốn',
  direction: 'phương hướng',
  frequency: 'tần suất',
  emphasis: 'nhấn mạnh',
  contrast: 'tương phản',
};

type VocabEntry = {
  id: string;
  word: string;
  reading: string;
  level: string;
};

type GrammarEntry = {
  id: string;
  pattern: string;
  displayTag: string;
  forms: string[];
  level: string;
  tags: string[];
};

type KanjiEntry = {
  id: string;
  character: string;
  level: string;
};

type CachedCatalog = {
  key: string;
  vocabByWord: Map<string, VocabEntry[]>;
  vocabByReading: Map<string, VocabEntry[]>;
  grammarEntries: GrammarEntry[];
  kanjiByChar: Map<string, KanjiEntry>;
  weekByItemId: Map<string, number>;
  hasWordFurigana: boolean;
};

let tokenizerPromise: Promise<KuromojiTokenizer | null> | null = null;
let cachedCatalog: CachedCatalog | null = null;

function isKanjiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    cp === 0x3005
  );
}

function isKanjiChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && isKanjiCodePoint(cp);
}

function containsKanji(text: string): boolean {
  for (const ch of text) {
    if (isKanjiChar(ch)) return true;
  }
  return false;
}

function isPureKana(text: string): boolean {
  if (!text) return false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const isHira = cp >= 0x3041 && cp <= 0x3096;
    const isKata = cp >= 0x30a1 && cp <= 0x30f6;
    if (!isHira && !isKata && cp !== 0x30fc) return false;
  }
  return true;
}

export function katakanaToHiragana(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x30a1 && cp <= 0x30f6) {
      out += String.fromCodePoint(cp - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function loadShadowingTokenizer(): Promise<KuromojiTokenizer | null> {
  if (tokenizerPromise) return tokenizerPromise;
  tokenizerPromise = new Promise((resolve) => {
    try {
      const nodeModule = (
        process as typeof process & {
          getBuiltinModule?: (id: string) => {
            createRequire: (filename: string) => NodeRequire;
          };
        }
      ).getBuiltinModule?.('node:module');
      if (!nodeModule?.createRequire) {
        resolve(null);
        return;
      }
      const req = nodeModule.createRequire(path.join(process.cwd(), 'package.json'));
      const pkgName = 'kuromoji';
      const kuromoji = req(pkgName) as KuromojiModule;
      const dicPath = path.join(path.dirname(req.resolve(`${pkgName}/package.json`)), 'dict');
      kuromoji.builder({ dicPath }).build((error, instance) => {
        if (error || !instance) {
          resolve(null);
          return;
        }
        resolve(instance);
      });
    } catch {
      resolve(null);
    }
  });
  return tokenizerPromise;
}

function mergeIrregularCounterTokens(rawTokens: RawIpadicToken[]): RawIpadicToken[] {
  const merged: RawIpadicToken[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const cur = rawTokens[i];
    const next = rawTokens[i + 1];
    const prev = merged[merged.length - 1];
    const prevIsNumeral = prev ? NUMERAL_PREFIX_RE.test(prev.surface_form) : false;
    if (
      !prevIsNumeral &&
      next &&
      next.surface_form === KANJI_PERSON &&
      (cur.surface_form === KANJI_ONE || cur.surface_form === KANJI_TWO)
    ) {
      merged.push({
        surface_form: cur.surface_form + next.surface_form,
        basic_form: cur.surface_form + next.surface_form,
        reading: cur.surface_form === KANJI_ONE ? '\u30D2\u30C8\u30EA' : '\u30D5\u30BF\u30EA',
        pos: POS_NOUN,
      });
      i++;
      continue;
    }
    merged.push(cur);
  }
  return merged;
}

function tokenizeRich(text: string, tokenizer: KuromojiTokenizer | null): RichToken[] {
  if (!text) return [];
  if (!tokenizer) {
    return [{ surface: text, basic: text, readingHira: null, pos: '', start: 0, end: text.length }];
  }
  const raw = mergeIrregularCounterTokens(tokenizer.tokenize(text));
  const tokens: RichToken[] = [];
  let cursor = 0;
  for (const item of raw) {
    const surface = item.surface_form;
    if (!surface || text.slice(cursor, cursor + surface.length) !== surface) {
      return [{ surface: text, basic: text, readingHira: null, pos: '', start: 0, end: text.length }];
    }
    const start = cursor;
    cursor += surface.length;
    const basic = item.basic_form && item.basic_form !== '*' ? item.basic_form : surface;
    const readingHira =
      item.reading && item.reading !== '*' ? katakanaToHiragana(item.reading.normalize('NFC')) : null;
    tokens.push({
      surface,
      basic,
      readingHira,
      pos: item.pos ?? '',
      start,
      end: cursor,
    });
  }
  if (cursor !== text.length) {
    return [{ surface: text, basic: text, readingHira: null, pos: '', start: 0, end: text.length }];
  }
  return tokens;
}

function splitKanjiKanaRuns(surface: string): { isKanji: boolean; text: string }[] {
  const runs: { isKanji: boolean; text: string }[] = [];
  for (const ch of surface) {
    const kanji = isKanjiChar(ch);
    const prev = runs[runs.length - 1];
    if (prev && prev.isKanji === kanji) {
      prev.text += ch;
    } else {
      runs.push({ isKanji: kanji, text: ch });
    }
  }
  return runs;
}

function findUniqueInternalSplit(
  runs: { isKanji: boolean; text: string }[],
  readingHira: string,
): string[] | null {
  const solutions: string[][] = [];

  function dfs(runIdx: number, readPos: number, acc: string[]): void {
    if (solutions.length > 1) return;
    if (runIdx === runs.length) {
      if (readPos === readingHira.length) solutions.push([...acc]);
      return;
    }
    const run = runs[runIdx];
    if (!run.isKanji) {
      const target = katakanaToHiragana(run.text);
      if (readingHira.startsWith(target, readPos)) {
        acc.push(run.text);
        dfs(runIdx + 1, readPos + target.length, acc);
        acc.pop();
      }
      return;
    }
    if (runIdx === runs.length - 1) {
      if (readPos < readingHira.length) {
        acc.push(readingHira.slice(readPos));
        dfs(runIdx + 1, readingHira.length, acc);
        acc.pop();
      }
      return;
    }
    const nextKana = katakanaToHiragana(runs[runIdx + 1].text);
    const remainingMin = runs.length - 1 - runIdx;
    for (let nextPos = readPos + 1; nextPos <= readingHira.length - remainingMin; nextPos++) {
      if (readingHira.startsWith(nextKana, nextPos)) {
        acc.push(readingHira.slice(readPos, nextPos));
        dfs(runIdx + 1, nextPos, acc);
        acc.pop();
        if (solutions.length > 1) return;
      }
    }
  }

  dfs(0, 0, []);
  return solutions.length === 1 ? solutions[0] : null;
}

function applyDbWordFurigana(
  surface: string,
  segmentsJson: string | undefined,
): string | null {
  if (!segmentsJson) return null;
  try {
    const parsed = JSON.parse(segmentsJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    let out = '';
    let plain = '';
    for (const seg of parsed) {
      if (typeof seg === 'string') {
        out += seg;
        plain += seg;
        continue;
      }
      if (seg && typeof seg === 'object' && typeof (seg as { ruby?: unknown }).ruby === 'string') {
        const ruby = String((seg as { ruby: string }).ruby).normalize('NFC');
        const rt =
          typeof (seg as { rt?: unknown }).rt === 'string'
            ? katakanaToHiragana(String((seg as { rt: string }).rt).normalize('NFC')).trim()
            : '';
        plain += ruby;
        if (rt && containsKanji(ruby)) {
          out += `{${ruby}|${rt}}`;
        } else {
          out += ruby;
        }
      } else {
        return null;
      }
    }
    if (plain !== surface) return null;
    return out;
  } catch {
    return null;
  }
}

export function alignTokenFurigana(
  surface: string,
  readingHira: string | null,
  dbWordFuriganaJson?: string,
): string {
  const normSurface = surface.normalize('NFC');
  if (!containsKanji(normSurface) || !readingHira) {
    return normSurface;
  }
  const fromDb = applyDbWordFurigana(normSurface, dbWordFuriganaJson);
  if (fromDb) return fromDb;

  const sChars = [...normSurface];
  const rChars = [...readingHira.normalize('NFC')];

  let sStart = 0;
  let rStart = 0;
  while (
    sStart < sChars.length &&
    rStart < rChars.length &&
    !isKanjiChar(sChars[sStart]) &&
    katakanaToHiragana(sChars[sStart]) === rChars[rStart]
  ) {
    sStart++;
    rStart++;
  }

  let sEnd = sChars.length;
  let rEnd = rChars.length;
  while (
    sEnd > sStart &&
    rEnd > rStart &&
    !isKanjiChar(sChars[sEnd - 1]) &&
    katakanaToHiragana(sChars[sEnd - 1]) === rChars[rEnd - 1]
  ) {
    sEnd--;
    rEnd--;
  }

  const prefix = sChars.slice(0, sStart).join('');
  const coreSurface = sChars.slice(sStart, sEnd).join('');
  const suffix = sChars.slice(sEnd).join('');
  const coreReading = rChars.slice(rStart, rEnd).join('');

  if (!coreSurface || !coreReading || !containsKanji(coreSurface)) {
    return normSurface;
  }

  const runs = splitKanjiKanaRuns(coreSurface);
  if (runs.length >= 3) {
    const split = findUniqueInternalSplit(runs, coreReading);
    if (split) {
      const inner = runs
        .map((run, idx) => (run.isKanji ? `{${run.text}|${split[idx]}}` : run.text))
        .join('');
      return `${prefix}${inner}${suffix}`;
    }
  }

  return `${prefix}{${coreSurface}|${coreReading}}${suffix}`;
}

export function buildSentenceFurigana(
  sentence: string,
  tokenizer: KuromojiTokenizer | null,
  wordFuriganaMap?: ReadonlyMap<string, string>,
): { ja: string; furigana: string; kana: string; tokens: RichToken[] } {
  const ja = sentence.normalize('NFC').trim();
  if (!ja) return { ja: '', furigana: '', kana: '', tokens: [] };
  const tokens = tokenizeRich(ja, tokenizer);
  const parts: string[] = [];
  for (const token of tokens) {
    const dbKey = token.readingHira ? `${token.surface}\0${token.readingHira}` : '';
    const annotated = alignTokenFurigana(
      token.surface,
      token.readingHira,
      dbKey ? wordFuriganaMap?.get(dbKey) : undefined,
    );
    parts.push(annotated);
  }
  const candidate = parts.join('');
  const furigana = parseFuriganaNotationStrict(ja, candidate) ? candidate : ja;
  const kana = furiganaToKana(furigana);
  return { ja, furigana, kana, tokens };
}

function cleanGrammarDisplay(pattern: string): string {
  return pattern
    .normalize('NFC')
    .replace(/[（(][^）)]*[）)]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGrammarForms(pattern: string): string[] {
  const cleaned = cleanGrammarDisplay(pattern);
  const rawParts = cleaned.split(/[\/・]/u);
  const out = new Set<string>();
  for (const part of rawParts) {
    const stripped = part.replace(/^[〜～~…\s]+|[〜～~…\s]+$/gu, '').trim();
    if (stripped) out.add(stripped);
  }
  return [...out];
}

function parseJsonStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function compareCatalogId(a: CatalogItem, b: CatalogItem): number {
  return a.id < b.id ? -1 : Number(a.id > b.id);
}

function loadOpenJlptCatalog(dbFile: string, startDate: string): CachedCatalog {
  const resolved = path.resolve(dbFile);
  let statKey = `${resolved}|${startDate}`;
  try {
    const stat = fs.statSync(resolved);
    statKey = `${resolved}|${stat.mtimeMs}|${stat.size}|${startDate}`;
  } catch {
    // Missing DB handled below
  }
  if (cachedCatalog && cachedCatalog.key === statKey) {
    return cachedCatalog;
  }

  const vocabByWord = new Map<string, VocabEntry[]>();
  const vocabByReading = new Map<string, VocabEntry[]>();
  const grammarEntries: GrammarEntry[] = [];
  const kanjiByChar = new Map<string, KanjiEntry>();
  const weekByItemId = new Map<string, number>();
  let hasWordFurigana = false;

  const db = openContentDatabase(resolved);
  try {
    const vocabRows = db
      .prepare(
        `SELECT i.item_id id, v.word, v.reading, v.level
         FROM content_items i
         JOIN vocab v USING(item_id)
         WHERE i.is_active=1 AND i.source_id='openjlpt'`,
      )
      .all() as Record<string, unknown>[];

    for (const row of vocabRows) {
      const entry: VocabEntry = {
        id: String(row.id),
        word: String(row.word).normalize('NFC'),
        reading: katakanaToHiragana(String(row.reading).normalize('NFC')),
        level: String(row.level),
      };
      const byW = vocabByWord.get(entry.word);
      if (byW) byW.push(entry);
      else vocabByWord.set(entry.word, [entry]);

      const byR = vocabByReading.get(entry.reading);
      if (byR) byR.push(entry);
      else vocabByReading.set(entry.reading, [entry]);
    }

    const grammarRows = db
      .prepare(
        `SELECT i.item_id id, g.pattern, g.level, g.tags
         FROM content_items i
         JOIN grammar g USING(item_id)
         WHERE i.is_active=1 AND i.source_id='openjlpt'`,
      )
      .all() as Record<string, unknown>[];

    for (const row of grammarRows) {
      const pattern = String(row.pattern).normalize('NFC');
      const forms = extractGrammarForms(pattern);
      if (!forms.length) continue;
      grammarEntries.push({
        id: String(row.id),
        pattern,
        displayTag: cleanGrammarDisplay(pattern) || pattern,
        forms,
        level: String(row.level),
        tags: parseJsonStringArray(row.tags),
      });
    }

    const kanjiRows = db
      .prepare(
        `SELECT i.item_id id, k.character, k.level
         FROM content_items i
         JOIN kanji k USING(item_id)
         WHERE i.is_active=1 AND i.source_id='openjlpt'`,
      )
      .all() as Record<string, unknown>[];

    for (const row of kanjiRows) {
      const character = String(row.character).normalize('NFC');
      kanjiByChar.set(character, {
        id: String(row.id),
        character,
        level: String(row.level),
      });
    }

    const roadmapCatalog = readRoadmapCatalog(db);
    const allocated = allocateRoadmap(roadmapCatalog, startDate, compareCatalogId);
    for (const week of allocated) {
      for (const item of week.items) {
        weekByItemId.set(item.id, week.week);
      }
    }

    const wfCount = db
      .prepare(`SELECT count(*) n FROM word_furigana LIMIT 1`)
      .get() as { n?: number } | undefined;
    hasWordFurigana = Number(wfCount?.n ?? 0) > 0;
  } finally {
    db.close();
  }

  cachedCatalog = {
    key: statKey,
    vocabByWord,
    vocabByReading,
    grammarEntries,
    kanjiByChar,
    weekByItemId,
    hasWordFurigana,
  };
  return cachedCatalog;
}

function loadWordFuriganaLookup(
  dbFile: string,
  tokensList: readonly RichToken[][],
): Map<string, string> {
  const result = new Map<string, string>();
  const pairs = new Map<string, { word: string; reading: string }>();
  for (const tokens of tokensList) {
    for (const token of tokens) {
      if (!token.readingHira || !containsKanji(token.surface)) continue;
      const key = `${token.surface}\0${token.readingHira}`;
      if (!pairs.has(key)) {
        pairs.set(key, { word: token.surface, reading: token.readingHira });
      }
    }
  }
  if (pairs.size === 0) return result;

  const db = openContentDatabase(path.resolve(dbFile));
  try {
    const stmt = db.prepare(
      `SELECT segments FROM word_furigana WHERE word=? AND reading=? ORDER BY source_id LIMIT 1`,
    );
    for (const [key, { word, reading }] of pairs) {
      const row = stmt.get(word, reading) as { segments?: unknown } | undefined;
      if (row && typeof row.segments === 'string') {
        result.set(key, row.segments);
      }
    }
  } finally {
    db.close();
  }
  return result;
}

function pickBestVocabEntry(entries: VocabEntry[], tokenReading: string | null): VocabEntry {
  const matchingReading = tokenReading
    ? entries.filter((e) => e.reading === tokenReading)
    : [];
  const pool = matchingReading.length > 0 ? matchingReading : entries;
  return pool
    .slice()
    .sort((a, b) => (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9) || (a.id < b.id ? -1 : 1))[0];
}

function matchGrammarEntry(entry: GrammarEntry, sentence: string, tokens: RichToken[]): boolean {
  for (const form of entry.forms) {
    const len = [...form].length;
    if (len === 1) {
      if (tokens.some((t) => t.surface === form && t.pos === POS_PARTICLE)) {
        return true;
      }
      continue;
    }

    // Check consecutive token spans (1..5 tokens) using surface or basic_form on the final token
    for (let i = 0; i < tokens.length; i++) {
      let surfaceAcc = '';
      for (let j = i; j < Math.min(tokens.length, i + 5); j++) {
        const prevAcc = surfaceAcc;
        surfaceAcc += tokens[j].surface;
        if (surfaceAcc === form) return true;
        if (tokens[j].basic !== tokens[j].surface && prevAcc + tokens[j].basic === form) {
          return true;
        }
        if (surfaceAcc.length > form.length + 4) break;
      }
    }

    if (len >= 3) {
      const idx = sentence.indexOf(form);
      if (idx >= 0 && tokens.some((t) => t.start === idx)) {
        return true;
      }
    }
  }
  return false;
}

function mapGrammarCategoryTag(rawTag: string): string | null {
  const key = rawTag.trim().toLowerCase();
  if (!key) return null;
  return GRAMMAR_TAG_LABELS[key] ?? null;
}

export async function analyzeClipMetadata(
  sentences: readonly string[],
  options: { dbFile?: string; startDate?: string } = {},
): Promise<ClipAutoMetaResult> {
  const cleanedSentences = sentences.map((s) => s.normalize('NFC').trim());
  const dbFile = options.dbFile ?? databasePath();
  const startDate = options.startDate ?? readTodaySettings().startDate;

  const tokenizer = await loadShadowingTokenizer();
  const catalog = loadOpenJlptCatalog(dbFile, startDate);

  // First pass tokenize to gather kanji tokens for optional word_furigana lookup
  const rawTokenized = cleanedSentences.map((s) => tokenizeRich(s, tokenizer));
  const wordFuriganaMap = catalog.hasWordFurigana
    ? loadWordFuriganaLookup(dbFile, rawTokenized)
    : undefined;

  const analyzedSegments = cleanedSentences.map((s) =>
    buildSentenceFurigana(s, tokenizer, wordFuriganaMap),
  );

  // Match OpenJLPT vocab, grammar, kanji across all sentences
  const matchedVocab = new Map<string, { entry: VocabEntry; count: number }>();
  const matchedGrammar = new Map<string, { entry: GrammarEntry; count: number }>();
  const matchedKanji = new Map<string, { entry: KanjiEntry; count: number }>();

  for (const seg of analyzedSegments) {
    if (!seg.ja) continue;

    for (const token of seg.tokens) {
      if (token.pos === POS_SYMBOL || !token.surface.trim()) continue;
      let hit: VocabEntry | null = null;
      const byBasic = catalog.vocabByWord.get(token.basic);
      const bySurface = catalog.vocabByWord.get(token.surface);
      if (byBasic && byBasic.length > 0) {
        hit = pickBestVocabEntry(byBasic, token.readingHira);
      } else if (bySurface && bySurface.length > 0) {
        hit = pickBestVocabEntry(bySurface, token.readingHira);
      } else if (
        isPureKana(token.basic) &&
        [...token.basic].length >= 2 &&
        CONTENT_POS.has(token.pos)
      ) {
        const byReading = catalog.vocabByReading.get(katakanaToHiragana(token.basic));
        if (byReading && byReading.length === 1) {
          hit = byReading[0];
        }
      }

      if (hit) {
        const prev = matchedVocab.get(hit.id);
        if (prev) prev.count++;
        else matchedVocab.set(hit.id, { entry: hit, count: 1 });
      }
    }

    for (const grammar of catalog.grammarEntries) {
      if (matchGrammarEntry(grammar, seg.ja, seg.tokens)) {
        const prev = matchedGrammar.get(grammar.id);
        if (prev) prev.count++;
        else matchedGrammar.set(grammar.id, { entry: grammar, count: 1 });
      }
    }

    for (const ch of seg.ja) {
      if (!isKanjiChar(ch)) continue;
      const hit = catalog.kanjiByChar.get(ch);
      if (hit) {
        const prev = matchedKanji.get(hit.id);
        if (prev) prev.count++;
        else matchedKanji.set(hit.id, { entry: hit, count: 1 });
      }
    }
  }

  // Determine highest JLPT level across matched vocab + grammar (fallback kanji)
  const primaryLevels = [
    ...[...matchedVocab.values()].map((m) => m.entry.level),
    ...[...matchedGrammar.values()].map((m) => m.entry.level),
  ];
  const fallbackLevels = [...matchedKanji.values()].map((m) => m.entry.level);
  const levelPool = primaryLevels.length > 0 ? primaryLevels : fallbackLevels;

  let suggestedLevel: string | null = null;
  let maxRank = 0;
  for (const lv of levelPool) {
    const rank = LEVEL_RANK[lv] ?? 0;
    if (rank > maxRank) {
      maxRank = rank;
      suggestedLevel = lv;
    }
  }

  // Build deterministic suggested tags (max 6)
  const rawTags: string[] = [];
  if (suggestedLevel) rawTags.push(suggestedLevel);

  const sortedGrammar = [...matchedGrammar.values()].sort(
    (a, b) =>
      (LEVEL_RANK[b.entry.level] ?? 0) - (LEVEL_RANK[a.entry.level] ?? 0) ||
      b.count - a.count ||
      (a.entry.id < b.entry.id ? -1 : 1),
  );
  for (const item of sortedGrammar.slice(0, 3)) {
    rawTags.push(item.entry.displayTag);
  }

  const catTagCounts = new Map<string, number>();
  for (const item of sortedGrammar) {
    for (const rawTag of item.entry.tags) {
      const mapped = mapGrammarCategoryTag(rawTag);
      if (mapped) {
        catTagCounts.set(mapped, (catTagCounts.get(mapped) ?? 0) + item.count);
      }
    }
  }
  const sortedCatTags = [...catTagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
    .slice(0, 2)
    .map(([label]) => label);
  rawTags.push(...sortedCatTags);

  const suggestedTags = normalizeClipTags(rawTags).slice(0, 6);

  // Suggest 87-week roadmap week based on matched OpenJLPT vocab/grammar/kanji
  type MatchedRoadmapHit = {
    id: string;
    kind: 'grammar' | 'vocab' | 'kanji';
    label: string;
    level: string;
    week: number;
    weight: number;
  };
  const roadmapHits: MatchedRoadmapHit[] = [];

  for (const { entry } of matchedGrammar.values()) {
    const week = catalog.weekByItemId.get(entry.id);
    if (week) {
      roadmapHits.push({
        id: entry.id,
        kind: 'grammar',
        label: entry.displayTag,
        level: entry.level,
        week,
        weight: 3,
      });
    }
  }
  for (const { entry } of matchedVocab.values()) {
    const week = catalog.weekByItemId.get(entry.id);
    if (week) {
      roadmapHits.push({
        id: entry.id,
        kind: 'vocab',
        label: entry.word,
        level: entry.level,
        week,
        weight: 2,
      });
    }
  }
  for (const { entry } of matchedKanji.values()) {
    const week = catalog.weekByItemId.get(entry.id);
    if (week) {
      roadmapHits.push({
        id: entry.id,
        kind: 'kanji',
        label: entry.character,
        level: entry.level,
        week,
        weight: 1,
      });
    }
  }

  let suggestedWeek: number | null = null;
  let suggestedWeekReason: string | null = null;
  let weekCandidates: AutoMetaWeekCandidate[] = [];

  if (roadmapHits.length > 0) {
    // Prefer the highest matched roadmap level (N5..N2) among vocab/grammar first, fallback kanji
    const vgHits = roadmapHits.filter((h) => h.kind !== 'kanji');
    const levelSource = vgHits.length > 0 ? vgHits : roadmapHits;
    let targetRank = 0;
    let targetLevel = '';
    for (const hit of levelSource) {
      const rank = LEVEL_RANK[hit.level] ?? 0;
      if (rank > targetRank) {
        targetRank = rank;
        targetLevel = hit.level;
      }
    }
    const scopedHits = roadmapHits.filter((h) => h.level === targetLevel);
    const activeHits = scopedHits.length > 0 ? scopedHits : roadmapHits;

    const byWeek = new Map<
      number,
      { score: number; matchedCount: number; labels: Set<string>; vocab: number; grammar: number; kanji: number }
    >();
    for (const hit of activeHits) {
      let bucket = byWeek.get(hit.week);
      if (!bucket) {
        bucket = { score: 0, matchedCount: 0, labels: new Set(), vocab: 0, grammar: 0, kanji: 0 };
        byWeek.set(hit.week, bucket);
      }
      bucket.score += hit.weight;
      bucket.matchedCount += 1;
      bucket.labels.add(hit.label);
      bucket[hit.kind] += 1;
    }

    const ranked = [...byWeek.entries()]
      .sort(
        (a, b) =>
          b[1].score - a[1].score ||
          b[1].matchedCount - a[1].matchedCount ||
          b[0] - a[0],
      )
      .slice(0, 3);

    weekCandidates = ranked
      .map(([weekNum, stats]) => {
        const info = roadmapWeekInfo(weekNum);
        if (!info) return null;
        return {
          week: info.week,
          level: info.level,
          theme: info.theme,
          matchedCount: stats.matchedCount,
          matchedLabels: [...stats.labels].sort().slice(0, 4),
        };
      })
      .filter((c): c is AutoMetaWeekCandidate => c !== null);

    if (weekCandidates.length > 0) {
      const top = weekCandidates[0];
      const topStats = byWeek.get(top.week)!;
      suggestedWeek = top.week;
      const breakdown: string[] = [];
      if (topStats.grammar > 0) breakdown.push(`${topStats.grammar} ngữ pháp`);
      if (topStats.vocab > 0) breakdown.push(`${topStats.vocab} từ vựng`);
      if (topStats.kanji > 0) breakdown.push(`${topStats.kanji} kanji`);
      suggestedWeekReason = `Gợi ý Tuần ${top.week} (${top.level} · ${top.theme}) — khớp ${breakdown.join(', ')}: ${top.matchedLabels.join(', ')}.`;
    }
  } else if (suggestedLevel === 'N1') {
    const info = roadmapWeekInfo(87)!;
    suggestedWeek = 87;
    weekCandidates = [
      {
        week: 87,
        level: info.level,
        theme: info.theme,
        matchedCount: matchedVocab.size + matchedGrammar.size,
        matchedLabels: [],
      },
    ];
    suggestedWeekReason =
      'Nội dung có mục cấp N1 ngoài phạm vi N5–N2; gợi ý gắn tuần cuối lộ trình (Tuần 87 · N2).';
  }

  return {
    segments: analyzedSegments.map((s) => ({
      ja: s.ja,
      furigana: s.furigana,
      kana: s.kana,
    })),
    suggestedLevel,
    suggestedTags,
    suggestedWeek,
    suggestedWeekReason,
    weekCandidates,
    matchedSummary: {
      vocabCount: matchedVocab.size,
      grammarCount: matchedGrammar.size,
      kanjiCount: matchedKanji.size,
    },
    machineTranslationAvailable: false,
  };
}
