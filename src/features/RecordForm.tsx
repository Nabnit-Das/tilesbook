"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { captureEvidence } from "@/lib/photo";
import { Camera, Check, Layers3, Mic, X } from "lucide-react";
import type { Module } from "./catalog";
import {
  canCost,
  docs,
  label,
  n,
  str,
  today,
  type Row,
  type Snapshot,
} from "./model";
import { useWorkspaceText } from "./i18n";
import { voice } from "./DocumentEditor";
export default function RecordForm({
  module: m,
  book,
  row,
  defaults = {},
  close,
  save,
}: {
  module: Module;
  book: Snapshot;
  row?: Row;
  defaults?: Record<string, unknown>;
  close: () => void;
  save: (data: Record<string, unknown>) => Promise<void>;
}) {
  const { t, locale } = useWorkspaceText();
  const fields = m.fields.filter(
    (f) => canCost(book) || !["purchasePrice", "landedCost"].includes(f.key),
  );
  const [err, setError] = useState(""),
    [photoBusy, setPhotoBusy] = useState(false),
    [photoName, setPhotoName] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => {
        let v: unknown =
          defaults[f.key] ??
          (row ? row[f.key] : undefined) ??
          f.initial ??
          (f.type === "date" ? today() : (f.options?.[0] ?? ""));
        if (row && f.key === "rate" && row.kind === "box") v = Number(v) / 100;
        if (
          f.type === "select" &&
          v !== "" &&
          f.options &&
          !f.options.includes(String(v))
        )
          v =
            f.options.find(
              (o) => o.toLowerCase() === String(v).toLowerCase(),
            ) || v;
        if (
          (row || defaults[f.key] !== undefined) &&
          f.type === "money" &&
          v !== ""
        )
          v = Number(v) / 100;
        return [f.key, String(v)];
      }),
    ),
  });
  const party = watch("partyId");
  return (
    <form
      className="tb-recordform"
      onSubmit={handleSubmit(async (values) => {
        setError("");
        const data: Record<string, unknown> = { ...defaults };
        if (row) data.id = row.id;
        for (const f of fields) {
          const v = values[f.key];
          if (v === undefined || v === "") continue;
          data[f.key] =
            f.type === "money"
              ? Math.round(Number(v) * 100)
              : ["number", "integer"].includes(f.type)
                ? Number(v)
                : v;
        }
        if (
          m.resource === "products" &&
          Number(data.openingQty) > 0 &&
          !data.lotNo &&
          !row
        ) {
          setError(t("openingLotRequired"));
          return;
        }
        if (
          m.resource === "slabs" &&
          data.status === "reserved" &&
          !data.partyId
        ) {
          setError(t("selectParty"));
          return;
        }
        if (m.resource === "slabs" && data.partyId)
          data.reservedFor = data.partyId;
        if (m.resource === "display" && data.partyId)
          data.givenTo = data.partyId;
        if (m.resource === "partners" && data.kind === "box")
          data.rate = Math.round(Number(data.rate) * 100);
        if (m.resource === "payments")
          data.direction = m.slug === "payment-in" ? "in" : "out";
        if (
          m.resource === "transfers" &&
          data.fromBranchId === data.toBranchId
        ) {
          setError(t("distinctBranches"));
          return;
        }
        try {
          await save(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : t("error"));
        }
      })}
    >
      <div className="tb-formhead">
        <span className="tb-headicon">
          <Layers3 />
        </span>
        <div>
          <small>{t(m.family)}</small>
          <h2>
            {t(row ? "edit" : "newRecord")} · {t(m.slug)}
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
        <div className="tb-formgrid">
          {fields.map((f) => (
            <label
              key={f.key}
              className={f.full || f.type === "photo" ? "tb-span" : ""}
            >
              {t(f.key)}
              {f.type === "money" ? " (₹)" : ""}
              {f.required && <em> *</em>}
              {f.type === "select" ? (
                <select {...register(f.key)} required={f.required}>
                  {f.options?.map((v) => (
                    <option key={v} value={v}>
                      {t(v)}
                    </option>
                  ))}
                </select>
              ) : f.type === "related" ? (
                <select {...register(f.key)} required={f.required}>
                  <option value="">{t("select")}</option>
                  {(f.source === "documents"
                    ? docs(book).filter(
                        (d) =>
                          (!party || d.partyId === party) &&
                          [
                            m.slug === "payment-out"
                              ? "purchaseBills"
                              : "saleInvoices",
                            "saleOrders",
                          ].includes(str(d, "resource")),
                      )
                    : book.records[f.source || ""] || []
                  ).map((r) => (
                    <option key={r.id} value={r.id}>
                      {label(r, book)}
                      {f.source === "lots"
                        ? " · " +
                          str(
                            (book.records.products || []).find(
                              (p) => p.id === r.productId,
                            ),
                            "name",
                          )
                        : ""}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea {...register(f.key)} rows={2} />
              ) : f.type === "photo" ? (
                <span className="tb-photo">
                  <Camera size={19} />
                  {photoName || t("choosePhoto")}
                  <input
                    aria-label={t("choosePhoto")}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoBusy(true);
                      try {
                        setValue(
                          f.key,
                          await captureEvidence(
                            book.business.id,
                            m.resource,
                            file,
                          ),
                        );
                        setPhotoName(file.name);
                      } catch {
                        setError(t("badPhoto"));
                      } finally {
                        setPhotoBusy(false);
                      }
                    }}
                  />
                </span>
              ) : (
                <span className="tb-inline">
                  <input
                    {...register(f.key)}
                    required={f.required}
                    type={
                      f.type === "date"
                        ? "date"
                        : ["money", "number", "integer"].includes(f.type)
                          ? "number"
                          : "text"
                    }
                    min={f.min}
                    max={
                      f.key === "gstRate" || f.key === "percentOff"
                        ? 100
                        : undefined
                    }
                    step={
                      f.type === "integer"
                        ? 1
                        : f.type === "money"
                          ? ".01"
                          : "any"
                    }
                    inputMode={f.key === "phone" ? "tel" : undefined}
                    maxLength={f.key === "phone" ? 18 : undefined}
                  />
                  {f.key === "lotNo" && (
                    <button
                      type="button"
                      className="tb-icon"
                      aria-label={t("voice")}
                      onClick={() =>
                        voice(
                          locale,
                          (s) => setValue(f.key, s),
                          () => setError(t("voiceFallback")),
                        )
                      }
                    >
                      <Mic size={18} />
                    </button>
                  )}
                </span>
              )}
            </label>
          ))}
        </div>
        {m.slug === "partners" && <small>{t("fixedRateNote")}</small>}
        {m.slug === "items" && <small>{t("gstVerify")}</small>}
        {m.slug === "stock-count" && watch("lotId") && (
          <p>
            {t("physical")} ·{" "}
            {n(
              book.records.lots?.find((r) => r.id === watch("lotId")),
              "physical",
            )}
          </p>
        )}
        {err && (
          <p className="tb-error" role="alert">
            {err}
          </p>
        )}
      </div>
      <div className="tb-foot">
        <button type="button" className="tb-outline" onClick={close}>
          {t("cancel")}
        </button>
        <button className="tb-primary" disabled={isSubmitting || photoBusy}>
          <Check size={17} />
          {t(isSubmitting ? "saving" : "save")}
        </button>
      </div>
    </form>
  );
}
