import {catalog,eventFor} from './festival-calendar.js';

export const weatherLabels={clear:'晴れ',cloudy:'曇り',drizzle:'小雨',rain:'大雨',snow:'雪',fog:'霧',wind:'風'};
// Percent weights: clear, cloudy, drizzle, heavy rain, snow, morning fog, wind.
export const weatherWeights=[
 [55,18,5,1,9,5,7],[50,18,7,1,8,6,10],[43,18,10,2,0,7,20],
 [40,20,12,3,0,5,20],[40,22,15,4,0,5,14],[32,23,24,10,0,4,7],
 [35,21,23,11,0,3,7],[58,16,9,4,0,3,10],[35,19,18,14,0,3,11],
 [43,21,12,5,0,7,12],[50,20,8,2,0,9,11],[56,17,5,1,7,6,8]];
export const tsuyuWeights=[24,22,32,13,0,3,6];
export const isWet=w=>w==='drizzle'||w==='rain';
export const overcast=w=>['cloudy','drizzle','rain','snow','fog'].includes(w);
export function weightsFor(date){const md=date.slice(5);return md>='06-15'&&md<='07-15'?tsuyuWeights:weatherWeights[Number(date.slice(5,7))-1]||weatherWeights[0];}
function sample(date){let h=2166136261;for(const c of date)h=Math.imul(h^c.charCodeAt(0),16777619);h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);let n=((h^(h>>>16))>>>0)/4294967296*100;return Object.keys(weatherLabels).find((_,i)=>(n-=weightsFor(date)[i])<0)||'clear';}
export function dailyWeather(date,period='morning'){
 let value=sample(date);
 if(['rain','snow'].includes(value)){
  const today=Date.parse(date+'T00:00:00Z');
  // A fourth consecutive extreme raw day is always a respite, independent of scene/reload.
  if([1,2,3].every(n=>['rain','snow'].includes(sample(new Date(today-n*86400000).toISOString().slice(0,10)))))value='clear';
 }
 // This is global for the date, so a festival's respite also reaches the other routes.
 if(value==='rain'&&catalog.some(e=>eventFor(e.scene,date)))value='clear';
 return value==='fog'&&period!=='morning'?'cloudy':value;
}
