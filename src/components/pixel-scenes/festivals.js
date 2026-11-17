import {overcast,isWet} from './weather.js';
import {catalog,eventFor,tsukimiDates} from './festival-calendar.js';
export {catalog,eventFor,tsukimiDates} from './festival-calendar.js';
 function sample(event,year){const md=event.id==='tsukimi'?[tsukimiDates[year]].flat()[0]:event.monthDay;return md?`${year}-${md}`:null}
 export function decorate(def){
  if(!catalog.some(e=>e.scene===def.id)||def.mount)return def;
  return{...def,create(api){
   const base=def.create(api),{state,draw:d}=api,{rect:r,line:l,ellipse:e,polygon:p}=d;
   const active=()=>eventFor(def.id,state.date),night=()=>state.time==='night';
   const originalFirst=base.layers[0];
   const layers=[...base.layers];
   // Replace the ordinary small moon only on Tsukimi, leaving the underlying scene file untouched.
   layers[0]=c=>{originalFirst(c);if(active()?.id==='tsukimi'&&night())r(c,274,16,29,28,0)};
   function back(c){if(active()?.id==='tsukimi'&&night()&&!overcast(state.weather)){e(c,258,29,22,22,1);e(c,258,29,18,18,39);e(c,251,25,3,2,13);e(c,264,35,4,2,13);p(c,[[253,32],[252,27],[254,24],[255,18],[257,18],[257,25],[259,26],[261,22],[263,22],[261,28],[263,33],[259,36]],15)}}
   function lamp(c,x,y){r(c,x,y,1,8,24);e(c,x,y+13,4,6,night()?35:29);l(c,x-3,y+8,x+3,y+8,21);l(c,x-3,y+18,x+3,y+18,21);l(c,x-2,y+10,x-2,y+16,30);r(c,x,y+11,1,4,21)}
   function bamboo(c,x,y){
    r(c,x-8,y-1,17,8,23);r(c,x-7,y,15,5,25);l(c,x-8,y,x+8,y,12);r(c,x-1,y-57,2,56,18);r(c,x,y-57,1,55,9);
    for(let i=0;i<5;i++){const yy=y-11-i*10,dir=i%2?1:-1;r(c,x-2,yy,4,1,19);l(c,x,yy,x+dir*10,yy-8,18);p(c,[[x+dir*3,yy-2],[x+dir*13,yy-9],[x+dir*9,yy-2]],9);p(c,[[x+dir*5,yy-4],[x+dir*9,yy-12],[x+dir*10,yy-6]],18)}
   }
   function front(c){
    const id=active()?.id;
    if(id==='hatsumode')for(const i of [0,2,4,6,8]){const f=i/10;lamp(c,151+f*107,101-f*41)}
    if(id==='hanami'){
     l(c,301,112,251,101,24);for(let i=0;i<14;i++){const x=247+(i*17)%37,y=94+(i*11)%17;e(c,x,y,4,2,26);e(c,x-1,y-1,3,1,27);r(c,x,y-2,1,1,28)}
     p(c,[[219,205],[241,205],[246,214],[219,215]],21);p(c,[[220,206],[240,206],[244,213],[220,214]],33);for(let y=207;y<214;y+=3)for(let x=221;x<242;x+=4)r(c,x+(y%2),y,2,1,13);
     r(c,229,210,9,3,24);r(c,230,210,7,2,13);r(c,231,210,2,1,29);r(c,235,210,2,1,18);r(c,241,208,2,3,25);
    }
    if(id==='tanabata'){bamboo(c,132,162);bamboo(c,280,169)}
    if(id==='tsukimi'){
     // A small viewing deck is anchored in the gravel bank and carried by visible piles in the pond.
     r(c,130,202,3,14,24);r(c,143,208,3,8,24);p(c,[[78,190],[130,190],[151,216],[77,216]],23);p(c,[[79,191],[128,191],[146,213],[79,213]],25);for(let y=194;y<215;y+=4)l(c,79,y,128+(y-191)*.8,y,24);
     r(c,117,198,3,13,24);r(c,133,198,3,13,24);r(c,114,195,24,4,23);r(c,115,195,22,2,13);e(c,126,194,9,2,12);
     for(const[x,y]of[[120,192],[125,192],[130,192],[122,188],[127,188],[125,184]]){e(c,x,y,2,2,13);r(c,x-1,y-1,2,1,39)}
     for(let i=0;i<5;i++){const x=85+i*3;l(c,x,207,x-3+i%2,186-i%2*5,12);p(c,[[x-3,190],[x-5,183],[x-2,178],[x,186]],11)}
    }
   }
   function person(c,x,y,f,tone=7,small=false){
    // Six hand-pixelled walking poses at the same grounded baseline.
    e(c,x+3,y+2,2,2,13);r(c,x+1,y+5,5,6,tone);r(c,x+(f%2?0:1),y+6,1,4,13);const n=[0,1,1,0,-1,-1][f%6];l(c,x+2,y+11,x+1+n,y+14,21);l(c,x+5,y+11,x+6-n,y+14,21);if(!small)r(c,x+5,y+6,3,4,24);if(isWet(state.weather)){const w=small?6:9;l(c,x+6,y-3,x+6,y+8,24);p(c,[[x+3-w,y-2],[x+3-w*.7,y-6],[x+3,y-9],[x+3+w*.7,y-6],[x+3+w,y-2]],29);l(c,x+3,y-9,x+3,y-2,30);l(c,x+3-w,y-2,x+3+w,y-2,31)}
   }
   function burst(t,still,x,y,phase,color){
    if(!still&&(phase<0||phase>4.8))return;const radius=still?33:3+Math.min(30,phase*17),drop=still?0:Math.max(0,phase-1.6)**2*2;
    api.actor(0,{x:x-41,y:y-41,w:84,h:104},(c,xx,yy)=>{c.save();c.globalAlpha=still?1:Math.max(.16,1-phase/5.5);const colors=['#ff92b0','#8fe4f3','#ffe6a1','#f8b55d','#a5e8ad','#c5b0ff','#fff6e2'];
     const pixel=(x,y,tone)=>{c.fillStyle=tone;c.fillRect(Math.round(x),Math.round(y),1,1)};
     for(let i=0;i<84;i++){const angle=i/84*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle),reach=.64+((i*47)%31)/86,tone=colors[(i+color)%colors.length],cx=xx+41,cy=yy+41+drop;
      // Unequal radial trails fill the center; no shared-radius rings.
      for(let step=1;step<=Math.ceil(radius*reach);step++){if(step>radius*.6&&(step+i)%5===0)continue;pixel(cx+cos*step,cy+sin*step,step<7?'#fff6e2':tone);}
      if(still||phase>1)for(let tail=1;tail<=6;tail++)pixel(cx+cos*(radius*reach-tail*.45),cy+sin*radius*reach+tail*1.6,tail%3?tone:'#fff6e2');
     }c.restore();});
   }
   function frame(t,still){
    base.frame(t,still);const id=active()?.id;
    if(id==='hatsumode')for(let i=0;i<8;i++){const f=i/7,x=148+f*99+(i%2?7:-7),foot=184-f*88,y=foot-15;api.actor(2,{x:x-(isWet(state.weather)?8:1),y:y-(isWet(state.weather)?10:0),w:isWet(state.weather)?28:12,h:isWet(state.weather)?31:18},(c,x,y)=>person(c,x+(isWet(state.weather)?8:1),y+(isWet(state.weather)?10:0),still?i%6:Math.floor(t*3+i),[7,29,18,25][i%4],i>4))}
    if(id==='hanami'){
     for(const[x,y,tone]of[[220,200,29],[240,201,18]])api.actor(2,{x,y,w:7,h:11},(c,x,y)=>{e(c,x+3,y+2,2,2,13);r(c,x+1,y+5,5,4,tone);l(c,x+1,y+8,x+6,y+8,21)});
     for(let i=0;i<6;i++){const x=222+(i*13+(still?0:t*2))%48,y=128+(i*17+(still?0:t*3))%70;api.actor(2,{x,y,w:3,h:2},(c,x,y)=>{r(c,x,y,2,1,27);r(c,x+1,y+1,1,1,28)})}
    }
    if(id==='tanabata')for(const[bx,by]of[[132,162],[280,169]])for(let i=0;i<5;i++){
     const dir=i%2?1:-1,x=bx+dir*8,y=by-12-i*9,n=still?0:[0,1,0,-1][Math.floor(t*2+i)%4];api.actor(2,{x:x-3,y:y-5,w:9,h:18},(c,x,y)=>{l(c,x+3,y,x+3,y+4,24);p(c,[[x+1,y+4],[x+5,y+4],[x+5+n,y+13],[x+1+n,y+13]],[29,33,13,30,35][i]);l(c,x+2,y+6,x+2+n,y+11,14)})
    }
    if(id==='matsuri'&&night()){const phase=t%12;burst(t,still,143,43,phase,37);burst(t,still,240,46,phase-6,33)}
    if(id==='tsukimi'){
     api.actor(2,{x:98,y:186,w:22,h:28},(c,x,y)=>{e(c,x+11,y+22,7,5,13);e(c,x+9,y+19,7,6,39);e(c,x+5,y+17,4,4,39);const pose=still?0:Math.floor(t*.7)%4;r(c,x+2,y+4+pose%2,2,11,39);r(c,x+7,y+2,2,12,39);r(c,x+3,y+6+pose%2,1,7,27);r(c,x+8,y+4,1,7,27);r(c,x+3,y+16,1,1,21);r(c,x+1,y+19,1,1,29);e(c,x+17,y+20,3,3,39);l(c,x+7,y+26,x+14,y+26,13)});api.creature('tsukimi-rabbit',{x:98,y:186,w:22,h:28});
    }
   }
   const z=base.layers.map((_,i)=>base.zIndices?.[i]??i*2),frontZ=def.id==='home-tokyo'?10:Math.max(...z)+2;
   return{...base,layers:[...layers,back,front],zIndices:[...z,1,frontZ],depths:[...(base.depths||base.layers.map(()=>0)),base.depths?.[0]||0,base.dynamicDepths?.[2]||0],frame,stats(){return{...base.stats?.(),festival:active()?.id||null,festivalLabel:active()?.label||null,calendarSupported:!!tsukimiDates[Number(state.date.slice(0,4))]}}};
  }};
 }
