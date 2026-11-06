import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { databasePath } from '../src/core/config.ts';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const schema = fs.readFileSync(new URL('../docs/data/schema.draft.sql', import.meta.url), 'utf8');
const bytes = fs.readFileSync(new URL('../data/fixtures/openjlpt.json', import.meta.url));
const sample = JSON.parse(bytes.toString('utf8'));

export function seedDemo(file = databasePath()) {
  if (fs.existsSync(file)) throw new Error('Database already exists; refusing to overwrite it');
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(schema);
    db.exec('BEGIN IMMEDIATE');
    // The unmodified G0 draft inserts a user-media category; this public sample has no media.
    db.prepare("DELETE FROM data_sources WHERE source_id='user-media'").run();
    const source = sample.source,
      checksum = hash(bytes),
      release = 'openjlpt:foundation:' + checksum.slice(0, 32),
      now = new Date().toISOString();
    db.prepare(
      'INSERT INTO data_sources(source_id,name,url,license,version,checksum,attribution,usage_scope) VALUES(?,?,?,?,?,?,?,?)',
    ).run(
      'openjlpt',
      source.name,
      source.url,
      source.license,
      source.commit,
      checksum,
      source.attribution,
      'redistributable',
    );
    db.prepare(
      'INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      release,
      'openjlpt',
      source.commit + ':foundation-sample',
      checksum,
      source.url + '/tree/' + source.commit,
      now,
      source.license,
      source.attribution,
      JSON.stringify({ subset: 'foundation-sample', original_commit: source.commit }),
    );
    function content(kind: string, key: string, row: unknown) {
      const id = `openjlpt:${kind}:${key}`;
      db.prepare(
        'INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)',
      ).run(id, kind, 'openjlpt', key, release, hash(JSON.stringify(row)));
      return id;
    }
    for (const row of sample.vocab) {
      const id = content('vocab', row.id, row);
      db.prepare(
        'INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        id,
        row.word,
        row.reading,
        row.romaji,
        row.level,
        JSON.stringify(row.meanings),
        JSON.stringify(row.pos ?? []),
        row.jmdict_id ?? null,
      );
    }
    for (const row of sample.kanji) {
      const id = content(
        'kanji',
        'U+' + row.character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'),
        row,
      );
      db.prepare(
        'INSERT INTO kanji(item_id,character,level,strokes,grade,frequency_rank,radical,radical_number,onyomi,kunyomi,nanori,meanings_en) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        row.character,
        row.level,
        row.strokes ?? null,
        row.grade ?? null,
        row.freq ?? null,
        row.radical ?? null,
        row.radical_number ?? null,
        JSON.stringify(row.onyomi),
        JSON.stringify(row.kunyomi),
        JSON.stringify(row.nanori ?? []),
        JSON.stringify(row.meanings),
      );
    }
    for (const row of sample.grammar) {
      const id = content('grammar', row.id, row);
      db.prepare(
        'INSERT INTO grammar(item_id,pattern,reading,romaji,level,meaning_en,formation_en,notes_en,tags) VALUES(?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        row.pattern,
        row.reading ?? null,
        row.romaji,
        row.level,
        row.meaning,
        row.formation,
        row.notes ?? null,
        JSON.stringify(row.tags ?? []),
      );
      for (const [position, example] of row.examples.entries()) {
        const sentenceKey = hash(example.ja.normalize('NFC')),
          sentenceId = 'openjlpt:sentence:' + sentenceKey;
        if (!db.prepare('SELECT 1 FROM content_items WHERE item_id=?').get(sentenceId)) {
          content('sentence', sentenceKey, example);
          db.prepare(
            'INSERT INTO sentences(item_id,text_ja,text_en,furigana_notation,author_attribution) VALUES(?,?,?,?,?)',
          ).run(
            sentenceId,
            example.ja,
            example.en,
            example.furigana ?? null,
            'OpenJLPT contributors',
          );
        }
        db.prepare(
          'INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,?,?,?)',
        ).run(id, sentenceId, position, 'openjlpt', release);
      }
    }
    db.exec('COMMIT');
    if (db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Sample foreign-key violation');
    return {
      vocab: sample.vocab.length,
      kanji: sample.kanji.length,
      grammar: sample.grammar.length,
    };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    db.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log('Created OpenJLPT-only demo:', seedDemo());
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not create demo');
    process.exitCode = 1;
  }
}
