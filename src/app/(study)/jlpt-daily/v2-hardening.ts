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
const grammarCache=new WeakMap<V2Context,{surface:string;level:string}[]>();
function upperGrammar(c:V2Context){
 let rows=grammarCache.get(c);if(rows)return rows;
 const grammar=(c.grammarCatalog??c.catalog).filter(s=>s.kind==='grammar'&&['N1','N2','N3'].includes(s.level));
 const conversions=(c.boundaryWords??c.dictionary).filter(s=>s.kind==='vocab'&&s.reading&&/\p{Script=Han}/u.test(s.title)).sort((a,b)=>b.title.length-a.title.length);
 rows=learnedGrammarForms(grammar).flatMap(form=>{
  const level=grammar.find(s=>s.id===form.id)!.level;
  if(form.surface.length<2||/[\p{Script=Latin}〜～~+()[\]（）]/u.test(form.surface))return [];
  let kana=form.surface;for(const word of conversions)if(kana.includes(word.title))kana=kana.replaceAll(word.title,word.reading!);
  return [...new Set([form.surface,kana])].map(surface=>({surface,level}));
 });grammarCache.set(c,rows);return rows;
}
export function hardeningIssues(q:V2Question,c:V2Context){
 const issues:string[]=[],source=c.catalog.find(s=>s.id===q.targetId);if(!source)return issues;
 if(!standardMeanings(source).length)issues.push('NO_STANDARD_MEANING');
 if(source.vietnamese&&!provenMeaning(source)&&q.explanation.includes(`${source.vietnamese.text} [${source.vietnamese.sourceId}`))issues.push('TRANSLATION_SENSE_UNPROVEN');
 const sentence=q.sentence??'';
 if(sentence){
  if(index(c).verbStems.some(stem=>sentence.includes('を'+stem+'じゃ')||sentence.includes('を'+stem+'では')))issues.push('SOURCE_INVALID_VERB_COPULA');
  const starts=orderBoundaries(sentence,c,q.example);
  if(upperGrammar(c).some(g=>{let at=sentence.indexOf(g.surface);while(at>=0){if(starts.has(at))return true;at=sentence.indexOf(g.surface,at+1);}return false;}))issues.push('GRAMMAR_ABOVE_N4');
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
  if(/^[かねよの。？！!?\s]*$/u.test(after)&&q.choices.some((v,i)=>i!==q.correct&&['じゃない','でした','でしょう'].includes(v)))issues.push('GRAMMAR_COPULA_AMBIGUITY');
  if(q.choices.includes('から')&&/(?:ます|ました|ません)$/u.test(before)&&/^[。？！!?\s]*$/u.test(after))issues.push('GRAMMAR_FINAL_KARA_AMBIGUITY');
  if(q.choices.includes('だけ')&&/^(?:ある|あります|です|だ)[。？！!?\s]*$/u.test(after))issues.push('GRAMMAR_DAKE_AMBIGUITY');
  if(q.choices.includes('から')&&/^[^。？！!?]*(?:買[ういっ]|か(?:う|いたい|います|いました))/u.test(after))issues.push('GRAMMAR_BUY_KARA_AMBIGUITY');
 }
 if(q.type==='context'&&source.pos.some(p=>p.startsWith('adv'))&&q.choices.some((v,i)=>i!==q.correct&&c.catalog.some(s=>s.kind==='vocab'&&s.title===v&&s.pos.some(p=>p.startsWith('adv')))))issues.push('CONTEXT_ADVERB_AMBIGUITY');
 return [...new Set(issues)];
}
