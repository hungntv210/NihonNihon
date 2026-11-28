import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { databasePath } from '../../../core/config.ts';
import {
  furiganaToKana,
  normalizeClipTags,
  normalizeRoadmapWeek,
} from './auto-meta-model.ts';
import {
  analyzeClipMetadata,
  buildSentenceFurigana,
  loadShadowingTokenizer,
} from './auto-meta-server.ts';
import {
  MAX_CLIP_SPAN_MS,
  MAX_CLIP_UPLOAD_BYTES,
  MAX_SUBTITLE_BYTES,
  MIN_CLIP_SPAN_MS,
  buildSegmentsFromPlainText,
  buildSegmentsFromSubtitles,
  clampClipRange,
  mimeForMediaExtension,
  parseSubtitleFile,
  validateClipDraft,
  validateUploadInput,
  type AllowedUploadMime,
  type DraftSegment,
  type SubtitleCue,
  type SubtitleParseResult,
} from './clip-maker-model.ts';
import {
  shadowingCustomClipsPath,
  shadowingMediaDir,
  upsertImportedFileClip,
} from './clip-maker-store.ts';

export const DEFAULT_IRODORI_DIR = 'data/private/irodori';
export const IRODORI_CLIP_PREFIX = 'user-clip:irodori-';
export const IRODORI_LICENSE = 'Japan Foundation IRODORI (private local copy)';

export type IrodoriCefrLevel = 'A1' | 'A2' | 'B1';
export type IrodoriBookCode = 'A1' | 'A2-1' | 'A2-2' | 'A2' | 'B1';
export type IrodoriJlptLevel = 'N5' | 'N4' | 'N3';

export type IrodoriLevelSpec = {
  cefr: IrodoriCefrLevel;
  book: IrodoriBookCode;
  jlpt: IrodoriJlptLevel;
  attribution: string;
  tags: string[];
};

export type IrodoriImportOptions = {
  dir?: string;
  dryRun?: boolean;
  levels?: readonly IrodoriCefrLevel[];
  autoMeta?: boolean;
  dbFile?: string;
  storePath?: string;
  mediaDir?: string;
  now?: Date;
};

export type IrodoriImportedClipSummary = {
  id: string;
  sourceKey: string;
  title: string;
  cefr: IrodoriCefrLevel;
  book: IrodoriBookCode;
  jlpt: IrodoriJlptLevel;
  attribution: string;
  topic: string;
  tags: string[];
  roadmapWeek: number | null;
  sentenceCount: number;
  durationMs: number;
  status: 'dry-run' | 'created' | 'updated' | 'unchanged';
};

export type IrodoriImportError = {
  ref: string;
  code: string;
  message: string;
};

export type IrodoriLevelCount = {
  jlpt: IrodoriJlptLevel;
  count: number;
  created: number;
  updated: number;
  unchanged: number;
};

export type IrodoriImportReport = {
  dryRun: boolean;
  sourceDir: string;
  totals: {
    discovered: number;
    valid: number;
    created: number;
    updated: number;
    unchanged: number;
    errors: number;
  };
  byLevel: Record<IrodoriCefrLevel, IrodoriLevelCount>;
  clips: IrodoriImportedClipSummary[];
  errors: IrodoriImportError[];
};

type ManifestSegmentInput = {
  id?: string;
  startMs?: number;
  endMs?: number;
  start_ms?: number;
  end_ms?: number;
  start?: number;
  end?: number;
  ja?: string;
  text?: string;
  furigana?: string | null;
  kana?: string | null;
  speaker?: string | null;
  vi?: string | null;
};

type ManifestClipEntry = {
  id?: string;
  cefr?: string;
  book?: string;
  level?: string;
  title?: string;
  topic?: string;
  lesson?: string | number;
  tags?: string[];
  roadmapWeek?: number | null;
  audio?: string;
  media?: string;
  subtitle?: string;
  transcript?: string;
  durationMs?: number;
  duration_ms?: number;
  clipStartMs?: number;
  clip_start_ms?: number;
  clipEndMs?: number;
  clip_end_ms?: number;
  segments?: ManifestSegmentInput[];
};

type CandidateSpec = {
  ref: string;
  baseDir: string;
  audioRel: string;
  subtitleRel: string | null;
  levelSpec: IrodoriLevelSpec;
  explicitId: string | null;
  title: string | null;
  topic: string | null;
  lesson: string | null;
  tags: string[];
  roadmapWeek: number | null;
  durationMs: number | null;
  clipStartMs: number | null;
  clipEndMs: number | null;
  inlineSegments: ManifestSegmentInput[] | null;
};

const MEDIA_EXTS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.webm']);
const SIDECAR_EXTS = ['.json', '.srt', '.vtt', '.ass', '.ssa', '.txt'] as const;
const MANIFEST_NAMES = ['manifest.json', 'clips.json'] as const;

