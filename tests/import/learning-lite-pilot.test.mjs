import test from 'node:test';import assert from 'node:assert/strict';import {pilotRequests,learningSample} from '../../tools/data/learning-lite-pilot.mjs';import {sha} from '../../tools/data/core.mjs';
test('pilot selects exactly60 unfinished learning requests with20 Han Viet and no sentences',()=>{
 const request=(i,task)=>({request_id:String(i),task,input:{item_id:String(i),field:task==='han_viet'?'han_viet':'meaning'}}),hv=Array.from({length:21},(_,i)=>request(i,'han_viet')),other=Array.from({length:50},(_,i)=>request(i+100,'translate'));
 const cache={sentenceDone:new Map(),learningDone:new Map([[sha({task:hv[0].task,input:hv[0].input}),true]])};const rows=pilotRequests([...hv,...other,{task:'translate',input:{ja:'文',field:'text'}}],cache);assert.equal(rows.length,60);assert.equal(rows.filter(r=>r.task==='han_viet').length,20);assert.ok(!rows.includes(hv[0]));assert.ok(rows.every(r=>r.input.field!=='text'));
});
test('learning review samples30 distinct items including10 Han Viet and preserves actual models',()=>{
 const rows=Array.from({length:60},(_,i)=>({request:{task:i<20?'han_viet':'translate'},row:{request_id:String(i),output:{text_vi:'Nghĩa'}},model:i%2?'gemini-3.5-flash-lite':'gemini-3.1-flash-lite',manifest:'private'}));const sample=learningSample(rows);assert.equal(sample.length,30);assert.equal(new Set(sample.map(r=>r.request_id)).size,30);assert.equal(sample.filter(r=>r.request.task==='han_viet').length,10);assert.ok(sample.every(r=>r.model.startsWith('gemini-3.')));
});
