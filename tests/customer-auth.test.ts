import { it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/email-config",()=>({requiresEmailProof:async()=>true}));
const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  verifyOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
}));
const identity = vi.hoisted(() => vi.fn());
vi.mock("@/server/identity", () => ({
  identity,
  authClient: async () => ({ auth }),
  localRequest: async () => false,
  counterId: "counter",
  ownerId: "owner",
  demoLogin: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: vi.fn() }) }));
import { POST, GET } from "../src/app/api/auth/route";
const email = "customer@example.test",
  password = "new-password-111",
  otp = "438529";
const post = (data: object) =>
  POST(
    new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...data }),
    }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(auth)) fn.mockResolvedValue({ error: null });
  identity.mockResolvedValue({ id: "customer" });
});
it("passes only display data and terms to Supabase signup", async () => {
  const r = await post({
    action: "register",
    password,
    confirm: password,
    terms: true,
    fullName: "Owner",
    role: "Owner",
  });
  expect(r.status).toBe(200);
  expect(auth.signUp).toHaveBeenCalledWith({
    email,
    password,
    options: { data: { full_name: "Owner", terms_version: "1" } },
  });
});
it("responds identically to duplicate signup", async () => {
  auth.signUp.mockResolvedValue({ error: { code: "user_already_exists" } });
  expect(
    await (
      await post({
        action: "register",
        password,
        confirm: password,
        terms: true,
        fullName: "Owner",
      })
    ).json(),
  ).toEqual({ ok: true });
});
it("verifies signup codes using the signup purpose", async () => {
  expect((await post({ action: "confirm", otp })).ok).toBe(true);
  expect(auth.verifyOtp).toHaveBeenCalledWith({
    email,
    token: otp,
    type: "signup",
  });
});
it("uses a generic error for failed passwords and confirms successful login", async () => {
  auth.signInWithPassword.mockResolvedValueOnce({
    error: { message: "internal detail" },
  });
  const r = await post({ action: "email", password });
  expect(r.status).toBe(401);
  expect(await r.json()).toEqual({ error: "authFailed" });
  expect((await post({ action: "email", password })).ok).toBe(true);
});
it("requests recovery without accepting redirect destinations", async () => {
  await post({ action: "forgot", redirectTo: "https://example.org/" });
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(email);
});
it("updates a password only after the matching recovery proof", async () => {
  auth.verifyOtp.mockResolvedValueOnce({ error: {} });
  expect(
    (await post({ action: "reset", password, confirm: password, otp })).ok,
  ).toBe(false);
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(
    (await post({ action: "reset", password, confirm: password, otp })).ok,
  ).toBe(true);
  expect(auth.verifyOtp).toHaveBeenCalledWith({
    email,
    type: "recovery",
    token: otp,
  });
  expect(auth.updateUser).toHaveBeenCalledWith({ password });
});
it("restores validated identities and rejects expired sessions", async () => {
  expect(await (await GET()).json()).toEqual({ id: "customer" });
  identity.mockRejectedValueOnce(Error());
  expect((await GET()).status).toBe(401);
});
it("logs out the current device", async () => {
  expect((await post({ action: "logout" })).ok).toBe(true);
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("links a verified phone through the current identity without creating an OTP account", async () => {
  vi.stubEnv("TILEBOOK_SMS_ENABLED", "1");
  try {
    await post({ action: "linkPhone", phone: "9000000000" });
    expect(identity).toHaveBeenCalled();
    expect(auth.updateUser).toHaveBeenCalledWith({ phone: "+919000000000" });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    await post({ action: "confirmPhone", phone: "9000000000", otp });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+919000000000",
      type: "phone_change",
      token: otp,
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