// Unicode-escaped Japanese book names to stay compatible with font-split Core WOFF2 src/ scan.
const JP_NYUMON = '\u5165\u9580';
const JP_SHOKYU = '\u521d\u7d1a';
const JP_CHUKYU = '\u4e2d\u7d1a';

const LEVEL_SPECS: Record<IrodoriBookCode, IrodoriLevelSpec> = {
  A1: {
    cefr: 'A1',
    book: 'A1',
    jlpt: 'N5',
    attribution: 'IRODORI (A1 · Nhập môn)',
    tags: ['IRODORI', 'A1', 'N5'],
  },
  'A2-1': {
    cefr: 'A2',
    book: 'A2-1',
    jlpt: 'N4',
    attribution: 'IRODORI (A2-1 · Sơ cấp 1)',
    tags: ['IRODORI', 'A2-1', 'N4'],
  },
  'A2-2': {
    cefr: 'A2',
    book: 'A2-2',
    jlpt: 'N4',
    attribution: 'IRODORI (A2-2 · Sơ cấp 2)',
    tags: ['IRODORI', 'A2-2', 'N4'],
  },
  A2: {
    cefr: 'A2',
    book: 'A2',
    jlpt: 'N4',
    attribution: 'IRODORI (A2 · Sơ cấp)',
    tags: ['IRODORI', 'A2', 'N4'],
  },
  B1: {
    cefr: 'B1',
    book: 'B1',
    jlpt: 'N3',
    attribution: 'IRODORI (B1 · Trung cấp)',
    tags: ['IRODORI', 'B1', 'N3'],
  },
};

export function resolveIrodoriDir(explicitDir?: string): string {
  const raw = explicitDir?.trim() || process.env.NIHON_IRODORI_DIR?.trim() || DEFAULT_IRODORI_DIR;
  return path.resolve(raw);
}

export function mapIrodoriLevel(raw: string | null | undefined): IrodoriLevelSpec | null {
  if (!raw) return null;
  const normalized = raw.normalize('NFKC').trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase().replace(/[\s_]+/g, '-');

  if (
    lower === 'a1' ||
    lower.startsWith('a1-') ||
    lower === 'starter' ||
    lower.includes('starter') ||
    lower.includes('nyumon') ||
    lower.includes('nyuumon') ||
    lower === 'n5' ||
    normalized.includes(JP_NYUMON)
  ) {
    return LEVEL_SPECS.A1;
  }

  if (
    lower === 'a2-1' ||
    lower === 'a21' ||
    lower.startsWith('a2-1-') ||
    lower === 'elementary-1' ||
    lower === 'elementary1' ||
    lower === 'shokyu-1' ||
    lower === 'shokyu1' ||
    normalized.includes(`${JP_SHOKYU}1`)
  ) {
    return LEVEL_SPECS['A2-1'];
  }

  if (
    lower === 'a2-2' ||
    lower === 'a22' ||
    lower.startsWith('a2-2-') ||
    lower === 'elementary-2' ||
    lower === 'elementary2' ||
    lower === 'shokyu-2' ||
    lower === 'shokyu2' ||
    normalized.includes(`${JP_SHOKYU}2`)
  ) {
    return LEVEL_SPECS['A2-2'];
  }

  if (
    lower === 'a2' ||
    lower.startsWith('a2-') ||
    lower === 'elementary' ||
    lower.includes('elementary') ||
    lower.includes('shokyu') ||
    lower === 'n4' ||
    normalized.includes(JP_SHOKYU)
  ) {
    return LEVEL_SPECS.A2;
  }

  if (
    lower === 'b1' ||
    lower.startsWith('b1-') ||
    lower === 'intermediate' ||
    lower.includes('intermediate') ||
    lower.includes('chukyu') ||
    lower.includes('chuukyuu') ||
    lower === 'n3' ||
    normalized.includes(JP_CHUKYU)
  ) {
    return LEVEL_SPECS.B1;
  }

  return null;
}

