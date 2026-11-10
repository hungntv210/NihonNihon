import {compoundAssessment} from './learning-quality.mjs';
import {kanjiMeaningAssessment} from './kanji-meaning-qa.mjs';
export function auditLearning(db,dictionary=new Map()){
 dictionary=new Map(dictionary);
 for(const r of db.prepare("SELECT v.word,t.text_vi FROM vocab v JOIN vi_translations t USING(item_id) WHERE t.status='selected' AND (t.field='han_viet' OR (t.field='meaning' AND t.method='dictionary'))").all())dictionary.set(r.word,[...dictionary.get(r.word)??[],...r.text_vi.split(/[,;()]/u).map(s=>s.trim()).filter(Boolean)]);
 const rows=db.prepare("SELECT k.character,k.meanings_en,t.* FROM kanji k JOIN vi_translations t USING(item_id) WHERE t.status='selected' AND t.field IN ('han_viet','meaning')").all(),candidates=new Map();
 for(const r of rows.filter(r=>r.field==='han_viet')){const c=JSON.parse(r.context_json);candidates.set(r.character,(c.candidate_readings??[r.text_vi]).map(reading=>({reading})));}
 const result=[];
 for(const r of rows){const context=JSON.parse(r.context_json),input={character:r.character,field:r.field,meanings_en:JSON.parse(r.meanings_en),candidates:candidates.get(r.character)??[]};
  const evidence=context.mt_output??context.evidence,check=r.field==='meaning'?kanjiMeaningAssessment({text_vi:r.text_vi},input,input.candidates):compoundAssessment(evidence?{...evidence,text_vi:r.text_vi}:null,input,dictionary);
  for(const reason of check.issues)result.push({kanji:r.character,item_id:r.item_id,field:r.field,translation_id:r.translation_id,current:r.text_vi,proposed:null,reason,severity:'review_required'});
  for(const flag of check.flags)result.push({kanji:r.character,item_id:r.item_id,field:r.field,translation_id:r.translation_id,current:r.text_vi,proposed:flag.proposed??null,reason:flag.reason??flag,severity:'flag'});
  if(r.field==='meaning'&&!/[\u00c0-\u024f\u1e00-\u1eff]/u.test(r.text_vi))result.push({kanji:r.character,item_id:r.item_id,field:r.field,translation_id:r.translation_id,current:r.text_vi,proposed:null,reason:'meaning_language_review_required',severity:'flag'});
 }
 return result;
}
