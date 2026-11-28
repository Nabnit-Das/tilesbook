import {beforeEach,afterEach,expect,it,vi} from "vitest";
const auth=vi.hoisted(()=>({signUp:vi.fn(),resend:vi.fn(),verifyOtp:vi.fn(),getUser:vi.fn(),updateUser:vi.fn(),signOut:vi.fn(),resetPasswordForEmail:vi.fn()}));
const settings=vi.hoisted(()=>vi.fn());
vi.mock("@/server/identity",()=>({authClient:async()=>({auth}),localRequest:async()=>false,identity:async()=>({id:"owner"})}));
vi.mock("@/server/email-config",()=>({requiresEmailProof:settings}));
const jar=vi.hoisted(()=>new Map<string,string>());
vi.mock("next/headers",()=>({cookies:async()=>({get:(k:string)=>({value:jar.get(k)}),set:(k:string,v:string)=>jar.set(k,v),delete:({name}:{name:string})=>jar.delete(name)})}));
import {POST} from "../src/app/api/customer/route";
const email="owner@example.test", password="private-test-123",code="584319";
const start={action:"start",email,firstName:"Ravi",lastName:"Das",company:"Marbles",category:"mixed"};
const pass={action:"setPassword",password,confirm:password,terms:true,privacy:true};
const post=(data:object)=>POST(new Request("http://localhost/api/customer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}));
beforeEach(()=>{vi.resetAllMocks();settings.mockResolvedValue(true);for(const f of Object.values(auth))f.mockResolvedValue({error:null});jar.clear();});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
it("requires email confirmation, even if the client supplies a verification flag",async()=>{settings.mockResolvedValue(false);expect((await post({...start,email_confirmed_at:"now"})).status).toBe(503);expect(auth.signUp).not.toHaveBeenCalled();});
it("starts signup with unique unexposed credentials and display data only",async()=>{for(let i=0;i<2;i++)expect(await (await post({...start,password,role:"Owner"})).json()).toEqual({ok:true});const [a,b]=auth.signUp.mock.calls.map(c=>c[0]);expect(a.password).not.toBe(b.password);expect(a.password).not.toBe(password);expect(a.options.data).toEqual({full_name:"Ravi Das",company:"Marbles",category:"mixed"});});
it("requires the matching verified email and the signup purpose",async()=>{auth.verifyOtp.mockResolvedValue({data:{user:{email:"different@example.test",email_confirmed_at:"now"}}});expect((await post({action:"emailProof",email,code})).status).toBe(403);expect(auth.verifyOtp).toHaveBeenCalledWith({email,token:code,type:"signup"});});
it("resends signup through GoTrue and surfaces rate limits and expired codes",async()=>{auth.resend.mockResolvedValue({error:{status:429}});expect((await post({action:"resend",email})).status).toBe(429);expect(auth.resend).toHaveBeenCalledWith({type:"signup",email});auth.verifyOtp.mockResolvedValue({error:{code:"otp_expired"}});expect(await (await post({action:"emailProof",email,code})).json()).toEqual({error:"codeExpired"});});
it("restricts development sends to the authorized address",async()=>{vi.stubEnv("TILEBOOK_LOCAL_EMAIL_RECIPIENT","other@example.test");expect((await post(start)).status).toBe(400);expect(auth.signUp).not.toHaveBeenCalled();});
it("rejects client verification claims and requires both consents",async()=>{auth.getUser.mockResolvedValue({data:{user:{user_metadata:{email_confirmed_at:"now"}}}});expect((await post(pass)).status).toBe(403);auth.getUser.mockResolvedValue({data:{user:{email_confirmed_at:"now",app_metadata:{tilebook_password_pending:true}}}});expect((await post({...pass,terms:false})).status).toBe(400);expect((await post({...pass,privacy:false})).status).toBe(400);expect((await post(pass)).ok).toBe(true);});
it("surfaces delivery failures while keeping unknown recovery addresses private",async()=>{auth.resetPasswordForEmail.mockResolvedValueOnce({error:{status:500}}).mockResolvedValueOnce({error:{code:"user_not_found"}});expect((await post({action:"recoverEmail",email})).status).toBe(503);expect(await (await post({action:"recoverEmail",email})).json()).toEqual({ok:true});});
it.each([false,true])("requires a fresh single-use recovery code (expired=%s)",async expired=>{vi.useFakeTimers();const reset={...pass,action:"resetPassword"};expect((await post(reset)).status).toBe(403);auth.verifyOtp.mockResolvedValue({data:{user:{id:"owner",email,email_confirmed_at:"now",app_metadata:{}}}});expect((await post({action:"checkRecoveryEmail",email,code})).ok).toBe(true);expect(auth.verifyOtp).toHaveBeenCalledWith({email,token:code,type:"recovery"});if(expired)vi.advanceTimersByTime(300001);expect((await post(reset)).status).toBe(expired?403:200);if(!expired)expect(auth.signOut).toHaveBeenCalledWith({scope:"global"});expect((await post(reset)).status).toBe(403);});
it("rejects retired mobile customer actions",async()=>{for(const action of ["mobileLogin","phoneProof","recoverPhone","checkRecoveryPhone"])expect((await post({action,phone:"9000000091",code})).status).toBe(400);});

it("resumes interrupted password setup only after a matching recovery proof",async()=>{
 auth.verifyOtp.mockResolvedValue({data:{user:{id:"owner",email,email_confirmed_at:"now",app_metadata:{tilebook_password_pending:true}}}});
 expect(await (await post({action:"checkRecoveryEmail",email,code})).json()).toEqual({ok:true,next:"setPassword"});
 expect((await post({...pass,action:"resetPassword"})).status).toBe(403);
});
