import {need} from './core.mjs';
import {canonicalReading} from './learning-quality.mjs';
export function meaningOnlyBatch(batch,fixed){
 return batch.map(r=>{const f=fixed.get(r.input.item_id);need(r.task==='han_viet'&&f&&r.input.candidates.some(c=>canonicalReading(c.reading)===canonicalReading(f.reading)),'Fixed reading lacks public candidate evidence');return {request_id:r.request_id,task:'translate',input:{item_id:r.input.item_id,field:'compound_meaning',ja:f.output.compound.word,en:f.output.meaning}};});
}
export function expandCompoundMeaning(row,request,fixed){
 const f=fixed.get(request.input.item_id),candidate=request.input.candidates.find(c=>canonicalReading(c.reading)===canonicalReading(f.reading));
 need(candidate&&row.output.text_vi?.trim(),'Missing fixed compound translation');
 return {...f.output,text_vi:candidate.reading,candidate_id:candidate.id,meaning:row.output.text_vi.normalize('NFC')};
}
