import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { databasePath } from '../../../core/config.ts';
import { localClock } from '../today-roadmap/model.ts';
import {
  ALLOWED_AUDIO_MIMES,
  compareIsoDesc,
  extensionForMime,
  HISTORY_RETENTION_DAYS,
  MAX_PIN_AUDIO_BYTES,
  MAX_TURNS_PER_CLIP,
  normalizeAudioMime,
  RECORDING_RETENTION_DAYS,
  summarizeClipHistory,
  type AllowedAudioMime,
  type ClipHistorySummary,
  type PinnedBestTake,
  type ShadowingHistoryStore,
  type ShadowingTurn,
} from './history-model.ts';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const DAY_MS = 24 * 60 * 60 * 1000;
const SAFE_AUDIO_REL = /^shadowing\/[a-zA-Z0-9._-]{1,120}\.(webm|m4a|ogg)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function shadowingHistoryPath(dbFile = databasePath()): string {
  if (process.env.NIHON_SHADOWING_HISTORY_PATH) {
    return path.resolve(process.env.NIHON_SHADOWING_HISTORY_PATH);
  }
  return path.join(path.dirname(path.resolve(dbFile)), 'private', 'shadowing-history.json');
}

export function shadowingRecordingsDir(dbFile = databasePath()): string {
  if (process.env.NIHON_RECORDINGS_DIR) {
    return path.resolve(process.env.NIHON_RECORDINGS_DIR);
  }
  return path.join(path.dirname(path.resolve(dbFile)), 'recordings');
}

