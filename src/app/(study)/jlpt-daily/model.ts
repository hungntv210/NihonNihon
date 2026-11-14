import { createHash } from 'node:crypto';
import {plainJapanese,hardQuestionIssues} from './hard-qa.ts';
export const questionTypes = ['reading','spelling','context','synonym','usage','grammar','order','paragraph'] as const;
export type QuestionType = typeof questionTypes[number];
export type Level = 'N5'|'N4'|'N3'|'N2'|'N1';
export type Source = { id:string; kind:'vocab'|'kanji'|'grammar'; level:Level; title:string; reading:string|null; english:string[]; pos:string[]; hash:string };
export type Draft = { day:number; position:number; type:QuestionType; targetId:string; stem:string; choices:string[]; correct:number; explanation:string; order:number[]; starSlot:number };
export type Question = Draft & { id:string; fingerprint:string; date:string };
export type Audit = { index:number; possibleAnswers:number[]; sameType:boolean; plausible:boolean; levelMatch:boolean; learnedOnly:boolean; original:boolean; explanationCorrect:boolean };
export type Bank = { version:1; week:string; level:Level; generatedAt:string; model:string; verifierModel:string; promptHash:string; auditPromptHash:string; sourceHashes:Record<string,string>; questions:Question[]; audit:Audit[] };
export const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requireValue(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message);}
export function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export const plusDays=(date:string,n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const fingerprint=(s:string)=>hash(s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase());
const text=(s:unknown,max:number)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&s===s.normalize('NFC');
export function validateQuestion(raw:unknown,catalog:Source[],week:string,level:Level,history:Question[]=[]):Question{
 requireValue(validDate(week)&&new Date(week+'T00:00:00Z').getUTCDay()===1,'WEEK_MUST_START_MONDAY');
 const sources=new Map(catalog.map(s=>[s.id,s]));
 const knownKanji=new Set(catalog.flatMap(s=>[...s.title,...s.reading??'']).filter(c=>/\p{Script=Han}/u.test(c)));
  const q=raw as Draft;requireValue(q&&questionTypes.includes(q.type)&&Number.isInteger(q.day)&&q.day>=0&&q.day<7&&Number.isInteger(q.position)&&q.position>=0&&q.position<10,'INVALID_QUESTION');
  const source=sources.get(q.targetId);requireValue(source&&source.id.startsWith('openjlpt:')&&source.level===level,'SOURCE_NOT_LEARNED_OR_WRONG_LEVEL');
  requireValue(text(q.stem,2200)&&text(q.explanation,1600)&&Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(v=>text(v,350)),'INVALID_TEXT_OR_CHOICES');
  requireValue(q.choices.every(v=>/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(v)),'CHOICE_TYPE');
  requireValue(new Set(q.choices.map(v=>v.normalize('NFKC').trim())).size===4&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4,'ONE_DISTINCT_ANSWER_REQUIRED');
  const grammar=['grammar','order','paragraph'].includes(q.type);requireValue(grammar?source.kind==='grammar':q.type==='spelling'?source.kind!=='grammar':source.kind==='vocab','SOURCE_KIND');
  if(q.type==='reading'){requireValue(source.reading&&q.choices[q.correct]===source.reading,'READING_EVIDENCE');requireValue(q.choices.every(v=>/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(v)),'READING_DISTRACTOR_TYPE');}
  else if(q.type!=='order')requireValue(q.choices[q.correct]===plainJapanese(source.title),'ANSWER_SOURCE_EVIDENCE');
  if(q.type==='order'){requireValue(Array.isArray(q.order)&&q.order.length===4&&new Set(q.order).size===4&&q.order.every(v=>Number.isInteger(v)&&v>=0&&v<4)&&Number.isInteger(q.starSlot)&&q.starSlot>=0&&q.starSlot<4&&q.correct===q.order[q.starSlot]&&(q.stem.match(/★/gu)??[]).length===1,'WORD_ORDER_EVIDENCE');}
  requireValue([...q.stem,...q.choices.join('')].filter(c=>/\p{Script=Han}/u.test(c)).every(c=>knownKanji.has(c)),'UNLEARNED_KANJI');
  const issues=hardQuestionIssues(q,source,catalog);requireValue(!issues.length,'HARD_QA_'+issues.join(','));
  const date=plusDays(week,q.day),fp=fingerprint(q.stem),slot=q.day+':'+q.position;
  requireValue(!history.some(old=>old.fingerprint===fp&&Math.abs(Date.parse(date)-Date.parse(old.date))<=30*86400000),'REPEATED_WITHIN_THIRTY_DAYS');
  return {...q,id:hash({week,level,slot,fp}).slice(0,32),fingerprint:fp,date};
}
function validateDays(input:unknown,catalog:Source[],week:string,level:Level,history:Question[],days:number[],wholeWeek:boolean):Question[]{
 requireValue(Array.isArray(input)&&input.length===days.length*10,wholeWeek?'NEED_SEVENTY_QUESTIONS':'NEED_TEN_QUESTIONS');
 const seen=new Set<string>(),positions=new Set<string>();
 const rows=input.map(raw=>{const q=validateQuestion(raw,catalog,week,level,history),slot=q.day+':'+q.position;requireValue(days.includes(q.day),'INVALID_QUESTION');requireValue(!seen.has(q.fingerprint)&&!positions.has(slot),'DUPLICATE_QUESTION');seen.add(q.fingerprint);positions.add(slot);return q;});
 if(wholeWeek)requireValue(questionTypes.every(t=>rows.some(q=>q.type===t)),'MISSING_WEEKLY_QUESTION_TYPE');
 for(const day of days){const selected=rows.filter(q=>q.day===day);requireValue(selected.length===10&&new Set(selected.map(q=>q.type)).size>=3&&selected.some(q=>['grammar','order','paragraph'].includes(q.type))&&selected.some(q=>!['grammar','order','paragraph'].includes(q.type)),'INVALID_DAILY_MIX');}
 return rows.sort((a,b)=>a.day-b.day||a.position-b.position);
}
export const validateDrafts=(input:unknown,catalog:Source[],week:string,level:Level,history:Question[]=[])=>validateDays(input,catalog,week,level,history,[0,1,2,3,4,5,6],true);
export function validateDayDrafts(input:unknown,catalog:Source[],week:string,level:Level,day:number,history:Question[]=[]){requireValue(Number.isInteger(day)&&day>=0&&day<7,'INVALID_DAY');return validateDays(input,catalog,week,level,history,[day],false);}
export function validateAudit(input:unknown,questions:Question[]):Audit[]{
 requireValue(Array.isArray(input)&&input.length===questions.length,'INCOMPLETE_SEMANTIC_QA');const seen=new Set<number>();
 for(const raw of input){const a=raw as Audit;requireValue(a&&Number.isInteger(a.index)&&a.index>=0&&a.index<questions.length&&!seen.has(a.index),'INVALID_QA_INDEX');seen.add(a.index);requireValue(Array.isArray(a.possibleAnswers)&&a.possibleAnswers.length===1&&a.possibleAnswers[0]===questions[a.index].correct&&a.sameType===true&&a.plausible===true&&a.levelMatch===true&&a.learnedOnly===true&&a.original===true&&a.explanationCorrect===true,'SEMANTIC_QA_REJECTED');}
 return input as Audit[];
}