function parseVttTimestamp(raw: string): number | null {
  const trimmed = raw.trim();
  const hms = /^(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(trimmed);
  if (hms) {
    const h = Number(hms[1]);
    const m = Number(hms[2]);
    const s = Number(hms[3]);
    const frac = hms[4].length === 1 ? Number(hms[4]) * 100 : hms[4].length === 2 ? Number(hms[4]) * 10 : Number(hms[4]);
    if (m >= 60 || s >= 60) return null;
    return ((h * 60 + m) * 60 + s) * 1000 + frac;
  }
  const msOnly = /^(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(trimmed);
  if (msOnly) {
    const m = Number(msOnly[1]);
    const s = Number(msOnly[2]);
    const frac = msOnly[3].length === 1 ? Number(msOnly[3]) * 100 : msOnly[3].length === 2 ? Number(msOnly[3]) * 10 : Number(msOnly[3]);
    if (s >= 60) return null;
    return (m * 60 + s) * 1000 + frac;
  }
  return null;
}

export function parseWebVtt(content: string): SubtitleParseResult {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];
  const errors: { line: number; reason: string }[] = [];

  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const blockStart = i + 1;
    const block: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      block.push(lines[i]);
      i++;
    }

    const head = block[0].trim();
    if (/^WEBVTT(?:\s|$)/i.test(head) || /^NOTE(?:\s|$)/i.test(head) || /^STYLE(?:\s|$)/i.test(head) || /^REGION(?:\s|$)/i.test(head)) {
      continue;
    }

    const timeIdx = block[0].includes('-->') ? 0 : block.length >= 2 && block[1].includes('-->') ? 1 : -1;
    if (timeIdx < 0) {
      errors.push({ line: blockStart, reason: 'Thiếu dòng mốc thời gian WebVTT.' });
      continue;
    }

    const [startRaw, endRawWithSettings] = block[timeIdx].split('-->');
    const startMs = parseVttTimestamp(startRaw ?? '');
    const endToken = (endRawWithSettings ?? '').trim().split(/\s+/)[0] ?? '';
    const endMs = parseVttTimestamp(endToken);
    if (startMs === null || endMs === null || endMs <= startMs) {
      errors.push({ line: blockStart + timeIdx, reason: 'Mốc thời gian WebVTT không hợp lệ.' });
      continue;
    }

    let speaker: string | null = null;
    const rawText = block.slice(timeIdx + 1).join('\n').trim();
    const voiceMatch = /^<v\s+([^>]+)>/i.exec(rawText);
    if (voiceMatch) {
      speaker = voiceMatch[1].trim() || null;
    }
    const text = rawText
      .replace(/<[^>]*>/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    if (!text) {
      errors.push({ line: blockStart + timeIdx + 1, reason: 'Khối WebVTT không có nội dung.' });
      continue;
    }
    cues.push({ startMs, endMs, text, speaker });
  }

  return { format: 'srt', cues, errors };
}

function parseWavDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, false) !== 0x52494646 || // RIFF
    view.getUint32(8, false) !== 0x57415645 // WAVE
  ) {
    return null;
  }
  let byteRate = 0;
  let dataSize = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataStart = offset + 8;
    if (chunkId === 'fmt ' && chunkSize >= 16 && chunkDataStart + 16 <= bytes.length) {
      byteRate = view.getUint32(chunkDataStart + 8, true);
    } else if (chunkId === 'data') {
      dataSize = Math.min(chunkSize, bytes.length - chunkDataStart);
      break;
    }
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }
  if (byteRate <= 0 || dataSize <= 0) return null;
  return Math.max(1, Math.round((dataSize / byteRate) * 1000));
}

const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

function parseMp3DurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 4) return null;
  let offset = 0;
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    offset = 10 + tagSize;
  }
  const limit = Math.min(bytes.length - 4, offset + 4096);
  for (let i = offset; i <= limit; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      const versionBits = (bytes[i + 1] >> 3) & 0x03;
      const layerBits = (bytes[i + 1] >> 1) & 0x03;
      const bitrateIdx = (bytes[i + 2] >> 4) & 0x0f;
      if (versionBits === 1 || layerBits !== 1) continue; // Layer III only
      const table = versionBits === 3 ? MPEG1_L3_BITRATES : MPEG2_L3_BITRATES;
      const kbps = table[bitrateIdx] ?? 0;
      if (kbps <= 0) continue;
      const audioBytes = Math.max(0, bytes.length - i);
      if (audioBytes <= 0) return null;
      return Math.max(1, Math.round((audioBytes * 8) / kbps));
    }
  }
  return null;
}

export function detectAudioDurationMs(mime: AllowedUploadMime, bytes: Uint8Array): number | null {
  if (mime === 'audio/wav') return parseWavDurationMs(bytes);
  if (mime === 'audio/mpeg') return parseMp3DurationMs(bytes);
  return null;
}

export function resolveSafeIrodoriFile(
  rootReal: string,
  baseDir: string,
  relativeRef: string,
): string {
  const cleaned = relativeRef.trim();
  if (!cleaned || cleaned.includes('\0') || path.isAbsolute(cleaned)) {
    throw new Error('PATH_OUTSIDE_IRODORI_ROOT');
  }
  const candidate = path.resolve(baseDir, cleaned);
  const relLogical = path.relative(rootReal, candidate);
  if (!relLogical || relLogical.startsWith('..') || path.isAbsolute(relLogical)) {
    throw new Error('PATH_OUTSIDE_IRODORI_ROOT');
  }
  if (!fs.existsSync(candidate)) {
    throw new Error('FILE_NOT_FOUND');
  }
  const lstat = fs.lstatSync(candidate);
  if (lstat.isSymbolicLink()) {
    throw new Error('SYMLINK_NOT_ALLOWED');
  }
  if (!lstat.isFile()) {
    throw new Error('NOT_A_FILE');
  }
  const realTarget = fs.realpathSync(candidate);
  const relReal = path.relative(rootReal, realTarget);
  if (!relReal || relReal.startsWith('..') || path.isAbsolute(relReal)) {
    throw new Error('PATH_OUTSIDE_IRODORI_ROOT');
  }
  return realTarget;
}

