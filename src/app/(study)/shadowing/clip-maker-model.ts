export const MAX_CLIP_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MiB (safely under Next 16 proxy 10 MiB cap)
export const MAX_SUBTITLE_BYTES = 1024 * 1024; // 1 MiB
export const MIN_CLIP_SPAN_MS = 1_000;
export const MAX_CLIP_SPAN_MS = 60_000;
export const MAX_SOURCE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
export const MIN_SEGMENT_MS = 100;
export const MAX_CLIP_SEGMENTS = 40;
export const CLIP_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export const ALLOWED_UPLOAD_MIMES = [
  'video/mp4',
  'video/webm',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIMES)[number];

export type SubtitleCue = {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string | null;
};

export type SubtitleParseError = {
  line: number;
  reason: string;
};

export type SubtitleParseResult = {
  format: 'srt' | 'ass';
  cues: SubtitleCue[];
  errors: SubtitleParseError[];
};

export type DraftSegment = {
  id: string;
  startMs: number;
  endMs: number;
  ja: string;
  kana?: string | null;
  speaker?: string | null;
  vi?: string | null;
};

export type ClipDraftInput = {
  kind: 'file' | 'youtube';
  title: string;
  level?: string;
  topic?: string;
  durationMs: number;
  clipStartMs: number;
  clipEndMs: number;
  youtubeUrlOrId?: string;
  segments: DraftSegment[];
};

export type NormalizedClipDraft = {
  kind: 'file' | 'youtube';
  title: string;
  level: string;
  topic: string;
  durationMs: number;
  clipStartMs: number;
  clipEndMs: number;
  youtubeId: string | null;
  segments: {
    id: string;
    startMs: number;
    endMs: number;
    ja: string;
    kana: string | null;
    speaker: string | null;
    vi: string | null;
  }[];
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function normalizeUploadMime(raw: string | null | undefined): AllowedUploadMime | null {
  if (!raw) return null;
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'audio/x-m4a' || base === 'audio/m4a') return 'audio/mp4';
  if (base === 'audio/x-wav' || base === 'audio/wave') return 'audio/wav';
  if (base === 'audio/mp3') return 'audio/mpeg';
  if ((ALLOWED_UPLOAD_MIMES as readonly string[]).includes(base)) {
    return base as AllowedUploadMime;
  }
  return null;
}

export function extensionForUploadMime(mime: AllowedUploadMime): string {
  switch (mime) {
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
    case 'audio/webm':
      return 'webm';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
  }
}

export function mimeForMediaExtension(ext: string): AllowedUploadMime | null {
  switch (ext.toLowerCase()) {
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.m4a':
      return 'audio/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.ogg':
      return 'audio/ogg';
    case '.wav':
      return 'audio/wav';
    default:
      return null;
  }
}

export function checkMediaMagicBytes(mime: AllowedUploadMime, bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (mime === 'video/webm' || mime === 'audio/webm') {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  if (mime === 'video/mp4' || mime === 'audio/mp4') {
    return (
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    );
  }
  if (mime === 'audio/ogg') {
    return bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  if (mime === 'audio/wav') {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x41 &&
      bytes[10] === 0x56 &&
      bytes[11] === 0x45
    );
  }
  if (mime === 'audio/mpeg') {
    const hasId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    const hasFrameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    return hasId3 || hasFrameSync;
  }
  return false;
}

const SAFE_MEDIA_FILENAME_RE = /^clip-[a-f0-9-]{8,64}\.(mp4|webm|m4a|mp3|ogg|wav)$/;
const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function isSafeStoredMediaName(name: string): boolean {
  if (!name || name.length > 100) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) {
    return false;
  }
  if (WINDOWS_RESERVED_RE.test(name)) return false;
  return SAFE_MEDIA_FILENAME_RE.test(name);
}

