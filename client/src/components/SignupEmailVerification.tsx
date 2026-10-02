import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignupPendingState, cancelSignup, getRetrySeconds, isSignupPending } from "@/lib/signupVerification";
import { Mail, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react";

export function SignupEmailVerification({
  pending,
  onVerified,
  onChangeEmail,
  dark = false,
  testPrefix = "signup-verification",
}: {
  pending: SignupPendingState;
  onVerified: (account: any) => void | Promise<void>;
  onChangeEmail: () => void;
  dark?: boolean;
  testPrefix?: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(Date.parse(pending.resendAvailableAt) || 0);
  const [seconds, setSeconds] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [deliveryFailed, setDeliveryFailed] = useState(pending.deliveryStatus === "failed");
  const [expiresAt, setExpiresAt] = useState(Date.parse(pending.codeExpiresAt));
  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  const post = async (path: string, body: object) => {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true); setError("");
    try {
      const { response, data } = await post("/api/signup/verify", { challengeId: pending.challengeId, code });
      if (response.status === 201 && data.success === true) {
        await onVerified(data);
      } else {
        setError(data.message || (data.error === "attempt_limit" ? "Too many incorrect attempts. Start signup again to request a new code." : "That code could not be verified. Check it and try again."));
      }
    } catch {
      setError("We could not reach the server. Your signup is still pending; try again.");
    } finally { setBusy(false); }
  }
  async function resend() {
    if (busy || seconds > 0) return;
    setBusy(true); setError("");
    try {
      const { response, data } = await post("/api/signup/resend", { challengeId: pending.challengeId });
      if (isSignupPending(data)) {
        setResendAt(Date.parse(data.resendAvailableAt) || Date.now());
        setExpiresAt(Date.parse(data.codeExpiresAt) || expiresAt);
        setDeliveryFailed(data.deliveryStatus === "failed");
        setCode("");
        if (data.deliveryStatus === "failed") setError("We could not send the code. Please retry when available.");
      } else {
        const retry = getRetrySeconds(response, data);
        if (retry) setResendAt(Date.now() + retry * 1000);
        setError(data.message || "The code could not be resent. Please try again.");
      }
    } catch { setError("We could not reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  async function changeEmail() {
    if (busy) return;
    setBusy(true);
    try {
      await cancelSignup(pending.challengeId);
      onChangeEmail();
    } catch { setError("Could not safely restart signup. Please try again."); }
    finally { setBusy(false); }
  }
  const color = dark ? "text-white" : "text-slate-900";
  const expired = Number.isFinite(expiresAt) && now >= expiresAt;
  return <section className={`${color} space-y-4`} aria-labelledby={`${testPrefix}-title`} data-testid={testPrefix}>
    <div className="text-center">
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${dark ? "bg-white/10" : "bg-indigo-50"}`}><Mail className="h-5 w-5 text-indigo-500" /></div>
      <h2 id={`${testPrefix}-title`} className="text-xl font-semibold">Check your email</h2>
      <p className={`mt-1 text-sm ${dark ? "text-white/60" : "text-slate-500"}`}>Enter the six-digit code sent to <strong>{pending.maskedEmail}</strong>.</p>
      <p className={`mt-1 text-xs ${dark ? "text-white/50" : "text-slate-400"}`}>{expired ? "This code has expired. Request a new one to continue." : `The code expires ${Number.isFinite(expiresAt) ? `at ${new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "in 10 minutes"}.`} Never share it.</p>
    </div>
    {deliveryFailed && <div role="status" className="rounded-lg border border-amber-300/50 bg-amber-500/10 p-3 text-sm">The email service did not accept the message. You can retry sending the code.</div>}
    <form onSubmit={verify} className="space-y-3">
      <label htmlFor={`${testPrefix}-code`} className="text-sm font-medium">Verification code</label>
      <Input id={`${testPrefix}-code`} data-testid={`${testPrefix}-code`} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onPaste={e => { e.preventDefault(); setCode(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} aria-label="Six-digit verification code" className={`text-center font-mono text-2xl tracking-[0.5em] ${dark ? "bg-white/10 text-white border-white/20" : ""}`} />
      {error && <div role="alert" data-testid={`${testPrefix}-error`} className="rounded-md bg-red-500/10 p-2 text-sm text-red-600">{error}</div>}
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6 || expired} data-testid={`${testPrefix}-verify`}>{busy ? "Checking code…" : <><ShieldCheck className="mr-2 h-4 w-4" />Verify email</>}</Button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <button type="button" onClick={changeEmail} disabled={busy} className="inline-flex items-center gap-1 text-indigo-500 hover:underline" data-testid={`${testPrefix}-change`}><ArrowLeft className="h-3.5 w-3.5" />Change email</button>
      <button type="button" onClick={resend} disabled={busy || seconds > 0} className="inline-flex items-center gap-1 text-indigo-500 disabled:opacity-50" data-testid={`${testPrefix}-resend`}><RefreshCw className="h-3.5 w-3.5" />{seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}</button>
    </div>
  </section>;
}