import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vietnamClock } from '../src/core/day-period.ts';
import { renderTown } from '../src/components/town/art.ts';
test('Vietnam periods use server instants and exact local boundaries',()=>{
 for(const [iso,period,time]of [['2026-11-14T21:59:00Z','night','04:59'],['2026-11-14T22:00:00Z','morning','05:00'],['2026-11-15T03:59:00Z','morning','10:59'],['2026-11-15T04:00:00Z','day','11:00'],['2026-11-15T10:00:00Z','sunset','17:00'],['2026-11-15T12:00:00Z','night','19:00']])assert.deepEqual(vietnamClock(new Date(iso)),{period,time,now:new Date(iso).toISOString()});
});
test('Japanese is confined to original scenery and no mockup learner data is ported',()=>{
 const scene=renderTown('night');
 for(const text of ['商店街','食堂','みどり駅','神社','学校','ごはん'])assert.ok(scene.includes(text));
 assert.doesNotMatch(scene,/PHỐ MUA SẮM|Tiệm|\bXP\b/);
 assert.ok(scene.includes('M30 165Q250 184'));
 const nav=fs.readFileSync('src/components/nav.tsx','utf8');assert.doesNotMatch(nav,/[ぁ-龯]/);
});
test('four full color ramps meet text contrast, including yellow and orange fill controls',()=>{
 const css=fs.readFileSync('src/styles/tokens.css','utf8');
 const luminance=(color:string)=>color.slice(1).match(/../g)!.map(s=>parseInt(s,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
 for(const period of ['morning','day','sunset','night']){
 const block=css.split(`html[data-time=${period}]{`)[1].split('}')[0];const tokens=Object.fromEntries([...block.matchAll(/--theme-([a-z-]+):(#[a-f0-9]{6})/g)].map(m=>[m[1],m[2]]));
 for(const [fg,bg]of [['ink','surface'],['muted','surface'],['ink','raised'],['muted','raised'],['link','surface'],['link','selected'],['accent-ink','accent'],['error','surface']]){const [a,b]=[luminance(tokens[fg]),luminance(tokens[bg])].sort((x,y)=>y-x);assert.ok((a+.05)/(b+.05)>=4.5,`${period}: ${fg}/${bg}`)}
 }
});
