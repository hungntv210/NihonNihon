import {dailyWeather,weatherLabels,type Weather} from './weather.js';
import {vietnamClock} from '../../core/day-period.ts';
export type SceneId='home-tokyo'|'review-koi'|'kanji-himeji'|'shadowing-inari'|'vocab-market'|'grammar-kinkakuji'|'jlpt-study'|'roadmap-journey'|'login-shoji';
export function sceneClock(now=new Date()){
 const clock=vietnamClock(now),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),month=Number(date.slice(5,7));
 const fixture=(globalThis as typeof globalThis & {__nihonUIFixture?:boolean}).__nihonUIFixture===true?process.env.NIHON_UI_WEATHER_FIXTURE:undefined;
 const weather=fixture&&Object.hasOwn(weatherLabels,fixture)?fixture as Weather:dailyWeather(date,clock.period);
 return {...clock,date,weather,season:month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter'};
}
export function shadowProgress(status:{awarded:boolean;practiceMs:number;clips:Record<string,{recorded:number;total:number}>}|null){
 if(!status)return 0;if(status.awarded)return 1;
 const recordings=Math.max(0,...Object.values(status.clips).map(c=>c.total>0?c.recorded/c.total:0));
 return Math.max(0,Math.min(1,status.practiceMs/900000,recordings));
}

export function remainingDue(initial:{due:number;cards:{cardId:string}[]},seen:string[]){return Math.max(0,initial.due-initial.cards.filter(c=>seen.includes(c.cardId)).length);}
