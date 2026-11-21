import {statements} from "@/finance/ledger";
import {canCost,docs,lines,lookup,moduleRows,n,preferences,str,today,type Row,type Snapshot} from "./model";
export interface ReportResult {columns:string[];rows:Row[];note?:string}
export interface Scope {start:string;end:string;user:string;search?:string}
export function inScope(r:Row,s:Scope){const date=(str(r,"date")||str(r,"createdAt")).slice(0,10);
 return (!s.start||date>=s.start)&&(!s.end||date<=s.end)&&(!s.user||r.userId===s.user||r.createdBy===s.user);}
function group(rows:Row[],keys:string[],values:string[]):Row[]{const by=new Map<string,Row>();for(const r of rows){const id=JSON.stringify(keys.map(k=>r[k]??""));const v=by.get(id)||{id,...Object.fromEntries(keys.map(k=>[k,r[k]]))};for(const k of values)v[k]=n(v,k)+n(r,k);by.set(id,v)}return [...by.values()]}
export const profitReports=["profit-loss","bill-profit","party-profit","item-profit","category-profit","balance-sheet","trial-balance","breakage-loss"];
export function report(book:Snapshot,id:string,scope:Scope):ReportResult{
 const result=(columns:string,rows:Row[],note?:string)=>({columns:columns.split(" "),rows,note});
 if(profitReports.includes(id)&&!canCost(book))return result("name",[],"accessRestricted");
 const get=(key:string)=>(book.records[key]||[]).filter(r=>inScope(r,scope));
 const invoices=get("saleInvoices"),purchases=get("purchaseBills"),credits=get("creditNotes"),debits=get("debitNotes"),payments=get("payments"),expenses=get("expenses");
 const sum=(rows:Row[],key:string)=>rows.reduce((s,r)=>s+n(r,key),0);
 const all=docs(book).filter(r=>inScope(r,scope));
 const itemRows=(documents:Row[],sign:number)=>documents.flatMap(d=>lines(d).map(l=>{const product=lookup(book,"products",l.productId);const qty=n(l,"qty")*sign;const sourceCost=product?.purchasePrice;
 return {...l,id:d.id+"-"+l.id,number:d.number,date:d.date,partyId:d.partyId,partnerId:d.partnerId,category:product?.category||"other",hsn:l.hsn||product?.hsn||"",unit:l.unit||product?.baseUnit,qty,taxable:n(l,"taxable")*sign,tax:n(l,"tax")*sign,amount:n(l,"amount")*sign,discount:n(l,"discount")*sign,cgst:n(l,"cgst")*sign,sgst:n(l,"sgst")*sign,igst:n(l,"igst")*sign,net:n(l,"taxable")*sign-qty*(Number(sourceCost)||0)} as Row}));
 const salesLines=[...itemRows(invoices,1),...itemRows(credits,-1)],purchaseLines=[...itemRows(purchases,1),...itemRows(debits,-1)];
 const lots=book.records.lots||[],products=moduleRows(book,"items","products"),parties=moduleRows(book,"parties","parties");
 const balance=moduleRows(book,"partners","partners"),ord=get("saleOrders");
 switch(id){
 case "sales-report":case "purchases-report":return result("date number partyName taxable tax total balance",id==="sales-report"?invoices:purchases);
 case "day-book":case "all-transactions":return result("date number partyName resource total status",[...all,...payments.map(p=>({...p,resource:p.direction==="in"?"payment-in":"payment-out",total:p.amount,partyName:str(lookup(book,"parties",p.partyId),"name")})),...expenses.map(e=>({...e,resource:"expenses",total:e.amount,partyName:e.name}))].sort((a,b)=>str(b,"date").localeCompare(str(a,"date"))));
 case "profit-loss":return statements(book,id,scope);
 case "bill-profit":case "party-profit":case "item-profit":case "category-profit":{const key=({"bill-profit":"number","party-profit":"partyId","item-profit":"productId","category-profit":"category"})[id]||"number";return result(key+" taxable net",group(salesLines,[key],["taxable","net"]),"estimatedCostNote")}
 case "cash-flow":case "bank-statement":return result("date partyId mode direction amount reference",payments.filter(r=>id==="cash-flow"||str(r,"mode").toLowerCase()!=="cash"));
 case "cash-ledger":return result("date partyId direction amount reference",[...payments.filter(r=>str(r,"mode").toLowerCase()==="cash"),...get("cashAdjustments").map(r=>({...r,reference:r.reason})),...get("staffAdvances").map(r=>({...r,direction:"out",reference:r.name})),...expenses.filter(r=>str(r,"mode").toLowerCase()==="cash").map(r=>({...r,direction:"out",reference:r.name}))].sort((a,b)=>str(b,"date").localeCompare(str(a,"date"))));
 case "trial-balance":case "balance-sheet":return statements(book,id,scope);
 case "party-statement":{
 const trade=all.filter(r=>["saleInvoices","purchaseBills","creditNotes","debitNotes"].includes(str(r,"resource"))).map(r=>({...r,amount:(["saleInvoices","debitNotes"].includes(str(r,"resource"))?1:-1)*n(r,"total")}));
 const cash=payments.map(p=>({...p,number:str(p,"reference")||str(p,"number"),resource:p.direction==="out"?"payment-out":"payment-in",amount:(p.direction==="in"?-1:1)*n(p,"amount")}));
 return result("date number partyId resource amount",[...trade,...cash].sort((a,b)=>str(b,"date").localeCompare(str(a,"date"))));}
 case "all-parties":return result("name type phone gstin balance",parties);
 case "party-by-item":case "item-by-party":return result("partyId productId unit qty taxable",group(salesLines,["partyId","productId","unit"],["qty","taxable"]));
 case "trade-by-party":case "trade-by-category":{const key=id==="trade-by-party"?"partyId":"category";return result(key+" sales purchases",group([...salesLines.map(l=>({...l,sales:l.taxable})),...purchaseLines.map(l=>({...l,purchases:l.taxable}))],[key],["sales","purchases"]))}
 case "by-party-group":return result("type balance",group(parties,["type"],["balance"]));
 case "gstr-1":case "gstr-2":return result("date number partyName taxable tax total",(id==="gstr-1"?invoices:purchases),"gstWorksheet");
 case "gstr-3b":case "gstr-9":return result("group taxable tax",[{id:"s",group:"sales",taxable:sum(salesLines,"taxable"),tax:sum(salesLines,"tax")},{id:"p",group:"purchases",taxable:sum(purchaseLines,"taxable"),tax:sum(purchaseLines,"tax")}],"gstWorksheet");
 case "hsn-summary":case "gst-rates":case "gst-report":{const k=id==="hsn-summary"?"hsn":"gstRate";return result(k+" taxable cgst sgst igst tax amount",group(salesLines,[k],["taxable","cgst","sgst","igst","tax","amount"]),"gstWorksheet")}
 case "sac-report":return result("name hsn salePrice gstRate",get("services"),"serviceMasterNote");
 case "stock-summary":case "item-detail":case "low-stock":return result("name category baseUnit sellable lowStockLevel salePrice",products.filter(p=>id!=="low-stock"||n(p,"sellable")<=n(p,"lowStockLevel")));
 case "stock-detail":return result("date lotId qty reason branchId",get("stockMovements"));
 case "stock-by-category":return result("category baseUnit sellable",group(products,["category","baseUnit"],["sellable"]));
 case "item-discount":case "discount-report":return result("productId qty discount",group(salesLines.filter(l=>n(l,"discount")!==0),["productId"],["qty","discount"]));
 case "form-27eq":case "tcs-receivable":case "tds-payable":case "tds-receivable":{const key=id.includes("tds")?"tds":"tcs";return result("number partyId date "+key,all.filter(r=>n(r,key)!==0),"taxWorksheet")}
 case "expense-report":return result("date name category amount",expenses);
 case "expense-category":case "expense-item":{const k=id==="expense-category"?"category":"name";return result(k+" amount",group(expenses,[k],["amount"]))}
 case "sale-order-report":case "purchase-order-report":return result("number date partyName total balance status",id==="sale-order-report"?ord:get("purchaseOrders"));
 case "order-item":return result("number productId lotId qty delivered",itemRows(ord,1));
 case "loan-statement":return result("name principal interestRate months emi dueDate",moduleRows(book,"loans","loans"));
 case "dead-stock": {const now=Date.parse(today());const threshold=Math.max(0,Number(preferences(book).deadStockDays??180));return result("lotNo shade productId sellable days",lots.map(l=>({...l,days:Math.floor((now-Date.parse(str(l,"lastSoldDate")||str(l,"receivedDate")||today()))/86400000)})).filter(l=>l.days>=threshold&&n(l,"sellable")>0))}
 case "lot-stock":return result("productId lotNo shade physical reserved display sellable",lots);
 case "breakage-loss":return result("date lotId qty reason responsible loss",get("damage"));
 case "pending-deliveries":return result("number partyId productId lotId qty delivered remaining",itemRows(ord,1).map(l=>({...l,remaining:n(l,"qty")-n(l,"delivered")})).filter(l=>l.remaining>0));
 case "advance-held":return result("date number partyName received advance status",ord.filter(r=>str(r,"status").toLowerCase()!=="closed").map(r=>({...r,advance:Math.max(0,n(r,"received")-n(r,"advanceApplied"))})).filter(r=>r.advance>0));
 case "commission-payable":return result("partyId earned paid payable",balance);
 case "partner-sales":return result("partnerId number date partyName total",invoices.filter(r=>!!r.partnerId));
 case "returns-by-lot":return result("productId lotId qty amount",group(itemRows(credits,1),["lotId","productId"],["qty","amount"]));
 case "display-stock":return result("date lotId qty location partyId",get("display"));
 case "quotation-conversion":return result("number date partyName total status",get("estimates").map(r=>({...r,status:(book.records.saleOrders||[]).some(o=>o.sourceId===r.id)?"converted":r.status||"open"})));
 default:return result("number date partyName total",[]);
 }
}

