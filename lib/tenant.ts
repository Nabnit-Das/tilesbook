import {Prisma, type Membership} from '@prisma/client';
import {db} from './db';
import {invoiceTotals,mixedLots,stock,commission,type Line} from './domain';
import {type Data,type Kind} from './records';
type Actor=Pick<Membership,'businessId'|'role'|'userId'>;
const restricted=new Set(['purchase','po','debit','expense','paymentOut','bank','loan','cash','cheque','commission','partner','audit']);
export function canRead(role:Actor['role'],kind:string) {
  return !(['COUNTER','GODOWN'].includes(role) && restricted.has(kind));
}
export function canWrite(role:Actor['role'],kind:string) {
  if(role==='OWNER') return true;
  if(role==='MANAGER') return kind!=='setting';
  if(role==='COUNTER') return ['party','invoice','estimate','proforma','order','pos','paymentIn'].includes(kind);
  if(role==='GODOWN') return ['challan','damage','display','transfer','count'].includes(kind);
  return false;
}
export async function readRecords(actor:Actor,kind?:string) {
  const rows=await db.record.findMany({where:{businessId:actor.businessId,...(kind?{kind}:{})},orderBy:{createdAt:'desc'}});
  return rows.filter(row=>canRead(actor.role,row.kind)).map(row=>{
    if (!['COUNTER','GODOWN'].includes(actor.role) || !['product','movement','damage','credit','invoice','pos'].includes(row.kind)) return row;
    const safe={...(row.data as Data)};
    for(const key of ['cost','loss','accrued']) delete safe[key];
    return {...row,data:safe};
  });
}
export class RuleError extends Error {}
const valid=(value:unknown,message:string)=>{if(!value) throw new RuleError(message);};
const str=(data:Data,key:string)=>String(data[key]??'');
const num=(data:Data,key:string)=>Number(data[key]??0);
export async function createRecord(actor:Actor,kind:Kind,input:Data,key:string,state:string) {
  if(!canWrite(actor.role,kind)) throw new RuleError('Your role cannot create this record.');
  return db.$transaction(async tx=>{
    const existing=await tx.record.findMany({where:{businessId:actor.businessId}});
    const id=actor.businessId+'_'+key;
    const prior=existing.find(r=>r.id===id);
    if(prior){valid(prior.kind===kind,'Record key already used.');return prior;}
    const data={...input};
    const get=(id:string,kind:string)=>{
      const row=existing.find(x=>x.id===id && x.kind===kind);
      if(!row) throw new RuleError('The selected '+kind+' is unavailable.');
      return row.data as Data;
    };
    const movements=existing.filter(r=>r.kind==='movement').map(r=>r.data as {lotId:string;quantity:number;location?:string});
    const pending:{lotId:string;quantity:number;sourceId:string;action:Kind;location?:string}[]=[];
    const move=(lotId:string,quantity:number,location?:string)=>{
      valid(stock([...movements,...pending],lotId)+quantity>=0,'Insufficient physical stock.');
      pending.push({lotId,quantity,sourceId:id,action:kind,...(location?{location}:{})});
    };
    const orders=existing.filter(r=>r.kind==='order');
    const challans=existing.filter(r=>r.kind==='challan').map(r=>r.data as Data);
    const linesOf=(d:Data)=>(d.lines??[]) as Line[];
    const sent=(orderId:string,lotId:string)=>challans.filter(x=>x.orderId===orderId).flatMap(linesOf).filter(x=>x.lotId===lotId).reduce((s,x)=>s+x.qty,0);
    const reserved=(lotId:string,except='')=>orders.filter(x=>x.id!==except).reduce((s,x)=>s+Math.max(0,linesOf(x.data as Data).filter(l=>l.lotId===lotId).reduce((a,l)=>a+l.qty,0)-sent(x.id,lotId)),0);
    const partyId=str(data,'partyId');
    const party=partyId?get(partyId,'party'):null;
    const lotId=str(data,'lotId');
    const lot=lotId?get(lotId,'lot'):null;
    if(kind==='lot'){
      get(str(data,'productId'),'product');
      valid(!existing.some(r=>r.kind==='lot'&&(r.data as Data).productId===data.productId&&(r.data as Data).lot===data.lot),'This product already has that lot number.');
      if(data.supplierId) get(str(data,'supplierId'),'party');
      if(num(data,'quantity')) move(id,num(data,'quantity'));
      delete data.quantity;
    }
    if(['invoice','estimate','proforma','order','challan','pos'].includes(kind)){
      const lines:Line[]=(input.lines as {productId:string;lotId:string;qty:number;price:number;discount:number;room:string}[]).map(item=>{
        const product=get(item.productId,'product');
        const lot=get(item.lotId,'lot');
        valid(lot.productId===item.productId,'Lot does not belong to this product.');
        return {...item,description:str(product,'name'),hsn:str(product,'hsn'),lot:str(lot,'lot'),shade:str(lot,'shade'),unit:str(product,'unit'),sqft:item.qty*num(product,'area')*(product.unit==='Box'?num(product,'pack'):1),gst:num(product,'gst')};
      });
      valid(!mixedLots(lines)||(actor.role==='OWNER'&&data.override),'Mixed lots may differ in shade. An owner must supply an override reason.');
      const quantities=new Map<string,number>();
      lines.forEach(l=>quantities.set(l.lotId,(quantities.get(l.lotId)??0)+l.qty));
      const orderId=str(data,'orderId');
      const sourceChallanId=str(data,'sourceChallanId');
      if(sourceChallanId){
        valid(kind==='invoice','Only an invoice can be linked to a dispatched challan.');
        const source=get(sourceChallanId,'challan');
        valid(source.partyId===partyId,'Invoice party must match the challan.');
        valid(!existing.some(r=>r.kind==='invoice'&&(r.data as Data).sourceChallanId===sourceChallanId),'This challan already has an invoice.');
        const shipped=linesOf(source);
        valid(shipped.length===lines.length&&shipped.every((l,i)=>l.lotId===lines[i].lotId&&l.qty===lines[i].qty),'Invoice quantities must match the dispatched challan.');
        data.orderId=source.orderId;
      }
      if(kind==='challan'){
        const order=get(orderId,'order');
        valid(order.partyId===partyId,'Challan party must match the order.');
        for(const [batch,count] of quantities){
          const ordered=linesOf(order).filter(l=>l.lotId===batch).reduce((s,l)=>s+l.qty,0);
          valid(count<=ordered-sent(orderId,batch),'Quantity exceeds the remaining order balance.');
        }
      }
      for(const [batch,count] of quantities){
        if(['order','challan','invoice','pos'].includes(kind)&&!sourceChallanId){
          valid(count<=stock(movements,batch)-reserved(batch,kind==='challan'?orderId:''),'Insufficient unreserved stock for the selected lot.');
          if(kind!=='order'){
            let needed=count;
            const locations=new Set(movements.filter(m=>m.lotId===batch).map(m=>m.location??'main'));
            for(const location of locations){
              const onHand=stock(movements.filter(m=>(m.location??'main')===location),batch);
              const take=Math.min(needed,Math.max(onHand,0));
              if(take)move(batch,-take,location);
              needed-=take;
            }
          }
        }
      }
      const interstate=party?.state!==state;
      const totals=invoiceTotals(lines,interstate);
      valid(num(data,'received')<=totals.total,'Payment exceeds document total.');
      Object.assign(data,{lines,total:totals.total,interstate,partyName:party?.name,billTo:party?.address,shipTo:party?.shipping,gstin:party?.gstin,state:party?.state});
      if(data.partnerId){
        const partner=get(str(data,'partnerId'),'party');
        data.partnerName=partner.name;
        const rule=existing.find(r=>r.kind==='partner'&&(r.data as Data).partyId===data.partnerId)?.data as Data|undefined;
        if(rule && ['invoice','pos'].includes(kind)){
          data.commissionRate=num(rule,'rate');data.commissionPerBox=num(rule,'perBox');
          data.accrued=commission(totals.total,lines.filter(l=>l.unit==='Box').reduce((s,l)=>s+l.qty,0),num(rule,'rate'),num(rule,'perBox'));
        }
      }
    }
    if(kind==='credit'){
      const source=existing.find(r=>r.id===data.sourceId&&['invoice','pos'].includes(r.kind));
      if(!source) throw new RuleError('Select an original invoice.');
      const invoice=source.data as Data;
      const lines=linesOf(invoice).filter(l=>l.lotId===lotId);
      valid(lines.length,'This invoice did not use the selected lot.');
      const returned=existing.filter(r=>r.kind==='credit'&&(r.data as Data).sourceId===data.sourceId&&(r.data as Data).lotId===lotId).reduce((s,r)=>s+num(r.data as Data,'quantity'),0);
      valid(num(data,'quantity')+returned<=lines.reduce((s,l)=>s+l.qty,0),'Return exceeds the quantity sold.');
      let skip=returned;
      let take=num(data,'quantity');
      const returnedLines:Line[]=[];
      for(const item of lines){
        const offset=Math.min(skip,item.qty);skip-=offset;
        const quantity=Math.min(take,item.qty-offset);take-=quantity;
        if(quantity)returnedLines.push({...item,qty:quantity,sqft:item.sqft*quantity/item.qty,discount:Math.round(item.discount*(offset+quantity)/item.qty)-Math.round(item.discount*offset/item.qty)});
      }
      const total=invoiceTotals(returnedLines,Boolean(invoice.interstate)).total;
      Object.assign(data,{lines:returnedLines,total,interstate:invoice.interstate,partyId:invoice.partyId,partyName:invoice.partyName,partnerId:invoice.partnerId,accrued:-commission(total,returnedLines.filter(l=>l.unit==='Box').reduce((s,l)=>s+l.qty,0),num(invoice,'commissionRate'),num(invoice,'commissionPerBox'))});
      move(lotId,num(data,'quantity'));
    }
    if(kind==='transfer'||kind==='count'){
      const locationFor=(location:string)=>location.trim().toLowerCase();
      const source=locationFor(str(data,kind==='transfer'?'from':'location'));
      const book=stock(movements.filter(m=>(m.location??'main')===source),lotId);
      if(kind==='transfer'){
        const dest=locationFor(str(data,'to'));
        valid(source!==dest,'Choose two different locations.');
        valid(num(data,'quantity')<=book,'Insufficient stock at the source location.');
        move(lotId,-num(data,'quantity'),source);
        move(lotId,num(data,'quantity'),dest);
        data.from=source;data.to=dest;
      }else{
        data.location=source;data.system=book;data.difference=num(data,'counted')-book;
      }
    }
    if(kind==='purchase') move(lotId,num(data,'quantity'));
    if(['damage','display','debit'].includes(kind)){
      valid(num(data,'quantity')<=stock(movements,lotId)-reserved(lotId),'This quantity is reserved or unavailable.');
      let needed=num(data,'quantity');
      const locations=new Set(movements.filter(m=>m.lotId===lotId).map(m=>m.location??'main'));
      for(const location of locations){
        const book=stock(movements.filter(m=>(m.location??'main')===location),lotId);
        const take=Math.min(needed,Math.max(book,0));
        if(take)move(lotId,-take,location);
        needed-=take;
      }
    }
    if(lot) Object.assign(data,{lot:lot.lot,shade:lot.shade});
    if(kind==='damage'&&lot) data.loss=num(get(str(lot,'productId'),'product'),'cost')*num(data,'quantity');
    if(kind==='paymentIn'&&data.sourceId){
      const source=existing.find(r=>r.id===data.sourceId&&['invoice','pos'].includes(r.kind))?.data as Data|undefined;
      if(!source) throw new RuleError('Select an existing invoice.');
      valid(source.partyId===partyId,'Payment party must match the invoice.');
      const paid=existing.filter(r=>r.kind==='paymentIn'&&(r.data as Data).sourceId===data.sourceId).reduce((s,r)=>s+num(r.data as Data,'amount'),num(source,'received'));
      const credited=existing.filter(r=>r.kind==='credit'&&(r.data as Data).sourceId===data.sourceId).reduce((s,r)=>s+num(r.data as Data,'total'),0);
      valid(paid+num(data,'amount')<=num(source,'total')-credited,'Payment exceeds the open balance.');
    }
    if(party) data.partyName=party.name;
    const row=await tx.record.create({data:{id,businessId:actor.businessId,kind,data:JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue}});
    for(const movement of pending) await tx.record.create({data:{businessId:actor.businessId,kind:'movement',data:movement}});
    const setting=existing.find(r=>r.kind==='setting');
    if((setting?.data as Data|undefined)?.audit!==false) await tx.record.create({data:{businessId:actor.businessId,kind:'audit',data:{actor:actor.userId,target:id,action:'create',before:null,after:JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue}}});
    return row;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
