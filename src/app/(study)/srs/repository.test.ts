import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from '../../../../tests/helpers.ts';
import { enqueueCard } from '../../../core/review.ts';
import { session, recordReview } from './repository.ts';
import { scheduler, hydrate, VERSION, appendReview } from './model.ts';
const created = new Date('2026-11-06T09:00:00Z'), now = new Date('2026-11-06T10:00:00Z');
test('quick sessions select only vocab/kanji recognition and cap at15; full sessions cap at20',async t=>{
 const {db,file,itemId}=fixture(t);
 const items=db.prepare("SELECT item_id FROM content_items WHERE kind IN ('vocab','kanji') ORDER BY item_id").all();
 for(const row of items)for(const type of ['recognition','reading','recall','listening'] as const)enqueueCard(file,String(row.item_id),type,created);
 enqueueCard(file,String(db.prepare('SELECT item_id FROM grammar LIMIT 1').get()!.item_id),'recognition',created);
 const e=await scheduler(), quick=session(db,e,'quick',now),full=session(db,e,'full',now);
 assert.equal(quick.cards.length,12);assert.equal(quick.due,12);
 assert.deepEqual(quick.cards.map(c=>c.itemId).sort(),items.map(r=>String(r.item_id)).sort());
 assert.deepEqual([...new Set(quick.cards.map(c=>c.type))],['recognition']);
 assert.deepEqual([...new Set(quick.cards.map(c=>c.kind))].sort(),['kanji','vocab']);
 assert.equal(full.cards.length,20);assert.equal(full.due,49);assert.equal(full.forecast[0].count,49);
 // Duplicate public fixture vocabulary under synthetic test IDs to exceed the quick limit.
 for(let n=0;n<4;n++){
  const id=`test:quick-limit:${n}`;
  db.prepare(`INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash)
   SELECT ?,kind,source_id,?,release_id,source_hash FROM content_items WHERE item_id=?`).run(id,id,itemId);
  db.prepare(`INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos,jmdict_id)
   SELECT ?,word,reading,romaji,level,meanings_en,pos,jmdict_id FROM vocab WHERE item_id=?`).run(id,itemId);
  enqueueCard(file,id,'recognition',created);
 }
 const capped=session(db,e,'quick',now);
 assert.equal(capped.cards.length,15);assert.equal(capped.due,16);
 assert.ok(capped.cards.every(c=>c.type==='recognition'&&['vocab','kanji'].includes(c.kind)));
 assert.equal(session(db,e,'full',now).cards.length,20);
});
test('ratings persist real FSRS state once; receipt replay is idempotent and schema unchanged',async t=>{
 const {db,file,itemId}=fixture(t), initial=enqueueCard(file,itemId,'recognition',created), schema=db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all();
 const event={reviewId:randomUUID(),cardId:initial.cardId,rating:3,reviewedAt:now.toISOString(),baseUpdatedAt:created.toISOString(),elapsedMs:1200};
 assert.equal((await recordReview(file,event,now)).duplicate,false);assert.equal((await recordReview(file,event,now)).duplicate,true);assert.equal(db.prepare('SELECT count(*) n FROM srs_reviews').get()!.n,1);
 const row=db.prepare('SELECT * FROM srs_cards').get()!;assert.equal(row.scheduler_version,VERSION);assert.equal(JSON.parse(String(row.state_json)).reps,1);assert.ok(String(row.due_at)>now.toISOString());assert.deepEqual(db.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all(),schema);
 await assert.rejects(()=>recordReview(file,{...event,rating:4},now),/REUSED/);
 await assert.rejects(()=>recordReview(file,{...event,reviewId:randomUUID()},now),/CONFLICT/);
});
test('invalid/future ratings and inactive cards cannot write history',async t=>{
 const {db,file,itemId}=fixture(t),card=enqueueCard(file,itemId,'recognition',created),event={reviewId:randomUUID(),cardId:card.cardId,rating:0,reviewedAt:now.toISOString(),baseUpdatedAt:created.toISOString(),elapsedMs:0};
 await assert.rejects(()=>recordReview(file,event,now),/INVALID/);await assert.rejects(()=>recordReview(file,{...event,rating:3,reviewedAt:new Date(now.getTime()+3600000).toISOString()},now),/TIME/);
 db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(itemId);await assert.rejects(()=>recordReview(file,{...event,rating:3},now),/NOT_FOUND/);assert.equal(db.prepare('SELECT count(*) n FROM srs_reviews').get()!.n,0);
});
test('unknown or malformed scheduler state is not reset or shown as a due card',async t=>{
 const {db,file,itemId}=fixture(t),card=enqueueCard(file,itemId,'recognition',created);db.prepare('UPDATE srs_cards SET scheduler_version=? WHERE card_id=?').run('unknown',card.cardId);
 const result=session(db,await scheduler(),'full',now);assert.equal(result.cards.length,0);assert.equal(result.unsupported,1);assert.equal(db.prepare('SELECT scheduler_version FROM srs_cards').get()!.scheduler_version,'unknown');
 assert.throws(()=>hydrate({cardId:'a',schedulerVersion:VERSION,dueAt:now.toISOString(),updatedAt:now.toISOString(),stateJson:'{}'},{} as never));
});
test('outbox event IDs cannot be overwritten by a different rating',()=>{
 const event={reviewId:randomUUID(),cardId:'card',rating:3,reviewedAt:now.toISOString(),baseUpdatedAt:created.toISOString(),elapsedMs:10};assert.equal(appendReview([event],event).length,1);assert.throws(()=>appendReview([event],{...event,rating:4}),/REUSED/);
});
