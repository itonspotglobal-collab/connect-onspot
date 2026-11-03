import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from "@shared/passwordPolicy";

type PortalRole = "client" | "talent";
type PasswordResetFlowProps = {
  initialEmail: string;
  role?: PortalRole | null;
  appearance: "dark" | "light";
  onCancel: () => void;
  onSuccess: (email: string) => void;
  toast: (options: { title: string; description?: string; variant?: "destructive" }) => void;
};

const requestMessage = "If an account exists for that email, we've sent a 6-digit code.";

export function PasswordResetFlow({
  initialEmail,
  role,
  appearance,
  onCancel,
  onSuccess,
  toast,
}: PasswordResetFlowProps) {
  const dark = appearance === "dark";
  const [stage, setStage] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft > 0]);

  const inputClass = dark
    ? "bg-white/10 border-white/25 text-white placeholder:text-white/45 rounded-xl h-11 focus-visible:border-[#8294FF] focus-visible:ring-[#8294FF]/35"
    : "bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus-visible:border-[#7167E8] focus-visible:ring-[#7167E8]/15 h-12";
  const labelClass = dark ? "text-white/90 text-sm font-semibold" : "text-[#30344F] text-sm font-medium";
  const helperClass = dark ? "text-white/55" : "text-[#737993]";
  const linkClass = dark ? "text-[#B9C4FF] hover:text-white" : "text-[#555B78] hover:text-[#17182C]";
  const errorClass = dark ? "text-red-300" : "text-red-600";

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast({ variant: "destructive", title: "Invalid email", description: "Please enter a valid email address." });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, ...(role ? { role } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        toast({ variant: "destructive", title: "Could not send code", description: data.message || "Please try again." });
        return;
      }
      setEmail(normalizedEmail);
      setStage(2);
      setCode("");
      setSecondsLeft(60);
      toast({ title: "Check your email", description: requestMessage });
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast({ variant: "destructive", title: "Invalid code", description: "Enter the 6-digit code from your email." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match", description: "New password and confirmation must be the same." });
      return;
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      toast({ variant: "destructive", title: "Password requirements", description: strength.errors[0] });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        toast({ variant: "destructive", title: "Reset failed", description: data.message || "Could not reset password." });
        return;
      }
      onSuccess(email.trim().toLowerCase());
      toast({ title: "Password updated. Please sign in." });
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onCancel} className={`flex items-center gap-1.5 text-sm mb-6 transition-colors ${linkClass}`}>
        <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to Sign In
      </button>
      <h2 className={`mb-1 ${dark ? "text-2xl font-semibold text-white" : "text-3xl font-light text-[#17182C]"}`} style={{ letterSpacing: "-0.02em" }}>
        Reset Password
      </h2>
      <p className={`mb-5 text-sm ${dark ? "text-white/70" : "text-[#555B78]"}`}>
        {stage === 1 ? "We’ll email you a code to verify your account." : `Enter the code sent to ${email}.`}
      </p>
      {stage === 1 ? (
        <form onSubmit={sendCode} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-email" className={labelClass}>Email Address</Label>
            <Input id="reset-email" type="email" required placeholder="you@example.com" value={email}
              onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={inputClass} />
          </div>
          <button type="submit" disabled={loading || !email.trim()}
            className={`w-full flex items-center justify-center gap-2 rounded-xl h-11 text-sm font-semibold text-white transition disabled:opacity-45 ${dark ? "border border-[#8294FF]/50 bg-[#3A3AF8]/80 hover:bg-[#4848ff]" : "bg-[#5552D9] hover:bg-[#4643C7]"}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-code" className={labelClass}>6-digit code</Label>
            <Input id="reset-code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              autoComplete="one-time-code" required value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" className={`${inputClass} tracking-[0.28em] font-mono`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-new-password" className={labelClass}>New Password</Label>
            <div className="relative">
              <Input id="reset-new-password" type={showPassword ? "text" : "password"} required value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password"
                placeholder="Create a strong password" className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${helperClass} hover:opacity-75`}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className={`text-xs leading-relaxed ${helperClass}`}>{PASSWORD_POLICY_HINT}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password" className={labelClass}>Confirm New Password</Label>
            <div className="relative">
              <Input id="reset-confirm-password" type={showConfirm ? "text" : "password"} required value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password"
                placeholder="Repeat your new password" className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setShowConfirm((value) => !value)}
                aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${helperClass} hover:opacity-75`}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && <p className={`text-xs ${errorClass}`}>Passwords do not match.</p>}
          </div>
          <button type="submit" disabled={loading || !/^\d{6}$/.test(code) || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className={`w-full flex items-center justify-center gap-2 rounded-xl h-11 text-sm font-semibold text-white transition disabled:opacity-45 ${dark ? "border border-[#8294FF]/50 bg-[#3A3AF8]/80 hover:bg-[#4848ff]" : "bg-[#5552D9] hover:bg-[#4643C7]"}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Resetting…" : "Reset password"}
          </button>
          <div className="text-center text-sm">
            <button type="button" disabled={secondsLeft > 0 || loading} onClick={() => void sendCode()}
              className={`font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-55 ${linkClass}`}>
              {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
