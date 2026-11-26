// Import G0 frozen content (vocab/kanji/grammar + example sentences + aux tables) into an app DB.
// Usage: node tools/import-g0.mjs --source <frozen.sqlite> --target <db> [--dry-run|--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export function parseArgs(argv) {
  const out = { mode: 'dry-run', source: '', target: '', releaseId: '', version: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') out.source = argv[++i] ?? '';
    else if (a === '--target') out.target = argv[++i] ?? '';
    else if (a === '--release-id') out.releaseId = argv[++i] ?? '';
    else if (a === '--version') out.version = argv[++i] ?? '';
    else if (a === '--dry-run') out.mode = 'dry-run';
    else if (a === '--apply') out.mode = 'apply';
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!out.source || !out.target) throw new Error('Both --source and --target are required');
  return out;
}

export function assertTargetIsSafe(targetPath, sourcePath = '') {
  const resolvedTarget = path.resolve(targetPath);
  const normalized = resolvedTarget.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('/data/private/')) {
    throw new Error('Refusing to run: --target resolves inside data/private/');
  }
  const envDb = process.env.NIHON_DB_PATH;
  if (envDb) {
    const envNormalized = path.resolve(envDb).replace(/\\/g, '/').toLowerCase();
    if (normalized === envNormalized) {
      throw new Error('Refusing to run: --target equals NIHON_DB_PATH');
    }
  }
  if (sourcePath) {
    const resolvedSource = path.resolve(sourcePath);
    if (resolvedTarget.toLowerCase() === resolvedSource.toLowerCase()) {
      throw new Error('Refusing to run: --target equals --source');
    }
  }
}

// parentOk checks against activeItemHashes (Map<item_id, source_hash> after this run's adds and
// reconciliations), so --dry-run predicts the same adds and skips that --apply executes.
const AUX_TABLES = [
  {
    name: 'vi_translations',
    cols: [
      'translation_id', 'item_id', 'field', 'text_vi', 'method', 'source_id', 'release_id',
      'source_record_key', 'base_content_hash', 'status', 'match_method', 'needs_refresh',
      'context_json', 'created_at',
    ],
    keyCols: ['translation_id'],
    parentOk: (row, activeItemHashes) => activeItemHashes.has(row.item_id),
  },
  {
    name: 'vocab_forms',
    cols: ['item_id', 'form_kind', 'form', 'source_id', 'release_id'],
    keyCols: ['item_id', 'form_kind', 'form'],
    parentOk: (row, activeItemHashes) => activeItemHashes.has(row.item_id),
  },
  {
    name: 'kanji_vocab',
    cols: ['kanji_id', 'vocab_id', 'source_id', 'release_id'],
    keyCols: ['kanji_id', 'vocab_id'],
    parentOk: (row, activeItemHashes) =>
      activeItemHashes.has(row.kanji_id) && activeItemHashes.has(row.vocab_id),
  },
  {
    name: 'kanji_strokes',
    cols: ['kanji_id', 'variant', 'stroke_no', 'path_d', 'source_id', 'release_id'],
    keyCols: ['kanji_id', 'variant', 'stroke_no'],
    parentOk: (row, activeItemHashes) => activeItemHashes.has(row.kanji_id),
  },
];

const KIND_NATURAL_KEY = {
  vocab: {
    table: 'vocab',
    cols: ['item_id', 'word', 'reading', 'romaji', 'level', 'meanings_en', 'pos', 'jmdict_id'],
    key: (row) => `${row.word}\u0000${row.reading}`,
  },
  kanji: {
    table: 'kanji',
    cols: [
      'item_id', 'character', 'level', 'strokes', 'grade', 'frequency_rank', 'radical',
      'radical_number', 'onyomi', 'kunyomi', 'nanori', 'meanings_en', 'supplementary',
    ],
    key: (row) => row.character,
  },
  grammar: {
    table: 'grammar',
    cols: [
      'item_id', 'pattern', 'reading', 'romaji', 'level', 'meaning_en', 'formation_en',
      'notes_en', 'tags',
    ],
    key: (row) => `${row.pattern}\u0000${row.level}`,
  },
};

const SENTENCE_COLS = ['item_id', 'text_ja', 'text_en', 'furigana_notation', 'author_attribution'];

