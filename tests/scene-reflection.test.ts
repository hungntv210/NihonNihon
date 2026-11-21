import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SceneEngine } from '../src/components/pixel-scenes/engine.js';
import kanjiHimeji from '../src/components/pixel-scenes/kanji-himeji.js';
import grammarKinkakuji from '../src/components/pixel-scenes/grammar-kinkakuji.js';

const W = 384;
const H = 216;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const TIMES = ['morning', 'day', 'sunset', 'night'] as const;

function parseHex(hex: string): [number, number, number, number] {
  const s = String(hex || '#000000').replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function makeMockCanvas(w = W, h = H, onDrawImage?: (count: number, buf: Uint8ClampedArray) => void) {
  let width = w;
  let height = h;
  let buf = new Uint8ClampedArray(width * height * 4);
  let putImageDataCalls = 0;
  let drawImageCalls = 0;
  let fillRectCalls = 0;

  const ctx = {
    fillStyle: '#000000',
    globalAlpha: 1,
    save() {},
    restore() {},
    clearRect(x: number, y: number, cw: number, ch: number) {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(width, Math.ceil(x + cw));
      const y1 = Math.min(height, Math.ceil(y + ch));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * width + xx) * 4;
          buf[o] = 0;
          buf[o + 1] = 0;
          buf[o + 2] = 0;
          buf[o + 3] = 0;
        }
      }
    },
    fillRect(x: number, y: number, cw: number, ch: number) {
      fillRectCalls++;
      const [r, g, b, a] = parseHex(this.fillStyle);
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(width, Math.ceil(x + cw));
      const y1 = Math.min(height, Math.ceil(y + ch));
      const alpha = Math.round(a * this.globalAlpha);
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * width + xx) * 4;
          buf[o] = r;
          buf[o + 1] = g;
          buf[o + 2] = b;
          buf[o + 3] = alpha;
        }
      }
    },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      const data = new Uint8ClampedArray(sw * sh * 4);
      for (let yy = 0; yy < sh; yy++) {
        const y = sy + yy;
        if (y < 0 || y >= height) continue;
        for (let xx = 0; xx < sw; xx++) {
          const x = sx + xx;
          if (x < 0 || x >= width) continue;
          const src = (y * width + x) * 4;
          const dst = (yy * sw + xx) * 4;
          data[dst] = buf[src];
          data[dst + 1] = buf[src + 1];
          data[dst + 2] = buf[src + 2];
          data[dst + 3] = buf[src + 3];
        }
      }
      return { width: sw, height: sh, data };
    },
    createImageData(iw: number, ih: number) {
      return { width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) };
    },
    putImageData(img: { width: number; height: number; data: Uint8ClampedArray }, dx: number, dy: number) {
      putImageDataCalls++;
      for (let y = 0; y < img.height; y++) {
        const ty = dy + y;
        if (ty < 0 || ty >= height) continue;
        for (let x = 0; x < img.width; x++) {
          const tx = dx + x;
          if (tx < 0 || tx >= width) continue;
          const s = (y * img.width + x) * 4;
          const d = (ty * width + tx) * 4;
          buf[d] = img.data[s];
          buf[d + 1] = img.data[s + 1];
          buf[d + 2] = img.data[s + 2];
          buf[d + 3] = img.data[s + 3];
        }
      }
    },
    drawImage(srcCanvas: ReturnType<typeof makeMockCanvas>, dx: number, dy: number) {
      drawImageCalls++;
      const sbuf = srcCanvas.raw();
      const sw = srcCanvas.width;
      const sh = srcCanvas.height;
      for (let y = 0; y < sh; y++) {
        const ty = dy + y;
        if (ty < 0 || ty >= height) continue;
        for (let x = 0; x < sw; x++) {
          const tx = dx + x;
          if (tx < 0 || tx >= width) continue;
          const s = (y * sw + x) * 4;
          const sa = sbuf[s + 3];
          if (sa === 0) continue;
          const d = (ty * width + tx) * 4;
          if (sa === 255) {
            buf[d] = sbuf[s];
            buf[d + 1] = sbuf[s + 1];
            buf[d + 2] = sbuf[s + 2];
            buf[d + 3] = 255;
          } else {
            const a = sa / 255;
            const inv = 1 - a;
            buf[d] = Math.round(sbuf[s] * a + buf[d] * inv);
            buf[d + 1] = Math.round(sbuf[s + 1] * a + buf[d + 1] * inv);
            buf[d + 2] = Math.round(sbuf[s + 2] * a + buf[d + 2] * inv);
            buf[d + 3] = Math.min(255, Math.round(sa + buf[d + 3] * inv));
          }
        }
      }
      onDrawImage?.(drawImageCalls, new Uint8ClampedArray(buf));
    },
  };

  return {
    get width() { return width; },
    set width(v: number) { width = v; buf = new Uint8ClampedArray(width * height * 4); },
    get height() { return height; },
    set height(v: number) { height = v; buf = new Uint8ClampedArray(width * height * 4); },
    getContext() { return ctx; },
    raw() { return buf; },
    stats() { return { putImageDataCalls, drawImageCalls, fillRectCalls }; },
  };
}

