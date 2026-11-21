import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.ts';
import { enqueueCard } from '../src/core/review.ts';
import { DEFAULT_PREFERENCES, parseStoredPreferences, validatePreferences } from '../src/core/preferences.ts';
import { hydrate, isCompatibleSessionCache, previews, scheduler, schedulerVersion, VERSION, type StudyCard, type StudySession } from '../src/app/(study)/srs/model.ts';
import { recordReview, session } from '../src/app/(study)/srs/repository.ts';

const created = new Date('2026-11-20T01:00:00Z');
const day1 = new Date('2026-11-21T02:00:00Z'); // 09:00 Asia/Ho_Chi_Minh
const day1Later = new Date('2026-11-21T03:00:00Z'); // 10:00 Asia/Ho_Chi_Minh
const day2 = new Date('2026-11-22T02:00:00Z'); // 09:00 Asia/Ho_Chi_Minh next day

test('settings form removes readOnly and fixed-90% / unintegrated notices for SRS inputs', () => {
  const source = fs.readFileSync(
    path.resolve('src/app/(study)/settings/settings-form.tsx'),
    'utf8',
  );
  assert.doesNotMatch(source, /readOnly/);
  assert.doesNotMatch(source, /chưa tích hợp/);
  assert.doesNotMatch(source, /cố định 90%/);
  assert.match(source, /MIN_NEW_CARDS_PER_DAY/);
  assert.match(source, /MAX_NEW_CARDS_PER_DAY/);
  assert.match(source, /MIN_FSRS_RETENTION/);
  assert.match(source, /MAX_FSRS_RETENTION/);
  assert.match(source, /FSRS_RETENTION_STEP/);
});

