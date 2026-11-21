/** Monetary values are integer paise. GST rates and ratios are percentages. */
export type InvoiceLineInput = {
  qty: number;
  ratePaise: number;
  gstRate: number;
  discountPaise?: number;
  hsn?: string;
};

function nonnegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(name);
  return value;
}

function paise(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError("Invalid paise");
  return value;
}

/** Use the same decimal value as JSON/Postgres, including quantities such as 1.005. */
function roundedProduct(amountPaise: number, factor: number, divisor = 1) {
  const [mantissa, exponent = "0"] = factor.toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const shift = Number(exponent) - fraction.length;
  const numerator =
    BigInt(amountPaise) *
    BigInt(whole + fraction) *
    10n ** BigInt(Math.max(0, shift));
  const denominator = BigInt(divisor) * 10n ** BigInt(Math.max(0, -shift));
  return paise(Number((2n * numerator + denominator) / (2n * denominator)));
}

export function convertSqft(
  sqft: number,
  sqftPerPiece: number,
  piecesPerBox: number,
  wastagePercent = 0,
  fullBoxes = false,
) {
  nonnegative(sqft, "Invalid area");
  nonnegative(wastagePercent, "Invalid wastage");
  if (!Number.isFinite(sqftPerPiece) || sqftPerPiece <= 0)
    throw new RangeError("Invalid piece area");
  if (!Number.isSafeInteger(piecesPerBox) || piecesPerBox < 1)
    throw new RangeError("Invalid pack size");
  const requiredArea = sqft * (1 + wastagePercent / 100);
  const exact = requiredArea / sqftPerPiece;
  const minimum = Math.ceil(exact - Math.abs(exact) * Number.EPSILON * 2);
  const pieces = fullBoxes
    ? Math.ceil(minimum / piecesPerBox) * piecesPerBox
    : minimum;
  if (!Number.isSafeInteger(pieces))
    throw new RangeError("Area exceeds supported range");
  return {
    requiredArea,
    pieces,
    boxes: Math.floor(pieces / piecesPerBox),
    loose: pieces % piecesPerBox,
  };
}

export function splitGst(
  taxablePaise: number,
  gstRate: number,
  interstate = false,
) {
  paise(taxablePaise);
  nonnegative(gstRate, "Invalid GST rate");
  if (gstRate > 100) throw new RangeError("Invalid GST rate");
  const taxPaise = roundedProduct(taxablePaise, gstRate, 100);
  const cgstPaise = interstate ? 0 : Math.floor(taxPaise / 2);
  return {
    taxPaise,
    cgstPaise,
    sgstPaise: interstate ? 0 : taxPaise - cgstPaise,
    igstPaise: interstate ? taxPaise : 0,
  };
}

export type TaxSummary = ReturnType<typeof splitGst> & {
  taxablePaise: number;
  hsn: string;
  gstRate: number;
};

/** Spread a bill discount across taxable bases. Distribute residual paise by largest remainder. */
function spreadDiscount(bases: number[], amount: number) {
  const total = paise(bases.reduce((a, b) => a + b, 0));
  if (amount > total) throw new RangeError("Discount exceeds bill");
  if (!amount || !total) return bases.map(() => 0);
  const denominator = BigInt(total);
  const weights = bases.map((value) => BigInt(value) * BigInt(amount));
  const shares = weights.map((weight) => Number(weight / denominator));
  const order = weights
    .map((weight, index) => ({
      index,
      remainder: Number(weight % denominator),
    }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let left = amount - shares.reduce((a, b) => a + b, 0);
  for (const { index } of order) {
    if (left <= 0) break;
    shares[index]++;
    left--;
  }
  return shares;
}

export function calculateInvoice(
  inputs: InvoiceLineInput[],
  interstate = false,
  billDiscountPaise = 0,
) {
  const bases = inputs.map((line) => {
    if (!Number.isFinite(line.qty) || line.qty <= 0)
      throw new RangeError("Invalid quantity");
    return paise(
      roundedProduct(paise(line.ratePaise), line.qty) -
        paise(line.discountPaise ?? 0),
    );
  });
  const shares = spreadDiscount(bases, paise(billDiscountPaise));
  const summary = new Map<string, TaxSummary>();
  const lines = inputs.map((line, index) => {
    const taxablePaise = bases[index] - shares[index];
    const tax = splitGst(taxablePaise, line.gstRate, interstate);
    const hsn = line.hsn || "—";
    const key = hsn + "/" + line.gstRate;
    const group = summary.get(key) ?? {
      hsn,
      gstRate: line.gstRate,
      taxablePaise: 0,
      taxPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    };
    group.taxablePaise += taxablePaise;
    group.cgstPaise += tax.cgstPaise;
    group.sgstPaise += tax.sgstPaise;
    group.igstPaise += tax.igstPaise;
    group.taxPaise += tax.taxPaise;
    summary.set(key, group);
    return {
      ...line,
      billDiscountPaise: shares[index],
      taxablePaise,
      ...tax,
      amountPaise: paise(taxablePaise + tax.taxPaise),
    };
  });
  const hsn = Array.from(summary.values());
  const sum = (
    key: "cgstPaise" | "sgstPaise" | "igstPaise" | "taxablePaise" | "taxPaise",
  ) => paise(hsn.reduce((acc, row) => acc + row[key], 0));
  const taxablePaise = sum("taxablePaise");
  const taxPaise = sum("taxPaise");
  const grossPaise = paise(taxablePaise + taxPaise);
  const totalPaise = paise(roundedProduct(grossPaise, 1, 100) * 100);
  return {
    lines,
    hsn,
    taxablePaise,
    taxPaise,
    cgstPaise: sum("cgstPaise"),
    sgstPaise: sum("sgstPaise"),
    igstPaise: sum("igstPaise"),
    grossPaise,
    totalPaise,
    roundOffPaise: totalPaise - grossPaise,
  };
}

const ones = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function numberWords(n: number): string {
  if (n < 20) return ones[n];
  if (n < 100)
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  for (const [scale, word] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ] as const) {
    if (n >= scale)
      return (
        numberWords(Math.floor(n / scale)) +
        " " +
        word +
        (n % scale ? " " + numberWords(n % scale) : "")
      );
  }
  throw new RangeError("Invalid amount");
}

export function amountInWords(amountPaise: number) {
  paise(amountPaise);
  const rupees = Math.floor(amountPaise / 100);
  const fraction = amountPaise % 100;
  return (
    numberWords(rupees) +
    (rupees === 1 ? " Rupee" : " Rupees") +
    (fraction
      ? " and " + numberWords(fraction) + (fraction === 1 ? " Paisa" : " Paise")
      : "") +
    " Only"
  );
}

export function commissionPaise(
  saleTaxablePaise: number,
  boxes: number,
  rule: { kind: "percent" | "perBox"; value: number },
) {
  paise(saleTaxablePaise);
  nonnegative(boxes, "Invalid boxes");
  nonnegative(rule.value, "Invalid commission");
  return rule.kind === "percent"
    ? roundedProduct(saleTaxablePaise, rule.value, 100)
    : roundedProduct(paise(rule.value), boxes);
}

export const payableCommission = (
  accruedPaise: number,
  reversedPaise: number,
  paidPaise: number,
) => paise(accruedPaise) - paise(reversedPaise) - paise(paidPaise);

function istDay(value: string | Date) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new RangeError("Invalid date");
  return Math.floor((time + 19800000) / 86400000);
}

