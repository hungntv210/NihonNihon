import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { toHiragana } from 'wanakana';
import type { Translation } from './content.ts';

export const JMDICT_ITEM_PREFIX = 'jmdict:vocab:';
export const JMDICT_LEVEL_LABEL = 'Ngoài JLPT';

export const JMDICT_ATTRIBUTION = {
  sourceId: 'jmdict',
  name: 'JMdict',
  license: 'CC BY-SA 4.0',
  url: 'https://www.edrdg.org/edrdg/licence.html',
  attribution:
    'James William Breen and the Electronic Dictionary Research and Development Group (EDRDG)',
} as const;

export const TU_DIEN_VI_ATTRIBUTION = {
  sourceId: 'bunchaway-javi',
  name: 'tu-dien-nhat-viet',
  license: 'CC BY-SA 4.0',
  url: 'https://github.com/bunchaway/tu-dien-nhat-viet',
  attribution: 'Bunchaway (tu-dien-nhat-viet)',
} as const;

export type JmdictRecord = {
  id: string;
  entSeq: number;
  word: string;
  reading: string;
  romaji: string;
  kanjiForms: string[];
  readingForms: string[];
  meaningsEn: string[];
  pos: string[];
  meaningVi: string | null;
  viMatchForm: string | null;
  isCommon: boolean;
};

export type JmdictMeta = {
  schemaVersion: string;
  jmdictVersion: string;
  jmdictSha256: string;
  viSource: string;
  viSha256: string;
};

export type JmdictSearchOptions = {
  limit?: number;
  excludeWordReadings?: Set<string>;
  excludeJmdictIds?: Set<number>;
};

export type JmdictSearchResult = {
  total: number;
  items: JmdictRecord[];
  hasViSource: boolean;
};

const ZERO_SHA = '0'.repeat(64);
const SHA256_RE = /^[a-f0-9]{64}$/;
const FTS_TOKEN_SPLIT_RE = /[\s\p{P}\p{S}]+/gu;
const JAPANESE_CHAR_RE = /[\u3041-\u3096\u30A1-\u30FA\u30FC\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;

export function isJmdictItemId(itemId: string): boolean {
  return parseJmdictEntSeq(itemId) !== null;
}

export function parseJmdictEntSeq(itemId: string): number | null {
  if (typeof itemId !== 'string' || !itemId.startsWith(JMDICT_ITEM_PREFIX)) return null;
  const tail = itemId.slice(JMDICT_ITEM_PREFIX.length);
  if (!/^\d{7,10}$/.test(tail)) return null;
  const seq = Number.parseInt(tail, 10);
  return Number.isSafeInteger(seq) && seq >= 1_000_000 ? seq : null;
}

export function normalizeJmdictQuery(value: string): string {
  if (typeof value !== 'string') return '';
  return toHiragana(value.normalize('NFKC').toLowerCase(), { passRomaji: true })
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/gu, 'd')
    .normalize('NFC')
    .trim();
}

function resolveMainDbFile(db: DatabaseSync): string {
  try {
    const rows = db.prepare('PRAGMA database_list').all() as Array<{
      name?: unknown;
      file?: unknown;
    }>;
    const main = rows.find((row) => row.name === 'main');
    return typeof main?.file === 'string' ? main.file : '';
  } catch {
    return '';
  }
}

export function resolveJmdictDbPath(
  mainDbOrFile: DatabaseSync | string,
  explicitPath?: string,
): string {
  if (explicitPath !== undefined) {
    const trimmed = explicitPath.trim();
    return trimmed ? path.resolve(trimmed) : '';
  }
  if (process.env.NIHON_JMDICT_DB_PATH !== undefined) {
    const envPath = process.env.NIHON_JMDICT_DB_PATH.trim();
    return envPath ? path.resolve(envPath) : '';
  }
  const mainFile =
    typeof mainDbOrFile === 'string' ? mainDbOrFile : resolveMainDbFile(mainDbOrFile);
  if (!mainFile || mainFile === ':memory:') return '';
  return path.join(path.dirname(path.resolve(mainFile)), 'private', 'jmdict.sqlite');
}

