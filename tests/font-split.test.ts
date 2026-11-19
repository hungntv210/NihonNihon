import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type FaceRule = {
  family: string;
  url: string;
  format: string;
  weight: string;
  ranges: Array<[number, number]>;
};

const ROOT = process.cwd();
const FONTS_DIR = path.join(ROOT, 'public', 'fonts');
const TOKENS_CSS = path.join(ROOT, 'src', 'styles', 'tokens.css');
const SUBSETS_CSS = path.join(FONTS_DIR, 'subsets.css');
const SUBSETS_JSON = path.join(FONTS_DIR, 'subsets.json');

function parseUnicodeRange(spec: string): Array<[number, number]> {
  return spec
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/.exec(part);
      assert.ok(m, `Invalid unicode-range token: ${part}`);
      const start = Number.parseInt(m[1], 16);
      const end = m[2] ? Number.parseInt(m[2], 16) : start;
      assert.ok(start <= end, `Descending unicode-range: ${part}`);
      return [start, end] as [number, number];
    });
}

function parseFontFaces(css: string): FaceRule[] {
  const rules: FaceRule[] = [];
  const re = /@font-face\{([^}]+)\}/g;
  for (const match of css.matchAll(re)) {
    const body = match[1];
    const family = /font-family:'([^']+)'/.exec(body)?.[1];
    const src = /src:url\('([^']+)'\)\s*format\('([^']+)'\)/.exec(body);
    const weight = /font-weight:([^;]+)/.exec(body)?.[1];
    const rangeSpec = /unicode-range:([^;]+)/.exec(body)?.[1];
    assert.ok(family && src && weight && rangeSpec, `Incomplete @font-face: ${body}`);
    rules.push({
      family,
      url: src[1],
      format: src[2],
      weight: weight.trim(),
      ranges: parseUnicodeRange(rangeSpec),
    });
  }
  return rules;
}

function containsCodePoint(ranges: Array<[number, number]>, cp: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = ranges[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
}

function rangesOverlap(a: Array<[number, number]>, b: Array<[number, number]>): number | null {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i][0], b[j][0]);
    const end = Math.min(a[i][1], b[j][1]);
    if (start <= end) return start;
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return null;
}

function rangeCount(ranges: Array<[number, number]>): number {
  return ranges.reduce((sum, [a, b]) => sum + (b - a + 1), 0);
}

function collectSrcText(): string {
  const srcRoot = path.join(ROOT, 'src');
  const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.json']);
  const chunks: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && exts.has(path.extname(entry.name))) {
        chunks.push(fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(srcRoot);
  return chunks.join('').normalize('NFC');
}

test('tokens.css, subsets.css, subsets.json, OFL licenses and original TTFs stay in sync', () => {
  const subsetsCss = fs.readFileSync(SUBSETS_CSS, 'utf8').replace(/\r\n/g, '\n');
  const tokensCss = fs.readFileSync(TOKENS_CSS, 'utf8').replace(/\r\n/g, '\n');
  const [header] = tokensCss.split(':root {', 1);
  assert.ok(header.includes(subsetsCss), 'tokens.css must inline public/fonts/subsets.css verbatim');

  const manifest = JSON.parse(fs.readFileSync(SUBSETS_JSON, 'utf8')) as {
    fonts: Array<{
      source: string;
      file: string;
      sha256: string;
      bytes: number;
      unicode_count: number;
      bucket?: string;
    }>;
  };
  const shipporiEntries = manifest.fonts.filter((f) => f.source === 'ShipporiMincho-Regular.ttf');
  assert.deepEqual(
    shipporiEntries.map((f) => f.bucket),
    ['Core', 'N5', 'N4', 'N3', 'N2', 'N1'],
    'Shippori Mincho must be split into Core + N5..N1 buckets',
  );
  const totalShipporiGlyphs = shipporiEntries.reduce((sum, f) => sum + f.unicode_count, 0);
  assert.ok(totalShipporiGlyphs >= 3100, `Expected >=3100 Shippori glyphs, got ${totalShipporiGlyphs}`);

  const coreEntry = shipporiEntries.find((f) => f.bucket === 'Core');
  assert.ok(coreEntry && coreEntry.bytes < 150_000, `Core Shippori subset should stay compact (<150 KB), got ${coreEntry?.bytes}`);

  for (const entry of manifest.fonts) {
    assert.ok(entry.file.endsWith('-Subset.woff2'), `Subset filename must end with -Subset.woff2: ${entry.file}`);
    const full = path.join(FONTS_DIR, entry.file);
    const buf = fs.readFileSync(full);
    assert.equal(buf.length, entry.bytes, `Byte size mismatch for ${entry.file}`);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    assert.equal(hash, entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    assert.ok(fs.existsSync(path.join(FONTS_DIR, entry.source)), `Original TTF missing: ${entry.source}`);
  }

  for (const ofl of ['OFL.BeVietnamPro.txt', 'OFL.ShipporiMincho.txt', 'OFL.VT323.txt']) {
    assert.ok(fs.existsSync(path.join(FONTS_DIR, ofl)), `OFL license missing: ${ofl}`);
  }
});

test('Shippori WOFF2 subsets and all TTF fallbacks have strictly disjoint unicode-ranges', () => {
  const rules = parseFontFaces(fs.readFileSync(TOKENS_CSS, 'utf8'));
  const byFamilyWeight = new Map<string, FaceRule[]>();
  for (const rule of rules) {
    const key = `${rule.family}|${rule.weight}`;
    const list = byFamilyWeight.get(key) ?? [];
    list.push(rule);
    byFamilyWeight.set(key, list);
  }

  for (const [key, group] of byFamilyWeight) {
    const woff2s = group.filter((r) => r.format === 'woff2');
    const ttfs = group.filter((r) => r.format === 'truetype');
    assert.ok(woff2s.length >= 1, `Missing WOFF2 rule for ${key}`);
    assert.equal(ttfs.length, 1, `Expected 1 TTF fallback rule for ${key}`);

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const hit = rangesOverlap(group[i].ranges, group[j].ranges);
        assert.equal(
          hit,
          null,
          `Overlapping unicode-range in ${key} between ${group[i].url} and ${group[j].url} at U+${hit?.toString(16).toUpperCase()}`,
        );
      }
    }
  }

  const shipporiWoff2 = rules.filter((r) => r.family === 'Shippori Mincho' && r.format === 'woff2');
  assert.equal(shipporiWoff2.length, 6, 'Expected 6 split Shippori WOFF2 @font-face rules');
  assert.ok(
    !shipporiWoff2.some((r) => r.url === '/fonts/ShipporiMincho-Regular-Subset.woff2'),
    'Monolithic ShipporiMincho-Regular-Subset.woff2 must no longer be declared in tokens.css',
  );
  const totalCovered = shipporiWoff2.reduce((sum, r) => sum + rangeCount(r.ranges), 0);
  assert.ok(totalCovered >= 3100, `Expected >=3100 codepoints across split Shippori rules, got ${totalCovered}`);
});

