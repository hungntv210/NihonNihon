import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {randomSample,writeReviewCheckpoint,reviewFeedback,applyTranslationFlags,retainCampaignBackups} from '../../tools/data/campaign-review.mjs';
import {prepare,runGemini,publicPlan} from '../../tools/data/mt-gemini.mjs';
import {importCampaign} from '../../tools/data/translation-campaign.mjs';
import {createMT} from '../../tools/data/han-viet.mjs';
import {sha} from '../../tools/data/core.mjs';

test('MT indexes cache once while preserving first-cache priority, result order and attempt caps',()=>{
 const config={source_id:'mt:google-gemini',model:'gemini-test',prompt_version:'test',prompt_sha256:'a'.repeat(64),max_attempts:2},source={source_id:config.source_id,license:'test',attribution:'test'};
 const input={word:'日'},release_id=`${config.source_id}:config:${sha(config).slice(0,32)}`,id=sha({task:'translate',input,release:release_id});let reads=0;
 const db={prepare:()=>({all:()=>{reads++;return ['cached-first','cached-later'].map(text=>({context_json:JSON.stringify({request_id:id,mt_output:{text_vi:text}})}));}})};
 const responses=['first','second','third','wrong-profile'].map(text=>({row:{request_id:id,output:{text_vi:text}},a:{source,file:{mt_config_sha256:text==='wrong-profile'?'b'.repeat(64):sha(config)}}}));
 const engine=createMT({manifest:{mt:config,sources:[source]}},{responses},db);
 for(let i=0;i<2;i++){const result=engine.ask('translate',input,o=>assert.ok(o.text_vi));assert.equal(result.output.text_vi,'cached-first');assert.deepEqual(result.alternatives.map(r=>r.output.text_vi),['first','second']);}
 assert.equal(reads,1);assert.equal(engine.stats.cache_hits,2);assert.equal(engine.stats.attempts,4);
});

test('review checkpoint samples thirty unique new sentences near 500 and survives restart without duplicate files',t=>{
 const f=fixture(t),state={review_cursor:100},rows=Array.from({length:610},(_,i)=>({request_id:String(i),ja:'公開文'+i,output:{text_vi:'Câu thử '+i},model:'gemini-test'}));
 assert.equal(writeReviewCheckpoint({directory:f.dir,state,rows:rows.slice(0,599),provenance:{}}),null);
 const sample=writeReviewCheckpoint({directory:f.dir,state,rows,provenance:{},choose:n=>n-1});assert.equal(sample.rows.length,30);assert.ok(sample.rows.every(r=>Number(r.request_id)>=100));assert.equal(new Set(sample.rows.map(r=>r.ja)).size,30);
 assert.equal(state.review_cursor,610);assert.equal(writeReviewCheckpoint({directory:f.dir,state:JSON.parse(JSON.stringify(state)),rows,provenance:{}}),null);
 assert.ok(fs.readFileSync(path.join(f.dir,'review-0001.md'),'utf8').includes('chưa được duyệt nghĩa'));
 assert.equal(reviewFeedback(sample,JSON.parse(fs.readFileSync(path.join(f.dir,'review-0001.feedback.json')))).reviewed,0);
});

test('campaign retention keeps first and latest two registered snapshots without touching other backups',t=>{
 const f=fixture(t),backupDir=path.join(f.dir,'backups');fs.mkdirSync(backupDir);fs.writeFileSync(path.join(backupDir,'before-999-aaaaaaaa.sqlite'),'unregistered');fs.writeFileSync(path.join(backupDir,'before-restore.sqlite'),'unrelated');
 for(let i=0;i<6;i++){const file=path.join(backupDir,`before-${i}-aaaaaaaa.sqlite`);fs.writeFileSync(file,'snapshot');retainCampaignBackups(f.dir,file);}
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'campaign-backups.json'))),['before-0-aaaaaaaa.sqlite','before-4-aaaaaaaa.sqlite','before-5-aaaaaaaa.sqlite']);
 assert.equal(fs.readFileSync(path.join(backupDir,'before-999-aaaaaaaa.sqlite'),'utf8'),'unregistered');assert.equal(fs.readFileSync(path.join(backupDir,'before-restore.sqlite'),'utf8'),'unrelated');
 assert.throws(()=>retainCampaignBackups(f.dir,path.join(f.dir,'before-6-aaaaaaaa.sqlite')),/outside/);
});

test('review stops only above ten percent major errors and rejects mismatched feedback IDs',()=>{
 const sample={sample_id:'review-0001',rows:Array.from({length:30},(_,i)=>({request_id:String(i)}))},feedback={version:1,sample_id:sample.sample_id,results:sample.rows.map(r=>({...r,severity:null,note:''}))};
 for(let i=0;i<3;i++)feedback.results[i].severity='major';assert.equal(reviewFeedback(sample,feedback).pause,false);
 feedback.results[3].severity='major';const result=reviewFeedback(sample,feedback);assert.equal(result.pause,true);assert.equal(result.reviewed,4);assert.equal(result.flags.length,4);
 feedback.results[4].request_id='foreign';assert.throws(()=>reviewFeedback(sample,feedback),/Unknown/);
 assert.equal(randomSample([{ja:'é',request_id:'1'},{ja:'é',request_id:'2'}]).length,1);
});

test('accepted batches import immediately, keep selected translations and add idempotent review reports without schema changes',async t=>{
 const f=fixture(t),config={model:'gemini-test',prompt_version:'gemini-vi-hv-6',prompt_revision:2,requests_per_minute:15,requests_per_day:500,daily_budget:450,max_output_tokens:4096,route:'sentences'};
 const p={config,manifestPath:f.dir+'/sentence-manifest.json',requestsPath:f.dir+'/sentence-requests.json',resultsPath:f.dir+'/sentence-results.json',statePath:f.dir+'/quota.json'};
 await prepare({manifestPath:f.manifestPath,config,outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});let received;
 await runGemini({...p,limit:1,ai:{models:{generateContent:async params=>{received=JSON.parse(params.contents);return {text:JSON.stringify(received.map(r=>({request_id:r.request_id,output:{text_vi:'Đây là ngày.'}})))};}}}});
 assert.deepEqual(received[0].reference_en,['Synthetic sentence.']);assert.ok(!JSON.stringify(received).includes('kanjidictvn'));assert.equal((await publicPlan(p.manifestPath,{cache:true})).englishGlosses.get('日です。')[0],'Synthetic sentence.');
 const flags=[{request_id:received[0].request_id,reason:'Lần dịch lại vẫn cần xem lại'}],options={baseManifest:p.manifestPath,profiles:[p],directory:f.dir+'/campaign',dbPath:f.dbPath,flags};
 await importCampaign(options);const db=f.open(),selected=db.prepare("SELECT translation_id FROM vi_translations WHERE field='text' AND status='selected'").get();assert.ok(selected);
 assert.equal(db.prepare("SELECT count(*) n FROM translation_reports WHERE status='open'").get().n,1);assert.equal(applyTranslationFlags(f.dbPath,flags),0);
 await importCampaign(options);assert.equal(db.prepare("SELECT count(*) n FROM translation_reports").get().n,1);assert.equal(db.prepare("SELECT translation_id FROM vi_translations WHERE field='text' AND status='selected'").get().translation_id,selected.translation_id);
 const schema=db.prepare("SELECT sql FROM sqlite_schema WHERE name='vi_translations'").get().sql;assert.ok(!schema.includes('severity'));
});
