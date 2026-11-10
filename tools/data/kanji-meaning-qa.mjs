export const foldVietnamese=text=>String(text).normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const sameReading=text=>String(text).normalize('NFC').toLowerCase().trim();
import {distinctEnglish} from './learning-quality.mjs';
export function kanjiMeaningAssessment(output,input,candidates=[],{recoveryAttempt=0}={}){
 if(!input.character||input.field!=='meaning')return {issues:[],flags:[]};
 const issues=[],flags=[],overlap=candidates.some(c=>sameReading(typeof c==='string'?c:c.reading)===sameReading(output.text_vi));
 const required=Math.min(input.meanings_en?.length??0,3),count=new Set(output.text_vi.split(/[,，]/u).map(foldVietnamese).filter(Boolean)).size;
 if(count<required){if(recoveryAttempt===2&&distinctEnglish(input.meanings_en).length<=2&&count>0)flags.push('limited_distinct_meanings: owner-approved recovery after two attempts');else issues.push(`too_few_meanings: expected >=${required}, got ${count}`);}
 if(overlap){if((input.meanings_en?.length??0)>=2&&count===1)issues.push('han_viet_as_meaning');else flags.push('han_viet_reading_overlap: owner review required');}
 return {issues,flags};
}
export const kanjiMeaningIssues=(output,input,candidates)=>kanjiMeaningAssessment(output,input,candidates).issues;
