import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pgtap } from "@electric-sql/pglite/pgtap";
import { openEmbedded, asUser } from "../src/server/embedded";
import type { MutationResult, Row, Snapshot } from "../src/types/database";

const owner = "00000000-0000-4000-8000-000000000001";
const counter = "00000000-0000-4000-8000-000000000002";
const shop = "10000000-0000-4000-8000-000000000001";
const foreignShop = "10000000-0000-4000-8000-000000000099";
const firstItem = "00000002-0000-4000-8000-000000000001";
const firstLot = "00000003-0000-4000-8000-000000000001";
const oldLot = "00000003-0000-4000-8000-000000000012";
const party = "00000004-0000-4000-8000-000000000001";
const partner = "00000004-0000-4000-8000-000000000003";
let db: PGlite;
beforeAll(async () => {
  db = await openEmbedded(undefined, { extensions: { pgtap } });
  await db.exec(
    "create schema extensions; grant usage on schema extensions to authenticated",
  );
  await db.query("insert into public.businesses(id,name) values($1,$2)", [
    foreignShop,
    "Other shop",
  ]);
}, 30_000);
afterAll(async () => {
  if (db) await db.close();
});
async function snapshot(who = owner, b = shop) {
  return (
    await asUser(db, who, (tx) =>
      tx.query<{ data: Snapshot }>("select tilebook_snapshot($1) as data", [b]),
    )
  ).rows[0].data;
}
async function post(
  resource: string,
  data: object,
  options: {
    who?: string;
    business?: string;
    action?: string;
    id?: string;
  } = {},
) {
  return (
    await asUser(db, options.who || owner, (tx) =>
      tx.query<{ data: MutationResult }>(
        "select tilebook_mutate($1,$2,$3,$4,$5) as data",
        [
          options.business || shop,
          resource,
          options.action || "create",
          data,
          options.id || randomUUID(),
        ],
      ),
    )
  ).rows[0].data.row;
}
const line = (qty: number, lotId = firstLot) => ({
  productId: firstItem,
  lotId,
  qty,
  rate: 319600,
});
const lineRows = (row: Row) => row.lines as Row[];
const getLot = async (id = firstLot) =>
  (await snapshot()).records.lots.find((l) => l.id === id)!;
