import { z } from "zod";
import { getSnapshot } from "@/server/store";
import { reports } from "@/features/catalog";
import { fmt, canCost } from "@/features/model";
import { report, profitReports } from "@/features/reporting";
import en from "@/features/messages/en.json";
import hi from "@/features/messages/hi.json";
import or from "@/features/messages/or.json";
import { escapeHtml } from "@/print/html";
import { printPage } from "@/print/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const date = z.union([z.literal(""), z.iso.date()]).optional();
const options = z.object({
  businessId: z.uuid().optional(),
  lang: z.enum(["hi", "en", "or"]).default("en"),
  start: date,
  end: date,
  user: z.string().max(128).optional(),
  q: z.string().max(300).optional(),
  column: z.string().max(80).optional(),
});
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const fail = (status: number, error: string) =>
  Response.json({ error }, { status, headers });

export async function GET(
  req: Request,
  ctx: { params: Promise<{ view: string }> },
) {
  const { view } = await ctx.params;
  const valid = options.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!valid.success) return fail(400, "Invalid report filters");
  if (!Object.values(reports).flat().includes(view))
    return fail(404, "Report unavailable");
  try {
    const {
      businessId,
      lang,
      start = "",
      end = "",
      user = "",
      q = "",
      column = "",
    } = valid.data;
    if (start && end && end < start) return fail(400, "Invalid date range");
    const book = await getSnapshot(businessId);
    if (!canCost(book) && profitReports.includes(view))
      return fail(403, "Report unavailable");
    const result = report(book, view, { start, end, user });
    const columns = result.columns.filter(
      (k) => canCost(book) || !["purchasePrice", "loss", "net"].includes(k),
    );
    const dict: Record<string, string> =
      lang === "hi" ? hi : lang === "or" ? or : en;
    const t = (key: string) => (Object.hasOwn(dict, key) ? dict[key] : key);
    const esc = escapeHtml;
    const filterColumns = columns.includes(column) ? [column] : columns;
    const search = q.trim().toLowerCase();
    const rows = search
      ? result.rows.filter((r) =>
          filterColumns.some((c) =>
            fmt(r, c, book, t, lang).toLowerCase().includes(search),
          ),
        )
      : result.rows;
    const bytes = await printPage(
      (
        fonts,
      ) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(t(view))}</title><style>${fonts}
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:10pt Arial,"TB Hindi","TB Odia",sans-serif;color:#171c43;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    header{display:flex;align-items:baseline;gap:8mm;justify-content:space-between;border-bottom:2px solid #14183f;padding-bottom:3mm}h1{font-size:18pt;margin:0}h2{font-size:12pt;margin:0;color:#066b6b}p{margin:2.4mm 0;color:#4b5860}.note{padding:2mm 3mm;background:#eff7f5}
    table{width:100%;border-collapse:collapse;margin-top:3mm}thead{display:table-header-group}th,td{text-align:left;border:1px solid #bcc7ca;padding:1.8mm;overflow-wrap:anywhere}th{background:#14183f;color:white}tr{break-inside:avoid}tr:nth-child(even){background:#f5f8f8}
    </style></head><body><header><h1>${esc(t(view))}</h1><h2>${esc(book.business.name)}</h2></header><p>${esc([start, end].filter(Boolean).join(" – "))}${start || end ? " · " : ""}${rows.length} ${esc(t("records"))}</p>${result.note ? `<p class="note">${esc(t(result.note))}</p>` : ""}<table><thead><tr>${columns.map((c) => `<th>${esc(t(c))}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(fmt(r, c, book, t, lang))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${columns.length}">${esc(t("noRecords"))}</td></tr>`}</tbody></table></body></html>`,
      "A4",
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TileBook-${view}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sign in required" || message === "Unauthorized")
      return fail(401, "Sign in required");
    if (message === "Business access denied") return fail(403, message);
    return fail(503, "Report unavailable");
  }
}
