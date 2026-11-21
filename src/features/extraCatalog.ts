import type {Field,Module} from './catalog';
const txt=(key:string,required=false):Field=>({key,type:'text',required});
const rel=(key:string,source:string,required=false):Field=>({key,type:'related',source,required});
const money=(key:string):Field=>({key,type:'money',min:0,required:true});
const day:Field={key:'date',type:'date',required:true};
const opts=(key:string,options:string[]):Field=>({key,type:'select',options,required:true});
export const extraModules:Module[]=[
 {slug:'attendance',resource:'attendance',family:'admin',columns:['date','name','status','notes'],fields:[day,txt('name',true),opts('status',['present','absent','leave']),txt('notes')]},
 {slug:'staff-advances',resource:'staffAdvances',family:'money',columns:['date','name','amount','reference'],fields:[day,txt('name',true),money('amount'),txt('reference')]},
 {slug:'complaints',resource:'complaints',family:'crm',columns:['date','partyId','category','name','status'],fields:[day,rel('partyId','parties',true),opts('category',['shade','damage','delivery']),txt('name',true),rel('lotId','lots'),opts('status',['open','completed']),txt('notes')]},
 {slug:'price-lists',resource:'priceLists',family:'directory',columns:['priceList','partyId','productId','salePrice'],fields:[opts('priceList',['retail','contractor','builder','dealer']),rel('partyId','parties'),rel('productId','products',true),money('salePrice')]},
 {slug:'cash-adjustments',resource:'cashAdjustments',family:'money',columns:['date','direction','amount','reason'],fields:[day,opts('direction',['in','out']),money('amount'),txt('reason',true)]},
 {slug:'cash-closing',resource:'closings',family:'money',columns:['date','countedCash','notes'],fields:[day,money('countedCash'),txt('notes')]},
 {slug:'bank-reconciliation',resource:'bankEntries',family:'money',columns:['date','bankId','reference','amount','status'],fields:[day,rel('bankId','banks',true),txt('reference',true),opts('direction',['in','out']),money('amount'),opts('status',['open','matched']),rel('paymentId','payments')]},
 {slug:'reminder-register',resource:'reminders',family:'crm',columns:['name','partyId','dueDate','status'],fields:[txt('name',true),rel('partyId','parties',true),{key:'dueDate',type:'date',required:true},opts('status',['open','completed']),txt('message')]}
];