import { z } from "zod";
import { backupFile } from "@/server/store";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("export"), businessId: z.uuid() }),
  z.object({
    action: z.literal("restore"),
    businessId: z.uuid(),
    file: z.string().max(20000000),
    confirm: z.literal(true),
  }),
]);
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return Response.json({ error: "Origin denied" }, { status: 403 });
    if (
      req.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return Response.json({ error: "Expected JSON" }, { status: 415 });
    const data = input.parse(await req.json());
    const restoring = data.action === "restore";
    const result = await backupFile(
      data.businessId,
      restoring ? data.file : undefined,
    );
    return new Response(result, {
      headers: {
        "Content-Type": restoring ? "text/plain" : "application/json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Checkpoint failed" },
      { status: 400 },
    );
  }
}
