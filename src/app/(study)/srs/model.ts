import { DefaultScheduler, type Grade } from 'ts-fsrs';
import type { Translation } from '../../../core/content.ts';
export const VERSION = 'ts-fsrs@6.0.0/FSRS-6/r90';
const makeScheduler = () => DefaultScheduler({ version: 'FSRS-6', desiredRetention: 0.9, enableFuzz: false });
export type Engine = Awaited<ReturnType<typeof makeScheduler>>;
export type Memory = ReturnType<Engine['newCard']>;
let pending: ReturnType<typeof makeScheduler> | undefined;
export const scheduler = () => pending ??= makeScheduler();
export type StoredCard = { cardId: string; stateJson: string; schedulerVersion: string; dueAt: string; updatedAt: string };
export type ReviewEvent = { reviewId: string; cardId: string; rating: number; reviewedAt: string; baseUpdatedAt: string; elapsedMs: number };
export type StudyCard = StoredCard & { itemId: string; kind: string; type: string; title: string; reading: string | null; english: string; vietnamese: Translation | null; hanViet: Translation | null };
export type StudySession = { cards: StudyCard[]; due: number; unsupported: number; serverNow: string; mode: 'quick' | 'full'; forecast: { day: string; count: number }[] };
export function hydrate(row: StoredCard, engine: Engine): Memory {
  const raw = JSON.parse(row.stateJson);
  if (row.schedulerVersion === 'pending:g1/srs') {
    if (raw.status !== 'new' || Object.keys(raw).length !== 1) throw new Error('INVALID_STATE');
    return engine.newCard({ cardId: row.cardId, now: new Date(row.dueAt) });
  }
  if (row.schedulerVersion !== VERSION || raw.cardId !== row.cardId || raw.dueAt !== row.dueAt) throw new Error('UNSUPPORTED_SCHEDULER');
  for (const key of ['stability','difficulty','reps','lapses','scheduledDays','learningStep']) if (!Number.isFinite(raw[key]) || raw[key] < 0) throw new Error('INVALID_STATE');
  if (raw.difficulty > 10 || ![0,1,2,3].includes(raw.state) || !['new','learning','review'].includes(raw.scheduleStatus)) throw new Error('INVALID_STATE');
  for (const key of ['reps','lapses','scheduledDays','learningStep']) if (!Number.isSafeInteger(raw[key])) throw new Error('INVALID_STATE');
  const dueAt = new Date(raw.dueAt), lastReviewAt = raw.lastReviewAt ? new Date(raw.lastReviewAt) : null;
  if (!Number.isFinite(dueAt.getTime()) || (lastReviewAt && !Number.isFinite(lastReviewAt.getTime()))) throw new Error('INVALID_STATE');
  return { ...raw, dueAt, lastReviewAt } as Memory;
}
export function grade(card: StoredCard, rating: number, now: Date, engine: Engine) {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('INVALID_RATING');
  return engine.review({ card: hydrate(card, engine), grade: rating as Grade, now });
}
export function previews(card: StoredCard, now: Date, engine: Engine) {
  return Array.from(engine.preview({ card: hydrate(card, engine), now })).map(c => ({ rating: c.grade, dueAt: c.card.dueAt.toISOString() }));
}
export function intervalLabel(dueAt: string, now: number) {
  const minutes = Math.max(1, Math.round((Date.parse(dueAt) - now) / 60000));
  return minutes < 60 ? `${minutes} phút` : minutes < 1440 ? `${Math.round(minutes / 60)} giờ` : `${Math.round(minutes / 1440)} ngày`;
}
export function appendReview(queue: ReviewEvent[], event: ReviewEvent) {
  const previous = queue.find(e => e.reviewId === event.reviewId);
  if (previous && JSON.stringify(previous) !== JSON.stringify(event)) throw new Error('REVIEW_ID_REUSED');
  return previous ? queue : [...queue, event];
}
