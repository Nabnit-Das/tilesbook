"use client";
import { useLocale } from "next-intl";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import or from "./messages/or.json";
export function useWorkspaceText() {
  const locale = useLocale();
  const file: Record<string, string> =
    locale === "hi" ? hi : locale === "or" ? or : en;
  const t = (key: string) =>
    Object.hasOwn(file, key)
      ? file[key]
      : Object.hasOwn(file, key.toLowerCase())
        ? file[key.toLowerCase()]
        : key;
  return { locale, t };
}
