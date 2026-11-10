import test from 'node:test';import assert from 'node:assert/strict';
import {hardQuestionIssues,plainJapanese,orderedSentence,spellingNeighbor,readingNeighbor,samePartOfSpeech} from './hard-qa.ts';import {validateQuestion,type Draft,type Source} from './model.ts';
const source=(title:string,reading:string,kind:Source['kind']='vocab'):Source=>({id:'openjlpt:'+kind+':'+title,title,reading,kind,level:'N5',english:['fixture'],pos:['n'],hash:'f'.repeat(64)});
const weekdays=['月曜日','火曜日','木曜日','金曜日'].map((title,i)=>source(title,['げつようび','かようび','もくようび','きんようび'][i])),year=source('今年','ことし'),grammar=source('〜です','','grammar'),catalog=[...weekdays,year,grammar];
const base=(type:Draft['type'],target=year):Draft=>({type,targetId:target.id,day:0,position:0,stem:'【今年】のよみかたはどれですか。',choices:['ことし','こんねん','きょねん','ことしい'],correct:0,explanation:'Năm nay.',order:[],starSlot:0});
test('hard QA reading requires marked kanji, kana choices and no answer leak',()=>{const q=base('reading');assert.deepEqual(hardQuestionIssues(q,year,catalog),[]);for(const stem of ['ことしのよみかたはどれですか。','【今年】はことしです。'])assert.ok(hardQuestionIssues({...q,stem},year,catalog).some(s=>s.startsWith('READING_')));assert.ok(hardQuestionIssues({...q,choices:['今年',...q.choices.slice(1)]},year,catalog).includes('READING_KANA_CHOICES'));});
test('hard QA spelling requires marked kana and same-level near-kanji distractors',()=>{const q={...base('spelling',weekdays[0]),stem:'【げつようび】のかんじはどれですか。',choices:weekdays.map(s=>s.title)};assert.deepEqual(hardQuestionIssues(q,weekdays[0],catalog),[]);for(const stem of ['げつようびのかんじはどれですか。','【げつようび】は月です。','How to write 【げつようび】?' ])assert.ok(hardQuestionIssues({...q,stem},weekdays[0],catalog).includes('SPELLING_MARKED_KANA'));const dog=source('犬','いぬ');assert.ok(hardQuestionIssues({...q,choices:[q.choices[0],'犬',...q.choices.slice(2)]},weekdays[0],[...catalog,dog]).includes('SPELLING_NEAR_DISTRACTORS'));assert.equal(spellingNeighbor(weekdays[0],{...weekdays[1],level:'N4'}),false);assert.ok(hardQuestionIssues({...q,choices:[q.choices[0],'かようび',...q.choices.slice(2)]},weekdays[0],catalog).includes('SPELLING_KANJI_CHOICES'));});
test('hard QA strips catalog annotations for planning but rejects them in actual choices',()=>{assert.equal(plainJapanese('〜で（place of action）'),'で');assert.equal(plainJapanese('〜ではありません / 〜じゃない'),'ではありません');for(const choice of ['〜で','で（place of action）','で (means)','でA'])assert.ok(hardQuestionIssues({...base('synonym'),choices:[choice,'あ','い','う']},year,catalog).includes('PLAIN_JAPANESE_CHOICES'));});
test('hard QA order checks four holes, fixed-word overlap, key and reconstructed explanation',()=>{const q={...base('order',grammar),stem:'これは ＿ ★ ＿ ＿ です。',choices:['きのう','ほんを','みた','ひと'],order:[1,0,2,3],starSlot:1};q.explanation=`Thứ tự: 2→1→3→4. ★=1. Câu: 「${orderedSentence(q)}」`;assert.deepEqual(hardQuestionIssues(q,grammar,catalog),[]);assert.ok(hardQuestionIssues({...q,stem:'これは ★ です。'},grammar,catalog).includes('ORDER_FOUR_SLOTS'));assert.ok(hardQuestionIssues({...q,starSlot:2},grammar,catalog).includes('ORDER_FOUR_SLOTS'));assert.ok(hardQuestionIssues({...q,choices:['これは',...q.choices.slice(1)]},grammar,catalog).includes('ORDER_DUPLICATES_FIXED_TEXT'));assert.ok(hardQuestionIssues({...q,correct:2},grammar,catalog).includes('ORDER_KEY'));assert.ok(hardQuestionIssues({...q,explanation:'Thứ tự: 1→2→3→4. ★=1. Câu sai.'},grammar,catalog).includes('ORDER_EXPLANATION'));});
test('hard QA rejects missing/duplicate choices and mismatched gap/paragraph task shape',()=>{const q=base('reading');for(const choices of [q.choices.slice(1),[...q.choices,'あ']])assert.ok(hardQuestionIssues({...q,choices},year,catalog).includes('FOUR_CHOICES'));assert.ok(hardQuestionIssues({...q,choices:['ことし','ことし','い','う']},year,catalog).includes('DISTINCT_CHOICES'));for(const type of ['context','usage','grammar'] as const)assert.ok(hardQuestionIssues({...q,type,stem:'きょうはあめです。'},year,catalog).includes('TYPE_REQUIRES_GAP'));assert.ok(hardQuestionIssues({...q,type:'paragraph',stem:'きのうはあめでした。'},year,catalog).includes('PARAGRAPH_PASSAGE'));const stem='【ほんぶん】あさ、こうえんをあるきました。そこにはおおきなきがありました。しずかだったので、ながくやすみました。【とい】どれですか。';assert.ok(!hardQuestionIssues({...q,type:'paragraph',stem},grammar,catalog).includes('PARAGRAPH_PASSAGE'));});
test('order full-sentence equality rejects added/missing/repeated words and unused fragments',()=>{
 const q={...base('order',grammar),stem:'これは ＿ ★ ＿ ＿ です。',choices:['きのう','ほんを','みた','ひと'],order:[1,0,2,3],starSlot:1},full=orderedSentence(q),explanation=(text:string)=>`Thứ tự: 2→1→3→4. ★=1. Câu: 「${text}」`;
 assert.deepEqual(hardQuestionIssues({...q,explanation:explanation(full)},grammar,catalog),[]);
 for(const sentence of [full+'ほん', 'きのう'+full,full.replace('ほんを',''),full+full,full.replace('です。','でした。')])assert.ok(hardQuestionIssues({...q,explanation:explanation(sentence)},grammar,catalog).includes('ORDER_SENTENCE_EXACT'));
 assert.ok(hardQuestionIssues({...q,explanation:explanation(full)+` Câu: 「${full}」`},grammar,catalog).includes('ORDER_SENTENCE_EXACT'));
 assert.ok(hardQuestionIssues({...q,order:[1,0,2,2],explanation:explanation(full)},grammar,catalog).includes('ORDER_KEY'));
 assert.ok(hardQuestionIssues({...q,explanation:explanation(full).replace('★=1.','★=10.')},grammar,catalog).includes('ORDER_EXPLANATION'));
});
test('reading distractors are near-sound kana of the same script and source level/POS',()=>{
 const q=base('reading');for(const option of ['こんねん','きょねん','ことしい'])assert.equal(readingNeighbor('ことし',option),true);
 for(const option of ['タクシー','ノート','き','こうえん'])assert.equal(readingNeighbor('ことし',option),false);
 for(const entry of [{...source('去年','きょねん'),level:'N4' as const},{...source('去年','きょねん'),pos:['v5r']}])assert.ok(hardQuestionIssues(q,year,[...catalog,entry]).includes('READING_NEAR_SAME_LEVEL_DISTRACTORS'));
 assert.ok(hardQuestionIssues({...q,choices:['ことし','タクシー','きょねん','ことしい']},year,catalog).includes('READING_NEAR_SAME_LEVEL_DISTRACTORS'));
});
test('synonym and spelling distractors enforce dictionary POS, Japanese word script and level',()=>{
 const q={...base('synonym'),choices:['今年','月曜日','火曜日','木曜日']};assert.deepEqual(hardQuestionIssues(q,year,catalog),[]);
 const verb={...source('知る','しる'),pos:['v5r','vt']};assert.equal(samePartOfSpeech(year,verb),false);
 assert.ok(hardQuestionIssues({...q,choices:['今年','知る','火曜日','木曜日']},year,[...catalog,verb]).includes('SYNONYM_POS_AND_SCRIPT'));
 assert.ok(hardQuestionIssues({...q,choices:['今年','月曜日です。','火曜日','木曜日']},year,catalog).includes('SYNONYM_POS_AND_SCRIPT'));
 assert.ok(hardQuestionIssues(q,year,catalog.map(s=>s.title==='火曜日'?{...s,level:'N4' as const}:s)).includes('SYNONYM_POS_AND_SCRIPT'));
 assert.equal(spellingNeighbor(weekdays[0],{...weekdays[1],pos:['v5r']}),false);
});
test('UNLEARNED_KANJI allows 私 only when present in the approved content catalog',()=>{
 const q={...base('context'),stem:'私の（　　）です。',choices:['今年','月曜日','火曜日','木曜日']};
 assert.throws(()=>validateQuestion(q,catalog,'2026-11-16','N5'),/UNLEARNED_KANJI/);
 assert.doesNotThrow(()=>validateQuestion(q,[...catalog,source('私','わたくし')],'2026-11-16','N5'));
});


