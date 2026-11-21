import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { openEmbedded, asUser } from "../src/server/embedded";
import type { Row, Snapshot } from "../src/types/database";
import { parseStatementCsv } from "../src/features/statement-csv";
import en from "../src/features/extra-messages/en.json";
import hi from "../src/features/extra-messages/hi.json";
import or from "../src/features/extra-messages/or.json";
const party = "00000004-0000-4000-8000-000000000001";
const bank = "00000006-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000001";
const counter = "00000000-0000-4000-8000-000000000002";
const shop = "10000000-0000-4000-8000-000000000001";
let db: Awaited<ReturnType<typeof openEmbedded>>;
beforeAll(async () => {
  db = await openEmbedded();
}, 30000);
afterAll(async () => {
  if (db) await db.close();
});
async function post(
  k: string,
  data: object,
  action = "create",
  requestId: string = randomUUID(),
  actor = owner,
) {
  const res = await asUser(db, actor, (tx) =>
    tx.query<{ data: { row: Row } }>(
      "select tilebook_mutate($1,$2,$3,$4,$5) as data",
      [shop, k, action, data, requestId],
    ),
  );
  return res.rows[0].data.row;
}
async function read() {
  const res = await asUser(db, owner, (tx) =>
    tx.query<{ data: Snapshot }>("select tilebook_snapshot($1) as data", [
      shop,
    ]),
  );
  return res.rows[0].data.records;
}
it("parses quoted bank CSV as rupees with exact paise and rejects malformed rows", () => {
  const head = "date,reference,description,debit,credit\n";
  expect(
    parseStatementCsv(head + '2026-01-01,TR1,"Tiles, 2 boxes",,105.25\r\n')[0],
  ).toMatchObject({
    direction: "in",
    amount: 10525,
    description: "Tiles, 2 boxes",
  });
  expect(() => parseStatementCsv(head + "2025-02-29,A,Test,3,")).toThrow();
  expect(() => parseStatementCsv(head + "2026-01-01,A,Test,3,4")).toThrow();
  expect(() => parseStatementCsv(head + "2026-01-01,A,Test,3.001,")).toThrow();
  expect(Object.keys(en).sort()).toEqual(Object.keys(hi).sort());
  expect(Object.keys(en).sort()).toEqual(Object.keys(or).sort());
});
describe.sequential("supplementary posting workflows", () => {
  it("reserves only against a paid advance and cuts a slab without double counting area", async () => {
    const rows = await read();
    const source = rows.slabs[0];
    const order = rows.saleOrders[0];
    await expect(
      post("slabReserve", { slabId: source.id, orderId: randomUUID() }),
    ).rejects.toThrow();
    await expect(
      post("slabs", { id: source.id, status: "reserved" }, "update"),
    ).rejects.toThrow(/workshop/);
    const reserved = await post("slabReserve", {
      slabId: source.id,
      orderId: order.id,
    });
    expect(reserved).toMatchObject({
      status: "reserved",
      partyId: order.partyId,
    });
    await expect(
      post("slabReserve", { slabId: source.id, orderId: order.id }),
    ).rejects.toThrow(/already reserved/);
    await expect(
      post("slabCut", { slabId: source.id, length: 99, width: 1 }),
    ).rejects.toThrow(/fit inside/);
    const data = { slabId: source.id, length: 3, width: 2 };
    const key = randomUUID();
    const original = await post("slabCut", data, "create", key);
    expect(original.status).toBe("cut");
    expect(await post("slabCut", data, "create", key)).toEqual(original);
    const children = (await read()).slabs.filter(
      (r) => r.parentId === source.id,
    );
    expect(children).toHaveLength(3);
    expect(children.reduce((sum, r) => sum + Number(r.area), 0)).toBe(49.5);
    expect(children.filter((r) => r.status === "reserved")).toHaveLength(1);
    expect(children.filter((r) => r.status === "remnant")).toHaveLength(2);
    await expect(post("slabCut", data)).rejects.toThrow(/already been cut/);
  });
  it("imports repeatable statement rows and matches only equal ledger payments without posting money twice", async () => {
    const input = {
      bankId: bank,
      lines: [
        {
          date: "2026-11-01",
          reference: "UTR123",
          amount: 9555,
          direction: "in",
        },
      ],
    };
    const balance = (await read()).banks.find((r) => r.id === bank)!.balance;
    expect(await post("statementImport", input)).toMatchObject({
      imported: 1,
      duplicates: 0,
    });
    expect(await post("statementImport", input)).toMatchObject({
      imported: 0,
      duplicates: 1,
    });
    const state = await read();
    expect(state.banks.find((r) => r.id === bank)!.balance).toBe(balance);
    const row = state.bankEntries.find((r) => r.reference === "UTR123")!;
    const pay = await post("payments", {
      bankId: bank,
      mode: "upi",
      partyId: party,
      amount: 9555,
      direction: "in",
    });
    const wrong = await post("payments", {
      bankId: bank,
      mode: "upi",
      partyId: party,
      amount: 9550,
      direction: "in",
    });
    await expect(
      post("matchBankLine", { lineId: row.id, paymentId: wrong.id }),
    ).rejects.toThrow(/must match/);
    expect(
      await post("matchBankLine", { lineId: row.id, paymentId: pay.id }),
    ).toMatchObject({ status: "matched", paymentId: pay.id });
    await expect(
      post("bankEntries", { id: row.id, status: "unmatched" }, "update"),
    ).rejects.toThrow(/reconciliation/);
    await expect(
      post("statementImport", input, "create", randomUUID(), counter),
    ).rejects.toThrow(/Permission denied/);
  });
  it("closes only a completed March year with owner confirmation, then blocks old but permits current posting", async () => {
    const through = "2000-03-31";
    const before = await post("backups", { name: "Pre-close" });
    await expect(
      post("closeFinancialYear", { through, confirm: "wrong" }),
    ).rejects.toThrow(/Confirm/);
    await expect(
      post(
        "closeFinancialYear",
        { through, confirm: through },
        "create",
        randomUUID(),
        counter,
      ),
    ).rejects.toThrow(/Permission denied/);
    await expect(post("yearClosures", { through })).rejects.toThrow(
      /read-only/,
    );
    expect(
      await post("closeFinancialYear", { through, confirm: through }),
    ).toMatchObject({ through });
    await expect(
      post("payments", {
        direction: "in",
        mode: "cash",
        partyId: party,
        amount: 100,
        date: through,
      }),
    ).rejects.toThrow(/Financial year is closed/);
    await expect(
      post("saleInvoices", {
        partyId: party,
        date: through,
        lines: [
          {
            productId: "00000002-0000-4000-8000-000000000001",
            lotId: "00000003-0000-4000-8000-000000000001",
            qty: 1,
            rate: 100,
          },
        ],
      }),
    ).rejects.toThrow(/Financial year is closed/);
    expect(
      await post("payments", {
        direction: "in",
        mode: "cash",
        partyId: party,
        amount: 100,
        date: "2000-04-01",
      }),
    ).toMatchObject({ amount: 100 });
    await expect(post("backups", { id: before.id }, "restore")).rejects.toThrow(
      /closed books/,
    );
    const after = await post("backups", { name: "Post-close" });
    expect(await post("backups", { id: after.id }, "restore")).toMatchObject({
      sourceId: after.id,
    });
  });
});
