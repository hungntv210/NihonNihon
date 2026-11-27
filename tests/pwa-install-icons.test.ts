import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import manifest from '../src/app/manifest.ts';
import { proxy } from '../src/proxy.ts';
import { hashPassword } from '../src/core/session.ts';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BG_RGB = [0x2f, 0x68, 0x4e] as const;

function readPngDimensions(filePath: string) {
  const buf = fs.readFileSync(filePath);
  assert.ok(buf.length >= 26, `${filePath} must be a valid PNG`);
  assert.deepEqual(buf.subarray(0, 8), PNG_SIGNATURE, `${filePath} PNG signature`);
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', `${filePath} IHDR chunk`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
    bytes: buf.length,
  };
}

test('proxy allows unauthenticated /icons/*.png and strictly blocks traversal, wrong extensions, and /api', (t) => {
  const prevSecret = process.env.SESSION_SECRET;
  const prevHash = process.env.NIHON_PASSWORD_HASH;
  process.env.SESSION_SECRET = 'synthetic-pwa-icon-secret-'.repeat(2);
  process.env.NIHON_PASSWORD_HASH = hashPassword('synthetic-pwa-icon-password');
  t.after(() => {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevHash === undefined) delete process.env.NIHON_PASSWORD_HASH;
    else process.env.NIHON_PASSWORD_HASH = prevHash;
  });

  for (const iconPath of [
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon-180.png',
  ]) {
    const res = proxy(new NextRequest(`http://127.0.0.1:3000${iconPath}`));
    assert.equal(res.status, 200, `${iconPath} must be public`);
    assert.equal(res.headers.get('x-middleware-next'), '1', `${iconPath} passes through proxy`);
  }

  // URL-normalized traversal /icons/../api/x resolves to /api/x -> 401
  const normalizedTraversal = proxy(new NextRequest('http://127.0.0.1:3000/icons/../api/x'));
  assert.equal(normalizedTraversal.status, 401);

  // Raw unnormalized pathname with '..' must still be blocked even if passed directly
  const rawTraversalReq = {
    nextUrl: { pathname: '/icons/../api/x' },
    url: 'http://127.0.0.1:3000/icons/../api/x',
    method: 'GET',
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
  const rawTraversalRes = proxy(rawTraversalReq);
  assert.equal(rawTraversalRes.status, 307);
  assert.ok(rawTraversalRes.headers.get('location')?.endsWith('/login'));

  for (const blockedPath of [
    '/icons/..%2fapi%2fx.png',
    '/icons/%2e%2e%2fapi%2fx.png',
    '/icons/a..b.png',
    '/icons/sub/icon-192.png',
    '/icons/a.svg',
    '/icons/x.png.js',
    '/icons/.png',
    '/icons/icon-192.png.bak',
    '/icons/',
  ]) {
    const res = proxy(new NextRequest(`http://127.0.0.1:3000${blockedPath}`));
    assert.equal(res.status, 307, `${blockedPath} must be blocked`);
    assert.ok(res.headers.get('location')?.endsWith('/login'), `${blockedPath} redirects to /login`);
  }

  for (const apiPath of ['/api/review/cards', '/api/settings', '/api/backup']) {
    const res = proxy(new NextRequest(`http://127.0.0.1:3000${apiPath}`));
    assert.equal(res.status, 401, `${apiPath} must stay protected with 401`);
  }
});

test('manifest declares id, scope, existing branding, and all 4 icons with exact sizes and purposes', () => {
  const m = manifest();
  assert.equal(m.id, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.name, 'Nihon Nihon');
  assert.equal(m.short_name, 'Nihon');
  assert.equal(m.lang, 'vi');
  assert.equal(m.start_url, '/');
  assert.equal(m.display, 'standalone');
  assert.equal(m.background_color, '#f7f6f1');
  assert.equal(m.theme_color, '#f7f6f1');

  assert.deepEqual(m.icons, [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ]);
});

test('public/icons PNG files exist with exact pixel dimensions, opaque iOS/maskable backgrounds, and 80% maskable safe zone', async () => {
  const expected = [
    { file: 'public/icons/icon-192.png', size: 192, opaque: false },
    { file: 'public/icons/icon-512.png', size: 512, opaque: false },
    { file: 'public/icons/icon-maskable-512.png', size: 512, opaque: true },
    { file: 'public/icons/apple-touch-icon-180.png', size: 180, opaque: true },
  ];

  for (const item of expected) {
    const fullPath = path.resolve(item.file);
    assert.ok(fs.existsSync(fullPath), `${item.file} exists`);
    const png = readPngDimensions(fullPath);
    assert.equal(png.width, item.size, `${item.file} width`);
    assert.equal(png.height, item.size, `${item.file} height`);
    if (item.opaque) {
      // PNG color type 2 = truecolor RGB (no alpha channel)
      assert.equal(png.colorType, 2, `${item.file} must have solid opaque background (no alpha)`);
    }
  }

  // Verify maskable icon keeps all foreground artwork strictly inside the centered 80% safe-zone circle
  const maskablePath = path.resolve('public/icons/icon-maskable-512.png');
  const { data: maskData, info: maskInfo } = await sharp(maskablePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(maskInfo.width, 512);
  assert.equal(maskInfo.height, 512);
  assert.equal(maskInfo.channels, 3);

  const cx = 255.5;
  const cy = 255.5;
  const safeRadius = 512 * 0.4; // 80% diameter = 40% radius
  let nonBgOutsideSafeZone = 0;
  let brightInsideSafeZone = 0;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 3;
      const r = maskData[idx];
      const g = maskData[idx + 1];
      const b = maskData[idx + 2];
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > safeRadius) {
        if (r !== BG_RGB[0] || g !== BG_RGB[1] || b !== BG_RGB[2]) nonBgOutsideSafeZone++;
      } else if (r > 240 && g > 240 && b > 240) {
        brightInsideSafeZone++;
      }
    }
  }

  assert.equal(nonBgOutsideSafeZone, 0, 'maskable icon must have solid background outside 80% safe zone');
  assert.ok(brightInsideSafeZone > 5000, 'maskable icon must render visible foreground glyph inside safe zone');

  // Verify apple-touch-icon corners are solid brand green and center has visible foreground
  const applePath = path.resolve('public/icons/apple-touch-icon-180.png');
  const { data: appleData, info: appleInfo } = await sharp(applePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(appleInfo.width, 180);
  assert.equal(appleInfo.height, 180);
  assert.equal(appleInfo.channels, 3);
  for (const [x, y] of [
    [0, 0],
    [179, 0],
    [0, 179],
    [179, 179],
  ]) {
    const idx = (y * 180 + x) * 3;
    assert.deepEqual([appleData[idx], appleData[idx + 1], appleData[idx + 2]], [...BG_RGB]);
  }
});

test('layout.tsx declares iOS home-screen meta tags via Next metadata API', () => {
  const layoutSource = fs.readFileSync(path.resolve('src/app/layout.tsx'), 'utf8');
  assert.match(layoutSource, /\/icons\/apple-touch-icon-180\.png/);
  assert.match(layoutSource, /appleWebApp:\s*\{/);
  assert.match(layoutSource, /capable:\s*true/);
  assert.match(layoutSource, /statusBarStyle:\s*'default'/);
  assert.match(layoutSource, /title:\s*'Nihon Nihon'/);
  assert.match(layoutSource, /'apple-mobile-web-app-capable':\s*'yes'/);
});
