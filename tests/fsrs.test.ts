import test from 'node:test';
import assert from 'node:assert/strict';
import { DefaultScheduler, Rating } from 'ts-fsrs';
import { toHiragana } from 'wanakana';

test('pinned FSRS provides four deterministic schedules at 90% retention without mutating input', async () => {
  const scheduler = await DefaultScheduler({ version: 'FSRS-6', desiredRetention: 0.9, enableFuzz: false });
  const now = new Date('2026-11-06T09:00:00Z');
  const card = scheduler.newCard({ cardId: 'synthetic-fsrs', now });
  const before = JSON.stringify(card);
  const choices = Array.from(scheduler.preview({ card, now }));
  assert.deepEqual(choices.map(c => c.grade), [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]);
  assert.ok(choices.every(c => c.card.dueAt > now && c.card.reps === 1));
  assert.ok(choices[3].card.dueAt > choices[0].card.dueAt);
  assert.deepEqual(scheduler.review({ card, grade: Rating.Good, now }), { card: choices[2].card, revlog: choices[2].revlog });
  assert.equal(JSON.stringify(card), before);
});

test('pinned romaji conversion handles syllabic n and doubled consonants', () => {
  assert.equal(toHiragana('gakkou'), 'がっこう');
  assert.equal(toHiragana('kanji'), 'かんじ');
});
