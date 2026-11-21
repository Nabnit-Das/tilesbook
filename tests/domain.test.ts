import { describe, expect, it } from "vitest";
import {
  amountInWords,
  calculateInvoice,
  commissionPaise,
  convertSqft,
  deadLot,
  deliveryBalance,
  loanEmi,
  lotAgeDays,
  mixedLotProducts,
  payableCommission,
  splitGst,
  stockFromLedger,
  suggestLot,
  validateReturn,
} from "../src/domain/rules";

describe("tile quantities", () => {
  it("converts 350 sqft to 22 boxes or 23 at 5% waste", () => {
    expect(convertSqft(350, 4, 4)).toMatchObject({
      pieces: 88,
      boxes: 22,
      loose: 0,
    });
    expect(convertSqft(350, 4, 4, 5)).toMatchObject({
      pieces: 92,
      boxes: 23,
      loose: 0,
    });
  });
  it("keeps loose pieces unless full boxes are requested", () => {
    expect(convertSqft(17, 4, 4)).toMatchObject({
      pieces: 5,
      boxes: 1,
      loose: 1,
    });
    expect(convertSqft(17, 4, 4, 0, true)).toMatchObject({
      pieces: 8,
      boxes: 2,
      loose: 0,
    });
    expect(convertSqft(0, 4, 4).pieces).toBe(0);
    expect(() => convertSqft(12, 0, 4)).toThrow();
  });
  it("finds a single lot with enough stock and flags same-product mixed lots", () => {
    const rows = [
      { productId: "p", lotId: "A" },
      { productId: "q", lotId: "A" },
      { productId: "p", lotId: "B" },
    ];
    expect(mixedLotProducts(rows)).toEqual(["p"]);
    expect(suggestLot([{ sellable: 5 }, { sellable: 19 }], 7)).toEqual({
      sellable: 19,
    });
  });
});

describe("invoice accounting", () => {
  it("matches PostgreSQL decimal rounding at half-paisa boundaries", () => {
    const [line] = calculateInvoice([
      { qty: 1.005, ratePaise: 100, gstRate: 0 },
    ]).lines;
    expect(line.taxablePaise).toBe(101);
    expect(commissionPaise(10000, 1, { kind: "percent", value: 1.005 })).toBe(
      101,
    );
  });
  it("keeps CGST and SGST equal to the total rounded GST", () => {
    expect(splitGst(10000, 18)).toEqual({
      taxPaise: 1800,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
    });
    expect(splitGst(10000, 5, true)).toEqual({
      taxPaise: 500,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 500,
    });
    expect(splitGst(50, 18)).toEqual({
      taxPaise: 9,
      cgstPaise: 4,
      sgstPaise: 5,
      igstPaise: 0,
    });
  });
  it("reconciles INV-113, including rounding and the payment", () => {
    const result = calculateInvoice([
      { qty: 23, ratePaise: 319600, gstRate: 18, hsn: "6907" },
      { qty: 6, ratePaise: 52000, gstRate: 18, hsn: "3214" },
    ]);
    expect(result).toMatchObject({
      totalPaise: 9042100,
      roundOffPaise: -4,
      taxablePaise: 7662800,
      taxPaise: 1379304,
      cgstPaise: 689652,
      sgstPaise: 689652,
    });
    expect(result.totalPaise - 5000000).toBe(4042100);
    expect(result.hsn).toMatchObject([
      { hsn: "6907", taxablePaise: 7350800, taxPaise: 1323144 },
      { hsn: "3214", taxablePaise: 312000, taxPaise: 56160 },
    ]);
  });
  it("allocates discounts in integer paise without losing a paisa", () => {
    const result = calculateInvoice(
      [
        { qty: 2, ratePaise: 110, discountPaise: 20, gstRate: 18, hsn: "6907" },
        { qty: 1, ratePaise: 200, gstRate: 18, hsn: "6907" },
      ],
      false,
      1,
    );
    expect(result.taxablePaise).toBe(399);
    expect(result.hsn).toHaveLength(1);
    expect(result.lines.map((line) => line.billDiscountPaise)).toEqual([1, 0]);
    expect(() =>
      calculateInvoice([
        { qty: 1, ratePaise: 100, discountPaise: 101, gstRate: 5 },
      ]),
    ).toThrow();
  });
  it("writes rupees, paise, lakh and crore", () => {
    expect(amountInWords(9042100)).toBe(
      "Ninety Thousand Four Hundred Twenty One Rupees Only",
    );
    expect(amountInWords(10000000)).toBe("One Lakh Rupees Only");
    expect(amountInWords(1010000050)).toBe(
      "One Crore One Lakh Rupees and Fifty Paise Only",
    );
    expect(amountInWords(101)).toBe("One Rupee and One Paisa Only");
  });
});

describe("stock and partner accounts", () => {
  it("reserves without dispatching and keeps samples out of sale", () => {
    const opening = { physical: 240 };
    const booking = { physical: 0, reserved: 200 };
    expect(stockFromLedger([opening, booking])).toEqual({
      physical: 240,
      reserved: 200,
      display: 0,
      sellable: 40,
    });
    expect(
      stockFromLedger([
        opening,
        booking,
        { physical: -60, reserved: -60 },
        { physical: 0, display: 1 },
      ]),
    ).toEqual({ physical: 180, reserved: 140, display: 1, sellable: 39 });
  });
  it("fulfils a 200-box order in two phases", () => {
    expect(deliveryBalance(200, 0, 60)).toMatchObject({
      balance: 140,
      closed: false,
    });
    expect(deliveryBalance(200, 60, 140)).toMatchObject({
      balance: 0,
      closed: true,
    });
    expect(() => deliveryBalance(200, 60, 141)).toThrow();
  });
  it("rejects wrong lots, opened boxes, and excess returns", () => {
    expect(validateReturn("2531", "2531", true, 5, 1, 4)).toBe(4);
    expect(() => validateReturn("2531", "2416", true, 5, 1, 1)).toThrow();
    expect(() => validateReturn("2531", "2531", false, 5, 1, 1)).toThrow();
    expect(() => validateReturn("2531", "2531", true, 5, 1, 5)).toThrow();
  });
  it("accrues percent or fixed per box, reverses returns and subtracts payments", () => {
    expect(commissionPaise(750000, 12, { kind: "percent", value: 2 })).toBe(
      15000,
    );
    expect(commissionPaise(750000, 12, { kind: "perBox", value: 2500 })).toBe(
      30000,
    );
    expect(payableCommission(15000, 1000, 2000)).toBe(12000);
  });
  it("counts local calendar days in IST, using received date for an unsold lot", () => {
    expect(lotAgeDays("2026-01-01", null, "2026-07-01")).toBe(181);
    expect(
      lotAgeDays("2026-01-01", "2026-06-30T18:29:59Z", "2026-06-30T18:30:01Z"),
    ).toBe(1);
    expect(deadLot(40, 181)).toBe(true);
    expect(deadLot(0, 181)).toBe(false);
    expect(deadLot(40, 180)).toBe(false);
  });
  it("calculates EMI in paise, including interest-free loans", () => {
    expect(loanEmi(120000, 0, 12)).toBe(10000);
    expect(loanEmi(10000000, 12, 12)).toBe(888488);
  });
});
