import type {Source} from './model.ts';

// Closed N5 function/scaffolding vocabulary, never a whitelist of kana fragments.
export const N5_FUNCTION_WORDS=Object.freeze([
 'です','でした','ではありません','じゃありません','ではありませんでした','だ','だった',
 'ます','ました','ません','ませんでした','ある','あります','ありません','ありました','ありませんでした',
 'いる','います','いません','いました','いませんでした','ない','なかった','ください',
 'わたし','あなた','この','その','あの','どの','これ','それ','あれ','どれ','ここ','そこ','あそこ','どこ',
 'だれ','いつ','いま','きょう','どう','なに','なん','いくつ','どうして','なぜ','時','とき',
 '一つ','二つ','三つ','四つ','五つ','六つ','七つ','八つ','九つ',
 'ひとつ','ふたつ','みっつ','よっつ','いつつ','むっつ','ななつ','やっつ','ここのつ',
 'の','を','に','は','が','へ','で','と','も','か','ね','よ','から','まで','より','だけ','しか','ので','のに',
 'そして','でも','それから','では','じゃ','はい','いいえ','とても','もう','まだ','また','いっしょ',
 'かんじ','よみかた','いみ','ことば','つぎ','ただしい','どちら','ほんぶん','とい','おなじ',
]);
const polite=['ます','ました','ません','ませんでした'];
const teEndings=['て','た','ています','ていました','てください','てから'];
export function roadmapLexicon(catalog:Source[]){
 const words=new Set<string>(N5_FUNCTION_WORDS);
 for(const s of catalog){
  const title=s.title.split(/\s*[\/／]\s*/u)[0].replace(/[（(][^）)]*[）)]/gu,'').replace(/[〜～~]/gu,'').trim();
  if(s.kind==='kanji'){words.add(title);continue;} // on/kun fragments are not lexical words
  for(const base of [title,s.reading??''].filter(Boolean)){
   words.add(base.normalize('NFC'));
   const tags=s.pos;
   const add=(stem:string,endings:string[])=>endings.forEach(e=>words.add(stem+e));
   if(tags.some(p=>p.startsWith('v1'))&&base.endsWith('る')){const stem=base.slice(0,-1);add(stem,[...polite,...teEndings,'ない','なかった']);}
   const row=tags.find(p=>/^v5[ukgstnbmr]/u.test(p));
   if(row){const final=base.slice(-1),i='うくぐすつぬぶむる'.indexOf(final);if(i>=0){const stem=base.slice(0,-1);add(stem+'いきぎしちにびみり'[i],polite);const te=['って','いて','いで','して','って','んで','んで','んで','って'][i];const actual=row.startsWith('v5k-s')?'って':te;add(stem,[actual,actual.slice(0,-1)+(actual.endsWith('で')?'だ':'た'),actual+'います',actual+'いました',actual+'ください',actual+'から']);add(stem+'わかがさたなばまら'[i],['ない','なかった']);}}
   if(tags.some(p=>p.startsWith('vs'))){const stem=base.endsWith('する')?base.slice(0,-2):base;add(stem,['する','します','しました','しません','しませんでした','して','した','しています','してください','しない']);}
   if(tags.includes('vk')){const stem=base.endsWith('くる')?base.slice(0,-2):base.endsWith('来る')?base.slice(0,-2):null;if(stem!==null)add(stem,base.endsWith('来る')?['来ます','来ました','来ません','来て','来た','来ています','来てください','来ない']:['きます','きました','きません','きて','きた','きています','きてください','こない']);}
   if(tags.includes('adj-i')&&base.endsWith('い'))add(base.slice(0,-1),['く','くない','くなかった','かった','くて']);
  }
 }
 return words;
}
export function draftContextLexicon(roadmap:Source[],dictionary:Source[]){
 // This evidence never changes the target catalog or the learned-kanji gate.
 return roadmapLexicon([...roadmap,...dictionary.filter(s=>s.kind==='vocab'&&s.level==='N5')]);
}

export function japaneseWordEvidence(text:string,lexicon:ReadonlySet<string>){
 const allowed=new Set([...lexicon,...N5_FUNCTION_WORDS].map(w=>w.normalize('NFC')).filter(w=>!/^[ぁぃぅぇぉゃゅょっァィゥェォャュョッ]$/u.test(w)));
 const segmenter=new Intl.Segmenter('ja',{granularity:'word'});
 const words:string[]=[],unresolved:string[]=[];
 for(const match of text.normalize('NFC').matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+|[\p{Script=Latin}]+/gu)){
  const span=match[0],segments=[...segmenter.segment(span)];
  // ICU may split りょこう or merge 時に. Match whole attested surfaces across
  // those boundaries; single fragments are never inserted into the word list.
  const preferred=new Set(segments.map(s=>s.index+s.segment.length));
  const particles=new Set(['の','を','に','は','が','へ','で','と','も','か','ね','よ']);
  const anchors=segments.filter(s=>particles.has(s.segment));
  const paths=new Map<number,string[]>([[0,[]]]);
  for(let i=0;i<span.length;i++)if(paths.has(i)){
   const endings:number[]=[];for(let end=i+1;end<=span.length;end++){
    const surface=span.slice(i,end);if(!allowed.has(surface))continue;
    // A merged lexical word cannot be licensed merely by spelling it with
    // known characters/nouns. Only N5 function boundaries may split it.
    if(!preferred.has(end)&&!N5_FUNCTION_WORDS.includes(surface))continue;
    const anchored=anchors.some(a=>a.index>=i&&a.index<end&&(a.index>i||a.index+a.segment.length<end));
    // Do not swallow an ICU particle boundary to invent a noun compound such
    // as ひとり + がく + ぶん. Whole N5 forms retain their explicit evidence.
    if(anchored&&!N5_FUNCTION_WORDS.includes(surface)&&!/(?:ます|ました|ません|でした|ない|なかった|てください|でください)$/u.test(surface))continue;
    endings.push(end);
   }
   endings.sort((a,b)=>Number(preferred.has(b))-Number(preferred.has(a))||b-a);
   for(const end of endings)if(!paths.has(end))paths.set(end,[...paths.get(i)!,span.slice(i,end)]);
  }
  const path=paths.get(span.length);if(path)words.push(...path);else unresolved.push(span);
 }
 return {words,unresolved};
}
