import {z} from 'zod';
const text=z.string().trim().max(240);
const name=text.min(1);
const optional=text.default('');
const amount=z.number().int().nonnegative().max(100000000000);
const qty=z.number().int().positive().max(1000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const line=z.object({productId:name,lotId:name,qty,price:amount,discount:amount.default(0),room:optional});
const sale=z.object({partyId:name,date,reference:name,lines:z.array(line).min(1).max(80),note:optional,received:amount.default(0),override:optional,partnerId:optional,dueDate:optional,orderId:optional,sourceChallanId:optional});
const photo=z.string().max(1400000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).optional();
export const schemas={
 transfer:z.object({lotId:name,quantity:qty,from:name,to:name,date,note:optional}),
 count:z.object({lotId:name,location:name,counted:amount,date,note:optional}),
party:z.object({name,type:z.enum(['Customer','Supplier','Mason','Contractor','Architect','Builder']),phone:optional,gstin:optional,address:optional,shipping:optional,state:text.regex(/^\d{2}$/).default('21')}),
product:z.object({name,category:optional,brand:optional,design:optional,size:optional,finish:optional,hsn:name,gst:z.number().min(0).max(100),unit:name,area:z.number().positive(),pack:qty,price:amount,cost:amount,low:amount,barcode:optional}),
lot:z.object({productId:name,lot:name,shade:name,date,quantity:amount,supplierId:optional,photo}),
invoice:sale,estimate:sale,proforma:sale,order:sale,challan:sale,pos:sale,
credit:z.object({sourceId:name,lotId:name,quantity:qty,date,reference:name,note:optional}),
purchase:z.object({partyId:name,lotId:name,quantity:qty,cost:amount,landed:amount,date,reference:name}),
po:z.object({partyId:name,lotId:name,quantity:qty,cost:amount,landed:amount,date,reference:name}),
debit:z.object({partyId:name,lotId:name,quantity:qty,cost:amount,date,reference:name,note:optional}),
paymentIn:z.object({partyId:name,sourceId:optional,amount:amount.positive(),mode:name,date,reference:name}),
paymentOut:z.object({partyId:name,amount:amount.positive(),mode:name,date,reference:name}),
expense:z.object({name,category:name,amount:amount.positive(),date,note:optional}),
bank:z.object({name,account:name,ifsc:optional,upi:optional,amount,date}),
cheque:z.object({name,reference:name,amount,date,status:z.enum(['Open','Deposited','Bounced','Withdrawn'])}),
loan:z.object({name,amount,rate:z.number().min(0).max(100),months:qty,date}),
cash:z.object({name,amount,date,direction:z.enum(['In','Out'])}),
damage:z.object({lotId:name,quantity:qty,reason:z.enum(['Factory transit','Godown handling','Delivery','Showroom']),name,date,note:optional,photo}),
display:z.object({lotId:name,quantity:qty,name,date,note:optional}),
slab:z.object({name,length:z.number().positive(),width:z.number().positive(),status:z.enum(['Available','Reserved','Remnant']),partyId:optional,date,note:optional,photo}),
partner:z.object({partyId:name,rate:z.number().min(0).max(100),perBox:amount,date}),
commission:z.object({partyId:name,amount:amount.positive(),date,reference:name}),
followup:z.object({partyId:name,name,date,note:optional}),
offer:z.object({lotId:name,name,rate:z.number().min(0).max(100),date,note:optional}),
campaign:z.object({name,date,note:optional}),
service:z.object({name,hsn:name,price:amount,gst:z.number().min(0).max(100)}),
category:z.object({name,note:optional}),
setting:z.object({mode:z.enum(['Simple','Pro']),language:z.enum(['en','hi','or']),accent:text.regex(/^#[a-fA-F0-9]{6}$/),terms:text,upi:optional,threshold:qty,audit:z.boolean(),phone:optional}),
};
export type Kind=keyof typeof schemas;
export type Data=Record<string,unknown>;
export type Row={id:string;kind:string;data:Data;createdAt:string};
