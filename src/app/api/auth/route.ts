import {cookies} from "next/headers";
import {z} from "zod";
import {authClient,identity,localRequest,demoLogin,ownerId,counterId} from "@/server/identity";
import {limited} from "@/server/auth-throttle";
const input=z.discriminatedUnion("action",[z.object({action:z.literal("email"),email:z.string().trim().toLowerCase().pipe(z.email().max(254)),password:z.string().min(1).max(256)}),z.object({action:z.literal("logout")}),z.object({action:z.literal("demo"),role:z.enum(["owner","counter"])})]);
const reply=(status=200,error?:string)=>Response.json(error?{error}:{ok:true},{status,headers:{"Cache-Control":"private,no-store"}});
export async function GET(){try{return Response.json({id:(await identity()).id},{headers:{"Cache-Control":"private,no-store"}});}catch{return reply(401,"authFailed");}}
export async function POST(req:Request){
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return reply(415,"authInvalid");
 try{const parsed=input.safeParse(await req.json());if(!parsed.success)return reply(400,"authInvalid");const v=parsed.data,demo=await localRequest();
 if(v.action==="demo"){if(!demo)return reply(403,"authFailed");await demoLogin(v.role==="owner"?ownerId:counterId);return reply();}
 if(v.action==="logout"){if(!demo&&(await (await authClient()).auth.signOut({scope:"local"})).error)return reply(503,"authFailed");(await cookies()).delete("tb_demo");return reply();}
 if(demo||limited(v.email))return reply(429,"authWait");
 const {error}=await (await authClient()).auth.signInWithPassword({email:v.email,password:v.password});return error?reply(401,"authFailed"):reply();
 }catch{return reply(400,"authFailed");}
}
