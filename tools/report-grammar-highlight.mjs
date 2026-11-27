import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import {
  readContentSupplement,
  supplementExamples,
  supplementFor,
  supplementSentence,
} from '../src/core/content-supplement.ts';
import {
  auditGrammarHighlight,
  legacyFocusHighlights,
  resolveGrammarHighlights,
} from '../src/app/(study)/grammar/highlight.ts';
import { grammarPractice } from '../src/app/(study)/grammar/practice.ts';

const LEVELS = ['N5', 'N4', 'N3', 'N2'];

const LINKED_SENTENCES_SQL = `SELECT s.*, si.source_hash
  FROM item_sentences l
  JOIN sentences s ON s.item_id = l.sentence_id
  JOIN content_items si ON si.item_id = s.item_id AND si.is_active = 1
  WHERE l.item_id = ?
  ORDER BY l.position
  LIMIT 50`;

const GRAMMAR_PATTERNS_SQL = `SELECT g.item_id, g.pattern, g.level, g.formation_en, i.source_hash
  FROM grammar g
  JOIN content_items i USING(item_id)
  WHERE i.is_active = 1 AND g.level IN ('N5','N4','N3','N2')
  ORDER BY CASE g.level WHEN 'N5' THEN 0 WHEN 'N4' THEN 1 WHEN 'N3' THEN 2 ELSE 3 END, g.item_id`;

function emptyBucket() {
  return {
    patterns: 0,
    examples: 0,
    oldExamples: 0,
    supplementExamples: 0,
    highlighted: 0,
    unhighlighted: 0,
    mismatch: 0,
    mismatchReasons: {
      empty: 0,
      out_of_bounds: 0,
      overlapping: 0,
      whole_sentence: 0,
      pattern_mismatch: 0,
    },
    oldHighlighted: 0,
    oldUnhighlighted: 0,
    oldMismatch: 0,
    supplementHighlighted: 0,
    supplementUnhighlighted: 0,
    supplementMismatch: 0,
  };
}

function recordAudit(buckets, level, isSupp, audit) {
  for (const key of [level, 'ALL']) {
    const b = buckets[key];
    b.examples++;
    if (isSupp) b.supplementExamples++;
    else b.oldExamples++;

    if (audit.status === 'ok') {
      b.highlighted++;
      if (isSupp) b.supplementHighlighted++;
      else b.oldHighlighted++;
    } else if (audit.status === 'none') {
      b.unhighlighted++;
      if (isSupp) b.supplementUnhighlighted++;
      else b.oldUnhighlighted++;
    } else {
      b.mismatch++;
      if (isSupp) b.supplementMismatch++;
      else b.oldMismatch++;
      for (const r of audit.reasons) {
        if (r in b.mismatchReasons) b.mismatchReasons[r]++;
      }
    }
  }
}

export function reportGrammarHighlights(db, supplement = new Map()) {
  const linked = db.prepare(LINKED_SENTENCES_SQL);
  const patterns = db.prepare(GRAMMAR_PATTERNS_SQL).all();

  const legacy = {};
  const current = {};
  for (const lvl of [...LEVELS, 'ALL']) {
    legacy[lvl] = emptyBucket();
    current[lvl] = emptyBucket();
  }

  const fixedSupplementAudit = { total: 0, ok: 0, mismatch: 0, mismatchIds: [] };
  const remainingUnhighlighted = [];
  const remainingMismatches = [];

  for (const row of patterns) {
    const level = String(row.level);
    const grammarId = String(row.item_id);
    const pattern = String(row.pattern);
    const formationEn = row.formation_en == null ? null : String(row.formation_en);

    for (const key of [level, 'ALL']) {
      legacy[key].patterns++;
      current[key].patterns++;
    }

    const original = linked.all(grammarId).map((s) => {
      const japanese = String(s.text_ja);
      const baseFurigana = s.furigana_notation == null ? null : String(s.furigana_notation);
      const extra = supplementSentence(
        supplement,
        { id: String(s.item_id), hash: s.source_hash, japanese, furigana: baseFurigana },
        true,
      );
      return {
        id: String(s.item_id),
        japanese,
        furigana: extra.furigana,
        isSupp: false,
        fixedHighlights: undefined,
      };
    });

    const entry = supplementFor(supplement, grammarId, row.source_hash);
    const added = supplementExamples(
      entry,
      original.map((o) => o.japanese),
    ).map((s) => ({
      id: s.id,
      japanese: s.japanese,
      furigana: s.furigana,
      isSupp: true,
      fixedHighlights: s.highlights,
    }));

    for (const ex of [...original, ...added]) {
      const legacyRanges = ex.fixedHighlights?.length
        ? ex.fixedHighlights
        : legacyFocusHighlights(pattern, ex.japanese, ex.furigana);
      const legacyAudit = auditGrammarHighlight({
        pattern,
        japanese: ex.japanese,
        furigana: ex.furigana,
        formationEn,
        highlights: legacyRanges,
      });
      recordAudit(legacy, level, ex.isSupp, legacyAudit);

      const currentRanges = ex.fixedHighlights?.length
        ? ex.fixedHighlights
        : resolveGrammarHighlights(pattern, ex.japanese, ex.furigana, formationEn);
      const currentAudit = auditGrammarHighlight({
        pattern,
        japanese: ex.japanese,
        furigana: ex.furigana,
        formationEn,
        highlights: currentRanges,
      });
      recordAudit(current, level, ex.isSupp, currentAudit);

      if (ex.fixedHighlights?.length) {
        fixedSupplementAudit.total++;
        if (currentAudit.status === 'ok') fixedSupplementAudit.ok++;
        else {
          fixedSupplementAudit.mismatch++;
          fixedSupplementAudit.mismatchIds.push({
            grammarId,
            level,
            exampleId: ex.id,
            reasons: currentAudit.reasons,
          });
        }
      }

      if (currentAudit.status === 'none') {
        remainingUnhighlighted.push({
          grammarId,
          level,
          exampleId: ex.id,
          source: ex.isSupp ? 'supplement' : 'db',
        });
      } else if (currentAudit.status === 'mismatch') {
        remainingMismatches.push({
          grammarId,
          level,
          exampleId: ex.id,
          source: ex.isSupp ? 'supplement' : 'db',
          reasons: currentAudit.reasons,
        });
      }
    }
  }

  return {
    legacy,
    current,
    fixedSupplementAudit,
    remainingUnhighlighted,
    remainingMismatches,
  };
}