export function validateUploadInput(input: {
  mime: string | null | undefined;
  size: number;
  bytes: Uint8Array;
  maxBytes?: number;
}): ValidationResult<{ mime: AllowedUploadMime; extension: string }> {
  const maxBytes = input.maxBytes ?? MAX_CLIP_UPLOAD_BYTES;
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.bytes.length === 0) {
    return { ok: false, code: 'EMPTY_UPLOAD', message: 'Tệp tải lên đang trống.' };
  }
  if (input.size > maxBytes || input.bytes.length > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    return {
      ok: false,
      code: 'UPLOAD_TOO_LARGE',
      message: `Tệp vượt giới hạn ${mb} MB. Hãy chọn đoạn ngắn hơn hoặc nén nhẹ trước khi tải lên.`,
    };
  }
  const mime = normalizeUploadMime(input.mime);
  if (!mime) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_MIME',
      message: 'Định dạng không hỗ trợ. Chỉ nhận MP4, WebM, MP3, M4A, OGG hoặc WAV.',
    };
  }
  if (!checkMediaMagicBytes(mime, input.bytes)) {
    return {
      ok: false,
      code: 'MEDIA_SIGNATURE_MISMATCH',
      message: 'Nội dung tệp không khớp định dạng âm thanh/video đã chọn.',
    };
  }
  return { ok: true, value: { mime, extension: extensionForUploadMime(mime) } };
}

export function parseYoutubeTimeParam(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    const sec = Number(trimmed);
    return Number.isSafeInteger(sec) && sec >= 0 ? sec : null;
  }
  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(trimmed);
  if (!hms || (!hms[1] && !hms[2] && !hms[3])) return null;
  const sec = Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  return Number.isSafeInteger(sec) && sec >= 0 ? sec : null;
}

export function parseYoutubeLink(input: string): { videoId: string; startSeconds: number | null } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (YOUTUBE_ID_RE.test(trimmed)) {
    return { videoId: trimmed, startSeconds: null };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let id: string | null = null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = parts[0] ?? null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else if (parts.length >= 2 && ['embed', 'shorts', 'live'].includes(parts[0])) {
    id = parts[1];
  }
  if (!id || !YOUTUBE_ID_RE.test(id)) return null;
  const startSeconds =
    parseYoutubeTimeParam(url.searchParams.get('t')) ??
    parseYoutubeTimeParam(url.searchParams.get('start'));
  return { videoId: id, startSeconds };
}

export function parseYoutubeVideoId(input: string): string | null {
  return parseYoutubeLink(input)?.videoId ?? null;
}

function parseFractionalMs(raw: string): number {
  if (raw.length === 1) return Number(raw) * 100;
  if (raw.length === 2) return Number(raw) * 10;
  return Number(raw.slice(0, 3));
}

