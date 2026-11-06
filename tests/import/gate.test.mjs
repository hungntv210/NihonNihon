import test from 'node:test';import assert from 'node:assert/strict';import {inspectBatch,summarizeGate} from '../../tools/data/translation-gate.mjs';
test('quality gate identifies malformed/missing, empty, copied Japanese, length and NFC defects',()=>{
 const req=Array.from({length:4},(_,i)=>({request_id:String(i),task:'translate',input:{ja:'私は学生です。'}}));
 assert.equal(inspectBatch('{',req).json_invalid,1);
 const rows=[{request_id:'0',output:{text_vi:''}},{request_id:'1',output:{text_vi:'私は学生です。'}},{request_id:'2',output:{text_vi:'a'.repeat(100)}}];const r=inspectBatch(JSON.stringify(rows),req);assert.equal(r.missing,1);assert.equal(r.empty,1);assert.equal(r.source_copy,1);assert.equal(r.japanese_left,1);assert.equal(r.length_outlier,1);
 const n=inspectBatch(JSON.stringify([{request_id:'0',output:{text_vi:'Việt'.normalize('NFD')}}]),req.slice(0,1));assert.equal(n.non_nfc,1);
 const summary=summarizeGate([{http_status:200,qa:r},{http_status:503}],3);assert.equal(summary.api_requests,2);assert.equal(summary.http_errors,1);assert.equal(summary.rates_percent.empty,25);assert.equal(summary.status,'REVIEW_REQUIRED');
});
