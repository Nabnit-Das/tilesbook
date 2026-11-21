'use client';
import {useEffect,useState} from 'react';
import {useTranslations} from 'next-intl';
import Workspace from '@/features/Workspace';
import {BookProvider} from './BookProvider';
import {useBook} from '@/lib/client';
import Brand from './Brand';
function OfflineDesk(){
 const t=useTranslations(),{book,error,online,pending,refresh}=useBook();
 const [slug,setSlug]=useState('invoices');
 return <div className="offline-desk"><header><Brand/><span>{t(online?'online':'offline')} · {pending} {t('queued')}</span></header><main><div className="offline-tools">{[['invoices','newBill'],['payment-in','nav_payment-in'],['damage','nav_damage']].map(([v,k])=><button key={v} className={'btn '+(slug===v?'primary':'')} onClick={()=>setSlug(v)}>{t(k)}</button>)}{online&&<a href="/" className="btn">{t('home')}</a>}</div>{error&&<p role="alert">{error} <button onClick={refresh}>{t('retry')}</button></p>}{book?<Workspace slug={slug}/>:<p>{t('loading')}</p>}</main></div>;
}
export default function OfflineWorkspace(){const [id,setId]=useState<string|null>(null),t=useTranslations();useEffect(()=>{const active=JSON.parse(localStorage.getItem('tb-active')||'null');setId(active?.expires>Date.now()?active.userId:'');},[]);
 if(!id)return <main className="offline-locked"><Brand/><p>{t(id===null?'loading':'signIn')}</p><a className="btn" href="/login">{t('continue')}</a></main>;
 return <BookProvider userId={id}><OfflineDesk/></BookProvider>;
}