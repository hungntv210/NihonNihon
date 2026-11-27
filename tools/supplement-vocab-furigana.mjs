import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { furiganaMatches, readContentSupplement, supplementSentence } from '../src/core/content-supplement.ts';
import { buildSentenceFurigana, loadShadowingTokenizer } from '../src/app/(study)/shadowing/auto-meta-server.ts';
import { reviewVocabFurigana } from './vocab-furigana-review.ts';

const [snapshot, baseline, output, reviewQueue] = process.argv.slice(2);
if (!snapshot || !baseline || !output || !reviewQueue || process.argv.length !== 6) {
  throw new Error('Usage: node --import tsx tools/supplement-vocab-furigana.mjs <snapshot.sqlite> <baseline.json> <new-output.json> <new-review-queue.json>');
}
if (path.resolve(output) === path.resolve(reviewQueue) || [output, reviewQueue].some(file => fs.existsSync(file))) {
  throw new Error('Both output paths must be distinct new files');
}
const raw = JSON.parse(fs.readFileSync(baseline, 'utf8'));
const supplement = readContentSupplement(baseline);
const tokenizer = await loadShadowingTokenizer();
if (!tokenizer) throw new Error('The local Kuromoji dictionary could not be loaded');
const db = new DatabaseSync(snapshot, { readOnly: true });
const pending = [];
const changes = { written: {}, pending: {} };
let added = 0, updated = 0;
function review(id, japanese, notation, tokens, targets, inherited, extraReasons = []) {
  const result = reviewVocabFurigana(japanese, notation, tokens, targets);
  const reasons = [...new Set([...result.reasons, ...extraReasons])];
  if (reasons.length) pending.push({ id, japanese, furigana: result.furigana, reasons, retainedApproved: inherited });
  const counts = reasons.length && !inherited ? changes.pending : changes.written;
  for (const [rule, n] of Object.entries(result.changes)) counts[rule] = (counts[rule] ?? 0) + n;
  return { ...result, reasons };
}

try {
  const sentences = db.prepare(`SELECT DISTINCT s.item_id AS id, si.source_hash AS hash,
    s.text_ja AS japanese, s.furigana_notation AS furigana
    FROM vocab v JOIN content_items vi ON vi.item_id=v.item_id AND vi.is_active=1
    JOIN item_sentences l ON l.item_id=v.item_id
    JOIN sentences s ON s.item_id=l.sentence_id
    JOIN content_items si ON si.item_id=s.item_id AND si.is_active=1
    WHERE v.level IN ('N5','N4','N3','N2') ORDER BY s.item_id`).all();
  const forms = db.prepare(`SELECT v.word,v.reading FROM vocab v WHERE v.item_id=?
    UNION SELECT f.form word,v.reading FROM vocab v JOIN vocab_forms f USING(item_id)
    WHERE v.item_id=? AND f.form_kind='writing'`);
  const targets = id => forms.all(id,id);
  const linked = db.prepare(`SELECT DISTINCT v.item_id FROM item_sentences l JOIN vocab v ON v.item_id=l.item_id
    JOIN content_items i ON i.item_id=v.item_id AND i.is_active=1
    WHERE l.sentence_id=? AND v.level IN ('N5','N4','N3','N2')`);
  const activeVocab = db.prepare(`SELECT i.source_hash FROM vocab v JOIN content_items i USING(item_id)
    WHERE v.item_id=? AND i.is_active=1 AND v.level IN ('N5','N4','N3','N2')`);

  for (const sentence of sentences) {
    const existing = supplementSentence(supplement, sentence, true).furigana;
    const hasExisting = existing?.trim() && furiganaMatches(sentence.japanese, existing);
    const inherited = Boolean(hasExisting && existing !== sentence.furigana);
    if (hasExisting && !inherited) continue;
    const entry = raw.items[sentence.id];
    const { furigana, tokens } = buildSentenceFurigana(sentence.japanese, tokenizer);
    const words = linked.all(sentence.id).flatMap(row => targets(row.item_id));
    const result = review(sentence.id, sentence.japanese, inherited ? existing : furigana, tokens, words,
      inherited, entry && entry.hash !== sentence.hash ? ['source-hash-mismatch'] : []);
    // A previously approved annotation stays available when the review is inconclusive.
    // Only a structurally valid, deterministic correction can update it.
    if ((!inherited && result.reasons.length) || !furiganaMatches(sentence.japanese, result.furigana)
      || result.reasons.includes('unresolved-notation') || result.reasons.includes('source-hash-mismatch')) continue;
    if (inherited && result.furigana === existing) continue;
    raw.items[sentence.id] = { ...entry, hash: sentence.hash, furigana: result.furigana };
    if (inherited) updated++;
    else added++;
  }

  for (const [itemId, entry] of Object.entries(raw.items)) {
    if (!entry.examples?.length || activeVocab.get(itemId)?.source_hash !== entry.hash) continue;
    const words = targets(itemId);
    for (const example of entry.examples) {
      const { tokens } = buildSentenceFurigana(example.japanese, tokenizer);
      const result = review(example.id, example.japanese, example.furigana, tokens, words, true);
      if (result.furigana === example.furigana || result.reasons.includes('unresolved-notation')) continue;
      example.furigana = result.furigana;
      updated++;
    }
  }
} finally {
  db.close();
}
fs.writeFileSync(output, JSON.stringify(raw, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
readContentSupplement(output);
fs.writeFileSync(reviewQueue, JSON.stringify(pending, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ added, updated, changes, pending: pending.length, withheld: pending.filter(x=>!x.retainedApproved).length }));
