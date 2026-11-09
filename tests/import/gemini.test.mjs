import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from './helpers.mjs';
import {prepare,runGemini,settings,validateResults} from '../../tools/data/mt-gemini.mjs';
const config={model:'gemini-test',requests_per_minute:10,requests_per_day:100,daily_budget:5,max_output_tokens:4096};
async function setup(t){const f=fixture(t);f.vocab.splice(0,1,...Array.from({length:25},(_,i)=>({...f.vocab[0],id:String(i+1).padStart(10,'0'),word:'公開'+i,examples:[]})));f.write('vocab.json',f.vocab);f.save();
const options={config,manifestPath:f.dir+'/gemini.json',requestsPath:f.dir+'/gemini-requests.json',resultsPath:f.dir+'/results.json',statePath:f.dir+'/quota.json'};
await prepare({manifestPath:f.manifestPath,config,outputManifest:options.manifestPath,requestsPath:options.requestsPath,resultsPath:options.resultsPath});return {f,options};}
const fake=response=>({models:{generateContent:response}});
const output=params=>JSON.parse(params.contents).map(r=>({request_id:r.request_id,output:{text_vi:'tiếng Việt'}}));

test('Gemini pilot sends at most 20 verified public requests, normalizes NFC, pins output, resumes',async t=>{
const {f,options}=await setup(t);let count=0;
const queue=JSON.parse(fs.readFileSync(options.requestsPath));queue.requests.push({request_id:'private',task:'translate',input:{item_id:'user-media:sentence:secret',ja:'private subtitle'}});fs.writeFileSync(options.requestsPath,JSON.stringify(queue));
const ai=fake(async p=>{count++;assert.equal(p.config.responseMimeType,'application/json');assert.ok(p.config.responseJsonSchema);assert.equal(p.config.httpOptions.retryOptions.attempts,1);assert.ok(!p.contents.includes('private subtitle'));return {text:JSON.stringify(output(p))};});
const first=await runGemini({...options,ai});assert.equal(first.sent,20);assert.equal(first.blocked_private_or_unverified,1);assert.equal(count,1);
const rows=JSON.parse(fs.readFileSync(options.resultsPath));assert.ok(rows.every(r=>r.output.text_vi===r.output.text_vi.normalize('NFC')));
let clock=Date.now();const second=await runGemini({...options,ai,now:()=>clock,sleep:async n=>{clock+=n;}});assert.equal(second.already_completed,20);assert.ok(second.sent>0);
assert.equal((await runGemini({...options,ai})).sent,0);
});

test('Gemini rejects tampered public payloads and wrong model configuration before sending',async t=>{
const {options}=await setup(t),queue=JSON.parse(fs.readFileSync(options.requestsPath));queue.requests[0].input.word='private replacement';fs.writeFileSync(options.requestsPath,JSON.stringify(queue));
const report=await runGemini({...options,ai:fake(async p=>({text:JSON.stringify(output(p))}))});assert.equal(report.blocked_private_or_unverified,1);
await assert.rejects(()=>runGemini({...options,config:{...config,model:'gemini-other'}}),/mismatch/);
assert.throws(()=>settings({model:'gemini-test'}),/Real rate limit/);
});

test('Gemini 429 backs off and daily quota stops without retrying or losing checkpoint',async t=>{
const {options}=await setup(t);let clock=Date.now(),calls=0;const pauses=[];
const ai=fake(async p=>{calls++;if(calls===1)throw {status:429,message:'per-minute retryDelay: 12s'};return {text:JSON.stringify(output(p))};});
const report=await runGemini({...options,ai,now:()=>clock,sleep:async n=>{pauses.push(n);clock+=n;}});assert.equal(report.sent,20);assert.ok(pauses.some(n=>n>=12000));
let dailyCalls=0;const daily=fake(async()=>{dailyCalls++;throw {status:429,message:'GenerateRequestsPerDay quota'};});
assert.equal((await runGemini({...options,ai:daily,now:()=>clock,sleep:async n=>{clock+=n;}})).status,'daily_limit');
assert.equal((await runGemini({...options,ai:daily,now:()=>clock})).status,'daily_limit');assert.equal(dailyCalls,1);
});

