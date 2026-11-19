import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {readingNoise,spellingNoise,candidates,validateV2,phrases,dailyMix} from './deterministic.ts';import {safeExample,exampleEvidence,type V2Source,type V2Context} from './v2-data.ts';import {fingerprint,hash,plusDays} from './model.ts';import {runDeterministic} from './v2-run.ts';import {blindQuestions,verifyDeterministic} from './v2-verifier.ts';import {enqueueMistake} from './repository.ts';import {enqueueCard} from '../../../core/review.ts';import {fixtureCatalog} from './fixture.ts';import {DatabaseSync} from 'node:sqlite';import {session} from '../srs/repository.ts';import {scheduler} from '../srs/model.ts';
import {draftCollisionIssues,sentenceKeys} from './hard-qa.ts';
import {contextAt} from './v2-data.ts';import {japaneseWordEvidence,roadmapLexicon} from './word-evidence.ts';import {reviewHtml,main} from './generate-v2.ts';
import {verifierWireSchema} from './v2-verifier.ts';import {independentSchema,choiceSentence} from './independent-qa.ts';
const source=(title:string,reading:string,kind:V2Source['kind']='vocab',pos=['n']):V2Source=>({id:'openjlpt:'+kind+':fixture-'+title,title,reading,kind,pos,level:'N5',hash:hash(title),english:['self-authored fixture'],vietnamese:null,on:[]});
export function context():V2Context{
 const words=[source('私','わたし','vocab',['pn']),source('毎日','まいにち','vocab',['adv']),source('学校','がっこう'),source('日本語','にほんご'),source('勉強','べんきょう','vocab',['vs']),source('校長','こうちょう'),source('日本','にほん'),source('曰本','にほん'),source('本','ほん'),source('名前','なまえ'),source('はし','はし'),source('行','こう')];
 const characters=[...new Set(words.flatMap(w=>[...w.title]).filter(c=>/\p{Script=Han}/u.test(c)))];characters.push('木','人','国','未','末','目','白');const catalog=[...words,...characters.map(k=>({...source(k,'こう','kanji'),on:k==='行'?['コウ','ギョウ','アン']:k==='本'||k==='書'?['ホン']:k==='日'||k==='人'?['ジツ']:[]})),...['は','が','を','に','で','へ','と','の','だけ','です','だ','でした','ではありません'].map(s=>source(s,s,'grammar',[]))];
 const target=catalog.find(s=>s.kind==='grammar'&&s.title==='で')!;return{mode:'draft_roadmap',date:'2026-11-16',level:'N5',catalog,dictionary:catalog,knownKanji:characters,examples:[{id:'fixture:sentence:1',targetId:target.id,text:'私は毎日学校で日本語を勉強しています。',english:'Self-authored test only.',notation:null,sourceId:'openjlpt',releaseId:'fixture',attribution:'Self-authored test'},{id:'fixture:sentence:modifiers',targetId:catalog.find(s=>s.kind==='grammar'&&s.title==='です')!.id,text:'私の学校の日本語の本です。',english:'Self-authored plumbing fixture; not semantic approval.',notation:null,sourceId:'openjlpt',releaseId:'fixture',attribution:'Self-authored test'}]};
}
test('v2 reading distractors prove long vowels,sokuon,voicing,other On and shared-kanji readings',()=>{
 const c=context(),school=c.catalog.find(s=>s.title==='学校')!,rows=readingNoise(school,c);assert.ok(rows.some(r=>r.rule==='long-vowel'&&r.value==='がっこお'));assert.ok(rows.some(r=>r.rule==='sokuon'&&r.value==='がこう'));assert.ok(rows.some(r=>r.rule==='shared-kanji'&&r.value==='こうちょう'));const voiced=readingNoise(c.catalog.find(s=>s.title==='はし')!,c);assert.ok(voiced.some(r=>r.value==='ばし'));assert.ok(voiced.some(r=>r.value==='ぱし'));assert.ok(readingNoise(c.catalog.find(s=>s.kind==='vocab'&&s.title==='行')!,c).some(r=>r.rule==='other-on'&&r.value==='ぎょう'));assert.ok(rows.every(r=>/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(r.value)&&r.value!==school.reading&&!r.value.includes('っっ')));
});
test('v2 spelling derives same-sound,shape and one-learned-kanji evidence only',()=>{
 const c=context(),target=c.catalog.find(s=>s.title==='日本')!,rows=spellingNoise(target,c);assert.ok(rows.some(r=>r.rule==='same-sound'&&r.value==='人本'));assert.ok(!rows.some(r=>r.value==='曰本'));assert.ok(rows.some(r=>r.rule==='similar-shape'));assert.ok(rows.every(r=>r.rule==='same-sound'||r.rule==='similar-shape'));assert.ok(rows.every(r=>r.sourceIds.length>0&&[...r.value].every(ch=>!/[\p{Script=Han}]/u.test(ch)||c.knownKanji.includes(ch))));
});
test('v2 is deterministic, preserves sourced grammar/order and requires all core hard gates',()=>{
 const c=context(),a=candidates(c),b=candidates(structuredClone(c));assert.deepEqual(a,b);for(const type of ['reading','spelling','grammar','order'])assert.ok(a.questions.some(q=>q.type===type),JSON.stringify(a.rejected));assert.ok(a.rejected.HARDENING_ORDER_SCRAMBLING>0,'The original multi-argument fixture must now be excluded as an order task');
 const q=a.questions.find(q=>q.type==='reading')!;
 for(const mutate of [(r:any)=>r.stem+='鬱',(r:any)=>r.choices[1]=r.choices[0],(r:any)=>r.correct=(r.correct+1)%4,(r:any)=>r.explanation+=' forged',(r:any)=>r.sourceHash='changed']){const raw=structuredClone(q);mutate(raw);assert.throws(()=>validateV2(raw,c));}
 const grammar=a.questions.find(q=>q.type==='grammar')!;assert.equal(grammar.stem.replace('＿',grammar.choices[grammar.correct]),grammar.sentence);assert.throws(()=>exampleEvidence({...grammar,example:{...grammar.example!,sourceId:''}},c),/SOURCE/);
 const order=a.questions.find(q=>q.type==='order')!;assert.equal(order.order.length,4);assert.equal(phrases(order.sentence!).join(''),order.sentence);assert.equal(order.order[order.starSlot],order.correct);
 assert.throws(()=>validateV2({...q,date:plusDays(c.date,29)}, {...c,date:plusDays(c.date,29)},[q]),/COLLISION|THIRTY/);assert.doesNotThrow(()=>validateV2({...q,date:plusDays(c.date,31)}, {...c,date:plusDays(c.date,31)},[q]));
 const outside=structuredClone(q);outside.stem+='ひとりがくぶん';outside.fingerprint=fingerprint(outside.stem);assert.throws(()=>validateV2(outside,c),/UNATTESTED/);
});
test('source kana fallback preserves text readings and refuses missing/changed provenance',()=>{
 const c=context(),e={...c.examples[0],text:'魚を見ます。',notation:'{魚|さかな}を{見|み}ます。'};assert.equal(safeExample(e,c),'さかなをみます。');assert.equal(safeExample({...e,notation:null},c),null);assert.equal(safeExample({...e,notation:'{魚|さかな}とは'},c),null);
});
test('verifier input hides key,explanation,target and distractor proofs; ambiguity is rejected without editing',async()=>{
 const c=context(),q=candidates(c).questions.find(q=>q.type==='reading')!,payload=blindQuestions([q]);assert.ok(!('correct' in payload[0])&&!('explanation' in payload[0])&&!('distractors' in payload[0])&&!('targetId' in payload[0]));let calls=0;
 const result=await verifyDeterministic(async(phase,_prompt,p)=>{assert.equal(phase,'verify');calls++;if(calls===1)return[{index:0,possibleAnswers:[0,1],independentAnswer:0,natural:true,knowledgeCorrect:true,optionGrades:q.choices.map((v,i)=>({choiceIndex:i,completedSentence:q.stem.replace(/【[^】]+】/u,v),candidateOrder:[],grammatical:true,formCorrect:true,natural:true,meaningFits:true,acceptable:true,reason:'fixture ambiguity'}))}];return q.choices.map((_,index)=>({index,grammatical:true,formCorrect:true,natural:true,meaningFits:true,reason:'fixture ambiguity'}));},[q]);assert.equal(calls,2);assert.equal(result[0].accepted,false);assert.equal(q.correct,candidates(c).questions.find(r=>r.id===q.id)!.correct);
});
test('bounded run checkpoints on quota and resumes deterministically without reaccepting a question',async()=>{
 const contexts=Array.from({length:7},(_,n)=>({...context(),date:plusDays(context().date,n)}));let checkpoints=0;const stopped=await runDeterministic(contexts,[],{provider:async()=>{throw Error('DAILY_BUDGET_REACHED');},checkpoint:()=>checkpoints++});assert.match(stopped.status,/stopped/);assert.equal(stopped.questions.length,0);assert.ok(checkpoints>0);
 const a=await runDeterministic(contexts,[],{noVerifier:true,seed:stopped}),b=await runDeterministic(contexts,[],{noVerifier:true});assert.deepEqual(a.questions,b.questions);assert.equal(a.status,'unverified_fixture');assert.equal(new Set(a.questions.map(q=>q.fingerprint)).size,a.questions.length);
});
test('wrong grammar cloze is due next day in full SRS, never quick; existing later card is brought forward',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-v2-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'demo.sqlite'),catalog=fixtureCatalog(file),id=catalog.find(s=>s.kind==='grammar')!.id,now=new Date('2026-11-16T13:00:00Z'),due=new Date('2026-11-17T13:00:00Z');const original=enqueueCard(file,id,'cloze',new Date('2026-12-20T13:00:00Z'));assert.equal(enqueueMistake(file,id,'cloze',due,now).cardId,original.cardId);const db=new DatabaseSync(file);try{db.prepare("UPDATE srs_cards SET due_at='2027-01-01T00:00:00Z' WHERE card_id<>?").run(original.cardId);const engine=await scheduler();assert.equal(session(db,engine,'full',now).cards.length,0);assert.equal(session(db,engine,'full',due).cards[0]?.cardId,original.cardId);assert.equal(session(db,engine,'quick',due).cards.length,0);}finally{db.close();}
});
test('Vietnam day cutoff and roadmap never include future days; real review mode remains independent',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-v2-days-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'demo.sqlite');fixtureCatalog(file);const db=new DatabaseSync(file);try{
  assert.equal(contextAt(db,db,'2026-11-01','draft_roadmap').catalog.length,0);
  const monday=contextAt(db,db,'2026-11-02','draft_roadmap'),tuesday=contextAt(db,db,'2026-11-03','draft_roadmap');assert.ok(monday.catalog.length>0&&tuesday.catalog.length>=monday.catalog.length);assert.ok(monday.catalog.every(s=>tuesday.catalog.some(t=>t.id===s.id)));
  db.exec("UPDATE srs_reviews SET reviewed_at='2026-11-16T17:00:00Z'");assert.equal(contextAt(db,db,'2026-11-16','srs').catalog.length,0);assert.ok(contextAt(db,db,'2026-11-17','srs').catalog.length>0);
  assert.deepEqual(contextAt(db,db,'2026-11-02','draft_roadmap').catalog,monday.catalog);
 }finally{db.close();}
});
test('attested whole calendar words survive ICU particle boundaries, invented compounds still fail',()=>{
 const lex=roadmapLexicon([source('二十日','はつか'),source('三日','みっか'),source('ひとり','ひとり'),source('学','がく'),source('文','ぶん')]);for(const text of ['はつか','みっか'])assert.deepEqual(japaneseWordEvidence(text,lex).unresolved,[]);assert.ok(japaneseWordEvidence('ひとりがくぶん',lex).unresolved.length>0);
});
test('fixture CLI needs no key or API and writes only unverified draft review/checkpoints',async t=>{
 const base=path.resolve('.tmp');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'jlpt-v2-cli-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'demo.sqlite');fixtureCatalog(file);const out=path.join(dir,'out');await main(['--content',file,'--learning',file,'--fixture','--no-verifier','--mode','draft_roadmap','--week','2026-11-16','--weeks','1','--output',out]);const bank=JSON.parse(fs.readFileSync(path.join(out,'bank-2026-11-16.json'),'utf8'));assert.equal(bank.status,'unverified_fixture');assert.equal(bank.mode,'draft_roadmap');assert.match(reviewHtml(bank),/Chưa nhập kho duyệt/);assert.ok(!fs.existsSync(path.join(out,'approved.sqlite')));
});
test('Gemini wire schema avoids nested fixed-length state explosion while runtime cardinality stays exact',async()=>{
 const wire=verifierWireSchema(independentSchema);assert.doesNotMatch(JSON.stringify(wire),/minItems|maxItems/);assert.deepEqual(wire.items.required,independentSchema.items.required);assert.deepEqual(wire.items.properties.optionGrades.items.required,independentSchema.items.properties.optionGrades.items.required);assert.equal(wire.items.additionalProperties,false);
 const q=candidates(context()).questions.find(q=>q.type==='reading')!;
 await assert.rejects(verifyDeterministic(async(_phase,_prompt,_payload,schema)=>{assert.doesNotMatch(JSON.stringify(schema),/minItems|maxItems/);return [];},[q]),/INVALID_QA_INDEX/);
 let calls=0;await assert.rejects(verifyDeterministic(async(_phase,_prompt,_payload,schema)=>{assert.doesNotMatch(JSON.stringify(schema),/minItems|maxItems/);if(++calls===2)return [];return [{index:0,possibleAnswers:[q.correct],independentAnswer:q.correct,natural:true,knowledgeCorrect:true,optionGrades:q.choices.map((_,choiceIndex)=>({choiceIndex,completedSentence:choiceSentence(q,choiceIndex),candidateOrder:[],grammatical:choiceIndex===q.correct,formCorrect:choiceIndex===q.correct,natural:choiceIndex===q.correct,meaningFits:choiceIndex===q.correct,acceptable:choiceIndex===q.correct,reason:'Self-authored fixture'}))}];},[q]),/INVALID_ISOLATED_QA_INDEX/);assert.equal(calls,2);
 const incomplete=await verifyDeterministic(async()=>[{index:0,possibleAnswers:[q.correct],independentAnswer:q.correct,natural:true,knowledgeCorrect:true,optionGrades:[]}],[q]).catch(e=>e);assert.ok(incomplete instanceof Error);
});
import {orderPermutations} from './v2-verifier.ts';
test('order alternatives provide all six exact reconstructions for each zero-based star choice',()=>{
 const q=candidates(context()).questions.find(q=>q.type==='order')!;
 const options=orderPermutations(q);assert.equal(new Set(options.map(x=>x.candidateOrder.join())).size,24);
 for(let i=0;i<4;i++)assert.equal(options.filter(x=>x.choiceIndex===i&&x.candidateOrder[q.starSlot]===i).length,6);
 assert.ok(options.some(x=>x.choiceIndex===q.correct&&x.completedSentence===q.sentence));
 assert.ok(phrases('きのう、デパートでくつをかいました。').includes('かいました。'));
});
test('a vocabulary example can supply learned grammar and preserves its actual parent',()=>{
 const c=context();c.examples[0].targetId=c.catalog.find(x=>x.kind==='vocab'&&x.title==='学校')!.id;
 const q=candidates(c).questions.find(q=>q.type==='grammar'&&q.example?.id===c.examples[0].id);
 assert.ok(q);assert.equal(q.example?.targetId,c.examples[0].targetId);assert.notEqual(q.targetId,q.example?.targetId);
});
test('supplement only fills grammar or order vacancies while keeping the baseline intact',async()=>{
 const c=context(),contexts=Array.from({length:7},(_,i)=>({...c,date:plusDays(c.date,i)}));
 const q=candidates(c).questions.find(x=>x.type==='reading')!;
 const baseline=Array.from({length:9},(_,i)=>({...q,id:'existing-'+i,position:i}));
 const before=JSON.stringify(baseline);const run=await runDeterministic(contexts,baseline,{supplement:true,noVerifier:true});
 assert.equal(JSON.stringify(baseline),before);assert.ok(run.questions.length>0);
 assert.ok(run.questions.every(r=>r.type==='grammar'||r.type==='order'));
 assert.ok(run.questions.filter(r=>r.date===c.date).length<=1);
 for(const day of contexts)for(const type of ['grammar','order'])assert.ok(run.questions.filter(r=>r.date===day.date&&r.type===type).length<=3);
});

