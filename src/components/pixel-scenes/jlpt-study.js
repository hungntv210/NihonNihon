import {overcast,isWet} from './weather.js';
import {SceneCraft} from './scene-craft.js';
export default {crop:.5,id:'jlpt-study',title:'Góc học · JLPT',description:'Một ngọn đèn, một tách trà và những trang ghi chú sau mỗi câu trả lời.',params:{answered:4},swatches:{8:'#304541',9:'#465d4b',10:'#768367',11:'#9b9479',12:'#b5a17a',13:'#d0b78a',14:'#f1d59a',15:'#686d65',16:'#56616a',17:'#45535a',18:'#334b45',19:'#253b3c',20:'#25313b',21:'#1b2632',22:'#202b34',23:'#302e35',24:'#51413c',25:'#765c48',26:'#655448',27:'#8c7051',28:'#bd9563',29:'#a56245',30:'#a38354',31:'#5e4640',35:'#eac781',36:'#cc9e60',37:'#9f6f43',38:'#4e3f3b',39:'#f1d8a1'},create(api){
 const {state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p}=d,C=SceneCraft(api);
 function room(c){
  r(c,0,0,384,216,22);r(c,0,0,384,143,23);for(let x=0;x<384;x+=9)l(c,x,0,x,143,24);r(c,0,135,384,81,24);
  for(let y=141;y<216;y+=6)l(c,0,y,384,y,23);for(let x=20;x<384;x+=48)l(c,x,143,x-17,216,25);
  // Light outside changes with time; the room's warm ink/wood palette stays constant.
  r(c,94,20,196,107,0);r(c,97,68,190,57,3);p(c,[[97,86],[118,76],[143,86],[171,70],[202,80],[228,69],[259,77],[287,65],[287,124],[97,124]],5);
  if(!overcast(state.weather)){if(state.time==='night'){e(c,252,39,9,9,1);e(c,252,39,6,6,39);for(let i=0;i<19;i++)r(c,101+(i*37)%178,25+(i*17)%37,1,1,15)}}
  r(c,97,96,190,28,19);for(let i=0;i<14;i++){const x=99+i*14;e(c,x,96+i%3*3,12,7,18);e(c,x-1,93+i%3*3,8,4,9);if(state.season==='winter')e(c,x,92+i%3*3,8,2,39)}
  r(c,99,114,187,10,24);r(c,100,113,185,2,state.season==='winter'?39:16);for(let x=104;x<284;x+=9)r(c,x,116,1,7,25);
  for(const x of [91,189,288]){r(c,x,17,4,114,24);r(c,x+1,18,1,112,25)}r(c,91,17,201,4,24);r(c,91,127,201,6,24);r(c,94,130,197,2,25);r(c,92,64,199,3,24);
  if(state.season==='winter')for(const x of [96,194]){p(c,[[x,124],[x+12,123],[x+26,124],[x+41,122],[x+58,124],[x+75,123],[x+90,124],[x+90,128],[x,128]],32);l(c,x+1,128,x+89,128,13);r(c,x+22,128,2,2,32);r(c,x+64,128,2,3,32)}
  // Bookcase shelves carry every book; no detached rectangles.
  r(c,12,40,60,95,21);r(c,15,43,54,90,24);for(let row=0;row<3;row++){const y=48+row*27;r(c,17,y+21,50,3,25);for(let i=0;i<7;i++){const x=18+i*7,h=13+(i*3+row)%7;r(c,x,y+21-h,5,h,[18,29,7,25][i%4]);l(c,x+1,y+23-h,x+3,y+23-h,13)}}
 }
 function table(c){
  // Lamp pool consists of opaque palette bands, not a large animated blur.
  p(c,[[62,140],[319,140],[346,190],[40,190]],25);p(c,[[64,142],[317,142],[339,186],[46,186]],24);
  e(c,111,158,54,19,25);e(c,110,157,34,13,27);for(let y=146;y<188;y+=6)l(c,49,y,337,y,25);
  r(c,41,189,303,7,23);r(c,50,196,9,20,23);r(c,326,196,9,20,23);r(c,52,196,2,20,25);r(c,327,196,2,20,25);
  // Real lamp stem, weighted base and warm shade.
  e(c,100,160,14,4,21);e(c,99,158,12,3,25);r(c,98,113,3,44,21);r(c,99,114,1,42,30);p(c,[[88,95],[111,95],[121,119],[78,119]],30);p(c,[[90,97],[108,97],[116,115],[83,115]],35);l(c,80,120,119,120,21);r(c,98,91,3,4,21);
  for(let i=0;i<5;i++){const x=269-i%2*2,y=163-i*5;r(c,x,y,40,5,[18,29,7,25,24][i]);r(c,x+3,y+1,34,2,13);r(c,x,y,2,5,21)}
  // Cup and saucer are seated on the tabletop.
  e(c,121,173,11,3,23);e(c,120,171,9,2,13);r(c,114,162,12,8,13);e(c,120,162,6,2,39);e(c,120,162,4,1,24);l(c,126,164,129,164,13);l(c,129,164,129,168,13);l(c,126,168,129,168,13);
 }
 function notes(c){
  for(let i=0;i<state.params.answered;i++){const x=147+(i%4)*18+(i%2)*2,y=148+Math.floor(i/4)*10;p(c,[[x,y],[x+16,y],[x+19,y+13],[x-1,y+13]],21);p(c,[[x,y-1],[x+15,y-1],[x+17,y+11],[x,y+11]],13);for(let k=0;k<3;k++)l(c,x+3,y+2+k*3,x+12,y+2+k*3,25)}
  l(c,214,148,225,156,21);l(c,214,147,224,154,30);r(c,225,155,2,2,13);
 }
 return{layers:[room,table,notes],depths:[0,0,0],dynamicDepths:[0,0,0,0],weatherClip:[98,23,188,101],puddles:[],normalize(v){v.answered=Math.min(10,Math.floor(v.answered))},frame(t,still){
  // Four breathing poses move only the upper back by one native pixel.
  api.actor(2,{x:229,y:165,w:35,h:20},(c,x,y)=>{const n=still?0:[0,0,-1,0][Math.floor(t*1.2)%4];e(c,x+16,y+15,17,4,23);e(c,x+16,y+9+n,15,8,30);e(c,x+19,y+8+n,10,6,28);p(c,[[x+2,y+9],[x+3,y+2],[x+7,y+5],[x+12,y+2],[x+14,y+9],[x+10,y+14],[x+4,y+14]],28);l(c,x+5,y+10,x+7,y+10,21);l(c,x+10,y+10,x+12,y+10,21);for(let i=0;i<4;i++)r(c,x+17+i*3,y+3+n+i%2,2,3,25);e(c,x+20,y+13,9,3,25);e(c,x+21,y+12,6,2,28)});api.creature('sleeping-cat',{x:229,y:165,w:35,h:20});
  for(const [i,x,y]of [[0,144,107],[1,237,106]]){api.actor(0,{x,y,w:11,h:9},(c,x,y)=>C.bird(c,x,y,still?i:Math.floor(t*2+i)%4));api.creature('garden-sparrow',{x,y,w:9,h:7})}
  api.actor(2,{x:113,y:139,w:17,h:21},(c,x,y)=>{for(let i=0;i<3;i++){const drift=still?0:Math.round(Math.sin(t*1.2+i)*2);l(c,x+3+i*4,y+17,x+1+i*4+drift,y+11,isWet(state.weather)?39:15);l(c,x+1+i*4+drift,y+11,x+4+i*4,y+4,isWet(state.weather)?13:16)}});
  if(state.season==='summer')for(let i=0;i<5;i++){const x=112+i*33,y=93+i%3*5;api.actor(0,{x,y,w:2,h:2},(c,x,y)=>r(c,x,y,1,1,still||Math.sin(t+i)>0?35:18))}
 },stats(){return{notes:state.params.answered,indoorPalette:true}}};
}};