function makePalette(def: any, season: string, time: string): string[] {
  const colors = [...(SceneEngine as any).palettes[time]];
  if (def.seasonSwatches !== false) {
    const seasonal: Record<string, string[]> = {
      spring: ['#b38793', '#d2a8ac', '#edc8ba'],
      summer: ['#476759', '#718966', '#a4af7c'],
      autumn: ['#965740', '#bd7e46', '#deaa66'],
      winter: ['#839695', '#bac4b6', '#e6e1cb'],
    };
    colors.splice(26, 3, ...seasonal[season]);
  }
  const override = typeof def.swatches === 'function' ? def.swatches({ season, time }) : def.swatches;
  for (const [i, color] of Object.entries(override || {})) colors[Number(i)] = String(color);
  return colors;
}

function makeDraw(palette: string[], onRect?: (c: any, x: number, y: number, w: number, h: number, idx: number) => void) {
  function rect(c: any, x: number, y: number, w: number, h: number, index: number) {
    onRect?.(c, x, y, w, h, index);
    c.fillStyle = palette[index];
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function line(c: any, x0: number, y0: number, x1: number, y1: number, index: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      rect(c, x0, y0, 1, 1, index);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function polygon(c: any, points: number[][], index: number) {
    const ys = points.map((pt) => pt[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      const cuts: number[] = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a[1] > y) !== (b[1] > y)) cuts.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i < cuts.length; i += 2) {
        rect(c, Math.ceil(cuts[i]), y, Math.floor(cuts[i + 1]) - Math.ceil(cuts[i]) + 1, 1, index);
      }
    }
  }
  function ellipse(c: any, x: number, y: number, rx: number, ry: number, index: number) {
    for (let yy = -ry; yy <= ry; yy++) {
      const width = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))));
      rect(c, x - width, y + yy, width * 2 + 1, 1, index);
    }
  }
  return { rect, line, polygon, ellipse };
}

function diffPixels(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  assert.equal(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++;
  }
  return diff;
}

