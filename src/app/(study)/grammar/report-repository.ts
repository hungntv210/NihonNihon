import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export function saveGrammarReport(
  file: string,
  input: { grammarId: string; translationId: string; reason: string },
  now = new Date(),
) {
  if (
    typeof input.grammarId !== 'string' ||
    input.grammarId.length > 256 ||
    typeof input.translationId !== 'string' ||
    input.translationId.length > 256 ||
    typeof input.reason !== 'string'
  )
    throw Error('INVALID_REPORT');
  const reason = input.reason.normalize('NFC').trim();
  if (reason.length < 3 || reason.length > 1000) throw Error('INVALID_REPORT');
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const row = db
      .prepare(
        `SELECT t.translation_id FROM vi_translations t JOIN content_items i USING(item_id) JOIN content_items g ON g.item_id=? AND g.kind='grammar' AND g.is_active=1 WHERE t.translation_id=? AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash AND i.is_active=1 AND (t.item_id=g.item_id OR EXISTS(SELECT 1 FROM item_sentences l WHERE l.item_id=g.item_id AND l.sentence_id=t.item_id))`,
      )
      .get(input.grammarId, input.translationId);
    if (!row) throw Error('REPORT_NOT_FOUND');
    const previous = db
      .prepare(
        "SELECT report_id FROM translation_reports WHERE translation_id=? AND reason=? AND status='open' LIMIT 1",
      )
      .get(input.translationId, reason);
    const id = previous ? String(previous.report_id) : randomUUID();
    if (!previous)
      db.prepare(
        "INSERT INTO translation_reports(report_id,translation_id,reason,reported_at,status) VALUES(?,?,?,?,'open')",
      ).run(id, input.translationId, reason, now.toISOString());
    db.exec('COMMIT');
    return { reportId: id, created: !previous };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    db.close();
  }
}
