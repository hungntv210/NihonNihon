import {dailyWeather,weatherLabels} from './weather.js';
import {weatherPalette,staticAtmosphere,weatherFrame} from './weather-paint.js';
// Approved standalone pixel renderer, adapted to route-local ES modules.
const W=384,H=216;const palettes={
 morning:['#c4d8db','#d8e3dc','#ede8ce','#a7c2cc','#8aabb8','#78949f','#637b8b','#536e7c','#506c70','#6e8581','#929d8e','#b5b39d','#d7c8aa','#e9d5b5','#faf0cf','#c2b9a1','#9f9d8e','#7c8780','#596e6b','#384e55','#273d48','#1d303c','#26343e','#43454a','#676266','#8f8580','#b8a29a','#d8b9ad','#eed2bc','#b68b80','#91656b','#6c505d','#d1e9d6','#9ebfbd','#709590','#ffdd99','#efbc7d','#c58d65','#826e61','#f4e7c4'],
 day:['#80b5c4','#a6c9ca','#f1dba5','#86afb4','#71969e','#61828b','#54717a','#45616c','#526e62','#779271','#a5b28b','#c6c096','#daca9b','#ecdaa6','#fff2c5','#b8b697','#a19f85','#838e77','#627b65','#3c594e','#2b4644','#20383c','#2c393b','#494849','#716761','#a28b76','#c7ac8d','#e0c6a3','#f7deba','#c09283','#a66f70','#75545c','#d9ecc4','#aec6a5','#7d9e8d','#ffe49c','#f5c46b','#d39750','#8f735a','#fff0c5'],
 sunset:['#5d697f','#9a8290','#cf9b90','#a0838b','#80758b','#6b6c80','#596578','#4b596c','#4b6565','#69786b','#8e8b77','#b59d81','#cfaf8e','#e5c49e','#f3d7af','#a99b8c','#8c8b80','#727e77','#566c66','#3c5359','#2b414d','#20323f','#2b3544','#43404d','#665263','#8b6674','#b0808b','#cc9da1','#e2bab1','#bc877f','#a5656e','#754e60','#e6d6bb','#b9c6b0','#83a49b','#ffda94','#edb974','#cb8b5b','#82675d','#f8e2b5'],
 night:['#1c2b46','#293955','#3b4b65','#354765','#344661','#34445d','#344356','#303e50','#304b4c','#405e54','#5a7161','#78836d','#999782','#b9ad91','#d3c3a0','#687b7a','#576c70','#465e65','#374f58','#293f4b','#213443','#192b38','#1c2938','#293342','#3e4052','#5c5263','#7d6b7d','#9c8490','#b39c9e','#9e756c','#7e5364','#5e4258','#b9cdb4','#8daea7','#5b8b89','#ffdc8f','#e8b96e','#be8756','#6e5d59','#f7e5b7']};

function makeCanvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c}
function makeDrawing(P,state){const rand=()=>.63;const canvas=makeCanvas;function rect(c,x,y,w,h,index){c.fillStyle=P[index];c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function line(c,x0,y0,x1,y1,index){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let err=dx+dy;for(;;){rect(c,x0,y0,1,1,index);if(x0===x1&&y0===y1)break;let e=2*err;if(e>=dy){err+=dy;x0+=sx}if(e<=dx){err+=dx;y0+=sy}}}
function polygon(c,points,index){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);for(let y=Math.min(...ys);y<=Math.max(...ys);y++){const cuts=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}cuts.sort((a,b)=>a-b);for(let i=0;i<cuts.length;i+=2)rect(c,Math.ceil(cuts[i]),y,Math.floor(cuts[i+1])-Math.ceil(cuts[i])+1,1,index)}}
const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function dither(c,x,y,w,h,a,b,density=2){rect(c,x,y,w,h,a);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(BAYER[yy&3][xx&3]<density*4)rect(c,xx,yy,1,1,b)}
// Hand-pixelled 11px glyphs; no font rasterisation or unreadable microtext.
const glyphs={
 '東':['.....#.....','.#########.','.....#.....','..#######..','..#..#..#..','..#######..','..#..#..#..','..#######..','....###....','..##.#.##..','.#...#...#.'],
 '京':['.....#.....','.#########.','...........','..#######..','..#.....#..','..#######..','...........','.....#.....','..#..#..#..','.#...#...#.','....##.....'],
 'さ':['......#....','......#....','.#########.','.......#...','........#..','...####....','..#........','..#........','...#.......','....#####..','...........'],
 'く':['.......#...','......#....','.....#.....','....#......','...#.......','..#........','...#.......','....#......','.....#.....','......#....','.......#...'],
 'ら':['...###.....','......#....','...........','...#.......','...#.......','..#..###...','..###...#..','........#..','........#..','......##...','...###.....'],
 '食':['.....#.....','...##.##...','.##.....##.','...#####...','...#...#...','...#####...','...#...#...','...#####...','...#..#.#..','...#...#...','..###...##.'],
 '堂':['..#..#..#..','...#.#.#...','.#########.','.#.......#.','...#####...','...#...#...','...#####...','.....#.....','..#######..','.....#.....','.#########.']};
