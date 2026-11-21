import type {V2Source} from './v2-data.ts';
import {grammarTokens,type GrammarToken} from './tokenizer.ts';

// IPADIC metadata is consumed by the generator and never rendered in the UI.
const ipadic={
 particle:'\u52a9\u8a5e',
 verb:'\u52d5\u8a5e',
 auxiliary:'\u52a9\u52d5\u8a5e',
 adjective:'\u5f62\u5bb9\u8a5e',
 noun:'\u540d\u8a5e',
 symbol:'\u8a18\u53f7',
 caseParticle:'\u683c\u52a9\u8a5e',
 conjunctiveParticle:'\u63a5\u7d9a\u52a9\u8a5e',
 adverbialParticle:'\u526f\u52a9\u8a5e',
 parallelParticle:'\u4e26\u7acb\u52a9\u8a5e',
 sentenceFinalParticle:'\u7d42\u52a9\u8a5e',
 sharedKa:'\u526f\u52a9\u8a5e\uff0f\u4e26\u7acb\u52a9\u8a5e\uff0f\u7d42\u52a9\u8a5e',
};

const known=(token:GrammarToken|undefined)=>token?.word_type==='KNOWN';
const particle=(token:GrammarToken|undefined,detail:string)=>known(token)&&token?.pos===ipadic.particle&&token.pos_detail_1===detail;
const predicate=(token:GrammarToken|undefined)=>known(token)&&[ipadic.verb,ipadic.auxiliary,ipadic.adjective].includes(token?.pos??'');
const nominal=(token:GrammarToken|undefined)=>known(token)&&token?.pos===ipadic.noun;
const endPunctuation=/^[。．.!！?？」』]+$/u;
const timeAmount=/[0-9０-９一二三四五六七八九十百]+(?:時間|時|分|日|月|年|じ|ふん|ぷん)$|(?:今日|明日|きょう|あした)$/u;

export function matchesGrammarFunction(source:V2Source,surface:string,sentence:string,start:number,tokens=grammarTokens(sentence)){
 if(source.kind!=='grammar')return true;
 const first=tokens.findIndex(t=>t.start===start);
 const last=tokens.findIndex(t=>t.end===start+surface.length);
 if(first<0||last<first)return false;
 const target=tokens[first],previous=tokens[first-1],next=tokens[last+1];
 if(surface==='が'&&source.id==='openjlpt:grammar:ga-subject')return particle(target,ipadic.caseParticle)&&nominal(previous)&&next?.pos===ipadic.verb&&known(next);
 if(surface==='が'&&source.id==='openjlpt:grammar:ga-but')return particle(target,ipadic.conjunctiveParticle)&&predicate(previous);
 if(surface==='か'&&['openjlpt:grammar:ka-question','openjlpt:grammar:ka-or'].includes(source.id)){
  if(!known(target)||target.pos!==ipadic.particle)return false;
  const detail=target.pos_detail_1,right=tokens.slice(last+1);
  const final=right.every(token=>endPunctuation.test(token.surface_form));
  const embedded=previous?.surface_form==='の'&&predicate(tokens[first-2])&&
   ['は','が','を','も','に'].includes(next?.surface_form??'')&&next?.pos===ipadic.particle;
  if(source.id==='openjlpt:grammar:ka-question'){
   return [ipadic.adverbialParticle,ipadic.sentenceFinalParticle,ipadic.sharedKa].includes(detail)&&(embedded||final&&predicate(previous));
  }
  // IPADIC often uses one shared tag for all three functions of か.
  const choice=right.findIndex(token=>nominal(token)&&['どちら','いずれ'].includes(token.surface_form));
  const alternative=nominal(previous)&&nominal(next)&&choice>0&&!right.slice(0,choice).some(token=>token.pos===ipadic.symbol);
  return detail===ipadic.parallelParticle||detail===ipadic.sharedKa&&alternative;
 }
 if(surface==='まで'||surface==='までに'){
  if(source.id==='openjlpt:grammar:made-even'||(source.id==='openjlpt:grammar:made-ni'&&surface!=='までに')||
     (source.id==='openjlpt:grammar:made'&&surface!=='まで'))return false;
  const until=target.surface_form==='まで'&&particle(target,ipadic.adverbialParticle);
  const time=timeAmount.test(tokens.slice(Math.max(0,first-3),first).map(token=>token.surface_form).join(''));
  return until&&time&&(surface==='まで'?next?.surface_form!=='に':
   last===first+1&&tokens[last].surface_form==='に'&&particle(tokens[last],ipadic.caseParticle));
 }
 if(surface==='で')return particle(target,ipadic.caseParticle);
 if(['は','が','を','に','へ','と','も','の','から','より','だけ','しか','さえ','でも','など'].includes(surface)){
  return tokens.slice(first,last+1).every(token=>known(token)&&token.pos===ipadic.particle);
 }
 return true;
}