test('distractor evidence comes only from explicit forms of grammar records already allocated that day', async()=>{
 const {learnedGrammarForms}=await import('./confusion-groups.ts');
 const earlier=[{kind:'grammar',id:'exist',title:'〜がある / 〜がいる'},{kind:'vocab',id:'ha',title:'は'}];
 assert.deepEqual(learnedGrammarForms(earlier).map(x=>x.surface),['がある','がいる']);
 const today=[...earlier,{kind:'grammar',id:'negative',title:'〜ではありません / 〜じゃない'},{kind:'grammar',id:'or',title:'〜か（or）'}];
 assert.deepEqual(learnedGrammarForms(today).slice(2),[{id:'negative',surface:'ではありません'},{id:'negative',surface:'じゃない'},{id:'or',surface:'か'}]);
 assert.ok(!learnedGrammarForms(today).some(x=>['は','が','ます','ません'].includes(x.surface)));
});

test('open translation reports in the live DB block the exact Frozen meaning before verification',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-reports-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const live=path.join(dir,'live.sqlite'),frozen=path.join(dir,'frozen.sqlite');fixtureCatalog(live);const db=new DatabaseSync(live);
 try{
  const row=db.prepare("SELECT * FROM content_items WHERE kind='vocab' LIMIT 1").get()!;
  db.prepare("INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('frozen-meaning',?,'meaning','Nghĩa fixture','dictionary','openjlpt',?,'fixture',?,'selected','word','2026-11-18')").run(row.item_id,row.release_id,row.source_hash);
  db.exec(`VACUUM INTO '${frozen.replaceAll("'","''")}'`);
  db.exec("UPDATE vi_translations SET translation_id='live-meaning' WHERE translation_id='frozen-meaning'");
  db.exec("INSERT INTO translation_reports(report_id,translation_id,reason,reported_at,status) VALUES('report','live-meaning','Fixture report','2026-11-18','open')");
  const snapshot=new DatabaseSync(frozen,{readOnly:true});try{
   const read=()=>contextAt(snapshot,db,'2026-12-31','draft_roadmap');
   assert.equal(read().catalog.find(s=>s.id===row.item_id)?.translationReported,true);
   db.exec("UPDATE translation_reports SET status='resolved'");assert.equal(read().catalog.find(s=>s.id===row.item_id)?.translationReported,false);
   db.exec("UPDATE translation_reports SET status='open'; UPDATE vi_translations SET text_vi='Dòng dịch khác'");assert.equal(read().catalog.find(s=>s.id===row.item_id)?.translationReported,false);
  }finally{snapshot.close();}
 }finally{db.close();}
 const c=context(),school=c.catalog.find(s=>s.title==='学校')!;school.translationReported=true;
 const pool=candidates(c);assert.ok(!pool.questions.some(q=>q.targetId===school.id));assert.ok(pool.rejected.TRANSLATION_REPORTED_OPEN>=1);
 const good=context(),q=candidates(good).questions.find(q=>q.targetId===school.id)!;
 assert.throws(()=>validateV2(q,c),/TRANSLATION_REPORTED_OPEN/);
});