function lettering(c,value,x,y,index=20){for(const ch of value){const g=glyphs[ch];if(g){g.forEach((row,yy)=>Array.from(row).forEach((v,xx)=>{if(v==='#')rect(c,x+xx,y+yy,1,1,index)}));x+=13}}}
function ellipse(c,x,y,rx,ry,index){for(let yy=-ry;yy<=ry;yy++){const width=Math.floor(rx*Math.sqrt(Math.max(0,1-yy*yy/(ry*ry))));rect(c,x-width,y+yy,width*2+1,1,index)}}
function text(c,value,x,y,size,index){const a=canvas(),ac=a.getContext('2d');ac.font=`${size}px JP`;ac.textBaseline='top';ac.fillStyle='#fff';ac.fillText(value,0,0);const pixels=ac.getImageData(0,0,Math.ceil(ac.measureText(value).width)+2,size+5);for(let yy=0;yy<pixels.height;yy++)for(let xx=0;xx<pixels.width;xx++)if(pixels.data[(yy*pixels.width+xx)*4+3]>100)rect(c,x+xx,y+yy,1,1,index)}
function windows(c,x,y,cols,rows,step=6,rng=rand){const n=state.time==='night'||state.time==='sunset';for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){const lit=n&&rng()>.35;rect(c,x+k*step,y+r*7,3,4,lit?35:7);if(lit){rect(c,x+k*step,y+r*7,1,4,39);rect(c,x+k*step+3,y+r*7+3,1,1,37)}else rect(c,x+k*step,y+r*7,1,1,15)}}