export function lotAgeDays(
  receivedDate: string,
  lastSoldDate: string | null,
  today: string | Date = new Date(),
) {
  return Math.max(0, istDay(today) - istDay(lastSoldDate || receivedDate));
}

export function deadLot(remaining: number, days: number, threshold = 180) {
  return remaining > 0 && days > threshold;
}

export type LedgerDelta = {
  physical: number;
  reserved?: number;
  display?: number;
};
export function stockFromLedger(rows: LedgerDelta[]) {
  const result = rows.reduce<Required<LedgerDelta>>(
    (v, r) => ({
      physical: v.physical + r.physical,
      reserved: v.reserved + (r.reserved ?? 0),
      display: v.display + (r.display ?? 0),
    }),
    { physical: 0, reserved: 0, display: 0 },
  );
  return {
    ...result,
    sellable: result.physical - result.reserved - result.display,
  };
}

export function deliveryBalance(
  ordered: number,
  delivered: number,
  dispatch: number,
) {
  [ordered, delivered, dispatch].forEach((value) =>
    nonnegative(value, "Invalid delivery"),
  );
  const balance = ordered - delivered - dispatch;
  if (balance < -0.000001)
    throw new RangeError("Dispatch exceeds remaining order");
  return {
    ordered,
    delivered: delivered + dispatch,
    balance: Math.max(0, balance),
    closed: balance <= 0.000001,
  };
}

export function validateReturn(
  originalLotId: string,
  returnedLotId: string,
  unopened: boolean,
  sold: number,
  alreadyReturned: number,
  quantity: number,
) {
  if (!originalLotId || originalLotId !== returnedLotId)
    throw new RangeError("Return to the original lot");
  if (!unopened) throw new RangeError("Only unopened stock can be returned");
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity >
      nonnegative(sold, "Invalid sale") -
        nonnegative(alreadyReturned, "Invalid returns")
  )
    throw new RangeError("Invalid return quantity");
  return quantity;
}

export function mixedLotProducts(
  lines: { productId: string; lotId: string }[],
) {
  const groups = new Map<string, Set<string>>();
  for (const { productId, lotId } of lines) {
    if (!productId || !lotId) continue;
    const lots = groups.get(productId) ?? new Set<string>();
    lots.add(lotId);
    groups.set(productId, lots);
  }
  return Array.from(groups)
    .filter(([, lots]) => lots.size > 1)
    .map(([id]) => id);
}

export function suggestLot<T extends { sellable: number }>(
  lots: T[],
  required: number,
) {
  return lots.find((lot) => lot.sellable >= required);
}

export function loanEmi(
  principalPaise: number,
  annualRate: number,
  months: number,
) {
  paise(principalPaise);
  nonnegative(annualRate, "Invalid interest");
  if (!Number.isInteger(months) || months <= 0)
    throw new RangeError("Invalid tenure");
  const monthly = annualRate / 1200;
  return Math.round(
    monthly
      ? (principalPaise * monthly) / -Math.expm1(-months * Math.log1p(monthly))
      : principalPaise / months,
  );
}
