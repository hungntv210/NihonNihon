import type { DayPeriod } from '../../core/day-period.ts';
const PIXEL = {
 orange:['#f4c288','#bf6b32','#824017'], blue:['#b6dce8','#4084aa','#235777'],
 coral:['#f3b3a0','#c45547','#8a302a'], gold:['#f6d781','#b4872d','#725214'],
 violet:['#d3c1ee','#8b68b5','#593c7b'], teal:['#a9d9ce','#3d8f87','#205b58'],
 rose:['#ebc0d5','#b66c93','#7e3e64'], leaf:['#cdda9f','#7c9853','#4c6231'],
 stone:['#fffaf1','#d9d3c7','#414451'], sky:['#bacfe5','#6e87ab','#283a59'],
 ink:'#252834', white:'#fffdf8'
};
let sceneSerial=0;
function rect(x:number,y:number,w:number,h:number,fill:string){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`}
function sceneAtmosphere(id:string,time:DayPeriod){
 const colors={morning:['#add6e5','#fbfaf5'],day:['#70bfdb','#fcd575'],sunset:['#f4a25d','#b7282e'],night:['#141d46','#3a2457']};
 const style='';
 return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1" ${style}><stop style="stop-color:var(--sky-top)"/><stop offset="1" style="stop-color:var(--sky-bottom)"/></linearGradient><radialGradient id="${id}-halo"><stop stop-color="#fff0be" stop-opacity=".23"/><stop offset=".45" stop-color="#ffe8b0" stop-opacity=".11"/><stop offset="1" stop-color="#ffe8b0" stop-opacity="0"/></radialGradient><linearGradient id="${id}-mist" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5fbff" stop-opacity="0"/><stop offset=".5" stop-color="#f5fbff" stop-opacity=".28"/><stop offset="1" stop-color="#f5fbff" stop-opacity="0"/></linearGradient></defs><g class="sky-colors"><rect width="1280" height="480" fill="url(#${id}-sky)"/>${time==='night'?`<g class="moon" shape-rendering="geometricPrecision"><circle cx="1038" cy="64" r="86" fill="url(#${id}-halo)"/><circle cx="1038" cy="64" r="25" fill="#ffedc1"/><circle cx="1029" cy="54" r="5" fill="#d5c6ae" opacity=".38"/><circle cx="1046" cy="70" r="7" fill="#d5c6ae" opacity=".25"/><circle cx="1030" cy="75" r="3" fill="#d5c6ae" opacity=".3"/></g>`:`<circle cx="1038" cy="${time==='sunset'?127:64}" r="${time==='sunset'?39:27}" fill="${time==='sunset'?'#ffdcad':'#fff0be'}" opacity=".95" shape-rendering="geometricPrecision"/>`}</g>`;
}

