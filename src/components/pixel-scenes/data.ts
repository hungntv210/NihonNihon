import type {DatabaseSync} from 'node:sqlite';
// Same learned criterion as JLPT: at least one actual SRS review, not merely enqueued.
export function learnedKanjiCount(db:DatabaseSync){return Number(db.prepare(`SELECT count(DISTINCT k.item_id) n FROM kanji k JOIN content_items i USING(item_id) JOIN srs_cards c USING(item_id) JOIN srs_reviews r USING(card_id) WHERE i.is_active=1`).get()!.n);}