test('Gemini output rejects foreign IDs, missing evidence and out-of-list HV candidates',()=>{
const requests=[{request_id:'hv',task:'han_viet',input:{candidates:[{id:'x',reading:'nhật'}],compounds:[]}}];
const row={request_id:'hv',output:{text_vi:'nhật',candidate_id:'x',compound:{word:'日本',reading:'にほん'},meaning:'Nhật Bản',reason:'test',evidence_origin:'model-generated',references:[]}};
assert.equal(validateResults([row],requests).length,1);assert.throws(()=>validateResults([{...row,request_id:'other'}],requests));
assert.throws(()=>validateResults([{...row,output:{...row.output,candidate_id:'outside'}}],requests));
assert.throws(()=>validateResults([{...row,output:{text_vi:'nhật'}}],requests));
assert.throws(()=>validateResults([{...row,output:{...row.output,evidence_origin:'input'}}],requests));
});

test('Interactions enforces JSON schema, thinking, routing, and retries invalid JSON',async t=>{
 const {options}=await setup(t);const c={...config,api:'interactions',thinking_level:'medium',route:'learning',min_interval_ms:13000,tokens_per_minute:250000};
 const manifest=JSON.parse(fs.readFileSync(options.manifestPath));manifest.mt=settings(c);fs.writeFileSync(options.manifestPath,JSON.stringify(manifest));
 const {publicPlan}=await import('../../tools/data/mt-gemini.mjs');const plan=await publicPlan(options.manifestPath);fs.writeFileSync(options.requestsPath,JSON.stringify({version:1,requests:plan.requests}));
 let clock=Date.now(),calls=0;const pauses=[];
 const ai={interactions:{create:async(p,opts)=>{calls++;assert.equal(p.store,false);assert.equal(p.generation_config.thinking_level,'medium');assert.equal(p.response_format.mime_type,'application/json');assert.ok(p.response_format.schema);assert.equal(opts.maxRetries,0);const batch=JSON.parse(p.input);assert.ok(batch.every(r=>r.input.field!=='text'));
 if(calls===2)throw {statusCode:503,message:'temporarily unavailable'};return {output_text:calls===1?'bad JSON':JSON.stringify(batch.map(r=>({request_id:r.request_id,output:{text_vi:'Nghĩa thử'}})))};}}};
 const result=await runGemini({...options,config:c,ai,sleep:async n=>{pauses.push(n);clock+=n;},now:()=>clock});
 assert.equal(result.sent,20);assert.equal(result.invalid_outputs,1);assert.equal(calls,3);assert.ok(pauses.reduce((n,v)=>n+v,0)>=13000);
});

test('quota resumes on the next Pacific date and aliases share model identity',async t=>{
 const {options}=await setup(t);let clock=Date.parse('2026-11-06T07:55:00Z');let calls=0;
 const ai=fake(async p=>{calls++;return {text:JSON.stringify(output(p))};});
 const c={...config,daily_budget:1};await runGemini({...options,config:c,ai,now:()=>clock});
 assert.equal((await runGemini({...options,config:c,ai,now:()=>clock})).status,'daily_limit');
 clock=Date.parse('2026-11-06T08:05:00Z');const r=await runGemini({...options,config:c,ai,now:()=>clock});assert.ok(r.sent>0);assert.equal(calls,2);
 assert.equal(settings({...config,model:'models/gemini-test'}).model,'gemini-test');
});

test('503 stops after at most three calls, with waits in the 30-60 second range',async t=>{
 const {options}=await setup(t);let clock=Date.now(),calls=0;const pauses=[];
 const result=await runGemini({...options,config:{...config,max_api_attempts:4},limit:1,ai:fake(async()=>{calls++;throw {status:503};}),now:()=>clock,random:()=>0.5,sleep:async ms=>{pauses.push(ms);clock+=ms;}});
 assert.equal(calls,3);assert.equal(result.status,'api_error');assert.equal(result.error_status,503);assert.deepEqual(pauses,[32500,60000]);
});

