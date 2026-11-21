"use client";
import Image from "next/image";
import { useState } from "react";
import {
  BookOpen,
  Camera,
  Check,
  Download,
  ImagePlus,
  Search,
  Send,
} from "lucide-react";
import { useBook } from "@/lib/client";
import { captureEvidence, readablePhoto } from "@/lib/photo";
import { useWorkspaceText } from "./i18n";
import { catalogueItems, productLibrary } from "./showcase";
import { canWrite, download, money, share, str, type Snapshot } from "./model";
export function DesignGallery({ book }: { book: Snapshot }) {
  const { locale, t } = useWorkspaceText(),
    api = useBook(),
    [search, setSearch] = useState(""),
    [cat, setCat] = useState(""),
    [busy, setBusy] = useState(false),
    [message, say] = useState("");
  const all = book.records.products || [];
  const rows = catalogueItems(all, search, cat);
  const url =
    "/api/catalogue?" +
    new URLSearchParams({
      businessId: book.business.id,
      lang: locale,
      q: search,
      category: cat,
    });
  const saveImage = async (id: string, file: File) => {
    setBusy(true);
    say("");
    try {
      const item = all.find((p) => p.id === id);
      if (!item) return;
      const photo = await captureEvidence(book.business.id, "products", file);
      await api.save(
        "products",
        {
          id,
          name: item.name,
          baseUnit: item.baseUnit,
          piecesPerBox: item.piecesPerBox,
          sqftPerPiece: item.sqftPerPiece,
          gstRate: item.gstRate,
          salePrice: item.salePrice,
          photo,
        },
        "update",
      );
      say(t("saved"));
    } catch (e) {
      say(e instanceof Error ? e.message : t("badPhoto"));
    } finally {
      setBusy(false);
    }
  };
  async function sendFile() {
    setBusy(true);
    say("");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw Error(t("pdfFailure"));
      const file = new File([await res.blob()], "TileBook-catalogue.pdf", {
        type: "application/pdf",
      });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({
          files: [file],
          title: str(book.business, "name"),
        });
      else {
        download(file, file.name);
        say(t("attachCatalogue"));
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        say(e instanceof Error ? e.message : t("pdfFailure"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="tb-pagehead">
        <div>
          <span className="tb-breadcrumb">
            <BookOpen size={16} />
            {t("items")}
          </span>
          <h1>{t("designGallery")}</h1>
        </div>
        <div className="tb-detailactions">
          <a href={url} className="tb-outline">
            <Download size={16} />
            {t("downloadPdf")}
          </a>
          <button
            className="tb-primary"
            disabled={busy || !rows.length}
            onClick={sendFile}
          >
            <Send size={16} />
            {t("whatsappShare")}
          </button>
        </div>
      </div>
      <div className="tb-galleryfilters">
        <label className="tb-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("searchList")}
            placeholder={t("searchList")}
          />
        </label>
        <select
          value={cat}
          aria-label={t("category")}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">{t("allCategories")}</option>
          {Array.from(
            new Set(all.map((r) => str(r, "category")).filter(Boolean)),
          )
            .sort()
            .map((c) => (
              <option key={c}>{c}</option>
            ))}
        </select>
      </div>
      {message && (
        <div className="tb-note" role="status">
          {message}
          {message === t("attachCatalogue") && (
            <button
              className="tb-textbtn"
              onClick={() =>
                share(str(book.business, "name") + " · " + t("designGallery"))
              }
            >
              {t("openWhatsApp")}
            </button>
          )}
        </div>
      )}
      <div className="tb-gallery">
        {rows.map((p) => (
          <article key={p.id} className="tb-panel">
            <div className="tb-productphoto">
              {readablePhoto(p.photo) ? (
                <Image
                  unoptimized
                  src={p.photo}
                  alt={p.name}
                  width={400}
                  height={260}
                />
              ) : (
                <ImagePlus size={32} aria-hidden="true" />
              )}
              {canWrite(book, "products") && (
                <label className="tb-camera" title={t("choosePhoto")}>
                  <Camera size={16} />
                  <input
                    type="file"
                    disabled={busy}
                    accept="image/*"
                    aria-label={t("choosePhoto") + " " + p.name}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void saveImage(p.id, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <div>
              <small>{p.brand}</small>
              <h2>{p.name}</h2>
              <p>{[p.size, p.finish].filter(Boolean).join(" · ")}</p>
              <strong>
                {money(p.price, locale)} / {t(p.unit)}
              </strong>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <p>{t("noRecords")}</p>}
      <p className="tb-recorddate">{t("cataloguePriceNote")}</p>
    </>
  );
}
export function ItemLibrary({ book }: { book: Snapshot }) {
  const { t } = useWorkspaceText(),
    api = useBook(),
    [key, setKey] = useState<string>(productLibrary[0].key),
    [price, setPrice] = useState(""),
    [name, setName] = useState(t(productLibrary[0].key)),
    [message, say] = useState(""),
    [busy, setBusy] = useState(false);
  const item = productLibrary.find((p) => p.key === key)!;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const normalized = name.trim();
        if (!normalized) return;
        setBusy(true);
        say("");
        try {
          if (
            (book.records.products || []).some(
              (p) =>
                str(p, "name").trim().toLowerCase() ===
                normalized.toLowerCase(),
            )
          )
            throw Error(t("alreadyImported"));
          await api.save("products", {
            name: normalized,
            baseUnit: item.baseUnit,
            size: item.size,
            sqftPerPiece: item.sqftPerPiece,
            piecesPerBox: item.piecesPerBox,
            hsn: item.hsn,
            gstRate: item.gstRate,
            salePrice: Math.round(Number(price) * 100),
            libraryCode: key,
          });
          say(t("saved"));
        } catch (e) {
          say(e instanceof Error ? e.message : t("error"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {t("libraryItem")}
        <select
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setName(t(e.target.value));
            say("");
          }}
        >
          {productLibrary.map((p) => (
            <option key={p.key} value={p.key}>
              {t(p.key)}
            </option>
          ))}
        </select>
      </label>
      <p>
        {item.size} · {t(item.baseUnit)} · {item.gstRate}% {t("tax")}
      </p>
      <div className="tb-formgrid">
        <label>
          {t("name")}
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("salePrice")} (₹)
          <input
            type="number"
            min="0"
            step=".01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
      <p>{t("gstVerify")}</p>
      <button
        className="tb-primary"
        disabled={busy || !canWrite(book, "products")}
      >
        <Check size={16} />
        {t("importItems")}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
