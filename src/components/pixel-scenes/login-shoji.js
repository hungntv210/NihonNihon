import {overcast,isWet} from './weather.js';
import {SceneCraft} from './scene-craft.js';
export default {crop:.5,nativeHeight:(host,scale)=>matchMedia('(orientation: portrait)').matches?Math.max(216,Math.ceil(host.parentElement.clientHeight/scale)):216,id:'login-shoji',title:'Shoji · Đăng nhập',description:'Một khoảng tatami yên, cửa shoji mở ra khu vườn và mặt hồ nhỏ.',params:{},swatches:s=>({8:s.time==='night'?'#203e4b':'#315765',16:'#8c9386',17:'#65776c',21:'#202b31',22:'#2b3336',23:'#3e3637',24:'#675247',25:'#8a7057',29:'#a7674d',30:'#bd9566',31:'#634638',...(s.time==='night'?{13:'#a3967d',14:'#d0bc91',39:'#ecdbb7'}:{13:'#d7c7a6',14:'#eee1bd',39:'#f6ebd0'})}),create(original){
 const height=()=>original.state.nativeHeight??216,portrait=()=>height()>216,top=()=>portrait()?Math.min(96,Math.round((height()-216)*.35)):0;
 const api={...original,actor:(layer,b,paint)=>original.actor(layer,{...b,y:b.y+top()},paint),creature:(kind,b)=>original.creature(kind,{...b,y:b.y+top()})};
 const {state,draw:d}=api,{rect:r,line:l,polygon:p,ellipse:e}=d,C=SceneCraft(api),winter=()=>state.season==='winter';
 function garden(c){
  r(c,0,0,384,216,23);r(c,102,12,180,72,0);r(c,102,39,180,45,3);
  if(!overcast(state.weather)){if(state.time==='night'){e(c,246,28,9,9,1);e(c,246,28,6,6,39);for(let i=0;i<25;i++)r(c,105+(i*31)%174,15+(i*17)%27,1,1,i%4?15:39)}else e(c,246,27,9,9,14);}
  p(c,[[102,47],[128,37],[151,44],[175,35],[203,45],[237,34],[282,45],[282,84],[102,84]],5);
  r(c,102,51,180,33,19);for(let i=0;i<17;i++){const x=103+i*11;e(c,x,51+i%3*2,11,5,18);e(c,x-1,49+i%3*2,8,3,9);if(winter())e(c,x,48+i%3*2,7,1,32)}
  // Pond, stone shore and a low bridge share the same garden plane.
  p(c,[[139,54],[162,49],[209,48],[242,55],[250,65],[233,74],[184,78],[147,73],[132,64]],20);
  p(c,[[143,55],[164,51],[208,50],[239,56],[246,64],[230,71],[183,75],[149,70],[136,64]],8);
  for(let i=0;i<19;i++){const x=143+(i*17)%93,y=56+(i*11)%15;l(c,x,y,x+4,y,i%3?7:34)}
  for(const [x,y,w]of [[140,67,7],[152,74,7],[187,78,9],[226,74,8],[246,66,6],[125,78,10],[257,74,9]])C.rock(c,x,y,w,3);
  for(const x of [167,221]){r(c,x,55,3,13,24);r(c,x+1,56,1,11,25)}p(c,[[160,57],[169,51],[219,50],[230,55],[229,59],[162,61]],24);l(c,161,53,169,48,25);l(c,169,48,219,47,25);l(c,219,47,230,52,25);for(let x=165;x<229;x+=7){r(c,x,50,1,8,24);l(c,x,56,x+5,55,25)}
  if(winter()){l(c,169,47,218,46,32);l(c,164,54,173,51,32)}
  // Stone lantern is planted on its own plinth, left of the pond.
  e(c,117,77,9,3,20);r(c,113,59,8,17,17);r(c,111,55,12,10,16);r(c,114,57,6,5,state.time==='night'?35:7);p(c,[[107,55],[117,47],[127,55]],7);p(c,[[110,53],[117,48],[124,53]],15);r(c,116,43,2,5,16);if(winter()){p(c,[[108,53],[117,46],[126,53],[122,54],[117,50],[112,54]],32);l(c,113,64,121,64,32)}
  // Cherry branches grow from the tree outside the opening, above the animals.
  p(c,[[102,64],[107,37],[135,19],[140,19],[113,39],[107,66]],24);l(c,111,38,167,18,24);l(c,137,28,189,24,24);l(c,150,23,159,11,24);
  const rand=api.random(1606);if(!winter())for(let i=0;i<75;i++){const x=113+rand()*81,y=14+rand()*22;e(c,x,y,2+rand()*3,2,26);e(c,x-1,y-1,2,1,27);r(c,x,y-2,1,1,28)}
  else{l(c,112,36,166,16,32);l(c,139,25,189,21,32);l(c,150,21,158,10,32)}
 }
 function room(c){
  r(c,0,0,384,9,21);r(c,0,9,384,3,24);l(c,0,10,384,10,25);
  for(const[x,w]of[[0,66],[318,66]]){r(c,x,12,w,94,22);for(let xx=x+4;xx<x+w;xx+=7)l(c,xx,13,xx,104,24)}
  for(const x of [66,282]){r(c,x,12,36,91,13);for(let xx=x;xx<=x+36;xx+=12)r(c,xx,12,2,93,24);for(let y=13;y<104;y+=15)r(c,x,y,37,2,24);for(let y=18;y<100;y+=15)l(c,x+3,y,x+9,y,12)}
  for(const x of [64,100,280,318]){r(c,x,9,3,99,21);r(c,x+1,11,1,95,25)}
  r(c,102,83,178,6,24);l(c,103,84,279,84,25);r(c,66,89,254,17,24);for(let y=92;y<106;y+=4)l(c,67,y,318,y,23);r(c,64,104,257,3,21);
 }
 function tatami(c){
  if(portrait()){portraitFloor(c);return}
  r(c,0,107,384,109,24);p(c,[[0,109],[384,109],[384,216],[0,216]],24);
  for(const[x,y,xx,yy]of [[0,151,384,151],[98,107,69,216],[285,107,315,216]]){l(c,x,y,xx,yy,22);l(c,x+1,y+1,xx+1,yy+1,25)}
  // Texture stays at the sides; native x=112..272, y=90..216 is reserved for the login form.
  for(let y=112;y<216;y+=3){l(c,2,y,78,y,25);l(c,307,y,382,y,25);if(y%6===1){for(let x=8;x<77;x+=9)r(c,x,y,1,1,23);for(let x=311;x<380;x+=9)r(c,x,y,1,1,23)}}
  r(c,19,137,33,10,23);r(c,22,138,27,7,25);l(c,22,140,48,140,24);p(c,[[31,138],[34,112],[38,112],[36,138]],24);r(c,34,95,2,30,24);l(c,35,109,25,101,24);l(c,35,111,45,105,24);for(const[x,y,w]of[[25,101,9],[44,105,10],[34,94,11]]){e(c,x,y,w,4,19);e(c,x-1,y-1,w-2,3,18);e(c,x-2,y-2,w-4,1,9);l(c,x-w+4,y-2,x+w-4,y-2,10)}
  p(c,[[330,173],[353,169],[366,180],[343,185]],23);p(c,[[332,173],[352,171],[363,179],[343,183]],25);l(c,335,174,357,178,24);
 }
 function ceiling(c){
  r(c,0,0,384,height(),24);for(let y=0;y<top();y+=10){r(c,0,y,384,9,y%20?24:23);l(c,0,y+8,384,y+8,25)}
  for(const x of [112,272]){p(c,[[x-5,0],[x+5,0],[192+(x-192)*1.7,top()],[192+(x-192)*1.7-5,top()]],21);l(c,x+5,0,192+(x-192)*1.7,top(),25)}
  const cy=Math.round(top()*.48);l(c,192,0,192,cy-14,21);e(c,192,cy,11,15,21);e(c,192,cy,9,13,13);e(c,192,cy,6,11,state.time==='night'?35:39);for(let y=cy-9;y<=cy+9;y+=4)l(c,184,y,200,y,25);r(c,187,cy-15,11,3,24);r(c,187,cy+13,11,3,24);
 }
 function portraitFloor(c){
  const end=height()-top();r(c,0,107,384,end-107,12);const rows=[107];let y=107,gap=27;while(y<end){y=Math.min(end,y+gap);rows.push(y);gap+=6}
  for(let n=0;n<rows.length-1;n++){const y=rows[n],yy=rows[n+1],spread=(y-107)*.23,next=(yy-107)*.23;for(let col=0;col<4;col++){const x=48+col*72,xx=x+72;p(c,[[x-spread,y],[xx+spread,y],[xx+next,yy],[x-next,yy]],(n+col)%2?11:12)}l(c,0,y,384,y,21);l(c,0,y+1,384,y+1,25)}
  for(let yy=110;yy<end;yy+=3)for(let x=0;x<384;x+=6)l(c,x+(yy%2),yy,x+3+(yy%2),yy,13);
  for(const x of [48,120,192,264,336]){const xx=192+(x-192)*(1+(end-107)/310);l(c,x,107,xx,end,21);l(c,x+1,107,xx+1,end,25)}furniture(c);
 }
 const roomY=()=>Math.min(126,height()-top()-196),furnished=()=>portrait()&&roomY()>=94;let catFrame=0;
 function shadow(c,x,y,rx,ry){c.save();c.globalAlpha=.12;e(c,x,y,rx,ry,21);c.restore()}
 function furniture(c){if(!furnished())return;const y=roomY();
  shadow(c,138,y+58,20,2);p(c,[[119,y+37],[151,y+35],[157,y+55],[122,y+58]],31);p(c,[[121,y+38],[150,y+37],[154,y+54],[124,y+56]],29);l(c,126,y+40,147,y+39,30);l(c,125,y+53,150,y+52,30);
  shadow(c,252,y+57,20,2);p(c,[[238,y+34],[271,y+36],[270,y+56],[234,y+55]],21);p(c,[[240,y+36],[269,y+38],[268,y+54],[237,y+53]],34);l(c,242,y+39,266,y+40,13);
  shadow(c,190,y+46,39,3);for(const x of [164,212]){r(c,x,y+17,5,27,31);r(c,x+1,y+20,2,22,25);r(c,x-1,y+43,7,2,24)}
  e(c,190,y+16,40,12,31);e(c,190,y+12,40,12,25);e(c,190,y+11,36,9,30);for(const yy of [y+8,y+16])l(c,160,yy,218,yy,25);
  p(c,[[173,y+7],[207,y+7],[210,y+21],[171,y+21]],31);p(c,[[175,y+8],[205,y+8],[207,y+19],[173,y+19]],24);
  e(c,181,y+9,4,4,13);e(c,181,y+9,2,2,24);p(c,[[192,y+6],[200,y+4],[198,y+9],[192,y+11]],13);e(c,188,y+8,7,6,13);e(c,188,y+12,5,2,25);r(c,184,y+2,8,2,39);r(c,187,y,2,2,24);
  for(const [x,yy]of [[176,y+16],[203,y+13]]){r(c,x-2,yy,6,4,13);e(c,x+1,yy,3,2,39);l(c,x-1,yy,x+3,yy,8);r(c,x-1,yy+4,4,1,25)}
  shadow(c,252,y+54,15,2);
 }
 function roomLife(t,still){if(!furnished()){catFrame=0;return}const y=roomY();catFrame=still?0:Math.floor(t/.95)%4;
  api.actor(1,{x:233,y:y+33,w:39,h:25,room:'cat'},(c,x,yy)=>{const rise=[0,1,1,0][catFrame],head=catFrame>=2?1:0;
   e(c,x+16,yy+13-rise,14,7+rise,30);e(c,x+6,yy+17,6,4,29);e(c,x+6,yy+16,4,2,30);p(c,[[x+10,yy+8-rise],[x+14,yy+7-rise],[x+16,yy+12-rise],[x+12,yy+13-rise]],29);l(c,x+20,yy+8-rise,x+22,yy+11-rise,29);
   e(c,x+30,yy+13+head,6,5,13);p(c,[[x+24,yy+10+head],[x+25,yy+4+head],[x+29,yy+9+head]],30);p(c,[[x+30,yy+9+head],[x+34,yy+5+head],[x+35,yy+12+head]],30);l(c,x+28,yy+13+head,x+31,yy+14+head,24);r(c,x+35,yy+15+head,1,1,29);r(c,x+21,yy+19,11,2,39);
  });api.creature('sleeping-cat',{x:233,y:y+33,w:39,h:25});
  const phase=still?0:Math.floor(t*.8)%4;api.actor(2,{x:181,y:y-17,w:23,h:22},(c,x,yy)=>{c.save();c.globalAlpha=isWet(state.weather)?.7:.45;const vapor=state.time==='night'?39:17;for(let i=0;i<2;i++){const dx=[0,1,0,-1][(phase+i)%4],xx=x+5+i*6;l(c,xx,yy+19,xx-1+dx,yy+13,vapor);l(c,xx-1+dx,yy+13,xx+1+dx,yy+8,vapor);r(c,xx+1+dx,yy+4,1,2,vapor)}c.restore()});
  for(let i=0;i<3;i++){const f=still?(i+1)*.23:(t*.07+i*.31)%1,x=[139,205,255][i]+Math.round(Math.sin(still?i:t*.35+i)*7),yy=83+Math.floor(f*(y-48));api.actor(2,{x,y:yy,w:4,h:4},(c,x,yy)=>{const tone=state.season==='spring'?27:state.season==='summer'?18:state.season==='autumn'?37:25;r(c,x+1,yy,2,1,tone);r(c,x,yy+1,3,1,tone);r(c,x+1,yy+2,1,1,state.season==='spring'?28:30)})}
 }
 const shifted=paint=>c=>{c.save();c.translate(0,top());paint(c);c.restore()};
 return{layers:[c=>{if(portrait())ceiling(c);shifted(garden)(c)},c=>{shifted(room)(c);if(portrait()){const start=Math.max(8,Math.round(top()*.2)),end=top()+104;for(const x of [66,282]){r(c,x,start,36,end-start,13);for(let xx=x;xx<=x+36;xx+=12)r(c,xx,start,2,end-start,24);for(let y=start;y<end;y+=15)r(c,x,y,37,2,24)}for(const x of [64,100,280,318])r(c,x,start,3,end-start,21)}},shifted(tatami)],depths:[0,0,0],dynamicDepths:[0,0,0,0],get weatherClip(){return[103,12+top(),176,70]},puddles:[],frame(t,still){
  roomLife(t,still);
  for(const[i,x,y]of [[0,121,67],[1,252,63]]){api.actor(1,{x,y,w:11,h:9},(c,x,y)=>C.bird(c,x,y,still?i:Math.floor(t*2+i)%4));api.creature('garden-bird',{x,y,w:9,h:7})}
  for(const[i,x0,y]of [[0,172,61],[1,212,64]]){const x=x0+(still?0:Math.sin(t*.2+i)*5);api.actor(0,{x,y,w:23,h:10},(c,x,y)=>C.fish(c,x,y,still?2:Math.floor(t*4),i));api.creature('pond-koi',{x,y,w:21,h:8})}
  if(state.season==='spring')for(let i=0;i<6;i++){const x=136+(i*23+(still?0:t*2))%102,y=29+(i*11+(still?0:t*2))%47;api.actor(2,{x,y,w:3,h:2},(c,x,y)=>{r(c,x,y,2,1,27);r(c,x+1,y+1,1,1,28)})}
 },stats(){return{formClearance:{x:112,y:90+top(),w:160,h:height()-90-top()},roomObjects:furnished()?[{kind:'chabudai',x:150,y:top()+roomY(),w:80,h:47},{kind:'zabuton',x:119,y:top()+roomY()+35,w:38,h:25},{kind:'zabuton',x:234,y:top()+roomY()+34,w:38,h:24},{kind:'sleeping-cat',x:233,y:top()+roomY()+33,w:39,h:25}]:[],catFrame,catFrames:4,seasonParticles:furnished()?3:0,portrait:portrait(),ceilingHeight:top(),loginBackground:true}}};
}};