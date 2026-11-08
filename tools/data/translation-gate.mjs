import {validateResults,properNameIssues} from './mt-gemini.mjs';
export function inspectBatch(text,requests,{properNames=false}={}){
 const report={expected:requests.length,json_invalid:0,missing:0,unexpected:0,duplicate_ids:0,empty:0,source_copy:0,japanese_left:0,length_outlier:0,non_nfc:0,proper_name:0,schema_invalid:0,items:[]};let rows;
 try{rows=JSON.parse(text);if(!Array.isArray(rows))throw Error();}catch{report.json_invalid=1;report.missing=requests.length;return report;}
 const wanted=new Map(requests.map(r=>[r.request_id,r])),seen=new Set();
 for(const row of rows){if(!row||!wanted.has(row.request_id)){report.unexpected++;continue;}if(seen.has(row.request_id)){report.duplicate_ids++;continue;}seen.add(row.request_id);const req=wanted.get(row.request_id),source=req.input.ja??'',vi=row.output?.text_vi,flags=[];
 if(typeof vi!=='string'||!vi.trim()){report.empty++;flags.push('empty');}
 else {const normalized=vi.normalize('NFC');if(vi!==normalized){report.non_nfc++;flags.push('non_nfc');}if(source&&normalized.trim()===source.normalize('NFC').trim()){report.source_copy++;flags.push('source_copy');}if(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(vi)){report.japanese_left++;flags.push('japanese_left');}const ratio=[...vi].length/Math.max(1,[...source].length);if(source&&(ratio<0.5||ratio>8)){report.length_outlier++;flags.push('length_outlier');}}
 if(properNames&&typeof vi==='string'&&properNameIssues(source,vi).length){report.proper_name++;flags.push('proper_name');}
 if(flags.length)report.items.push({request_id:row.request_id,flags});}
 report.missing=requests.length-seen.size;try{validateResults(rows,requests);}catch{report.schema_invalid=1;}return report;
}
export function summarizeGate(attempts,stored){
 const qa=attempts.filter(r=>r.http_status===200),sum=k=>qa.reduce((n,r)=>n+(r.qa?.[k]??0),0),expected=qa.reduce((n,r)=>n+(r.qa?.expected??0),0),rowKeys=['missing','unexpected','duplicate_ids','empty','source_copy','japanese_left','length_outlier','non_nfc'];
 const failures=qa.filter(r=>r.validation_error).length;
 rowKeys.push('proper_name');const counts=Object.fromEntries(rowKeys.map(k=>[k,sum(k)])),rates=Object.fromEntries(rowKeys.map(k=>[k,expected?100*counts[k]/expected:0]));return {api_requests:attempts.length,http_errors:attempts.length-qa.length,json_invalid:sum('json_invalid'),schema_invalid:sum('schema_invalid'),validation_failures:failures,expected_items_across_attempts:expected,stored_results:stored,counts,rates_percent:rates,request_rates_percent:{http_error:attempts.length?100*(attempts.length-qa.length)/attempts.length:0,json_invalid:qa.length?100*sum('json_invalid')/qa.length:0,schema_invalid:qa.length?100*sum('schema_invalid')/qa.length:0,validation_failure:qa.length?100*failures/qa.length:0},status:!stored?'INCOMPLETE':failures||sum('json_invalid')||sum('schema_invalid')||Object.values(counts).some(Boolean)?'REVIEW_REQUIRED':'PASS'};
}
