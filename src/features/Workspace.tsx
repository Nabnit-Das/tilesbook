"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Crown,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FilePlus2,
  FileText,
  Filter,
  IndianRupee,
  Layers3,
  LayoutGrid,
  MoreHorizontal,
  Package,
  Plus,
  Printer,
  Search,
  Send,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useBook } from "@/lib/client";
import { findModule, reports, type Module } from "./catalog";
import {
  asDate,
  canCost,
  canWrite,
  docs,
  excel,
  fmt,
  label,
  lines,
  lookup,
  moduleRows,
  money,
  n,
  share,
  str,
  today,
  type Row,
  type Snapshot,
  type T,
} from "./model";
import { inScope, profitReports, report } from "./reporting";
import { useWorkspaceText } from "./i18n";
import DocumentEditor, { CalculatorForm } from "./DocumentEditor";
import RecordForm from "./RecordForm";
import Tools from "./Tools";
import { readablePhoto } from "@/lib/photo";
import PrintActions from "@/print/PrintActions";
import "./workspace.css";

const printHref = (id: string, businessId: string, thermal = false) =>
  "/api/print/" +
  encodeURIComponent(id) +
  "?businessId=" +
  encodeURIComponent(businessId) +
  (thermal ? "&paper=80mm" : "");
const nextDoc: Record<string, string> = {
  estimates: "orders",
  proforma: "orders",
  orders: "challans",
  challans: "invoices",
  "purchase-orders": "purchases",
  invoices: "credit-notes",
  purchases: "debit-notes",
};
const tabs: Record<string, string[]> = {};
for (const group of [
  ["items", "services", "categories", "lots"],
  [
    "banks",
    "cash",
    "cheques",
    "loans",
    "cash-adjustments",
    "cash-closing",
    "bank-reconciliation",
  ],
  ["partners", "follow-ups", "offers", "campaigns"],
  ["damage", "display", "slabs", "transfers", "stock-count"],
  ["users", "branches", "backup", "audit"],
])
  for (const slug of group) tabs[slug] = group;