export function reportGrammarExerciseGapsByLevel(db, supplement = new Map()) {
  const linked = db.prepare(LINKED_SENTENCES_SQL);
  const patterns = db.prepare(GRAMMAR_PATTERNS_SQL).all();
  const allPatterns = db
    .prepare(
      'SELECT g.item_id, g.pattern FROM grammar g JOIN content_items i USING(item_id) WHERE i.is_active = 1 ORDER BY g.level, g.item_id',
    )
    .all();

  const byLevel = {};
  for (const lvl of [...LEVELS, 'ALL']) {
    byLevel[lvl] = {
      patterns: 0,
      choiceQuestions: 0,
      orderingQuestions: 0,
      fewerThanThreeChoice: 0,
      choiceShortfall: 0,
      fewerThanThreeOrdering: 0,
      orderingShortfall: 0,
      fewerThanThreeEither: 0,
    };
  }

  for (const row of patterns) {
    const level = String(row.level);
    const grammarId = String(row.item_id);
    const original = linked.all(grammarId).map((s) => ({
      id: String(s.item_id),
      japanese: String(s.text_ja),
      english: s.text_en == null ? null : String(s.text_en),
    }));
    const other = allPatterns
      .filter((p) => String(p.item_id) !== grammarId)
      .map((p) => String(p.pattern));
    const exercises = supplementFor(supplement, grammarId, row.source_hash)?.exercises;
    const practice = grammarPractice(String(row.pattern), original, other, exercises);
    const cShort = Math.max(0, 3 - practice.choices.length);
    const oShort = Math.max(0, 3 - practice.ordering.length);
    for (const key of [level, 'ALL']) {
      const b = byLevel[key];
      b.patterns++;
      b.choiceQuestions += practice.choices.length;
      b.orderingQuestions += practice.ordering.length;
      b.fewerThanThreeChoice += Number(practice.choices.length < 3);
      b.choiceShortfall += cShort;
      b.fewerThanThreeOrdering += Number(practice.ordering.length < 3);
      b.orderingShortfall += oShort;
      b.fewerThanThreeEither += Number(practice.choices.length < 3 || practice.ordering.length < 3);
    }
  }
  return byLevel;
}

function parseCliArgs(argv) {
  const positional = [];
  let includeExerciseGaps = false;
  let baselineSupplementPath = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--exercise-gaps') {
      includeExerciseGaps = true;
    } else if (arg === '--baseline-supplement') {
      baselineSupplementPath = argv[++i] ?? null;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node tools/report-grammar-highlight.mjs <snapshot.sqlite> [supplement.json] [--exercise-gaps] [--baseline-supplement <baseline.json>]',
      );
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }
  return {
    dbPath: positional[0],
    supplementPath: positional[1],
    includeExerciseGaps,
    baselineSupplementPath,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseCliArgs(process.argv.slice(2));
  if (!opts.dbPath) {
    console.error(
      'Usage: node tools/report-grammar-highlight.mjs <snapshot.sqlite> [supplement.json] [--exercise-gaps] [--baseline-supplement <baseline.json>]',
    );
    process.exit(1);
  }
  const supplement = opts.supplementPath ? readContentSupplement(opts.supplementPath) : new Map();
  const db = new DatabaseSync(opts.dbPath, { readOnly: true });
  try {
    const report = reportGrammarHighlights(db, supplement);
    if (opts.includeExerciseGaps) {
      report.exerciseGaps = opts.baselineSupplementPath
        ? {
            before: reportGrammarExerciseGapsByLevel(
              db,
              readContentSupplement(opts.baselineSupplementPath),
            ),
            after: reportGrammarExerciseGapsByLevel(db, supplement),
          }
        : reportGrammarExerciseGapsByLevel(db, supplement);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    db.close();
  }
}
