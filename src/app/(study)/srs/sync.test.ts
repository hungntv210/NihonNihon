import test from 'node:test';
import assert from 'node:assert/strict';
import { syncReviews } from './sync.ts';
const event=(id:string,cardId:string)=>({reviewId:id,cardId,rating:3,reviewedAt:'2026-11-06T10:00:00Z',baseUpdatedAt:'',elapsedMs:0});
test('conflicts stay durable without blocking independent cards or violating same-card order',async()=>{
 const sent:string[]=[],acked:string[]=[];const result=await syncReviews([event('a','one'),event('b','one'),event('c','two')],async e=>{sent.push(e.reviewId);return e.reviewId==='a'?new Response('{}',{status:409}):Response.json({reviewId:e.reviewId});},async id=>{acked.push(id);});
 assert.deepEqual(sent,['a','c']);assert.deepEqual(acked,['c']);assert.equal(result.conflicts[0].reviewId,'a');
});
test('temporary errors leave current and later events untouched',async()=>{
 const acked:string[]=[];const result=await syncReviews([event('a','one'),event('b','two')],async()=>new Response('{}',{status:503}),async id=>{acked.push(id);});assert.equal(result.stopped,'temporary');assert.deepEqual(acked,[]);
});
