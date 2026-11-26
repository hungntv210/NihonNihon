// Import EDRDG JMdict_e (XML/gz) or jmdict-simplified (JSON/gz) + optional Bunchaway tu-dien-nhat-viet CSV
// into a standalone SQLite database with FTS5 index (default: data/private/jmdict.sqlite).
// Never modifies demo.sqlite or openjlpt tables.
//
// Usage:
//   node tools/import-jmdict.mjs --jmdict <file> [--vi <csv>] [--target <sqlite>] [--jmdict-sha256 <hex>] [--vi-sha256 <hex>] [--dry-run]
//   node tools/import-jmdict.mjs --download [--raw-dir data/private/jmdict] [--target data/private/jmdict.sqlite] [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { toHiragana, toRomaji } from 'wanakana';

export const JMDICT_SCHEMA_VERSION = 'jmdict-v1';
export const DEFAULT_JMDICT_URL = 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz';
export const DEFAULT_VI_URL =
  'https://raw.githubusercontent.com/bunchaway/tu-dien-nhat-viet/6b1e9248c5382949115ccf1f5e8846d0fc85d6ad/final.csv';
export const DEFAULT_VI_COMMIT = '6b1e9248c5382949115ccf1f5e8846d0fc85d6ad';

const COMMON_PRIORITY_RE = /^(?:news1|ichi1|spec1|gai1|nf(?:0\d|1\d|20))$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

export function normalizeLookupText(value) {
  return toHiragana(String(value ?? '').normalize('NFKC').toLowerCase(), { passRomaji: true })
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/gu, 'd')
    .normalize('NFC')
    .trim();
}

export function sha256File(filePath) {
  const hash = createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(1024 * 1024);
    let read = 0;
    while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, read));
    }
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function readTextMaybeGzip(filePath) {
  const raw = fs.readFileSync(filePath);
  const isGzip = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;
  return (isGzip ? zlib.gunzipSync(raw) : raw).toString('utf8');
}

function decodeXmlEntities(text, entityMap) {
  if (!text.includes('&')) return text;
  return text.replace(/&([a-zA-Z0-9#._-]+);/g, (full, name) => {
    if (name === 'amp') return '&';
    if (name === 'lt') return '<';
    if (name === 'gt') return '>';
    if (name === 'quot') return '"';
    if (name === 'apos') return "'";
    if (name.startsWith('#x') || name.startsWith('#X')) {
      const cp = Number.parseInt(name.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : full;
    }
    if (name.startsWith('#')) {
      const cp = Number.parseInt(name.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : full;
    }
    return entityMap?.get(name) ?? name;
  });
}

function extractTagTexts(block, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'g');
  const results = [];
  let match;
  while ((match = re.exec(block)) !== null) {
    results.push(match[1]);
  }
  return results;
}

export function parseJmdictXml(xmlText) {
  const dateMatch = /<!--\s*JMdict created:\s*(\d{4}-\d{2}-\d{2})\s*-->/.exec(
    xmlText.slice(0, 64_000),
  );
  const version = dateMatch ? dateMatch[1] : 'xml-unknown';

  const entityMap = new Map();
  const doctypeEnd = xmlText.indexOf('<JMdict>');
  const headerSlice = doctypeEnd > 0 ? xmlText.slice(0, doctypeEnd) : xmlText.slice(0, 64_000);
  const entityRe = /<!ENTITY\s+([a-zA-Z0-9._-]+)\s+"([^"]*)">/g;
  let entMatch;
  while ((entMatch = entityRe.exec(headerSlice)) !== null) {
    entityMap.set(entMatch[1], entMatch[2]);
  }

  const entries = [];
  let cursor = doctypeEnd >= 0 ? doctypeEnd : 0;

  while (true) {
    const start = xmlText.indexOf('<entry>', cursor);
    if (start === -1) break;
    const end = xmlText.indexOf('</entry>', start);
    if (end === -1) break;
    cursor = end + 8;

    const block = xmlText.slice(start + 7, end);
    const seqMatch = /<ent_seq>(\d+)<\/ent_seq>/.exec(block);
    if (!seqMatch) continue;
    const entSeq = Number.parseInt(seqMatch[1], 10);
    if (!Number.isSafeInteger(entSeq) || entSeq < 1_000_000) continue;

    const kanjiForms = [];
    const readingForms = [];
    let isCommon = false;

    for (const rawKeb of extractTagTexts(block, 'keb')) {
      const keb = decodeXmlEntities(rawKeb, entityMap).normalize('NFC').trim();
      if (keb && !kanjiForms.includes(keb)) kanjiForms.push(keb);
    }
    for (const rawReb of extractTagTexts(block, 'reb')) {
      const reb = decodeXmlEntities(rawReb, entityMap).normalize('NFC').trim();
      if (reb && !readingForms.includes(reb)) readingForms.push(reb);
    }
    if (readingForms.length === 0) continue;

    for (const pri of [
      ...extractTagTexts(block, 'ke_pri'),
      ...extractTagTexts(block, 're_pri'),
    ]) {
      if (COMMON_PRIORITY_RE.test(pri.trim())) {
        isCommon = true;
        break;
      }
    }

    const posSet = new Set();
    const meaningsEn = [];
    const meaningSeen = new Set();
    let usuallyKana = false;

    const senseBlocks = extractTagTexts(block, 'sense');
    for (const sense of senseBlocks) {
      if (sense.includes('&uk;')) usuallyKana = true;
      for (const rawPos of extractTagTexts(sense, 'pos')) {
        const cleaned = rawPos.trim().replace(/^&|;$/g, '');
        if (cleaned) posSet.add(cleaned);
      }
      const glossRe = /<gloss(?:\s+([^>]*))?>([\s\S]*?)<\/gloss>/g;
      let gm;
      while ((gm = glossRe.exec(sense)) !== null) {
        const attrs = gm[1] ?? '';
        if (/xml:lang="(?!eng")/.test(attrs)) continue;
        const text = decodeXmlEntities(gm[2], entityMap).normalize('NFC').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (meaningSeen.has(key)) continue;
        meaningSeen.add(key);
        if (meaningsEn.length < 12) meaningsEn.push(text);
      }
    }

    if (meaningsEn.length === 0) continue;

    const word = kanjiForms[0] ?? readingForms[0];
    const reading = readingForms[0];
    const romaji = toRomaji(reading).normalize('NFC').trim();

    entries.push({
      entSeq,
      word,
      reading,
      romaji,
      kanjiForms,
      readingForms,
      meaningsEn,
      pos: [...posSet].slice(0, 8),
      isCommon,
      usuallyKana,
    });
  }

  return { version, entries };
}

