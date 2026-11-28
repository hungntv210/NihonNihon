import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { toHiragana, toRomaji } from 'wanakana';
import { databaseContentSupplement, reviewedVocabularyMeaning } from '../../../core/content-supplement.ts';

export const FTS5_TOKENIZER = 'trigram' as const;
const INDEX_VERSION = 'fts5-trigram-v2';
const FIELD_SEPARATOR = '\u001f';

export const GROUPED_CONTENT_KINDS = ['vocab', 'kanji', 'grammar'] as const;
export type GroupedContentKind = (typeof GROUPED_CONTENT_KINDS)[number];

export type SearchIndexOptions = {
  indexPath?: string;
  force?: boolean;
};

export type SearchIndexRow = {
  id: string;
  kind: string;
  title: string;
  reading: string;
  level: string;
  english: string;
  source: string;
};

export type GroupedSearchIndexResult = Record<
  GroupedContentKind,
  { total: number; rows: SearchIndexRow[] }
>;

export type RebuildResult = {
  indexPath: string;
  tokenizer: typeof FTS5_TOKENIZER;
  indexedCount: number;
  rebuilt: boolean;
  stamp: string;
};

type ConnectionState = {
  indexPath: string;
  totalChanges: number;
  stamp: string;
};

type MemoryIndexState = {
  indexDb: DatabaseSync;
  totalChanges: number;
  stamp: string;
  indexedCount: number;
};

const connectionStates = new WeakMap<DatabaseSync, ConnectionState>();
const memoryIndexes = new WeakMap<DatabaseSync, MemoryIndexState>();

export function normalize(value: string) {
  return toHiragana(value.normalize('NFC').toLowerCase(), { passRomaji: true })
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/gu, 'd')
    .normalize('NFC');
}

export const CONTENT_SQL = `SELECT i.item_id id,i.kind,v.word title,v.reading,v.romaji,v.level,v.meanings_en english,s.name source FROM content_items i JOIN vocab v USING(item_id) JOIN data_sources s ON s.source_id=i.source_id WHERE i.is_active=1 AND i.source_id<>'jmdict'
 UNION ALL SELECT i.item_id,i.kind,k.character,k.onyomi||' '||k.kunyomi,'',k.level,k.meanings_en,s.name FROM content_items i JOIN kanji k USING(item_id) JOIN data_sources s ON s.source_id=i.source_id WHERE i.is_active=1
 UNION ALL SELECT i.item_id,i.kind,g.pattern,coalesce(g.reading,''),g.romaji,g.level,json_array(g.meaning_en),s.name FROM content_items i JOIN grammar g USING(item_id) JOIN data_sources s ON s.source_id=i.source_id WHERE i.is_active=1`;

const TRANSLATIONS_SQL = `SELECT t.item_id, t.text_vi, t.field
  FROM vi_translations t
  JOIN content_items i ON i.item_id=t.item_id
  WHERE t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash
    AND i.is_active=1 AND i.kind IN ('vocab','kanji','grammar')`;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS search_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS search_items (
    rowid INTEGER PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    reading TEXT NOT NULL,
    level TEXT NOT NULL,
    english TEXT NOT NULL,
    source TEXT NOT NULL,
    search_text TEXT NOT NULL
  ) STRICT;
  CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
    search_text,
    content='search_items',
    content_rowid='rowid',
    tokenize='trigram case_sensitive 1'
  );
