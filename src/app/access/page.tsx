import { redirect } from "next/navigation";
import { workspaces } from "@/server/store";
import { authClient, localRequest } from "@/server/identity";
import { smsAvailable } from "@/server/auth-policy";
import Login from "@/components/Login";
import { identity } from "@/server/identity";
import Access from "@/components/Access";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await identity().catch(() => null);
  if (!user) redirect("/login");
  const firms = await workspaces();
  if (!firms.length && !(await localRequest())) {
    const { data } = await (await authClient()).auth.getUser();
    if (!data.user?.email_confirmed_at) redirect("/login/verify");
    if (
      !data.user.phone_confirmed_at ||
      !/^\+?91[6-9]\d{9}$/.test(data.user.phone || "")
    )
      return (
        <Login
          link
          registrationPhone={String(
            data.user.user_metadata.registration_phone || "",
          )}
          demo={false}
          sms={smsAvailable()}
        />
      );
  }
  return <Access firms={firms} userId={user.id} />;
}