export function parseJmdictSimplifiedJson(jsonText) {
  const parsed = JSON.parse(jsonText);
  const words = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray(parsed.words)
      ? parsed.words
      : null;
  if (!words) {
    throw new Error('INVALID_JMDICT_JSON');
  }
  const version =
    typeof parsed?.dictDate === 'string' && parsed.dictDate
      ? parsed.dictDate
      : typeof parsed?.version === 'string' && parsed.version
        ? parsed.version
        : 'json-unknown';

  const entries = [];
  for (const item of words) {
    if (!item || typeof item !== 'object') continue;
    const entSeq = Number.parseInt(String(item.id ?? item.entSeq ?? ''), 10);
    if (!Number.isSafeInteger(entSeq) || entSeq < 1_000_000) continue;

    const kanjiForms = [];
    const readingForms = [];
    let isCommon = false;

    if (Array.isArray(item.kanji)) {
      for (const k of item.kanji) {
        const text = typeof k === 'string' ? k : typeof k?.text === 'string' ? k.text : '';
        const cleaned = text.normalize('NFC').trim();
        if (cleaned && !kanjiForms.includes(cleaned)) kanjiForms.push(cleaned);
        if (k && typeof k === 'object' && k.common) isCommon = true;
      }
    }
    if (Array.isArray(item.kana)) {
      for (const r of item.kana) {
        const text = typeof r === 'string' ? r : typeof r?.text === 'string' ? r.text : '';
        const cleaned = text.normalize('NFC').trim();
        if (cleaned && !readingForms.includes(cleaned)) readingForms.push(cleaned);
        if (r && typeof r === 'object' && r.common) isCommon = true;
      }
    }
    if (readingForms.length === 0) continue;

    const posSet = new Set();
    const meaningsEn = [];
    const meaningSeen = new Set();
    let usuallyKana = false;

    const senses = Array.isArray(item.sense) ? item.sense : [];
    for (const s of senses) {
      if (!s || typeof s !== 'object') continue;
      if (Array.isArray(s.misc) && s.misc.includes('uk')) usuallyKana = true;
      if (Array.isArray(s.partOfSpeech)) {
        for (const p of s.partOfSpeech) {
          if (typeof p === 'string' && p.trim()) posSet.add(p.trim());
        }
      }
      if (Array.isArray(s.gloss)) {
        for (const g of s.gloss) {
          if (typeof g === 'string') {
            const text = g.normalize('NFC').trim();
            if (text && !meaningSeen.has(text.toLowerCase()) && meaningsEn.length < 12) {
              meaningSeen.add(text.toLowerCase());
              meaningsEn.push(text);
            }
          } else if (g && typeof g === 'object' && typeof g.text === 'string') {
            if (g.lang && g.lang !== 'eng') continue;
            const text = g.text.normalize('NFC').trim();
            if (text && !meaningSeen.has(text.toLowerCase()) && meaningsEn.length < 12) {
              meaningSeen.add(text.toLowerCase());
              meaningsEn.push(text);
            }
          }
        }
      }
    }

    if (meaningsEn.length === 0) continue;

    const word = kanjiForms[0] ?? readingForms[0];
    const reading = readingForms[0];
    const romaji = toRomaji(reading).normalize('NFC').trim();

    entries.push({
      entSeq,
      word,
      reading,
      romaji,
      kanjiForms,
      readingForms,
      meaningsEn,
      pos: [...posSet].slice(0, 8),
      isCommon,
      usuallyKana,
    });
  }

  return { version, entries };
}

