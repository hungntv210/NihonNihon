export type Highlight = { start: number; end: number };

export type HighlightAuditStatus = 'ok' | 'none' | 'mismatch';

export type HighlightMismatchReason =
  | 'empty'
  | 'out_of_bounds'
  | 'overlapping'
  | 'whole_sentence'
  | 'pattern_mismatch';

export type HighlightAuditResult = {
  status: HighlightAuditStatus;
  reasons: HighlightMismatchReason[];
  matchedTexts: string[];
};

type RubyUnit = {
  text: string;
  reading?: string;
  jaStart: number;
  jaEnd: number;
  rdStart: number;
  rdEnd: number;
};

type ReadingIndex = {
  japanese: string;
  reading: string;
  units: RubyUnit[];
};

type PatternVariant = {
  slots: string[];
  hasLeadingWave: boolean;
  allowReorder?: boolean;
  maxGap?: number;
  priorityPenalty?: number;
};

const PUNCT_RE = /[。、！？!?,\.\s「」『』（）()・…]/gu;
const WAVE_EDGE_RE = /^[〜～~…\s]+|[〜～~…\s]+$/gu;
const WAVE_SPLIT_RE = /[〜～~…]+/u;
const ASCII_PARENS_RE = /[（(][^）)]*[A-Za-z][^）)]*[）)]/gu;
const SENSE_PARENS_RE = /[（(]([^）)]*[A-Za-z][^）)]*)[）)]/u;
const JP_OPT_PARENS_RE = /[（(]([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+)[）)]/u;
const PURE_JP_RE = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+$/u;
const HAS_KANJI_RE = /\p{Script=Han}/u;
const NOUN_PLUS_JP_RE = /\bNoun\s*\+\s*([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]{2,})/gu;

// Common kanji -> hiragana reading map for grammar keywords so kanji-written patterns
// still match kana-written examples (and vice versa via sentence furigana).
// Kanji are Unicode-escaped to avoid pulling extra glyphs into Shippori Core WOFF2 scans.
const GRAMMAR_KANJI_KANA: readonly [string, string][] = [
  ['\u4e00\u65b9', '\u3044\u3063\u307d\u3046'],
  ['\u4e00\u756a', '\u3044\u3061\u3070\u3093'],
  ['\u4e0a\u624b', '\u3058\u3087\u3046\u305a'],
  ['\u4e0b\u624b', '\u3078\u305f'],
  ['\u4e2d\u5fc3', '\u3061\u3085\u3046\u3057\u3093'],
  ['\u4ee5\u6765', '\u3044\u3089\u3044'],
  ['\u5148\u7acb', '\u3055\u304d\u3060'],
  ['\u5168\u7136', '\u305c\u3093\u305c\u3093'],
  ['\u53cd\u9762', '\u306f\u3093\u3081\u3093'],
  ['\u534a\u9762', '\u306f\u3093\u3081\u3093'],
  ['\u59cb\u3081', '\u306f\u3058\u3081'],
  ['\u6700\u4e2d', '\u3055\u3044\u3061\u3085\u3046'],
  ['\u6b21\u7b2c', '\u3057\u3060\u3044'],
  ['\u76f8\u9055', '\u305d\u3046\u3044'],
  ['\u4ee3\u308f', '\u304b\u308f'],
  ['\u5acc\u3044', '\u304d\u3089\u3044'],
  ['\u597d\u304d', '\u3059\u304d'],
  ['\u69cb\u308f', '\u304b\u307e\u308f'],
  ['\u904e\u304e', '\u3059\u304e'],
  ['\u9055\u3044', '\u3061\u304c\u3044'],
  ['\u6c7a\u307e', '\u304d\u307e'],
  ['\u6bd4\u3079', '\u304f\u3089\u3079'],
  ['\u5f93\u3063', '\u3057\u305f\u304c\u3063'],
  ['\u5bfe\u3057', '\u305f\u3044\u3057'],
  ['\u53cd\u3057', '\u306f\u3093\u3057'],
  ['\u9650\u3089', '\u304b\u304e\u3089'],
  ['\u9650\u308a', '\u304b\u304e\u308a'],
  ['\u9650\u308b', '\u304b\u304e\u308b'],
  ['\u9650\u3063', '\u304b\u304e\u3063'],
  ['\u8d8a\u3057', '\u3053\u3057'],
  ['\u52a0\u3048', '\u304f\u308f\u3048'],
  ['\u57fa\u3065', '\u3082\u3068\u3065'],
  ['\u5411\u3051', '\u3080\u3051'],
  ['\u5411\u304d', '\u3080\u304d'],
  ['\u5fdc\u3058', '\u304a\u3046\u3058'],
  ['\u969b\u3057', '\u3055\u3044\u3057'],
  ['\u6cbf\u3063', '\u305d\u3063'],
  ['\u4f34\u3063', '\u3068\u3082\u306a\u3063'],
  ['\u9664\u3044', '\u306e\u305e\u3044'],
  ['\u554f\u308f', '\u3068\u308f'],
  ['\u629c\u304d', '\u306c\u304d'],
  ['\u629c\u304f', '\u306c\u304f'],
  ['\u5f97\u308b', '\u3046\u308b'],
  ['\u5f97\u306a', '\u3048\u306a'],
  ['\u6e08\u3080', '\u3059\u3080'],
  ['\u95a2\u3057', '\u304b\u3093\u3057'],
  ['\u95a2\u3059', '\u304b\u3093\u3059'],
  ['\u901a\u3058', '\u3064\u3046\u3058'],
  ['\u901a\u3057', '\u3068\u304a\u3057'],
  ['\u7d42\u308f', '\u304a\u308f'],
  ['\u7d9a\u3051', '\u3064\u3065\u3051'],
  ['\u5207\u308b', '\u304d\u308b'],
  ['\u5207\u308c', '\u304d\u308c'],
  ['\u51fa\u3059', '\u3060\u3059'],
  ['\u5408\u3046', '\u3042\u3046'],
  ['\u76f4\u3059', '\u306a\u304a\u3059'],
  ['\u8a00\u3046', '\u3044\u3046'],
  ['\u601d\u3046', '\u304a\u3082\u3046'],
  ['\u898b\u308b', '\u307f\u308b'],
  ['\u983c\u3080', '\u305f\u306e\u3080'],
  ['\u4f1d\u3048', '\u3064\u305f\u3048'],
  ['\u884c\u304f', '\u3044\u304f'],
  ['\u6765\u308b', '\u304f\u308b'],
  ['\u524d', '\u307e\u3048'],
  ['\u5f8c', '\u3042\u3068'],
  ['\u9593', '\u3042\u3044\u3060'],
  ['\u4e0a', '\u3046\u3048'],
  ['\u969b', '\u3055\u3044'],
  ['\u672b', '\u3059\u3048'],
  ['\u6c17', '\u304d'],
  ['\u4f55', '\u306a\u306b'],
  ['\u8ab0', '\u3060\u308c'],
  ['\u65b9', '\u307b\u3046'],
];

function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30a1-\u30f6]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function toKanaReading(s: string): string {
  let out = s;
  for (const [kanji, kana] of GRAMMAR_KANJI_KANA) {
    if (out.includes(kanji)) out = out.replaceAll(kanji, kana);
  }
  return katakanaToHiragana(out);
}

