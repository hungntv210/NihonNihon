'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
export function RoutePresentation({children}:{children:ReactNode}){
 const pathname=usePathname(),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const cards=root.current?.querySelectorAll<HTMLElement>('.content-card,.stat-card,.today-block');
  if(!cards||!('IntersectionObserver'in window))return;
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('card-visible');observer.unobserve(entry.target)}},{threshold:.05});
  for(const card of cards){card.classList.add('card-reveal');observer.observe(card)}
  return()=>{observer.disconnect();for(const card of cards)card.classList.remove('card-reveal','card-visible')};
 },[pathname]);
 return <div ref={root} className="route-presentation" key={pathname}>{children}</div>;
}
