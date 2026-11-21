const CACHE='tilebook-offline-v1';
const SHELL='/offline';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const shell=await fetch(SHELL,{cache:'reload'});
 if(!shell.ok)throw new Error('Offline page unavailable');
 const html=await shell.clone().text();
 const paths=[...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')))];
 await cache.addAll([...paths,'/icons/icon-192.png','/icons/icon-512.png','/manifest.webmanifest']);
 await cache.put(SHELL,shell);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('tilebook-offline-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/portal/'))return;
 if(req.mode==='navigate'){
 event.respondWith(fetch(req).catch(()=>caches.match(SHELL).then(x=>x||Response.error())));return;
 }
 if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/')){
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(req);if(hit)return hit;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;})());
 }
});
