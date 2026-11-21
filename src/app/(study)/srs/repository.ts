import { DatabaseSync } from 'node:sqlite';
import { selectedTranslation } from '../../../core/content.ts';
import { normalizeNewCardsPerDay } from '../../../core/preferences.ts';
import {
  DEFAULT_RETENTION,
  hydrate,
  grade,
  normalizeRetention,
  scheduler,
  schedulerVersion,
  type Engine,
  type Memory,
  type StoredCard,
  type StudyCard,
  type StudySession,
  type ReviewEvent,
} from './model.ts';
const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
function resolveTimeZone(timeZone?: string) {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try { new Intl.DateTimeFormat('en-CA', { timeZone }); return timeZone; } catch { return DEFAULT_TIME_ZONE; }
}
const dateKey = (date: Date, timeZone = DEFAULT_TIME_ZONE) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
function stored(row: Record<string, unknown>): StoredCard {
  return { cardId: String(row.card_id), stateJson: String(row.state_json), schedulerVersion: String(row.scheduler_version), dueAt: String(row.due_at), updatedAt: String(row.updated_at) };
}
function isNewCard(card: StoredCard, memory: Memory): boolean {
  return card.schedulerVersion === 'pending:g1/srs' || (memory.reps === 0 && memory.scheduleStatus === 'new');
}
function countNewCardsStudiedToday(db: DatabaseSync, today: string, timeZone: string): number {
  const firstReviews = db.prepare('SELECT card_id, MIN(reviewed_at) AS first_reviewed_at FROM srs_reviews GROUP BY card_id').all();
  let count = 0;
  for (const row of firstReviews) {
    const time = new Date(String(row.first_reviewed_at));
    if (Number.isFinite(time.getTime()) && dateKey(time, timeZone) === today) count++;
  }
  return count;
}
export type SessionOptions = { newCardsPerDay?: number; desiredRetention?: number; timeZone?: string };
export function session(db: DatabaseSync, engine: Engine, mode: 'quick' | 'full', now = new Date(), options?: SessionOptions): StudySession {
  const limit = mode === 'quick' ? 15 : 20;
  const timeZone = resolveTimeZone(options?.timeZone);
  const desiredRetention = normalizeRetention(options?.desiredRetention);
  const hasNewLimit = options !== undefined && options.newCardsPerDay !== undefined;
  const newCardsPerDay = hasNewLimit ? normalizeNewCardsPerDay(options.newCardsPerDay) : undefined;
  const today = dateKey(now, timeZone);
  const newCardsRemaining = newCardsPerDay !== undefined ? Math.max(0, newCardsPerDay - countNewCardsStudiedToday(db, today, timeZone)) : undefined;
  const rows = db.prepare(`SELECT c.*,i.kind,v.word,v.reading,v.meanings_en vocab_en,k.character,k.meanings_en kanji_en,g.pattern,g.meaning_en
    FROM srs_cards c JOIN content_items i USING(item_id)
    LEFT JOIN vocab v USING(item_id) LEFT JOIN kanji k USING(item_id) LEFT JOIN grammar g USING(item_id)
    WHERE i.is_active=1 AND c.due_at<=? AND c.card_type IN ('recognition','reading','recall','listening','cloze')
      AND i.kind IN ('vocab','kanji','grammar')
      AND (?='full' OR (i.kind IN ('vocab','kanji') AND c.card_type='recognition'))
    ORDER BY c.due_at,c.card_id`).all(now.toISOString(), mode);
  let unsupported = mode === 'full' ? Number(db.prepare(`SELECT count(*) n FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1 AND c.due_at<=? AND (i.kind NOT IN ('vocab','kanji','grammar') OR c.card_type NOT IN ('recognition','reading','recall','listening','cloze'))`).get(now.toISOString())?.n ?? 0) : 0;
  const reviewRows: { row: Record<string, unknown>; value: StoredCard }[] = [];
  const newRows: { row: Record<string, unknown>; value: StoredCard }[] = [];
  for (const row of rows) {
    const value = stored(row);
    let memory: Memory;
    try { memory = hydrate(value, engine); } catch { unsupported++;continue; }
    if (isNewCard(value, memory)) newRows.push({ row, value });
    else reviewRows.push({ row, value });
  }
  const allowedNewRows = newCardsRemaining !== undefined ? newRows.slice(0, newCardsRemaining) : newRows;
  const eligible = [...reviewRows, ...allowedNewRows];
  const due = eligible.length;
  const cards: StudyCard[] = [];
  for (const { row, value } of eligible.slice(0, limit)) {
    const en = row.meaning_en ?? JSON.parse(String(row.vocab_en ?? row.kanji_en)).join('; ');
    cards.push({ ...value, itemId: String(row.item_id), kind: String(row.kind), type: String(row.card_type), title: String(row.word ?? row.character ?? row.pattern), reading: row.reading ? String(row.reading) : null, english: String(en), vietnamese: selectedTranslation(db, String(row.item_id), 'meaning'), hanViet: selectedTranslation(db, String(row.item_id), 'han_viet') });
  }
  const forecast = Array.from({ length: 7 }, (_, n) => ({ day: dateKey(new Date(now.getTime() + n * 86400000), timeZone), count: 0 }));
  const scheduled = db.prepare('SELECT c.due_at FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1 AND c.due_at<?').all(new Date(now.getTime() + 7 * 86400000).toISOString());
  for (const row of scheduled) { const day = dateKey(new Date(String(row.due_at)), timeZone), bucket = day < forecast[0].day ? forecast[0] : forecast.find(b => b.day === day);if (bucket) bucket.count++; }
  return {
    cards, due, unsupported, serverNow: now.toISOString(), mode, forecast, desiredRetention,
    ...(newCardsPerDay !== undefined ? { newCardsPerDay, newCardsRemaining } : {}),
  };
}
export async function recordReview(file: string, event: ReviewEvent, serverNow = new Date(), desiredRetention: unknown = DEFAULT_RETENTION) {
  if (!event || !/^[0-9a-f-]{36}$/i.test(event.reviewId) || typeof event.cardId !== 'string' || event.cardId.length > 256 || ![1,2,3,4].includes(event.rating) || !Number.isSafeInteger(event.elapsedMs) || event.elapsedMs < 0 || event.elapsedMs > 3600000) throw new Error('INVALID_REVIEW');
  const time = new Date(event.reviewedAt);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== event.reviewedAt || time.getTime() > serverNow.getTime() + 60000 || typeof event.baseUpdatedAt !== 'string') throw new Error('INVALID_TIME');
  const retention = normalizeRetention(desiredRetention), version = schedulerVersion(retention);
  const engine = await scheduler(retention), db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
    const previous = db.prepare('SELECT * FROM srs_reviews WHERE review_id=?').get(event.reviewId);
    if (previous) {
      if (previous.card_id !== event.cardId || previous.rating !== event.rating || previous.reviewed_at !== event.reviewedAt || previous.elapsed_ms !== event.elapsedMs) throw new Error('REVIEW_ID_REUSED');
      db.exec('COMMIT');return { reviewId: event.reviewId, duplicate: true };
    }
    const row = db.prepare('SELECT c.*,i.kind,i.is_active FROM srs_cards c JOIN content_items i USING(item_id) WHERE c.card_id=?').get(event.cardId);
    if (!row || row.is_active !== 1) throw new Error('CARD_NOT_FOUND');
    if (!['vocab','kanji','grammar'].includes(String(row.kind)) || !['recognition','recall','reading','listening','cloze'].includes(String(row.card_type))) throw new Error('UNSUPPORTED_CARD');
    if (row.updated_at !== event.baseUpdatedAt || String(row.due_at) > event.reviewedAt || String(row.updated_at) > event.reviewedAt) throw new Error('REVIEW_CONFLICT');
    const result = grade(stored(row), event.rating, time, engine);
    db.prepare('UPDATE srs_cards SET state_json=?,scheduler_version=?,due_at=?,updated_at=? WHERE card_id=?').run(JSON.stringify(result.card), version, result.card.dueAt.toISOString(), event.reviewedAt, event.cardId);
    db.prepare('INSERT INTO srs_reviews(review_id,card_id,rating,reviewed_at,elapsed_ms,scheduler_version) VALUES(?,?,?,?,?,?)').run(event.reviewId,event.cardId,event.rating,event.reviewedAt,event.elapsedMs,version);
    db.exec('COMMIT');return { reviewId: event.reviewId, duplicate: false, dueAt: result.card.dueAt.toISOString() };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}
