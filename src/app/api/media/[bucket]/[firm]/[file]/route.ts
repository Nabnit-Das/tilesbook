import {z} from 'zod';import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {authClient,localRequest} from '@/server/identity';import {getSnapshot} from '@/server/store';
const paramsSchema=z.object({bucket:z.enum(['damage-photos','lot-photos','vein-match-photos','logos','purchase-bills']),firm:z.uuid(),file:z.string().regex(/^[a-f0-9-]{36}\.jpg$/)});
type Context={params:Promise<{bucket:string;firm:string;file:string}>};
const imageHeaders={'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function serve(req:Request,ctx:Context,write:boolean){
 try{const p=paramsSchema.parse(await ctx.params),book=await getSnapshot(p.firm);const actor=req.headers.get('X-TileBook-User');if(actor&&actor!==book.userId)return new Response(null,{status:403});if(book.business.id!==p.firm)throw Error('Permission denied');
 if(p.bucket==="purchase-bills"&&!["Owner","Manager",...(write?[]:["Accountant"])].includes(book.role))return new Response(null,{status:403});
 if(write&&(book.role==='Accountant'||(p.bucket==='logos'&&book.role!=='Owner')))return new Response(null,{status:403});
 const embedded=await localRequest();const object=p.firm+'/'+p.file;const folder=path.resolve(process.env.TILEBOOK_DATA_DIR||'.tilebook/data','../private-media',p.bucket,p.firm);const file=path.join(folder,p.file);
 if(write){
  if(req.headers.get('content-type')!=='image/jpeg'||Number(req.headers.get('content-length'))>1024*1024)return new Response(null,{status:415});
  const data=new Uint8Array(await req.arrayBuffer());if(data.length>1024*1024||data.length<4||data[0]!==255||data[1]!==216||data[2]!==255)return new Response(null,{status:415});
  if(embedded){await mkdir(folder,{recursive:true});await writeFile(file,data,{flag:'wx'});}
  else{const {error}=await (await authClient()).storage.from(p.bucket).upload(object,data,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
  return Response.json({url:new URL(req.url).pathname},{status:201});}
 if(embedded)return new Response(new Uint8Array(await readFile(file)),{headers:imageHeaders});
 const {data,error}=await (await authClient()).storage.from(p.bucket).download(object);if(error||!data)return new Response(null,{status:404});return new Response(data,{headers:imageHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'File unavailable'},{status:e instanceof z.ZodError?400:e instanceof Error&&/unauthorized|sign in/i.test(e.message)?401:404});}
}
export async function POST(req:Request,ctx:Context){return serve(req,ctx,true);}
export async function GET(req:Request,ctx:Context){return serve(req,ctx,false);}
