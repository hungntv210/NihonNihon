import {SceneEngine} from './engine.js';
export default {crop:0.52,id:'shadowing-inari',title:'Inari · Shadowing',description:'Một lối cổng đỏ men sườn núi, giữa rừng tuyết tùng và tiếng chuông.',params:{progress:0},swatches:state=>state.time==='night'?{29:'#ad684c',30:'#824332',31:'#4c302b'}:{29:'#ce8856',30:'#a94e34',31:'#6b352d'},create(api){
 const {state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p}=d,winter=()=>state.season==='winter';
 const pathPoints=[[145,184],[166,163],[188,141],[211,122],[235,103],[258,88]];
 const point=progress=>{const n=Math.max(0,Math.min(1,progress))*(pathPoints.length-1),i=Math.min(pathPoints.length-2,Math.floor(n)),f=n-i;return{x:pathPoints[i][0]+(pathPoints[i+1][0]-pathPoints[i][0])*f,y:pathPoints[i][1]+(pathPoints[i+1][1]-pathPoints[i][1])*f}};
 function cedar(c,x,y,h,w,near=false){
  r(c,x-2,y-h,4,h,24);r(c,x,y-h,1,h,25);
  for(let j=0;j<6;j++){const yy=y-h+j*h*.14,ww=w*(.26+j*.13);p(c,[[x,yy-8],[x-ww,yy+17],[x-ww*.5,yy+16],[x,yy+21],[x+ww*.65,yy+17],[x+ww,yy+16]],near?19:6);p(c,[[x-1,yy-7],[x-ww*.8,yy+13],[x+ww*.4,yy+11]],near?18:5);l(c,x-ww*.6,yy+12,x+ww*.3,yy+12,near?9:4);if(winter()){p(c,[[x-ww*.8,yy+12],[x-ww*.35,yy+8],[x,yy+7],[x+ww*.5,yy+10],[x+ww*.7,yy+12],[x+ww*.25,yy+13],[x-ww*.3,yy+11]],39);l(c,x-ww*.5,yy+13,x+ww*.3,yy+14,13);if(j===0)r(c,x-1,yy-8,2,2,39)}}
 }
 function distance(c){
  r(c,0,0,384,216,0);r(c,0,39,384,47,3);r(c,0,76,384,35,4);
  if(state.time==='night'){e(c,91,25,10,10,1);e(c,91,25,6,6,39);for(let i=0;i<38;i++)r(c,(i*71)%384,5+(i*19)%64,1,1,i%4?15:39)}else e(c,102,27,10,10,14);
  p(c,[[0,63],[38,47],[67,55],[115,34],[155,50],[191,39],[245,58],[303,42],[384,57],[384,119],[0,119]],5);
  p(c,[[0,88],[41,69],[78,78],[124,61],[166,80],[207,57],[264,70],[301,60],[384,78],[384,132],[0,132]],6);
  // Kyoto roofs occupy a distant valley to the left of the hillside.
  for(let i=0;i<14;i++){const x=3+(i*23)%138,y=85+(i%3)*7,w=13+i%5;r(c,x,y,w,10,15);p(c,[[x-3,y],[x+3,y-4],[x+w-2,y-4],[x+w+3,y]],7);r(c,x+3,y+4,2,3,state.time==='night'?35:17);if(winter())l(c,x+2,y-5,x+w-2,y-5,39)}
  for(let i=0;i<19;i++)cedar(c,139+i*14,112+(i%4)*5,55+i%3*8,12,false);
 }
 function hillside(c){
  p(c,[[0,141],[73,121],[134,140],[199,99],[263,77],[326,86],[384,64],[384,216],[0,216]],19);
  p(c,[[0,174],[82,149],[121,163],[195,112],[272,88],[325,123],[384,117],[384,216],[0,216]],18);
  // The path runs diagonally across the slope rather than facing the camera.
  p(c,[[103,216],[121,181],[151,154],[177,131],[201,112],[224,94],[248,80],[271,85],[248,112],[224,132],[202,153],[181,178],[160,216]],20);
  p(c,[[111,216],[130,182],[158,156],[183,134],[206,115],[229,98],[252,84],[265,87],[243,108],[219,128],[196,149],[175,174],[150,216]],16);
  const rand=api.random(999);
  for(let i=0;i<23;i++){
   const f=i/22,pt=point(f),w=26-f*15,x=pt.x,y=pt.y;
   l(c,x-w,y+3,x+w,y-1,7);l(c,x-w+1,y+4,x+w-1,y,11);l(c,x-4+(i%3)*3,y,x-5+(i%3)*3,y-3,17);
   if(winter()){l(c,x-w+2,y+1,x+w-2,y-3,39);l(c,x-w+4,y+2,x-5,y,13)}
  }
  for(let i=0;i<650;i++){const x=rand()*384,y=112+rand()*104;if(Math.abs(x-(145+(184-y)*1.15))>28){r(c,x,y,1+rand()*2,1,i%3?9:17);if(winter()&&i%5===0)r(c,x,y-1,3,1,39)}}
  for(let i=0;i<12;i++){const x=17+(i*39)%384;if(x<130||x>278)cedar(c,x,145+(i%4)*15,70+i%3*16,12+i%4*3,true)}
  // Tall bamboo along the outside edges leaves the entrance and tunnel readable.
  for(const x of [11,22,35,354,365,376]){r(c,x,38,2,168,18);r(c,x,38,1,168,9);for(let y=48;y<206;y+=17){r(c,x-1,y,4,2,19);l(c,x,y+4,x+(x<100?10:-10),y-4,18);l(c,x,y+4,x+(x<100?7:-7),y+8,9)}}
 }
 function gate(c,x,foot,w,h){
  const y=foot-h,leg=Math.max(3,Math.floor(w/14)),left=x-w/2+5,right=x+w/2-5,tilt=-4;
  for(const xx of [left,right]){const shift=xx===right?tilt:0;r(c,xx,y+5+shift,leg,h-5,31);r(c,xx+1,y+6+shift,leg-2,h-9,30);r(c,xx+1,y+7+shift,1,h-13,29);r(c,xx,foot-8+shift,leg,9,21);r(c,xx-2,foot+shift,leg+4,3,7)}
  p(c,[[left-7,y-2],[left-4,y],[right+leg+3,y+tilt],[right+leg+7,y+tilt-3],[right+leg+5,y+tilt+3],[left-6,y+4]],21);
  p(c,[[left-4,y+4],[right+leg+3,y+tilt+4],[right+leg+3,y+tilt+7],[left-4,y+7]],30);l(c,left-4,y+4,right+leg+3,y+tilt+4,29);
  l(c,left-3,y+14,right+leg+3,y+tilt+14,30);l(c,left-3,y+15,right+leg+3,y+tilt+15,30);r(c,x-2,y+7,4,6,31);
  if(winter()){p(c,[[left-7,y-4],[left-3,y-2],[right+leg+4,y+tilt-2],[right+leg+7,y+tilt-4],[right+leg+5,y+tilt],[left-6,y]],39);l(c,left-4,y+1,right+leg+3,y+tilt+1,13)}
 }
 function lantern(c,x,y,small=false){
  const h=small?14:21,w=small?4:6;e(c,x,y,w+3,3,20);r(c,x-w+1,y-h,w*2-2,h,17);r(c,x-w,y-h-2,w*2,7,16);r(c,x-2,y-h,4,4,state.time==='night'?35:7);p(c,[[x-w-4,y-h-3],[x,y-h-10],[x+w+4,y-h-3]],7);p(c,[[x-w-2,y-h-4],[x,y-h-9],[x+w+1,y-h-4]],15);r(c,x-1,y-h-13,2,4,16);if(winter()){p(c,[[x-w-3,y-h-5],[x,y-h-11],[x+w+3,y-h-5],[x+w,y-h-3],[x,y-h-7],[x-w,y-h-3]],39);l(c,x-w+1,y-h-1,x+w-1,y-h-1,13)}
 }
 function architecture(c){
  for(let i=10;i>=0;i--){const f=i/10;gate(c,151+f*107,166-f*75,62-f*35,65-f*34)}
  for(const [x,y,sm]of [[112,186,false],[218,171,false],[214,128,true],[271,110,true]])lantern(c,x,y,sm);
  // A small shrine sits on a stone plinth beside the trail, with bowed eaves and a real porch.
  p(c,[[284,169],[280,176],[365,176],[359,169]],20);r(c,290,137,64,33,24);r(c,293,140,58,28,25);
  for(let x=295;x<350;x+=5)l(c,x,142,x,168,24);r(c,308,141,24,28,20);r(c,310,144,20,21,23);for(let x=312;x<331;x+=4)r(c,x,145,1,19,24);
  p(c,[[277,136],[285,134],[297,120],[345,120],[358,133],[369,135],[364,139],[279,140]],21);p(c,[[282,134],[298,122],[344,122],[360,135],[352,133],[291,134]],7);
  for(let i=0;i<4;i++)l(c,296-i*3,123+i*3,345+i*4,123+i*3,18);for(let x=298;x<346;x+=7)l(c,x,122,x+4,135,6);
  if(winter()){p(c,[[280,133],[296,118],[345,118],[366,133],[358,132],[344,121],[298,121],[286,133]],39);l(c,282,137,363,136,13);r(c,285,173,74,2,39)}
  for(let x=298;x<345;x++){const y=142+Math.round(Math.sin((x-298)/47*Math.PI)*3);r(c,x,y,1,2,x%3?12:25)}for(const x of [304,318,335])p(c,[[x,145],[x+3,148],[x,152],[x+2,155],[x-2,153],[x-1,148]],39);
  r(c,321,144,1,13,12);r(c,317,157,9,6,37);l(c,318,156,324,156,36);r(c,320,162,2,7,12);
  // Ema plaques are hung from a timber rack, grounded on the hillside.
  for(const x of [65,101]){r(c,x,153,3,38,24);r(c,x+1,154,1,34,25);e(c,x+1,191,5,2,20)}r(c,62,151,45,4,24);p(c,[[58,151],[66,145],[102,145],[111,151]],21);if(winter())l(c,64,144,104,144,39);
  for(let row=0;row<2;row++)for(let i=0;i<5;i++){const x=68+i*7,y=157+row*12;r(c,x+2,y-3,1,4,12);p(c,[[x,y+2],[x+3,y],[x+6,y+2],[x+6,y+8],[x,y+8]],i%2?12:25);r(c,x+2,y+3,2,2,24)}
  for(let i=0;i<5;i++)gate(c,247+i*9,150-i*4,9,13);
 }
 function kitsune(c,x,y,flip){
  e(c,x,y+2,9,3,20);r(c,x-7,y-2,15,4,16);p(c,[[x-4,y-3],[x-5,y-14],[x-2,y-23],[x-4,y-29],[x-1,y-26],[x+3,y-30],[x+4,y-24],[x+7,y-21],[x+3,y-18],[x+4,y-6],[x+7,y-3]],15);
  p(c,[[x-3,y-4],[x-3,y-15],[x,y-22],[x+3,y-21],[x+2,y-6]],11);p(c,[[x-4,y-5],[x-10,y-12],[x-11,y-17],[x-8,y-15],[x-5,y-9]],16);
  r(c,x+(flip?-2:2),y-24,1,1,21);p(c,[[x-4,y-19],[x+4,y-19],[x+5,y-14],[x,y-11],[x-4,y-15]],30);l(c,x-2,y-18,x+3,y-18,29);if(winter()){l(c,x-6,y-3,x+6,y-3,39);r(c,x-3,y-27,5,1,39)}
 }
 function foreground(c){kitsune(c,120,204,false);kitsune(c,187,202,true);for(let i=0;i<8;i++){const x=5+i*12,y=211-(i%3)*4;e(c,x,y,10,6,19);e(c,x-2,y-3,7,3,18);if(winter())e(c,x-1,y-5,6,2,39)}}
 function largeFox(c,index,x,y){const a=SceneEngine.sprites.fox[index%8];for(let yy=0;yy<a.length;yy++)for(let xx=0;xx<a[yy].length;xx++)if(a[yy][xx]>=0)r(c,x+Math.floor((a[yy].length-xx-1)*1.5),y+Math.floor(yy*1.5),Math.ceil(1.5),Math.ceil(1.5),a[yy][xx])}
 return{depths:[.25,.5,.5,1],dynamicDepths:[.5,.5,.5,0],layers:[distance,hillside,architecture,foreground],puddles:[[141,194,18],[195,155,12]],normalize(p){p.progress=Math.min(1,p.progress)},frame(t,still){
  const pos=point(state.params.progress),x=pos.x-12,y=pos.y-15;api.actor(1,{x,y,w:28,h:17},(c,xx,yy)=>largeFox(c,still?1:Math.floor(t*7)%8,xx,yy));api.creature('fox',{x,y,w:26,h:15});
  for(const [i,x,y]of [[0,137,190],[1,231,171],[2,200,119]]){api.actor(2,{x,y,w:11,h:9},(c,xx,yy)=>{api.sprite(c,SceneEngine.sprites.bird,still?i:Math.floor(t*3+i)%4,xx,yy);r(c,xx+6,yy+2,2,1,36)});api.creature('sparrow',{x,y,w:9,h:7})}
  // A crow rests on the third gate's lintel, not in open sky.
  api.actor(2,{x:178,y:78,w:13,h:11},(c,x,y)=>{p(c,[[x,y+6],[x+3,y+3],[x+5,y+2],[x+9,y+3],[x+10,y+6],[x+8,y+8],[x+2,y+8]],21);r(c,x+7,y+2,3,3,21);r(c,x+10,y+4,2,1,20);l(c,x+4,y+8,x+4,y+10,21);l(c,x+8,y+8,x+8,y+10,21)});api.creature('crow',{x:178,y:78,w:12,h:11});
  // One small pilgrim keeps a quiet walking cycle on the lower steps.
  api.actor(1,{x:164,y:175,w:8,h:15},(c,x,y)=>{e(c,x+4,y+3,3,1,12);r(c,x+2,y+1,3,3,13);r(c,x+1,y+5,5,6,7);r(c,x+4,y+6,3,4,24);const f=still?0:Math.floor(t*3)%2;l(c,x+2,y+11,x+1+f,y+14,21);l(c,x+5,y+11,x+6-f,y+14,21)});
  api.actor(2,{x:321,y:164,w:10,h:19},(c,x,y)=>{const n=still?0:Math.round(Math.sin(t*2)*2);l(c,x,y,x+n,y+5,12);p(c,[[x-2+n,y+5],[x+2+n,y+5],[x+3+n,y+15],[x-1+n,y+15]],13)});
  if(state.season==='summer')for(let i=0;i<6;i++){const x=125+(i*31)%142+(still?0:Math.sin(t*.7+i)*3),y=112+(i*23)%75;api.actor(2,{x,y,w:3,h:3},(c,xx,yy)=>{r(c,xx,yy,1,1,still||Math.sin(t*1.5+i)>.2?35:18);r(c,xx+1,yy+1,1,1,36)})}
 },stats(){return{foxPosition:point(state.params.progress),progress:state.params.progress,tunnelWidth:176}}};
}};