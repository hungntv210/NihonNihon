import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {gzipSync} from 'node:zlib';import {randomUUID,createHash} from 'node:crypto';
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

test('engine builds static layers exactly once on mount for portrait and standard scenes with identical canvas pixels',async()=>{
 const {SceneEngine}=await import('../src/components/pixel-scenes/engine.js');
 const loginShoji=(await import('../src/components/pixel-scenes/login-shoji.js')).default;
 const homeTokyo=(await import('../src/components/pixel-scenes/home-tokyo.js')).default;
 const prev={innerWidth:(globalThis as any).innerWidth,matchMedia:(globalThis as any).matchMedia,ResizeObserver:(globalThis as any).ResizeObserver,IntersectionObserver:(globalThis as any).IntersectionObserver,requestAnimationFrame:(globalThis as any).requestAnimationFrame,cancelAnimationFrame:(globalThis as any).cancelAnimationFrame,window:(globalThis as any).window,document:(globalThis as any).document};
 try{
  const makeMockCanvas=(w=384,h=216)=>{
   let width=w,height=h,buf=new Uint8Array(width*height*4),tx=0,ty=0;
   const stack:Array<{fillStyle:string;globalAlpha:number;tx:number;ty:number}>=[];
   const parseHex=(hex:string)=>{const s=String(hex||'#000000').replace('#',''),v=s.length===3?s.split('').map(c=>c+c).join(''):s,n=parseInt(v,16)||0;return[(n>>16)&255,(n>>8)&255,n&255,255];};
   const ctx={fillStyle:'#000000',globalAlpha:1,save(){stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,tx,ty});},restore(){const s=stack.pop();if(s){this.fillStyle=s.fillStyle;this.globalAlpha=s.globalAlpha;tx=s.tx;ty=s.ty;}},translate(dx:number,dy:number){tx+=dx;ty+=dy;},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},clearRect(x:number,y:number,cw:number,ch:number){const x0=Math.max(0,Math.floor(x+tx)),y0=Math.max(0,Math.floor(y+ty)),x1=Math.min(width,Math.ceil(x+tx+cw)),y1=Math.min(height,Math.ceil(y+ty+ch));for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)buf.fill(0,(yy*width+xx)*4,(yy*width+xx)*4+4);},fillRect(x:number,y:number,cw:number,ch:number){const [r,g,b,a]=parseHex(this.fillStyle),x0=Math.max(0,Math.floor(x+tx)),y0=Math.max(0,Math.floor(y+ty)),x1=Math.min(width,Math.ceil(x+tx+cw)),y1=Math.min(height,Math.ceil(y+ty+ch));for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const idx=(yy*width+xx)*4;buf[idx]=r;buf[idx+1]=g;buf[idx+2]=b;buf[idx+3]=Math.round(a*this.globalAlpha);}}};
   return{className:'',style:{},get width(){return width;},set width(v){width=v;buf=new Uint8Array(width*height*4);tx=0;ty=0;stack.length=0;},get height(){return height;},set height(v){height=v;buf=new Uint8Array(width*height*4);tx=0;ty=0;stack.length=0;},getContext(){return ctx;},hash(){return createHash('sha256').update(buf).digest('hex');}};
  };
  for(const [def,expectedHeight]of [[loginShoji,422],[homeTokyo,216]]as const){
   let roCallback:(()=>void)|null=null;
   (globalThis as any).innerWidth=390;
   (globalThis as any).matchMedia=(q:string)=>({matches:q.includes('orientation: portrait')||q.includes('max-width'),addEventListener(){},removeEventListener(){}});
   (globalThis as any).ResizeObserver=class{constructor(cb:()=>void){roCallback=cb;}observe(){}disconnect(){}};
   (globalThis as any).IntersectionObserver=class{observe(){}disconnect(){}};
   (globalThis as any).requestAnimationFrame=()=>1;
   (globalThis as any).cancelAnimationFrame=()=>{};
   (globalThis as any).window={addEventListener(){},removeEventListener(){}};
   (globalThis as any).document={hidden:false,addEventListener(){},removeEventListener(){},createElement(tag:string){return tag==='canvas'?makeMockCanvas():{className:'',style:{},children:[]as unknown[],append(c:unknown){this.children.push(c);},remove(){}};}};
   const host={clientWidth:390,parentElement:{clientHeight:844},style:{},children:[]as unknown[],append(c:unknown){this.children.push(c);},getBoundingClientRect:()=>({top:130})};
   const engine=new (SceneEngine as any).Engine(host,def,{time:'day',season:'autumn',date:'2026-11-19',weather:'clear',motion:false});
   assert.equal(engine.stats().staticBuilds,1);
   assert.deepEqual(engine.stats().native,[384,expectedHeight]);
   if(roCallback)(roCallback as ()=>void)();
   assert.equal(engine.stats().staticBuilds,1);
   const hashes=[...engine.statics,...engine.dynamics].map((c:any)=>c.hash());
   engine.rebuild();
   assert.equal(engine.stats().staticBuilds,2);
   const rebuiltHashes=[...engine.statics,...engine.dynamics].map((c:any)=>c.hash());
   assert.deepEqual(hashes,rebuiltHashes);
   engine.destroy();
  }
 }finally{
  Object.assign(globalThis,prev);
 }
});
