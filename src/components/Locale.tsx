'use client';
import {NextIntlClientProvider} from 'next-intl';
import {useState,useEffect,createContext,useContext} from 'react';
import en from '@/messages/en.json';import hi from '@/messages/hi.json';import or from '@/messages/or.json';
const locales={en,hi,or};export type Lang=keyof typeof locales;
const Change=createContext<(l:Lang)=>void>(()=>{});
export const useChangeLocale=()=>useContext(Change);
export function Locale({children}:{children:React.ReactNode}){
 const [lang,set]=useState<Lang>('en');
 const change=(l:Lang)=>{set(l);document.documentElement.lang=l;localStorage.setItem('tb-lang',l);};
 useEffect(()=>{const l=localStorage.getItem('tb-lang');if(l==='hi'||l==='or')change(l);
 if('serviceWorker' in navigator && process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
 return <Change.Provider value={change}><NextIntlClientProvider locale={lang} messages={locales[lang]} timeZone="Asia/Kolkata">{children}</NextIntlClientProvider></Change.Provider>;
}