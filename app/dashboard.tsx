'use client';
import {useState} from 'react';
import {Activity, ArrowDownLeft, ArrowUpRight, Calculator, ChevronRight, CircleAlert, CircleDollarSign, ClipboardList, FileBarChart2, HandCoins, Layers3, Mic, Package, ReceiptText, Truck, Wallet} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {deadDays,money} from '@/lib/domain';
import type {Row} from '@/lib/records';
import {num,str,speak} from './forms';
import {titles} from '@/lib/screens';

export function stats(rows:Row[]){
 const invoices=rows.filter(r=>['invoice','pos'].includes(r.kind));
 const purch=rows.filter(r=>r.kind==='purchase');
 const payments=rows.filter(r=>r.kind==='paymentIn');
 const challans=rows.filter(r=>r.kind==='challan');
 const orders=rows.filter(r=>r.kind==='order');
 const sales=invoices.reduce((sum,r)=>sum+num(r.data,'total'),0);
 const received=(invoice:Row)=>num(invoice.data,'received')+payments.filter(p=>p.data.sourceId===invoice.id).reduce((sum,p)=>sum+num(p.data,'amount'),0);
 const balance=(invoice:Row)=>Math.max(0,num(invoice.data,'total')-received(invoice)-rows.filter(p=>p.kind==='credit'&&p.data.sourceId===invoice.id).reduce((sum,p)=>sum+num(p.data,'total'),0));
 const remaining=(order:Row)=>Math.max(0,lineQuantity(order)-challans.filter(r=>r.data.orderId===order.id).reduce((sum,r)=>sum+lineQuantity(r),0));
 const pending=orders.filter(r=>remaining(r)>0);
 const due=invoices.reduce((sum,r)=>sum+balance(r),0);
 const payable=Math.max(0,purch.reduce((s,r)=>s+num(r.data,'cost')*num(r.data,'quantity')+num(r.data,'landed'),0)-rows.filter(r=>r.kind==='paymentOut').reduce((s,r)=>s+num(r.data,'amount'),0));
 const onHand=(id:string)=>rows.filter(r=>r.kind==='movement'&&r.data.lotId===id).reduce((s,r)=>s+num(r.data,'quantity'),0);
 const reserved=(id:string)=>Math.max(0,orders.flatMap(lines).filter(l=>l.lotId===id).reduce((s,l)=>s+l.qty,0)-challans.flatMap(lines).filter(l=>l.lotId===id).reduce((s,l)=>s+l.qty,0));
 const sellable=(id:string)=>Math.max(0,onHand(id)-reserved(id));
 const lastSold=(lot:Row)=>[str(lot.data,'lastSold'),...invoices.filter(i=>lines(i).some(l=>l.lotId===lot.id)).map(i=>str(i.data,'date'))].filter(Boolean).sort().at(-1)??str(lot.data,'date');
 const threshold=num(rows.find(r=>r.kind==='setting')?.data??{},'threshold')||180;
 const dead=rows.filter(r=>r.kind==='lot'&&onHand(r.id)>0&&deadDays(lastSold(r))>=threshold);
 const commission=Math.max(0,rows.reduce((sum,r)=>sum+num(r.data,'accrued')-(r.kind==='commission'?num(r.data,'amount'):0),0));
 return {invoices,sales,balance,received,remaining,due,payable,pending,dead,onHand,reserved,sellable,lastSold,commission};
}
const lines=(r:Row)=>(Array.isArray(r.data.lines)?r.data.lines:[]) as {qty:number;lotId:string}[];
const lineQuantity=(r:Row)=>lines(r).reduce((sum,line)=>sum+line.qty,0);
const simpleTiles=[['New Bill','invoice',ReceiptText,'coral'],['Sqft Calculator','calculator',Calculator,'teal'],['Orders','order',Truck,'gold'],['Stock','lot',Package,''],['Who Owes Me','receivables',Wallet,'green'],['Reports','reports',FileBarChart2,'']] as const;
export function Dashboard({rows,go,create,simple,language,setLanguage,notify,t}:{rows:Row[];go:(page:string)=>void;create:(page:string,note?:string)=>void;simple:boolean;language:string;setLanguage:(language:string)=>void;notify:(text:string)=>void;t:(key:string)=>string}){
 const [period,setPeriod]=useState('This Month');
 const s=stats(rows);
 const newDate=new Date();
 const days=period==='Last 7 days'?7:period==='Last 90 days'?90:31;
 const earliest=new Date(newDate);earliest.setDate(earliest.getDate()-days+1);
 const interval=Array.from({length:days},(_,i)=>{const d=new Date(earliest);d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)});
 const series=interval.map(d=>({date:new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}),sales:s.invoices.filter(r=>r.data.date===d).reduce((total,r)=>total+num(r.data,'total')/100,0)}));
 const breakage=rows.filter(r=>r.kind==='damage'&&String(r.data.date).startsWith(newDate.toISOString().slice(0,10)));
 const alerts=[
  ['Pending deliveries',s.pending.length+' open orders','pending',Truck,''],
  ['Dead stock',s.dead.length+' lots need attention','deadStock',Layers3,'gold'],
  ['Commission payable',money(s.commission),'commissionDue',HandCoins,'green'],
  ['Today’s breakage',breakage.length+' entries','damage',CircleAlert,'coral'],
  ['Advance held',money(s.pending.reduce((sum,r)=>sum+num(r.data,'received'),0)),'advance',Wallet,'teal']
 ] as const;
 return <>
 <div className="heading"><div><h1>{t('Home')}</h1><p>{t('Review your sales, inventory and deliveries.')}</p></div><button className="btn" onClick={()=>go('reports')}><FileBarChart2 size={16}/>{t('Reports')}</button></div>
 {simple&&<div className="card inset stack" style={{marginBottom:16}}><div className="inline" style={{justifyContent:'space-between'}}><h2>{t('Quick actions')}</h2><div className="inline">{[['or','ଓଡ଼ିଆ'],['hi','हिन्दी'],['en','English']].map(([code,label])=><button key={code} className={'btn '+(code===language?'primary':'')} onClick={()=>setLanguage(code)}>{label}</button>)}</div></div><div className="tileGrid">{simpleTiles.map(([label,key,Icon,color])=><button className="card tile" key={key} onClick={()=>key==='invoice'?create(key):go(key)}><span className={'softIcon '+color}><Icon size={19}/></span><b>{t(label)}</b></button>)}</div><div><button className="btn primary" onClick={()=>speak(text=>create('invoice',text),notify)}><Mic size={17}/>{t('Speak a bill')}</button></div></div>}
 <div className="metrics">
 {([
  [simple?'Who Owes Me':'Total Receivable',money(s.due),'Open customer balances','receivables',ArrowDownLeft,'green'],
  [simple?'I Owe':'Total Payable',money(s.payable),s.payable?'Outstanding supplier balances':'No payables at the moment','purchase',ArrowUpRight,'coral'],
  ['Total Sales',money(s.sales),s.invoices.length+' recorded bills','invoice',Activity,''],
  ['Pending Deliveries',String(s.pending.length),s.pending.reduce((sum,r)=>sum+s.remaining(r),0)+' units awaiting dispatch','order',Truck,'gold']
 ] as const).map(([label,value,desc,key,Icon,color])=><button className="metric" key={label} onClick={()=>go(key)}><span className="metricTop"><span className={'softIcon '+color}><Icon size={17}/></span>{t(label)}</span><strong className={color==='green'?'positive':color==='coral'?'negative':''}>{value}</strong><small>{desc}</small></button>)}
 </div>
 <div className="gridMain"><section className="card"><div className="cardHead"><div><h2>{t('Sales overview')}</h2><p className="subtle">Invoice totals by day</p></div><select aria-label="Chart period" value={period} onChange={e=>setPeriod(e.target.value)}>{['This Month','Last 7 days','Last 90 days'].map(x=><option key={x}>{x}</option>)}</select></div><div className="chart"><div className="chartArea"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{left:4,right:10,top:12,bottom:0}}><defs><linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0fa3a3" stopOpacity={.27}/><stop offset="100%" stopColor="#0fa3a3" stopOpacity={.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e6eaf2" strokeDasharray="4 4"/><XAxis dataKey="date" tick={{fontSize:11,fill:'#64708a'}} tickLine={false} axisLine={false} minTickGap={25}/><YAxis width={48} tickFormatter={(value:number)=>value>=1000?'₹'+Math.round(value/1000)+'k':'₹'+value} tick={{fontSize:11,fill:'#64708a'}} tickLine={false} axisLine={false}/><Tooltip formatter={(value)=>money(Number(value)*100)}/><Area type="monotone" dataKey="sales" stroke="#0b8588" strokeWidth={2.5} fill="url(#tealFill)" name="Sales"/></AreaChart></ResponsiveContainer></div></div></section>
 <section className="card"><div className="cardHead"><h2>{t('Business alerts')}</h2></div>{alerts.map(([label,value,key,Icon,color])=><button className="alert" key={key} onClick={()=>go(key)}><span className={'softIcon '+color}><Icon size={16}/></span><span className="label"><b>{t(label)}</b><small>{value}</small></span><ChevronRight size={15}/></button>)}</section></div>
 <section className="card"><div className="cardHead"><h2>{t('Most used reports')}</h2></div><div className="inset inline">{[['receivables','Who Owes Me',CircleDollarSign],['lot','Lot-wise Stock',Package],['order','Pending Deliveries',ClipboardList],['gst','GSTR-1 / HSN',FileBarChart2]].map(([key,label,Icon])=>{const Glyph=Icon as typeof Package;return <button key={String(key)} className="btn" onClick={()=>go(String(key))}><Glyph size={16}/>{t(String(label))}</button>})}</div></section>
 <section className="card" style={{marginTop:16}}><div className="cardHead"><h2>{t('Recent invoices')}</h2><button className="btn" onClick={()=>go('invoice')}>All invoices</button></div>{s.invoices.slice(0,4).map(r=><button className="alert" key={r.id} onClick={()=>go('invoice')}><ReceiptText size={18}/><span className="label"><b>{str(r.data,'reference')}</b><small>{str(r.data,'partyName')}</small></span><b>{money(num(r.data,'total'))}</b></button>)}{!s.invoices.length&&<p className="inset subtle">Saved invoices will appear here.</p>}</section>
 </>;
}
export const reportPages=['gst','profit','deadStock','pending','advance','breakage','returns','commissionDue'];
Object.assign(titles,{gst:'GSTR-1 / HSN',profit:'Trading Summary',deadStock:'Dead Stock by Lot',pending:'Pending Deliveries',advance:'Advance Held',breakage:'Breakage Loss',returns:'Returns by Lot',commissionDue:'Commission Payable'});