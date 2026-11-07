import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { defaults, emptyProgress, todayPlan, lessonAccess, allocateRoadmap, localClock, type Shadow } from './model.ts';
import { readProgress, updateProgress, validateProgress, roadmapData } from './repository.ts';
fs.mkdirSync(path.resolve('.tmp'), {recursive:true});
const session = (date: string, kind: Shadow['kind'] = 'regular'): Shadow => ({date, kind, minutes:25, clips:kind === 'makeup' ? ['a','b'] : ['a'],method:'manual'});
test('local daytime/evening and Friday warning follow study timezone', () => {
 const p = emptyProgress();
 assert.equal(localClock(new Date('2026-11-06T12:29:00Z')).time,'19:29');
 assert.equal(todayPlan(p,defaults,new Date('2026-11-06T12:29:00Z'),0).evening,false);
 const evening=todayPlan(p,defaults,new Date('2026-11-06T12:30:00Z'),0);
 assert.equal(evening.evening,true);assert.equal(evening.urgent,true);
});
test('two distinct days clear next week lock; only valid current-week makeup unlocks', () => {
 const p=emptyProgress();
 assert.equal(lessonAccess(p,'2026-11-08',defaults.startDate).locked,false);
 assert.equal(lessonAccess(p,'2026-11-09',defaults.startDate).locked,true);
 p.shadow=[session('2026-11-03'),session('2026-11-05')];
 assert.equal(lessonAccess(p,'2026-11-09',defaults.startDate).locked,false);
 p.shadow=[session('2026-11-08','makeup')];assert.equal(lessonAccess(p,'2026-11-09',defaults.startDate).locked,true);
 p.shadow.push(session('2026-11-09','makeup'));assert.equal(lessonAccess(p,'2026-11-09',defaults.startDate).locked,false);
});
test('Sunday and recovery always retain review and never assign new lessons', () => {
 const p=emptyProgress();p.activity=['2026-11-03'];
 const sunday=todayPlan(p,defaults,new Date('2026-11-08T13:00:00Z'),70);
 assert.deepEqual(sunday.selected,['review','weekly']);
 const recovery=todayPlan(p,defaults,new Date('2026-11-06T13:00:00Z'),70);
 assert.deepEqual(recovery.selected,['review']);assert.equal(recovery.reduceNew,true);
 p.shortDays=['2026-11-05'];assert.deepEqual(todayPlan(p,defaults,new Date('2026-11-05T13:00:00Z'),0).selected,['review','new','grammar']);
});
test('roadmap distributes real catalog exactly once across 87 weeks in frequency order', () => {
 const items=Array.from({length:25},(_,n)=>({id:String(n),kind:'kanji' as const,level:'N5',title:String(n),frequency:25-n}));
 const weeks=allocateRoadmap(items,defaults.startDate);
 assert.equal(weeks.length,87);assert.equal(weeks[0].date,defaults.startDate);
 assert.deepEqual(weeks.flatMap(w=>w.items.map(i=>i.id)),items.toReversed().map(i=>i.id));
 assert.equal(weeks.filter(w=>w.level==='N2').length,30);
 assert.equal(allocateRoadmap([],defaults.startDate).flatMap(w=>w.items).length,0);
});
test('storage rejects invalid makeup/corruption and retains prior progress on failed update', () => {
 const dir=fs.mkdtempSync(path.join(path.resolve('.tmp'),'roadmap-')),file=path.join(dir,'progress.json');
 try {
 assert.deepEqual(readProgress(file),emptyProgress());
 updateProgress(file,p=>({...p,shadow:[session('2026-11-09','makeup')]}));
 const prior=fs.readFileSync(file,'utf8');
 assert.throws(()=>updateProgress(file,p=>({...p,shadow:[{...session('2026-11-09','makeup'),minutes:24}]})),/INVALID_PROGRESS/);
 assert.equal(fs.readFileSync(file,'utf8'),prior);
 assert.throws(()=>validateProgress({...emptyProgress(),shadow:[{...session('2026-11-09','makeup'),clips:['a','a']}]}));
 fs.writeFileSync(file,'broken');assert.throws(()=>readProgress(file));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('catalog and quick count use active OpenJLPT and recognition cards only', () => {
 const dir=fs.mkdtempSync(path.join(path.resolve('.tmp'),'roadmap-db-')),file=path.join(dir,'test.sqlite');seedDemo(file);
 const db=new DatabaseSync(file);
 try {
 const data=roadmapData(db,new Date('2100-01-01'));
 assert.equal(data.items.length,15);assert.deepEqual(new Set(data.items.map(i=>i.kind)),new Set(['vocab','kanji','grammar']));
 assert.equal(data.due,0);assert.deepEqual(data.clips,[]);
 } finally {db.close();fs.rmSync(dir,{recursive:true,force:true});}
});


test('missed complete weeks defer the roadmap and custom shadowing days are used', () => {
 const p=emptyProgress();p.activity=['2026-11-02'];
 const plan=todayPlan(p,defaults,new Date('2026-11-16T13:00:00Z'),0);
 assert.equal(plan.delayedWeeks,1);assert.equal(plan.week,2);
 const custom=todayPlan(emptyProgress(),{...defaults,shadowingDays:[3,5]},new Date('2026-11-04T13:00:00Z'),0);
 assert.ok(custom.selected.includes('shadow'));
});
test('settings adapter reads shared preferences and rejects corrupt settings', async () => {
 const {readTodaySettings}=await import('./settings.ts');
 const dir=fs.mkdtempSync(path.join(path.resolve('.tmp'),'roadmap-settings-')),file=path.join(dir,'settings.json');
 try {
 assert.deepEqual(readTodaySettings(file),defaults);
 fs.writeFileSync(file,JSON.stringify({...defaults,eveningTime:'20:00',shadowingDays:[3,5],theme:'dark'}));
 assert.equal(readTodaySettings(file).eveningTime,'20:00');assert.deepEqual(readTodaySettings(file).shadowingDays,[3,5]);
 fs.writeFileSync(file,JSON.stringify({eveningTime:'24:00'}));assert.throws(()=>readTodaySettings(file));
 fs.writeFileSync(file,'{}');assert.deepEqual(readTodaySettings(file),defaults);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