test('same source sentence collides across grammar targets, gaps and order windows in one batch/week',async()=>{
 const c=context();c.catalog=c.catalog.filter(s=>s.title!=='だけ'); // Keep this collision fixture free of the independently forbidden limiting distractor.
 c.examples=[{...c.examples[0],targetId:c.catalog.find(s=>s.kind==='vocab'&&s.title==='学校')!.id,text:'これは私の学校の日本語の本です。'}];const pool=candidates(c),orders=pool.questions.filter(q=>q.type==='order');assert.ok(orders.length>1,JSON.stringify(pool.rejected));
 const first=orders[0],other=orders.find(q=>q.stem!==first.stem)!;assert.ok(other);
 assert.throws(()=>validateV2(other,c,[first]),/DUPLICATE_SENTENCE/);
 const grammar=pool.questions.find(q=>q.type==='grammar')!;assert.ok(grammar);assert.throws(()=>validateV2(grammar,c,[first]),/DUPLICATE_SENTENCE/);
 const wide={...first,example:{...first.example!,text:first.example!.text.replace('。','．')}};
 const narrow={...other,example:{...other.example!,text:first.example!.text.replace('。','．').normalize('NFKC')}};
 assert.ok(draftCollisionIssues(narrow,[wide],c.catalog).includes('DUPLICATE_SENTENCE'));
 const run=await runDeterministic(Array.from({length:7},(_,n)=>({...c,date:plusDays(c.date,n)})),[],{noVerifier:true});
 const rows=run.questions.filter(q=>q.type==='grammar'||q.type==='order');assert.equal(rows.length,1);
 assert.equal(new Set(rows.map(q=>sentenceKeys(q)[0])).size,rows.length);
});

