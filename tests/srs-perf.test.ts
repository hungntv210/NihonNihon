import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { remainingDue } from '../src/components/pixel-scenes/model.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { dispatchSceneDueIfChanged } = await import('../src/app/(study)/srs/review-session.tsx');

test('nihon-scene-due does not fire when due count is unchanged and fires whenever it changes', () => {
  const initial = { due: 3, cards: [{ cardId: 'c1' }, { cardId: 'c2' }, { cardId: 'c3' }] };
  const tracker = { initial, due: remainingDue(initial, []) };
  const target = new EventTarget();
  const details: number[] = [];
  target.addEventListener('nihon-scene-due', (e) => {
    details.push((e as CustomEvent<number>).detail);
  });

  // Initial mount with empty seen matches server-rendered initial.due: must not fire.
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, [], target), false);
  // pendingReviews() resolving empty creates a fresh [] array: must still not fire.
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, [...[]], target), false);
  // Stale cached card ID not in fresh server cards leaves remaining due unchanged: must not fire.
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, ['stale-cached-card'], target), false);
  assert.deepEqual(details, []);

  // Rating or pending review for an active due card lowers remaining due (3 -> 2): must fire once.
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, ['c1'], target), true);
  assert.deepEqual(details, [2]);

  // Duplicate IDs or unrelated IDs keep remaining due at 2: must not fire again.
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, ['c1', 'c1'], target), false);
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, ['c1', 'other-stale'], target), false);
  assert.deepEqual(details, [2]);

  // Rating a second due card lowers remaining due (2 -> 1): must fire with 1.
  assert.equal(dispatchSceneDueIfChanged(tracker, initial, ['c1', 'c2'], target), true);
  assert.deepEqual(details, [2, 1]);

  // Switching server session prop resets baseline to the new initial.due (matched by PixelScene).
  const nextInitial = { due: 5, cards: [{ cardId: 'q1' }, { cardId: 'q2' }] };
  assert.equal(dispatchSceneDueIfChanged(tracker, nextInitial, [], target), false);
  assert.deepEqual(details, [2, 1]);

  // Pending/rated card in the new session lowers remaining due (5 -> 4): must fire with 4.
  assert.equal(dispatchSceneDueIfChanged(tracker, nextInitial, ['q1'], target), true);
  assert.deepEqual(details, [2, 1, 4]);
});

test('SRS mode links disable prefetch and ReviewSession routes scene due updates through dispatchSceneDueIfChanged', () => {
  const src = fs.readFileSync('src/app/(study)/srs/review-session.tsx', 'utf8');
  assert.match(src, /<Link\s+href="\/srs\?mode=full"\s+prefetch=\{false\}/);
  assert.match(src, /<Link\s+href="\/srs\?mode=quick"\s+prefetch=\{false\}/);
  assert.match(src, /dispatchSceneDueIfChanged\(sceneDue\.current,\s*initial,\s*seen\)/);
  assert.doesNotMatch(
    src,
    /useEffect\(\(\)=>\{const remaining=remainingDue\(initial,seen\);window\.dispatchEvent/,
  );
});
