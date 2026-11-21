import { modules } from "./catalog";
export interface Row {
  id: string;
  [field: string]: unknown;
}
export interface Snapshot {
  business: Row;
  entitlements?: { plan: string; premium: boolean; trialEnds: string };
  role: string;
  userId: string;
  records: Record<string, Row[]>;
  businesses?: Row[];
}
export type T = (key: string) => string;
export const str = (r: Row | undefined, k: string) => String(r?.[k] ?? "");
export const n = (r: Row | undefined, k: string) => Number(r?.[k]) || 0;
export const lines = (row: Row): Row[] =>
  (Array.isArray(row.lines) ? row.lines : []).filter(
    (v): v is Row => v !== null && typeof v === "object",
  );
export const docs = (book: Snapshot): Row[] =>
  Object.entries(book.records)
    .filter(([k]) =>
      modules.some((m) => m.family === "documents" && m.resource === k),
    )
    .flatMap(([resource, rows]) => rows.map((r) => ({ ...r, resource })));
export const lookup = (
  book: Snapshot,
  resource: string | undefined,
  id: unknown,
) =>
  (resource === "documents"
    ? docs(book)
    : book.records[resource || ""] || []
  ).find(
    (r) => r.id === id || (resource === "partners" && r.partyId === id),
  ) as Row | undefined;
