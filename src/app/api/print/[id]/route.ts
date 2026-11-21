import { z } from "zod";
import { getSnapshot } from "@/server/store";
import { buildPrintModel } from "@/print/model";
import { renderPdf } from "@/print/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const querySchema = z.object({
  businessId: z.string().uuid().optional(),
  paper: z.enum(["A4", "A5", "80mm"]).optional(),
  lang: z.enum(["en", "hi", "or"]).optional(),
  uiLang: z.enum(["en", "hi", "or"]).optional(),
  copy: z.enum(["original", "duplicate", "triplicate"]).optional(),
  download: z.enum(["0", "1"]).optional(),
  retail: z.enum(["0", "1"]).optional(),
});
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const issue = (status: number, error: string) =>
  Response.json({ error }, { status, headers: privateHeaders });

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!query.success || !id || id.length > 128)
    return issue(400, "Invalid print request");
  try {
    const { businessId, download, retail, ...options } = query.data;
    const snapshot = await getSnapshot(businessId);
    const model = buildPrintModel(snapshot, id, {
      ...options,
      retail: retail === "1",
    });
    if (!model) return issue(404, "Document unavailable");
    const pdf = await renderPdf(model);
    const file =
      (model.number || model.party.name || model.kind)
        .replace(/[^a-z0-9_-]+/gi, "-")
        .slice(0, 80) || "TileBook";
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download === "1" ? "attachment" : "inline"}; filename="${file}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sign in required" || message === "Unauthorized")
      return issue(401, "Sign in required");
    if (message === "Business access denied")
      return issue(403, "Business access denied");
    console.error(
      "TileBook PDF rendering failed",
      error instanceof Error ? error.name : "Error",
    );
    return issue(503, "Print service unavailable");
  }
}