function NavTabs({ slug, t }: { slug: string; t: T }) {
  return tabs[slug] ? (
    <nav className="tb-tabs" aria-label={t("relatedPages")}>
      {tabs[slug].map((v) => (
        <Link
          key={v}
          href={"/" + v}
          aria-current={v === slug ? "page" : undefined}
          className={v === slug ? "on" : ""}
        >
          {t(v)}
        </Link>
      ))}
    </nav>
  ) : null;
}
export function Modal({
  children,
  close,
  title,
}: {
  children: ReactNode;
  close: () => void;
  title: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="tb-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            close();
        }
      }}
    >
      {children}
    </dialog>
  );
}
export function DataTable({
  rows,
  columns,
  book,
  t,
  locale,
  open,
}: {
  rows: Row[];
  columns: string[];
  book: Snapshot;
  t: T;
  locale: string;
  open?: (r: Row) => void;
}) {
  const defs: ColumnDef<Row>[] = columns.map((k) => ({
    id: k,
    header: t(k),
    accessorFn: (r) => r[k],
    cell: ({ row }) => {
      const value = fmt(row.original, k, book, t, locale);
      if (k === "status" || k === "type" || k === "mode")
        return (
          <span
            className={
              "tb-badge " +
              (k === "status" ? str(row.original, k).toLowerCase() : "neutral")
            }
          >
            {value}
          </span>
        );
      return value;
    },
  }));
  const table = useReactTable({
    columns: defs,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="tb-tablewrap">
      <table className="tb-table">
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
              {open && (
                <th>
                  <span className="tb-sr">{t("details")}</span>
                </th>
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} onClick={open ? () => open(r.original) : undefined}>
              {r.getVisibleCells().map((c, i) => (
                <td
                  key={c.id}
                  data-label={t(c.column.id)}
                  className={i === 0 ? "tb-cellfirst" : ""}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
              {open && (
                <td className="tb-actions">
                  <button
                    type="button"
                    className="tb-icon"
                    aria-label={t("details") + " " + label(r.original, book)}
                    onClick={(e) => {
                      e.stopPropagation();
                      open(r.original);
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Empty({ t, action }: { t: T; action?: () => void }) {
  return (
    <div className="tb-empty">
      <svg width="76" height="58" viewBox="0 0 76 58" aria-hidden="true">
        <path d="M5 41 38 23l33 18-33 16z" fill="#dcefea" />
        <path d="m9 33 29-16 29 16-29 16z" stroke="#61ada5" fill="#edf8f5" />
        <path d="M9 25 38 9l29 16-29 16z" stroke="#438a86" fill="#e1f0ed" />
        <path d="m25 18 28 15m-29 1 29-17" fill="none" stroke="#8cb4ab" />
      </svg>
      <h3>{t("noRecords")}</h3>
      <p>{t("emptyHint")}</p>
      {action && (
        <button className="tb-primary" onClick={action}>
          <Plus size={16} />
          {t("addRecord")}
        </button>
      )}
    </div>
  );
}
function ReportIndex({ book, t }: { book: Snapshot; t: T }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <div className="tb-pagehead">
        <div>
          <span className="tb-breadcrumb">
            <BarChart3 size={15} />
            {t("business")}
          </span>
          <h1>{t("reports")}</h1>
        </div>
      </div>
      <div className="tb-search full">
        <Search size={18} />
        <input
          aria-label={t("findReport")}
          placeholder={t("findReport")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tb-reportindex">
        {Object.entries(reports).map(([group, ids]) => {
          const filtered = ids.filter(
            (id) =>
              (canCost(book) || !profitReports.includes(id)) &&
              t(id).toLowerCase().includes(query.toLowerCase()),
          );
          return filtered.length ? (
            <section className="tb-panel" key={group}>
              <span className="tb-headicon">
                <BookOpen size={19} />
              </span>
              <h3>{t(group)}</h3>
              {filtered.map((id) => (
                <Link key={id} href={"/reports?view=" + id}>
                  {t(id)}
                  <ChevronRight size={15} />
                </Link>
              ))}
            </section>
          ) : null;
        })}
      </div>
    </>
  );
}
export default function Workspace({ slug }: { slug: string }) {
  const api = useBook();
  const q = useSearchParams();
  const { t } = useWorkspaceText();
  return (
    <main className="tb-workspace">
      {api.book ? (
        <Working
          key={slug + "?" + q.toString()}
          slug={slug}
          book={api.book as unknown as Snapshot}
        />
      ) : (
        <p role="status">{api.error || t("loading")}</p>
      )}
    </main>
  );
}
function Working({ slug, book }: { slug: string; book: Snapshot }) {
  const { t, locale } = useWorkspaceText(),
    api = useBook(),
    params = useSearchParams();
  const view = params.get("view") || "",
    rid = params.get("id") || "";
  const m =
    findModule(slug) ||
    findModule(slug === "receivables" ? "parties" : "payment-in")!;
  const [showForm, setForm] = useState(
      params.get("new") === "1" || slug === "pos",
    ),
    [edit, setEdit] = useState<Row | undefined>(),
    [selected, setSelected] = useState<Row | undefined>(() =>
      rid ? lookup(book, m.resource, rid) : undefined,
    );
  const [query, setQuery] = useState(params.get("q") || ""),
    [dateFilter, setPeriod] = useState("allTime"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [actor, setActor] = useState(""),
    [extended, setExtended] = useState(false),
    [col, setCol] = useState(""),
    [perPage, setPerPage] = useState(30),
    [toast, setToast] = useState(""),
    [focus, setFocus] = useState(""),
    [batch, setBatch] = useState<string[]>([]),
    [confirmBatch, setConfirmBatch] = useState(false),
    [posting, setPosting] = useState(false),
    [orderTab, setOrderTab] = useState("orders");
  const isReport = slug === "reports";
  const isCash = slug === "cash",
    readOnly =
      ["audit", "approvals"].includes(slug) ||
      isReport ||
      slug === "receivables" ||
      isCash;
  const first = today().slice(0, 7) + "-01",
    scope = {
      start:
        dateFilter === "month"
          ? first
          : dateFilter === "today"
            ? today()
            : dateFilter === "custom"
              ? start
              : "",
      end:
        dateFilter === "custom"
          ? end
          : dateFilter === "today" || dateFilter === "month"
            ? today()
            : "",
      user: actor,
    };
  const reportData =
    isReport && view
      ? report(book, view, scope)
      : isCash
        ? report(book, "cash-ledger", scope)
        : null;
  const base = reportData
    ? reportData.rows
    : moduleRows(book, slug, m.resource).filter(
        (r) =>
          inScope(r, scope) &&
          (!(slug === "orders" && orderTab === "onlineOrders") ||
            r.channel === "online"),
      );
  const cols = (reportData?.columns || m.columns).filter(
    (k) => canCost(book) || !["purchasePrice", "loss", "net"].includes(k),
  );
  const rows = base.filter((r) =>
    (col ? [col] : cols).some((k) =>
      fmt(r, k, book, t, locale)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ),
  );
  const source = params.get("source")
    ? docs(book).find((r) => r.id === params.get("source"))
    : undefined;
  const split = ["items", "parties"].includes(slug);
  const focused = rows.find((r) => r.id === focus) || rows[0];
  const canBatch =
    ["challans", "orders"].includes(slug) && canWrite(book, "saleInvoices");
  const sourceLot = params.get("lot") || "",
    sourceProduct = params.get("product") || "";
  const submitBatch = async () => {
    setPosting(true);
    let count = 0;
    try {
      for (const id of batch) {
        const source = base.find((v) => v.id === id);
        if (!source) continue;
        const batchLines = lines(source)
          .map((l) => ({
            productId: l.productId,
            lotId: l.lotId,
            qty:
              slug === "orders"
                ? Math.max(0, n(l, "qty") - n(l, "delivered"))
                : n(l, "qty"),
            unit: l.unit,
            rate: l.rate,
            discount: l.discount,
            sourceLineId: l.id,
            gstRate: l.gstRate,
          }))
          .filter((l) => l.qty > 0);
        if (!batchLines.length) continue;
        await api.save("saleInvoices", {
          sourceId: id,
          partyId: source.partyId,
          date: today(),
          placeOfSupply: source.placeOfSupply,
          lines: batchLines,
        });
        count++;
        setBatch((v) => v.filter((s) => s !== id));
      }
      setConfirmBatch(false);
      setToast(t("saved") + " · " + count);
    } catch (e) {
      setToast(
        (e instanceof Error ? e.message : t("error")) +
          " · " +
          t("saved") +
          " " +
          count,
      );
      setConfirmBatch(false);
    } finally {
      setPosting(false);
    }
  };
  const newRecord = () => {
    setEdit(undefined);
    setSelected(undefined);
    setForm(true);
  };
  const close = () => {
    setEdit(undefined);
    setForm(false);
    setSelected(undefined);
  };
  const save = async (data: Record<string, unknown>, intent?: string) => {
    const result = await api.save(m.resource, data, edit ? "update" : "create");
    close();
    setToast(
      t(
        result.queued
          ? "queued"
          : result.row.pendingApproval
            ? "awaitingApproval"
            : "saved",
      ),
    );
    if (
      !result.queued &&
      !result.row.pendingApproval &&
      intent === "print" &&
      result.row?.id
    )
      window.open(
        printHref(result.row.id, book.business.id, slug === "pos"),
        "_blank",
        "noopener",
      );
  };
  if (slug === "calculator")
    return (
      <>
        <div className="tb-pagehead">
          <h1>{t("calculator")}</h1>
        </div>
        <section className="tb-panel tb-standcalc">
          <CalculatorForm book={book} />
        </section>
      </>
    );
  if (isReport && !view) return <ReportIndex book={book} t={t} />;
  if (["utilities", "backup", "whatsapp"].includes(slug))
    return (
      <>
        <NavTabs slug={slug} t={t} />
        <Tools slug={slug} book={book} />
      </>
    );
  const restricted =
    (!canCost(book) &&
      [
        "purchases",
        "purchase-orders",
        "debit-notes",
        "loans",
        "partners",
        "commission-payments",
        "staff-advances",
        "price-lists",
        "bank-reconciliation",
        "payment-out",
        "approvals",
      ].includes(slug)) ||
    (["users", "backup", "audit"].includes(slug) &&
      !["owner", "manager"].includes(book.role.toLowerCase()));
  if (restricted)
    return (
      <section className="tb-panel">
        <h1>{t(slug)}</h1>
        <p>{t("accessRestricted")}</p>
      </section>
    );
  const sums = (key: string) => rows.reduce((a, r) => a + n(r, key), 0),
    dir = (key: string) =>
      rows
        .filter((r) => r.direction === key)
        .reduce((a, r) => a + n(r, "amount"), 0);
  const stat = (key: string, value: string, icon: ReactNode, tone: string) => ({
    key,
    value,
    icon,
    tone,
  });
  const count = stat("records", String(rows.length), <ClipboardList />, "blue");
  const stats =
    m.family === "documents" && !isReport && !isCash
      ? [
          stat("total", money(sums("total"), locale), <FileText />, "blue"),
          stat(
            "received",
            money(sums("received"), locale),
            <ArrowDownLeft />,
            "green",
          ),
          stat("balance", money(sums("balance"), locale), <Wallet />, "orange"),
        ]
      : isCash
        ? [
            stat(
              "moneyIn",
              money(dir("in"), locale),
              <ArrowDownLeft />,
              "green",
            ),
            stat(
              "moneyOut",
              money(dir("out"), locale),
              <ArrowUpRight />,
              "orange",
            ),
            stat(
              "balance",
              money(dir("in") - dir("out"), locale),
              <Wallet />,
              "blue",
            ),
          ]
        : ["parties", "receivables"].includes(slug)
          ? [
              count,
              stat(
                "receivable",
                money(
                  rows.reduce((a, r) => a + Math.max(n(r, "balance"), 0), 0),
                  locale,
                ),
                <ArrowDownLeft />,
                "green",
              ),
              stat(
                "payable",
                money(
                  rows.reduce((a, r) => a + Math.max(-n(r, "balance"), 0), 0),
                  locale,
                ),
                <ArrowUpRight />,
                "orange",
              ),
            ]
          : slug === "items" || slug === "lots"
            ? [
                count,
                stat(
                  "lots",
                  String(book.records.lots?.length || 0),
                  <Layers3 />,
                  "green",
                ),
                stat(
                  "low-stock",
                  String(
                    moduleRows(book, "items", "products").filter(
                      (p) => n(p, "sellable") <= n(p, "lowStockLevel"),
                    ).length,
                  ),
                  <Box />,
                  "orange",
                ),
              ]
            : [
                count,
                ...(rows.some((r) => r.amount !== undefined)
                  ? [
                      stat(
                        "amount",
                        money(sums("amount"), locale),
                        <IndianRupee />,
                        "green",
                      ),
                    ]
                  : []),
                ...(rows.some((r) => r.qty !== undefined)
                  ? [stat("qty", String(sums("qty")), <Package />, "green")]
                  : []),
              ];
  return (
    <>
      <div className="tb-pagehead">
        <div>
          <span className="tb-breadcrumb">
            {isReport ? (
              <BarChart3 size={15} />
            ) : m.family === "directory" ? (
              <LayoutGrid size={15} />
            ) : (
              <BookOpen size={15} />
            )}{" "}
            {isReport ? (
              <Link href="/reports">{t("reports")}</Link>
            ) : (
              t(isCash ? "money" : m.family)
            )}
          </span>
          <h1>
            {t(isReport ? view : slug)}
            {slug === "slabs" && <small className="tb-beta">{t("beta")}</small>}
          </h1>
        </div>
        {!readOnly && canWrite(book, m.resource) && (
          <button className="tb-primary" onClick={newRecord}>
            <Plus size={18} />
            {t("add")} {t(slug)}
          </button>
        )}
        {isCash && canWrite(book, m.resource) && (
          <Link className="tb-primary" href="/payment-in?new=1">
            <Plus size={18} />
            {t("payment-in")}
          </Link>
        )}
        {slug === "receivables" && (
          <Link className="tb-primary" href="/payment-in?new=1">
            <Plus size={18} />
            {t("payment-in")}
          </Link>
        )}
      </div>
      {book.entitlements?.premium === false &&
        ["partners", "campaigns", "slabs"].includes(slug) && (
          <Link className="tb-note tb-detailactions" href="/plans">
            <Crown size={19} />
            {t("upgradePro")}
          </Link>
        )}
      {slug === "slabs" && (
        <Link className="tb-outline" href="/slab-workshop">
          {t("slabWorkshop")}
        </Link>
      )}
      {slug === "bank-reconciliation" && (
        <Link className="tb-outline" href="/statement-import">
          {t("statementImport")}
        </Link>
      )}
      <NavTabs slug={slug} t={t} />
      {slug === "orders" && (
        <nav className="tb-tabs">
          {["orders", "onlineOrders"].map((k) => (
            <button
              key={k}
              className={k === orderTab ? "on" : ""}
              onClick={() => setOrderTab(k)}
            >
              {t(k)}
            </button>
          ))}
        </nav>
      )}
      <div className="tb-filterrow">
        <span>
          <CalendarDays size={15} />
          <select
            aria-label={t("period")}
            value={dateFilter}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {["allTime", "month", "today", "custom"].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </span>
        <span>
          <Layers3 size={15} />
          {str(book.business, "name")}
        </span>
        <span>
          <Users size={15} />
          <select
            aria-label={t("users")}
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            <option value="">{t("allUsers")}</option>
            {(book.records.users || []).map((u) => (
              <option key={u.id} value={str(u, "userId") || u.id}>
                {label(u, book)}
              </option>
            ))}
          </select>
        </span>
        {dateFilter === "custom" && (
          <>
            <input
              aria-label={t("fromDate")}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <input
              aria-label={t("toDate")}
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </>
        )}
      </div>
      <div className="tb-statgrid">
        {stats.map((s) => (
          <div className="tb-stat" key={s.key}>
            <div>
              <span>{t(s.key)}</span>
              <strong>{s.value}</strong>
            </div>
            <i className={s.tone}>{s.icon}</i>
          </div>
        ))}
      </div>
      {reportData?.note && <div className="tb-note">{t(reportData.note)}</div>}
      <section className="tb-panel tb-listpanel">
        <div className="tb-listtools">
          <div className="tb-search">
            <Search size={17} />
            <input
              aria-label={t("searchList")}
              placeholder={t("searchList")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <button
              className="tb-icon"
              onClick={() => setExtended(!extended)}
              aria-label={t("columnFilters")}
              aria-pressed={extended}
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              className="tb-outline"
              onClick={() => {
                excel(view || slug, cols, rows, book, t, locale).catch((e) =>
                  setToast(String(e)),
                );
              }}
            >
              <Download size={15} />
              {t("excel")}
            </button>
            <button
              className="tb-icon"
              aria-label={t("print")}
              onClick={() => window.print()}
            >
              <Printer size={18} />
            </button>
            {isReport && (
              <a
                className="tb-outline"
                href={
                  "/api/reports/" +
                  encodeURIComponent(view) +
                  "?" +
                  new URLSearchParams({
                    businessId: book.business.id,
                    lang: locale,
                    ...scope,
                    q: query,
                    column: col,
                  })
                }
                target="_blank"
                rel="noreferrer"
              >
                {t("openPdf")}
              </a>
            )}
            {isReport && (
              <button
                className="tb-icon"
                aria-label={t("share")}
                onClick={() =>
                  share(
                    [
                      t(view),
                      str(book.business, "name"),
                      ...rows
                        .slice(0, 20)
                        .map((r) =>
                          cols
                            .map((c) => fmt(r, c, book, t, locale))
                            .join(" · "),
                        ),
                    ].join("\n"),
                  )
                }
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        {extended && (
          <label className="tb-colchoose">
            <Filter size={16} />
            {t("searchColumn")}
            <select value={col} onChange={(e) => setCol(e.target.value)}>
              <option value="">{t("allColumns")}</option>
              {cols.map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </label>
        )}
        {canBatch && rows.length > 0 && (
          <div className="tb-batchbar">
            <select
              multiple
              value={batch}
              onChange={(e) =>
                setBatch(
                  Array.from(e.target.selectedOptions).map((v) => v.value),
                )
              }
              aria-label={t("selectOrders")}
            >
              {rows
                .filter(
                  (r) =>
                    !["converted", "closed"].includes(
                      str(r, "status").toLowerCase(),
                    ),
                )
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    {str(r, "number")} · {str(r, "partyName")}
                  </option>
                ))}
            </select>
            <button
              className="tb-outline"
              disabled={!batch.length}
              onClick={() => setConfirmBatch(true)}
            >
              {t("bulkInvoice")} ({batch.length})
            </button>
          </div>
        )}
        {rows.length > 0 && split ? (
          <div className="tb-directory">
            <div className="tb-dirlist">
              {rows.map((r) => (
                <button
                  className={focused?.id === r.id ? "on" : ""}
                  key={r.id}
                  onClick={() => setFocus(r.id)}
                >
                  <b>{label(r, book)}</b>
                  <span>
                    {slug === "items"
                      ? str(r, "brand") +
                        " · " +
                        n(r, "sellable") +
                        " " +
                        t(str(r, "baseUnit"))
                      : fmt(r, "balance", book, t, locale)}
                  </span>
                </button>
              ))}
            </div>
            {focused && (
              <Details
                key={focused.id}
                inline
                row={focused}
                book={book}
                module={m}
                close={close}
                edit={() => {
                  setEdit(focused);
                  setForm(true);
                }}
              />
            )}
          </div>
        ) : rows.length ? (
          <>
            <DataTable
              rows={rows.slice(0, perPage)}
              columns={cols}
              book={book}
              t={t}
              locale={locale}
              open={
                (!isReport && !isCash) ||
                ["dead-stock", "low-stock", "pending-deliveries"].includes(view)
                  ? setSelected
                  : undefined
              }
            />
            <div className="tb-tablefoot">
              {Math.min(perPage, rows.length)} / {rows.length} {t("records")}
              {rows.length > perPage && (
                <button
                  className="tb-textbtn"
                  onClick={() => setPerPage((v) => v + 50)}
                >
                  {t("loadMore")}
                </button>
              )}
            </div>
          </>
        ) : (
          <Empty
            t={t}
            action={
              !readOnly && canWrite(book, m.resource) ? newRecord : undefined
            }
          />
        )}
      </section>
      {toast && (
        <div role="status" className="tb-toast">
          <CheckCircle2 size={19} />
          {toast}
          <button aria-label={t("close")} onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {confirmBatch && (
        <Modal
          title={t("bulkInvoice")}
          close={() => {
            if (!posting) setConfirmBatch(false);
          }}
        >
          <section className="tb-toolbody">
            <h2>{t("bulkInvoice")}</h2>
            <p>
              {t("bulkConfirm")} · {batch.length}
            </p>
            <div className="tb-detailactions">
              <button
                className="tb-outline"
                disabled={posting}
                onClick={() => setConfirmBatch(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="tb-primary"
                disabled={posting}
                onClick={submitBatch}
              >
                {t(posting ? "saving" : "confirm")}
              </button>
            </div>
          </section>
        </Modal>
      )}
      {showForm && canWrite(book, m.resource) && (
        <Modal title={t(slug)} close={close}>
          {m.family === "documents" ? (
            <DocumentEditor
              module={m}
              book={book}
              source={source}
              initialParty={params.get("party") || ""}
              initialProduct={sourceProduct}
              initialLot={sourceLot}
              voiceEntry={params.get("voice") === "1"}
              damageId={params.get("damage") || ""}
              initialQuantity={Number(params.get("qty")) || 1}
              close={close}
              save={save}
            />
          ) : (
            <RecordForm
              module={m}
              book={book}
              row={edit}
              defaults={{
                ...(params.get("party")
                  ? { partyId: params.get("party") }
                  : {}),
                ...(params.get("document")
                  ? { documentId: params.get("document") }
                  : {}),
                ...(params.get("amount")
                  ? { amount: Number(params.get("amount")) }
                  : {}),
                ...(params.get("lot") ? { lotId: params.get("lot") } : {}),
              }}
              close={close}
              save={save}
            />
          )}
        </Modal>
      )}
      {selected && !showForm && isReport && (
        <Modal title={t(view)} close={close}>
          <div className="tb-toolbody">
            <h2>{t(view)}</h2>
            <dl className="tb-detailsgrid">
              {cols.map((k) => (
                <div key={k}>
                  <dt>{t(k)}</dt>
                  <dd>{fmt(selected, k, book, t, locale)}</dd>
                </div>
              ))}
            </dl>
            <div className="tb-detailactions">
              {view === "dead-stock" && (
                <>
                  <Link
                    className="tb-primary"
                    href={"/offers?new=1&lot=" + selected.id}
                  >
                    {t("createClearance")}
                  </Link>
                  <button
                    className="tb-outline"
                    onClick={() =>
                      share(
                        [
                          str(book.business, "name"),
                          t("clearanceOffer"),
                          fmt(selected, "productId", book, t, locale),
                          t("lotNo") + " " + str(selected, "lotNo"),
                          t("discount") + " 10%",
                        ].join(" · "),
                      )
                    }
                  >
                    {t("whatsappShare")}
                  </button>
                </>
              )}
              {view === "low-stock" && canWrite(book, "purchaseOrders") && (
                <Link
                  className="tb-primary"
                  href={
                    "/purchase-orders?new=1&product=" +
                    selected.id +
                    "&qty=" +
                    Math.max(
                      1,
                      n(selected, "lowStockLevel") - n(selected, "sellable"),
                    )
                  }
                >
                  {t("reorderItem")}
                </Link>
              )}
              {view === "pending-deliveries" && canWrite(book, "challans") && (
                <Link
                  className="tb-primary"
                  href={
                    "/challans?new=1&source=" +
                    (book.records.saleOrders || []).find(
                      (o) => o.number === selected.number,
                    )?.id
                  }
                >
                  {t("challans")}
                </Link>
              )}
              <button className="tb-outline" onClick={close}>
                {t("close")}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {selected && !showForm && !isReport && (
        <Modal title={t("details")} close={close}>
          <Details
            row={selected}
            book={book}
            module={m}
            close={close}
            edit={() => {
              setEdit(selected);
              setForm(true);
            }}
          />
        </Modal>
      )}
    </>
  );
}
function Details({
  row: r,
  module: m,
  book,
  close,
  edit,
  inline = false,
}: {
  row: Row;
  module: Module;
  book: Snapshot;
  close: () => void;
  edit: () => void;
  inline?: boolean;
}) {
  const api = useBook(),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const { locale, t } = useWorkspaceText(),
    isDoc = m.family === "documents",
    isParty = m.slug === "parties",
    isItem = m.slug === "items";
  const amountKeys = [
    "date",
    "dueDate",
    "total",
    "received",
    "balance",
    "status",
  ];
  const keys = isDoc
    ? amountKeys
    : [...new Set([...m.columns, ...m.fields.map((f) => f.key)])].filter(
        (k) =>
          r[k] !== undefined &&
          k !== "photo" &&
          (canCost(book) || !["loss", "purchasePrice"].includes(k)),
      );
  const docLines = lines(r),
    related = isParty
      ? docs(book).filter((d) => d.partyId === r.id)
      : isItem
        ? book.records.lots?.filter((l) => l.productId === r.id)
        : null;
  const relatedCols = isParty
    ? ["date", "number", "total", "status"]
    : ["lotNo", "shade", "physical", "sellable", "lastSoldDate"];
  const printable = isDoc || isParty || m.resource === "payments";
  const suggested = Math.max(1, n(r, "lowStockLevel") - n(r, "sellable"));
  return (
    <div>
      <div className="tb-formhead">
        <span className="tb-headicon">
          {isItem ? <Box /> : isParty ? <Users /> : <FileText />}
        </span>
        <div>
          <small>{t(m.slug)}</small>
          <h2>{label(r, book)}</h2>
        </div>
        {!inline && (
          <button className="tb-icon" aria-label={t("close")} onClick={close}>
            <X />
          </button>
        )}
      </div>
      <div className="tb-scroll">
        {isDoc && <h3>{str(r, "partyName")}</h3>}
        <dl className="tb-detailsgrid">
          {keys.map((k) => (
            <div key={k}>
              <dt>{t(k)}</dt>
              <dd>{fmt(r, k, book, t, locale)}</dd>
            </div>
          ))}
        </dl>
        {readablePhoto(r.photo || r.purchaseProof) && (
          <a
            className="tb-textbtn"
            download="TileBook-photo.jpg"
            href={readablePhoto(r.photo || r.purchaseProof)}
          >
            <Download size={16} />
            {t("photo")}
          </a>
        )}
        {docLines.length > 0 && (
          <>
            <h3>{t("lineItems")}</h3>
            <DataTable
              book={book}
              rows={docLines}
              columns={[
                "productName",
                "lotNo",
                "shade",
                "qty",
                "unit",
                "amount",
              ]}
              locale={locale}
              t={t}
            />
          </>
        )}
        {related && (
          <>
            <h3>{t(isParty ? "transactions" : "lots")}</h3>
            {related.length ? (
              <DataTable
                rows={related}
                columns={relatedCols}
                book={book}
                t={t}
                locale={locale}
              />
            ) : (
              <p>{t("noRecords")}</p>
            )}
          </>
        )}
        <div className="tb-detailactions">
          {isItem &&
            canWrite(book, "purchaseOrders") &&
            n(r, "sellable") <= n(r, "lowStockLevel") && (
              <Link
                className="tb-primary"
                href={
                  "/purchase-orders?new=1&product=" + r.id + "&qty=" + suggested
                }
              >
                {t("reorderItem")}
              </Link>
            )}
          {m.slug === "damage" &&
            canWrite(book, "debitNotes") &&
            !(book.records.debitNotes || []).some(
              (d) => d.damageId === r.id,
            ) && (
              <Link
                className="tb-primary"
                href={
                  "/debit-notes?new=1&damage=" +
                  r.id +
                  "&lot=" +
                  r.lotId +
                  "&qty=" +
                  r.qty
                }
              >
                {t("supplierClaim")}
              </Link>
            )}
          {m.slug === "approvals" &&
            str(r, "status").toLowerCase() === "pending" &&
            canWrite(book, "approvals") &&
            ["Approved", "Rejected"].map((status) => (
              <button
                key={status}
                disabled={busy}
                className="tb-outline"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.save("approvals", { id: r.id, status }, "update");
                    close();
                  } catch (e) {
                    setFeedback(e instanceof Error ? e.message : t("error"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t(status)}
              </button>
            ))}
          {isParty && str(r, "phone") && (
            <>
              <a
                className="tb-outline"
                href={"tel:" + str(r, "phone").replace(/[^+\d]/g, "")}
              >
                {t("callParty")}
              </a>
              <a
                className="tb-outline"
                href={"sms:" + str(r, "phone").replace(/[^+\d]/g, "")}
              >
                {t("sms")}
              </a>
              <Link
                href={"/follow-ups?new=1&party=" + r.id}
                className="tb-outline"
              >
                {t("follow-ups")}
              </Link>
            </>
          )}
          {feedback && (
            <p role="status" className="tb-error">
              {feedback}
            </p>
          )}
          {printable && (
            <PrintActions
              id={r.id}
              businessId={book.business.id}
              locale={locale}
              name={label(r, book)}
              phone={str(
                isParty ? r : lookup(book, "parties", r.partyId),
                "phone",
              )}
              invoice={m.resource === "saleInvoices"}
            />
          )}
          {isDoc && nextDoc[m.slug] && canWrite(book, m.resource) && (
            <Link
              className="tb-primary"
              href={"/" + nextDoc[m.slug] + "?new=1&source=" + r.id}
            >
              {t("createLinked")} {t(nextDoc[m.slug])}
            </Link>
          )}
          {isDoc &&
            ["invoices", "purchases"].includes(m.slug) &&
            n(r, "balance") > 0 &&
            canWrite(book, m.resource) && (
              <Link
                className="tb-outline"
                href={
                  "/" +
                  (m.slug === "purchases" ? "payment-out" : "payment-in") +
                  "?new=1&party=" +
                  r.partyId +
                  "&document=" +
                  r.id +
                  "&amount=" +
                  r.balance
                }
              >
                {t("recordPayment")}
              </Link>
            )}
          {isParty && canWrite(book, "saleInvoices") && (
            <Link className="tb-primary" href={"/invoices?new=1&party=" + r.id}>
              <FilePlus2 size={16} />
              {t("newBill")}
            </Link>
          )}
          {!printable && (m.family === "crm" || m.slug === "lots") && (
            <button
              className="tb-outline"
              onClick={() =>
                share(
                  [
                    str(book.business, "name"),
                    str(r, "message") || label(r, book),
                    r.total ? money(n(r, "total"), locale) : "",
                    r.balance
                      ? t("balance") + " " + money(n(r, "balance"), locale)
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  str(
                    isParty ? r : lookup(book, "parties", r.partyId),
                    "phone",
                  ),
                )
              }
            >
              <Send size={16} />
              {t("whatsappShare")}
            </button>
          )}
          {!isDoc &&
            m.fields.length > 0 &&
            canWrite(book, m.resource) &&
            ["directory", "crm", "admin"].includes(m.family) &&
            m.resource !== "lots" && (
              <button className="tb-outline" onClick={edit}>
                {t("edit")}
              </button>
            )}
          {[
            "slabs",
            "cheques",
            "loans",
            "banks",
            "bank-reconciliation",
          ].includes(m.slug) &&
            (m.slug !== "slabs" ||
              str(r, "status").toLowerCase() === "available") &&
            canWrite(book, m.resource) && (
              <button className="tb-outline" onClick={edit}>
                {t("edit")}
              </button>
            )}
          {m.slug === "partners" && canWrite(book, "commissionPayments") && (
            <Link className="tb-outline" href="/commission-payments?new=1">
              {t("commission-payments")}
            </Link>
          )}
        </div>
        <div className="tb-recorddate">
          {t("createdAt")} · {asDate(str(r, "createdAt"))}
        </div>
      </div>
    </div>
  );
}