function parseSrtTimestamp(raw: string): number | null {
  const match = /^(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const ms = parseFractionalMs(match[4]);
  if (minutes >= 60 || seconds >= 60) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms;
}

function parseAssTimestamp(raw: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const ms = parseFractionalMs(match[4]);
  if (minutes >= 60 || seconds >= 60) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms;
}

function cleanSrtText(lines: string[]): string {
  return lines
    .map((line) => line.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function cleanAssText(raw: string): string {
  return raw
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\h/g, ' ')
    .replace(/\\[Nn]/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function parseSrt(content: string): SubtitleParseResult {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];
  const errors: SubtitleParseError[] = [];

  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const blockStartLine = i + 1;
    const blockLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      blockLines.push(lines[i]);
      i++;
    }

    let timeIndex = 0;
    if (blockLines.length >= 2 && /^\d+$/.test(blockLines[0].trim())) {
      timeIndex = 1;
    }
    const timeLine = blockLines[timeIndex] ?? '';
    const arrowParts = timeLine.split('-->');
    if (arrowParts.length !== 2) {
      errors.push({ line: blockStartLine + timeIndex, reason: 'Thiếu hoặc sai dòng mốc thời gian SRT.' });
      continue;
    }
    const startMs = parseSrtTimestamp(arrowParts[0].trim());
    const endToken = arrowParts[1].trim().split(/\s+/)[0] ?? '';
    const endMs = parseSrtTimestamp(endToken);
    if (startMs === null || endMs === null) {
      errors.push({ line: blockStartLine + timeIndex, reason: 'Định dạng mốc thời gian SRT không hợp lệ.' });
      continue;
    }
    if (endMs <= startMs) {
      errors.push({ line: blockStartLine + timeIndex, reason: 'Mốc kết thúc phải lớn hơn mốc bắt đầu.' });
      continue;
    }
    const text = cleanSrtText(blockLines.slice(timeIndex + 1));
    if (!text) {
      errors.push({ line: blockStartLine + timeIndex + 1, reason: 'Khối phụ đề không có nội dung.' });
      continue;
    }
    cues.push({ startMs, endMs, text, speaker: null });
  }

  return { format: 'srt', cues, errors };
}

export function parseAss(content: string): SubtitleParseResult {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];
  const errors: SubtitleParseError[] = [];

  let inEvents = false;
  let sawEvents = false;
  let formatCols: string[] | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const trimmed = lines[idx].trim();
    if (!trimmed || trimmed.startsWith(';')) continue;

    if (/^\[[^\]]+\]$/.test(trimmed)) {
      inEvents = trimmed.toLowerCase() === '[events]';
      if (inEvents) sawEvents = true;
      continue;
    }
    if (!inEvents) continue;

    if (/^format\s*:/i.test(trimmed)) {
      formatCols = trimmed
        .slice(trimmed.indexOf(':') + 1)
        .split(',')
        .map((col) => col.trim().toLowerCase());
      continue;
    }

    if (/^dialogue\s*:/i.test(trimmed)) {
      if (!formatCols) {
        errors.push({ line: lineNum, reason: 'Thiếu dòng Format trước Dialogue trong [Events].' });
        continue;
      }
      const startIdx = formatCols.indexOf('start');
      const endIdx = formatCols.indexOf('end');
      const textIdx = formatCols.indexOf('text');
      const nameIdx =
        formatCols.indexOf('name') >= 0 ? formatCols.indexOf('name') : formatCols.indexOf('actor');
      if (startIdx < 0 || endIdx < 0 || textIdx < 0) {
        errors.push({ line: lineNum, reason: 'Format ASS thiếu cột Start, End hoặc Text.' });
        continue;
      }

      const payload = trimmed.slice(trimmed.indexOf(':') + 1);
      const cols: string[] = [];
      let rest = payload;
      for (let c = 0; c < formatCols.length - 1; c++) {
        const comma = rest.indexOf(',');
        if (comma < 0) {
          cols.length = 0;
          break;
        }
        cols.push(rest.slice(0, comma).trim());
        rest = rest.slice(comma + 1);
      }
      if (cols.length !== formatCols.length - 1) {
        errors.push({ line: lineNum, reason: 'Dòng Dialogue thiếu cột so với Format.' });
        continue;
      }
      cols.push(rest);

      const startMs = parseAssTimestamp(cols[startIdx] ?? '');
      const endMs = parseAssTimestamp(cols[endIdx] ?? '');
      if (startMs === null || endMs === null) {
        errors.push({ line: lineNum, reason: 'Định dạng mốc thời gian ASS không hợp lệ.' });
        continue;
      }
      if (endMs <= startMs) {
        errors.push({ line: lineNum, reason: 'Mốc kết thúc phải lớn hơn mốc bắt đầu.' });
        continue;
      }
      const text = cleanAssText(cols[textIdx] ?? '');
      if (!text) {
        errors.push({ line: lineNum, reason: 'Dòng Dialogue không có nội dung sau khi bỏ thẻ định dạng.' });
        continue;
      }
      const speaker = nameIdx >= 0 ? cols[nameIdx]?.trim() || null : null;
      cues.push({ startMs, endMs, text, speaker });
    }
  }

  if (!sawEvents) {
    errors.push({ line: 1, reason: 'Tệp ASS thiếu mục [Events].' });
  }
  return { format: 'ass', cues, errors };
}

export function parseSubtitleFile(
  filename: string,
  content: string,
): ValidationResult<SubtitleParseResult> {
  if (!content || !content.trim()) {
    return { ok: false, code: 'SUBTITLE_EMPTY', message: 'Nội dung phụ đề đang trống.' };
  }
  if (content.length > MAX_SUBTITLE_BYTES) {
    return { ok: false, code: 'SUBTITLE_TOO_LARGE', message: 'Tệp phụ đề vượt giới hạn 1 MB.' };
  }
  const lower = filename.trim().toLowerCase();
  const isAss =
    lower.endsWith('.ass') ||
    lower.endsWith('.ssa') ||
    (!lower.endsWith('.srt') && /(?:^|\n)\s*\[(?:script info|events)\]/i.test(content));
  const parsed = isAss ? parseAss(content) : parseSrt(content);
  if (parsed.cues.length === 0) {
    const detail = parsed.errors[0]?.reason ?? 'Không đọc được câu phụ đề hợp lệ nào.';
    return { ok: false, code: 'INVALID_SUBTITLE_FORMAT', message: detail };
  }
  return { ok: true, value: parsed };
}

