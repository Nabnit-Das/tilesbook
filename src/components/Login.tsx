"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Eye, EyeOff, Store } from "lucide-react";
import Brand from "./Brand";
import { useChangeLocale, type Lang } from "./Locale";
import { clearLocalBooks } from "@/lib/offline";
type Step =
  | "email"
  | "register"
  | "confirm"
  | "forgot"
  | "reset"
  | "send"
  | "verify"
  | "linkPhone"
  | "confirmPhone";
const titles: Record<Step, string> = {
  email: "signIn",
  register: "register",
  confirm: "verifyEmail",
  forgot: "forgotPassword",
  reset: "resetPassword",
  send: "phoneSignIn",
  verify: "verifyPhone",
  linkPhone: "linkPhone",
  confirmPhone: "verifyPhone",
};
export default function Login({
  demo,
  sms,
  link = false,
  phoneFirst = false,
  registrationPhone = "",
  verifyEmail = false,
}: {
  demo: boolean;
  sms: boolean;
  link?: boolean;
  phoneFirst?: boolean;
  registrationPhone?: string;
  verifyEmail?: boolean;
}) {
  const t = useTranslations(),
    locale = useLocale(),
    lang = useChangeLocale();
  const [step, setStep] = useState<Step>(
      verifyEmail
        ? "confirm"
        : link
          ? "linkPhone"
          : demo || phoneFirst
            ? "send"
            : "email",
    ),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(demo ? "9999999999" : registrationPhone),
    [show, setShow] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function go(next: Step) {
    setStep(next);
    setError("");
    setMessage("");
    setShow(false);
  }
  async function submit(
    values: Record<string, unknown>,
    action: Step | "resendEmail" = step,
  ) {
    setError("");
    setMessage("");
    if ("confirm" in values && values.confirm !== values.password) {
      setError("passwordMismatch");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, ...values, action }),
      });
      if (!r.ok) {
        const code = (await r.json()).error;
        setError(
          [
            "codeExpired",
            "authWait",
            "smsUnavailable",
            "verificationUnavailable",
            "authInvalid",
          ].includes(code)
            ? code
            : "authFailed",
        );
        return;
      }
      const next: Partial<Record<Step, Step>> = {
        send: "verify",
        linkPhone: "confirmPhone",
        forgot: "reset",
        register: "confirm",
      };
      if (action === "resendEmail") {
        setMessage("checkEmail");
        return;
      }
      if (next[action]) {
        go(next[action]!);
        setMessage(
          action === "register" || action === "forgot"
            ? "checkEmail"
            : "checkPhone",
        );
      } else {
        await clearLocalBooks();
        location.replace("/access");
      }
    } catch {
      setError("authFailed");
    } finally {
      setBusy(false);
    }
  }
  const otp = ["confirm", "verify", "reset", "confirmPhone"].includes(step),
    mobile = ["send", "verify", "linkPhone", "confirmPhone"].includes(step),
    password = ["email", "register", "reset"].includes(step);
  const nav = (s: Step) => (
    <button
      type="button"
      disabled={busy}
      className="text-button"
      onClick={() => go(s)}
    >
      {t(titles[s])}
    </button>
  );
  return (
    <main className="login customer-login">
      <section className="login-brand">
        <Brand />
        <div className="tile-art" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div>
          <Store size={30} />
          <h1>TileBook</h1>
          <p>{t("loginCopy")}</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="langchips">
          {(["or", "hi", "en"] as Lang[]).map((l, i) => (
            <button
              key={l}
              aria-pressed={l === locale}
              className={l === locale ? "selected" : ""}
              onClick={() => lang(l)}
            >
              {["ଓଡ଼ିଆ", "हिन्दी", "English"][i]}
            </button>
          ))}
        </div>
        <form
          key={step}
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            void submit({
              ...data,
              ...(step === "register"
                ? { terms: data.terms === "on", privacy: data.privacy === "on" }
                : {}),
            });
          }}
        >
          {(step === "register" || step === "confirm" || link) && (
            <p className="auth-progress">
              {t("registrationStep", {
                step: step === "register" ? 1 : step === "confirm" ? 2 : 3,
              })}
            </p>
          )}
          <h2>{t(titles[step])}</h2>
          {!demo && (step === "email" || step === "send") && (
            <div className="auth-methods">
              {(["email", "send"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  disabled={busy || (s === "send" && !sms)}
                  aria-pressed={step === s}
                  onClick={() => go(s)}
                >
                  {t(s === "email" ? "email" : "phone")}
                </button>
              ))}
            </div>
          )}
          {step === "register" && (
            <label>
              {t("fullName")}
              <input
                name="fullName"
                autoComplete="name"
                maxLength={120}
                required
              />
            </label>
          )}
          {mobile ? (
            <label>
              {t("phone")}
              <span className="phoneinput">
                +91
                <input
                  type="tel"
                  required
                  value={phone}
                  pattern="[0-9]{10}"
                  autoComplete="tel-national"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </span>
            </label>
          ) : (
            <label>
              {t("email")}
              <input
                type="email"
                required
                value={email}
                maxLength={254}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {step === "register" && (
            <label>
              {t("phone")}
              <span className="phoneinput">
                +91
                <input
                  type="tel"
                  required
                  autoComplete="tel-national"
                  pattern="[6-9][0-9]{9}"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </span>
            </label>
          )}
          {otp && (
            <label>
              {t("code")}
              <input
                name="otp"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                inputMode="numeric"
                required
              />
            </label>
          )}
          {password && (
            <>
              <label>
                {t("password")}
                <span className="password-box">
                  <input
                    type={show ? "text" : "password"}
                    name="password"
                    required
                    autoComplete={
                      step === "email" ? "current-password" : "new-password"
                    }
                    minLength={step === "email" ? 1 : 10}
                    maxLength={step === "email" ? 256 : 128}
                  />{" "}
                  <button
                    className="password-toggle"
                    aria-label={t(show ? "hidePassword" : "showPassword")}
                    type="button"
                    aria-pressed={show}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
                  </button>
                </span>
              </label>
              {step !== "email" && (
                <label>
                  {t("confirmPassword")}
                  <input
                    name="confirm"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={10}
                  />
                </label>
              )}
            </>
          )}
          {step === "register" && (
            <label className="auth-terms">
              <input name="terms" type="checkbox" required />
              {t("termsAcceptance")}
            </label>
          )}
          {step === "register" && (
            <label className="auth-terms">
              <input type="checkbox" required name="privacy" />
              <span>
                {t("privacyConsent")}{" "}
                <a href="/privacy" target="_blank" rel="noreferrer">
                  {t("privacyPolicy")}
                </a>
              </span>
            </label>
          )}
          {error && <p role="alert">{t(error)}</p>}
          {message && <p role="status">{t(message)}</p>}
          <button
            className="btn primary full"
            disabled={busy || (mobile && !sms && !demo)}
          >
            {t(
              busy
                ? "loading"
                : step === "send" || step === "linkPhone"
                  ? "send"
                  : "continue",
            )}
            <ArrowRight size={16} />
          </button>
          {otp && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() =>
                submit(
                  {},
                  step === "confirm"
                    ? "resendEmail"
                    : step === "reset"
                      ? "forgot"
                      : step === "confirmPhone"
                        ? "linkPhone"
                        : "send",
                )
              }
            >
              {t("resendCode")}
            </button>
          )}
          {mobile && !demo && !sms && <p>{t("smsUnavailable")}</p>}
          <div className="auth-links">
            {!link && !demo && (
              <>
                {step !== "email" && step !== "send" && nav("email")}
                {step === "email" && (
                  <>
                    {nav("register")}
                    {nav("forgot")}
                    {nav("confirm")}
                    {!sms && <small>{t("smsUnavailable")}</small>}
                  </>
                )}
              </>
            )}
            {step === "verify" && nav("send")}
            {link && <a href="/settings">{t("settings")}</a>}
          </div>
          {demo && (
            <div className="demo-options">
              <span>{t("demo")} · OTP 123456</span>
              <div>
                {["9999999999", "9999999998"].map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      submit({ phone: p, otp: "123456" }, "verify")
                    }
                  >
                    {t(i ? "counterDemo" : "ownerDemo")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
