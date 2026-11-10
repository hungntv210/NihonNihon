import type {Draft,Source} from './model.ts';

export const plainJapanese=(s:string)=>s.normalize('NFC').split(/\s*[\/／]\s*/u)[0].replace(/[（(][^）)]*[）)]/gu,'').replace(/[〜～~]/gu,'').trim();
const compact=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}]/gu,'');
const kana=/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
function distance(a:string,b:string){let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const row=[i+1];for(let j=0;j<b.length;j++)row.push(Math.min(row[j]+1,previous[j+1]+1,previous[j]+Number(a[i]!==b[j])));previous=row;}return previous[b.length];}
const shapes=['日曰目白田','土士','木本未末','人入八','大太犬','牛午','千干','力刀','待持','問間'];
export function spellingNeighbor(target:Source,other:Source){
 if(target.id===other.id||target.level!==other.level||other.kind==='grammar'||!/[\p{Script=Han}]/u.test(other.title))return false;
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
  fail(!q.stem.normalize('NFKC').includes(q.choices[q.correct]?.normalize('NFKC')??''),'READING_ANSWER_LEAK');
 }
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
  if(permutation){const sequence=q.order.map(i=>i+1).join('→');fail(q.explanation.includes(`Thứ tự: ${sequence}`)&&q.explanation.includes(`★=${q.correct+1}`)&&compact(q.explanation).includes(compact(orderedSentence(q))),'ORDER_EXPLANATION');}
 }
 if(['context','usage','grammar'].includes(q.type))fail(/＿+|（\s*）|\(\s*\)/u.test(q.stem),'TYPE_REQUIRES_GAP');
 if(q.type==='paragraph'){
  const passage=q.stem.split('【とい】')[0].replace('【ほんぶん】','');
  fail(q.stem.includes('【ほんぶん】')&&q.stem.includes('【とい】')&&(passage.match(/[。！？]/gu)??[]).length>=3&&(passage.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)??[]).length>=40,'PARAGRAPH_PASSAGE');
 }
 return issues;
}
