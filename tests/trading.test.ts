import { describe, expect, it } from "vitest";
import {
  balances,
  canWrite,
  label,
  lookup,
  moduleRows,
  n,
  today,
  type Row,
  type Snapshot,
} from "@/features/model";
import { report } from "@/features/reporting";
import { readVcard, tallyMasters } from "@/features/exchange";
import { readablePhoto } from "@/lib/photo";
const scope = { start: "", end: "", user: "" };
const party = { id: "p", name: "Sai Builders", openingBalance: 0 },
  product = {
    id: "i",
    name: "White <600> & gloss",
    baseUnit: "Box",
    purchasePrice: 100,
    salePrice: 200,
  };
const invoice: Row = {
  id: "inv",
  number: "INV-1",
  date: "2026-11-01",
  partyId: "p",
  total: 23600,
  lines: [
    {
      id: "line",
      productId: "i",
      lotId: "L",
      hsn: "6907",
      qty: 100,
      unit: "box",
      taxable: 20000,
      tax: 3600,
      cgst: 1800,
      sgst: 1800,
      igst: 0,
      amount: 23600,
    },
  ],
};
const mk = (records: Record<string, Row[]> = {}): Snapshot => ({
  business: { id: "firm", name: "Demo" },
  role: "Owner",
  userId: "user",
  records: {
    parties: [party],
    products: [product],
    saleInvoices: [invoice],
    ...records,
  },
});
describe("Trading registers", () => {
  it("includes receipts, payments and returns in who owes me", () => {
    const b = mk({
      payments: [{ id: "in", partyId: "p", amount: 5000, direction: "in" }],
      creditNotes: [{ id: "cn", partyId: "p", total: 1000 }],
    });
    expect(balances(b)[0].balance).toBe(17600);
  });
  it("sums available quantity across lots without adding physical, reserved or display twice", () => {
    const b = mk({
      lots: [
        {
          id: "1",
          productId: "i",
          physical: 100,
          reserved: 20,
          display: 10,
          sellable: 70,
        },
        { id: "2", productId: "i", sellable: 5 },
      ],
    });
    expect(moduleRows(b, "items", "products")[0].sellable).toBe(75);
  });
  it("groups HSN tax amounts including interstate supplies", () => {
    const b = mk();
    expect(report(b, "hsn-summary", scope).rows[0]).toMatchObject({
      hsn: "6907",
      taxable: 20000,
      tax: 3600,
      cgst: 1800,
      sgst: 1800,
      igst: 0,
    });
  });
  it("honours the shop dead-stock threshold even when print preferences are first", () => {
    const since = new Date(Date.parse(today()) - 40 * 86400000)
      .toISOString()
      .slice(0, 10);
    const b = mk({
      settings: [
        { id: "1", key: "print" },
        { id: "2", key: "preferences", value: { deadStockDays: 30 } },
      ],
      lots: [{ id: "1", productId: "i", receivedDate: since, sellable: 40 }],
    });
    expect(report(b, "dead-stock", scope).rows[0].days).toBe(40);
  });
  it("accounts for advance assigned to an invoice", () => {
    const b = mk({
      saleOrders: [
        { id: "1", received: 50000, advanceApplied: 40000, status: "Open" },
      ],
    });
    expect(report(b, "advance-held", scope).rows[0].advance).toBe(10000);
  });
  it("computes partner payable from accruals, reversals, and payouts", () => {
    const b = mk({
      partners: [{ id: "rule", partyId: "p", kind: "percent", rate: 2 }],
      commissions: [
        { id: "1", partnerId: "p", amount: 400 },
        { id: "2", partnerId: "p", amount: -50 },
      ],
      commissionPayments: [{ id: "3", partnerId: "p", amount: 200 }],
    });
    expect(moduleRows(b, "partners", "partners")[0].payable).toBe(150);
    expect(label(lookup(b, "partners", "p"), b)).toBe("Sai Builders");
  });
  it("supports legacy seed loan and cheque fields", () => {
    const b = mk({
      loans: [{ id: "1", rate: 12, months: 12, principal: 120000 }],
      cheques: [{ id: "2", number: "000555" }],
    });
    expect(n(moduleRows(b, "loans", "loans")[0], "emi")).toBe(10662);
    expect(moduleRows(b, "cheques", "cheques")[0].reference).toBe("000555");
  });
  it("tracks cash movements without counting bank receipts as cash", () => {
    const b = mk({
      cashAdjustments: [{ id: "1", amount: 30000, direction: "in" }],
      payments: [{ id: "2", amount: 10000, direction: "in", mode: "upi" }],
      staffAdvances: [{ id: "3", amount: 3000 }],
      expenses: [{ id: "4", amount: 1000, mode: "Cash" }],
    });
    const rows = report(b, "cash-ledger", scope).rows;
    expect(
      rows.reduce(
        (s, r) => s + n(r, "amount") * (r.direction === "in" ? 1 : -1),
        0,
      ),
    ).toBe(26000);
  });
  it("hides disallowed record actions and premium writes", () => {
    const b = mk();
    expect(canWrite({ ...b, role: "Accountant" }, "products")).toBe(false);
    expect(canWrite({ ...b, role: "Godown" }, "damage")).toBe(true);
    expect(canWrite({ ...b, role: "Counter" }, "users")).toBe(false);
    expect(
      canWrite(
        {
          ...b,
          entitlements: { premium: false, plan: "basic", trialEnds: "" },
        },
        "campaigns",
      ),
    ).toBe(false);
  });
  it("exports escaped XML masters and reads vCard contacts", () => {
    expect(tallyMasters([product], [party])).toContain(
      "White &lt;600&gt; &amp; gloss",
    );
    expect(
      readVcard(
        "BEGIN:VCARD\r\nFN:Sai Builders\r\nTEL;TYPE=CELL:9999999999\r\nEND:VCARD",
      ),
    ).toEqual([
      {
        resource: "parties",
        data: { name: "Sai Builders", phone: "9999999999", type: "customer" },
      },
    ]);
  });
  it("accepts only recorded photos or protected storage paths", () => {
    expect(
      readablePhoto("/api/media/purchase-bills/abc/0123.jpg"),
    ).toBeTruthy();
    expect(readablePhoto("https://example.com/a.jpg")).toBe("");
  });
});