return{rect,line,polygon,dither,ellipse,lettering,windows,BAYER}}
// Canvas coordinates and dirty rectangles are always native pixels; CSS never filters them.
class Engine {
 constructor(host,definition,options={}){
  this.height=H;this.host=host;this.def=definition;this.id=definition.id;
  this.state={nativeHeight:H,time:'day',season:'spring',date:'1970-01-01',motion:true,seconds:7,frames:0,params:{...definition.params},...options};
  if(!palettes[this.state.time])this.state.time='sunset';if(!['spring','summer','autumn','winter'].includes(this.state.season))this.state.season='spring';
  if(!Object.hasOwn(weatherLabels,this.state.weather))this.state.weather=dailyWeather(this.state.date,this.state.time);
  this.palette=[];this.statics=[];this.dynamics=[];this.dirty=[];this.creatures=[];this.metrics={staticBuilds:0,frames:0,maxDirtyArea:0};this.raf=0;this.last=0;this.visible=false;this.media=matchMedia('(prefers-reduced-motion: reduce)');
  this.world=document.createElement('div');this.world.className='pixel-world';host.append(this.world);
  this.api={reduced:()=>this.reduced(),state:this.state,palette:this.palette,draw:makeDrawing(this.palette,this.state),actor:(...args)=>this.actor(...args),creature:(kind,bounds)=>this.creatures.push({kind,...bounds}),random:seeded,hash,scheduled:(t,name,start,end,chance=1)=>{const lap=Math.floor(t/24),r=seeded(hash(this.state.date+name+lap))();return t%24>=start&&t%24<end&&r<chance},sprite:(c,frames,f,x,y,flip=false)=>this.sprite(c,frames,f,x,y,flip)};
  this.scene=definition.create(this.api);this.params(this.state.params,false);
  this.scene.layers.forEach((fn,i)=>{const c=makeCanvas();c.className='pixel-layer';c.style.zIndex=String(this.scene.zIndices?.[i]??i*2);this.world.append(c);this.statics.push(c)});
  for(let i=0;i<4;i++){const c=makeCanvas();c.className='pixel-layer';c.style.zIndex=String(this.scene.dynamicZIndices?.[i]??[3,5,11,13][i]);this.world.append(c);this.dynamics.push(c);this.dirty.push([])}
  this.resize=()=>{let scale=innerWidth<600?2:Math.max(2,Math.min(4,Math.floor(host.clientWidth/W)));if(this.def.nativeHeight?.(host,scale)>H)scale=Math.max(scale,Math.ceil(host.clientWidth/W));this.scale=scale;this.world.style.width=W*scale+'px';const height=this.def.nativeHeight?.(host,scale)??H,changed=height!==this.height;this.height=height;this.state.nativeHeight=height;this.world.style.height=height*scale+'px';this.world.style.left=Math.round((host.clientWidth-W*scale)*(this.def.crop??.5))+'px';host.style.height=height*scale+'px';if(changed)for(const c of [...this.statics,...this.dynamics])c.height=height;if(changed||!this.metrics.staticBuilds)this.rebuild();this.parallax()};
  this.onScroll=()=>this.parallax();this.onVisibility=()=>this.sync();this.onMedia=()=>this.sync();
  this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(host);if(definition.nativeHeight)this.resizeObserver.observe(host.parentElement);this.intersection=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.sync()});this.intersection.observe(host);
  document.addEventListener('visibilitychange',this.onVisibility);this.media.addEventListener('change',this.onMedia);window.addEventListener('scroll',this.onScroll,{passive:true});
  this.resize();
 }
 params(values,rebuild=true){for(const key of Object.keys(this.def.params)){const n=Number(values[key]);this.state.params[key]=Number.isFinite(n)?Math.max(0,n):this.def.params[key];}this.scene.normalize?.(this.state.params);if(rebuild)this.rebuild()}
 set(values){Object.assign(this.state,values);if(values.date&&!values.weather)this.state.weather=dailyWeather(this.state.date,this.state.time);if(this.state.weather==='fog'&&this.state.time!=='morning')this.state.weather='cloudy';this.rebuild()}
 rebuild(){
  const colors=[...palettes[this.state.time]];
  if(this.def.seasonSwatches!==false){const seasonal={spring:['#b38793','#d2a8ac','#edc8ba'],summer:['#476759','#718966','#a4af7c'],autumn:['#965740','#bd7e46','#deaa66'],winter:['#839695','#bac4b6','#e6e1cb']}[this.state.season];colors.splice(26,3,...seasonal)}
  const override=typeof this.def.swatches==='function'?this.def.swatches(this.state):this.def.swatches;for(const [i,color]of Object.entries(override||{}))colors[Number(i)]=color;this.palette.splice(0,this.palette.length,...weatherPalette(colors,this.state,['login-shoji','jlpt-study'].includes(this.id)));

  this.scene.layers.forEach((fn,i)=>{const c=this.statics[i].getContext('2d');c.clearRect(0,0,W,this.height);fn(c);staticAtmosphere(this,i)});this.metrics.staticBuilds++;this.frame(true);this.sync();this.onChange?.();
 }
 actor(layer,bounds,paint){const {x,y,w,h}=bounds,c=this.dynamics[layer].getContext('2d');const b={x:Math.floor(x)-2,y:Math.floor(y)-2,w:Math.ceil(w)+4,h:Math.ceil(h)+4};this.dirty[layer].push(b);paint(c,Math.floor(x),Math.floor(y));}
 sprite(c,frames,index,x,y,flip=false){const frame=frames[((index%frames.length)+frames.length)%frames.length];for(let yy=0;yy<frame.length;yy++)for(let xx=0;xx<frame[yy].length;xx++){const color=frame[yy][xx];if(color>=0)this.api.draw.rect(c,x+(flip?frame[yy].length-xx-1:xx),y+yy,1,1,color)}}
 frame(still=false){for(let i=0;i<this.dynamics.length;i++){const c=this.dynamics[i].getContext('2d');for(const b of this.dirty[i])c.clearRect(b.x,b.y,b.w,b.h);this.dirty[i]=[]}this.creatures=[];this.scene.frame(this.state.seconds,still);this.weather(still);this.metrics.maxDirtyArea=Math.max(this.metrics.maxDirtyArea,this.dirty.flat().reduce((a,b)=>a+b.w*b.h,0));}
 weather(still){this.weatherParticles=0;weatherFrame(this,still)}
 reduced(){return !this.state.motion||this.media.matches}
 parallax(){const n=this.reduced()?0:Math.max(-2,Math.min(2,Math.round((this.host.getBoundingClientRect().top-130)/250)));this.statics.forEach((c,i)=>{c.style.transform=`translateY(${Math.round(n*(this.scene.depths?.[i]||0))*this.scale}px)`});this.dynamics.forEach((c,i)=>{c.style.transform=`translateY(${Math.round(n*(this.scene.dynamicDepths?.[i]||0))*this.scale}px)`})}
 tick(now){this.raf=0;if(document.hidden||this.reduced()||!this.visible)return;this.raf=requestAnimationFrame(t=>this.tick(t));if(now-this.last<1000/30)return;this.state.seconds+=Math.min(.08,(now-this.clock)/1000);this.clock=now;this.last=now;this.state.frames++;this.metrics.frames++;this.frame(false)}
 sync(){cancelAnimationFrame(this.raf);this.raf=0;if(!document.hidden&&!this.reduced()&&this.visible){this.clock=performance.now();this.last=0;this.raf=requestAnimationFrame(t=>this.tick(t))}else if(this.reduced())this.frame(true);this.parallax()}
 drawAt(t){this.state.seconds=t;this.frame(true)}
 complete(){this.scene.complete?.(this.reduced());this.frame(this.reduced())}
 stats(){return{native:[W,this.height],scale:this.scale,palette:this.palette.length,weather:this.state.weather,weatherParticles:this.weatherParticles||0,creatures:this.creatures,params:{...this.state.params},...this.metrics,...this.scene.stats?.()}}
 destroy(){cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.intersection.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.media.removeEventListener('change',this.onMedia);window.removeEventListener('scroll',this.onScroll);this.world.remove()}
}
function hash(s){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
function seeded(n){return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
const decode=rows=>rows.map(r=>Array.from(r,c=>c==='.'?-1:parseInt(c,36)));
const bird=Array.from({length:6},(_,f)=>decode(f===0?['...kk....','..kffk...','..f3fk...','.kffff...','kfffffk..','..kffk...','..k..k...']:f===1?['.........','...kk....','..kffk...','.kff3fk..','kfffffk..','..kffk...','..k..k...']:f===2?['.........','.........','..kk.....','.kffffk..','kffff3fk.','..kffk...','..k..k...']:f===3?['...kk....','..kffk...','..kf3f...','.kffff...','kfffffk..','..kffk...','..k..k...']:f===4?['f.....f..','.f...f...','..fkf....','..ffff...','...kk....','.........','.........']:['.........','...fkf...','.ffffff..','f..kk..f.','.........','.........','.........']));
const fish=Array.from({length:8},(_,f)=>{const a=decode(['........fffff...........','.....ffdddddddff........','...ffddeedddddddff......','..fdddtddttddddddef.....','.kddtttddttdddddddf.....','..fdddttddddddeedf......','...ffdddddddddddff.....','.....ffdddddddff........','........fffff...........','........................']);for(const [x,y]of [[[20,2],[21,2],[21,3],[22,3]],[[21,3],[22,3],[22,5],[23,5]],[[20,6],[21,7],[22,7],[21,8]],[[21,4],[22,4],[23,4],[22,5]]][f%4])a[y][x]=13;if(f>=4){a[0][10]=14;a[0][11]=14;a[1][11]=14}return a});
const fox=Array.from({length:8},(_,f)=>{const rows=['..t.....t........','..tt...tt........','..tdddddt........','..tdkddkdtt......','...dddddddtt.....','...dddeddtttt....','...ttddddttteee..','....ttttttteee...','....tt..ttt.....',['...k......k.....','....k....k......','.....k....k.....','...k.....k......'][f%4]];if(f>=4){rows[6]='...ttddddtteeee..';rows[7]='....ttttttteee...'}return decode(rows)});
const dragonfly=[['f...f...f','..f.f.f..','...kkk...','..f.k.f..','f...k...f'],['.f..f..f.','...fff...','...kkk...','...fkf...','.f..k..f.'],['..f.f.f..','...fff...','...kkk...','..f.k.f..','..f.k.f..'],['...fff...','..f.f.f..','...kkk...','.f..k..f.','....k....']].map(decode);
export const SceneEngine={Engine,palettes,hash,seeded,decode,sprites:{bird,fish,fox,dragonfly}};

