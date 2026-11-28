import http from "node:http";
import next from "next";
import {readFileSync} from "node:fs";
import {parseEnv} from "node:util";
const hostname="127.0.0.1";
if(process.env.NODE_ENV==="production" || process.env.VERCEL || process.env.SUPABASE_PROJECT_REF)throw Error("Local development only");
const local=parseEnv(readFileSync(".env.local","utf8"));
const endpoint=process.env.SUPABASE_INTERNAL_URL||local.SUPABASE_INTERNAL_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||local.NEXT_PUBLIC_SUPABASE_URL;
if(!/^http:\/\/(localhost|127\.0\.0\.1):54321\/?$/.test(endpoint||""))throw Error("A loopback Supabase URL is required.");
if(process.argv.includes("--resend")){
 const recipient=parseEnv(readFileSync(".env.providers.local","utf8")).AUTHORIZED_TEST_EMAIL;
 if(!recipient?.includes("@"))throw Error("Set AUTHORIZED_TEST_EMAIL before starting.");
 process.env.TILEBOOK_LOCAL_EMAIL_RECIPIENT=recipient.trim().toLowerCase();
}
process.env.NODE_ENV="development";
process.env.TILEBOOK_LOCAL_DEMO="0";
const port=Number(process.env.PORT||3000);
const app=next({dev:true,hostname,port,webpack:true});
await app.prepare();
const handle=app.getRequestHandler();
http.createServer((req,res)=>{
 if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.headers.host||"")||req.headers["x-forwarded-host"]||req.headers.forwarded){res.writeHead(403);res.end();return;}
 return handle(req,res);
}).listen(port,hostname,()=>console.log("TileBook local authentication: http://"+hostname+":"+port));
