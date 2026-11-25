import {demoAllowed} from './auth-policy';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const ownerId = '00000000-0000-4000-8000-000000000001';
export const counterId = '00000000-0000-4000-8000-000000000002';
export const demoEnabled = () => process.env.TILEBOOK_LOCAL_DEMO === '1' && !process.env.VERCEL && !process.env.SUPABASE_PROJECT_REF;
export async function localRequest(){
  const h = await headers();
  return demoAllowed((process as NodeJS.Process & {tilebookLoopbackDemo?:boolean}).tilebookLoopbackDemo===true,demoEnabled(),h.get('host'),h.get('x-forwarded-host'),!!process.env.VERCEL);
}
const envSchema = z.object({url:z.string().url(),key:z.string().min(10)});
export async function authClient(){
  const env=envSchema.safeParse({url:(process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY});
  if(!env.success)throw new Error('Supabase configuration is missing. Run npm run setup or npm run demo.');
  const jar=await cookies();
  return createServerClient(env.data.url,env.data.key,{cookies:{getAll:()=>jar.getAll(),setAll(values){for(const v of values)jar.set(v.name,v.value,v.options);}}});
}
async function key(){
  const dir=path.resolve('.tilebook'); await mkdir(dir,{recursive:true});
  const file=path.join(dir,'session.key');
  try{await writeFile(file,randomBytes(48),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  return readFile(file);
}
export async function demoLogin(id:string){
  if(!await localRequest() || ![ownerId,counterId].includes(id))throw new Error('Local access required');
  const payload=id+'.'+(Date.now()+12*3600000);
  const sig=createHmac('sha256',await key()).update(payload).digest('hex');
  (await cookies()).set('tb_demo',payload+'.'+sig,{httpOnly:true,sameSite:'strict',path:'/',maxAge:43200});
}
export async function identity():Promise<{id:string;token?:string}>{
  if(await localRequest()){
    const parts=(await cookies()).get('tb_demo')?.value.split('.');
    if(parts?.length===3 && [ownerId,counterId].includes(parts[0]) && Number(parts[1])>Date.now()){
      const check=createHmac('sha256',await key()).update(parts.slice(0,2).join('.')).digest();
      const sig=Buffer.from(parts[2],'hex');
      if(sig.length===check.length && timingSafeEqual(sig,check))return {id:parts[0]};
    }
    throw new Error('Unauthorized');
  }
  const client=await authClient(); const {data,error}=await client.auth.getUser();
  if(error || !data.user)throw new Error('Unauthorized');
  const session=await client.auth.getSession();
  if(!session.data.session)throw new Error('Unauthorized');
  return {id:data.user.id,token:session.data.session.access_token};
}