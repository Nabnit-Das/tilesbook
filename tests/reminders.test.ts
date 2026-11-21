import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { openEmbedded, asUser } from "../src/server/embedded";
import type { Row, Snapshot, MutationResult } from "../src/types/database";

const shop = "10000000-0000-4000-8000-000000000001",
  owner = "00000000-0000-4000-8000-000000000001",
  counter = "00000000-0000-4000-8000-000000000002";
const partyId = "00000004-0000-4000-8000-000000000001",
  productId = "00000002-0000-4000-8000-000000000001",
  lotId = "00000003-0000-4000-8000-000000000001";
let db: PGlite, day: string, invoice: Row;
const line = { productId, lotId, qty: 1, rate: 10000 };
const options = {
  whatsappEnabled: true,
  smsEnabled: true,
  paymentReminders: true,
  dailyOwnerSummary: true,
  inactivePartnerReminders: true,
  ownerSummaryTime: "21:00",
  inactivePartnerDays: 30,
  dueDays: 3,
};
async function write(resource: string, data: object) {
  const result = await asUser(db, owner, (tx) =>
    tx.query<{ data: MutationResult }>(
      "select public.tilebook_mutate($1,$2,'create',$3,$4) data",
      [shop, resource, data, randomUUID()],
    ),
  );
  return result.rows[0].data.row;
}
const preferences = (overrides: object = {}) =>
  write("settings", {
    key: "preferences",
    value: { ...options, ...overrides },
  });
const state = async () =>
  (
    await asUser(db, owner, (tx) =>
      tx.query<{ s: Snapshot }>("select public.tilebook_snapshot($1) s", [
        shop,
      ]),
    )
  ).rows[0].s;
const timed = async (time: string) =>
  (
    await db.query<{ r: { queued: number; reminders: number } }>(
      "select tilebook.prepare_messages($1,$2::timestamptz) r",
      [shop, day + "T" + time + "Z"],
    )
  ).rows[0].r;
beforeAll(async () => {
  db = await openEmbedded();
  day = (
    await db.query<{ d: string }>(
      "select (now() at time zone 'Asia/Kolkata')::date::text d",
    )
  ).rows[0].d;
}, 30000);
afterAll(async () => {
  if (db) await db.close();
});
describe.sequential(
  "Reminder preparation and configured message triggers",
  () => {
    it("queues one invoice per enabled channel including a PDF reference, and honors invoice/dispatch switches", async () => {
      await preferences();
      invoice = await write("saleInvoices", {
        partyId,
        date: day,
        dueDate: day,
        lines: [line],
      });
      const messages = (await state()).records.outbox.filter(
        (q) => q.documentId === invoice.id,
      );
      expect(messages.map((q) => q.channel).sort()).toEqual([
        "sms",
        "whatsapp",
      ]);
      expect(messages[0].attachment).toEqual({
        kind: "invoicePdf",
        documentId: invoice.id,
      });
      expect(messages[0].recipient).toBe("+919876543210");
      await preferences({ invoiceMessage: false, confirmDelivery: false });
      const muted = await write("saleInvoices", { partyId, lines: [line] });
      const order = await write("saleOrders", {
        partyId,
        lines: [{ ...line, qty: 2 }],
      });
      const partial = () =>
        write("challans", { sourceId: order.id, partyId, lines: [line] });
      const first = await partial();
      await preferences({ confirmDelivery: true, whatsappEnabled: false });
      const second = await partial();
      const outbox = (await state()).records.outbox;
      expect(
        outbox.filter(
          (q) => q.documentId === muted.id || q.documentId === first.id,
        ),
      ).toHaveLength(0);
      expect(
        outbox.filter((q) => q.documentId === second.id).map((q) => q.channel),
      ).toEqual(["sms"]);
    });
    it("prepares payment and inactive-partner reminders idempotently and queues the owner summary after the IST cutoff", async () => {
      await preferences();
      await timed("15:29:00");
      const before = (await state()).records;
      expect(before.outbox.some((q) => q.kind === "dailySummary")).toBe(false);
      expect(
        before.outbox.filter(
          (q) => q.kind === "paymentReminder" && q.documentId === invoice.id,
        ),
      ).toHaveLength(2);
      expect(
        before.reminders.filter(
          (q) => q.kind === "paymentReminder" && q.documentId === invoice.id,
        ),
      ).toHaveLength(1);
      expect(before.outbox.some((q) => q.kind === "inactivePartner")).toBe(
        true,
      );
      const after = await timed("15:30:00");
      expect(after.queued).toBe(2);
      expect(
        (await state()).records.outbox.filter(
          (q) => q.kind === "dailySummary" && q.reference,
        ),
      ).toHaveLength(2);
      expect(await timed("15:45:00")).toEqual({ queued: 0, reminders: 0 });
      await write("payments", {
        partyId,
        documentId: invoice.id,
        direction: "in",
        amount: invoice.total,
        mode: "cash",
      });
      await timed("15:46:00");
      const settled = (await state()).records;
      expect(
        settled.outbox
          .filter(
            (q) => q.kind === "paymentReminder" && q.documentId === invoice.id,
          )
          .every((q) => q.status === "Cancelled"),
      ).toBe(true);
      expect(
        settled.reminders.find((q) => q.documentId === invoice.id)?.status,
      ).toBe("Closed");
    });
    it("allows authorised per-shop preparation while denying foreign scopes, staff and public scheduler execution", async () => {
      const prepare = (user: string, business: string) =>
        asUser(db, user, (tx) =>
          tx.query("select public.tilebook_prepare_messages($1)", [business]),
        );
      await expect(prepare(owner, shop)).resolves.toBeTruthy();
      await expect(prepare(counter, shop)).rejects.toThrow(
        "Role cannot prepare messages",
      );
      await expect(prepare(owner, randomUUID())).rejects.toThrow(
        "Business access denied",
      );
      await expect(
        asUser(db, owner, (tx) =>
          tx.query("select tilebook.prepare_scheduled_messages()"),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  },
);