export function parseRubyUnits(japanese: string, notation: string | null | undefined): RubyUnit[] {
  const plainUnits = (): RubyUnit[] => {
    const result: RubyUnit[] = [];
    let rd = 0;
    for (let i = 0; i < japanese.length; i++) {
      const ch = japanese[i];
      const h = katakanaToHiragana(ch);
      result.push({ text: ch, jaStart: i, jaEnd: i + 1, rdStart: rd, rdEnd: rd + h.length });
      rd += h.length;
    }
    return result;
  };
  if (!notation) return plainUnits();
  const raw: { text: string; reading?: string }[] = [];
  let end = 0;
  for (const match of notation.matchAll(/\{([^|{}]+)\|([^{}]+)\}/gu)) {
    if (match.index! > end) raw.push({ text: notation.slice(end, match.index) });
    raw.push({ text: match[1], reading: match[2] });
    end = match.index! + match[0].length;
  }
  if (end < notation.length) raw.push({ text: notation.slice(end) });
  if (!raw.length || raw.map((p) => p.text).join('') !== japanese) return plainUnits();

  const units: RubyUnit[] = [];
  let ja = 0;
  let rd = 0;
  for (const part of raw) {
    if (part.reading) {
      const h = katakanaToHiragana(part.reading);
      units.push({
        text: part.text,
        reading: part.reading,
        jaStart: ja,
        jaEnd: ja + part.text.length,
        rdStart: rd,
        rdEnd: rd + h.length,
      });
      ja += part.text.length;
      rd += h.length;
    } else {
      for (let i = 0; i < part.text.length; i++) {
        const ch = part.text[i];
        const h = katakanaToHiragana(ch);
        units.push({ text: ch, jaStart: ja, jaEnd: ja + 1, rdStart: rd, rdEnd: rd + h.length });
        ja += 1;
        rd += h.length;
      }
    }
  }
  return units;
}

function buildReadingIndex(japanese: string, furigana?: string | null): ReadingIndex {
  const units = parseRubyUnits(japanese, furigana);
  const reading = units.map((u) => katakanaToHiragana(u.reading ?? u.text)).join('');
  return { japanese, reading, units };
}

function mapReadingRangeToJa(index: ReadingIndex, rdStart: number, rdEnd: number): Highlight | null {
  if (rdStart >= rdEnd) return null;
  let jaStart = -1;
  let jaEnd = -1;
  for (const u of index.units) {
    if (u.rdStart === rdStart) jaStart = u.jaStart;
    if (u.rdEnd === rdEnd) jaEnd = u.jaEnd;
  }
  if (jaStart < 0 || jaEnd <= jaStart) return null;
  return { start: jaStart, end: jaEnd };
}

function isInsideRubyUnit(index: ReadingIndex, start: number, end: number): boolean {
  for (const u of index.units) {
    if (!u.reading) continue;
    if (start > u.jaStart && start < u.jaEnd) return true;
    if (end > u.jaStart && end < u.jaEnd) return true;
    if (u.text.length > 1 && start >= u.jaStart && end <= u.jaEnd && (start > u.jaStart || end < u.jaEnd)) {
      return true;
    }
  }
  return false;
}

function isSuffixInsideRubyUnit(index: ReadingIndex, start: number, end: number): boolean {
  for (const u of index.units) {
    if (!u.reading) continue;
    if (u.text.length > 1 && start > u.jaStart && end === u.jaEnd) {
      return true;
    }
  }
  return false;
}