test('every Japanese UI/scene/core specimen is covered by Shippori Core WOFF2 and never triggers TTF fallback', () => {
  const rules = parseFontFaces(fs.readFileSync(TOKENS_CSS, 'utf8'));
  const shipporiCore = rules.find((r) => r.url === '/fonts/ShipporiMincho-Regular-Core-Subset.woff2');
  const shipporiTtf = rules.find((r) => r.url === '/fonts/ShipporiMincho-Regular.ttf');
  const shipporiWoff2 = rules.filter((r) => r.family === 'Shippori Mincho' && r.format === 'woff2');
  assert.ok(shipporiCore, 'Missing Core Shippori subset rule');
  assert.ok(shipporiTtf, 'Missing Shippori TTF fallback rule');

  // Required specimens: town art signs, weather, time/greeting, SRS/test-app specimens, core demo kanji/kana.
  const requiredSpecimens =
    '商店街食堂ごはんみどり駅神社学校まちあさひるゆうがたよる今日も少しずつ働返直骨日晴れ曇雨雪霧風本学生行私今天気あいうえおアイウエオ';
  for (const ch of requiredSpecimens) {
    const cp = ch.codePointAt(0)!;
    assert.ok(
      containsCodePoint(shipporiCore.ranges, cp),
      `Required Japanese specimen ${ch} (U+${cp.toString(16).toUpperCase()}) missing from Core WOFF2`,
    );
    assert.ok(
      !containsCodePoint(shipporiTtf.ranges, cp),
      `Required Japanese specimen ${ch} (U+${cp.toString(16).toUpperCase()}) must not match TTF fallback`,
    );
  }

  // Every hiragana, katakana, Japanese punctuation, and CJK ideograph found in src/ must be in Core WOFF2 and never match TTF.
  const srcText = collectSrcText();
  const seen = new Set<number>();
  for (const ch of srcText) {
    const cp = ch.codePointAt(0)!;
    if (seen.has(cp)) continue;
    seen.add(cp);
    const isCoreJapanese =
      (cp >= 0x3000 && cp <= 0x30ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0x9fff);
    if (isCoreJapanese) {
      assert.ok(
        containsCodePoint(shipporiCore.ranges, cp),
        `src/ Japanese char ${ch} (U+${cp.toString(16).toUpperCase()}) missing from Core WOFF2`,
      );
      assert.ok(
        !containsCodePoint(shipporiTtf.ranges, cp),
        `src/ Japanese char ${ch} (U+${cp.toString(16).toUpperCase()}) must not trigger TTF fallback`,
      );
    } else if (cp >= 0xff00 && cp <= 0xffef) {
      assert.ok(
        !containsCodePoint(shipporiTtf.ranges, cp),
        `src/ fullwidth/halfwidth char ${ch} (U+${cp.toString(16).toUpperCase()}) must not trigger TTF fallback`,
      );
    }
  }

  // Verify Be Vietnam Pro Vietnamese specimens never match TTF fallback.
  const viRegular = rules.find((r) => r.url === '/fonts/BeVietnamPro-Regular-Subset.woff2');
  const viRegularTtf = rules.find((r) => r.url === '/fonts/BeVietnamPro-Regular.ttf');
  assert.ok(viRegular && viRegularTtf);
  for (const ch of 'ỘỆỜỮỸĐ') {
    const cp = ch.codePointAt(0)!;
    assert.ok(containsCodePoint(viRegular.ranges, cp));
    assert.ok(!containsCodePoint(viRegularTtf.ranges, cp));
  }

  // Sanity check that N5..N1 buckets are all non-empty WOFF2 subsets.
  for (const bucket of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    const rule = shipporiWoff2.find((r) => r.url === `/fonts/ShipporiMincho-Regular-${bucket}-Subset.woff2`);
    assert.ok(rule && rangeCount(rule.ranges) > 100, `Expected non-trivial Shippori ${bucket} bucket`);
  }
});
