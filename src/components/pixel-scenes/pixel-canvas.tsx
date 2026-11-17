'use client';
import {useEffect,useRef} from 'react';
import type {sceneClock,SceneId} from './model.ts';
import {shadowProgress} from './model.ts';
import type {Definition,PixelEngine} from './engine.js';
import styles from './scene.module.css';
const loaders={
 'login-shoji':()=>import('./login-shoji.js'),
 'vocab-market':()=>import('./vocab-market.js'),
 'grammar-kinkakuji':()=>import('./grammar-kinkakuji.js'),
 'jlpt-study':()=>import('./jlpt-study.js'),
 'roadmap-journey':()=>import('./roadmap-journey.js'),
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
 const due=(e:Event)=>{const n=(e as CustomEvent<number>).detail;if(id==='review-koi'&&Number.isFinite(n)){latest.current={dueCards:Math.max(0,Math.min(10,n))};instance.current?.params(latest.current);}};
 const progress=(e:Event)=>{if(id==='shadowing-inari'){latest.current={progress:shadowProgress((e as CustomEvent).detail)};instance.current?.params(latest.current);}};
 const answered=(e:Event)=>{if(id==='jlpt-study'){const n=(e as CustomEvent<number>).detail;if(Number.isFinite(n)){latest.current={answered:Math.max(0,Math.min(10,n))};instance.current?.params(latest.current);}}};window.addEventListener('nihon-jlpt-answered',answered);window.addEventListener('nihon-motion',changed);window.addEventListener('nihon-scene-due',due);window.addEventListener('nihon-shadowing-progress',progress);
 void Promise.all([import('./engine.js'),loaders[id](),['home-tokyo','shadowing-inari','vocab-market','grammar-kinkakuji'].includes(id)?import('./festivals.js'):Promise.resolve(null)]).then(([{SceneEngine},definition,festivals])=>{if(disposed)return;const def=(festivals?festivals.decorate(definition.default):definition.default) as Definition;const options={time:clock.period,season:clock.season,date:clock.date,motion:motion(),params:latest.current};const engine=def.mount?def.mount(element,options):new SceneEngine.Engine(element,def,options);instance.current=engine;Object.assign(element,{pixelEngine:engine});element.dataset.ready='true';}).catch(error=>{console.error('Pixel scene failed',error);if(!disposed)element.dataset.ready='error';});
 return()=>{disposed=true;window.removeEventListener('nihon-jlpt-answered',answered);window.removeEventListener('nihon-motion',changed);window.removeEventListener('nihon-scene-due',due);window.removeEventListener('nihon-shadowing-progress',progress);instance.current?.destroy();instance.current=null;};
 },[id,clock.period,clock.season,clock.date]);
 useEffect(()=>{instance.current?.params(params);},[params]);
 const canvas=<div className={id==='roadmap-journey'?styles.strip:id==='login-shoji'?styles.viewport+' '+styles.loginViewport:styles.viewport} ref={host} aria-hidden="true" data-pixel-viewport={id}/>;return id==='roadmap-journey'?<><div className={styles.journeyFrame} data-journey-frame tabIndex={0} role="region" aria-label="Cuộn ngang xem hành trình 87 tuần">{canvas}</div><button type="button" className="text-link" onClick={()=>instance.current?.followTrain?.()}>Theo tàu →</button></>:canvas;
}