`;

export function resolveMainFile(db: DatabaseSync): string {
  const rows = db.prepare('PRAGMA database_list').all() as Array<{ name?: unknown; file?: unknown }>;
  const main = rows.find((row) => row.name === 'main');
  return typeof main?.file === 'string' ? main.file : '';
}

export function resolveSearchIndexPath(db: DatabaseSync, options?: SearchIndexOptions): string {
  if (options?.indexPath) {
    return options.indexPath === ':memory:' ? ':memory:' : path.resolve(options.indexPath);
  }
  const envPath = process.env.NIHON_SEARCH_FTS5_PATH?.trim();
  if (envPath) {
    return envPath === ':memory:' ? ':memory:' : path.resolve(envPath);
  }
  const mainFile = resolveMainFile(db);
  if (!mainFile) return ':memory:';
  return path.join(path.dirname(mainFile), 'private', `${path.basename(mainFile)}.search-fts5.sqlite`);
}

function readHeaderBytes(file: string, length: number): Buffer {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buf, 0, length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function computeFileStamp(mainFile: string, supplementStamp: string): string {
  if (!mainFile) return `${INDEX_VERSION}|memory`;
  const st = fs.statSync(mainFile, { bigint: true });
  const header = readHeaderBytes(mainFile, 48);
  const changeCounter = header.length >= 28 ? header.readUInt32BE(24) : 0;
  const schemaCookie = header.length >= 44 ? header.readUInt32BE(40) : 0;
  let walSig = 'nowal';
  const walFile = `${mainFile}-wal`;
  if (fs.existsSync(walFile)) {
    try {
      const wst = fs.statSync(walFile, { bigint: true });
      const wh = wst.size > 0n ? readHeaderBytes(walFile, 32).toString('hex') : '';
      walSig = `${wst.size}:${wst.mtimeNs}:${wh}`;
    } catch {
      walSig = 'wal-gone';
    }
  }
  return `${INDEX_VERSION}|${st.size}|${st.mtimeNs}|${changeCounter}|${schemaCookie}|${walSig}|${supplementStamp}`;
}

function connectionTotalChanges(db: DatabaseSync): { queryOnly: boolean; totalChanges: number } {
  const qoRow = db.prepare('PRAGMA query_only').get() as { query_only?: unknown } | undefined;
  const queryOnly = Number(qoRow?.query_only ?? 0) === 1;
  if (queryOnly) return { queryOnly: true, totalChanges: 0 };
  const row = db.prepare('SELECT total_changes() c').get() as { c?: unknown } | undefined;
  return { queryOnly: false, totalChanges: Number(row?.c ?? 0) };
}

function buildSearchText(values: string[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const n1 = normalize(raw);
    if (n1 && !seen.has(n1)) {
      seen.add(n1);
      parts.push(n1);
    }
    const n2 = normalize(toRomaji(raw));
    if (n2 && !seen.has(n2)) {
      seen.add(n2);
      parts.push(n2);
    }
  }
  return parts.join(FIELD_SEPARATOR);
}

function collectSourceRows(db: DatabaseSync) {
  const items = db
    .prepare(`WITH content AS (${CONTENT_SQL}) SELECT * FROM content ORDER BY level,kind,title,id`)
    .all();
  const trRows = db.prepare(TRANSLATIONS_SQL).all();
  const { items: supplement } = databaseContentSupplement(db);
  const corrections = new Map<string, string>();
  const activeVocabulary = db.prepare("SELECT source_hash FROM content_items WHERE item_id=? AND kind='vocab' AND is_active=1");
  for (const [id, entry] of supplement) {
    if (!entry.reviewedMeaning) continue;
    const reviewed = reviewedVocabularyMeaning(supplement, id, activeVocabulary.get(id)?.source_hash);
    if (reviewed) corrections.set(id, reviewed.text);
  }
  const translationsByItem = new Map<string, string[]>();
  for (const row of trRows) {
    const id = String(row.item_id);
    if (row.field === 'meaning' && corrections.has(id)) continue;
    let list = translationsByItem.get(id);
    if (!list) {
      list = [];
      translationsByItem.set(id, list);
    }
    list.push(String(row.text_vi));
  }
  return items.map((row) => {
    const id = String(row.id);
    const kind = String(row.kind);
    const title = String(row.title);
    const reading = String(row.reading);
    const romaji = String(row.romaji);
    const level = String(row.level);
    const english = String(row.english);
    const source = String(row.source);
    const searchText = buildSearchText([
      title,
      reading,
      romaji,
      english,
      corrections.get(id) ?? '',
      ...(translationsByItem.get(id) ?? []),
    ]);
    return { id, kind, title, reading, level, english, source, searchText };
  });
}

function populateIndexDatabase(
  indexDb: DatabaseSync,
  rows: ReturnType<typeof collectSourceRows>,
  stamp: string,
) {
  indexDb.exec(SCHEMA_SQL);
  indexDb.prepare('DELETE FROM search_items').run();
  const insertItem = indexDb.prepare(
    'INSERT INTO search_items(rowid,id,kind,title,reading,level,english,source,search_text) VALUES(?,?,?,?,?,?,?,?,?)',
  );
  let rowid = 1;
  for (const row of rows) {
    insertItem.run(
      rowid++,
      row.id,
      row.kind,
      row.title,
      row.reading,
      row.level,
      row.english,
      row.source,
      row.searchText,
    );
  }
  indexDb.exec("INSERT INTO search_fts(search_fts) VALUES('rebuild')");
  const upsertMeta = indexDb.prepare(
    'INSERT INTO search_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  );
  upsertMeta.run('version', INDEX_VERSION);
  upsertMeta.run('tokenizer', FTS5_TOKENIZER);
  upsertMeta.run('source_stamp', stamp);
  upsertMeta.run('indexed_count', String(rows.length));
}

function readMetaFromConnection(
  reader: DatabaseSync,
): { version: string; stamp: string; indexedCount: number } | null {
  try {
    const rows = reader.prepare('SELECT key, value FROM search_meta').all() as Array<{
      key: unknown;
      value: unknown;
    }>;
    const meta = new Map(rows.map((r) => [String(r.key), String(r.value)]));
    const version = meta.get('version') ?? '';
    const stamp = meta.get('source_stamp') ?? '';
    const indexedCount = Number(meta.get('indexed_count') ?? -1);
    if (version !== INDEX_VERSION || !stamp || !Number.isInteger(indexedCount) || indexedCount < 0) {
      return null;
    }
    return { version, stamp, indexedCount };
  } catch {
    return null;
  }
}

function readSidecarMeta(indexPath: string): { version: string; stamp: string; indexedCount: number } | null {
  if (!fs.existsSync(indexPath)) return null;
  if (fs.lstatSync(indexPath).isSymbolicLink()) throw new Error('SYMLINK_FORBIDDEN');
  let reader: DatabaseSync | undefined;
  try {
    reader = new DatabaseSync(indexPath, { readOnly: true, timeout: 5000 });
    return readMetaFromConnection(reader);
  } catch {
    return null;
  } finally {
    reader?.close();
  }
}

function cleanupFile(file: string) {
  for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
    try {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    } catch {}
  }
}

function rebuildMemoryIndex(
  db: DatabaseSync,
  stamp: string,
  totalChanges: number,
  force: boolean,
): { state: MemoryIndexState; rebuilt: boolean } {
  const existing = memoryIndexes.get(db);
  if (
    !force &&
    existing &&
    existing.stamp === stamp &&
    existing.totalChanges === totalChanges
  ) {
    return { state: existing, rebuilt: false };
  }
  const rows = collectSourceRows(db);
  const indexDb = existing?.indexDb ?? new DatabaseSync(':memory:');
  indexDb.exec('BEGIN IMMEDIATE');
  try {
    populateIndexDatabase(indexDb, rows, stamp);
    indexDb.exec('COMMIT');
  } catch (error) {
    try {
      indexDb.exec('ROLLBACK');
    } catch {}
    throw error;
  }
  const state: MemoryIndexState = {
    indexDb,
    totalChanges,
    stamp,
    indexedCount: rows.length,
  };
  memoryIndexes.set(db, state);
  return { state, rebuilt: true };
}

function buildNewFileAtomically(
  indexPath: string,
  rows: ReturnType<typeof collectSourceRows>,
  stamp: string,
) {
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const tmpFile = `${indexPath}.${process.pid}.${randomUUID()}.tmp`;
  let tmpDb: DatabaseSync | undefined;
  try {
    tmpDb = new DatabaseSync(tmpFile, { timeout: 5000 });
    tmpDb.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL; BEGIN IMMEDIATE;');
    populateIndexDatabase(tmpDb, rows, stamp);
    tmpDb.exec('COMMIT');
    tmpDb.close();
    tmpDb = undefined;
    fs.renameSync(tmpFile, indexPath);
  } finally {
    tmpDb?.close();
    cleanupFile(tmpFile);
  }
}

function rebuildInPlace(
  indexPath: string,
  db: DatabaseSync,
  stamp: string,
  force: boolean,
): { indexedCount: number; rebuilt: boolean } {
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  if (fs.existsSync(indexPath) && fs.lstatSync(indexPath).isSymbolicLink()) {
    throw new Error('SYMLINK_FORBIDDEN');
  }
  let writer: DatabaseSync | undefined;
  try {
    writer = new DatabaseSync(indexPath, { timeout: 5000 });
    writer.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL; BEGIN IMMEDIATE;');
    if (!force) {
      const existing = readMetaFromConnection(writer);
      if (existing && existing.stamp === stamp) {
        writer.exec('ROLLBACK');
        return { indexedCount: existing.indexedCount, rebuilt: false };
      }
    }
    const rows = collectSourceRows(db);
    populateIndexDatabase(writer, rows, stamp);
    writer.exec('COMMIT');
    return { indexedCount: rows.length, rebuilt: true };
  } catch (error) {
    try {
      writer?.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    writer?.close();
  }
}

function isReadOnlyFsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EACCES' || code === 'EROFS' || code === 'EPERM';
}

export function rebuildSearchIndex(db: DatabaseSync, options?: SearchIndexOptions): RebuildResult {
  const mainFile = resolveMainFile(db);
  const indexPath = resolveSearchIndexPath(db, options);
  const stamp = computeFileStamp(mainFile, databaseContentSupplement(db).stamp);
  const { queryOnly, totalChanges } = connectionTotalChanges(db);
  const prev = connectionStates.get(db);
  const connectionMutated =
    !queryOnly &&
    prev !== undefined &&
    (prev.totalChanges !== totalChanges || prev.indexPath !== indexPath || prev.stamp !== stamp);
  const force = Boolean(options?.force) || connectionMutated;

  if (indexPath === ':memory:') {
    const { state, rebuilt } = rebuildMemoryIndex(db, stamp, totalChanges, force);
    connectionStates.set(db, { indexPath, totalChanges, stamp });
    return {
      indexPath: ':memory:',
      tokenizer: FTS5_TOKENIZER,
      indexedCount: state.indexedCount,
      rebuilt,
      stamp,
    };
  }

  if (!force) {
    const existing = readSidecarMeta(indexPath);
    if (existing && existing.stamp === stamp) {
      connectionStates.set(db, { indexPath, totalChanges, stamp });
      return {
        indexPath,
        tokenizer: FTS5_TOKENIZER,
        indexedCount: existing.indexedCount,
        rebuilt: false,
        stamp,
      };
    }
  }

  try {
    if (!fs.existsSync(indexPath)) {
      const rows = collectSourceRows(db);
      try {
        buildNewFileAtomically(indexPath, rows, stamp);
        connectionStates.set(db, { indexPath, totalChanges, stamp });
        return {
          indexPath,
          tokenizer: FTS5_TOKENIZER,
          indexedCount: rows.length,
          rebuilt: true,
          stamp,
        };
      } catch (renameErr) {
        if (!fs.existsSync(indexPath)) throw renameErr;
      }
    }
    try {
      const res = rebuildInPlace(indexPath, db, stamp, force);
      connectionStates.set(db, { indexPath, totalChanges, stamp });
      return {
        indexPath,
        tokenizer: FTS5_TOKENIZER,
        indexedCount: res.indexedCount,
        rebuilt: res.rebuilt,
        stamp,
      };
    } catch (corruptErr) {
      if (isReadOnlyFsError(corruptErr)) throw corruptErr;
      cleanupFile(indexPath);
      const rows = collectSourceRows(db);
      buildNewFileAtomically(indexPath, rows, stamp);
      connectionStates.set(db, { indexPath, totalChanges, stamp });
      return {
        indexPath,
        tokenizer: FTS5_TOKENIZER,
        indexedCount: rows.length,
        rebuilt: true,
        stamp,
      };
    }
  } catch (error) {
    if (!isReadOnlyFsError(error)) throw error;
    const { state, rebuilt } = rebuildMemoryIndex(db, stamp, totalChanges, force);
    connectionStates.set(db, { indexPath: ':memory:', totalChanges, stamp });
    return {
      indexPath: ':memory:',
      tokenizer: FTS5_TOKENIZER,
      indexedCount: state.indexedCount,
      rebuilt,
      stamp,
    };
  }
}

function queryOpenIndex(
  indexDb: DatabaseSync,
  needle: string,
  limit: number,
  offset: number,
): { total: number; rows: SearchIndexRow[] } {
  if (!needle) {
    const total = Number(indexDb.prepare('SELECT count(*) n FROM search_items').get()!.n);
    const rows = indexDb
      .prepare('SELECT id,kind,title,reading,level,english,source FROM search_items ORDER BY rowid LIMIT ? OFFSET ?')
      .all(limit, offset) as SearchIndexRow[];
    return { total, rows };
  }

  if (needle.includes(FIELD_SEPARATOR)) {
    return { total: 0, rows: [] };
  }

  if (Array.from(needle).length >= 3 && !needle.includes('\0')) {
    const phrase = `"${needle.replaceAll('"', '""')}"`;
    const total = Number(
      indexDb
        .prepare(
          'SELECT count(*) n FROM search_fts f JOIN search_items i ON i.rowid=f.rowid WHERE f.search_text MATCH ? AND instr(i.search_text, ?)>0',
        )
        .get(phrase, needle)!.n,
    );
    const rows = indexDb
      .prepare(
        'SELECT i.id,i.kind,i.title,i.reading,i.level,i.english,i.source FROM search_fts f JOIN search_items i ON i.rowid=f.rowid WHERE f.search_text MATCH ? AND instr(i.search_text, ?)>0 ORDER BY i.rowid LIMIT ? OFFSET ?',
      )
      .all(phrase, needle, limit, offset) as SearchIndexRow[];
    return { total, rows };
  }

  const total = Number(
    indexDb
      .prepare('SELECT count(*) n FROM search_items WHERE instr(search_text, ?)>0')
      .get(needle)!.n,
  );
  const rows = indexDb
    .prepare(
      'SELECT id,kind,title,reading,level,english,source FROM search_items WHERE instr(search_text, ?)>0 ORDER BY rowid LIMIT ? OFFSET ?',
    )
    .all(needle, limit, offset) as SearchIndexRow[];
  return { total, rows };
}

