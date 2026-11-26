import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { databasePath } from '../../../core/config.ts';
import { enqueueCard, type CardType } from '../../../core/review.ts';
import type { SavedLookupSentence } from './lookup-popup-model.ts';

export type LookupSentenceStore = {
  version: 1;
  entries: Record<string, SavedLookupSentence>;
};

const MAX_STORE_BYTES = 2_000_000;
const ALLOWED_LOOKUP_CARD_TYPES: readonly CardType[] = [
  'recognition',
  'reading',
  'recall',
  'cloze',
  'listening',
];

export function lookupContextPath(): string {
  return path.resolve(
    process.env.NIHON_LOOKUP_CONTEXT_PATH ||
      path.join(path.dirname(databasePath()), 'private', 'lookup-sentences.json'),
  );
}

function emptyStore(): LookupSentenceStore {
  return { version: 1, entries: {} };
}

function isValidEntry(value: unknown): value is SavedLookupSentence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.cardId === 'string' &&
    e.cardId.length > 0 &&
    e.cardId.length <= 256 &&
    typeof e.itemId === 'string' &&
    e.itemId.length > 0 &&
    e.itemId.length <= 256 &&
    typeof e.sentenceJa === 'string' &&
    e.sentenceJa.trim().length > 0 &&
    e.sentenceJa.length <= 500 &&
    (e.sentenceVi === null || (typeof e.sentenceVi === 'string' && e.sentenceVi.length <= 500)) &&
    (e.sourceClipId === null ||
      (typeof e.sourceClipId === 'string' && e.sourceClipId.length <= 128)) &&
    typeof e.savedAt === 'string' &&
    e.savedAt.length > 0
  );
}

export function validateLookupSentenceStore(value: unknown): LookupSentenceStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_LOOKUP_STORE');
  }
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || !raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) {
    throw new Error('INVALID_LOOKUP_STORE');
  }
  const entries: Record<string, SavedLookupSentence> = {};
  for (const [key, entry] of Object.entries(raw.entries as Record<string, unknown>)) {
    if (!key || key.length > 256 || !isValidEntry(entry)) {
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

function writeLookupSentenceEntry(file: string, entry: SavedLookupSentence): LookupSentenceStore {
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
    const next = validateLookupSentenceStore({
      version: 1,
      entries: {
        ...current.entries,
        [entry.cardId]: entry,
      },
    });
    fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
    return next;
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

export function saveLookupItemToSrs(params: {
  dbPath?: string;
  contextPath?: string;
  jmdictPath?: string;
  itemId: string;
  cardType?: CardType;
  sentenceJa: string;
  sentenceVi?: string | null;
  sourceClipId?: string | null;
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
  const sourceClipId =
    typeof params.sourceClipId === 'string' && params.sourceClipId.trim()
      ? params.sourceClipId.trim().slice(0, 128)
      : null;
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
    sourceClipId,
    savedAt: now.toISOString(),
  };
  writeLookupSentenceEntry(params.contextPath ?? lookupContextPath(), sentence);
  return {
    ...card,
    sentence,
  };
}
