import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { furiganaMatches, readContentSupplement, supplementSentence } from '../src/core/content-supplement.ts';
import { buildSentenceFurigana, loadShadowingTokenizer } from '../src/app/(study)/shadowing/auto-meta-server.ts';

const [snapshot, baseline, output] = process.argv.slice(2);
if (!snapshot || !baseline || !output || process.argv.length !== 5) {
  throw new Error('Usage: node --import tsx tools/supplement-vocab-furigana.mjs <snapshot.sqlite> <baseline.json> <new-output.json>');
}
const raw = JSON.parse(fs.readFileSync(baseline, 'utf8'));
const supplement = readContentSupplement(baseline);
const tokenizer = await loadShadowingTokenizer();
if (!tokenizer) throw new Error('The local Kuromoji dictionary could not be loaded');
const db = new DatabaseSync(snapshot, { readOnly: true });
const pending = [];
let added = 0;
try {
  const sentences = db.prepare(`SELECT DISTINCT s.item_id AS id, si.source_hash AS hash,
    s.text_ja AS japanese, s.furigana_notation AS furigana
    FROM vocab v JOIN content_items vi ON vi.item_id=v.item_id AND vi.is_active=1
    JOIN item_sentences l ON l.item_id=v.item_id
    JOIN sentences s ON s.item_id=l.sentence_id
    JOIN content_items si ON si.item_id=s.item_id AND si.is_active=1
    WHERE v.level IN ('N5','N4','N3','N2') ORDER BY s.item_id`).all();

  for (const sentence of sentences) {
    const existing = supplementSentence(supplement, sentence, true).furigana;
    if (existing?.trim() && furiganaMatches(sentence.japanese, existing)) continue;
    const entry = raw.items[sentence.id];
    const { furigana } = buildSentenceFurigana(sentence.japanese, tokenizer);
    if ((entry && entry.hash !== sentence.hash) || !furiganaMatches(sentence.japanese, furigana)
      || /\{[^{}|]*[\p{Script=Hiragana}\p{Script=Katakana}?]\|/u.test(furigana)) {
      pending.push(sentence.id);
      continue;
    }
    raw.items[sentence.id] = { ...entry, hash: sentence.hash, furigana };
    added++;
  }
} finally {
  db.close();
}
fs.writeFileSync(output, JSON.stringify(raw, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
readContentSupplement(output);
console.log(JSON.stringify({ added, pending }));
