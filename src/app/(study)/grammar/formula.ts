export type FormulaKind =
  | 'verb'
  | 'i-adj'
  | 'na-adj'
  | 'noun'
  | 'fixed'
  | 'connector'
  | 'neutral';

export type TypedFormulaKind = Exclude<FormulaKind, 'connector' | 'neutral'>;

export type FormulaBlock = {
  kind: FormulaKind;
  text: string;
  raw: string;
  /** Visible category text so color is never the sole cue. */
  tag?: string;
  lang?: 'ja' | 'vi' | 'en';
};

export type FormulaLine = FormulaBlock[];

export type ParsedFormula = {
  source: 'formation' | 'pattern' | 'none';
  lines: FormulaLine[];
  blocks: FormulaBlock[];
  hasTypedBlock: boolean;
  usedKinds: TypedFormulaKind[];
};

export const FORMULA_TAGS: Record<Exclude<FormulaKind, 'connector'>, string> = {
  verb: 'Động từ',
  'i-adj': 'Tính từ い',
  'na-adj': 'Tính từ な',
  noun: 'Danh từ',
  fixed: 'Mẫu',
  neutral: 'Khác',
};

export const FORMULA_LEGEND: ReadonlyArray<{
  kind: TypedFormulaKind;
  code: string;
  label: string;
}> = [
  { kind: 'verb', code: 'V', label: 'động từ' },
  { kind: 'i-adj', code: 'Aい', label: 'tính từ い' },
  { kind: 'na-adj', code: 'Aな', label: 'tính từ な' },
  { kind: 'noun', code: 'N', label: 'danh từ' },
  { kind: 'fixed', code: 'Mẫu', label: 'phần cố định' },
];

const JA_CHAR = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/u;
const ONLY_PLACEHOLDER = /^[\s〜~….\-‐‑–—・/]+$/u;
const OPEN_DELIMS = '(（[「『';
const CLOSE_DELIMS = ')）]」』';

// Unicode-escaped Japanese POS metalanguage regexes keep Core WOFF2 font subsetting clean.
const VERB_SHORT_RE =
  /^V(?:[-‐‑–—](?:て|た|る|ない|ます|ば|よう|\u8f9e\u66f8\u5f62|\u666e\u901a\u5f62|て\u5f62|た\u5f62|ない\u5f62|ます\u5f62|\u53ef\u80fd\u5f62|\u610f\u5411\u5f62|te|ta|dict|nai|stem|plain|ba|volitional|thường|gốc)(?:\s*(?:stem|gốc))?)?$/iu;
const VERB_JA_RE = /^\u52d5\u8a5e(?:[（(].*[）)])?$/u;
const I_ADJ_SHORT_RE =
  /^(?:Aい|い-?Adj|い\u5f62\u5bb9\u8a5e)(?:[-‐‑–—](?:く|かった|くない|くて|さ|ku|stem|gốc)|\s+(?:stem|gốc))?$/iu;
const NA_ADJ_SHORT_RE =
  /^(?:Aな|な-?Adj|な\u5f62\u5bb9\u8a5e)(?:[-‐‑–—](?:な|に|だ|で|だった|じゃない|stem|gốc)|\s+(?:stem|gốc))?$/iu;
const NOUN_SHORT_RE = /^(?:N[12]?|\u540d\u8a5e)$/u;

function splitOutsideDelims(input: string, separator: '+' | '/'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (OPEN_DELIMS.includes(ch)) {
      depth++;
    } else if (CLOSE_DELIMS.includes(ch) && depth > 0) {
      depth--;
    } else if (depth === 0 && ch === separator) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

function hasCharOutsideDelims(input: string, target: string): boolean {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (OPEN_DELIMS.includes(ch)) depth++;
    else if (CLOSE_DELIMS.includes(ch) && depth > 0) depth--;
    else if (depth === 0 && ch === target) return true;
  }
  return false;
}

function stripParenthetical(input: string): string {
  return input
    .replace(/\([^)]*\)/g, ' ')
    .replace(/（[^）]*）/gu, ' ')
    .trim();
}

function extractNote(raw: string): { head: string; note: string } {
  const match = raw.match(/^(.*?)\s*(\([^)]*\)|（[^）]*）)\s*$/u);
  if (!match) return { head: raw.trim(), note: '' };
  return { head: match[1].trim(), note: match[2].trim() };
}

function withNote(base: string, note: string): string {
  return note ? `${base} ${note}` : base;
}

