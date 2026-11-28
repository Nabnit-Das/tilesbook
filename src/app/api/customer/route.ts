import {randomBytes} from "node:crypto";
import {customerInput} from "@/server/customer-input";
import {limited} from "@/server/auth-throttle";
import {authClient,identity,localRequest} from "@/server/identity";
import {requiresEmailProof} from "@/server/email-config";
import {consumeRecovery,issueRecovery} from "@/server/recovery-proof";
const reply=(status=200,error?:string)=>Response.json(error?{error}:{ok:true},{status,headers:{"Cache-Control":"private,no-store"}});
function failure(e:{status?:number;code?:string}){
 if(e.status===429)return reply(429,"authWait");
 if((e.status||0)>=500 || e.code==="email_address_not_authorized")return reply(503,"deliveryUnavailable");
 return reply(400,e.code==="otp_expired"?"codeExpired":"authFailed");
}
export async function POST(req:Request){
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return reply(415,"authInvalid");
 try{
 if(await localRequest())return reply(403,"authFailed");
 const parsed=customerInput.safeParse(await req.json());if(!parsed.success)return reply(400,"authInvalid");
 const v=parsed.data,auth=(await authClient()).auth;
 if("email" in v && limited(v.email))return reply(429,"authWait");
 if(v.action==="start"||v.action==="linkEmail"||v.action==="resend"||v.action==="recoverEmail"){
   const allowed=process.env.TILEBOOK_LOCAL_EMAIL_RECIPIENT;
   if(allowed && allowed!==v.email)return reply(400,"testRecipientOnly");
   if(!await requiresEmailProof())return reply(503,"verificationUnavailable");
 }
 switch(v.action){
 case "start":{
   // GoTrue requires a password for signup. This individual random value is never returned or retained by TileBook.
   const {error}=await auth.signUp({email:v.email,password:randomBytes(48).toString("base64url"),options:{data:{full_name:v.firstName+" "+v.lastName,company:v.company,category:v.category}}});
   return error&&error.code!=="user_already_exists"?failure(error):reply();
 }
 case "linkEmail":case "verifyLink":{
   const {data:{user}}=await auth.getUser();if(!user||user.email_confirmed_at)return reply(403,"authFailed");
   if(v.action==="linkEmail"){const {error}=await auth.updateUser({email:v.email});return error?failure(error):reply();}
   const {data,error}=await auth.verifyOtp({email:v.email,token:v.code,type:"email_change"});if(error)return failure(error);
   if(data.user?.id!==user.id||!data.user.email_confirmed_at||data.user.email?.toLowerCase()!==v.email){await auth.signOut({scope:"local"});return reply(403,"authFailed");}
   await issueRecovery(user.id);return reply();
 }
 case "resend":{const {error}=await auth.resend({type:"signup",email:v.email});return error?failure(error):reply();}
 case "recoverEmail":{const {error}=await auth.resetPasswordForEmail(v.email);return error&&error.code!=="user_not_found"?failure(error):reply();}
 case "emailProof":case "checkRecoveryEmail":{
   const {data,error}=await auth.verifyOtp({email:v.email,token:v.code,type:v.action==="emailProof"?"signup":"recovery"});
   if(error)return failure(error);
   if(!data.user?.email_confirmed_at||data.user.email?.toLowerCase()!==v.email){await auth.signOut({scope:"local"});return reply(403,"authFailed");}
   if(v.action==="checkRecoveryEmail"){
     if(data.user.app_metadata.tilebook_password_pending)return Response.json({ok:true,next:"setPassword"},{headers:{"Cache-Control":"private,no-store"}});
     await issueRecovery(data.user.id);
   }
   return reply();
 }
 case "setPassword":{
   const {data:{user}}=await auth.getUser();
   if(!user?.email_confirmed_at||user.app_metadata.tilebook_password_pending!==true)return reply(403,"authFailed");
   const {error}=await auth.updateUser({password:v.password,data:{terms_version:"1",privacy_version:"1"}});return error?failure(error):reply();
 }
 case "resetPassword":{
   if(!await consumeRecovery((await identity()).id))return reply(403,"codeExpired");
   const {error}=await auth.updateUser({password:v.password});if(error)return failure(error);
   return (await auth.signOut({scope:"global"})).error?reply(503,"authFailed"):reply();
 }
 }
 }catch{return reply(503,"authFailed");}
}
