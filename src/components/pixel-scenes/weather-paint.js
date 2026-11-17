import {isWet,overcast} from './weather.js';

// Native-pixel exposure planes. Sheltered roofs, room timbers and the login floor are excluded.
const profiles={
 'home-tokyo':{areas:[[46,13,292,160]],rainLayer:0,frontAreas:[[226,180,19,36],[280,181,49,35]],rainCount:72,pools:[[226,210,18],[280,207,31],[96,149,18],[232,149,18]],caps:[[137,108,78],[23,128,32]],people:[[231,190]]},
 'review-koi':{areas:[[23,8,334,201]],water:[[130,83],[231,152],[164,181],[251,112],[183,104],[207,72],[143,149],[220,183],[190,141]],caps:[[126,27,16],[174,21,16],[228,28,16]]},
 'kanji-himeji':{areas:[[58,12,84,106],[253,12,73,79],[61,157,264,36]],water:[[141,170],[218,181],[168,183],[252,168]],caps:[[177,29,39],[149,86,94],[49,36,45]]},
 'shadowing-inari':{areas:[[20,5,110,74],[271,4,70,74],[126,165,79,50]],pools:[[141,194,18],[196,204,12]],caps:[[111,153,13],[212,103,13],[286,119,58]],people:[[164,175]]},
 'vocab-market':{areas:[[3,6,35,166],[348,6,33,166],[55,177,274,39]],pools:[[165,198,28],[222,211,30],[287,190,23]],caps:[[91,7,202],[0,173,39],[347,172,36]],folded:[[229,174]],people:[]},
 'grammar-kinkakuji':{areas:[[0,0,384,35],[0,36,151,89],[276,36,108,98],[111,174,227,42]],water:[[173,191],[273,200],[200,159],[232,187],[157,166]],caps:[[176,47,75],[60,86,40],[289,108,35]]},
 'jlpt-study':{indoor:true,areas:[[98,23,88,39],[196,23,90,39],[98,69,88,55],[196,69,90,55]],caps:[[103,113,74],[200,113,79]],drops:[[107,31],[164,73],[203,28],[269,82]]},
 'login-shoji':{indoor:true,rainCount:56,areas:[[103,12,176,70]],water:[[151,62],[231,68],[190,72]],caps:[[111,51,13],[169,46,49],[139,23,46]],drops:[[105,81],[277,81],[119,83],[263,83]]},
};
export function weatherProfile(id,scene){const p=profiles[id]||{areas:[[0,0,384,45],[3,180,378,36]],pools:[[145,185,24],[230,190,22]],caps:[],people:[]};if(id.startsWith('journey-')){if(id==='journey-osaka')p.people=[[72,128],[141,127],[202,130]];if(id==='journey-kyoto')p.areas=[[0,0,149,45],[246,0,138,45],[3,180,378,36]];else if(id==='journey-osaka')p.areas=[[0,0,231,29],[303,0,81,29],[3,180,378,36]];else if(id==='journey-tokyo')p.areas=[[0,0,384,24],[3,186,378,30]];}if(id!=='login-shoji')return p;const dy=(scene.weatherClip?.[1]||12)-12;return Object.fromEntries(Object.entries(p).map(([key,v])=>[key,Array.isArray(v)?v.map(([x,y,...rest])=>[x,y+dy,...rest]):v]));}
function clip(c,areas){c.beginPath();for(const area of areas)c.rect(...area);c.clip();}
const mix=(hex,to,amount)=>'#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i+1,i+3),16)*(1-amount)+parseInt(to.slice(i+1,i+3),16)*amount).toString(16).padStart(2,'0')).join('');
export function weatherPalette(colors,state,indoor){if(indoor||!overcast(state.weather))return colors;const night=state.time==='night',amount=state.weather==='rain'?.27:.16;return colors.map((v,i)=>i>=35?v:mix(v,night?'#253743':'#657b83',amount));}
export function staticAtmosphere(engine,index){
 const {state:s,scene,api,statics}=engine,w=s.weather;if(w==='clear'||w==='wind')return;
 const profile=weatherProfile(engine.id,scene),c=statics[index].getContext('2d'),{rect:r,line:l,ellipse:e,polygon:p}=api.draw;
 c.save();if(profile.indoor)clip(c,profile.areas);
 // The entry paving is wet; racks, roof and walkers are painted above it.
 if(engine.id==='vocab-market'&&index===0&&isWet(w)){c.globalAlpha=.22;p(c,[[95,177],[279,177],[303,216],[63,216]],7);c.globalAlpha=.42;for(const[x,y,width]of [[174,189,16],[244,203,20],[128,209,14]])l(c,x,y,x+width,y,33);c.globalAlpha=1;}
 // Distance haze is composited onto occupied pixels, not onto foreground empty space.
 if(w==='fog'||(profile.indoor||engine.id.startsWith('journey-'))&&overcast(w)){
  c.globalCompositeOperation='source-atop';c.globalAlpha=w==='fog'?.38/(1+(scene.depths?.[index]||0)*2):w==='rain'&&engine.id==='login-shoji'?.5:w==='drizzle'&&profile.indoor?.3:.2;
  c.fillStyle=w==='fog'?(s.time==='night'?'#506575':'#a9b9b8'):(s.time==='night'?'#1e3143':'#556d76');c.fillRect(0,0,384,engine.height);c.globalCompositeOperation='source-over';c.globalAlpha=1;
 }
 if(index===0&&overcast(w)){
  // Small opaque cloud banks read even with motion disabled; skies have no sun/moon.
  for(const [x,y,rx]of [[126,22,23],[253,33,31]]){c.globalAlpha=.3;e(c,x,y+(engine.id==='login-shoji'?(scene.weatherClip[1]-12):0),rx,3,3);}c.globalAlpha=1;
 }
 c.restore();
}
export function weatherFrame(engine,still){
 const {state:s,scene,api}=engine,w=s.weather;if(w==='clear')return;
 const profile=weatherProfile(engine.id,scene),{rect:r,line:l,ellipse:e,polygon:p}=api.draw,t=still?7:s.seconds;
 const random=api.random(api.hash(s.date+engine.id+'weather'));
 let count=0;const actor=(b,paint)=>engine.actor(3,b,paint);
 // Wet footprints are on actual ground/water, never a generic floating ellipse in the room.
 if(isWet(w)){
  for(const [x,y,width]of profile.pools||[])actor({x,y,w:width,h:5},(c,x,y)=>{c.save();c.globalAlpha=.76;e(c,x+width/2,y+2,width/2,2,7);l(c,x+3,y+1,x+width-3,y+1,33);if(s.time==='night')l(c,x+width/2-2,y+2,x+width/2+2,y+2,36);c.restore()});
  for(const [i,[x,y]]of (profile.water||[]).entries())actor({x:x-7,y:y-4,w:15,h:9},(c,x,y)=>{const size=3+(still?i%3:Math.floor(t*1.7+i)%4);c.save();c.globalAlpha=.72;for(let n=0;n<24;n++){const a=n/24*Math.PI*2;if(n%7!==0)r(c,x+7+Math.cos(a)*size,y+4+Math.sin(a)*size*.6,1,1,33)}c.restore()});
 }
 if(w==='snow')for(const[x,y,width]of profile.caps||[])actor({x,y:y-2,w:width,h:4},(c,x,y)=>{l(c,x,y+1,x+width,y+1,39);l(c,x+2,y,x+width-3,y,32);l(c,x+2,y+2,x+width-2,y+2,13)});
 if(isWet(w)||w==='snow'||w==='wind'){
  const plane=profile.rainLayer??3,contexts=[...new Set([plane,3])].map(layer=>{const c=engine.dynamics[layer].getContext('2d');c.save();clip(c,layer===plane?profile.areas:profile.frontAreas||profile.areas);return c});
  count=w==='rain'?(profile.rainCount||36):w==='drizzle'?32:w==='snow'?20:8;
  for(let i=0;i<count;i++){
   const front=isWet(w)&&profile.frontAreas&&i>=count-12,areas=front?profile.frontAreas:profile.areas,area=areas[i%areas.length],speed=w==='snow'?3:w==='wind'?6:w==='rain'?37:25;
   const x=area[0]+(random()*area[2]+t*(w==='wind'?10:2))%area[2],y=area[1]+(random()*area[3]+t*speed)%area[3];
   engine.actor(front?3:plane,{x,y,w:5,h:8},(c,x,y)=>{c.save();c.globalAlpha=w==='rain'?(engine.id==='shadowing-inari'?.38:.62):.72;
    if(isWet(w)){if(w==='rain'&&engine.id==='shadowing-inari')l(c,x+1,y,x,y+5,16);else{c.fillStyle=s.time==='night'?'#9cbacb':'#bfd1d9';c.fillRect(x+1,y,1,2);c.fillRect(x,y+2,1,w==='rain'?4:3);}}
    else if(w==='snow'){r(c,x,y,1+i%2,1,39);if(i%4===0)r(c,x,y+1,1,1,32)}
    else{const color=s.season==='spring'?27:s.season==='summer'?10:s.season==='autumn'?37:25;r(c,x,y,2,1,color);r(c,x+1,y+1,2,1,color)}c.restore();
   });
  }for(const c of contexts)c.restore();
 }
 if(isWet(w)&&profile.drops)for(const[x,y]of profile.drops)actor({x,y,w:3,h:9},(c,x,y)=>{c.save();c.globalAlpha=.6;l(c,x,y,x,y+5,16);r(c,x,y+6,2,2,15);c.restore()});
 if(isWet(w))for(const[x,y]of profile.folded||[])actor({x,y,w:6,h:22},(c,x,y)=>{l(c,x+2,y,x+2,y+20,24);p(c,[[x,y+3],[x+4,y+3],[x+5,y+16],[x+2,y+18]],29);l(c,x+2,y+4,x+3,y+16,30);l(c,x+2,y+20,x+4,y+20,24)});
 // Outdoor walkers have their own grounded rain silhouettes; canopies remain dry.
 if(isWet(w))for(const[x,y]of profile.people||[])actor({x:x-8,y:y-10,w:24,h:30},(c,x,y)=>{const xx=x+8,yy=y+10;e(c,xx+4,yy+2,2,2,13);r(c,xx+2,yy+5,5,7,7);l(c,xx+3,yy+12,xx+2,yy+16,21);l(c,xx+5,yy+12,xx+6,yy+16,21);l(c,xx+8,yy-1,xx+8,yy+10,24);p(c,[[xx-7,yy-1],[xx-4,yy-6],[xx+3,yy-9],[xx+10,yy-6],[xx+14,yy-1]],29);l(c,xx+3,yy-9,xx+3,yy-1,30);l(c,xx-7,yy-1,xx+14,yy-1,31)});
 engine.weatherParticles=count;
}
