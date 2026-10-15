import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { usePortalLogin, PortalType } from "@/hooks/usePortalLogin";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { PortalChooser } from "@/components/PortalChooser";
import { AuthModalFrame } from "@/components/AuthModalFrame";
import { getSafeReturnTo } from "@shared/internalRedirect";
import { AuthBackButton } from "@/components/AuthBackButton";
import { authPortalHref } from "@/lib/authBackNavigation";

type PageStep = "login" | "setup-password" | "forgot-password";

// ── Design tokens ──────────────────────────────────────────────────────────
const BRAND = "#B9C4FF";

const inputCls = [
  "bg-white/10 border border-white/25 text-white",
  "placeholder:text-white/45 rounded-xl h-11 px-4",
  "focus-visible:border-[#8294FF] focus-visible:ring-2 focus-visible:ring-[#8294FF]/35",
  "transition-all duration-200",
].join(" ");

const labelCls = "text-white/90 text-sm font-semibold";

const backBtnCls = [
  "flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors duration-200 text-white/75 hover:text-white",
].join(" ");

// ── Reusable action button ─────────────────────────────────────────────────
function PrimaryButton({
  onClick,
  type = "button",
  testId,
  disabled,
  loading,
  loadingText,
  children,
}: {
  onClick?: () => void;
  type?: "button" | "submit";
  testId?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      data-testid={testId}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 border border-[#8294FF]/50 bg-[#3A3AF8]/80 hover:bg-[#4848ff] h-11 shadow-[0_8px_22px_rgba(4,7,45,.28)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {loading ? loadingText : children}
    </button>
  );
}

// ── Password-visibility toggle ────────────────────────────────────────────
function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/55 hover:text-white transition-colors"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

// ── Main page component ────────────────────────────────────────────────────
export default function PortalLogin() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { signInToPortal, setupTalentPassword, isLoading } = usePortalLogin();
  const { toast } = useToast();
  const pathname = location.split("?")[0];
  const search = useSearch();
  const currentSearch = search ? `?${search}` : "";
  const routePortal: PortalType | null =
    pathname === "/login/client" ? "client" :
    pathname === "/login/talent" ? "talent" :
    null;

  // Safely read query params — all reads are wrapped in try/catch so a malformed
  // URL or restricted browser environment never crashes the login page.
  const [applicationToken] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("applicationToken") || ""; }
    catch { return ""; }
  });

  // Preserve org invite token through the login flow so the user lands back on
  // the token-based invitation page after authentication.
  const [orgInviteToken] = useState(() => {
    try {
      // Extract from returnTo if it points to /organization-invite/:token
      const rt = new URLSearchParams(window.location.search).get("returnTo") || "";
      const match = rt.match(/^\/organization-invite\/([^/?#]+)/);
      return match ? match[1] : "";
    } catch { return ""; }
  });

  // Optional return destination after login (e.g. the job detail page the user came from)
  const [returnTo] = useState(() => {
    try { return getSafeReturnTo(new URLSearchParams(window.location.search).get("returnTo")) || ""; }
    catch { return ""; }
  });

  const requestedPortal = new URLSearchParams(search).get("portal");
  const selectedPortal = requestedPortal === "client" || requestedPortal === "talent" ? requestedPortal : null;
  const [email, setEmail] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("email") || ""; }
    catch { return ""; }
  });
  const [step, setStep] = useState<PageStep>("login");
  const [signupOpen, setSignupOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const activePortal = routePortal ?? selectedPortal;
  const [portalError, setPortalError] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const retryUntil = useRef(0);
  const signInPending = useRef(false);

  // Password setup state
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [showSetupPw, setShowSetupPw] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (!retryUntil.current) return;
    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((retryUntil.current - Date.now()) / 1000));
      setRetrySeconds(remaining);
      if (remaining === 0) retryUntil.current = 0;
    };
    updateCooldown();
    const interval = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(interval);
  }, [retrySeconds > 0]);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") { navigate(returnTo || "/admin/find-work", { replace: true }); return; }
      if (user.role === "client") { navigate(returnTo || "/hire-talent", { replace: true }); return; }
    }
    // Skip auto-redirect when arriving from a job application flow — the user
    // must explicitly log in so the application token can be linked correctly.
    if (applicationToken) return;
    try {
      const talentAuth = loadTalentAuth();
      if (talentAuth?.candidateId) {
        // If we arrived from a specific page (e.g. the job apply gate), send the
        // user there instead of their profile so they don't lose their place.
        navigate(returnTo || `/talent-profile/${talentAuth.candidateId}`, { replace: true });
      }
    } catch {
      // localStorage read failure — ignore and show login form
    }
  }, [isAuthenticated, user, applicationToken, returnTo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signInPending.current || isLoading || retryUntil.current > Date.now()) return;
    const formData = new FormData(event.currentTarget);
    const loginEmail = String(formData.get("email") ?? "");
    const loginPassword = String(formData.get("password") ?? "");
    if (!loginEmail.trim() || loginPassword.length === 0 || !activePortal) {
      const message = "Please fill in your email and password.";
      setPortalError(message);
      toast({ variant: "destructive", title: "Missing fields", description: message });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      const message = "Please enter a valid email address.";
      setPortalError(message);
      toast({ variant: "destructive", title: "Invalid email", description: message });
      return;
    }
    signInPending.current = true;
    setEmail(loginEmail);
    setPassword(loginPassword);
    setPortalError("");
    let result: Awaited<ReturnType<typeof signInToPortal>>;
    try {
      result = await signInToPortal(activePortal, loginEmail, loginPassword);
    } catch (err: any) {
      const message = err?.message || "An unexpected error occurred. Please try again.";
      setPortalError(message);
      toast({ variant: "destructive", title: "Sign in error", description: message });
      return;
    } finally {
      signInPending.current = false;
    }
    if (!result.success) {
      if (result.requiresPasswordSetup) {
        setStep("setup-password");
        toast({ title: "Set a password", description: "This profile exists but has no password yet. Create one to continue." });
        return;
      }
      setPortalError(result.message);
      if (result.rateLimited && result.retryAfter) {
        retryUntil.current = Date.now() + result.retryAfter * 1000;
        setRetrySeconds(result.retryAfter);
      }
      toast({ variant: "destructive", title: "Sign in failed", description: result.message });
      return;
    }
    // Safely access display name — use optional chaining to prevent runtime crash
    // if the server returns an unexpected shape at runtime.
    const displayName = result.portal === "talent"
      ? (result.auth?.fullName || result.auth?.email || "there")
      : (result.displayName || "there");
    toast({ title: "Signed in", description: `Welcome back, ${displayName}!` });

    // If the user arrived here from the "existing email" application dialog,
    // attempt to link the pending application to the newly authenticated account.
    if (applicationToken && result.portal === "talent") {
      try {
        const jwt = result.portal === "talent" ? result.auth?.token : null;
        const linkRes = await fetch("/api/job-applications/link-by-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify({ token: applicationToken }),
        });
        if (linkRes.ok) {
          toast({ title: "Application linked!", description: "Your saved application has been connected to your account." });
        }
        // On email_mismatch or any other error we still navigate — the application
        // stays as pending_login and admins can see it.
      } catch (_) { /* non-fatal — just navigate */ }
      // Return to the job page the user came from, or fall back to the jobs listing
      navigate(returnTo || "/find-work/jobs", { replace: true });
      return;
    }

    // If the user arrived here from a protected page (e.g. the job apply gate),
    // honour the returnTo param so they land back where they started.
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    navigate(result.redirectTo, { replace: true });
  }

  if (!activePortal && step === "login") {
    // Keep the same dialog/scroll-lock owner when only the role view changes.
    return <AuthModalFrame title="Login portal selection" wide><PortalChooser /></AuthModalFrame>;
  }

  async function handleSetupPassword() {
    if (!setupPassword || !setupConfirm) {
      toast({ variant: "destructive", title: "Missing fields", description: "Fill in all fields." });
      return;
    }
    if (setupPassword.length < 8) {
      toast({ variant: "destructive", title: "Password too short", description: "Must be at least 8 characters." });
      return;
    }
    if (setupPassword !== setupConfirm) {
      toast({ variant: "destructive", title: "Passwords don't match" });
      return;
    }
    setSetupLoading(true);
    try {
      const result = await setupTalentPassword(email, setupPassword);
      if (!result.success) {
        toast({ variant: "destructive", title: "Setup failed", description: result.message });
        return;
      }
      toast({ title: "Password created!", description: `Welcome, ${result.auth.fullName}!` });
      navigate(returnTo || result.redirectTo, { replace: true });
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail || !forgotNewPw || !forgotConfirm) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all fields." });
      return;
    }
    if (forgotNewPw !== forgotConfirm) { toast({ variant: "destructive", title: "Passwords don't match" }); return; }
    if (forgotNewPw.length < 8) {
      toast({ variant: "destructive", title: "Password too short", description: "Must be at least 8 characters." });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/dev/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase(), newPassword: forgotNewPw }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Password reset", description: data.message || "You can now sign in with your new password." });
        setEmail(forgotEmail);
        setPassword("");
        setForgotEmail(""); setForgotNewPw(""); setForgotConfirm("");
        setStep("login");
      } else {
        toast({ variant: "destructive", title: "Reset failed", description: data.message || "Could not reset password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Could not reach the server. Please try again." });
    } finally {
      setForgotLoading(false);
    }
  }

  // ── Password Setup Step ───────────────────────────────────────────────────
  if (step === "setup-password") {
    return (
      <AuthModalFrame title="Create a Password">
        <button type="button" onClick={() => { setStep("login"); setSetupPassword(""); setSetupConfirm(""); }}
          className={backBtnCls} style={{ color: BRAND }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
        <h2 className="text-2xl font-semibold text-white mb-1" style={{ letterSpacing: "-0.02em" }}>
          Create a Password
        </h2>
        <p className="text-white/70 mb-5 text-sm">
          Your profile exists but has no password yet. Set one to access the Talent Portal.
        </p>
        <div className="mb-4 px-4 py-3 rounded-xl border border-white/15 bg-white/5">
          <p className="text-white/55 text-xs mb-0.5">Signing in as</p>
          <p className="text-white text-sm font-medium truncate">{email}</p>
        </div>
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label className={labelCls}>New Password</Label>
            <div className="relative">
              <Input id="setup-password" name="new-password" type={showSetupPw ? "text" : "password"}
                placeholder="Minimum 8 characters" value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)} autoComplete="new-password"
                className={`${inputCls} pr-11`} />
              <EyeToggle show={showSetupPw} onToggle={() => setShowSetupPw(v => !v)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Confirm Password</Label>
            <Input id="setup-confirm" name="confirm-password" type={showSetupPw ? "text" : "password"}
              placeholder="Re-enter your new password" value={setupConfirm}
              onChange={(e) => setSetupConfirm(e.target.value)} autoComplete="new-password"
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && handleSetupPassword()} />
            {setupConfirm && setupPassword !== setupConfirm && (
              <p className="text-red-300 text-xs">Passwords do not match.</p>
            )}
          </div>
        </div>
        <PrimaryButton onClick={handleSetupPassword} loading={setupLoading} loadingText="Setting up…"
          disabled={!setupPassword || !setupConfirm || setupPassword !== setupConfirm || setupPassword.length < 8}>
          <span>Create Password &amp; Sign In</span> <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </AuthModalFrame>
    );
  }

  // ── Forgot Password Step ──────────────────────────────────────────────────
  if (step === "forgot-password") {
    return (
      <AuthModalFrame title="Reset Password">
        <button type="button"
          onClick={() => { setStep("login"); setForgotEmail(""); setForgotNewPw(""); setForgotConfirm(""); }}
          className={backBtnCls} style={{ color: BRAND }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
        <h2 className="text-2xl font-semibold text-white mb-1" style={{ letterSpacing: "-0.02em" }}>
          Reset Password
        </h2>
        <p className="text-white/70 mb-6 text-sm">
          Enter your registered email and choose a new password.
        </p>
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label className={labelCls}>Email Address</Label>
            <Input id="forgot-email" name="email" type="email" placeholder="you@example.com"
              value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
              autoComplete="email" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>New Password</Label>
            <div className="relative">
              <Input id="forgot-new-password" name="new-password" type={showForgotPw ? "text" : "password"}
                placeholder="Min 8 characters" value={forgotNewPw}
                onChange={(e) => setForgotNewPw(e.target.value)} autoComplete="new-password"
                className={`${inputCls} pr-11`} />
              <EyeToggle show={showForgotPw} onToggle={() => setShowForgotPw(v => !v)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Confirm New Password</Label>
            <Input id="forgot-confirm" name="confirm-password" type={showForgotPw ? "text" : "password"}
              placeholder="Repeat your new password" value={forgotConfirm}
              onChange={(e) => setForgotConfirm(e.target.value)} autoComplete="new-password"
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()} />
            {forgotConfirm && forgotNewPw !== forgotConfirm && (
              <p className="text-red-300 text-xs">Passwords do not match.</p>
            )}
          </div>
        </div>
        <PrimaryButton onClick={handleForgotPassword} loading={forgotLoading} loadingText="Resetting…"
          disabled={!forgotEmail || !forgotNewPw || !forgotConfirm || forgotNewPw !== forgotConfirm}>
          <span>Reset Password</span> <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </AuthModalFrame>
    );
  }

  // ── Main Login Step ───────────────────────────────────────────────────────
  return (
      <AuthModalFrame title={activePortal === "client" ? "Client Login" : "Talent Login"}>
        <AuthBackButton
          href={authPortalHref("login", currentSearch)}
          variant="dark"
          disabled={isLoading || retrySeconds > 0}
          className="mb-6"
          testId="auth-back-to-portal"
        />
        <h2 className="text-[1.625rem] font-semibold text-white mb-1" style={{ letterSpacing: "-0.02em" }}>
          {activePortal === "client" ? "Client Login" : "Talent Login"}
        </h2>
        <p className="text-white/70 mb-4 text-sm">
          {activePortal === "client"
            ? "Sign in to manage your team and talent."
            : "Sign in to manage your profile and opportunities."}
        </p>
        <form id="portal-login-form" noValidate onSubmit={handleSignIn}>
          {/* Email */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="login-email" className={labelCls}>Email Address</Label>
            <Input id="login-email" name="email" type="email" placeholder="you@example.com" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" className={inputCls} data-testid="input-portal-login-email" />
          </div>

          {/* Password */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password" className={labelCls}>Password</Label>
              <button type="button" disabled={isLoading || retrySeconds > 0}
                onClick={() => {
                  if (signInPending.current) return;
                  setForgotEmail(email);
                  setStep("forgot-password");
                }}
                className="text-xs font-medium transition-colors duration-200 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: BRAND }}>
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input id="login-password" name="password" type={showPassword ? "text" : "password"}
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" className={`${inputCls} pr-11`} required
                data-testid="input-portal-login-password" />
              <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
            </div>
          </div>

          {/* Sign In Button */}
          <div className="mb-5">
            <PrimaryButton type="submit" loading={isLoading} loadingText="Signing in…"
              testId="button-submit-portal-login" disabled={!activePortal || retrySeconds > 0}>
              <span>{retrySeconds > 0 ? `Try again in ${retrySeconds}s` : "Sign In"}</span>
              {retrySeconds === 0 && <ArrowRight className="w-4 h-4" />}
            </PrimaryButton>
          </div>
          {portalError && (
            <div role="alert" aria-live="assertive" data-testid="portal-login-error"
              className="mb-5 rounded-xl border border-red-300/30 bg-red-950/45 px-4 py-3 text-sm text-red-100">
              <p>{portalError}</p>
              {portalError.includes("Client") && activePortal === "talent" && (
                <Link href={`/login/client${currentSearch}`}>
                  <span className="mt-2 inline-block cursor-pointer font-semibold underline">Go to Client Login</span>
                </Link>
              )}
              {portalError.includes("Talent") && activePortal === "client" && (
                <Link href={`/login/talent${currentSearch}`}>
                  <span className="mt-2 inline-block cursor-pointer font-semibold underline">Go to Talent Login</span>
                </Link>
              )}
            </div>
          )}
        </form>

        {/* Footer links */}
        <div className="text-center space-y-2">
          <p className="text-white/65 text-xs">
            Don&apos;t have an account?{" "}
             <Link href={`/signup/${activePortal}${currentSearch}`}>
               <span className="text-xs font-medium hover:underline transition-colors duration-200 cursor-pointer" style={{ color: BRAND }}>
                 Create Account
               </span>
             </Link>
          </p>
        </div>
      </AuthModalFrame>
  );
}
