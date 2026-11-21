import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { createWanakanaLoader } = await import('../src/app/(study)/srs/review-session.tsx');

test('review-session.tsx uses dynamic import for wanakana instead of a static top-level import', () => {
  const src = fs.readFileSync('src/app/(study)/srs/review-session.tsx', 'utf8');
  assert.doesNotMatch(src, /import\s+[^;]*from\s+['"]wanakana['"]/);
  assert.match(src, /import\(['"]wanakana['"]\)/);
  assert.match(src, /onFocus=\{[^}]*wanakana\.load\(\)/);
  assert.match(src, /await\s+wanakana\.isReadingMatch\(/);
});

test('lazy wanakana loader does not load eagerly, converts romaji after dynamic import, and caches the module', async () => {
  let importCalls = 0;
  const loader = createWanakanaLoader(async () => {
    importCalls += 1;
    return import('wanakana');
  });

  // Creation must not eagerly import wanakana.
  assert.equal(importCalls, 0);
  assert.equal(loader.getCached(), null);

  // First conversion triggers dynamic import and preserves IME mode behavior.
  assert.equal(await loader.convertIme('gakusei'), 'がくせい');
  assert.equal(importCalls, 1);
  assert.equal(typeof loader.getCached(), 'function');

  // Subsequent IME and reading match calls reuse the cached module without re-importing.
  assert.equal(await loader.convertIme('nihon'), 'にほn');
  assert.equal(await loader.isReadingMatch('nihon', 'にほん'), true);
  assert.equal(await loader.isReadingMatch('にほn', 'にほん'), true);
  assert.equal(await loader.isReadingMatch('gakkou', 'がっこう'), true);
  assert.equal(await loader.isReadingMatch('  GAKUSEI ', 'ガクセイ'), true);
  assert.equal(await loader.isReadingMatch('sensei', 'がくせい'), false);
  assert.equal(importCalls, 1);
});

test('rapid romaji answer check awaits pending dynamic wanakana import instead of skipping conversion', async () => {
  let importCalls = 0;
  let releaseImport!: (mod: { toHiragana: (input?: string, options?: { IMEMode?: boolean }) => string }) => void;
  const loader = createWanakanaLoader(() => {
    importCalls += 1;
    return new Promise((resolve) => {
      releaseImport = resolve;
    });
  });

  // Simulate user focusing input / typing romaji and clicking "Hiện đáp án" immediately while chunk is in flight.
  const prewarm = loader.load();
  let settled = false;
  const checkPromise = loader.isReadingMatch('gakusei', 'がくせい').then((res) => {
    settled = true;
    return res;
  });

  // Concurrent calls share a single dynamic import and check must wait until wanakana resolves.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(importCalls, 1);
  assert.equal(settled, false);

  const realWanakana = await import('wanakana');
  releaseImport(realWanakana);

  const [loadedFn, matched] = await Promise.all([prewarm, checkPromise]);
  assert.equal(typeof loadedFn, 'function');
  assert.equal(settled, true);
  assert.equal(matched, true);
  assert.equal(importCalls, 1);
});

test('lazy wanakana loader clears failed promise so subsequent attempts can recover', async () => {
  let attempts = 0;
  const loader = createWanakanaLoader(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('transient chunk error');
    return import('wanakana');
  });

  await assert.rejects(() => loader.load(), /transient chunk error/);
  assert.equal(loader.getCached(), null);

  assert.equal(await loader.isReadingMatch('kanji', 'かんじ'), true);
  assert.equal(attempts, 2);
});
