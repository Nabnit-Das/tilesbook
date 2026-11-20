'use client';
import {useState} from 'react';
import {Calculator, Plus, Trash2, X, Mic} from 'lucide-react';
import {add,fields,saleKinds,type Field} from '@/lib/screens';
import {convertArea,invoiceTotals,mixedLots,money,type Line} from '@/lib/domain';
import type {Data,Row} from '@/lib/records';
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const str=(d:Data,k:string)=>String(d[k]??'');
export const num=(d:Data,k:string)=>Number(d[k]??0);
export const day=(value:string)=>/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).split('-').reverse().join('/'):value;
export type OpenForm={kind:string;initial?:Data};
type EditorProps={form:OpenForm;rows:Row[];role:string;close:()=>void;save:(kind:string,data:Data,print:boolean)=>Promise<void>};
export function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){
 return <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape')close()}}><header className="cardHead"><h2>{title}</h2><button type="button" className="icon-btn" onClick={close} aria-label="Close"><X size={18}/></button></header>{children}</section></div>;
}
function options(rows:Row[],kind:string){
 return rows.filter(r=>kind==='invoice'?['invoice','pos'].includes(r.kind):r.kind===kind).map(r=>[r.id,kind==='lot'?str(r.data,'lot')+' / '+str(r.data,'shade')+' · '+str(rows.find(x=>x.id===r.data.productId)?.data??{},'name'):str(r.data,'name')||str(r.data,'reference')] as const);
}
function Input({field,value,change,rows}:{field:Field;value:unknown;change:(v:unknown)=>void;rows:Row[]}){
 const [,label,type='text',values]=field;
 const choices=values?.map(x=>[x,x] as const)??options(rows,type);
 return <label className="field">{label}{choices.length||['party','lot','product','invoice','order','select'].includes(type)?<select aria-label={label} value={String(value??'')} onChange={e=>change(e.target.value)}><option value="">Select</option>{choices.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>:<input aria-label={label} type={type==='money'?'number':type} step={type==='money'||type==='number'?'any':undefined} min={type==='money'||type==='number'?0:undefined} value={type==='money'&&typeof value==='number'?value/100:String(value??'')} onChange={e=>change(type==='money'?Math.round(Number(e.target.value)*100):type==='number'?Number(e.target.value):e.target.value)}/>}</label>;
}
const starterLine={productId:'',lotId:'',qty:1,price:0,discount:0,room:''};
function defaults(kind:string):Data{
 const data:Data={date:today(),reference:(kind==='invoice'?'INV':kind.toUpperCase())+'-'+Date.now().toString().slice(-6)};
 if(kind==='party')Object.assign(data,{type:'Customer',state:'21'});
 if(kind==='product')Object.assign(data,{unit:'Box',gst:18,area:4,pack:4,cost:0,price:0,low:20});
 if(kind==='paymentIn'||kind==='paymentOut')data.mode='UPI';
 if(kind==='transfer')data.from='main';
 if(kind==='count')data.location='main';
 if(kind==='cheque')data.status='Open';
 if(kind==='slab')data.status='Available';
 if(kind==='cash')data.direction='In';
 if(kind==='service')Object.assign(data,{gst:18,price:0});
 for(const [key,,type] of fields[kind]??[])if((type==='number'||type==='money')&&data[key]===undefined)data[key]=0;
 return data;
}
export function speak(onText:(value:string)=>void,onError:(reason:string)=>void){
 type Recognition={start:()=>void;lang:string;onresult:(event:{results:{transcript:string}[][]})=>void;onerror:()=>void};
 const host=window as Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
 const Speech=host.SpeechRecognition??host.webkitSpeechRecognition;
 if(!Speech){onError('Voice input is unavailable in this browser. You can type the details.');return;}
 const engine=new Speech();
 engine.lang='en-IN';
 engine.onresult=event=>onText(event.results[0][0].transcript);
 engine.onerror=()=>onError('No speech was captured. Try again or type the details.');
 engine.start();
}
export function AreaCalculator({area=4,pack=4,onApply}:{area?:number;pack?:number;onApply?:(boxes:number)=>void}){
 const [sqft,setSqft]=useState(350),[wastage,setWastage]=useState(5),[piece,setPiece]=useState(area),[pieces,setPieces]=useState(pack),[full,setFull]=useState(true);
 let result:ReturnType<typeof convertArea>|null=null;
 try{result=convertArea(sqft,wastage,piece,pieces,full)}catch{}
 return <div className="formBody"><div className="fieldGrid">{([['Area (sqft)',sqft,setSqft],['Wastage (%)',wastage,setWastage],['Sqft per piece',piece,setPiece],['Pieces per box',pieces,setPieces]] as const).map(([label,value,fn])=><label key={label} className="field">{label}<input type="number" min="0" step="any" value={value} onChange={e=>fn(Number(e.target.value))}/></label>)}</div><label className="inline"><input type="checkbox" checked={full} onChange={e=>setFull(e.target.checked)}/>Round up to full boxes</label>{result?<div className="card inset"><strong className="gross">{result.boxes} boxes{result.loose?' + '+result.loose+' loose pieces':''}</strong><p className="subtle">{result.requiredArea.toFixed(2)} sqft with wastage · {result.pieces} pieces required</p></div>:<p className="warning">Enter valid tile dimensions and area.</p>}{onApply&&result&&<button className="btn primary" type="button" disabled={!!result.loose||result.boxes===0} onClick={()=>onApply(result.boxes)}>Use {result.boxes} boxes</button>}</div>;
}
export function Editor({form,rows,role,close,save}:EditorProps){
 const {kind,initial}=form;
 const isSale=saleKinds.includes(kind);
 const [data,setData]=useState<Data>(()=>({...defaults(kind),...initial}));
 const [entries,setEntries]=useState<typeof starterLine[]>(()=>(initial?.lines as typeof starterLine[]|undefined)??[{...starterLine}]);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[calculator,setCalculator]=useState<number|null>(null);
 const change=(key:string,value:unknown)=>setData(current=>({...current,[key]:value}));
 const changeLine=(index:number,patch:Partial<typeof starterLine>)=>setEntries(current=>current.map((entry,i)=>i===index?{...entry,...patch}:entry));
 const record=(id:string)=>rows.find(r=>r.id===id)?.data??{};
 const lines:Line[]=entries.map(entry=>{
  const product=record(entry.productId),lot=record(entry.lotId);
  return {...entry,description:str(product,'name'),hsn:str(product,'hsn'),lot:str(lot,'lot'),shade:str(lot,'shade'),gst:num(product,'gst'),unit:str(product,'unit'),sqft:entry.qty*num(product,'area')*(product.unit==='Box'?num(product,'pack'):1)};
 });
 let total=0;
 try{total=invoiceTotals(lines).total}catch{}
 const warning=mixedLots(lines.filter(line=>line.productId&&line.lotId));
 const field=(config:Field)=> <Input key={config[0]} field={config} value={data[config[0]]} change={value=>change(config[0],value)} rows={rows}/>;
 const submit=async(print:boolean)=>{
  setBusy(true);setError('');
  try{await save(kind,isSale?{...data,lines:entries}:data,print)}catch(e){setError(e instanceof Error?e.message:'Unable to save.')}finally{setBusy(false)}
 };
 return <Modal title={'Add '+(add[kind]??kind)} close={close}><form className="formBody" onSubmit={e=>{e.preventDefault();void submit(false)}}>
 {isSale?<><div className="fieldGrid">{field(['partyId','Party','party'])}{field(['reference','Document number'])}{field(['date','Date','date'])}{kind==='challan'&&field(['orderId','Sale order','order'])}{field(['partnerId','Referred by','party'])}{field(['dueDate','Due date','date'])}{field(['received','Amount received (₹)','money'])}</div>
 {kind==='pos'&&<label className="field">Scan or enter barcode<input onKeyDown={e=>{if(e.key!=='Enter')return;e.preventDefault();const input=e.currentTarget;const product=rows.find(r=>r.kind==='product'&&r.data.barcode===input.value.trim());const lot=product&&rows.find(r=>r.kind==='lot'&&r.data.productId===product.id);if(!product||!lot){setError('No product and lot match this barcode.');return;}setEntries(old=>[...old.filter(l=>l.productId),{...starterLine,productId:product.id,lotId:lot.id,price:num(product.data,'price')}]);input.value='';setError('');}}/></label>}
 <div className="inline"><h3>Items</h3><button type="button" className="btn" onClick={()=>speak(value=>{const party=rows.find(r=>r.kind==='party'&&str(r.data,'name').toLowerCase().includes(value.toLowerCase()));if(party)change('partyId',party.id);else change('note',value)},setError)}><Mic size={15}/>Speak party or note</button></div>
 {entries.map((entry,index)=><div className="lineItem" key={index}>
 <Input field={['productId','Item','product']} value={entry.productId} change={v=>changeLine(index,{productId:String(v),lotId:'',price:num(record(String(v)),'price')})} rows={rows}/>
 <Input field={['lotId','Lot / Shade','lot']} value={entry.lotId} change={v=>changeLine(index,{lotId:String(v)})} rows={rows.filter(r=>r.kind!=='lot'||r.data.productId===entry.productId)}/>
 <Input field={['qty','Quantity','number']} value={entry.qty} change={v=>changeLine(index,{qty:Number(v)})} rows={rows}/>
 <Input field={['price','Rate (₹)','money']} value={entry.price} change={v=>changeLine(index,{price:Number(v)})} rows={rows}/>
 <Input field={['discount','Discount (₹)','money']} value={entry.discount} change={v=>changeLine(index,{discount:Number(v)})} rows={rows}/>
 {kind==='estimate'&&<Input field={['room','Room']} value={entry.room} change={v=>changeLine(index,{room:String(v)})} rows={rows}/>}
 <div className="inline"><button type="button" className="btn" onClick={()=>setCalculator(index)}><Calculator size={15}/>Sqft Converter</button>{entries.length>1&&<button type="button" aria-label="Remove line" className="icon-btn" onClick={()=>setEntries(old=>old.filter((_,i)=>i!==index))}><Trash2 size={15}/></button>}</div></div>)}
 <div className="inline"><button type="button" className="btn" onClick={()=>setEntries(old=>[...old,{...starterLine}])}><Plus size={16}/>Add line</button><span className="subtle">GST rates should be verified with your CA.</span></div>
 {warning&&<div className="warning">Mixed lots may differ in shade. Check whether the order can be filled from one lot.{role==='OWNER'&&field(['override','Owner override reason'])}</div>}
 {field(['note','Notes'])}<div className="inline"><strong className="gross">{money(total)}</strong><span className="subtle">Balance {money(total-num(data,'received'))}</span></div>
 </>:<div className="fieldGrid">{(fields[kind]??[]).map(field)}</div>}
 {['lot','damage','slab'].includes(kind)&&<label className="field">{kind==='slab'?'Vein-match photo':'Photo'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{const file=e.target.files?.[0];if(!file){change('photo',undefined);return;}if(file.size>1000000){setError('Choose an image under 1 MB.');e.target.value='';change('photo',undefined);return;}const reader=new FileReader();reader.onload=()=>{change('photo',reader.result);setError('');};reader.readAsDataURL(file);}}/></label>}
 {error&&<p role="alert" className="warning">{error}</p>}
 <div className="formActions"><button type="button" className="btn" onClick={close}>Cancel</button>{(isSale||['credit','purchase','po','debit','paymentIn','paymentOut'].includes(kind))&&<button type="button" className="btn" disabled={busy} onClick={()=>void submit(true)}>Save & Print</button>}<button className="btn primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form>{calculator!==null&&<Modal title="Sqft Converter" close={()=>setCalculator(null)}><AreaCalculator area={num(record(entries[calculator].productId),'area')||4} pack={num(record(entries[calculator].productId),'pack')||4} onApply={boxes=>{changeLine(calculator,{qty:boxes});setCalculator(null)}}/></Modal>}</Modal>;
}