import {lines,n,str,type Row,type Snapshot} from '@/features/model';

type AccountClass='asset'|'liability'|'equity'|'income'|'expense';
const classes:Record<string,AccountClass>={
 cashAtBank:'asset',cashOnHand:'asset',receivableControl:'asset',inputGst:'asset',inventoryValue:'asset',staffLoans:'asset',
 supplierControl:'liability',outputGst:'liability',partnerLiability:'liability',loanPrincipal:'liability',
 capital:'equity',salesRevenue:'income',rounding:'income',stockVariance:'income',costOfSales:'expense',
 overhead:'expense',breakageCost:'expense',partnerExpense:'expense'
};
type Entry={date:string;actor:string;account:string;paise:number};
const dateOf=(r:Row)=>String(r.date||r.createdAt||'').slice(0,10);
const cashAccount=(r:Row)=>String(r.mode||r.paymentMode||'cash').toLowerCase()==='cash'?'cashOnHand':'cashAtBank';
/** A signed journal entry is a debit when positive. Every posting has an equal credit. */
export function journal(book:Snapshot):Entry[]{
 const entries:Entry[]=[];
 const rows=(resource:string)=>book.records[resource]||[];
 const post=(r:Row,debit:string,credit:string,amount:number)=>{const paise=Math.round(amount);if(!paise)return;
  const common={date:dateOf(r),actor:String(r.createdBy||r.userId||'')};
  entries.push({...common,account:debit,paise},{...common,account:credit,paise:-paise});
 };
 const parties=new Map(rows('parties').map(r=>[r.id,r]));
 const productCosts=new Map(rows('products').map(r=>[r.id,n(r,'purchasePrice')]));
 const purchaseHistory=rows('purchaseBills').flatMap(b=>lines(b).map(line=>({date:dateOf(b),lot:line.lotId,product:line.productId,price:n(line,'baseQty')||n(line,'qty')?(n(line,'landedCost')||n(line,'taxable'))/(n(line,'baseQty')||n(line,'qty')):0}))).sort((a,b)=>b.date.localeCompare(a.date));
 const cost=(r:Row,d:string)=>purchaseHistory.find(p=>p.date<=d&&p.lot===r.lotId&&p.product===r.productId)?.price??productCosts.get(str(r,'productId'))??0;
 for(const b of rows('banks'))post(b,'cashAtBank','capital',n(b,'openingBalance'));
 for(const p of rows('parties'))post(p,n(p,'openingBalance')>=0?'receivableControl':'supplierControl','capital',n(p,'openingBalance'));
 for(const l of rows('loans'))post(l,'capital','loanPrincipal',n(l,'principal'));
 for(const m of rows('stockMovements')){
  if(m.kind==='Opening')post(m,'inventoryValue','capital',n(m,'physical')*(productCosts.get(str(m,'productId'))??0));
  if(m.kind==='stockCounts')post(m,'inventoryValue','stockVariance',n(m,'physical')*cost(m,dateOf(m)));
 }
 const invoiceDates = new Map(rows('saleInvoices').map(invoice => [invoice.id, dateOf(invoice)]));
 for(const [resource,sign] of [['saleInvoices',1],['creditNotes',-1]] as const){
  for(const r of rows(resource)){post(r,'receivableControl','salesRevenue',sign*n(r,'taxable'));post(r,'receivableControl','outputGst',sign*n(r,'tax'));post(r,'receivableControl','rounding',sign*n(r,'roundOff'));
   const valuationDate = resource === 'creditNotes' ? invoiceDates.get(str(r,'sourceId')) ?? dateOf(r) : dateOf(r);
   for(const line of lines(r))post(r,'costOfSales','inventoryValue',sign*(n(line,'baseQty')||n(line,'qty'))*cost(line,valuationDate));
  }
 }
 for(const [resource,sign] of [['purchaseBills',1],['debitNotes',-1]] as const){
  for(const r of rows(resource)){
   post(r,'inventoryValue','supplierControl',sign*n(r,'taxable'));post(r,'inputGst','supplierControl',sign*n(r,'tax'));post(r,'rounding','supplierControl',sign*n(r,'roundOff'));
  }
 }
 const docs=[...rows('saleInvoices'),...rows('purchaseBills'),...rows('saleOrders')];
 const supplierIds=new Set(rows('purchaseBills').map(r=>r.id));
 for(const r of rows('payments')){const d=docs.find(v=>v.id===r.documentId);const supplier=d?supplierIds.has(d.id):str(parties.get(str(r,'partyId')),'type').toLowerCase()==='supplier';
  post(r,cashAccount(r),supplier?'supplierControl':'receivableControl',(r.direction==='out'?-1:1)*n(r,'amount'));
 }
 for(const r of rows('expenses'))post(r,'overhead',cashAccount(r),n(r,'amount'));
 for(const r of rows('damage'))post(r,'breakageCost','inventoryValue',n(r,'loss'));
 for(const r of rows('commissions'))post(r,'partnerExpense','partnerLiability',n(r,'amount'));
 for(const r of rows('commissionPayments'))post(r,'partnerLiability',cashAccount(r),n(r,'amount'));
 for(const r of rows('staffAdvances'))post(r,'staffLoans',cashAccount(r),n(r,'amount'));
 for(const r of rows('cashAdjustments'))post(r,'cashOnHand','capital',(r.direction==='out'?-1:1)*n(r,'amount'));
 return entries;
}
export function statements(book:Snapshot,view:string,scope:{start:string;end:string;user:string}){
 const accounts=new Map<string,number>();
 for(const e of journal(book)){if((scope.end&&e.date>scope.end)||(scope.user&&scope.user!==e.actor)||(view==='profit-loss'&&scope.start&&e.date<scope.start))continue;
 accounts.set(e.account,(accounts.get(e.account)??0)+e.paise);}
 const entries=[...accounts].filter(([,amount])=>amount!==0);
 if(view==='trial-balance')return {columns:['metric','debitPaise','creditPaise'],rows:entries.map(([k,v])=>({id:k,metric:k,debitPaise:Math.max(v,0),creditPaise:Math.max(-v,0)})),note:'valuationNote'};
 const profit=-entries.filter(([k])=>['income','expense'].includes(classes[k])).reduce((s,[,v])=>s+v,0);
 if(view==='profit-loss')return {columns:['metric','net'],rows:[...entries.filter(([k])=>['income','expense'].includes(classes[k])).map(([k,v])=>({id:k,metric:k,net:-v})),{id:'earnings',metric:'earnings',net:profit}],note:'valuationNote'};
 const balance=entries.filter(([k])=>!['income','expense'].includes(classes[k])).map(([k,v])=>({id:k,metric:k,group:classes[k],amount:classes[k]==='asset'?v:-v}));
 return {columns:['group','metric','amount'],rows:[...balance,{id:'earnings',metric:'earnings',group:'equity',amount:profit}],note:'asOfValuation'};
}
