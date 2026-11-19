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
test('roadmap-journey builds each tile once on mount, skips unchanged resize, and reserves fixed CSS height',async()=>{
 const css=fs.readFileSync('src/components/pixel-scenes/scene.module.css','utf8');
 assert.match(css,/\.journeyFrame\{[^}]*min-height:432px/);
 assert.match(css,/\.strip\{[^}]*height:432px/);
 const def=(await import('../src/components/pixel-scenes/roadmap-journey.js')).default as any;
 const prev={innerWidth:(globalThis as any).innerWidth,matchMedia:(globalThis as any).matchMedia,ResizeObserver:(globalThis as any).ResizeObserver,IntersectionObserver:(globalThis as any).IntersectionObserver,requestAnimationFrame:(globalThis as any).requestAnimationFrame,cancelAnimationFrame:(globalThis as any).cancelAnimationFrame,window:(globalThis as any).window,document:(globalThis as any).document};
 try{
  const makeMockCanvas=(w=384,h=216)=>{
   let width=w,height=h,buf=new Uint8Array(width*height*4);
   const ctx={fillStyle:'#000000',globalAlpha:1,save(){},restore(){},translate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},clearRect(){},fillRect(){},drawImage(){},createImageData(iw:number,ih:number){return{width:iw,height:ih,data:new Uint8ClampedArray(iw*ih*4)};},putImageData(img:{width:number;height:number;data:Uint8ClampedArray},dx:number,dy:number){for(let y=0;y<img.height;y++){const ty=dy+y;if(ty<0||ty>=height)continue;for(let x=0;x<img.width;x++){const tx=dx+x;if(tx<0||tx>=width)continue;const s=(y*img.width+x)*4,d=(ty*width+tx)*4;buf[d]=img.data[s];buf[d+1]=img.data[s+1];buf[d+2]=img.data[s+2];buf[d+3]=img.data[s+3];}}}};
   return{className:'',style:{} as Record<string,string>,attributes:{} as Record<string,string>,setAttribute(k:string,v:string){this.attributes[k]=v;},get width(){return width;},set width(v){width=v;buf=new Uint8Array(width*height*4);},get height(){return height;},set height(v){height=v;buf=new Uint8Array(width*height*4);},getContext(){return ctx;},data(){return buf;}};
  };
  const makeEl=()=>({className:'',style:{} as Record<string,string>,dataset:{} as Record<string,string>,children:[] as any[],classList:{add(){},toggle(){}},append(c:any){this.children.push(c);},replaceChildren(){this.children=[];},remove(){},get clientWidth(){return parseInt(this.style.width||'0',10)||0;},getBoundingClientRect:()=>({top:130})});
  const roCallbacks:Array<()=>void>=[];
  (globalThis as any).innerWidth=390;
  (globalThis as any).matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  (globalThis as any).ResizeObserver=class{constructor(cb:()=>void){roCallbacks.push(cb);}observe(){}disconnect(){}};
  (globalThis as any).IntersectionObserver=class{observe(){}disconnect(){}};
  (globalThis as any).requestAnimationFrame=()=>1;
  (globalThis as any).cancelAnimationFrame=()=>{};
  (globalThis as any).window={addEventListener(){},removeEventListener(){}};
  (globalThis as any).document={hidden:false,addEventListener(){},removeEventListener(){},createElement(tag:string){return tag==='canvas'?makeMockCanvas():makeEl();}};
  const frame={clientWidth:354,scrollLeft:0,addEventListener(){},removeEventListener(){}};
  const host={...makeEl(),closest(sel:string){return sel==='[data-journey-frame]'?frame:null;}};
  const journey=def.mount(host,{time:'day',season:'autumn',date:'2026-11-19',weather:'clear',motion:false,params:{week:1}});
  assert.equal(journey.pieces.length,7);
  assert.equal(journey.metrics.staticBuilds,7);
  assert.equal(journey.stats().staticBuilds,7);
  assert.ok(journey.pieces.every((p:any)=>p.engine.metrics.staticBuilds===1));
  let tileResizeCalls=0;
  for(const p of journey.pieces){const orig=p.engine.resize;p.engine.resize=()=>{tileResizeCalls++;orig();};}
  journey.resize();journey.resize();for(const cb of roCallbacks)cb();
  assert.equal(journey.metrics.staticBuilds,7);
  assert.equal(tileResizeCalls,0,'unchanged dimensions skip piece resize');
  // Verify mist pixel alpha matches exact smoothstep formula at sample coordinates
  const mist=journey.mist.data();
  const alphaAt=(x:number,y:number)=>mist[(y*1920+x)*4+3];
  assert.equal(alphaAt(335,100),0,'clear left of mist start');
  assert.equal(alphaAt(336,64),0,'clear above mist start');
  assert.equal(alphaAt(600,150),36,'full mist opacity in saturated zone');
  assert.equal(alphaAt(336+96,65+32),Math.round(36*0.5*(32/65)*(32/65)*(3-2*(32/65))));
  // Verify changing scale resizes tiles cleanly without rebuilding static layers
  (globalThis as any).innerWidth=1440;frame.clientWidth=1152;
  journey.resize();
  assert.equal(journey.scale,3);
  assert.equal(tileResizeCalls,7);
  assert.equal(journey.metrics.staticBuilds,7);
  journey.destroy();
 }finally{
  Object.assign(globalThis,prev);
 }
});
