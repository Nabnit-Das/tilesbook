import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPrintModel,
  docKinds,
  messages,
  type PrintQuery,
} from "../src/print/model";
import { printHtml } from "../src/print/html";
import { renderPdf } from "../src/print/pdf";
import { printSnapshot } from "./print-fixture";
import { asUser, openEmbedded } from "../src/server/embedded";
import type { Snapshot } from "../src/types/database";

function model(id = "inv", options: PrintQuery = {}, snapshot = printSnapshot) {
  const result = buildPrintModel(snapshot, id, options);
  if (!result) throw new Error("Missing print document");
  return result;
}
async function readPdf(bytes: Uint8Array) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const texts = await page.getTextContent();
    return {
      width: viewport.width,
      height: viewport.height,
      pages: pdf.numPages,
      text: texts.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " "),
    };
  } finally {
    await task.destroy();
  }
}
async function saveForInspection(name: string, bytes: Uint8Array) {
  if (!process.env.TILEBOOK_PRINT_ARTIFACT_DIR) return;
  await mkdir(process.env.TILEBOOK_PRINT_ARTIFACT_DIR, { recursive: true });
  await writeFile(
    path.join(process.env.TILEBOOK_PRINT_ARTIFACT_DIR, name),
    bytes,
  );
}

describe("print documents", () => {
  it("provides every heading in English, Hindi and Odia", () => {
    for (const lang of ["hi", "or"] as const) {
      expect(Object.keys(messages[lang]).sort()).toEqual(
        Object.keys(messages.en).sort(),
      );
      expect(
        Object.values(messages[lang]).every((word) => word.trim().length > 0),
      ).toBe(true);
    }
  });
  it("uses saved values, filters by snapshot and never resolves foreign documents", () => {
    expect(buildPrintModel({ business: {}, records: {} }, "inv")).toBeNull();
    const document = model();
    expect(document).toMatchObject({
      taxable: 7662800,
      cgst: 689652,
      sgst: 689652,
      tax: 1379304,
      total: 9042100,
      roundOff: -4,
      balance: 4042100,
    });
    expect(document.hsn).toHaveLength(2);
    expect(document.lines[0]).toMatchObject({ lotNo: "2531", shade: "A3" });
  });
  it("renders each document family, including a running party statement", async () => {
    const snapshot = structuredClone(printSnapshot);
    for (const [resource, kind] of Object.entries(docKinds)) {
      if (["payments", "parties", "saleInvoices"].includes(resource)) continue;
      const row = snapshot.records.saleInvoices[0] as object;
      snapshot.records[resource] = [{ ...row, id: resource, number: "DOC-14" }];
      const document = model(resource, {}, snapshot);
      expect(document.kind).toBe(kind);
      expect(await printHtml(document)).toContain(messages.en[kind]);
    }
    expect(model("pay")).toMatchObject({
      kind: "payment",
      reference: "INV-113",
      total: 5000000,
    });
    expect(model("p").statement).toMatchObject({
      opening: 0,
      closing: 4042100,
    });
    expect(model("inv", { retail: true }).kind).toBe("retail");
  });
  it("honours print-template preferences, copy selection and escaped merchant fields", async () => {
    const snapshot = structuredClone(printSnapshot);
    snapshot.records.settings = [
      {
        key: "preferences",
        value: {
          paper: "A5",
          accent: "#126b62",
          showHsn: false,
          showLot: false,
          terms: "<b>Custom terms</b>",
          footer: "Our footer",
          copies: 3,
          printLanguage: "hi",
        },
      },
    ];
    const html = await printHtml(model("inv", { copy: "duplicate" }, snapshot));
    expect(html).toContain(messages.hi.duplicate);
    expect(html).toContain("&lt;b&gt;Custom terms&lt;/b&gt;");
    expect(html).not.toContain(messages.hi.lot);
    expect(html).toContain("Our footer");
    expect(html).toContain("A5 landscape");
    expect(html).toContain("#126b62");
  });
  it("groups estimates by room, retaining the per-line rate", async () => {
    const snap = structuredClone(printSnapshot);
    const invoice = snap.records.saleInvoices[0] as { lines: object[] };
    snap.records.estimates = [
      {
        ...invoice,
        id: "estimate",
        lines: invoice.lines.map((r, i) => ({
          ...r,
          room: i ? "Bathroom" : "Living room",
        })),
      },
    ];
    const html = await printHtml(model("estimate", {}, snap));
    expect(html).toContain("Room · Living room");
    expect(html).toContain("Room · Bathroom");
    expect(html).toContain("18%");
  });
  it("switches interstate invoices to IGST", async () => {
    const snap = structuredClone(printSnapshot);
    const invoice = snap.records.saleInvoices[0] as object;
    snap.records.saleInvoices = [
      { ...invoice, interstate: true, placeOfSupply: "West Bengal" },
    ];
    const doc = model("inv", {}, snap);
    expect(doc.igst).toBe(1379304);
    const html = await printHtml(doc);
    expect(html).toContain(">IGST<");
    expect(html).not.toContain(">CGST<");
  });
  it("prints INV-113 as a one-page A4 tax invoice with readable values and a payment QR", async () => {
    const db = await openEmbedded();
    let snapshot: Snapshot;
    try {
      const result = await asUser(
        db,
        "00000000-0000-4000-8000-000000000001",
        (tx) =>
          tx.query<{ data: Snapshot }>("select tilebook_snapshot($1) as data", [
            "10000000-0000-4000-8000-000000000001",
          ]),
      );
      snapshot = result.rows[0].data;
    } finally {
      await db.close();
    }
    const id = snapshot.records.saleInvoices.find(
      (row) => row.number === "INV-113",
    )?.id;
    expect(id).toBeTruthy();
    const doc = model(id, {}, snapshot);
    const html = await printHtml(doc);
    expect(html).toContain('alt="UPI QR"');
    const bytes = await renderPdf(doc);
    await saveForInspection("INV-113-A4.pdf", bytes);
    const pdf = await readPdf(bytes);
    expect(pdf.width).toBeCloseTo(595, -1);
    expect(pdf.height).toBeCloseTo(842, -1);
    expect(pdf.pages).toBe(1);
    for (const field of [
      "INV-113",
      "Sai Builders",
      "Lot / Shade",
      "2531 / A3",
      "HSN-WISE TAX SUMMARY",
      "90,421",
      "50,000",
      "40,421",
      "Ninety Thousand Four Hundred Twenty One Rupees Only",
      "State Bank of India",
      "Scan to pay by UPI",
      "TERMS AND CONDITIONS",
      "Authorised Signatory",
    ])
      expect(pdf.text).toContain(field);
  }, 60000);
  it("renders an 80 mm thermal PDF", async () => {
    const bytes = await renderPdf(model("inv", { paper: "80mm" }));
    await saveForInspection("INV-113-thermal.pdf", bytes);
    const pdf = await readPdf(bytes);
    expect(Math.abs((pdf.width * 25.4) / 72 - 80)).toBeLessThan(0.4);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("GST included");
    expect(pdf.text).toContain("90,421");
  }, 60000);
  for (const lang of ["hi", "or"] as const) {
    it(`prints a native, font-embedded ${lang} PDF`, async () => {
      const bytes = await renderPdf(model("inv", { lang }));
      await saveForInspection(`INV-113-${lang}.pdf`, bytes);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      const pdf = await readPdf(bytes);
      expect(pdf.pages).toBe(1);
      expect(pdf.text).toContain("INV-113");
      expect(pdf.text).toMatch(
        lang === "hi" ? /[\u0900-\u097f]/ : /[\u0b00-\u0b7f]/,
      );
    }, 60000);
  }
});
