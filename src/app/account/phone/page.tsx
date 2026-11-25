import { identity } from "@/server/identity";
import { smsAvailable } from "@/server/auth-policy";
import { redirect } from "next/navigation";
import Login from "@/components/Login";
export default async function Page() {
  if (!(await identity().catch(() => null))) redirect("/login");
  return <Login demo={false} sms={smsAvailable()} link />;
}