test('a network error without HTTP status retries and succeeds within the same Pacific day',async t=>{
 const {options}=await setup(t),attempts=[],pauses=[];let calls=0,clock=Date.parse('2026-11-09T08:30:00Z');
 const result=await runGemini({...options,limit:1,ai:fake(async p=>{if(++calls===1)throw Object.assign(Error('fetch failed'),{code:'ECONNRESET'});return {text:JSON.stringify(output(p))};}),onAttempt:a=>attempts.push(a),now:()=>clock,random:()=>0.5,sleep:async ms=>{pauses.push(ms);clock+=ms;}});
 assert.equal(result.status,'complete');assert.equal(result.sent,1);assert.equal(calls,2);assert.deepEqual(pauses,[32500]);assert.equal(attempts[0].http_status,null);assert.equal(attempts[0].error_kind,'network_or_unknown');assert.equal(attempts[1].http_status,200);
 const ledger=JSON.parse(fs.readFileSync(options.statePath)).models[config.model];assert.equal(ledger.day,'2026-11-09');assert.equal(ledger.dailyCount,2);assert.equal(ledger.blockedDay,null);
});

test('one glossary failure in 30 sentences keeps and imports the 29 valid rows',async t=>{
 const f=fixture(t),c={...config,route:'sentences',max_api_attempts:1};
 const source='損失は１００万ドル以上にのぼる。';f.vocab[0].examples=Array.from({length:30},(_,i)=>({ja:i?'これは公開例文その'+i+'です。':source,en:'Synthetic public example '+i}));f.write('vocab.json',f.vocab);f.grammar.length=0;f.write('grammar.json',[]);f.manifest.expected_counts.grammar=0;f.save();
 const options={config:c,manifestPath:f.dir+'/partial-manifest.json',requestsPath:f.dir+'/partial-queue.json',resultsPath:f.dir+'/partial-results.json',statePath:f.dir+'/partial-quota.json'};
 await prepare({manifestPath:f.manifestPath,config:c,outputManifest:options.manifestPath,requestsPath:options.requestsPath,resultsPath:options.resultsPath});
 const attempts=[];const {assertSentenceQuality}=await import('../../tools/data/translation-gate.mjs');
 const result=await runGemini({...options,limit:30,batchSize:30,ai:fake(async p=>({text:JSON.stringify(JSON.parse(p.contents).map(r=>({request_id:r.request_id,output:{text_vi:r.input.ja===source?'Thiệt hại lên tới hơn một triệu đô la.':'Đây là câu ví dụ công khai.'}})))})),validateOutput:(rows,requests)=>assertSentenceQuality(rows,requests,'gemini-vi-hv-7'),onAttempt:a=>attempts.push(a)});
 assert.equal(result.calls,1);assert.equal(result.status,'partial_output');assert.equal(result.sent,29);assert.equal(result.rejected.length,1);assert.match(result.rejected[0].reason,/trở lên/);assert.equal(attempts[0].validation_error,'terminology');assert.deepEqual(attempts[0].rejected,result.rejected);
 const saved=JSON.parse(fs.readFileSync(options.resultsPath));assert.equal(saved.length,29);assert.ok(!saved.some(r=>r.request_id===result.rejected[0].request_id));
 const {runImport}=await import('../../tools/data/import.mjs');const report=await runImport({...f,manifestPath:options.manifestPath,takeBackup:false});assert.equal(report.db_committed,true);
 assert.equal(f.open().prepare("SELECT COUNT(*) AS n FROM vi_translations WHERE method='machine' AND status='selected'").get().n,29);
});

