import {provenMeaning,standardMeanings} from './v2-hardening.ts';
import type {Example,V2Source} from './v2-data.ts';

export const contextSensePolicy = 'unique-linked-example-gloss-v1';
const englishWords = (s: string) => s.normalize('NFKC').toLowerCase().match(/[a-z]+(?:'[a-z]+)*/gu) ?? [];
const containsPhrase = (words: string[], phrase: string[]) => words.some((_,index) =>
 phrase.every((word,n) => words[index+n]===word));

export function contextMeaning(source: V2Source, example: Example | undefined) {
 if(example?.targetId!==source.id || !example.english.trim())return null;
 const words=englishWords(example.english);
 const matches=[...new Set(standardMeanings(source))].filter(gloss=>{
  const phrase=englishWords(gloss);
  return phrase.length>0 && containsPhrase(words,phrase);
 });
 if(matches.length!==1)return null;
 const gloss=matches[0];
 return provenMeaning(source) && source.translationSenseGloss===gloss
  ? {text:source.vietnamese!.text,source:source.vietnamese!.sourceId,model:source.vietnamese!.model}
  : {text:gloss,source:'OpenJLPT · EN',model:null};
}
