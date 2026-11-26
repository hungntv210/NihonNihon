import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { databasePath } from '../../../core/config.ts';
import { openContentDatabase } from '../../../core/content.ts';
import {
  getJmdictEntryById,
  isJmdictItemId,
  resolveJmdictDbPath,
} from '../../../core/jmdict.ts';
import { enqueueCard, type CardType } from '../../../core/review.ts';
import type { LookupSaveSource, SavedLookupSentence } from './lookup-popup-model.ts';

export type LookupSentenceStore = {
  version: 1;
  entries: Record<string, SavedLookupSentence>;
};

export const NOTEBOOK_ENTRY_PREFIX = 'notebook:';
const MAX_STORE_BYTES = 2_000_000;
const ALLOWED_LOOKUP_CARD_TYPES: readonly CardType[] = [
  'recognition',
  'reading',
  'recall',
  'cloze',
  'listening',
];
const ALLOWED_SOURCE_KINDS: readonly LookupSaveSource[] = ['clip', 'lookup', 'jlpt'];
const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function lookupContextPath(): string {
  return path.resolve(
    process.env.NIHON_LOOKUP_CONTEXT_PATH ||
      path.join(path.dirname(databasePath()), 'private', 'lookup-sentences.json'),
  );
}

function emptyStore(): LookupSentenceStore {
  return { version: 1, entries: {} };
}

function isOptionalNullableString(value: unknown, max: number): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.length <= max)
  );
}

function isValidEntry(value: unknown): value is SavedLookupSentence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  if (
    typeof e.cardId !== 'string' ||
    e.cardId.length === 0 ||
    e.cardId.length > 256 ||
    typeof e.itemId !== 'string' ||
    e.itemId.length === 0 ||
    e.itemId.length > 256 ||
    typeof e.sentenceJa !== 'string' ||
    e.sentenceJa.trim().length === 0 ||
    e.sentenceJa.length > 500 ||
    !(e.sentenceVi === null || (typeof e.sentenceVi === 'string' && e.sentenceVi.length <= 500)) ||
    !(e.sourceClipId === null || (typeof e.sourceClipId === 'string' && e.sourceClipId.length <= 128)) ||
    typeof e.savedAt !== 'string' ||
    e.savedAt.length === 0 ||
    e.savedAt.length > 64
  ) {
    return false;
  }
  if (
    e.sourceKind !== undefined &&
    (typeof e.sourceKind !== 'string' ||
      !ALLOWED_SOURCE_KINDS.includes(e.sourceKind as LookupSaveSource))
  ) {
    return false;
  }
  if (
    e.jlptDate !== undefined &&
    e.jlptDate !== null &&
    (typeof e.jlptDate !== 'string' || !isValidCalendarDate(e.jlptDate))
  ) {
    return false;
  }
  if (!isOptionalNullableString(e.jlptQuestionId, 128)) return false;
  if (
    e.jlptQuestionNumber !== undefined &&
    e.jlptQuestionNumber !== null &&
    (!Number.isInteger(e.jlptQuestionNumber) ||
      Number(e.jlptQuestionNumber) < 1 ||
      Number(e.jlptQuestionNumber) > 100)
  ) {
    return false;
  }
  if (e.notebookOnly !== undefined && typeof e.notebookOnly !== 'boolean') return false;
  if (e.sentenceMissing !== undefined && typeof e.sentenceMissing !== 'boolean') return false;
  if (!isOptionalNullableString(e.word, 160)) return false;
  if (!isOptionalNullableString(e.reading, 160)) return false;
  if (!isOptionalNullableString(e.romaji, 256)) return false;
  if (!isOptionalNullableString(e.meaningVi, 1000)) return false;
  if (
    e.meaningsEn !== undefined &&
    e.meaningsEn !== null &&
    (!Array.isArray(e.meaningsEn) ||
      e.meaningsEn.length > 20 ||
      !e.meaningsEn.every((item) => typeof item === 'string' && item.length <= 256))
  ) {
    return false;
  }
  return true;
}

