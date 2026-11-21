"use client";
import { useState } from "react";
import { Download, Upload, Users } from "lucide-react";
import { useBook } from "@/lib/client";
import {
  readTallyMasters,
  readVcard,
  tallyMasters,
  type Master,
} from "./exchange";
import { canWrite, download, str, type Snapshot } from "./model";
import { useWorkspaceText } from "./i18n";
interface Contacts {
  select: (
    props: string[],
    options: { multiple: boolean },
  ) => Promise<{ name?: string[]; tel?: string[] }[]>;
}
export default function MasterExchange({
  book,
  tool,
}: {
  book: Snapshot;
  tool: string;
}) {
  const { t } = useWorkspaceText(),
    api = useBook(),
    [pending, setPending] = useState<Master[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const accept = tool === "tallyMasters" ? ".xml" : ".vcf,.vcard";
  const prepare = (rows: Master[]) => {
    const seen = new Set<string>();
    const next = rows.filter((r) => {
      const key = r.resource + ":" + String(r.data.name).toLowerCase();
      if (
        seen.has(key) ||
        (book.records[r.resource] || []).some(
          (x) =>
            str(x, "name").toLowerCase() === String(r.data.name).toLowerCase(),
        )
      )
        return false;
      seen.add(key);
      return true;
    });
    setPending(next);
    setMessage(next.length ? "" : t("noNewRecords"));
  };
  const readFile = async (file: File) => {
    setMessage("");
    try {
      if (file.size > 5_000_000) throw Error();
      const text = await file.text();
      prepare(
        tool === "tallyMasters" ? readTallyMasters(text) : readVcard(text),
      );
    } catch {
      setMessage(t("badImport"));
    }
  };
  const pick = async () => {
    const contacts = (navigator as unknown as { contacts?: Contacts }).contacts;
    if (!contacts) {
      setMessage(t("contactFallback"));
      return;
    }
    try {
      const res = await contacts.select(["name", "tel"], { multiple: true });
      prepare(
        res
          .filter((r) => r.name?.length)
          .map((r) => ({
            resource: "parties",
            data: {
              name: r.name![0],
              phone: r.tel?.[0] || "",
              type: "customer",
            },
          })),
      );
    } catch {
      setMessage(t("contactFallback"));
    }
  };
  const commit = async () => {
    setBusy(true);
    let count = 0;
    try {
      for (const row of pending) {
        await api.save(row.resource, row.data);
        count++;
      }
      setMessage(t("rowsProcessed") + " · " + count);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("error"));
    } finally {
      setPending((v) => v.slice(count));
      setBusy(false);
    }
  };
  return (
    <div>
      <p>{t(tool === "tallyMasters" ? "tallyHelp" : "contactHelp")}</p>
      <div className="tb-detailactions">
        {tool === "tallyMasters" ? (
          <button
            className="tb-outline"
            onClick={() =>
              download(
                new Blob(
                  [
                    tallyMasters(
                      book.records.products || [],
                      book.records.parties || [],
                    ),
                  ],
                  { type: "application/xml" },
                ),
                "TileBook-masters.xml",
              )
            }
          >
            <Download size={16} />
            {t("exportTally")}
          </button>
        ) : (
          <button className="tb-outline" onClick={pick}>
            <Users size={16} />
            {t("pickContacts")}
          </button>
        )}
        <label className="tb-filebtn">
          <Upload size={16} />
          {t("chooseFileGeneric")}
          <input
            type="file"
            accept={accept}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void readFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {!!pending.length && (
        <>
          <h3>
            {t("preview")} · {pending.length}
          </h3>
          <ul>
            {pending.slice(0, 10).map((p) => (
              <li key={p.resource + ":" + p.data.name}>{p.data.name}</li>
            ))}
          </ul>
          <button
            className="tb-primary"
            onClick={commit}
            disabled={busy || pending.some((p) => !canWrite(book, p.resource))}
          >
            {t("applyImport")}
          </button>
        </>
      )}
      {message && (
        <p role="status" className="tb-note">
          {message}
        </p>
      )}
    </div>
  );
}
