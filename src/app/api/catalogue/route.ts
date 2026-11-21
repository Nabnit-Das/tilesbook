import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getSnapshot } from "@/server/store";
import { authClient, localRequest } from "@/server/identity";
import { catalogueItems, cataloguePhoto } from "@/features/catalogue-data";
import { money, str } from "@/features/model";
import { printPage } from "@/print/pdf";
import en from "@/features/messages/en.json";
import hi from "@/features/messages/hi.json";
import or from "@/features/messages/or.json";
const query = z.object({
  businessId: z.uuid(),
  lang: z.enum(["en", "hi", "or"]).default("en"),
  q: z.string().max(160).optional(),
  category: z.string().max(160).optional(),
});
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || "",
  );
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const parsed = query.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Invalid catalogue request" },
      { status: 400 },
    );
  const { businessId, lang, q, category } = parsed.data;
  try {
    const book = await getSnapshot(businessId);
    if (book.business.id !== businessId)
      return new Response(null, { status: 403 });
    const words: Record<string, string> =
      lang === "hi" ? hi : lang === "or" ? or : en;
    const t = (key: string) => words[key] || key;
    const rows = catalogueItems(book.records.products || [], q, category);
    const demo = await localRequest();
    const client = demo ? undefined : await authClient();
    const cards: string[] = [];
    for (const item of rows) {
      const source = cataloguePhoto(item.photo, businessId);
      let photo = source.data || "";
      if (source.file) {
        try {
          const bytes = demo
            ? await readFile(
                path.resolve(
                  process.env.TILEBOOK_DATA_DIR || ".tilebook/data",
                  "../private-media/lot-photos",
                  businessId,
                  source.file,
                ),
              )
            : await client!.storage
                .from("lot-photos")
                .download(businessId + "/" + source.file)
                .then(async (r) =>
                  r.data ? Buffer.from(await r.data.arrayBuffer()) : null,
                );
          if (bytes && bytes.length <= 1024 * 1024)
            photo = "data:image/jpeg;base64," + bytes.toString("base64");
        } catch {
          /* A missing photo should not prevent the product from printing. */
        }
      }
      cards.push(
        "<article>" +
          (photo ? '<img alt="" src="' + photo + '"/>' : "") +
          "<h2>" +
          escape(item.name) +
          "</h2><p>" +
          escape(
            [item.brand, item.size, item.finish].filter(Boolean).join(" · "),
          ) +
          "</p><strong>" +
          escape(money(item.price, lang)) +
          " / " +
          escape(t(item.unit)) +
          "</strong></article>",
      );
    }
    const bytes = await printPage(
      (fonts) =>
        '<!doctype html><html lang="' +
        lang +
        '"><head><meta charset="utf-8"/><style>' +
        fonts +
        '@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font:11pt Arial,"TB Hindi","TB Odia",sans-serif;color:#171d40}header{border-bottom:2px solid #087e74;margin-bottom:5mm}header p{margin:1mm 0 4mm}h1{font-size:22pt;margin:0}main{display:block}article{width:48%;display:inline-block;vertical-align:top;padding:3mm;margin:0 1.5% 4mm 0;border:1px solid #d5dfdf;break-inside:avoid}img{width:100%;height:33mm;object-fit:contain}h2{font-size:11pt;margin:2mm 0}p{margin:1mm 0;color:#4b5963}strong{color:#0a685e;font-size:12pt}</style></head><body><header><h1>' +
        escape(String(book.business.name)) +
        "</h1><p>" +
        escape(t("designGallery")) +
        " · " +
        escape(str(book.business, "phone")) +
        "</p></header><main>" +
        cards.join("") +
        "</main><footer>" +
        escape(t("cataloguePriceNote")) +
        "</footer></body></html>",
      "A4",
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="TileBook-catalogue.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return Response.json(
      { error: "Catalogue unavailable" },
      {
        status: /unauthorized|sign in/i.test(msg)
          ? 401
          : /denied/i.test(msg)
            ? 403
            : 503,
      },
    );
  }
}
