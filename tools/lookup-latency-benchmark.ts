import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { openContentDatabase } from '../src/core/content.ts';
import {
  rebuildSearchIndex,
  searchAllKinds,
} from '../src/app/(study)/common-tools/repository.ts';
import { lookupWord } from '../src/app/(study)/common-tools/lookup.ts';
import { handleLookupGet } from '../src/app/(study)/common-tools/lookup-handler.ts';

type QueryCategory = 'kana' | 'kanji' | 'romaji' | 'vietnamese' | 'no_result';

type BenchmarkQuery = {
  id: string;
  category: QueryCategory;
  q: string;
};

// 30 fixed generic queries (6 per category); no private user data.
export const BENCHMARK_QUERIES: readonly BenchmarkQuery[] = [
  // Kana (6)
  { id: 'kana-1', category: 'kana', q: 'がくせい' },
  { id: 'kana-2', category: 'kana', q: 'たべる' },
  { id: 'kana-3', category: 'kana', q: 'にほんご' },
  { id: 'kana-4', category: 'kana', q: 'てんき' },
  { id: 'kana-5', category: 'kana', q: 'カタカナ' },
  { id: 'kana-6', category: 'kana', q: 'べんきょう' },
  // Kanji (6)
  { id: 'kanji-1', category: 'kanji', q: '学生' },
  { id: 'kanji-2', category: 'kanji', q: '食べる' },
  { id: 'kanji-3', category: 'kanji', q: '日本' },
  { id: 'kanji-4', category: 'kanji', q: '天' },
  { id: 'kanji-5', category: 'kanji', q: '勉強' },
  { id: 'kanji-6', category: 'kanji', q: '先生' },
  // Romaji (6)
  { id: 'romaji-1', category: 'romaji', q: 'gakusei' },
  { id: 'romaji-2', category: 'romaji', q: 'taberu' },
  { id: 'romaji-3', category: 'romaji', q: 'nihongo' },
  { id: 'romaji-4', category: 'romaji', q: 'tenki' },
  { id: 'romaji-5', category: 'romaji', q: 'sensei' },
  { id: 'romaji-6', category: 'romaji', q: 'benkyou' },
  // Vietnamese accented & accent-free (6)
  { id: 'vi-1', category: 'vietnamese', q: 'học sinh' },
  { id: 'vi-2', category: 'vietnamese', q: 'hoc sinh' },
  { id: 'vi-3', category: 'vietnamese', q: 'ăn' },
  { id: 'vi-4', category: 'vietnamese', q: 'thời tiết' },
  { id: 'vi-5', category: 'vietnamese', q: 'thoi tiet' },
  { id: 'vi-6', category: 'vietnamese', q: 'giáo viên' },
  // No-result (6)
  { id: 'none-1', category: 'no_result', q: 'zzznomatch1' },
  { id: 'none-2', category: 'no_result', q: 'qwertyuiop99' },
  { id: 'none-3', category: 'no_result', q: 'khongtontai88' },
  { id: 'none-4', category: 'no_result', q: 'ぬぬぬぬぬ' },
  { id: 'none-5', category: 'no_result', q: '乁乁乁' },
  { id: 'none-6', category: 'no_result', q: 'xzy987654' },
];

const RUNS_PER_QUERY = 5;
const WARMUP_RUNS = 1;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

type PathSummary = {
  path: string;
  queries: number;
  samples: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  meanMs: number;
  byCategory: Record<QueryCategory, { p50Ms: number; p95Ms: number; maxMs: number }>;
  slowest: Array<{ id: string; category: QueryCategory; maxMs: number; hits: number }>;
};

async function measurePath(
  name: string,
  runQuery: (query: BenchmarkQuery) => Promise<number> | number,
): Promise<PathSummary> {
  const allSamples: number[] = [];
  const catSamples: Record<QueryCategory, number[]> = {
    kana: [],
    kanji: [],
    romaji: [],
    vietnamese: [],
    no_result: [],
  };
  const perQueryMax: Array<{ id: string; category: QueryCategory; maxMs: number; hits: number }> =
    [];

  for (const query of BENCHMARK_QUERIES) {
    let queryMax = 0;
    let lastHits = 0;
    for (let run = 0; run < RUNS_PER_QUERY; run++) {
      const start = performance.now();
      lastHits = await runQuery(query);
      const elapsed = performance.now() - start;
      if (run >= WARMUP_RUNS) {
        allSamples.push(elapsed);
        catSamples[query.category].push(elapsed);
        if (elapsed > queryMax) queryMax = elapsed;
      }
    }
    perQueryMax.push({
      id: query.id,
      category: query.category,
      maxMs: roundMs(queryMax),
      hits: lastHits,
    });
  }

  allSamples.sort((a, b) => a - b);
  const byCategory = {} as Record<QueryCategory, { p50Ms: number; p95Ms: number; maxMs: number }>;
  for (const cat of Object.keys(catSamples) as QueryCategory[]) {
    const arr = catSamples[cat].sort((a, b) => a - b);
    byCategory[cat] = {
      p50Ms: roundMs(percentile(arr, 50)),
      p95Ms: roundMs(percentile(arr, 95)),
      maxMs: roundMs(arr[arr.length - 1] ?? 0),
    };
  }
  perQueryMax.sort((a, b) => b.maxMs - a.maxMs);
  const sum = allSamples.reduce((acc, v) => acc + v, 0);

  return {
    path: name,
    queries: BENCHMARK_QUERIES.length,
    samples: allSamples.length,
    p50Ms: roundMs(percentile(allSamples, 50)),
    p95Ms: roundMs(percentile(allSamples, 95)),
    maxMs: roundMs(allSamples[allSamples.length - 1] ?? 0),
    meanMs: roundMs(allSamples.length ? sum / allSamples.length : 0),
    byCategory,
    slowest: perQueryMax.slice(0, 5),
  };
}