function emptyGroupedResult(): GroupedSearchIndexResult {
  return {
    vocab: { total: 0, rows: [] },
    kanji: { total: 0, rows: [] },
    grammar: { total: 0, rows: [] },
  };
}

function queryOpenIndexGrouped(
  indexDb: DatabaseSync,
  needle: string,
  limitPerKind: number,
): GroupedSearchIndexResult {
  const limit = Math.max(0, Math.min(Math.trunc(limitPerKind), 100));
  const result = emptyGroupedResult();
  if (needle.includes(FIELD_SEPARATOR)) {
    return result;
  }

  const applyCounts = (rows: Array<{ kind?: unknown; n?: unknown }>) => {
    for (const row of rows) {
      const kind = String(row.kind);
      if (kind === 'vocab' || kind === 'kanji' || kind === 'grammar') {
        result[kind].total = Number(row.n ?? 0);
      }
    }
  };

  if (!needle) {
    applyCounts(
      indexDb.prepare('SELECT kind, count(*) n FROM search_items GROUP BY kind').all() as Array<{
        kind?: unknown;
        n?: unknown;
      }>,
    );
    if (limit > 0) {
      const stmt = indexDb.prepare(
        'SELECT id,kind,title,reading,level,english,source FROM search_items WHERE kind=? ORDER BY rowid LIMIT ?',
      );
      for (const kind of GROUPED_CONTENT_KINDS) {
        if (result[kind].total > 0) {
          result[kind].rows = stmt.all(kind, limit) as SearchIndexRow[];
        }
      }
    }
    return result;
  }

  if (Array.from(needle).length >= 3 && !needle.includes('\0')) {
    const phrase = `"${needle.replaceAll('"', '""')}"`;
    applyCounts(
      indexDb
        .prepare(
          'SELECT i.kind, count(*) n FROM search_fts f JOIN search_items i ON i.rowid=f.rowid WHERE f.search_text MATCH ? AND instr(i.search_text, ?)>0 GROUP BY i.kind',
        )
        .all(phrase, needle) as Array<{ kind?: unknown; n?: unknown }>,
    );
    if (limit > 0) {
      const stmt = indexDb.prepare(
        'SELECT i.id,i.kind,i.title,i.reading,i.level,i.english,i.source FROM search_fts f JOIN search_items i ON i.rowid=f.rowid WHERE f.search_text MATCH ? AND instr(i.search_text, ?)>0 AND i.kind=? ORDER BY i.rowid LIMIT ?',
      );
      for (const kind of GROUPED_CONTENT_KINDS) {
        if (result[kind].total > 0) {
          result[kind].rows = stmt.all(phrase, needle, kind, limit) as SearchIndexRow[];
        }
      }
    }
    return result;
  }

  applyCounts(
    indexDb
      .prepare('SELECT kind, count(*) n FROM search_items WHERE instr(search_text, ?)>0 GROUP BY kind')
      .all(needle) as Array<{ kind?: unknown; n?: unknown }>,
  );
  if (limit > 0) {
    const stmt = indexDb.prepare(
      'SELECT id,kind,title,reading,level,english,source FROM search_items WHERE instr(search_text, ?)>0 AND kind=? ORDER BY rowid LIMIT ?',
    );
    for (const kind of GROUPED_CONTENT_KINDS) {
      if (result[kind].total > 0) {
        result[kind].rows = stmt.all(needle, kind, limit) as SearchIndexRow[];
      }
    }
  }
  return result;
}

