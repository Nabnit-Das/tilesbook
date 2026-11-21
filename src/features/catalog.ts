import {extraModules} from "./extraCatalog";
export type FieldType = "text" | "date" | "number" | "money" | "integer" | "select" | "related" | "textarea" | "photo";
export interface Field {
  key: string; type: FieldType; required?: boolean; options?: string[]; source?: string;
  min?: number; initial?: string | number; full?: boolean;
}
export interface Module {
  slug: string; resource: string; columns: string[]; fields: Field[];
  family: "directory" | "documents" | "money" | "stock" | "crm" | "admin";
}
const txt = (key: string, required = false): Field => ({key, type:"text", required});
const memo = (key: string): Field => ({key, type:"textarea", full:true});
const choice = (key: string, options: string[]): Field => ({key,type:"select",options,required:true});
const rel = (key: string, source: string, required = false): Field => ({key,type:"related",source,required});
const num = (key: string, initial = 0, min = 0): Field => ({key,type:"number",initial,min});
const money = (key: string, required = false): Field => ({key,type:"money",min:0,required});
const date = (key: string): Field => ({key,type:"date"});
const photo = (key: string): Field => ({key,type:"photo"});
const party = rel("partyId","parties",true), lot = rel("lotId","lots",true);
const documentCols = ["number","date","partyName","total","balance","status"];
const doc = (slug: string, resource: string): Module => ({slug,resource,columns:documentCols,fields:[],family:"documents"});
const payments = [date("date"),party,rel("documentId","documents"),money("amount",true),choice("mode",["cash","upi","bank","cheque"]),rel("bankId","banks"),txt("reference"),memo("notes")];
export const modules: Module[] = [
 ...extraModules,
 {slug:"approvals",resource:"approvals",family:"admin",columns:["number","date","partyId","status","notes"],fields:[]},
 {slug:"parties",resource:"parties",family:"directory",columns:["name","type","phone","gstin","balance"],fields:[txt("name",true),choice("type",["customer","supplier","mason","contractor","architect","builder"]),txt("phone"),txt("gstin"),txt("state"),memo("address"),memo("shippingAddress"),money("openingBalance"),money("creditLimit"),choice("priceList",["retail","contractor","builder","dealer"])]},
 {slug:"items",resource:"products",family:"directory",columns:["name","category","baseUnit","salePrice","sellable"],fields:[txt("name",true),txt("brand"),txt("design"),txt("size"),txt("finish"),txt("category"),txt("hsn"),num("gstRate",18),choice("baseUnit",["Box","Piece","Bag","Slab","Sqft"]),num("sqftPerPiece",4,.01),num("piecesPerBox",4,1),money("salePrice",true),money("purchasePrice"),num("lowStockLevel"),txt("barcode"),txt("lotNo"),txt("shade"),num("openingQty")]},
 {slug:"lots",resource:"lots",family:"directory",columns:["lotNo","productId","shade","physical","reserved","sellable","lastSoldDate"],fields:[rel("productId","products",true),txt("lotNo",true),txt("shade",true),rel("supplierId","parties"),date("receivedDate"),num("openingQty"),photo("photo")]},
 {slug:"services",resource:"services",family:"directory",columns:["name","hsn","salePrice","gstRate"],fields:[txt("name",true),txt("hsn"),money("salePrice",true),num("gstRate",18)]},
 {slug:"categories",resource:"categories",family:"directory",columns:["name","description"],fields:[txt("name",true),memo("description")]},
 doc("invoices","saleInvoices"),doc("estimates","estimates"),doc("proforma","proformas"),doc("orders","saleOrders"),doc("challans","challans"),doc("credit-notes","creditNotes"),doc("purchases","purchaseBills"),doc("purchase-orders","purchaseOrders"),doc("debit-notes","debitNotes"),doc("pos","saleInvoices"),
 {slug:"payment-in",resource:"payments",family:"money",columns:["date","partyId","documentId","mode","amount","reference"],fields:payments},
 {slug:"payment-out",resource:"payments",family:"money",columns:["date","partyId","documentId","mode","amount","reference"],fields:payments},
 {slug:"expenses",resource:"expenses",family:"money",columns:["date","name","category","amount","mode"],fields:[txt("name",true),date("date"),choice("category",["freight","unloading","rent","labour","other"]),money("amount",true),choice("mode",["cash","upi","bank","cheque"]),memo("notes")]},
 {slug:"banks",resource:"banks",family:"money",columns:["name","accountNumber","ifsc","upi","balance"],fields:[txt("name",true),txt("accountNumber"),txt("ifsc"),txt("upi"),money("openingBalance")]},
 {slug:"cheques",resource:"cheques",family:"money",columns:["reference","partyId","date","amount","status"],fields:[txt("reference",true),party,date("date"),money("amount",true),choice("direction",["in","out"]),choice("status",["open","deposited","bounced","withdrawn"]),rel("bankId","banks")]},
 {slug:"loans",resource:"loans",family:"money",columns:["name","principal","interestRate","months","emi","dueDate"],fields:[txt("name",true),money("principal",true),num("interestRate",10),num("months",12,1),date("dueDate"),memo("notes")]},
 {slug:"partners",resource:"partners",family:"crm",columns:["partyId","kind","rate","earned","paid","payable"],fields:[party,choice("kind",["percent","box"]),num("rate",2),date("lastContact")]},
 {slug:"follow-ups",resource:"followUps",family:"crm",columns:["name","partyId","dueDate","status"],fields:[txt("name",true),party,date("dueDate"),choice("status",["open","completed"]),memo("notes")]},
 {slug:"offers",resource:"offers",family:"crm",columns:["name","lotId","percentOff","dueDate"],fields:[txt("name",true),lot,num("percentOff",10),date("dueDate"),memo("message")]},
 {slug:"campaigns",resource:"campaigns",family:"crm",columns:["name","audience","date","status"],fields:[txt("name",true),txt("audience"),date("date"),memo("message"),choice("status",["draft","ready"])]},
 {slug:"damage",resource:"damage",family:"stock",columns:["date","lotId","qty","reason","responsible","loss"],fields:[date("date"),lot,num("qty",1,.001),choice("reason",["factoryTransit","godownHandling","delivery","showroom"]),txt("responsible",true),photo("photo"),memo("notes")]},
 {slug:"display",resource:"display",family:"stock",columns:["date","lotId","qty","location","partyId"],fields:[date("date"),lot,num("qty",1,.001),txt("location",true),rel("partyId","parties"),memo("notes")]},
 {slug:"slabs",resource:"slabs",family:"stock",columns:["slabNo","length","width","area","status","partyId"],fields:[txt("slabNo",true),num("length",9,.01),num("width",5.5,.01),choice("status",["available","reserved","remnant"]),rel("partyId","parties"),txt("parentSlab"),photo("photo"),memo("notes")]},
 {slug:"transfers",resource:"transfers",family:"stock",columns:["date","lotId","fromBranchId","toBranchId","qty"],fields:[date("date"),lot,rel("fromBranchId","branches",true),rel("toBranchId","branches",true),num("qty",1,.001)]},
 {slug:"stock-count",resource:"stockCounts",family:"stock",columns:["date","lotId","systemQty","counted","difference"],fields:[date("date"),lot,rel("branchId","branches"),num("counted"),memo("reason")]},
 {slug:"commission-payments",resource:"commissionPayments",family:"money",columns:["date","partnerId","amount","mode"],fields:[date("date"),rel("partnerId","partners",true),money("amount",true),choice("mode",["cash","upi","bank"])]},
 {slug:"branches",resource:"branches",family:"admin",columns:["name","address"],fields:[txt("name",true),memo("address")]},
 {slug:"users",resource:"users",family:"admin",columns:["name","phone","role"],fields:[txt("name",true),txt("phone",true),choice("role",["Manager","Counter","Godown","Accountant","Owner"])]},
 {slug:"audit",resource:"audit",family:"admin",columns:["createdAt","resource","action","userId"],fields:[]},
];
export const findModule = (slug:string) => modules.find(m=>m.slug===slug);
export const reports: Record<string,string[]> = {
 transaction:["sales-report","purchases-report","day-book","all-transactions","profit-loss","bill-profit","cash-flow","trial-balance","balance-sheet"],
 party:["party-statement","party-profit","all-parties","party-by-item","trade-by-party","by-party-group"],
 gst:["gstr-1","gstr-2","gstr-3b","gstr-9","hsn-summary","sac-report"],
 stock:["stock-summary","item-by-party","item-profit","category-profit","low-stock","stock-detail","item-detail","trade-by-category","stock-by-category","item-discount"],
 business:["bank-statement","discount-report"],taxes:["gst-report","gst-rates","form-27eq","tcs-receivable","tds-payable","tds-receivable"],
 expense:["expense-report","expense-category","expense-item"],orderGroup:["sale-order-report","purchase-order-report","order-item"],finance:["loan-statement"],
 tileReports:["dead-stock","lot-stock","breakage-loss","pending-deliveries","advance-held","commission-payable","partner-sales","returns-by-lot","display-stock","quotation-conversion"]
};
