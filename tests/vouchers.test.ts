import { expect, it } from "vitest";
import { cashVoucherXml } from "../src/features/exchange";
it("balances cash receipts and payments, links bills, escapes names and skips bank movements", () => {
  const base = {
    id: "1",
    mode: "Cash",
    partyName: "A & B",
    amount: 1299,
    date: "2026-11-21",
    number: "R-1",
  };
  const xml = cashVoucherXml(
    [
      { ...base, direction: "in", documentId: "a" },
      { ...base, id: "2", direction: "out" },
      { ...base, id: "3", mode: "UPI" },
    ],
    [{ id: "a", number: "INV-1" }],
  );
  expect(xml.match(/<VOUCHER ACTION=/g)).toHaveLength(2);
  expect(xml).toContain(
    "<NAME>INV-1</NAME><BILLTYPE>Agst Ref</BILLTYPE><AMOUNT>12.99",
  );
  expect(xml).toContain("<BILLTYPE>On Account</BILLTYPE><AMOUNT>-12.99");
  expect(xml).toContain("A &amp; B");
  expect(xml).toContain("20261121");
  expect(() =>
    cashVoucherXml([{ ...base, direction: "in", documentId: "missing" }], []),
  ).toThrow();
});
