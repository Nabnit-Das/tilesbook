import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {session} from '@/lib/auth';
import {readRecords} from '@/lib/tenant';
import {invoiceTotals,rupeesInWords,type Line} from '@/lib/domain';
import type {Data} from '@/lib/records';
export const runtime='nodejs';
const titles:Record<string,string>={invoice:'TAX INVOICE',pos:'CASH BILL',estimate:'ESTIMATE / QUOTATION',proforma:'PROFORMA INVOICE',order:'SALE ORDER',challan:'DELIVERY CHALLAN',credit:'CREDIT NOTE',debit:'DEBIT NOTE',purchase:'PURCHASE BILL',po:'PURCHASE ORDER',paymentIn:'PAYMENT RECEIPT',paymentOut:'PAYMENT VOUCHER'};
const amount=(p:number)=>new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(p/100);
const s=(row:Data,key:string)=>String(row[key]??'');
const n=(row:Data,key:string)=>Number(row[key]??0);
const sizeToPoints=(mm:number)=>mm*72/25.4;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await session();
 if(!actor)return new Response('Sign in first.',{status:401});
 const {id}=await params;
 const rows=await readRecords(actor);
 const row=rows.find(r=>r.id===id);
 if(!row||!titles[row.kind])return new Response('Document unavailable.',{status:404});
 const d=row.data as Data,setting=(rows.find(r=>r.kind==='setting')?.data??{}) as Data,bank=(rows.find(r=>r.kind==='bank')?.data??{}) as Data;
 const query=new URL(request.url).searchParams;
 const thermal=row.kind==='pos'||query.get('paper')==='80mm';
 const allLines=Array.isArray(d.lines)?d.lines as Line[]:[];
 const totals=invoiceTotals(allLines,Boolean(d.interstate));
 const title=thermal?'CASH BILL':titles[row.kind];
 const pdf=new PDFDocument({margin:thermal?12:32,size:thermal?[sizeToPoints(80),Math.max(340,250+allLines.length*29)]:'A4',info:{Title:title+' '+s(d,'reference')}});
 const buffers:Buffer[]=[];
 const finished=new Promise<Buffer>((resolve,reject)=>{pdf.on('data',(chunk:Buffer)=>buffers.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(buffers)));pdf.on('error',reject)});
 const accent=s(setting,'accent')||'#0b8588';
 const left=pdf.page.margins.left, width=pdf.page.width-left-pdf.page.margins.right;
 const text=(value:string,size=9,align:'left'|'right'|'center'='left',color='#202542')=>pdf.fillColor(color).fontSize(size).text(value,{align});
 const line=()=>{const y=pdf.y+4;pdf.moveTo(left,y).lineTo(left+width,y).strokeColor('#cdd3e2').stroke();pdf.y=y+7};
 const received=n(d,'received')+rows.filter(r=>r.kind==='paymentIn'&&(r.data as Data).sourceId===id).reduce((sum,r)=>sum+n(r.data as Data,'amount'),0);
 const challan=rows.find(r=>r.id===d.sourceChallanId);
 const credit=rows.filter(r=>r.kind==='credit'&&(r.data as Data).sourceId===id).reduce((sum,r)=>sum+n(r.data as Data,'total'),0);
 const total=allLines.length?totals.total:d.amount!==undefined?n(d,'amount'):n(d,'cost')*n(d,'quantity')+n(d,'landed');
 const upi=s(setting,'upi')||s(bank,'upi');
 const date=s(d,'date').split('-').reverse().join('/');
 const qr=upi?await QRCode.toBuffer('upi://pay?pa='+encodeURIComponent(upi)+'&pn='+encodeURIComponent(actor.business.name),{margin:1}):null;
 text(actor.business.name.toUpperCase(),thermal?12:17,thermal?'center':'left');
 if(actor.business.id==='tilebook_demo'){text('Khandagiri, Bhubaneswar, Odisha 751030',8,thermal?'center':'left');text('GSTIN 21ABCDE1234F1Z5 | 9437179877',8,thermal?'center':'left');}
 line();text(title,thermal?10:16,thermal?'center':'right',accent);
 if(!thermal&&row.kind==='invoice'){
  const copy=query.get('copy');
  text(copy==='duplicate'?'DUPLICATE':copy==='triplicate'?'TRIPLICATE':'ORIGINAL FOR RECIPIENT',8,'right');
 }
 text('No. '+s(d,'reference')+'  |  Date '+date,9,thermal?'center':'left');
 if(!thermal){
  if(d.state)text('Place of supply '+s(d,'state')+'   |   Vehicle '+(s(d,'vehicle')||'________')+'   |   E-way bill '+(s(d,'eway')||'________'));
  if(challan)text('Challan '+s(challan.data as Data,'reference'));
  if(d.orderId)text('Order '+(s((rows.find(r=>r.id===d.orderId)?.data??{}) as Data,'reference')||s(d,'orderId')));
  if(d.partnerName)text('Referred by '+s(d,'partnerName'));
  if(d.partyName)text('Bill To  '+s(d,'partyName')+'   '+s(d,'billTo')+'   '+s(d,'gstin'));
  if(d.shipTo)text('Ship To  '+s(d,'shipTo'));
 }
 line();
 if(thermal){
  for(const item of totals.rows){text(item.description+' ('+item.lot+')',9);text(item.qty+' '+item.unit+' × '+amount(item.price)+' = '+amount(item.taxable),8);}
  line();text('GST included  '+amount(totals.rows.reduce((sum,r)=>sum+r.tax,0)),8);text('TOTAL Rs. '+amount(total),12);text('Paid  '+(s(d,'mode')||'—')+(received?' · Rs. '+amount(received):''),9);
  if(qr){pdf.moveDown(.4);const y=pdf.y;pdf.image(qr,left+width/2-28,y,{width:56});pdf.y=y+61;text('Scan to pay via UPI',8,'center');}
  text('Thank you. Visit again.',9,'center');
 }else{
  const grid=(headers:string[],widths:number[],data:string[][])=>{
   const draw=(cells:string[],header=false)=>{
    const height=Math.max(19,...cells.map((cell,i)=>{pdf.fontSize(7);return pdf.heightOfString(cell,{width:widths[i]-7})+8}));
    if(pdf.y+height>pdf.page.height-42){pdf.addPage();if(!header)draw(headers,true);}
    const y=pdf.y;let x=left;
    for(const [i,cell] of cells.entries()){
     pdf.rect(x,y,widths[i],height).fillAndStroke(header?'#14183f':'#ffffff','#d4d9e6');
     pdf.fillColor(header?'#ffffff':'#202542').fontSize(7).text(cell,x+3,y+4,{width:widths[i]-7,lineBreak:true});
     x+=widths[i];
    }
    pdf.x=left;pdf.y=y+height;
   };
   draw(headers,true); data.forEach(cells=>draw(cells));
   pdf.moveDown(.55);
  };
  if(allLines.length){
   const interstate=Boolean(d.interstate);
   const taxHeads=interstate?['IGST']:['CGST','SGST'];
   const table=totals.rows.map((r,i)=>[String(i+1),(r.room?r.room+' / ':'')+r.description,r.hsn,r.lot+' / '+r.shade,r.qty+' '+r.unit,r.unit==='Bag'?'-':String(r.sqft),amount(r.price),amount(r.discount),amount(r.taxable),...(interstate?[r.gst+'% '+amount(r.igst)]:[r.gst/2+'% '+amount(r.cgst),r.gst/2+'% '+amount(r.sgst)]),amount(r.amount)]);
   table.push(['','Total','','',String(totals.rows.reduce((sum,r)=>sum+r.qty,0)),String(totals.rows.reduce((sum,r)=>sum+(r.unit==='Bag'?0:r.sqft),0)),'','',amount(totals.rows.reduce((sum,r)=>sum+r.taxable,0)),...(interstate?[amount(totals.rows.reduce((sum,r)=>sum+r.igst,0))]:[amount(totals.rows.reduce((sum,r)=>sum+r.cgst,0)),amount(totals.rows.reduce((sum,r)=>sum+r.sgst,0))]),amount(totals.net)]);
   grid(['#','Description','HSN','Lot / Shade','Qty','Sqft','Rate','Discount','Taxable',...taxHeads,'Amount'],[16,108,33,49,42,31,42,36,47,...(interstate?[80]:[40,40]),width-484],table);
   text('HSN-wise tax summary',10,'left',accent);pdf.moveDown(.2);
   const headings=['HSN','Taxable',...taxHeads,'Total tax'];
   grid(headings,headings.map(()=>width/headings.length),totals.hsn.map(r=>[r.hsn,amount(r.taxable),...(interstate?[amount(r.igst)]:[amount(r.cgst),amount(r.sgst)]),amount(r.cgst+r.sgst+r.igst)]));
  }else if(d.lot)text('Lot / shade  '+s(d,'lot')+' / '+s(d,'shade')+'   |   Quantity '+s(d,'quantity'));
  if(d.mode)text('Payment mode  '+s(d,'mode'));
  text('Amount in words  '+rupeesInWords(total));
  if(allLines.length)text('Round-off  '+amount(totals.roundOff));
  text('Total Rs. '+amount(total),14,'right',accent);
  if(['invoice','pos','proforma','order'].includes(row.kind))text('Received  Rs. '+amount(received)+'   |   Balance due  Rs. '+amount(Math.max(0,total-received-credit))+(d.dueDate?'   |   Due '+s(d,'dueDate').split('-').reverse().join('/'):''),9);
  if(d.note)text('Notes  '+s(d,'note'));
  line();
  if(bank.name)text('Bank  '+s(bank,'name')+'  |  A/c '+s(bank,'account')+'  |  IFSC '+s(bank,'ifsc'));
  if(upi)text('UPI  '+upi);
  if(row.kind==='invoice')text('IRN  __________________  |  E-invoice QR  [integration pending]',8);
  text('Terms  '+(s(setting,'terms')||'Shade can differ between lots. Report breakage at delivery. Returns must be unopened and from the same lot.'),8);
  pdf.moveDown(.75);
  if(qr&&pdf.y+72>pdf.page.height-pdf.page.margins.bottom)pdf.addPage();
  const footerY=pdf.y;
  if(qr)pdf.image(qr,left,footerY,{width:51});
  pdf.y=footerY+4;
  text('For '+actor.business.name,9,'right');
  text('Authorised Signatory',8,'right');
  pdf.y=footerY+(qr?57:29);
  if(qr)text('Scan to pay via UPI',8);
  text('Prepared by '+actor.user.name,8);
 }
 pdf.end();
 const contents=await finished;
 const filename=(s(d,'reference')||row.kind).replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';
 return new Response(new Uint8Array(contents),{headers:{'Content-Type':'application/pdf','Content-Disposition':(query.get('inline')==='1'?'inline':'attachment')+'; filename="'+filename+'"','Cache-Control':'private, no-store'}});
}