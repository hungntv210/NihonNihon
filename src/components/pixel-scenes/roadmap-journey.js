import {overcast,dailyWeather} from './weather.js';
/* A 1920-native-pixel panorama assembled from unchanged 384×216 engine tiles.
   Transition tiles show their first 128px. Offscreen tiles use the engine's visibility pause. */
import {SceneEngine} from './engine.js';
import {SceneCraft} from './scene-craft.js';
const regions=['Kyoto / Nara','Osaka','Tokyo','Hokkaido'],starts=[0,512,1024,1536],TOTAL=1920;
const railY=x=>198+Math.sin(x/220)*2;
const regionAt=x=>x<448?0:x<960?1:x<1472?2:3;
const targetFor=w=>192+(w-1)/86*1536;
const clampWeek=w=>Math.max(1,Math.min(87,Math.floor(Number.isFinite(Number(w))?Number(w):23)));
function colors(kind,s){
 const night=s.time==='night',evening=s.time==='sunset',winter=s.season==='winter';
 const skies={morning:['#c7e0d5','#e0ead9','#f4e7c1','#aacac2','#91b5b0','#789995','#5d7f7d','#3f6266'],day:['#85bbc3','#b4d2c9','#f5e2a1','#8db6b9','#7caaa7','#68928c','#557a77','#365d61'],sunset:['#78818e','#c5a695','#e2ba91','#a99998','#8e8990','#777d85','#626f7a','#3c5564'],night:['#182a43','#253c55','#536378','#344a60','#344b61','#304a5a','#2b4551','#213743']};
 const c=Object.fromEntries(skies[s.time].map((v,i)=>[i,v]));
 const families=[
  ['#294b45','#638f61','#92b27a','#c4c99b','#ded8b3','#eee2ba','#f8edcc','#8fa98b','#6e8d7b','#466f59','#467150','#244d40','#213c38','#183431','#233b37','#47483c','#695b47','#92765b','#bd8d9b','#dfb2ba','#f3d4cc','#9b6751','#bb9464','#674a3c'],
  ['#254c57','#8b9163','#b3af7d','#d5bb86','#e5cf99','#efdbaf','#fff0c9','#91978b','#78877f','#596f69','#677b53','#3d5948','#263f40','#203538','#2b3b3c','#50413d','#75523f','#a5754d','#aa664b','#d39166','#edbb82','#b85942','#d59454','#683a32'],
  ['#233f59','#607d87','#839ba3','#b2bfc0','#c4cdd0','#d6e0db','#f1f3de','#77929e','#617d8c','#48677d','#496477','#314e63','#263f55','#1b3146','#263c51','#3e5267','#57657a','#7a8b9b','#7d99ab','#a6bbc5','#d5dcd3','#758ea5','#a9becb','#455d76'],
  ['#285767','#88a8a3','#afc4ba','#c6d5cf','#d8e0d6','#e2e9df','#f4f4e6','#a2b7bd','#7d9ca9','#587d91','#5f807d','#3d6068','#304e60','#223f53','#365267','#627b87','#8fa1a5','#b9c7c4','#b6cbd0','#d2dfe0','#ecf0e5','#bc5b55','#bac7c7','#6b8291']
 ];
 const family=kind==='kyoto'||kind==='rice'?0:kind==='osaka'?1:kind==='hokkaido'||kind==='sea'?3:2;
 families[family].forEach((v,i)=>c[i+8]=v);
 if(family===0&&s.season==='autumn'){c[9]='#8d8153';c[10]='#b49a62';c[18]='#756d43';c[26]='#b9754f';c[27]='#d59c68';c[28]='#e6b984'}
 if(family===0&&s.season==='summer'){c[26]='#4e7d57';c[27]='#7b9c66';c[28]='#acba7b'}
 if(winter&&family!==3){c[26]='#9fbbb9';c[27]='#c5d7cf';c[28]='#e7eade'}
 Object.assign(c,{32:'#dfebe4',33:'#acc7cc',34:'#4b7c8b',35:family===2?'#dce9ed':'#ffdaa1',36:'#e8b974',37:'#b8754c',38:'#6c6660',39:family===3?'#f1f3e8':'#f7ead2'});
 if(night){for(let i=8;i<32;i++){if(i>=26&&family===0&&!winter)continue;const rgb=c[i].slice(1).match(/../g).map(x=>parseInt(x,16));c[i]='#'+rgb.map((v,k)=>Math.round(v*(family===3?.76:.64)+[3,9,18][k]).toString(16).padStart(2,'0')).join('')}c[32]='#bdcfd3';c[33]='#8daab8';c[34]='#355f74'}
 if(evening&&family===1)c[35]='#ffe0a1';
 return c;
}
const mix=(a,b,t)=>'#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(i+1,i+3),16)*(1-t)+parseInt(b.slice(i+1,i+3),16)*t).toString(16).padStart(2,'0')).join('');
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
function polygonRGB(c,points,color){
 c.fillStyle=color;const lo=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),hi=Math.min(215,Math.ceil(Math.max(...points.map(p=>p[1]))));
 for(let y=lo;y<=hi;y++){const cuts=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}cuts.sort((a,b)=>a-b);for(let i=0;i+1<cuts.length;i+=2)c.fillRect(Math.ceil(cuts[i]),y,Math.floor(cuts[i+1])-Math.ceil(cuts[i])+1,1)}
}
function ellipseRGB(c,x,y,rx,ry,color){c.fillStyle=color;for(let v=-ry;v<=ry;v++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-v*v/(ry*ry))));c.fillRect(Math.round(x-w),Math.round(y+v),w*2+1,1)}}
function inside(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function makeBackground(s){
 const canvas=()=>{const c=document.createElement('canvas');c.width=TOTAL;c.height=216;return c},sky=canvas(),ground=canvas(),edges=canvas(),a=sky.getContext('2d'),g=ground.getContext('2d'),z=edges.getContext('2d');
 const profiles=['kyoto','osaka','tokyo','hokkaido'].map(k=>colors(k,s)),base=profiles[0],ice=profiles[3],night=s.time==='night';
 const material=(x,index)=>{const get=i=>profiles[i][Array.isArray(index)?index[i]:index];for(let i=0;i<3;i++){const begin=starts[i]+384,end=starts[i+1];if(x<begin)return get(i);if(x<end)return mix(get(i),get(i+1),smooth((x-begin)/(end-begin)))}return get(3)};
 // One world-space sky, one celestial disk. No local region can recolour or duplicate it.
 for(let y=0;y<216;y++){a.fillStyle=y<54?mix(base[0],base[3],Math.floor(y/6)/9):mix(base[3],base[1],Math.min(1,Math.floor((y-54)/7)/7));a.fillRect(0,y,TOTAL,1)}
 if(night&&!overcast(s.weather)){for(let i=0;i<150;i++){a.fillStyle=i%4?'#bacbd0':'#e9e9d0';a.fillRect((i*139+57)%TOTAL,6+(i*31)%69,1,1)}ellipseRGB(a,1090,28,13,13,base[1]);ellipseRGB(a,1090,28,8,8,'#f7ead2')}
 else if(!overcast(s.weather)){ellipseRGB(a,1090,28,12,12,base[14]);for(const[x,y,w]of[[80,24,34],[359,18,26],[629,30,40],[923,15,22],[1264,20,33],[1490,26,30],[1804,18,25]]){ellipseRGB(a,x,y,w,3,base[1]);ellipseRGB(a,x+8,y-3,Math.round(w*.7),4,base[1])}}
 // Shared height fields span all seven tiles; only the ground material blends through connectors.
 for(let x=0;x<TOTAL;x++){const far=96+Math.sin(x/131)*10+Math.sin(x/47)*4;g.fillStyle=base[5];g.fillRect(x,Math.round(far),1,216)}
 const mountains=[[1368,116],[1444,99],[1492,108],[1536,112],[1587,88],[1624,101],[1693,44],[1745,88],[1789,61],[1837,93],[1881,68],[1920,100],[1920,216],[1368,216]];
 polygonRGB(g,mountains,ice[33]);polygonRGB(g,[[1440,116],[1536,116],[1587,88],[1624,104],[1693,44],[1679,78],[1687,89],[1674,101],[1701,94],[1716,80],[1709,71],[1741,88],[1789,61],[1775,90],[1794,96],[1787,106],[1809,100],[1837,94],[1881,68],[1867,94],[1882,101],[1920,110],[1920,216],[1440,216]],ice[32]);
 polygonRGB(g,[[1693,49],[1689,75],[1701,88],[1694,99],[1718,115],[1711,96],[1720,87],[1707,76]],ice[17]);polygonRGB(g,[[1789,67],[1787,88],[1799,94],[1796,108],[1818,119],[1809,98]],ice[15]);
 polygonRGB(g,[[842,114],[884,90],[928,62],[948,78],[977,63],[1018,101],[1063,119],[1063,216],[842,216]],base[6]);
 for(let x=0;x<TOTAL;x++){
  const middle=125+Math.sin(x/167)*7+Math.cos(x/61)*3,near=150+Math.sin(x/93)*6+Math.cos(x/31)*2;
  const snow=s.season==='winter';g.fillStyle=material(x,snow?[27,27,27,33]:[18,17,6,33]);g.fillRect(x,Math.round(middle),1,216);g.fillStyle=material(x,snow?[28,28,28,32]:[9,17,22,32]);g.fillRect(x,Math.round(near),1,216);
 }
 // A single canal/river shape crosses the rice/Osaka/mountain boundaries.
 const canal=[[444,107],[459,111],[456,139],[489,146],[544,149],[610,142],[654,149],[725,143],[790,151],[860,142],[902,145],[936,157],[923,177],[884,186],[822,186],[750,180],[675,185],[598,178],[534,183],[478,184],[463,204],[455,216],[437,216],[444,192],[447,172],[430,140]];
 polygonRGB(g,canal,profiles[1][20]);const water=canal.map(([x,y])=>[x<478?x+(x<447?2:-2):x,y<170?y+2:y-2]);polygonRGB(g,water,profiles[1][8]);
 for(let i=0;i<115;i++){const x=437+(i*47)%490,y=117+(i*31)%97;if(inside(x,y,water)&&inside(x+7,y,water)){g.fillStyle=profiles[1][34];g.fillRect(x,y,5+i%5,1)}}
 // Fields begin inside Kyoto and continue into the approach, with no clipped terrace at x=384.
 for(let i=0;i<5;i++)for(let x=348;x<506;x++){const y=Math.round(137+i*11-6*Math.sin(x/37));if(!inside(x,y,canal)){g.fillStyle=mix(material(x,9),material(x,10),.35);g.fillRect(x,y,1,1);if(x%8===0)g.fillRect(x,y-3,1,3)}}
 const ocean=[[1360,147],[1399,132],[1428,141],[1458,132],[1492,142],[1529,137],[1568,149],[1568,216],[1360,216]];polygonRGB(g,ocean,ice[8]);
 for(let i=0;i<70;i++){const x=1360+(i*37)%208,y=145+(i*19)%70;if(inside(x,y,ocean)&&inside(x+9,y,ocean)){g.fillStyle=i%4?ice[34]:ice[33];g.fillRect(x,y,5+i%9,1)}}
 polygonRGB(g,[[1024,157],[1339,151],[1381,157],[1415,170],[1430,188],[1422,216],[1024,216]],profiles[2][22]);
 polygonRGB(g,[[1501,216],[1509,185],[1516,164],[1535,150],[1554,139],[1606,147],[1660,138],[1720,151],[1789,139],[1850,151],[1920,138],[1920,216]],ice[32]);
 polygonRGB(g,[[867,169],[887,145],[913,140],[940,158],[956,189],[867,194]],profiles[2][19]);
 // Regional surfaces share the same global noise coordinates, so texture also crosses seams.
 const rand=SceneEngine.seeded(63218);for(let i=0;i<1700;i++){const x=Math.floor(rand()*TOTAL),y=152+Math.floor(rand()*41);if(!inside(x,y,canal)&&!inside(x,y,ocean)){g.fillStyle=material(x,s.season==='winter'?[27,27,27,33]:[18,17,23,33]);g.fillRect(x,y,1+Math.floor(rand()*2),1)}}
 // Foreground bushes/pines straddle every tile boundary and are drawn from this same atlas.
 for(const[x,y,h]of[[381,165,15],[507,145,28],[895,161,28],[1023,174,38],[1409,173,17],[1537,163,26]]){
  const snowy=x>1500||s.season==='winter',pal=x>1500?ice:profiles[x<600?0:2];ellipseRGB(z,x,y+2,13,3,pal[16]);z.fillStyle=pal[24];z.fillRect(x-1,y-h,3,h);
  for(let j=0;j<4;j++){const yy=y-h+j*h*.2,w=5+j*2;polygonRGB(z,[[x,yy-4],[x-w,yy+12],[x+w,yy+12]],pal[19]);polygonRGB(z,[[x,yy-2],[x-w*.7,yy+9],[x+w*.4,yy+8]],snowy?pal[32]:pal[18])}
 }
 return{sky,ground,edges};
}
function tileDefinition(kind,offset,width,journey){return{id:'journey-'+kind,params:{week:23},swatches:s=>colors(kind,s),seasonSwatches:false,create(api){
 const {state,draw:d}=api,{rect:r,line:l,polygon:p,ellipse:e}=d,C=SceneCraft(api),snow=()=>kind==='hokkaido'||state.season==='winter';
 const rng=seed=>api.random(seed),night=()=>state.time==='night',autumn=()=>state.season==='autumn';
 function sky(c){
  c.drawImage(journey.background(state).sky,offset,0,width,216,0,0,width,216);
 }
 function rock(c,x,y,w=9,h=5,white=snow()){
  p(c,[[x-w,y+1],[x-w*.6,y-h],[x+w*.5,y-h],[x+w,y],[x+w*.5,y+4],[x-w*.5,y+3]],20);p(c,[[x-w+2,y],[x-w*.5,y-h],[x+w*.4,y-h+1],[x+w-2,y-1],[x-1,y+1]],16);l(c,x-w+3,y-1,x-1,y-h+1,15);if(white){p(c,[[x-w+2,y-2],[x-w*.5,y-h-2],[x+w*.4,y-h-1],[x+w-2,y-2],[x,y-1]],32);l(c,x-w*.5,y+1,x+w*.5,y,33)}
 }
 function grass(c,seed,from=131){const rand=rng(seed);for(let i=0;i<750;i++){const x=rand()*width,y=from+rand()*(193-from);r(c,x,y,1+rand()*2,1,snow()?i%5?33:32:i%4?18:10)}}
 function pine(c,x,y,h=43,w=15){r(c,x-2,y-h,4,h,24);r(c,x,y-h,1,h,25);for(let j=0;j<5;j++){const yy=y-h+j*h*.17,ww=w*(.3+j*.16);p(c,[[x,yy-6],[x-ww,yy+13],[x-ww*.4,yy+12],[x+ww,yy+13]],19);p(c,[[x,yy-4],[x-ww*.7,yy+10],[x+ww*.4,yy+8]],18);if(snow()){p(c,[[x-ww*.8,yy+10],[x-ww*.3,yy+5],[x,yy+3],[x+ww*.7,yy+10],[x+ww*.2,yy+11]],32);l(c,x-ww*.5,yy+12,x+ww*.4,yy+12,33)}else l(c,x-ww*.7,yy+11,x+ww*.5,yy+10,9)}}
 function tileRoof(c,x,y,w,h=12){C.roof(c,x,y,w,h,snow());for(let xx=x+7;xx<x+w-3;xx+=4)l(c,xx,y+2,xx+3,y+h-2,18)}
 function kyoto(c){
  grass(c,312);
  // Sparse bamboo grove, separate from the pagoda's clear silhouette.
  for(let i=0;i<15;i++){const x=8+i*4,y=48+(i%4)*8;r(c,x,y,2,102,19);r(c,x,y,1,100,10);for(let yy=y+12;yy<150;yy+=14){r(c,x-1,yy,4,1,18);l(c,x,yy,x+7,yy-7,18);l(c,x,yy+4,x-6,yy-1,9)}}
  // One five-storey timber pagoda with attached veranda and a stone footing.
  p(c,[[149,144],[153,136],[240,136],[246,144]],16);l(c,148,145,247,145,20);
  for(let i=0;i<5;i++){const w=70-i*9,x=197-w/2,y=119-i*21;r(c,x,y,w,18,24);r(c,x+2,y+1,w-4,15,25);for(let xx=x+5;xx<x+w-2;xx+=8){r(c,xx,y+2,2,15,23);r(c,xx+3,y+5,3,7,20)}tileRoof(c,x-7,y-11,w+14,13);r(c,x-2,y+16,w+4,2,23);for(let xx=x;xx<x+w;xx+=5)r(c,xx,y+12,1,5,12);l(c,x-2,y+11,x+w+2,y+11,25)}
  r(c,196,6,2,17,24);for(let y=8;y<22;y+=3)l(c,192,y,202,y,37);e(c,197,5,2,2,36);
  // A cherry tree grows from the left bank; its canopy doesn't crowd the tower.
  p(c,[[87,142],[89,87],[103,58],[107,59],[95,90],[94,141]],24);l(c,95,90,66,66,24);l(c,99,78,133,58,24);
  const rand=rng(620);for(let i=0;i<75;i++){const x=61+rand()*84,y=46+rand()*39;e(c,x,y,3+rand()*4,2,26);e(c,x-1,y-1,2+rand()*3,1,27);r(c,x,y-2,1,1,28)}
  C.pine(c,331,144,25,40);for(const[x,y]of[[132,147],[259,147],[49,173],[300,175]])rock(c,x,y,6,3);
  p(c,[[149,146],[168,146],[183,158],[191,177],[184,190],[162,190],[169,173],[161,158]],16);for(let i=0;i<7;i++)l(c,165+i*2,151+i*5,178+i,151+i*5,15);
 }
 function osaka(c){
  // An irregular water moat surrounds an earth island; the high battered wall bears the keep.
  p(c,[[195,134],[222,123],[308,124],[338,135],[351,147],[340,156],[318,160],[205,157],[187,146]],20);
  p(c,[[197,136],[224,126],[307,127],[336,137],[346,147],[338,153],[317,157],[207,154],[192,146]],8);
  p(c,[[205,139],[218,115],[306,115],[327,137],[334,145],[318,151],[214,150],[199,145]],19);
  C.pine(c,208,139,12,28);C.pine(c,328,139,13,31);
  const wall=[[226,102],[225,113],[221,125],[214,137],[204,145],[329,145],[319,137],[310,125],[305,113],[303,102]];
  p(c,wall,20);p(c,[[228,104],[302,104],[304,115],[309,127],[322,142],[212,142],[221,129],[226,115]],16);
  for(let y=107;y<144;y+=4){const bend=(y-104)/39,left=227-20*bend*bend,right=303+21*bend*bend;for(let x=left+(Math.floor(y/4)%2)*4;x<right;x+=9){l(c,x,y,Math.min(right,x+7),y-1,7);l(c,Math.min(right,x+7),y-1,Math.min(right,x+8),y+2,17);l(c,x+1,y+1,Math.min(right,x+6),y,15)}}
  for(let x=201;x<341;x+=17)l(c,x,150+(x%3),x+8,150+(x%3),34);
  for(let i=0;i<4;i++){const w=65-i*11,x=267-w/2,y=87-i*16;r(c,x,y,w,19,13);r(c,x+1,y,w-2,16,39);for(let xx=x+6;xx<x+w-3;xx+=9)r(c,xx,y+5,3,7,20);tileRoof(c,x-3,y-9,w+6,11);if(i===0||i===2){const mid=x+w/2;p(c,[[mid-11,y+2],[mid,y-8],[mid+11,y+2]],39);l(c,mid-12,y+2,mid,y-10,21);l(c,mid,y-10,mid+12,y+2,21)}}
  p(c,[[0,143],[26,139],[83,140],[142,146],[200,138],[253,145],[261,153],[198,151],[141,156],[82,150],[0,151]],20);p(c,[[0,142],[27,138],[83,139],[142,145],[200,137],[252,144],[256,148],[198,147],[141,152],[82,146],[0,147]],17);
  for(const[x,w,h]of[[25,51,44],[91,48,39],[192,54,30]]){const y=145-h;r(c,x,y,w,h,24);for(let xx=x+3;xx<x+w-2;xx+=5)l(c,xx,y+2,xx,y+h-2,25);tileRoof(c,x-1,y-9,w+2,10);r(c,x+4,y+12,w-8,h-14,21);for(let xx=x+7;xx<x+w-5;xx+=10){r(c,xx,y+17,7,h-20,night()?35:13);r(c,xx+3,y+17,1,h-20,24)}r(c,x+2,y+h-3,w-4,3,20)}
  const glyph={
   '寿':['.....#.......','..#########..','.....#.......','.###########.','....#........','..##########.','...#....#....','..#.....#....','.#..#...#....','....##..#....','........#....','......###....','.............'],
   '司':['.###########.','...........#.','...#######.#.','...........#.','....#####..#.','....#...#..#.','....#...#..#.','....#####..#.','...........#.','...........#.','..........##.','.............','.............'],
   '本':['......#......','......#......','.###########.','.....###.....','....#.#.#....','...#..#..#...','..#...#...#..','.#....#....#.','#..#######..#','......#......','......#......','......#......','.............'],
   'た':['....#........','....#........','.#######.....','...#.........','...#..#####..','..#..........','..#..........','.#.....###...','.#....#......','.#....#......','#......####..','.............','.............'],
   'こ':['.............','...#######...','..........#..','.........#...','.............','.............','.............','..#..........','..#..........','...#.........','....######...','.............','.............']};
  for(const[x,y,text,w]of[[34,102,'寿司',32],[106,107,'本',18],[204,119,'たこ',32]]){r(c,x-1,y-2,w+2,18,21);r(c,x,y,w,15,night()?35:13);[...text].forEach((ch,i)=>glyph[ch].forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='#')r(c,x+2+i*15+xx,y+1+yy,1,1,20)})))}
  for(const x of [80,154,254]){r(c,x,125,1,23,24);l(c,x,126,x+7,126,24);e(c,x+7,135,4,6,night()?35:29);l(c,x+5,132,x+5,138,30)}
  // A pedestrian bridge spans the canal. Its piers meet the water below.
  p(c,[[146,149],[153,144],[175,144],[185,152],[181,156],[145,154]],24);l(c,145,148,154,141,20);l(c,154,141,175,141,20);l(c,175,141,185,149,20);for(let x=149;x<184;x+=6)r(c,x,145,1,8,20);r(c,151,155,4,30,16);r(c,178,155,4,30,16);
  if(snow()){for(const[x,w]of[[25,51],[91,48],[192,54]])l(c,x,145,x+w,145,32)}
  for(let x=14;x<370;x+=12)l(c,x,188,x+2,194,25);
 }
 function tokyo(c){
  // Three separate skyline planes, with the tower's breathing room kept on the right.
  for(let plane=0;plane<3;plane++){const rand=rng(304+plane);for(let i=0;i<12;i++){const x=i*37-20+plane*5,w=17+rand()*16,y=40+rand()*58+plane*14,h=169-y;if(x<16||x+w>365)continue;r(c,x,y,w,h,[5,6,7][plane]);r(c,x+2,y+2,w-4,h-2,[6,7,20][plane]);for(let yy=y+6;yy<y+h-3;yy+=7)for(let xx=x+4;xx<x+w-3;xx+=6)r(c,xx,yy,2,3,night()?(i+xx+yy)%5?35:16:15);r(c,x+3,y-2,w-6,2,16);r(c,x-1,168,w+2,2,21)}}
  for(let x=25;x<358;x+=14)l(c,x,180,x+6,180,17);r(c,18,183,348,3,23);l(c,18,184,366,184,16);
  // Large cool steel tower, separated in front of the recessed skyline.
  const tx=251;for(const side of [-1,1]){p(c,[[tx+side*3,33],[tx+side*9,99],[tx+side*39,176],[tx+side*29,176],[tx+side*6,99],[tx,36]],30)}
  r(c,tx-1,13,2,27,31);r(c,tx-6,48,12,3,13);for(let y=55;y<172;y+=10){const w=(y-31)*.24;l(c,tx-w,y,tx+w,y,31);l(c,tx-w,y,tx+w+2,y+10,25);l(c,tx+w,y,tx-w-2,y+10,25);r(c,tx-w,y,1,2,39);r(c,tx+w,y,1,2,39)}
  r(c,tx-14,101,28,7,21);r(c,tx-13,102,26,4,night()?35:13);for(let x=tx-10;x<tx+12;x+=5)r(c,x,102,1,4,24);r(c,tx-22,134,44,4,15);
  for(const x of [tx-39,tx+29]){r(c,x-2,175,14,4,16);r(c,x-3,178,16,2,20)}
  for(const[x,y]of[[42,116],[105,98],[162,127]]){r(c,x,y,9,29,21);r(c,x+1,y+1,7,26,night()?35:13);for(let j=0;j<4;j++)r(c,x+3,y+4+j*5,3,2,7)}
  // Elevated rail viaduct has joints, beams and piers, rather than floating rails.
  for(let x=14;x<384;x+=49){p(c,[[x,190],[x+9,190],[x+12,216],[x-3,216]],16);r(c,x+1,194,2,22,17)}
  r(c,0,190,384,8,20);r(c,0,191,384,2,16);for(let x=0;x<384;x+=12){l(c,x,194,x+9,194,7);r(c,x+4,196,1,1,15)}
 }
 function hokkaido(c){
  for(const[x,y,h,w]of[[18,158,58,17],[51,146,44,13],[78,157,49,14],[311,145,49,15],[349,158,67,19],[378,163,48,15]])pine(c,x,y,h,w);
  // Spacious onsen basin. Snow-capped rocks sit on its rim, monkeys sit within the waterline.
  e(c,176,169,62,20,20);e(c,176,168,56,16,8);e(c,176,168,43,11,34);
  for(let i=0;i<15;i++){const a=i/15*6.283;rock(c,176+Math.cos(a)*61,168+Math.sin(a)*18,7+i%3,4,true)}
  for(let i=0;i<8;i++)l(c,139+i*10,169+i%3*3,145+i*10,169+i%3*3,33);
  for(const[x,y]of[[100,161],[288,173],[260,146]]){e(c,x,y,9,2,33);l(c,x-5,y,x+6,y,39)}
 }
 function rice(c){
  // Terraces and river live in the shared world atlas.
 }
 function mountain(c){
  for(const[x,y,h]of[[26,154,45],[92,156,48]])pine(c,x,y,h,10);for(let i=0;i<33;i++)rock(c,35+(i*17)%65,123+(i*23)%60,3,2,snow());
 }
 function sea(c){
  // Coast and waves cross both adjoining tiles in world coordinates.
 }
 const landscapes={kyoto,osaka,tokyo,hokkaido,rice,mountain,sea};
 function ground(c){c.drawImage(journey.background(state).ground,offset,0,width,216,0,0,width,216);landscapes[kind](c)}
 function tracks(c){
  const bridge=kind==='rice'||kind==='sea',elevated=kind==='tokyo';
  if(bridge){r(c,0,199,width,7,20);r(c,0,200,width,2,15);for(let x=9;x<width;x+=31){p(c,[[x,203],[x+6,203],[x+9,216],[x-2,216]],16);l(c,x+2,204,x+4,216,17)}
   if(kind==='rice'){for(const y of [183,198])l(c,0,y,128,y,20);for(let x=0;x<128;x+=16){l(c,x,183,x+16,198,20);l(c,x,198,x+16,183,20);r(c,x,183,2,16,15)}}else{for(let x=0;x<128;x+=32){r(c,x,168,2,31,20);l(c,x+1,168,x+31,196,15);l(c,x+1,168,x-30,196,15)}}
  }
  for(let x=0;x<width;x++){const y=railY(offset+x);if(!elevated&&!bridge)r(c,x,y-1,1,9,16);if(x%4===0){r(c,x,y,2,7,24);r(c,x,y+1,1,1,12)}r(c,x,y+1,1,1,20);r(c,x,y+2,1,1,15);r(c,x,y+5,1,1,20);r(c,x,y+6,1,1,15)}
 }
 function foreground(c){
  c.drawImage(journey.background(state).edges,offset,0,width,216,0,0,width,216);
  if(starts.includes(offset)){
   const glyph={N:['#...#','##..#','#.#.#','#.#.#','#..##','#...#','#...#','#...#','#...#'],5:['#####','#....','#....','####.','....#','....#','....#','#...#','.###.'],4:['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.','...#.','...#.'],3:['####.','....#','....#','..##.','....#','....#','....#','#...#','.###.'],2:['.###.','#...#','....#','...#.','..#..','.#...','#....','#....','#####']};
   r(c,138,10,30,19,21);const label='N'+(5-starts.indexOf(offset));[...label].forEach((ch,i)=>glyph[ch].forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='#')r(c,144+i*9+x,15+y,1,1,39)})));
  }
  if(kind==='mountain'){
   // Portal sides sit in the mountain. Trains disappear behind the rock, then reappear.
   p(c,[[29,147],[49,127],[81,126],[104,149],[107,205],[27,205]],19);p(c,[[37,149],[51,137],[78,137],[96,153],[99,205],[35,205]],16);
   p(c,[[45,205],[45,169],[50,160],[78,160],[86,170],[86,205]],21);for(let y=159;y<205;y+=7){l(c,37,y,44,y,7);l(c,87,y,98,y,7)}l(c,50,155,80,155,15);if(snow())l(c,45,135,80,134,32);
  }
 }
 function deer(c,x,y,f=0,grazing=false){
  e(c,x+14,y+24,17,3,18);e(c,x+14,y+10,13,6,30);e(c,x+12,y+9,10,4,25);p(c,[[x+21,y+7],[x+23,y-2],[x+28,y-4],[x+29,y+1],[x+26,y+10]],30);
  if(grazing){p(c,[[x+22,y+6],[x+29,y+11],[x+31,y+17],[x+26,y+18],[x+23,y+12]],30);r(c,x+29,y+16,2,1,21)}else{p(c,[[x+23,y],[x+22,y-7],[x+25,y-5],[x+29,y-8],[x+30,y],[x+27,y+4]],30);r(c,x+28,y,1,1,21)}
  for(const xx of [5,11,21,25]){l(c,x+xx,y+13,x+xx+(f%2),y+23,31);r(c,x+xx,y+23,3,1,21)}for(const[xx,yy]of[[7,7],[12,10],[16,6],[21,9]])r(c,x+xx,y+yy,2,1,39);r(c,x,y+5,3,2,13);
 }
 function monkey(c,x,y){
  e(c,x+14,y+19,13,6,17);e(c,x+14,y+16,11,7,16);e(c,x+14,y+10,9,9,15);for(let i=0;i<7;i++)r(c,x+8+i*2,y+i%3,1,3,32);e(c,x+5,y+9,3,3,16);e(c,x+23,y+9,3,3,16);e(c,x+14,y+12,7,5,29);r(c,x+10,y+10,2,1,21);r(c,x+18,y+10,2,1,21);e(c,x+14,y+14,3,2,12);r(c,x+13,y+13,2,1,31);l(c,x+5,y+16,x,y+24,15);l(c,x+23,y+16,x+28,y+24,15);l(c,x+1,y+25,x+27,y+25,34);
 }
 function birdActor(x,y,i=0,f=0){api.actor(2,{x,y,w:11,h:9},(c,x,y)=>C.bird(c,x,y,f));api.creature('bird',{x,y,w:9,h:7})}
 function moving(t,still){
  if(journey.ready)journey.advance();
  if(kind==='kyoto'){
   for(const[i,x,y]of[[0,100,163],[1,158,156],[2,227,162],[3,286,153]]){api.actor(1,{x:x-1,y:y-9,w:36,h:37},(c,x,y)=>deer(c,x+1,y+9,still?i:Math.floor(t*.8+i),i%2===0));api.creature('nara-deer',{x,y:y-7,w:33,h:32})}
   if(state.season!=='winter')for(let i=0;i<8;i++){const x=107+(i*19+(still?0:t*3))%141,y=79+(i*23+(still?0:t*2))%89;api.actor(2,{x,y,w:3,h:2},(c,x,y)=>{r(c,x,y,2,1,27);r(c,x+1,y+1,1,1,28)})}
  }else if(kind==='osaka'){
   for(const[i,x,y]of[[0,40,138],[1,80,139],[2,112,138],[3,176,140],[4,255,137]])birdActor(x,y,i,still?i%4:Math.floor(t*2+i)%4);
   for(const[i,bx,by]of[[0,92,170],[1,220,173]]){const x=bx+(still?0:Math.sin(t*.12+i)*16),y=by;api.actor(0,{x,y,w:45,h:14},(c,x,y)=>{p(c,[[x,y+3],[x+43,y+3],[x+35,y+11],[x+8,y+11]],24);l(c,x+4,y+4,x+39,y+4,12);r(c,x+14,y-1,18,5,25);r(c,x+12,y-3,22,3,21);r(c,x+16,y,5,3,13);r(c,x+24,y,5,3,13);l(c,x+5,y+12,x+37,y+12,34)})}
   for(const[x,y]of[[72,128],[141,127],[202,130]])api.actor(1,{x,y,w:10,h:19},(c,x,y)=>C.person(c,x,y,still?0:Math.floor(t*2),29));
  }else if(kind==='tokyo'){
   for(const[i,x,y]of[[0,119,177],[1,173,176],[2,249,178],[3,283,178],[4,319,177]])birdActor(x,y,i,still?i%4:Math.floor(t*2+i)%4);
   const x=still?115:70+(t*1.2)%130,y=28;api.actor(0,{x,y,w:15,h:6},(c,x,y)=>{l(c,x,y+3,x+13,y+3,13);l(c,x+5,y+3,x+7,y,13);l(c,x+5,y+3,x+8,y+5,13);r(c,x+1,y+1,1,2,13)})
  }else if(kind==='hokkaido'){
   api.actor(1,{x:162,y:143,w:31,h:29},(c,x,y)=>monkey(c,x,y));api.creature('snow-monkey',{x:162,y:143,w:31,h:29});
   for(const[i,x,y]of[[0,238,153],[1,258,150]]){api.actor(2,{x:x-8,y:y-4,w:36,h:32},(c,x,y)=>{C.crane(c,x+8,y+4,still?i:Math.floor(t*2),true);r(c,x+8,y+2,4,2,29);if(still?i===1:Math.floor(t*.7+i)%4===2){p(c,[[x+14,y+13],[x+4,y+5],[x,y+7],[x+12,y+18]],39);l(c,x+2,y+7,x+13,y+17,21)}});api.creature('red-crowned-crane',{x:x-7,y:y-3,w:34,h:30})}
   birdActor(111,174,0,still?0:Math.floor(t)%4);
   for(let i=0;i<4;i++){const x=149+i*17,y=119;api.actor(2,{x,y,w:15,h:24},(c,x,y)=>{const n=still?0:Math.round(Math.sin(t*.6+i)*2);l(c,x+4,y+23,x+1+n,y+12,33);l(c,x+1+n,y+12,x+8,y+1,15);l(c,x+5,y+23,x+2+n,y+12,33)})}
   if(state.weather==='snow')for(let i=0;i<12;i++){const x=(i*37+(still?0:t*2))%384,y=18+(i*19+(still?0:t*3))%158;api.actor(2,{x,y,w:2,h:2},(c,x,y)=>r(c,x,y,i%3?1:2,1,32))}
  }else if(state.weather!=='rain'){for(const[i,x,y]of[[0,34,79],[1,65,70],[2,96,84]]){api.actor(2,{x,y,w:12,h:6},(c,x,y)=>{l(c,x,y+4,x+4,y+1,20);l(c,x+4,y+1,x+8,y+4,20)});api.creature('flying-bird',{x,y,w:10,h:5})}}
  // Only tiles intersected by the train dirty its small native rectangle.
  const local=journey.x-offset;if(local>-54&&local<width+54){const x=local-29,y=railY(journey.x)-12;api.actor(1,{x,y,w:60,h:17},(c,x,y)=>{
   for(let i=0;i<3;i++){const xx=x+i*16;p(c,[[xx,y+3],[xx+3,y],[xx+15,y],[xx+15,y+11],[xx,y+11]],39);r(c,xx+2,y+3,11,3,7);r(c,xx,y+8,15,1,6);r(c,xx+1,y+11,13,2,20);r(c,xx+15,y+3,1,7,16)}p(c,[[x+47,y],[x+51,y+2],[x+59,y+11],[x+47,y+11]],39);p(c,[[x+48,y+2],[x+52,y+4],[x+54,y+6],[x+48,y+6]],7);l(c,x+47,y+8,x+55,y+9,6);
  })}
 }
 return{layers:[sky,ground,tracks,foreground],depths:[0,0,0,0],dynamicDepths:[0,0,0,0],puddles:[],frame:moving};
}}}

