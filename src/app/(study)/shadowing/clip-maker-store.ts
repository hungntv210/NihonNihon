import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { databasePath } from '../../../core/config.ts';
import type { Clip } from './clip-model.ts';
import { furiganaToKana } from './auto-meta-model.ts';
import {
  ALLOWED_UPLOAD_MIMES,
  MAX_CLIP_UPLOAD_BYTES,
  isSafeStoredMediaName,
  validateClipDraft,
  validateUploadInput,
  type AllowedUploadMime,
  type ClipDraftInput,
} from './clip-maker-model.ts';

export const USER_CLIP_PREFIX = 'user-clip:';
export const MAX_STORED_CLIPS = 1000;
const SOURCE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{1,127}$/;
const IMPORTED_CLIP_ID_RE = /^user-clip:[A-Za-z0-9][A-Za-z0-9._-]{1,84}$/;

export type StoredUserClip = {
  id: string;
  kind: 'file' | 'youtube';
  title: string;
  level: string;
  topic: string;
  tags: string[];
  roadmapWeek: number | null;
  attribution?: string | null;
  license?: string | null;
  sourceKey?: string | null;
  createdAt: string;
  durationMs: number;
  clipStartMs: number;
  clipEndMs: number;
  youtubeId: string | null;
  mediaFile: string | null;
  mediaMime: AllowedUploadMime | null;
  mediaBytes: number | null;
  sha256: string | null;
  segments: {
    id: string;
    startMs: number;
    endMs: number;
    ja: string;
    furigana: string | null;
    kana: string | null;
    speaker: string | null;
    vi: string | null;
  }[];
};

type UserClipStoreFile = {
  version: 1;
  clips: StoredUserClip[];
};

const verifiedUserMedia = new Map<string, string>();

export function shadowingCustomClipsPath(dbFile = databasePath()): string {
  if (process.env.NIHON_SHADOWING_CLIPS_PATH) {
    return path.resolve(process.env.NIHON_SHADOWING_CLIPS_PATH);
  }
  return path.join(path.dirname(path.resolve(dbFile)), 'private', 'shadowing-clips.json');
}

export function shadowingMediaDir(dbFile = databasePath()): string {
  if (process.env.NIHON_SHADOWING_MEDIA_ROOT) {
    return path.resolve(process.env.NIHON_SHADOWING_MEDIA_ROOT);
  }
  return path.join(path.dirname(path.resolve(dbFile)), 'private', 'shadowing-media');
}

export function resolveSafeMediaPath(rootDir: string, relativeName: string): string {
  if (!isSafeStoredMediaName(relativeName)) {
    throw new Error('INVALID_MEDIA_PATH');
  }
  const root = path.resolve(rootDir);
  const full = path.resolve(root, relativeName);
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
    throw new Error('INVALID_MEDIA_PATH');
  }
  return full;
}

function emptyStore(): UserClipStoreFile {
  return { version: 1, clips: [] };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function parseOptionalText(value: unknown, maxLen: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('INVALID_USER_CLIP_STORE');
  const trimmed = value.normalize('NFC').trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) throw new Error('INVALID_USER_CLIP_STORE');
  return trimmed;
}

function parseOptionalSourceKey(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('INVALID_USER_CLIP_STORE');
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!SOURCE_KEY_RE.test(trimmed)) throw new Error('INVALID_USER_CLIP_STORE');
  return trimmed;
}

