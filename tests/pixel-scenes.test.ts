import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {gzipSync} from 'node:zlib';import {randomUUID} from 'node:crypto';
import {sceneClock,shadowProgress} from '../src/components/pixel-scenes/model.ts';import {learnedKanjiCount} from '../src/components/pixel-scenes/data.ts';import {fixture} from './helpers.ts';import {enqueueCard} from '../src/core/review.ts';
test('scene clock uses Vietnam date/time including UTC month crossover and four real seasons',()=>{
 assert.equal(sceneClock(new Date('2026-11-15T22:00:00Z')).date,'2026-11-16');
 for(const [iso,period,season]of [['2026-02-28T22:00:00Z','morning','spring'],['2026-06-15T05:00:00Z','day','summer'],['2026-09-15T10:30:00Z','sunset','autumn'],['2026-12-15T14:00:00Z','night','winter']]){const s=sceneClock(new Date(iso));assert.equal(s.period,period);assert.equal(s.season,season);}
});
test('shadowing scene advances only from real session time and qualifying recordings',()=>{
 assert.equal(shadowProgress(null),0);const status={awarded:false,practiceMs:450000,clips:{fixture:{recorded:3,total:6}}};assert.equal(shadowProgress(status),.5);assert.equal(shadowProgress({...status,practiceMs:900000}),.5);assert.equal(shadowProgress({...status,clips:{}}),0);assert.equal(shadowProgress({...status,awarded:true}),1);
});
test('kanji learned counts distinct active kanji with actual reviews, never queued-only cards',t=>{
 const {file,db}=fixture(t),id=String(db.prepare('SELECT item_id FROM kanji LIMIT 1').get()!.item_id);assert.equal(learnedKanjiCount(db),0);const card=enqueueCard(file,id,'recognition');assert.equal(learnedKanjiCount(db),0);
 for(let n=0;n<2;n++)db.prepare('INSERT INTO srs_reviews(review_id,card_id,rating,reviewed_at,elapsed_ms,scheduler_version) VALUES(?,?,3,?,1000,?)').run(randomUUID(),card.cardId,new Date().toISOString(),'fixture');assert.equal(learnedKanjiCount(db),1);db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(id);assert.equal(learnedKanjiCount(db),0);
});
test('original four scene JS and shared client wiring stay below 40KiB gzip without dependencies or URL overrides',()=>{
 const dir='src/components/pixel-scenes',files=['engine.js','home-tokyo.js','review-koi.js','kanji-himeji.js','shadowing-inari.js','pixel-canvas.tsx','pixel-scene.tsx','model.ts','data.ts'];const bytes=files.reduce((sum,n)=>sum+gzipSync(fs.readFileSync(path.join(dir,n))).length,0);assert.ok(bytes<=40*1024,`${bytes} bytes gzip`);
 const engine=fs.readFileSync(path.join(dir,'engine.js'),'utf8');assert.doesNotMatch(engine,/location\.search/);assert.match(engine,/1000\/30/);assert.match(engine,/document\.hidden/);assert.match(engine,/this\.visible/);
});

test('due scene uses fresh server cards, ignoring stale cached card IDs and duplicate local events',async()=>{
 const {remainingDue}=await import('../src/components/pixel-scenes/model.ts');const initial={due:8,cards:[{cardId:'due-now'},{cardId:'another'}]};assert.equal(remainingDue(initial,['old-cached-card']),8);assert.equal(remainingDue(initial,['due-now','due-now']),7);assert.equal(remainingDue(initial,[]),8);
});
test('single koi remains connected through tail frames and changes of direction',async()=>{
 const scene=(await import('../src/components/pixel-scenes/review-koi.js')).default as any;let pixels=new Set<string>(),actors=0;
 const api:any={state:{params:{dueCards:1},seconds:0,season:'winter',weather:'clear'},draw:{rect:(_c:unknown,x:number,y:number)=>pixels.add(Math.round(x)+','+Math.round(y)),line:()=>{},ellipse:()=>{},polygon:()=>{}},random:()=>()=>.5,scheduled:()=>false,creature:()=>{},sprite:()=>{},actor:(layer:number,b:{x:number;y:number},paint:Function)=>{if(layer===0&&actors++===0)paint({},Math.floor(b.x),Math.floor(b.y));}};
 const fish=scene.create(api);for(let n=0;n<96;n++){pixels=new Set();actors=0;fish.frame(n*1.4,false);const remaining=new Set(pixels);let largest=0;while(remaining.size){const todo=[remaining.values().next().value as string];remaining.delete(todo[0]);let size=0;while(todo.length){const [x,y]=todo.pop()!.split(',').map(Number);size++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const key=(x+dx)+','+(y+dy);if(remaining.delete(key))todo.push(key);}}largest=Math.max(largest,size);}assert.ok(largest>=pixels.size*.98,`broken fish at ${n}: ${largest}/${pixels.size}`);}
});

test('pond keeps two residents, caps small due fish at ten and only small fish depart',async()=>{
 const def=(await import('../src/components/pixel-scenes/review-koi.js')).default as any;const state={params:{dueCards:0},seconds:0,season:'winter',weather:'clear'};const noop=()=>{};let reduced=false;const scene=def.create({state,reduced:()=>reduced,draw:{rect:noop,line:noop,ellipse:noop,polygon:noop},random:()=>()=>.5,scheduled:()=>false,creature:noop,sprite:noop,actor:noop});scene.normalize(state.params);scene.frame(0,true);assert.equal(scene.stats().fishCount,2);state.params.dueCards=50;scene.normalize(state.params);assert.equal(state.params.dueCards,10);assert.equal(scene.stats().fishCount,12);state.params.dueCards=0;scene.normalize(state.params);assert.equal(scene.stats().dueFishCount,10);state.seconds=4;scene.frame(4,false);assert.equal(scene.stats().fishCount,2);assert.equal(scene.stats().residentCount,2);state.params.dueCards=3;scene.normalize(state.params);reduced=true;state.params.dueCards=0;scene.normalize(state.params);scene.frame(4,true);assert.equal(scene.stats().fishCount,2);
});
