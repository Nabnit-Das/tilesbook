"use client";
import { useTranslations } from "next-intl";
export default function Privacy() {
  const t = useTranslations();
  return (
    <main className="access-main">
      <article className="access-card">
        <h1>{t("privacyPolicy")}</h1>
        <p>{t("privacyText")}</p>
      </article>
    </main>
  );
}
