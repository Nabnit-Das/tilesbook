import {cpSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {parseEnv} from "node:util";
import path from "node:path";

// Windows operator command. Keep Docker inspection data and CLI status banners private.
const args=new Set(process.argv.slice(2));
if([...args].some(v=>!["--apply","--check","--mailpit"].includes(v)))throw Error("Unknown option");
const resend=!args.has("--mailpit");
const values=resend?parseEnv(readFileSync(".env.providers.local","utf8")):{};
if(resend&&(!/^re_\S+$/.test(values.RESEND_API_KEY||"")||![values.RESEND_FROM_EMAIL,values.AUTHORIZED_TEST_EMAIL].every(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||""))))throw Error("Check RESEND_API_KEY, RESEND_FROM_EMAIL and AUTHORIZED_TEST_EMAIL in .env.providers.local.");
const workdir=path.resolve(".tilebook",resend?"email-resend":"email-mailpit"),target=path.join(workdir,"supabase");
mkdirSync(target,{recursive:true});for(const f of ["templates","migrations"])cpSync("supabase/"+f,path.join(target,f),{recursive:true});
let config=readFileSync("supabase/config.toml","utf8").replaceAll("\r\n","\n").replace('[db.seed]\nenabled = true','[db.seed]\nenabled = false').replace('sql_paths = ["./seed.sql"]','sql_paths = []');
if(resend)config+=`
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "env(RESEND_FROM_EMAIL)"
sender_name = "TileBook"
`;
writeFileSync(path.join(target,"config.toml"),config);
console.log("Prepared email-only profile for "+(resend?"Resend":"Mailpit")+".");
function docker(...args){return spawnSync("docker",args,{encoding:"utf8",timeout:15000,windowsHide:true});}
function active(){
 const result=docker("inspect","--format","{{json .Config.Env}}","supabase_auth_tilebook");
 if(result.status!==0)return false;
 const pairs=JSON.parse(result.stdout).map(v=>[v.slice(0,v.indexOf("=")),v.slice(v.indexOf("=")+1)]);
 const env=Object.fromEntries(pairs);
 const mail=resend?env.GOTRUE_SMTP_HOST==="smtp.resend.com"&&env.GOTRUE_SMTP_PORT==="465"&&env.GOTRUE_SMTP_PASS===values.RESEND_API_KEY&&env.GOTRUE_SMTP_ADMIN_EMAIL===values.RESEND_FROM_EMAIL:/mailpit|inbucket/i.test(env.GOTRUE_SMTP_HOST||"");
 console.log("Active SMTP profile match:",mail,"Email confirmation required:",env.GOTRUE_MAILER_AUTOCONFIRM==="false","Phone disabled:",env.GOTRUE_EXTERNAL_PHONE_ENABLED!=="true");
 return mail&&env.GOTRUE_MAILER_AUTOCONFIRM==="false"&&env.GOTRUE_EXTERNAL_PHONE_ENABLED!=="true"&&!!env.GOTRUE_MAILER_TEMPLATES_CONFIRMATION&&!!env.GOTRUE_MAILER_TEMPLATES_RECOVERY;
}
function cli(...args){const env={...process.env};if(resend){env.RESEND_API_KEY=values.RESEND_API_KEY;env.RESEND_FROM_EMAIL=values.RESEND_FROM_EMAIL;}
 if(spawnSync(process.execPath,["node_modules/supabase/dist/supabase.js",...args,"--workdir",workdir],{env,stdio:"ignore",windowsHide:true}).status!==0)throw Error("Local Supabase "+args[0]+" failed. Check Docker and local port bindings.");}
if(args.has("--check")||args.has("--apply")){
 if(docker("info","--format","{{.ServerVersion}}").status!==0)throw Error("Run in Windows PowerShell with access to Docker Desktop.");
 if(docker("volume","inspect","--format","{{.Name}}","supabase_db_tilebook").status!==0)throw Error("Existing TileBook DB volume was not found; verify your Docker context.");
 if(!active()){
   if(!args.has("--apply"))throw Error("Running Auth configuration differs. Use --apply to reload it.");
   // Supabase stop retains named volumes. Never use --no-backup or db reset.
   cli("stop");cli("start");
   if(!active())throw Error("The running Auth container did not load the email profile. Delivery is unverified.");
 }
 if(args.has("--apply"))cli("migration","up","--local");
 console.log("Active email profile verified.");
}
