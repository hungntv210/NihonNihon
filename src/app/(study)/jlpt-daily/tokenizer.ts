import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';

type IpadicToken={surface_form:string;word_type:'KNOWN'|'UNKNOWN';pos:string;pos_detail_1:string};
type Tokenizer={tokenize(text:string):IpadicToken[]};
type Kuromoji={builder(options:{dicPath:string}):{build(callback:(error:Error|null,tokenizer:Tokenizer)=>void):void}};
export type GrammarToken=IpadicToken&{start:number;end:number};

const require=createRequire(import.meta.url);
const kuromoji:Kuromoji=require('kuromoji');
const tokenizer=await new Promise<Tokenizer>((resolve,reject)=>{
 const dicPath=join(dirname(require.resolve('kuromoji/package.json')),'dict');
 kuromoji.builder({dicPath}).build((error,value)=>error?reject(error):resolve(value));
});

export function grammarTokens(text:string):GrammarToken[]{
 // Derive UTF-16 offsets from the original token surfaces.
 let end=0;
 const tokens=tokenizer.tokenize(text).map(token=>{
  const start=end;
  end+=token.surface_form.length;
  if(text.slice(start,end)!==token.surface_form)throw Error('TOKENIZER_TEXT_MISMATCH');
  return {...token,start,end};
 });
 if(end!==text.length)throw Error('TOKENIZER_TEXT_MISMATCH');
 return tokens;
}

export function tokenEdges(tokens:GrammarToken[]){
 return new Set([0,...tokens.map(token=>token.end)]);
}