function openJmdictReadOnly(jmdictPath: string): DatabaseSync | null {
  if (!jmdictPath) return null;
  const resolved = path.resolve(jmdictPath);
  if (!fs.existsSync(resolved)) return null;
  if (fs.lstatSync(resolved).isSymbolicLink()) {
    throw new Error('SYMLINK_FORBIDDEN');
  }
  const db = new DatabaseSync(resolved, { readOnly: true, timeout: 5000 });
  db.exec('PRAGMA query_only=ON;');
  return db;
}

function parseJsonStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
  } catch {
    return [];
  }
}

function hydrateRecord(row: Record<string, unknown>): JmdictRecord {
  const entSeq = Number(row.ent_seq);
  return {
    id: `${JMDICT_ITEM_PREFIX}${entSeq}`,
    entSeq,
    word: String(row.word),
    reading: String(row.reading),
    romaji: String(row.romaji ?? ''),
    kanjiForms: parseJsonStringArray(row.kanji_forms),
    readingForms: parseJsonStringArray(row.reading_forms),
    meaningsEn: parseJsonStringArray(row.meanings_en),
    pos: parseJsonStringArray(row.pos),
    meaningVi: row.meaning_vi == null ? null : String(row.meaning_vi),
    viMatchForm: row.vi_match_form == null ? null : String(row.vi_match_form),
    isCommon: Number(row.is_common ?? 0) === 1,
  };
}

function readMeta(db: DatabaseSync): JmdictMeta {
  const map = new Map<string, string>();
  try {
    const rows = db.prepare('SELECT key, value FROM jmdict_meta').all() as Array<{
      key?: unknown;
      value?: unknown;
    }>;
    for (const row of rows) {
      map.set(String(row.key), String(row.value));
    }
  } catch {
    // ignore missing meta
  }
  const rawJmdictSha = (map.get('jmdict_sha256') ?? '').toLowerCase();
  const rawViSha = (map.get('vi_sha256') ?? '').toLowerCase();
  return {
    schemaVersion: map.get('schema_version') ?? 'jmdict-v1',
    jmdictVersion: map.get('jmdict_version') ?? 'unknown',
    jmdictSha256: SHA256_RE.test(rawJmdictSha) ? rawJmdictSha : ZERO_SHA,
    viSource: map.get('vi_source') ?? '',
    viSha256: SHA256_RE.test(rawViSha) ? rawViSha : ZERO_SHA,
  };
}

export function jmdictMeaningTranslation(
  entry: JmdictRecord,
  meta?: JmdictMeta,
): Translation | null {
  if (!entry.meaningVi) return null;
  return {
    text: entry.meaningVi,
    sourceId: TU_DIEN_VI_ATTRIBUTION.sourceId,
    sourceName: TU_DIEN_VI_ATTRIBUTION.name,
    releaseId: `bunchaway-javi:${(meta?.viSha256 ?? ZERO_SHA).slice(0, 16)}`,
    method: 'dictionary',
    model: null,
    promptVersion: null,
    autoSelected: false,
  };
}

