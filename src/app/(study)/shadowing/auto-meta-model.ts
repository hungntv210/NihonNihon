export const MAX_CLIP_TAGS = 12;
export const MAX_CLIP_TAG_LENGTH = 40;
export const MAX_SEGMENT_FURIGANA_LENGTH = 1200;
export const MIN_ROADMAP_WEEK = 1;
export const MAX_ROADMAP_WEEK = 87;

export type FuriganaPart = {
  text: string;
  reading?: string;
};

export type PositionedFuriganaPart = FuriganaPart & {
  start: number;
  end: number;
};

export type RoadmapStage = {
  level: 'N5' | 'N4' | 'N3' | 'N2';
  start: number;
  end: number;
  theme: string;
};

export const ROADMAP_STAGES: readonly RoadmapStage[] = [
  { level: 'N5', start: 1, end: 12, theme: 'Nền tảng và sinh hoạt' },
  { level: 'N4', start: 13, end: 35, theme: 'Cuộc sống và công việc' },
  { level: 'N3', start: 36, end: 57, theme: 'Kết nối và diễn đạt' },
  { level: 'N2', start: 58, end: 87, theme: 'Đọc hiểu và lập luận' },
] as const;

export type AutoMetaWeekCandidate = {
  week: number;
  level: string;
  theme: string;
  matchedCount: number;
  matchedLabels: string[];
};

export type ClipAutoMetaResult = {
  segments: {
    ja: string;
    furigana: string;
    kana: string;
  }[];
  suggestedLevel: string | null;
  suggestedTags: string[];
  suggestedWeek: number | null;
  suggestedWeekReason: string | null;
  weekCandidates: AutoMetaWeekCandidate[];
  matchedSummary: {
    vocabCount: number;
    grammarCount: number;
    kanjiCount: number;
  };
  machineTranslationAvailable: false;
};

export function roadmapWeekInfo(week: number): { week: number; level: string; theme: string } | null {
  if (!Number.isSafeInteger(week) || week < MIN_ROADMAP_WEEK || week > MAX_ROADMAP_WEEK) {
    return null;
  }
  const stage = ROADMAP_STAGES.find((s) => week >= s.start && week <= s.end);
  if (!stage) return null;
  return { week, level: stage.level, theme: stage.theme };
}

export function normalizeRoadmapWeek(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (!Number.isSafeInteger(num) || num < MIN_ROADMAP_WEEK || num > MAX_ROADMAP_WEEK) {
    return null;
  }
  return num;
}

export function normalizeClipTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const cleaned = item.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length > MAX_CLIP_TAG_LENGTH) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_CLIP_TAGS) break;
  }
  return out;
}

/**
 * Parses `{base|reading}` notation into plain/ruby segments.
 * Returns null if the notation has malformed braces or does not reconstruct `japanese`.
 */
export function parseFuriganaNotationStrict(japanese: string, notation: string): FuriganaPart[] | null {
  const ja = japanese.normalize('NFC');
  const raw = notation.normalize('NFC');
  if (!raw) return ja ? null : [];
  const parts: FuriganaPart[] = [];
  let i = 0;
  let plain = '';

  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '}') return null;
    if (ch === '{') {
      if (plain) {
        parts.push({ text: plain });
        plain = '';
      }
      const close = raw.indexOf('}', i + 1);
      if (close < 0) return null;
      const body = raw.slice(i + 1, close);
      if (body.includes('{')) return null;
      const sep = body.indexOf('|');
      if (sep <= 0 || sep !== body.lastIndexOf('|') || sep === body.length - 1) {
        return null;
      }
      const base = body.slice(0, sep);
      const reading = body.slice(sep + 1).trim();
      if (!base || !reading) return null;
      parts.push({ text: base, reading });
      i = close + 1;
    } else {
      plain += ch;
      i++;
    }
  }
  if (plain) parts.push({ text: plain });
  const reconstructed = parts.map((p) => p.text).join('');
  if (reconstructed !== ja) return null;
  return parts;
}

export function parseFuriganaNotation(japanese: string, notation: string | null | undefined): FuriganaPart[] {
  if (!notation || !notation.trim()) return [{ text: japanese }];
  return parseFuriganaNotationStrict(japanese, notation.trim()) ?? [{ text: japanese }];
}

export function parsePositionedFurigana(
  japanese: string,
  notation: string | null | undefined,
): PositionedFuriganaPart[] | null {
  if (!notation || !notation.trim()) return null;
  const parts = parseFuriganaNotationStrict(japanese, notation.trim());
  if (!parts) return null;
  let offset = 0;
  return parts.map((part) => {
    const start = offset;
    offset += part.text.length;
    return { ...part, start, end: offset };
  });
}

export function sliceFuriganaRange(
  parts: readonly PositionedFuriganaPart[],
  rangeStart: number,
  rangeEnd: number,
): FuriganaPart[] {
  const out: FuriganaPart[] = [];
  for (const part of parts) {
    if (part.end <= rangeStart || part.start >= rangeEnd) continue;
    if (part.reading && part.start >= rangeStart && part.end <= rangeEnd) {
      out.push({ text: part.text, reading: part.reading });
    } else {
      const from = Math.max(0, rangeStart - part.start);
      const to = Math.min(part.text.length, rangeEnd - part.start);
      const slice = part.text.slice(from, to);
      if (slice) out.push({ text: slice });
    }
  }
  return out;
}

export function validateFuriganaNotation(
  japanese: string,
  notation: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (notation === null || notation === undefined) return { ok: true, value: null };
  if (typeof notation !== 'string') {
    return { ok: false, message: 'Định dạng furigana không hợp lệ.' };
  }
  const trimmed = notation.normalize('NFC').trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_SEGMENT_FURIGANA_LENGTH) {
    return { ok: false, message: 'Chuỗi furigana quá dài.' };
  }
  const parsed = parseFuriganaNotationStrict(japanese.normalize('NFC').trim(), trimmed);
  if (!parsed) {
    return {
      ok: false,
      message: 'Furigana chưa khớp câu tiếng Nhật (dùng cú pháp {base|reading} và giữ nguyên chữ gốc).',
    };
  }
  return { ok: true, value: trimmed };
}

export function furiganaToKana(notation: string): string {
  return notation
    .normalize('NFC')
    .replace(/\{[^|{}]+\|([^{}]+)\}/gu, (_match, reading: string) => reading.trim());
}