describe.sequential(
  "PostgreSQL migrations, access controls and atomic posting",
  () => {
    it("runs the pgTAP tenant and role suite on PostgreSQL", async () => {
      const sql = await readFile(
        "supabase/tests/database/tenant_access.test.sql",
        "utf8",
      );
      const result = await db.exec(sql);
      const tap = result.flatMap((command) =>
        command.rows.flatMap((row) => Object.values(row).map(String)),
      );
      expect(tap.filter((line) => /^not ok/.test(line))).toEqual([]);
      expect(tap.filter((line) => /^ok \d+/.test(line))).toHaveLength(13);
    });
    it("seeds the full demo including the reference invoice and dead lot", async () => {
      const s = await snapshot();
      expect(s.records.products).toHaveLength(25);
      expect(s.records.lots).toHaveLength(12);
      expect(s.records.parties).toHaveLength(20);
      expect(s.records.saleInvoices).toHaveLength(30);
      expect(s.records.saleOrders).toHaveLength(5);
      expect(s.records.challans).toHaveLength(2);
      expect(s.records.creditNotes).toHaveLength(3);
      expect(s.records.damage).toHaveLength(6);
      expect(
        s.records.saleInvoices.find((r) => r.number === "INV-113"),
      ).toMatchObject({
        total: 9042100,
        received: 5000000,
        balance: 4042100,
        roundOff: -4,
      });
      expect(await getLot(oldLot)).toMatchObject({
        physical: 40,
        sellable: 40,
      });
    });
    it("enables RLS on every public table and denies both foreign reads and foreign writes", async () => {
      const { rows } = await db.query(
        "select relname from pg_class join pg_namespace on relnamespace=pg_namespace.oid where nspname='public' and relkind='r' and not relrowsecurity",
      );
      expect(rows).toEqual([]);
      await expect(snapshot(owner, foreignShop)).rejects.toThrow(
        "Business access denied",
      );
      await expect(
        post(
          "parties",
          { name: "Cross-tenant write" },
          { business: foreignShop },
        ),
      ).rejects.toThrow("Business access denied");
      const otherParty = randomUUID();
      await db.query(
        "insert into public.parties(id,business_id,payload) values ($1,$2,$3)",
        [otherParty, foreignShop, { name: "Private buyer" }],
      );
      await expect(
        post("saleInvoices", { partyId: otherParty, lines: [line(1)] }),
      ).rejects.toThrow("Missing or inaccessible");
      expect(
        (await snapshot()).records.parties.some((p) => p.id === otherParty),
      ).toBe(false);
    });
    it("hides supplier prices and profit data and blocks direct authenticated base table access", async () => {
      const s = await snapshot(counter);
      expect(s.records.products[0]).not.toHaveProperty("purchasePrice");
      expect(s.records.purchaseBills).toEqual([]);
      expect(s.records.productCosts).toEqual([]);
      expect(s.records.audit).toEqual([]);
      expect(s.records.damage.every((d) => d.loss === undefined)).toBe(true);
      await expect(
        asUser(db, counter, (tx) =>
          tx.query("select * from public.product_costs"),
        ),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        post(
          "products",
          { name: "New item", purchasePrice: 20 },
          { who: counter },
        ),
      ).rejects.toThrow("Role cannot");
    });
    it("keeps reservation, phase dispatch, conversion and advance receipt consistent", async () => {
      const before = await getLot();
      const order = await post("saleOrders", {
        partyId: party,
        lines: [line(200)],
        received: 100000,
      });
      const reserved = await getLot();
      expect(reserved.physical).toBe(before.physical);
      expect(reserved.reserved).toBe(Number(before.reserved) + 200);
      const dispatch = async (qty: number) =>
        post("challans", {
          partyId: party,
          sourceId: order.id,
          lines: [{ ...line(qty), sourceLineId: lineRows(order)[0].id }],
        });
      const first = await dispatch(60);
      let s = await snapshot();
      let o = s.records.saleOrders.find((x) => x.id === order.id)!;
      expect(
        Number(lineRows(o)[0].qty) - Number(lineRows(o)[0].delivered),
      ).toBe(140);
      expect((await getLot()).physical).toBe(Number(before.physical) - 60);
      await dispatch(140);
      s = await snapshot();
      o = s.records.saleOrders.find((x) => x.id === order.id)!;
      expect(o.status).toBe("Closed");
      expect(lineRows(o)[0].delivered).toBe(200);
      expect((await getLot()).reserved).toBe(before.reserved);
      const receipts = s.records.payments.length;
      const bill = await post("saleInvoices", {
        partyId: party,
        sourceId: first.id,
        lines: [{ ...line(60), sourceLineId: lineRows(first)[0].id }],
      });
      expect(bill.received).toBe(100000);
      expect((await snapshot()).records.payments).toHaveLength(receipts);
      expect((await getLot()).physical).toBe(Number(before.physical) - 200);
      await expect(dispatch(1)).rejects.toThrow("outstanding balance");
    });
    it("requires a reason for mixed lots, rejects wrong-lot and excess returns, and reverses commissions", async () => {
      const before = await getLot();
      await expect(
        post("saleInvoices", {
          partyId: party,
          lines: [line(1), line(1, oldLot)],
        }),
      ).rejects.toThrow("Mixed lots");
      const mixed = await post("saleInvoices", {
        partyId: party,
        lines: [line(1), line(1, oldLot)],
        overrideReason: "Buyer approved sample comparison",
      });
      expect(mixed.total).toBeGreaterThan(0);
      const sale = await post("saleInvoices", {
        partyId: party,
        partnerId: partner,
        lines: [line(3)],
      });
      const refund = (qty: number, lotId: string) =>
        post("creditNotes", {
          partyId: party,
          sourceId: sale.id,
          lines: [{ ...line(qty, lotId), sourceLineId: lineRows(sale)[0].id }],
        });
      await expect(refund(1, oldLot)).rejects.toThrow("original document");
      const credit = await refund(1, firstLot);
      await expect(refund(3, firstLot)).rejects.toThrow(
        "exceeds original quantity",
      );
      expect((await getLot()).physical).toBe(Number(before.physical) - 3);
      const s = await snapshot();
      expect(
        s.records.commissions.find((x) => x.documentId === sale.id)?.amount,
      ).toBe(19176);
      expect(
        s.records.commissions.find((x) => x.documentId === credit.id)?.amount,
      ).toBe(-6392);
    });
    it("returns the frozen original unit price, discount and tax allocation", async () => {
      const sale = await post("saleInvoices", {
        partyId: party,
        lines: [{ ...line(2), gstRate: 5, discount: 10000 }],
      });
      const credit = await post("creditNotes", {
        partyId: party,
        sourceId: sale.id,
        lines: [
          {
            ...line(1),
            rate: 400000,
            gstRate: 18,
            sourceLineId: lineRows(sale)[0].id,
          },
        ],
      });
      expect(lineRows(credit)[0]).toMatchObject({
        gstRate: 5,
        rate: 319600,
        discount: 5000,
        taxable: 314600,
        tax: 15730,
      });
    });
    it("derives display, damage, transfer and count from the movement ledger", async () => {
      const before = await getLot();
      const b = (await snapshot()).records.branches;
      const main = b.find((v) => v.name === "Main Godown")!,
        show = b.find((v) => v.name === "Showroom")!;
      await post("display", { lotId: firstLot, qty: 2, branchId: main.id });
      expect((await getLot()).physical).toBe(before.physical);
      expect((await getLot()).sellable).toBe(Number(before.sellable) - 2);
      await post("transfers", {
        lotId: firstLot,
        qty: 5,
        fromBranchId: main.id,
        toBranchId: show.id,
      });
      expect((await getLot()).physical).toBe(before.physical);
      const count = await post("stockCounts", {
        lotId: firstLot,
        counted: 4,
        branchId: show.id,
      });
      expect(count.difference).toBe(-1);
      const damage = await post("damage", {
        lotId: firstLot,
        qty: 1,
        reason: "Delivery",
        branchId: show.id,
      });
      expect(damage.loss).toBeGreaterThan(0);
      expect((await getLot()).physical).toBe(Number(before.physical) - 2);
    });
    it("replays an offline request once, rejects changed retries and rolls back failed multi-line sales", async () => {
      const req = randomUUID(),
        input = { partyId: party, lines: [line(1)] };
      const before = await getLot();
      const [a, b] = await Promise.all([
        post("saleInvoices", input, { id: req }),
        post("saleInvoices", input, { id: req }),
      ]);
      expect(a.id).toBe(b.id);
      expect((await getLot()).physical).toBe(Number(before.physical) - 1);
      await expect(
        post("saleInvoices", { ...input, notes: "Changed" }, { id: req }),
      ).rejects.toThrow("Request id already in use");
      await expect(
        post("saleInvoices", {
          partyId: party,
          lines: [line(1), line(999999)],
        }),
      ).rejects.toThrow("Insufficient sellable stock");
      expect((await getLot()).physical).toBe(Number(before.physical) - 1);
    });
    it("queues a discount for the owner and posts the saved draft exactly once on approval", async () => {
      await post("settings", {
        key: "preferences",
        value: { discountLimit: 10 },
      });
      const before = await getLot();
      const draft = {
        partyId: party,
        lines: [{ ...line(1), discount: 100000 }],
      };
      const pending = await post("saleInvoices", draft, { who: counter });
      expect(pending.pendingApproval).toBe(true);
      expect((await getLot()).physical).toBe(before.physical);
      await expect(
        post(
          "approvals",
          { id: pending.id, status: "Approved" },
          { who: counter, action: "update" },
        ),
      ).rejects.toThrow("Role cannot");
      const decision = await post(
        "approvals",
        { id: pending.id, status: "Approved" },
        { action: "update" },
      );
      expect(decision.documentId).toBeTruthy();
      expect((await getLot()).physical).toBe(Number(before.physical) - 1);
      await expect(
        post(
          "approvals",
          { id: pending.id, status: "Approved" },
          { action: "update" },
        ),
      ).rejects.toThrow("already been decided");
    });
    it("uses party credit from unapplied receipts and blocks a sale over the configured limit", async () => {
      const buyer = await post("parties", {
        name: "Credit customer",
        creditLimit: 200000,
      });
      await post("settings", {
        key: "preferences",
        value: { blockCreditLimit: true },
      });
      const sale = { partyId: buyer.id, lines: [line(1)] };
      await expect(post("saleInvoices", sale)).rejects.toThrow("credit limit");
      await post("payments", {
        partyId: buyer.id,
        direction: "in",
        mode: "cash",
        amount: 200000,
      });
      expect((await post("saleInvoices", sale)).balance).toBe(377100);
    });
    it("claims a logged breakage from the matching supplier without moving stock twice", async () => {
      const purchase = (await snapshot()).records.purchaseBills[0];
      const damage = await post("damage", {
        lotId: firstLot,
        qty: 1,
        reason: "Factory transit",
      });
      const claim = {
        partyId: purchase.partyId,
        sourceId: purchase.id,
        damageId: damage.id,
        lines: [
          { ...line(1), rate: 245000, sourceLineId: lineRows(purchase)[0].id },
        ],
      };
      const lost = await getLot();
      const debit = await post("debitNotes", claim);
      expect(debit.damageId).toBe(damage.id);
      expect((await getLot()).physical).toBe(lost.physical);
      await expect(post("debitNotes", claim)).rejects.toThrow(
        "already been claimed",
      );
    });
    it("limits purchase bill attachments to owners, managers and read-only accountants", async () => {
      const access: [string, boolean, boolean][] = [
        ["Owner", true, true],
        ["Manager", true, true],
        ["Accountant", true, false],
        ["Godown", false, false],
        ["Counter", false, false],
      ];
      await db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          counter,
        ]);
        for (const [role, read, write] of access) {
          await tx.query(
            "update public.memberships set role=$1 where user_id=$2 and business_id=$3",
            [role, counter, shop],
          );
          const { rows } = await tx.query(
            "select tilebook_can_access_file($1,'purchase-bills',false) as read, tilebook_can_access_file($1,'purchase-bills',true) as write, tilebook_can_access_file($2,'purchase-bills',false) as foreign_read",
            [shop, foreignShop],
          );
          expect(rows[0]).toEqual({ read, write, foreign_read: false });
        }
      });
    });
    it("expires trials without blocking regular lot-tracked invoices or historical reports", async () => {
      const trial = await snapshot();
      expect(trial.entitlements).toMatchObject({
        plan: "trial",
        premium: true,
      });
      const sub = trial.records.subscriptions[0];
      await post(
        "subscriptions",
        { id: sub.id, plan: "trial", trialEnds: "2020-01-01" },
        { action: "update" },
      );
      const basic = await snapshot();
      expect(basic.entitlements).toMatchObject({
        plan: "basic",
        premium: false,
      });
      expect(basic.records.partners.length).toBeGreaterThan(0);
      await expect(post("campaigns", { name: "New offer" })).rejects.toThrow(
        "Upgrade to Pro",
      );
      await expect(
        post("slabs", { slabNo: "A-9", length: 9, width: 4 }),
      ).rejects.toThrow("Upgrade to Pro");
      await expect(
        post("partners", { partyId: partner, kind: "percent", rate: 2 }),
      ).rejects.toThrow("Upgrade to Pro");
      const buyer = await post("parties", { name: "Basic plan walk-in" });
      const sale = await post("saleInvoices", { partyId: buyer.id, lines: [line(1)] });
      expect(sale.number).toBeTruthy();
      await post(
        "subscriptions",
        { id: sub.id, plan: "pro" },
        { action: "update" },
      );
      expect((await post("campaigns", { name: "Clearance" })).name).toBe(
        "Clearance",
      );
    });
    it("takes one restorable pre-write automatic archive per occupied IST day", async () => {
      await post("settings", {
        key: "preferences",
        value: { autoBackup: true },
      });
      const first = await post("parties", { name: "First daily change" });
      await post("parties", { name: "Second daily change" });
      const archives = (await snapshot()).records.backups.filter(
        (x) => x.kind === "automatic",
      );
      expect(archives).toHaveLength(1);
      await post("backups", { id: archives[0].id }, { action: "restore" });
      expect(
        (await snapshot()).records.parties.some((x) => x.id === first.id),
      ).toBe(false);
    });
    it("shares one party through an expiring token, revokes replaced links and restores a private archive", async () => {
      const link = await post("portalLinks", { partyId: party });
      const loadPortal = (token: unknown) =>
        db.transaction(async (tx) => {
          await tx.exec("set local role anon");
          return (
            await tx.query<{
              d: { party: { name: string }; documents: Row[] } | null;
            }>("select tilebook_portal($1) d", [token])
          ).rows[0].d;
        });
      const portal = await loadPortal(link.token);
      expect(portal?.party.name).toBe("Sai Builders");
      expect(portal?.documents.every((d) => !("purchasePrice" in d))).toBe(
        true,
      );
      const replacement = await post("portalLinks", { partyId: party });
      const allowedIds = new Set(
        Object.values((await snapshot()).records).flat().filter(r => r.partyId === party).map(r => r.id),
      );
      expect(portal?.documents.every(r => allowedIds.has(r.id))).toBe(true);
      await db.query("update public.portal_links set payload=jsonb_set(payload,'{expiresAt}',to_jsonb(now()-interval '1 minute')) where id=$1", [replacement.id]);
      expect(await loadPortal(replacement.token)).toBeNull();
      expect(await loadPortal(link.token)).toBeNull();
      const archive = await post("backups", { name: "Before edits" });
      const req = randomUUID(),
        payload = { name: "After snapshot", type: "Customer" };
      const p = await post("parties", payload, { id: req });
      await post("backups", { id: archive.id }, { action: "restore" });
      expect(
        (await snapshot()).records.parties.some((x) => x.id === p.id),
      ).toBe(false);
      await expect(post("parties", payload, { id: req })).rejects.toThrow(
        "restore reversed this entry",
      );
    });
  },
);