export function lookupJmdictExact(
  jmdictPath: string,
  terms: string[],
  limit = 6,
): { items: JmdictRecord[]; meta: JmdictMeta } | null {
  const db = openJmdictReadOnly(jmdictPath);
  if (!db) return null;
  try {
    const meta = readMeta(db);
    const stmt = db.prepare(
      `SELECT e.ent_seq, e.word, e.reading, e.romaji, e.kanji_forms, e.reading_forms,
              e.meanings_en, e.pos, e.meaning_vi, e.vi_match_form, e.is_common
       FROM jmdict_forms f
       JOIN jmdict_entries e ON e.ent_seq = f.ent_seq
       WHERE f.form_norm = ?
       ORDER BY f.priority ASC, e.is_common DESC, e.ent_seq ASC
       LIMIT ?`,
    );
    const seen = new Set<number>();
    const items: JmdictRecord[] = [];
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 20));

    for (const raw of terms) {
      if (typeof raw !== 'string' || raw.includes('\0')) continue;
      const norm = normalizeJmdictQuery(raw.slice(0, 160));
      if (!norm) continue;
      const rows = stmt.all(norm, safeLimit) as Record<string, unknown>[];
      for (const row of rows) {
        const seq = Number(row.ent_seq);
        if (seen.has(seq)) continue;
        seen.add(seq);
        items.push(hydrateRecord(row));
        if (items.length >= safeLimit) return { items, meta };
      }
    }
    return { items, meta };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function buildFtsMatchQuery(needle: string): string {
  const tokens = needle
    .split(FTS_TOKEN_SPLIT_RE)
    .map((t) => t.replaceAll('"', '').trim())
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (tokens.length === 0) return '';
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}

function isExcluded(record: JmdictRecord, options?: JmdictSearchOptions): boolean {
  if (options?.excludeJmdictIds?.has(record.entSeq)) return true;
  if (options?.excludeWordReadings?.size) {
    const pair = `${record.word}\u0000${record.reading}`;
    if (options.excludeWordReadings.has(pair)) return true;
  }
  return false;
}

export function searchJmdict(
  jmdictPath: string,
  rawQuery: string,
  options?: JmdictSearchOptions,
): JmdictSearchResult {
  if (typeof rawQuery !== 'string' || rawQuery.includes('\0')) {
    return { total: 0, items: [], hasViSource: false };
  }
  const needle = normalizeJmdictQuery(rawQuery.slice(0, 160));
  if (!needle) {
    return { total: 0, items: [], hasViSource: false };
  }
  const db = openJmdictReadOnly(jmdictPath);
  if (!db) {
    return { total: 0, items: [], hasViSource: false };
  }

  const limit = Math.max(1, Math.min(Math.trunc(options?.limit ?? 10), 50));

  try {
    const meta = readMeta(db);
    const hasViSource = Boolean(meta.viSource);
    const collected: JmdictRecord[] = [];
    const seen = new Set<number>();

    const addRows = (rows: Record<string, unknown>[], cap: number) => {
      for (const row of rows) {
        const record = hydrateRecord(row);
        if (seen.has(record.entSeq)) continue;
        seen.add(record.entSeq);
        if (isExcluded(record, options)) continue;
        collected.push(record);
        if (collected.length >= cap) break;
      }
    };

    // 1. Exact kanji/kana form match (O(log N) B-tree)
    const exactRows = db
      .prepare(
        `SELECT e.ent_seq, e.word, e.reading, e.romaji, e.kanji_forms, e.reading_forms,
                e.meanings_en, e.pos, e.meaning_vi, e.vi_match_form, e.is_common
         FROM jmdict_forms f
         JOIN jmdict_entries e ON e.ent_seq = f.ent_seq
         WHERE f.form_norm = ?
         ORDER BY f.priority ASC, e.is_common DESC, e.ent_seq ASC
         LIMIT ?`,
      )
      .all(needle, limit * 3) as Record<string, unknown>[];
    addRows(exactRows, limit);

    // 2. Prefix match on Japanese kanji/kana forms
    if (collected.length < limit && JAPANESE_CHAR_RE.test(needle)) {
      const prefixRows = db
        .prepare(
          `SELECT e.ent_seq, e.word, e.reading, e.romaji, e.kanji_forms, e.reading_forms,
                  e.meanings_en, e.pos, e.meaning_vi, e.vi_match_form, e.is_common
           FROM jmdict_forms f
           JOIN jmdict_entries e ON e.ent_seq = f.ent_seq
           WHERE f.form_norm >= ? AND f.form_norm < ?
           ORDER BY f.priority ASC, e.is_common DESC, length(f.form_norm) ASC, e.ent_seq ASC
           LIMIT ?`,
        )
        .all(needle, `${needle}\uFFFF`, limit * 4) as Record<string, unknown>[];
      addRows(prefixRows, limit);
    }

    // 3. FTS5 match on kanji, kana, romaji, and Vietnamese/English glosses
    const ftsQuery = buildFtsMatchQuery(needle);
    let ftsTotal = 0;
    if (ftsQuery) {
      const countRow = db
        .prepare('SELECT count(*) n FROM jmdict_fts WHERE jmdict_fts MATCH ?')
        .get(ftsQuery) as { n?: unknown } | undefined;
      ftsTotal = Number(countRow?.n ?? 0);

      if (collected.length < limit && ftsTotal > 0) {
        const ftsRows = db
          .prepare(
            `SELECT e.ent_seq, e.word, e.reading, e.romaji, e.kanji_forms, e.reading_forms,
                    e.meanings_en, e.pos, e.meaning_vi, e.vi_match_form, e.is_common
             FROM jmdict_fts f
             JOIN jmdict_entries e ON e.ent_seq = f.rowid
             WHERE jmdict_fts MATCH ?
             ORDER BY e.is_common DESC, bm25(jmdict_fts, 10.0, 8.0, 6.0, 2.0), e.ent_seq ASC
             LIMIT ?`,
          )
          .all(ftsQuery, limit * 4) as Record<string, unknown>[];
        addRows(ftsRows, limit);
      }
    }

    const total = Math.max(collected.length, ftsTotal);
    return {
      total,
      items: collected.slice(0, limit),
      hasViSource,
    };
  } catch {
    return { total: 0, items: [], hasViSource: false };
  } finally {
    db.close();
  }
}

