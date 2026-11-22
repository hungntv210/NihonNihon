import { databasePath } from '../../../core/config.ts';
import { openContentDatabase } from '../../../core/content.ts';
import { lookupContextPath, readLookupSentenceStore } from '../common-tools/lookup-store.ts';
import type { Clip } from './clip-model.ts';
import {
  computeClipMeta,
  normalizeClipTerm,
  type ClipMetaSummary,
} from './clip-meta.ts';

function readSavedLookupItemIds(contextFile: string): string[] {
  try {
    const store = readLookupSentenceStore(contextFile);
    const ids = new Set<string>();
    for (const entry of Object.values(store.entries)) {
      if (entry?.itemId) ids.add(entry.itemId);
    }
    return [...ids];
  } catch {
    return [];
  }
}

function addVocabRowTerms(terms: Set<string>, row: Record<string, unknown>): void {
  const word = typeof row.word === 'string' ? normalizeClipTerm(row.word) : '';
  const reading = typeof row.reading === 'string' ? normalizeClipTerm(row.reading) : '';
  if (word) terms.add(word);
  if (reading) terms.add(reading);
}

/**
 * Loads normalized Japanese vocabulary terms (surface word + reading) from the
 * user's active SRS cards and saved vocab-notebook lookup entries.
 * Returns an empty set when the user has 0 cards (never throws on empty state).
 */
export function loadKnownVocabTerms(
  dbFile = databasePath(),
  contextFile = lookupContextPath(),
): Set<string> {
  const terms = new Set<string>();
  const db = openContentDatabase(dbFile);
  try {
    const srsRows = db
      .prepare(
        `SELECT DISTINCT v.word, v.reading
         FROM vocab v
         JOIN content_items i USING(item_id)
         JOIN srs_cards c ON c.item_id=v.item_id
         WHERE i.is_active=1`,
      )
      .all() as Record<string, unknown>[];
    for (const row of srsRows) {
      addVocabRowTerms(terms, row);
    }

    const savedIds = readSavedLookupItemIds(contextFile);
    if (savedIds.length > 0) {
      const stmt = db.prepare(
        `SELECT v.word, v.reading
         FROM vocab v
         JOIN content_items i USING(item_id)
         WHERE i.is_active=1 AND v.item_id=?`,
      );
      for (const id of savedIds) {
        const row = stmt.get(id) as Record<string, unknown> | undefined;
        if (row) addVocabRowTerms(terms, row);
      }
    }
  } finally {
    db.close();
  }
  return terms;
}

export function buildClipMetaMap(
  clips: readonly Clip[],
  dbFile = databasePath(),
  contextFile = lookupContextPath(),
): Record<string, ClipMetaSummary> {
  let knownTerms: Set<string> | null = null;
  try {
    knownTerms = loadKnownVocabTerms(dbFile, contextFile);
  } catch {
    knownTerms = null;
  }
  const map: Record<string, ClipMetaSummary> = {};
  for (const clip of clips) {
    map[clip.id] = computeClipMeta(clip, knownTerms);
  }
  return map;
}
