import type {Draft,Source} from './model.ts';
import {toHiragana,toRomaji} from 'wanakana';

export const plainJapanese=(s:string)=>s.normalize('NFC').split(/\s*[\/／]\s*/u)[0].replace(/[（(][^）)]*[）)]/gu,'').replace(/[〜～~]/gu,'').trim();
const exactSentence=(s:string)=>s.normalize('NFC').replace(/\s+/gu,'');
const kana=/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const word=/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const kanaStyle=(s:string)=>/^[\p{Script=Hiragana}ー]+$/u.test(s)?'hiragana':/^[\p{Script=Katakana}ー]+$/u.test(s)?'katakana':'mixed';
const part=(tag:string)=>tag==='vi'||tag==='vt'?null:/^v(?:[1-5]|[a-z])/.test(tag)?'verb':/^n(?:$|-)/.test(tag)?'noun':tag==='adj-i'?'i-adjective':tag==='adj-na'?'na-adjective':tag==='adv'?'adverb':tag==='pn'?'pronoun':tag==='num'?'number':tag==='int'?'interjection':tag==='conj'?'conjunction':null;
export function samePartOfSpeech(a:Source,b:Source){if(a.kind!==b.kind)return false;if(a.kind==='kanji')return true;const classes=new Set(a.pos.map(part).filter(Boolean));return b.pos.some(p=>classes.has(part(p))&&part(p)!==null);}
const moras=(s:string)=>toHiragana(s).match(/[\p{Script=Hiragana}ー][ゃゅょぁぃぅぇぉ]?/gu)??[];
const soundKey=(s:string)=>{const roman=toRomaji(s);return roman[0]+roman.slice(-1);};
export function readingNeighbor(reading:string,choice:string){
 if(!kana.test(reading)||!kana.test(choice)||reading===choice||kanaStyle(reading)!==kanaStyle(choice))return false;
 const a=moras(reading),b=moras(choice),weak=(s:string)=>s==='ん'||s==='っ';
 let previous=Array.from({length:b.length+1},(_,i)=>b.slice(0,i).reduce((n,m)=>n+(weak(m)?0.5:1),0));
 for(let i=0;i<a.length;i++){const row=[previous[0]+(weak(a[i])?0.5:1)];for(let j=0;j<b.length;j++){const change=a[i]===b[j]?0:soundKey(a[i])===soundKey(b[j])?0.25:weak(a[i])||weak(b[j])?0.5:1;row.push(Math.min(row[j]+(weak(b[j])?0.5:1),previous[j+1]+(weak(a[i])?0.5:1),previous[j]+change));}previous=row;}
 const anchor=a.some(m=>b.some(n=>m===n||soundKey(m)===soundKey(n)));
 return anchor&&previous[b.length]<=Math.max(1,Math.min(2,(a.length*3+1)/5));
}
export function validReadingDistractor(target:Source,choice:string,catalog:Source[]){
 if(!target.reading||!readingNeighbor(target.reading,choice))return false;
 const entries=catalog.filter(s=>s.kind==='vocab'&&s.reading===choice);
 // An absent dictionary entry is a source-derived misreading (e.g. ことしい), at the target's level.
 return !entries.length||entries.some(s=>s.level===target.level&&samePartOfSpeech(target,s));
}
export function readingDistractors(target:Source,catalog:Source[]){
 if(!target.reading)return [];
 const voiced='かきくけこさしすせそたちつてとはひふへほがぎぐげござじずぜぞだぢづでどばびぶべぼ',changed='がぎぐげござじずぜぞだぢづでどばびぶべぼかきくけこさしすせそたちつてとはひふへほ';
 const variants=[...target.reading].flatMap((c,i)=>{const p=voiced.indexOf(c);return p<0?[]:[target.reading!.slice(0,i)+changed[p]+target.reading!.slice(i+1)];});
 const suffix=kanaStyle(target.reading)==='katakana'?['ア','イ','ウ','エ','オ']:['あ','い','う','え','お'];
 return [...new Set([...catalog.filter(s=>s.level===target.level&&samePartOfSpeech(target,s)).map(s=>s.reading),...variants,...suffix.map(s=>target.reading+s)].filter((s):s is string=>!!s))].filter(s=>validReadingDistractor(target,s,catalog));
}
function distance(a:string,b:string){let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const row=[i+1];for(let j=0;j<b.length;j++)row.push(Math.min(row[j]+1,previous[j+1]+1,previous[j]+Number(a[i]!==b[j])));previous=row;}return previous[b.length];}
const shapes=['日曰目白田','土士','木本未末','人入八','大太犬','牛午','千干','力刀','待持','問間'];
export function spellingNeighbor(target:Source,other:Source){
 if(target.id===other.id||target.level!==other.level||other.kind==='grammar'||!samePartOfSpeech(target,other)||!/\p{Script=Han}/u.test(other.title))return false;
 const a=[...target.title].filter(c=>/\p{Script=Han}/u.test(c)).join(''),b=[...other.title].filter(c=>/\p{Script=Han}/u.test(c)).join('');
 const visual=a!==b&&(a.length>1&&b.length>1&&distance(a,b)<=1||a.length===1&&b.length===1&&shapes.some(g=>g.includes(a)&&g.includes(b)));
 const sound=target.reading&&other.reading&&distance(target.reading,other.reading)<=Math.max(1,Math.floor(target.reading.length/3));
 return Boolean(visual||sound);
}
export const orderSlots=/(?:＿|★)(?:\s+(?:＿|★)){3}/u;
export function orderedSentence(q:Draft){return q.stem.replace(orderSlots,q.order.map(i=>q.choices[i]).join(''));}
export function hardQuestionIssues(q:Draft,source:Source,catalog:Source[]):string[]{
 const issues:string[]=[];const fail=(condition:unknown,reason:string)=>{if(!condition)issues.push(reason);};
 if(!Array.isArray(q.choices)||q.choices.length!==4||q.choices.some(c=>typeof c!=='string'))return ['FOUR_CHOICES'];
 fail(new Set(q.choices.map(c=>c.normalize('NFKC').trim())).size===4,'DISTINCT_CHOICES');
 fail(q.choices.every(c=>!/[\p{Script=Latin}〜～~()（）]/u.test(c)),'PLAIN_JAPANESE_CHOICES');
 if(q.type==='reading'){
  fail(/\p{Script=Han}/u.test(source.title)&&q.stem.includes(`【${source.title}】`),'READING_MARKED_KANJI');
  fail(q.choices.every(c=>kana.test(c)),'READING_KANA_CHOICES');
  fail(q.choices.every((c,i)=>i===q.correct||validReadingDistractor(source,c,catalog)),'READING_NEAR_SAME_LEVEL_DISTRACTORS');
  fail(!q.stem.normalize('NFKC').includes(q.choices[q.correct]?.normalize('NFKC')??''),'READING_ANSWER_LEAK');
 }
 if(q.type==='synonym')fail(q.choices.every(c=>word.test(c)&&catalog.some(s=>s.level===source.level&&samePartOfSpeech(source,s)&&plainJapanese(s.title)===c)),'SYNONYM_POS_AND_SCRIPT');
 if(q.type==='spelling'){
  fail(source.reading&&kana.test(source.reading)&&q.stem.includes(`【${source.reading}】`)&&!/[^\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{S}\p{N}\sー]/u.test(q.stem),'SPELLING_MARKED_KANA');
  fail(q.choices.every(c=>/\p{Script=Han}/u.test(c)),'SPELLING_KANJI_CHOICES');
  fail(q.choices.every((c,i)=>i===q.correct||catalog.some(s=>plainJapanese(s.title)===c&&spellingNeighbor(source,s))),'SPELLING_NEAR_DISTRACTORS');
 }
 if(q.type==='order'){
  const match=q.stem.match(orderSlots),holes=q.stem.match(/[＿★]/gu)??[];
  fail(match&&holes.length===4&&holes.filter(c=>c==='★').length===1&&match[0].split(/\s+/u).indexOf('★')===q.starSlot,'ORDER_FOUR_SLOTS');
  const fixed=q.stem.replace(orderSlots,''),segmenter=new Intl.Segmenter('ja',{granularity:'word'}),words=new Set([...segmenter.segment(fixed)].filter(s=>s.isWordLike).map(s=>s.segment));
  fail(q.choices.every(c=>![...segmenter.segment(c)].some(s=>s.isWordLike&&words.has(s.segment))),'ORDER_DUPLICATES_FIXED_TEXT');
  const permutation=Array.isArray(q.order)&&q.order.length===4&&new Set(q.order).size===4&&q.order.every(i=>Number.isInteger(i)&&i>=0&&i<4);
  fail(permutation&&q.correct===q.order[q.starSlot],'ORDER_KEY');
  if(permutation){const sequence=q.order.map(i=>i+1).join('→'),orders=[...q.explanation.matchAll(/Thứ tự:\s*([1-4](?:\s*→\s*[1-4]){3})(?=\s*[.。;])/gu)],keys=[...q.explanation.matchAll(/★\s*=\s*(\d+)(?=\s*[.。;])/gu)];fail(orders.length===1&&exactSentence(orders[0][1])===sequence&&keys.length===1&&Number(keys[0][1])===q.correct+1,'ORDER_EXPLANATION');const fields=[...q.explanation.matchAll(/Câu:\s*「([^「」\r\n]+)」/gu)];fail(fields.length===1&&(q.explanation.match(/Câu:/gu)??[]).length===1&&exactSentence(fields[0][1])===exactSentence(orderedSentence(q)),'ORDER_SENTENCE_EXACT');}
 }
 if(['context','usage','grammar'].includes(q.type))fail(/＿+|（\s*）|\(\s*\)/u.test(q.stem),'TYPE_REQUIRES_GAP');
 if(q.type==='paragraph'){
  const passage=q.stem.split('【とい】')[0].replace('【ほんぶん】','');
  fail(q.stem.includes('【ほんぶん】')&&q.stem.includes('【とい】')&&(passage.match(/[。！？]/gu)??[]).length>=3&&(passage.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)??[]).length>=40,'PARAGRAPH_PASSAGE');
 }
 return issues;
}