export function renderTown(time: DayPeriod){
 const state={time,townLevel:1};
 const id='town-'+(++sceneSerial),night=time==='night',P=PIXEL;
 const skies={morning:P.sky[0],day:P.blue[0],sunset:P.rose[0],night:P.sky[2]};
 const sky=skies[time],wall=night?'#51435b':P.stone[0],window=night||time==='sunset'?'#ffd08a':P.blue[0],outline=P.ink;
 let s='';const r=(x:number,y:number,w:number,h:number,c:string)=>s+=c===window?rect(x,y,w,h,c).replace('<rect ','<rect class="window-light" '):rect(x,y,w,h,c);const p=(points:string,c:string)=>s+=`<polygon points="${points}" fill="${c}"/>`;
 s+=sceneAtmosphere(id,time);s+=`<defs><pattern id="${id}-waves" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 24a24 24 0 0 1 48 0M8 24a16 16 0 0 1 32 0M16 24a8 8 0 0 1 16 0" stroke="#fffaf1" fill="none" stroke-width="1"/></pattern></defs><rect x="20" y="12" width="400" height="100" fill="url(#${id}-waves)" opacity=".045"/>`;
 s+='<g class="cloud-bank">';
 for(const [x,y] of [[47,50],[392,32],[735,72]]){r(x,y,95,12,night?P.sky[1]:P.white);r(x+16,y-10,53,12,night?P.sky[1]:P.white);r(x-13,y+8,118,9,night?P.sky[1]:P.white)}
 s+='</g><g class="parallax-layer" data-layer="mountains" data-depth="0.025">';
 // Layer 1: stepped mountain profiles, with a separate line of foothills.
 p('0,188 0,140 60,140 60,123 105,123 105,99 140,99 140,76 168,76 168,55 197,55 197,75 223,75 223,98 259,98 259,120 299,120 299,143 350,143 350,162 420,162 420,122 464,122 464,94 500,94 500,71 531,71 531,53 551,53 551,72 580,72 580,99 608,99 608,125 655,125 655,151 722,151 722,188',night?P.sky[1]:time==='sunset'?P.violet[1]:P.sky[1]);
 p('635,191 635,160 704,160 704,138 746,138 746,115 781,115 781,94 814,94 814,113 848,113 848,139 890,139 890,158 954,158 954,141 996,141 996,119 1032,119 1032,96 1062,96 1062,75 1092,75 1092,97 1132,97 1132,124 1175,124 1175,147 1220,147 1220,164 1280,164 1280,215',night?P.teal[2]:P.teal[1]);
 p('115,101 140,101 140,76 168,76 168,57 194,57 194,77 220,77 220,99 198,99 198,89 179,89 179,105 157,105 157,95 139,95 139,110',night?P.sky[0]:P.stone[0]);
 s+='</g>';if(time==='morning')s+=`<rect x="0" y="100" width="1280" height="175" fill="url(#${id}-mist)"/>`;s+='<g class="parallax-layer" data-layer="houses" data-depth="0.05">';
 // Layer 2: distant roofline and hillside trees.
 r(0,180,1280,90,night?P.leaf[2]:P.leaf[1]);
 for(let i=0;i<14;i++){const x=i*99-18,y=164+(i%3)*9;r(x,y+16,65,47,night?P.sky[1]:P.stone[1]);p(`${x-5},${y+17} ${x+15},${y} ${x+49},${y} ${x+70},${y+17}`,night?P.sky[2]:P.coral[2]);r(x+12,y+25,11,13,window);r(x+39,y+25,11,13,window)}
 function tree(x:number,y:number,scale=1){let t='';const rr=(a:number,b:number,w:number,h:number,c:string)=>t+=rect(a,b,w,h,c);rr(22,35,8,37,P.orange[2]);rr(12,16,30,40,outline);rr(4,25,47,22,outline);rr(18,8,18,51,outline);rr(12,20,30,29,night?P.leaf[2]:P.leaf[1]);rr(8,28,39,14,night?P.leaf[1]:P.leaf[0]);rr(18,12,18,32,night?P.leaf[1]:P.leaf[0]);rr(27,38,15,12,P.leaf[2]);s+=`<g transform="translate(${x} ${y}) scale(${scale})">${t}</g>`}
 [[0,170,1.1],[465,160,.9],[789,156,.95],[1192,153,1],[847,184,.85]].forEach(a=>tree(a[0],a[1],a[2]));
 s+='</g><g class="parallax-layer" data-layer="road" data-depth="0.08">';
 // Layer 3: distinct street architecture and its foreground.
 r(0,280,1280,200,night?P.stone[2]:P.stone[1]);r(0,335,1280,78,night?P.sky[1]:P.orange[0]);r(0,339,1280,4,night?P.sky[0]:P.stone[0]);r(0,409,1280,5,P.orange[2]);r(0,414,1280,66,night?P.leaf[2]:P.leaf[0]);
 for(let x=0;x<1280;x+=43)r(x,377,18,3,night?P.sky[0]:P.stone[0]);
 if(time==='sunset')s+='<g class="long-shadows" fill="#613650" opacity=".24"><path d="M51 328H265L366 402H152Z M303 328H452L553 402H404Z M1050 328H1221L1280 395H1146Z"/></g>';s+='</g><g class="parallax-layer" data-layer="houses" data-depth="0.05">';
 // Shopping arcade: broad stepped glass arch, two rows of stalls.
 r(51,236,215,91,outline);r(56,240,205,85,wall);p('40,239 40,222 53,222 53,209 69,209 69,198 88,198 88,189 227,189 227,198 246,198 246,210 264,210 264,225 277,225 277,240',outline);
 p('46,233 46,225 59,225 59,213 74,213 74,204 94,204 94,195 222,195 222,204 241,204 241,216 258,216 258,229 271,229 271,234',P.blue[1]);r(76,211,166,20,P.blue[0]);for(let x=86;x<248;x+=30)r(x,206,4,27,outline);
 for(const x of [65,129,193]){r(x,256,57,57,outline);r(x+3,259,51,51,window);r(x+3,282,51,4,P.orange[2]);r(x+20,286,3,24,outline);r(x-3,244,63,13,P.coral[1]);for(let a=x;a<x+60;a+=15)r(a,244,7,13,P.stone[0])}s+=`<rect x="56" y="202" width="204" height="29" fill="${night?'#292b46':'#e9f3fa'}"/><text x="158" y="224" text-anchor="middle" font-size="30" font-family="Shippori Mincho" fill="${outline}">商店街</text>`;
 // Restaurant: a deep roof, noren curtain and a kitchen chimney.
 r(303,224,149,104,outline);r(307,228,141,96,wall);p('290,229 300,207 317,207 317,191 436,191 436,207 452,207 464,229',outline);p('299,223 309,212 323,212 323,197 430,197 430,212 447,212 455,223',P.coral[1]);r(331,188,20,15,P.orange[2]);r(407,165,17,38,outline);r(410,168,11,29,P.stone[1]);
 s+=`<g class="kitchen-smoke">${rect(408,151,12,8,P.stone[0])}${rect(400,137,17,8,P.stone[0])}${rect(405,122,12,7,P.stone[0])}</g>`;
 r(315,257,61,62,outline);r(320,263,51,52,window);r(386,260,50,30,outline);r(390,264,42,22,window);r(313,250,68,27,P.teal[2]);r(334,250,3,27,wall);r(357,250,3,27,wall);s+=`<text x="347" y="266" font-size="12" fill="${P.white}" text-anchor="middle" font-family="Shippori Mincho">ごはん</text>`;
 s+=`<rect x="378" y="227" width="61" height="29" fill="${night?'#292b46':'#f5fbff'}"/><text x="408" y="250" font-size="28" text-anchor="middle" font-family="Shippori Mincho" fill="${outline}">食堂</text>`;
 // Station: tall clock tower, platform canopy, rails and a moving train.
 r(511,220,273,105,outline);r(515,225,265,94,wall);r(537,177,55,58,outline);r(542,182,45,48,P.gold[0]);r(549,190,29,29,outline);r(553,194,21,21,P.white);r(562,197,3,10,outline);r(564,205,9,3,outline);r(499,231,298,9,outline);r(507,223,283,8,P.blue[2]);r(520,243,250,7,P.sky[1]);r(521,254,252,51,P.sky[2]);r(514,305,267,6,P.gold[1]);r(513,313,271,3,outline);r(513,324,271,3,outline);for(let x=520;x<780;x+=17)r(x,314,3,13,P.orange[2]);
 s+=`<defs><clipPath id="${id}"><rect x="524" y="255" width="243" height="48"/></clipPath></defs><g clip-path="url(#${id})"><g class="town-train">${rect(525,261,236,34,outline)}${rect(529,264,229,25,P.stone[0])}${rect(529,283,229,6,P.teal[1])}${Array.from({length:9},(_,i)=>rect(537+i*25,268,17,12,P.blue[0])).join('')}${rect(545,294,15,5,outline)}${rect(720,294,15,5,outline)}</g></g>`;
 s+=`<rect x="605" y="198" width="135" height="27" fill="${night?'#292b46':'#f5fbff'}"/><text x="673" y="220" font-size="20" text-anchor="middle" fill="${outline}" font-family="Shippori Mincho">みどり駅</text>`;
 // Shrine and steps: clearly separate from the school and station.
 for(let i=0;i<5;i++)r(873-i*8,315+i*5,120+i*16,6,i%2?P.stone[1]:P.stone[0]);r(901,245,67,70,outline);r(906,251,57,60,P.orange[0]);p('884,249 900,226 916,218 951,218 974,236 987,249',P.orange[2]);r(924,276,21,39,outline);r(856,225,11,89,P.coral[2]);r(989,225,11,89,P.coral[2]);r(843,216,171,11,outline);r(846,211,165,10,P.coral[1]);r(853,237,150,7,P.coral[1]);r(860,209,139,4,P.gold[0]);
 // School: clock above a symmetrical entrance, classroom windows and a flag-free yard.
 r(1050,214,171,113,outline);r(1054,219,163,104,wall);r(1042,208,187,9,P.blue[2]);r(1099,184,70,32,outline);r(1104,189,60,25,P.stone[0]);r(1125,191,17,18,outline);r(1128,194,11,12,P.white);r(1133,195,2,7,outline);r(1134,200,5,2,outline);
 for(const y of [230,267])for(let x=1064;x<1210;x+=34){r(x,y,23,25,outline);r(x+3,y+3,17,19,window);r(x+10,y+3,2,19,P.sky[1])}r(1119,292,34,31,outline);r(1123,296,26,27,window);r(1135,297,2,26,P.sky[1]);
 s+='</g><g class="parallax-layer" data-layer="road" data-depth="0.08">';
 // Foreground pitch: lines and two upright goals, with no club branding.
 r(905,424,332,51,outline);r(909,428,324,43,P.leaf[1]);r(916,432,310,2,P.stone[0]);r(916,465,310,2,P.stone[0]);r(916,432,2,35,P.stone[0]);r(1224,432,2,35,P.stone[0]);r(1070,432,2,35,P.stone[0]);r(1048,443,46,2,P.stone[0]);r(1048,455,46,2,P.stone[0]);r(1048,443,2,14,P.stone[0]);r(1092,443,2,14,P.stone[0]);for(const x of [909,1220]){r(x,432,13,2,P.stone[0]);r(x,432,2,25,P.stone[0]);r(x+11,432,2,25,P.stone[0]);r(x,457,13,2,P.stone[0])}
 // Utility poles and wires connect the near street, without crossing text labels.
 for(const x of [27,479,817,1254]){r(x,178,6,170,P.orange[2]);r(x-14,184,35,5,outline);r(x-8,175,3,11,P.stone[0]);r(x+11,175,3,11,P.stone[0])}
 s+=`<path d="M30 165Q250 184 482 165Q650 181 820 165Q1040 183 1257 165M30 170Q250 190 482 170Q650 187 820 170Q1040 190 1257 170" fill="none" stroke="${outline}" stroke-width="2"/>`;
 // Vending machines, bicycle, laundry, pots and a street cat.
 r(460,285,31,48,outline);r(463,288,25,42,P.coral[1]);r(467,292,17,19,P.stone[0]);for(let i=0;i<6;i++)r(469+(i%3)*5,294+Math.floor(i/3)*8,3,5,Object.values(PIXEL)[i][0]);r(468,319,15,6,outline);
 s+=`<g stroke="${outline}" stroke-width="3" fill="none"><path d="M277 317h14v16h-14zM308 317h14v16h-14zM284 325l10-19 21 19h-31l16-16M298 302h10M306 307l5-10h8"/></g>`;
 r(795,262,56,2,outline);r(798,264,2,41,outline);r(848,264,2,41,outline);r(805,264,13,21,P.blue[0]);r(823,264,19,18,P.rose[0]);r(808,263,3,3,P.orange[2]);r(833,263,3,3,P.orange[2]);
 for(const [x,y] of [[57,326],[268,328],[394,325],[1023,326],[1241,330]]){r(x,y,25,9,P.orange[2]);r(x+5,y-11,3,12,P.leaf[2]);r(x+16,y-14,3,15,P.leaf[2]);r(x+1,y-14,10,5,P.rose[1]);r(x+11,y-18,12,6,P.gold[0])}
 p('363,391 363,382 366,382 370,386 375,382 378,382 378,395 388,395 392,391 394,393 390,399 368,399 365,396',outline);r(366,388,9,7,P.gold[1]);r(377,396,9,2,P.gold[0]);
 // Lanterns and night window light use the same limited palette.
 for(const [x,y] of [[295,255],[445,251],[859,262],[999,262]]){r(x+5,y-6,2,11,outline);s+=`<g class="lantern-light">${rect(x,y,12,18,outline)}${rect(x+2,y+2,8,14,night?P.gold[0]:P.coral[1])}${rect(x+5,y+2,2,14,night?P.stone[0]:P.coral[0])}</g>`}
 // Two-frame walkers, small enough to keep the town calm.
 for(const [x,y,color] of [[180,353,P.violet[1]],[699,355,P.teal[2]],[1100,354,P.coral[2]]] as const)s+=`<g class="street-walker" transform="translate(${x} ${y})">${rect(6,0,10,6,outline)}${rect(6,5,10,8,P.orange[0])}${rect(3,13,16,14,color)}<g class="walk-leg-a">${rect(4,27,5,9,outline)}${rect(14,27,5,5,outline)}</g><g class="walk-leg-b">${rect(4,27,5,5,outline)}${rect(14,27,5,9,outline)}</g></g>`;
 [[4,385,1.1],[842,356,.8],[1243,344,.9]].forEach(a=>tree(a[0],a[1],a[2]));
 // Completing a region adds a new original building to the near side of town.
 if(state.townLevel>=2){r(435,429,99,46,outline);r(439,433,91,38,wall);r(428,423,114,9,P.coral[2]);r(447,440,23,22,window);r(501,440,23,22,window);r(480,447,13,25,outline);s+=`<text x="485" y="438" text-anchor="middle" fill="${outline}" font-size="8">本</text>`}
 if(state.townLevel>=3){r(579,433,109,39,outline);r(582,436,103,31,wall);r(579,451,109,7,P.teal[1]);for(let x=588;x<680;x+=21)r(x,440,15,9,window)}
 if(state.townLevel>=4){r(709,428,96,46,outline);r(714,433,86,38,wall);p('700,430 720,415 793,415 813,430',P.violet[2]);r(748,448,17,25,outline);r(722,440,15,16,window);r(775,440,15,16,window)}
 if(state.townLevel>=5){r(1150,112,55,65,wall);p('1140,115 1140,105 1150,105 1150,94 1160,94 1160,85 1195,85 1195,94 1205,94 1205,105 1215,105 1215,115',P.sky[2]);r(1173,69,8,25,outline);r(1165,66,30,8,P.blue[1]);r(1165,129,25,26,window)}
 s+=`<text x="934" y="240" font-family="Shippori Mincho" font-size="20" fill="${night?'#ffedc1':'#252834'}" text-anchor="middle">神社</text><text x="1137" y="225" font-family="Shippori Mincho" font-size="18" fill="${night?'#ffedc1':'#252834'}" text-anchor="middle">学校</text><text x="301" y="268" font-family="Shippori Mincho" font-size="10" text-anchor="middle" fill="#252834">食</text><text x="451" y="264" font-family="Shippori Mincho" font-size="10" text-anchor="middle" fill="#252834">堂</text>`;s+='</g>';
 return `<svg data-scene-time="${time}" class="scene town-depth" viewBox="0 0 1280 480" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Thị trấn ba lớp: núi xa, mái nhà giữa và phố gần. Phố mái vòm, quán ăn, ga tàu, đền, trường học và sân bóng. ${night?'Ban đêm, cửa sổ và đèn lồng sáng.':''}" shape-rendering="crispEdges">${s}</svg>`;
}
