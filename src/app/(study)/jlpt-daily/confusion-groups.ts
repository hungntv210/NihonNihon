// Authored grammar-surface groups, not questions. Every used surface must also
// occur as a learned grammar record. Verifier still rejects ambiguous sentences.
export const confusionGroups=Object.freeze([
 {id:'particles',label:'Trợ từ',surfaces:['は','が','を','に','で','へ','と','も','の','か','から','まで','より','だけ','しか','さえ','でも','など']},
 {id:'copula-polite',label:'Đuôi danh từ lịch sự',surfaces:['だ','です','でした','でしょう','じゃない','ではありません','ではありませんでした']},
 {id:'verb-polite',label:'Đuôi động từ lịch sự',surfaces:['ます','ました','ません','ませんでした']},
 {id:'connectives',label:'Liên kết mệnh đề',surfaces:['ので','のに','けど','から']},
]);

// Split only explicit alternatives. A composite such as がほしい does not teach standalone が.
export function learnedGrammarForms(catalog:readonly {id:string;title:string;kind:string}[]){
 return catalog.filter(s=>s.kind==='grammar').flatMap(s=>s.title.split(/[/／]/u).map(part=>({
  id:s.id,surface:part.trim().normalize('NFC').replace(/[（(][^）)]*[）)]/gu,'').replace(/^[〜～~]/u,'').trim()
 })));
}
