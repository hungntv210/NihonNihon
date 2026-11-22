import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const DEFAULT_REPORT_REASON = 'Đánh dấu cần xem lại';

export type MarkReportResult = {
  reportId: string;
  translationId: string;
  created: boolean;
};

export function markTranslationReport(
  file: string,
  translationId: unknown,
  reasonInput?: unknown,
  now = new Date(),
): MarkReportResult {
  if (typeof translationId !== 'string') {
    throw new Error('INVALID_REPORT');
  }
  const id = translationId.normalize('NFC').trim();
  if (!id || id.length > 256) {
    throw new Error('INVALID_REPORT');
  }

  let normalizedReason = DEFAULT_REPORT_REASON;
  let isQuickMark = true;
  if (reasonInput !== undefined && reasonInput !== null && reasonInput !== '') {
    if (typeof reasonInput !== 'string') {
      throw new Error('INVALID_REPORT');
    }
    const trimmed = reasonInput.normalize('NFC').trim();
    if (trimmed.length < 3 || trimmed.length > 1000) {
      throw new Error('INVALID_REPORT');
    }
    normalizedReason = trimmed;
    isQuickMark = false;
  }

  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const translation = db
      .prepare(
        `SELECT t.translation_id FROM vi_translations t
         JOIN content_items i USING(item_id)
         WHERE t.translation_id=? AND i.is_active=1
           AND t.status='selected' AND t.needs_refresh=0
           AND t.base_content_hash=i.source_hash`,
      )
      .get(id);
    if (!translation) {
      throw new Error('TRANSLATION_NOT_FOUND');
    }

    const prior = isQuickMark
      ? db
          .prepare(
            `SELECT report_id FROM translation_reports
             WHERE translation_id=? AND status='open'
             ORDER BY reported_at ASC LIMIT 1`,
          )
          .get(id)
      : db
          .prepare(
            `SELECT report_id FROM translation_reports
             WHERE translation_id=? AND reason=? AND status='open'
             LIMIT 1`,
          )
          .get(id, normalizedReason);

    const reportId = prior ? String(prior.report_id) : randomUUID();
    if (!prior) {
      db.prepare(
        `INSERT INTO translation_reports(report_id, translation_id, reason, reported_at, status)
         VALUES(?, ?, ?, ?, 'open')`,
      ).run(reportId, id, normalizedReason, now.toISOString());
    }
    db.exec('COMMIT');
    return { reportId, translationId: id, created: !prior };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback error if transaction was not active.
    }
    throw error;
  } finally {
    db.close();
  }
}