function detailColsMatch(cols, left, right) {
  return cols.every((c) => (left[c] ?? null) === (right[c] ?? null));
}

function viUniqueKey(row, hashOverride) {
  return [
    row.item_id,
    row.field,
    row.source_id,
    row.release_id,
    row.source_record_key,
    hashOverride ?? row.base_content_hash,
  ].join('\u0000');
}

export function importG0(options) {
  const mode = options.mode === 'apply' ? 'apply' : 'dry-run';
  assertTargetIsSafe(options.target, options.source);

  const sourceChecksum = createHash('sha256').update(fs.readFileSync(options.source)).digest('hex');
  const RELEASE_SOURCE_ID = 'openjlpt';
  const RELEASE_ID = options.releaseId || `g0:import:${sourceChecksum.slice(0, 12)}`;
  const RELEASE_VERSION = options.version || `g0-import-${sourceChecksum.slice(0, 12)}`;
  const ARTIFACT_URL = `local://g0-import/${path.basename(options.source)}`;

  const src = new DatabaseSync(options.source, { readOnly: true });
  const tgt = new DatabaseSync(options.target, { readOnly: mode === 'dry-run' });

  try {
    if (mode === 'apply') {
      tgt.exec('PRAGMA foreign_keys = ON');
    }

    const counts = {};
    for (const kind of Object.keys(KIND_NATURAL_KEY)) {
      counts[kind] = {
        toAdd: 0,
        reconciled: 0,
        skippedDuplicate: 0,
        skippedConflict: 0,
        sentencesAdded: 0,
        sentencesReconciled: 0,
        sentencesSkipped: 0,
        rebasedTranslations: 0,
      };
    }
    const auxCounts = {};
    for (const aux of AUX_TABLES) {
      auxCounts[aux.name] = {
        toAdd: 0,
        skippedDuplicateKey: 0,
        skippedOrphanParent: 0,
        skippedHashMismatch: 0,
        skippedSelectedConflict: 0,
      };
    }

    // Active rows already in target per kind, keyed by natural key.
    const existingByKey = {};
    for (const [kind, def] of Object.entries(KIND_NATURAL_KEY)) {
      const rows = tgt
        .prepare(
          `SELECT c.source_id, c.source_key, c.release_id, c.source_hash, t.*
           FROM ${def.table} t
           JOIN content_items c ON c.item_id = t.item_id
           WHERE c.kind = ? AND c.is_active = 1`,
        )
        .all(kind);
      existingByKey[kind] = new Map(rows.map((r) => [def.key(r), r]));
    }

    const existingSentencesById = new Map(
      tgt
        .prepare(
          `SELECT c.source_id, c.source_key, c.release_id, c.source_hash, s.*
           FROM sentences s
           JOIN content_items c ON c.item_id = s.item_id
           WHERE c.kind = 'sentence' AND c.is_active = 1`,
        )
        .all()
        .map((r) => [r.item_id, r]),
    );

    const allTargetItemIds = new Set(
      tgt.prepare('SELECT item_id FROM content_items').all().map((r) => r.item_id),
    );

    // Maps every active item_id in target (existing, reconciled, or added by this run) to its
    // resulting content_items.source_hash. Used to guard vi_translations.base_content_hash.
    const activeItemHashes = new Map(
      tgt
        .prepare('SELECT item_id, source_hash FROM content_items WHERE is_active = 1')
        .all()
        .map((r) => [r.item_id, r.source_hash]),
    );

    const targetViCountByItem = new Map(
      tgt
        .prepare('SELECT item_id, count(*) n FROM vi_translations GROUP BY item_id')
        .all()
        .map((r) => [r.item_id, Number(r.n)]),
    );

    const existingAuxKeys = {};
    for (const aux of AUX_TABLES) {
      const rows = tgt.prepare(`SELECT ${aux.keyCols.join(',')} FROM ${aux.name}`).all();
      existingAuxKeys[aux.name] = new Set(
        rows.map((r) => aux.keyCols.map((c) => r[c]).join('\u0000')),
      );
    }

    const existingViUniqueKeys = new Set(
      tgt
        .prepare(
          'SELECT item_id, field, source_id, release_id, source_record_key, base_content_hash FROM vi_translations',
        )
        .all()
        .map((r) => viUniqueKey(r)),
    );

    const existingSelected = new Set(
      tgt
        .prepare("SELECT item_id, field FROM vi_translations WHERE status = 'selected'")
        .all()
        .map((r) => `${r.item_id}\u0000${r.field}`),
    );

    const existingItemSentenceLinks = new Set(
      tgt
        .prepare('SELECT item_id, sentence_id FROM item_sentences')
        .all()
        .map((r) => `${r.item_id}\u0000${r.sentence_id}`),
    );

    const existingItemSentencePositions = new Map();
    for (const r of tgt.prepare('SELECT item_id, position FROM item_sentences').all()) {
      let set = existingItemSentencePositions.get(r.item_id);
      if (!set) {
        set = new Set();
        existingItemSentencePositions.set(r.item_id, set);
      }
      set.add(Number(r.position));
    }

    if (mode === 'apply') {
      tgt.exec('BEGIN IMMEDIATE');
    }

    let importReleaseEnsured = false;
    function ensureImportRelease() {
      if (mode !== 'apply' || importReleaseEnsured) return;
      importReleaseEnsured = true;
      if (!tgt.prepare('SELECT 1 FROM data_sources WHERE source_id = ?').get(RELEASE_SOURCE_ID)) {
        const ds = src
          .prepare('SELECT * FROM data_sources WHERE source_id = ?')
          .get(RELEASE_SOURCE_ID);
        if (!ds) throw new Error(`Missing data_sources row in G0 for source_id=${RELEASE_SOURCE_ID}`);
        tgt
          .prepare(
            'INSERT INTO data_sources(source_id,name,url,license,version,imported_at,checksum,attribution,usage_scope) VALUES(?,?,?,?,?,?,?,?,?)',
          )
          .run(
            ds.source_id,
            ds.name,
            ds.url,
            ds.license,
            ds.version,
            ds.imported_at,
            ds.checksum,
            ds.attribution,
            ds.usage_scope,
          );
      }
      const already = tgt
        .prepare('SELECT 1 FROM source_releases WHERE release_id = ? AND source_id = ?')
        .get(RELEASE_ID, RELEASE_SOURCE_ID);
      if (!already) {
        const openjlptSource = tgt
          .prepare('SELECT license, attribution FROM data_sources WHERE source_id = ?')
          .get(RELEASE_SOURCE_ID);
        tgt
          .prepare(
            `INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json)
             VALUES(?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            RELEASE_ID,
            RELEASE_SOURCE_ID,
            RELEASE_VERSION,
            sourceChecksum,
            ARTIFACT_URL,
            new Date().toISOString(),
            openjlptSource.license,
            openjlptSource.attribution,
            JSON.stringify({ pipeline: 'g0-data-import', source_file: path.basename(options.source) }),
          );
      }
    }

    function rebaseItemTranslations(itemId, oldHash, newHash, kind) {
      const rows = tgt
        .prepare(
          'SELECT translation_id, item_id, field, source_id, release_id, source_record_key, base_content_hash FROM vi_translations WHERE item_id = ? AND base_content_hash = ?',
        )
        .all(itemId, oldHash);
      for (const tr of rows) {
        const nextUnique = viUniqueKey(tr, newHash);
        if (existingViUniqueKeys.has(nextUnique)) continue;
        existingViUniqueKeys.delete(viUniqueKey(tr));
        existingViUniqueKeys.add(nextUnique);
        counts[kind].rebasedTranslations++;
        if (mode === 'apply') {
          tgt
            .prepare('UPDATE vi_translations SET base_content_hash = ? WHERE translation_id = ?')
            .run(newHash, tr.translation_id);
        }
      }
    }

    function canUpdateSourceKey(sourceId, kind, sourceKey, itemId) {
      const owner = tgt
        .prepare(
          'SELECT item_id FROM content_items WHERE source_id = ? AND kind = ? AND source_key = ?',
        )
        .get(sourceId, kind, sourceKey);
      return !owner || owner.item_id === itemId;
    }

    function syncItemSentences(kind, itemId) {
      const links = src
        .prepare('SELECT item_id, sentence_id, position FROM item_sentences WHERE item_id = ? ORDER BY position ASC')
        .all(itemId);
      for (const link of links) {
        const sentenceContentItem = src
          .prepare("SELECT * FROM content_items WHERE item_id = ? AND kind = 'sentence'")
          .get(link.sentence_id);
        const sentenceRow = src
          .prepare('SELECT * FROM sentences WHERE item_id = ?')
          .get(link.sentence_id);
        if (!sentenceContentItem || !sentenceRow) continue;

        if (!allTargetItemIds.has(link.sentence_id)) {
          counts[kind].sentencesAdded++;
          allTargetItemIds.add(link.sentence_id);
          activeItemHashes.set(link.sentence_id, sentenceContentItem.source_hash);
          existingSentencesById.set(link.sentence_id, {
            ...sentenceContentItem,
            ...sentenceRow,
          });
          if (mode === 'apply') {
            ensureImportRelease();
            tgt
              .prepare(
                'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
              )
              .run(
                sentenceContentItem.item_id,
                'sentence',
                sentenceContentItem.source_id,
                sentenceContentItem.source_key,
                RELEASE_ID,
                sentenceContentItem.source_hash,
              );
            tgt
              .prepare(
                'INSERT INTO sentences(item_id,text_ja,text_en,furigana_notation,author_attribution) VALUES(?,?,?,?,?)',
              )
              .run(
                sentenceRow.item_id,
                sentenceRow.text_ja,
                sentenceRow.text_en,
                sentenceRow.furigana_notation,
                sentenceRow.author_attribution,
              );
          }
        } else if (existingSentencesById.has(link.sentence_id)) {
          const existingSent = existingSentencesById.get(link.sentence_id);
          const sameHash = existingSent.source_hash === sentenceContentItem.source_hash;
          const sameDetail = detailColsMatch(SENTENCE_COLS, existingSent, sentenceRow);
          if (sameHash && sameDetail) {
            counts[kind].sentencesSkipped++;
          } else {
            const hasExistingVi = (targetViCountByItem.get(link.sentence_id) ?? 0) > 0;
            const sourceKeySafe = canUpdateSourceKey(
              sentenceContentItem.source_id,
              'sentence',
              sentenceContentItem.source_key,
              link.sentence_id,
            );
            if (
              existingSent.source_id === RELEASE_SOURCE_ID &&
              sentenceContentItem.source_id === RELEASE_SOURCE_ID &&
              sourceKeySafe &&
              (!hasExistingVi || sameDetail)
            ) {
              counts[kind].sentencesReconciled++;
              if (mode === 'apply') {
                ensureImportRelease();
                tgt
                  .prepare(
                    'UPDATE content_items SET source_key = ?, release_id = ?, source_hash = ? WHERE item_id = ?',
                  )
                  .run(
                    sentenceContentItem.source_key,
                    RELEASE_ID,
                    sentenceContentItem.source_hash,
                    link.sentence_id,
                  );
                tgt
                  .prepare(
                    'UPDATE sentences SET text_ja = ?, text_en = ?, furigana_notation = ?, author_attribution = ? WHERE item_id = ?',
                  )
                  .run(
                    sentenceRow.text_ja,
                    sentenceRow.text_en,
                    sentenceRow.furigana_notation,
                    sentenceRow.author_attribution,
                    link.sentence_id,
                  );
              }
              if (sameDetail && hasExistingVi && !sameHash) {
                rebaseItemTranslations(
                  link.sentence_id,
                  existingSent.source_hash,
                  sentenceContentItem.source_hash,
                  kind,
                );
              }
              activeItemHashes.set(link.sentence_id, sentenceContentItem.source_hash);
              existingSentencesById.set(link.sentence_id, {
                ...sentenceContentItem,
                ...sentenceRow,
              });
            } else {
              counts[kind].sentencesSkipped++;
            }
          }
        } else {
          counts[kind].sentencesSkipped++;
        }

        if (!activeItemHashes.has(link.sentence_id)) continue;
        const linkKey = `${link.item_id}\u0000${link.sentence_id}`;
        if (!existingItemSentenceLinks.has(linkKey)) {
          let positions = existingItemSentencePositions.get(link.item_id);
          if (!positions) {
            positions = new Set();
            existingItemSentencePositions.set(link.item_id, positions);
          }
          let position = Number(link.position);
          if (positions.has(position)) {
            let maxPos = -1;
            for (const p of positions) {
              if (p > maxPos) maxPos = p;
            }
            position = maxPos + 1;
          }
          existingItemSentenceLinks.add(linkKey);
          positions.add(position);
          if (mode === 'apply') {
            ensureImportRelease();
            tgt
              .prepare(
                'INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,?,?,?)',
              )
              .run(link.item_id, link.sentence_id, position, RELEASE_SOURCE_ID, RELEASE_ID);
          }
        }
      }
    }

    try {
      for (const [kind, def] of Object.entries(KIND_NATURAL_KEY)) {
        const srcRows = src
          .prepare(
            `SELECT c.item_id, c.source_id, c.source_key, c.source_hash, t.*
             FROM content_items c
             JOIN ${def.table} t ON t.item_id = c.item_id
             WHERE c.kind = ? AND c.is_active = 1 AND c.source_id = 'openjlpt'`,
          )
          .all(kind);

        const updateCols = def.cols.filter((c) => c !== 'item_id');
        const updateSetSql = updateCols.map((c) => `${c} = ?`).join(', ');
        const insertPlaceholders = def.cols.map(() => '?').join(',');

        for (const row of srcRows) {
          const naturalKey = def.key(row);
          const existing = existingByKey[kind].get(naturalKey);

          if (!existing) {
            if (allTargetItemIds.has(row.item_id)) {
              counts[kind].skippedDuplicate++;
              continue;
            }
            counts[kind].toAdd++;
            existingByKey[kind].set(naturalKey, row);
            allTargetItemIds.add(row.item_id);
            activeItemHashes.set(row.item_id, row.source_hash);

            if (mode === 'apply') {
              ensureImportRelease();
              tgt
                .prepare(
                  'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
                )
                .run(row.item_id, kind, row.source_id, row.source_key, RELEASE_ID, row.source_hash);
              tgt
                .prepare(`INSERT INTO ${def.table}(${def.cols.join(',')}) VALUES(${insertPlaceholders})`)
                .run(...def.cols.map((c) => row[c]));
            }
            syncItemSentences(kind, row.item_id);
            continue;
          }

          const sameId = existing.item_id === row.item_id;
          const sameHash = existing.source_hash === row.source_hash;
          const sameDetail = detailColsMatch(def.cols, existing, row);

          if (sameId && sameHash && sameDetail) {
            counts[kind].skippedDuplicate++;
            continue;
          }

          // Reconcile colliding OpenJLPT seed items that share the same item_id so their
          // source_hash matches G0 before dependent G0 translations are considered.
          const hasExistingVi = (targetViCountByItem.get(existing.item_id) ?? 0) > 0;
          const sourceKeySafe = canUpdateSourceKey(row.source_id, kind, row.source_key, row.item_id);
          if (sameId && existing.source_id === RELEASE_SOURCE_ID && sourceKeySafe && (!hasExistingVi || sameDetail)) {
            counts[kind].reconciled++;
            if (mode === 'apply') {
              ensureImportRelease();
              tgt
                .prepare(
                  'UPDATE content_items SET source_key = ?, release_id = ?, source_hash = ? WHERE item_id = ?',
                )
                .run(row.source_key, RELEASE_ID, row.source_hash, row.item_id);
              tgt
                .prepare(`UPDATE ${def.table} SET ${updateSetSql} WHERE item_id = ?`)
                .run(...updateCols.map((c) => row[c]), row.item_id);
            }
            if (sameDetail && hasExistingVi && !sameHash) {
              rebaseItemTranslations(row.item_id, existing.source_hash, row.source_hash, kind);
            }
            existingByKey[kind].set(naturalKey, row);
            activeItemHashes.set(row.item_id, row.source_hash);
            syncItemSentences(kind, row.item_id);
          } else if (sameId && existing.source_id === RELEASE_SOURCE_ID && hasExistingVi && !sameDetail) {
            // Semantic conflict on an already-translated item: preserve target row; hash guard
            // below prevents importing mismatched G0 translations onto it.
            counts[kind].skippedConflict++;
          } else {
            counts[kind].skippedDuplicate++;
          }
        }
      }

      // Aux rows keep G0's own (source_id, release_id) provenance verbatim.
      const ensuredReleases = new Set();
      function ensureSourceRelease(sourceId, releaseId) {
        const key = `${sourceId}\u0000${releaseId}`;
        if (ensuredReleases.has(key)) return;
        ensuredReleases.add(key);
        if (
          tgt
            .prepare('SELECT 1 FROM source_releases WHERE release_id = ? AND source_id = ?')
            .get(releaseId, sourceId)
        ) {
          return;
        }
        if (!tgt.prepare('SELECT 1 FROM data_sources WHERE source_id = ?').get(sourceId)) {
          const ds = src.prepare('SELECT * FROM data_sources WHERE source_id = ?').get(sourceId);
          if (!ds) throw new Error(`Missing data_sources row in G0 for source_id=${sourceId}`);
          tgt
            .prepare(
              'INSERT INTO data_sources(source_id,name,url,license,version,imported_at,checksum,attribution,usage_scope) VALUES(?,?,?,?,?,?,?,?,?)',
            )
            .run(
              ds.source_id,
              ds.name,
              ds.url,
              ds.license,
              ds.version,
              ds.imported_at,
              ds.checksum,
              ds.attribution,
              ds.usage_scope,
            );
        }
        const rel = src
          .prepare('SELECT * FROM source_releases WHERE release_id = ? AND source_id = ?')
          .get(releaseId, sourceId);
        if (!rel) throw new Error(`Missing source_releases row in G0 for release_id=${releaseId}`);
        tgt
          .prepare(
            'INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES(?,?,?,?,?,?,?,?,?)',
          )
          .run(
            rel.release_id,
            rel.source_id,
            rel.version,
            rel.checksum,
            rel.artifact_url,
            rel.retrieved_at,
            rel.license,
            rel.attribution,
            rel.manifest_json,
          );
      }

      for (const aux of AUX_TABLES) {
        const srcRows = src.prepare(`SELECT * FROM ${aux.name}`).all();
        const placeholders = aux.cols.map(() => '?').join(',');
        for (const row of srcRows) {
          const keyVal = aux.keyCols.map((c) => row[c]).join('\u0000');
          if (existingAuxKeys[aux.name].has(keyVal)) {
            auxCounts[aux.name].skippedDuplicateKey++;
            continue;
          }
          if (!aux.parentOk(row, activeItemHashes)) {
            auxCounts[aux.name].skippedOrphanParent++;
            continue;
          }
          if (aux.name === 'vi_translations') {
            const uKey = viUniqueKey(row);
            if (existingViUniqueKeys.has(uKey)) {
              auxCounts[aux.name].skippedDuplicateKey++;
              continue;
            }
            const targetHash = activeItemHashes.get(row.item_id);
            if (targetHash !== row.base_content_hash) {
              auxCounts[aux.name].skippedHashMismatch++;
              continue;
            }
            if (row.status === 'selected') {
              const selKey = `${row.item_id}\u0000${row.field}`;
              if (existingSelected.has(selKey)) {
                auxCounts[aux.name].skippedSelectedConflict++;
                continue;
              }
              existingSelected.add(selKey);
            }
            existingViUniqueKeys.add(uKey);
          }

          auxCounts[aux.name].toAdd++;
          existingAuxKeys[aux.name].add(keyVal);
          if (mode !== 'apply') continue;
          ensureSourceRelease(row.source_id, row.release_id);
          tgt
            .prepare(`INSERT INTO ${aux.name}(${aux.cols.join(',')}) VALUES(${placeholders})`)
            .run(...aux.cols.map((c) => row[c]));
        }
      }

      if (mode === 'apply') {
        const fkViolations = tgt.prepare('PRAGMA foreign_key_check').all();
        if (fkViolations.length) throw new Error(`Foreign key violations: ${fkViolations.length}`);
        tgt.exec('COMMIT');
      }
    } catch (err) {
      if (mode === 'apply') {
        try {
          tgt.exec('ROLLBACK');
        } catch {}
      }
      throw err;
    }

    return { mode, releaseId: RELEASE_ID, counts, auxCounts };
  } finally {
    src.close();
    tgt.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = importG0(args);
  console.log(JSON.stringify(result, null, 2));
}