function classifyToken(rawInput: string): FormulaBlock {
  const raw = rawInput.trim();
  const { head, note } = extractNote(raw);

  // 1. Verb (OpenJLPT English + Japanese/shorthand)
  const verbEn = head.match(/^Verb(?:(?:-|\s+)(.+))?$/i);
  if (verbEn) {
    const suffix = (verbEn[1] ?? '').trim().toLowerCase();
    const map: Record<string, string> = {
      '': 'V',
      te: 'V-て',
      ta: 'V-た',
      dict: 'V-る',
      nai: 'V-ない',
      'nai stem': 'V-ない gốc',
      stem: 'V-ます gốc',
      plain: 'V-thường',
      ba: 'V-ば',
      volitional: 'V-よう',
      potential: 'V-khả năng',
      passive: 'V-bị động',
      causative: 'V-sai khiến',
      imperative: 'V-mệnh lệnh',
      conditional: 'V-điều kiện',
    };
    const compact = map[suffix] ?? `V-${verbEn[1]!.trim()}`;
    const text = withNote(compact, note);
    return {
      kind: 'verb',
      text,
      raw,
      tag: FORMULA_TAGS.verb,
      lang: JA_CHAR.test(text) ? 'ja' : 'vi',
    };
  }
  if (VERB_SHORT_RE.test(head) || VERB_JA_RE.test(head)) {
    return {
      kind: 'verb',
      text: raw,
      raw,
      tag: FORMULA_TAGS.verb,
      lang: JA_CHAR.test(raw) ? 'ja' : 'en',
    };
  }

  // 2. i-Adjective
  const iAdjEn = head.match(/^i-Adj(?:(?:-|\s+)(.+))?$/i);
  if (iAdjEn) {
    const suffix = (iAdjEn[1] ?? '').trim().toLowerCase();
    const map: Record<string, string> = {
      '': 'Aい',
      ku: 'Aい-く',
      stem: 'Aい gốc',
    };
    const compact = map[suffix] ?? `Aい-${iAdjEn[1]!.trim()}`;
    return {
      kind: 'i-adj',
      text: withNote(compact, note),
      raw,
      tag: FORMULA_TAGS['i-adj'],
      lang: 'ja',
    };
  }
  if (I_ADJ_SHORT_RE.test(head)) {
    return {
      kind: 'i-adj',
      text: raw,
      raw,
      tag: FORMULA_TAGS['i-adj'],
      lang: 'ja',
    };
  }

  // 3. na-Adjective
  const naAdjEn = head.match(/^na-Adj(?:(?:-|\s+)(.+))?$/i);
  if (naAdjEn) {
    const suffix = (naAdjEn[1] ?? '').trim();
    const compact = suffix ? `Aな-${suffix}` : 'Aな';
    return {
      kind: 'na-adj',
      text: withNote(compact, note),
      raw,
      tag: FORMULA_TAGS['na-adj'],
      lang: 'ja',
    };
  }
  if (NA_ADJ_SHORT_RE.test(head)) {
    return {
      kind: 'na-adj',
      text: raw,
      raw,
      tag: FORMULA_TAGS['na-adj'],
      lang: 'ja',
    };
  }

  // 4. Noun
  if (/^Noun$/i.test(head)) {
    return {
      kind: 'noun',
      text: withNote('N', note),
      raw,
      tag: FORMULA_TAGS.noun,
      lang: note ? 'en' : 'vi',
    };
  }
  if (NOUN_SHORT_RE.test(head)) {
    return {
      kind: 'noun',
      text: raw,
      raw,
      tag: FORMULA_TAGS.noun,
      lang: JA_CHAR.test(raw) ? 'ja' : 'vi',
    };
  }

  // 5. Fixed Japanese grammar part (must have kana/kanji outside parens and not be English prose)
  const core = stripParenthetical(raw);
  if (
    core &&
    !ONLY_PLACEHOLDER.test(core) &&
    JA_CHAR.test(core) &&
    !/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(core)
  ) {
    return {
      kind: 'fixed',
      text: raw,
      raw,
      tag: FORMULA_TAGS.fixed,
      lang: 'ja',
    };
  }

  // 6. Neutral fallback — never fabricate a grammatical category
  return {
    kind: 'neutral',
    text: raw,
    raw,
    tag: FORMULA_TAGS.neutral,
    lang: JA_CHAR.test(raw) ? 'ja' : 'en',
  };
}

function parseSingleLine(line: string): FormulaLine {
  const plusParts = splitOutsideDelims(line, '+');
  const tokens: FormulaLine = [];
  for (let i = 0; i < plusParts.length; i++) {
    if (i > 0) {
      tokens.push({ kind: 'connector', text: '+', raw: '+' });
    }
    const alts = splitOutsideDelims(plusParts[i], '/');
    for (let j = 0; j < alts.length; j++) {
      if (j > 0) {
        tokens.push({ kind: 'connector', text: '/', raw: '/' });
      }
      tokens.push(classifyToken(alts[j]));
    }
  }
  return tokens;
}

export function parseGrammarFormula(
  formation?: string | null,
  pattern?: string | null,
): ParsedFormula {
  const formationText = (formation ?? '').trim();
  const patternText = (pattern ?? '').trim();
  const source: ParsedFormula['source'] = formationText
    ? 'formation'
    : patternText
      ? 'pattern'
      : 'none';
  const input = source === 'formation' ? formationText : source === 'pattern' ? patternText : '';
  if (!input) {
    return { source: 'none', lines: [], blocks: [], hasTypedBlock: false, usedKinds: [] };
  }

  const rawLines = input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const lines: FormulaLine[] = [];
  for (const rawLine of rawLines) {
    const slashParts = splitOutsideDelims(rawLine, '/');
    // Split into separate visual rows only when every `/`-separated branch is its own `+` formula.
    if (slashParts.length > 1 && slashParts.every((part) => hasCharOutsideDelims(part, '+'))) {
      for (const branch of slashParts) {
        const parsed = parseSingleLine(branch);
        if (parsed.length) lines.push(parsed);
      }
    } else {
      const parsed = parseSingleLine(rawLine);
      if (parsed.length) lines.push(parsed);
    }
  }

  const blocks = lines.flat();
  const usedSet = new Set<TypedFormulaKind>();
  for (const block of blocks) {
    if (block.kind !== 'connector' && block.kind !== 'neutral') {
      usedSet.add(block.kind);
    }
  }
  const usedKinds = FORMULA_LEGEND.map((entry) => entry.kind).filter((kind) => usedSet.has(kind));

  return {
    source,
    lines,
    blocks,
    hasTypedBlock: usedKinds.length > 0,
    usedKinds,
  };
}
