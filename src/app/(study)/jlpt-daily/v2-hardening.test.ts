import test from 'node:test';import assert from 'node:assert/strict';
import {hardeningIssues,orderBoundaries,provenMeaning,standardMeanings,translationSenseEvidence,grammarLevelMatches} from './v2-hardening.ts';
import {phrases} from './deterministic.ts';
import type {V2Context,V2Source} from './v2-data.ts';import type {V2Question} from './deterministic.ts';
// All sentences and records here are authored fixtures, not bank/source questions.
const source=(title:string,reading=title,pos=['n'],kind:V2Source['kind']='vocab',level:V2Source['level']='N5'):V2Source=>({id:'fixture:'+title,title,reading,pos,kind,level,hash:'fixture',english:['fixture meaning'],vietnamese:null,on:[]});
function context():V2Context{
 const words=[source('秤','はかり'),source('大学','だいがく'),source('載せる','のせる',['v1']),source('覚える','おぼえる',['v1']),source('買う','かう',['v5u']),source('済む','すむ',['v5m']),source('本','ほん'),source('私','わたし'),source('学校','がっこう'),source('日本語','にほんご')];
 const grammar=source('です','です',[],'grammar');return{mode:'draft_roadmap',date:'2026-11-30',level:'N5',catalog:[...words,grammar],dictionary:words,boundaryWords:words,grammarCatalog:[],examples:[],knownKanji:['私','学','校','日','本','語','先','生','来']};
}
function question(c:V2Context,stem:string,choices:string[],type:V2Question['type']='grammar',correct=0):V2Question{return{version:2,mode:c.mode,id:'fixture',date:c.date,fingerprint:'fixture',day:0,position:0,type,targetId:c.catalog.at(-1)!.id,stem,choices,correct,order:[0,1,2,3],starSlot:1,explanation:'Self-authored fixture',sourceHash:'fixture',distractors:[],sentence:stem.replace('＿',choices[correct])};}
test('source words/readings and inflections forbid cuts inside nouns and verb stems',()=>{
 const c=context(),sentence='はかりに本をのせてください。',b=orderBoundaries(sentence,c);
 for(const cut of [1,2,sentence.indexOf('のせ')+1])assert.equal(b.has(cut),false);
 assert.ok(b.has(3));assert.equal(phrases(sentence,b).join(''),sentence);assert.ok(!phrases(sentence,b).includes('は'));
 const text='だいがくの先生が来ます。',example={id:'fixture-example',targetId:c.catalog[0].id,text:'大学の先生が来ます。',notation:'{大学|だいがく}の{先生|せんせい}が{来|き}ます。',english:'Authored fixture',sourceId:'fixture',releaseId:'fixture',attribution:'Authored fixture'};
 for(const cut of [1,2,3])assert.equal(orderBoundaries(text,c,example).has(cut),false);
 const q=question(c,'＿ ★ ＿ ＿',['だいが','くの','先生が','来ます。'],'order');q.sentence=text;q.example=example;
 assert.ok(hardeningIssues(q,c).includes('ORDER_WORD_BOUNDARY'));
});
test('order refuses interchangeable case phrases and sourced adverbs without asking the verifier',()=>{
 const c=context(),q=question(c,'＿ ★ ＿ ＿',['図書館で','友だちと','本を','読みます。'],'order');q.sentence=q.choices.join('');assert.ok(hardeningIssues(q,c).includes('ORDER_SCRAMBLING'));
 const adverb={...q,choices:['また','学校で','本を','読みます。']};assert.ok(hardeningIssues(adverb,c).includes('ORDER_SCRAMBLING'));
 const modifiers={...q,choices:['私の','学校の','日本語の','本です。'],sentence:'私の学校の日本語の本です。'};assert.ok(!hardeningIssues(modifiers,c).includes('ORDER_SCRAMBLING'),'This guard is not semantic approval; the blind verifier still audits every order');
});
test('predicate copula alternatives, final polite kara, nominal dake and buy-kara are denied deterministically',()=>{
 const c=context();
 for(const [stem,choices] of [
  ['この本はどれ＿か。',['です','でした','だ','ではありません']],
  ['明日は晴れる＿。',['でしょう','じゃない','だ','です']],
  ['ここで読んでもよい＿か。',['です','じゃない','でした','だ']],
 ] as [string,string[]][])assert.ok(hardeningIssues(question(c,stem,choices),c).includes('GRAMMAR_COPULA_AMBIGUITY'));
 assert.ok(hardeningIssues(question(c,'妹は働きます＿。',['か','から','と','に']),c).includes('GRAMMAR_FINAL_KARA_AMBIGUITY'));
 assert.ok(hardeningIssues(question(c,'町には店＿あります。',['が','だけ','と','に']),c).includes('GRAMMAR_DAKE_AMBIGUITY'));
 assert.ok(hardeningIssues(question(c,'この店＿買います。',['で','から','と','に']),c).includes('GRAMMAR_BUY_KARA_AMBIGUITY'));
 assert.ok(hardeningIssues(question(c,'この店＿新しい本を買いたいです。',['で','から','と','に']),c).includes('GRAMMAR_BUY_KARA_AMBIGUITY'));
 assert.ok(!hardeningIssues(question(c,'駅＿来ました。',['から','で','に','へ']),c).includes('GRAMMAR_BUY_KARA_AMBIGUITY'));
});
test('Vietnamese sense needs matching evidence; restricted glosses and adverb alternatives cannot be approved by the model',()=>{
 const c=context(),target=source('だんだん','だんだん',['adv']);target.english=['gradually','thanks (regional dialect)'];target.vietnamese={text:'Cảm ơn',sourceId:'fixture',sourceName:'fixture',releaseId:'fixture',method:'dictionary',model:null,promptVersion:null,autoSelected:false};
 c.catalog.push(target,...['また','初めて','よく'].map(t=>source(t,t,['adv'])));
 assert.deepEqual(standardMeanings(target),['gradually']);assert.equal(provenMeaning(target),false);
 const q=question(c,'＿町がにぎやかになりました。',['だんだん','また','初めて','よく'],'context');q.targetId=target.id;q.explanation='Cảm ơn [fixture]';
 assert.ok(hardeningIssues(q,c).includes('TRANSLATION_SENSE_UNPROVEN'));assert.ok(hardeningIssues(q,c).includes('CONTEXT_ADVERB_AMBIGUITY'));
 assert.equal(provenMeaning({...target,vietnamese:{...target.vietnamese,text:'Dần dần'},translationSenseProven:true}),true);
 assert.deepEqual(standardMeanings({english:['(archaic) fixture','(rare, dialect) fixture']}),[]);assert.deepEqual(standardMeanings({english:['rare']}),['rare']);
 assert.equal(translationSenseEvidence(target,{gloss_en:'gradually',pos:['adv']}),true);assert.equal(translationSenseEvidence(target,{gloss_en:'thanks',pos:['adv']}),false);assert.equal(translationSenseEvidence(target,{gloss_en:'gradually',pos:['n']}),false);assert.equal(translationSenseEvidence(target,{gloss_en:'gradually',pos:['adv'],tags:['dialect']}),false);
 const loan={...source('ラジオ','ラジオ'),english:['radio'],vietnamese:{...target.vietnamese,text:'radio'}};c.catalog.push(loan);
 const fallback={...q,type:'reading' as const,targetId:loan.id,sentence:undefined,explanation:'radio [OpenJLPT · EN].'};assert.ok(!hardeningIssues(fallback,c).includes('TRANSLATION_SENSE_UNPROVEN'),'An English fallback sharing a loanword is not use of the unproven Vietnamese row');
});
test('an object plus bare ichidan stem cannot take a negative nominal copula',()=>{
 const c=context(),bad=question(c,'名前を覚えじゃありませんか。',['本','私','学校','日本語'],'context');assert.ok(hardeningIssues(bad,c).includes('SOURCE_INVALID_VERB_COPULA'));
 const good={...bad,sentence:'名前を覚えていますか。'};assert.ok(!hardeningIssues(good,c).includes('SOURCE_INVALID_VERB_COPULA'));
});
test('grammar level is checked against the full OpenJLPT grammar catalog, with attested kana equivalents',()=>{
 const c=context();c.grammarCatalog=[source('〜ずに','',[],'grammar','N3'),source('〜である','',[],'grammar','N2'),source('〜ずに済む','',[],'grammar','N2'),source('〜って','',[],'grammar','N3')];
 for(const sentence of ['鍵を持たずに出ました。','急がずにすむ。','本である。']){
  const q=question(c,sentence,['は','が','を','で']);q.sentence=sentence;assert.ok(hardeningIssues(q,c).includes('GRAMMAR_ABOVE_N4'),sentence);
 }
 const q=question(c,'本を買って帰ります。',['は','が','を','で']);assert.ok(!hardeningIssues(q,c).includes('GRAMMAR_ABOVE_N4'),'A verb te-form must not be confused with a standalone upper-level quotative');
 const formal=question(context(),'そのわけは雨だからである。',['は','が','を','で']);assert.ok(hardeningIssues(formal,context()).includes('GRAMMAR_LEVEL_UNPROVEN'),'No <=N4 source label means quarantine, not an invented source level');
});
test('order keeps auxiliaries and polite inflections indivisible, including negative and explanatory chains',()=>{
 const c=context();for(const form of ['でしょう','だろう','でした','です','ではありません','じゃありません','ます','ました','ません','ましょう','のです','んです','ではありませんでした','ませんでした']){
  const text='明日は休み'+form+'。',start=text.indexOf(form),b=orderBoundaries(text,c);
  for(let cut=start+1;cut<start+form.length;cut++)assert.equal(b.has(cut),false,form+':'+cut);
 }
 const q=question(c,'＿ ★ ＿ ＿',['明日は','たぶん','休みで','しょう。'],'order');q.sentence=q.choices.join('');
 assert.ok(hardeningIssues(q,c).includes('ORDER_WORD_BOUNDARY'));
});
test('order keeps embedded-question no-ka chains in one fragment',()=>{
 const c=context();for(const form of ['のか','のかは','のかどうか']){
  const text='弟が来る'+form+'まだ知りません。',start=text.indexOf(form),b=orderBoundaries(text,c);
  for(let cut=start+1;cut<start+form.length;cut++)assert.equal(b.has(cut),false,form);
 }
 const q=question(c,'＿ ★ ＿ ＿',['弟が','来るの','かは','まだ知りません。'],'order');q.sentence=q.choices.join('');
 assert.ok(hardeningIssues(q,c).includes('ORDER_WORD_BOUNDARY'));
});
test('limiting-particle distractors before a predicate cannot leave a second valid answer',()=>{
 const c=context();for(const particle of ['だけ','も','しか']){
  const q=question(c,'なぜこの町＿静かですか。',['が',particle,'を','で']);
  assert.ok(hardeningIssues(q,c).includes('GRAMMAR_LIMITING_PARTICLE_AMBIGUITY'),particle);
 }
 const q=question(c,'妹は学生＿。',['です','が','を','で']);assert.ok(!hardeningIssues(q,c).includes('GRAMMAR_LIMITING_PARTICLE_AMBIGUITY'));
});
test('upper-level matching respects complete tokens and sourced lower-level functions, never blanket surface exemptions',()=>{
 const c=context(),lower=['〜まで','〜までに','〜くらい','〜こと','〜ことができる','〜ことにする','〜ので','〜のに','あまり〜ない'].map(t=>source(t,'',[],'grammar','N4'));
 c.boundaryWords!.push(source('金曜日','きんようび',['n-t']));
 c.grammarCatalog=[...lower,...['〜まで','〜くらい','〜こと','〜ことに','〜って'].map(t=>source(t,'',[],'grammar','N3')),{...source('〜あまり','',[],'grammar','N2'),id:'upper-adverb'}];
 for(const sentence of ['金曜日まで待ちます。','三時間くらい読みます。','読むことを選びました。','日本語を話すことができます。','明日出ることにしました。','私はあまり泳ぎません。','本を買って帰りました。']){
  assert.deepEqual(grammarLevelMatches(sentence,c),[],sentence);
 }
 assert.ok(grammarLevelMatches('先生まで来ました。',c).some(m=>m.uncertain),'A polysemous surface without lower evidence stays quarantined');
 assert.ok(grammarLevelMatches('心配のあまり眠れません。',c).some(m=>m.level==='N2'&&!m.uncertain));
 const upper=c.grammarCatalog.find(s=>s.title==='〜まで'&&s.level==='N3')!,e={id:'authored-upper',targetId:upper.id,text:'先生まで笑いました。',notation:null,english:'Authored even-use fixture',sourceId:'fixture',releaseId:'fixture',attribution:'Authored'};
 c.examples=[e];assert.ok(grammarLevelMatches(e.text,c,e).some(m=>!m.uncertain));
 const q=question(c,'先生＿来ました。',['が','を','で','に']);q.sentence='先生まで来ました。';assert.ok(hardeningIssues(q,c).includes('GRAMMAR_LEVEL_UNPROVEN'));
});

