'use client';
import {useEffect,useRef,useState} from 'react';import {practiceDelta,type PracticeSample,type PracticeStatus} from './practice.ts';
export function usePractice(clipId:string,enabled:boolean,sample:()=>Omit<PracticeSample,'at'|'visible'>){
 const current=useRef(sample);current.current=sample;const [status,setStatus]=useState<PracticeStatus|null>(null),[error,setError]=useState(false);
 const queue=useRef<{clip_id:string;segment_id:string;duration_ms:number}[]>([]),send=useRef<()=>void>(()=>{});
 useEffect(()=>{if(!enabled)return;let disposed=false,busy=false,total=0,seq=0;const client=crypto.randomUUID();const read=():PracticeSample=>({...current.current(),at:performance.now(),visible:document.visibilityState==='visible'});let previous=read();
 const flush=async()=>{if(busy)return;busy=true;let sent=false;const recording=queue.current[0];try{const response=await fetch('/shadowing/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:client,seq:seq++,active_ms:Math.floor(total),...(recording?{recording}:{})}),keepalive:true});if(!response.ok)throw Error();const value=await response.json();if(recording)queue.current.shift();sent=true;if(!disposed){setStatus(value);setError(false);}}catch{if(!disposed)setError(true);}finally{busy=false;if(disposed&&sent&&queue.current.length)void flush();}};
 send.current=()=>{void flush();};void flush();const timer=setInterval(()=>{const next=read();total+=practiceDelta(previous,next);previous=next;},1000),heartbeat=setInterval(()=>{void flush();},5000);const visibility=()=>{previous=read();void flush();};document.addEventListener('visibilitychange',visibility);
 return()=>{disposed=true;clearInterval(timer);clearInterval(heartbeat);document.removeEventListener('visibilitychange',visibility);send.current=()=>{};void flush();};
 },[clipId,enabled]);
 return {status,error,record:(segmentId:string,durationMs:number)=>{if(!enabled)return;queue.current.push({clip_id:clipId,segment_id:segmentId,duration_ms:Math.min(60000,Math.max(1,Math.round(durationMs)))});send.current();}};
}