test('fallback retries only unfinished contexts and records the actual model for every result',async t=>{
 const {f,options}=await setup(t);const {runChain}=await import('../../tools/data/mt-gemini-chain.mjs');const backup={...config,model:'gemini-backup',max_api_attempts:1};
 const second={config:backup,manifestPath:f.dir+'/backup-manifest.json',requestsPath:f.dir+'/backup-requests.json',resultsPath:f.dir+'/backup-results.json'};
 await prepare({config:backup,manifestPath:f.manifestPath,outputManifest:second.manifestPath,requestsPath:second.requestsPath,resultsPath:second.resultsPath});
 let clock=Date.now(),primaryCalls=0;const received=[];
 const ai=fake(async p=>{received.push({model:p.model,items:JSON.parse(p.contents)});if(p.model===config.model&&++primaryCalls===2)throw {status:503};return {text:JSON.stringify(output(p))};});
 const report=await runChain({profiles:[{...options,config:{...config,max_api_attempts:1}},second],limit:22,statePath:options.statePath,reportPath:f.dir+'/chain-report.json',ai,now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(report.remaining,0);assert.equal(report.results.filter(r=>r.model===config.model).length,20);assert.equal(report.results.filter(r=>r.model===backup.model).length,2);
 assert.equal(received.at(-1).items.length,2);assert.notEqual(received[1].items[0].request_id,received[2].items[0].request_id);
 assert.equal(JSON.parse(fs.readFileSync(second.manifestPath)).mt.model,backup.model);
 assert.equal(JSON.parse(fs.readFileSync(second.resultsPath)).length,2);
});

test('disabled model makes no API call even when invoked directly',async t=>{
 const {options}=await setup(t);const r=await runGemini({...options,config:{...config,enabled:false},ai:fake(async()=>{throw Error('Must not call');})});assert.equal(r.status,'model_disabled');assert.equal(r.calls,0);
});

test('mixed translation and Han Viet tasks share one API call with strict per-task validation',async t=>{
 const {f,options}=await setup(t);f.write('hv.json',[['日','nhật niết','','',[],{}]]);f.save();
 const configMixed={...config,mixed_tasks:true,api:'interactions',max_api_attempts:1};
 const paths={manifestPath:f.dir+'/mixed-manifest.json',requestsPath:f.dir+'/mixed-queue.json',resultsPath:f.dir+'/mixed-output.json'};
 await prepare({manifestPath:f.manifestPath,config:configMixed,outputManifest:paths.manifestPath,requestsPath:paths.requestsPath,resultsPath:paths.resultsPath});
 const q=JSON.parse(fs.readFileSync(paths.requestsPath));q.requests=[q.requests.find(r=>r.task==='translate'),q.requests.find(r=>r.task==='han_viet')];fs.writeFileSync(paths.requestsPath,JSON.stringify(q));let calls=0;
 const ai={interactions:{create:async p=>{calls++;assert.equal(p.response_format.schema.items.anyOf.length,2);return {output_text:JSON.stringify(JSON.parse(p.input).map(r=>({request_id:r.request_id,output:r.task==='translate'?{text_vi:'nghĩa thử'}:{text_vi:r.input.candidates[0].reading,candidate_id:r.input.candidates[0].id,compound:{word:'日本',reading:'にほん'},meaning:'Nhật Bản',reason:'test',evidence_origin:'model-generated',references:[]}})))};}}};
 const result=await runGemini({...paths,config:configMixed,statePath:f.dir+'/mixed-state.json',limit:2,ai});assert.equal(calls,1);assert.equal(result.sent,2);
});

test('terminology validation rejects cảm cúm and flattened humble speech',async()=>{
 const {validateTerminology}=await import('../../tools/data/mt-gemini.mjs');const q=[{request_id:'cold',task:'translate',input:{ja:'風邪は伝染する。'}},{request_id:'visit',task:'translate',input:{ja:'明日伺います。'}}];
 assert.throws(()=>validateTerminology([{request_id:'cold',output:{text_vi:'Cảm cúm lây truyền.'}}],q),/influenza/);assert.throws(()=>validateTerminology([{request_id:'visit',output:{text_vi:'Ngày mai tôi sẽ đến.'}}],q),/Humble/);
 validateTerminology([{request_id:'cold',output:{text_vi:'Bệnh cảm có thể lây.'}},{request_id:'visit',output:{text_vi:'Ngày mai tôi xin phép đến.'}}],q);
});

test('longest glossary match distinguishes 留学生 and 小学生 while retaining standalone 学生',async()=>{
 const {validateTerminology,glossaryRequirements}=await import('../../tools/data/mt-gemini.mjs');
 const verify=(ja,vi)=>validateTerminology([{request_id:'x',output:{text_vi:vi}}],[{request_id:'x',task:'translate',input:{ja}}]);
 verify('留学生も入れるのかしら。','Không biết du học sinh có được vào không nhỉ.');verify('彼らは小学生でした。','Họ từng là học sinh tiểu học.');verify('私は学生です。','Tôi là sinh viên.');
 assert.throws(()=>verify('私は学生です。','Tôi là học sinh.'),/Glossary/);assert.throws(()=>verify('留学生もいる。','Cũng có sinh viên.'),/Glossary/);
 assert.deepEqual(glossaryRequirements('留学生と学生と小学生。').map(r=>r.expected).sort(),['du học sinh','học sinh','sinh viên'].sort());
});

test('proper-name QA rejects substituted or omitted public names without exempting Japanese leftovers',async()=>{
 const {inspectBatch,summarizeGate}=await import('../../tools/data/translation-gate.mjs');
 const requests=[{request_id:'x',task:'translate',input:{ja:'キートンはハトの頭に磁石を取り付けた。',field:'text'}}];
 const check=vi=>inspectBatch(JSON.stringify([{request_id:'x',output:{text_vi:vi}}]),requests,{properNames:true});
 assert.equal(check('Keeton đã gắn nam châm lên đầu bồ câu.').proper_name,0);
 const bad=check('Keaton đã gắn nam châm lên đầu bồ câu.');assert.equal(bad.proper_name,1);assert.ok(bad.items[0].flags.includes('proper_name'));
 assert.equal(check('キートン đã gắn nam châm lên đầu bồ câu.').japanese_left,1);
 assert.equal(summarizeGate([{http_status:200,validation_error:'quality_gate',qa:bad}],0).counts.proper_name,1);
 const {properNameIssues}=await import('../../tools/data/mt-gemini.mjs');assert.deepEqual(properNameIssues('アトムです。','Đây là Atom.'),[]);
});

test('API failures preserve real HTTP 400/429/503 and distinguish network errors without logging secrets',async t=>{
 const {apiErrorStatus}=await import('../../tools/data/mt-gemini.mjs');
 assert.equal(apiErrorStatus({response:{status:503}}),503);assert.equal(apiErrorStatus({code:'ECONNRESET'}),null);assert.equal(apiErrorStatus({status:null}),null);
 for(const code of [400,429,503]){
  const {options}=await setup(t),attempts=[];
  const result=await runGemini({...options,config:{...config,max_api_attempts:1},ai:fake(async()=>{throw {response:{status:code},message:'key=secret-do-not-log'};}),onAttempt:a=>attempts.push(a)});
  assert.equal(result.error_status,code);assert.equal(attempts[0].http_status,code);assert.equal(attempts[0].error_kind,'http');assert.ok(!JSON.stringify(attempts).includes('secret-do-not-log'));
 }
});

test('503 attempt preserves the message, redacts keys before the 300-character limit, and keeps retry waits',async t=>{
 const {options}=await setup(t),attempts=[],pauses=[],key='test-env-gemini-secret',googleKey='AIza'+'a'.repeat(35),previous=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY=key;t.after(()=>{if(previous==null)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;});
 let clock=Date.now();const message=`Google temporarily unavailable: ${key}; ${googleKey}; key=label-secret; `+'x'.repeat(400);
 const result=await runGemini({...options,limit:1,ai:fake(async()=>{throw {status:503,message};}),onAttempt:a=>attempts.push(a),now:()=>clock,random:()=>0.5,sleep:async ms=>{pauses.push(ms);clock+=ms;}});
 assert.equal(result.error_status,503);assert.equal(result.calls,3);assert.deepEqual(pauses,[32500,60000]);
 for(const attempt of attempts){assert.equal(attempt.http_status,503);assert.equal(attempt.error_message.length,300);assert.ok(attempt.error_message.startsWith('Google temporarily unavailable: [REDACTED]'));assert.ok(![key,googleKey,'label-secret'].some(secret=>attempt.error_message.includes(secret)));}
});

test('global call cap stops before another request and audits every response',async t=>{
 const {options}=await setup(t);let calls=0;const attempts=[];const result=await runGemini({...options,limit:25,maxCalls:1,ai:fake(async p=>{calls++;return {text:JSON.stringify(output(p))};}),onAttempt:r=>attempts.push(r)});
 assert.equal(calls,1);assert.equal(result.calls,1);assert.equal(result.status,'request_limit');assert.equal(result.sent,20);assert.equal(attempts.length,1);assert.equal(attempts[0].http_status,200);
});

test('Pacific quota reset follows midnight including DST rather than Vietnam midnight',async()=>{
 const {nextPacificReset,quotaDay}=await import('../../tools/data/mt-gemini.mjs');
 assert.equal(new Date(nextPacificReset(Date.parse('2026-11-06T06:45:00Z'))).toISOString(),'2026-11-06T08:00:00.000Z');
 assert.equal(new Date(nextPacificReset(Date.parse('2026-07-01T06:00:00Z'))).toISOString(),'2026-07-01T07:00:00.000Z');
 const reset=nextPacificReset(Date.parse('2026-11-06T06:45:00Z'));assert.notEqual(quotaDay(reset-1),quotaDay(reset));
});

test('numeric glossary distinguishes inclusive bounds without changing discourse',async()=>{
 const {validateTerminology,numericGlossaryRequirements}=await import('../../tools/data/mt-gemini.mjs');
 for(const [term,vi]of [['以下','20 người trở xuống'],['以上','20 người trở lên'],['未満','dưới 20 người']]){
 const req={request_id:term,task:'translate',input:{ja:'２０人'+term+'です。'}};
 validateTerminology([{request_id:term,output:{text_vi:vi}}],[req]);
 assert.throws(()=>validateTerminology([{request_id:term,output:{text_vi:'hơn 20 người'}}],[req]),/Numeric/);
 }
 assert.equal(numericGlossaryRequirements({ja:'学生である以上、勉強すべきです。'}).length,0);
});

test('60 translation items fit one Flash request and caches still verify changed source artifacts',async t=>{
 const {f,options}=await setup(t);const original={...f.vocab[0],examples:[]};f.vocab.splice(0,f.vocab.length,...Array.from({length:70},(_,i)=>({...original,id:String(i+1).padStart(10,'0'),word:'公開'+i})));f.write('vocab.json',f.vocab);f.save();
 const p={config,manifestPath:f.dir+'/sixty-manifest.json',requestsPath:f.dir+'/sixty-queue.json',resultsPath:f.dir+'/sixty-results.json',statePath:f.dir+'/sixty-state.json'};
 await prepare({config,manifestPath:f.manifestPath,outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});let calls=0;
 const result=await runGemini({...p,limit:60,batchSize:60,ai:fake(async params=>{calls++;assert.equal(JSON.parse(params.contents).length,60);return {text:JSON.stringify(output(params))};})});assert.equal(result.sent,60);assert.equal(calls,1);
 const {publicPlan}=await import('../../tools/data/mt-gemini.mjs');await publicPlan(p.manifestPath,{cache:true});fs.writeFileSync(f.dir+'/vocab.json','[]');await assert.rejects(()=>publicPlan(p.manifestPath,{cache:true}),/checksum/i);
});

test('quality gate rejects output before checkpointing and audits the reason within the call cap',async t=>{
 const {options}=await setup(t);let clock=Date.now(),calls=0;const attempts=[],pauses=[];
 const result=await runGemini({...options,config:{...config,pause_after_response_ms:5000},maxCalls:2,ai:fake(async p=>{calls++;return {text:JSON.stringify(output(p))};}),validateOutput:()=>{throw Error('Rejected by QA');},onAttempt:a=>attempts.push(a),now:()=>clock,sleep:async ms=>{clock+=ms;pauses.push(ms);}});
 assert.equal(result.calls,2);assert.equal(result.sent,0);assert.equal(result.status,'request_limit');assert.equal(result.invalid_outputs,2);assert.ok(attempts.every(a=>a.validation_error==='quality_gate'));assert.equal(pauses.filter(ms=>ms===5000).length,2);assert.deepEqual(JSON.parse(fs.readFileSync(options.resultsPath)),[]);
});

test('campaign imports preserve model provenance and reruns do not duplicate output',async t=>{
 const {f,options}=await setup(t);await runGemini({...options,ai:fake(async p=>({text:JSON.stringify(output(p))}))});
 const {publicPlan}=await import('../../tools/data/mt-gemini.mjs'),{hash}=await import('../../tools/data/core.mjs');
 const oldManifest=JSON.parse(fs.readFileSync(options.manifestPath));oldManifest.mt.prompt_version='gemini-vi-hv-3';fs.writeFileSync(options.manifestPath,JSON.stringify(oldManifest));
 const oldQueue=(await publicPlan(options.manifestPath)).requests;const oldRows=JSON.parse(fs.readFileSync(options.resultsPath));oldRows.forEach((r,i)=>r.request_id=oldQueue[i].request_id);fs.writeFileSync(options.resultsPath,JSON.stringify(oldRows));oldManifest.sources.find(s=>s.source_id==='mt:google-gemini').files[0].sha256=hash(fs.readFileSync(options.resultsPath));fs.writeFileSync(options.manifestPath,JSON.stringify(oldManifest));
 const {runImport}=await import('../../tools/data/import.mjs');await runImport({manifestPath:options.manifestPath,dbPath:f.dbPath,reportPath:f.reportPath,requestsPath:f.requestsPath});
 const backup={...config,prompt_version:'gemini-vi-hv-4',model:'gemini-second',route:'learning'},p={config:backup,manifestPath:f.dir+'/second-manifest.json',requestsPath:f.dir+'/second-queue.json',resultsPath:f.dir+'/second-results.json',statePath:f.dir+'/second-quota.json'};
 await prepare({manifestPath:f.manifestPath,config:backup,outputManifest:p.manifestPath,requestsPath:p.requestsPath,resultsPath:p.resultsPath});await runGemini({...p,ai:fake(async params=>({text:JSON.stringify(output(params).map(r=>({...r,output:{text_vi:'Bản khác'}})))}))});
 const {importCampaign}=await import('../../tools/data/translation-campaign.mjs');const args={baseManifest:options.manifestPath,profiles:[p],directory:f.dir+'/campaign',dbPath:f.dbPath};
 await importCampaign(args);const db=f.open();const query="SELECT json_extract(r.manifest_json,'$.model') model,count(*) n FROM vi_translations t JOIN source_releases r USING(release_id) WHERE t.method='machine' GROUP BY model ORDER BY model";
 const first=db.prepare(query).all().map(r=>({...r}));assert.ok(first.some(r=>r.model===config.model&&r.n===20));assert.ok(first.some(r=>r.model===backup.model&&r.n===20));
 assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE method='machine' AND text_vi='Bản khác' AND status='selected'").get().n,20);
 assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE method='machine' AND text_vi='tiếng Việt' AND status='needs_review'").get().n,20);
 await importCampaign(args);assert.deepEqual(db.prepare(query).all().map(r=>({...r})),first);
 assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE method='machine' AND text_vi='Bản khác' AND status='selected'").get().n,20);
});