test('motion destinations exclude made as an alternate answer',()=>{
 const c=context(),code='GRAMMAR_MOTION_MADE_AMBIGUITY';
 for(const [stem,answer] of [['きょう、学校＿帰ります。','へ'],['学校＿来ました。','に'],['学校＿いきません。','へ']]){
  const q=question(c,stem,['まで',answer,'で','が'],'grammar',1);
  assert.ok(hardeningIssues(q,c).includes(code));
  assert.ok(!hardeningIssues({...q,choices:['と',answer,'で','が']},c).includes(code));
 }
 const stationary=question(c,'学校＿本があります。',['まで','に','で','が'],'grammar',1);
 assert.ok(!hardeningIssues(stationary,c).includes(code));
});
test('time noun blanks reject another source-attested time noun',()=>{
 const c=context(),code='CONTEXT_TIME_NOUN_AMBIGUITY';
 const target={...source('さくや','さくや',['n','adv']),english:['last night']};
 const duration={...source('一月','ひとつき',['n']),english:['one month']};
 c.catalog.push(duration,target);
 const q=question(c,'＿本を読みました。',['本','さくや','学校','一月'],'context',1);
 assert.ok(hardeningIssues(q,c).includes(code));
 assert.ok(!hardeningIssues({...q,choices:['本','さくや','学校','日本語']},c).includes(code));
});
