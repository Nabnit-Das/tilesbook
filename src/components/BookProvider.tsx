'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {DeviceLock} from './Passcode';import {prepareQueuedMedia} from '@/lib/queueSync';
import {Book,type RowInput,type SaveResult} from '@/lib/client';
import type {Snapshot} from '@/types/database';
import {localBook,type Pending} from '@/lib/offline';
const eligible=new Set(['saleInvoices','payments','damage','stockCounts','transfers','display','purchaseBills']);
async function submit(input:Pending):Promise<SaveResult>{
 const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resource:input.resource,data:input.data,action:input.action,requestId:input.requestId,businessId:input.businessId})});
 const json=await r.json();if(!r.ok)throw new Error(String(json.error??r.statusText));return json as SaveResult;
}
export function BookProvider({userId,children}:{userId:string;children:React.ReactNode}){
 const [book,setBook]=useState<Snapshot|null>(null),[error,setError]=useState(''),[firm,setFirm]=useState(''),[pending,setPending]=useState(0),[online,setOnline]=useState(true);
 const seq=useRef(0), syncing=useRef(false);
 const refresh=useCallback(async()=>{
 const sequence=++seq.current;let target=firm||localStorage.getItem('tb-firm')||'';
 const previous=JSON.parse(localStorage.getItem('tb-active')||'null') as {userId:string;firm:string}|null;
 if(previous && previous.userId!==userId){target='';localStorage.removeItem('tb-firm');}
 try{
 const response=await fetch('/api/data'+(target?'?businessId='+encodeURIComponent(target):''),{cache:'no-store'});if(response.status===401){location.assign('/login');return;}
 const b=await response.json();if(!response.ok)throw new Error(b.error||response.statusText);
 if(sequence!==seq.current)return;setBook(b);setError('');target=b.business.id;
 localStorage.setItem('tb-firm',target);localStorage.setItem('tb-active',JSON.stringify({userId,firm:target,expires:Date.now()+12*3600000}));
 await localBook.snapshots.put({key:userId+':'+target,book:b});setPending(await localBook.queue.where('[userId+businessId]').equals([userId,target]).count());
 }catch(e){if(sequence!==seq.current)return;
 if(!navigator.onLine || e instanceof TypeError){const saved=await localBook.snapshots.get(userId+':'+target);if(saved){setBook(saved.book);setError('');setPending(await localBook.queue.where('[userId+businessId]').equals([userId,target]).count());return;}}
 setError(e instanceof Error?e.message:String(e));}
 },[firm,userId]);
 const businessId=book?.business.id??firm;
 const flush=useCallback(async()=>{if(!navigator.onLine || !businessId || syncing.current)return;syncing.current=true;
 try{const q=await localBook.queue.where('[userId+businessId]').equals([userId,businessId]).sortBy('time');for(const p of q){const prepared=await prepareQueuedMedia(p);if(prepared!==p)await localBook.queue.put(prepared);await submit(prepared);await localBook.queue.delete(p.requestId);}if(q.length)await refresh();}
 catch(e){setError(e instanceof Error?e.message:String(e));}finally{syncing.current=false;setPending(await localBook.queue.where('[userId+businessId]').equals([userId,businessId]).count());}
 },[userId,businessId,refresh]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{const update=()=>{setOnline(navigator.onLine);if(navigator.onLine)void flush();};update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[flush]);
 const save=useCallback(async(resource:string,data:RowInput,action='create')=>{
 if(!businessId)throw new Error('Choose a business first');
 const p:Pending={userId,businessId,resource,data,action,time:Date.now(),requestId:crypto.randomUUID()};
 try{if(!navigator.onLine)throw new TypeError('Offline');const result=await submit(p);await refresh();return result;}
 catch(e){if(!(e instanceof TypeError) || !eligible.has(resource) || action!=='create')throw e;await localBook.queue.put(p);setPending(n=>n+1);return {row:{id:p.requestId,...data},queued:true};}
 },[userId,businessId,refresh]);
 return <Book.Provider value={{book,error,businessId,refresh:async()=>{await refresh();await flush();},save,switchBusiness:id=>{setBook(null);localStorage.setItem('tb-firm',id);setFirm(id);},pending,online}}><DeviceLock userId={userId}>{children}</DeviceLock></Book.Provider>;
}