function expandOptionalParens(raw: string): string[] {
  const match = JP_OPT_PARENS_RE.exec(raw);
  if (!match) return [raw];
  const withInner = raw.slice(0, match.index) + match[1] + raw.slice(match.index + match[0].length);
  const withoutInner = raw.slice(0, match.index) + raw.slice(match.index + match[0].length);
  return [...new Set([...expandOptionalParens(withInner), ...expandOptionalParens(withoutInner)])];
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function extractSenseHint(pattern: string): string {
  const match = SENSE_PARENS_RE.exec(pattern);
  return match ? match[1].trim().toLowerCase() : '';
}

function extractFormationKeigoHeads(formationEn: string): string[] {
  const heads: string[] = [];
  for (const rawPart of formationEn.split(/[\/／]/u)) {
    const head = rawPart.split(/[（(]/u)[0].trim();
    if (head && PURE_JP_RE.test(head)) heads.push(head);
  }
  return dedupe(heads);
}

function extractPatternVariants(pattern: string, formationEn?: string | null): PatternVariant[] {
  const sense = extractSenseHint(pattern);
  const cleaned = pattern.replace(ASCII_PARENS_RE, '').trim();
  const variants: PatternVariant[] = [];

  for (const rawBranch of cleaned.split(/[\/／]/u)) {
    const branch = rawBranch.trim();
    if (!branch) continue;
    for (const expanded of expandOptionalParens(branch)) {
      const hasLeadingWave = /^[〜～~…]/u.test(expanded);
      const stripped = expanded.replace(WAVE_EDGE_RE, '').trim();
      if (!stripped) continue;
      const slots = stripped
        .split(WAVE_SPLIT_RE)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && PURE_JP_RE.test(s));
      if (!slots.length) continue;
      const allowReorder =
        slots.length === 2 &&
        ((slots[0].includes('\u65b9') && slots[1] === 'より') ||
          (slots[0] === 'より' && slots[1].includes('\u65b9')));
      variants.push({ slots, hasLeadingWave, allowReorder });
    }
  }

  // Augment honorific meta-patterns (sonkeigo / kenjougo) using their formationEn verb lists.
  if (
    formationEn &&
    variants.length === 1 &&
    variants[0].slots.length === 1 &&
    !variants[0].hasLeadingWave &&
    /^\p{Script=Han}{2,}$/u.test(variants[0].slots[0]) &&
    formationEn.includes('/')
  ) {
    for (const head of extractFormationKeigoHeads(formationEn)) {
      variants.push({ slots: [head], hasLeadingWave: false });
    }
  }

  // Augment formation-documented Noun + <suffix> alternatives.
  if (formationEn) {
    for (const m of formationEn.matchAll(NOUN_PLUS_JP_RE)) {
      const suffix = m[1];
      const isExistingSuffix = variants.some(
        (v) => v.slots.length === 1 && v.slots[0].length > suffix.length && v.slots[0].endsWith(suffix),
      );
      if (isExistingSuffix) {
        variants.push({ slots: [suffix], hasLeadingWave: true, priorityPenalty: 30 });
      }
    }
  }

  for (const v of [...variants]) {
    // Augment お〜する / お〜になる with ご〜する / ご〜いたす / お〜いたす / ご〜になる.
    if (v.slots.length === 2 && v.slots[0] === 'お' && v.slots[1] === 'する') {
      variants.push({ slots: ['お', 'いたす'], hasLeadingWave: false });
      variants.push({ slots: ['ご', 'する'], hasLeadingWave: false });
      variants.push({ slots: ['ご', 'いたす'], hasLeadingWave: false });
    }
    if (v.slots.length === 2 && v.slots[0] === 'お' && v.slots[1] === 'になる') {
      variants.push({ slots: ['ご', 'になる'], hasLeadingWave: false });
    }
    // 〜と〜とどちらが often has a comma or omits the second と before どちらが
    if (v.slots.length === 2 && v.slots[0] === 'と' && v.slots[1] === 'とどちらが') {
      variants.push({ slots: ['と', 'と', 'どちらが'], hasLeadingWave: true });
      variants.push({ slots: ['と', 'どちらが'], hasLeadingWave: true });
    }
    // 〜て（reason） also accepts くて and で per formationEn
    if (sense === 'reason' && v.slots.length === 1 && v.slots[0] === 'て') {
      variants.push({ slots: ['くて'], hasLeadingWave: true });
      variants.push({ slots: ['で'], hasLeadingWave: true });
    }
    // Augment you-ni-yotte-wa kanji variant.
    if (v.slots.length === 1 && v.slots[0] === 'ようによっては') {
      variants.push({ slots: ['\u65b9によっては'], hasLeadingWave: true });
    }
    // 〜がある / 〜がいる / 〜をください allow a short counter/quantifier between particle and verb
    if (v.slots.length === 1 && (v.slots[0] === 'がある' || v.slots[0] === 'がいる')) {
      variants.push({
        slots: ['が', v.slots[0].slice(1)],
        hasLeadingWave: true,
        maxGap: 8,
        priorityPenalty: 300,
      });
    }
    if (v.slots.length === 1 && v.slots[0] === 'をください') {
      variants.push({
        slots: ['を', 'ください'],
        hasLeadingWave: true,
        maxGap: 8,
        priorityPenalty: 300,
      });
    }
    // Augment ga-hoshii with mo/wa in negative or contrastive clauses.
    if (v.slots.length === 1 && v.slots[0] === 'がほしい') {
      variants.push({ slots: ['もほしい'], hasLeadingWave: true, priorityPenalty: 25 });
      variants.push({ slots: ['はほしい'], hasLeadingWave: true, priorityPenalty: 25 });
    }
    // Augment you-ni-iu / you-ni-tanomu with reporting verb tsutaeru.
    if (v.slots.length === 1 && v.slots[0] === 'ように\u8a00う') {
      variants.push({ slots: ['ように\u4f1dえる'], hasLeadingWave: true, priorityPenalty: 20 });
    }
    // 〜ことは〜が accepts colloquial けど / けれど / けれども
    if (v.slots.length === 2 && v.slots[0] === 'ことは' && v.slots[1] === 'が') {
      variants.push({ slots: ['ことは', 'けれども'], hasLeadingWave: true, priorityPenalty: 15 });
      variants.push({ slots: ['ことは', 'けれど'], hasLeadingWave: true, priorityPenalty: 15 });
      variants.push({ slots: ['ことは', 'けど'], hasLeadingWave: true, priorityPenalty: 15 });
    }
  }

  return variants;
}

const ICHIDAN_ENDINGS = [
  'ています', 'ていました', 'ていません', 'ていませんでした', 'ている', 'ていた', 'ていない',
  'ませんでした', 'ましょう', 'ました', 'ません', 'ませんか', 'ます', 'なかった', 'なくて',
  'ないで', 'ない', 'たかった', 'たい', 'れば', 'よう', 'られ', 'られる', 'る', 'た', 'て',
];

const SURU_ENDINGS = [
  'しています', 'していました', 'していません', 'している', 'していた', 'していない',
  'しませんでした', 'しましょう', 'しました', 'しません', 'しませんか', 'します',
  'しなかった', 'しなくて', 'しないで', 'しない', 'したかった', 'したい', 'しよう',
  'すれば', 'される', 'された', 'させる', 'させた', 'できる', 'できた', 'する', 'した', 'して',
];

const KURU_KANA_ENDINGS = [
  'きています', 'きていました', 'きている', 'きていた', 'きませんでした', 'きました',
  'きません', 'きます', 'こなかった', 'こない', 'くれば', 'こよう', 'くる', 'きた', 'きて',
];

const KURU_KANJI_ENDINGS = [
  '\u6765ています', '\u6765ている', '\u6765ませんでした', '\u6765ました', '\u6765ません',
  '\u6765ます', '\u6765なかった', '\u6765ない', '\u6765れば', '\u6765よう', '\u6765る',
  '\u6765た', '\u6765て',
];

const IKU_KANA_ENDINGS = [
  'いっています', 'いっている', 'いきませんでした', 'いきましょう', 'いきました',
  'いきません', 'いきます', 'いかなかった', 'いかない', 'いきたい', 'いこう',
  'いけば', 'いく', 'いった', 'いって',
];

const IKU_KANJI_ENDINGS = [
  '\u884cっています', '\u884cっている', '\u884cきませんでした', '\u884cきましょう',
  '\u884cきました', '\u884cきません', '\u884cきます', '\u884cかなかった', '\u884cかない',
  '\u884cきたい', '\u884cこう', '\u884cけば', '\u884cく', '\u884cった', '\u884cって',
];

const IRU_ENDINGS = [
  'いませんでした', 'いました', 'いません', 'います', 'いなかった', 'いなくて', 'いないで',
  'いない', 'いれば', 'いよう', 'いる', 'いた', 'いて',
];

const ARU_ENDINGS = [
  'ありませんでした', 'ありました', 'ありません', 'あります', 'なかった', 'なくて',
  'ない', 'あれば', 'ある', 'あった', 'あって',
];

const NARU_ENDINGS = [
  'なっています', 'なっていた', 'なっている', 'なりませんでした', 'なりました', 'なりません',
  'なります', 'ならなかった', 'ならない', 'なれば', 'なろう', 'なる', 'なった', 'なって',
];

const OKU_ENDINGS = [
  'おきました', 'おきません', 'おきます', 'おかなかった', 'おかない', 'おきましょう',
  'おこう', 'おけば', 'おく', 'おいた', 'おいて',
];

const GODAN_U_ENDINGS = [
  'っています', 'っていました', 'っている', 'っていた', 'いませんでした', 'いました',
  'いません', 'います', 'わなかった', 'わない', 'えます', 'えた', 'える', 'えない',
  'いたい', 'われる', 'われた', 'おう', 'えば', 'う', 'った', 'って', 'い',
];

const GODAN_KU_ENDINGS = [
  'いています', 'いている', 'きませんでした', 'きました', 'きません', 'きます',
  'かなかった', 'かない', 'けませんか', 'けません', 'けます', 'けた', 'ける', 'きたい',
  'けば', 'こう', 'く', 'いた', 'いて', 'き',
];

const GODAN_SU_ENDINGS = [
  'しています', 'している', 'しませんでした', 'しました', 'しません', 'します',
  'さなかった', 'さない', 'したい', 'せば', 'そう', 'す', 'した', 'して', 'し',
];

const GODAN_MU_ENDINGS = [
  'んでいます', 'んでいる', 'みませんでした', 'みました', 'みません', 'みます',
  'まなかった', 'まない', 'まれました', 'まれた', 'まれる', 'めば', 'もう', 'む', 'んだ', 'んで', 'み',
];

const GODAN_RU_ENDINGS = [
  'っています', 'っている', 'りませんでした', 'りました', 'りません', 'ります',
  'らなかった', 'らない', 'れません', 'れます', 'れる', 'れない', 'れば', 'ろう', 'る', 'った', 'って', 'り',
];

const KEIGO_RU_ENDINGS = [
  'いませんでした', 'いませんか', 'いました', 'いません', 'います', 'いませ',
  'なかった', 'らない', 'れば', 'った', 'って', 'る', 'い',
];

const COPULA_DA_ENDINGS = [
  'ではありませんでした', 'じゃありませんでした', 'ではありません', 'じゃありません',
  'ではなかった', 'じゃなかった', 'ではない', 'じゃない', 'ではなく', 'じゃなく',
  'でしょう', 'だろう', 'なのに', 'なので', 'でした', 'だった', 'です', 'なら', 'で', 'だ',
];

const I_ADJ_ENDINGS = [
  'くありませんでした', 'くありません', 'くなかった', 'くないです', 'くない',
  'かったです', 'かった', 'いです', 'くて', 'ければ', 'く', 'い',
];

const DEWANAI_FORMS = [
  'ではありませんでした', 'じゃありませんでした', 'ではありません', 'じゃありません',
  'ではなかった', 'じゃなかった', 'ではなくて', 'じゃなくて', 'ではなく', 'じゃなく',
  'ではない', 'じゃない',
];

const GODAN_RU_STEMS = [
  '\u7d42\u308f',
  '\u5207',
  '\u304c',
  '\u53c2',
  '\u304a',
  '\u9650',
  '\u53ec\u3057\u4e0a\u304c',
  '\u304b\u304b\u308f',
  '\u3042\u305f',
  '\u308f\u305f',
  '\u3081\u3050',
];

const KEIGO_RU_STEMS = [
  '\u304f\u3060\u3055',
  '\u3044\u3089\u3063\u3057\u3083',
  '\u304a\u3063\u3057\u3083',
  '\u306a\u3055',
];

const ICHIDAN_SUFFIX_VERBS = [
  'あげる', 'くれる', 'できる', '\u51fa\u6765\u308b', 'すぎる', '\u904e\u304e\u308b',
  '\u59cb\u3081\u308b', '\u7d9a\u3051\u308b', 'かける', 'かねる', 'みる', '\u898b\u308b',
  '\u5f97\u308b', 'える', 'られる', 'れる', 'させる', 'せる', 'てる', 'でる',
];

const I_ADJ_SUFFIXES = ['ほしい', 'たい', 'やすい', 'にくい', 'っぽい', 'らしい', 'くない'];

function expandBaseSlot(slot: string, isStandaloneNai: boolean): string[] {
  const out: string[] = [slot];

  // 1. Compound & special fixed expressions
  if (slot.endsWith('ではない')) {
    const stem = slot.slice(0, -4);
    for (const f of DEWANAI_FORMS) out.push(stem + f);
    return dedupe(out);
  }
  if (slot === 'ありません' || slot === 'ではありません') {
    for (const f of DEWANAI_FORMS) out.push(f);
    return dedupe(out);
  }
  if (slot === 'じゃない') {
    for (const f of DEWANAI_FORMS) out.push(f);
    return dedupe(out);
  }
  if (slot.endsWith('てしまう')) {
    const stem = slot.slice(0, -4);
    for (const e of GODAN_U_ENDINGS) out.push(stem + 'てしま' + e, stem + 'でしま' + e);
    for (const e of GODAN_U_ENDINGS) out.push(stem + 'ちゃ' + e, stem + 'じゃ' + e);
    return dedupe(out);
  }
  if (slot === 'ちゃう') {
    for (const e of GODAN_U_ENDINGS) out.push('ちゃ' + e, 'じゃ' + e);
    return dedupe(out);
  }
  if (slot.endsWith('ている')) {
    const stem = slot.slice(0, -3);
    for (const e of IRU_ENDINGS) out.push(stem + 'て' + e);
    for (const e of ['てます', 'てました', 'てません', 'てる', 'てた', 'てない']) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('ていない')) {
    const stem = slot.slice(0, -4);
    for (const e of ['ていませんでした', 'ていません', 'ていなかった', 'ていない', 'ていなくて', 'ていないで', 'てません', 'てない']) {
      out.push(stem + e);
    }
    return dedupe(out);
  }
  if (slot.endsWith('ておく')) {
    const stem = slot.slice(0, -3);
    for (const e of OKU_ENDINGS) out.push(stem + 'て' + e);
    for (const e of ['ときます', 'ときました', 'とく', 'といた', 'といて']) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('ていく')) {
    const stem = slot.slice(0, -3);
    for (const e of IKU_KANA_ENDINGS) out.push(stem + 'て' + e);
    for (const e of IKU_KANJI_ENDINGS) out.push(stem + 'て' + e);
    return dedupe(out);
  }
  if (slot.endsWith('てくる')) {
    const stem = slot.slice(0, -3);
    for (const e of KURU_KANA_ENDINGS) out.push(stem + 'て' + e);
    for (const e of KURU_KANJI_ENDINGS) out.push(stem + 'て' + e);
    return dedupe(out);
  }
  if (slot.endsWith('てみる')) {
    const stem = slot.slice(0, -3);
    for (const e of ICHIDAN_ENDINGS) out.push(stem + 'てみ' + e, stem + 'て\u898b' + e);
    return dedupe(out);
  }
  if (slot.endsWith('に\u884cく') || slot.endsWith('にいく')) {
    const stem = slot.slice(0, -2);
    for (const e of IKU_KANA_ENDINGS) out.push(stem + e);
    for (const e of IKU_KANJI_ENDINGS) out.push(stem + e);
    for (const e of KURU_KANJI_ENDINGS) out.push(stem + e);
    for (const e of KURU_KANA_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('ください')) {
    const stem = slot.slice(0, -4);
    out.push(
      stem + 'くださいませんか',
      stem + 'くださいますか',
      stem + 'くださいませ',
      stem + 'ください',
      stem + '\u4e0bさい',
    );
    if (slot === 'させてください') {
      out.push('せてください', 'せてくださいませんか', 'せて\u4e0bさい');
    }
    return dedupe(out);
  }
  if (slot === 'ますように') {
    out.push('ますように', 'ませんように', 'ように');
    return dedupe(out);
  }
  if (slot === 'たらどう') {
    out.push('たらどうでしょうか', 'たらどうですか', 'たらどう');
    return dedupe(out);
  }
  if (slot === 'ものか') {
    out.push('ものですか', 'もんですか', 'ものか', 'もんか');
    return dedupe(out);
  }
  if (slot === 'てからでないと') {
    out.push('てからでないと', 'てからでなければ', 'てからでなきゃ');
    return dedupe(out);
  }
  if (slot === '\u6700\u4e2dに') {
    out.push('\u6700\u4e2dに', '\u6700\u4e2dです', '\u6700\u4e2dだった', '\u6700\u4e2dだ', '\u6700\u4e2d');
    return dedupe(out);
  }
  if (slot === 'を\u4e2d\u5fc3に') {
    out.push('を\u4e2d\u5fc3として', 'を\u4e2d\u5fc3にして', 'を\u4e2d\u5fc3とした', 'を\u4e2d\u5fc3に');
    return dedupe(out);
  }
  if (slot === 'とおりに' || slot === 'どおりに') {
    out.push(slot, slot.slice(0, -1));
    return dedupe(out);
  }
  if (slot === 'んです' || slot === 'のです') {
    const pre = slot[0];
    for (const e of ['んですか', 'のですか', 'んでした', 'のでした', 'んじゃない', 'のではない', 'んです', 'のです', 'んだ', 'のだ']) {
      if (e.startsWith(pre)) out.push(e);
    }
    return dedupe(out);
  }

  // 2. Negative patterns ending in ない
  if (slot === 'ない') {
    if (isStandaloneNai) {
      out.push(
        'ませんでした', 'ません', 'くありません', 'くなかった', 'くない',
        'ではありません', 'じゃありません', 'ではない', 'じゃない',
        'なかったです', 'ないです', 'なかった', 'なくて', 'ないで', 'なければ', 'なく', 'ない',
      );
    } else {
      out.push('なかった', 'なくて', 'ないで', 'なければ', 'なく', 'ないです', 'ない');
    }
    return dedupe(out);
  }
  if (slot.endsWith('てはいけない')) {
    const stem = slot.slice(0, -6);
    out.push(
      stem + 'てはいけません', stem + 'てはいけなかった', stem + 'てはいけない',
      stem + 'ちゃいけません', stem + 'ちゃいけない', stem + 'てはだめ', stem + 'ちゃだめ',
    );
    return dedupe(out);
  }
  if (slot.endsWith('なくてはいけない')) {
    const stem = slot.slice(0, -8);
    out.push(
      stem + 'なくてはいけません', stem + 'なくてはいけなかった', stem + 'なくてはいけない',
      stem + 'なくちゃいけない', stem + 'なくちゃ',
    );
    return dedupe(out);
  }
  if (slot.endsWith('ないといけない')) {
    const stem = slot.slice(0, -7);
    out.push(stem + 'ないといけません', stem + 'ないといけなかった', stem + 'ないといけない');
    return dedupe(out);
  }
  if (slot.endsWith('なければならない')) {
    const stem = slot.slice(0, -8);
    out.push(
      stem + 'なければなりませんでした', stem + 'なければなりません',
      stem + 'なければならなかった', stem + 'なければならない',
    );
    return dedupe(out);
  }
  if (slot.endsWith('ない') && slot.length > 2) {
    const before = slot.slice(0, -2);
    const last = before.at(-1) ?? '';
    out.push(before + 'なかった', before + 'なくて', before + 'ないで', before + 'ないです', before + 'なく');
    if (last === 'ら') {
      const s = before.slice(0, -1);
      out.push(s + 'りませんでした', s + 'りません');
    } else if (last === 'れ' || last === 'け' || last === 'え' || last === 'ぎ' || last === '\u5f97') {
      out.push(before + 'ませんでした', before + 'ません');
    } else if (last === 'か') {
      const s = before.slice(0, -1);
      out.push(s + 'きませんでした', s + 'きません');
    } else if (last === 'わ') {
      const s = before.slice(0, -1);
      out.push(s + 'いませんでした', s + 'いません');
    } else if (last === 'が' || last === 'は') {
      out.push(before + 'ありませんでした', before + 'ありません');
    }
    return dedupe(out);
  }

  // 3. Copula patterns ending in だ
  if (slot.endsWith('だ') && slot.length >= 2) {
    const stem = slot.slice(0, -1);
    for (const e of COPULA_DA_ENDINGS) out.push(stem + e);
    if (stem === 'よう' || stem === 'かのよう' || stem === 'そう' || stem === 'ばかり' || stem === '\u6b21\u7b2c') {
      out.push(stem + 'な', stem + 'に', stem + 'の');
    }
    if (stem === 'はず') {
      out.push('はずがありません', 'はずがない', 'はずはない');
    }
    return dedupe(out);
  }

  // 4. Irregular & regular verb endings
  if (slot.endsWith('する')) {
    const stem = slot.slice(0, -2);
    for (const e of SURU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('いる')) {
    const stem = slot.slice(0, -2);
    for (const e of IRU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('ある')) {
    const stem = slot.slice(0, -2);
    for (const e of ARU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('なる')) {
    const stem = slot.slice(0, -2);
    for (const e of NARU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('くる') || slot.endsWith('\u6765\u308b')) {
    const stem = slot.slice(0, -2);
    for (const e of KURU_KANA_ENDINGS) out.push(stem + e);
    for (const e of KURU_KANJI_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.endsWith('いく') || slot.endsWith('\u884c\u304f')) {
    const stem = slot.slice(0, -2);
    for (const e of IKU_KANA_ENDINGS) out.push(stem + e);
    for (const e of IKU_KANJI_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  for (const kStem of KEIGO_RU_STEMS) {
    if (slot.endsWith(kStem + 'る')) {
      const stem = slot.slice(0, -1);
      for (const e of KEIGO_RU_ENDINGS) out.push(stem + e);
      return dedupe(out);
    }
  }
  for (const gStem of GODAN_RU_STEMS) {
    if (slot.endsWith(gStem + 'る')) {
      const stem = slot.slice(0, -1);
      for (const e of GODAN_RU_ENDINGS) out.push(stem + e);
      return dedupe(out);
    }
  }
  for (const v of ICHIDAN_SUFFIX_VERBS) {
    if (slot.endsWith(v)) {
      const stem = slot.slice(0, -1);
      for (const e of ICHIDAN_ENDINGS) out.push(stem + e);
      if (v === 'かける') out.push(stem + 'の');
      if (v === '\u5f97\u308b') {
        const s = slot.slice(0, -2);
        out.push(s + 'うる', s + 'える', s + 'えた', s + 'えます', s + '\u5f97ます', s + '\u5f97た');
      }
      return dedupe(out);
    }
  }
  if (slot.length >= 2 && slot.endsWith('う') && !/[おこごそぞとどのほぼもろよ]う$/u.test(slot)) {
    const stem = slot.slice(0, -1);
    for (const e of GODAN_U_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.length >= 2 && slot.endsWith('く') && !slot.endsWith('なく') && !slot.endsWith('にくく')) {
    const stem = slot.slice(0, -1);
    for (const e of GODAN_KU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.length >= 2 && slot.endsWith('す') && !slot.endsWith('です') && !slot.endsWith('ます')) {
    const stem = slot.slice(0, -1);
    for (const e of GODAN_SU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }
  if (slot.length >= 2 && slot.endsWith('む')) {
    const stem = slot.slice(0, -1);
    for (const e of GODAN_MU_ENDINGS) out.push(stem + e);
    return dedupe(out);
  }

  // 5. Participial / te-form grammar expressions
  if (slot.length >= 3 && slot.endsWith('して')) {
    const stem = slot.slice(0, -2);
    out.push(stem + 'しての', stem + 'して', stem + 'する', stem + 'した', stem + 'し');
    return dedupe(out);
  }
  if (slot.length >= 3 && slot.endsWith('って')) {
    const stem = slot.slice(0, -2);
    out.push(
      stem + 'って', stem + 'った', stem + 'う', stem + 'い',
      stem + 'る', stem + 'り', stem + 'つ', stem + 'ち',
    );
    return dedupe(out);
  }
  if (slot.length >= 3 && slot.endsWith('いて')) {
    const stem = slot.slice(0, -2);
    out.push(stem + 'いて', stem + 'いた', stem + 'く', stem + 'き');
    return dedupe(out);
  }
  if (slot.length >= 3 && /[えけじべ]て$/u.test(slot)) {
    const stem = slot.slice(0, -1);
    out.push(stem + 'て', stem + 'た', stem + 'る', stem);
    return dedupe(out);
  }
  if (slot.endsWith('ずに')) {
    out.push(slot, slot.slice(0, -1));
    return dedupe(out);
  }

  // 6. i-Adjective grammar suffixes
  for (const adj of I_ADJ_SUFFIXES) {
    if (slot.endsWith(adj)) {
      const stem = slot.slice(0, -1);
      for (const e of I_ADJ_ENDINGS) out.push(stem + e);
      return dedupe(out);
    }
  }

  return dedupe(out);
}

function expandSlotForms(slot: string, allowVoicing: boolean, isStandaloneNai: boolean): string[] {
  const base = expandBaseSlot(slot, isStandaloneNai);
  const forms: string[] = [...base];

  if (allowVoicing && slot.startsWith('て')) {
    for (const f of base) {
      if (f.startsWith('て')) forms.push('で' + f.slice(1));
    }
  } else if (allowVoicing && slot.startsWith('た')) {
    for (const f of base) {
      if (f.startsWith('た')) forms.push('だ' + f.slice(1));
    }
  }

  // Sort: exact slot first, then longer forms before shorter forms so greedy conjugation wins.
  const uniq = dedupe(forms);
  return uniq.sort((a, b) => {
    if (a === slot && b !== slot) return -1;
    if (b === slot && a !== slot) return 1;
    return b.length - a.length;
  });
}

function findDirectMatches(
  index: ReadingIndex,
  form: string,
  allowRubySuffix = false,
): { range: Highlight; rubySuffix: boolean }[] {
  const matches: { range: Highlight; rubySuffix: boolean }[] = [];
  const ja = index.japanese;
  let pos = 0;
  while ((pos = ja.indexOf(form, pos)) >= 0) {
    const end = pos + form.length;
    if (!isInsideRubyUnit(index, pos, end)) {
      matches.push({ range: { start: pos, end }, rubySuffix: false });
    } else if (
      allowRubySuffix &&
      form.length === 1 &&
      HAS_KANJI_RE.test(form) &&
      isSuffixInsideRubyUnit(index, pos, end)
    ) {
      matches.push({ range: { start: pos, end }, rubySuffix: true });
    }
    pos += 1;
  }
  return matches;
}

function findReadingMatches(index: ReadingIndex, form: string): Highlight[] {
  const kanaForm = toKanaReading(form);
  if (!kanaForm || HAS_KANJI_RE.test(kanaForm)) return [];
  const matches: Highlight[] = [];
  const rd = index.reading;
  let pos = 0;
  while ((pos = rd.indexOf(kanaForm, pos)) >= 0) {
    const mapped = mapReadingRangeToJa(index, pos, pos + kanaForm.length);
    if (mapped) matches.push(mapped);
    pos += 1;
  }
  return matches;
}

const isEndPunct = (c: string) => !c || /[。！？!?\s」』]/u.test(c);

function scoreFormMatch(
  japanese: string,
  match: Highlight,
  form: string,
  slot: string,
  sense: string,
): number {
  const prev = match.start > 0 ? japanese[match.start - 1] : '';
  const next = match.end < japanese.length ? japanese[match.end] : '';
  const afterNext = match.end + 1 < japanese.length ? japanese[match.end + 1] : '';
  let score = 0;

  if (form.length === 2 && slot === 'くて' && sense === 'reason') {
    if (next === '、') score += 12;
    return score;
  }

  if (slot === 'たい' && form.startsWith('たい')) {
    if (/[いきぎしじちびみにりえけげせぜてでねへべめれ]/u.test(prev)) score += 14;
    if (isEndPunct(next) || /[とかねよのがけ]/u.test(next) || japanese.slice(match.end, match.end + 2) === 'です') {
      score += 12;
    }
    if (prev === '\u51b7' || prev === '\u91cd' || prev === '\u7720' || prev === '\u5e73') {
      score -= 25;
    }
    return score;
  }

  if (form.length !== 1) return 0;

  // Prefer matches right after kanji/katakana/digits (strong particle boundary)
  if (/[\p{Script=Han}\p{Script=Katakana}0-9０-９]/u.test(prev)) score += 3;
  // Penalize matching at index 0 for wave-prefixed suffixes/particles
  if (match.start === 0) score -= 10;

  if (form === 'か') {
    if (sense === 'question') {
      if (isEndPunct(next)) score += 20;
    } else if (sense === 'or') {
      if (!isEndPunct(next)) score += 10;
    } else if (sense.includes('embedded')) {
      if (!isEndPunct(next) && /[どう\u77e5\u5206\u6559\u899a\u805e\u898b]/u.test(japanese.slice(match.end, match.end + 4))) {
        score += 12;
      }
      if (!isEndPunct(next)) score += 5;
    }
  } else if (form === 'な') {
    if (sense === 'prohibition') {
      if (isEndPunct(next)) score += 20;
    } else if (sense.includes('na-adjective')) {
      if (next && !/[いくかっんのと。！？!?\s]/u.test(next)) score += 15;
      else score -= 8;
    }
  } else if (form === 'が' && sense === 'but') {
    if (next === '、' || next === '，') score += 20;
  } else if (form === 'ね' || form === 'よ') {
    if (isEndPunct(next)) score += 20;
  } else if (form === 'し') {
    if (next === '、' || isEndPunct(next)) score += 15;
    if (next === 'ま' || next === 'た' || next === 'て') score -= 10;
  } else if (form === 'た' || form === 'だ') {
    if (isEndPunct(next) || next === '、') score += 15;
    if (form === 'た' && (next === 'い' || next === 'め' || next === 'ち')) score -= 6;
  } else if (form === 'て' || form === 'で') {
    if (next === '、') score += 12;
    if (next === 'も' && sense !== 'even') score -= 3;
    if (prev === 'と' && next === 'も') score -= 12;
  } else if (form === 'は') {
    if (next === 'い' && afterNext === '。') score -= 10;
    if (prev === 'お' && next === 'よ') score -= 15;
  } else if (form === 'に' && sense === 'destination') {
    if (/[\u884c\u6765\u5e30\u7740\u5165\u51faいきかえ]/u.test(next)) score += 12;
  } else if (form === 'の') {
    if (/[\p{Script=Han}\p{Script=Katakana}]/u.test(next)) score += 4;
  }

  return score;
}

function findSlotOccurrences(
  index: ReadingIndex,
  slot: string,
  allowVoicing: boolean,
  isStandaloneNai: boolean,
  sense: string,
): { range: Highlight; priority: number }[] {
  const forms = expandSlotForms(slot, allowVoicing, isStandaloneNai);
  const byKey = new Map<string, { range: Highlight; priority: number }>();

  const add = (range: Highlight, priority: number) => {
    const key = `${range.start}:${range.end}`;
    const existing = byKey.get(key);
    if (!existing || priority > existing.priority) {
      byKey.set(key, { range, priority });
    }
  };

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    const isExact = form === slot;
    const extendsExact = !isExact && slot.length >= 2 && form.startsWith(slot);
    const basePriority = (isExact || extendsExact ? 200 : 100) + form.length * 4 - i * 0.01;
    const direct = findDirectMatches(index, form, allowVoicing);
    for (const hit of direct) {
      const m = hit.range;
      const bonus = scoreFormMatch(index.japanese, m, form, slot, sense);
      const rubyPenalty = hit.rubySuffix ? -35 : 0;
      if (allowVoicing && m.start === 0 && form.length <= 2) continue;
      add(m, basePriority + bonus + rubyPenalty);
    }
    if (direct.length === 0 && form.length >= 2) {
      const readingMatches = findReadingMatches(index, form);
      for (const m of readingMatches) {
        if (allowVoicing && m.start === 0 && m.end - m.start <= 1) continue;
        add(m, basePriority - 20);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.priority - a.priority || a.range.start - b.range.start);
}

function findMultiSlotChain(
  index: ReadingIndex,
  variant: PatternVariant,
  sense: string,
): { ranges: Highlight[]; score: number } | null {
  const slotLists = variant.slots.map((slot, idx) => {
    const allowVoicing = (idx === 0 && variant.hasLeadingWave) || idx > 0;
    const isStandaloneNai = slot === 'ない';
    return findSlotOccurrences(index, slot, allowVoicing, isStandaloneNai, sense);
  });
  if (slotLists.some((list) => list.length === 0)) return null;

  let best: { ranges: Highlight[]; score: number } | null = null;
  const maxGap = variant.maxGap ?? 40;
  const penalty = variant.priorityPenalty ?? 0;

  const search = (depth: number, prevEnd: number, chosen: Highlight[], accPriority: number) => {
    if (depth === slotLists.length) {
      const span = chosen[chosen.length - 1].end - chosen[0].start;
      const totalScore = accPriority - span * 0.25 - penalty;
      if (!best || totalScore > best.score) {
        best = { ranges: [...chosen], score: totalScore };
      }
      return;
    }
    const candidates = slotLists[depth].slice(0, 10);
    for (const cand of candidates) {
      if (depth > 0 && cand.range.start < prevEnd) continue;
      if (depth > 0 && cand.range.start - prevEnd > maxGap) continue;
      if (
        depth === 1 &&
        (variant.slots[0] === 'お' || variant.slots[0] === 'ご') &&
        (cand.range.start - prevEnd < 1 || cand.range.start - prevEnd > 12)
      ) {
        continue;
      }
      chosen.push(cand.range);
      search(depth + 1, cand.range.end, chosen, accPriority + cand.priority);
      chosen.pop();
    }
  };

  search(0, 0, [], 0);
  return best;
}

function resolveInflectionalSpecials(
  pattern: string,
  index: ReadingIndex,
): Highlight[] | null {
  const ja = index.japanese;
  const sense = extractSenseHint(pattern);

  // 1. Potential: 〜える / 〜られる（potential）
  if (pattern.includes('える') && pattern.includes('られる') && sense === 'potential') {
    const re =
      /(?:られ(?:る|ます|ました|た|て|ない|ません|なかった|ませんでした)|でき(?:る|ます|ました|た|て|ない|ません|なかった|ませんでした)|[えけげせぜてでねへべめれ](?:る|ます|ました|た|て|ない|ません|なかった|ませんでした))/gu;
    let best: Highlight | null = null;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start === 0 && !m[0].startsWith('でき')) continue;
      if (isInsideRubyUnit(index, start, end)) continue;
      const prev = start > 0 ? ja[start - 1] : '';
      if ((m[0].startsWith('て') || m[0].startsWith('で')) && /[\p{Script=Hiragana}]/u.test(prev)) {
        if (!/[っんい]/u.test(prev) && m[0].startsWith('てる')) continue;
      }
      best = { start, end };
    }
    if (best) return [best];
  }

  // 2. Passive: 〜れる / 〜られる（passive）
  if (pattern.includes('れる') && pattern.includes('られる') && sense === 'passive') {
    const re =
      /(?:られ|され|れ)(?:る|ます|ました|た|て|ない|ません|なかった|ませんでした)/gu;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start === 0 || isInsideRubyUnit(index, start, end)) continue;
      return [{ start, end }];
    }
  }

  // 3. Causative-passive: 〜せられる / 〜させられる
  if (pattern.includes('せられる') && pattern.includes('させられる')) {
    const re =
      /(?:させられ|せられ|され)(?:る|ます|ました|た|て|ない|ません|なかった|ませんでした)/gu;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start === 0 || isInsideRubyUnit(index, start, end)) continue;
      return [{ start, end }];
    }
  }

  // 4. Causative: 〜せる / 〜させる
  if (pattern.includes('せる') && pattern.includes('させる')) {
    const re =
      /(?:させ|せ)(?:る|ます|ました|た|て|ない|ません|なかった|ませんでした)/gu;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start === 0 || isInsideRubyUnit(index, start, end)) continue;
      return [{ start, end }];
    }
  }

  // 5. Volitional: 〜おう / 〜よう
  if (pattern.includes('おう') && pattern.includes('よう')) {
    const re = /(?:ましょう|よう|[おこごそぞとどのほぼもろ]う)(?=[とかなよよね。！？!?\s」』]|$)/gu;
    let best: Highlight | null = null;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start === 0 || isInsideRubyUnit(index, start, end)) continue;
      if (m[0] === 'そう' && ja[start - 1] && /[いし]/u.test(ja[start - 1])) continue;
      best = { start, end };
    }
    if (best) return [best];
  }

  // 6. Imperative: 〜え / 〜ろ
  if (/〜え\s*\/\s*〜ろ/u.test(pattern)) {
    const re = /(?:しろ|せよ|こい|\u6765い|ろ|よ|[えけげせぜてでねへべめれ])(?=[！!。?？…」』\s]|$)/gu;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start === 0 || isInsideRubyUnit(index, start, end)) continue;
      return [{ start, end }];
    }
  }

  // 7. na-adjective predicate fallback (〜な（na-adjective） when example uses です/でした/ではありません)
  if (sense.includes('na-adjective')) {
    const naMatch = findSlotOccurrences(index, 'な', true, false, sense);
    const strongNa = naMatch.find((m) => m.priority >= 210);
    if (strongNa) return [strongNa.range];
    const predRe = /(?:ではありません|じゃありません|ではない|じゃない|でした|です)(?=[。！？!?\s」』]|$)/gu;
    for (const m of ja.matchAll(predRe)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start > 0 && !isInsideRubyUnit(index, start, end)) {
        return [{ start, end }];
      }
    }
  }

  // 8. volitional + to-omou when verb is godan
  if (pattern.includes('うと\u601d')) {
    const re =
      /(?:よう|[おこごそぞとどのほぼもろ]う)と(?:\u601d|おも)(?:っています|っていました|っている|っていた|います|いました|った|う|って)/gu;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start > 0 && !isInsideRubyUnit(index, start, end)) {
        return [{ start, end }];
      }
    }
  }

  // 9. 〜（よ）うではないか when verb is godan volitional
  if (pattern.includes('うではないか')) {
    const re = /(?:よう|[おこごそぞとどのほぼもろ]う)(?:ではないか|じゃないか|ではありませんか|じゃありませんか)/gu;
    for (const m of ja.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (start > 0 && !isInsideRubyUnit(index, start, end)) {
        return [{ start, end }];
      }
    }
  }

  // 10. もう〜た when verb is polite past 〜ました / 〜ませんでした
  if (pattern === 'もう〜た') {
    const mou = findDirectMatches(index, 'もう')[0]?.range;
    if (mou) {
      const tailRe = /(?:ました|ませんでした|た|だ)(?=[。！？!?かよよね\s」』]|$)/gu;
      for (const m of ja.matchAll(tailRe)) {
        const start = m.index!;
        const end = start + m[0].length;
        if (start > mou.end && !isInsideRubyUnit(index, start, end)) {
          return [mou, { start, end }];
        }
      }
    }
  }

  // 11. 〜たら〜た when second verb is polite past 〜ました or plain past 〜た/〜だ
  if (pattern === '〜たら〜た') {
    const taraMatches = [
      ...findDirectMatches(index, 'たら').map((h) => h.range),
      ...findDirectMatches(index, 'だら').map((h) => h.range),
    ].sort((a, b) => a.start - b.start);
    if (taraMatches.length > 0) {
      const first = taraMatches[0];
      const tailRe = /(?:ました|た|だ)(?=[。！？!?かよよね\s」』]|$)/gu;
      for (const m of ja.matchAll(tailRe)) {
        const start = m.index!;
        const end = start + m[0].length;
        if (start > first.end && !isInsideRubyUnit(index, start, end)) {
          return [first, { start, end }];
        }
      }
    }
  }

  // 12. 〜ば〜ほど when verb/i-adj uses ば or na-adj uses なら
  if (pattern === '〜ば〜ほど') {
    const hodo = findDirectMatches(index, 'ほど')[0]?.range ?? findReadingMatches(index, 'ほど')[0];
    if (hodo) {
      const ba = findDirectMatches(index, 'ば')
        .map((h) => h.range)
        .find((m) => m.end < hodo.start);
      if (ba) return [ba, hodo];
      const nara = findDirectMatches(index, 'なら')
        .map((h) => h.range)
        .find((m) => m.end < hodo.start);
      if (nara) return [nara, hodo];
    }
  }

  return null;
}

