// Original synthetic questions for plumbing tests only; not a production question bank.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { seedDemo } from '../../../../tools/seed-demo.ts';
import { enqueueCard } from '../../../core/review.ts';
import { learnedCatalog } from './catalog.ts';
import { hash,questionTypes,type Draft,type Source,type Audit } from './model.ts';
import { generateWeek } from './generation.ts';
import {plainJapanese,orderedSentence,readingDistractors,samePartOfSpeech} from './hard-qa.ts';

export function fixtureCatalog(file:string){
 seedDemo(file);
 const db=new DatabaseSync(file);
 try{
  const release=db.prepare("SELECT release_id FROM source_releases WHERE source_id='openjlpt' LIMIT 1").get()!.release_id as string;
  for(const [i,title]of ['月曜日','火曜日','木曜日','金曜日'].entries()){
   const id='openjlpt:vocab:synthetic-weekday-'+i;
   db.prepare('INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,?,?,?,?,?)').run(id,'vocab','openjlpt','synthetic-weekday-'+i,release,hash({fixture:title}));
   db.prepare('INSERT INTO vocab(item_id,word,reading,romaji,level,meanings_en,pos) VALUES(?,?,?,?,?,?,?)').run(id,title,['げつようび','かようび','もくようび','きんようび'][i],'fixture','N5','["synthetic weekday fixture"]','["n"]');
  }
  for(const row of db.prepare("SELECT i.item_id FROM content_items i WHERE i.kind IN ('vocab','kanji','grammar')").all()){
   const card=enqueueCard(file,String(row.item_id),'recognition');
   db.prepare('INSERT INTO srs_reviews(review_id,card_id,rating,reviewed_at,elapsed_ms,scheduler_version) VALUES(?,?,3,?,1000,?)').run(randomUUID(),card.cardId,new Date().toISOString(),'fixture');
  }
  return learnedCatalog(db).filter(s=>s.level==='N5');
 }finally{db.close();}
}
export function fixtureDrafts(catalog:Source[],suffix=''):Draft[]{
 const vocab=catalog.find(s=>s.kind==='vocab'&&s.reading)!,grammar=catalog.find(s=>s.kind==='grammar')!,spelling=catalog.find(s=>s.title==='月曜日')!,synonym=catalog.find(s=>s.kind==='vocab'&&s.pos.includes('n'))!;
 return Array.from({length:70},(_,i)=>{
  const type=questionTypes[i%8],gram=['grammar','order','paragraph'].includes(type),target=gram?grammar:type==='spelling'?spelling:type==='synonym'?synonym:vocab;
  const correct=type==='reading'?target.reading!:plainJapanese(target.title);
  const q:Draft={day:Math.floor(i/10),position:i%10,type,targetId:target.id,
   stem:`${i+1}${suffix}：${type==='reading'?`【${target.title}】のよみかたはどれですか。`:type==='spelling'?`【${target.reading}】のかんじはどれですか。`:type==='order'?'これは ＿ ★ ＿ ＿ です。':type==='paragraph'?'【ほんぶん】あさ、こうえんをあるきました。そこにはおおきなきがありました。しずかだったので、ながくやすみました。【とい】かっこにあうことばはどれですか。（　　）':'かっこにあうものをえらんでください。（　　）'}`,
   choices:type==='order'?['きのう','ほんを','みた','ひと']:type==='spelling'?['月曜日','火曜日','木曜日','金曜日']:type==='reading'?[correct,...readingDistractors(target,catalog).slice(0,3)]:type==='synonym'?[correct,...catalog.filter(s=>s.id!==target.id&&s.level===target.level&&samePartOfSpeech(target,s)).map(s=>plainJapanese(s.title)).slice(0,3)]:[correct,...['たなか','さくら','みどり','あかい'].filter(s=>s!==correct).slice(0,3)],correct:0,
   explanation:'Đây là lời giải thích trong fixture kiểm thử, không phải nội dung luyện thật.',order:type==='order'?[1,0,2,3]:[],starSlot:type==='order'?1:0};
  if(type==='order')q.explanation=`Thứ tự: 2→1→3→4. ★=1. Câu: 「${orderedSentence(q)}」 Đây là fixture kiểm thử.`;return q;
 });
}
export const fixtureAudit=(drafts:Draft[]):Audit[]=>drafts.map((q,index)=>({index,possibleAnswers:[q.correct],sameType:true,plausible:true,levelMatch:true,learnedOnly:true,original:true,explanationCorrect:true}));
export async function fixtureBank(catalog:Source[],week:string,suffix=''){
 const drafts=fixtureDrafts(catalog,suffix);
 return generateWeek({week,level:'N5',catalog,history:[],model:'fixture-no-api',verifierModel:'fixture-no-api'},async phase=>phase==='generate'?drafts:fixtureAudit(drafts));
}