function emptyStore(): ShadowingHistoryStore {
  return { version: 1, turns: [], pinned: {} };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAllowedMime(value: unknown): value is AllowedAudioMime {
  return typeof value === 'string' && (ALLOWED_AUDIO_MIMES as readonly string[]).includes(value);
}

export function validateShadowingHistoryStore(raw: unknown): ShadowingHistoryStore {
  if (!isPlainObject(raw) || raw.version !== 1 || !Array.isArray(raw.turns) || !isPlainObject(raw.pinned)) {
    throw new Error('INVALID_SHADOWING_HISTORY');
  }
  if (raw.turns.length > 10000) {
    throw new Error('INVALID_SHADOWING_HISTORY');
  }
  const turns: ShadowingTurn[] = [];
  for (const item of raw.turns) {
    if (!isPlainObject(item)) throw new Error('INVALID_SHADOWING_HISTORY');
    const id = item.id;
    const clipId = item.clipId;
    const segmentId = item.segmentId;
    const practicedAt = item.practicedAt;
    const date = item.date;
    const durationMs = item.durationMs;
    const recordedSegments = item.recordedSegments;
    const totalSegments = item.totalSegments;
    const audioFile = item.audioFile;
    const audioMime = item.audioMime;
    const audioBytes = item.audioBytes;
    if (
      typeof id !== 'string' ||
      !id ||
      id.length > 128 ||
      typeof clipId !== 'string' ||
      !clipId ||
      clipId.length > 256 ||
      !(segmentId === null || (typeof segmentId === 'string' && segmentId.length > 0 && segmentId.length <= 256)) ||
      typeof practicedAt !== 'string' ||
      practicedAt.length > 64 ||
      !Number.isFinite(Date.parse(practicedAt)) ||
      typeof date !== 'string' ||
      !DATE_RE.test(date) ||
      !Number.isSafeInteger(durationMs) ||
      (durationMs as number) < 0 ||
      (durationMs as number) > 3_600_000 ||
      !Number.isSafeInteger(recordedSegments) ||
      (recordedSegments as number) < 0 ||
      (recordedSegments as number) > 500 ||
      !Number.isSafeInteger(totalSegments) ||
      (totalSegments as number) < 0 ||
      (totalSegments as number) > 500 ||
      !(audioFile === null || (typeof audioFile === 'string' && SAFE_AUDIO_REL.test(audioFile))) ||
      !(audioMime === null || isAllowedMime(audioMime)) ||
      !(
        audioBytes === null ||
        (Number.isSafeInteger(audioBytes) && (audioBytes as number) > 0 && (audioBytes as number) <= MAX_PIN_AUDIO_BYTES)
      )
    ) {
      throw new Error('INVALID_SHADOWING_HISTORY');
    }
    turns.push({
      id,
      clipId,
      segmentId,
      practicedAt,
      date,
      durationMs: durationMs as number,
      recordedSegments: recordedSegments as number,
      totalSegments: totalSegments as number,
      audioFile,
      audioMime,
      audioBytes: audioBytes as number | null,
    });
  }

  const pinned: Record<string, Record<string, PinnedBestTake>> = {};
  const clipPairs = Object.entries(raw.pinned);
  if (clipPairs.length > 500) throw new Error('INVALID_SHADOWING_HISTORY');
  for (const [clipId, segMap] of clipPairs) {
    if (!clipId || clipId.length > 256 || FORBIDDEN_KEYS.has(clipId) || !isPlainObject(segMap)) {
      throw new Error('INVALID_SHADOWING_HISTORY');
    }
    const segPairs = Object.entries(segMap);
    if (segPairs.length > 200) throw new Error('INVALID_SHADOWING_HISTORY');
    const cleanSegs: Record<string, PinnedBestTake> = {};
    for (const [segmentId, entry] of segPairs) {
      if (!segmentId || segmentId.length > 256 || FORBIDDEN_KEYS.has(segmentId) || !isPlainObject(entry)) {
        throw new Error('INVALID_SHADOWING_HISTORY');
      }
      if (
        typeof entry.id !== 'string' ||
        !entry.id ||
        entry.id.length > 128 ||
        entry.clipId !== clipId ||
        entry.segmentId !== segmentId ||
        typeof entry.pinnedAt !== 'string' ||
        entry.pinnedAt.length > 64 ||
        !Number.isFinite(Date.parse(entry.pinnedAt)) ||
        !Number.isSafeInteger(entry.durationMs) ||
        (entry.durationMs as number) <= 0 ||
        (entry.durationMs as number) > 60_000 ||
        typeof entry.audioFile !== 'string' ||
        !SAFE_AUDIO_REL.test(entry.audioFile) ||
        !isAllowedMime(entry.audioMime) ||
        !Number.isSafeInteger(entry.audioBytes) ||
        (entry.audioBytes as number) <= 0 ||
        (entry.audioBytes as number) > MAX_PIN_AUDIO_BYTES
      ) {
        throw new Error('INVALID_SHADOWING_HISTORY');
      }
      cleanSegs[segmentId] = {
        id: entry.id,
        clipId,
        segmentId,
        pinnedAt: entry.pinnedAt,
        durationMs: entry.durationMs as number,
        audioFile: entry.audioFile,
        audioMime: entry.audioMime,
        audioBytes: entry.audioBytes as number,
      };
    }
    if (Object.keys(cleanSegs).length > 0) {
      pinned[clipId] = cleanSegs;
    }
  }
  return { version: 1, turns, pinned };
}

export function readShadowingHistory(file = shadowingHistoryPath()): ShadowingHistoryStore {
  if (!fs.existsSync(file)) return emptyStore();
  return validateShadowingHistoryStore(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function writeStoreAtomic(file: string, store: ShadowingHistoryStore): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

function withHistoryLock<T>(file: string, action: () => T): T {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let fd: number | undefined;
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      fd = fs.openSync(lock, 'wx', 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const waitUntil = Date.now() + 20;
      while (Date.now() < waitUntil) {
        // brief synchronous backoff
      }
    }
  }
  if (fd === undefined) throw new Error('HISTORY_BUSY');
  try {
    return action();
  } finally {
    fs.closeSync(fd);
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
  }
}

function resolveRecordingFile(recordingsDir: string, relativeFile: string): string {
  if (!SAFE_AUDIO_REL.test(relativeFile)) throw new Error('INVALID_AUDIO_PATH');
  const root = path.resolve(recordingsDir);
  const full = path.resolve(root, relativeFile);
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('INVALID_AUDIO_PATH');
  }
  return full;
}

function pinnedAudioSet(store: ShadowingHistoryStore): Set<string> {
  const files = new Set<string>();
  for (const segMap of Object.values(store.pinned)) {
    for (const pin of Object.values(segMap)) {
      files.add(pin.audioFile);
    }
  }
  return files;
}

function deleteUnpinnedAudioFile(recordingsDir: string, relativeFile: string, pinnedFiles: Set<string>): boolean {
  if (pinnedFiles.has(relativeFile)) return false;
  try {
    const full = resolveRecordingFile(recordingsDir, relativeFile);
    if (fs.existsSync(full) && fs.lstatSync(full).isFile()) {
      fs.unlinkSync(full);
      return true;
    }
  } catch {
    // Ignore missing or already-removed files
  }
  return false;
}

export function pruneShadowingHistory(
  store: ShadowingHistoryStore,
  options: {
    recordingsDir?: string;
    now?: Date;
    historyRetentionDays?: number;
    recordingRetentionDays?: number;
    maxTurnsPerClip?: number;
  } = {},
): { store: ShadowingHistoryStore; prunedTurns: number; prunedFiles: string[] } {
  const nowMs = (options.now ?? new Date()).getTime();
  const historyCutoff = nowMs - (options.historyRetentionDays ?? HISTORY_RETENTION_DAYS) * DAY_MS;
  const recordingCutoff = nowMs - (options.recordingRetentionDays ?? RECORDING_RETENTION_DAYS) * DAY_MS;
  const maxPerClip = options.maxTurnsPerClip ?? MAX_TURNS_PER_CLIP;
  const pinnedFiles = pinnedAudioSet(store);
  const prunedFiles: string[] = [];

  const sorted = store.turns
    .slice()
    .sort((a, b) => {
      const cmp = compareIsoDesc(a.practicedAt, b.practicedAt);
      return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
    });

  const perClipCount = new Map<string, number>();
  const kept: ShadowingTurn[] = [];
  let prunedTurns = 0;

  for (const turn of sorted) {
    const practicedMs = Date.parse(turn.practicedAt);
    const count = perClipCount.get(turn.clipId) ?? 0;
    const expired = Number.isFinite(practicedMs) && practicedMs < historyCutoff;
    const overLimit = count >= maxPerClip;
    if (expired || overLimit) {
      prunedTurns++;
      if (turn.audioFile && options.recordingsDir) {
        if (deleteUnpinnedAudioFile(options.recordingsDir, turn.audioFile, pinnedFiles)) {
          prunedFiles.push(turn.audioFile);
        }
      }
      continue;
    }
    perClipCount.set(turn.clipId, count + 1);
    // Also prune stale audio attached to kept unpinned turns if past recordingRetentionDays
    if (
      turn.audioFile &&
      options.recordingsDir &&
      Number.isFinite(practicedMs) &&
      practicedMs < recordingCutoff &&
      !pinnedFiles.has(turn.audioFile)
    ) {
      if (deleteUnpinnedAudioFile(options.recordingsDir, turn.audioFile, pinnedFiles)) {
        prunedFiles.push(turn.audioFile);
      }
      kept.push({ ...turn, audioFile: null, audioMime: null, audioBytes: null });
    } else {
      kept.push(turn);
    }
  }

  // Sweep orphaned unpinned files inside recordings/shadowing/ older than recordingRetentionDays
  if (options.recordingsDir) {
    const subDir = path.join(path.resolve(options.recordingsDir), 'shadowing');
    if (fs.existsSync(subDir)) {
      const keptTurnAudio = new Set(kept.map((t) => t.audioFile).filter(Boolean) as string[]);
      for (const entry of fs.readdirSync(subDir, { withFileTypes: true })) {
        if (!entry.isFile() || entry.isSymbolicLink()) continue;
        const rel = `shadowing/${entry.name}`;
        if (pinnedFiles.has(rel)) continue; // Pinned best recordings NEVER pruned
        const full = path.join(subDir, entry.name);
        const stat = fs.statSync(full);
        if (!keptTurnAudio.has(rel) || stat.mtimeMs < recordingCutoff) {
          fs.unlinkSync(full);
          prunedFiles.push(rel);
        }
      }
    }
  }

  return {
    store: { version: 1, turns: kept, pinned: store.pinned },
    prunedTurns,
    prunedFiles,
  };
}

export function recordShadowingTurn(input: {
  historyPath?: string;
  recordingsDir?: string;
  clipId: string;
  segmentId: string | null;
  durationMs: number;
  recordedSegments: number;
  totalSegments: number;
  now?: Date;
  timeZone?: string;
}): { turn: ShadowingTurn; summary: ClipHistorySummary } {
  const file = input.historyPath ?? shadowingHistoryPath();
  const recordingsDir = input.recordingsDir ?? shadowingRecordingsDir();
  const now = input.now ?? new Date();
  const date = localClock(now, input.timeZone ?? 'Asia/Ho_Chi_Minh').date;
  const durationMs = Math.min(3_600_000, Math.max(1, Math.round(input.durationMs)));
  const recordedSegments = Math.min(500, Math.max(0, Math.round(input.recordedSegments)));
  const totalSegments = Math.min(500, Math.max(0, Math.round(input.totalSegments)));

  const turn: ShadowingTurn = {
    id: randomUUID(),
    clipId: input.clipId,
    segmentId: input.segmentId,
    practicedAt: now.toISOString(),
    date,
    durationMs,
    recordedSegments,
    totalSegments,
    audioFile: null,
    audioMime: null,
    audioBytes: null,
  };

  const updated = withHistoryLock(file, () => {
    const store = readShadowingHistory(file);
    store.turns.unshift(turn);
    const { store: pruned } = pruneShadowingHistory(store, { recordingsDir, now });
    writeStoreAtomic(file, pruned);
    return pruned;
  });

  return { turn, summary: summarizeClipHistory(updated, input.clipId) };
}

export function pinBestRecording(input: {
  historyPath?: string;
  recordingsDir?: string;
  clipId: string;
  segmentId: string;
  durationMs: number;
  audioBytes: Buffer;
  audioMime: string;
  now?: Date;
}): { pin: PinnedBestTake; summary: ClipHistorySummary } {
  const file = input.historyPath ?? shadowingHistoryPath();
  const recordingsDir = input.recordingsDir ?? shadowingRecordingsDir();
  const now = input.now ?? new Date();
  const mime = normalizeAudioMime(input.audioMime);
  if (!mime) throw new Error('UNSUPPORTED_AUDIO_MIME');
  if (!Buffer.isBuffer(input.audioBytes) || input.audioBytes.length <= 0 || input.audioBytes.length > MAX_PIN_AUDIO_BYTES) {
    throw new Error('INVALID_AUDIO_SIZE');
  }
  const durationMs = Math.round(input.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > 60_000) {
    throw new Error('INVALID_DURATION');
  }

  const id = randomUUID();
  const ext = extensionForMime(mime);
  const relFile = `shadowing/pin-${id}.${ext}`;
  const fullAudio = resolveRecordingFile(recordingsDir, relFile);

  const pin: PinnedBestTake = {
    id,
    clipId: input.clipId,
    segmentId: input.segmentId,
    pinnedAt: now.toISOString(),
    durationMs,
    audioFile: relFile,
    audioMime: mime,
    audioBytes: input.audioBytes.length,
  };

  const updated = withHistoryLock(file, () => {
    fs.mkdirSync(path.dirname(fullAudio), { recursive: true });
    const tmpAudio = `${fullAudio}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tmpAudio, input.audioBytes, { flag: 'wx', mode: 0o600 });
      fs.renameSync(tmpAudio, fullAudio);
    } finally {
      if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio);
    }

    const store = readShadowingHistory(file);
    const clipPins = store.pinned[input.clipId] ?? {};
    const previous = clipPins[input.segmentId] ?? null;
    clipPins[input.segmentId] = pin;
    store.pinned[input.clipId] = clipPins;

    const { store: pruned } = pruneShadowingHistory(store, { recordingsDir, now });
    writeStoreAtomic(file, pruned);

    if (previous && previous.audioFile !== pin.audioFile) {
      deleteUnpinnedAudioFile(recordingsDir, previous.audioFile, pinnedAudioSet(pruned));
    }
    return pruned;
  });

  return { pin, summary: summarizeClipHistory(updated, input.clipId) };
}

export function unpinBestRecording(input: {
  historyPath?: string;
  recordingsDir?: string;
  clipId: string;
  segmentId: string;
  now?: Date;
}): { removed: boolean; summary: ClipHistorySummary } {
  const file = input.historyPath ?? shadowingHistoryPath();
  const recordingsDir = input.recordingsDir ?? shadowingRecordingsDir();
  const now = input.now ?? new Date();

  let removed = false;
  const updated = withHistoryLock(file, () => {
    const store = readShadowingHistory(file);
    const clipPins = store.pinned[input.clipId];
    const previous = clipPins?.[input.segmentId] ?? null;
    if (!previous) return store;
    delete clipPins[input.segmentId];
    if (Object.keys(clipPins).length === 0) {
      delete store.pinned[input.clipId];
    }
    removed = true;
    const { store: pruned } = pruneShadowingHistory(store, { recordingsDir, now });
    writeStoreAtomic(file, pruned);
    deleteUnpinnedAudioFile(recordingsDir, previous.audioFile, pinnedAudioSet(pruned));
    return pruned;
  });

  return { removed, summary: summarizeClipHistory(updated, input.clipId) };
}

export function readPinnedAudio(input: {
  historyPath?: string;
  recordingsDir?: string;
  clipId: string;
  segmentId: string;
  pinId?: string | null;
}): { bytes: Buffer; mime: AllowedAudioMime; pin: PinnedBestTake } | null {
  const file = input.historyPath ?? shadowingHistoryPath();
  const recordingsDir = input.recordingsDir ?? shadowingRecordingsDir();
  const store = readShadowingHistory(file);
  const pin = store.pinned[input.clipId]?.[input.segmentId] ?? null;
  if (!pin) return null;
  if (input.pinId && pin.id !== input.pinId) return null;
  const full = resolveRecordingFile(recordingsDir, pin.audioFile);
  if (!fs.existsSync(full) || !fs.lstatSync(full).isFile()) return null;
  return { bytes: fs.readFileSync(full), mime: pin.audioMime, pin };
}
