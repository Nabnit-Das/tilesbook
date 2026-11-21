import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {authClient,counterId,demoLogin,localRequest,ownerId,identity} from '@/server/identity';
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('send'),phone:z.string().regex(/^\d{10}$/)}),
 z.object({action:z.literal('verify'),phone:z.string().regex(/^\d{10}$/),otp:z.string().regex(/^\d{6}$/)}),
 z.object({action:z.literal('email'),email:z.string().email(),password:z.string().min(8)}),
 z.object({action:z.literal('logout')})
]);
export async function GET(){try{const user=await identity();return NextResponse.json({id:user.id});}catch{return NextResponse.json({error:'Unauthorized'},{status:401});}}
export async function POST(req:Request){
 try{
 const data=input.parse(await req.json());const demo=await localRequest();
 if(data.action==='logout'){(await cookies()).delete('tb_demo');if(!demo){const client=await authClient();await client.auth.signOut();}return NextResponse.json({ok:true});}
 if(data.action==='email'){if(process.env.ENABLE_DEV_EMAIL_AUTH!=='1')return NextResponse.json({error:'Email sign-in disabled'},{status:403});
 const {error}=await (await authClient()).auth.signInWithPassword(data);if(error)throw error;}
 else if(demo){if(!['9999999999','9999999998'].includes(data.phone))throw new Error('Use a configured demo phone number');
 if(data.action==='verify'){if(data.otp!=='123456')throw new Error('Incorrect verification code');await demoLogin(data.phone==='9999999999'?ownerId:counterId);}}
 else{const client=await authClient();const phone='+91'+data.phone;const result=data.action==='send'?await client.auth.signInWithOtp({phone,options:{shouldCreateUser:true}}):await client.auth.verifyOtp({phone,token:data.otp,type:'sms'});if(result.error)throw result.error;}
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?'Check your phone number and code':e instanceof Error?e.message:'Unable to sign in'},{status:400});}
}