import {SceneEngine} from './engine.js';
export default {crop:0.5,id:'kanji-himeji',title:'Himeji · Kanji',description:'Qua khung shoji, từng tầng mái trắng hiện ra sau cành hoa.',params:{kanjiLearned:0},create(api){
 const {state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p}=d;const winter=()=>state.season==='winter';let lamps=0;
 function distant(c){
  for(let y=0;y<216;y++)r(c,0,y,384,1,y<40?0:y<75?3:1);
  for(let i=0;i<17;i++){const x=i*24-5;e(c,x,102+Math.sin(i)*5,30,21,5);e(c,x-3,96+Math.sin(i)*5,25,14,6)}
  if(state.time==='night'){e(c,239,39,10,10,1);e(c,239,39,7,7,39);for(let i=0;i<45;i++)r(c,(i*71)%384,12+(i*31)%72,1,1,i%4?15:39)}else e(c,249,44,12,12,14);
  r(c,0,144,384,72,8);for(let i=0;i<160;i++){const x=(i*47)%384,y=148+(i*23)%67;l(c,x,y,x+2+i%6,y,i%4?9:33)}
 }
 function roof(c,x,y,w,h){
  // Hipped tiled roof, with an upward kick confined to the eave ends.
  p(c,[[x-9,y+h-3],[x-5,y+h],[x+w+5,y+h],[x+w+10,y+h-4],[x+w-1,y+1],[x+5,y]],21);
  p(c,[[x-5,y+h-2],[x+6,y+1],[x+w-2,y+2],[x+w+6,y+h-2]],7);
  for(let i=1;i<h;i+=2)l(c,x+5-i,y+i,x+w-2+i,y+i,18);
  for(let xx=x+9;xx<x+w-2;xx+=5)l(c,xx,y+1,xx+2,y+h-2,6);
  l(c,x-5,y+h,x+w+5,y+h,20);l(c,x+5,y-1,x+w-1,y,6);
  if(winter()){p(c,[[x+4,y-2],[x+w,y-1],[x+w+6,y+h-4],[x+w+2,y+h-3],[x+w-2,y+1],[x+6,y],[x-3,y+h-3],[x-6,y+h-4]],39);l(c,x+6,y+1,x+w-2,y+2,13)}
 }
 function gable(c,x,y,w,h){
  // Chidori-hafu: a triangular plaster pediment with a tiled ridge, never a semicircle.
  p(c,[[x-w/2,y+h],[x,y],[x+w/2,y+h]],39);l(c,x-w/2-2,y+h,x,y-2,21);l(c,x,y-2,x+w/2+2,y+h,21);
  l(c,x-w/2-1,y+h-2,x,y-3,7);l(c,x,y-3,x+w/2+1,y+h-2,7);l(c,x-w/2+3,y+h,x+w/2-3,y+h,13);
  r(c,x-1,y+Math.max(3,h-4),2,3,20);if(winter()){l(c,x-w/2,y+h-4,x,y-4,39);l(c,x,y-4,x+w/2,y+h-4,39)}
 }
 function architecture(c){
  // The stone base bows out at its foot: a battered, irregular ishigaki wall.
  const left=[[123,119],[120,129],[116,139],[110,148],[100,157]],right=[[261,119],[264,130],[268,140],[275,149],[286,157]];
  p(c,[...left,[286,157],...right.slice(0,-1).reverse()],20);p(c,[[125,121],[260,121],[263,132],[267,142],[278,153],[109,153],[118,141],[122,130]],16);
  const rand=api.random(618);for(let y=123;y<155;y+=4){const spread=(y-120)*.53;for(let x=124-spread;x<261+spread;x+=7+rand()*6){const w=6+rand()*5;l(c,x,y,x+w,y-1,7);l(c,x+w,y-1,x+w+1,y+2,18);l(c,x+1,y+1,x+w-1,y,15)}}
  // Connected smaller keeps create an asymmetrical silhouette around the main donjon.
  for(const [x,y,w]of [[110,121,43],[239,128,36]]){r(c,x,y,w,22,13);r(c,x+1,y,w-2,19,39);for(let xx=x+6;xx<x+w-3;xx+=10)r(c,xx,y+8,3,7,20);roof(c,x-1,y-9,w+2,10);gable(c,x+w*.57,y-11,18,10)}
  const levels=[{x:141,y:116,w:109,h:23},{x:149,y:96,w:94,h:23},{x:157,y:78,w:78,h:22},{x:169,y:61,w:55,h:21},{x:178,y:43,w:37,h:22}];
  for(const [i,b]of levels.entries()){
   r(c,b.x,b.y,b.w,b.h,13);r(c,b.x+1,b.y,b.w-2,b.h-3,39);r(c,b.x+b.w-7,b.y,6,b.h,13);
   for(let xx=b.x+7;xx<b.x+b.w-5;xx+=11){r(c,xx,b.y+7,3,7,20);r(c,xx+1,b.y+7,1,6,state.time==='night'?35:7);r(c,xx-1,b.y+15,5,1,13)}
   l(c,b.x+2,b.y+b.h-4,b.x+b.w-2,b.y+b.h-4,15);roof(c,b.x-2,b.y-8,b.w+4,10);
  }
  // Front pediments overlap the recessed walls; draw them after the connected roof volumes.
  for(const [x,y,w,h]of [[163,107,27,12],[223,109,24,10],[199,85,35,14],[176,69,25,12],[222,70,21,11],[197,51,28,12]])gable(c,x,y,w,h);
  // A single kara-hafu has an ogee eave, with an inflection at each end and no circular motif.
  p(c,[[176,123],[184,119],[191,112],[196,111],[202,113],[209,120],[216,123]],39);
  const ogee=[[175,121],[181,120],[187,115],[191,110],[196,108],[201,109],[206,113],[210,118],[217,121]];
  for(let i=1;i<ogee.length;i++){const a=ogee[i-1],b=ogee[i];l(c,a[0],a[1],b[0],b[1],21);l(c,a[0],a[1]-1,b[0],b[1]-1,winter()?39:7)}
  // The top gable faces the viewer beneath the highest ridge and paired shachihoko.
  gable(c,196,32,37,13);l(c,176,34,216,34,7);for(const x of [176,216]){l(c,x,34,x-2,29,20);r(c,x-3,28,2,2,37)}
  r(c,264,95,2,44,20);r(c,264,138,4,3,7);
 }
 function castle(c){
  const a=document.createElement('canvas');a.width=384;a.height=216;const ac=a.getContext('2d');architecture(ac);c.drawImage(a,0,0);
  // Palette-indexed reflected masonry, broken by water. Sampling only happens on a static rebuild.
  const pixels=ac.getImageData(0,0,384,216).data,rand=api.random(925);
  for(let y=159;y<194;y++){if(y%4===0)continue;const sy=Math.floor(152-(y-159)*2.9),wave=Math.round(Math.sin(y*.8)*2);for(let x=97;x<286;x++){const at=(sy*384+x)*4;if(pixels[at+3]&&rand()>.3){const bright=pixels[at]+pixels[at+1]+pixels[at+2];r(c,x+wave,y,1,1,bright>520?16:bright>330?17:7)}}}
  for(let i=0;i<22;i++){const x=120+(i*37)%150,y=161+(i*11)%30;l(c,x,y,x+3+i%5,y,i%3?8:33)}
 }
 function garden(c){
  for(let i=0;i<11;i++){const x=45+i*30,y=133+(i%3)*3;e(c,x,y,17,8,19);e(c,x-2,y-3,14,6,18);e(c,x-3,y-5,10,3,9);for(let j=0;j<6;j++)r(c,x-10+j*3,y-5+(j%2),2,1,10);if(winter())l(c,x-10,y-7,x+9,y-7,39)}
  r(c,0,194,384,22,23);for(let y=197;y<216;y+=5)l(c,0,y,384,y,24);
  // Branches originate in the tree outside the left side of the window.
  p(c,[[26,103],[40,42],[78,17],[89,18],[52,46],[31,112]],24);l(c,47,47,137,29,24);l(c,77,38,111,13,24);l(c,102,32,167,18,24);
  const rand=api.random(124);for(let i=0;i<90&&!winter();i++){const x=40+rand()*132,y=13+rand()*40,rad=3+rand()*4;e(c,x,y,rad,3,26);e(c,x-1,y-1,rad-1,2,27);r(c,x-1,y-2,2,1,28)}
  if(winter()){l(c,48,44,137,26,39);l(c,48,45,137,27,13);l(c,79,35,110,10,39);l(c,103,29,167,15,39)}
 }
 function shoji(c){
  const timbers=[[0,0,384,10],[0,207,384,9],[0,0,20,216],[364,0,20,216]];
  for(const [x,y,w,h]of timbers){r(c,x,y,w,h,21);r(c,x+2,y+2,w-4,h-4,24);for(let k=0;k<Math.max(w,h);k+=6){if(w>h)l(c,x+k,y+3,x+k+8,y+3,25);else l(c,x+4,y+k,x+4,y+k+7,25)}}
  // Side paper panes leave the central crop entirely open.
  for(const x of [20,327]){r(c,x,11,37,194,13);for(let xx=x;xx<x+38;xx+=12)r(c,xx,11,2,196,24);for(let y=12;y<207;y+=25)r(c,x,y,37,2,24)}
  for(let y=211;y<216;y+=2)l(c,22,y,362,y,25);
  lamps=Math.floor(Math.min(1,state.params.kanjiLearned/100)*8);
  for(let i=0;i<8;i++){const x=107+i*24,y=184;r(c,x,173,1,9,24);r(c,x-4,y-3,9,12,20);r(c,x-3,y-2,7,9,i<lamps?35:25);r(c,x-4,y-4,9,2,20);r(c,x-4,y+7,9,2,20);r(c,x-1,y+9,2,11,24);r(c,x-4,y+18,9,2,20);if(i<lamps){r(c,x-2,y-1,2,6,39);r(c,x-5,y,1,5,37);r(c,x+5,y,1,5,37)}}
 }
 return{depths:[.25,.5,1,0],dynamicDepths:[.25,1,0,0],weatherClip:[57,11,270,183],layers:[distant,castle,garden,shoji],puddles:[[145,164,20],[235,179,18]],normalize(p){p.kanjiLearned=Math.floor(p.kanjiLearned)},frame(t,still){
  const hawkX=still?210:210+Math.sin(t*.18)*28,y=47;api.actor(1,{x:hawkX,y,w:15,h:8},(c,x,y)=>{const wing=Math.floor(t*3)%4;l(c,x,y+4,x+6,y+2,20);l(c,x+6,y+2,x+13,y+(wing<2?0:5),20);r(c,x+6,y+2,2,4,20);r(c,x+8,y+2,2,1,37)});api.creature('hawk',{x:hawkX,y,w:14,h:7});
  for(const [i,x,y]of [[0,159,164],[1,211,174]]){api.actor(0,{x,y,w:26,h:12},(c,xx,yy)=>api.sprite(c,SceneEngine.sprites.fish,Math.floor(t*4+i),xx,yy,i===1));api.creature('moat-koi',{x,y,w:24,h:10})}
  for(const [x,y]of [[132,197],[248,197]]){api.actor(2,{x,y,w:11,h:9},(c,xx,yy)=>api.sprite(c,SceneEngine.sprites.bird,still?0:Math.floor(t*3)%4,xx,yy));api.creature('sparrow',{x,y,w:9,h:7})}
  api.actor(1,{x:265,y:95,w:16,h:12},(c,x,y)=>{const f=still?1:Math.floor(t*4)%4;p(c,[[x,y],[x+12,y+(f%2)],[x+11,y+7],[x,y+6]],30);l(c,x+2,y+1,x+10,y+2,27)});
 },stats(){return{lanternsLit:lamps,lanternsTotal:8}}};
}};