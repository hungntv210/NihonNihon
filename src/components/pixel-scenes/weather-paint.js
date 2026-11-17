import {isWet,overcast} from './weather.js';

// Native-pixel exposure planes. Sheltered roofs, room timbers and the login floor are excluded.
const profiles={
 'home-tokyo':{areas:[[46,13,292,48],[46,145,292,8]],pools:[[96,149,15],[232,149,15]],caps:[[137,108,78],[23,128,32]],people:[[101,133]]},
 'review-koi':{areas:[[23,8,334,201]],water:[[130,83],[231,152],[164,181],[251,112]],caps:[[126,27,16],[174,21,16],[228,28,16]]},
 'kanji-himeji':{areas:[[58,12,84,106],[253,12,73,79],[61,157,264,36]],water:[[141,170],[218,181]],caps:[[177,29,39],[149,86,94],[49,36,45]]},
 'shadowing-inari':{areas:[[20,5,110,74],[271,4,70,74],[126,165,79,50]],pools:[[141,194,18],[196,204,12]],caps:[[111,153,13],[212,103,13],[286,119,58]],people:[[165,175]]},
 'vocab-market':{areas:[[3,6,35,166],[348,6,33,166],[55,179,274,37]],pools:[[177,204,18],[232,211,15]],caps:[[0,173,39],[347,172,36]],people:[[194,178]]},
 'grammar-kinkakuji':{areas:[[0,0,384,35],[0,36,151,89],[276,36,108,98],[111,174,227,42]],water:[[173,191],[273,200],[200,159]],caps:[[176,47,75],[60,86,40],[289,108,35]]},
 'jlpt-study':{indoor:true,areas:[[98,23,88,39],[196,23,90,39],[98,69,88,55],[196,69,90,55]],caps:[[103,113,74],[200,113,79]],drops:[[107,31],[164,73],[203,28],[269,82]]},
 'login-shoji':{indoor:true,areas:[[103,12,176,70]],water:[[157,65],[222,66]],caps:[[111,51,13],[169,46,49],[139,23,46]],drops:[[106,15],[276,17],[104,73],[277,75]]},
};
export function weatherProfile(id,scene){const p=profiles[id]||{areas:[[0,0,384,45],[3,180,378,36]],pools:[[145,185,16]],caps:[],people:[]};if(id.startsWith('journey-')){if(id==='journey-osaka')p.people=[[72,128],[141,127],[202,130]];if(id==='journey-kyoto')p.areas=[[0,0,149,45],[246,0,138,45],[3,180,378,36]];else if(id==='journey-osaka')p.areas=[[0,0,231,29],[303,0,81,29],[3,180,378,36]];else if(id==='journey-tokyo')p.areas=[[0,0,384,24],[3,186,378,30]];}if(id!=='login-shoji')return p;const dy=(scene.weatherClip?.[1]||12)-12;return Object.fromEntries(Object.entries(p).map(([key,v])=>[key,Array.isArray(v)?v.map(([x,y,...rest])=>[x,y+dy,...rest]):v]));}
function clip(c,areas){c.beginPath();for(const area of areas)c.rect(...area);c.clip();}
const mix=(hex,to,amount)=>'#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i+1,i+3),16)*(1-amount)+parseInt(to.slice(i+1,i+3),16)*amount).toString(16).padStart(2,'0')).join('');
export function weatherPalette(colors,state,indoor){if(indoor||!overcast(state.weather))return colors;const night=state.time==='night',amount=state.weather==='rain'?.27:.16;return colors.map((v,i)=>i>=35?v:mix(v,night?'#253743':'#657b83',amount));}
export function staticAtmosphere(engine,index){
 const {state:s,scene,api,statics}=engine,w=s.weather;if(w==='clear'||w==='wind')return;
 const profile=weatherProfile(engine.id,scene),c=statics[index].getContext('2d'),{rect:r,line:l,ellipse:e}=api.draw;
 c.save();if(profile.indoor)clip(c,profile.areas);
 // Distance haze is composited onto occupied pixels, not onto foreground empty space.
 if(w==='fog'||(profile.indoor||engine.id.startsWith('journey-'))&&overcast(w)){
  c.globalCompositeOperation='source-atop';c.globalAlpha=w==='fog'?.38/(1+(scene.depths?.[index]||0)*2):.2;
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
 const random=api.random(api.hash(s.date+engine.id+'weather')),surface=engine.dynamics[3].getContext('2d');
 let count=0;const actor=(b,paint)=>engine.actor(3,b,paint);
 // Wet footprints are on actual ground/water, never a generic floating ellipse in the room.
 if(isWet(w)){
  for(const [x,y,width]of profile.pools||[])actor({x,y,w:width,h:5},(c,x,y)=>{c.save();c.globalAlpha=.55;e(c,x+width/2,y+2,width/2,2,7);l(c,x+3,y+1,x+width-3,y+1,16);if(s.time==='night')l(c,x+width/2-2,y+2,x+width/2+2,y+2,36);c.restore()});
  for(const [i,[x,y]]of (profile.water||[]).entries())actor({x:x-5,y:y-2,w:11,h:5},(c,x,y)=>{const size=1+(still?i%3:Math.floor(t*1.7+i)%3);c.save();c.globalAlpha=.55;for(let n=0;n<18;n++){const a=n/18*Math.PI*2;r(c,x+5+Math.cos(a)*size,y+2+Math.sin(a)*size*.5,1,1,16)}c.restore()});
 }
 if(w==='snow')for(const[x,y,width]of profile.caps||[])actor({x,y:y-2,w:width,h:4},(c,x,y)=>{l(c,x,y+1,x+width,y+1,39);l(c,x+2,y,x+width-3,y,32);l(c,x+2,y+2,x+width-2,y+2,13)});
 if(isWet(w)||w==='snow'||w==='wind'){
  surface.save();clip(surface,profile.areas);
  count=w==='rain'?36:w==='drizzle'?15:w==='snow'?20:8;
  for(let i=0;i<count;i++){
   const area=profile.areas[i%profile.areas.length],speed=w==='snow'?3:w==='wind'?6:w==='rain'?37:25;
   const x=area[0]+(random()*area[2]+t*(w==='wind'?10:2))%area[2],y=area[1]+(random()*area[3]+t*speed)%area[3];
   actor({x,y,w:5,h:7},(c,x,y)=>{c.save();c.globalAlpha=w==='rain'?.38:.55;
    if(isWet(w))l(c,x+1,y,x,y+(w==='rain'?5:3),16);
    else if(w==='snow'){r(c,x,y,1+i%2,1,39);if(i%4===0)r(c,x,y+1,1,1,32)}
    else{const color=s.season==='spring'?27:s.season==='summer'?10:s.season==='autumn'?37:25;r(c,x,y,2,1,color);r(c,x+1,y+1,2,1,color)}c.restore();
   });
  }surface.restore();
 }
 if(isWet(w)&&profile.drops)for(const[x,y]of profile.drops)actor({x,y,w:3,h:9},(c,x,y)=>{c.save();c.globalAlpha=.6;l(c,x,y,x,y+5,16);r(c,x,y+6,2,2,15);c.restore()});
 // Outdoor walkers have their own grounded rain silhouettes; canopies remain dry.
 if(isWet(w))for(const[x,y]of profile.people||[])actor({x:x-8,y:y-10,w:24,h:30},(c,x,y)=>{const xx=x+8,yy=y+10;e(c,xx+4,yy+2,2,2,13);r(c,xx+2,yy+5,5,7,7);l(c,xx+3,yy+12,xx+2,yy+16,21);l(c,xx+5,yy+12,xx+6,yy+16,21);l(c,xx+8,yy-1,xx+8,yy+10,24);p(c,[[xx-7,yy-1],[xx-4,yy-6],[xx+3,yy-9],[xx+10,yy-6],[xx+14,yy-1]],29);l(c,xx+3,yy-9,xx+3,yy-1,30);l(c,xx-7,yy-1,xx+14,yy-1,31)});
 engine.weatherParticles=count;
}
