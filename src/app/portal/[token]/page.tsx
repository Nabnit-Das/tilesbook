"use client";
import {use,useEffect,useState} from "react";
import en from "@/features/messages/en.json";
import hi from "@/features/messages/hi.json";
import or from "@/features/messages/or.json";
import {asDate,money} from "@/features/model";
import "@/features/workspace.css";
interface Data {business:{name:string;address:string;phone:string};party:{name:string};documents:{id:string;number:string;kind:string;date:string;status:string;total:number;balance:number}[];balance:number}
export default function Portal({params}:{params:Promise<{token:string}>}){const {token}=use(params);const [data,setData]=useState<Data|null>(null),[error,setError]=useState(false),[lang,setLang]=useState<"en"|"hi"|"or">("en");const t=(key:string)=>((lang==="hi"?hi:lang==="or"?or:en) as Record<string,string>)[key]||key;
 useEffect(()=>{const controller=new AbortController();fetch("/api/portal/"+encodeURIComponent(token),{signal:controller.signal,cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();setData(await r.json() as Data)}).catch(()=>{if(!controller.signal.aborted)setError(true)});return()=>controller.abort()},[token]);
 return <main className="tb-workspace tb-portal"><div className="tb-pagehead"><strong>TileBook</strong><label>{t("language")} <select value={lang} onChange={e=>setLang(e.target.value as typeof lang)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="or">ଓଡ଼ିଆ</option></select></label></div>{error?<h1>{t("invalidPortal")}</h1>:!data?<p>{t("loading")}</p>:<><span className="tb-breadcrumb">{t("customerPortal")}</span><h1>{data.business.name}</h1><p>{data.business.address} · {data.business.phone}</p><section className="tb-panel tb-toolbody"><span>{data.party.name}</span><h2>{t("balance")} · {money(data.balance,lang)}</h2></section><section className="tb-panel tb-toolbody"><h2>{t("documents")}</h2>{data.documents.map(d=><article key={d.id} className="tb-backuprow"><div><strong>{d.number}</strong><div>{t(d.kind)} · {asDate(d.date)}</div></div><span>{t(d.status)} · {money(d.total,lang)}</span></article>)}</section></>}</main>
}

