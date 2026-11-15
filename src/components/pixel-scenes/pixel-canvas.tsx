'use client';
import {useEffect,useRef} from 'react';
import type {sceneClock,SceneId} from './model.ts';
import {shadowProgress} from './model.ts';
import type {Definition,PixelEngine} from './engine.js';
import styles from './scene.module.css';
const loaders={
 'home-tokyo':()=>import('./home-tokyo.js'),
 'review-koi':()=>import('./review-koi.js'),
 'kanji-himeji':()=>import('./kanji-himeji.js'),
 'shadowing-inari':()=>import('./shadowing-inari.js'),
};
export function PixelCanvas({id,clock,params}:{id:SceneId;clock:ReturnType<typeof sceneClock>;params:Record<string,number>}){
 const host=useRef<HTMLDivElement>(null),instance=useRef<PixelEngine|null>(null),latest=useRef(params);latest.current=params;
 useEffect(()=>{let disposed=false;const element=host.current!;
 const motion=()=>document.documentElement.dataset.motion!=='off';
 const changed=()=>instance.current?.set({motion:motion()});
 const due=(e:Event)=>{const n=(e as CustomEvent<number>).detail;if(id==='review-koi'&&Number.isFinite(n)){latest.current={dueCards:Math.max(0,Math.min(12,n))};instance.current?.params(latest.current);}};
 const progress=(e:Event)=>{if(id==='shadowing-inari'){latest.current={progress:shadowProgress((e as CustomEvent).detail)};instance.current?.params(latest.current);}};
 window.addEventListener('nihon-motion',changed);window.addEventListener('nihon-scene-due',due);window.addEventListener('nihon-shadowing-progress',progress);
 void Promise.all([import('./engine.js'),loaders[id]()]).then(([{SceneEngine},definition])=>{if(disposed)return;const engine=new SceneEngine.Engine(element,definition.default as Definition,{time:clock.period,season:clock.season,date:clock.date,motion:motion(),params:latest.current});instance.current=engine;Object.assign(element,{pixelEngine:engine});element.dataset.ready='true';}).catch(()=>{if(!disposed)element.dataset.ready='error';});
 return()=>{disposed=true;window.removeEventListener('nihon-motion',changed);window.removeEventListener('nihon-scene-due',due);window.removeEventListener('nihon-shadowing-progress',progress);instance.current?.destroy();instance.current=null;};
 },[id,clock.period,clock.season,clock.date]);
 useEffect(()=>{instance.current?.params(params);},[params]);
 return <div className={styles.viewport} ref={host} aria-hidden="true" data-pixel-viewport={id}/>;
}