test('borrowed examples never assign or/connective/demonstrative meanings by substring to grammar or order',()=>{
 for(const title of ['〜か（or）','〜くて / 〜で','これ / それ']){
  const c=context(),s=source(title,'','grammar',[]);s.english=['WRONG_FUNCTION_SENTINEL'];c.catalog.push(s);
  c.catalog.push(source('わからない','わからない'));
  const sentences=title.includes('か')?['これは私の学校の本の名前か。']:title.includes('くて')?['この学校の日本語の本で勉強します。']:['私の学校の名前はこれです。'];
  c.examples=sentences.map((text,i)=>({...c.examples[0],id:'borrowed-'+i,text,targetId:c.catalog.find(s=>s.title==='学校')!.id}));
  const pool=candidates(c),rows=pool.questions.filter(q=>q.targetId===s.id);assert.ok(rows.some(q=>q.type==='order'),title+JSON.stringify(pool.rejected));
  for(const q of rows){assert.ok(!q.explanation.includes('WRONG_FUNCTION_SENTINEL'));assert.ok(q.explanation.includes(`Câu: 「${q.sentence}」`));assert.doesNotThrow(()=>validateV2(q,c));}
 }
 const c=context(),direct=candidates(c).questions.find(q=>q.type==='grammar')!;assert.ok(direct.explanation.includes('self-authored fixture'));
});

