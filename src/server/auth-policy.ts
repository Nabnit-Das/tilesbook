import { z } from "zod";
const email = z
  .email()
  .trim()
  .max(254)
  .transform((s) => s.toLowerCase());
const phone = z.string().regex(/^[6-9]\d{9}$/);
const otp = z.string().regex(/^\d{6}$/);
const password = z.string().min(10).max(128);
export const authInput = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("email"),
      email,
      password: z.string().min(1).max(256),
    }),
    z.object({
      action: z.literal("register"),
      phone: z.string().regex(/^[6-9]\d{9}$/),
      privacy: z.literal(true),
      email,
      password,
      confirm: z.string(),
      fullName: z.string().trim().min(1).max(120),
      terms: z.literal(true),
    }),
    z.object({ action: z.literal("resendEmail"), email }),
    z.object({ action: z.literal("confirm"), email, otp }),
    z.object({ action: z.literal("forgot"), email }),
    z.object({
      action: z.literal("reset"),
      email,
      otp,
      password,
      confirm: z.string(),
    }),
    z.object({ action: z.literal("send"), phone }),
    z.object({ action: z.literal("verify"), phone, otp }),
    z.object({ action: z.literal("linkPhone"), phone }),
    z.object({ action: z.literal("confirmPhone"), phone, otp }),
    z.object({ action: z.literal("logout") }),
  ])
  .refine((v) => !("confirm" in v) || v.password === v.confirm);
export function demoAllowed(
  startedOnLoopback: boolean,
  enabled: boolean,
  host: string | null,
  forwarded: string | null,
  hosted: boolean,
) {
  const loop = (h: string | null) =>
    !!h && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(h);
  return (
    startedOnLoopback &&
    enabled &&
    !hosted &&
    loop(host) &&
    (!forwarded || loop(forwarded))
  );
}
export function smsAvailable(phone?:string) {
  if (process.env.TILEBOOK_SMS_ENABLED === "1") return true;
  return (
    process.env.TILEBOOK_TEST_SMS === "1" && !process.env.VERCEL &&
    (!phone || /^(999999999[89]|900000009[1-8])$/.test(phone)) &&
    /^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(
      process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    )
  );
}
