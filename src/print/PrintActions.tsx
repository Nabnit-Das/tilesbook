"use client";
import { useState } from "react";
import { Download, Printer, Send } from "lucide-react";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import or from "./messages/or.json";

interface Props {
  id: string;
  businessId: string;
  locale: string;
  name: string;
  phone?: string;
  invoice?: boolean;
}
export function PrintActions({
  id,
  businessId,
  locale,
  name,
  phone = "",
  invoice = false,
}: Props) {
  const t = locale === "hi" ? hi : locale === "or" ? or : en;
  const [paper, setPaper] = useState(""),
    [copy, setCopy] = useState(""),
    [lang, setLang] = useState(""),
    [retail, setRetail] = useState(false);
  const [preparing, setPreparing] = useState(false),
    [ready, setReady] = useState<{ href: string; file: File } | null>(null),
    [status, setStatus] = useState<"attached" | "failed" | null>(null);
  const params = new URLSearchParams({ businessId, uiLang: locale });
  if (paper) params.set("paper", paper);
  if (copy) params.set("copy", copy);
  if (lang) params.set("lang", lang);
  if (retail) params.set("retail", "1");
  const base = "/api/print/" + encodeURIComponent(id);
  const href = base + "?" + params.toString();
  const phoneNumber = phone.replace(/\D/g, "");
  const wa =
    "https://wa.me/" +
    (phoneNumber.length === 10 ? "91" : "") +
    phoneNumber +
    "?text=" +
    encodeURIComponent(name);
  async function share() {
    setStatus(null);
    const existing = ready?.href === href ? ready.file : null;
    if (existing) {
      try {
        await navigator.share({ files: [existing], title: name });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setStatus("failed");
      }
      return;
    }
    setPreparing(true);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/pdf")
      )
        throw new Error("Invalid PDF");
      const file = new File(
        [await response.blob()],
        (name.replace(/[\\/:*?"<>|]/g, "-") || "TileBook") + ".pdf",
        { type: "application/pdf" },
      );
      if (navigator.canShare?.({ files: [file] })) {
        // A second tap preserves transient user activation even on a slow connection.
        setReady({ href, file });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setStatus("attached");
      }
    } catch {
      setStatus("failed");
    } finally {
      setPreparing(false);
    }
  }
  return (
    <div
      className="print-actions"
      style={{ flexBasis: "100%", display: "grid", gap: 10 }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="tb-outline" href={href} target="_blank" rel="noreferrer">
          <Printer size={16} />
          {t.openPdf}
        </a>
        <a className="tb-outline" href={href + "&download=1"}>
          <Download size={16} />
          {t.downloadPdf}
        </a>
        <button
          type="button"
          className="tb-outline"
          disabled={preparing}
          onClick={share}
        >
          <Send size={16} />
          {preparing
            ? t.preparing
            : ready?.href === href
              ? t.shareReady
              : t.sharePdf}
        </button>
        {invoice && (
          <a
            className="tb-outline"
            href={
              base +
              "?" +
              new URLSearchParams({
                ...Object.fromEntries(params),
                paper: "80mm",
              })
            }
            target="_blank"
            rel="noreferrer"
          >
            {t.thermal}
          </a>
        )}
      </div>
      <details>
        <summary
          style={{ cursor: "pointer", width: "fit-content", paddingBlock: 5 }}
        >
          {t.printOptions}
        </summary>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label>
            {t.paper}{" "}
            <select value={paper} onChange={(e) => setPaper(e.target.value)}>
              <option value="">{t.useTemplate}</option>
              <option>A4</option>
              <option>A5</option>
              <option value="80mm">{t.thermal}</option>
            </select>
          </label>
          <label>
            {t.copies}{" "}
            <select value={copy} onChange={(e) => setCopy(e.target.value)}>
              <option value="">{t.useTemplate}</option>
              {(["original", "duplicate", "triplicate"] as const).map((v) => (
                <option key={v} value={v}>
                  {t[v]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.printLanguage}{" "}
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="">{t.useTemplate}</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="or">ଓଡ଼ିଆ</option>
            </select>
          </label>
          {invoice && (
            <label>
              {t.kind}{" "}
              <select
                value={retail ? "retail" : "invoice"}
                onChange={(e) => setRetail(e.target.value === "retail")}
              >
                <option value="invoice">{t.invoice}</option>
                <option value="retail">{t.retail}</option>
              </select>
            </label>
          )}
        </div>
      </details>
      {status && (
        <p role="status">
          {status === "failed" ? (
            t.pdfFailure
          ) : (
            <>
              {t.attachPdf}{" "}
              <a href={wa} target="_blank" rel="noreferrer">
                {t.whatsapp}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
export default PrintActions;
