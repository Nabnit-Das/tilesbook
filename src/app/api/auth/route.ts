import { requiresEmailProof } from "@/server/email-config";
import { cookies } from "next/headers";
import {
  authClient,
  counterId,
  demoLogin,
  localRequest,
  ownerId,
  identity,
} from "@/server/identity";
import { authInput, smsAvailable } from "@/server/auth-policy";
import { createHash } from "node:crypto";
const attempts = new Map<string, { count: number; end: number }>();
function limited(target: string) {
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
const answer = (status = 200, error?: string) =>
  Response.json(error ? { error } : { ok: true }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  try {
    return Response.json(
      { id: (await identity()).id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return answer(401, "authFailed");
  }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
      return answer(415, "authInvalid");
    const parsed = authInput.safeParse(await req.json());
    if (!parsed.success) return answer(400, "authInvalid");
    const v = parsed.data,
      demo = await localRequest();
    if (v.action === "logout") {
      if (!demo) {
        const { error } = await (
          await authClient()
        ).auth.signOut({ scope: "local" });
        if (error) return answer(503, "authFailed");
      }
      (await cookies()).delete("tb_demo");
      return answer();
    }
    if (!demo && limited("email" in v ? v.email : v.phone))
      return answer(429, "authWait");
    if (demo) {
      if (
        (v.action !== "send" && v.action !== "verify") ||
        !["9999999999", "9999999998"].includes(v.phone)
      )
        return answer(400, "authFailed");
      if (v.action === "verify") {
        if (v.otp !== "123456") return answer(400, "authFailed");
        await demoLogin(v.phone === "9999999999" ? ownerId : counterId);
      }
      return answer();
    }
    const client = await authClient();
    if ("phone" in v && v.action !== "register" && !smsAvailable(v.phone))
      return answer(503, "smsUnavailable");
    switch (v.action) {
      case "register": {
        if (!(await requiresEmailProof()))
          return answer(503, "verificationUnavailable");
        const { error } = await client.auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            data: {
              full_name: v.fullName,
              terms_version: "1",
              privacy_version: "1",
              registration_phone: v.phone,
            },
          },
        });
        if (error && error.code !== "user_already_exists")
          return answer(
            error.status === 429 ? 429 : 400,
            error.status === 429 ? "authWait" : "authFailed",
          );
        break;
      }
      case "email": {
        const { error } = await client.auth.signInWithPassword({
          email: v.email,
          password: v.password,
        });
        if (error) return answer(401, "authFailed");
        break;
      }
      case "resendEmail": {
        const { error } = await client.auth.resend({
          type: "signup",
          email: v.email,
        });
        if (error?.status === 429) return answer(429, "authWait");
        if (error && error.status && error.status >= 500)
          return answer(503, "authFailed");
        break;
      }
      case "forgot": {
        const { error } = await client.auth.resetPasswordForEmail(v.email);
        if (error?.status === 429) return answer(429, "authWait");
        if (error && error.status && error.status >= 500)
          return answer(503, "authFailed");
        break;
      }
      case "confirm":
      case "reset": {
        const { error } = await client.auth.verifyOtp({
          email: v.email,
          token: v.otp,
          type: v.action === "reset" ? "recovery" : "signup",
        });
        if (error)
          return answer(
            400,
            error.code === "otp_expired" ? "codeExpired" : "authFailed",
          );
        if (v.action === "reset") {
          const { error } = await client.auth.updateUser({
            password: v.password,
          });
          if (error) return answer(400, "authFailed");
        }
        break;
      }
      case "send": {
        const { error } = await client.auth.signInWithOtp({
          options: { shouldCreateUser: false },
          phone: "+91" + v.phone,
        });
        if (error) return answer(400, "authFailed");
        break;
      }
      case "linkPhone": {
        await identity();
        const { error } = await client.auth.updateUser({
          phone: "+91" + v.phone,
        });
        if (error) return answer(400, "authFailed");
        break;
      }
      case "confirmPhone":
      case "verify": {
        const linking = v.action === "confirmPhone" ? await identity() : null;
        const { data, error } = await client.auth.verifyOtp({
          phone: "+91" + v.phone,
          token: v.otp,
          type: v.action === "verify" ? "sms" : "phone_change",
        });
        if (error)
          return answer(
            400,
            error.code === "otp_expired" ? "codeExpired" : "authFailed",
          );
        if (linking && data?.user?.id !== linking.id) {
          await client.auth.signOut({ scope: "local" });
          return answer(401, "authFailed");
        }
        break;
      }
    }
    return answer();
  } catch {
    return answer(400, "authFailed");
  }
}
