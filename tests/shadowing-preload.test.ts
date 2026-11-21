import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { ShadowingPlayer } = await import('../src/app/(study)/shadowing/player.tsx');
const { syntheticClip } = await import('../src/app/(study)/shadowing/clip-model.ts');

test('ShadowingPlayer renders <video> with preload="metadata" for demo and private clips', () => {
  const demoHtml = renderToStaticMarkup(createElement(ShadowingPlayer, { clip: syntheticClip }));
  const demoVideos = demoHtml.match(/<video\b[^>]*>/g) ?? [];
  assert.equal(demoVideos.length, 1, 'Expected exactly one <video> element for demo clip');
  assert.match(demoVideos[0], /\bpreload="metadata"/);
  assert.doesNotMatch(demoVideos[0], /\bpreload="auto"/);
  assert.match(demoVideos[0], /\bsrc="\/shadowing\/media"/);

  const privateClip = {
    ...syntheticClip,
    id: 'private-fixture',
    isDemo: false,
    mediaUrl: '/shadowing/media?clip=private-fixture',
  };
  const privateHtml = renderToStaticMarkup(createElement(ShadowingPlayer, { clip: privateClip }));
  const privateVideos = privateHtml.match(/<video\b[^>]*>/g) ?? [];
  assert.equal(privateVideos.length, 1, 'Expected exactly one <video> element for private clip');
  assert.match(privateVideos[0], /\bpreload="metadata"/);
  assert.doesNotMatch(privateVideos[0], /\bpreload="auto"/);
  assert.match(privateVideos[0], /\bsrc="\/shadowing\/media\?clip=private-fixture"/);
});

test('src/app/(study)/shadowing/player.tsx sets preload="metadata" and never preload="auto"', () => {
  const src = fs.readFileSync('src/app/(study)/shadowing/player.tsx', 'utf8');
  const videoTags = src.match(/<video\b[^>]*>/g) ?? [];
  assert.equal(videoTags.length, 1);
  assert.match(videoTags[0], /\bpreload="metadata"/);
  assert.doesNotMatch(src, /\bpreload="auto"/);
});
