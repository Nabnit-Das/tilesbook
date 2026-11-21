export type BankStatementLine = {
  date: string;
  reference: string;
  description: string;
  direction: "in" | "out";
  amount: number;
};
export type CsvErrorCode = "invalidCsv" | "badHeader" | "badRow" | "tooMany";
export class StatementCsvError extends Error {
  constructor(
    readonly code: CsvErrorCode,
    readonly row = 0,
  ) {
    super(code);
  }
}

function parseCells(input: string) {
  if (input.length > 1024 * 1024) throw new StatementCsvError("tooMany");
  const table: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    ended = false;
  const push = () => {
    row.push(cell.trim());
    cell = "";
    ended = false;
  };
  const endRow = () => {
    push();
    if (row.some(Boolean)) table.push(row);
    row = [];
  };
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') {
        cell += c;
        continue;
      }
      if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
        ended = true;
      }
    } else if (c === ",") {
      push();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else if (c === '"' && !cell && !ended) {
      quoted = true;
    } else if (c === '"' || (ended && c.trim())) {
      throw new StatementCsvError("invalidCsv", table.length + 1);
    } else {
      cell += c;
    }
  }
  if (quoted) throw new StatementCsvError("invalidCsv", table.length + 1);
  endRow();
  return table;
}

export function parseStatementCsv(text: string): BankStatementLine[] {
  const [head, ...rows] = parseCells(text);
  const keys = head?.map((k) => k.toLowerCase()) || [];
  if (
    new Set(keys).size !== keys.length ||
    !["date", "reference", "debit", "credit"].every((k) => keys.includes(k))
  )
    throw new StatementCsvError("badHeader");
  if (!rows.length || rows.length > 500) throw new StatementCsvError("tooMany");
  return rows.map((cells, i) => {
    const invalid = () => {
      throw new StatementCsvError("badRow", i + 2);
    };
    if (cells.length !== keys.length) invalid();
    const field = (key: string) => cells[keys.indexOf(key)] || "";
    const amount = (s: string) => {
      if (!s) return 0;
      if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return invalid();
      const [r, p = ""] = s.split(".");
      const amt = Number(r) * 100 + Number(p.padEnd(2, "0"));
      return Number.isSafeInteger(amt) ? amt : invalid();
    };
    const debit = amount(field("debit")),
      credit = amount(field("credit"));
    const date = field("date");
    const dt = new Date(date + "T00:00:00Z");
    if (
      !/^\d{4}-\d\d-\d\d$/.test(date) ||
      !Number.isFinite(+dt) ||
      dt.toISOString().slice(0, 10) !== date ||
      !field("reference") ||
      field("reference").length > 150 ||
      Boolean(debit) === Boolean(credit)
    )
      invalid();
    return {
      date,
      reference: field("reference"),
      description: field("description"),
      direction: credit ? "in" : "out",
      amount: credit || debit,
    };
  });
}
