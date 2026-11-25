"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceLock } from "./Passcode";
import { prepareQueuedMedia } from "@/lib/queueSync";
import { Book, type RowInput, type SaveResult } from "@/lib/client";
import type { Snapshot } from "@/types/database";
import { clearLocalBooks, localBook, type Pending } from "@/lib/offline";
const eligible = new Set([
  "saleInvoices",
  "payments",
  "damage",
  "stockCounts",
  "transfers",
  "display",
  "purchaseBills",
]);
async function submit(input: Pending): Promise<SaveResult> {
  const r = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedUser: input.userId,
      resource: input.resource,
      data: input.data,
      action: input.action,
      requestId: input.requestId,
      businessId: input.businessId,
    }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(String(json.error ?? r.statusText));
  return json as SaveResult;
}
export function BookProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [book, setBook] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [firm, setFirm] = useState(""),
    [pending, setPending] = useState(0),
    [online, setOnline] = useState(true);
  const selectedFirm = useRef('');
  const seq = useRef(0),
    syncing = useRef(false);
  const refresh = useCallback(async () => {
    if(selectedFirm.current!==firm)return;
    const sequence = ++seq.current;
    let target = firm || localStorage.getItem("tb-last-" + userId) || "";
    const previous = JSON.parse(
      localStorage.getItem("tb-active") || "null",
    ) as { userId: string; firm: string } | null;
    if (previous && previous.userId !== userId) {
      setBook(null);
      await clearLocalBooks();
    }
    if (!target && previous?.userId === userId) target = previous.firm;
    try {
      if (!target && navigator.onLine) {
        const list = await fetch("/api/workspaces", { cache: "no-store" });
        if (list.status === 401) {
          await clearLocalBooks();
          location.replace("/login");
          return;
        }
        if (!list.ok) throw new Error(list.statusText);
        const firms = await list.json();
        if (sequence !== seq.current) return;
        if (firms.length !== 1) {
          location.replace("/access");
          return;
        }
        target = firms[0].id;
        localStorage.setItem("tb-last-" + userId, target);
      }
      const response = await fetch(
        "/api/data" +
          (target ? "?businessId=" + encodeURIComponent(target) : ""),
        { cache: "no-store" },
      );
      if (sequence !== seq.current) return;
      if (response.status === 401 || response.status === 403) {
        setBook(null);
        localStorage.removeItem("tb-last-" + userId);
        await clearLocalBooks();
        location.replace(response.status === 401 ? "/login" : "/access");
        return;
      }
      const b = await response.json();
      if (!response.ok) throw new Error(b.error || response.statusText);
      if (sequence !== seq.current) return;
      if (b.userId !== userId || b.business.id !== target) {
        setBook(null);
        await clearLocalBooks();
        location.replace("/access");
        return;
      }
      setBook(b);
      setError("");
      target = b.business.id;
      localStorage.setItem("tb-firm", target);
      localStorage.setItem(
        "tb-active",
        JSON.stringify({
          userId,
          firm: target,
          expires: Date.now() + 12 * 3600000,
        }),
      );
      await localBook.snapshots.put({ key: userId + ":" + target, book: b });
      setPending(
        await localBook.queue
          .where("[userId+businessId]")
          .equals([userId, target])
          .count(),
      );
    } catch (e) {
      if (sequence !== seq.current) return;
      if (
        !navigator.onLine &&
        previous?.userId === userId &&
        previous.firm === target &&
        Number((previous as { expires?: number }).expires) > Date.now()
      ) {
        const saved = await localBook.snapshots.get(userId + ":" + target);
        if (saved) {
          setBook(saved.book);
          setError("");
          setPending(
            await localBook.queue
              .where("[userId+businessId]")
              .equals([userId, target])
              .count(),
          );
          return;
        }
      }
      setBook(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [firm, userId]);
  const businessId = book?.business.id ?? firm;
  const flush = useCallback(async () => {
    if (!navigator.onLine || !businessId || syncing.current) return;
    syncing.current = true;
    try {
      const q = await localBook.queue
        .where("[userId+businessId]")
        .equals([userId, businessId])
        .sortBy("time");
      for (const p of q) {
        if(selectedFirm.current && selectedFirm.current!==businessId)break;
        const prepared = await prepareQueuedMedia(p);
        if (prepared !== p) await localBook.queue.put(prepared);
        await submit(prepared);
        await localBook.queue.delete(p.requestId);
      }
      if (q.length) await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      syncing.current = false;
      setPending(
        await localBook.queue
          .where("[userId+businessId]")
          .equals([userId, businessId])
          .count(),
      );
    }
  }, [userId, businessId, refresh]);
  useEffect(() => {
    void refresh();
    const changed = (e: StorageEvent) => {
      if (
        e.key === "tb-active" &&
        (!e.newValue || JSON.parse(e.newValue).userId !== userId)
      ) {
        seq.current++;
        setBook(null);
        location.replace("/login");
      }
    };
    window.addEventListener("storage", changed);
    return () => {
      seq.current++;
      window.removeEventListener("storage", changed);
    };
  }, [refresh, userId]);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void refresh();
        void flush();
      }
    };
    setOnline(navigator.onLine);
    if (navigator.onLine) void flush();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [flush, refresh]);
  useEffect(() => {
    if (!book) return;
    const check = () => {
      if (navigator.onLine) {
        void refresh();
        return;
      }
      const active = JSON.parse(localStorage.getItem("tb-active") || "null");
      if (
        active?.userId !== userId ||
        active.firm !== book.business.id ||
        active.expires <= Date.now()
      ) {
        seq.current++;
        setBook(null);
        location.replace("/login");
      }
    };
    const timer = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [book, refresh, userId]);
  const save = useCallback(
    async (resource: string, data: RowInput, action = "create") => {
      if (!businessId) throw new Error("Choose a business first");
      if (!navigator.onLine) {
        const active = JSON.parse(localStorage.getItem("tb-active") || "null");
        if (
          active?.userId !== userId ||
          active.firm !== businessId ||
          active.expires <= Date.now()
        )
          throw new Error("Sign in required");
      }
      const p: Pending = {
        userId,
        businessId,
        resource,
        data,
        action,
        time: Date.now(),
        requestId: crypto.randomUUID(),
      };
      try {
        if (!navigator.onLine) throw new TypeError("Offline");
        const result = await submit(p);
        await refresh();
        return result;
      } catch (e) {
        if (
          !(e instanceof TypeError) ||
          !eligible.has(resource) ||
          action !== "create"
        )
          throw e;
        await localBook.queue.put(p);
        setPending((n) => n + 1);
        return { row: { id: p.requestId, ...data }, queued: true };
      }
    },
    [userId, businessId, refresh],
  );
  return (
    <Book.Provider
      value={{
        book,
        error,
        businessId,
        refresh: async () => {
          await refresh();
          await flush();
        },
        save,
        switchBusiness: (id) => {
          selectedFirm.current=id;
          seq.current++;
          setBook(null);
          localStorage.setItem("tb-last-" + userId, id);
          localStorage.setItem("tb-firm", id);
          setFirm(id);
        },
        pending,
        online,
      }}
    >
      <DeviceLock userId={userId}>{children}</DeviceLock>
    </Book.Provider>
  );
}
