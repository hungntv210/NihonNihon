const STATIC='nihon-static-v1', PRIVATE='nihon-private-v1';
let key=null;
const enc=new TextEncoder();
async function derive(password,salt){const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function seal(bytes){const iv=crypto.getRandomValues(new Uint8Array(12)),body=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes);return new Response(new Blob([iv,body]));}
async function open(response){const b=new Uint8Array(await response.arrayBuffer());return crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},key,b.slice(12));}
self.addEventListener('install',event=>event.waitUntil(caches.open(STATIC).then(cache=>cache.addAll(['/offline.html','/icon.svg'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>event.waitUntil((async()=>{const reply=value=>event.ports[0]?.postMessage(value);try{const cache=await caches.open(PRIVATE);if(event.data.type==='CLEAR'){key=null;await caches.delete(PRIVATE);reply({ok:true});return;}if(event.data.type==='LOCK'){key=null;reply({ok:true});return;}if(!['ENABLE','UNLOCK'].includes(event.data.type))return;
let saltResponse=await cache.match('/__offline_salt'),salt=saltResponse?new Uint8Array(await saltResponse.arrayBuffer()):crypto.getRandomValues(new Uint8Array(16));
key=await derive(event.data.password,salt);let proof=await cache.match('/__offline_proof');if(proof){await open(proof);}else{if(event.data.type!=='ENABLE')throw Error();await cache.put('/__offline_salt',new Response(salt));await cache.put('/__offline_proof',await seal(enc.encode('nihon-offline-v1')));}reply({ok:true});}catch{key=null;reply({ok:false});}})()));
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(url.origin!==location.origin)return;
if(url.pathname==='/api/logout'){event.respondWith((async()=>{const response=await fetch(request);if(response.ok||response.status===303){key=null;await caches.delete(PRIVATE);}return response;})());return;}
if(request.method!=='GET')return;
if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/fonts/')){event.respondWith((async()=>{const cache=await caches.open(STATIC),saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;})());return;}
if(request.mode!=='navigate')return;
event.respondWith((async()=>{const cache=await caches.open(PRIVATE);try{const response=await fetch(request);if(key&&response.ok&&!response.redirected&&response.headers.get('content-type')?.includes('text/html')&&!['/login','/offline.html'].includes(url.pathname)){const bytes=await response.clone().arrayBuffer();await cache.put(request.url,await seal(bytes));}if(response.redirected&&new URL(response.url).pathname==='/login'){key=null;await caches.delete(PRIVATE);}return response;}catch{const saved=await cache.match(request.url);if(key&&saved){try{return new Response(await open(saved),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}catch{key=null;}}return (await caches.open(STATIC)).match('/offline.html');}})());});
