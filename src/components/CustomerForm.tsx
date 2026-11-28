"use client";
import {useEffect,useState} from "react";
import {useTranslations} from "next-intl";
import {Eye,EyeOff} from "lucide-react";
import {clearLocalBooks} from "@/lib/offline";
export type Step="linkEmail"|"linkCode"|"login"|"details"|"emailCode"|"password"|"recovery"|"recoverCode"|"reset";
export default function CustomerForm({initial="login"}:{initial?:Step}){
 const t=useTranslations();
 const [step,setStep]=useState(initial),[email,setEmail]=useState(""),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[cooldown,setCooldown]=useState(0),[length,setLength]=useState(0);
 const [details,setDetails]=useState({firstName:"",lastName:"",company:"",category:"tiles"});
 useEffect(()=>{
 if(initial!=="login"&&initial!=="details")return;
 if(new URLSearchParams(location.search).has("recovered"))setNotice("passwordChanged");
 try{const draft=JSON.parse(sessionStorage.getItem("tb-signup-draft")||"null");
 if(draft&&draft.until>Date.now()&&typeof draft.email==="string" && draft.version===2){setDetails(draft.details);setEmail(draft.email);setStep("emailCode");setCooldown(Math.max(0,Math.ceil((draft.sent+60000-Date.now())/1000)));}
 else sessionStorage.removeItem("tb-signup-draft");}catch{sessionStorage.removeItem("tb-signup-draft");}
 },[initial]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(timer);},[cooldown]);
 function go(next:Step,message=""){setStep(next);setShow(false);setLength(0);setNotice(message);setError("");}
 async function post(action:string,values:Record<string,unknown>={}){
  const legacy=action==="email";
  const result=await fetch(legacy?"/api/auth":"/api/customer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...values,action})});
  if(!result.ok){const body=await result.json();throw Error(["authInvalid","authWait","deliveryUnavailable","testRecipientOnly","codeExpired","verificationUnavailable"].includes(body.error)?body.error:"authFailed");}
  return result.json() as Promise<{ok:true;next?:"setPassword"}>;
 }
 async function submit(values:Record<string,unknown>,resend=false){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   if("confirm" in values&&values.confirm!==values.password)throw Error("passwordMismatch");
   if(step==="linkEmail"||(step==="linkCode"&&resend)){await post("linkEmail",{email});go("linkCode","checkEmail");setCooldown(60);}
   else if(step==="linkCode"){await post("verifyLink",{email,code:values.code});go("reset");}
   else if(step==="details"||(step==="emailCode"&&resend)){await post(resend?"resend":"start",{...details,email});sessionStorage.setItem("tb-signup-draft",JSON.stringify({version:2,email,details,sent:Date.now(),until:Date.now()+600000}));go("emailCode","checkEmail");setCooldown(60);}
   else if(step==="emailCode"){await post("emailProof",{email,code:values.code});sessionStorage.removeItem("tb-signup-draft");await clearLocalBooks();location.replace("/access");}
   else if(step==="password"){await post("setPassword",{...values,terms:values.terms==="on",privacy:values.privacy==="on"});location.replace("/access");}
   else if(step==="recovery"||(step==="recoverCode"&&resend)){await post("recoverEmail",{email});go("recoverCode","recoveryNotice");setCooldown(60);}
   else if(step==="recoverCode"){const result=await post("checkRecoveryEmail",{email,code:values.code});go(result.next==="setPassword"?"password":"reset");}
   else if(step==="reset"){await post("resetPassword",values);await clearLocalBooks();location.replace("/login?recovered=1");}
   else{await post("email",{email,password:values.password});await clearLocalBooks();location.replace("/access");}
  }catch(e){setError(e instanceof Error&&["authInvalid","authWait","deliveryUnavailable","testRecipientOnly","codeExpired","verificationUnavailable","passwordMismatch"].includes(e.message)?e.message:"authFailed");}
  finally{setBusy(false);}
 }
 const titles:Record<Step,string>={linkEmail:"verifyEmail",linkCode:"verifyEmail",login:"welcomeBack",details:"register",emailCode:"verifyEmail",password:"createPassword",recovery:"forgotPassword",recoverCode:"verifyEmail",reset:"resetPassword"};
 const otp=["linkCode","emailCode","recoverCode"].includes(step),newPass=step==="password"||step==="reset";
 const registration=["details","emailCode","password"].includes(step);
 return <form key={step} onSubmit={e=>{e.preventDefault();void submit(Object.fromEntries(new FormData(e.currentTarget)));}}>
 {registration&&<p className="auth-progress">{t("registrationStep",{step:step==="details"?1:step==="emailCode"?2:3})}</p>}
 <h2>{t(titles[step])}</h2>
 {step==="details"&&<>{(["firstName","lastName","company"] as const).map(k=><label key={k}>{t(k==="company"?"firm_name":k)}<input required maxLength={k==="company"?120:60} autoComplete={k==="firstName"?"given-name":k==="lastName"?"family-name":"organization"} value={details[k]} onChange={e=>setDetails({...details,[k]:e.target.value})}/></label>)}<label>{t("category")}<select value={details.category} onChange={e=>setDetails({...details,category:e.target.value})}>{["tiles","sanitary","marble","mixed"].map(c=><option key={c} value={c}>{t(c)}</option>)}</select></label></>}
 {(step==="details"||step==="login"||step==="recovery"||step==="linkEmail"||step==="emailCode")&&<label>{t("email")}<input type="email" value={email} autoComplete="email" maxLength={254} required onChange={e=>setEmail(e.target.value)}/></label>}
 {otp&&<label>{t("code")}<input name="code" autoComplete="one-time-code" inputMode="numeric" autoFocus pattern="[0-9]{6}" maxLength={6} required/></label>}
 {(newPass||step==="login")&&<label>{t("password")}<span className="password-box"><input type={show?"text":"password"} name="password" autoComplete={newPass?"new-password":"current-password"} minLength={newPass?10:1} maxLength={newPass?128:256} required onChange={e=>setLength(e.target.value.length)}/><button type="button" className="password-toggle" aria-label={t(show?"hidePassword":"showPassword")} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>}
 {newPass&&<><small>{t("passwordLength")}</small><meter min={0} max={16} value={length} aria-label={t("passwordLength")}/><label>{t("confirmPassword")}<input type={show?"text":"password"} autoComplete="new-password" required name="confirm" minLength={10} maxLength={128}/></label></>}
 {step==="password"&&<><label className="auth-terms"><input name="terms" type="checkbox" required/>{t("termsAcceptance")}</label><label className="auth-terms"><input name="privacy" type="checkbox" required/><span>{t("privacyConsent")} <a href="/privacy" target="_blank" rel="noreferrer">{t("privacyPolicy")}</a></span></label></>}
 {step==="login"&&<a href="/forgot-password">{t("forgotPassword")}</a>}
 {error&&<p role="alert">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}
 <button className="btn primary full" disabled={busy}>{t(busy?"loading":step==="login"?"signIn":step==="details"||step==="recovery"?"send":"continue")}</button>
 {otp&&<><button className="text-button" type="button" disabled={busy||cooldown>0} onClick={()=>submit({},true)}>{t("resendCode")}{cooldown>0&&" ("+cooldown+"s)"}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{sessionStorage.removeItem("tb-signup-draft");go(step==="linkCode"?"linkEmail":step==="emailCode"?"details":"recovery");}}>{t("changeContact")}</button></>}
 {step==="login"&&<button type="button" className="btn full" onClick={()=>go("details")}>{t("register")}</button>}
 {step==="details"&&<a href="/login/verify">{t("alreadyHaveCode")}</a>}
 {(step==="details"||step==="recovery")&&<a href="/login">{t("signIn")}</a>}
 </form>;
}
