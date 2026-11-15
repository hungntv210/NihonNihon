import {SceneEngine} from './engine.js';
export default {crop:0.5,id:'review-koi',title:'Ao koi · Ôn tập',description:'Dưới bóng lá, từng con cá chậm rãi tìm đường qua mặt nước.',params:{dueCards:0},swatches:{29:'#b95d4c',30:'#d4a85e',31:'#263a40'},create(api){
 const {state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p}=d;let leaving=null,departing=0,previous=0;
 // Vertical koi silhouettes: head, tapered body, paired pectoral fins and a separate moving tail.
 const koi=Array.from({length:3},(_,type)=>Array.from({length:6},(_,frame)=>{
  const a=Array.from({length:32},()=>Array(22).fill(-1)),put=(x,y,v)=>{if(a[y]&&x>=0&&x<22)a[y][x]=v};
  for(let y=3;y<=25;y++){
   const bend=Math.round(Math.sin(frame*Math.PI/3)*Math.max(0,y-15)/18),mid=10+bend,w=y<7?3:y<12?4:y<18?3:y<22?2:1;
   for(let x=-w;x<=w;x++){let color=type===1?30:39;if(type===0&&((y>5&&y<10&&x<2)||(y>13&&y<18&&x>-2)||(y>21&&x<=0)))color=29;if(type===2&&((y>6&&y<12&&x<2)||(y>17&&x>-1)))color=31;if(x===w)color=type===1?37:color===39?13:color;put(mid+x,y,color)}
  }
  for(const side of [-1,1])for(let y=10;y<15;y++)for(let x=4;x<8-(y-10)/2;x++)put(10+side*x,y,type===1?36:13);
  const sway=[-1,0,1,1,0,-1][frame],tailRoot=10+Math.round(Math.sin(frame*Math.PI/3)*10/18);for(let y=26;y<31;y++){const m=tailRoot+Math.round((y-25)*sway/5);for(let x=-(y-25)/2;x<=(y-25)/2;x++)put(m+Math.round(x),y,type===1?36:13)}
  put(8,6,21);put(12,6,21);put(10,3,type===1?36:14);return a;
 }));
 function outline(){return Array.from({length:100},(_,i)=>{const a=i/100*Math.PI*2,bulge=1+.045*Math.sin(a*5)+.028*Math.cos(a*9);return[191+Math.cos(a)*174*bulge,131+Math.sin(a)*121*bulge]})}
 function bed(c){
  r(c,0,0,384,216,19);const rand=api.random(1645);
  for(let i=0;i<1700;i++){const x=rand()*384,y=rand()*216;r(c,x,y,1+rand()*2,1,[18,9,8,20][i%4])}
  p(c,outline(),21);
  // Individually shaded, uneven stones interrupt the natural shore. Water continues below the view.
  for(let i=0;i<65;i++){
   const a=i/65*6.283,b=1+.045*Math.sin(a*5)+.028*Math.cos(a*9),x=191+Math.cos(a)*175*b,y=131+Math.sin(a)*122*b,w=5+rand()*8,h=3+rand()*5;
   p(c,[[x-w,y-h/2],[x-w*.4,y-h],[x+w*.6,y-h+1],[x+w,y+1],[x+w*.4,y+h],[x-w*.6,y+h-1]],20);
   p(c,[[x-w+1,y-h/2],[x-w*.4,y-h],[x+w*.5,y-h+1],[x+w-2,y],[x,y+2],[x-w*.6,y+1]],16);l(c,x-w+3,y-h/2,x-1,y-h+1,15);l(c,x+2,y+1,x+w-2,y-1,7);
   if(state.season==='winter'){p(c,[[x-w+1,y-h/2-1],[x-w*.4,y-h-2],[x+w*.5,y-h-1],[x+w-2,y-1],[x,y]],39);l(c,x-w+3,y-1,x+2,y+1,13)}
  }
  for(let i=0;i<90;i++){const a=rand()*6.28,x=191+Math.cos(a)*181,y=131+Math.sin(a)*126;for(let k=0;k<5;k++){const xx=x-4+k*2;l(c,xx,y+3,xx+(k-2)*2,y-3-rand()*8,18);r(c,xx,y-3,1,3,9)}}
  for(let i=0;i<42;i++){const x=42+rand()*298,y=38+rand()*169;if(((x-191)/153)**2+((y-131)/109)**2<1){e(c,x,y,5+rand()*14,2+rand()*4,i%3?22:20);for(let j=0;j<5;j++)r(c,x-6+rand()*15,y-2+rand()*4,1,1,7)}}
  for(let i=0;i<110;i++){const x=30+rand()*328,y=25+rand()*189;if(((x-191)/158)**2+((y-131)/115)**2<1)l(c,x,y,x+1+rand()*4,y,i%5?7:8)}
  for(const [x,y]of [[130,20],[178,14],[232,21]]){e(c,x+4,y+10,10,4,20);e(c,x+3,y+8,9,3,16);l(c,x-3,y+7,x+7,y+6,state.season==='winter'?39:15)}
 }
 function shadows(c){for(const [x,y,w,h]of [[48,82,24,13],[67,110,22,10],[316,73,27,15],[300,161,26,14],[118,39,25,8]]){e(c,x,y,w,h,22);for(let i=0;i<5;i++)e(c,x-w/2+i*w/4,y-3+(i%2)*5,6,3,20)}}
 function pad(c,x,y,size){
  e(c,x+2,y+3,size-1,Math.round(size*.6),7);e(c,x,y,size,Math.round(size*.68),18);e(c,x-2,y-2,size-3,Math.max(1,Math.round(size*.45)),9);
  p(c,[[x,y],[x+size+1,y-2],[x+size-1,y+5]],7);l(c,x-size+3,y-1,x-3,y,10);l(c,x-6,y-5,x-1,y-1,10);r(c,x-5,y-3,2,1,11);
 }
 function flower(c,x,y,pink){
  for(let layer=0;layer<2;layer++)for(let i=0;i<8;i++){const a=(i+.5*layer)/8*6.28,rr=layer?4:7;p(c,[[x,y+1],[x+Math.cos(a-.3)*rr,y+Math.sin(a-.3)*rr*.6-2],[x+Math.cos(a)*rr,y+Math.sin(a)*rr*.6-3],[x+Math.cos(a+.3)*rr,y+Math.sin(a+.3)*rr*.6-2]],pink?27+layer:13+layer)}e(c,x,y-1,2,1,36);
 }
 function bankPlants(c){
  const winter=state.season==='winter';
  for(const [x,y,s]of [[94,70,18],[112,57,12],[117,79,16],[78,92,11],[275,145,21],[297,132,17],[290,161,13],[263,168,10],[220,48,12],[237,42,8],[139,176,14]]){
   if(winter){e(c,x,y,s,Math.max(2,s*.5),20);l(c,x-s+3,y-2,x+s-3,y-2,13)}else pad(c,x,y,s);
  }
  if(!winter){flower(c,112,69,false);flower(c,280,148,true);flower(c,235,41,false)}
  // Iris and reeds are rooted on the bank; no diagonal deck lines.
  for(let i=0;i<26;i++){const x=11+(i*7)%45,y=147+(i*13)%51,h=8+i%11;l(c,x,y,x+(i%3-1)*5,y-h,18);l(c,x+1,y,x+3,y-h+4,9);if(!winter&&i%3===0){p(c,[[x+2,y-h],[x-1,y-h-3],[x+2,y-h-5],[x+4,y-h-2],[x+7,y-h-3],[x+5,y-h+1]],5);r(c,x+2,y-h-1,1,2,14)}if(winter)l(c,x-2,y-h-1,x+2,y-h-1,39)}
 }
 function paintFish(c,frame,x,y,angle,type,submerged,scale=1){
  const a=koi[type][frame%6],cos=Math.cos(angle),sin=Math.sin(angle);
  // Inverse nearest-pixel sampling keeps the body solid when its heading changes.
  for(let yy=-Math.ceil(19*scale);yy<=Math.ceil(19*scale);yy++)for(let xx=-Math.ceil(19*scale);xx<=Math.ceil(19*scale);xx++){const sy=Math.round((-xx*sin+yy*cos)/scale)+15,sx=Math.round((xx*cos+yy*sin)/scale)+10;let v=a[sy]?.[sx];if(v===undefined||v<0)continue;if(submerged)v=v===39||v===13?16:v===29||v===30?17:7;r(c,x+xx,y+yy,1,1,v)}
 }
 return{depths:[0,0,0],dynamicDepths:[0,0,0,0],layers:[bed,shadows,bankPlants],puddles:[],normalize(v){v.dueCards=Math.min(10,Math.floor(v.dueCards));if(v.dueCards===0&&previous>0){departing=previous;leaving=state.seconds;}else if(v.dueCards>0){leaving=null;departing=0;}previous=v.dueCards;},frame(t,still){
  if(api.reduced?.()&&leaving!==null)leaving=state.seconds-3;
  const total=leaving===null?state.params.dueCards:departing,elapsed=leaving===null?0:Math.max(0,t-leaving),gone=leaving!==null&&elapsed>=3;
  for(let i=0;i<2;i++){const a=i*Math.PI+t*.025,x=192+Math.cos(a)*56,y=126+Math.sin(a)*62,angle=Math.atan2(Math.cos(a)*62,-Math.sin(a)*56)+Math.PI/2;api.actor(0,{x:x-30,y:y-30,w:61,h:61},(c,xx,yy)=>paintFish(c,Math.floor(t*2+i)%6,xx+30,yy+30,angle,i,false,1.25));api.creature('resident-koi',{x:x-24,y:y-24,w:48,h:48});}
  if(!gone)for(let i=0;i<total;i++){
   const a=i*2.399+(still?.2:t*.05),rx=35+(i%3)*16,ry=43+(i%4)*8;
   let x=192+Math.cos(a)*rx,y=124+Math.sin(a)*ry,angle=Math.atan2(Math.cos(a)*ry,-Math.sin(a)*rx)+Math.PI/2;
   if(leaving!==null){x+=(192-x)*Math.min(1,elapsed);y+=elapsed*65;angle=Math.PI}
   const dive=leaving===null&&(still?i%5===4:(t+i*3)%29>23);
   api.actor(0,{x:x-24,y:y-24,w:49,h:49},(c,xx,yy)=>paintFish(c,Math.floor(t*5+i)%6,xx+24,yy+24,Math.round(angle/(Math.PI/16))*Math.PI/16,i%3,dive,.65));if(y<216)api.creature('koi',{x:x-18,y:y-18,w:36,h:36});
   if(!dive&&(still||Math.floor(t+i)%11===0))api.actor(1,{x:x-18,y:y-7,w:37,h:15},(c,xx,yy)=>{for(let n=0;n<30;n++){const a=n/30*6.28;if(n%5<3)r(c,xx+18+Math.round(Math.cos(a)*17),yy+7+Math.round(Math.sin(a)*6),1,1,7)}});
  }
  for(const [i,x,y]of [[0,130,20],[1,178,14],[2,232,21]]){api.actor(2,{x,y,w:11,h:9},(c,xx,yy)=>{api.sprite(c,SceneEngine.sprites.bird,still?i:Math.floor(t*3+i)%4,xx,yy);r(c,xx+3,yy+4,2,1,14);r(c,xx+6,yy+2,2,1,36)});api.creature('sparrow',{x,y,w:9,h:7})}
  if(state.season!=='winter'&&(still||api.scheduled(t,'dragonfly',12,18,.7))){const x=225+(still?0:Math.sin(t)*9),y=82;api.actor(2,{x,y,w:11,h:7},(c,xx,yy)=>api.sprite(c,SceneEngine.sprites.dragonfly,Math.floor(t*7),xx,yy));api.creature('dragonfly',{x,y,w:9,h:5})}
  if(state.weather==='rain')for(let i=0;i<9;i++){const x=120+(i*31)%133,y=60+(i*47)%130,phase=still?i%3:(t*2+i)%3;api.actor(1,{x:x-5,y:y-3,w:11,h:7},(c,xx,yy)=>{const rad=1+Math.floor(phase);for(let n=0;n<16;n++){const a=n/16*6.28;r(c,xx+5+Math.round(Math.cos(a)*rad),yy+3+Math.round(Math.sin(a)*rad*.5),1,1,16)}})}
 },complete(instant){if(leaving!==null)return;departing=state.params.dueCards;leaving=state.seconds;if(instant)leaving=state.seconds-3},stats(){return{fishCount:2+(leaving!==null?(state.seconds-leaving>=3?0:departing):state.params.dueCards),residentCount:2,dueFishCount:leaving!==null?(state.seconds-leaving>=3?0:departing):state.params.dueCards,completed:leaving!==null}}};
}};