// Authored grammar-surface groups, not questions. Every used surface must also
// occur as a learned grammar record. Verifier still rejects ambiguous sentences.
export const confusionGroups=Object.freeze([
 {id:'particles',label:'Trợ từ',surfaces:['は','が','を','に','で','へ','と','も','の','から','まで','より','だけ','しか','さえ','でも','など']},
 {id:'copula-polite',label:'Đuôi danh từ lịch sự',surfaces:['だ','です','でした','ではありません','ではありませんでした']},
 {id:'verb-polite',label:'Đuôi động từ lịch sự',surfaces:['ます','ました','ません','ませんでした']},
 {id:'connectives',label:'Liên kết mệnh đề',surfaces:['ので','のに','けど','から']},
]);
