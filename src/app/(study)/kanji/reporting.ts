import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
export function reportKanjiTranslation(file: string, translationId: string, reason: string) {
  if (
    typeof translationId !== 'string' ||
    !translationId ||
    translationId.length > 256 ||
    typeof reason !== 'string'
  )
    throw Error('INVALID_REPORT');
  const normalized = reason.normalize('NFC').trim();
  if (normalized.length < 3 || normalized.length > 500) throw Error('INVALID_REPORT');
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const translation = db
      .prepare(
        `SELECT t.translation_id FROM vi_translations t JOIN content_items i USING(item_id) WHERE t.translation_id=?
      AND i.kind='kanji' AND i.is_active=1 AND t.field IN ('meaning','han_viet') AND t.status='selected' AND t.needs_refresh=0 AND t.base_content_hash=i.source_hash`,
      )
      .get(translationId);
    if (!translation) throw Error('STALE_TRANSLATION');
    const prior = db
      .prepare(
        "SELECT report_id FROM translation_reports WHERE translation_id=? AND reason=? AND status='open' LIMIT 1",
      )
      .get(translationId, normalized);
    const id = prior ? String(prior.report_id) : randomUUID();
    if (!prior)
      db.prepare(
        "INSERT INTO translation_reports(report_id,translation_id,reason,reported_at,status) VALUES(?,?,?,?,'open')",
      ).run(id, translationId, normalized, new Date().toISOString());
    db.exec('COMMIT');
    return { reportId: id, created: !prior };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    db.close();
  }
}
