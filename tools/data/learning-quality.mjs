const normalized=s=>String(s??'').normalize('NFC').toLowerCase().trim().replace(/\s+/gu,' ');
export const canonicalReading=s=>normalized(s)==='uỷ'?'ủy':normalized(s);
export const distinctEnglish=values=>[...new Set((values??[]).map(normalized).filter(Boolean))];
export function compoundAssessment(output,input,dictionary=new Map()){
 const issues=[],flags=[];
 if(!output?.compound)return {issues,flags};
 const meaning=normalized(output.meaning),english=input.compounds?.filter(c=>c.word===output.compound.word).flatMap(c=>Array.isArray(c.meaning)?c.meaning:[c.meaning])??[];
 const attested=(dictionary.get(output.compound.word)??[]).some(value=>normalized(value)===meaning);
 if((!/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u.test(meaning)&&!attested)||english.some(v=>normalized(v)===meaning))issues.push('compound_meaning_not_vietnamese');
 if((input.candidates?.length??0)>1){
  const chars=[...output.compound.word],positions=chars.flatMap((c,i)=>c===input.character?[i]:[]),supported=new Set();
  for(const value of dictionary.get(output.compound.word)??[]){const tokens=normalized(value).split(' ').map(canonicalReading);if(tokens.length===chars.length)for(const i of positions)if(input.candidates.some(c=>canonicalReading(c.reading)===tokens[i]))supported.add(tokens[i]);}
  if(supported.size===1&&!supported.has(canonicalReading(output.text_vi)))flags.push({reason:'compound_dictionary_candidate_mismatch',proposed:[...supported][0],compound:output.compound.word});
 }
 return {issues,flags};
}
export const normalizeGrammar=text=>String(text).normalize('NFC').replace(/thể nguyên mẫu/giu,'thể từ điển');