function slugifyPart(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/giu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'clip';
}

function buildStableClipIds(
  book: IrodoriBookCode,
  rawKey: string,
): { id: string; sourceKey: string } {
  const normalizedKey = rawKey.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').normalize('NFC');
  const hash = createHash('sha256').update(`${book}\0${normalizedKey}`).digest('hex').slice(0, 10);
  const slug = slugifyPart(normalizedKey).slice(0, 48);
  const bookSlug = book.toLowerCase();
  return {
    id: `${IRODORI_CLIP_PREFIX}${bookSlug}-${slug}-${hash}`,
    sourceKey: `irodori:${bookSlug}:${slug}:${hash}`,
  };
}

function humanizeName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coerceMs(primary: unknown, fallbackMs: unknown, fallbackSec: unknown): number | null {
  if (typeof primary === 'number' && Number.isFinite(primary)) return Math.round(primary);
  if (typeof fallbackMs === 'number' && Number.isFinite(fallbackMs)) return Math.round(fallbackMs);
  if (typeof fallbackSec === 'number' && Number.isFinite(fallbackSec)) return Math.round(fallbackSec * 1000);
  return null;
}

function normalizeManualSegments(rawSegments: readonly ManifestSegmentInput[]): DraftSegment[] {
  const out: DraftSegment[] = [];
  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    if (!seg || typeof seg !== 'object') continue;
    const ja = String(seg.ja ?? seg.text ?? '').normalize('NFC').trim();
    const startMs = coerceMs(seg.startMs, seg.start_ms, seg.start);
    const endMs = coerceMs(seg.endMs, seg.end_ms, seg.end);
    if (!ja || startMs === null || endMs === null) {
      throw new Error('INVALID_SEGMENT_TIMING');
    }
    out.push({
      id: typeof seg.id === 'string' && seg.id.trim() ? seg.id.trim() : `seg-${i + 1}`,
      startMs,
      endMs,
      ja,
      furigana: typeof seg.furigana === 'string' && seg.furigana.trim() ? seg.furigana.normalize('NFC').trim() : null,
      kana: typeof seg.kana === 'string' && seg.kana.trim() ? seg.kana.normalize('NFC').trim() : null,
      speaker: typeof seg.speaker === 'string' && seg.speaker.trim() ? seg.speaker.normalize('NFC').trim() : null,
      vi: typeof seg.vi === 'string' && seg.vi.trim() ? seg.vi.normalize('NFC').trim() : null,
    });
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function readManifestEntries(filePath: string): ManifestClipEntry[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter(isPlainObject) as ManifestClipEntry[];
  }
  if (isPlainObject(parsed) && Array.isArray(parsed.clips)) {
    return parsed.clips.filter(isPlainObject) as ManifestClipEntry[];
  }
  throw new Error('INVALID_MANIFEST_FORMAT');
}

