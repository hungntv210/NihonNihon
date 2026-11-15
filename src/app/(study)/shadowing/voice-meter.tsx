'use client';
import {useEffect,useRef} from 'react';import {reducedMotion} from '../../../components/motion/animate.ts';
export function VoiceMeter({analyser}:{analyser:AnalyserNode|null}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!analyser)return;const el=root.current!,bars=Array.from(el.querySelectorAll<HTMLElement>('i')),data=new Uint8Array(analyser.frequencyBinCount);let raf=0,last=0;
 const tick=(now:number)=>{raf=0;if(document.hidden)return;raf=requestAnimationFrame(tick);if(now-last<1000/30)return;last=now;analyser.getByteFrequencyData(data);let sum=0;for(const n of data)sum+=n;const value=Math.round(sum/data.length/255*100);el.setAttribute('aria-valuenow',String(value));el.dataset.volume=String(value);const still=reducedMotion();bars.forEach((bar,i)=>bar.style.transform=`scaleY(${still?.2:Math.max(.08,data[Math.floor(i*data.length/bars.length)]/255)})`);};
 const sync=()=>{cancelAnimationFrame(raf);raf=0;if(!document.hidden)raf=requestAnimationFrame(tick);};document.addEventListener('visibilitychange',sync);sync();return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',sync);};},[analyser]);
 return <div ref={root} className="voice-meter" role="meter" aria-label="Âm lượng micro thực tế" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>{Array.from({length:8},(_,i)=><i key={i}/>)}</div>;
}
