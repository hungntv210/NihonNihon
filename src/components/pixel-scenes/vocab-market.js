import {SceneCraft} from './scene-craft.js';
export default {crop:.5,id:'vocab-market',title:'Phố chợ · Từ vựng',description:'Dưới mái vòm, các sạp đầy thêm sau mỗi nhóm 250 từ đã học.',params:{vocabLearned:500},swatches:{29:'#ad6045',30:'#c09853',31:'#644d3c'},create(api){
 const {state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p,lettering}=d,C=SceneCraft(api);let stock=0;
 const glyphs={
  '八':['.............','.....#.#.....','.....#.#.....','.....#..#....','....#...#....','....#...#....','...#.....#...','...#.....#...','..#.......#..','.#.........#.','#...........#','.............','.............'],
  '百':['.###########.','......#......','.....#.......','...#######...','...#.....#...','...#.....#...','...#######...','...#.....#...','...#.....#...','...#.....#...','...#######...','.............','.............'],
  '屋':['.###########.','.#.........#.','.###########.','.#...........','.#..########.','.#......#....','.#.....#.....','.#...#######.','.#......#..#.','.#......#....','#....#######.','#.......#....','...##########'],
  '魚':['.....##......','....#..#.....','...#####.....','..#....#.....','...#######...','...#..#..#...','...#######...','...#..#..#...','...#######...','.............','..#..#..#..#.','.#...#..#...#','.............']};
 function sign(c,text,x,y){for(const ch of text){glyphs[ch].forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='#')r(c,x+xx,y+yy,1,1,20)}));x+=15}}
 function shiba(c,x,y,f){
  e(c,x+18,y+20,16,3,7);e(c,x+5,y+7,5,5,31);e(c,x+5,y+6,4,4,30);e(c,x+5,y+6,2,2,16);l(c,x+3,y+4,x+5,y+3,39);
  p(c,[[x+8,y+7],[x+25,y+7],[x+28,y+11],[x+26,y+16],[x+10,y+16],[x+7,y+12]],29);e(c,x+17,y+10,11,5,30);p(c,[[x+10,y+13],[x+25,y+12],[x+24,y+16],[x+12,y+16]],13);
  p(c,[[x+23,y+8],[x+24,y+1],[x+28,y+4],[x+31,y],[x+34,y+7],[x+34,y+11],[x+29,y+14],[x+24,y+12]],31);p(c,[[x+24,y+7],[x+25,y+2],[x+28,y+5],[x+31,y+2],[x+33,y+7],[x+32,y+11],[x+27,y+12]],30);p(c,[[x+25,y+8],[x+28,y+9],[x+31,y+7],[x+34,y+9],[x+34,y+12],[x+28,y+13],[x+25,y+11]],39);r(c,x+26,y+7,1,1,21);r(c,x+31,y+6,1,1,21);r(c,x+34,y+9,2,1,21);
  const gait=[0,1,2,1,0,-1][f%6];for(const [xx,step]of [[11,gait],[16,-gait],[24,gait]]){r(c,x+xx,y+14,2,4,30);l(c,x+xx,y+17,x+xx+step,y+19,13);r(c,x+xx+step,y+19,3,1,31)}
 }
 function street(c){
  C.sky(c);r(c,0,80,384,136,23);p(c,[[172,86],[221,86],[303,216],[63,216]],16);
  for(let row=0;row<22;row++){const y=98+row*6,left=170-(y-98)*.7,right=220+(y-98)*.65;l(c,left,y,right,y,17);for(let x=left+((row%2)*8);x<right;x+=16)l(c,x,y,x+3,y+5,15)}
  for(let i=0;i<12;i++){const y=145+i*6;l(c,180-(y-145)*.45,y,184-(y-145)*.45,y,13)}
  r(c,0,66,154,112,24);r(c,244,65,140,113,24);r(c,4,68,146,104,25);r(c,248,67,133,104,25);
  for(let x=8;x<150;x+=6)l(c,x,70,x,170,24);for(let x=252;x<384;x+=6)l(c,x,69,x,170,24);
  r(c,152,94,83,43,24);r(c,157,100,73,34,20);C.roof(c,153,86,81,10,false);
  for(let x=157;x<234;x+=10){r(c,x,99,8,10,18);l(c,x+1,100,x+1,106,9)}
  if(state.season==='winter'){r(c,0,173,53,3,39);r(c,327,171,57,3,39)}
 }
 function shops(c){
  stock=Math.min(4,Math.floor(state.params.vocabLearned/250));
  for(const [x,w]of [[15,122],[253,116]]){
   r(c,x,89,w,46,21);r(c,x+3,92,w-6,39,22);r(c,x-3,132,w+6,5,24);r(c,x-3,136,w+6,28,25);for(let xx=x;xx<x+w;xx+=7)l(c,xx,138,xx,162,24);r(c,x+2,163,5,13,24);r(c,x+w-7,163,5,13,24);
   for(let i=0;i<6;i++){r(c,x+i*w/6,91,w/6-2,17,x<100?18:29);l(c,x+i*w/6+3,93,x+i*w/6+3,102,x<100?9:30)}
  }
  // Racks, price pictograms, bags and wicker baskets stay physically attached even when empty.
  for(const [x,w]of [[19,113],[255,104],[158,66]]){r(c,x,113,w,3,24);for(let i=0;i<5;i++){const xx=x+8+i*(w-15)/5;l(c,xx,107,xx,114,12);if(x>150&&x<250){p(c,[[xx-3,115],[xx+3,115],[xx+4,121],[xx-3,121]],30);r(c,xx-2,116,4,1,13)}else{r(c,xx-3,110,7,8,21);r(c,xx-2,111,5,6,13);e(c,xx,113,1,1,x<100?18:7);l(c,xx-1,116,xx+2,116,24)}}}
  for(const [x,y]of [[67,177],[131,174],[315,176]]){e(c,x,y,10,5,24);r(c,x-9,y-4,18,6,30);e(c,x,y-4,9,3,12);e(c,x,y-4,7,2,23);for(let k=-7;k<=7;k+=3)l(c,x+k,y-3,x+k,y+3,25);l(c,x-8,y+1,x+8,y+1,25)}
  // Each level adds a full layer of individually recognisable stock.
  for(const [x,y,w]of [[19,124,31],[56,124,31],[94,124,31],[255,125,48],[310,125,46],[159,126,62]]){
   r(c,x,y,w,9,24);r(c,x+1,y+1,w-2,6,12);r(c,x+3,y+2,w-6,4,23);l(c,x,y+7,x+w,y+7,25);
   if(x>250)for(let i=0;i<33;i++){const xx=x+2+(i*17)%(w-5),yy=y-1-(i*7)%5;p(c,[[xx,yy],[xx+2,yy-2],[xx+4,yy],[xx+2,yy+1]],i%2?33:39)}
   for(let i=0;i<stock*4;i++){
    const xx=x+4+(i%4)*(w-8)/4,yy=y-1-Math.floor(i/4)*5;
    if(x>250){const fx=xx+1,fy=yy-2;e(c,fx,fy,4,2,15);l(c,fx-3,fy,fx+3,fy,33);p(c,[[fx+3,fy],[fx+6,fy-2],[fx+6,fy+2]],7);r(c,fx-3,fy,1,1,21);l(c,fx-1,fy-1,fx-1,fy+1,7)}
    else if(x>150){r(c,xx,yy-5,8,6,i%2?12:30);r(c,xx+1,yy-4,6,3,13);r(c,xx+2,yy-3,4,1,25);l(c,xx,yy,xx+7,yy,24)}
    else if(x<50){e(c,xx+1,yy-2,4,3,18);e(c,xx,yy-3,3,2,9);l(c,xx-2,yy-4,xx+3,yy-2,10);l(c,xx,yy-5,xx+1,yy,11)}
    else if(x<90){for(let k=0;k<2;k++){p(c,[[xx+k*3,yy-5],[xx+3+k*3,yy-4],[xx+1+k*3,yy+1]],37);l(c,xx+1+k*3,yy-5,xx-1+k*3,yy-8,18);l(c,xx+1+k*3,yy-5,xx+3+k*3,yy-8,9)}}
    else if(i%2){e(c,xx+1,yy-3,3,3,23);l(c,xx,yy-5,xx,yy-3,26);r(c,xx,yy-7,2,2,18)}
    else{p(c,[[xx,yy-6],[xx+3,yy-6],[xx+2,yy+1],[xx+1,yy+2]],39);l(c,xx+1,yy-6,xx-1,yy-9,18);l(c,xx+1,yy-6,xx+4,yy-9,9)}
   }
  }
  // A maneki-neko sits on a shelf; its animated paw is above the same fixed body.
  r(c,105,150,20,4,24);r(c,108,154,3,10,24);r(c,120,154,3,10,24);
  for(const [x,y]of [[142,106],[245,106],[166,97],[225,97]]){r(c,x,y-12,1,9,24);if(state.time==='night')e(c,x,y+2,9,10,37);e(c,x,y+2,6,8,state.time==='night'?35:29);l(c,x-4,y-4,x+4,y-4,21);l(c,x-4,y+9,x+4,y+9,21);l(c,x-3,y-2,x-3,y+6,30);r(c,x-1,y,2,4,21)}
  // Bicycle rests on two wheels and a kickstand beside the fish shop.
  for(const x of [260,287]){for(let a=0;a<6.29;a+=.1)r(c,x+Math.cos(a)*7,181+Math.sin(a)*7,1,1,20);l(c,x-5,176,x+5,186,17);l(c,x+5,176,x-5,186,17)}
  for(const [a,b]of [[[260,181],[271,169]],[[271,169],[277,181]],[[277,181],[260,181]],[[271,169],[283,169]],[[283,169],[287,181]],[[277,181],[283,169]]])l(c,...a,...b,29);l(c,269,168,275,168,21);l(c,282,169,282,165,20);l(c,282,165,287,165,20);l(c,275,181,273,188,20);
 }
 function arcade(c){
  // Solid frosted panels between steel ribs, with lit crown and darker curved shoulders.
  const near=[[40,82],[40,43],[61,21],[94,8],[290,8],[324,21],[345,43],[345,82]],arch=i=>near.map(([x,y])=>[195+(x-195)*(1-i*.125),88+(y-88)*(1-i*.125)]);
  for(let i=0;i<7;i++){const a=arch(i),b=arch(i+1);for(let k=0;k<7;k++){p(c,[a[k],a[k+1],b[k+1],b[k]],[5,4,3,i%2?1:3,3,4,5][k]);if(k===3)l(c,a[k][0]+5,a[k][1]+3,a[k+1][0]-5,a[k+1][1]+3,2)}for(let k=1;k<8;k++){l(c,...a[k-1],...a[k],7);l(c,a[k-1][0],a[k-1][1]+1,a[k][0],a[k][1]+1,16);l(c,...a[k-1],...b[k-1],7)}}
  for(const [x,y,w]of [[195,29,20],[195,54,13],[195,73,8]]){l(c,x,y-9,x,y,20);r(c,x-w/2-1,y,w+2,4,21);r(c,x-w/2,y+1,w,2,state.time==='night'?35:39);l(c,x-w/2,y+4,x+w/2,y+4,16)}
  for(const x of [46,337]){r(c,x,43,3,135,7);r(c,x+1,44,1,133,16);r(c,x-2,175,7,4,20)}
  if(state.season==='winter'){l(c,91,7,293,7,39);l(c,58,21,89,8,39);l(c,294,8,325,21,39)}
  // Signs face the street, in front of the glazing and clear of posts and lanterns.
  for(const [x,w,text,pad]of [[88,52,'八百屋',6],[253,75,'魚',16]]){r(c,x,70,w,19,24);r(c,x+2,72,w-4,15,13);sign(c,text,x+pad,73);r(c,x+3,89,2,3,24);r(c,x+w-5,89,2,3,24)}
 }
 return{layers:[street,shops,arcade],depths:[.25,.5,.5],dynamicDepths:[.5,.5,.5,0],weatherClip:[55,178,274,38],puddles:[[175,202,19],[231,211,18]],normalize(v){v.vocabLearned=Math.floor(v.vocabLearned)},frame(t,still){
  const x=still?155:150+Math.sin(t*.23)*26,y=165;api.actor(1,{x,y,w:38,h:25},(c,xx,yy)=>shiba(c,xx,yy,still?1:Math.floor(t*6)));api.creature('shiba',{x,y,w:36,h:23});
  for(const [i,x,y]of [[0,139,196],[1,206,200],[2,239,187]]){const hop=still?0:Math.floor(t*2+i)%5===0?-2:0;api.actor(2,{x,y:y+hop,w:11,h:9},(c,xx,yy)=>C.bird(c,xx,yy,still?i:Math.floor(t*3+i)%4));api.creature('sparrow',{x,y:y+hop,w:9,h:7})}
  api.actor(1,{x:107,y:132,w:18,h:19},(c,x,y)=>{p(c,[[x+1,y+5],[x+2,y],[x+6,y+3],[x+10,y],[x+13,y+5],[x+12,y+14],[x+14,y+17],[x,y+17]],39);r(c,x+4,y+6,1,1,21);r(c,x+9,y+6,1,1,21);r(c,x+4,y+10,7,2,29);e(c,x+7,y+14,3,2,36);const n=still?1:Math.floor(t*3)%4;r(c,x+14,y+4+n,3,6,39);r(c,x+15,y+4+n,1,1,13)});api.creature('maneki-neko',{x:107,y:132,w:18,h:19});
  for(const [x,y,tone]of [[179,134,18],[222,164,29],[151,151,7],[194,176,18],[216,128,30]])api.actor(1,{x:x-2,y,w:15,h:21},(c,xx,yy)=>{c.save();c.globalAlpha=.18;e(c,xx+6,yy+19,4,1,7);c.restore();C.person(c,xx+2,yy,still?0:Math.floor(t*3),tone);r(c,xx+10,yy+9,4,6,12);l(c,xx+10,yy+9,xx+13,yy+9,24)});
 },stats(){return{stockLevel:stock,stockLevels:5,vocabLearned:state.params.vocabLearned}}};
}};