function cleanVietnameseMeaning(raw) {
  const compact = String(raw ?? '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return '';
  return compact.length > 360 ? `${compact.slice(0, 357).trimEnd()}…` : compact;
}

// RFC 4180 two-column CSV parser supporting quoted fields and embedded newlines.
export function parseTuDienNhatVietCsv(csvText) {
  const map = new Map();
  const len = csvText.length;
  let i = len > 0 && csvText.charCodeAt(0) === 0xfeff ? 1 : 0;

  function readField() {
    if (i < len && csvText[i] === '"') {
      i++;
      let out = '';
      while (i < len) {
        const ch = csvText[i];
        if (ch === '"') {
          if (i + 1 < len && csvText[i + 1] === '"') {
            out += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          out += ch;
          i++;
        }
      }
      return out;
    }
    const start = i;
    while (i < len && csvText[i] !== ',' && csvText[i] !== '\n' && csvText[i] !== '\r') {
      i++;
    }
    return csvText.slice(start, i);
  }

  while (i < len) {
    const col1 = readField();
    let col2 = '';
    if (i < len && csvText[i] === ',') {
      i++;
      col2 = readField();
      while (i < len && csvText[i] !== '\n' && csvText[i] !== '\r') {
        if (csvText[i] === ',') {
          i++;
          readField();
        } else {
          i++;
        }
      }
    }
    if (i < len && csvText[i] === '\r') i++;
    if (i < len && csvText[i] === '\n') i++;

    const headword = col1.normalize('NFC').trim();
    if (!headword || headword.toLowerCase() === 'word') continue;
    const meaning = cleanVietnameseMeaning(col2);
    if (!meaning) continue;
    if (!map.has(headword)) {
      map.set(headword, meaning);
    }
  }

  return map;
}

export function matchVietnameseMeaning(entry, viMap) {
  if (!viMap || viMap.size === 0) return null;
  for (const keb of entry.kanjiForms) {
    const hit = viMap.get(keb);
    if (hit) return { text: hit, form: keb };
  }
  if (entry.kanjiForms.length === 0 || entry.usuallyKana) {
    for (const reb of entry.readingForms) {
      const hit = viMap.get(reb);
      if (hit) return { text: hit, form: reb };
    }
  }
  return null;
}

export function assertSafeTargetPath(targetPath) {
  const resolved = path.resolve(targetPath);
  const baseName = path.basename(resolved).toLowerCase();
  if (baseName === 'demo.sqlite') {
    throw new Error('REFUSING_TO_OVERWRITE_APP_DB');
  }
  const envDb = process.env.NIHON_DB_PATH?.trim();
  if (envDb && path.resolve(envDb).toLowerCase() === resolved.toLowerCase()) {
    throw new Error('REFUSING_TO_OVERWRITE_APP_DB');
  }
  if (fs.existsSync(resolved)) {
    if (fs.lstatSync(resolved).isSymbolicLink()) {
      throw new Error('SYMLINK_FORBIDDEN');
    }
    const probe = new DatabaseSync(resolved, { readOnly: true, timeout: 5000 });
    try {
      const hasOpenJlptVocab = probe
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='vocab'")
        .get();
      if (hasOpenJlptVocab) {
        throw new Error('REFUSING_TO_OVERWRITE_APP_DB');
      }
    } finally {
      probe.close();
    }
  }
  return resolved;
}

const JMDICT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS jmdict_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS jmdict_entries (
    ent_seq INTEGER PRIMARY KEY,
    word TEXT NOT NULL,
    reading TEXT NOT NULL,
    romaji TEXT NOT NULL,
    kanji_forms TEXT NOT NULL,
    reading_forms TEXT NOT NULL,
    meanings_en TEXT NOT NULL,
    pos TEXT NOT NULL,
    meaning_vi TEXT,
    vi_match_form TEXT,
    is_common INTEGER NOT NULL DEFAULT 0
  ) STRICT;

  CREATE TABLE IF NOT EXISTS jmdict_forms (
    form_norm TEXT NOT NULL,
    form_kind TEXT NOT NULL CHECK(form_kind IN ('kanji', 'reading')),
    ent_seq INTEGER NOT NULL REFERENCES jmdict_entries(ent_seq) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(form_norm, form_kind, ent_seq)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_jmdict_forms_lookup
    ON jmdict_forms(form_norm, priority, ent_seq);

  CREATE VIRTUAL TABLE IF NOT EXISTS jmdict_fts USING fts5(
    kanji_text,
    kana_text,
    romaji_text,
    meaning_text,
    tokenize='unicode61 remove_diacritics 2'
  );
`;

async function downloadFile(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DOWNLOAD_FAILED_${response.status}:${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const tmp = `${destPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, destPath);
  return sha256File(destPath);
}

export function importJmdict(options) {
  const jmdictFile = path.resolve(options.jmdictPath);
  if (!fs.existsSync(jmdictFile)) {
    throw new Error(`JMDICT_FILE_NOT_FOUND:${jmdictFile}`);
  }
  const jmdictSha256 = sha256File(jmdictFile);
  if (options.expectedJmdictSha256) {
    const expected = options.expectedJmdictSha256.trim().toLowerCase();
    if (!SHA256_RE.test(expected) || jmdictSha256 !== expected) {
      throw new Error(`JMDICT_SHA256_MISMATCH:expected=${expected},actual=${jmdictSha256}`);
    }
  }

  let viMap = new Map();
  let viSha256 = '';
  let viSource = '';
  if (options.viPath) {
    const viFile = path.resolve(options.viPath);
    if (!fs.existsSync(viFile)) {
      throw new Error(`VI_FILE_NOT_FOUND:${viFile}`);
    }
    viSha256 = sha256File(viFile);
    if (options.expectedViSha256) {
      const expected = options.expectedViSha256.trim().toLowerCase();
      if (!SHA256_RE.test(expected) || viSha256 !== expected) {
        throw new Error(`VI_SHA256_MISMATCH:expected=${expected},actual=${viSha256}`);
      }
    }
    viMap = parseTuDienNhatVietCsv(readTextMaybeGzip(viFile));
    viSource = 'bunchaway-javi';
  }

  const rawText = readTextMaybeGzip(jmdictFile);
  const trimmed = rawText.trimStart();
  const parsed =
    trimmed.startsWith('{') || trimmed.startsWith('[')
      ? parseJmdictSimplifiedJson(rawText)
      : parseJmdictXml(rawText);

  if (parsed.entries.length === 0) {
    throw new Error('NO_JMDICT_ENTRIES_PARSED');
  }

  let viMatchedCount = 0;
  const preparedEntries = parsed.entries.map((entry) => {
    const viHit = matchVietnameseMeaning(entry, viMap);
    if (viHit) viMatchedCount++;
    return {
      ...entry,
      meaningVi: viHit ? viHit.text : null,
      viMatchForm: viHit ? viHit.form : null,
    };
  });

  const targetPath = options.dryRun ? '' : assertSafeTargetPath(options.targetPath);

  if (options.dryRun) {
    return {
      mode: 'dry-run',
      version: parsed.version,
      jmdictSha256,
      viSource,
      viSha256,
      viDictionarySize: viMap.size,
      parsedEntries: preparedEntries.length,
      viMatchedCount,
      inserted: 0,
      updated: 0,
      totalEntries: preparedEntries.length,
    };
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const db = new DatabaseSync(targetPath, { timeout: 10000 });
  let inserted = 0;
  let updated = 0;
  let totalEntries = 0;

  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;');
    db.exec(JMDICT_SCHEMA_SQL);

    const existingRows = db.prepare('SELECT ent_seq FROM jmdict_entries').all();
    const existingSet = new Set(existingRows.map((r) => Number(r.ent_seq)));

    const upsertEntry = db.prepare(`
      INSERT INTO jmdict_entries(
        ent_seq, word, reading, romaji, kanji_forms, reading_forms,
        meanings_en, pos, meaning_vi, vi_match_form, is_common
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(ent_seq) DO UPDATE SET
        word=excluded.word,
        reading=excluded.reading,
        romaji=excluded.romaji,
        kanji_forms=excluded.kanji_forms,
        reading_forms=excluded.reading_forms,
        meanings_en=excluded.meanings_en,
        pos=excluded.pos,
        meaning_vi=excluded.meaning_vi,
        vi_match_form=excluded.vi_match_form,
        is_common=excluded.is_common
    `);
    const deleteForms = db.prepare('DELETE FROM jmdict_forms WHERE ent_seq=?');
    const insertForm = db.prepare(
      'INSERT OR IGNORE INTO jmdict_forms(form_norm, form_kind, ent_seq, priority) VALUES(?,?,?,?)',
    );
    const deleteFts = db.prepare('DELETE FROM jmdict_fts WHERE rowid=?');
    const insertFts = db.prepare(
      'INSERT INTO jmdict_fts(rowid, kanji_text, kana_text, romaji_text, meaning_text) VALUES(?,?,?,?,?)',
    );
    const upsertMeta = db.prepare(
      'INSERT INTO jmdict_meta(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    );

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of preparedEntries) {
        const alreadyExists = existingSet.has(entry.entSeq);
        upsertEntry.run(
          entry.entSeq,
          entry.word,
          entry.reading,
          entry.romaji,
          JSON.stringify(entry.kanjiForms),
          JSON.stringify(entry.readingForms),
          JSON.stringify(entry.meaningsEn),
          JSON.stringify(entry.pos),
          entry.meaningVi,
          entry.viMatchForm,
          entry.isCommon ? 1 : 0,
        );
        if (alreadyExists) {
          updated++;
          deleteForms.run(entry.entSeq);
          deleteFts.run(entry.entSeq);
        } else {
          inserted++;
          existingSet.add(entry.entSeq);
        }

        const kanjiNorms = [];
        for (let idx = 0; idx < entry.kanjiForms.length; idx++) {
          const norm = normalizeLookupText(entry.kanjiForms[idx]);
          if (!norm) continue;
          kanjiNorms.push(norm);
          const priority = idx === 0 ? (entry.isCommon ? 0 : 1) : entry.isCommon ? 4 : 5;
          insertForm.run(norm, 'kanji', entry.entSeq, priority);
        }

        const kanaNorms = [];
        const romajiNorms = [];
        for (let idx = 0; idx < entry.readingForms.length; idx++) {
          const rawReading = entry.readingForms[idx];
          const norm = normalizeLookupText(rawReading);
          if (norm) {
            kanaNorms.push(norm);
            const priority = idx === 0 ? (entry.isCommon ? 2 : 3) : entry.isCommon ? 4 : 5;
            insertForm.run(norm, 'reading', entry.entSeq, priority);
          }
          const rom = normalizeLookupText(toRomaji(rawReading));
          if (rom && !romajiNorms.includes(rom)) romajiNorms.push(rom);
        }

        const meaningParts = [];
        if (entry.meaningVi) {
          const normVi = normalizeLookupText(entry.meaningVi);
          if (normVi) meaningParts.push(normVi);
        }
        for (const gloss of entry.meaningsEn) {
          const normEn = normalizeLookupText(gloss);
          if (normEn) meaningParts.push(normEn);
        }

        insertFts.run(
          entry.entSeq,
          kanjiNorms.join(' '),
          kanaNorms.join(' '),
          romajiNorms.join(' '),
          meaningParts.join(' '),
        );
      }

      totalEntries = Number(db.prepare('SELECT count(*) n FROM jmdict_entries').get().n);
      const totalViMatched = Number(
        db.prepare('SELECT count(*) n FROM jmdict_entries WHERE meaning_vi IS NOT NULL').get().n,
      );

      upsertMeta.run('schema_version', JMDICT_SCHEMA_VERSION);
      upsertMeta.run('jmdict_version', parsed.version);
      upsertMeta.run('jmdict_sha256', jmdictSha256);
      upsertMeta.run('jmdict_license', 'CC BY-SA 4.0');
      upsertMeta.run(
        'jmdict_attribution',
        'James William Breen and the Electronic Dictionary Research and Development Group (EDRDG)',
      );
      upsertMeta.run('jmdict_url', 'https://www.edrdg.org/jmdict/j_jmdict.html');
      upsertMeta.run('vi_source', viSource);
      upsertMeta.run('vi_sha256', viSha256);
      upsertMeta.run('vi_license', viSource ? 'CC BY-SA 4.0' : '');
      upsertMeta.run('vi_attribution', viSource ? 'Bunchaway (tu-dien-nhat-viet)' : '');
      upsertMeta.run(
        'vi_url',
        viSource ? 'https://github.com/bunchaway/tu-dien-nhat-viet' : '',
      );
      upsertMeta.run('entry_count', String(totalEntries));
      upsertMeta.run('vi_matched_count', String(totalViMatched));
      upsertMeta.run('imported_at', new Date().toISOString());

      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw error;
    }

    db.exec("INSERT INTO jmdict_fts(jmdict_fts) VALUES('optimize');");
    db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL;');
  } finally {
    db.close();
  }

  return {
    mode: 'apply',
    targetPath,
    version: parsed.version,
    jmdictSha256,
    viSource,
    viSha256,
    viDictionarySize: viMap.size,
    parsedEntries: preparedEntries.length,
    viMatchedCount,
    inserted,
    updated,
    totalEntries,
    dbBytes: fs.statSync(targetPath).size,
  };
}

export function parseCliArgs(argv) {
  const out = {
    jmdictPath: '',
    viPath: '',
    targetPath: path.resolve('data/private/jmdict.sqlite'),
    rawDir: path.resolve('data/private/jmdict'),
    expectedJmdictSha256: '',
    expectedViSha256: '',
    download: false,
    forceDownload: false,
    skipVi: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--jmdict') out.jmdictPath = argv[++i] ?? '';
    else if (arg === '--vi') out.viPath = argv[++i] ?? '';
    else if (arg === '--target') out.targetPath = path.resolve(argv[++i] ?? '');
    else if (arg === '--raw-dir') out.rawDir = path.resolve(argv[++i] ?? '');
    else if (arg === '--jmdict-sha256') out.expectedJmdictSha256 = argv[++i] ?? '';
    else if (arg === '--vi-sha256') out.expectedViSha256 = argv[++i] ?? '';
    else if (arg === '--download') out.download = true;
    else if (arg === '--force-download') {
      out.download = true;
      out.forceDownload = true;
    } else if (arg === '--no-vi') out.skipVi = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.download) {
    const jmdictDest = args.jmdictPath
      ? path.resolve(args.jmdictPath)
      : path.join(args.rawDir, 'JMdict_e.gz');
    if (args.forceDownload || !fs.existsSync(jmdictDest)) {
      await downloadFile(DEFAULT_JMDICT_URL, jmdictDest);
    }
    args.jmdictPath = jmdictDest;

    if (!args.skipVi) {
      const viDest = args.viPath
        ? path.resolve(args.viPath)
        : path.join(args.rawDir, 'tu-dien-nhat-viet.csv');
      if (args.forceDownload || !fs.existsSync(viDest)) {
        await downloadFile(DEFAULT_VI_URL, viDest);
      }
      args.viPath = viDest;
    }
  }

  if (!args.jmdictPath) {
    throw new Error('Provide --jmdict <path> or --download');
  }

  const report = importJmdict({
    jmdictPath: args.jmdictPath,
    viPath: args.skipVi ? '' : args.viPath,
    targetPath: args.targetPath,
    expectedJmdictSha256: args.expectedJmdictSha256,
    expectedViSha256: args.expectedViSha256,
    dryRun: args.dryRun,
  });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