function discoverCandidates(
  rootReal: string,
  errors: IrodoriImportError[],
): CandidateSpec[] {
  const candidates: CandidateSpec[] = [];
  const claimedAudioPaths = new Set<string>();

  const registerManifest = (manifestPath: string, defaultLevel: IrodoriLevelSpec | null) => {
    const baseDir = path.dirname(manifestPath);
    const relManifest = path.relative(rootReal, manifestPath).replace(/\\/g, '/');
    let entries: ManifestClipEntry[];
    try {
      entries = readManifestEntries(manifestPath);
    } catch {
      errors.push({
        ref: relManifest,
        code: 'INVALID_MANIFEST_FORMAT',
        message: 'Không đọc được tệp manifest JSON (cần mảng hoặc { "clips": [...] }).',
      });
      return;
    }

    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx];
      const ref = `${relManifest}#${idx + 1}`;
      const audioRel = String(entry.audio ?? entry.media ?? '').trim();
      if (!audioRel) {
        errors.push({ ref, code: 'MISSING_AUDIO_REF', message: 'Mục manifest thiếu đường dẫn tệp audio.' });
        continue;
      }

      const levelRaw = entry.book ?? entry.cefr ?? entry.level;
      const levelSpec = mapIrodoriLevel(levelRaw) ?? defaultLevel;
      if (!levelSpec) {
        errors.push({
          ref,
          code: 'UNKNOWN_IRODORI_LEVEL',
          message: `Không xác định được cấp độ IRODORI (cần A1, A2-1, A2-2, A2 hoặc B1): ${String(levelRaw ?? '')}`,
        });
        continue;
      }

      try {
        const safeAudio = resolveSafeIrodoriFile(rootReal, baseDir, audioRel);
        claimedAudioPaths.add(safeAudio);
      } catch {
        // Keep candidate so processing reports the exact security/missing error cleanly.
      }

      candidates.push({
        ref,
        baseDir,
        audioRel,
        subtitleRel: typeof (entry.subtitle ?? entry.transcript) === 'string'
          ? String(entry.subtitle ?? entry.transcript).trim() || null
          : null,
        levelSpec,
        explicitId: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null,
        title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.normalize('NFC').trim() : null,
        topic: typeof entry.topic === 'string' && entry.topic.trim() ? entry.topic.normalize('NFC').trim() : null,
        lesson: entry.lesson !== undefined && entry.lesson !== null && String(entry.lesson).trim()
          ? String(entry.lesson).normalize('NFC').trim()
          : null,
        tags: Array.isArray(entry.tags) ? entry.tags.filter((t): t is string => typeof t === 'string') : [],
        roadmapWeek: entry.roadmapWeek !== undefined && entry.roadmapWeek !== null
          ? normalizeRoadmapWeek(entry.roadmapWeek)
          : null,
        durationMs: coerceMs(entry.durationMs, entry.duration_ms, null),
        clipStartMs: coerceMs(entry.clipStartMs, entry.clip_start_ms, null),
        clipEndMs: coerceMs(entry.clipEndMs, entry.clip_end_ms, null),
        inlineSegments: Array.isArray(entry.segments) ? entry.segments : null,
      });
    }
  };

  // 1. Optional root manifest
  for (const name of MANIFEST_NAMES) {
    const rootManifest = path.join(rootReal, name);
    if (fs.existsSync(rootManifest) && !fs.lstatSync(rootManifest).isSymbolicLink() && fs.lstatSync(rootManifest).isFile()) {
      registerManifest(rootManifest, null);
    }
  }

  // 2. Scan top-level CEFR/book folders (A1/, A2-1/, A2-2/, A2/, B1/, ...)
  const topEntries = fs
    .readdirSync(rootReal, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  for (const top of topEntries) {
    if (top.isSymbolicLink() || !top.isDirectory()) continue;
    const levelSpec = mapIrodoriLevel(top.name);
    if (!levelSpec) continue;

    const levelDir = path.join(rootReal, top.name);

    // Optional manifest inside each level folder
    for (const name of MANIFEST_NAMES) {
      const levelManifest = path.join(levelDir, name);
      if (fs.existsSync(levelManifest) && !fs.lstatSync(levelManifest).isSymbolicLink() && fs.lstatSync(levelManifest).isFile()) {
        registerManifest(levelManifest, levelSpec);
      }
    }

    // Recursive walk for convention-based audio + sidecar pairs
    const walkLevelDir = (dir: string, topicHint: string | null) => {
      const entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkLevelDir(full, topicHint ?? humanizeName(entry.name));
          continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!MEDIA_EXTS.has(ext)) continue;

        const realAudio = fs.realpathSync(full);
        if (claimedAudioPaths.has(realAudio)) continue;
        claimedAudioPaths.add(realAudio);

        const stem = entry.name.slice(0, -ext.length);
        let sidecar: string | null = null;
        for (const sExt of SIDECAR_EXTS) {
          const candidateSidecar = path.join(dir, `${stem}${sExt}`);
          if (
            fs.existsSync(candidateSidecar) &&
            !fs.lstatSync(candidateSidecar).isSymbolicLink() &&
            fs.lstatSync(candidateSidecar).isFile()
          ) {
            sidecar = `${stem}${sExt}`;
            break;
          }
        }

        const relRef = path.relative(rootReal, full).replace(/\\/g, '/');
        candidates.push({
          ref: relRef,
          baseDir: dir,
          audioRel: entry.name,
          subtitleRel: sidecar,
          levelSpec,
          explicitId: null,
          title: null,
          topic: topicHint,
          lesson: null,
          tags: [],
          roadmapWeek: null,
          durationMs: null,
          clipStartMs: null,
          clipEndMs: null,
          inlineSegments: null,
        });
      }
    };

    walkLevelDir(levelDir, null);
  }

  return candidates;
}

function buildEmptyLevelCounts(): Record<IrodoriCefrLevel, IrodoriLevelCount> {
  return {
    A1: { jlpt: 'N5', count: 0, created: 0, updated: 0, unchanged: 0 },
    A2: { jlpt: 'N4', count: 0, created: 0, updated: 0, unchanged: 0 },
    B1: { jlpt: 'N3', count: 0, created: 0, updated: 0, unchanged: 0 },
  };
}