function validateStoredClip(raw: unknown): StoredUserClip {
  if (!isPlainObject(raw)) throw new Error('INVALID_USER_CLIP_STORE');
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id.startsWith(USER_CLIP_PREFIX) || id.length > 96) {
    throw new Error('INVALID_USER_CLIP_STORE');
  }
  const kind = raw.kind === 'file' || raw.kind === 'youtube' ? raw.kind : null;
  if (!kind) throw new Error('INVALID_USER_CLIP_STORE');
  const createdAt = typeof raw.createdAt === 'string' && Number.isFinite(Date.parse(raw.createdAt))
    ? raw.createdAt
    : null;
  if (!createdAt) throw new Error('INVALID_USER_CLIP_STORE');

  const attribution = parseOptionalText(raw.attribution, 120);
  const license = parseOptionalText(raw.license, 120);
  const sourceKey = parseOptionalSourceKey(raw.sourceKey);

  const draft = validateClipDraft({
    kind,
    title: String(raw.title ?? ''),
    level: typeof raw.level === 'string' ? raw.level : 'N5',
    topic: typeof raw.topic === 'string' ? raw.topic : '',
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    roadmapWeek:
      raw.roadmapWeek === undefined || raw.roadmapWeek === null
        ? null
        : (raw.roadmapWeek as number),
    durationMs: Number(raw.durationMs),
    clipStartMs: Number(raw.clipStartMs),
    clipEndMs: Number(raw.clipEndMs),
    youtubeUrlOrId: typeof raw.youtubeId === 'string' ? raw.youtubeId : undefined,
    segments: Array.isArray(raw.segments) ? (raw.segments as ClipDraftInput['segments']) : [],
  });
  if (!draft.ok) throw new Error('INVALID_USER_CLIP_STORE');

  const extraMeta = {
    ...(attribution ? { attribution } : {}),
    ...(license ? { license } : {}),
    ...(sourceKey ? { sourceKey } : {}),
  };

  if (kind === 'file') {
    const mediaFile = typeof raw.mediaFile === 'string' ? raw.mediaFile : '';
    const mediaMime =
      typeof raw.mediaMime === 'string' && (ALLOWED_UPLOAD_MIMES as readonly string[]).includes(raw.mediaMime)
        ? (raw.mediaMime as AllowedUploadMime)
        : null;
    const mediaBytes = Number(raw.mediaBytes);
    const sha256 = typeof raw.sha256 === 'string' ? raw.sha256 : '';
    if (
      !isSafeStoredMediaName(mediaFile) ||
      !mediaMime ||
      !Number.isSafeInteger(mediaBytes) ||
      mediaBytes <= 0 ||
      mediaBytes > MAX_CLIP_UPLOAD_BYTES ||
      !/^[a-f0-9]{64}$/.test(sha256)
    ) {
      throw new Error('INVALID_USER_CLIP_STORE');
    }
    return {
      id,
      kind: 'file',
      title: draft.value.title,
      level: draft.value.level,
      topic: draft.value.topic,
      tags: draft.value.tags,
      roadmapWeek: draft.value.roadmapWeek,
      ...extraMeta,
      createdAt,
      durationMs: draft.value.durationMs,
      clipStartMs: draft.value.clipStartMs,
      clipEndMs: draft.value.clipEndMs,
      youtubeId: null,
      mediaFile,
      mediaMime,
      mediaBytes,
      sha256,
      segments: draft.value.segments,
    };
  }

  return {
    id,
    kind: 'youtube',
    title: draft.value.title,
    level: draft.value.level,
    topic: draft.value.topic,
    tags: draft.value.tags,
    roadmapWeek: draft.value.roadmapWeek,
    ...extraMeta,
    createdAt,
    durationMs: draft.value.durationMs,
    clipStartMs: draft.value.clipStartMs,
    clipEndMs: draft.value.clipEndMs,
    youtubeId: draft.value.youtubeId,
    mediaFile: null,
    mediaMime: null,
    mediaBytes: null,
    sha256: null,
    segments: draft.value.segments,
  };
}

export function readUserClipStore(storePath = shadowingCustomClipsPath()): UserClipStoreFile {
  if (!fs.existsSync(storePath)) return emptyStore();
  const raw = JSON.parse(fs.readFileSync(storePath, 'utf8')) as unknown;
  if (!isPlainObject(raw) || raw.version !== 1 || !Array.isArray(raw.clips) || raw.clips.length > MAX_STORED_CLIPS) {
    throw new Error('INVALID_USER_CLIP_STORE');
  }
  return { version: 1, clips: raw.clips.map(validateStoredClip) };
}

