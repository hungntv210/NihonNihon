import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import {
  furiganaMatches, readContentSupplement, supplementExamples, supplementFor, supplementSentence,
} from '../src/core/content-supplement.ts';
import { choiceQuestions, orderingQuestions } from '../src/app/(study)/grammar/practice.ts';

const levels = "('N5','N4','N3','N2')";
const scoped = (table) => `FROM ${table} t JOIN content_items i USING(item_id)
  WHERE i.is_active=1 AND t.level IN ${levels}`;
const linked = `SELECT s.*, si.source_hash,
    EXISTS (SELECT 1 FROM vi_translations v WHERE v.item_id=s.item_id AND v.field='text'
      AND v.status='selected' AND v.needs_refresh=0 AND v.base_content_hash=si.source_hash
      AND length(trim(v.text_vi))>0) AS has_vi
  FROM item_sentences l JOIN sentences s ON s.item_id=l.sentence_id
  JOIN content_items si ON si.item_id=s.item_id AND si.is_active=1
  WHERE l.item_id=? ORDER BY l.position`;

export function reportContentGaps(db, supplement = new Map()) {
  const vocab = { total: 0, missingPos: 0, noExamples: 0, noCompleteExample: 0 };
  const grammar = { total: 0, examples: 0, missingNotation: 0, missingFurigana: 0, missingVietnamese: 0,
    fewerThanThreeExamples: 0, fewerThanThreeChoice: 0, fewerThanThreeOrdering: 0 };
  const kanji = { total: 0, missingHanViet: 0, unexplainedMissingHanViet: 0, missingVietnamese: 0, noReadings: 0, missingOn: 0,
    missingKun: 0, missingStrokes: 0 };
  const examples = db.prepare(linked);
  const effectiveExamples = (rows, entry) => [
    ...rows.map((row) => {
      const { furigana, vi } = supplementSentence(supplement, {
        id: row.item_id, hash: row.source_hash, japanese: row.text_ja, furigana: row.furigana_notation,
      }, Boolean(row.has_vi));
      return { ...row, furigana_notation: furigana, has_vi: row.has_vi || Boolean(vi) };
    }),
    ...supplementExamples(entry, rows.map((row) => row.text_ja)).map((row) => ({
      item_id: row.id, text_ja: row.japanese, text_en: row.english, has_vi: true,
      furigana_notation: row.furigana,
    })),
  ];

  for (const row of db.prepare('SELECT t.item_id,t.pos,i.source_hash ' + scoped('vocab')).all()) {
    vocab.total++;
    const entry = supplementFor(supplement, row.item_id, row.source_hash);
    vocab.missingPos += Number(![...JSON.parse(row.pos), ...(entry?.pos ?? [])]
      .some((pos) => typeof pos === 'string' && pos.trim()));
    const base = examples.all(row.item_id).slice(0, 4);
    const all = effectiveExamples(base, entry);
    const shown = [...all.slice(base.length), ...all.slice(0, base.length)].slice(0, 2);
    vocab.noExamples += Number(!shown.length);
    vocab.noCompleteExample += Number(!shown.some((s) =>
      furiganaMatches(s.text_ja, s.furigana_notation || s.text_ja) && s.has_vi && s.text_en?.trim()));
  }

  const patterns = db.prepare('SELECT t.item_id,t.pattern,i.source_hash ' + scoped('grammar')).all();
  const allPatterns = db.prepare("SELECT g.item_id,g.pattern FROM grammar g JOIN content_items i USING(item_id) WHERE i.is_active=1 ORDER BY g.level,g.item_id").all();
  for (const row of patterns) {
    grammar.total++;
    const original = examples.all(row.item_id).slice(0, 50);
    const rows = effectiveExamples(original, supplementFor(supplement, row.item_id, row.source_hash));
    grammar.examples += rows.length;
    grammar.missingNotation += rows.filter((s) => !s.furigana_notation?.trim()).length;
    grammar.missingFurigana += rows.filter((s) =>
      !furiganaMatches(s.text_ja, s.furigana_notation || s.text_ja)).length;
    grammar.missingVietnamese += rows.filter((s) => !s.has_vi).length;
    grammar.fewerThanThreeExamples += Number(rows.length < 3);
    const distinct = [...new Map(original.map((s) => [s.text_ja.normalize('NFKC'), s])).values()]
      .map((s) => ({ id: s.item_id, japanese: s.text_ja, english: s.text_en }));
    const other = allPatterns.filter((p) => p.item_id !== row.item_id)
      .map((p) => p.pattern);
    grammar.fewerThanThreeChoice += Number(choiceQuestions(row.pattern, distinct, other).length < 3);
    grammar.fewerThanThreeOrdering += Number(orderingQuestions(distinct).length < 3);
  }

  const translation = db.prepare(`SELECT 1 FROM vi_translations v JOIN content_items i USING(item_id)
    WHERE v.item_id=? AND v.field=? AND v.status='selected' AND v.needs_refresh=0
    AND v.base_content_hash=i.source_hash AND length(trim(v.text_vi))>0`);
  const strokes = db.prepare("SELECT 1 FROM kanji_strokes WHERE kanji_id=? AND length(trim(path_d))>0 LIMIT 1");
  for (const row of db.prepare('SELECT t.item_id,t.onyomi,t.kunyomi,i.source_hash ' + scoped('kanji')).all()) {
    kanji.total++;
    const noOn = JSON.parse(row.onyomi).length === 0;
    const noKun = JSON.parse(row.kunyomi).length === 0;
    const noHanViet = !translation.get(row.item_id, 'han_viet');
    kanji.missingHanViet += Number(noHanViet);
    kanji.unexplainedMissingHanViet += Number(noHanViet && !supplementFor(supplement, row.item_id, row.source_hash)?.readingNote);
    kanji.missingVietnamese += Number(!translation.get(row.item_id, 'meaning'));
    kanji.noReadings += Number(noOn && noKun);
    kanji.missingOn += Number(noOn);
    kanji.missingKun += Number(noKun);
    kanji.missingStrokes += Number(!strokes.get(row.item_id));
  }
  return { vocab, grammar, kanji };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (![3, 4].includes(process.argv.length))
    throw new Error('Usage: node tools/report-content-gaps.mjs <snapshot.sqlite> [supplement.json]');
  const supplement = process.argv[3] ? readContentSupplement(process.argv[3]) : undefined;
  const db = new DatabaseSync(process.argv[2], { readOnly: true });
  try {
    console.log(JSON.stringify(reportContentGaps(db, supplement), null, 2));
  } finally {
    db.close();
  }
}
