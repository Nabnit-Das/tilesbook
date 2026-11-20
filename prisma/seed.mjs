import {loadEnvFile} from 'node:process';
import {PrismaClient} from '@prisma/client';
import {invoiceTotals} from '../lib/domain.ts';
try{loadEnvFile()}catch(error){if(error.code!=='ENOENT')throw error;}
const db=new PrismaClient();
const businessId='tilebook_demo';
const day=(offset=0)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const phoneUsers=[['9999999999','Demo Owner','OWNER'],['9999999998','Demo Counter','COUNTER']];
const data=[];
const add=(kind,key,row)=>{const id=businessId+'_'+key;data.push({id,businessId,kind,data:row});return id};
const names=['Sai Builders','Das Homes','Ramesh Mishra','Patel Contractors','Kajaria Distribution','Nabnit Das','Aditi Mohanty','Triveni Ceramics','Bikash Sahu','Anil Behera','Ananya Das','Rupali Designs','Kapil Mohanty','Prakash Infra','Kalinga Sanitary','Maa Tarini Traders','Anup Sethi','Riya Patnaik','Lingaraj Homes','Coastal Projects'];
const types=['Builder','Customer','Mason','Contractor','Supplier','Supplier','Architect','Supplier','Mason','Mason','Architect','Customer','Contractor','Builder','Supplier','Supplier','Customer','Customer','Builder','Customer'];
const parties=names.map((name,i)=>add('party','party'+i,{name,type:types[i],phone:'98765432'+String(10+i),state:'21',gstin:i===0?'21AAAAA0000A1Z5':'',address:i===0?'Patia, Bhubaneswar':'Bhubaneswar, Odisha',shipping:i===0?'Site, Chandaka Road':'Bhubaneswar, Odisha'}));
const productNames=['2x2 Glossy White Vitrified','Tile Adhesive 20 kg','2x4 Satin Wall Tile','Beige Marble Slab','Raw Granite Block','Ivory Kitchen Tile','Oak Plank Tile','Stone Grey Floor Tile','Onyx White Tile','Mint Ceramic Wall Tile','Compact Basin','Dual Flush WC','Wall-hung Basin','Matte Black Tap','Floor Drain','White Grout 5 kg','Cobble Outdoor Paver','Terracotta Step Tile','Carrara Polished Slab','Rosa Pink Granite','Walnut Porcelain Tile','Blue Subway Tile','Teal Mosaic Sheet','Chrome Shower Mixer','Countertop Basin'];
const items=productNames.map((name,i)=>({name,hsn:i===1?'3214':i===3||i===4?'2515':'6907',gst:i===4?5:18,unit:i===1?'Bag':i===3?'Slab':i===4||i>=10?'Piece':'Box',area:i===1?1:4,pack:i===1||i===3||i>=10?1:4,price:i===0?319600:i===1?52000:120000+i*15000,cost:i===0?266000:i===1?41500:90000+i*8000,low:20,barcode:String(8906000100000+i),category:i===1?'Adhesive':i===3||i===4?'Marble & granite':'Tiles',size:i===0?'600 × 600 mm':'',finish:i===0?'Glossy':'',brand:'',design:''}));
const products=items.map((item,i)=>add('product','product'+i,item));
const lotDefs=Array.from({length:12},(_,i)=>({product:i===2?0:i===3?2:i===4?0:i>4?i-1:i,lot:i===0?'2531':i===1?'AD-24':i===4?'2416':String(2532+i),shade:i===0?'A3':i===4?'B2':i===2?'A4':'Standard',opening:i===4?40:i===0?1200:350}));
const lots=lotDefs.map((lot,i)=>add('lot','lot'+i,{productId:products[lot.product],lot:lot.lot,shade:lot.shade,date:day(i===4?-210:-50),lastSold:i===4?day(-202):'',supplierId:parties[4]}));
const move=(key,lotIndex,quantity,sourceId,action)=>add('movement',key,{lotId:lots[lotIndex],quantity,sourceId,action});
lotDefs.forEach((lot,i)=>move('opening'+i,i,lot.opening,lots[i],'lot'));
const line=(i,qty)=>{const lot=lotDefs[i],p=items[lot.product];return {productId:products[lot.product],description:p.name,hsn:p.hsn,lotId:lots[i],lot:lot.lot,shade:lot.shade,room:'',qty,unit:p.unit,sqft:qty*p.area*p.pack,price:p.price,discount:0,gst:p.gst};};
const documents=(kind,key,partyIndex,reference,date,lines,more={})=>add(kind,key,{partyId:parties[partyIndex],partyName:names[partyIndex],billTo:partyIndex===0?'Patia, Bhubaneswar':'Bhubaneswar, Odisha',shipTo:partyIndex===0?'Site, Chandaka Road':'Bhubaneswar, Odisha',gstin:partyIndex===0?'21AAAAA0000A1Z5':'',date,reference,lines,state:'21',interstate:false,total:invoiceTotals(lines).total,received:0,...more});
for(let i=0;i<29;i++){
 const index=[0,1,3,5,6,7,8,9,10,11][i%10],qty=2+(i%13),party=i%names.length;
 const invoice=documents('invoice','invoice'+i,party,'INV-'+(84+i),day(-Math.floor((29-i)/1.4)),[line(index,qty)],{received:i%3===0?0:invoiceTotals([line(index,qty)]).total,...(i%5===0?{partnerId:parties[2],partnerName:names[2],commissionRate:2,commissionPerBox:0,accrued:Math.round(invoiceTotals([line(index,qty)]).total*.02)}:{})});
 move('sold'+i,index,-qty,invoice,'invoice');
}
const sample=documents('invoice','invoice113',0,'INV-113','2026-11-19',[line(0,23),line(1,6)],{received:5000000,dueDate:'2026-11-30',partnerId:parties[2],partnerName:names[2],commissionRate:2,commissionPerBox:0,accrued:180842,vehicle:'OD02 AB 1234'});
move('sample0',0,-23,sample,'invoice');move('sample1',1,-6,sample,'invoice');
for(let i=0;i<5;i++){
 const qty=i===0?200:12+i*6;
 const order=documents('order','order'+i,1,'SO-'+(i+1),day(-8-i),[line(0,qty)],{received:1250000,dueDate:day(7)});
 if(i===0)for(const [phase,count] of [[0,60],[1,80]]){const challan=documents('challan','challan'+phase,1,'DC-'+(phase+1),day(-5+phase),[line(0,count)],{orderId:order});move('dispatch'+phase,0,-count,challan,'challan');}
}
for(let i=0;i<3;i++){const index=[0,1,3][i];const saleIndex=[0,1,2][i];const credit=documents('credit','credit'+i,saleIndex,'CN-'+(i+1),day(-3+i),[line(index,1)],{sourceId:businessId+'_invoice'+saleIndex,lotId:lots[index],lot:lotDefs[index].lot,shade:lotDefs[index].shade,quantity:1});move('return'+i,index,1,credit,'credit');}
for(let i=0;i<6;i++){const damage=add('damage','damage'+i,{date:day(-i*2),lotId:lots[0],lot:'2531',shade:'A3',quantity:2+i,name:'Raju Sahu',reason:['Delivery','Godown handling','Factory transit','Showroom'][i%4],loss:items[0].cost*(2+i)});move('breakage'+i,0,-(2+i),damage,'damage');}
const samples=add('display','display0',{date:day(-3),lotId:lots[0],lot:'2531',shade:'A3',quantity:2,name:'Showroom wall'});move('samples',0,-2,samples,'display');
documents('estimate','estimate1',1,'Q-21',day(-2),[{...line(0,23),room:'Living room'},{...line(1,6),room:'Bathroom'}]);
documents('proforma','proforma1',3,'PF-05',day(-1),[line(3,12)]);
const purchase=add('purchase','purchase1',{partyId:parties[4],partyName:names[4],lotId:lots[0],lot:'2531',shade:'A3',quantity:40,cost:266000,landed:840000,date:day(-7),reference:'PB-06'});move('purchase-lot0',0,40,purchase,'purchase');
add('po','po1',{partyId:parties[4],partyName:names[4],lotId:lots[3],lot:lotDefs[3].lot,shade:lotDefs[3].shade,quantity:15,cost:items[2].cost,landed:0,date:day(-3),reference:'PO-09'});
add('expense','expense1',{name:'Warehouse rent',category:'Rent',amount:2500000,date:day(-7),note:''});
add('bank','bank1',{name:'State Bank of India',account:'1234567890',ifsc:'SBIN0001234',upi:'demomarbles@sbi',amount:48200000,date:day()});
add('bank','bank2',{name:'HDFC Savings',account:'0987654321',ifsc:'HDFC0001234',upi:'',amount:7600000,date:day()});
add('cheque','cheque1',{name:'Sai Builders',reference:'000555',date:day(10),amount:4000000,status:'Open'});
add('loan','loan1',{name:'HDFC Business',amount:80000000,rate:11,months:36,date:day(15)});
add('partner','partner1',{partyId:parties[2],partyName:names[2],rate:2,perBox:0,date:day(-35)});
add('commission','commission1',{partyId:parties[2],partyName:names[2],amount:30000,reference:'CP-01',date:day(-5)});
add('slab','slab1',{name:'M14-01',length:9,width:5.5,status:'Available',date:day(-18)});
add('slab','slab2',{name:'M14-R1',length:2.1,width:1.4,status:'Remnant',date:day(-17)});
add('service','service1',{name:'Tile installation',hsn:'9954',price:50000,gst:18});
add('category','category1',{name:'Vitrified tile',note:'Indoor flooring'});
add('setting','setting1',{mode:'Simple',language:'en',accent:'#0fa3a3',threshold:180,upi:'demomarbles@sbi',terms:'Shade can differ between lots. Report breakage at delivery. Returns must be unopened and from the same lot.',audit:true,phone:'9437179877'});
try{
 await db.business.upsert({where:{id:businessId},update:{},create:{id:businessId,name:'Demo Marbles & Tiles',state:'21'}});
 for(const [phone,name,role] of phoneUsers){
  const user=await db.user.upsert({where:{phone},update:{},create:{phone,name}});
  await db.membership.upsert({where:{businessId_userId:{businessId,userId:user.id}},update:{role},create:{businessId,userId:user.id,role}});
 }
 await db.record.createMany({data,skipDuplicates:true});
 const second=await db.business.upsert({where:{id:'tilebook_second'},update:{},create:{id:'tilebook_second',name:'Coastal Sample Tiles',state:'21'}});
 const secondOwner=await db.user.upsert({where:{phone:'9999999997'},update:{},create:{phone:'9999999997',name:'Second Demo Owner'}});
 await db.membership.upsert({where:{businessId_userId:{businessId:second.id,userId:secondOwner.id}},update:{},create:{businessId:second.id,userId:secondOwner.id,role:'OWNER'}});
 await db.record.upsert({where:{id:'tilebook_second_party'},update:{},create:{id:'tilebook_second_party',businessId:second.id,kind:'party',data:{name:'Coastal Tenant Private Party',state:'21',type:'Customer'}}});

 console.log('Demo firms and records ready.');
}finally{await db.$disconnect();}
