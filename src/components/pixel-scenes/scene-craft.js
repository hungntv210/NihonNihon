import {overcast,isWet} from './weather.js';
import {SceneEngine} from './engine.js';
// Scene-level pixel motifs. The engine and its lifecycle remain unchanged.
export function SceneCraft(api){
 const {rect:r,line:l,ellipse:e,polygon:p}=api.draw,s=api.state;
 function sky(c){r(c,0,0,384,216,0);r(c,0,45,384,50,3);r(c,0,90,384,126,1);if(!overcast(s.weather)){if(s.time==='night'){e(c,287,29,11,11,1);e(c,287,29,7,7,39);for(let i=0;i<45;i++)r(c,(i*71)%384,6+(i*31)%76,1,1,i%4?15:39)}else e(c,286,28,12,12,14);}p(c,[[0,86],[35,67],[72,78],[116,52],[157,70],[201,59],[251,77],[308,60],[350,77],[384,66],[384,123],[0,123]],5)}
 function roof(c,x,y,w,h=10,snow=s.season==='winter'){
  p(c,[[x-7,y+h-2],[x-4,y+h+1],[x+w+4,y+h+1],[x+w+8,y+h-3],[x+w-2,y],[x+4,y]],21);p(c,[[x-3,y+h-1],[x+5,y+1],[x+w-3,y+1],[x+w+4,y+h-1]],7);
  for(let k=2;k<h;k+=2)l(c,x+4-k,y+k,x+w-3+k,y+k,18);for(let xx=x+7;xx<x+w-3;xx+=5)l(c,xx,y+1,xx+2,y+h-1,6);
  if(snow){p(c,[[x-5,y+h-4],[x+3,y-2],[x+w-1,y-2],[x+w+6,y+h-4],[x+w+2,y+h-3],[x+w-3,y],[x+5,y],[x-1,y+h-3]],39);l(c,x-3,y+h,x+w+4,y+h,13)}
 }
 function rock(c,x,y,w=9,h=5,snow=s.season==='winter'){
  p(c,[[x-w,y+1],[x-w*.7,y-h],[x+w*.3,y-h-1],[x+w,y],[x+w*.5,y+3],[x-w*.6,y+3]],20);p(c,[[x-w+2,y],[x-w*.6,y-h],[x+w*.2,y-h],[x+w-2,y-1],[x-2,y+1]],16);l(c,x-w+3,y-2,x-1,y-h,15);if(snow){p(c,[[x-w+2,y-2],[x-w*.6,y-h-2],[x+w*.2,y-h-2],[x+w-2,y-3],[x,y-2]],39);l(c,x-w+3,y-1,x+1,y-1,13)}
 }
 function pine(c,x,y,w=22,h=35){
  p(c,[[x-3,y],[x-1,y-h],[x+3,y-h],[x+2,y]],24);l(c,x,y-15,x-w*.6,y-h+7,24);l(c,x,y-21,x+w*.6,y-h+3,24);
  for(const [xx,yy,ww]of [[x-w*.6,y-h+5,w*.6],[x+w*.5,y-h,w*.65],[x-2,y-h-8,w*.7]]){e(c,xx,yy,ww,6,19);e(c,xx-2,yy-2,ww-2,4,18);e(c,xx-3,yy-3,ww-5,2,9);for(let i=0;i<8;i++)r(c,xx-ww+3+i*ww/4,yy-3+i%2,2,1,10);if(s.season==='winter'){p(c,[[xx-ww+2,yy-3],[xx-ww*.4,yy-6],[xx+ww*.3,yy-5],[xx+ww-2,yy-2],[xx+2,yy-1]],39);l(c,xx-ww*.5,yy,xx+ww*.5,yy,13)}}
 }
 function bird(c,x,y,f=0){api.sprite(c,SceneEngine.sprites.bird,f,x,y);r(c,x+6,y+2,2,1,36)}
 function person(c,x,y,f=0,tone=7){e(c,x+4,y+2,2,2,13);r(c,x+2,y+5,5,7,tone);r(c,x+1,y+6,1,5,13);r(c,x+7,y+6,1,5,13);l(c,x+3,y+12,x+2+f%2,y+16,21);l(c,x+5,y+12,x+6-f%2,y+16,21)}
 function fish(c,x,y,f=0,type=0){
  p(c,[[x+2,y+3],[x+5,y],[x+11,y+1],[x+15,y+3],[x+12,y+5],[x+5,y+6]],type===1?36:39);p(c,[[x+7,y+1],[x+9,y-2],[x+11,y+2]],type===1?30:13);p(c,[[x+7,y+5],[x+10,y+8],[x+11,y+4]],13);const n=[-2,-1,0,1,2,0][f%6];p(c,[[x+14,y+3],[x+20,y+n],[x+18,y+3+n],[x+20,y+6+n]],type===1?30:13);r(c,x+3,y+2,1,1,21);if(type===0){r(c,x+6,y+1,3,3,29);r(c,x+11,y+3,2,2,29)}
 }
 function crane(c,x,y,f=0,red=false){
  l(c,x+5,y+13,x+4,y+23,20);l(c,x+9,y+13,x+10,y+23,20);e(c,x+7,y+10,7,4,39);p(c,[[x+2,y+8],[x+10,y+9],[x+13,y+13],[x+7,y+13]],13);l(c,x+4,y+8,x+2,y+1,39);l(c,x+3,y+8,x+1,y+1,39);e(c,x+2,y,3,2,39);r(c,x+1,y-1,2,1,red?29:20);l(c,x-5,y+1,x,y+1,37);r(c,x+2,y,1,1,21);if(f%4>1)l(c,x+7,y+8,x+11,y+6,13);
 }
 return{sky,roof,rock,pine,bird,person,fish,crane};
}