test('grammar can reuse a learned target with another sentence inside 30 days; daily and weekly mix stay strict',async()=>{
 const c=context(),old=candidates(c).questions.find(q=>q.type==='grammar')!;
 const changed={...c,examples:[{...c.examples[0],id:'second-sentence',text:'毎日私は学校で日本語を勉強しています。'}]};
 const q=candidates(changed).questions.find(q=>q.type==='grammar'&&q.targetId===old.targetId)!;assert.ok(q);
 assert.doesNotThrow(()=>validateV2(q,changed,[old]));
 assert.throws(()=>validateV2({...old,date:plusDays(old.date,30)},{...c,date:plusDays(old.date,30)},[old]),/DUPLICATE/);
 assert.doesNotThrow(()=>validateV2({...old,date:plusDays(old.date,31)},{...c,date:plusDays(old.date,31)},[old]));
 const reading=candidates(c).questions.find(q=>q.type==='reading')!;
 assert.ok(draftCollisionIssues({...reading,stem:reading.stem+'。'},[reading],c.catalog).includes('REPEATED_TARGET_WORD'));
 const run=await runDeterministic(Array.from({length:7},(_,n)=>({...changed,date:plusDays(c.date,n)})),[old],{noVerifier:true});
 assert.ok(run.questions.some(q=>q.targetId===old.targetId&&(q.type==='grammar'||q.type==='order')));
 const ten=Array.from({length:10},(_,n)=>({...reading,type:n===0?'grammar' as const:n===1?'spelling' as const:'reading' as const}));
 assert.equal(dailyMix(ten),true);assert.equal(dailyMix(ten.slice(1)),false);assert.equal(dailyMix(ten.map(q=>({...q,type:'reading'}))),false);
 assert.ok(!run.days.every(day=>day.mix));assert.equal(run.status,'unverified_fixture');
});

