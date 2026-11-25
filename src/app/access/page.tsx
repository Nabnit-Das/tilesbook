import { redirect } from "next/navigation";
import { workspaces } from "@/server/store";
import { identity } from "@/server/identity";
import Access from "@/components/Access";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await identity().catch(() => null);
  if (!user) redirect("/login");
  return <Access firms={await workspaces()} userId={user.id} />;
}
