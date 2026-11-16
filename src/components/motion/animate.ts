export const EASE_OUT='cubic-bezier(0.23,1,0.32,1)';
export function reducedMotion(){return document.documentElement.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches;}
export function keyboardMotion(){return document.documentElement.dataset.input==='keyboard';}
export function animateUI(element:Element|null,frames:Keyframe[],duration=180,keyboard=keyboardMotion()){
 if(!element||keyboard)return;
 const reduced=reducedMotion(),animation=element.animate(reduced?(frames.some(f=>f.opacity!==undefined)?frames.map(({transform,...frame})=>frame):[{opacity:.8},{opacity:1}]):frames,{duration:reduced?Math.min(duration,80):duration,easing:EASE_OUT});
 animation.finished.catch(()=>{});return animation;
}
export function snapshotCard(element:HTMLElement|null){
 if(!element||keyboardMotion())return null;const rect=element.getBoundingClientRect(),copy=element.cloneNode(true) as HTMLElement;
 copy.setAttribute('aria-hidden','true');copy.inert=true;copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 Object.assign(copy.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',pointerEvents:'none',zIndex:'30'});document.body.append(copy);return copy;
}
export function swapCards(old:HTMLElement|null,next:HTMLElement|null,keyboard=false){
 const exit=animateUI(old,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-16px)'}],180,keyboard);
 if(old){if(exit)exit.finished.catch(()=>{}).finally(()=>old.remove());else old.remove();}
 return animateUI(next,[{opacity:0,transform:'translateX(16px)'},{opacity:1,transform:'translateX(0)'}],180,keyboard);
}