export function getJmdictEntryById(
  jmdictPath: string,
  itemId: string,
): { entry: JmdictRecord; meta: JmdictMeta } | null {
  const entSeq = parseJmdictEntSeq(itemId);
  if (entSeq === null) return null;
  const db = openJmdictReadOnly(jmdictPath);
  if (!db) return null;
  try {
    const row = db
      .prepare(
        `SELECT ent_seq, word, reading, romaji, kanji_forms, reading_forms,
                meanings_en, pos, meaning_vi, vi_match_form, is_common
         FROM jmdict_entries WHERE ent_seq=?`,
      )
      .get(entSeq) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { entry: hydrateRecord(row), meta: readMeta(db) };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function materializeJmdictItem(
  appDb: DatabaseSync,
  itemId: string,
  jmdictPath: string,
  now = new Date(),
): boolean {
  const existing = appDb
    .prepare('SELECT 1 FROM content_items WHERE item_id=? AND is_active=1')
    .get(itemId);
  if (existing) return true;

  const found = getJmdictEntryById(jmdictPath, itemId);
  if (!found) return false;
  const { entry, meta } = found;
  const timestamp = now.toISOString();

  const jmdictReleaseId = `jmdict:${meta.jmdictVersion}:${meta.jmdictSha256.slice(0, 16)}`;
  const sourceHash = createHash('sha256')
    .update(
      JSON.stringify({
        entSeq: entry.entSeq,
        word: entry.word,
        reading: entry.reading,
        meaningsEn: entry.meaningsEn,
      }),
    )
    .digest('hex');

  appDb
    .prepare(
      `INSERT OR IGNORE INTO data_sources(
        source_id, name, url, license, version, checksum, attribution, usage_scope
      ) VALUES(?,?,?,?,?,?,?,?)`,
    )
    .run(
      JMDICT_ATTRIBUTION.sourceId,
      JMDICT_ATTRIBUTION.name,
      JMDICT_ATTRIBUTION.url,
      JMDICT_ATTRIBUTION.license,
      meta.jmdictVersion,
      meta.jmdictSha256,
      JMDICT_ATTRIBUTION.attribution,
      'redistributable',
    );

  appDb
    .prepare(
      `INSERT OR IGNORE INTO source_releases(
        release_id, source_id, version, checksum, artifact_url, retrieved_at, license, attribution, manifest_json
      ) VALUES(?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      jmdictReleaseId,
      JMDICT_ATTRIBUTION.sourceId,
      meta.jmdictVersion,
      meta.jmdictSha256,
      JMDICT_ATTRIBUTION.url,
      timestamp,
      JMDICT_ATTRIBUTION.license,
      JMDICT_ATTRIBUTION.attribution,
      JSON.stringify({ outside_jlpt: true, jmdict_version: meta.jmdictVersion }),
    );

  appDb
    .prepare(
      `INSERT OR IGNORE INTO content_items(
        item_id, kind, source_id, source_key, release_id, source_hash, field_sources, is_active
      ) VALUES(?,?,?,?,?,?,?,1)`,
    )
    .run(
      entry.id,
      'vocab',
      JMDICT_ATTRIBUTION.sourceId,
      String(entry.entSeq),
      jmdictReleaseId,
      sourceHash,
      JSON.stringify({ outside_jlpt: true, meanings_en: { source_id: 'jmdict' } }),
    );

  // vocab.level has CHECK(level IN ('N5','N4','N3','N2','N1')) in schema.draft.sql;
  // outside-JLPT status is tracked via content_items.source_id = 'jmdict' and field_sources.outside_jlpt.
  appDb
    .prepare(
      `INSERT OR IGNORE INTO vocab(
        item_id, word, reading, romaji, level, meanings_en, pos, jmdict_id
      ) VALUES(?,?,?,?,?,?,?,?)`,
    )
    .run(
      entry.id,
      entry.word,
      entry.reading,
      entry.romaji,
      'N1',
      JSON.stringify(entry.meaningsEn),
      JSON.stringify(entry.pos),
      entry.entSeq,
    );

  if (entry.meaningVi) {
    const viReleaseId = `bunchaway-javi:${meta.viSha256.slice(0, 16)}`;
    appDb
      .prepare(
        `INSERT OR IGNORE INTO data_sources(
          source_id, name, url, license, version, checksum, attribution, usage_scope
        ) VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        TU_DIEN_VI_ATTRIBUTION.sourceId,
        TU_DIEN_VI_ATTRIBUTION.name,
        TU_DIEN_VI_ATTRIBUTION.url,
        TU_DIEN_VI_ATTRIBUTION.license,
        'main',
        meta.viSha256,
        TU_DIEN_VI_ATTRIBUTION.attribution,
        'redistributable',
      );

    appDb
      .prepare(
        `INSERT OR IGNORE INTO source_releases(
          release_id, source_id, version, checksum, artifact_url, retrieved_at, license, attribution, manifest_json
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        viReleaseId,
        TU_DIEN_VI_ATTRIBUTION.sourceId,
        'main',
        meta.viSha256,
        TU_DIEN_VI_ATTRIBUTION.url,
        timestamp,
        TU_DIEN_VI_ATTRIBUTION.license,
        TU_DIEN_VI_ATTRIBUTION.attribution,
        JSON.stringify({ outside_jlpt: true }),
      );

    appDb
      .prepare(
        `INSERT OR IGNORE INTO vi_translations(
          translation_id, item_id, field, text_vi, method, source_id, release_id,
          source_record_key, base_content_hash, status, match_method, created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        `jmdict-vi:${entry.entSeq}`,
        entry.id,
        'meaning',
        entry.meaningVi,
        'dictionary',
        TU_DIEN_VI_ATTRIBUTION.sourceId,
        viReleaseId,
        entry.viMatchForm ?? entry.word,
        sourceHash,
        'selected',
        'jmdict_form',
        timestamp,
      );
  }

  return true;
}
