import { calculateInvoice } from "../domain/rules";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import or from "./messages/or.json";

export const messages = { en, hi, or };
export type Language = keyof typeof messages;
export type Heading = keyof typeof en;
export type Paper = "A4" | "A5" | "80mm";
export type Copy = "original" | "duplicate" | "triplicate";
type Data = Record<string, unknown>;
export type PrintSnapshot = {
  business: object;
  records: Record<string, unknown[]>;
};
export const docKinds = {
  saleInvoices: "invoice",
  estimates: "estimate",
  proformas: "proforma",
  saleOrders: "order",
  challans: "challan",
  creditNotes: "credit",
  purchaseBills: "purchase",
  purchaseOrders: "po",
  debitNotes: "debit",
  payments: "payment",
  parties: "statement",
} as const;
export type DocumentKind =
  (typeof docKinds)[keyof typeof docKinds] | "voucher" | "retail";

const data = (value: unknown): Data =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Data)
    : {};
const list = (value: unknown) => (Array.isArray(value) ? value.map(data) : []);
function str(row: Data, ...names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}
function num(row: Data, key: string, fallback = 0) {
  const value = row[key];
  if (
    (typeof value === "number" ||
      (typeof value === "string" && value.trim())) &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return fallback;
}
export type PrintQuery = {
  paper?: Paper;
  lang?: Language;
  uiLang?: Language;
  copy?: Copy;
  retail?: boolean;
};
function template(settings: Data, options: PrintQuery) {
  const select = (key: string) => settings[key] !== false;
  const savedPaper = str(settings, "paper");
  const savedLang =
    str(settings, "printLanguage") ||
    options.uiLang ||
    str(settings, "language");
  const accent = str(settings, "accent");
  const logo = str(settings, "logo");
  const count = Math.max(
    1,
    Math.min(3, Math.floor(num(settings, "copies", 1))),
  );
  return {
    lang:
      options.lang ??
      (savedLang === "hi" || savedLang === "or" ? savedLang : "en"),
    paper:
      options.paper ??
      (savedPaper === "A5" || savedPaper === "80mm" ? savedPaper : "A4"),
    labels: options.copy
      ? [options.copy]
      : (["original", "duplicate", "triplicate"] as const).slice(0, count),
    accent: /^#[a-f\d]{6}$/i.test(accent) ? accent : "#087c7c",
    logo:
      logo.length < 3_000_000 &&
      /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(logo)
        ? logo
        : "",
    showLot: select("showLot"),
    showHsn: select("showHsn"),
    showSqft: select("showSqft"),
    showDiscount: select("showDiscount"),
    terms: str(settings, "terms"),
    footer: str(settings, "footer"),
  };
}

const partyInfo = (row: Data) => ({
  name: str(row, "name", "partyName"),
  address: str(row, "address", "billingAddress"),
  ship: str(row, "shippingAddress", "address", "billingAddress"),
  gstin: str(row, "gstin"),
  phone: str(row, "phone"),
});

function getStatement(records: Record<string, unknown[]>, party: Data) {
  const entries: {
    id: string;
    reference: string;
    date: string;
    kind: DocumentKind;
    debit: number;
    credit: number;
  }[] = [];
  for (const [resource, kind] of Object.entries(docKinds)) {
    if (
      !(
        ["invoice", "purchase", "credit", "debit", "payment"] as string[]
      ).includes(kind)
    )
      continue;
    for (const row of list(records[resource])) {
      if (row.partyId !== party.id) continue;
      const amount =
        kind === "payment" ? num(row, "amount") : num(row, "total");
      const out = String(row.direction).toLowerCase() === "out";
      const debit =
        kind === "invoice" || kind === "debit" || (kind === "payment" && out);
      entries.push({
        id: str(row, "id"),
        reference: str(row, "number", "reference", "documentNo"),
        date: str(row, "date", "createdAt"),
        kind: kind === "payment" && out ? "voucher" : kind,
        debit: debit ? amount : 0,
        credit: debit ? 0 : amount,
      });
    }
  }
  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.reference.localeCompare(b.reference) ||
      a.id.localeCompare(b.id),
  );
  const opening = num(party, "openingBalance");
  return {
    opening,
    entries,
    closing: entries.reduce(
      (value, row) => value + row.debit - row.credit,
      opening,
    ),
  };
}