test('SRS session enforces newCardsPerDay daily quota, prioritizes due reviews, and resets next day', async t => {
  const { db, file } = fixture(t);
  const items = db
    .prepare("SELECT item_id FROM content_items WHERE kind IN ('vocab','kanji') ORDER BY item_id")
    .all();
  assert.ok(items.length >= 6, 'demo fixture provides at least 6 vocab/kanji items');
  const cardTimes = items.slice(0, 6).map((_, i) => new Date(created.getTime() + i * 1000));
  const cardIds = items.slice(0, 6).map((row, i) => enqueueCard(file, String(row.item_id), 'recognition', cardTimes[i]).cardId);
  const engine = await scheduler(0.9);

  // Cap = 0 hides all new cards.
  const zero = session(db, engine, 'full', day1, { newCardsPerDay: 0, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(zero.cards.length, 0);
  assert.equal(zero.due, 0);
  assert.equal(zero.newCardsRemaining, 0);

  // Cap = 3 shows only the first 3 of the 6 new cards.
  const first = session(db, engine, 'full', day1, { newCardsPerDay: 3, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(first.cards.length, 3);
  assert.equal(first.due, 3);
  assert.equal(first.newCardsPerDay, 3);
  assert.equal(first.newCardsRemaining, 3);
  assert.deepEqual(first.cards.map(c => c.cardId), cardIds.slice(0, 3));

  // Review 2 new cards today with rating 3 (Good -> due again in 10 minutes as learning cards).
  for (let i = 0; i < 2; i++) {
    await recordReview(
      file,
      { reviewId: randomUUID(), cardId: cardIds[i], rating: 3, reviewedAt: day1.toISOString(), baseUpdatedAt: cardTimes[i].toISOString(), elapsedMs: 900 },
      day1,
      0.9,
    );
  }

  // Later the same day: the 2 learning/review cards are due (and NOT blocked), plus only 1 new card left today.
  const afterTwo = session(db, engine, 'full', day1Later, { newCardsPerDay: 3, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(afterTwo.newCardsRemaining, 1);
  assert.equal(afterTwo.due, 3);
  assert.equal(afterTwo.cards.length, 3);
  // Review/learning cards come before remaining new cards.
  assert.deepEqual(afterTwo.cards.slice(0, 2).map(c => c.cardId).sort(), cardIds.slice(0, 2).sort());
  assert.equal(afterTwo.cards[2].cardId, cardIds[2]);

  // Even when newCardsPerDay is reduced to 0, due review/learning cards are still shown.
  const reviewsOnly = session(db, engine, 'full', day1Later, { newCardsPerDay: 0, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(reviewsOnly.due, 2);
  assert.deepEqual(reviewsOnly.cards.map(c => c.cardId).sort(), cardIds.slice(0, 2).sort());

  // Review the 3rd new card today -> remaining new quota reaches 0.
  await recordReview(
    file,
    { reviewId: randomUUID(), cardId: cardIds[2], rating: 4, reviewedAt: day1Later.toISOString(), baseUpdatedAt: cardTimes[2].toISOString(), elapsedMs: 700 },
    day1Later,
    0.9,
  );
  const exhausted = session(db, engine, 'full', day1Later, { newCardsPerDay: 3, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(exhausted.newCardsRemaining, 0);
  assert.equal(exhausted.due, 2); // only the 2 due learning cards

  // Next local day: quota resets to 3, allowing the remaining 3 untouched new cards.
  const nextDay = session(db, engine, 'full', day2, { newCardsPerDay: 3, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(nextDay.newCardsRemaining, 3);
  assert.equal(nextDay.due, 5); // 2 due learning cards + 3 remaining new cards
});

test('quick SRS session delivers all 15 cards when due reviews plus remaining new quota >= 15', async t => {
  const { db, file } = fixture(t);
  const release = String(db.prepare("SELECT release_id FROM source_releases WHERE source_id='openjlpt' LIMIT 1").get()!.release_id);
  for (let i = 0; i < 6; i++) {
    const id = `openjlpt:vocab:quick-regression-${i}`;
    db.prepare('INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)')
      .run(id, 'vocab', 'openjlpt', `quick-regression-${i}`, release, String(i).padStart(64, 'a'));
    db.prepare('INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos) VALUES(?,?,?,?,?,?,?)')
      .run(id, `言葉${i}`, `ことば${i}`, `kotoba${i}`, 'N5', '["word"]', '["n"]');
  }
  const items = db
    .prepare("SELECT item_id FROM content_items WHERE kind IN ('vocab','kanji') ORDER BY item_id LIMIT 16")
    .all();
  assert.equal(items.length, 16);

  const engine = await scheduler(0.9);
  const seededAt = new Date('2026-11-10T00:00:00Z');
  const dueAt = '2026-11-14T00:00:00.000Z';
  const cardIds = items.map(row => enqueueCard(file, String(row.item_id), 'recognition', new Date(dueAt)).cardId);

  // All 16 cards are untouched new cards -> default newCardsPerDay=10 caps quick session at 10.
  const newOnly = session(db, engine, 'quick', day1, { newCardsPerDay: DEFAULT_PREFERENCES.newCardsPerDay, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(newOnly.cards.length, 10);
  assert.equal(newOnly.due, 10);

  // Convert the first 10 cards into due review cards -> 10 due reviews + 6 new (within quota 10) = 16 eligible, quick returns full 15 with all 10 reviews first.
  const updateCard = db.prepare('UPDATE srs_cards SET state_json=?,scheduler_version=?,due_at=?,updated_at=? WHERE card_id=?');
  for (const cardId of cardIds.slice(0, 10)) {
    const reviewed = engine.review({ card: engine.newCard({ cardId, now: seededAt }), grade: 3, now: seededAt }).card;
    updateCard.run(JSON.stringify({ ...reviewed, dueAt }), VERSION, dueAt, dueAt, cardId);
  }
  const mixed = session(db, engine, 'quick', day1, { newCardsPerDay: DEFAULT_PREFERENCES.newCardsPerDay, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(mixed.due, 16);
  assert.equal(mixed.cards.length, 15);
  assert.deepEqual(mixed.cards.slice(0, 10).map(c => c.cardId).sort(), cardIds.slice(0, 10).sort());
  assert.deepEqual(mixed.cards.slice(10).map(c => c.cardId), cardIds.slice(10).sort().slice(0, 5));

  // Convert all 16 cards into due review cards -> even with newCardsPerDay=0, quick returns full 15.
  for (const cardId of cardIds.slice(10)) {
    const reviewed = engine.review({ card: engine.newCard({ cardId, now: seededAt }), grade: 3, now: seededAt }).card;
    updateCard.run(JSON.stringify({ ...reviewed, dueAt }), VERSION, dueAt, dueAt, cardId);
  }
  const reviewsOnly = session(db, engine, 'quick', day1, { newCardsPerDay: 0, desiredRetention: 0.9, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(reviewsOnly.due, 16);
  assert.equal(reviewsOnly.cards.length, 15);
});

test('isCompatibleSessionCache preserves legacy/default and unchanged-setting caches and invalidates on setting change', () => {
  const card = { cardId: 'c1' } as StudyCard;
  const legacySession: StudySession = {
    cards: [card, { cardId: 'c2' } as StudyCard],
    due: 2,
    unsupported: 0,
    serverNow: '2026-11-16T13:00:00.000Z',
    mode: 'full',
    forecast: [],
  };

  // Legacy/unoptioned cache (desiredRetention & newCardsPerDay omitted) stays compatible with default preferences.
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: legacySession, seen: [] },
      { mode: 'full', desiredRetention: DEFAULT_PREFERENCES.fsrsRetention, newCardsPerDay: DEFAULT_PREFERENCES.newCardsPerDay },
    ),
    true,
  );

  // Changing newCardsPerDay or desiredRetention away from defaults invalidates the legacy cache.
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: legacySession, seen: [] },
      { mode: 'full', desiredRetention: DEFAULT_PREFERENCES.fsrsRetention, newCardsPerDay: 25 },
    ),
    false,
  );
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: legacySession, seen: [] },
      { mode: 'full', desiredRetention: 0.85, newCardsPerDay: DEFAULT_PREFERENCES.newCardsPerDay },
    ),
    false,
  );

  // Explicit non-default settings are preserved when unchanged and invalidated when changed back to default or another value.
  const customSession: StudySession = { ...legacySession, desiredRetention: 0.85, newCardsPerDay: 25 };
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: customSession, seen: ['c1'] },
      { mode: 'full', desiredRetention: 0.85, newCardsPerDay: 25 },
    ),
    true,
  );
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: customSession, seen: ['c1'] },
      { mode: 'full', desiredRetention: 0.85, newCardsPerDay: DEFAULT_PREFERENCES.newCardsPerDay },
    ),
    false,
  );
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: customSession, seen: ['c1', 'c2'] },
      { mode: 'full', desiredRetention: 0.85, newCardsPerDay: 25 },
    ),
    false,
  );
  assert.equal(
    isCompatibleSessionCache(
      { version: 1, session: customSession, seen: [] },
      { mode: 'quick', desiredRetention: 0.85, newCardsPerDay: 25 },
    ),
    false,
  );
});

