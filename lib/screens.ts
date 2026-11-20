export const groups=[
 ['Home','home'],
 ['Parties','party','whatsapp','portal'],
 ['Items','product','lot','service','category','damage','display','slab','transfer','count'],
 ['Sale','invoice','estimate','proforma','paymentIn','order','challan','credit','pos'],
 ['Purchase & Expense','purchase','paymentOut','expense','po','debit'],
 ['Grow Your Business','partner','commission','followup','offer','campaign'],
 ['Cash & Bank','bank','cash','cheque','loan'],
 ['Reports','reports'],
 ['Sync, Share & Backup','users','audit','backup'],
 ['Utilities','utilities'],
 ['Settings','setting'],
 ['Plans & Pricing','plans']
] as const;
export const titles:Record<string,string>={home:'Home',party:'Party Details',whatsapp:'WhatsApp Connect',portal:'Customer Portal',product:'Items',lot:'Lot-wise Stock',service:'Services',category:'Categories',damage:'Damage Log',display:'Display & Samples',slab:'Marble Slabs',transfer:'Stock Transfer',count:'Physical Stock Count',invoice:'Sale Invoices',estimate:'Estimate / Quotation',proforma:'Proforma Invoice',paymentIn:'Payment-In',order:'Sale Orders',challan:'Delivery Challans',credit:'Sale Return / Credit Note',pos:'POS / Counter',purchase:'Purchase Bills',paymentOut:'Payment-Out',expense:'Expenses',po:'Purchase Orders',debit:'Purchase Return / Debit Note',partner:'Trade Partners',commission:'Commission Payments',followup:'Follow-ups',offer:'Offers',campaign:'WhatsApp Campaigns',bank:'Bank Accounts',cash:'Cash In Hand',cheque:'Cheques',loan:'Loan Accounts',reports:'Reports',users:'Users & Roles',audit:'Audit Trail',backup:'Backup & Restore',utilities:'Imports & Utilities',setting:'Settings',plans:'Plans & Pricing',calculator:'Sqft Calculator',receivables:'Who Owes Me'};
export const add:Record<string,string>={party:'Party',product:'Item',lot:'Lot',service:'Service',category:'Category',damage:'Damage',display:'Display Stock',slab:'Slab',transfer:'Transfer',count:'Stock Count',invoice:'Sale',estimate:'Estimate',proforma:'Proforma',paymentIn:'Payment-In',order:'Order',challan:'Challan',credit:'Credit Note',pos:'Counter Bill',purchase:'Purchase',paymentOut:'Payment-Out',expense:'Expense',po:'Purchase Order',debit:'Debit Note',partner:'Partner Rule',commission:'Commission Payment',followup:'Follow-up',offer:'Offer',campaign:'Campaign',bank:'Bank Account',cash:'Cash Adjustment',cheque:'Cheque',loan:'Loan'};
export const saleKinds=['invoice','estimate','proforma','order','challan','pos'];
export type Field=[key:string,label:string,type?:string,options?:string[]];
const date:Field=['date','Date','date'];
const ref:Field=['reference','Reference'];
const party:Field=['partyId','Party','party'];
const lot:Field=['lotId','Lot / Shade','lot'];
const amount:Field=['amount','Amount (₹)','money'];
const note:Field=['note','Notes'];
const quantity:Field=['quantity','Quantity','number'];
const purchaseFields:Field[]=[party,lot,quantity,['cost','Unit cost (₹)','money'],['landed','Landed cost (₹)','money'],date,ref];
export const fields:Record<string,Field[]>={
 party:[['name','Party name'],['type','Type','select',['Customer','Supplier','Mason','Contractor','Architect','Builder']],['phone','Phone','tel'],['gstin','GSTIN'],['state','State code'],['address','Billing address'],['shipping','Shipping address']],
 product:[['name','Item name'],['category','Category'],['brand','Brand'],['design','Design'],['size','Size'],['finish','Finish'],['hsn','HSN'],['gst','GST %','number'],['unit','Stock unit','select',['Box','Bag','Piece','Slab']],['area','Sqft per piece','number'],['pack','Pieces per box','number'],['price','Sale price (₹)','money'],['cost','Purchase price (₹)','money'],['low','Low stock level','number'],['barcode','Barcode']],
 lot:[['productId','Product','product'],['lot','Lot number'],['shade','Shade'],['supplierId','Supplier','party'],['quantity','Opening stock','number'],date],
 purchase:purchaseFields,po:purchaseFields,debit:[party,lot,quantity,['cost','Unit cost (₹)','money'],date,ref,note],
 paymentIn:[party,['sourceId','Invoice','invoice'],amount,['mode','Mode','select',['Cash','UPI','Bank','Cheque']],date,ref],
 paymentOut:[party,amount,['mode','Mode','select',['Cash','UPI','Bank','Cheque']],date,ref],
 credit:[['sourceId','Original invoice','invoice'],lot,quantity,date,ref,note],
 transfer:[lot,quantity,['from','From location'],['to','To location'],date,note],
 count:[lot,['location','Location'],['counted','Counted units','number'],date,note],
 damage:[lot,quantity,['reason','Reason','select',['Factory transit','Godown handling','Delivery','Showroom']],['name','Responsible person'],date,note],
 display:[lot,quantity,['name','Showroom location / recipient'],date,note],
 expense:[['name','Expense'],['category','Category','select',['Freight','Unloading','Rent','Other']],amount,date,note],
 bank:[['name','Bank name'],['account','Account number'],['ifsc','IFSC'],['upi','UPI address'],amount,date],
 cash:[['name','Description'],amount,['direction','Direction','select',['In','Out']],date],
 loan:[['name','Lender'],amount,['rate','Annual interest %','number'],['months','Term (months)','number'],date],
 cheque:[['name','Party name'],ref,amount,date,['status','Status','select',['Open','Deposited','Bounced','Withdrawn']]],
 slab:[['name','Slab number'],['length','Length (ft)','number'],['width','Width (ft)','number'],['status','Status','select',['Available','Reserved','Remnant']],party,date,note],
 partner:[party,['rate','Commission %','number'],['perBox','Fixed per box (₹)','money'],date],
 commission:[party,amount,date,ref],
 followup:[party,['name','Follow-up'],date,note],
 offer:[lot,['name','Offer'],['rate','Discount %','number'],date,note],
 campaign:[['name','Campaign'],date,note],service:[['name','Service name'],['hsn','SAC'],['price','Price (₹)','money'],['gst','GST %','number']],category:[['name','Category name'],note]
};
export const descriptions:Record<string,string>={invoice:'Manage GST invoices, payments and customer balances.',lot:'Track batches, matching shades and available stock.',party:'Manage customers, suppliers and trade partners.',product:'Manage products, dimensions and pricing.',order:'Reserve stock and track every phase of delivery.',challan:'Dispatch reserved stock against a sale order.',estimate:'Build room-by-room quotes with per-item GST.',damage:'Record breakage by lot and see the cost.',display:'Track opened boxes and samples issued.',slab:'Track individual marble slabs and remnants.',credit:'Return unopened stock to its original lot.',reports:'Review sales, inventory and delivery performance.',receivables:'Track outstanding customer invoices.'};