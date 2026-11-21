"use client";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { CalendarCheck, Download, Landmark, Scissors } from "lucide-react";
import { useBook, localeMoney, day } from "@/lib/client";
import type { Row } from "@/types/database";
import {
  parseStatementCsv,
  StatementCsvError,
  type BankStatementLine,
} from "./statement-csv";
import en from "./extra-messages/en.json";
import hi from "./extra-messages/hi.json";
import or from "./extra-messages/or.json";
import "./workspace.css";

type Words = typeof en;
type Slug = "slab-workshop" | "statement-import" | "close-year";
type Save = (
  resource: string,
  data: Record<string, unknown>,
) => Promise<Row | undefined>;
const s = (r: Row | undefined, key: string) => String(r?.[key] ?? "");
const value = (r: Row | undefined, key: string) => Number(r?.[key]) || 0;
const dates = (r: Row[]) =>
  r
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
const uiStatus = (w: Words, v: string) =>
  ({
    reserved: w.reserved,
    cut: w.cutStatus,
    available: w.available,
    remnant: w.remnant,
    matched: w.matched,
    unmatched: w.unmatched,
  })[v.toLowerCase()] || v;
type Context = {
  records: Record<string, Row[]>;
  role: string;
  words: Words;
  locale: string;
  save: Save;
  busy: boolean;
  premium: boolean;
};
function Box({ children }: { children: ReactNode }) {
  return (
    <section
      className="tb-panel tb-toolbody"
      style={{ padding: "clamp(16px,3vw,30px)", display: "grid", gap: 14 }}
    >
      {children}
    </section>
  );
}
function Slabs({
  records,
  role,
  words: w,
  locale,
  save,
  busy,
  premium,
}: Context) {
  const slabs = records.slabs ?? [],
    orders = (records.saleOrders ?? []).filter(
      (o) =>
        ["open", "partial"].includes(s(o, "status").toLowerCase()) &&
        value(o, "received") - value(o, "advanceApplied") > 0,
    );
  const eligible = slabs.filter((r) =>
    ["available", "remnant", "reserved"].includes(
      s(r, "status").toLowerCase() || "available",
    ),
  );
  const [id, setId] = useState(""),
    [order, setOrder] = useState(""),
    [length, setLength] = useState(""),
    [width, setWidth] = useState("");
  const selected = eligible.find((r) => r.id === id);
  const remaining = selected
    ? Math.round(
        (value(selected, "length") * value(selected, "width") -
          Number(length) * Number(width)) *
          1000,
      ) / 1000
    : 0;
  const can = ["Owner", "Manager", "Godown"].includes(role) && premium;
  return (
    <>
      <Box>
        <Link className="tb-textbtn" href="/slabs">
          {w.slabs}
        </Link>
        <label>
          {w.slab}
          <select
            value={selected?.id || ""}
            onChange={(e) => {
              setId(e.target.value);
              setOrder("");
              setLength("");
              setWidth("");
            }}
          >
            <option value="">{w.select}</option>
            {eligible.map((r) => (
              <option key={r.id} value={r.id}>
                {s(r, "slabNo")} · {value(r, "length")} × {value(r, "width")} ·{" "}
                {uiStatus(w, s(r, "status"))}
              </option>
            ))}
          </select>
        </label>
        {!can && <p>{premium ? w.denied : w.pro}</p>}
        {selected && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await save("slabReserve", { slabId: id, orderId: order }))
                  setOrder("");
              }}
            >
              <label>
                {w.order}
                <select
                  required
                  value={order}
                  disabled={
                    !can || s(selected, "status").toLowerCase() === "reserved"
                  }
                  onChange={(e) => setOrder(e.target.value)}
                >
                  <option value="">{w.select}</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {s(o, "number")} · {s(o, "partyName")} ·{" "}
                      {localeMoney(
                        value(o, "received") - value(o, "advanceApplied"),
                        locale,
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="tb-outline"
                disabled={
                  busy ||
                  !can ||
                  !order ||
                  s(selected, "status").toLowerCase() === "reserved"
                }
              >
                {w.reserve}
              </button>
            </form>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await save("slabCut", {
                    slabId: id,
                    length: Number(length),
                    width: Number(width),
                  })
                ) {
                  setId("");
                  setLength("");
                  setWidth("");
                }
              }}
            >
              <p>{w.cutPreview}</p>
              <div className="tb-formgrid">
                <label>
                  {w.length}
                  <input
                    required
                    type="number"
                    step=".001"
                    min=".001"
                    max={value(selected, "length")}
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                </label>
                <label>
                  {w.width}
                  <input
                    required
                    type="number"
                    step=".001"
                    min=".001"
                    max={value(selected, "width")}
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </label>
              </div>
              {length && width && remaining >= 0 && (
                <p>
                  {w.remaining} · {remaining} {w.sqft}
                </p>
              )}
              <button
                className="tb-primary"
                disabled={busy || !can || !length || !width || remaining <= 0}
              >
                <Scissors size={16} />
                {w.cut}
              </button>
            </form>
          </>
        )}
      </Box>
      <Box>
        <h2>{w.history}</h2>
        {dates(records.slabEvents ?? []).map((r) => (
          <div key={r.id} className="tb-backuprow">
            <b>{s(r, "slabNo")}</b>
            <span>
              {uiStatus(w, s(r, "status"))} · {day(s(r, "date"), locale)}
            </span>
          </div>
        ))}
        {!records.slabEvents?.length && <p>{w.empty}</p>}
      </Box>
    </>
  );
}
function Bank({ records, role, words: w, locale, save, busy }: Context) {
  const banks = records.banks ?? [],
    [bankId, setBank] = useState(banks[0]?.id || ""),
    [rows, setRows] = useState<BankStatementLine[]>([]),
    [err, setErr] = useState(""),
    [outcome, setOutcome] = useState(""),
    [lineId, setLine] = useState(""),
    [pay, setPay] = useState("");
  const allowed = ["Owner", "Manager"].includes(role);
  const imported = (records.bankEntries ?? []).filter(
    (r) => r.origin === "statement" && r.bankId === bankId,
  );
  const unmatched = imported.filter((r) => !r.paymentId);
  const line = unmatched.find((r) => r.id === lineId);
  const used = new Set(
    (records.bankEntries ?? []).map((r) => r.paymentId).filter(Boolean),
  );
  const payments = (records.payments ?? []).filter(
    (p) =>
      line &&
      p.bankId === bankId &&
      s(p, "direction").toLowerCase() === line.direction &&
      p.amount === line.amount &&
      !used.has(p.id),
  );
  const csv =
    "date,reference,description,debit,credit\r\n2026-04-01,TXN-0001,UPI,,1250.00\r\n";
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await save("statementImport", { bankId, lines: rows });
    if (result) {
      setOutcome(
        w.imported +
          " " +
          value(result, "imported") +
          " · " +
          w.duplicate +
          " " +
          value(result, "duplicates"),
      );
      setRows([]);
    }
  }
  return (
    <>
      <Box>
        <label>
          {w.bank}
          <select
            value={bankId}
            onChange={(e) => {
              setBank(e.target.value);
              setLine("");
              setPay("");
              setRows([]);
              setOutcome("");
            }}
          >
            <option value="">{w.select}</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {s(b, "name")}
              </option>
            ))}
          </select>
        </label>
        {!allowed && <p>{w.denied}</p>}
        <p>{w.csvHelp}</p>
        <a
          className="tb-textbtn"
          download="bank-statement.csv"
          href={"data:text/csv;charset=utf-8," + encodeURIComponent(csv)}
        >
          <Download size={16} />
          {w.template}
        </a>
        <form onSubmit={submit}>
          <label>
            {w.statement}
            <input
              key={bankId}
              disabled={!allowed}
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setRows([]);
                setErr("");
                setOutcome("");
                if (!file) return;
                try {
                  if (file.size > 1048576)
                    throw new StatementCsvError("tooMany");
                  setRows(parseStatementCsv(await file.text()));
                } catch (error) {
                  setErr(
                    error instanceof StatementCsvError
                      ? w[error.code] + (error.row ? " " + error.row : "")
                      : w.invalidCsv,
                  );
                }
              }}
            />
          </label>
          {rows.length > 0 && (
            <p>
              {w.rows} · {rows.length}
            </p>
          )}
          {err && <p role="alert">{err}</p>}
          <button
            className="tb-primary"
            disabled={busy || !allowed || !bankId || !rows.length}
          >
            {w.import}
          </button>
        </form>
        {outcome && <p role="status">{outcome}</p>}
      </Box>
      <Box>
        <h2>{w.match}</h2>
        <p>{w.matchHelp}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save("matchBankLine", { lineId, paymentId: pay })) {
              setLine("");
              setPay("");
            }
          }}
        >
          <div className="tb-formgrid">
            <label>
              {w.ref}
              <select
                required
                value={lineId}
                onChange={(e) => {
                  setLine(e.target.value);
                  setPay("");
                }}
              >
                <option value="">{w.select}</option>
                {unmatched.map((r) => (
                  <option key={r.id} value={r.id}>
                    {s(r, "reference")} · {day(s(r, "date"), locale)} ·{" "}
                    {r.direction === "in" ? w.in : w.out} ·{" "}
                    {localeMoney(r.amount, locale, 2)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {w.payment}
              <select
                required
                value={pay}
                onChange={(e) => setPay(e.target.value)}
              >
                <option value="">{w.select}</option>
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {s(p, "number")} · {s(p, "partyName")} ·{" "}
                    {day(s(p, "date"), locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="tb-outline"
            disabled={!allowed || busy || !line || !pay}
          >
            {w.match}
          </button>
        </form>
        {dates(imported).map((r) => (
          <div className="tb-backuprow" key={r.id}>
            <b>{s(r, "reference")}</b>
            <span>
              {localeMoney(r.amount, locale, 2)} ·{" "}
              {r.paymentId ? w.matched : w.unmatched}
            </span>
          </div>
        ))}
        {!imported.length && <p>{w.empty}</p>}
      </Box>
    </>
  );
}
function Year({ records, role, words: w, save, busy }: Context) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const current = Number(today.slice(0, 4));
  const latest = today.slice(5) > "03-31" ? current : current - 1;
  const boundary =
    (records.yearClosures ?? [])
      .map((r) => s(r, "through"))
      .sort()
      .at(-1) || "";
  const [end, setEnd] = useState(latest + "-03-31"),
    [confirm, setConfirm] = useState("");
  return (
    <Box>
      <strong>
        {w.closed} · {boundary || w.open}
      </strong>
      <p>{w.yearHelp}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save("closeFinancialYear", { through: end, confirm }))
            setConfirm("");
        }}
      >
        <label>
          {w.year}
          <input
            type="date"
            max={latest + "-03-31"}
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setConfirm("");
            }}
          />
        </label>
        <label>
          {w.confirm}
          <input
            autoComplete="off"
            value={confirm}
            placeholder={end}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {role !== "Owner" && <p>{w.denied}</p>}
        <button
          className="tb-primary"
          disabled={
            busy ||
            role !== "Owner" ||
            end !== confirm ||
            end <= boundary ||
            !end.endsWith("-03-31") ||
            end >= today
          }
        >
          {w["close-year"]}
        </button>
      </form>
    </Box>
  );
}
export default function Extras({ slug }: { slug: Slug }) {
  const { book, save, online } = useBook();
  const locale = useLocale();
  const words = locale === "hi" ? hi : locale === "or" ? or : en;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(false);
  if (!book) return null;
  const post: Save = async (k, data) => {
    setMessage("");
    setFailure(false);
    if (!online) {
      setFailure(true);
      setMessage(words.offline);
      return;
    }
    setBusy(true);
    try {
      const res = await save(k, data);
      setMessage(words.saved);
      return res.row as Row;
    } catch (error) {
      setFailure(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const shared = {
    records: book.records,
    role: book.role,
    words,
    locale,
    save: post,
    busy,
    premium: book.entitlements.premium,
  };
  const Icon =
    slug === "slab-workshop"
      ? Scissors
      : slug === "close-year"
        ? CalendarCheck
        : Landmark;
  return (
    <section className="tb-workspace" style={{ display: "grid", gap: 16 }}>
      <div className="tb-pagehead">
        <h1>
          <Icon aria-hidden="true" size={26} />
          {words[slug]}
        </h1>
      </div>
      {message && (
        <div
          className={failure ? "tb-error" : "tb-note"}
          role={failure ? "alert" : "status"}
        >
          {message}
        </div>
      )}
      {slug === "slab-workshop" ? (
        <Slabs {...shared} />
      ) : slug === "close-year" ? (
        <Year {...shared} />
      ) : (
        <Bank {...shared} />
      )}
    </section>
  );
}
