import {SceneEngine} from './engine.js';
import {SceneCraft} from './scene-craft.js';
export default {crop:.5,id:'grammar-kinkakuji',title:'Kinkaku-ji · Ngữ pháp',description:'Mái vàng và đảo thông soi xuống mặt hồ Kyōko-chi.',params:{},swatches:s=>({...{8:s.time==='night'?'#203747':'#2b4c5d',34:s.time==='night'?'#365766':'#4d7380',16:'#8e968b',17:'#697e78'},...(s.time==='night'?{29:'#816540',30:'#b28b49',31:'#d7b973'}:{29:'#98703d',30:'#c7a458',31:'#edcf83'})}),create(api){
 const {state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p}=d,C=SceneCraft(api),winter=()=>state.season==='winter';
 function landscape(c){
  C.sky(c);p(c,[[0,105],[49,84],[94,96],[152,74],[208,91],[260,71],[326,83],[384,68],[384,153],[0,153]],6);r(c,0,126,384,90,8);
  const rand=api.random(287);for(let i=0;i<130;i++){const x=rand()*384,y=91+rand()*48;e(c,x,y,4+rand()*7,3,19);e(c,x-1,y-2,3+rand()*4,2,18)}
  for(let i=0;i<48;i++){const x=rand()*384,y=139+rand()*76;l(c,x,y,x+3+rand()*6,y,i%4?20:34)}
  p(c,[[0,132],[36,134],[63,146],[87,166],[107,197],[94,216],[0,216]],16);
  const stones=[[27,160,9],[68,189,11]],onGravel=(x,y)=>x<36+(y-134)*.78&&y>=135&&y<216;
  for(let i=0;i<420;i++){const x=rand()*96,y=137+rand()*79;if(onGravel(x,y))r(c,x,y,1,1,i%3?15:17)}
  // Continuous parallel rake lines bend gently around the boulders.
  for(let j=0;j<17;j++)for(let x=0;x<104;x++){const y=138+j*5+Math.sin(x/22)*2;if(onGravel(x,y)&&stones.every(([sx,sy,w])=>((x-sx)/(w+12))**2+((y-sy)/14)**2>1))r(c,x,y,1,1,11)}
  for(const [x,y,w]of stones){for(let i=0;i<4;i++)for(let a=0;a<6.285;a+=.025){const xx=x+Math.cos(a)*(w+4+i*3),yy=y+Math.sin(a)*(5+i*2);if(onGravel(xx,yy))r(c,xx,yy,1,1,i%2?11:17)}C.rock(c,x,y,w,6)}
  // Stone edging separates the water plane from the lawn and raked gravel.
  for(let i=0;i<13;i++){const y=135+i*6,x=36+(y-134)*.78;C.rock(c,x,y,5+i%3,3)}
  for(let x=0;x<384;x+=14){if(x>144&&x<280)continue;C.rock(c,x,137+(x%3),8,3)}
  if(winter())p(c,[[0,128],[32,130],[59,141],[55,144],[29,134],[0,132]],39);
 }
 function building(c){
  // Keep the architecture in a scratch canvas so only its silhouette is reflected.
  const a=document.createElement('canvas');a.width=384;a.height=216;const ac=a.getContext('2d');
  p(ac,[[151,136],[151,117],[268,117],[276,139]],20);r(ac,151,117,119,17,13);r(ac,156,119,110,15,25);
  for(let x=157;x<268;x+=9){r(ac,x,120,2,15,24);r(ac,x+3,122,4,9,21)}
  C.roof(ac,147,106,125,12);r(ac,161,87,101,22,29);r(ac,164,89,95,18,31);
  for(let x=167;x<258;x+=13){r(ac,x,90,2,18,29);r(ac,x+3,93,7,10,state.time==='night'?35:23);r(ac,x+4,93,1,10,30)}
  // Open gold balustrade and layered top storey.
  r(ac,156,107,112,2,30);for(let x=158;x<268;x+=5)r(ac,x,103,1,5,31);r(ac,156,102,112,1,31);
  C.roof(ac,156,76,110,12);r(ac,180,60,63,19,29);r(ac,182,62,59,15,31);for(let x=186;x<240;x+=10){r(ac,x,63,2,15,29);r(ac,x+3,65,5,9,state.time==='night'?35:23)}
  C.roof(ac,173,48,77,13);r(ac,180,77,64,2,30);for(let x=181;x<244;x+=5)r(ac,x,73,1,5,31);l(ac,180,72,244,72,31);
  // Phoenix ornament is attached to the roof ridge.
  r(ac,212,44,1,5,30);p(ac,[[212,43],[205,39],[208,39],[213,41],[216,38],[217,41],[222,40],[216,44]],31);r(ac,216,37,2,2,30);
  c.drawImage(a,0,0);const pixels=ac.getImageData(0,0,384,216).data,lookup=new Map(api.palette.map((v,i)=>[parseInt(v.slice(1),16),i]));
  // Solid inverted silhouette, compressed slightly vertically. Only a one-pixel horizontal ripple.
  const reflected={39:16,13:16,25:17,24:20,21:8,23:8,7:20,18:20,6:7,29:29,30:29,31:30,35:30};
  for(let y=142;y<216;y++){const sy=Math.floor(137-(y-142)*1.38),wave=Math.round(Math.sin(y*.21));for(let x=138;x<283;x++){const at=(sy*384+x)*4;if(pixels[at+3]){const index=lookup.get((pixels[at]<<16)|(pixels[at+1]<<8)|pixels[at+2]);r(c,x+wave,y,1,1,reflected[index]??20)}}}
  for(let x=148;x<279;x+=13)C.rock(c,x,139,8,3);
 }
 function islands(c){
  for(const [x,y,w]of [[88,131,33],[301,152,34],[246,165,17]]){e(c,x,y+2,w+3,5,7);p(c,[[x-w,y],[x-w*.5,y-5],[x+w*.5,y-6],[x+w,y],[x+w*.6,y+3],[x-w*.4,y+3]],19);C.rock(c,x-w*.7,y+1,9,4);C.rock(c,x+w*.7,y+1,7,4);if(winter())e(c,x,y-3,w-5,2,39)}
  C.pine(c,84,128,23,32);C.pine(c,307,149,25,37);C.rock(c,248,166,12,5);
  // A crane's small shore projects into the water.
  p(c,[[105,160],[116,149],[133,148],[143,154],[139,164],[118,167]],18);C.rock(c,124,165,13,4);
  if(state.season!=='winter')for(let i=0;i<8;i++){const x=340+i*5,y=211-i%3*4;l(c,x,y,x-3,y-17,18);l(c,x,y,x+4,y-13,9);e(c,x-3,y-18,2,2,27)}
 }
 return{layers:[landscape,building,islands],depths:[.25,.5,1],dynamicDepths:[.5,1,1,0],puddles:[[181,191,26],[275,204,20]],frame(t,still){
  api.actor(1,{x:122,y:136,w:23,h:30},(c,x,y)=>C.crane(c,x,y,still?0:Math.floor(t*2)));api.creature('white-crane',{x:122,y:136,w:21,h:28});
  api.actor(1,{x:240,y:157,w:17,h:10},(c,x,y)=>{e(c,x+8,y+4,6,4,19);e(c,x+7,y+3,4,3,10);l(c,x+4,y+2,x+10,y+5,18);l(c,x+4,y+5,x+10,y+2,18);e(c,x+15,y+3,2,1,9);for(const xx of [3,11]){r(c,x+xx,y,2,1,18);r(c,x+xx,y+8,2,1,18)}r(c,x+16,y+3,1,1,21)});api.creature('turtle',{x:240,y:157,w:17,h:10});
  for(const [i,xx,yy]of [[0,185,187],[1,222,207]]){const x=xx+(still?0:Math.sin(t*.25+i)*13),y=yy;api.actor(0,{x,y,w:23,h:10},(c,x,y)=>C.fish(c,x,y,still?2:Math.floor(t*4),i));api.creature('koi',{x,y,w:21,h:8})}
  if(state.season!=='winter'&&(still||api.scheduled(t,'kinkaku-dragonfly',9,16,.8))){api.actor(2,{x:145,y:145,w:11,h:7},(c,x,y)=>api.sprite(c,SceneEngine.sprites.dragonfly,Math.floor(t*6),x,y));api.creature('dragonfly',{x:145,y:145,w:9,h:5})}
  for(let i=0;i<4;i++){const x=166+i*23,y=155+(i*17)%48,n=still?0:Math.round(Math.sin(t*.6+i));api.actor(0,{x:x-2,y,w:17,h:2},(c,x,y)=>l(c,x+2+n,y,x+12+n,y,34))}
 },stats(){return{reflection:true}}};
}};