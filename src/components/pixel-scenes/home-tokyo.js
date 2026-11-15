import {SceneEngine} from './engine.js';
export default {crop:0.55,id:'home-tokyo',title:'Tokyo · Cảnh chuẩn',description:'Bản adapter của cảnh sân ga đã duyệt; file pilot gốc không thay đổi.',seasonSwatches:false,params:{},create(api){const W=384,H=216;const state=api.state,P=api.palette;let seed=8712;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const{rect,line,polygon,dither,ellipse,lettering,BAYER}=api.draw;const windows=(c,x,y,cols,rows,step=6)=>api.draw.windows(c,x,y,cols,rows,step,rand);const region=(i,x,y,w,h,paint)=>api.actor(i,{x,y,w,h},paint);function sky(c){
 const bands=state.time==='sunset'?[0,1,3,2,12]:state.time==='night'?[0,0,1,3,4]:[0,0,3,1,2];
 for(let i=0;i<bands.length;i++){const y=i*15;rect(c,0,y,W,18,bands[i]);if(i&&bands[i]!==bands[i-1])for(let yy=0;yy<8;yy++)for(let x=0;x<W;x++)if(BAYER[(y+yy)&3][x&3]<(8-yy)*2)rect(c,x,y+yy,1,1,bands[i-1]);}
 rect(c,0,75,W,75,bands[4]);
 if(state.time==='night'){ellipse(c,251,29,11,11,1);ellipse(c,251,29,8,8,13);ellipse(c,251,29,6,6,39);ellipse(c,248,27,2,2,13);rect(c,254,33,2,1,13);for(let i=0;i<65;i++){const x=Math.floor(rand()*W),y=15+Math.floor(rand()*63);rect(c,x,y,1,1,i%6?15:39)}}
 else{const x=state.time==='sunset'?234:258,y=state.time==='sunset'?66:33;ellipse(c,x,y,12,12,14);ellipse(c,x,y,10,10,state.time==='sunset'?36:39)}
 for(let i=0;i<7;i++){let x=rand()*W,y=18+rand()*42,w=14+rand()*40;rect(c,x,y,w,1,state.time==='night'?3:1);rect(c,x+6,y-1,w*.5,1,state.time==='night'?3:1)}
 polygon(c,[[113,95],[135,86],[153,65],[171,49],[182,51],[199,69],[226,92],[247,98]],4);
 polygon(c,[[150,68],[171,49],[182,51],[197,68],[186,64],[180,69],[172,65],[164,70]],state.time==='night'?5:1);
 for(let y=81;y<97;y++)for(let x=133-(y-80);x<219+(y-80);x++)if((x*3+y)%7===0)rect(c,x,y,1,1,3);
 polygon(c,[[0,96],[32,83],[59,95],[91,86],[126,99],[178,92],[225,100],[280,86],[315,94],[355,82],[384,95],[384,120],[0,120]],5);
 if(state.time==='morning')dither(c,0,91,W,12,3,1,1);
}
function city(c){
 seed=7432;for(let i=0;i<37;i++){const x=i*11-4,h=7+Math.floor(rand()*32),y=111-h;rect(c,x,y,8+rand()*8,h,6);rect(c,x,y,9,1,5);if(i%3===0){rect(c,x+3,y-4,2,4,6);line(c,x+4,y-5,x+4,y-9,6)}for(let k=0;k<3;k++)for(let r=0;r<h/5;r++)if(rand()>.5)rect(c,x+2+k*3,y+3+r*5,1,2,state.time==='night'&&rand()>.7?36:5)}
 line(c,297,70,290,105,5);line(c,297,70,305,105,5);line(c,293,88,301,88,5);line(c,292,96,303,96,5);rect(c,296,65,2,8,5);
 for(let i=0;i<7;i++){const x=i*63-9,y=103+(i%3)*5,w=47;rect(c,x,y,w,34,9);rect(c,x+2,y+2,w-4,31,10);rect(c,x+4,y-3,12,3,17);windows(c,x+5,y+7,6,3);line(c,x+35,y,x+35,y+32,16)}
}
function houses(c){
 rect(c,0,135,W,20,18);rect(c,0,138,W,13,17);line(c,0,144,384,144,11);for(let x=0;x<W;x+=30)rect(c,x,145,10,1,12);
 seed=3542;
 for(let i=0;i<9;i++){const x=i*46-9,y=116+(i%3)*6,w=41,h=22;rect(c,x,y,w,h,23);rect(c,x+2,y+2,w-4,h-2,i%2?11:15);polygon(c,[[x-4,y+1],[x+5,y-10],[x+w-7,y-10],[x+w+4,y+1]],20);line(c,x-3,y,x+w+3,y,7);for(let r=0;r<4;r++)line(c,x+4-r*2,y-8+r*2,x+w-6+r*2,y-8+r*2,19);for(let xx=x+9;xx<x+w-4;xx+=8)line(c,xx,y-8,xx+5,y,7);rect(c,x+5,y-13,7,4,16);line(c,x+5,y-13,x+12,y-13,12);windows(c,x+6,y+5,4,2,8);rect(c,x+w-8,y+3,5,7,18);rect(c,x+w-7,y+4,3,1,10);rect(c,x+w-7,y+6,3,1,10);}
 // Shop noren, signs and a bicycle stand in the street below.
 rect(c,119,133,33,10,22);rect(c,119,131,33,3,30);for(let x=120;x<152;x+=5){rect(c,x,134,4,4,29);rect(c,x,137,4,1,31)}
 // A continuous flat roof supports the cat; the shop sign is bolted to its wall.
 rect(c,139,112,74,28,23);rect(c,141,113,70,26,25);rect(c,137,110,78,3,20);rect(c,137,110,78,1,12);
 for(let y=115;y<139;y+=4){line(c,142,y,210,y,24);for(let x=143+(y%8);x<210;x+=12)line(c,x,y,x,y+3,23)}
 windows(c,145,117,3,2,7);rect(c,174,121,32,17,20);rect(c,176,122,28,15,13);lettering(c,'食堂',178,124);
 rect(c,91,134,6,11,18);rect(c,92,135,4,5,15);
 // Planks, balconies, pots and air conditioner grilles create inhabited facades.
 for(const x of [47,94,231,326]){for(let y=128;y<141;y+=3)line(c,x,y,x+20,y,16);rect(c,x,135,24,2,20);for(let xx=x;xx<x+24;xx+=4)rect(c,xx,129,1,7,20);rect(c,x+13,123,10,6,15);for(let yy=124;yy<129;yy+=2)line(c,x+14,yy,x+21,yy,7);rect(c,x+3,138,5,4,29);ellipse(c,x+5,136,4,3,18);rect(c,x+4,134,2,2,10)}
 if(state.season==='winter'){for(let i=0;i<9;i++){const x=i*46-9,y=116+(i%3)*6;for(let r=0;r<3;r++)line(c,x+5-r*3,y-11+r,x+34+r*3,y-11+r,39);rect(c,x+6,y-14,7,2,39)}rect(c,137,108,78,2,39);rect(c,139,110,9,1,13);rect(c,186,110,14,1,13)}
 line(c,23,130,57,130,20);line(c,28,125,28,135,20);line(c,51,125,51,135,20);for(let i=0;i<5;i++){rect(c,29+i*4,130,2,5,12);rect(c,29+i*4,135,3,1,12)}
}
function tracks(c){
 rect(c,0,152,W,28,21);rect(c,0,153,W,1,16);rect(c,0,160,W,2,15);rect(c,0,162,W,1,7);rect(c,0,174,W,2,10);rect(c,0,176,W,1,20);
 for(let x=-2;x<W;x+=7){rect(c,x,155,3,5,23);rect(c,x,166,3,7,23);rect(c,x+1,156,1,2,38);rect(c,x+1,169,1,2,38)}for(let i=0;i<380;i++){const x=Math.floor(rand()*W),y=154+Math.floor(rand()*24);rect(c,x,y,1,1,[22,23,19,7][i%4])}
 for(let x=0;x<384;x+=19){line(c,x,160,x+15,160,16);line(c,x,173,x+15,173,16)}
}
function tree(c){
 // Power cables stay above the shop signs, each sag is plotted on the pixel grid.
 for(const x of [72,277,359]){rect(c,x,51,3,102,20);rect(c,x-7,57,18,2,20);rect(c,x-5,61,15,1,7);for(const k of [-4,1,6])rect(c,x+k,54,2,4,15);rect(c,x+3,88,4,13,17);rect(c,x+4,89,2,11,10)}
 for(let j=0;j<3;j++)for(let x=0;x<W;x++){const part=x<72?[0,72]:x<277?[72,277]:[277,384],u=(x-part[0])/(part[1]-part[0]);rect(c,x,53+j*5+4*u*(1-u)*9,1,1,20)}
 rect(c,315,107,6,69,22);polygon(c,[[315,132],[290,103],[270,96],[268,92],[291,97],[319,123],[345,91],[350,92],[322,137],[321,177],[314,177]],23);
 line(c,318,128,303,80,24);line(c,318,138,348,113,24);line(c,298,110,253,101,24);line(c,329,119,362,88,24);
 seed=979;const winter=state.season==='winter',summer=state.season==='summer',autumn=state.season==='autumn';
 if(!winter)for(let i=0;i<115;i++){const x=266+rand()*104,y=77+rand()*43;if(((x-319)/56)**2+((y-96)/24)**2>1)continue;const r=4+Math.floor(rand()*5),colors=summer?[18,9,10,11]:autumn?[31,30,29,37]:[31,30,26,27];ellipse(c,x,y,r,Math.max(1,r*.65|0),colors[0]);ellipse(c,x-1,y-1,r-1,Math.max(1,r*.45|0),colors[1]);ellipse(c,x-2,y-2,Math.max(1,r-3),2,colors[2]);rect(c,x-2,y-3,3,1,summer?11:autumn?36:28);if(i%3===0){rect(c,x+1,y,1,1,colors[3]);rect(c,x+3,y+1,1,1,summer?10:28)}}
 if(winter){for(const [a,b,d,e]of [[256,100,292,104],[287,98,315,123],[304,81,317,120],[330,118,355,92],[321,136,348,113]]){line(c,a,b,d,e,24);line(c,a,b-2,d,e-2,13);line(c,a,b-3,d,e-3,39);line(c,a,b-4,d,e-4,39)}rect(c,315,106,4,4,39)}
}
function foreground(c){
 // Platform lip, pale tactile tiles and a deep canopy frame the distant view.
 rect(c,0,179,W,37,22);rect(c,0,180,W,2,7);rect(c,0,182,W,4,12);rect(c,0,186,W,30,23);dither(c,0,199,W,17,23,22,1);
 for(let x=0;x<W;x+=8){rect(c,x,183,5,1,37);rect(c,x+2,185,2,1,38)}for(let x=0;x<W;x+=24){line(c,x,188,x+8,216,24)}line(c,0,202,384,202,24);
 rect(c,0,169,W,2,20);rect(c,0,168,W,1,12);for(let x=8;x<W;x+=28){rect(c,x,170,2,19,20);rect(c,x+1,170,1,16,7);rect(c,x-2,188,6,2,22)}
 // Painted station board, with two-color rasterised Japanese lettering.
 rect(c,120,170,105,34,20);rect(c,122,171,101,31,13);rect(c,122,199,101,3,18);rect(c,124,172,97,25,39);lettering(c,'さくら',154,180);rect(c,124,200,5,1,39);rect(c,217,200,4,1,39);rect(c,128,204,2,4,20);rect(c,215,204,2,4,20);
 // Illuminated vending machine: inset drinks, coils, coin slot, lower hatch.
 const x=247,y=157;rect(c,x-1,y+1,30,51,21);rect(c,x,y,27,50,30);rect(c,x+1,y+1,24,46,29);rect(c,x+2,y+2,22,4,13);rect(c,x+9,y+2,8,1,30);rect(c,x+2,y+8,17,27,20);rect(c,x+3,y+9,15,24,35);
 for(let row=0;row<3;row++){rect(c,x+3,y+16+row*8,15,1,37);for(let col=0;col<4;col++){const xx=x+4+col*3,yy=y+11+row*8;rect(c,xx,yy,2,4,[33,30,12,32][col]);rect(c,xx,yy,1,1,39);rect(c,xx,yy+5,2,1,14)}}
 rect(c,x+20,y+10,3,6,20);rect(c,x+21,y+12,1,1,35);rect(c,x+20,y+18,3,3,37);rect(c,x+20,y+23,3,1,21);rect(c,x+4,y+37,13,6,21);rect(c,x+5,y+38,11,1,37);rect(c,x+20,y+36,3,7,13);rect(c,x+3,y+47,5,3,21);rect(c,x+20,y+47,5,3,21);
 if(state.time==='night'){for(let i=0;i<6;i++)rect(c,246-i,207+i,30+2*i,1,i%2?23:38);rect(c,x+3,y+8,15,1,39)}
 // Bench, ticket gate edge and platform canopy architecture.
 rect(c,55,196,35,3,25);rect(c,57,191,31,4,25);for(let xx=59;xx<86;xx+=6)rect(c,xx,191,1,4,22);rect(c,59,199,2,6,20);rect(c,85,199,2,6,20);rect(c,293,197,9,11,18);rect(c,292,195,11,2,15);rect(c,295,198,4,2,21);
 rect(c,0,0,W,8,21);rect(c,0,8,W,2,19);rect(c,0,11,W,1,7);polygon(c,[[0,9],[24,9],[49,48],[43,48]],20);polygon(c,[[384,9],[365,9],[340,45],[345,45]],20);rect(c,40,10,5,206,21);rect(c,42,11,2,205,19);rect(c,339,10,7,206,21);rect(c,339,11,2,205,7);rect(c,31,11,25,4,20);rect(c,331,11,23,4,20);
 for(let xx=0;xx<W;xx+=24){rect(c,xx,0,2,8,22);rect(c,xx+3,7,17,1,7)}rect(c,112,10,1,9,20);rect(c,204,10,1,9,20);rect(c,108,19,100,21,20);rect(c,110,20,96,17,13);lettering(c,'東京',145,23);rect(c,110,37,96,2,18);
 rect(c,52,12,34,3,35);rect(c,53,15,32,1,36);rect(c,285,12,34,3,35);rect(c,286,15,32,1,36);
 if(state.season==='winter'){for(let x=2;x<W;x+=28){rect(c,x,166,18,2,13);rect(c,x+2,165,13,1,39)}rect(c,247,154,27,3,39);rect(c,55,188,35,3,39);for(let x=0;x<W;x+=38){rect(c,x,0,31,3,39);rect(c,x+2,3,25,1,13)}}
}
// Sprite frames are explicit arrays of colour indices. -1 is transparent.
const parseSprite=rows=>rows.map(r=>Array.from(r,ch=>ch==='.'?-1:parseInt(ch,36)));
const catBase=['..k.....k.......','..kk...kk.......','..kpppppk.......','..kpppppkk......','..kpgppgpk......','...ppcppp.......','...kpppppppk....','...kppppppppk...','...kppppppppkk..','....pp...pp..kk.','....kk...kk...k.'];
const cats=Array.from({length:8},(_,f)=>{const rows=catBase.map(r=>r.split(''));if(f<4){rows[9]=Array.from(f%2?'...pp.....pp....':'....pp...pp.....');rows[10]=Array.from(f%2?'...kk.....kk....':'....kk...kk.....')}else{rows[5]=Array.from('...ppcpppp......');rows[8]=Array.from(f%2?'...kppppppppkk..':'...kpppppkppkk..');rows[9]=Array.from('....pp.pppp.....')}return rows.map(r=>r.map(ch=>ch==='.'?-1:parseInt(ch,36)))});
const birds=Array.from({length:6},(_,f)=>parseSprite(f===0?['...kk....','..kffk...','..f3fk...','.kffff...','kfffffk..','..kffk...','..k..k...']:f===1?['.........','...kk....','..kffk...','.kff3fk..','kfffffk..','..kffk...','..k..k...']:f===2?['.........','.........','..kk.....','.kffffk..','kffff3fk.','..kffk...','..k..k...']:f===3?['...kk....','..kffk...','..kf3f...','.kffff...','kfffffk..','..kffk...','..k..k...']:f===4?['f.....f..','.f...f...','..fkf....','..ffff...','...kk....','.........','.........']:['.........','...fkf...','.ffffff..','f..kk..f.','.........','.........','.........']));
const riders=Array.from({length:8},(_,f)=>{const rows=['......dd........','.....dedd.......','......ee........','......t.........','.....tttk.......','....ktt..k......','...k.t....k.....','..kk..t..kk.....','..k..k.k..k.....','.k...k.k...k....','.k...k.k...k....','..kkk...kkk.....'];const pose=f%4;rows[7]=['..kk..t..kk.....','..kk.t...kk.....','..kk..tt.kk.....','..kkt....kk.....'][pose];rows[8]=['..k..k.k..k.....','..k.k...k.k.....','..k...kk..k.....','..k..kk...k.....'][pose];if(f>=4){rows[0]='.......dd.......';rows[1]='......dedd......';rows[2]='.......ee.......'}return parseSprite(rows)});
function sprite(c,frames,f,x,y){const data=frames[f%frames.length];for(let yy=0;yy<data.length;yy++)for(let xx=0;xx<data[yy].length;xx++)if(data[yy][xx]>=0)rect(c,x+xx,y+yy,1,1,data[yy][xx]);}
function train(c,x){
 for(let car=0;car<3;car++){const xx=Math.round(x)+car*81;rect(c,xx,150,77,2,20);rect(c,xx-1,152,79,19,21);rect(c,xx,152,77,17,15);rect(c,xx+1,153,75,1,39);rect(c,xx,164,77,3,34);rect(c,xx,167,77,2,18);rect(c,xx+3,170,15,3,21);rect(c,xx+58,170,15,3,21);rect(c,xx+6,171,3,2,24);rect(c,xx+66,171,3,2,24);
  for(let j=0;j<7;j++){const wx=xx+5+j*10;rect(c,wx,155,8,8,20);rect(c,wx+1,156,6,5,state.time==='night'||state.time==='sunset'?35:33);rect(c,wx+1,161,6,1,17);if(j%3===1){rect(c,wx+3,158,2,4,23);rect(c,wx+2,160,4,2,23)}if(j===2||j===5){rect(c,wx-1,154,1,14,17);rect(c,wx+8,154,1,14,17)}}
  for(const door of [21,51]){rect(c,xx+door,154,9,14,17);rect(c,xx+door+1,155,7,7,20);rect(c,xx+door+2,156,5,5,state.time==='night'?35:33);line(c,xx+door+4,154,xx+door+4,167,7);rect(c,xx+door+2,163,1,1,12);rect(c,xx+door+6,163,1,1,12)}
  for(let j=0;j<7;j++){const wx=xx+6+j*10;line(c,wx,156,wx+2,159,state.time==='night'?39:32);rect(c,wx+2,156,2,1,14)}
  rect(c,xx+2,154,1,14,17);rect(c,xx+74,154,1,14,17);rect(c,xx+77,159,3,6,20);if(car===0){rect(c,xx,156,2,2,39);rect(c,xx,161,2,2,36)}if(car===1){line(c,xx+25,149,xx+31,142,20);line(c,xx+31,142,xx+40,149,20);line(c,xx+23,141,xx+40,141,20)}}
}

function drawMoving(t,staticFrame=false){const cycle=t%20,trainHere=cycle>=4&&cycle<11.5;
 if(trainHere){const x=384-(cycle-4)/7.5*650;region(0,x,140,245,35,(c,xx)=>train(c,xx))}
 const episode=Math.floor(t/20),chance=(Math.sin(episode*91.7+8)*1257)%1;
 const catX=cycle<3?148+cycle*6:cycle<13?166:166+(cycle-13)*3;if(staticFrame||Math.abs(Math.sin(episode*12.31+3))>.12)region(1,catX,99,18,13,(c,x,y)=>sprite(c,cats,cycle<3||cycle>13?Math.floor(t*6)%4:4+Math.floor(t*4)%4,x,y));
 // Two sheltered pigeons remain in view, even while the other flock takes flight.
 for(const [j,x]of [230,278].entries())region(2,x,205,10,8,(c,xx,yy)=>{const f=staticFrame?j:Math.floor(t*3+j)%4;sprite(c,birds,f,xx,yy);rect(c,xx+6,yy+(f===2?4:2),2,1,36);rect(c,xx+2,yy+7,1,1,37);rect(c,xx+5,yy+7,1,1,37)});
 for(const [j,x]of [212,242].entries())region(2,x,44+j*5,10,8,(c,xx,yy)=>sprite(c,birds,4+(staticFrame?j:Math.floor(t*5+j)%2),xx,yy));
 if(staticFrame)region(1,110,135,17,13,(c,xx,yy)=>sprite(c,riders,2,xx,yy));
 // Birds peck first, take off as the train approaches, then stay out of the scene.
 const flock=2+(Math.abs(Math.sin(episode*43.7))>.4?1:0);
 if(cycle<4){for(let j=0;j<flock;j++)region(2,199+j*12,202+(j%2)*3,10,8,(c,x,y)=>sprite(c,birds,Math.floor(t*4+j)%4,x,y))}
 else if(cycle<5.9&&!staticFrame){for(let j=0;j<flock;j++)region(2,199+j*12+(cycle-4)*22,202-(cycle-4)*39-j*7,10,8,(c,x,y)=>sprite(c,birds,4+Math.floor(t*7)%2,x,y))}
 if(cycle>12&&cycle<17&&!staticFrame&&Math.abs(chance)>.25){const x=95+(cycle-12)*20;region(1,x,135,17,13,(c,xx,yy)=>sprite(c,riders,Math.floor(t*8),xx,yy))}
 {const count=state.season==='winter'?23:state.season==='summer'?6:11;for(let i=0;i<count;i++){const speed=state.season==='winter'?3:4.5,x=(210+i*17+Math.sin(t*.4+i)*14)%384,y=(i*23+t*speed)%(175-20)+20;if(state.season==='summer'&&state.time!=='night')continue;region(2,x,y,3,3,(c,xx,yy)=>{rect(c,xx,yy,state.season==='winter'?1:2,1,state.season==='summer'?35:state.season==='winter'?39:state.season==='autumn'?37:27);if(i%3===0)rect(c,xx+1,yy+1,1,1,state.season==='winter'?13:state.season==='autumn'?30:28)})}}
 // Stars blink in tiny dirty regions; the static sky is never repainted per tick.
 if(state.time==='night'&&!staticFrame)for(let i=0;i<9;i++)region(2,90+i*19,18+(i*17)%46,1,1,(c,x,y)=>rect(c,x,y,1,1,Math.sin(t+i*2)>.1?39:5));
}

return{layers:[sky,city,houses,tracks,tree,foreground].map((fn,i)=>c=>{seed=8712+i*117;fn(c)}),depths:[0,.5,1,1.5,2,0],dynamicDepths:[1.5,1,0,0],zIndices:[0,1,2,3,6,9],dynamicZIndices:[5,4,10,12],weatherClip:[45,12,294,160],frame(t,still){drawMoving(t,still);for(const[x,y]of[[166,99],[230,205],[278,205]])api.creature('home-animal',{x,y,w:10,h:8})}}}};