async function main() {
  const rawDbPath = process.env.NIHON_DB_PATH?.trim();
  if (!rawDbPath) {
    console.error('Set NIHON_DB_PATH to a disposable copy of the SQLite database before running.');
    process.exit(1);
  }
  const dbPath = path.resolve(rawDbPath);
  if (!fs.existsSync(dbPath)) {
    console.error('Database file does not exist.');
    process.exit(1);
  }

  const db = openContentDatabase(dbPath);
  try {
    const counts = {
      vocab: Number(
        db.prepare("SELECT count(*) n FROM content_items WHERE kind='vocab' AND is_active=1").get()
          ?.n ?? 0,
      ),
      kanji: Number(
        db.prepare("SELECT count(*) n FROM content_items WHERE kind='kanji' AND is_active=1").get()
          ?.n ?? 0,
      ),
      grammar: Number(
        db
          .prepare("SELECT count(*) n FROM content_items WHERE kind='grammar' AND is_active=1")
          .get()?.n ?? 0,
      ),
      sentences: Number(
        db
          .prepare("SELECT count(*) n FROM content_items WHERE kind='sentence' AND is_active=1")
          .get()?.n ?? 0,
      ),
      selectedVi: Number(
        db
          .prepare(
            "SELECT count(*) n FROM vi_translations t JOIN content_items i USING(item_id) WHERE t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash AND i.is_active=1",
          )
          .get()?.n ?? 0,
      ),
    };

    const indexBuildStart = performance.now();
    const indexInfo = rebuildSearchIndex(db);
    const indexBuildMs = roundMs(performance.now() - indexBuildStart);

    const searchSummary = await measurePath('searchAllKinds (4 groups)', (query) => {
      const res = searchAllKinds(db, query.q, { dbFile: dbPath, youtubeFile: '' });
      return res.total;
    });

    const lookupSummary = await measurePath('lookupWord (direct)', (query) => {
      const res = lookupWord(db, query.q);
      return res.item ? 1 + res.alternatives.length : 0;
    });

    const unusedContextPath = path.join(path.dirname(dbPath), 'nonexistent-lookup-context.json');
    const handlerSummary = await measurePath('GET /api/common-tools/lookup (handler)', async (q) => {
      const req = new Request(
        `http://127.0.0.1:3000/api/common-tools/lookup?q=${encodeURIComponent(q.q)}`,
      );
      const res = await handleLookupGet(req, {
        isAuthenticated: async () => true,
        sameOriginCheck: () => true,
        readBody: async () => '',
        dbPath,
        contextPath: unusedContextPath,
      });
      const payload = (await res.json()) as { item: unknown; alternatives: unknown[] };
      return payload.item ? 1 + payload.alternatives.length : 0;
    });

    const results = [searchSummary, lookupSummary, handlerSummary];
    const allUnder200 = results.every((r) => r.p95Ms < 200);

    const report = {
      measuredAt: new Date().toISOString(),
      machine: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        cpu: os.cpus()[0]?.model ?? 'unknown',
        cores: os.cpus().length,
        memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
      },
      database: counts,
      fts5Index: {
        tokenizer: indexInfo.tokenizer,
        indexedCount: indexInfo.indexedCount,
        rebuilt: indexInfo.rebuilt,
        buildMs: indexBuildMs,
      },
      protocol: {
        queries: BENCHMARK_QUERIES.length,
        runsPerQuery: RUNS_PER_QUERY,
        droppedWarmupRuns: WARMUP_RUNS,
        measuredSamplesPerPath: BENCHMARK_QUERIES.length * (RUNS_PER_QUERY - WARMUP_RUNS),
      },
      thresholdMs: 200,
      allP95Under200Ms: allUnder200,
      results,
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    db.close();
  }
}

void main();
