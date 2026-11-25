import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
export async function proxy(request:NextRequest){
 const origin=request.headers.get('origin');
 if(!['GET','HEAD','OPTIONS'].includes(request.method) && origin && new URL(origin).host!==request.nextUrl.host && new URL(origin).host!==request.headers.get('host'))return NextResponse.json({error:'Invalid request origin'},{status:403});
 let response=NextResponse.next({request});
 const url=(process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(url && key && !(process as NodeJS.Process & {tilebookLoopbackDemo?:boolean}).tilebookLoopbackDemo){
 const client=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){for(const v of values)request.cookies.set(v.name,v.value);response=NextResponse.next({request});for(const v of values)response.cookies.set(v.name,v.value,v.options);}}});
 await client.auth.getUser();
 }
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|icon|sw.js|manifest.webmanifest).*)']};