function writeStoreAtomic(file: string, store: UserClipStoreFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

function withClipStoreLock<T>(file: string, action: () => T): T {
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
  if (fd === undefined) throw new Error('CLIP_STORE_BUSY');
  try {
    return action();
  } finally {
    fs.closeSync(fd);
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
  }
}

export function toPlayableClip(record: StoredUserClip): Clip {
  return {
    id: record.id,
    title: record.title,
    level: record.level,
    topic: record.topic || 'Tự tạo',
    tags: record.tags ?? [],
    roadmapWeek: record.roadmapWeek ?? null,
    duration: record.durationMs / 1000,
    start: record.clipStartMs / 1000,
    end: record.clipEndMs / 1000,
    isDemo: false,
    attribution: record.attribution?.trim() || (record.kind === 'youtube' ? 'YouTube cá nhân' : 'Tệp cá nhân'),
    license: record.license?.trim() || (record.kind === 'youtube' ? 'YouTube embed' : 'Private use'),
    mediaUrl: record.kind === 'file' ? `/shadowing/media?clip=${encodeURIComponent(record.id)}` : null,
    youtubeId: record.kind === 'youtube' ? record.youtubeId : null,
    segments: record.segments.map((seg) => ({
      id: seg.id,
      start: seg.startMs / 1000,
      end: seg.endMs / 1000,
      ja: seg.ja,
      furigana: seg.furigana ?? null,
      kana: seg.kana ?? (seg.furigana ? furiganaToKana(seg.furigana) : null),
      speaker: seg.speaker,
      vi: seg.vi,
    })),
  };
}

export function listUserShadowingClips(
  dbFile = databasePath(),
  storePath = shadowingCustomClipsPath(dbFile),
): Clip[] {
  return readUserClipStore(storePath).clips.map(toPlayableClip);
}

export function createUserFileClip(input: {
  draft: Omit<ClipDraftInput, 'kind'>;
  bytes: Buffer;
  mime: string | null | undefined;
  dbFile?: string;
  storePath?: string;
  mediaDir?: string;
  now?: Date;
}): { record: StoredUserClip; clip: Clip } {
  const validatedUpload = validateUploadInput({
    mime: input.mime,
    size: input.bytes.length,
    bytes: input.bytes,
  });
  if (!validatedUpload.ok) {
    throw new Error(validatedUpload.code);
  }
  const validatedDraft = validateClipDraft({ ...input.draft, kind: 'file' });
  if (!validatedDraft.ok) {
    throw new Error(validatedDraft.code);
  }

  const dbFile = input.dbFile ?? databasePath();
  const storePath = input.storePath ?? shadowingCustomClipsPath(dbFile);
  const mediaDir = input.mediaDir ?? shadowingMediaDir(dbFile);
  const now = input.now ?? new Date();

  const uuid = randomUUID();
  const id = `${USER_CLIP_PREFIX}${uuid}`;
  const mediaFile = `clip-${uuid}.${validatedUpload.value.extension}`;
  const fullMedia = resolveSafeMediaPath(mediaDir, mediaFile);
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');

  const record: StoredUserClip = {
    id,
    kind: 'file',
    title: validatedDraft.value.title,
    level: validatedDraft.value.level,
    topic: validatedDraft.value.topic,
    tags: validatedDraft.value.tags,
    roadmapWeek: validatedDraft.value.roadmapWeek,
    createdAt: now.toISOString(),
    durationMs: validatedDraft.value.durationMs,
    clipStartMs: validatedDraft.value.clipStartMs,
    clipEndMs: validatedDraft.value.clipEndMs,
    youtubeId: null,
    mediaFile,
    mediaMime: validatedUpload.value.mime,
    mediaBytes: input.bytes.length,
    sha256,
    segments: validatedDraft.value.segments.map((s, idx) => ({
      ...s,
      id: `${id}:seg-${idx + 1}`,
    })),
  };

  let wroteMedia = false;
  try {
    withClipStoreLock(storePath, () => {
      const store = readUserClipStore(storePath);
      if (store.clips.length >= MAX_STORED_CLIPS) {
        throw new Error('CLIP_LIMIT_REACHED');
      }
      fs.mkdirSync(mediaDir, { recursive: true });
      const tmpMedia = `${fullMedia}.${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(tmpMedia, input.bytes, { flag: 'wx', mode: 0o600 });
        fs.renameSync(tmpMedia, fullMedia);
        wroteMedia = true;
      } finally {
        if (fs.existsSync(tmpMedia)) fs.unlinkSync(tmpMedia);
      }
      store.clips.push(record);
      writeStoreAtomic(storePath, store);
    });
  } catch (error) {
    if (wroteMedia && fs.existsSync(fullMedia)) {
      try {
        fs.unlinkSync(fullMedia);
      } catch {
        // Ignore best-effort cleanup error
      }
    }
    throw error;
  }

  return { record, clip: toPlayableClip(record) };
}

function sameStoredSegments(
  a: StoredUserClip['segments'],
  b: StoredUserClip['segments'],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i]!;
    const sb = b[i]!;
    if (
      sa.startMs !== sb.startMs ||
      sa.endMs !== sb.endMs ||
      sa.ja !== sb.ja ||
      (sa.furigana ?? null) !== (sb.furigana ?? null) ||
      (sa.kana ?? null) !== (sb.kana ?? null) ||
      (sa.speaker ?? null) !== (sb.speaker ?? null) ||
      (sa.vi ?? null) !== (sb.vi ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function sameStoredClipContent(a: StoredUserClip, b: StoredUserClip): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.level === b.level &&
    a.topic === b.topic &&
    a.roadmapWeek === b.roadmapWeek &&
    (a.attribution ?? null) === (b.attribution ?? null) &&
    (a.license ?? null) === (b.license ?? null) &&
    (a.sourceKey ?? null) === (b.sourceKey ?? null) &&
    a.durationMs === b.durationMs &&
    a.clipStartMs === b.clipStartMs &&
    a.clipEndMs === b.clipEndMs &&
    a.mediaFile === b.mediaFile &&
    a.mediaMime === b.mediaMime &&
    a.mediaBytes === b.mediaBytes &&
    a.sha256 === b.sha256 &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    sameStoredSegments(a.segments, b.segments)
  );
}

export function upsertImportedFileClip(input: {
  id: string;
  sourceKey: string;
  attribution: string;
  license: string;
  draft: Omit<ClipDraftInput, 'kind'>;
  bytes: Buffer;
  mime: string | null | undefined;
  dbFile?: string;
  storePath?: string;
  mediaDir?: string;
  now?: Date;
}): { status: 'created' | 'updated' | 'unchanged'; record: StoredUserClip; clip: Clip } {
  if (!IMPORTED_CLIP_ID_RE.test(input.id)) {
    throw new Error('INVALID_IMPORTED_CLIP_ID');
  }
  if (!SOURCE_KEY_RE.test(input.sourceKey)) {
    throw new Error('INVALID_SOURCE_KEY');
  }
  const attribution = input.attribution.normalize('NFC').trim();
  const license = input.license.normalize('NFC').trim();
  if (!attribution || attribution.length > 120 || !license || license.length > 120) {
    throw new Error('INVALID_IMPORT_ATTRIBUTION');
  }

  const validatedUpload = validateUploadInput({
    mime: input.mime,
    size: input.bytes.length,
    bytes: input.bytes,
  });
  if (!validatedUpload.ok) {
    throw new Error(validatedUpload.code);
  }
  const validatedDraft = validateClipDraft({ ...input.draft, kind: 'file' });
  if (!validatedDraft.ok) {
    throw new Error(validatedDraft.code);
  }

  const dbFile = input.dbFile ?? databasePath();
  const storePath = input.storePath ?? shadowingCustomClipsPath(dbFile);
  const mediaDir = input.mediaDir ?? shadowingMediaDir(dbFile);
  const now = input.now ?? new Date();

  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const fileDigest = createHash('sha256')
    .update(`${input.sourceKey}\0${sha256}`)
    .digest('hex')
    .slice(0, 32);
  const mediaFile = `clip-${fileDigest}.${validatedUpload.value.extension}`;
  const fullMedia = resolveSafeMediaPath(mediaDir, mediaFile);

  let status: 'created' | 'updated' | 'unchanged' = 'created';
  let finalRecord!: StoredUserClip;
  let wroteMedia = false;
  let oldMediaToDelete: string | null = null;

  try {
    withClipStoreLock(storePath, () => {
      const store = readUserClipStore(storePath);
      const existingIdx = store.clips.findIndex(
        (c) => c.sourceKey === input.sourceKey || c.id === input.id,
      );
      const existing = existingIdx >= 0 ? store.clips[existingIdx] : null;
      const clipId = existing ? existing.id : input.id;

      const nextRecord: StoredUserClip = {
        id: clipId,
        kind: 'file',
        title: validatedDraft.value.title,
        level: validatedDraft.value.level,
        topic: validatedDraft.value.topic,
        tags: validatedDraft.value.tags,
        roadmapWeek: validatedDraft.value.roadmapWeek,
        attribution,
        license,
        sourceKey: input.sourceKey,
        createdAt: existing ? existing.createdAt : now.toISOString(),
        durationMs: validatedDraft.value.durationMs,
        clipStartMs: validatedDraft.value.clipStartMs,
        clipEndMs: validatedDraft.value.clipEndMs,
        youtubeId: null,
        mediaFile,
        mediaMime: validatedUpload.value.mime,
        mediaBytes: input.bytes.length,
        sha256,
        segments: validatedDraft.value.segments.map((s, idx) => ({
          ...s,
          id: `${clipId}:seg-${idx + 1}`,
        })),
      };

      if (existing && sameStoredClipContent(existing, nextRecord) && fs.existsSync(fullMedia)) {
        status = 'unchanged';
        finalRecord = existing;
        return;
      }

      if (!existing && store.clips.length >= MAX_STORED_CLIPS) {
        throw new Error('CLIP_LIMIT_REACHED');
      }

      fs.mkdirSync(mediaDir, { recursive: true });
      if (!fs.existsSync(fullMedia)) {
        const tmpMedia = `${fullMedia}.${randomUUID()}.tmp`;
        try {
          fs.writeFileSync(tmpMedia, input.bytes, { flag: 'wx', mode: 0o600 });
          fs.renameSync(tmpMedia, fullMedia);
          wroteMedia = true;
        } finally {
          if (fs.existsSync(tmpMedia)) fs.unlinkSync(tmpMedia);
        }
      }

      if (existing) {
        status = 'updated';
        if (existing.mediaFile && existing.mediaFile !== mediaFile) {
          oldMediaToDelete = existing.mediaFile;
        }
        store.clips[existingIdx] = nextRecord;
      } else {
        status = 'created';
        store.clips.push(nextRecord);
      }
      writeStoreAtomic(storePath, store);
      finalRecord = nextRecord;
    });
  } catch (error) {
    if (wroteMedia && fs.existsSync(fullMedia)) {
      try {
        fs.unlinkSync(fullMedia);
      } catch {
        // Ignore best-effort cleanup error
      }
    }
    throw error;
  }

  if (oldMediaToDelete) {
    try {
      const oldFull = resolveSafeMediaPath(mediaDir, oldMediaToDelete);
      if (fs.existsSync(oldFull) && !fs.lstatSync(oldFull).isSymbolicLink() && fs.lstatSync(oldFull).isFile()) {
        fs.unlinkSync(oldFull);
      }
    } catch {
      // Ignore best-effort cleanup error
    }
  }

  return { status, record: finalRecord, clip: toPlayableClip(finalRecord) };
}

export function createUserYoutubeClip(input: {
  draft: Omit<ClipDraftInput, 'kind'>;
  dbFile?: string;
  storePath?: string;
  now?: Date;
}): { record: StoredUserClip; clip: Clip } {
  const validatedDraft = validateClipDraft({ ...input.draft, kind: 'youtube' });
  if (!validatedDraft.ok) {
    throw new Error(validatedDraft.code);
  }
  const dbFile = input.dbFile ?? databasePath();
  const storePath = input.storePath ?? shadowingCustomClipsPath(dbFile);
  const now = input.now ?? new Date();
  const uuid = randomUUID();
  const id = `${USER_CLIP_PREFIX}${uuid}`;

  const record: StoredUserClip = {
    id,
    kind: 'youtube',
    title: validatedDraft.value.title,
    level: validatedDraft.value.level,
    topic: validatedDraft.value.topic,
    tags: validatedDraft.value.tags,
    roadmapWeek: validatedDraft.value.roadmapWeek,
    createdAt: now.toISOString(),
    durationMs: validatedDraft.value.durationMs,
    clipStartMs: validatedDraft.value.clipStartMs,
    clipEndMs: validatedDraft.value.clipEndMs,
    youtubeId: validatedDraft.value.youtubeId,
    mediaFile: null,
    mediaMime: null,
    mediaBytes: null,
    sha256: null,
    segments: validatedDraft.value.segments.map((s, idx) => ({
      ...s,
      id: `${id}:seg-${idx + 1}`,
    })),
  };

  withClipStoreLock(storePath, () => {
    const store = readUserClipStore(storePath);
    if (store.clips.length >= MAX_STORED_CLIPS) {
      throw new Error('CLIP_LIMIT_REACHED');
    }
    store.clips.push(record);
    writeStoreAtomic(storePath, store);
  });

  return { record, clip: toPlayableClip(record) };
}

export function deleteUserClip(input: {
  id: string;
  dbFile?: string;
  storePath?: string;
  mediaDir?: string;
}): boolean {
  if (!input.id.startsWith(USER_CLIP_PREFIX)) return false;
  const dbFile = input.dbFile ?? databasePath();
  const storePath = input.storePath ?? shadowingCustomClipsPath(dbFile);
  const mediaDir = input.mediaDir ?? shadowingMediaDir(dbFile);

  let removed: StoredUserClip | null = null;
  withClipStoreLock(storePath, () => {
    const store = readUserClipStore(storePath);
    const idx = store.clips.findIndex((c) => c.id === input.id);
    if (idx < 0) return;
    removed = store.clips[idx];
    store.clips.splice(idx, 1);
    writeStoreAtomic(storePath, store);
  });

  if (!removed) return false;
  const target = removed as StoredUserClip;
  if (target.kind === 'file' && target.mediaFile) {
    try {
      const full = resolveSafeMediaPath(mediaDir, target.mediaFile);
      if (fs.existsSync(full) && !fs.lstatSync(full).isSymbolicLink() && fs.lstatSync(full).isFile()) {
        fs.unlinkSync(full);
      }
    } catch {
      // Ignore missing or already-removed media file
    }
  }
  return true;
}

export async function resolveUserClipMedia(
  id: string,
  dbFile = databasePath(),
  storePath = shadowingCustomClipsPath(dbFile),
  mediaDir = shadowingMediaDir(dbFile),
): Promise<{ path: string; size: number; mime: AllowedUploadMime }> {
  if (!id.startsWith(USER_CLIP_PREFIX)) throw new Error('CLIP_NOT_FOUND');
  const store = readUserClipStore(storePath);
  const record = store.clips.find((c) => c.id === id && c.kind === 'file');
  if (!record || !record.mediaFile || !record.mediaMime || !record.sha256) {
    throw new Error('CLIP_NOT_FOUND');
  }
  const full = resolveSafeMediaPath(mediaDir, record.mediaFile);
  if (!fs.existsSync(full)) throw new Error('INVALID_MEDIA_FILE');
  const lstat = fs.lstatSync(full);
  if (lstat.isSymbolicLink() || !lstat.isFile()) throw new Error('INVALID_MEDIA_FILE');

  const realRoot = fs.realpathSync(mediaDir);
  const actual = fs.realpathSync(full);
  const rel = path.relative(realRoot, actual);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('MEDIA_OUTSIDE_PRIVATE_ROOT');
  }

  const key = `${actual}:${lstat.size}:${lstat.mtimeMs}:${record.sha256}`;
  if (!verifiedUserMedia.has(key)) {
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(actual)) hash.update(chunk);
    if (hash.digest('hex') !== record.sha256) throw new Error('PRIVATE_MEDIA_HASH_MISMATCH');
    verifiedUserMedia.set(key, record.sha256);
  }
  return { path: actual, size: lstat.size, mime: record.mediaMime };
}

let cachedWhisperAvailable: boolean | null = null;

export function detectLocalWhisper(): boolean {
  if (cachedWhisperAvailable !== null) return cachedWhisperAvailable;
  const configured = process.env.NIHON_WHISPER_CMD?.trim();
  if (configured) {
    cachedWhisperAvailable = fs.existsSync(configured);
    return cachedWhisperAvailable;
  }
  const locator = process.platform === 'win32' ? 'where' : 'which';
  for (const bin of ['whisper', 'whisper-cli', 'whisper-cpp', 'faster-whisper']) {
    try {
      const out = execFileSync(locator, [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (out) {
        cachedWhisperAvailable = true;
        return true;
      }
    } catch {
      // binary not in PATH
    }
  }
  cachedWhisperAvailable = false;
  return false;
}