function extractFunctionBody(src: string, fnName: string): string {
  const start = src.indexOf(`function ${fnName}(`);
  assert.ok(start >= 0, `Could not find function ${fnName}`);
  let depth = 0;
  let open = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') {
      if (open < 0) open = i;
      depth++;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0 && open >= 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated function ${fnName}`);
}

test('kanji-himeji castle() and grammar-kinkakuji building() avoid per-pixel r(...,1,1,...) reflection and composite via offscreen ImageData', () => {
  const kanjiSrc = fs.readFileSync('src/components/pixel-scenes/kanji-himeji.js', 'utf8');
  const grammarSrc = fs.readFileSync('src/components/pixel-scenes/grammar-kinkakuji.js', 'utf8');
  const castleBody = extractFunctionBody(kanjiSrc, 'castle');
  const buildingBody = extractFunctionBody(grammarSrc, 'building');

  for (const [name, body] of [['kanji-himeji castle', castleBody], ['grammar-kinkakuji building', buildingBody]]) {
    assert.doesNotMatch(body, /\br\([^)]*,\s*1\s*,\s*1\s*,/, `${name} must not call per-pixel r(...,1,1,...)`);
    assert.doesNotMatch(body, /\bc\.putImageData\s*\(/, `${name} must not putImageData directly onto destination c`);
    assert.match(body, /\.createImageData\s*\(\s*384\s*,\s*216\s*\)/, `${name} must allocate offscreen ImageData`);
    assert.match(body, /\.putImageData\s*\(/, `${name} must putImageData once onto offscreen canvas`);
    assert.match(body, /\bc\.drawImage\s*\(/, `${name} must composite offscreen canvas onto c via drawImage`);
  }
});

test('kanji-himeji castle() reflection buffer matches legacy per-pixel r() output and rand() call order across all 16 season x time frames', () => {
  const prevDocument = (globalThis as any).document;
  try {
    for (const season of SEASONS) {
      for (const time of TIMES) {
        const palette = makePalette(kanjiHimeji, season, time);
        const createdCanvases: Array<ReturnType<typeof makeMockCanvas>> = [];
        (globalThis as any).document = {
          createElement(tag: string) {
            assert.equal(tag, 'canvas');
            const canvas = makeMockCanvas(W, H);
            createdCanvases.push(canvas);
            return canvas;
          },
        };

        let reflectionPixelRectCalls = 0;
        let rand925Calls = 0;
        const dst = makeMockCanvas(W, H);
        const dstCtx = dst.getContext();
        const draw = makeDraw(palette, (ctx, _x, _y, w, h) => {
          if (ctx === dstCtx && w === 1 && h === 1) reflectionPixelRectCalls++;
        });
        const api: any = {
          state: { season, time, weather: 'clear', params: { kanjiLearned: 0 } },
          palette,
          draw,
          random(seed: number) {
            const inner = (SceneEngine as any).seeded(seed);
            if (seed !== 925) return inner;
            return () => {
              rand925Calls++;
              return inner();
            };
          },
        };

        const scene = (kanjiHimeji as any).create(api);
        scene.layers[1](dstCtx);

        assert.equal(createdCanvases.length, 2, 'Expected architecture canvas and reflection canvas');
        assert.equal(dst.stats().putImageDataCalls, 0, 'Must never call putImageData directly on destination c');
        assert.equal(createdCanvases[1].stats().putImageDataCalls, 1, 'Expected single putImageData on offscreen reflection canvas');
        assert.equal(dst.stats().drawImageCalls, 2, 'Expected drawImage for architecture and reflection');

        // Reconstruct legacy per-pixel output from the exact architecture canvas pixels
        const legacyCanvas = makeMockCanvas(W, H);
        const legacyCtx = legacyCanvas.getContext();
        const legacyDraw = makeDraw(palette);
        legacyCtx.drawImage(createdCanvases[0], 0, 0);
        const archPixels = createdCanvases[0].getContext().getImageData(0, 0, W, H).data;
        const legacyRand = (SceneEngine as any).seeded(925);
        let legacyRandCalls = 0;
        for (let y = 159; y < 194; y++) {
          if (y % 4 === 0) continue;
          const sy = Math.floor(152 - (y - 159) * 2.9);
          const wave = Math.round(Math.sin(y * 0.8) * 2);
          for (let x = 97; x < 286; x++) {
            const at = (sy * W + x) * 4;
            if (archPixels[at + 3]) {
              legacyRandCalls++;
              if (legacyRand() > 0.3) {
                const bright = archPixels[at] + archPixels[at + 1] + archPixels[at + 2];
                legacyDraw.rect(legacyCtx, x + wave, y, 1, 1, bright > 520 ? 16 : bright > 330 ? 17 : 7);
              }
            }
          }
        }
        for (let i = 0; i < 22; i++) {
          const x = 120 + ((i * 37) % 150);
          const y = 161 + ((i * 11) % 30);
          legacyDraw.line(legacyCtx, x, y, x + 3 + (i % 5), y, i % 3 ? 8 : 33);
        }

        assert.equal(rand925Calls, legacyRandCalls, `rand(925) call count mismatch on ${season}/${time}`);
        assert.equal(diffPixels(dst.raw(), legacyCanvas.raw()), 0, `Pixel diff on kanji-himeji ${season}/${time}`);
        // The 22 water ripple lines use l() which calls rect(...,1,1,...), totaling 131 pixels (never the reflection loop's thousands of pixels).
        assert.ok(reflectionPixelRectCalls < 200, `Unexpected per-pixel rect count on dst: ${reflectionPixelRectCalls}`);
      }
    }
  } finally {
    (globalThis as any).document = prevDocument;
  }
});

test('grammar-kinkakuji building() reflection buffer matches legacy per-pixel r() output across all 16 season x time frames', () => {
  const prevDocument = (globalThis as any).document;
  try {
    const reflected: Record<number, number> = {
      39: 16, 13: 16, 25: 17, 24: 20, 21: 8, 23: 8, 7: 20, 18: 20, 6: 7, 29: 29, 30: 29, 31: 30, 35: 30,
    };
    for (const season of SEASONS) {
      for (const time of TIMES) {
        const palette = makePalette(grammarKinkakuji, season, time);
        const createdCanvases: Array<ReturnType<typeof makeMockCanvas>> = [];
        (globalThis as any).document = {
          createElement(tag: string) {
            assert.equal(tag, 'canvas');
            const canvas = makeMockCanvas(W, H);
            createdCanvases.push(canvas);
            return canvas;
          },
        };

        let dstPixelRectCalls = 0;
        let dstAfterReflection: Uint8ClampedArray | null = null;
        const dst = makeMockCanvas(W, H, (count, snap) => { if (count === 2) dstAfterReflection = snap; });
        const dstCtx = dst.getContext();
        const draw = makeDraw(palette, (ctx, _x, _y, w, h) => {
          if (ctx === dstCtx && w === 1 && h === 1) dstPixelRectCalls++;
        });
        const api: any = {
          state: { season, time, weather: 'clear', params: {} },
          palette,
          draw,
          random: (SceneEngine as any).seeded,
        };

        const scene = (grammarKinkakuji as any).create(api);
        scene.layers[1](dstCtx);

        assert.equal(createdCanvases.length, 2, 'Expected building canvas and reflection canvas');
        assert.equal(dst.stats().putImageDataCalls, 0, 'Must never call putImageData directly on destination c');
        assert.equal(createdCanvases[1].stats().putImageDataCalls, 1, 'Expected single putImageData on offscreen reflection canvas');
        assert.equal(dst.stats().drawImageCalls, 2, 'Expected drawImage for building and reflection');

        // Reconstruct legacy per-pixel output from the exact building canvas pixels
        const legacyCanvas = makeMockCanvas(W, H);
        const legacyCtx = legacyCanvas.getContext();
        const legacyDraw = makeDraw(palette);
        legacyCtx.drawImage(createdCanvases[0], 0, 0);
        const archPixels = createdCanvases[0].getContext().getImageData(0, 0, W, H).data;
        const lookup = new Map(palette.map((v, i) => [parseInt(v.slice(1), 16), i]));
        for (let y = 142; y < 216; y++) {
          const sy = Math.floor(137 - (y - 142) * 1.38);
          const wave = Math.round(Math.sin(y * 0.21));
          for (let x = 138; x < 283; x++) {
            const at = (sy * W + x) * 4;
            if (archPixels[at + 3]) {
              const index = lookup.get((archPixels[at] << 16) | (archPixels[at + 1] << 8) | archPixels[at + 2]);
              legacyDraw.rect(legacyCtx, x + wave, y, 1, 1, (index !== undefined ? reflected[index] : undefined) ?? 20);
            }
          }
        }
        // Snapshot dst immediately after drawImage(b,0,0) (before shoreline rocks) to verify full architecture + reflection composite on c.

        const legacyReflCanvas = makeMockCanvas(W, H);
        const legacyReflCtx = legacyReflCanvas.getContext();
        for (let y = 142; y < 216; y++) {
          const sy = Math.floor(137 - (y - 142) * 1.38);
          const wave = Math.round(Math.sin(y * 0.21));
          for (let x = 138; x < 283; x++) {
            const at = (sy * W + x) * 4;
            if (archPixels[at + 3]) {
              const index = lookup.get((archPixels[at] << 16) | (archPixels[at + 1] << 8) | archPixels[at + 2]);
              legacyDraw.rect(legacyReflCtx, x + wave, y, 1, 1, (index !== undefined ? reflected[index] : undefined) ?? 20);
            }
          }
        }

        assert.equal(
          diffPixels(createdCanvases[1].raw(), legacyReflCanvas.raw()),
          0,
          `Reflection buffer pixel diff on grammar-kinkakuji ${season}/${time}`,
        );
        assert.equal(
          diffPixels(dstAfterReflection!, legacyCanvas.raw()),
          0,
          `Composited layer pixel diff on grammar-kinkakuji ${season}/${time}`,
        );
        // C.rock draws only 11 small rocks (few 1x1 calls), never the ~6000-pixel reflection loop.
        assert.ok(dstPixelRectCalls < 200, `Unexpected per-pixel rect count on dst: ${dstPixelRectCalls}`);
      }
    }
  } finally {
    (globalThis as any).document = prevDocument;
  }
});