import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { seedDemo } from '../tools/seed-demo.ts';
import { selectedTranslation } from '../src/core/content.ts';
import { kanjiDetail } from '../src/app/(study)/kanji/repository.ts';

const SCRIPT = path.resolve('tools/import-g0.mjs');
const SCHEMA = fs.readFileSync(path.resolve('docs/data/schema.draft.sql'), 'utf8');

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function makeTempDir(t: test.TestContext, prefix: string) {
  const base = path.resolve('.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, prefix));
  t.after(() => {
    assert.equal(path.dirname(dir), base);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  return dir;
}

type ImportReport = {
  mode: string;
  releaseId: string;
  counts: Record<
    string,
    {
      toAdd: number;
      reconciled: number;
      skippedDuplicate: number;
      skippedConflict: number;
      sentencesAdded: number;
      sentencesReconciled: number;
      sentencesSkipped: number;
      rebasedTranslations: number;
    }
  >;
  auxCounts: Record<
    string,
    {
      toAdd: number;
      skippedDuplicateKey: number;
      skippedOrphanParent: number;
      skippedHashMismatch: number;
      skippedSelectedConflict: number;
    }
  >;
};

function runImporter(
  source: string,
  target: string,
  extraArgs: string[] = ['--apply'],
  envOverrides: Record<string, string | undefined> = {},
) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NIHON_DB_PATH;
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--source', source, '--target', target, ...extraArgs],
    { encoding: 'utf8', env },
  );
  return result;
}

function createSyntheticG0Source(file: string, seededSampleFile: string) {
  const sample = new DatabaseSync(seededSampleFile, { readOnly: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(SCHEMA);
    db.exec('BEGIN IMMEDIATE');
    db.prepare("DELETE FROM data_sources WHERE source_id='user-media'").run();

    const g0Checksum = sha256('synthetic-g0-openjlpt');
    const g0Rel = 'openjlpt:g0-test:' + g0Checksum.slice(0, 12);
    const mtChecksum = sha256('synthetic-mt');
    const mtRel = 'mt:test:v1';
    const kdChecksum = sha256('synthetic-kanjidictvn');
    const kdRel = 'kanjidictvn:v1';
    const kvgChecksum = sha256('synthetic-kanjivg');
    const kvgRel = 'kanjivg:v1';

    const insertSource = db.prepare(
      'INSERT INTO data_sources(source_id,name,url,license,version,checksum,attribution,usage_scope) VALUES(?,?,?,?,?,?,?,?)',
    );
    insertSource.run(
      'openjlpt',
      'OpenJLPT',
      'https://github.com/evanclan/OpenJLPT',
      'CC BY-SA 4.0',
      'g0-synthetic',
      g0Checksum,
      'OpenJLPT contributors',
      'redistributable',
    );
    insertSource.run(
      'mt:test',
      'Synthetic MT',
      'https://example.invalid/mt',
      'Synthetic',
      '1',
      mtChecksum,
      'Synthetic MT',
      'private_only',
    );
    insertSource.run(
      'kanjidictvn',
      'KanjiDictVN',
      'https://example.invalid/kanjidictvn',
      'Synthetic',
      '1',
      kdChecksum,
      'KanjiDictVN',
      'redistributable',
    );
    insertSource.run(
      'kanjivg',
      'KanjiVG',
      'https://example.invalid/kanjivg',
      'CC BY-SA 3.0',
      '1',
      kvgChecksum,
      'KanjiVG',
      'redistributable',
    );

    const insertRelease = db.prepare(
      'INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES(?,?,?,?,?,?,?,?,?)',
    );
    insertRelease.run(
      g0Rel,
      'openjlpt',
      'g0-synthetic',
      g0Checksum,
      'local://synthetic/openjlpt',
      '2026-11-26T00:00:00.000Z',
      'CC BY-SA 4.0',
      'OpenJLPT contributors',
      '{}',
    );
    insertRelease.run(
      mtRel,
      'mt:test',
      '1',
      mtChecksum,
      'local://synthetic/mt',
      '2026-11-26T00:00:00.000Z',
      'Synthetic',
      'Synthetic MT',
      JSON.stringify({ model: 'synthetic-model', prompt_version: 'v1' }),
    );
    insertRelease.run(
      kdRel,
      'kanjidictvn',
      '1',
      kdChecksum,
      'local://synthetic/kanjidictvn',
      '2026-11-26T00:00:00.000Z',
      'Synthetic',
      'KanjiDictVN',
      '{}',
    );
    insertRelease.run(
      kvgRel,
      'kanjivg',
      '1',
      kvgChecksum,
      'local://synthetic/kanjivg',
      '2026-11-26T00:00:00.000Z',
      'CC BY-SA 3.0',
      'KanjiVG',
      '{}',
    );

    // Copy colliding seed items (日, 学生, wa, and wa's first example sentence) with NEW G0 hashes
    // so they reproduce the exact seed-vs-G0 hash mismatch seen in production.
    const seedKanji = sample
      .prepare("SELECT c.source_key, k.* FROM kanji k JOIN content_items c USING(item_id) WHERE k.character = '日'")
      .get() as Record<string, SQLInputValue>;
    const seedVocab = sample
      .prepare("SELECT c.source_key, v.* FROM vocab v JOIN content_items c USING(item_id) WHERE v.word = '学生'")
      .get() as Record<string, SQLInputValue>;
    const seedGrammar = sample
      .prepare("SELECT c.source_key, g.* FROM grammar g JOIN content_items c USING(item_id) WHERE g.item_id = 'openjlpt:grammar:wa'")
      .get() as Record<string, SQLInputValue>;
    assert.ok(seedKanji && seedVocab && seedGrammar);
    const seedSentence = sample
      .prepare(
        `SELECT c.source_key, s.*, l.position
         FROM item_sentences l
         JOIN sentences s ON s.item_id = l.sentence_id
         JOIN content_items c ON c.item_id = s.item_id
         WHERE l.item_id = ?
         ORDER BY l.position ASC LIMIT 1`,
      )
      .get(String(seedGrammar.item_id)) as Record<string, SQLInputValue>;
    assert.ok(seedSentence);

    const g0KanjiHash = sha256('g0-canonical:kanji:日');
    const g0VocabHash = sha256('g0-canonical:vocab:学生');
    const g0GrammarHash = sha256('g0-canonical:grammar:wa');
    const g0SentenceHash = sha256('g0-canonical:sentence:' + String(seedSentence.text_ja));

    const newKanjiId = 'openjlpt:kanji:U+5C71';
    const newKanjiHash = sha256('g0-canonical:kanji:山');
    const newVocabId = 'openjlpt:vocab:synthetic-yama';
    const newVocabHash = sha256('g0-canonical:vocab:山');

    const insertItem = db.prepare(
      'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
    );

    // Colliding kanji 日 (same item_id & character, G0 hash)
    insertItem.run(seedKanji.item_id, 'kanji', 'openjlpt', seedKanji.source_key, g0Rel, g0KanjiHash);
    db.prepare(
      'INSERT INTO kanji(item_id,character,level,strokes,grade,frequency_rank,radical,radical_number,onyomi,kunyomi,nanori,meanings_en,supplementary) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      seedKanji.item_id,
      seedKanji.character,
      seedKanji.level,
      seedKanji.strokes,
      seedKanji.grade,
      seedKanji.frequency_rank,
      seedKanji.radical,
      seedKanji.radical_number,
      seedKanji.onyomi,
      seedKanji.kunyomi,
      seedKanji.nanori,
      seedKanji.meanings_en,
      seedKanji.supplementary,
    );

    // New kanji 山
    insertItem.run(newKanjiId, 'kanji', 'openjlpt', 'U+5C71', g0Rel, newKanjiHash);
    db.prepare(
      'INSERT INTO kanji(item_id,character,level,strokes,grade,frequency_rank,radical,radical_number,onyomi,kunyomi,nanori,meanings_en,supplementary) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(newKanjiId, '山', 'N5', 3, 1, 131, '山', 46, '["サン"]', '["やま"]', '[]', '["mountain"]', 0);

    // Colliding vocab 学生
    insertItem.run(seedVocab.item_id, 'vocab', 'openjlpt', seedVocab.source_key, g0Rel, g0VocabHash);
    db.prepare(
      'INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id) VALUES(?,?,?,?,?,?,?,?)',
    ).run(
      seedVocab.item_id,
      seedVocab.word,
      seedVocab.reading,
      seedVocab.romaji,
      seedVocab.level,
      seedVocab.meanings_en,
      seedVocab.pos,
      seedVocab.jmdict_id,
    );

    // New vocab 山
    insertItem.run(newVocabId, 'vocab', 'openjlpt', 'synthetic-yama', g0Rel, newVocabHash);
    db.prepare(
      'INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id) VALUES(?,?,?,?,?,?,?,?)',
    ).run(newVocabId, '山', 'やま', 'yama', 'N5', '["mountain"]', '["n"]', 1302680);

    // Colliding grammar wa + colliding example sentence
    insertItem.run(seedGrammar.item_id, 'grammar', 'openjlpt', seedGrammar.source_key, g0Rel, g0GrammarHash);
    db.prepare(
      'INSERT INTO grammar(item_id,pattern,reading,romaji,level,meaning_en,formation_en,notes_en,tags) VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      seedGrammar.item_id,
      seedGrammar.pattern,
      seedGrammar.reading,
      seedGrammar.romaji,
      seedGrammar.level,
      seedGrammar.meaning_en,
      seedGrammar.formation_en,
      seedGrammar.notes_en,
      seedGrammar.tags,
    );
    insertItem.run(seedSentence.item_id, 'sentence', 'openjlpt', seedSentence.source_key, g0Rel, g0SentenceHash);
    db.prepare(
      'INSERT INTO sentences(item_id,text_ja,text_en,furigana_notation,author_attribution) VALUES(?,?,?,?,?)',
    ).run(
      seedSentence.item_id,
      seedSentence.text_ja,
      seedSentence.text_en,
      seedSentence.furigana_notation,
      seedSentence.author_attribution,
    );
    db.prepare(
      'INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,?,?,?)',
    ).run(seedGrammar.item_id, seedSentence.item_id, seedSentence.position, 'openjlpt', g0Rel);

    // G0 translations keyed to G0 hashes
    const insertVi = db.prepare(
      `INSERT INTO vi_translations(
         translation_id,item_id,field,text_vi,method,source_id,release_id,
         source_record_key,base_content_hash,status,match_method,needs_refresh,context_json,created_at
       ) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,'{}','2026-11-26T00:00:00.000Z')`,
    );
    insertVi.run('vi-hi-hv', seedKanji.item_id, 'han_viet', 'NHẬT', 'han_viet', 'kanjidictvn', kdRel, 'U+65E5:hv', g0KanjiHash, 'selected', 'codepoint');
    insertVi.run('vi-hi-meaning', seedKanji.item_id, 'meaning', 'ngày, mặt trời', 'machine', 'mt:test', mtRel, 'U+65E5:m', g0KanjiHash, 'selected', 'machine_context');
    insertVi.run('vi-hi-kd-meaning', seedKanji.item_id, 'meaning', 'mặt trời, ban ngày', 'dictionary', 'kanjidictvn', kdRel, 'U+65E5:kd', g0KanjiHash, 'candidate', 'codepoint');
    insertVi.run('vi-yama-hv', newKanjiId, 'han_viet', 'SƠN', 'han_viet', 'kanjidictvn', kdRel, 'U+5C71:hv', newKanjiHash, 'selected', 'codepoint');
    insertVi.run('vi-yama-meaning', newKanjiId, 'meaning', 'núi', 'machine', 'mt:test', mtRel, 'U+5C71:m', newKanjiHash, 'selected', 'machine_context');
    insertVi.run('vi-gakusei-meaning', seedVocab.item_id, 'meaning', 'sinh viên', 'machine', 'mt:test', mtRel, 'gakusei:m', g0VocabHash, 'selected', 'machine_context');
    insertVi.run('vi-wa-meaning', seedGrammar.item_id, 'meaning', 'trợ từ chủ đề', 'machine', 'mt:test', mtRel, 'wa:m', g0GrammarHash, 'selected', 'machine_context');
    insertVi.run('vi-sent-text', seedSentence.item_id, 'text', 'Tôi là sinh viên.', 'machine', 'mt:test', mtRel, 'sent:t', g0SentenceHash, 'selected', 'machine_context');

    // Aux rows for both colliding and new items
    db.prepare(
      'INSERT INTO kanji_strokes(kanji_id,variant,stroke_no,path_d,source_id,release_id) VALUES(?,?,?,?,?,?)',
    ).run(seedKanji.item_id, '', 1, 'M10,10 L90,10', 'kanjivg', kvgRel);
    db.prepare(
      'INSERT INTO kanji_vocab(kanji_id,vocab_id,source_id,release_id) VALUES(?,?,?,?)',
    ).run(newKanjiId, newVocabId, 'openjlpt', g0Rel);
    db.prepare(
      'INSERT INTO vocab_forms(item_id,form_kind,form,source_id,release_id) VALUES(?,?,?,?,?)',
    ).run(seedVocab.item_id, 'writing', '学生', 'openjlpt', g0Rel);

    db.exec('COMMIT');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);

    return {
      kanjiId: String(seedKanji.item_id),
      vocabId: String(seedVocab.item_id),
      grammarId: String(seedGrammar.item_id),
      sentenceId: String(seedSentence.item_id),
      newKanjiId,
      g0KanjiHash,
    };
  } finally {
    sample.close();
    db.close();
  }
}

function snapshotTables(db: DatabaseSync) {
  const tables = [
    'data_sources',
    'source_releases',
    'content_items',
    'vocab',
    'kanji',
    'grammar',
    'sentences',
    'item_sentences',
    'vi_translations',
    'vocab_forms',
    'kanji_vocab',
    'kanji_strokes',
  ];
  const out: Record<string, unknown[]> = {};
  for (const table of tables) {
    out[table] = db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all();
  }
  return out;
}

test('colliding seed items reconcile hashes so selected translations match and second import is idempotent', (t) => {
  const dir = makeTempDir(t, 'import-g0-');
  const target = path.join(dir, 'target.sqlite');
  const source = path.join(dir, 'g0-source.sqlite');

  seedDemo(target);
  const ids = createSyntheticG0Source(source, target);

  // Verify precondition: target seed hash for 日 differs from G0 hash.
  const preDb = new DatabaseSync(target, { readOnly: true });
  const preHash = String(
    preDb.prepare('SELECT source_hash FROM content_items WHERE item_id = ?').get(ids.kanjiId)!.source_hash,
  );
  preDb.close();
  assert.notEqual(preHash, ids.g0KanjiHash);

  // Dry-run must not mutate target and must predict reconciliation + translation adds.
  const dryRun = runImporter(source, target, ['--dry-run']);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const dryReport = JSON.parse(dryRun.stdout) as ImportReport;
  assert.equal(dryReport.mode, 'dry-run');
  assert.equal(dryReport.counts.kanji.reconciled, 1);
  assert.equal(dryReport.counts.kanji.toAdd, 1);
  assert.equal(dryReport.counts.vocab.reconciled, 1);
  assert.equal(dryReport.counts.vocab.toAdd, 1);
  assert.equal(dryReport.counts.grammar.reconciled, 1);
  assert.equal(dryReport.counts.grammar.sentencesReconciled, 1);
  assert.equal(dryReport.auxCounts.vi_translations.toAdd, 8);
  assert.equal(dryReport.auxCounts.vi_translations.skippedHashMismatch, 0);

  const afterDryDb = new DatabaseSync(target, { readOnly: true });
  assert.equal(afterDryDb.prepare('SELECT count(*) n FROM vi_translations').get()!.n, 0);
  afterDryDb.close();

  // First apply: reconciles colliding seed items and imports translations with matching hashes.
  const apply1 = runImporter(source, target, ['--apply']);
  assert.equal(apply1.status, 0, apply1.stderr);
  const report1 = JSON.parse(apply1.stdout) as ImportReport;
  assert.equal(report1.counts.kanji.reconciled, 1);
  assert.equal(report1.counts.kanji.toAdd, 1);
  assert.equal(report1.counts.vocab.reconciled, 1);
  assert.equal(report1.counts.vocab.toAdd, 1);
  assert.equal(report1.counts.grammar.reconciled, 1);
  assert.equal(report1.counts.grammar.sentencesReconciled, 1);
  assert.equal(report1.auxCounts.vi_translations.toAdd, 8);
  assert.equal(report1.auxCounts.vi_translations.skippedHashMismatch, 0);

  const db1 = new DatabaseSync(target, { readOnly: true });
  let snap1: Record<string, unknown[]>;
  try {
    assert.equal(db1.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    assert.equal(db1.prepare('PRAGMA foreign_key_check').all().length, 0);

    // Core invariant: every selected translation matches its parent's content_items.source_hash.
    const selectedMismatches = Number(
      db1
        .prepare(
          `SELECT count(*) n
           FROM vi_translations t
           JOIN content_items i USING(item_id)
           WHERE t.status = 'selected' AND t.base_content_hash <> i.source_hash`,
        )
        .get()!.n,
    );
    assert.equal(selectedMismatches, 0);

    const anyMismatches = Number(
      db1
        .prepare(
          `SELECT count(*) n
           FROM vi_translations t
           JOIN content_items i USING(item_id)
           WHERE t.base_content_hash <> i.source_hash`,
        )
        .get()!.n,
    );
    assert.equal(anyMismatches, 0);

    // Verify production readers return translations without relaxing reader filters.
    const hi = kanjiDetail(db1, '日');
    assert.ok(hi);
    assert.equal(hi.hanViet?.text, 'NHẬT');
    assert.equal(hi.meaning?.text, 'ngày, mặt trời');
    assert.equal(hi.hanVietOriginalMeaning?.text, 'mặt trời, ban ngày');

    const yama = kanjiDetail(db1, '山');
    assert.ok(yama);
    assert.equal(yama.hanViet?.text, 'SƠN');
    assert.equal(yama.meaning?.text, 'núi');

    assert.equal(selectedTranslation(db1, ids.vocabId, 'meaning')?.text, 'sinh viên');
    assert.equal(selectedTranslation(db1, ids.grammarId, 'meaning')?.text, 'trợ từ chủ đề');
    assert.equal(selectedTranslation(db1, ids.sentenceId, 'text')?.text, 'Tôi là sinh viên.');

    snap1 = snapshotTables(db1);
  } finally {
    db1.close();
  }

  // Second apply must be strictly idempotent: zero adds, zero reconciliations, identical DB rows.
  const apply2 = runImporter(source, target, ['--apply']);
  assert.equal(apply2.status, 0, apply2.stderr);
  const report2 = JSON.parse(apply2.stdout) as ImportReport;
  for (const kind of ['vocab', 'kanji', 'grammar']) {
    assert.equal(report2.counts[kind].toAdd, 0, `${kind} toAdd`);
    assert.equal(report2.counts[kind].reconciled, 0, `${kind} reconciled`);
    assert.equal(report2.counts[kind].skippedConflict, 0, `${kind} skippedConflict`);
    assert.equal(report2.counts[kind].sentencesAdded, 0, `${kind} sentencesAdded`);
    assert.equal(report2.counts[kind].sentencesReconciled, 0, `${kind} sentencesReconciled`);
    assert.equal(report2.counts[kind].rebasedTranslations, 0, `${kind} rebasedTranslations`);
  }
  for (const auxName of ['vi_translations', 'vocab_forms', 'kanji_vocab', 'kanji_strokes']) {
    assert.equal(report2.auxCounts[auxName].toAdd, 0, `${auxName} toAdd`);
  }

  const db2 = new DatabaseSync(target, { readOnly: true });
  try {
    assert.deepEqual(snapshotTables(db2), snap1);
  } finally {
    db2.close();
  }
});

test('preserves local semantic conflicts, rebases identical-content candidates, and blocks stale-hash translations', (t) => {
  const dir = makeTempDir(t, 'import-g0-edge-');
  const target = path.join(dir, 'target.sqlite');
  const source = path.join(dir, 'g0-source.sqlite');

  seedDemo(target);
  const ids = createSyntheticG0Source(source, target);

  // Add a pre-existing KanjiDictVN candidate on 日 (identical content, seed hash) -> should rebase.
  // Also alter 学生's English meaning in target AND give it a local selected translation -> semantic
  // conflict, so target 学生 must stay untouched and G0's mismatched-hash translation must be blocked.
  const tgtDb = new DatabaseSync(target);
  try {
    const hiHash = String(
      tgtDb.prepare('SELECT source_hash FROM content_items WHERE item_id = ?').get(ids.kanjiId)!.source_hash,
    );
    const gakuseiHash = String(
      tgtDb.prepare('SELECT source_hash FROM content_items WHERE item_id = ?').get(ids.vocabId)!.source_hash,
    );
    const localChecksum = sha256('local-source');
    tgtDb
      .prepare(
        "INSERT INTO data_sources(source_id,name,url,license,version,checksum,attribution,usage_scope) VALUES('local:dict','Local Dict','https://example.invalid/local','Synthetic','1',?,'Local','private_only')",
      )
      .run(localChecksum);
    tgtDb
      .prepare(
        "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('local:dict:v1','local:dict','1',?,'local://dict','2026-11-26T00:00:00.000Z','Synthetic','Local','{}')",
      )
      .run(localChecksum);

    // Pre-existing candidate on content-identical 日
    tgtDb
      .prepare(
        `INSERT INTO vi_translations(
           translation_id,item_id,field,text_vi,method,source_id,release_id,
           source_record_key,base_content_hash,status,match_method,needs_refresh,context_json,created_at
         ) VALUES('local-hi-cand',?,'han_viet','NHỰT','han_viet','local:dict','local:dict:v1','hi:cand',?,'candidate','codepoint',0,'{}','2026-11-26T00:00:00.000Z')`,
      )
      .run(ids.kanjiId, hiHash);

    // Semantic conflict on 学生: target has different meanings_en + an active selected translation
    tgtDb
      .prepare('UPDATE vocab SET meanings_en = ? WHERE item_id = ?')
      .run('["student (custom target)"]', ids.vocabId);
    tgtDb
      .prepare(
        `INSERT INTO vi_translations(
           translation_id,item_id,field,text_vi,method,source_id,release_id,
           source_record_key,base_content_hash,status,match_method,needs_refresh,context_json,created_at
         ) VALUES('local-gakusei-sel',?,'meaning','học sinh (bản cục bộ)','dictionary','local:dict','local:dict:v1','gakusei:local',?,'selected','word_reading',0,'{}','2026-11-26T00:00:00.000Z')`,
      )
      .run(ids.vocabId, gakuseiHash);
  } finally {
    tgtDb.close();
  }

  // Also inject a stale-hash translation in G0 source itself to verify the hash guard rejects it.
  const srcDb = new DatabaseSync(source);
  try {
    srcDb
      .prepare(
        `INSERT INTO vi_translations(
           translation_id,item_id,field,text_vi,method,source_id,release_id,
           source_record_key,base_content_hash,status,match_method,needs_refresh,context_json,created_at
         ) VALUES('vi-stale-in-g0',?,'notes','bản dịch lệch hash','machine','mt:test','mt:test:v1','stale:1',?,'selected','machine_context',0,'{}','2026-11-26T00:00:00.000Z')`,
      )
      .run(ids.newKanjiId, '0'.repeat(64));
  } finally {
    srcDb.close();
  }

  const run = runImporter(source, target, ['--apply']);
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout) as ImportReport;

  assert.equal(report.counts.kanji.reconciled, 1);
  assert.equal(report.counts.kanji.rebasedTranslations, 1);
  assert.equal(report.counts.vocab.skippedConflict, 1);
  // Both 学生's G0 translation (parent kept target hash) and vi-stale-in-g0 must be rejected.
  assert.equal(report.auxCounts.vi_translations.skippedHashMismatch, 2);

  const checkDb = new DatabaseSync(target, { readOnly: true });
  try {
    assert.equal(checkDb.prepare('PRAGMA foreign_key_check').all().length, 0);
    // Zero mismatched hashes across ALL translations (selected and candidate).
    const mismatches = Number(
      checkDb
        .prepare(
          'SELECT count(*) n FROM vi_translations t JOIN content_items i USING(item_id) WHERE t.base_content_hash <> i.source_hash',
        )
        .get()!.n,
    );
    assert.equal(mismatches, 0);

    // Local semantic conflict item keeps its local translation intact and readable.
    assert.equal(
      selectedTranslation(checkDb, ids.vocabId, 'meaning')?.text,
      'học sinh (bản cục bộ)',
    );
    // Rebased candidate on 日 now matches G0's hash.
    const rebased = checkDb
      .prepare("SELECT base_content_hash FROM vi_translations WHERE translation_id = 'local-hi-cand'")
      .get() as { base_content_hash: string };
    assert.equal(rebased.base_content_hash, ids.g0KanjiHash);
    // Stale-hash row from G0 was never inserted.
    assert.equal(
      checkDb.prepare("SELECT 1 FROM vi_translations WHERE translation_id = 'vi-stale-in-g0'").get(),
      undefined,
    );
  } finally {
    checkDb.close();
  }
});

test('refuses private live database paths, NIHON_DB_PATH, and overwriting source', (t) => {
  const dir = makeTempDir(t, 'import-g0-guard-');
  const source = path.join(dir, 'source.sqlite');
  const safeTarget = path.join(dir, 'target.sqlite');
  const privateTarget = path.join(dir, 'data', 'private', 'demo.sqlite');

  const privateRun = runImporter(source, privateTarget, ['--dry-run']);
  assert.notEqual(privateRun.status, 0);
  assert.match(privateRun.stderr, /data\/private\//);

  const envRun = runImporter(source, safeTarget, ['--dry-run'], { NIHON_DB_PATH: safeTarget });
  assert.notEqual(envRun.status, 0);
  assert.match(envRun.stderr, /NIHON_DB_PATH/);

  const sameRun = runImporter(source, source, ['--dry-run']);
  assert.notEqual(sameRun.status, 0);
  assert.match(sameRun.stderr, /equals --source/);
});