export function preferences(book: Snapshot): Record<string, unknown> {
  const v = (book.records.settings || []).find(
    (s) => s.key === "preferences",
  )?.value;
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const asDate = (value: string) => {
  const date = new Date(
    value.length === 10 ? value + "T12:00:00+05:30" : value,
  );
  return Number.isNaN(+date)
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata" }).format(
        date,
      );
};
export function money(value: number, locale = "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-IN" : locale + "-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}
export const canCost = (book: Snapshot) =>
  !["counter", "godown"].includes(book.role.toLowerCase());
export function canWrite(book: Snapshot, resource?: string) {
  const role = book.role.toLowerCase();
  if (role === "accountant") return false;
  if (!resource) return true;
  if (
    book.entitlements?.premium === false &&
    ["partners", "campaigns", "slabs"].includes(resource)
  )
    return false;
  if (
    [
      "users",
      "subscriptions",
      "settings",
      "backups",
      "approvals",
      "portalLinks",
      "businesses",
    ].includes(resource)
  )
    return role === "owner";
  if (
    [
      "stockMovements",
      "productCosts",
      "audit",
      "commissions",
      "outbox",
    ].includes(resource)
  )
    return false;
  if (role === "godown")
    return [
      "damage",
      "display",
      "stockCounts",
      "transfers",
      "lots",
      "challans",
      "slabs",
    ].includes(resource);
  if (role === "counter")
    return [
      "parties",
      "saleInvoices",
      "estimates",
      "proformas",
      "saleOrders",
      "payments",
      "complaints",
      "followUps",
    ].includes(resource);
  return role === "owner" || role === "manager";
}
export const currencyFields = new Set(
  "debitPaise creditPaise countedCash openingBalance creditLimit purchasePrice salePrice landedCost total taxable tax balance received discount ratePaise amount principal emi earned paid payable loss value sales purchases net commission tds tcs cgst sgst igst advance".split(
    " ",
  ),
);
const references: Record<string, string> = {
  lotId: "lots",
  productId: "products",
  partyId: "parties",
  partnerId: "partners",
  supplierId: "parties",
  sourceId: "documents",
  documentId: "documents",
  paymentId: "payments",
  reservedFor: "parties",
  bankId: "banks",
  branchId: "branches",
  fromBranchId: "branches",
  toBranchId: "branches",
  userId: "users",
};
export function label(row: Row | undefined, book: Snapshot): string {
  if (!row) return "—";
  if (row.lotNo)
    return [str(row, "lotNo"), str(row, "shade")].filter(Boolean).join(" / ");
  return (
    str(row, "name") ||
    str(row, "number") ||
    str(row, "slabNo") ||
    str(row, "reference") ||
    (row.partyId ? str(lookup(book, "parties", row.partyId), "name") : "") ||
    row.id
  );
}
export function fmt(
  row: Row,
  key: string,
  book: Snapshot,
  t: T,
  locale: string,
) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "—";
  if (references[key]) return label(lookup(book, references[key], value), book);
  if (currencyFields.has(key)) return money(n(row, key), locale);
  if (key === "rate" && row.kind === "box") return money(n(row, key), locale);
  if (key === "rate" && row.kind === "percent") return String(value) + "%";
  if (key === "gstRate" || key === "interestRate" || key === "percentOff")
    return String(value) + "%";
  if (
    key.endsWith("Date") ||
    ["date", "createdAt", "updatedAt", "lastContact"].includes(key)
  )
    return asDate(String(value));
  if (
    [
      "type",
      "status",
      "kind",
      "mode",
      "direction",
      "baseUnit",
      "category",
      "unit",
      "reason",
      "role",
      "group",
      "metric",
      "action",
    ].includes(key)
  )
    return t(String(value));
  return typeof value === "object" ? "—" : String(value);
}
export function balances(book: Snapshot): Row[] {
  return (book.records.parties || []).map((p) => {
    const matching = (key: string) =>
      (book.records[key] || []).filter((r) => r.partyId === p.id);
    const sum = (key: string, field: string) =>
      matching(key).reduce((s, r) => s + n(r, field), 0);
    // Payments include receipts captured while a document is being issued.
    const signed = (key: string) =>
      matching("payments")
        .filter((r) => r.direction === key)
        .reduce((s, r) => s + n(r, "amount"), 0);
    const balance =
      n(p, "openingBalance") +
      sum("saleInvoices", "total") -
      sum("creditNotes", "total") -
      sum("purchaseBills", "total") +
      sum("debitNotes", "total") -
      signed("in") +
      signed("out");
    return {
      ...p,
      balance: p.balance === undefined ? balance : n(p, "balance"),
    };
  });
}
export function moduleRows(
  book: Snapshot,
  slug: string,
  resource: string,
): Row[] {
  if (slug === "parties" || slug === "receivables")
    return balances(book).filter(
      (r) => slug !== "receivables" || n(r, "balance") > 0,
    );
  const records = book.records[resource] || [];
  if (slug === "items")
    return records.map((r) => ({
      ...r,
      sellable: (book.records.lots || [])
        .filter((l) => l.productId === r.id)
        .reduce((s, l) => s + n(l, "sellable"), 0),
    }));
  if (slug === "payment-in" || slug === "payment-out")
    return records.filter(
      (r) => r.direction === (slug === "payment-in" ? "in" : "out"),
    );
  if (slug === "slabs")
    return records.map((r) => ({
      ...r,
      area: Math.round(n(r, "length") * n(r, "width") * 100) / 100,
    }));
  if (slug === "cheques")
    return records.map((r) => ({ ...r, reference: r.reference || r.number }));
  if (slug === "follow-ups")
    return records.map((r) => ({ ...r, dueDate: r.dueDate || r.date }));
  if (slug === "loans")
    return records.map((r) => {
      const annualRate = Number(r.interestRate ?? r.rate ?? 0);
      const ir = annualRate / 1200;
      const months = n(r, "months");
      return {
        ...r,
        interestRate: annualRate,
        emi:
          months > 0
            ? Math.round(
                ir
                  ? (n(r, "principal") * ir) / (1 - (1 + ir) ** -months)
                  : n(r, "principal") / months,
              )
            : n(r, "emi"),
      };
    });
  if (slug === "partners")
    return records.map((r) => {
      const matches = (c: Row) =>
        c.partnerId === r.id || c.partnerId === r.partyId;
      const earned = (book.records.commissions || [])
        .filter(matches)
        .reduce((s, c) => s + n(c, "amount"), 0);
      const paid = (book.records.commissionPayments || [])
        .filter(matches)
        .reduce((s, c) => s + n(c, "amount"), 0);
      return { ...r, earned, paid, payable: earned - paid };
    });
  return records;
}
export async function excel(
  name: string,
  columns: string[],
  rows: Row[],
  book: Snapshot,
  t: T,
  locale: string,
) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const sheet = wb.addWorksheet("TileBook");
  sheet.columns = columns.map((k) => ({
    header: t(k),
    key: k,
    width: currencyFields.has(k) ? 19 : 26,
  }));
  for (const row of rows)
    sheet.addRow(
      columns.map((k) =>
        currencyFields.has(k) && row[k] !== undefined
          ? n(row, k) / 100
          : fmt(row, k, book, t, locale),
      ),
    );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF14183F" },
  };
  const bytes = await wb.xlsx.writeBuffer();
  download(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    name + ".xlsx",
  );
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function share(text: string, phone = "") {
  const digits = phone.replace(/\D/g, "");
  window.open(
    "https://wa.me/" +
      (digits.length === 10 ? "91" : "") +
      digits +
      "?text=" +
      encodeURIComponent(text),
    "_blank",
    "noopener,noreferrer",
  );
}
