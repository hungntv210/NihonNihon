import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const cardTypes = [
  'recognition',
  'recall',
  'reading',
  'cloze',
  'listening',
  'shadow',
] as const;
export type CardType = (typeof cardTypes)[number];

export function enqueueCard(file: string, itemId: string, cardType: CardType, now = new Date()) {
  if (typeof itemId !== 'string' || !itemId || itemId.length > 256 || !cardTypes.includes(cardType))
    throw new Error('INVALID_CARD');
  // The connection writes only srs_cards; content readers use a separate read-only connection.
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const item = db
      .prepare('SELECT kind FROM content_items WHERE item_id=? AND is_active=1')
      .get(itemId);
    if (!item) throw new Error('ITEM_NOT_FOUND');
    if (cardType === 'shadow' && item.kind !== 'clip') throw new Error('INVALID_CARD');
    const time = now.toISOString();
    const insert = db
      .prepare(
        `INSERT INTO srs_cards(card_id,item_id,card_type,state_json,scheduler_version,due_at,updated_at)
      VALUES(?,?,?,'{"status":"new"}','pending:g1/srs',?,?) ON CONFLICT(item_id,card_type) DO NOTHING`,
      )
      .run(randomUUID(), itemId, cardType, time, time);
    const row = db
      .prepare('SELECT card_id,due_at FROM srs_cards WHERE item_id=? AND card_type=?')
      .get(itemId, cardType)!;
    db.exec('COMMIT');
    return {
      cardId: String(row.card_id),
      dueAt: String(row.due_at),
      created: Number(insert.changes) === 1,
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