export async function importIrodoriDirectory(
  options: IrodoriImportOptions = {},
): Promise<IrodoriImportReport> {
  const sourceDir = resolveIrodoriDir(options.dir);
  const dryRun = Boolean(options.dryRun);
  const autoMeta = options.autoMeta !== false;
  const levelFilter = options.levels && options.levels.length > 0 ? new Set(options.levels) : null;
  const dbFile = options.dbFile ?? databasePath();
  const storePath = options.storePath ?? shadowingCustomClipsPath(dbFile);
  const mediaDir = options.mediaDir ?? shadowingMediaDir(dbFile);
  const now = options.now ?? new Date();

  const byLevel = buildEmptyLevelCounts();
  const clips: IrodoriImportedClipSummary[] = [];
  const errors: IrodoriImportError[] = [];

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    errors.push({
      ref: sourceDir,
      code: 'IRODORI_DIR_NOT_FOUND',
      message: 'Không tìm thấy thư mục IRODORI cục bộ. Hãy tải tài liệu IRODORI về máy và đặt đúng đường dẫn.',
    });
    return {
      dryRun,
      sourceDir,
      totals: { discovered: 0, valid: 0, created: 0, updated: 0, unchanged: 0, errors: errors.length },
      byLevel,
      clips,
      errors,
    };
  }

  const rootReal = fs.realpathSync(sourceDir);
  const allCandidates = discoverCandidates(rootReal, errors);
  const candidates = levelFilter
    ? allCandidates.filter((c) => levelFilter.has(c.levelSpec.cefr))
    : allCandidates;

  const hasDb = fs.existsSync(path.resolve(dbFile));
  const tokenizer = autoMeta && !hasDb ? await loadShadowingTokenizer() : null;

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const candidate of candidates) {
    try {
      // 1. Resolve & validate audio file safely inside root
      const audioPath = resolveSafeIrodoriFile(rootReal, candidate.baseDir, candidate.audioRel);
      const audioExt = path.extname(audioPath).toLowerCase();
      const mime = mimeForMediaExtension(audioExt);
      const stat = fs.statSync(audioPath);
      if (stat.size > MAX_CLIP_UPLOAD_BYTES) {
        errors.push({
          ref: candidate.ref,
          code: 'UPLOAD_TOO_LARGE',
          message: `Tệp audio vượt giới hạn ${Math.round(MAX_CLIP_UPLOAD_BYTES / (1024 * 1024))} MB.`,
        });
        continue;
      }
      const bytes = fs.readFileSync(audioPath);
      const uploadCheck = validateUploadInput({ mime, size: bytes.length, bytes });
      if (!uploadCheck.ok) {
        errors.push({ ref: candidate.ref, code: uploadCheck.code, message: uploadCheck.message });
        continue;
      }

      // 2. Load sidecar metadata/subtitles if present
      let title = candidate.title;
      let topic = candidate.topic;
      let levelSpec = candidate.levelSpec;
      let tags = [...candidate.tags];
      let roadmapWeek = candidate.roadmapWeek;
      let durationMs = candidate.durationMs;
      let clipStartMs = candidate.clipStartMs;
      let clipEndMs = candidate.clipEndMs;
      let segments: DraftSegment[] | null = candidate.inlineSegments
        ? normalizeManualSegments(candidate.inlineSegments)
        : null;

      let parsedCues: SubtitleCue[] | null = null;
      let plainTextScript: string | null = null;

      if (candidate.subtitleRel) {
        const subPath = resolveSafeIrodoriFile(rootReal, candidate.baseDir, candidate.subtitleRel);
        const subStat = fs.statSync(subPath);
        if (subStat.size > MAX_SUBTITLE_BYTES) {
          errors.push({
            ref: candidate.ref,
            code: 'SUBTITLE_TOO_LARGE',
            message: 'Tệp phụ đề vượt giới hạn 1 MB.',
          });
          continue;
        }
        const subText = fs.readFileSync(subPath, 'utf8');
        const subExt = path.extname(subPath).toLowerCase();

        if (subExt === '.json') {
          const sidecarJson = JSON.parse(subText) as unknown;
          if (!isPlainObject(sidecarJson)) {
            throw new Error('INVALID_SIDECAR_JSON');
          }
          if (!title && typeof sidecarJson.title === 'string' && sidecarJson.title.trim()) {
            title = sidecarJson.title.normalize('NFC').trim();
          }
          if (!topic && typeof sidecarJson.topic === 'string' && sidecarJson.topic.trim()) {
            topic = sidecarJson.topic.normalize('NFC').trim();
          }
          const sidecarLevel = mapIrodoriLevel(
            typeof sidecarJson.book === 'string'
              ? sidecarJson.book
              : typeof sidecarJson.cefr === 'string'
                ? sidecarJson.cefr
                : typeof sidecarJson.level === 'string'
                  ? sidecarJson.level
                  : undefined,
          );
          if (sidecarLevel && candidate.levelSpec.book === 'A2' && sidecarLevel.cefr === 'A2') {
            levelSpec = sidecarLevel;
          }
          if (Array.isArray(sidecarJson.tags)) {
            tags = [...tags, ...sidecarJson.tags.filter((t): t is string => typeof t === 'string')];
          }
          if (roadmapWeek === null && sidecarJson.roadmapWeek !== undefined && sidecarJson.roadmapWeek !== null) {
            roadmapWeek = normalizeRoadmapWeek(sidecarJson.roadmapWeek);
          }
          if (durationMs === null) {
            durationMs = coerceMs(sidecarJson.durationMs, sidecarJson.duration_ms, null);
          }
          if (clipStartMs === null) {
            clipStartMs = coerceMs(sidecarJson.clipStartMs, sidecarJson.clip_start_ms, null);
          }
          if (clipEndMs === null) {
            clipEndMs = coerceMs(sidecarJson.clipEndMs, sidecarJson.clip_end_ms, null);
          }
          if (!segments && Array.isArray(sidecarJson.segments)) {
            segments = normalizeManualSegments(sidecarJson.segments as ManifestSegmentInput[]);
          }
        } else if (subExt === '.vtt') {
          const parsed = parseWebVtt(subText);
          if (parsed.cues.length === 0) {
            errors.push({
              ref: candidate.ref,
              code: 'INVALID_SUBTITLE_FORMAT',
              message: parsed.errors[0]?.reason ?? 'Không đọc được câu phụ đề WebVTT hợp lệ.',
            });
            continue;
          }
          parsedCues = parsed.cues;
        } else if (subExt === '.srt' || subExt === '.ass' || subExt === '.ssa') {
          const parsed = parseSubtitleFile(path.basename(subPath), subText);
          if (!parsed.ok) {
            errors.push({ ref: candidate.ref, code: parsed.code, message: parsed.message });
            continue;
          }
          parsedCues = parsed.value.cues;
        } else if (subExt === '.txt') {
          plainTextScript = subText.normalize('NFC').trim();
        }
      }

      if (!segments && !parsedCues && !plainTextScript) {
        errors.push({
          ref: candidate.ref,
          code: 'MISSING_TRANSCRIPT',
          message: 'Thiếu tệp phụ đề/kịch bản (.json, .srt, .vtt, .ass hoặc .txt) khớp với tệp audio.',
        });
        continue;
      }

      // 3. Resolve duration & clip bounds
      const detectedDuration = detectAudioDurationMs(uploadCheck.value.mime, bytes);
      const maxTimingEnd =
        segments && segments.length > 0
          ? Math.max(...segments.map((s) => s.endMs))
          : parsedCues && parsedCues.length > 0
            ? Math.max(...parsedCues.map((c) => c.endMs))
            : null;

      if (durationMs === null) {
        durationMs = Math.max(detectedDuration ?? 0, maxTimingEnd ?? 0) || null;
      }
      if (durationMs === null || durationMs < MIN_CLIP_SPAN_MS) {
        errors.push({
          ref: candidate.ref,
          code: 'INVALID_DURATION',
          message: 'Không xác định được độ dài clip hợp lệ (tối thiểu 1 giây).',
        });
        continue;
      }

      const defaultStart =
        clipStartMs ??
        (segments && segments.length > 0
          ? Math.min(0, segments[0].startMs) < 0
            ? 0
            : 0
          : 0);
      const defaultEnd =
        clipEndMs ??
        (maxTimingEnd && maxTimingEnd >= MIN_CLIP_SPAN_MS
          ? Math.min(durationMs, maxTimingEnd)
          : Math.min(durationMs, MAX_CLIP_SPAN_MS));
      const clamped = clampClipRange(defaultStart, defaultEnd, durationMs);
      const finalStartMs = clipStartMs ?? clamped.clipStartMs;
      const finalEndMs = clipEndMs ?? clamped.clipEndMs;

      // 4. Build final segments
      let draftSegments: DraftSegment[];
      if (segments) {
        draftSegments = segments;
      } else if (parsedCues) {
        draftSegments = buildSegmentsFromSubtitles(parsedCues, finalStartMs, finalEndMs, { autoSplit: true });
      } else {
        draftSegments = buildSegmentsFromPlainText(plainTextScript!, finalStartMs, finalEndMs);
      }

      if (draftSegments.length === 0) {
        errors.push({
          ref: candidate.ref,
          code: 'EMPTY_SEGMENTS',
          message: 'Không trích được câu hội thoại nào trong khoảng thời gian của clip.',
        });
        continue;
      }

      // 5. Optional offline auto-meta enrichment (furigana, tags, roadmap week)
      let enrichedTags = [...levelSpec.tags, ...tags];
      if (autoMeta) {
        if (hasDb) {
          try {
            const meta = await analyzeClipMetadata(
              draftSegments.map((s) => s.ja),
              { dbFile },
            );
            draftSegments = draftSegments.map((seg, idx) => {
              const autoSeg = meta.segments[idx];
              const furigana = seg.furigana ?? (autoSeg?.furigana || null);
              const kana = seg.kana ?? (furigana ? furiganaToKana(furigana) : autoSeg?.kana || null);
              return { ...seg, furigana, kana };
            });
            enrichedTags = [...enrichedTags, ...meta.suggestedTags];
            if (roadmapWeek === null && meta.suggestedWeek !== null) {
              roadmapWeek = meta.suggestedWeek;
            }
          } catch {
            // Fall back to tokenizer-only furigana if DB catalog is unavailable
            const fallbackTok = await loadShadowingTokenizer();
            draftSegments = draftSegments.map((seg) => {
              if (seg.furigana) return seg;
              const built = buildSentenceFurigana(seg.ja, fallbackTok);
              return {
                ...seg,
                furigana: built.furigana || null,
                kana: seg.kana ?? (built.kana || null),
              };
            });
          }
        } else {
          draftSegments = draftSegments.map((seg) => {
            if (seg.furigana) return seg;
            const built = buildSentenceFurigana(seg.ja, tokenizer);
            return {
              ...seg,
              furigana: built.furigana || null,
              kana: seg.kana ?? (built.kana || null),
            };
          });
        }
      }

      const finalTitle =
        title ||
        (candidate.lesson
          ? `Bài ${candidate.lesson} · ${humanizeName(path.basename(audioPath))}`
          : humanizeName(path.basename(audioPath)));
      const finalTopic = topic || (candidate.lesson ? `Bài ${candidate.lesson}` : 'Hội thoại IRODORI');
      const finalTags = normalizeClipTags(enrichedTags).slice(0, 6);

      const draftInput = {
        title: finalTitle.slice(0, 120),
        level: levelSpec.jlpt,
        topic: finalTopic.slice(0, 80),
        tags: finalTags,
        roadmapWeek,
        durationMs,
        clipStartMs: finalStartMs,
        clipEndMs: finalEndMs,
        segments: draftSegments,
      };

      const draftCheck = validateClipDraft({ ...draftInput, kind: 'file' });
      if (!draftCheck.ok) {
        errors.push({ ref: candidate.ref, code: draftCheck.code, message: draftCheck.message });
        continue;
      }

      const keySeed =
        candidate.explicitId || path.relative(rootReal, audioPath).replace(/\\/g, '/');
      const { id, sourceKey } = buildStableClipIds(levelSpec.book, keySeed);

      let status: IrodoriImportedClipSummary['status'] = 'dry-run';
      if (!dryRun) {
        const res = upsertImportedFileClip({
          id,
          sourceKey,
          attribution: levelSpec.attribution,
          license: IRODORI_LICENSE,
          draft: draftInput,
          bytes,
          mime: uploadCheck.value.mime,
          dbFile,
          storePath,
          mediaDir,
          now,
        });
        status = res.status;
        if (status === 'created') {
          created++;
          byLevel[levelSpec.cefr].created++;
        } else if (status === 'updated') {
          updated++;
          byLevel[levelSpec.cefr].updated++;
        } else {
          unchanged++;
          byLevel[levelSpec.cefr].unchanged++;
        }
      }

      byLevel[levelSpec.cefr].count++;
      clips.push({
        id,
        sourceKey,
        title: draftCheck.value.title,
        cefr: levelSpec.cefr,
        book: levelSpec.book,
        jlpt: levelSpec.jlpt,
        attribution: levelSpec.attribution,
        topic: draftCheck.value.topic,
        tags: draftCheck.value.tags,
        roadmapWeek: draftCheck.value.roadmapWeek,
        sentenceCount: draftCheck.value.segments.length,
        durationMs: draftCheck.value.durationMs,
        status,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'IMPORT_FAILED';
      errors.push({
        ref: candidate.ref,
        code,
        message: `Không thể nhập clip (${code}).`,
      });
    }
  }

  return {
    dryRun,
    sourceDir,
    totals: {
      discovered: candidates.length,
      valid: clips.length,
      created,
      updated,
      unchanged,
      errors: errors.length,
    },
    byLevel,
    clips,
    errors,
  };
}

export function formatIrodoriReport(report: IrodoriImportReport): string {
  const lines: string[] = [];
  lines.push(
    report.dryRun
      ? '=== IRODORI DRY-RUN (không ghi tệp vào kho Shadowing) ==='
      : '=== IRODORI IMPORT HOÀN TẤT ===',
  );
  lines.push(`Phát hiện: ${report.totals.discovered} · Hợp lệ: ${report.totals.valid} · Lỗi: ${report.totals.errors}`);
  if (!report.dryRun) {
    lines.push(
      `Kết quả ghi kho: mới ${report.totals.created} · cập nhật ${report.totals.updated} · giữ nguyên ${report.totals.unchanged}`,
    );
  }
  lines.push('Phân bổ theo cấp:');
  for (const cefr of ['A1', 'A2', 'B1'] as const) {
    const row = report.byLevel[cefr];
    const detail = report.dryRun
      ? `${row.count} clip`
      : `${row.count} clip (mới ${row.created}, cập nhật ${row.updated}, giữ nguyên ${row.unchanged})`;
    lines.push(`  - ${cefr} -> ${row.jlpt}: ${detail}`);
  }
  if (report.errors.length > 0) {
    lines.push('Mục lỗi/bỏ qua:');
    for (const err of report.errors) {
      lines.push(`  ! [${err.code}] ${err.ref}: ${err.message}`);
    }
  }
  return lines.join('\n');
}
