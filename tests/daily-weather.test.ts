import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {dailyWeather,weatherLabels,weatherWeights,weightsFor} from '../src/components/pixel-scenes/weather.js';
import {eventFor,catalog} from '../src/components/pixel-scenes/festivals.js';
import {sceneClock} from '../src/components/pixel-scenes/model.ts';
import {weatherProfile,weatherPalette,weatherFrame} from '../src/components/pixel-scenes/weather-paint.js';

test('30 years follow monthly/tsuyu weights, winter-only snow, morning fog and no four extreme days',()=>{
 const keys=Object.keys(weatherLabels),buckets=Array.from({length:12},()=>({n:0,actual:Array(7).fill(0),expected:Array(7).fill(0)}));let streak=0;
 for(let day=Date.UTC(2000,0,1);day<Date.UTC(2030,0,1);day+=86400000){
  const date=new Date(day).toISOString().slice(0,10),month=Number(date.slice(5,7)),w=dailyWeather(date,'morning'),b=buckets[month-1];b.n++;b.actual[keys.indexOf(w)]++;
  const weights=[...weightsFor(date)];if(catalog.some(e=>eventFor(e.scene,date))){weights[0]+=weights[3];weights[3]=0;}weights.forEach((p,i)=>b.expected[i]+=p/100);
  assert.equal(dailyWeather(date,'morning'),w);if(w==='snow')assert.ok([12,1,2].includes(month));if(w==='fog'){assert.equal(dailyWeather(date,'day'),'cloudy');assert.equal(dailyWeather(date,'night'),'cloudy');}
  streak=['rain','snow'].includes(w)?streak+1:0;assert.ok(streak<=3,date);
 }
 for(const b of buckets)for(let i=0;i<7;i++)assert.ok(Math.abs(b.actual[i]-b.expected[i])/b.n<Math.max(.025,4*Math.sqrt((b.expected[i]/b.n)*(1-b.expected[i]/b.n)/b.n)+.005),JSON.stringify({i,...b}));
 const totals=keys.map((_,i)=>buckets.reduce((n,b)=>n+b.actual[i],0));assert.equal(totals.indexOf(Math.max(...totals)),0);for(const row of weatherWeights)assert.equal(row.reduce((a,b)=>a+b),100);
 assert.ok(weightsFor('2026-06-20')[2]>weightsFor('2026-05-20')[2]);
});
test('Vietnam date drives server weather, fixture env alone cannot override production, festival respite is global',()=>{
 const before=process.env.NIHON_UI_WEATHER_FIXTURE;try{process.env.NIHON_UI_WEATHER_FIXTURE='rain';const clock=sceneClock(new Date('2026-11-16T18:00:00Z'));assert.equal(clock.date,'2026-11-17');assert.equal(clock.weather,dailyWeather(clock.date,clock.period));}finally{if(before===undefined)delete process.env.NIHON_UI_WEATHER_FIXTURE;else process.env.NIHON_UI_WEATHER_FIXTURE=before;}
 for(let year=2000;year<2030;year++)for(const md of ['01-02','04-01','07-07','08-01'])assert.notEqual(dailyWeather(`${year}-${md}`,'night'),'rain');
});
test('room weather exposure stays outside floor/form and clear palette is byte-identical',()=>{
 const p=weatherProfile('login-shoji',{weatherClip:[103,84,176,70]});assert.deepEqual(p.areas,[[103,84,176,70]]);assert.ok(p.water.every((v:number[])=>v[1]<154));assert.equal(p.indoor,true);
 const colors=['#80b5c4','#f1dba5'];assert.deepEqual(weatherPalette(colors,{time:'day',weather:'clear'},false),colors);assert.deepEqual(weatherPalette(colors,{time:'day',weather:'rain'},true),colors);assert.notDeepEqual(weatherPalette(colors,{time:'day',weather:'rain'},false),colors);
 const engine=fs.readFileSync('src/components/pixel-scenes/engine.js','utf8');assert.doesNotMatch(engine,/\['rain','fog','wind','clear'\]/);assert.match(engine,/if\(!Object.hasOwn\(weatherLabels,this.state.weather\)\)/);assert.doesNotMatch(engine,/location.search/);
});
test('still weather is time-independent and particle count stays bounded in every state',()=>{
 for(const weather of Object.keys(weatherLabels)){
  let commands:any[]=[];const noop=()=>{},ctx:any={save:noop,restore:noop,beginPath:noop,rect:noop,clip:noop};const engine:any={id:'login-shoji',state:{weather,date:'2026-01-16',season:'winter',time:'night',seconds:10},scene:{weatherClip:[103,84,176,70]},api:{hash:()=>3,random:()=>()=>.3,draw:new Proxy({},{get:(_o,k)=>(_c:any,...args:any[])=>commands.push([k,...args])})},dynamics:[null,null,null,{getContext:()=>ctx}],actor:(_n:any,b:any,paint:Function)=>paint(ctx,b.x,b.y)};
  weatherFrame(engine,true);const first=JSON.stringify(commands);commands=[];engine.state.seconds=100;weatherFrame(engine,true);assert.equal(JSON.stringify(commands),first,weather);assert.ok(engine.weatherParticles<=36||weather==='clear');
 }
});
