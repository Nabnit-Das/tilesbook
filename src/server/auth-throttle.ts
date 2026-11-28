import { createHash } from "node:crypto";
const attempts = new Map<string, { count: number; end: number }>();
export function limited(target: string) {
  const key = createHash("sha256").update(target).digest("hex");
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.end > now) return ++entry.count > 20;
  if (attempts.size >= 4096) {
    for (const [k, v] of attempts) if (v.end <= now) attempts.delete(k);
    if (attempts.size >= 4096) return true;
  }
  attempts.set(key, { count: 1, end: now + 600000 });
  return false;
}
