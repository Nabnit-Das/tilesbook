// A mistakenly auto-confirming provider would mark an unverified address as owned.
export async function requiresEmailProof(){
 const base=(process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!key)return false;
 const r=await fetch(new URL('/auth/v1/settings',base),{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!r.ok)return false;
 const settings=await r.json();return settings.mailer_autoconfirm===false && settings.external?.email===true;
}