function withOpenSearchIndex<T>(
  db: DatabaseSync,
  options: SearchIndexOptions | undefined,
  run: (indexDb: DatabaseSync) => T,
): T {
  const mainFile = resolveMainFile(db);
  const indexPath = resolveSearchIndexPath(db, options);
  const stamp = computeFileStamp(mainFile, databaseContentSupplement(db).stamp);
  const { queryOnly, totalChanges } = connectionTotalChanges(db);
  const prev = connectionStates.get(db);
  const connectionMutated =
    !queryOnly &&
    prev !== undefined &&
    (prev.totalChanges !== totalChanges || prev.indexPath !== indexPath || prev.stamp !== stamp);

  // Fast warm path: single read-only open when sidecar exists and stamp matches.
  if (indexPath !== ':memory:' && !options?.force && !connectionMutated && fs.existsSync(indexPath)) {
    if (fs.lstatSync(indexPath).isSymbolicLink()) throw new Error('SYMLINK_FORBIDDEN');
    let reader: DatabaseSync | undefined;
    try {
      reader = new DatabaseSync(indexPath, { readOnly: true, timeout: 5000 });
      const meta = readMetaFromConnection(reader);
      if (meta && meta.stamp === stamp) {
        connectionStates.set(db, { indexPath, totalChanges, stamp });
        return run(reader);
      }
    } catch {
      // Fall through to rebuild below if sidecar is corrupt or locked.
    } finally {
      reader?.close();
    }
  }

  const status = rebuildSearchIndex(db, options);
  if (status.indexPath === ':memory:') {
    const mem = memoryIndexes.get(db);
    if (!mem) throw new Error('SEARCH_FTS5_UNAVAILABLE');
    return run(mem.indexDb);
  }
  const reader = new DatabaseSync(status.indexPath, { readOnly: true, timeout: 5000 });
  try {
    return run(reader);
  } finally {
    reader.close();
  }
}

export function querySearchIndex(
  db: DatabaseSync,
  needle: string,
  limit: number,
  offset: number,
  options?: SearchIndexOptions,
): { total: number; rows: SearchIndexRow[] } {
  return withOpenSearchIndex(db, options, (indexDb) => queryOpenIndex(indexDb, needle, limit, offset));
}

export function querySearchIndexGrouped(
  db: DatabaseSync,
  needle: string,
  limitPerKind = 10,
  options?: SearchIndexOptions,
): GroupedSearchIndexResult {
  return withOpenSearchIndex(db, options, (indexDb) =>
    queryOpenIndexGrouped(indexDb, needle, limitPerKind),
  );
}
