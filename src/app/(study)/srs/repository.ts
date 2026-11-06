import { DatabaseSync } from 'node:sqlite';
import { selectedTranslation } from '../../../core/content.ts';
import { hydrate, grade, scheduler, VERSION, type Engine, type StoredCard, type StudyCard, type StudySession, type ReviewEvent } from './model.ts';
const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
function stored(row: Record<string, unknown>): StoredCard {
  return { cardId: String(row.card_id), stateJson: String(row.state_json), schedulerVersion: String(row.scheduler_version), dueAt: String(row.due_at), updatedAt: String(row.updated_at) };
}
export function session(db: DatabaseSync, engine: Engine, mode: 'quick' | 'full', now = new Date()): StudySession {
  const limit = mode === 'quick' ? 15 : 20;
  const rows = db.prepare(`SELECT c.*,i.kind,v.word,v.reading,v.meanings_en vocab_en,k.character,k.meanings_en kanji_en,g.pattern,g.meaning_en
    FROM srs_cards c JOIN content_items i USING(item_id)
    LEFT JOIN vocab v USING(item_id) LEFT JOIN kanji k USING(item_id) LEFT JOIN grammar g USING(item_id)
    WHERE i.is_active=1 AND c.due_at<=? AND c.card_type IN ('recognition','reading','recall','listening')
      AND i.kind IN ('vocab','kanji','grammar')
      AND (?='full' OR (i.kind IN ('vocab','kanji') AND c.card_type='recognition'))
    ORDER BY c.due_at,c.card_id`).all(now.toISOString(), mode);
  const cards: StudyCard[] = [];let due = 0, unsupported = mode === 'full' ? Number(db.prepare(`SELECT count(*) n FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1 AND c.due_at<=? AND (i.kind NOT IN ('vocab','kanji','grammar') OR c.card_type NOT IN ('recognition','reading','recall','listening'))`).get(now.toISOString())?.n ?? 0) : 0;
  for (const row of rows) {
    const value = stored(row);
    try { hydrate(value, engine); } catch { unsupported++;continue; }
    due++;if (cards.length >= limit) continue;
    const en = row.meaning_en ?? JSON.parse(String(row.vocab_en ?? row.kanji_en)).join('; ');
    cards.push({ ...value, itemId: String(row.item_id), kind: String(row.kind), type: String(row.card_type), title: String(row.word ?? row.character ?? row.pattern), reading: row.reading ? String(row.reading) : null, english: String(en), vietnamese: selectedTranslation(db, String(row.item_id), 'meaning'), hanViet: selectedTranslation(db, String(row.item_id), 'han_viet') });
  }
  const forecast = Array.from({ length: 7 }, (_, n) => ({ day: dateKey(new Date(now.getTime() + n * 86400000)), count: 0 }));
  const scheduled = db.prepare('SELECT c.due_at FROM srs_cards c JOIN content_items i USING(item_id) WHERE i.is_active=1 AND c.due_at<?').all(new Date(now.getTime() + 7 * 86400000).toISOString());
  for (const row of scheduled) { const day = dateKey(new Date(String(row.due_at))), bucket = day < forecast[0].day ? forecast[0] : forecast.find(b => b.day === day);if (bucket) bucket.count++; }
  return { cards, due, unsupported, serverNow: now.toISOString(), mode, forecast };
}
export async function recordReview(file: string, event: ReviewEvent, serverNow = new Date()) {
  if (!event || !/^[0-9a-f-]{36}$/i.test(event.reviewId) || typeof event.cardId !== 'string' || event.cardId.length > 256 || ![1,2,3,4].includes(event.rating) || !Number.isSafeInteger(event.elapsedMs) || event.elapsedMs < 0 || event.elapsedMs > 3600000) throw new Error('INVALID_REVIEW');
  const time = new Date(event.reviewedAt);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== event.reviewedAt || time.getTime() > serverNow.getTime() + 60000 || typeof event.baseUpdatedAt !== 'string') throw new Error('INVALID_TIME');
  const engine = await scheduler(), db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
    const previous = db.prepare('SELECT * FROM srs_reviews WHERE review_id=?').get(event.reviewId);
    if (previous) {
      if (previous.card_id !== event.cardId || previous.rating !== event.rating || previous.reviewed_at !== event.reviewedAt || previous.elapsed_ms !== event.elapsedMs) throw new Error('REVIEW_ID_REUSED');
      db.exec('COMMIT');return { reviewId: event.reviewId, duplicate: true };
    }
    const row = db.prepare('SELECT c.*,i.kind,i.is_active FROM srs_cards c JOIN content_items i USING(item_id) WHERE c.card_id=?').get(event.cardId);
    if (!row || row.is_active !== 1) throw new Error('CARD_NOT_FOUND');
    if (!['vocab','kanji','grammar'].includes(String(row.kind)) || !['recognition','recall','reading','listening'].includes(String(row.card_type))) throw new Error('UNSUPPORTED_CARD');
    if (row.updated_at !== event.baseUpdatedAt || String(row.due_at) > event.reviewedAt || String(row.updated_at) > event.reviewedAt) throw new Error('REVIEW_CONFLICT');
    const result = grade(stored(row), event.rating, time, engine);
    db.prepare('UPDATE srs_cards SET state_json=?,scheduler_version=?,due_at=?,updated_at=? WHERE card_id=?').run(JSON.stringify(result.card), VERSION, result.card.dueAt.toISOString(), event.reviewedAt, event.cardId);
    db.prepare('INSERT INTO srs_reviews(review_id,card_id,rating,reviewed_at,elapsed_ms,scheduler_version) VALUES(?,?,?,?,?,?)').run(event.reviewId,event.cardId,event.rating,event.reviewedAt,event.elapsedMs,VERSION);
    db.exec('COMMIT');return { reviewId: event.reviewId, duplicate: false, dueAt: result.card.dueAt.toISOString() };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}
