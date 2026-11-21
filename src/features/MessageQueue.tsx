'use client';
import {useEffect,useRef,useState} from 'react';
import {Clock,RefreshCw,Send} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useBook} from '@/lib/client';
import {share} from './model';
export default function MessageQueue(){
 const {book,businessId,refresh}=useBook(),t=useTranslations();const [feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false);
 const started=useRef('');const allowed=book?.role==='Owner'||book?.role==='Manager';
 async function prepare(){
  setBusy(true);try{const res=await fetch('/api/reminders/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessId})});const data=await res.json();if(!res.ok)throw Error(data.error||t('retry'));if(data.queued||data.reminders)await refresh();setFeedback(t('queuePrepared')+' · '+data.queued);}catch(e){setFeedback(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 useEffect(()=>{if(businessId&&allowed&&started.current!==businessId&&navigator.onLine){started.current=businessId;void prepare();}},[businessId,allowed]);
 if(!allowed)return null;
 const jobs=[...(book?.records.outbox||[])].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,40);
 return <section className="tb-panel tb-toolbody"><div className="card-heading"><h2><Clock size={18}/>{t('outbox')}</h2><button className="btn" disabled={busy} onClick={prepare}><RefreshCw size={16}/>{t('refresh')}</button></div><p>{t('outboxHint')}</p>{feedback&&<small role="status">{feedback}</small>}{jobs.map(j=>{const k=String(j.kind||'saleInvoices');const customer=book?.records.parties?.find(p=>p.id===j.partyId);const phone=String(j.recipient||customer?.phone||'');const msg=String(j.message||j.reference||'');return <article className="outbox-row" key={j.id}><div><b>{t.has('event_'+k)?t('event_'+k):k}</b><small>{String(j.reference||customer?.name||'')} · {String(j.channel||'WhatsApp')}</small>{msg&&<p>{msg}</p>}</div>{phone&&msg&&(j.channel==='sms'?<a className="btn" href={'sms:'+encodeURIComponent(phone)+'?body='+encodeURIComponent(msg)}>{t('smsEnabled')}</a>:<button className="btn" onClick={()=>share(msg,phone)}><Send size={15}/>WhatsApp</button>)}</article>})}</section>;
}