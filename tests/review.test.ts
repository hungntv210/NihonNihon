import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.ts';
import { enqueueCard } from '../src/core/review.ts';
test('adding a card is idempotent and preserves an existing schedule, state, and schema', (t) => {
  const { db, file, itemId } = fixture(t),
    schema = db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all();
  const first = enqueueCard(file, itemId, 'recognition', new Date('2026-11-06T08:00:00Z'));
  assert.ok(first.created);
  db.prepare('UPDATE srs_cards SET state_json=?,scheduler_version=?,due_at=? WHERE card_id=?').run(
    '{"stability":9.5}',
    'synthetic-fsrs',
    '2027-01-01T00:00:00Z',
    first.cardId,
  );
  const second = enqueueCard(file, itemId, 'recognition');
  assert.ok(!second.created);
  assert.equal(second.cardId, first.cardId);
  assert.equal(second.dueAt, '2027-01-01T00:00:00Z');
  assert.equal(
    db.prepare('SELECT state_json FROM srs_cards').get()!.state_json,
    '{"stability":9.5}',
  );
  assert.equal(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n, 1);
  assert.deepEqual(db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all(), schema);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
test('invalid, inactive, and missing content cannot create orphan cards', (t) => {
  const { db, file, itemId } = fixture(t);
  assert.throws(() => enqueueCard(file, 'missing', 'recognition'), /NOT_FOUND/);
  assert.throws(() => enqueueCard(file, itemId, 'shadow'), /INVALID/);
  assert.throws(() => enqueueCard(file, itemId, 'invalid' as never), /INVALID/);
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(itemId);
  assert.throws(() => enqueueCard(file, itemId, 'recognition'), /NOT_FOUND/);
  assert.equal(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n, 0);
});
