'use client';
import {useEffect,useRef} from 'react';import {animateUI,reducedMotion,keyboardMotion} from './animate.ts';
export function CountUp({value,suffix=''}:{value:number;suffix?:string}){
 const text=useRef<HTMLSpanElement>(null),played=useRef(false);
 useEffect(()=>{const el=text.current!;if(played.current){el.textContent=String(value);return;}let frame=0;const io=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;io.disconnect();played.current=true;if(reducedMotion()||keyboardMotion()){el.textContent=String(value);return;}el.textContent='0';const start=performance.now();const tick=(at:number)=>{const t=Math.min(1,(at-start)/600);el.textContent=String(Math.round(value*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);});io.observe(el);return()=>{io.disconnect();cancelAnimationFrame(frame);};},[value]);
 return <><span aria-label={String(value)}><span ref={text} aria-hidden="true">{value}</span></span>{suffix}</>;
}
export function MotionProgress({value,max=1,label,id}:{value:number;max?:number;label:string;id?:string}){
 const bar=useRef<HTMLSpanElement>(null),seen=useRef(false);
 useEffect(()=>{const el=bar.current!,ratio=Math.max(0,Math.min(1,value/Math.max(1,max)));el.style.transform=`scaleX(${ratio})`;if(seen.current)return;const io=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;seen.current=true;io.disconnect();if(!reducedMotion())animateUI(el,[{transform:'scaleX(0)'},{transform:`scaleX(${ratio})`}],240);});io.observe(el);return()=>io.disconnect();},[value,max]);
 return <span id={id} className="motion-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span ref={bar}/></span>;
}
