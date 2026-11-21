"use client";
import { useEffect, useRef, useState } from "react";
import { captureEvidence } from "@/lib/photo";
import {
  Calculator,
  Check,
  ChevronDown,
  FileText,
  Mic,
  Plus,
  ScanLine,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { calculateInvoice, convertSqft } from "@/domain/rules";
import type { Module } from "./catalog";
import {
  balances,
  label,
  lines,
  lookup,
  money,
  n,
  preferences,
  str,
  today,
  type Row,
  type Snapshot,
} from "./model";
import { useWorkspaceText } from "./i18n";

type Save = (data: Record<string, unknown>, intent?: string) => Promise<void>;
interface CartLine {
  key: string;
  productId: string;
  lotId: string;
  qty: string;
  rate: string;
  discount: string;
  gstRate: number;
  room: string;
  sourceLineId?: string;
  unit: string;
}
const fresh = (): CartLine => ({
  key: crypto.randomUUID(),
  productId: "",
  lotId: "",
  qty: "1",
  rate: "0",
  discount: "0",
  gstRate: 18,
  room: "",
  unit: "Box",
});
const sourceKinds: Record<string, string[]> = {
  orders: ["estimates", "proformas"],
  invoices: ["challans", "saleOrders", "estimates", "proformas"],
  challans: ["saleOrders"],
  "credit-notes": ["saleInvoices"],
  purchases: ["purchaseOrders"],
  "debit-notes": ["purchaseBills"],
};
export function CalculatorForm({
  book,
  productId = "",
  apply,
}: {
  book: Snapshot;
  productId?: string;
  apply?: (id: string, pieces: number, boxes: number, loose: number) => void;
}) {
  const { t } = useWorkspaceText();
  const products = book.records.products || [];
  const [id, setId] = useState(productId || products[0]?.id || ""),
    [area, setArea] = useState("350"),
    [waste, setWaste] = useState("0"),
    [full, setFull] = useState(false);
  const p = lookup(book, "products", id),
    spp = n(p, "sqftPerPiece"),
    ppb = n(p, "piecesPerBox");
  const valid =
    Number(area) > 0 &&
    Number(waste) >= 0 &&
    spp > 0 &&
    Number.isInteger(ppb) &&
    ppb > 0;
  const result =
    valid && Number(area) <= 1e9 && Number(waste) <= 100
      ? convertSqft(Number(area), spp, ppb, Number(waste), full)
      : null;
  return (
    <div className="tb-calc">
      <label>
        {t("productId")}
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p, book)}
            </option>
          ))}
        </select>
      </label>
      <div className="tb-formgrid">
        <label>
          {t("requiredSqft")}
          <input
            type="number"
            min=".01"
            step="any"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </label>
        <label>
          {t("wastage")}
          <input
            type="number"
            min="0"
            max="100"
            step=".1"
            value={waste}
            onChange={(e) => setWaste(e.target.value)}
          />
        </label>
      </div>
      <label className="tb-check">
        <input
          type="checkbox"
          checked={full}
          onChange={(e) => setFull(e.target.checked)}
        />
        {t("fullBoxes")}
      </label>
      {result ? (
        <>
          <div className="tb-calcresult">
            <Calculator size={24} />
            <div>
              <strong>
                {result.boxes} {t("boxes")} · {result.loose} {t("loose")}
              </strong>
              <small>
                {result.pieces} {t("pieces")} · {result.requiredArea.toFixed(2)}{" "}
                {t("Sqft")}
              </small>
            </div>
          </div>
          {apply && (
            <button
              type="button"
              className="tb-primary"
              onClick={() =>
                apply(id, result.pieces, result.boxes, result.loose)
              }
            >
              <Check size={17} />
              {t("applyQuantity")}
            </button>
          )}
        </>
      ) : (
        <p role="status">{t("invalidConversion")}</p>
      )}
    </div>
  );
}
interface Recognition {
  lang: string;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: (() => void) | null;
  start: () => void;
}
export function voice(
  locale: string,
  onResult: (s: string) => void,
  onError: () => void,
) {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!C) {
    onError();
    return;
  }
  const r = new C();
  r.lang = locale + "-IN";
  r.onresult = (e) => onResult(e.results[0][0].transcript);
  r.onerror = onError;
  try {
    r.start();
  } catch {
    onError();
  }
}
export default function DocumentEditor({
  module: m,
  book,
  save,
  close,
  source: initial,
  initialParty = "",
  initialProduct = "",
  initialLot = "",
  initialQuantity = 1,
  damageId = "",
  voiceEntry = false,
}: {
  module: Module;
  book: Snapshot;
  save: Save;
  close: () => void;
  source?: Row;
  initialParty?: string;
  initialProduct?: string;
  initialLot?: string;
  initialQuantity?: number;
  damageId?: string;
  voiceEntry?: boolean;
}) {
  const { t, locale } = useWorkspaceText();
  const products = book.records.products || [],
    parties = book.records.parties || [],
    lots = book.records.lots || [];
  const isPurchase = ["purchases", "purchase-orders", "debit-notes"].includes(
    m.slug,
  );
  const fromRow = (r: Row): CartLine[] =>
    lines(r)
      .filter((l) => !damageId || l.lotId === initialLot)
      .map((l) => ({
        key: crypto.randomUUID(),
        productId: str(l, "productId"),
        lotId: str(l, "lotId"),
        qty: String(
          damageId
            ? Math.min(initialQuantity, n(l, "qty"))
            : m.slug === "challans"
              ? Math.max(0, n(l, "qty") - n(l, "delivered"))
              : n(l, "qty"),
        ),
        rate: String(n(l, "rate") / 100),
        discount: String(n(l, "discount") / 100),
        gstRate: n(l, "gstRate"),
        room: str(l, "room"),
        unit: str(l, "unit") || "Box",
        sourceLineId: l.id,
      }))
      .filter((l) => Number(l.qty) > 0);
  const [partyId, setParty] = useState(
      initial ? str(initial, "partyId") : initialParty,
    ),
    [cart, setCart] = useState<CartLine[]>(() => {
      if (initial) return fromRow(initial);
      const p = lookup(book, "products", initialProduct);
      return [
        p
          ? {
              ...fresh(),
              productId: p.id,
              lotId:
                initialLot || lots.find((l) => l.productId === p.id)?.id || "",
              qty: String(initialQuantity),
              rate: String(
                n(p, isPurchase ? "purchasePrice" : "salePrice") / 100,
              ),
              unit: str(p, "baseUnit"),
              gstRate: n(p, "gstRate"),
            }
          : fresh(),
      ];
    });
  const [sourceId, setSource] = useState(initial?.id || ""),
    [partner, setPartner] = useState(""),
    [date, setDate] = useState(today),
    [due, setDue] = useState(""),
    [place, setPlace] = useState(
      initial ? str(initial, "placeOfSupply") : str(book.business, "state"),
    ),
    [received, setReceived] = useState(""),
    [payMode, setPayMode] = useState("cash"),
    [notes, setNotes] = useState(""),
    [reason, setReason] = useState(""),
    [calc, setCalc] = useState(""),
    [scan, setScan] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [landed, setLanded] = useState(""),
    [action, setAction] = useState("save"),
    [billDiscount, setBillDiscount] = useState(""),
    [billNo, setBillNo] = useState(""),
    [tds,setTds]=useState(""),[tcs,setTcs]=useState(""),
    [eway, setEway] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [unopened, setUnopened] = useState(true);
  const [proof, setProof] = useState(""),
    [uploading, setUploading] = useState(false),
    [voiceTerm, setVoiceTerm] = useState("");
  const partySearch = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (voiceEntry) partySearch.current?.focus();
  }, [voiceEntry]);
  const sourceDocs = (sourceKinds[m.slug] || []).flatMap((k) =>
    (book.records[k] || []).filter(
      (r) =>
        (!damageId || lines(r).some((l) => l.lotId === initialLot)) &&
        !(m.slug === "challans" && String(r.status).toLowerCase() === "closed"),
    ),
  );
  const patch = (key: string, data: Partial<CartLine>) =>
    setCart((c) => c.map((l) => (l.key === key ? { ...l, ...data } : l)));
  const customer = lookup(book, "parties", partyId);
  const quoteOnly = ["estimates", "proforma", "purchase-orders"].includes(
    m.slug,
  );
  function unitRate(id: string, unit?: string) {
    const p = lookup(book, "products", id);
    const options = (book.records.priceLists || []).filter(
      (v) => v.productId === id,
    );
    const selected =
      options.find((v) => v.partyId === partyId && partyId) ||
      options.find((v) => !v.partyId && v.priceList === customer?.priceList);
    const price = isPurchase
      ? n(p, "purchasePrice")
      : n(selected || p, "salePrice");
    if (
      str(p, "baseUnit").toLowerCase() !== "box" ||
      !unit ||
      unit.toLowerCase() === "box"
    )
      return price / 100;
    const divisor =
      Math.max(1, n(p, "piecesPerBox")) *
      (unit.toLowerCase() === "sqft"
        ? Math.max(0.0001, n(p, "sqftPerPiece"))
        : 1);
    return Math.round(price / divisor) / 100;
  }
  function choose(
    key: string,
    id: string,
    quantity?: number,
    selectedLot?: string,
  ) {
    const p = lookup(book, "products", id);
    const available = lots.filter((l) => l.productId === id);
    const match =
      available.find((l) => n(l, "sellable") >= (quantity || 1)) ||
      available[0];
    patch(key, {
      productId: id,
      lotId: selectedLot || match?.id || "",
      unit: str(p, "baseUnit") || "Box",
      gstRate: n(p, "gstRate"),
      rate: String(unitRate(id)),
      ...(quantity ? { qty: String(quantity) } : {}),
    });
  }
  function scanProduct() {
    const query = scan.trim().toLowerCase();
    if (!query) return;
    const lot = lots.find((l) =>
        [str(l, "lotNo").toLowerCase(), l.id.toLowerCase()].includes(query),
      ),
      p = lot
        ? lookup(book, "products", lot.productId)
        : products.find((p) => str(p, "barcode").toLowerCase() === query);
    if (!p) {
      setFeedback(t("noBarcode"));
      return;
    }
    const match = cart.find(
      (l) => l.productId === p.id && (!lot || l.lotId === lot.id),
    );
    if (match) patch(match.key, { qty: String(Number(match.qty) + 1) });
    else {
      const empty = cart.find((l) => !l.productId);
      if (empty) choose(empty.key, p.id, 1, lot?.id);
      else
        setCart((c) => [
          ...c,
          {
            ...fresh(),
            productId: p.id,
            lotId: lot?.id || lots.find((l) => l.productId === p.id)?.id || "",
            unit: str(p, "baseUnit"),
            rate: String(unitRate(p.id)),
            gstRate: n(p, "gstRate"),
          },
        ]);
    }
    setScan("");
    setFeedback("");
  }
  const design = (id: string) =>
    (str(lookup(book, "products", id), "design").trim() || id).toLowerCase();
  const prefs = preferences(book);
  const mixed =
    prefs.warnMixedLots !== false &&
    cart.some(
      (l, i) =>
        l.productId &&
        l.lotId &&
        cart
          .slice(0, i)
          .some(
            (prev) =>
              design(prev.productId) === design(l.productId) &&
              prev.lotId &&
              prev.lotId !== l.lotId,
          ),
    );
  const amounts = cart
    .filter(
      (l) =>
        Number(l.qty) > 0 &&
        Number(l.rate) >= 0 &&
        Number(l.discount) >= 0 &&
        Number(l.discount) <= Number(l.qty) * Number(l.rate),
    )
    .map((l) => ({
      qty: Number(l.qty),
      ratePaise: Math.round(Number(l.rate) * 100),
      discountPaise: Math.round(Number(l.discount) * 100),
      gstRate: l.gstRate,
      hsn: str(lookup(book, "products", l.productId), "hsn"),
    }));
  const interstate = Boolean(
    place &&
    str(book.business, "state") &&
    place.toLowerCase() !== str(book.business, "state").toLowerCase(),
  );
  const billPaise = Math.round(Number(billDiscount) * 100);
  let totals = calculateInvoice([]),
    invalidTotals = false;
  try {
    totals = calculateInvoice(amounts, interstate, billPaise);
  } catch {
    invalidTotals = true;
  }
  const limit = n(customer, "creditLimit");
  const overLimit =
    limit > 0 &&
    n(
      balances(book).find((p) => p.id === partyId),
      "balance",
    ) +
      totals.totalPaise -
      Math.round(Number(received) * 100) >
      limit;
  const locked =
    (["challans", "credit-notes", "debit-notes"].includes(m.slug) ||
      !!damageId) &&
    !!sourceId;
  const handleSource = (id: string) => {
    setSource(id);
    const s = sourceDocs.find((r) => r.id === id);
    if (s) {
      setParty(str(s, "partyId"));
      setCart(fromRow(s));
      setPlace(str(s, "placeOfSupply") || str(book.business, "state"));
    } else setCart([fresh()]);
  };
  return (
    <form
      className="tb-docform"
      onSubmit={async (e) => {
        e.preventDefault();
        if (invalidTotals) {
          setFeedback(t("invalidTotals"));
          return;
        }
        if (mixed && !reason.trim()) {
          setFeedback(t("reasonRequired"));
          return;
        }
        setBusy(true);
        setFeedback("");
        try {
          await save(
            {
              date,
              partyId,
              damageId: damageId || undefined,
              number: billNo || undefined,
              ewayBillNo: eway,
              purchaseProof: proof,
              vehicleNo: vehicle,
              unopened,
              billDiscount: billPaise,
              tds:Math.round(Number(tds)*100),tcs:Math.round(Number(tcs)*100),
              sourceId: sourceId || undefined,
              placeOfSupply: place,
              dueDate: due || undefined,
              received: Math.round(Number(received) * 100),
              paymentMode: payMode,
              partnerId: partner || undefined,
              notes,
              overrideReason: reason,
              freight: Math.round(Number(landed) * 100),
              lines: cart.map((l) => ({
                productId: l.productId,
                lotId: l.lotId,
                qty: Number(l.qty),
                rate: Math.round(Number(l.rate) * 100),
                discount: Math.round(Number(l.discount) * 100),
                gstRate: l.gstRate,
                unit: l.unit,
                room: l.room,
                sourceLineId: l.sourceLineId,
              })),
            },
            action,
          );
        } catch (error) {
          setFeedback(error instanceof Error ? error.message : t("error"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="tb-formhead">
        <span className="tb-headicon">
          <FileText />
        </span>
        <div>
          <small>{t("documents")}</small>
          <h2>
            {t("newRecord")} · {t(m.slug)}
          </h2>
        </div>
        <button
          type="button"
          className="tb-icon"
          aria-label={t("close")}
          onClick={close}
        >
          <X />
        </button>
      </div>
      <div className="tb-scroll">
        {(voiceEntry || parties.length > 8) && (
          <label>
            {t("findParty")}
            <input
              ref={partySearch}
              type="search"
              value={voiceTerm}
              onChange={(e) => setVoiceTerm(e.target.value)}
              placeholder={t("partySearchHint")}
            />
          </label>
        )}
        <div className="tb-formgrid">
          {!!sourceKinds[m.slug] && (
            <label>
              {t("sourceId")}
              <select
                value={sourceId}
                onChange={(e) => handleSource(e.target.value)}
                required={
                  !!damageId ||
                  ["challans", "credit-notes", "debit-notes"].includes(m.slug)
                }
              >
                <option value="">{t("select")}</option>
                {sourceDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {str(d, "number")} · {str(d, "partyName")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t("partyId")}
            <span className="tb-inline">
              <select
                required
                value={partyId}
                disabled={locked}
                onChange={(e) => {
                  setParty(e.target.value);
                  setPlace(
                    str(lookup(book, "parties", e.target.value), "state") ||
                      str(book.business, "state"),
                  );
                }}
              >
                <option value="">{t("selectParty")}</option>
                {parties
                  .filter(
                    (p) =>
                      p.id === partyId ||
                      [str(p, "name"), str(p, "phone")]
                        .join(" ")
                        .toLowerCase()
                        .includes(voiceTerm.toLowerCase()),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {str(p, "name")}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="tb-icon"
                aria-label={t("voice")}
                onClick={() =>
                  voice(
                    locale,
                    (s) => {
                      const p = parties.find((p) =>
                        str(p, "name").toLowerCase().includes(s.toLowerCase()),
                      );
                      if (p) setParty(p.id);
                      else setFeedback(t("noMatch"));
                    },
                    () => setFeedback(t("voiceFallback")),
                  )
                }
              >
                <Mic size={18} />
              </button>
            </span>
          </label>
          <label>
            {t("date")}
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            {t("placeOfSupply")}
            <input value={place} onChange={(e) => setPlace(e.target.value)} />
          </label>
        </div>
        {m.slug === "purchases" && (
          <label>
            {t("uploadBill")}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  setProof(
                    await captureEvidence(book.business.id, "purchaseBills", f),
                  );
                  setFeedback(t("attached"));
                } catch {
                  setFeedback(t("badPhoto"));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        )}
        {damageId && <p className="tb-note">{t("damageClaimHelp")}</p>}
        {m.slug === "pos" && (
          <div className="tb-scan">
            <ScanLine />
            <input
              autoFocus
              value={scan}
              placeholder={t("scanBarcode")}
              aria-label={t("scanBarcode")}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  scanProduct();
                }
              }}
            />
            <button type="button" onClick={scanProduct}>
              {t("add")}
            </button>
          </div>
        )}
        <div className="tb-sectionhead">
          <h3>{t("lineItems")}</h3>
          <span>
            {cart.length} {t("lines")}
          </span>
        </div>
        {cart.map((l, i) => (
          <div className="tb-linecard" key={l.key}>
            <div className="tb-linehead">
              <b>
                {t("line")} {i + 1}
              </b>
              <button
                type="button"
                className="tb-icon"
                disabled={cart.length === 1}
                aria-label={t("removeLine")}
                onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="tb-formgrid">
              <label>
                {t("productId")}
                <select
                  required
                  value={l.productId}
                  disabled={locked}
                  onChange={(e) => choose(l.key, e.target.value)}
                >
                  <option value="">{t("selectItem")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {str(p, "name")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("lotShade")}
                <select
                  required={!quoteOnly}
                  value={l.lotId}
                  disabled={locked}
                  onChange={(e) => patch(l.key, { lotId: e.target.value })}
                >
                  <option value="">{t("selectLot")}</option>
                  {lots
                    .filter((v) => v.productId === l.productId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {label(v, book)} · {n(v, "sellable")} {t("available")}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {str(
              lookup(book, "products", l.productId),
              "baseUnit",
            ).toLowerCase() === "box" &&
              !locked && (
                <label>
                  {t("unit")}
                  <select
                    value={l.unit.toLowerCase()}
                    onChange={(e) =>
                      patch(l.key, {
                        unit: e.target.value,
                        rate: String(unitRate(l.productId, e.target.value)),
                      })
                    }
                  >
                    {["Box", "Piece", "Sqft"].map((unit) => (
                      <option key={unit} value={unit.toLowerCase()}>
                        {t(unit)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            <div className="tb-formgrid four">
              <label>
                {t("qty")} ({t(l.unit)})
                <input
                  type="number"
                  min=".001"
                  step=".001"
                  required
                  value={l.qty}
                  onChange={(e) => patch(l.key, { qty: e.target.value })}
                />
              </label>
              <label>
                {t("rateRupees")}
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={l.rate}
                  required
                  onChange={(e) => patch(l.key, { rate: e.target.value })}
                />
              </label>
              <label>
                {t("discountRupees")}
                <input
                  type="number"
                  step=".01"
                  min="0"
                  max={Math.max(0, Number(l.qty) * Number(l.rate))}
                  value={l.discount}
                  onChange={(e) => patch(l.key, { discount: e.target.value })}
                />
              </label>
              <label>
                {t("gstRate")}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  required
                  value={l.gstRate}
                  onChange={(e) =>
                    patch(l.key, { gstRate: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {m.slug === "estimates" && (
              <label>
                {t("room")}
                <input
                  value={l.room}
                  onChange={(e) => patch(l.key, { room: e.target.value })}
                />
              </label>
            )}
            {prefs.sqftConverter !== false && (
              <button
                type="button"
                className="tb-textbtn"
                onClick={() => setCalc(calc === l.key ? "" : l.key)}
              >
                <Calculator size={16} />
                {t("calculator")}
                <ChevronDown size={15} />
              </button>
            )}
            {calc === l.key && (
              <CalculatorForm
                book={book}
                productId={l.productId}
                apply={(id, pieces, boxes, loose) => {
                  const p = lookup(book, "products", id);
                  choose(
                    l.key,
                    id,
                    str(p, "baseUnit").toLowerCase() === "box"
                      ? boxes + loose / n(p, "piecesPerBox")
                      : pieces,
                  );
                  setCalc("");
                }}
              />
            )}
          </div>
        ))}
        {!locked && (
          <button
            type="button"
            className="tb-outline"
            onClick={() => setCart((c) => [...c, fresh()])}
          >
            <Plus size={16} />
            {t("addLine")}
          </button>
        )}
        {mixed && (
          <div className="tb-warning">
            <TriangleAlert size={18} />
            <label>
              {t("mixedLots")}
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("overrideReason")}
              />
            </label>
          </div>
        )}
        <details className="tb-details">
          <summary>{t("moreDetails")}</summary>
          <div className="tb-formgrid">
            <label>
              {t("dueDate")}
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label>
              {t("partnerId")}
              <select
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
              >
                <option value="">{t("none")}</option>
                {(book.entitlements?.premium === false
                  ? []
                  : book.records.partners || []
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {label(p, book)}
                  </option>
                ))}
              </select>
            </label>
            {isPurchase && (
              <label>
                {t("landedCost")} (₹)
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={landed}
                  onChange={(e) => setLanded(e.target.value)}
                />
              </label>
            )}
            <label>
              {t("number")}
              <input
                value={billNo}
                placeholder={t("automatic")}
                onChange={(e) => setBillNo(e.target.value)}
              />
            </label>
            <label>{t("tds")} (₹)<input type="number" min="0" step=".01" value={tds} onChange={e=>setTds(e.target.value)}/></label>
<label>{t("tcs")} (₹)<input type="number" min="0" step=".01" value={tcs} onChange={e=>setTcs(e.target.value)}/></label>
<label>
              {t("vehicleNo")}
              <input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
              />
            </label>
            <label>
              {t("eway")}
              <input value={eway} onChange={(e) => setEway(e.target.value)} />
            </label>
            <label>
              {t("billDiscount")} (₹)
              <input
                type="number"
                step=".01"
                min="0"
                value={billDiscount}
                onChange={(e) => setBillDiscount(e.target.value)}
              />
            </label>
            <label>
              {t("notes")}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
        </details>
        <div className="tb-doctotal">
          <div>
            <span>{t("taxable")}</span>
            <strong>{money(totals.taxablePaise, locale)}</strong>
          </div>
          <div>
            <span>{t("tax")}</span>
            <strong>{money(totals.taxPaise, locale)}</strong>
          </div>
          <div className="tb-grand">
            <b>{t("total")}</b>
            <strong>{money(totals.totalPaise, locale)}</strong>
          </div>
        </div>
        {["invoices", "pos", "orders", "purchases"].includes(m.slug) && (
          <div className="tb-formgrid">
            <label>
              {t("received")} (₹)
              <input
                type="number"
                min="0"
                max={totals.totalPaise / 100}
                step=".01"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            <label>
              {t("mode")}
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
              >
                {["cash", "upi", "bank", "cheque"].map((v) => (
                  <option key={v} value={v}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {m.slug === "credit-notes" && (
          <label className="tb-check">
            <input
              type="checkbox"
              required
              checked={unopened}
              onChange={(e) => setUnopened(e.target.checked)}
            />
            {t("unopenedBoxes")}
          </label>
        )}
        {overLimit && ["invoices", "pos"].includes(m.slug) && (
          <p className="tb-warning">
            {t("creditWarning")} · {money(limit, locale)}
          </p>
        )}
        {invalidTotals && <p className="tb-error">{t("invalidTotals")}</p>}
        {feedback && (
          <p className="tb-error" role="alert">
            {feedback}
          </p>
        )}
      </div>
      <div className="tb-foot">
        <button className="tb-outline" type="button" onClick={close}>
          {t("cancel")}
        </button>
        <button
          type="submit"
          className="tb-outline"
          disabled={busy || uploading}
          onClick={() => setAction("print")}
        >
          {t("savePrint")}
        </button>
        <button
          type="submit"
          className="tb-primary"
          disabled={busy || uploading}
          onClick={() => setAction("save")}
        >
          {t(busy ? "saving" : "save")}
        </button>
      </div>
    </form>
  );
}
