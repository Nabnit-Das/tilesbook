"use client";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Brand from "./Brand";
export default function Access({
  firms,
  userId,
}: {
  firms: { id: string; name: string }[];
  userId: string;
}) {
  const t = useTranslations(),
    locale = useLocale(),
    [registered, setRegistered] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function enter(id: string) {
    localStorage.setItem("tb-firm", id);
    localStorage.setItem("tb-last-" + userId, id);
    location.replace("/");
  }
  useEffect(() => {
    const last = localStorage.getItem("tb-last-" + userId);
    const preferred =
      firms.length === 1 ? firms[0] : firms.find((f) => f.id === last);
    if (preferred) enter(preferred.id);
  }, [firms, userId]);
  const textField = (key: string, maxLength: number, pattern?: string) => (
    <label key={key}>
      {t(key)}
      <input name={key} maxLength={maxLength} pattern={pattern} required />
    </label>
  );
  return (
    <main className="access-main">
      <Brand />
      <section className="access-card">
        <h1>{t(firms.length ? "chooseWorkspace" : "startWorkspace")}</h1>
        {firms.length ? (
          firms.map((f) => (
            <button key={f.id} className="btn" onClick={() => enter(f.id)}>
              {f.name}
            </button>
          ))
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/workspaces", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
                if (!r.ok) throw Error();
                localStorage.setItem("tb-lang", String(data.language));
                enter((await r.json()).id);
              } catch {
                setError(t("authInvalid"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {textField("ownerName", 120)}
            <label>
              {t("firm_name")}
              <input name="name" required maxLength={120} />
            </label>
            <label>
              {t("category")}
              <select name="category">
                {["tiles", "sanitary", "marble", "mixed"].map((k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("gstStatus")}
              <select
                name="gstStatus"
                onChange={(e) => setRegistered(e.target.value === "registered")}
              >
                {["unregistered", "registered"].map((k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ))}
              </select>
            </label>
            {registered &&
              textField(
                "gstin",
                15,
                "[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]",
              )}
            <label>
              {t("firm_address")}
              <input name="address" maxLength={400} required />
            </label>
            {textField("city", 100)}
            <label>
              {t("firm_state")}
              <input name="state" required maxLength={80} />
            </label>
            {textField("pin", 6, "[1-9][0-9]{5}")}
            {textField("phone", 10, "[0-9]{10}")}
            <label>
              {t("financialYear")}
              <input
                name="financialYear"
                required
                pattern="20[0-9]{2}"
                defaultValue={
                  new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0)
                }
              />
            </label>
            <label>
              {t("language")}
              <select name="language" defaultValue={locale}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="or">ଓଡ଼ିଆ</option>
              </select>
            </label>
            <button className="btn primary" disabled={busy}>
              {t(busy ? "loading" : "startWorkspace")}
            </button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