export function resolveGrammarHighlights(
  pattern: string,
  japanese: string,
  furigana?: string | null,
  formationEn?: string | null,
): Highlight[] {
  if (!pattern?.trim() || !japanese?.trim()) return [];
  const index = buildReadingIndex(japanese, furigana);

  const special = resolveInflectionalSpecials(pattern, index);
  if (special?.length) return special;

  const sense = extractSenseHint(pattern);
  const variants = extractPatternVariants(pattern, formationEn);
  if (!variants.length) return [];

  let best: { ranges: Highlight[]; score: number } | null = null;

  for (const variant of variants) {
    const penalty = variant.priorityPenalty ?? 0;
    if (variant.slots.length === 1) {
      const slot = variant.slots[0];
      const occs = findSlotOccurrences(index, slot, variant.hasLeadingWave, slot === 'ない', sense);
      if (occs.length > 0) {
        const top = occs[0];
        const score = top.priority - penalty;
        if (!best || score > best.score) {
          best = { ranges: [top.range], score };
        }
      }
    } else {
      const chain = findMultiSlotChain(index, variant, sense);
      if (chain && (!best || chain.score > best.score)) {
        best = chain;
      }
      if (variant.allowReorder && variant.slots.length === 2) {
        const reversed = findMultiSlotChain(
          index,
          { ...variant, slots: [variant.slots[1], variant.slots[0]] },
          sense,
        );
        if (reversed && (!best || reversed.score > best.score)) {
          best = reversed;
        }
      }
    }
  }

  if (!best) return [];
  const sorted = best.ranges
    .filter((r) => r.start >= 0 && r.end > r.start && r.end <= japanese.length)
    .sort((a, b) => a.start - b.start);
  const merged: Highlight[] = [];
  for (const r of sorted) {
    const prev = merged.at(-1);
    if (prev && r.start <= prev.end) prev.end = Math.max(prev.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

/**
 * Exact replica of the legacy `<Furigana focus={focusOf(pattern)}>` highlighting behavior
 * (before `resolveGrammarHighlights`), used for before/after coverage auditing.
 */
export function legacyFocusHighlights(
  pattern: string,
  japanese: string,
  furigana?: string | null,
): Highlight[] {
  const focus = pattern
    .replace(/^[〜～~…\s]+/u, '')
    .split(/[（(]/u)[0]
    .trim();
  const validFocus =
    focus && /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+$/u.test(focus)
      ? focus
      : null;
  if (!validFocus) return [];

  const parts: { text: string; reading?: string }[] = [];
  if (!furigana) {
    parts.push({ text: japanese });
  } else {
    let end = 0;
    for (const match of furigana.matchAll(/\{([^|{}]+)\|([^{}]+)\}/gu)) {
      if (match.index! > end) parts.push({ text: furigana.slice(end, match.index) });
      parts.push({ text: match[1], reading: match[2] });
      end = match.index! + match[0].length;
    }
    if (end < furigana.length) parts.push({ text: furigana.slice(end) });
    if (!parts.length || parts.map((p) => p.text).join('') !== japanese) {
      parts.length = 0;
      parts.push({ text: japanese });
    }
  }

  const ranges: Highlight[] = [];
  let pos = 0;
  for (const part of parts) {
    const start = pos;
    pos += part.text.length;
    if (part.text === validFocus) {
      ranges.push({ start, end: pos });
    } else if (!part.reading) {
      let idx = part.text.indexOf(validFocus);
      while (idx >= 0) {
        ranges.push({ start: start + idx, end: start + idx + validFocus.length });
        idx = part.text.indexOf(validFocus, idx + validFocus.length);
      }
    }
  }
  return ranges;
}

function violatesSenseBoundary(
  range: Highlight,
  japanese: string,
  pattern: string,
): boolean {
  const sense = extractSenseHint(pattern);
  const text = japanese.slice(range.start, range.end);
  const prev = range.start > 0 ? japanese[range.start - 1] : '';
  const next = range.end < japanese.length ? japanese[range.end] : '';

  if (text === 'か' && sense === 'question' && !isEndPunct(next)) return true;
  if (text === 'な' && sense === 'prohibition' && !isEndPunct(next)) return true;
  if (
    pattern === '〜たい' &&
    text === 'たい' &&
    (prev === '\u51b7' || prev === '\u91cd' || prev === '\u7720' || prev === '\u5e73')
  ) {
    return true;
  }
  return false;
}

function rangeMatchesAnyPatternForm(
  range: Highlight,
  index: ReadingIndex,
  pattern: string,
  formationEn?: string | null,
): boolean {
  if (violatesSenseBoundary(range, index.japanese, pattern)) {
    return false;
  }

  const text = index.japanese.slice(range.start, range.end);
  const readingParts: string[] = [];
  for (const u of index.units) {
    if (u.jaEnd > range.start && u.jaStart < range.end) {
      readingParts.push(katakanaToHiragana(u.reading ?? u.text));
    }
  }
  const markedReading = readingParts.join('');
  const sense = extractSenseHint(pattern);

  const special = resolveInflectionalSpecials(pattern, index);
  if (special?.some((s) => s.start <= range.end && s.end >= range.start)) {
    return true;
  }

  const variants = extractPatternVariants(pattern, formationEn);
  for (const variant of variants) {
    for (let i = 0; i < variant.slots.length; i++) {
      const slot = variant.slots[i];
      const allowVoicing = (i === 0 && variant.hasLeadingWave) || i > 0;
      const forms = expandSlotForms(slot, allowVoicing, slot === 'ない');
      for (const form of forms) {
        if (text === form || text.endsWith(form)) return true;
        const kanaForm = toKanaReading(form);
        if (kanaForm && !HAS_KANJI_RE.test(kanaForm)) {
          if (markedReading === kanaForm || markedReading.endsWith(kanaForm)) return true;
        }
      }
    }
  }

  if (sense && text.length === 1 && variants.some((v) => v.slots.includes(text))) {
    return true;
  }

  return false;
}

/**
 * Audits highlight ranges (fixed supplement ranges or computed ranges) for a grammar example.
 * Detects empty, out-of-bounds, overlapping, whole-sentence, or pattern-mismatched ranges.
 */
export function auditGrammarHighlight(input: {
  pattern: string;
  japanese: string;
  furigana?: string | null;
  formationEn?: string | null;
  highlights: Highlight[] | undefined;
}): HighlightAuditResult {
  const { pattern, japanese, furigana, formationEn, highlights } = input;
  if (!highlights || highlights.length === 0) {
    return { status: 'none', reasons: [], matchedTexts: [] };
  }

  const reasons = new Set<HighlightMismatchReason>();
  const matchedTexts: string[] = [];

  for (let i = 0; i < highlights.length; i++) {
    const r = highlights[i];
    if (
      !Number.isInteger(r.start) ||
      !Number.isInteger(r.end) ||
      r.start < 0 ||
      r.end > japanese.length
    ) {
      reasons.add('out_of_bounds');
      continue;
    }
    if (r.start >= r.end) {
      reasons.add('empty');
      continue;
    }
    if (i > 0 && Number.isInteger(highlights[i - 1].end) && r.start < highlights[i - 1].end) {
      reasons.add('overlapping');
    }
    const slice = japanese.slice(r.start, r.end);
    matchedTexts.push(slice);
    if (!slice.replace(PUNCT_RE, '').length) {
      reasons.add('empty');
    }
  }

  const bodyLen = japanese.replace(PUNCT_RE, '').length;
  const markedBodyLen = matchedTexts.reduce(
    (sum, s) => sum + s.replace(PUNCT_RE, '').length,
    0,
  );
  if (bodyLen > 0 && markedBodyLen >= bodyLen) {
    reasons.add('whole_sentence');
  }

  if (!reasons.has('out_of_bounds') && !reasons.has('empty')) {
    const index = buildReadingIndex(japanese, furigana);
    const allValid = highlights.every((r) =>
      rangeMatchesAnyPatternForm(r, index, pattern, formationEn),
    );
    if (!allValid) {
      reasons.add('pattern_mismatch');
    }
  }

  return {
    status: reasons.size > 0 ? 'mismatch' : 'ok',
    reasons: [...reasons],
    matchedTexts,
  };
}
