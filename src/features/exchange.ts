import {str,type Row} from "./model";
export interface Master {resource:"products"|"parties";data:Record<string,string|number>}
const xml=(s:string)=>s.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[ch]||"");
const value=(el:Element,tag:string)=>el.getElementsByTagName(tag)[0]?.textContent?.trim()||"";
// Master envelope described at https://help.tallysolutions.com/sample-xml/
export function tallyMasters(products:Row[],parties:Row[]){
 const unit=(p:Row)=>str(p,"baseUnit")||"Piece";
 const units=[...new Set(products.map(unit))].map(u=>"<UNIT ACTION=\"Create\"><NAME>"+xml(u)+"</NAME><ISSIMPLEUNIT>Yes</ISSIMPLEUNIT><DECIMALPLACES>3</DECIMALPLACES></UNIT>");
 const stock=products.map(p=>'<STOCKITEM NAME="'+xml(str(p,"name"))+'" ACTION="Create"><NAME>'+xml(str(p,"name"))+'</NAME><BASEUNITS>'+xml(unit(p))+'</BASEUNITS></STOCKITEM>');
 const ledgers=parties.map(p=>'<LEDGER NAME="'+xml(str(p,"name"))+'" ACTION="Create"><NAME>'+xml(str(p,"name"))+'</NAME><PARENT>'+(str(p,"type").toLowerCase()==="supplier"?"Sundry Creditors":"Sundry Debtors")+'</PARENT><LEDGERPHONE>'+xml(str(p,"phone"))+'</LEDGERPHONE><PARTYGSTIN>'+xml(str(p,"gstin"))+'</PARTYGSTIN></LEDGER>');
 return '<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA>'+[...units,...stock,...ledgers].map(v=>'<TALLYMESSAGE>'+v+'</TALLYMESSAGE>').join("")+'</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>';
}
export function readTallyMasters(text:string):Master[]{
 if(text.length>5_000_000||/<!DOCTYPE/i.test(text))throw Error("Invalid XML file");
 const doc=new DOMParser().parseFromString(text,"application/xml");
 if(doc.querySelector("parsererror"))throw Error("Invalid XML file");
 const rows:Master[]=[];
 for(const p of Array.from(doc.getElementsByTagName("STOCKITEM"))){const name=p.getAttribute("NAME")||value(p,"NAME");if(name)rows.push({resource:"products",data:{name,baseUnit:value(p,"BASEUNITS")||"Piece",category:value(p,"PARENT"),salePrice:0,gstRate:0,piecesPerBox:1,sqftPerPiece:0}})}
 for(const p of Array.from(doc.getElementsByTagName("LEDGER"))){const parent=value(p,"PARENT"),name=p.getAttribute("NAME")||value(p,"NAME");if(name&&/sundry (debtors|creditors)/i.test(parent))rows.push({resource:"parties",data:{name,type:/creditor/i.test(parent)?"supplier":"customer",phone:value(p,"LEDGERPHONE"),gstin:value(p,"PARTYGSTIN"),address:value(p,"ADDRESS")}})}
 return rows;
}
export function readVcard(input:string):Master[]{
 const normalize=(s:string)=>s.replace(/\\n/gi," ").replace(/\\([,;\\])/g,"$1").trim();return input.replace(/\r?\n[ \t]/g,"").split(/BEGIN:VCARD/i).slice(1).flatMap(card=>{
 const name=card.match(/^FN(?:;[^:\r\n]*)?:(.+)$/im)?.[1],tel=card.match(/^TEL(?:;[^:\r\n]*)?:(.+)$/im)?.[1];
 return name?[{resource:"parties" as const,data:{name:normalize(name),phone:normalize(tel||"").replace(/^tel:/i,""),type:"customer"}}]:[];
 });
}

