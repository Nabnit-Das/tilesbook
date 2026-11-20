import {z} from 'zod';
import {session} from '@/lib/auth';
import {schemas,type Kind} from '@/lib/records';
import {readRecords,createRecord,RuleError} from '@/lib/tenant';
export async function GET(){
  const actor=await session();
  if(!actor)return Response.json({error:'Sign in first.'},{status:401});
  return Response.json(await readRecords(actor),{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
  const actor=await session();
  if(!actor)return Response.json({error:'Sign in first.'},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body||!Object.hasOwn(schemas,body.kind)||!z.uuid().safeParse(body.key).success)return Response.json({error:'Invalid record.'},{status:400});
  const kind=body.kind as Kind;
  const checked=schemas[kind].safeParse(body.data);
  if(!checked.success)return Response.json({error:checked.error.issues.map(i=>i.path.join('.')+': '+i.message).join(' · ')},{status:400});
  try{
    const saved=await createRecord(actor,kind,checked.data,body.key,actor.business.state);
    return Response.json({id:saved.id},{status:201});
  }catch(error){
    if(error instanceof RuleError)return Response.json({error:error.message},{status:422});
    if(typeof error==='object'&&error!==null&&'code' in error&&['P2034','P2002'].includes(String(error.code)))return Response.json({error:'Another transaction changed these records. Retry the save.'},{status:409});
    throw error;
  }
}