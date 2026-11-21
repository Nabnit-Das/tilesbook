import QRCode from "qrcode";
import { amountInWords } from "../domain/rules";
import { messages, type Copy, type Heading, type PrintModel } from "./model";

export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ] ?? "",
  );
const esc = escapeHtml;
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
const number = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n);
const date = (s: string) =>
  s && Number.isFinite(Date.parse(s))
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(s))
    : "—";
type Label = (key: Heading) => string;
type Column = {
  label: string;
  align?: "right" | "left";
  cells: (line: PrintModel["lines"][number], index: number) => string;
  total?: string;
  cls?: string;
};
const dash = (s: string) => esc(s) || "—";
const row = (heading: string, value: string) =>
  `<div class="pair"><span>${heading}</span><b>${value}</b></div>`;
const tag = (heading: string) => `<div class="section-label">${heading}</div>`;
function displayUnit(s: string, t: Label) {
  const key = s
    .toLowerCase()
    .replace(
      /(boxes|pieces|bags)$/g,
      (v) => ({ boxes: "box", pieces: "piece", bags: "bag" })[v] ?? v,
    );
  return ["piece", "bag", "box", "sqft"].includes(key)
    ? t(key as Heading)
    : esc(s);
}
function paymentMode(s: string, t: Label) {
  return ["cash", "cheque", "upi"].includes(s.toLowerCase())
    ? t(s.toLowerCase() as Heading)
    : dash(s);
}
async function paymentQr(m: PrintModel) {
  if (!m.bank.upi || !/^[a-z\d._-]{2,256}@[a-z\d.-]{2,64}$/i.test(m.bank.upi))
    return "";
  const params = new URLSearchParams({
    pa: m.bank.upi,
    pn: m.business.name,
    cu: "INR",
    tn: m.number,
  });
  if (
    m.balance > 0 &&
    ["invoice", "retail", "proforma", "order", "estimate"].includes(m.kind)
  )
    params.set("am", (m.balance / 100).toFixed(2));
  // QR encodes only merchant and payment details; a PSP supplies the real payment flow.
  return QRCode.toDataURL("upi://pay?" + params.toString(), {
    errorCorrectionLevel: "M",
    width: 220,
    margin: 4,
    color: { dark: "#14183fff", light: "#ffffffff" },
  });
}
function table(m: PrintModel, t: Label) {
  const quantity = m.quantities
    .map(([unit, n]) => number(n) + " " + displayUnit(unit, t))
    .join("<br>");
  const cols: Column[] = [
    { label: "#", cells: (_, i) => String(i + 1), cls: "idx" },
    {
      label: t("description"),
      cells: (l) => `<b>${dash(l.description)}</b>`,
      total: t("total"),
      cls: "desc",
    },
  ];
  if (m.prefs.showHsn)
    cols.push({ label: t("hsn"), cells: (l) => dash(l.hsn) });
  if (m.prefs.showLot)
    cols.push({
      label: t("lot"),
      cells: (l) =>
        [l.lotNo, l.shade].filter(Boolean).map(esc).join(" / ") || "—",
    });
  cols.push({
    label: t("qty"),
    align: "right",
    cells: (l) => number(l.qty) + " " + displayUnit(l.unit, t),
    total: quantity,
  });
  if (m.prefs.showSqft)
    cols.push({
      label: t("sqft"),
      align: "right",
      cells: (l) => (l.sqft ? number(l.sqft) : "—"),
      total: m.sqft ? number(m.sqft) : "—",
    });
  cols.push({ label: t("rate"), align: "right", cells: (l) => money(l.rate) });
  if (m.prefs.showDiscount)
    cols.push({
      label: t("discount"),
      align: "right",
      cells: (l) => money(l.discount),
      total: money(m.discount),
    });
  cols.push({
    label: t("taxable"),
    align: "right",
    cells: (l) => money(l.taxable),
    total: money(m.taxable),
  });
  for (const tax of m.interstate
    ? ["igst" as const]
    : ["cgst" as const, "sgst" as const]) {
    cols.push({
      label: t(tax),
      align: "right",
      cells: (l) =>
        `${money(l[tax])}<small>${number(m.interstate ? l.gstRate : l.gstRate / 2)}%</small>`,
      total: money(m[tax]),
    });
  }
  cols.push({
    label: t("amount"),
    align: "right",
    cells: (l) => money(l.amount),
    total: money(m.taxable + m.tax),
  });
  const groups = new Map<string, PrintModel["lines"]>();
  for (const line of m.lines) {
    const key = m.kind === "estimate" ? line.room : "";
    const group = groups.get(key) ?? [];
    group.push(line);
    groups.set(key, group);
  }
  let lineNo = 0;
  const body = Array.from(groups, ([room, lines]) => {
    const heading = room
      ? `<tr class="room"><td colspan="${cols.length}">${t("room")} · ${esc(room)}</td></tr>`
      : "";
    const rows = lines
      .map((line) => {
        const cells = cols
          .map(
            (col) =>
              `<td class="${col.align ?? "left"} ${col.cls ?? ""}">${col.cells(line, lineNo)}</td>`,
          )
          .join("");
        lineNo++;
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return heading + rows;
  }).join("");
  return `<table class="items"><thead><tr>${cols.map((col) => `<th class="${col.align ?? "left"} ${col.cls ?? ""}">${col.label}</th>`).join("")}</tr></thead><tbody>${body}</tbody><tbody class="totals"><tr>${cols.map((col) => `<td class="${col.align ?? "left"}">${col.total ?? ""}</td>`).join("")}</tr></tbody></table>`;
}

function taxSummary(m: PrintModel, t: Label) {
  const taxes = m.interstate
    ? ["igst" as const]
    : ["cgst" as const, "sgst" as const];
  return (
    tag(t("hsnSummary")) +
    `<table class="summary"><thead><tr><th>${t("hsn")}</th><th>${t("rateOfTax")}</th><th>${t("taxable")}</th>${taxes.map((k) => `<th>${t(k)}</th>`).join("")}<th>${t("tax")}</th></tr></thead><tbody>${m.hsn.map((g) => `<tr><td>${dash(g.hsn)}</td><td>${number(g.gstRate)}%</td><td>${money(g.taxable)}</td>${taxes.map((k) => `<td>${money(g[k])}</td>`).join("")}<td>${money(g.cgst + g.sgst + g.igst)}</td></tr>`).join("")}</tbody></table>`
  );
}

function header(m: PrintModel, t: Label, copy: Copy) {
  return `<header><div class="shop">${m.prefs.logo ? `<img class="logo" src="${m.prefs.logo}" alt="">` : ""}<div><h1>${esc(m.business.name)}</h1><p>${esc(m.business.address)}</p><p>${t("gstin")} ${dash(m.business.gstin)} &nbsp; · &nbsp; ${t("phone")} ${dash(m.business.phone)}</p></div></div><div class="doc-title"><h2>${t(m.kind)}</h2><p>${t(copy)}</p><b>${esc(m.number)}</b></div></header>`;
}
function bankAndSignature(m: PrintModel, t: Label, qr: string) {
  const qrImg = qr
    ? `<figure><img src="${qr}" alt="UPI QR"><figcaption>${t("scan")}</figcaption></figure>`
    : "";
  return `<section class="sign"><div class="bank">${qrImg}<div>${tag(t("bank"))}<b>${dash(m.bank.name)}</b><p>${t("account")} ${dash(m.bank.account)}</p><p>${t("ifsc")} ${dash(m.bank.ifsc)}</p><p>${t("upi")} ${dash(m.bank.upi)}</p></div></div><div class="signature"><span>${t("forBusiness")} ${esc(m.business.name)}</span><div>${t("signature")}</div></div></section>`;
}
function addresses(m: PrintModel, t: Label) {
  const title = ["purchase", "po", "debit"].includes(m.kind)
    ? "supplier"
    : "billTo";
  return `<div class="addresses"><div>${tag(t(title))}<strong>${dash(m.party.name)}</strong><p>${dash(m.party.address)}</p><p>${t("gstin")} ${dash(m.party.gstin)} &nbsp; · &nbsp; ${t("phone")} ${dash(m.party.phone)}</p></div><div>${tag(t("shipTo"))}<strong>${dash(m.party.name)}</strong><p>${dash(m.party.ship)}</p></div></div>`;
}
function fullDocument(m: PrintModel, t: Label, qr: string, copy: Copy) {
  const details = `<section class="meta"><div>${row(t("number"), dash(m.number))}${row(t("date"), date(m.date))}${row(t("supply"), dash(m.state))}</div><div>${row(t("vehicle"), dash(m.vehicle))}${row(t("eway"), dash(m.eway))}${row(t("ref"), dash([m.order, m.challan, m.reference].filter(Boolean).join(" / ")))}</div><div class="referral">${row(t("partner"), dash(m.referred))}${row(t("salesperson"), dash(m.prepared))}</div></section>`;
  return (
    header(m, t, copy) +
    details +
    addresses(m, t) +
    table(m, t) +
    taxSummary(m, t) +
    `<section class="settlement"><div>${tag(t("words"))}<b>${esc(amountInWords(m.total))}</b>${m.note ? `<p>${t("notes")} · ${esc(m.note)}</p>` : ""}</div><div>${row(t("round"), money(m.roundOff))}${row(t("total"), "₹ " + money(m.total))}${row(t(["purchase", "po", "debit"].includes(m.kind) ? "paid" : "received"), "₹ " + money(m.received))}<div class="balance">${row(t("balance"), "₹ " + money(m.balance))}</div>${m.dueDate ? row(t("due"), date(m.dueDate)) : ""}</div></section>` +
    bankAndSignature(m, t, qr) +
    `<div class="terms">${tag(t("terms"))}<p>${esc(m.prefs.terms || messages[m.prefs.lang].defaultTerms)}</p></div>${m.kind === "invoice" ? `<div class="integration"><span>${m.irn ? esc(m.irn) : t("irn")}</span><span>${t("irnQr")}</span></div>` : ""}`
  );
}
function statement(m: PrintModel, t: Label, copy: Copy) {
  const st = m.statement!;
  let balance = st.opening;
  const fields = (
    ["date", "activity", "ref", "debitCol", "creditCol", "balance"] as const
  )
    .map((key) => `<th>${t(key)}</th>`)
    .join("");
  return (
    header(m, t, copy) +
    addresses(m, t) +
    `<p class="simple-total">${row(t("opening"), "₹ " + money(st.opening))}</p><table class="statement"><thead><tr>${fields}</tr></thead><tbody>${
      st.entries
        .map((r) => {
          balance += r.debit - r.credit;
          return `<tr><td>${date(r.date)}</td><td>${t(r.kind)}</td><td>${dash(r.reference)}</td><td>${money(r.debit)}</td><td>${money(r.credit)}</td><td>${money(balance)}</td></tr>`;
        })
        .join("") || `<tr><td colspan="6">${t("noEntries")}</td></tr>`
    }</tbody></table><section class="simple-total">${row(t("closing"), "₹ " + money(st.closing))}</section>`
  );
}
function receipt(m: PrintModel, t: Label, qr: string, copy: Copy) {
  return (
    header(m, t, copy) +
    `<section class="receipt-meta">${row(t("number"), dash(m.number))}${row(t("date"), date(m.date))}${row(t("party"), dash(m.party.name))}${row(t("ref"), dash(m.reference))}${row(t("method"), paymentMode(m.mode, t))}</section><section class="simple-total">${row(t("amount"), "₹ " + money(m.total))}</section>${tag(t("words"))}<p>${esc(amountInWords(m.total))}</p>${m.note ? `<p>${t("notes")} · ${esc(m.note)}</p>` : ""}` +
    bankAndSignature(m, t, qr)
  );
}
function thermal(m: PrintModel, t: Label, qr: string) {
  if (m.kind === "statement") return statement(m, t, "original");
  const isPayment = m.kind === "payment" || m.kind === "voucher";
  return `<div class="t-shop"><h1>${esc(m.business.name)}</h1><p>${esc(m.business.address)}</p><b>${t("gstin")} ${dash(m.business.gstin)}</b><h2>${t(m.kind)}</h2></div>${row(t("number"), dash(m.number))}${row(t("date"), date(m.date))}${row(t("party"), dash(m.party.name))}<hr>${m.lines.map((l) => `<div class="t-line"><b>${esc(l.description)}</b>${m.prefs.showLot && l.lotNo ? ` <span>(${t("lot")} ${esc(l.lotNo)} / ${dash(l.shade)})</span>` : ""}${row(number(l.qty) + " " + displayUnit(l.unit, t) + " × " + money(l.rate), money(l.amount))}</div>`).join("")}${!isPayment ? row(t("included"), money(m.tax)) : ""}${!isPayment ? row(t("round"), money(m.roundOff)) : ""}<div class="t-total">${row(t("total"), "₹ " + money(m.total))}</div>${row(t("method"), paymentMode(m.mode, t))}${!isPayment ? row(t("received"), money(m.received)) + row(t("balance"), money(m.balance)) : ""}${qr ? `<figure><img src="${qr}" alt="UPI QR"><figcaption>${t("scan")}</figcaption></figure>` : ""}<p class="thanks">${t("thankYou")}</p>`;
}

export async function printHtml(m: PrintModel, fontCss = "") {
  const t: Label = (key) => esc(messages[m.prefs.lang][key]);
  const qr = await paymentQr(m);
  const isThermal = m.prefs.paper === "80mm";
  const css = `${fontCss}
  *{box-sizing:border-box}html,body{margin:0;color:#171b3f;font-family:Arial,"TB Hindi","TB Odia","Nirmala UI",sans-serif;font-size:9pt;line-height:1.35}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{--accent:${m.prefs.accent};padding:0;break-after:page}.sheet:last-child{break-after:auto}h1,h2,p,figure{margin:0}p{overflow-wrap:anywhere}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:5mm;padding-bottom:4mm;border-bottom:2.2pt solid #14183f}
  .shop{display:flex;align-items:center;gap:3mm;min-width:0;max-width:65%}.logo{width:14mm;height:14mm;object-fit:contain}.shop h1{font-size:15pt;line-height:1.08;margin-bottom:1.6mm;letter-spacing:-.35pt}
  .shop p,.doc-title p{font-size:7.8pt;margin-top:1mm}.doc-title{text-align:right}.doc-title h2{color:var(--accent);font-size:14pt;line-height:1.12;text-transform:uppercase}.doc-title p{text-transform:uppercase;letter-spacing:.25pt}.doc-title b{display:block;margin-top:1mm}
  .meta,.addresses{display:grid;border:1px solid #aebcc6}.meta{grid-template-columns:1fr 1fr 1.08fr;margin-top:3mm}.meta>div,.addresses>div{padding:2.3mm 3mm;border-right:1px solid #aebcc6}.meta>div:last-child,.addresses>div:last-child{border:0}
  .pair{display:flex;justify-content:space-between;gap:2mm;align-items:baseline;margin:.6mm 0}.pair span{color:#4e5a65}.pair b{text-align:right;overflow-wrap:anywhere;min-width:0;font-weight:600}
  .meta .pair,.addresses p{font-size:7.3pt}.referral{background:#f0f9f7}.addresses{grid-template-columns:1fr 1fr;border-top:0;margin-bottom:3.5mm}.addresses strong{font-size:10pt}
  .section-label{color:#365b65;text-transform:uppercase;letter-spacing:.55pt;font-size:7.1pt;font-weight:700;margin-bottom:1mm}.addresses p{margin-top:.7mm}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:1.65mm 1.1mm;border:1px solid #b4c0c8;vertical-align:top;text-align:left}
  th{background:#171c43;color:white;line-height:1.17;font-weight:600}.items{font-size:7.3pt;margin-bottom:3mm}.items .idx{width:3%}.items .desc{width:18%;overflow-wrap:anywhere}.items .right{text-align:right}.items small{display:block;font-size:6.3pt;color:#586576}
  .totals td,.room td{background:#eaf5f3;font-weight:bold}.summary,.statement{font-size:8pt}.summary td:not(:first-child),.summary th:not(:first-child){text-align:right}.statement td:nth-last-child(-n+3){text-align:right}.summary{margin-bottom:3mm}
  .settlement{display:grid;grid-template-columns:1fr .75fr;gap:7mm;border-top:1px solid #d0dadd;padding:2mm 0;break-inside:avoid}.settlement p{margin-top:2mm}.balance{color:#a33024;background:#fcf1ed;padding:.4mm 1mm}.balance span{color:inherit}
  .sign{margin-top:3mm;display:flex;align-items:flex-end;justify-content:space-between;gap:5mm;border-top:1.5px solid #15193e;padding:3mm 0;break-inside:avoid}
  .bank{display:flex;align-items:center;gap:4mm;font-size:8pt;max-width:65%}.bank figure{max-width:23mm;text-align:center}.bank img{width:20mm;height:20mm}.bank figcaption{font-size:6.3pt}.signature{text-align:center;font-size:8pt}.signature div{border-top:1px solid #515867;margin-top:10mm;padding-top:1.3mm}
  .terms p{white-space:pre-wrap;font-size:8pt}.integration{display:flex;gap:2mm;margin-top:2.5mm}.integration span{border:1px dashed #97a4ab;padding:1mm 2mm;font-size:7pt}.foot{display:flex;gap:5mm;justify-content:space-between;border-top:1px solid #b0bec4;margin-top:3mm;padding-top:1.5mm;color:#546470;font-size:7pt}
  .simple-total{background:#eef8f6;padding:2mm 3mm;margin:3mm 0;font-size:12pt}.receipt-meta{margin:5mm 0;max-width:100mm}.receipt-meta .pair{padding:1.5mm 0;border-bottom:1px dotted #a8b2b8}
  ${isThermal ? `body{width:80mm;font-size:9pt;color:#161616}.sheet{width:80mm;padding:3mm}.t-shop,.thanks,figure{text-align:center}.t-shop h1{font-size:13pt}.t-shop h2{font-size:10.5pt;letter-spacing:.6pt;text-transform:uppercase;margin:2mm 0}.t-shop p,.t-line span{font-size:8pt}.t-line{border-bottom:1px dotted #999;padding:1.5mm 0}.t-line span{display:block}.t-total{border-block:1px dashed #333;padding:1mm 0;margin:1mm 0;font-size:13pt}.sheet figure{margin:2mm 0}.sheet figure img{width:26mm;height:26mm}.sheet figcaption,.thanks{font-size:8pt}.foot{display:block;text-align:center}.t-shop{margin-bottom:2mm}hr{border:0;border-top:1px dashed #555}.statement{font-size:6pt}` : `@page{size:${m.prefs.paper === "A5" ? "A5 landscape" : "A4 portrait"};margin:10mm 8mm}`}`;
  const pages = m.prefs.labels
    .map((copy) => {
      const content = isThermal
        ? thermal(m, t, qr)
        : m.kind === "statement"
          ? statement(m, t, copy)
          : m.kind === "payment" || m.kind === "voucher"
            ? receipt(m, t, qr, copy)
            : fullDocument(m, t, qr, copy);
      return `<main class="sheet">${content}<footer class="foot"><span>${esc(m.prefs.footer)}</span>${!isThermal ? `<span>${t("prepared")} · ${dash(m.prepared)}</span>` : ""}</footer></main>`;
    })
    .join("");
  return `<!doctype html><html lang="${m.prefs.lang}"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>${esc(m.number || m.party.name)} · ${t(m.kind)}</title><style>${css}</style></head><body>${pages}</body></html>`;
}
