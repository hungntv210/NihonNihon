import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {databasePath} from '../../../../core/config.ts';
import {enqueueMistake, withStoreLock, storeDirectory} from '../repository.ts';
import type {Source} from '../model.ts';

export type Item = {id:string;level:'N4'|'N5';section:'V'|'G';number:number;page:number;key:number;asset:string;passage?:string|null;instruction?:string;target?:string;explanation?:string};
export const directory = () => path.resolve(process.env.NIHON_JLPT_OFFICIAL_PATH || 'data/private/jlpt-official');
export function approvedItems(dir=directory()): Item[] {
  try {
    const approval = JSON.parse(fs.readFileSync(path.join(dir,'approval.json'),'utf8'));
    if (approval.enabled !== true || !approval.reviewer?.trim()) return [];
    const bytes = fs.readFileSync(path.join(dir,'bank.json'));
    if (createHash('sha256').update(bytes).digest('hex') !== approval.sha256) return [];
    const items:Item[] = JSON.parse(bytes.toString('utf8'));
    if (!items.length || new Set(items.map(q=>q.id)).size !== items.length || !items.every(q=>
      ['N4','N5'].includes(q.level) && ['V','G'].includes(q.section) && Number.isInteger(q.number) && q.number>0 &&
      q.id===q.level+q.section+'-'+q.number && q.asset===q.id+'.png' && (!q.passage || q.passage===q.level+'G-passage.png') &&
      Number.isInteger(q.key) && q.key>=1 && q.key<=4)) return [];
    return items;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code==='ENOENT') return [];
    throw e;
  }
}
export function score(items:Item[],form:FormData){
  if(!items.length) throw Error('Bộ đề chưa sẵn.');
  return items.map(q=>{
    const values=form.getAll(q.id);
    if(values.length!==1 || !/^[1-4]$/.test(String(values[0]))) throw Error('Cần chọn một đáp án cho mỗi câu.');
    return {id:q.id,section:q.section,choice:Number(values[0]),correct:Number(values[0])===q.key};
  });
}
export function saveResult(items:Item[],form:FormData,token:string,catalog:Source[],dir=path.join(storeDirectory(),'official-results')){
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(token)) throw Error('Lượt làm không hợp lệ.');
  const answers=score(items,form);
  return withStoreLock(dir,()=>{
    const file=path.join(dir,token+'.json');
    if(fs.existsSync(file)) return;
    const now=new Date(),due=new Date(now.getTime()+86400000);
    for(const [i,a] of answers.entries()){
      const q=items[i];
      if(a.correct || !q.target) continue;
      const matches=catalog.filter(t=>t.kind===(q.section==='V'?'vocab':'grammar') && t.title===q.target);
      if(matches.length===1) enqueueMistake(databasePath(),matches[0].id,q.section==='V'?'recall':'cloze',due,now);
    }
    const temp=file+'.'+randomUUID()+'.tmp';
    try{
      fs.writeFileSync(temp,JSON.stringify({level:items[0].level,at:now.toISOString(),answers}),{flag:'wx',mode:0o600});
      fs.renameSync(temp,file);
    }finally{fs.rmSync(temp,{force:true});}
  });
}
export function lastResults(dir=path.join(storeDirectory(),'official-results')){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')) as {
    level:string;at:string;answers:{id:string;section:string;correct:boolean}[]
  }).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,5);
}
