import {randomBytes,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
const state=globalThis as typeof globalThis & {tilebookRecovery?:Map<string,{user:string;until:number}>};
const proofs=state.tilebookRecovery??=new Map();
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function issueRecovery(user:string){
 const jar=await cookies(),secret=randomBytes(32).toString('hex');
 for(const [k,v] of proofs)if(v.until<Date.now())proofs.delete(k);
 if(proofs.size>=4096)throw Error('Try again later');
 proofs.set(hash(secret),{user,until:Date.now()+300000});
 jar.set('tb-recovery',secret,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:'strict',maxAge:300,path:'/api/customer'});
}
export async function consumeRecovery(user:string){
 const jar=await cookies(),key=hash(jar.get('tb-recovery')?.value||''),proof=proofs.get(key);
 proofs.delete(key);jar.delete({name:'tb-recovery',path:'/api/customer'});
 return !!proof&&proof.user===user&&proof.until>Date.now();
}
