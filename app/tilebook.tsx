'use client';
import Image from 'next/image';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowDownToLine,Bell,BookOpen,Building2,Calculator,ChevronDown,ClipboardList,FileBarChart2,HelpCircle,House,Layers3,Menu,MoreHorizontal,Package,Plus,Printer,ReceiptText,RefreshCw,Search,Settings,ShieldCheck,SlidersHorizontal,Users,Wallet,Wrench} from 'lucide-react';
import {add,descriptions,groups,titles} from '@/lib/screens';
import {deadDays,invoiceTotals,money,type Line} from '@/lib/domain';
import type {Data,Row} from '@/lib/records';
import {offline,syncQueue,type Viewer} from '@/lib/offline';
import {AreaCalculator,day,Editor,Modal,num,str,today,type OpenForm} from './forms';
import {Dashboard,reportPages,stats} from './dashboard';
import hi from '@/messages/hi.json';
import or from '@/messages/or.json';
import en from '@/messages/en.json';

const icons=[House,Users,Package,ReceiptText,ClipboardList,Layers3,Wallet,FileBarChart2,ShieldCheck,Wrench,Settings,BookOpen];
const restricted=new Set(['purchase','po','debit','expense','paymentOut','bank','cash','cheque','loan','partner','commission','profit','commissionDue','audit','breakage']);
const printKinds=new Set(['invoice','pos','estimate','proforma','order','challan','credit','purchase','po','debit','paymentIn','paymentOut']);
const moneyKeys=new Set(['price','cost','landed','amount','total','received','loss','balance','payable','taxable','cgst','sgst','igst','net','emi']);
const columns:Record<string,string[]>={invoice:['date','reference','partyName','total','received','balance','status'],pos:['date','reference','partyName','total'],estimate:['date','reference','partyName','rooms','total'],proforma:['date','reference','partyName','total'],order:['date','reference','partyName','quantity','balanceUnits','received','status'],challan:['date','reference','partyName','quantity','total'],credit:['date','reference','partyName','lot','shade','quantity','total'],party:['name','type','phone','gstin','address'],product:['name','size','finish','hsn','gst','price','cost','quantity'],lot:['lot','shade','product','quantity','reserved','available','date','lastSold'],damage:['date','lot','shade','quantity','reason','name','loss'],display:['date','lot','shade','quantity','name'],slab:['name','length','width','area','status','partyName'],transfer:['date','lot','shade','from','to','quantity'],count:['date','lot','shade','location','system','counted','difference'],purchase:['date','reference','partyName','lot','shade','quantity','total'],po:['date','reference','partyName','lot','quantity','total'],debit:['date','reference','partyName','lot','quantity','total'],paymentIn:['date','reference','partyName','mode','amount'],paymentOut:['date','reference','partyName','mode','amount'],expense:['date','name','category','amount'],bank:['name','account','ifsc','upi','amount'],cash:['date','name','direction','amount'],cheque:['date','name','reference','amount','status'],loan:['name','amount','rate','months','emi','date'],service:['name','hsn','price','gst'],category:['name','note'],partner:['partyName','rate','perBox','payable'],commission:['date','partyName','reference','amount'],followup:['date','partyName','name','note'],offer:['date','lot','name','rate','note'],campaign:['date','name','note'],audit:['date','target','action','actor'],receivables:['date','reference','partyName','total','balance'],gst:['hsn','taxable','cgst','sgst','igst'],profit:['name','net'],breakage:['date','lot','quantity','reason','loss'],pending:['date','reference','partyName','quantity','balanceUnits','status'],advance:['date','reference','partyName','received','balanceUnits'],deadStock:['lot','shade','product','quantity','lastSold','days'],returns:['date','reference','partyName','lot','shade','quantity','total'],commissionDue:['partyName','payable']};
const labels:Record<string,string>={partyName:'Party',hsn:'HSN / SAC',gst:'GST %',rate:'Rate %',balanceUnits:'Remaining',lastSold:'Last sold',perBox:'Fixed per box',cgst:'CGST',sgst:'SGST',igst:'IGST',upi:'UPI',ifsc:'IFSC',gstin:'GSTIN',emi:'Monthly EMI',lot:'Lot no.',date:'Date',cost:'Purchase price',price:'Sale price',available:'Sellable',reserved:'Reserved'};
const label=(key:string)=>labels[key]??key.charAt(0).toUpperCase()+key.slice(1);
const display=(key:string,value:unknown)=>value===undefined||value===null||value===''?'—':moneyKeys.has(key)||key==='perBox'?money(Number(value)):['date','lastSold'].includes(key)?day(String(value)):String(value);
const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);};
function Brand(){return <div className="brand"><Image unoptimized src="/tile.svg" alt="" width={33} height={33}/><span>Tile<b>Book</b></span></div>}
export default function TileBook(){
 const [viewer,setViewer]=useState<Viewer|null>(null),[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true);
 const [page,setPage]=useState('home'),[expanded,setExpanded]=useState(''),[drawer,setDrawer]=useState(false),[quick,setQuick]=useState(''),[form,setForm]=useState<OpenForm|null>(null),[detail,setDetail]=useState<Row|null>(null);
 const [language,setLanguage]=useState('en'),[mode,setMode]=useState('Simple'),[query,setQuery]=useState(''),[globalSearch,setGlobalSearch]=useState(''),[period,setPeriod]=useState('All dates'),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [phone,setPhone]=useState(''),[otp,setOtp]=useState(''),[toast,setToast]=useState(''),[authError,setAuthError]=useState(''),[signing,setSigning]=useState(false);
 const [settings,setSettings]=useState<Data>({accent:'#0fa3a3',terms:'Shade can differ between lots. Report breakage at delivery. Returns must be unopened and from the same lot.',threshold:180,upi:'',audit:true,phone:''});
 const t=(key:string)=>((language==='or'?or:language==='hi'?hi:en) as Record<string,string>)[key]??key;
 const notify=useCallback((message:string)=>{setToast(message);window.setTimeout(()=>setToast(current=>current===message?'':current),4200)},[]);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch('/api/session');
   if(response.status===401){setViewer(null);setRows([]);localStorage.removeItem('tilebook-viewer');return;}
   if(!response.ok)throw new Error('Could not connect to TileBook. Check the database setup.');
   const current:Viewer=await response.json();
   await syncQueue(current).catch(e=>notify(e instanceof Error?e.message:'Could not sync pending entries.'));
   const data=await fetch('/api/records');
   if(!data.ok)throw new Error('Could not load business records.');
   const records:Row[]=await data.json();
   setViewer(current);setRows(records);
   const snapshot=current.business.id+':'+current.userId;
   localStorage.setItem('tilebook-viewer',snapshot);
   await offline.snapshots.put({id:snapshot,viewer:current,rows:records}).catch(()=>{});
   const stored=records.find(r=>r.kind==='setting')?.data;
   if(stored){setSettings(stored);setLanguage(str(stored,'language')||'en');setMode(str(stored,'mode')||'Simple');}
  }catch(error){
   if(!navigator.onLine){
    const snapshot=await offline.snapshots.get(localStorage.getItem('tilebook-viewer')??'').catch(()=>undefined);
    if(snapshot){setViewer(snapshot.viewer);setRows(snapshot.rows);notify('Offline mode');return;}
   }
   setAuthError(error instanceof Error?error.message:'Could not connect to TileBook.');
  }finally{setLoading(false);}
 },[notify]);
 useEffect(()=>{const initialize=()=>void refresh();void Promise.resolve().then(initialize);window.addEventListener('online',initialize);if('serviceWorker' in navigator&&process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/sw.js').catch(()=>{});return()=>window.removeEventListener('online',initialize)},[refresh]);
 useEffect(()=>{const keys=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();document.getElementById('global-search')?.focus()}if(e.key==='Escape'){setQuick('');setGlobalSearch('')}};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys)},[]);
 const role=viewer?.role??'';
 const canAccess=(key:string)=>!(['COUNTER','GODOWN'].includes(role)&&restricted.has(key));
 const canEdit=(key:string)=>role==='OWNER'||(role==='MANAGER'&&key!=='setting')||(role==='COUNTER'&&['party','invoice','estimate','proforma','order','pos','paymentIn'].includes(key))||(role==='GODOWN'&&['challan','damage','display','transfer','count'].includes(key));
 const go=(key:string)=>{if(!canAccess(key))return;setPage(key);setQuery('');setGlobalSearch('');setPeriod('All dates');setDrawer(false);setQuick('');setExpanded(groups.find(group=>(group as readonly string[]).includes(key))?.[0]??'');window.scrollTo(0,0);};
 const create=(kind:string,note?:string)=>{if(!canEdit(kind)){notify('Your role cannot create this record.');return;}setQuick('');setForm({kind,initial:note?{note}:undefined});};
 const save=async(kind:string,data:Data,print:boolean)=>{
  if(!viewer)throw new Error('Sign in first.');
  const key=crypto.randomUUID();
  if(!navigator.onLine){
   if(!['invoice','pos','paymentIn','paymentOut','damage','display','purchase'].includes(kind))throw new Error('This entry requires a connection.');
   await offline.queue.add({key,kind,data,businessId:viewer.business.id,userId:viewer.userId});setForm(null);notify('Saved on this device. It will sync when you reconnect.');return;
  }
  const response=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,kind,data})});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(result?.error??'Could not save. Try again.');
  setForm(null);if(kind!=='setting')go(kind);notify('Saved successfully.');
  if(print){
   const document=await fetch('/api/print/'+result.id);
   if(document.ok)download(await document.blob(),(str(data,'reference')||kind)+'.pdf');
   else notify('The record was saved, but the PDF could not be downloaded.');
  }
  await refresh();
 };
 const analysis=useMemo(()=>stats(rows),[rows]);
 const record=(id:unknown)=>rows.find(r=>r.id===id)?.data??{};
 const withinPeriod=(value:string)=>{
  const date=value.slice(0,10);
  return !date||period==='All dates'||(period==='This Month'?date.startsWith(today().slice(0,7)):(!start||date>=start)&&(!end||date<=end));
 };
 const sourceRows:Row[]=(()=>{
  if(page==='receivables')return analysis.invoices.filter(r=>analysis.balance(r)>0);
  if(page==='deadStock')return analysis.dead;
  if(page==='pending'||page==='advance')return analysis.pending.filter(r=>page==='pending'||num(r.data,'received')>0);
  if(page==='breakage')return rows.filter(r=>r.kind==='damage');
  if(page==='returns')return rows.filter(r=>r.kind==='credit');
  if(page==='commissionDue')return rows.filter(r=>r.kind==='partner');
  if(page==='gst'){
   const byHsn=new Map<string,Data>();
   for(const invoice of analysis.invoices.filter(r=>withinPeriod(str(r.data,'date'))))for(const line of invoiceTotals(invoice.data.lines as Line[],Boolean(invoice.data.interstate)).hsn){
    const item=byHsn.get(line.hsn)??{hsn:line.hsn};for(const key of ['taxable','cgst','sgst','igst'] as const)item[key]=num(item,key)+line[key];byHsn.set(line.hsn,item);
   }
   return [...byHsn.entries()].map(([id,data])=>({id,kind:'gst',data,createdAt:''}));
  }
  if(page==='profit'){
   const expense=rows.filter(r=>r.kind==='expense').reduce((s,r)=>s+num(r.data,'amount'),0);
   const inventory=rows.filter(r=>r.kind==='purchase').reduce((s,r)=>s+num(r.data,'cost')*num(r.data,'quantity')+num(r.data,'landed'),0);
   return [['Gross sales',analysis.sales],['Purchases and landed cost',inventory],['Recorded expenses',expense],['Sales less purchases and expenses',analysis.sales-inventory-expense]].map(([name,net])=>({id:String(name),kind:'profit',data:{name,net},createdAt:''}));
  }
  return rows.filter(r=>r.kind===page);
 })();
 const table=sourceRows.map(row=>{
  const d={...row.data};const value=(k:string)=>num(d,k);
  if(['invoice','pos'].includes(row.kind)){
   d.received=analysis.received(row);d.balance=analysis.balance(row);
   d.status=d.balance===0?'Paid':Number(d.received)>0?'Part paid':'Unpaid';
  }
  if(['challan','order'].includes(row.kind))d.quantity=(d.lines as Line[]).reduce((sum,l)=>sum+l.qty,0);
  if(row.kind==='order'){const remaining=analysis.remaining(row);d.balanceUnits=remaining;d.status=remaining===0?'Closed':str(d,'dueDate')&&str(d,'dueDate')<today()?'Overdue':'Open';}
  if(row.kind==='estimate')d.rooms=new Set((d.lines as Line[]).map(l=>l.room).filter(Boolean)).size;
  if(row.kind==='lot'){d.product=record(d.productId).name;d.quantity=analysis.onHand(row.id);d.reserved=analysis.reserved(row.id);d.available=analysis.sellable(row.id);d.lastSold=analysis.lastSold(row);d.days=deadDays(String(d.lastSold));}
  if(row.kind==='product')d.quantity=rows.filter(r=>r.kind==='lot'&&r.data.productId===row.id).reduce((sum,r)=>sum+analysis.sellable(r.id),0);
  if(['purchase','po','debit'].includes(row.kind))d.total=value('cost')*value('quantity')+value('landed');
  if(row.kind==='slab')d.area=value('length')*value('width');
  if(row.kind==='loan'){const rate=value('rate')/1200;const periods=value('months');d.emi=Math.round(rate?value('amount')*rate/(1-(1+rate)**-periods):value('amount')/periods);}
  if(row.kind==='partner')d.payable=Math.max(0,rows.reduce((sum,r)=>sum+(r.data.partnerId===d.partyId?num(r.data,'accrued'):r.kind==='commission'&&r.data.partyId===d.partyId?-num(r.data,'amount'):0),0));
  if(row.kind==='audit')d.date=row.createdAt;
  return {...row,data:d};
 }).filter(row=>{
  return (!query||Object.values(row.data).some(v=>String(v).toLowerCase().includes(query.toLowerCase())))&&withinPeriod(str(row.data,'date'));
 }).sort((a,b)=>str(b.data,'date').localeCompare(str(a.data,'date')));
 const shown=(columns[page]??['name','date']).filter(k=>k!=='cost'||canAccess('purchase'));
 const headline=page==='product'?'Items':page==='paymentIn'&&mode==='Simple'?'Money received':page==='paymentOut'&&mode==='Simple'?'Money paid':titles[page]??page;
 const exportData=async()=>{
  try{const {Workbook}=await import('exceljs');const book=new Workbook();const sheet=book.addWorksheet('TileBook');sheet.addRow(shown.map(label));table.forEach(r=>sheet.addRow(shown.map(k=>display(k,r.data[k]))));const bytes=await book.xlsx.writeBuffer();download(new Blob([new Uint8Array(bytes as ArrayBuffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'tilebook-'+page+'.xlsx');}catch{notify('Excel export failed.');}
 };
 const login=async(e:React.FormEvent)=>{
  e.preventDefault();setSigning(true);setAuthError('');
  try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,otp})});if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error??'Sign-in failed. Check your setup.');await refresh();}catch(e){setAuthError(e instanceof Error?e.message:'Could not sign in.');}finally{setSigning(false);}
 };
 const switchFirm=async(businessId:string)=>{
  const result=await fetch('/api/session',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessId})});
  if(result.ok){go('home');await refresh();}else notify('Could not switch firms.');
 };
 const logout=async()=>{
  try{await fetch('/api/session',{method:'DELETE'});}finally{const key=localStorage.getItem('tilebook-viewer');if(key)await offline.snapshots.delete(key).catch(()=>{});localStorage.removeItem('tilebook-viewer');setViewer(null);setRows([]);setPage('home');setQuick('');setDetail(null);}
 };
 if(!viewer)return <main className="login"><form className="card loginCard" onSubmit={login}><Brand/><h1>Sign in</h1><p className="subtle">Access billing and inventory for your business.</p><label className="field">Phone number<input type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={10} required pattern="[0-9]{10}" onChange={e=>setPhone(e.target.value)}/></label><label className="field">One-time password<input type="password" inputMode="numeric" autoComplete="one-time-code" value={otp} required onChange={e=>setOtp(e.target.value)}/></label>{authError&&<div className="warning" role="alert">{authError}</div>}<button className="btn primary" disabled={signing||loading}>{signing||loading?'Connecting…':'Sign in'}</button>{process.env.NODE_ENV!=='production'&&<button type="button" className="btn" onClick={()=>{setPhone('9999999999');setOtp('123456')}}>Fill demo credentials</button>}</form></main>;
 const sum=(key:string)=>table.reduce((total,row)=>total+num(row.data,key),0);
 const primaryMetric=page==='receivables'?['Outstanding',sum('balance')]:shown.includes('total')?['Total value',sum('total')]:shown.includes('amount')?['Total amount',sum('amount')]:shown.includes('payable')?['Commission payable',sum('payable')]:shown.includes('loss')?['Recorded loss',sum('loss')]:null;
 const globalMatches=globalSearch?rows.filter(r=>titles[r.kind]&&canAccess(r.kind)&&[r.data.reference,r.data.partyName,r.data.name,r.data.lot].some(v=>String(v??'').toLowerCase().includes(globalSearch.toLowerCase()))).slice(0,7):[];
 const convert=(r:Row,kind:string)=>{
  let lines=(r.data.lines as Line[]).map(line=>({...line}));
  if(kind==='challan'){
   const delivered=new Map<string,number>();
   rows.filter(a=>a.kind==='challan'&&a.data.orderId===r.id).flatMap(a=>a.data.lines as Line[]).forEach(l=>delivered.set(l.lotId,(delivered.get(l.lotId)??0)+l.qty));
   lines=lines.map(l=>{const used=Math.min(l.qty,delivered.get(l.lotId)??0);delivered.set(l.lotId,(delivered.get(l.lotId)??0)-used);return {...l,qty:l.qty-used}}).filter(l=>l.qty>0);
  }
  setDetail(null);setForm({kind,initial:{partyId:r.data.partyId,partnerId:r.data.partnerId??'',lines,orderId:kind==='challan'?r.id:'',sourceChallanId:r.kind==='challan'?r.id:'',received:0}});
 };
 return <div className="app">
 {drawer&&<button className="sidenavOverlay" onClick={()=>setDrawer(false)} aria-label="Close navigation"/>}
 <aside className={'sidebar '+(drawer?'open':'')}><Brand/><button className="btn command" onClick={()=>{setDrawer(false);document.getElementById('global-search')?.focus()}}><Search size={14}/>Open Anything <kbd>Ctrl+F</kbd></button><nav className="nav" aria-label="Main navigation">{groups.map(([group,...keys],index)=>{const Icon=icons[index];const visible=keys.filter(canAccess);if(!visible.length)return null;const open=expanded===group;return <div key={group}><button className={'nav-button '+((visible as readonly string[]).includes(page)?'active':'')} onClick={()=>visible.length===1?go(visible[0]):setExpanded(open?'':group)} aria-expanded={visible.length>1?open:undefined}><Icon size={17}/>{t(group)}{visible.length>1&&<ChevronDown size={14}/>}</button>{open&&visible.length>1&&visible.map(key=><button key={key} className={'child-button '+(page===key?'active':'')} onClick={()=>go(key)}>{t(titles[key])}</button>)}</div>})}</nav><div className="firm"><div className="inline"><Building2 size={15}/><label htmlFor="firm-select">Current firm</label></div><select id="firm-select" value={viewer.business.id} onChange={e=>void switchFirm(e.target.value)}>{viewer.firms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><small>{viewer.role.toLowerCase()}</small></div></aside>
 <main className="workspace"><div className="topstrip"><div className="inline"><span>{viewer.business.name}</span><button onClick={()=>setQuick('help')}>Help</button><button onClick={()=>notify('Ctrl+F opens transaction search.')}>Shortcuts</button><button aria-label="Refresh data" onClick={()=>void refresh()}><RefreshCw size={13}/></button></div><span>{str(settings,'phone')||'Bhubaneswar · India'}</span></div>
 <header className="toolbar"><button className="icon-btn mobileOnly" aria-label="Open navigation" onClick={()=>setDrawer(true)}><Menu size={19}/></button><label className="search"><Search size={17}/><input id="global-search" aria-label="Search transactions" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder={t('Search Transactions')}/>{globalSearch&&<div className="quick" style={{left:0,right:'auto',width:'100%'}}>{globalMatches.length?globalMatches.map(r=><button key={r.id} onClick={()=>{go(r.kind);setDetail(r)}}>{str(r.data,'reference')||str(r.data,'name')||str(r.data,'lot')} · {titles[r.kind]}</button>):<p className="inset">No matching records</p>}</div>}</label>
 {canEdit('invoice')&&<button className="btn coral" onClick={()=>create('invoice')}><Plus size={16}/>{t('Add Sale')}</button>}{canEdit('purchase')&&<button className="btn blue desktopOnly" onClick={()=>create('purchase')}><Plus size={16}/>{t('Add Purchase')}</button>}
 <button className="icon-btn desktopOnly" aria-label="Quick add" onClick={()=>setQuick(quick==='add'?'':'add')}><Plus size={18}/></button><button className="icon-btn desktopOnly" aria-label="Notifications" onClick={()=>setQuick(quick==='alerts'?'':'alerts')}><Bell size={17}/></button><button className="icon-btn desktopOnly" aria-label="Print current page" onClick={()=>window.print()}><Printer size={17}/></button><button className="icon-btn avatar" aria-label="Account menu" onClick={()=>setQuick(quick==='account'?'':'account')}><MoreHorizontal size={17}/></button>
 {quick&&<div className="quick">{quick==='add'&&Object.keys(add).filter(canEdit).slice(0,12).map(key=><button key={key} onClick={()=>create(key)}>Add {add[key]}</button>)}{quick==='alerts'&&<><button onClick={()=>go('pending')}>{analysis.pending.length} pending orders</button><button onClick={()=>go('deadStock')}>{analysis.dead.length} aging lots</button></>}{quick==='help'&&<p className="inset">Use search or open a workspace from the sidebar.</p>}{quick==='account'&&<><p className="inset"><b>{viewer.name}</b></p><button onClick={()=>go('setting')}>Settings</button><button onClick={()=>void logout()}>Sign out</button></>}</div>}</header>
 <section className="content">
 {page==='home'?<Dashboard rows={rows} go={go} create={create} simple={mode==='Simple'} language={language} setLanguage={setLanguage} notify={notify} t={t}/>:<>
 <div className="heading"><div><h1>{t(headline)} {page==='slab'&&<span className="tag info">Beta</span>}</h1>{descriptions[page]&&<p>{t(descriptions[page])}</p>}</div>{add[page]&&canEdit(page)&&<button className={'btn '+(page==='invoice'?'coral':'primary')} onClick={()=>create(page)}><Plus size={16}/>Add {add[page]}</button>}</div>
 {page==='calculator'&&<section className="card"><AreaCalculator/></section>}
 {page==='reports'&&<div className="tileGrid">{['receivables','lot',...reportPages].filter(canAccess).map(key=><button className="card tile" key={key} onClick={()=>go(key)}><span className="softIcon teal"><FileBarChart2 size={19}/></span><b>{titles[key]}</b></button>)}</div>}
 {page==='setting'&&<form className="card formBody" onSubmit={e=>{e.preventDefault();void save('setting',{...settings,mode,language},false).catch(error=>notify(error.message));}}><div className="fieldGrid"><label className="field">Workspace mode<select value={mode} onChange={e=>setMode(e.target.value)}><option>Simple</option><option>Pro</option></select></label><label className="field">Language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="hi">Hindi</option><option value="or">Odia</option></select></label><label className="field">Dead-stock threshold (days)<input type="number" min={1} value={num(settings,'threshold')} onChange={e=>setSettings({...settings,threshold:Number(e.target.value)})}/></label><label className="field">Invoice accent<input type="color" value={str(settings,'accent')} onChange={e=>setSettings({...settings,accent:e.target.value})}/></label><label className="field">UPI address<input value={str(settings,'upi')} onChange={e=>setSettings({...settings,upi:e.target.value})}/></label><label className="field">Support phone<input value={str(settings,'phone')} onChange={e=>setSettings({...settings,phone:e.target.value})}/></label></div><label className="field">Invoice terms<textarea maxLength={240} value={str(settings,'terms')} onChange={e=>setSettings({...settings,terms:e.target.value})}/></label><label className="inline"><input type="checkbox" checked={settings.audit!==false} onChange={e=>setSettings({...settings,audit:e.target.checked})}/>Audit trail</label>{canEdit('setting')&&<div><button className="btn primary">Save settings</button></div>}</form>}
 {page==='plans'&&<div className="tileGrid">{[['Free trial','14 days to explore the workspace'],['Basic','Billing, stock and GST'],['Pro','Lots, deliveries and commissions']].map(([name,desc])=><section key={name} className="card inset stack"><h2>{name}</h2><p className="subtle">{desc}</p><button className="btn" onClick={()=>notify('Checkout is an integration stub.')}>View plan</button></section>)}</div>}
 {page==='backup'&&<section className="card inset stack"><p className="subtle">Download the records available to your role as a JSON file.</p><div><button className="btn primary" onClick={()=>download(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}),'tilebook-backup.json')}><ArrowDownToLine size={16}/>Download records</button></div></section>}
 {page==='utilities'&&<div className="tileGrid">{[['Export Items','product'],['Export Parties','party'],['Download Records','backup'],['Lot-by-Lot Stock','lot']].map(([name,key])=><button key={key} className="card tile" onClick={()=>go(key)}><Wrench size={18}/>{name}</button>)}</div>}
 {page==='whatsapp'&&<section className="card inset stack"><h2>Share a document</h2><p className="subtle">Open an invoice, download its PDF and attach it to your WhatsApp message. Automatic delivery requires a WhatsApp Business integration.</p><div><button className="btn primary" onClick={()=>go('invoice')}>Open invoices</button></div></section>}
 {['portal','users'].includes(page)&&<section className="card empty"><span className="softIcon"><HelpCircle size={25}/></span><h2>{headline}</h2><p className="subtle">This workflow is pending implementation.</p><button className="btn" onClick={()=>go('home')}>Back to Home</button></section>}
 {columns[page]&&<>
 {page==='product'&&<div className="filters">{[['Products','product'],['Services','service'],['Categories','category'],['Lots','lot']].map(([name,key])=><button className={'btn '+(page===key?'primary':'')} key={key} onClick={()=>go(key)}>{name}</button>)}</div>}
 <div className="filters"><SlidersHorizontal size={17}/><select aria-label="Date filter" value={period} onChange={e=>setPeriod(e.target.value)}><option>All dates</option><option>This Month</option><option>Custom range</option></select>{period==='Custom range'&&<><input type="date" aria-label="From" value={start} onChange={e=>setStart(e.target.value)}/><input type="date" aria-label="To" value={end} onChange={e=>setEnd(e.target.value)}/></>}<label className="search"><Search size={16}/><input aria-label="Search records" placeholder="Search records" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="btn" onClick={()=>void exportData()}><ArrowDownToLine size={15}/>Excel</button><button className="icon-btn" aria-label="Print report" onClick={()=>window.print()}><Printer size={16}/></button></div>
 <div className="metrics"><div className="metric"><span className="metricTop">Records</span><strong>{table.length}</strong></div>{primaryMetric&&<div className="metric"><span className="metricTop">{primaryMetric[0]}</span><strong>{money(Number(primaryMetric[1]))}</strong></div>}{page==='invoice'&&<><div className="metric"><span className="metricTop">Received</span><strong className="positive">{money(sum('received'))}</strong></div><div className="metric"><span className="metricTop">Outstanding</span><strong className="negative">{money(sum('balance'))}</strong></div></>}</div>
 <section className="card tableWrap">{table.length?<table className="dataTable"><thead><tr>{shown.map(k=><th key={k}>{label(k)}</th>)}<th>Actions</th></tr></thead><tbody>{table.map(r=><tr key={r.id}>{shown.map(k=><td key={k} data-label={label(k)}>{k==='status'?<span className={'tag '+(['Overdue','Part paid','Unpaid'].includes(String(r.data[k]))?'warn':r.data[k]==='Paid'?'':'info')}>{display(k,r.data[k])}</span>:display(k,r.data[k])}</td>)}<td data-label="Actions"><button className="icon-btn" aria-label={'View '+(r.data.reference??r.data.name??'record')} onClick={()=>setDetail(r)}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>:<div className="empty"><span className="softIcon teal"><ClipboardList size={25}/></span><h2>No matching records</h2><p className="subtle">{query?'Try a different search.':'New entries will appear here.'}</p>{add[page]&&canEdit(page)&&<button className="btn primary" onClick={()=>create(page)}>Add {add[page]}</button>}</div>}</section>
 </>}
 </>}
 </section></main>
 <nav className="mobileBar" aria-label="Quick navigation">{[['Home','home',House],['New Bill','invoice',ReceiptText],['Sqft Calculator','calculator',Calculator],['Who Owes Me','receivables',Wallet],['Reports','reports',FileBarChart2]].map(([name,key,Glyph])=>{const Icon=Glyph as typeof House;return <button key={String(key)} className={page===key?'active':''} onClick={()=>key==='invoice'?create('invoice'):go(String(key))}><Icon size={18}/>{t(String(name))}</button>})}</nav>
 {form&&<Editor key={form.kind} form={form} rows={rows} role={role} close={()=>setForm(null)} save={save}/>}
 {detail&&<Modal title={str(detail.data,'reference')||str(detail.data,'name')||titles[detail.kind]||'Record details'} close={()=>setDetail(null)}><div className="formBody"><div className="detail">{(columns[page]??Object.keys(detail.data).filter(key=>typeof detail.data[key]!=='object')).map(k=><div key={k}><p className="subtle">{label(k)}</p><b>{display(k,detail.data[k])}</b></div>)}</div>{Array.isArray(detail.data.lines)&&<div className="stack">{(detail.data.lines as Line[]).map((l,i)=><p key={i}>{l.description} · {l.lot} / {l.shade} · {l.qty} {l.unit}</p>)}</div>}<div className="formActions">{printKinds.has(detail.kind)&&<><a className="btn primary" href={'/api/print/'+detail.id}>Download PDF</a><a className="btn" target="_blank" rel="noreferrer" href={'/api/print/'+detail.id+'?inline=1'}>Print preview</a><a className="btn" target="_blank" rel="noreferrer" href={'https://wa.me/?text='+encodeURIComponent(viewer.business.name+' · '+str(detail.data,'reference')+' · '+money(num(detail.data,'total')))}>WhatsApp</a></>}{detail.kind==='order'&&canEdit('challan')&&analysis.remaining(detail)>0&&<button className="btn primary" onClick={()=>convert(detail,'challan')}>Create challan</button>}{detail.kind==='estimate'&&canEdit('order')&&<button className="btn primary" onClick={()=>convert(detail,'order')}>Convert to order</button>}{(detail.kind==='proforma'||(detail.kind==='challan'&&!rows.some(r=>r.kind==='invoice'&&r.data.sourceChallanId===detail.id)))&&canEdit('invoice')&&<button className="btn primary" onClick={()=>convert(detail,'invoice')}>Convert to sale</button>}{detail.kind==='invoice'&&canEdit('paymentIn')&&analysis.balance(detail)>0&&<button className="btn" onClick={()=>{setForm({kind:'paymentIn',initial:{partyId:detail.data.partyId,sourceId:detail.id,amount:analysis.balance(detail)}});setDetail(null)}}>Record payment</button>}{detail.kind==='product'&&canEdit('lot')&&<button className="btn" onClick={()=>{setForm({kind:'lot',initial:{productId:detail.id}});setDetail(null)}}>Add lot</button>}</div></div></Modal>}
 {toast&&<div className="toast" role="status">{toast}</div>}
 </div>;
}