class Journey{
 constructor(host,options){
  this.host=host;this.world=host;this.frameElement=host.closest('[data-journey-frame]');this.scale=innerWidth<600?2:3;this.ready=false;this.pieces=[];this.last=0;this.follow=true;this.media=matchMedia('(prefers-reduced-motion: reduce)');
  const week=clampWeek(options.params.week);
  this.state={...options,params:{week},seconds:7,frames:0};
  this.target=targetFor(week);this.x=this.target;this.from=this.x;this.moveStart=7;this.duration=0;
  host.classList.add('journey-strip');
  for(const[kind,offset,width]of[['kyoto',0,384],['rice',384,128],['osaka',512,384],['mountain',896,128],['tokyo',1024,384],['sea',1408,128],['hokkaido',1536,384]]){
   const section=document.createElement('section');section.className='journey-piece';section.dataset.kind=kind;const tile=document.createElement('div');tile.className='journey-tile';section.append(tile);host.append(section);
   const def=tileDefinition(kind,offset,width,this),engine=new SceneEngine.Engine(tile,def,{...this.state,params:{week}});this.pieces.push({kind,offset,width,section,tile,engine});
  }
  this.mist=document.createElement('canvas');this.mist.width=TOTAL;this.mist.height=216;this.mist.className='journey-mist';this.mist.setAttribute('aria-hidden','true');host.append(this.mist);
  this.resize=()=>{const scale=innerWidth<600?2:Math.max(2,Math.min(4,Math.floor(this.frameElement.clientWidth/384)));this.scale=scale;host.style.width=TOTAL*scale+'px';host.style.height=216*scale+'px';for(const item of this.pieces){item.section.style.width=item.width*scale+'px';item.section.style.height=216*scale+'px';item.tile.style.width=384*scale+'px';item.engine.resize()}if(this.follow)this.center(this.x)};
  this.onPointer=()=>{this.follow=false};this.onWheel=e=>{if(Math.abs(e.deltaX)>0||e.shiftKey)this.follow=false};this.onVisibility=()=>{this.last=performance.now()};this.onMedia=()=>this.sync();this.media.addEventListener('change',this.onMedia);
  this.frameElement.addEventListener('pointerdown',this.onPointer,{passive:true});this.frameElement.addEventListener('wheel',this.onWheel,{passive:true});document.addEventListener('visibilitychange',this.onVisibility);this.observer=new ResizeObserver(this.resize);this.observer.observe(this.frameElement);
  this.state.weather=this.pieces[0].engine.state.weather;this.ready=true;this.resize();this.refreshRegions();this.render(true);
 }
 background(s){const key=s.time+':'+s.season+':'+s.weather;if(this.backgroundCache?.key!==key)this.backgroundCache={key,...makeBackground(s)};return this.backgroundCache}
 get raf(){return this.pieces.find(p=>p.engine.raf)?.engine.raf||0}
 get active(){return this.pieces.find(p=>p.offset<=this.x&&p.offset+p.width>this.x)||this.pieces.at(-1)}
 get statics(){return this.active.engine.statics}get dynamics(){return this.active.engine.dynamics}get palette(){return this.active.engine.palette}
 get metrics(){return{staticBuilds:this.pieces.reduce((n,p)=>n+p.engine.metrics.staticBuilds,0),frames:this.state.frames,maxDirtyArea:Math.max(...this.pieces.map(p=>p.engine.metrics.maxDirtyArea))}}
 center(x){this.frameElement.scrollLeft=Math.round(Math.max(0,Math.min(TOTAL*this.scale-this.frameElement.clientWidth,x*this.scale-this.frameElement.clientWidth/2)))}
 refreshRegions(){const current=regionAt(this.target);this.host.dataset.time=this.state.time;for(const p of this.pieces)p.section.classList.toggle('journey-unreached',p.offset>=starts[current]+384);const c=this.mist.getContext('2d');c.clearRect(0,0,TOTAL,216);if(current===3)return;const data=c.createImageData(TOTAL,216),start=starts[current]+336,rgb=this.state.time==='night'?[113,137,158]:[196,211,206];for(let y=65;y<216;y++)for(let x=start;x<TOTAL;x++){const i=(y*TOTAL+x)*4;data.data[i]=rgb[0];data.data[i+1]=rgb[1];data.data[i+2]=rgb[2];data.data[i+3]=Math.round(36*smooth((x-start)/192)*smooth((y-65)/65))}c.putImageData(data,0,0)}
 advance(){if(!this.ready)return;const now=performance.now();if(now-this.last<1000/30)return;const dt=Math.min(.08,(now-(this.last||now))/1000);this.last=now;if(document.hidden||!this.state.motion||this.media.matches)return;this.state.seconds+=dt;this.state.frames++;this.position();}
 position(){const f=this.duration?Math.min(1,Math.max(0,(this.state.seconds-this.moveStart)/this.duration)):1;this.x=this.from+(this.target-this.from)*(1-(1-f)**3);if(this.follow&&f<1)this.center(this.x);if(f===1&&this.from!==this.target){this.x=this.target;this.from=this.target;if(this.follow)this.center(this.x);this.onChange?.()}}
 render(still){for(const p of this.pieces){p.engine.state.seconds=this.state.seconds;p.engine.frame(still)}}
 params(v){const week=clampWeek(v.week);this.state.params.week=week;this.from=this.x;this.target=targetFor(week);this.moveStart=this.state.seconds;this.duration=Math.min(8,Math.max(1,Math.abs(this.target-this.from)/210));this.follow=true;for(const p of this.pieces)p.engine.state.params.week=week;this.refreshRegions();if(!this.state.motion||this.media.matches){this.x=this.target;this.from=this.target;this.center(this.x)}this.render(!this.state.motion||this.media.matches);this.onChange?.()}
 set(v){Object.assign(this.state,v);if(v.date&&!v.weather)this.state.weather=dailyWeather(this.state.date,this.state.time);this.rebuild();this.sync()}
 rebuild(){for(const p of this.pieces)p.engine.set({time:this.state.time,season:this.state.season,date:this.state.date,weather:this.state.weather,motion:this.state.motion});this.state.weather=this.pieces[0].engine.state.weather;this.refreshRegions();this.onChange?.()}
 sync(){if(!this.state.motion||this.media.matches){this.x=this.target;this.from=this.target;if(this.follow)this.center(this.x)}this.last=performance.now();for(const p of this.pieces){p.engine.state.motion=this.state.motion;p.engine.sync()}this.render(!this.state.motion||this.media.matches)}
 drawAt(t){this.state.seconds=t;this.x=this.target;this.from=this.target;if(this.follow)this.center(this.x);this.render(true)}
 frame(still=false){this.position();this.render(still)}
 focusRegion(index){this.follow=false;this.center(starts[index]+192)}
 followTrain(){this.follow=true;this.center(this.x)}
 stats(){return{native:[384,216],nativeStrip:[TOTAL,216],scale:this.scale,palette:40,weather:this.active.engine.state.weather,params:{...this.state.params},...this.metrics,creatures:this.pieces.flatMap(p=>p.engine.creatures.map(c=>({...c,x:c.x+p.offset}))),week:this.state.params.week,trainTarget:{x:this.target,y:railY(this.target)-12},trainPosition:{x:this.x,y:railY(this.x)-12},region:regionAt(this.x),stopped:Math.abs(this.x-this.target)<.05,regions:starts.map((x,i)=>({name:regions[i],x,width:384,creatures:this.pieces.find(p=>p.offset===x).engine.creatures})),segments:this.pieces.map(p=>({kind:p.kind,x:p.offset,width:p.width}))}}
 destroy(){this.ready=false;this.observer.disconnect();for(const p of this.pieces)p.engine.destroy();this.frameElement.removeEventListener('pointerdown',this.onPointer);this.frameElement.removeEventListener('wheel',this.onWheel);document.removeEventListener('visibilitychange',this.onVisibility);this.media.removeEventListener('change',this.onMedia);this.host.replaceChildren()}
}
export default {id:'roadmap-journey',crop:.5,params:{week:1},mount:(host,options)=>new Journey(host,options)};