test('multi-question verifier states the full batch count and indexes; a first-question-only response still stops both passes',async()=>{
 const questions=candidates(context()).questions.filter(q=>q.type==='reading').slice(0,3);assert.equal(questions.length,3);
 const grade=(q:typeof questions[number],index:number)=>({index,possibleAnswers:[q.correct],independentAnswer:q.correct,natural:true,knowledgeCorrect:true,optionGrades:q.choices.map((_,choiceIndex)=>({choiceIndex,completedSentence:choiceSentence(q,choiceIndex),candidateOrder:[],grammatical:choiceIndex===q.correct,formCorrect:choiceIndex===q.correct,natural:choiceIndex===q.correct,meaningFits:choiceIndex===q.correct,acceptable:choiceIndex===q.correct,reason:'Self-authored batch fixture'}))});
 let calls=0;
 await assert.rejects(verifyDeterministic(async(_phase,prompt,payload:any)=>{
  calls++;assert.match(prompt,/exactly expectedResultCount/);assert.match(prompt,/EVERY index in expectedIndexes/);
  assert.equal(payload.expectedResultCount,3);assert.deepEqual(payload.expectedIndexes,[0,1,2]);assert.deepEqual(payload.questions.map((q:any)=>q.index),[0,1,2]);
  assert.ok(payload.questions.every((q:any)=>!('correct' in q)&&!('explanation' in q)&&!('targetId' in q)));
  return [grade(questions[0],0)];
 },questions),/INVALID_QA_INDEX/);assert.equal(calls,1);
 calls=0;
 await assert.rejects(verifyDeterministic(async(_phase,prompt,payload:any)=>{
  calls++;assert.match(prompt,/exactly expectedResultCount/);
  if(calls===1)return questions.map(grade);
  assert.equal(payload.expectedResultCount,12);assert.deepEqual(payload.expectedIndexes,Array.from({length:12},(_,i)=>i));assert.deepEqual(payload.sentences.map((s:any)=>s.index),payload.expectedIndexes);
  return [{index:0,grammatical:true,formCorrect:true,natural:true,meaningFits:true,reason:'Fixture incomplete response'}];
 },questions),/INVALID_ISOLATED_QA_INDEX/);assert.equal(calls,2);
});
test('model chain exhaustion persists a stopped checkpoint without accepting the pending batch',async()=>{
 const contexts=Array.from({length:7},(_,day)=>({...context(),date:plusDays('2026-11-16',day)}));let last:any;
 const run=await runDeterministic(contexts,[],{provider:async()=>{throw Error('DRAFT_MODELS_EXHAUSTED');},checkpoint:r=>{last=r;}});
 assert.equal(run.status,'stopped:DRAFT_MODELS_EXHAUSTED');assert.equal(last.status,run.status);assert.equal(run.questions.length,0);assert.equal(last.days.length,7);
});
