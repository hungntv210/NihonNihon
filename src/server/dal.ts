import 'server-only';
import type { DatabaseSync } from 'node:sqlite';
import { databasePath } from '../core/config.ts';
import {
  openContentDatabase,
  listContent,
  contentSummary,
  contentSources,
  selectedTranslation,
  type ContentKind,
  type TranslationField,
} from '../core/content.ts';
import { enqueueCard, type CardType } from '../core/review.ts';
import {
  listUserPushSubscriptions,
  remindersDatabasePath,
  removePushSubscription,
  upsertPushSubscription,
} from '../core/push.ts';
import { requireSession, requireSessionSubject } from './auth.ts';

export async function withContentDatabase<T>(query: (db: DatabaseSync) => T) {
  await requireSession();
  const db = openContentDatabase(databasePath());
  try {
    return query(db);
  } finally {
    db.close();
  }
}
export const getContent = (kind: ContentKind, limit = 12) =>
  withContentDatabase((db) => listContent(db, kind, limit));
export const getContentSummary = () => withContentDatabase(contentSummary);
export const getContentSources = () => withContentDatabase(contentSources);
export const getSelectedTranslation = (itemId: string, field: TranslationField) =>
  withContentDatabase((db) => selectedTranslation(db, itemId, field));
export async function addToReview(itemId: string, cardType: CardType = 'recognition') {
  await requireSession();
  return enqueueCard(databasePath(), itemId, cardType);
}
export async function savePushSubscription(input: unknown, userAgent = '') {
  const userId = await requireSessionSubject();
  return upsertPushSubscription(remindersDatabasePath(), userId, input, userAgent);
}
export async function deletePushSubscription(endpoint?: string) {
  const userId = await requireSessionSubject();
  return removePushSubscription(remindersDatabasePath(), userId, endpoint);
}
export async function listPushSubscriptions() {
  const userId = await requireSessionSubject();
  return listUserPushSubscriptions(remindersDatabasePath(), userId);
}
