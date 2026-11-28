"use client";
import {useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import Brand from "./Brand";
import {useChangeLocale,type Lang} from "./Locale";
import CustomerForm,{type Step} from "./CustomerForm";
import {clearLocalBooks} from "@/lib/offline";
export default function Login({demo=false,customerStep="login"}:{demo?:boolean;customerStep?:Step}){
 const t=useTranslations(),locale=useLocale(),lang=useChangeLocale(),[error,setError]=useState(false),[busy,setBusy]=useState(false);
 async function enter(role:string){setBusy(true);try{const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"demo",role})});if(!r.ok)throw Error();await clearLocalBooks();location.replace("/access");}catch{setError(true);}finally{setBusy(false);}}
 return <main className="login customer-login"><section className="login-brand"><Brand/><div><p>{t("loginCopy")}</p></div></section><section className="login-panel"><div className="langchips">{(["or","hi","en"] as Lang[]).map((l,i)=><button key={l} aria-pressed={l===locale} className={l===locale?"selected":""} onClick={()=>lang(l)}>{["ଓଡ଼ିଆ","हिन्दी","English"][i]}</button>)}</div>{demo?<div className="demo-options"><h2>{t("demo")}</h2>{["owner","counter"].map(role=><button className="btn" key={role} disabled={busy} onClick={()=>enter(role)}>{t(role==="owner"?"ownerDemo":"counterDemo")}</button>)}{error&&<p role="alert">{t("authFailed")}</p>}</div>:<CustomerForm initial={customerStep}/>}</section></main>;
}