export function buildPrintModel(
  snapshot: PrintSnapshot,
  id: string,
  options: PrintQuery = {},
) {
  const { records } = snapshot;
  const byId = (resource: string, key: unknown) =>
    list(records[resource]).find(
      (row) => typeof key === "string" && row.id === key,
    ) ?? {};
  const business = data(snapshot.business);
  const settingsRows = list(records.settings);
  const settingsRow =
    settingsRows.find((row) => row.key === "preferences") ??
    settingsRows[0] ??
    {};
  const settings = { ...settingsRow, ...data(settingsRow.value) };
  const prefs = template(settings, options);
  let record: Data | undefined;
  let kind: DocumentKind = "invoice";
  for (const [resource, k] of Object.entries(docKinds)) {
    record = list(records[resource]).find((row) => row.id === id);
    if (record) {
      kind = k;
      break;
    }
  }
  if (!record) return null;
  const row = record;
  if (kind === "invoice" && options.retail) kind = "retail";
  if (kind === "payment" && String(row.direction).toLowerCase() === "out")
    kind = "voucher";
  const party = kind === "statement" ? row : byId("parties", row.partyId);
  const partyDetails = partyInfo(party);
  // Freeze document-supplied snapshots where present. Master data is a fallback for legacy rows.
  partyDetails.name = str(row, "partyName") || partyDetails.name;
  partyDetails.address = str(row, "billingAddress") || partyDetails.address;
  partyDetails.ship =
    str(row, "shippingAddress") || partyDetails.ship || partyDetails.address;
  partyDetails.gstin = str(row, "partyGstin") || partyDetails.gstin;
  const bank = byId("banks", row.bankId);
  const banks = list(records.banks);
  const bankRow = bank.id
    ? bank
    : (banks.find((b) => str(b, "upiId", "upi")) ?? banks[0] ?? {});
  const linesIn = list(row.lines);
  const state = str(row, "placeOfSupply") || str(business, "state");
  const interstate =
    row.interstate === true ||
    linesIn.some((line) => num(line, "igst") > 0) ||
    (!linesIn.some((line) => num(line, "cgst") + num(line, "sgst") > 0) &&
      Boolean(
        state &&
        str(business, "state") &&
        state.toLowerCase() !== str(business, "state").toLowerCase(),
      ));
  const lines = linesIn.map((line) => {
    const product = byId("products", line.productId);
    const lot = byId("lots", line.lotId);
    const qty = num(line, "qty");
    const ratePaise = num(line, "rate");
    const discountPaise = num(line, "discount");
    const gstRate = num(line, "gstRate", num(product, "gstRate"));
    const fallback = calculateInvoice(
      [{ qty, ratePaise, discountPaise, gstRate }],
      interstate,
    ).lines[0];
    const taxable = num(line, "taxable", fallback.taxablePaise);
    const cgst = num(line, "cgst", fallback.cgstPaise);
    const sgst = num(line, "sgst", fallback.sgstPaise);
    const igst = num(line, "igst", fallback.igstPaise);
    return {
      description:
        str(line, "productName", "description", "name") || str(product, "name"),
      hsn: str(line, "hsn") || str(product, "hsn"),
      lotNo: str(line, "lotNo") || str(lot, "lotNo"),
      shade: str(line, "shade") || str(lot, "shade"),
      unit: str(line, "unit") || str(product, "baseUnit"),
      room: str(line, "room"),
      qty,
      rate: ratePaise,
      discount: discountPaise,
      gstRate,
      taxable,
      cgst,
      sgst,
      igst,
      amount: num(line, "amount", taxable + cgst + sgst + igst),
      sqft: num(line, "sqft"),
    };
  });
  const sum = (
    field:
      "taxable" | "cgst" | "sgst" | "igst" | "amount" | "sqft" | "discount",
  ) => lines.reduce((a, line) => a + line[field], 0);
  const summary = new Map<
    string,
    {
      hsn: string;
      gstRate: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
    }
  >();
  const quantities = new Map<string, number>();
  for (const line of lines) {
    const key = line.hsn + "/" + line.gstRate;
    const entry = summary.get(key) ?? {
      hsn: line.hsn,
      gstRate: line.gstRate,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    for (const field of ["taxable", "cgst", "sgst", "igst"] as const)
      entry[field] += line[field];
    summary.set(key, entry);
    quantities.set(line.unit, (quantities.get(line.unit) ?? 0) + line.qty);
  }
  const isPayment = kind === "payment" || kind === "voucher";
  const total = isPayment
    ? num(row, "amount")
    : num(row, "total", Math.round(sum("amount") / 100) * 100);
  const received = num(row, "received");
  const allDocs = Object.keys(docKinds)
    .filter((key) => key !== "parties" && key !== "payments")
    .flatMap((key) => list(records[key]));
  const reference = allDocs.find(
    (doc) => doc.id === (row.sourceId || row.documentId),
  );
  const partnerKey = row.partnerId || row.referredById;
  const partner = byId("partners", partnerKey);
  const referred = byId("parties", partner.partyId || partnerKey);
  const operator = list(records.users).find(
    (user) => user.userId === row.createdBy,
  );
  const prepared =
    str(row, "salesperson", "preparedBy", "createdByName") ||
    str(operator ?? {}, "name");
  return {
    kind,
    prefs,
    id,
    number: str(row, "number", "reference", "documentNo"),
    date: str(row, "date", "createdAt"),
    dueDate: str(row, "dueDate"),
    state,
    business: { ...partyInfo(business), state: str(business, "state") },
    bank: {
      name: str(settings, "bankName") || str(bankRow, "bankName", "name"),
      account:
        str(settings, "bankAccount") ||
        str(bankRow, "accountNo", "accountNumber"),
      ifsc: str(settings, "ifsc") || str(bankRow, "ifsc"),
      upi:
        str(settings, "upi") ||
        str(bankRow, "upiId", "upi") ||
        str(business, "upiId", "upi"),
    },
    party: partyDetails,
    lines,
    hsn: Array.from(summary.values()),
    quantities: Array.from(quantities),
    taxable: num(row, "taxable", sum("taxable")),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    igst: sum("igst"),
    tax: num(row, "tax", sum("cgst") + sum("sgst") + sum("igst")),
    discount: sum("discount"),
    sqft: sum("sqft"),
    total,
    received,
    balance: num(row, "balance", total - received),
    roundOff: num(row, "roundOff", total - sum("amount")),
    interstate,
    note: str(row, "notes", "note"),
    vehicle: str(row, "vehicleNo", "vehicle"),
    eway: str(row, "ewayBill", "ewayBillNo"),
    irn: str(row, "irn"),
    order: str(row, "orderReference", "orderNo"),
    challan: str(row, "challanReference", "challanNo"),
    reference: str(reference ?? {}, "number") || str(row, "sourceNumber"),
    referred: str(row, "partnerName", "referredBy") || str(referred, "name"),
    prepared,
    mode: str(row, "mode", "paymentMode"),
    statement: kind === "statement" ? getStatement(records, party) : null,
  };
}
export type PrintModel = NonNullable<ReturnType<typeof buildPrintModel>>;