const SENTENCE_END_RE = /[^。！？!?\n]+[。！？!?]+[」』）】〉》"'’”]*|[^。！？!?\n]+/g;

export function splitJapaneseSentences(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const results: string[] = [];
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const matches = line.match(SENTENCE_END_RE);
    if (!matches) continue;
    for (const piece of matches) {
      const cleaned = piece.trim();
      if (cleaned) results.push(cleaned);
    }
  }
  return results;
}

function allocateSentenceTimings(
  sentences: string[],
  startMs: number,
  endMs: number,
): { text: string; startMs: number; endMs: number }[] {
  const totalSpan = Math.round(endMs) - Math.round(startMs);
  if (sentences.length === 0 || totalSpan <= 0) return [];
  if (sentences.length === 1) {
    return [{ text: sentences[0], startMs: Math.round(startMs), endMs: Math.round(endMs) }];
  }
  const weights = sentences.map((s) => Math.max(1, s.replace(/\s+/g, '').length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const out: { text: string; startMs: number; endMs: number }[] = [];
  let cursor = Math.round(startMs);
  let consumedWeight = 0;

  for (let i = 0; i < sentences.length; i++) {
    consumedWeight += weights[i];
    const remaining = sentences.length - 1 - i;
    let nextEnd =
      i === sentences.length - 1
        ? Math.round(endMs)
        : Math.round(startMs + (totalSpan * consumedWeight) / totalWeight);
    const maxEnd = Math.round(endMs) - remaining;
    if (nextEnd > maxEnd) nextEnd = maxEnd;
    if (nextEnd <= cursor) nextEnd = Math.min(Math.round(endMs), cursor + 1);
    if (nextEnd <= cursor) break;
    out.push({ text: sentences[i], startMs: cursor, endMs: nextEnd });
    cursor = nextEnd;
  }
  return out;
}

export function buildSegmentsFromSubtitles(
  cues: readonly SubtitleCue[],
  clipStartMs: number,
  clipEndMs: number,
  options: { autoSplit?: boolean; maxSegments?: number } = {},
): DraftSegment[] {
  const autoSplit = options.autoSplit ?? true;
  const maxSegments = options.maxSegments ?? MAX_CLIP_SEGMENTS;
  const startBound = Math.round(clipStartMs);
  const endBound = Math.round(clipEndMs);
  if (endBound <= startBound) return [];

  const sorted = cues
    .filter((cue) => cue.endMs > startBound && cue.startMs < endBound && cue.text.trim().length > 0)
    .slice()
    .sort((a, b) => (a.startMs !== b.startMs ? a.startMs - b.startMs : a.endMs - b.endMs));

  const segments: DraftSegment[] = [];
  let cursor = startBound;

  for (const cue of sorted) {
    if (segments.length >= maxSegments) break;
    const clampedStart = Math.max(cursor, startBound, Math.round(cue.startMs));
    const clampedEnd = Math.min(endBound, Math.round(cue.endMs));
    if (clampedEnd - clampedStart < MIN_SEGMENT_MS) continue;

    const pieces = autoSplit
      ? splitJapaneseSentences(cue.text)
      : [cue.text.replace(/\s*\n\s*/g, ' ').trim()].filter(Boolean);
    const usablePieces =
      pieces.length > 1 && clampedEnd - clampedStart >= pieces.length * MIN_SEGMENT_MS
        ? pieces
        : [pieces.join(' ').trim()].filter(Boolean);

    const timed = allocateSentenceTimings(usablePieces, clampedStart, clampedEnd);
    for (const part of timed) {
      if (segments.length >= maxSegments) break;
      const segStart = Math.max(cursor, part.startMs);
      const segEnd = Math.min(endBound, part.endMs);
      if (segEnd <= segStart) continue;
      segments.push({
        id: `seg-${segments.length + 1}`,
        startMs: segStart,
        endMs: segEnd,
        ja: part.text,
        kana: null,
        speaker: cue.speaker ?? null,
        vi: null,
      });
      cursor = segEnd;
    }
  }
  return segments;
}

export function buildSegmentsFromPlainText(
  text: string,
  clipStartMs: number,
  clipEndMs: number,
  maxSegments = MAX_CLIP_SEGMENTS,
): DraftSegment[] {
  const startBound = Math.round(clipStartMs);
  const endBound = Math.round(clipEndMs);
  if (endBound <= startBound) return [];
  const sentences = splitJapaneseSentences(text).slice(0, maxSegments);
  if (!sentences.length) return [];
  const timed = allocateSentenceTimings(sentences, startBound, endBound);
  return timed.map((part, idx) => ({
    id: `seg-${idx + 1}`,
    startMs: part.startMs,
    endMs: part.endMs,
    ja: part.text,
    kana: null,
    speaker: null,
    vi: null,
  }));
}

export function clampClipRange(
  startMs: number,
  endMs: number,
  durationMs: number,
): { clipStartMs: number; clipEndMs: number } {
  const dur = Math.max(MIN_CLIP_SPAN_MS, Math.round(durationMs));
  let start = Number.isFinite(startMs) ? Math.round(startMs) : 0;
  let end = Number.isFinite(endMs) ? Math.round(endMs) : Math.min(dur, MAX_CLIP_SPAN_MS);
  start = Math.max(0, Math.min(dur - MIN_CLIP_SPAN_MS, start));
  end = Math.max(start + MIN_CLIP_SPAN_MS, Math.min(dur, end));
  if (end - start > MAX_CLIP_SPAN_MS) {
    end = Math.min(dur, start + MAX_CLIP_SPAN_MS);
  }
  return { clipStartMs: start, clipEndMs: end };
}

export function adjustSegmentBoundary(
  segments: readonly DraftSegment[],
  index: number,
  field: 'startMs' | 'endMs',
  nextMs: number,
  clipStartMs: number,
  clipEndMs: number,
): DraftSegment[] {
  if (index < 0 || index >= segments.length || !Number.isFinite(nextMs)) {
    return [...segments];
  }
  const target = Math.round(nextMs);
  const prevEnd = index > 0 ? segments[index - 1].endMs : clipStartMs;
  const nextStart = index < segments.length - 1 ? segments[index + 1].startMs : clipEndMs;
  const current = segments[index];

  const updated = segments.slice();
  if (field === 'startMs') {
    const clamped = Math.max(prevEnd, Math.min(current.endMs - MIN_SEGMENT_MS, target));
    updated[index] = { ...current, startMs: clamped };
  } else {
    const clamped = Math.max(current.startMs + MIN_SEGMENT_MS, Math.min(nextStart, target));
    updated[index] = { ...current, endMs: clamped };
  }
  return updated;
}

export function validateClipDraft(input: ClipDraftInput): ValidationResult<NormalizedClipDraft> {
  if (!input || (input.kind !== 'file' && input.kind !== 'youtube')) {
    return { ok: false, code: 'INVALID_SOURCE_KIND', message: 'Loại nguồn clip không hợp lệ.' };
  }
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 120) {
    return { ok: false, code: 'INVALID_TITLE', message: 'Nhập tiêu đề clip (1–120 ký tự).' };
  }
  const rawLevel = typeof input.level === 'string' ? input.level.trim().toUpperCase() : '';
  const level = rawLevel && (CLIP_LEVELS as readonly string[]).includes(rawLevel) ? rawLevel : 'N5';
  const topic = typeof input.topic === 'string' ? input.topic.trim().slice(0, 80) : '';

  let youtubeId: string | null = null;
  if (input.kind === 'youtube') {
    youtubeId = parseYoutubeVideoId(input.youtubeUrlOrId ?? '');
    if (!youtubeId) {
      return {
        ok: false,
        code: 'INVALID_YOUTUBE_URL',
        message: 'Link hoặc ID YouTube không hợp lệ (cần ID 11 ký tự hợp lệ).',
      };
    }
  }

  const durationMs = Math.round(Number(input.durationMs));
  const clipStartMs = Math.round(Number(input.clipStartMs));
  const clipEndMs = Math.round(Number(input.clipEndMs));
  if (!Number.isSafeInteger(durationMs) || durationMs < MIN_CLIP_SPAN_MS || durationMs > MAX_SOURCE_DURATION_MS) {
    return {
      ok: false,
      code: 'INVALID_DURATION',
      message: 'Độ dài nguồn clip không hợp lệ (tối thiểu 1 giây, tối đa 2 giờ).',
    };
  }
  if (
    !Number.isSafeInteger(clipStartMs) ||
    !Number.isSafeInteger(clipEndMs) ||
    clipStartMs < 0 ||
    clipEndMs > durationMs ||
    clipEndMs <= clipStartMs
  ) {
    return {
      ok: false,
      code: 'INVALID_CLIP_BOUNDS',
      message: 'Mốc đầu/cuối clip phải nằm trong độ dài nguồn và mốc cuối lớn hơn mốc đầu.',
    };
  }
  const spanMs = clipEndMs - clipStartMs;
  if (spanMs < MIN_CLIP_SPAN_MS || spanMs > MAX_CLIP_SPAN_MS) {
    return {
      ok: false,
      code: 'INVALID_CLIP_RANGE',
      message: 'Độ dài đoạn clip phải từ 1 đến 60 giây.',
    };
  }

  if (!Array.isArray(input.segments) || input.segments.length === 0) {
    return { ok: false, code: 'EMPTY_SEGMENTS', message: 'Cần ít nhất 1 câu phụ đề trong clip.' };
  }
  if (input.segments.length > MAX_CLIP_SEGMENTS) {
    return {
      ok: false,
      code: 'TOO_MANY_SEGMENTS',
      message: `Tối đa ${MAX_CLIP_SEGMENTS} câu cho mỗi clip.`,
    };
  }

  const seenIds = new Set<string>();
  const normalizedSegments: NormalizedClipDraft['segments'] = [];
  let prevEnd = clipStartMs;

  for (let i = 0; i < input.segments.length; i++) {
    const seg = input.segments[i];
    if (!seg || typeof seg !== 'object') {
      return { ok: false, code: 'INVALID_SEGMENT', message: `Câu ${i + 1} không hợp lệ.` };
    }
    const ja = typeof seg.ja === 'string' ? seg.ja.trim() : '';
    if (!ja || ja.length > 400) {
      return { ok: false, code: 'INVALID_SEGMENT_TEXT', message: `Câu ${i + 1} cần có nội dung tiếng Nhật (1–400 ký tự).` };
    }
    const startMs = Math.round(Number(seg.startMs));
    const endMs = Math.round(Number(seg.endMs));
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs)) {
      return { ok: false, code: 'INVALID_SEGMENT_TIMING', message: `Mốc thời gian câu ${i + 1} không hợp lệ.` };
    }
    if (startMs >= endMs) {
      return {
        ok: false,
        code: 'SEGMENT_START_NOT_BEFORE_END',
        message: `Câu ${i + 1}: mốc bắt đầu phải nhỏ hơn mốc kết thúc.`,
      };
    }
    if (startMs < clipStartMs || endMs > clipEndMs || endMs > durationMs) {
      return {
        ok: false,
        code: 'SEGMENT_OUT_OF_BOUNDS',
        message: `Câu ${i + 1}: mốc thời gian nằm ngoài khoảng đoạn clip đã chọn.`,
      };
    }
    if (startMs < prevEnd) {
      return {
        ok: false,
        code: 'SEGMENT_OVERLAP',
        message: `Câu ${i + 1}: mốc bắt đầu bị chồng lên câu trước.`,
      };
    }
    const rawId = typeof seg.id === 'string' && seg.id.trim() ? seg.id.trim().slice(0, 64) : `seg-${i + 1}`;
    const id = seenIds.has(rawId) ? `seg-${i + 1}` : rawId;
    seenIds.add(id);
    prevEnd = endMs;

    const kana = typeof seg.kana === 'string' && seg.kana.trim() ? seg.kana.trim().slice(0, 400) : null;
    const speaker = typeof seg.speaker === 'string' && seg.speaker.trim() ? seg.speaker.trim().slice(0, 60) : null;
    const vi = typeof seg.vi === 'string' && seg.vi.trim() ? seg.vi.trim().slice(0, 400) : null;
    normalizedSegments.push({ id, startMs, endMs, ja, kana, speaker, vi });
  }

  return {
    ok: true,
    value: {
      kind: input.kind,
      title,
      level,
      topic,
      durationMs,
      clipStartMs,
      clipEndMs,
      youtubeId,
      segments: normalizedSegments,
    },
  };
}
