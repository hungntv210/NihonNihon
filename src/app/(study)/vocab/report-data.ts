import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
export function reportTranslation(
  file: string,
  itemId: string,
  translationId: string,
  reason: string,
) {
  const text = reason.normalize('NFC').trim();
  if (
    !itemId ||
    itemId.length > 256 ||
    !translationId ||
    translationId.length > 256 ||
    text.length < 5 ||
    text.length > 1000
  )
    throw Error('INVALID_REPORT');
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const target = db
      .prepare(
        `SELECT t.translation_id FROM vi_translations t JOIN content_items i USING(item_id) WHERE t.translation_id=? AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash AND i.is_active=1 AND (i.item_id=? OR EXISTS(SELECT 1 FROM item_sentences x WHERE x.item_id=? AND x.sentence_id=i.item_id)) AND EXISTS(SELECT 1 FROM vocab v JOIN content_items vi ON vi.item_id=v.item_id WHERE v.item_id=? AND vi.is_active=1)`,
      )
      .get(translationId, itemId, itemId, itemId);
    if (!target) throw Error('REPORT_NOT_FOUND');
    const old = db
      .prepare(
        "SELECT report_id FROM translation_reports WHERE translation_id=? AND reason=? AND status='open'",
      )
      .get(translationId, text);
    if (old) {
      db.exec('COMMIT');
      return { reportId: String(old.report_id), created: false };
    }
    const reportId = randomUUID();
    db.prepare(
      'INSERT INTO translation_reports(report_id,translation_id,reason,reported_at) VALUES(?,?,?,?)',
    ).run(reportId, translationId, text, new Date().toISOString());
    db.exec('COMMIT');
    return { reportId, created: true };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    db.close();
  }
}
