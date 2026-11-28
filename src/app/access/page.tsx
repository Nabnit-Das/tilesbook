import {redirect} from "next/navigation";
import {identity,authClient,localRequest} from "@/server/identity";
import {workspaces} from "@/server/store";
import Access from "@/components/Access";
import Login from "@/components/Login";
export const dynamic="force-dynamic";
export default async function Page(){
 const user=await identity().catch(()=>null);if(!user)redirect("/login");
 const firms=await workspaces();let defaults={};
 if(!await localRequest()){
 const {data}=await (await authClient()).auth.getUser();if(!data.user)redirect("/login");
 if(data.user.app_metadata.tilebook_password_pending && data.user.email_confirmed_at)return <Login customerStep="password"/>;
 if(!data.user.email_confirmed_at)return <Login customerStep="linkEmail"/>;
 const meta=data.user.user_metadata;defaults={ownerName:String(meta.full_name||""),name:String(meta.company||""),category:String(meta.category||"tiles")};
 }
 return <Access defaults={defaults} firms={firms} userId={user.id}/>;
}