test('FSRS uses saved desiredRetention for intervals, previews, and stays compatible with existing r90 cards', async t => {
  const { db, file } = fixture(t);
  const schemaBefore = db.prepare('SELECT name, sql FROM sqlite_schema ORDER BY name').all();
  const items = db
    .prepare("SELECT item_id FROM content_items WHERE kind='vocab' ORDER BY item_id LIMIT 4")
    .all();
  const cards = items.map(row => enqueueCard(file, String(row.item_id), 'recognition', created));

  const retentions = [0.8, 0.9, 0.97] as const;
  const secondDueMs: number[] = [];

  for (let i = 0; i < retentions.length; i++) {
    const r = retentions[i];
    const cardId = cards[i].cardId;
    const step1 = await recordReview(
      file,
      { reviewId: randomUUID(), cardId, rating: 3, reviewedAt: day1.toISOString(), baseUpdatedAt: created.toISOString(), elapsedMs: 1000 },
      day1,
      r,
    );
    const step2Time = new Date(step1.dueAt!);
    const step2 = await recordReview(
      file,
      { reviewId: randomUUID(), cardId, rating: 3, reviewedAt: step2Time.toISOString(), baseUpdatedAt: day1.toISOString(), elapsedMs: 1000 },
      step2Time,
      r,
    );
    const row = db.prepare('SELECT * FROM srs_cards WHERE card_id=?').get(cardId)!;
    assert.equal(row.scheduler_version, schedulerVersion(r));
    secondDueMs.push(Date.parse(step2.dueAt!) - step2Time.getTime());
  }

  // Lower retention produces strictly longer intervals than higher retention.
  assert.ok(secondDueMs[0] > secondDueMs[1], `expected r=0.80 (${secondDueMs[0]}) > r=0.90 (${secondDueMs[1]})`);
  assert.ok(secondDueMs[1] > secondDueMs[2], `expected r=0.90 (${secondDueMs[1]}) > r=0.97 (${secondDueMs[2]})`);

  // Existing r90 card hydrates and reviews cleanly after user switches retention to 0.85 and then 0.95.
  const legacyCardId = cards[3].cardId;
  const r90Step1 = await recordReview(
    file,
    { reviewId: randomUUID(), cardId: legacyCardId, rating: 3, reviewedAt: day1.toISOString(), baseUpdatedAt: created.toISOString(), elapsedMs: 800 },
    day1,
    0.9,
  );
  const r90Row = db.prepare('SELECT * FROM srs_cards WHERE card_id=?').get(legacyCardId)!;
  assert.equal(r90Row.scheduler_version, VERSION);

  const engine85 = await scheduler(0.85);
  const engine95 = await scheduler(0.95);
  const storedLegacy = {
    cardId: String(r90Row.card_id),
    stateJson: String(r90Row.state_json),
    schedulerVersion: String(r90Row.scheduler_version),
    dueAt: String(r90Row.due_at),
    updatedAt: String(r90Row.updated_at),
  };
  assert.equal(hydrate(storedLegacy, engine85).reps, 1);
  const previewAt = new Date(r90Step1.dueAt!);
  const p85 = previews(storedLegacy, previewAt, engine85).find(c => c.rating === 3)!;
  const p95 = previews(storedLegacy, previewAt, engine95).find(c => c.rating === 3)!;
  assert.ok(Date.parse(p85.dueAt) > Date.parse(p95.dueAt), 'client preview intervals reflect desiredRetention');

  const dueSession85 = session(db, engine85, 'full', previewAt, { newCardsPerDay: 0, desiredRetention: 0.85, timeZone: 'Asia/Ho_Chi_Minh' });
  assert.equal(dueSession85.unsupported, 0);
  assert.equal(dueSession85.desiredRetention, 0.85);
  assert.ok(dueSession85.cards.some(c => c.cardId === legacyCardId));

  const upgraded = await recordReview(
    file,
    { reviewId: randomUUID(), cardId: legacyCardId, rating: 3, reviewedAt: previewAt.toISOString(), baseUpdatedAt: day1.toISOString(), elapsedMs: 800 },
    previewAt,
    0.85,
  );
  const updatedRow = db.prepare('SELECT * FROM srs_cards WHERE card_id=?').get(legacyCardId)!;
  assert.equal(updatedRow.scheduler_version, 'ts-fsrs@6.0.0/FSRS-6/r85');
  assert.equal(JSON.parse(String(updatedRow.state_json)).reps, 2);
  assert.equal(updatedRow.due_at, upgraded.dueAt);

  // Preferences fallback & strict validation remain intact and DB schema is unchanged.
  assert.deepEqual(parseStoredPreferences({}), DEFAULT_PREFERENCES);
  assert.throws(() => validatePreferences({ fsrsRetention: 0.79 }));
  assert.deepEqual(db.prepare('SELECT name, sql FROM sqlite_schema ORDER BY name').all(), schemaBefore);
});
