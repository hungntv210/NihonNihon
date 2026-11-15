'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { DayPeriod } from '../../core/day-period.ts';
export function TownEffects({period,children}:{period:DayPeriod;children:ReactNode}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const host=ref.current;if(!host)return;
    const canvas=document.createElement('canvas');canvas.className='town-particles';canvas.setAttribute('aria-hidden','true');host.append(canvas);
    const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const layers=Array.from(host.querySelectorAll<SVGGElement>('[data-depth]'));
    const particles=Array.from({length:40},(_,i)=>({x:((i*137+31)%991)/991,y:i<28?.025+(i*53%180)/1000:.62+(i*43%300)/1000,star:i<28,phase:i*1.73}));
    let frame=0,scrollFrame=0,last=0,width=0,height=0,dpr=1,visible=true;
    const enabled=()=>document.documentElement.dataset.motion!=='off'&&!media.matches&&!document.hidden;
    const draw=(time:number)=>{ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);if(period!=='night')return;for(const p of particles){ctx.save();ctx.translate(p.x*width+(p.star?0:Math.sin(time*.65+p.phase)*6),p.y*height+(p.star?0:Math.cos(time*.8+p.phase)*4));ctx.globalAlpha=.35+.6*(.5+.5*Math.sin(time*.7+p.phase));ctx.fillStyle=p.star?'#f8edda':'#ffdf91';const size=p.star?1.4:2.2;ctx.fillRect(-size/2,-size/2,size,size);if(!p.star){ctx.globalAlpha*=.12;ctx.fillRect(-4,-4,8,8);}ctx.restore();}};
    const tick=(time:number)=>{frame=0;if(!enabled()||!visible)return;if(time-last>=1000/30){last=time;draw(time/1000)}frame=requestAnimationFrame(tick)};
    const parallax=()=>{scrollFrame=0;if(!enabled())return;const rect=host.getBoundingClientRect(),view=innerHeight||800;const offset=Math.max(-1,Math.min(1,(view*.5-rect.top-rect.height*.5)/view));for(const layer of layers)layer.style.transform=`translateY(${(offset*Number(layer.dataset.depth)*100).toFixed(2)}px)`};
    const scroll=()=>{if(enabled()&&!scrollFrame)scrollFrame=requestAnimationFrame(parallax)};
    const update=()=>{cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);frame=scrollFrame=0;last=0;if(enabled()&&visible){if(period==='night')frame=requestAnimationFrame(tick);scroll()}else{layers.forEach(layer=>layer.style.transform='');draw(0)}};
    const resize=new ResizeObserver(entries=>{const rect=entries[0].contentRect;width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));draw(0);scroll()});resize.observe(host);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;update()});intersection.observe(host);
    const appearance=new MutationObserver(update);appearance.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
    document.addEventListener('visibilitychange',update);window.addEventListener('scroll',scroll,{passive:true});media.addEventListener('change',update);update();
    return ()=>{cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);resize.disconnect();intersection.disconnect();appearance.disconnect();document.removeEventListener('visibilitychange',update);window.removeEventListener('scroll',scroll);media.removeEventListener('change',update);canvas.remove()};
  },[period]);
  return <div className="town-viewport" ref={ref}>{children}</div>;
}
