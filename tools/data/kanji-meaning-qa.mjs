export const foldVietnamese=text=>String(text).normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function kanjiMeaningIssues(output,input,candidates=[]){
 if(!input.character||input.field!=='meaning')return [];
 const issues=[],value=foldVietnamese(output.text_vi);
 if(candidates.some(c=>foldVietnamese(typeof c==='string'?c:c.reading)===value))issues.push('han_viet_as_meaning');
 const required=Math.min(input.meanings_en?.length??0,3),count=new Set(output.text_vi.split(/[,，]/u).map(foldVietnamese).filter(Boolean)).size;
 if(count<required)issues.push(`too_few_meanings: expected >=${required}, got ${count}`);
 return issues;
}
