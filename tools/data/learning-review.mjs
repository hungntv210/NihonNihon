export function renderLearningReview(id,rows){
 const esc=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n','<br>');
 return '# '+id+'\n\nMẫu ngẫu nhiên, chờ duyệt nghĩa; feedback null/ok/minor/major.\n\n| # | Kanji / Nhật | Âm Hán Việt | Anh nguồn | Nghĩa Việt | Nguồn / model | Căn cứ / QA flag |\n| --- | --- | --- | --- | --- | --- | --- |\n'+rows.map((r,i)=>`| ${i+1} | ${esc(r.request.input.character??r.request.input.word??r.request.input.pattern??r.request.input.ja)} | ${esc(r.request.task==='han_viet'?r.output.text_vi:'')} | ${esc((r.request.input.meanings_en??[r.request.input.en??'']).join(', '))} | ${esc(r.output.meaning??r.output.text_vi)} | mt:google-gemini / ${r.model} | ${esc([r.output.reason,...r.qa_flags??[]].filter(Boolean).join('; '))} |`).join('\n')+'\n';
}
