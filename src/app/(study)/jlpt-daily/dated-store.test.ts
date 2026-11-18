import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {openStore,approvedBank} from './approved-store.ts';
import {hash,type Source} from './model.ts';

test('dated approval stays on its assigned day and cannot consume legacy or future questions',t=>{
 const root=path.resolve('.tmp');fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'dated-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const db=openStore(dir);
 const date='2026-11-18',week='2026-11-16';
 const q={version:2,id:'fixture-question',date,targetId:'fixture-word',sourceHash:'fixture-hash',type:'reading'};
 const receipt={reviewer:'tester-claude',origin:'draft_roadmap',status:'approved',approvedOn:'2026-11-18',sourceWeek:week,contentHash:hash(q),audit:{solver:{}}};
 db.prepare('INSERT INTO approved_questions VALUES(?,?,?)').run(q.id,JSON.stringify(q),JSON.stringify(receipt));
 db.prepare('INSERT INTO approved_schedule VALUES(?,?,?)').run(date,0,q.id);
 db.close();
 const catalog=[{id:q.targetId,hash:q.sourceHash}] as Source[];
 assert.equal(approvedBank(date,week,'N5',catalog,dir)?.questions.length,1);
 assert.equal(approvedBank('2026-11-19',week,'N5',catalog,dir)?.questions.length,0);
 assert.throws(()=>approvedBank(date,'2026-11-23','N5',catalog,dir),/INVALID_DATED_APPROVAL/);
 assert.throws(()=>approvedBank(date,week,'N5',[],dir),/INVALID_DATED_APPROVAL/);
});
