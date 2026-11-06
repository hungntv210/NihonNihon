import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from '../../../../tests/helpers.ts';
import { enqueueCard } from '../../../core/review.ts';
import { session, recordReview } from './repository.ts';
import { scheduler, hydrate, VERSION, appendReview } from './model.ts';
const created = new Date('2026-11-06T09:00:00Z'), now = new Date('2026-11-06T10:00:00Z');
test('quick sessions cap at15, full sessions20; quick excludes grammar and listening',async t=>{
 const {db,file}=fixture(t);for(const r of db.prepare('SELECT item_id FROM vocab').all())for(const type of ['recognition','reading','recall','listening'] as const)enqueueCard(file,String(r.item_id),type,created);
 enqueueCard(file,String(db.prepare('SELECT item_id FROM grammar LIMIT 1').get()!.item_id),'recognition',created);
 const e=await scheduler(), quick=session(db,e,'quick',now),full=session(db,e,'full',now);
 assert.equal(quick.cards.length,15);assert.equal(quick.due,24);assert.ok(quick.cards.every(c=>c.kind!=='grammar'&&c.type!=='listening'));assert.equal(full.cards.length,20);assert.equal(full.due,33);assert.equal(full.forecast[0].count,33);
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
