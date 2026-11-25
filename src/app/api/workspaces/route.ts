import { z } from "zod";
import { workspaces, onboard, revokeStaff } from "@/server/store";
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function failure(e: unknown) {
  return reply(
    { error: "authInvalid" },
    e instanceof Error && /Unauthorized|Sign in/.test(e.message) ? 401 : 400,
  );
}
export async function GET() {
  try {
    return reply(await workspaces());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
    return reply({ error: "authInvalid" }, 415);
  try {
    return reply({ id: await onboard(await req.json()) });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
    return reply({ error: "authInvalid" }, 415);
  try {
    const v = z
      .object({ businessId: z.uuid(), invitation: z.uuid() })
      .parse(await req.json());
    await revokeStaff(v.businessId, v.invitation);
    return reply({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
