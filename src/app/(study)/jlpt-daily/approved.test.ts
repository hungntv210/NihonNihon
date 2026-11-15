import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {fixtureCatalog,fixtureBank} from './fixture.ts';import {importApproved,approvedBank,type ApprovedInput} from './approved-store.ts';import {choiceSentence} from './independent-qa.ts';import {gradeAnswer} from './repository.ts';
import {approvedFixture} from './approved-fixture.ts';
test('approved SQLite stores exactly11 privately, assigns10 then1 then0 without repeats across weeks',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-approved-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'demo.sqlite'),catalog=fixtureCatalog(file),input=await approvedFixture(catalog,'2026-11-09');const hash=()=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash();
 assert.equal(importApproved(input,catalog,dir).inserted,11);assert.equal(importApproved(input,catalog,dir).inserted,0);assert.equal(hash(),before);
 const first=approvedBank('2026-11-15','2026-11-09','N5',catalog,dir)!;assert.equal(first.questions.length,10);assert.deepEqual(approvedBank('2026-11-15','2026-11-09','N5',catalog,dir)!.questions,first.questions);
 const second=approvedBank('2026-11-16','2026-11-16','N5',catalog,dir)!;assert.equal(second.questions.length,1);assert.equal(approvedBank('2026-11-17','2026-11-16','N5',catalog,dir)!.questions.length,0);assert.equal(approvedBank('2026-11-17','2026-11-16','N4',catalog,dir),null);
 const db=new DatabaseSync(path.join(dir,'approved.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(DISTINCT question_id) n FROM approved_schedule').get()!.n,11);const row=db.prepare('SELECT payload,receipt FROM approved_questions WHERE id=?').get(input.questions[0].id)!;assert.deepEqual(JSON.parse(String(row.payload)),input.questions[0]);assert.equal(JSON.parse(String(row.receipt)).origin,'draft_roadmap');}finally{db.close();}
 let enqueued=0;const day={date:'2026-11-16',week:'2026-11-16',level:'N5' as const},q=second.questions[0],options={directory:dir,approvedCatalog:catalog,enqueue:()=>{enqueued++;return {cardId:'fixture-card'};}};
 const answer=gradeAnswer({questionId:q.id,choice:(q.correct+1)%4},day,[],options);assert.equal(answer.correct,false);assert.equal(enqueued,1);gradeAnswer({questionId:q.id,choice:q.correct},day,[],options);assert.equal(enqueued,1);assert.equal(hash(),before);
});
test('import rejects unapproved counts, changed sources and failed QA before writing',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-approved-reject-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const catalog=fixtureCatalog(path.join(dir,'demo.sqlite')),input=await approvedFixture(catalog,'2026-11-09');
 assert.throws(()=>importApproved({...input,reviewer:'unknown'},catalog,dir),/APPROVED_ELEVEN/);assert.throws(()=>importApproved({...input,questions:input.questions.slice(1)},catalog,dir),/APPROVED_ELEVEN/);
 assert.throws(()=>importApproved({...input,sourceHashes:{}},catalog,dir),/SOURCE_CHANGED/);const bad=structuredClone(input);bad.audit[0].possibleAnswers=[0,1];assert.throws(()=>importApproved(bad,catalog,dir));assert.ok(!fs.existsSync(path.join(dir,'approved.sqlite')));
});

import {approvedBundle} from './import-approved.ts';
test('CLI bundle accepts only exact private accepted-set evidence and actual distinct model records',async t=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-approved-bundle-'));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));const dir=path.join(parent,'data','private','review');fs.mkdirSync(dir,{recursive:true});const catalog=fixtureCatalog(path.join(parent,'demo.sqlite')),input=await approvedFixture(catalog,'2026-11-09');const file=path.join(dir,'review-sample.json');
 fs.writeFileSync(file,JSON.stringify({draft:true,available:11,questions:input.questions}));fs.writeFileSync(path.join(dir,'metadata.json'),JSON.stringify({mode:'draft_roadmap',appPublished:false,week:input.sourceWeek,sourceHashes:input.sourceHashes}));
 for(let d=0;d<7;d++){const questions=input.questions.filter(q=>q.day===d);fs.writeFileSync(path.join(dir,`draft-day-${d+1}.json`),JSON.stringify({questions,audit:questions.map(q=>input.audit[input.questions.findIndex(r=>r.id===q.id)])}));}
 fs.writeFileSync(path.join(dir,'attempts.jsonl'),[{phase:'generate',status:'ok',model:input.model},{phase:'verify',status:'ok',model:input.verifierModel}].map(e=>JSON.stringify(e)).join('\n'));
 assert.equal(approvedBundle(file).questions.length,11);const changed=structuredClone(input.questions);changed[0].explanation+=' changed';fs.writeFileSync(file,JSON.stringify({draft:true,available:11,questions:changed}));assert.throws(()=>approvedBundle(file),/NOT_IN_ACCEPTED_SET/);
});

import {copyApprovedTargets} from './approved-targets.ts';
test('target import appends only pinned public rows and preserves existing reviews and media tables',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-approved-targets-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const srcFile=path.join(dir,'frozen.sqlite'),appFile=path.join(dir,'demo.sqlite');fixtureCatalog(srcFile);fixtureCatalog(appFile);const src=new DatabaseSync(srcFile),app=new DatabaseSync(appFile);const before=app.prepare('SELECT count(*) n FROM srs_reviews').get()!.n;
 const original=src.prepare("SELECT * FROM content_items WHERE kind='vocab' LIMIT 1").get()!,vocab=src.prepare('SELECT * FROM vocab WHERE item_id=?').get(original.item_id)!,id='openjlpt:vocab:approved-fixture-extra';
 for(const [table,row]of [['content_items',{...original,item_id:id,source_key:'approved-fixture-extra',source_hash:'f'.repeat(64)}],['vocab',{...vocab,item_id:id}]] as const){const cols=Object.keys(row);src.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).run(...Object.values(row));}
 try{assert.equal(copyApprovedTargets(src,appFile,[id]),1);assert.equal(copyApprovedTargets(src,appFile,[id]),0);assert.equal(app.prepare('SELECT count(*) n FROM srs_reviews').get()!.n,before);assert.equal(app.prepare('SELECT source_hash FROM content_items WHERE item_id=?').get(id)!.source_hash,'f'.repeat(64));assert.equal(app.prepare('PRAGMA foreign_key_check').all().length,0);}finally{src.close();app.close();}
});
