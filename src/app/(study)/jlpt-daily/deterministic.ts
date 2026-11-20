import {toHiragana,toKatakana} from 'wanakana';
import {hash,fingerprint,requireValue,type Question,type Draft,type QuestionType} from './model.ts';
import {plainJapanese,hardQuestionIssues,strictDraftIssues,draftCollisionIssues,samePartOfSpeech} from './hard-qa.ts';
import {draftContextLexicon} from './word-evidence.ts';
import {confusionGroups,learnedGrammarForms} from './confusion-groups.ts';
import {safeExample,exampleEvidence,type V2Context,type V2Source,type Example} from './v2-data.ts';
import {hardeningIssues,orderBoundaries,provenMeaning,standardMeanings} from './v2-hardening.ts';
import {matchesGrammarFunction} from './grammar-function.ts';
import type {QuestionProvenance} from './draft-provider.ts';
export type Distractor={value:string;rule:string;sourceIds:string[]};
export type V2Question=Question&{mode:V2Context['mode'];version:2;example?:Example;sentence?:string;distractors:Distractor[];sourceHash:string;provenance?:QuestionProvenance};
const kana=(s:string)=>/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(s)&&!/[ゃゅょぁぃぅぇぉっャュョァィゥェォッ]/u.test(s[0]??'');
const containsHan=(s:string)=>/\p{Script=Han}/u.test(s);
const charsKnown=(s:string,c:V2Context)=>[...s].filter(containsHan).every(k=>c.knownKanji.includes(k));
const wordEdges=(sentence:string)=>new Set([...new Intl.Segmenter('ja',{granularity:'word'}).segment(sentence)].flatMap(t=>[t.index,t.index+t.segment.length]));
function grammarOccurrence(source:V2Source,surface:string,sentence:string,edges:Set<number>,from=0,to=sentence.length){
 if(!surface)return -1;
 for(let start=sentence.indexOf(surface,from);start>=0&&start+surface.length<=to;start=sentence.indexOf(surface,start+1)){
  if(edges.has(start)&&edges.has(start+surface.length)&&matchesGrammarFunction(source,surface,sentence,start))return start;
 }
 return -1;
}
const stable=<T>(rows:T[],seed:string,key:(v:T)=>string)=>[...rows].sort((a,b)=>hash(seed+key(a)).localeCompare(hash(seed+key(b))));
const distinct=(rows:Distractor[],answer:string)=>{const seen=new Map<string,Distractor>();for(const r of rows)if(r.value!==answer&&!seen.has(r.value.normalize('NFKC')))seen.set(r.value.normalize('NFKC'),r);return [...seen.values()];};
export function readingNoise(source:V2Source,c:V2Context):Distractor[]{
 if(!source.reading)return [];const original=source.reading,base=toHiragana(original),style=(s:string)=>/^[\p{Script=Katakana}ー]+$/u.test(original)?toKatakana(s):s,rows:Distractor[]=[];
 const add=(value:string,rule:string,sourceIds=[source.id])=>{value=style(value);if(kana(value)&&!/[っッ]{2}/u.test(value))rows.push({value,rule,sourceIds});};
 for(let i=0;i<base.length-1;i++){const first=base[i],tail=base[i+1];if(/[おこごそぞとどのほぼぽもよろ]/u.test(first)&&['う','お'].includes(tail)){add(base.slice(0,i+1)+(tail==='う'?'お':'う')+base.slice(i+2),'long-vowel');add(base.slice(0,i+1)+base.slice(i+2),'long-vowel');}if(/[えけげせぜてでねへべぺめれ]/u.test(first)&&tail==='い'){add(base.slice(0,i+1)+'え'+base.slice(i+2),'long-vowel');add(base.slice(0,i+1)+base.slice(i+2),'long-vowel');}}
 for(const [from,forms]of [['おう',['おお','お']],['おお',['おう','お']],['えい',['ええ','え']],['ええ',['えい','え']],['うう',['う']],['いい',['い']],['ー',['']]] as const)for(let i=0;i<base.length;i++)if(base.startsWith(from,i))for(const form of forms)add(base.slice(0,i)+form+base.slice(i+from.length),'long-vowel');
 for(let i=0;i<base.length;i++){if(base[i]==='っ')add(base.slice(0,i)+base.slice(i+1),'sokuon');else if(i>0&&/[かきくけこさしすせそたちつてとはひふへほぱぴぷぺぽ]/u.test(base[i]))add(base.slice(0,i)+'っ'+base.slice(i),'sokuon');}
 for(const group of ['かが','きぎ','くぐ','けげ','こご','さざ','しじ','すず','せぜ','そぞ','ただ','ちぢ','つづ','てで','とど','はばぱ','ひびぴ','ふぶぷ','へべぺ','ほぼぽ'])for(let i=0;i<base.length;i++)if(group.includes(base[i]))for(const char of group)if(char!==base[i])add(base.slice(0,i)+char+base.slice(i+1),'dakuten-handakuten');
 for(const other of c.catalog)if(other.kind==='vocab'&&other.id!==source.id&&other.reading&&[...source.title].some(ch=>containsHan(ch)&&other.title.includes(ch)))add(toHiragana(other.reading),'shared-kanji',[other.id]);
 for(const k of c.catalog.filter(k=>k.kind==='kanji'&&source.title.includes(k.title)))for(const from of k.on.map(v=>toHiragana(v)).filter(kana))if(base.includes(from))for(const to of k.on.map(v=>toHiragana(v)).filter(kana))if(from!==to)add(base.replace(from,to),'other-on',[k.id]);
 return distinct(rows,original);
}
export const shapeGroups=['日曰目白田','土士','木本未末','人入八','大太犬','牛午','千干','力刀','待持','問間'];
export function spellingNoise(source:V2Source,c:V2Context):Distractor[]{
 const rows:Distractor[]=[];
 const kanji=c.catalog.filter(k=>k.kind==='kanji');
 const readings=(k:V2Source)=>new Set([...k.on,...k.kun??[]].map(v=>toHiragana(v.replaceAll('-','').split('.')[0])).filter(Boolean));
 const homophones=new Set(c.dictionary.filter(w=>w.kind==='vocab'&&w.reading&&toHiragana(w.reading)===toHiragana(source.reading??'')).map(w=>plainJapanese(w.title)));
 for(const [i,ch] of [...source.title].entries()){
  const original=kanji.find(k=>k.title===ch);
  if(!original)continue;
  const sounds=readings(original);
  for(const other of kanji){
   if(ch===other.title)continue;
   const similar=shapeGroups.some(g=>g.includes(ch)&&g.includes(other.title));
   if(!similar&&![...readings(other)].some(r=>sounds.has(r)))continue;
   const value=[...source.title].map((v,n)=>n===i?other.title:v).join('');
   if(!homophones.has(value))rows.push({value,rule:similar?'similar-shape':'same-sound',sourceIds:[original.id,other.id]});
  }
 }
 return distinct(rows,source.title);
}
const lexicons=new WeakMap<V2Context,Set<string>>();
const meaning=(s:V2Source)=>provenMeaning(s)?`${s.vietnamese!.text} [${s.vietnamese!.sourceId}${s.vietnamese!.model?' · '+s.vietnamese!.model:''}]`:`${standardMeanings(s).join('; ')} [OpenJLPT · EN]`;
function explanation(q:Pick<V2Question,'type'|'correct'|'choices'|'order'|'sentence'|'example'>,s:V2Source){
 const label=`${s.title}${s.reading?' — '+s.reading:''}: ${meaning(s)}.`;
 // A borrowed example attests the sentence, not the function of a matching particle.
 const grammarLabel=q.example?.targetId===s.id?` ${label}`:'';
 if(q.type==='order')return `Thứ tự: ${q.order.map(i=>i+1).join('→')}. ★=${q.correct+1}. Câu: 「${q.sentence}」${grammarLabel}`;
 if(q.type==='grammar')return `Đáp án ${q.correct+1}: 「${q.choices[q.correct]}」. Câu: 「${q.sentence}」${grammarLabel}`;
 return `Đáp án ${q.correct+1}: 「${q.choices[q.correct]}」. ${label}`;
}
function make(c:V2Context,s:V2Source,type:QuestionType,stem:string,answer:string,noise:Distractor[],extra:Partial<V2Question>={}):V2Question{
 const ranks:Record<string,number>={'long-vowel':0,'same-sound':0,'similar-shape':1,'sokuon':1,'other-on':1,'dakuten-handakuten':2,'shared-kanji':2,'one-known-kanji':3};const picked=stable(distinct(noise,answer),c.date+s.id+type,r=>r.rule+':'+r.value).sort((a,b)=>(ranks[a.rule]??0)-(ranks[b.rule]??0)).slice(0,3);requireValue(picked.length===3,'INSUFFICIENT_DISTRACTORS');
 const choices=stable([answer,...picked.map(r=>r.value)],c.date+s.id+stem,v=>v),correct=choices.indexOf(answer),fp=fingerprint(stem);
 const q:V2Question={version:2,mode:c.mode,id:hash({date:c.date,type,target:s.id,fp}).slice(0,32),date:c.date,fingerprint:fp,day:0,position:0,type,targetId:s.id,stem,choices,correct,explanation:'',order:[],starSlot:0,distractors:picked,sourceHash:s.hash,...extra};q.explanation=explanation(q,s);return q;
}
// Boundaries follow source phrases (particles terminate a phrase); no sentence
// or inflection is generated. Order windows leave attested fixed context visible.
export function phrases(text:string,allowed?:ReadonlySet<number>){
 const parts:string[]=[];let pending='';
 const tokens=[...new Intl.Segmenter('ja',{granularity:'word'}).segment(text)];
 for(const [i,t] of tokens.entries()){
  pending+=t.segment;
  const next=tokens[i+1]?.segment??'';
  if((!allowed||allowed.has(t.index+t.segment.length))&&(/[、，]$/u.test(pending)||(['は','が','を','に','で','へ','と','も','の','から','まで','より'].includes(t.segment)&&next&&!['は','も','して','し','する','なる','なっ','い','いる'].includes(next)))){
   parts.push(pending);pending='';
  }
 }
 if(pending)parts.push(pending);
 return parts;
}
export function validateV2(q:V2Question,c:V2Context,history:Question[]=[]){
 const s=c.catalog.find(s=>s.id===q.targetId);requireValue(s&&s.level===c.level&&s.hash===q.sourceHash,'SOURCE_NOT_LEARNED_OR_CHANGED');
 requireValue(!s.translationReported,'TRANSLATION_REPORTED_OPEN');
 requireValue(Number.isInteger(q.day)&&q.day>=0&&q.day<7&&Number.isInteger(q.position)&&q.position>=0&&q.position<10,'INVALID_DAY_POSITION');
 requireValue(supportedTypes.includes(q.type as any),'UNSUPPORTED_DATA_TYPE');requireValue(q.version===2&&q.mode===c.mode&&q.date===c.date&&q.stem.trim()&&q.stem.length<=2200&&q.explanation.trim()&&q.explanation.length<=1600,'INVALID_QUESTION');
 requireValue(q.choices.length===4&&q.choices.every(v=>typeof v==='string'&&v.trim()&&v.length<=350&&/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(v)&&v===v.normalize('NFC'))&&new Set(q.choices.map(v=>v.normalize('NFKC').trim())).size===4&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4,'ONE_DISTINCT_ANSWER_REQUIRED');
 requireValue(charsKnown(q.stem+q.choices.join(''),c),'UNLEARNED_KANJI');
 requireValue(['grammar','order'].includes(q.type)?s.kind==='grammar':s.kind==='vocab','SOURCE_KIND');
 requireValue(q.type==='order'||q.choices[q.correct]===(q.type==='reading'?s.reading:plainJapanese(s.title)),'ANSWER_SOURCE_EVIDENCE');
 // V2's two source-derived noise gates replace the legacy nearby-dictionary
 // restrictions; every other hard gate stays shared and unchanged.
 const hardened=hardeningIssues(q,c);requireValue(!hardened.length,'HARDENING_'+hardened.join(','));
 requireValue(q.explanation===explanation(q,s),'EXPLANATION_SOURCE_MISMATCH');
 const issues=hardQuestionIssues(q,s,c.catalog).filter(i=>!(q.type==='reading'&&i==='READING_NEAR_SAME_LEVEL_DISTRACTORS')&&!(q.type==='spelling'&&i==='SPELLING_NEAR_DISTRACTORS'));
 requireValue(!issues.length,'HARD_QA_'+issues.join(','));
 if(q.type==='reading'||q.type==='spelling'){
  const allowed=q.type==='reading'?readingNoise(s,c):spellingNoise(s,c);requireValue(q.choices.every((v,i)=>i===q.correct||allowed.some(n=>n.value===v))&&q.distractors.length===3&&q.distractors.every(n=>allowed.some(a=>hash(a)===hash(n))),'UNPROVEN_DISTRACTOR');
 }
 if(['grammar','order','context'].includes(q.type))exampleEvidence(q,c);
 if(q.type==='grammar'){const group=confusionGroups.find(g=>g.surfaces.includes(plainJapanese(s.title)));requireValue(group&&q.choices.every(v=>group.surfaces.includes(v)&&learnedGrammarForms(c.catalog).some(o=>o.surface===v)),'GRAMMAR_GROUP_NOT_LEARNED');}
 if(q.type==='context')requireValue(q.choices.every(v=>c.catalog.some(o=>o.kind==='vocab'&&plainJapanese(o.title)===v&&samePartOfSpeech(s,o))),'CONTEXT_DISTRACTOR_POS');
 if(q.type==='grammar'||q.type==='context')requireValue(q.stem.replace(/＿+/u,q.choices[q.correct])===q.sentence,'EXAMPLE_RECONSTRUCTION');
 if(q.type==='order')requireValue(q.stem.replace(/(?:＿|★)(?:\s+(?:＿|★)){3}/u,q.order.map(i=>q.choices[i]).join(''))===q.sentence,'EXAMPLE_RECONSTRUCTION');
 if(q.type==='grammar'||q.type==='order'){
  const sentence=q.sentence!, edges=wordEdges(sentence);
  const start=q.stem.search(q.type==='grammar'?/＿/u:/＿|★/u);
  const length=q.type==='grammar'?q.choices[q.correct].length:q.order.map(i=>q.choices[i]).join('').length;
  const forms=q.type==='grammar'?[q.choices[q.correct]]:learnedGrammarForms([s]).map(f=>f.surface);
  requireValue(start>=0&&forms.some(form=>grammarOccurrence(s,form,sentence,edges,start,start+length)>=0),'GRAMMAR_FUNCTION_UNPROVEN');
 }
 if(!lexicons.has(c))lexicons.set(c,draftContextLexicon(c.catalog,c.dictionary));const lexical=strictDraftIssues(q,lexicons.get(c)!);requireValue(!lexical.length,'STRICT_QA_'+lexical.join(','));
 const collisions=draftCollisionIssues(q,history.filter(h=>Math.abs(Date.parse(h.date)-Date.parse(q.date))<=30*86400000),c.catalog);requireValue(!collisions.length,'COLLISION_'+collisions.join(','));
 requireValue(!history.some(h=>h.fingerprint===fingerprint(q.stem)&&Math.abs(Date.parse(h.date)-Date.parse(q.date))<=30*86400000),'REPEATED_WITHIN_THIRTY_DAYS');
 requireValue(q.fingerprint===fingerprint(q.stem),'FINGERPRINT_CHANGED');return q;
}
export type CandidateDiagnostic={date:string;type:QuestionType;reason:string;stem:string;answer:string;targetId:string;group:string[];learned:{id:string;surface:string}[];eligible:string[]};
export function candidates(c:V2Context,report?: (row:CandidateDiagnostic)=>void){
 const questions:V2Question[]=[],rejected:Record<string,number>={};const attempt=(fn:()=>V2Question)=>{try{const q=fn();validateV2(q,c);questions.push(q);}catch(e){const reason=e instanceof Error?e.message:'INVALID';rejected[reason]=(rejected[reason]??0)+1;}};
 const forms=learnedGrammarForms(c.catalog);
 const parents=new Set(c.catalog.filter(x=>x.kind==='vocab').map(x=>x.id));
 for(const s of c.catalog){
  if(s.kind==='vocab'&&s.reading&&s.title===plainJapanese(s.title)&&charsKnown(s.title,c)&&containsHan(s.title)){
   attempt(()=>make(c,s,'reading',`【${s.title}】のよみかたはどれですか。`,s.reading!,readingNoise(s,c)));
   attempt(()=>make(c,s,'spelling',`【${s.reading}】のかんじはどれですか。`,s.title,spellingNoise(s,c)));
  }
  const surfaces=s.kind==='grammar'?forms.filter(o=>o.id===s.id).map(o=>o.surface).filter(v=>v && !/[〜～~]/u.test(v)) : [];
  const examples=c.examples.filter(e=>e.targetId===s.id||(s.kind==='grammar'&&parents.has(e.targetId)&&surfaces.some(v=>e.text.includes(v))));
  for(const example of examples){
   const sentence=safeExample(example,c);if(!sentence)continue;const surface=plainJapanese(s.title),boundaries=wordEdges(sentence);
   const start=grammarOccurrence(s,surface,sentence,boundaries);
   if(start>=0&&surface&&charsKnown(surface,c)){
    const stem=sentence.slice(0,start)+'＿'+sentence.slice(start+surface.length),group=confusionGroups.find(g=>g.surfaces.includes(surface));
    const noise=s.kind==='grammar' ? forms.filter(o=>o.id!==s.id && group?.surfaces.includes(o.surface) && !stem.includes(o.surface) && charsKnown(o.surface,c)).map(o=>({value:o.surface,rule:'confusion-group',sourceIds:[o.id]}))
     : c.catalog.filter(o=>o.kind==='vocab'&&o.id!==s.id&&charsKnown(o.title,c)&&!stem.includes(plainJapanese(o.title))&&samePartOfSpeech(s,o)).map(o=>({value:plainJapanese(o.title),rule:'same-pos',sourceIds:[o.id]}));
    if(report && group && s.kind==='grammar' && distinct(noise,surface).length<3)report({date:c.date,type:'grammar',reason:'INSUFFICIENT_DISTRACTORS',stem,answer:surface,targetId:s.id,group:group.surfaces,learned:forms.filter(o=>group.surfaces.includes(o.surface)),eligible:distinct(noise,surface).map(n=>n.value)});
    if(s.kind==='grammar'&&group||s.kind==='vocab')attempt(()=>make(c,s,s.kind==='grammar'?'grammar':'context',stem,surface,noise,{example,sentence}));
   }
   // Order can use any explicitly taught spelling of the pattern in a sourced sentence.
   // Do not infer an isolated particle from inside a composite pattern.
   const orderMatch=s.kind==='grammar'?surfaces.map(value=>({index:grammarOccurrence(s,value,sentence,boundaries),value})).find(m=>m.index>=0):undefined;
   if(orderMatch){
    const parts=phrases(sentence,orderBoundaries(sentence,c,example));for(let from=0;from+4<=parts.length;from++)if(parts.length>=4){const fragments=parts.slice(from,from+4);const offset=parts.slice(0,from).join('').length;if(orderMatch.index<offset||orderMatch.index+orderMatch.value.length>offset+fragments.join('').length)continue;
     attempt(()=>{const choices=stable(fragments,c.date+example.id,v=>v),order=fragments.map(f=>choices.indexOf(f)),starSlot=1,stem=parts.slice(0,from).join('')+'＿ ★ ＿ ＿'+parts.slice(from+4).join(''),correct=order[starSlot],fp=fingerprint(stem);const q:V2Question={version:2,mode:c.mode,id:hash({date:c.date,target:s.id,fp}).slice(0,32),date:c.date,fingerprint:fp,day:0,position:0,type:'order',targetId:s.id,stem,choices,correct,order,starSlot,distractors:[],sourceHash:s.hash,example,sentence,explanation:''};q.explanation=explanation(q,s);return q;});
    }
   }
  }
 }
 return {questions:[...new Map(questions.map(q=>[q.id,q])).values()],rejected};
}
export function dailyMix(questions:V2Question[]){return questions.length===10&&new Set(questions.map(q=>q.type)).size>=3&&questions.some(q=>['grammar','order'].includes(q.type))&&questions.some(q=>!['grammar','order'].includes(q.type));}
export const supportedTypes=['reading','spelling','grammar','order','context'] as const;
