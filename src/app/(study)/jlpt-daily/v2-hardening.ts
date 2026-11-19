import type {V2Context,V2Source,Example} from './v2-data.ts';
import type {V2Question} from './deterministic.ts';
import {roadmapLexicon} from './word-evidence.ts';
import {learnedGrammarForms} from './confusion-groups.ts';
const restricted=/\b(?:dialect(?:al)?|archaic|obsolete|rare|regional|dated|Izumo)\b/iu;
const restrictedMeaning=(text:string)=>[...text.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/gu)].some(m=>restricted.test(m[1]??m[2]))||/^(?:dialect(?:al)?|archaic|obsolete|rare|regional|dated|Izumo)\s*:/iu.test(text);
export const standardMeanings=(s:Pick<V2Source,'english'>)=>s.english.filter(v=>!restrictedMeaning(v));
export function translationSenseEvidence(s:Pick<V2Source,'english'|'pos'>,raw:unknown){
 if(!raw||typeof raw!=='object')return false;const e=raw as Record<string,unknown>;
 return typeof e.gloss_en==='string'&&standardMeanings(s).includes(e.gloss_en)&&Array.isArray(e.pos)&&e.pos.some(p=>typeof p==='string'&&s.pos.includes(p))&&!restricted.test(JSON.stringify([e.tags??[],e.register??'',e.dialect??'']));
}
export function provenMeaning(s:V2Source){return !!s.vietnamese&&s.translationSenseProven===true&&!restrictedMeaning(s.vietnamese.text)&&standardMeanings(s).length>0;}
type Index={words:Map<string,string[]>;adverbs:Set<string>;verbStems:string[]};
const indexes=new WeakMap<V2Context,Index>(),boundariesCache=new WeakMap<V2Context,Map<string,Set<number>>>();
function index(c:V2Context){
 let value=indexes.get(c);if(value)return value;
 const vocabulary=(c.boundaryWords??c.dictionary).filter(s=>s.kind==='vocab'),words=new Map<string,string[]>(),adverbs=new Set(['また','いっしょに','一緒に']),verbStems:string[]=[];
 // These surfaces prove segmentation only. They never license a target, character or word.
 for(const word of roadmapLexicon(vocabulary))if(word.length>=2){const rows=words.get(word[0])??[];rows.push(word);words.set(word[0],rows);}
 for(const s of vocabulary)for(const word of [s.title,s.reading??''].filter(Boolean)){
  if(s.pos.some(p=>p.startsWith('adv')))adverbs.add(word);
  if(s.pos.some(p=>p.startsWith('v1'))&&word.endsWith('る')&&word.length>=3)verbStems.push(word.slice(0,-1));
 }
 value={words,adverbs,verbStems};indexes.set(c,value);return value;
}
export function orderBoundaries(text:string,c:V2Context,example?:Example){
 let cache=boundariesCache.get(c);if(!cache){cache=new Map();boundariesCache.set(c,cache);}const key=text+'\0'+(example?.notation??'');const saved=cache.get(key);if(saved)return saved;
 const boundaries=new Set([0,text.length,...[...new Intl.Segmenter('ja',{granularity:'word'}).segment(text)].flatMap(t=>[t.index,t.index+t.segment.length])]);
 const protectedSpans:{start:number;end:number}[]=[],protect=(start:number,end:number)=>{protectedSpans.push({start,end});boundaries.add(start);boundaries.add(end);};
 // ICU may split an auxiliary or embedded question; order fragments must not.
 for(const form of ['でしょう','だろう','でした','です','ではありませんでした','ではありません','じゃありませんでした','じゃありません','ませんでした','ます','ました','ません','ましょう','のです','んです','のかどうか','のかは','のか']){
  let at=text.indexOf(form);while(at>=0){protect(at,at+form.length);at=text.indexOf(form,at+1);}
 }
 for(let start=0;start<text.length;start++)for(const word of index(c).words.get(text[start])??[])if(text.startsWith(word,start))protect(start,start+word.length);
 if(example?.notation&&example.notation.replace(/\{([^{}|]+)\|([^{}|]+)\}/gu,'$1')===example.text){
  let rendered='',from=0;const spans:{start:number;end:number}[]=[];
  for(const m of example.notation.matchAll(/\{([^{}|]+)\|([^{}|]+)\}/gu)){
   rendered+=example.notation.slice(from,m.index);const value=[...m[1]].filter(ch=>/\p{Script=Han}/u.test(ch)).every(ch=>c.knownKanji.includes(ch))?m[1]:m[2];
   spans.push({start:rendered.length,end:rendered.length+value.length});rendered+=value;from=m.index!+m[0].length;
  }
  rendered+=example.notation.slice(from);if(rendered.normalize('NFC')===text)for(const span of spans)protect(span.start,span.end);
 }
 for(const span of protectedSpans)for(let i=span.start+1;i<span.end;i++)boundaries.delete(i);
 cache.set(key,boundaries);return boundaries;
}
const casePhrase=(text:string)=>{
 const value=text.replace(/[、，\s]/gu,'');
 return /(?:を|で|に|が|へ|と|から)$/u.test(value);
};
const grammarCache=new WeakMap<V2Context,{id:string;surface:string;level:string}[]>();
function upperGrammar(c:V2Context){
 let rows=grammarCache.get(c);if(rows)return rows;
 const grammar=(c.grammarCatalog??c.catalog).filter(s=>s.kind==='grammar'&&['N1','N2','N3'].includes(s.level));
 const conversions=(c.boundaryWords??c.dictionary).filter(s=>s.kind==='vocab'&&s.reading&&/\p{Script=Han}/u.test(s.title)).sort((a,b)=>b.title.length-a.title.length);
 rows=learnedGrammarForms(grammar).flatMap(form=>{
  const level=grammar.find(s=>s.id===form.id)!.level;
  if(form.surface.length<2||/[\p{Script=Latin}〜～~+()[\]（）]/u.test(form.surface))return [];
  let kana=form.surface;for(const word of conversions)if(kana.includes(word.title))kana=kana.replaceAll(word.title,word.reading!);
  return [...new Set([form.surface,kana])].map(surface=>({id:form.id,surface,level}));
 });grammarCache.set(c,rows);return rows;
}
const lowerCache=new WeakMap<V2Context,ReturnType<typeof learnedGrammarForms>>();
function lowerGrammar(c:V2Context){
 let rows=lowerCache.get(c);if(rows)return rows;
 rows=learnedGrammarForms((c.grammarCatalog??c.catalog).filter(s=>['N4','N5'].includes(s.level))).flatMap(f=>{
  const forms=[f.surface];for(const [base,variants]of [['する',['します','しました','した','しています']],['なる',['なります','なりました','なった']],['ある',['あります','ありました','あった']],['できる',['できます','できました','できた']]] as const)if(f.surface.endsWith(base))for(const ending of variants)forms.push(f.surface.slice(0,-base.length)+ending);
  return forms.map(surface=>({...f,surface}));
 });lowerCache.set(c,rows);return rows;
}
// Source labels that share a surface need functional evidence, not a substring veto.
export function grammarLevelMatches(sentence:string,c:V2Context,example?:Example){
 const edges=orderBoundaries(sentence,c,example),ends=new Set([...new Intl.Segmenter('ja',{granularity:'word'}).segment(sentence)].map(t=>t.index+t.segment.length)),lower=lowerGrammar(c);
 const attested=(id:string)=>example?.targetId===id&&c.examples.some(e=>e.id===example.id&&e.text===example.text&&e.targetId===id);
 const lowerSpans=lower.filter(f=>f.surface.length>1&&!/[\p{Script=Latin}〜～~+()[\]（）]/u.test(f.surface)).flatMap(f=>{
  const spans=[];let at=sentence.indexOf(f.surface);while(at>=0){if(edges.has(at)&&ends.has(at+f.surface.length))spans.push({...f,start:at,end:at+f.surface.length});at=sentence.indexOf(f.surface,at+1);}return spans;
 });
 return upperGrammar(c).flatMap(g=>{
  const matches:{surface:string;level:string;uncertain:boolean}[]=[];let at=sentence.indexOf(g.surface);
  while(at>=0){const end=at+g.surface.length,before=sentence.slice(0,at),after=sentence.slice(end);if(edges.has(at)){
   const covers=lowerSpans.filter(l=>l.start<=at&&l.end>=end),direct=attested(g.id);
   let provenLower=!direct&&covers.some(l=>l.end-l.start>g.surface.length||attested(l.id));
   const shared=lower.some(l=>l.surface===g.surface);
   if(!direct&&shared){
    if(g.surface==='こと'&&/^(?:が|を|は|も|に|の)/u.test(after))provenLower=true;
    if(g.surface==='まで'&&((c.boundaryWords??c.dictionary).some(w=>w.kind==='vocab'&&w.pos.includes('n-t')&&[w.title,w.reading??''].some(v=>v&&before.endsWith(v)))||/[0-9０-９一二三四五六七八九十百]+(?:時|分|日|月|年|時間)$/u.test(before)))provenLower=true;
    if(['くらい','ぐらい'].includes(g.surface)&&/[0-9０-９一二三四五六七八九十百]+(?:時間|時|分|日|月|年|人|個|本|枚|円|回)?$/u.test(before))provenLower=true;
   }
   if(!direct&&g.surface==='あまり'&&lower.some(l=>l.surface==='あまり〜ない')&&/(?:^|[はがを])$/u.test(before)&&/^[^。？！!?]*(?:ない|ません)/u.test(after))provenLower=true;
   if(!provenLower)matches.push({surface:g.surface,level:g.level,uncertain:!direct&&shared});
  }at=sentence.indexOf(g.surface,at+1);}
  return matches;
 });
}
export function hardeningIssues(q:V2Question,c:V2Context){
 const issues:string[]=[],source=c.catalog.find(s=>s.id===q.targetId);if(!source)return issues;
 if(!standardMeanings(source).length)issues.push('NO_STANDARD_MEANING');
 if(source.vietnamese&&!provenMeaning(source)&&q.explanation.includes(`${source.vietnamese.text} [${source.vietnamese.sourceId}`))issues.push('TRANSLATION_SENSE_UNPROVEN');
 const sentence=q.sentence??'';
 if(sentence){
  if(index(c).verbStems.some(stem=>sentence.includes('を'+stem+'じゃ')||sentence.includes('を'+stem+'では')))issues.push('SOURCE_INVALID_VERB_COPULA');
  const matches=grammarLevelMatches(sentence,c,q.example);
  if(matches.some(g=>!g.uncertain))issues.push('GRAMMAR_ABOVE_N4');
  if(matches.some(g=>g.uncertain))issues.push('GRAMMAR_LEVEL_UNPROVEN');
  if(sentence.includes('である')&&!learnedGrammarForms((c.grammarCatalog??c.catalog).filter(s=>s.kind==='grammar'&&['N5','N4'].includes(s.level))).some(form=>form.surface==='である'))issues.push('GRAMMAR_LEVEL_UNPROVEN');
 }
 if(q.type==='order'&&Array.isArray(q.order)&&q.order.length===4&&q.order.every(i=>Number.isInteger(i)&&i>=0&&i<4)){
  const fragments=q.order.map(i=>q.choices[i]),match=q.stem.match(/(?:＿|★)(?:\s+(?:＿|★)){3}/u),allowed=orderBoundaries(sentence,c,q.example);let offset=match?.index??0;
  const cuts=[offset];for(const fragment of fragments){offset+=fragment.length;cuts.push(offset);}
  if(cuts.some(cut=>!allowed.has(cut)))issues.push('ORDER_WORD_BOUNDARY');
  // Conservatively reject multiple free arguments/adjuncts; never trust a model
  // selecting just one of the grammatically valid scrambled orders.
  const movable=fragments.filter(f=>casePhrase(f)||index(c).adverbs.has(f.replace(/[、，\s]/gu,'')));
  if(movable.length>=2)issues.push('ORDER_SCRAMBLING');
 }
 if(q.type==='grammar'){
  const hole=q.stem.indexOf('＿'),before=q.stem.slice(0,hole),after=q.stem.slice(hole).replace(/^＿+/u,'');
  if(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(after)&&q.choices.some((v,i)=>i!==q.correct&&['だけ','も','しか'].includes(v)))issues.push('GRAMMAR_LIMITING_PARTICLE_AMBIGUITY');
  if(/^[かねよの。？！!?\s]*$/u.test(after)&&q.choices.some((v,i)=>i!==q.correct&&['じゃない','でした','でしょう'].includes(v)))issues.push('GRAMMAR_COPULA_AMBIGUITY');
  if(q.choices.includes('から')&&/(?:ます|ました|ません)$/u.test(before)&&/^[。？！!?\s]*$/u.test(after))issues.push('GRAMMAR_FINAL_KARA_AMBIGUITY');
  if(q.choices.includes('だけ')&&/^(?:ある|あります|です|だ)[。？！!?\s]*$/u.test(after))issues.push('GRAMMAR_DAKE_AMBIGUITY');
  if(q.choices.includes('から')&&/^[^。？！!?]*(?:買[ういっ]|か(?:う|いたい|います|いました))/u.test(after))issues.push('GRAMMAR_BUY_KARA_AMBIGUITY');
 }
 if(q.type==='context'&&source.pos.some(p=>p.startsWith('adv'))&&q.choices.some((v,i)=>i!==q.correct&&c.catalog.some(s=>s.kind==='vocab'&&s.title===v&&s.pos.some(p=>p.startsWith('adv')))))issues.push('CONTEXT_ADVERB_AMBIGUITY');
 return [...new Set(issues)];
}
