// Original synthetic questions for plumbing tests only; not a production question bank.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { enqueueCard } from '../../../core/review.ts';
import { learnedCatalog } from './catalog.ts';
import { questionTypes,type Draft,type Source,type Audit } from './model.ts';
import { generateWeek } from './generation.ts';

export function fixtureCatalog(file:string){
 seedDemo(file);
 const db=new DatabaseSync(file);
 try{
  for(const row of db.prepare("SELECT i.item_id FROM content_items i WHERE i.kind IN ('vocab','kanji','grammar')").all()){
   const card=enqueueCard(file,String(row.item_id),'recognition');
   db.prepare('INSERT INTO srs_reviews(review_id,card_id,rating,reviewed_at,elapsed_ms,scheduler_version) VALUES(?,?,3,?,1000,?)').run(randomUUID(),card.cardId,new Date().toISOString(),'fixture');
  }
  return learnedCatalog(db).filter(s=>s.level==='N5');
 }finally{db.close();}
}
export function fixtureDrafts(catalog:Source[],suffix=''):Draft[]{
 const vocab=catalog.find(s=>s.kind==='vocab'&&s.reading)!,grammar=catalog.find(s=>s.kind==='grammar')!;
 return Array.from({length:70},(_,i)=>{
  const type=questionTypes[i%8],gram=['grammar','order','paragraph'].includes(type),target=gram?grammar:vocab;
  const correct=type==='reading'?target.reading!:target.title;
  return {day:Math.floor(i/10),position:i%10,type,targetId:target.id,
   stem:`${i+1}${suffix}：${type==='reading'?`「${target.title}」のよみかたはどれですか。`:type==='order'?'わたしは＿＿★＿＿＿＿。':'かっこにあうものをえらんでください。'}`,
   choices:type==='order'?['わたし','が','きのう','みた']: [correct,...['たなか','さくら','みどり','あかい'].filter(s=>s!==correct).slice(0,3)],correct:0,
   explanation:'Đây là lời giải thích trong fixture kiểm thử, không phải nội dung luyện thật.',order:type==='order'?[1,0,2,3]:[],starSlot:type==='order'?1:0};
 });
}
export const fixtureAudit=(drafts:Draft[]):Audit[]=>drafts.map((q,index)=>({index,possibleAnswers:[q.correct],sameType:true,plausible:true,levelMatch:true,learnedOnly:true,original:true,explanationCorrect:true}));
export async function fixtureBank(catalog:Source[],week:string,suffix=''){
 const drafts=fixtureDrafts(catalog,suffix);
 return generateWeek({week,level:'N5',catalog,history:[],model:'fixture-no-api',verifierModel:'fixture-no-api'},async phase=>phase==='generate'?drafts:fixtureAudit(drafts));
}
