"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBook } from "@/lib/client";
export default function StaffAccess() {
  const { book, refresh } = useBook(),
    t = useTranslations(),
    [message, setMessage] = useState("");
  if (book?.role !== "Owner") return null;
  return (
    <section>
      <h2>{t("staffAccess")}</h2>
      {book.records.users
        .filter((r) => r.status === "Active" || r.status === "Invited")
        .map((r) => (
          <p key={r.id}>
            {String(r.name || r.phone)} · {String(r.role)}{" "}
            <button
              className="btn"
              onClick={async () => {
                if (!window.confirm(t("revokeStaff"))) return;
                try {
                  const res = await fetch("/api/workspaces", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      businessId: book.business.id,
                      invitation: r.id,
                    }),
                  });
                  if (!res.ok) throw Error();
                  await refresh();
                } catch {
                  setMessage(t("authFailed"));
                }
              }}
            >
              {t("revokeStaff")}
            </button>
          </p>
        ))}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
