import {redirect} from "next/navigation";
import {authClient,localRequest} from "@/server/identity";
import Login from "@/components/Login";
export default async function Page(){if(await localRequest())redirect("/");const {data:{user}}=await (await authClient()).auth.getUser();if(!user)redirect("/login");if(user.email_confirmed_at)redirect("/access");return <Login customerStep="linkEmail"/>;}
