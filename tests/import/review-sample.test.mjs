import test from 'node:test';import assert from 'node:assert/strict';import {stratifiedSample} from '../../tools/data/review-sample.mjs';
test('review sample has 30 distinct sentences split 8/8/7/7 and refuses undersized strata',()=>{
 const rows=['N5','N4','N3','N2'].flatMap(level=>Array.from({length:10},(_,i)=>({level,ja:level+' sentence '+i,en:'synthetic',vi:'thử nghiệm'})));
 const sample=stratifiedSample(rows,undefined,()=>0);assert.equal(sample.length,30);assert.equal(new Set(sample.map(r=>r.ja)).size,30);assert.deepEqual(Object.fromEntries(['N5','N4','N3','N2'].map(l=>[l,sample.filter(r=>r.level===l).length])),{N5:8,N4:8,N3:7,N2:7});assert.throws(()=>stratifiedSample(rows.filter(r=>r.level!=='N2')),/Not enough/);
});
