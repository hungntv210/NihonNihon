import {demo} from './demo.ts';
export type ClipSegment={id:string;start:number;end:number;ja:string;kana:string|null;speaker:string|null;vi:string|null};
export type Clip={id:string;title:string;level:string;topic:string;duration:number;start:number;end:number;isDemo:boolean;attribution:string;license:string;mediaUrl:string|null;youtubeId:string|null;segments:ClipSegment[]};
export const syntheticClip:Clip={...demo,start:0,end:demo.duration,id:'demo',level:'N5',topic:'Thử thao tác',isDemo:true,attribution:'Video tổng hợp tự tạo',license:'Original synthetic fixture',mediaUrl:'/shadowing/media',youtubeId:null,segments:demo.segments.map((s,i)=>({...s,id:'demo-'+i,kana:null,speaker:null}))};
export function parsePrivateClip(id:string,metadata:unknown):Clip{
 const m=metadata as {title:string;level?:string;topic?:string;duration_ms:number;clip_start_ms:number;clip_end_ms:number;origin:{kind:string;attribution:string;license:string;sha256:string};segments:{id:string;ja:string;kana?:string;speaker?:string;vi?:string;start_ms:number;end_ms:number}[]};
 if(!m||!m.title||m.origin?.kind!=='file'||!m.origin.attribution||!m.origin.license||!/^[a-f0-9]{64}$/.test(m.origin.sha256)||!Number.isSafeInteger(m.duration_ms)||m.duration_ms<=0||!Array.isArray(m.segments)||!m.segments.length)throw Error('INVALID_PRIVATE_CLIP');
 if(!Number.isSafeInteger(m.clip_start_ms)||!Number.isSafeInteger(m.clip_end_ms)||m.clip_start_ms<0||m.clip_end_ms>m.duration_ms||m.clip_end_ms-m.clip_start_ms<10000||m.clip_end_ms-m.clip_start_ms>60000)throw Error('INVALID_CLIP_RANGE_10_TO_60_SECONDS');
 let previous=m.clip_start_ms;const seen=new Set<string>();
 const segments=m.segments.map(s=>{if(!s.id||seen.has(s.id)||!s.ja?.trim()||!Number.isSafeInteger(s.start_ms)||!Number.isSafeInteger(s.end_ms)||s.start_ms<previous||s.end_ms<=s.start_ms||s.end_ms>m.clip_end_ms)throw Error('INVALID_CLIP_TIMING');seen.add(s.id);previous=s.end_ms;return {id:s.id,start:s.start_ms/1000,end:s.end_ms/1000,ja:s.ja,kana:s.kana??null,speaker:s.speaker??null,vi:s.vi??null};});
 return {id,title:m.title,level:m.level??'',topic:m.topic??'',duration:m.duration_ms/1000,start:m.clip_start_ms/1000,end:m.clip_end_ms/1000,isDemo:false,attribution:m.origin.attribution,license:m.origin.license,mediaUrl:'/shadowing/media?clip='+encodeURIComponent(id),youtubeId:null,segments};
}
export function parseYoutubeClip(metadata:unknown):Clip{
 const m=metadata as {id:string;title:string;level?:string;topic?:string;duration_ms:number;clip_start_ms:number;clip_end_ms:number;origin:{kind:string;video_id:string;attribution:string;license:string};subtitle_sources:{ja:string;vi:string};segments:{id:string;ja:string;kana:string;vi:string;start_ms:number;end_ms:number}[]};
 if(!m?.id||!m.title||m.origin?.kind!=='youtube'||!/^[A-Za-z0-9_-]{11}$/.test(m.origin.video_id)||!m.origin.attribution||!m.origin.license||m.subtitle_sources?.ja!=='YouTube ja manual'||m.subtitle_sources?.vi!=='YouTube vi manual'||!Number.isSafeInteger(m.duration_ms)||m.duration_ms<=0||!Array.isArray(m.segments)||m.segments.length<3||m.segments.length>8)throw Error('INVALID_YOUTUBE_CLIP');
 if(!Number.isSafeInteger(m.clip_start_ms)||!Number.isSafeInteger(m.clip_end_ms)||m.clip_start_ms<0||m.clip_end_ms>m.duration_ms||m.clip_end_ms-m.clip_start_ms<10000||m.clip_end_ms-m.clip_start_ms>60000)throw Error('INVALID_CLIP_RANGE_10_TO_60_SECONDS');
 let previous=m.clip_start_ms;const seen=new Set<string>();
 const segments=m.segments.map(s=>{if(!s.id||seen.has(s.id)||!s.ja?.trim()||!s.kana?.trim()||!s.vi?.trim()||!Number.isSafeInteger(s.start_ms)||!Number.isSafeInteger(s.end_ms)||s.start_ms<previous||s.end_ms<=s.start_ms||s.end_ms>m.clip_end_ms)throw Error('INVALID_CLIP_TIMING');seen.add(s.id);previous=s.end_ms;return {id:s.id,start:s.start_ms/1000,end:s.end_ms/1000,ja:s.ja,kana:s.kana,speaker:null,vi:s.vi};});
 return {id:m.id,title:m.title,level:m.level??'',topic:m.topic??'',duration:m.duration_ms/1000,start:m.clip_start_ms/1000,end:m.clip_end_ms/1000,isDemo:false,attribution:m.origin.attribution,license:m.origin.license,mediaUrl:null,youtubeId:m.origin.video_id,segments};
}
export function playbackTime(time:number,clip:Clip,skipGaps:boolean){
 const bounded=Math.max(clip.start,Math.min(clip.end,time));
 if(skipGaps)for(let i=1;i<clip.segments.length;i++){const previous=clip.segments[i-1],next=clip.segments[i];if(next.start-previous.end>3&&bounded>=previous.end&&bounded<next.start)return next.start;}
 return bounded;
}
