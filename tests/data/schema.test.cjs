const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const schema = fs.readFileSync(path.join(__dirname, '../../docs/data/schema.draft.sql'), 'utf8');
const A = 'a'.repeat(64), B = 'b'.repeat(64);

function setup(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); db.exec(schema);
  db.prepare('INSERT INTO data_sources VALUES (?,?,?,?,?,?,?,?,?)').run('test', 'Synthetic fixture', 'https://example.invalid', 'test-only', null, null, null, 'Original synthetic fixture', 'private_only');
  for (const [id, version, hash] of [['r1','1',A],['r2','2',B]])
    db.prepare('INSERT INTO source_releases VALUES (?,?,?,?,?,?,?,?)').run(id, 'test', version, hash, 'https://example.invalid/test.json', '2026-11-05T00:00:00Z', 'test-only', 'Synthetic');
  db.prepare('INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES (?,?,?,?,?,?)').run('test:vocab:1', 'vocab', 'test', '1', 'r1', A);
  db.prepare('INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en) VALUES (?,?,?,?,?,?)').run('test:vocab:1', '方', 'かた', 'kata', 'N4', '["synthetic meaning"]');
  return db;
}
function translation(db, id = 'tr1', status = 'selected') {
  db.prepare(`INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, 'test:vocab:1', 'meaning', 'nghĩa thử nghiệm', 'machine', 'test', 'r1', id, A, status, 'machine_context', '2026-11-05T00:00:00Z');
}
function card(db) {
  db.prepare('INSERT INTO srs_cards VALUES (?,?,?,?,?,?,?)').run('card1', 'test:vocab:1', 'recognition', '{"stability":2}', 'draft-test', '2026-11-06T00:00:00Z', '2026-11-05T00:00:00Z');
  db.prepare('INSERT INTO srs_reviews VALUES (?,?,?,?,?,?)').run('review1', 'card1', 3, '2026-11-05T00:00:00Z', 500, 'draft-test');
}
test('draft creates 20 tables, with foreign keys enabled and no violations', t => {
  const db = setup(t);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table'").get().n, 20);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
test('subtypes and source release must reference the correct parent', t => {
  const db = setup(t);
  assert.throws(() => db.prepare('INSERT INTO grammar(item_id,pattern,romaji,level,meaning_en,formation_en,tags) VALUES (?,?,?,?,?,?,?)').run('test:vocab:1','〜','test','N3','test','test','[]'), /FOREIGN KEY/);
  db.prepare('INSERT INTO data_sources VALUES (?,?,?,?,?,?,?,?,?)').run('other','Other','https://example.invalid','test',null,null,null,'Synthetic','unverified');
  assert.throws(() => db.prepare('INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES (?,?,?,?,?,?)').run('bad','vocab','other','2','r1',A), /FOREIGN KEY/);
  assert.throws(() => db.prepare('INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en) VALUES (?,?,?,?,?,?)').run('missing','字','じ','ji','N5','["test"]'), /FOREIGN KEY/);
});
test('same written word with different reading keeps a separate stable identity', t => {
  const db = setup(t); card(db);
  db.prepare('INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES (?,?,?,?,?,?)').run('test:vocab:2','vocab','test','2','r1',A);
  db.prepare('INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en) VALUES (?,?,?,?,?,?)').run('test:vocab:2','方','ほう','hou','N3','["other synthetic meaning"]');
  assert.equal(db.prepare("SELECT count(*) n FROM vocab WHERE word='方'").get().n, 2);
  assert.equal(db.prepare('SELECT item_id FROM srs_cards').get().item_id, 'test:vocab:1');
});
test('sample source upsert preserves translation text, cards, and review history', t => {
  const db = setup(t); translation(db); card(db);
  const before = db.prepare('SELECT * FROM srs_cards').all(), reviews = db.prepare('SELECT * FROM srs_reviews').all();
  const update = () => {
    db.exec('BEGIN');
    db.prepare(`INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES (?,?,?,?,?,?)
      ON CONFLICT(item_id) DO UPDATE SET release_id=excluded.release_id,source_hash=excluded.source_hash`).run('test:vocab:1','vocab','test','1','r2',B);
    db.prepare('UPDATE vocab SET reading=?, meanings_en=? WHERE item_id=?').run('かた','["corrected source meaning"]','test:vocab:1');
    db.exec('UPDATE vi_translations SET needs_refresh=1 WHERE base_content_hash<>(SELECT source_hash FROM content_items WHERE item_id=vi_translations.item_id)');
    db.exec('COMMIT');
  };
  update(); update();
  assert.equal(db.prepare('SELECT count(*) n FROM content_items').get().n, 1);
  const tr = db.prepare('SELECT * FROM vi_translations').get();
  assert.equal(tr.translation_id, 'tr1'); assert.equal(tr.text_vi, 'nghĩa thử nghiệm'); assert.equal(tr.needs_refresh, 1); assert.equal(tr.base_content_hash,A);
  assert.deepEqual(db.prepare('SELECT * FROM srs_cards').all(), before);
  assert.deepEqual(db.prepare('SELECT * FROM srs_reviews').all(), reviews);
});
test('only one translation is selected per field, with alternative candidates retained', t => {
  const db = setup(t); translation(db);
  assert.throws(() => translation(db, 'tr2'), /UNIQUE/);
  translation(db, 'tr2','candidate');
  db.exec("BEGIN; UPDATE vi_translations SET status='needs_review' WHERE translation_id='tr1'; UPDATE vi_translations SET status='selected' WHERE translation_id='tr2'; COMMIT;");
  assert.equal(db.prepare('SELECT count(*) n FROM vi_translations').get().n, 2);
  assert.equal(db.prepare("SELECT translation_id FROM vi_translations WHERE status='selected'").get().translation_id, 'tr2');
});
test('failed transaction rolls source changes back', t => {
  const db = setup(t);
  db.exec('BEGIN');
  db.prepare('UPDATE content_items SET source_hash=?').run(B);
  assert.throws(() => db.exec("UPDATE vocab SET level='N0'"), /CHECK/);
  db.exec('ROLLBACK');
  assert.equal(db.prepare('SELECT source_hash FROM content_items').get().source_hash, A);
});
test('soft retirement keeps progress and translations; physical deletion is rejected', t => {
  const db = setup(t); translation(db); card(db);
  db.exec('UPDATE content_items SET is_active=0');
  assert.equal(db.prepare('SELECT count(*) n FROM srs_reviews').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM vi_translations').get().n, 1);
  assert.throws(() => db.exec('DELETE FROM content_items'), /FOREIGN KEY/);
  assert.throws(() => db.exec('DELETE FROM source_releases'), /FOREIGN KEY/);
});
test('invalid JSON, empty mandatory meanings, and invalid review ratings fail', t => {
  const db = setup(t); card(db);
  assert.throws(() => db.exec("UPDATE vocab SET meanings_en='not-json'"));
  assert.throws(() => db.exec("UPDATE vocab SET meanings_en='[]'"), /CHECK/);
  assert.throws(() => db.exec('UPDATE srs_reviews SET rating=5'), /CHECK/);
});
test('spec has all five parts and audit agrees with recorded source counts', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../../docs/data/data-source-spec.md'),'utf8');
  assert.equal((doc.match(/^## [1-5]\. /gm) || []).length, 5);
  const audit = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/data/source-audit.json'),'utf8'));
  assert.equal(audit.files.length,15);
  assert.ok(audit.files.every(f => /^[0-9a-f]{64}$/.test(f.sha256) && f.duplicate_keys_across_levels === 0));
  assert.equal(audit.n5_n2.vocab,4741); assert.equal(audit.n5_n2.ambiguous_headwords.length,22);
  assert.equal(audit.n5_n2.without_examples,166);
});
