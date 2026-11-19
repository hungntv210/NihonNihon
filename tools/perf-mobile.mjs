import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { seedDemo } from './seed-demo.ts';
import { hashPassword } from '../src/core/session.ts';

// Simulated mobile profile: iPhone 13/14 (390x844, DPR 3), 4x CPU slowdown, Fast 4G network
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE_FACTOR = 3;
const CPU_THROTTLE_RATE = 4;
// Fast 4G profile (~9 Mbps down, ~1.5 Mbps up, 60 ms latency)
const FAST_4G = {
  offline: false,
  latency: 60,
  downloadThroughput: Math.floor((9 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((1.5 * 1024 * 1024) / 8),
  connectionType: 'cellular4g',
};
const RUNS_PER_PAGE = 3;
const FPS_DURATION_MS = 10_000;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round(n, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

const base = path.resolve('.tmp');
fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'perf-mobile-')),
  dbPath = path.join(directory, 'app.sqlite');
seedDemo(dbPath);

// Add synthetic stroke geometry for kanji 日 so the detail page exercises the full stroke player
const db = new DatabaseSync(dbPath);
const dayKanji = db
  .prepare(
    "SELECT i.item_id,i.source_hash FROM content_items i JOIN kanji k USING(item_id) WHERE k.character='日'",
  )
  .get();
const vocabItem = db.prepare("SELECT item_id FROM vocab WHERE word='学生'").get();
if (dayKanji) {
  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:perf-test','Synthetic perf fixture','https://example.invalid','Synthetic test only','Synthetic fixture','private_only')",
  ).run();
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('perf-release','mt:perf-test','1',?,'local://perf','2026-11-19','Synthetic test only','Synthetic test',?)",
  ).run('a'.repeat(64), JSON.stringify({ model: 'synthetic-perf', prompt_version: 'perf-mobile' }));
  for (const [i, geometry] of [
    'M25 20L25 90',
    'M25 20L80 20L80 90',
    'M25 55L80 55',
    'M25 90L80 90',
  ].entries()) {
    db.prepare(
      "INSERT INTO kanji_strokes(kanji_id,stroke_no,path_d,source_id,release_id) VALUES(?,?,?,'mt:perf-test','perf-release')",
    ).run(String(dayKanji.item_id), i + 1, geometry);
  }
}
db.close();

const port = await new Promise((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No test port');
    const p = address.port;
    server.close(() => resolve(p));
  });
});

const origin = `http://127.0.0.1:${port}`,
  password = randomBytes(24).toString('base64url');

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      APP_ORIGIN: origin,
      NIHON_DB_PATH: dbPath,
      NIHON_DB_ROLE: 'snapshot',
      NIHON_SETTINGS_PATH: path.join(directory, 'settings.json'),
      NIHON_ROADMAP_PATH: path.join(directory, 'today-roadmap.json'),
      NIHON_RECORDINGS_DIR: path.join(directory, 'recordings'),
      NIHON_BACKUP_DIR: path.join(directory, 'backups'),
      NIHON_PASSWORD_HASH: hashPassword(password),
      SESSION_SECRET: randomBytes(32).toString('hex'),
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let log = '';
child.stdout.on('data', (b) => (log += b));
child.stderr.on('data', (b) => (log += b));

const request = (url, options = {}) =>
  fetch(origin + url, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });

let browser;
try {
  let ready = false,
    lastReady = '';
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw Error('Perf server exited: ' + log);
    try {
      const health = await request('/robots.txt');
      lastReady = health.status + ':' + (await health.text());
      if (health.ok) {
        ready = true;
        break;
      }
    } catch (error) {
      lastReady = String(error);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, 'Server became ready: ' + log + ' last response: ' + lastReady);

  // Create authenticated session cookie & seed 1 due SRS review card
  const loginRes = await request('/api/session', {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({ password }),
  });
  assert.equal(loginRes.status, 303, 'Login succeeded');
  const setCookie = loginRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Session cookie issued');
  const cookieHeader = setCookie.split(';')[0];
  const [cookieName, cookieValue] = cookieHeader.split('=');

  if (vocabItem) {
    const addCard = await request('/api/review/cards', {
      method: 'POST',
      headers: { cookie: cookieHeader, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: String(vocabItem.item_id), cardType: 'recognition' }),
    });
    assert.ok(addCard.status === 201 || addCard.status === 200, 'Seeded SRS card');
  }

  const chrome =
    process.env.CHROME_PATH ??
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined);

  browser = await chromium.launch({
    headless: true,
    ...(chrome && fs.existsSync(chrome) ? { executablePath: chrome } : {}),
  });

  const pagesToMeasure = [
    {
      id: 'login',
      label: 'Đăng nhập (/login)',
      path: '/login',
      authenticated: false,
      readyCheck: () => {
        const btn = document.querySelector('form[action="/api/session"] button:not([disabled])');
        const scene = document.querySelector('[data-pixel-viewport="login-shoji"]');
        return Boolean(btn && scene && scene.getAttribute('data-ready') === 'true');
      },
    },
    {
      id: 'today',
      label: 'Hôm nay (/)',
      path: '/',
      authenticated: true,
      readyCheck: () => {
        const h1 = document.querySelector('main h1');
        const scene = document.querySelector('[data-pixel-viewport="home-tokyo"]');
        return Boolean(h1 && scene && scene.getAttribute('data-ready') === 'true');
      },
    },
    {
      id: 'srs',
      label: 'Phiên ôn SRS (/srs)',
      path: '/srs',
      authenticated: true,
      readyCheck: () => {
        const session = document.querySelector('[data-srs-session]');
        const scene = document.querySelector('[data-pixel-viewport="review-koi"]');
        const cardReady =
          document.querySelector('[data-srs-card]') ||
          Array.from(document.querySelectorAll('button')).some((b) =>
            b.textContent?.includes('Hiện đáp án'),
          );
        return Boolean(session && cardReady && scene && scene.getAttribute('data-ready') === 'true');
      },
    },
    {
      id: 'kanji-detail',
      label: 'Chi tiết Kanji (/kanji/日)',
      path: '/kanji/%E6%97%A5',
      authenticated: true,
      readyCheck: () => {
        const h2 = Array.from(document.querySelectorAll('h2')).some((el) =>
          el.textContent?.includes('Chữ'),
        );
        const memo = document.querySelector('#kanji-memo');
        return Boolean(h2 && memo);
      },
    },
    {
      id: 'grammar-detail',
      label: 'Chi tiết Ngữ pháp (/grammar/wa)',
      path: '/grammar/wa',
      authenticated: true,
      readyCheck: () => {
        const h1 = document.querySelector('main h1');
        const meaning = document.querySelector('#meaning-title');
        return Boolean(h1 && meaning);
      },
    },
  ];

  async function measureSingleRun(target, runIndex) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    if (target.authenticated) {
      await context.addCookies([
        {
          name: cookieName,
          value: cookieValue,
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          sameSite: 'Strict',
        },
      ]);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Install PerformanceObservers before navigation
    await page.addInitScript(() => {
      window.__perfMetrics = {
        lcp: 0,
        cls: 0,
        tbt: 0,
        longTasksCount: 0,
        longTasks: [],
        fcp: 0,
      };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            window.__perfMetrics.lcp = last.renderTime || last.loadTime || last.startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}

      try {
        let sessionValue = 0;
        let sessionEntries = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              const first = sessionEntries[0];
              const last = sessionEntries[sessionEntries.length - 1];
              if (
                sessionValue &&
                entry.startTime - last.startTime < 1000 &&
                entry.startTime - first.startTime < 5000
              ) {
                sessionValue += entry.value;
                sessionEntries.push(entry);
              } else {
                sessionValue = entry.value;
                sessionEntries = [entry];
              }
              if (sessionValue > window.__perfMetrics.cls) {
                window.__perfMetrics.cls = sessionValue;
              }
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const blocking = Math.max(0, entry.duration - 50);
            window.__perfMetrics.tbt += blocking;
            window.__perfMetrics.longTasksCount += 1;
            window.__perfMetrics.longTasks.push({
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
              blocking: Math.round(blocking),
            });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch {}

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              window.__perfMetrics.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });
      } catch {}
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', FAST_4G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });

    const requests = new Map();
    const jsAssets = new Map();

    page.on('request', (req) => {
      if (req.url().startsWith(origin)) {
        requests.set(req.url() + '#' + requests.size, {
          url: new URL(req.url()).pathname + new URL(req.url()).search,
          resourceType: req.resourceType(),
        });
      }
    });

    page.on('response', async (res) => {
      try {
        const url = res.url();
        if (!url.startsWith(origin)) return;
        const ct = (res.headers()['content-type'] || '').toLowerCase();
        const isJs =
          res.request().resourceType() === 'script' ||
          ct.includes('javascript') ||
          new URL(url).pathname.endsWith('.js');
        if (isJs && res.status() === 200) {
          const body = await res.body();
          const gzipBytes = gzipSync(body).byteLength;
          jsAssets.set(new URL(url).pathname, {
            pathname: new URL(url).pathname,
            rawBytes: body.byteLength,
            gzipBytes,
          });
        }
      } catch {}
    });

    await page.goto(origin + target.path, { waitUntil: 'load' });
    await page.waitForFunction(target.readyCheck, undefined, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    // Allow buffered PerformanceObserver callbacks to flush after fonts and readyCheck
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const interactiveMs = performance.now();
      return {
        lcpMs: window.__perfMetrics.lcp || window.__perfMetrics.fcp || interactiveMs,
        cls: window.__perfMetrics.cls,
        tbtMs: window.__perfMetrics.tbt,
        longTasksCount: window.__perfMetrics.longTasksCount,
        longTasks: window.__perfMetrics.longTasks,
        fcpMs: window.__perfMetrics.fcp,
        domInteractiveMs: nav ? nav.domInteractive : 0,
        loadEventEndMs: nav ? nav.loadEventEnd : 0,
        interactiveMs,
      };
    });

    const jsList = [...jsAssets.values()].sort((a, b) => b.gzipBytes - a.gzipBytes);
    const totalJsGzipBytes = jsList.reduce((sum, item) => sum + item.gzipBytes, 0);
    const totalJsRawBytes = jsList.reduce((sum, item) => sum + item.rawBytes, 0);
    const requestCount = requests.size;

    await cdp.detach().catch(() => {});
    await context.close();

    return {
      run: runIndex + 1,
      lcpMs: round(perf.lcpMs, 1),
      cls: round(perf.cls, 4),
      tbtMs: round(perf.tbtMs, 1),
      longTasksCount: perf.longTasksCount,
      longTasks: perf.longTasks,
      jsGzipKb: round(totalJsGzipBytes / 1024, 2),
      jsRawKb: round(totalJsRawBytes / 1024, 2),
      jsChunks: jsList,
      requests: requestCount,
      requestUrls: [...requests.values()].map(r => r.url),
      ttiMs: round(perf.interactiveMs, 1),
      fcpMs: round(perf.fcpMs, 1),
    };
  }

  async function measurePixelSceneFps(sceneTarget) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    if (sceneTarget.authenticated) {
      await context.addCookies([
        {
          name: cookieName,
          value: cookieValue,
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          sameSite: 'Strict',
        },
      ]);
    }

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', FAST_4G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });

    await page.goto(origin + sceneTarget.path, { waitUntil: 'load' });
    await page.waitForFunction(
      (sceneId) => {
        const el = document.querySelector(`[data-pixel-viewport="${sceneId}"]`);
        return Boolean(el && el.getAttribute('data-ready') === 'true' && el.pixelEngine);
      },
      sceneTarget.sceneId,
      { timeout: 30000 },
    );

    const fpsStats = await page.evaluate(
      async ({ sceneId, durationMs }) => {
        const el = document.querySelector(`[data-pixel-viewport="${sceneId}"]`);
        const eng = el.pixelEngine;
        const startEngineFrames = eng.metrics.frames;
        let rafFrames = 0;
        const frameDeltas = [];
        let frameCpuTotalMs = 0;
        let frameCpuMaxMs = 0;
        const origFrame = eng.frame.bind(eng);
        eng.frame = function (still) {
          const t0 = performance.now();
          const res = origFrame(still);
          const dt = performance.now() - t0;
          if (!still) {
            frameCpuTotalMs += dt;
            if (dt > frameCpuMaxMs) frameCpuMaxMs = dt;
          }
          return res;
        };

        return await new Promise((resolve) => {
          const tStart = performance.now();
          let prev = tStart;
          function loop(now) {
            rafFrames++;
            frameDeltas.push(now - prev);
            prev = now;
            if (now - tStart < durationMs) {
              requestAnimationFrame(loop);
            } else {
              const elapsedSec = (now - tStart) / 1000;
              const engineFrames = eng.metrics.frames - startEngineFrames;
              const sortedDeltas = [...frameDeltas].sort((a, b) => a - b);
              const p95Delta =
                sortedDeltas[Math.min(sortedDeltas.length - 1, Math.floor(sortedDeltas.length * 0.95))] || 0;
              resolve({
                sceneId,
                durationSec: Math.round(elapsedSec * 100) / 100,
                rafFps: Math.round((rafFrames / elapsedSec) * 10) / 10,
                engineFps: Math.round((engineFrames / elapsedSec) * 10) / 10,
                engineTargetFps: 30,
                rafFrames,
                engineFrames,
                p95FrameDeltaMs: Math.round(p95Delta * 10) / 10,
                avgEngineFrameCpuMs:
                  engineFrames > 0 ? Math.round((frameCpuTotalMs / engineFrames) * 100) / 100 : 0,
                maxEngineFrameCpuMs: Math.round(frameCpuMaxMs * 100) / 100,
                maxDirtyAreaPx: eng.metrics.maxDirtyArea,
                staticLayers: eng.statics.length,
                dynamicLayers: eng.dynamics.length,
                stats: eng.stats(),
              });
            }
          }
          requestAnimationFrame(loop);
        });
      },
      { sceneId: sceneTarget.sceneId, durationMs: FPS_DURATION_MS },
    );

    await cdp.detach().catch(() => {});
    await context.close();
    return fpsStats;
  }

  const pageResults = [];
  for (const target of pagesToMeasure) {
    console.log(`Measuring ${target.label} (${RUNS_PER_PAGE} runs)...`);
    const runs = [];
    for (let r = 0; r < RUNS_PER_PAGE; r++) {
      const res = await measureSingleRun(target, r);
      runs.push(res);
      console.log(
        `  run ${r + 1}: LCP=${res.lcpMs}ms CLS=${res.cls} TBT=${res.tbtMs}ms JS=${res.jsGzipKb}KB(gzip) req=${res.requests} TTI=${res.ttiMs}ms`,
      );
    }
    const summary = {
      id: target.id,
      label: target.label,
      path: target.path,
      median: {
        lcpMs: round(median(runs.map((r) => r.lcpMs)), 1),
        cls: round(median(runs.map((r) => r.cls)), 4),
        tbtMs: round(median(runs.map((r) => r.tbtMs)), 1),
        longTasksCount: median(runs.map((r) => r.longTasksCount)),
        jsGzipKb: round(median(runs.map((r) => r.jsGzipKb)), 2),
        jsRawKb: round(median(runs.map((r) => r.jsRawKb)), 2),
        requests: median(runs.map((r) => r.requests)),
        ttiMs: round(median(runs.map((r) => r.ttiMs)), 1),
        fcpMs: round(median(runs.map((r) => r.fcpMs)), 1),
      },
      runs,
    };
    pageResults.push(summary);
  }

  console.log('Measuring 10s Pixel Scene FPS on /login (login-shoji) and / (home-tokyo)...');
  const fpsLogin = await measurePixelSceneFps({
    path: '/login',
    sceneId: 'login-shoji',
    authenticated: false,
  });
  console.log(
    `  login-shoji (10s): rAF FPS=${fpsLogin.rafFps}, engine FPS=${fpsLogin.engineFps}/${fpsLogin.engineTargetFps}, avgFrameCPU=${fpsLogin.avgEngineFrameCpuMs}ms, maxFrameCPU=${fpsLogin.maxEngineFrameCpuMs}ms`,
  );

  const fpsHome = await measurePixelSceneFps({
    path: '/',
    sceneId: 'home-tokyo',
    authenticated: true,
  });
  console.log(
    `  home-tokyo (10s): rAF FPS=${fpsHome.rafFps}, engine FPS=${fpsHome.engineFps}/${fpsHome.engineTargetFps}, avgFrameCPU=${fpsHome.avgEngineFrameCpuMs}ms, maxFrameCPU=${fpsHome.maxEngineFrameCpuMs}ms`,
  );

  const reportData = {
    generatedAt: new Date().toISOString(),
    profile: {
      device: 'iPhone 13/14 (Simulated)',
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      cpuThrottleRate: CPU_THROTTLE_RATE,
      network: 'Fast 4G (9 Mbps down, 1.5 Mbps up, 60 ms RTT)',
      runsPerPage: RUNS_PER_PAGE,
    },
    pages: pageResults,
    pixelScenesFps: {
      loginShoji: fpsLogin,
      homeTokyo: fpsHome,
    },
  };

  const reportsDir = path.resolve('data/reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, 'perf-mobile.json');
  const mdPath = path.join(reportsDir, 'perf-mobile.md');

  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf8');

  const mdLines = [
    '# Báo cáo hiệu năng giả lập Mobile (iPhone 390×844, DPR 3, CPU 4×, Fast 4G)',
    '',
    `- Thời điểm đo: \`${reportData.generatedAt}\``,
    `- Cấu hình giả lập: Viewport \`390×844\`, \`DPR 3\`, CPU throttle \`4×\`, mạng \`Fast 4G\` (9 Mbps down / 1.5 Mbps up / RTT 60 ms), mỗi trang chạy \`${RUNS_PER_PAGE}\` lần lấy trung vị.`,
    '',
    '## 1. Bảng số đo 5 trang (Trung vị 3 lần chạy)',
    '',
    '| Trang | Đường dẫn | LCP (ms) | CLS | TBT (ms) | Long tasks | Tổng JS tải (gzip KB) | Số request | Tới khi tương tác / TTI (ms) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...pageResults.map(
      (p) =>
        `| ${p.label} | \`${p.path}\` | ${p.median.lcpMs} | ${p.median.cls} | ${p.median.tbtMs} | ${p.median.longTasksCount} | ${p.median.jsGzipKb} | ${p.median.requests} | ${p.median.ttiMs} |`,
    ),
    '',
    '## 2. FPS cảnh pixel động chạy 10 giây (CPU throttle 4×)',
    '',
    '| Cảnh pixel | Trang | Thời gian đo (s) | rAF FPS | Engine Paint FPS (trần 30 FPS) | CPU TB/frame (ms) | CPU đỉnh/frame (ms) | Dirty area tối đa (px²) | Số lớp canvas (tĩnh + động) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| \`login-shoji\` | \`/login\` | ${fpsLogin.durationSec} | ${fpsLogin.rafFps} | ${fpsLogin.engineFps} / ${fpsLogin.engineTargetFps} | ${fpsLogin.avgEngineFrameCpuMs} | ${fpsLogin.maxEngineFrameCpuMs} | ${fpsLogin.maxDirtyAreaPx} | ${fpsLogin.staticLayers} + ${fpsLogin.dynamicLayers} |`,
    `| \`home-tokyo\` | \`/\` | ${fpsHome.durationSec} | ${fpsHome.rafFps} | ${fpsHome.engineFps} / ${fpsHome.engineTargetFps} | ${fpsHome.avgEngineFrameCpuMs} | ${fpsHome.maxEngineFrameCpuMs} | ${fpsHome.maxDirtyAreaPx} | ${fpsHome.staticLayers} + ${fpsHome.dynamicLayers} |`,
    '',
  ];

  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
  console.log(`Saved reports to ${jsonPath} and ${mdPath}`);
} finally {
  await browser?.close();
  child.kill();
  await new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once('exit', () => resolve());
  });
  assert.equal(path.dirname(directory), base);
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
