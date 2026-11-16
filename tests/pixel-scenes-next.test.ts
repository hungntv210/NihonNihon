import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gzipSync} from 'node:zlib';import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.ts';import {enqueueCard} from '../src/core/review.ts';import {learnedVocabCount} from '../src/components/pixel-scenes/data.ts';
test('market learned count requires real reviews, deduplicates cards/events and excludes inactive words',t=>{
 const {db,file}=fixture(t),id=String(db.prepare('SELECT item_id FROM vocab LIMIT 1').get()!.item_id);assert.equal(learnedVocabCount(db),0);const card=enqueueCard(file,id,'recognition');assert.equal(learnedVocabCount(db),0);
 for(let n=0;n<2;n++)db.prepare('INSERT INTO srs_reviews(review_id,card_id,rating,reviewed_at,elapsed_ms,scheduler_version) VALUES(?,?,3,?,1000,?)').run(randomUUID(),card.cardId,new Date().toISOString(),'fixture');assert.equal(learnedVocabCount(db),1);db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(id);assert.equal(learnedVocabCount(db),0);
});
test('market has five stock levels at real 250-word thresholds and caps a full market',async()=>{
 const def=(await import('../src/components/pixel-scenes/vocab-market.js')).default as any;const noop=()=>{};const state={params:{vocabLearned:0},season:'autumn',time:'day'};const api={state,draw:new Proxy({},{get:()=>noop})};const scene=def.create(api);for(const [n,level]of [[0,0],[249,0],[250,1],[500,2],[750,3],[1000,4],[99999,4]]){state.params.vocabLearned=n;for(const layer of scene.layers)layer({});assert.equal(scene.stats().stockLevel,level);}
});
test('additional four renderers and shared source wiring fit a separate 40KiB gzip PR budget',()=>{
 const files=['scene-craft.js','vocab-market.js','grammar-kinkakuji.js','jlpt-study.js','roadmap-journey.js','pixel-canvas.tsx','pixel-scene.tsx','model.ts','data.ts'];const bytes=files.reduce((n,p)=>n+gzipSync(fs.readFileSync('src/components/pixel-scenes/'+p)).length,0);assert.ok(bytes<=40960,`${bytes} bytes gzip`);
 const journey=fs.readFileSync('src/components/pixel-scenes/roadmap-journey.js','utf8');assert.doesNotMatch(journey,/location\.search|requestAnimationFrame/);assert.match(journey,/TOTAL=1920/);assert.match(journey,/new SceneEngine\.Engine/);
});