export function validateLookupSentenceStore(value: unknown): LookupSentenceStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_LOOKUP_STORE');
  }
  const raw = value as Record<string, unknown>;
  if (
    raw.version !== 1 ||
    !raw.entries ||
    typeof raw.entries !== 'object' ||
    Array.isArray(raw.entries)
  ) {
    throw new Error('INVALID_LOOKUP_STORE');
  }
  const entries: Record<string, SavedLookupSentence> = {};
  for (const [key, entry] of Object.entries(raw.entries as Record<string, unknown>)) {
    if (
      !key ||
      key.length > 256 ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype' ||
      !isValidEntry(entry)
    ) {
      throw new Error('INVALID_LOOKUP_STORE');
    }
    entries[key] = entry;
  }
  return { version: 1, entries };
}

export function readLookupSentenceStore(file = lookupContextPath()): LookupSentenceStore {
  try {
    if (fs.statSync(file).size > MAX_STORE_BYTES) throw new Error('INVALID_LOOKUP_STORE');
    return validateLookupSentenceStore(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
    throw error;
  }
}

export function getSavedSentenceForItem(
  itemId: string,
  file = lookupContextPath(),
): SavedLookupSentence | null {
  try {
    const store = readLookupSentenceStore(file);
    const matches = Object.values(store.entries).filter((entry) => entry.itemId === itemId);
    if (!matches.length) return null;
    matches.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return matches[0];
  } catch {
    return null;
  }
}

function writeLookupSentenceEntry(
  file: string,
  entry: SavedLookupSentence,
): { store: LookupSentenceStore; created: boolean } {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let descriptor: number;
  try {
    descriptor = fs.openSync(lock, 'wx', 0o600);
  } catch {
    throw new Error('LOOKUP_STORE_BUSY');
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const current = readLookupSentenceStore(file);
    const created = !Object.prototype.hasOwnProperty.call(current.entries, entry.cardId);
    const next = validateLookupSentenceStore({
      version: 1,
      entries: {
        ...current.entries,
        [entry.cardId]: entry,
      },
    });
    fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
    return { store: next, created };
  } finally {
    fs.closeSync(descriptor);
    try {
      fs.unlinkSync(lock);
    } catch {
      // ignore unlock error
    }
    if (fs.existsSync(temporary)) {
      try {
        fs.unlinkSync(temporary);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

function normalizeSourceMeta(params: {
  sourceKind?: LookupSaveSource;
  sourceClipId?: string | null;
  jlptDate?: string | null;
  jlptQuestionId?: string | null;
  jlptQuestionNumber?: number | null;
}) {
  if (
    params.sourceKind !== undefined &&
    !ALLOWED_SOURCE_KINDS.includes(params.sourceKind)
  ) {
    throw new Error('INVALID_SOURCE');
  }
  const sourceClipId =
    typeof params.sourceClipId === 'string' && params.sourceClipId.trim()
      ? params.sourceClipId.trim().slice(0, 128)
      : null;

  let jlptDate: string | null = null;
  if (typeof params.jlptDate === 'string' && params.jlptDate.trim()) {
    const trimmed = params.jlptDate.trim();
    if (!isValidCalendarDate(trimmed)) throw new Error('INVALID_SOURCE');
    jlptDate = trimmed;
  }

  let jlptQuestionId: string | null = null;
  if (typeof params.jlptQuestionId === 'string' && params.jlptQuestionId.trim()) {
    const trimmed = params.jlptQuestionId.trim();
    if (trimmed.length > 128 || /[\x00-\x1f]/.test(trimmed)) {
      throw new Error('INVALID_SOURCE');
    }
    jlptQuestionId = trimmed;
  }

  let jlptQuestionNumber: number | null = null;
  if (params.jlptQuestionNumber !== undefined && params.jlptQuestionNumber !== null) {
    if (
      !Number.isInteger(params.jlptQuestionNumber) ||
      params.jlptQuestionNumber < 1 ||
      params.jlptQuestionNumber > 100
    ) {
      throw new Error('INVALID_SOURCE');
    }
    jlptQuestionNumber = params.jlptQuestionNumber;
  }

  const hasJlptMeta =
    params.sourceKind === 'jlpt' || jlptDate !== null || jlptQuestionId !== null;
  const sourceKind: LookupSaveSource | undefined = hasJlptMeta
    ? 'jlpt'
    : params.sourceKind;

  return {
    sourceClipId,
    sourceKind,
    jlptDate,
    jlptQuestionId,
    jlptQuestionNumber,
  };
}

export function saveLookupItemToSrs(params: {
  dbPath?: string;
  contextPath?: string;
  jmdictPath?: string;
  itemId: string;
  cardType?: CardType;
  sentenceJa: string;
  sentenceVi?: string | null;
  sourceClipId?: string | null;
  sourceKind?: LookupSaveSource;
  jlptDate?: string | null;
  jlptQuestionId?: string | null;
  jlptQuestionNumber?: number | null;
  now?: Date;
}) {
  const cardType = params.cardType ?? 'recognition';
  if (!ALLOWED_LOOKUP_CARD_TYPES.includes(cardType)) {
    throw new Error('INVALID_CARD');
  }
  const sentenceJa = params.sentenceJa.normalize('NFC').trim();
  if (!sentenceJa || sentenceJa.length > 500) {
    throw new Error('INVALID_SENTENCE');
  }
  const sentenceVi =
    typeof params.sentenceVi === 'string' && params.sentenceVi.trim()
      ? params.sentenceVi.normalize('NFC').trim().slice(0, 500)
      : null;
  const meta = normalizeSourceMeta(params);
  const now = params.now ?? new Date();
  const card = enqueueCard(
    params.dbPath ?? databasePath(),
    params.itemId,
    cardType,
    now,
    params.jmdictPath,
  );
  const sentence: SavedLookupSentence = {
    cardId: card.cardId,
    itemId: params.itemId,
    sentenceJa,
    sentenceVi,
    sourceClipId: meta.sourceClipId,
    savedAt: now.toISOString(),
    ...(meta.sourceKind ? { sourceKind: meta.sourceKind } : {}),
    ...(meta.jlptDate ? { jlptDate: meta.jlptDate } : {}),
    ...(meta.jlptQuestionId ? { jlptQuestionId: meta.jlptQuestionId } : {}),
    ...(meta.jlptQuestionNumber !== null ? { jlptQuestionNumber: meta.jlptQuestionNumber } : {}),
  };
  writeLookupSentenceEntry(params.contextPath ?? lookupContextPath(), sentence);
  return {
    ...card,
    sentence,
  };
}

type ResolvedNotebookItem = {
  word: string;
  reading: string;
  romaji: string;
  meaningVi: string | null;
  meaningsEn: string[];
  outsideJlpt: boolean;
};

function resolveNotebookItemReadOnly(
  dbFile: string,
  itemId: string,
  jmdictPath?: string,
): ResolvedNotebookItem | null {
  const db = openContentDatabase(dbFile);
  try {
    const row = db
      .prepare(
        `SELECT v.word, v.reading, v.romaji, v.meanings_en, i.source_id
         FROM vocab v
         JOIN content_items i USING(item_id)
         WHERE i.is_active=1 AND v.item_id=?`,
      )
      .get(itemId) as Record<string, unknown> | undefined;
    if (row) {
      return {
        word: String(row.word),
        reading: String(row.reading),
        romaji: String(row.romaji ?? ''),
        meaningVi: null,
        meaningsEn: JSON.parse(String(row.meanings_en)) as string[],
        outsideJlpt: String(row.source_id) === 'jmdict',
      };
    }
  } finally {
    db.close();
  }

  if (isJmdictItemId(itemId)) {
    const resolvedJmdict = resolveJmdictDbPath(dbFile, jmdictPath);
    const found = resolvedJmdict ? getJmdictEntryById(resolvedJmdict, itemId) : null;
    if (found) {
      return {
        word: found.entry.word,
        reading: found.entry.reading,
        romaji: found.entry.romaji,
        meaningVi: found.entry.meaningVi,
        meaningsEn: found.entry.meaningsEn,
        outsideJlpt: true,
      };
    }
  }

  return null;
}

export function saveLookupItemToNotebook(params: {
  dbPath?: string;
  contextPath?: string;
  jmdictPath?: string;
  itemId: string;
  sentenceJa?: string | null;
  sentenceVi?: string | null;
  sourceClipId?: string | null;
  sourceKind?: LookupSaveSource;
  jlptDate?: string | null;
  jlptQuestionId?: string | null;
  jlptQuestionNumber?: number | null;
  now?: Date;
}) {
  if (typeof params.itemId !== 'string' || !params.itemId.trim() || params.itemId.length > 256) {
    throw new Error('INVALID_CARD');
  }
  const itemId = params.itemId.trim();
  const cardId = `${NOTEBOOK_ENTRY_PREFIX}${itemId}`;
  if (cardId.length > 256) {
    throw new Error('INVALID_CARD');
  }

  const meta = normalizeSourceMeta(params);
  const dbFile = params.dbPath ?? databasePath();
  const resolved = resolveNotebookItemReadOnly(dbFile, itemId, params.jmdictPath);
  if (!resolved) {
    throw new Error('ITEM_NOT_FOUND');
  }

  const rawSentence =
    typeof params.sentenceJa === 'string' ? params.sentenceJa.normalize('NFC').trim() : '';
  if (rawSentence.length > 500) {
    throw new Error('INVALID_SENTENCE');
  }
  const sentenceMissing = rawSentence.length === 0;
  const sentenceJa = sentenceMissing
    ? resolved.word.normalize('NFC').trim().slice(0, 500)
    : rawSentence;
  if (!sentenceJa) {
    throw new Error('INVALID_SENTENCE');
  }
  const sentenceVi =
    !sentenceMissing && typeof params.sentenceVi === 'string' && params.sentenceVi.trim()
      ? params.sentenceVi.normalize('NFC').trim().slice(0, 500)
      : null;

  const effectiveSourceKind: LookupSaveSource =
    meta.sourceKind ?? (meta.sourceClipId ? 'clip' : 'lookup');
  const now = params.now ?? new Date();

  const sentence: SavedLookupSentence = {
    cardId,
    itemId,
    sentenceJa,
    sentenceVi,
    sourceClipId: meta.sourceClipId,
    savedAt: now.toISOString(),
    sourceKind: effectiveSourceKind,
    notebookOnly: true,
    ...(sentenceMissing ? { sentenceMissing: true } : {}),
    ...(meta.jlptDate ? { jlptDate: meta.jlptDate } : {}),
    ...(meta.jlptQuestionId ? { jlptQuestionId: meta.jlptQuestionId } : {}),
    ...(meta.jlptQuestionNumber !== null ? { jlptQuestionNumber: meta.jlptQuestionNumber } : {}),
    ...(isJmdictItemId(itemId)
      ? {
          word: resolved.word.slice(0, 160),
          reading: resolved.reading.slice(0, 160),
          romaji: resolved.romaji.slice(0, 256),
          meaningVi: resolved.meaningVi ? resolved.meaningVi.slice(0, 1000) : null,
          meaningsEn: resolved.meaningsEn.slice(0, 20).map((s) => s.slice(0, 256)),
        }
      : {}),
  };

  const { created } = writeLookupSentenceEntry(
    params.contextPath ?? lookupContextPath(),
    sentence,
  );

  return {
    cardId,
    itemId,
    created,
    notebookOnly: true as const,
    sentence,
  };
}
