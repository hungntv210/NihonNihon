import test from 'node:test';import assert from 'node:assert/strict';import {roadmapLexicon,japaneseWordEvidence,N5_FUNCTION_WORDS} from './word-evidence.ts';import {strictDraftIssues,draftCollisionIssues} from './hard-qa.ts';import {nonOrderPrompt,typedQuestionSchema,generateTypedRows} from './typed-generation.ts';import {GENERATE_PROMPT} from './generation.ts';import type {Source,Draft} from './model.ts';
const source=(title:string,reading:string,pos=['n']):Source=>({id:'openjlpt:vocab:'+title,title,reading,pos,kind:'vocab',level:'N5',english:['fixture'],hash:'f'});
const catalog=[source('旅行','りょこう'),source('待つ','まつ',['v5t']),source('五つ','いつつ'),source('時','とき'),source('行く','いく',['v5k-s']),source('読む','よむ',['v5m']),source('本','ほん'),source('ひとり','ひとり')],lexicon=roadmapLexicon(catalog);
const q:Draft={day:0,position:0,type:'context',targetId:catalog[0].id,stem:'この（　）です。',choices:['本','五つ','時','旅行'],correct:0,explanation:'fixture',order:[],starSlot:0};
test('whole attested words survive ICU splits/merges; kana fragments are never words',()=>{
 for(const text of ['りょこう','まっています','あります','ありません','五つ','時に','わたし','わたしはりょこうにいきます','本を読んでください'])assert.deepEqual(japaneseWordEvidence(text,lexicon).unresolved,[],text);
 for(const fragment of ['り','ょ','っ','あり','つ','ありま']){assert.ok(!N5_FUNCTION_WORDS.includes(fragment));assert.deepEqual(japaneseWordEvidence(fragment,lexicon).words,[]);}
 assert.ok(japaneseWordEvidence('ひとりがくぶん',lexicon).unresolved.includes('ひとりがくぶん'));
 assert.ok(!lexicon.has('待てます'));assert.ok(lexicon.has('待っています'));
});
test('meaning target must be marked, Latin/kana mixing and reused targets remain rejected',()=>{
 assert.ok(strictDraftIssues({...q,type:'synonym',stem:'ことばのいみはどれですか'},lexicon).includes('UNMARKED_MEANING_TARGET'));
 assert.ok(!strictDraftIssues({...q,type:'synonym',stem:'【ことば】のいみはどれですか'},lexicon).includes('UNMARKED_MEANING_TARGET'));
 assert.ok(strictDraftIssues({...q,explanation:'maいにち'},lexicon).includes('LATIN_KANA_MIX'));
 assert.ok(!strictDraftIssues({...q,explanation:'毎日 (まいにち) nghĩa là hằng ngày'},lexicon).includes('LATIN_KANA_MIX'));
 assert.ok(draftCollisionIssues(q,[{...q,type:'reading',stem:'別の文'}],catalog).includes('REPEATED_TARGET_WORD'));
});
test('non-order wire prompt/schema has no order fields or explanation cues; content/key stay unchanged',async()=>{
 const prompt=nonOrderPrompt(GENERATE_PROMPT),schema=typedQuestionSchema(1,false);assert.doesNotMatch(prompt,/Thứ tự|★|starSlot|order=|For order/);assert.doesNotMatch(JSON.stringify(schema),/Thứ tự|★|starSlot|"order"/);
 const {order,starSlot,...wire}=q;const rows=await generateTypedRows(async(_phase,p,_payload,s)=>{assert.equal(p,prompt);assert.deepEqual(s,schema);return [wire];},GENERATE_PROMPT,positions=>({positions}),[{position:0,type:'context'}],[0]);assert.deepEqual(rows,[q]);assert.equal(rows[0].stem,wire.stem);assert.equal(rows[0].correct,wire.correct);
 assert.ok('order' in typedQuestionSchema(1,true).items.properties);
});
