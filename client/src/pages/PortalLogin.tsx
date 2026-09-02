import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { usePortalLogin, PortalType } from "@/hooks/usePortalLogin";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowRight, Building, User, ArrowLeft } from "lucide-react";
import { PortalChooser } from "@/components/PortalChooser";

type PageStep = "login" | "setup-password" | "forgot-password";

// ── Design tokens ──────────────────────────────────────────────────────────
const BRAND = "#6D5EF7";
const BRAND_DARK = "#5546E0";

const inputCls = [
  "bg-white/85 border border-[#D7DCEF] text-[#0F172A]",
  "placeholder:text-[#94A3B8] rounded-[14px] h-[52px] px-4",
  "focus:border-[#6D5EF7] focus:ring-2 focus:ring-[#6D5EF7]/20",
  "transition-all duration-200",
].join(" ");

const labelCls = "text-[#334155] text-sm font-medium";

const backBtnCls = [
  "flex items-center gap-1.5 text-sm font-medium mb-8 transition-colors duration-200",
  `text-[${BRAND}] hover:text-[${BRAND_DARK}]`,
].join(" ");

// ── Reusable action button ─────────────────────────────────────────────────
function PrimaryButton({
  onClick,
  disabled,
  loading,
  loadingText,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 text-base font-semibold text-white rounded-2xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{
        background: `linear-gradient(135deg, ${BRAND} 0%, #4F7CFF 100%)`,
        height: "56px",
        boxShadow: "0 4px 20px rgba(109,94,247,0.30)",
      }}
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
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155] transition-colors"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

// ── Card shell — page background + glass card ─────────────────────────────
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #FCFDFF 0%, #F6F8FF 20%, #EEF4FF 45%, #E7F0FF 70%, #F8F9FF 100%)",
      }}
    >
      {/* Radial blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: "rgba(99,102,241,0.08)", filter: "blur(160px)" }} />
        <div className="absolute -top-20 -right-40 w-[450px] h-[450px] rounded-full"
          style={{ background: "rgba(168,85,247,0.08)", filter: "blur(180px)" }} />
        <div className="absolute -bottom-40 -left-20 w-[400px] h-[400px] rounded-full"
          style={{ background: "rgba(59,130,246,0.06)", filter: "blur(140px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "rgba(255,255,255,0.45)", filter: "blur(120px)" }} />
      </div>

      {/* Logo area */}
      <div className="relative z-10 flex flex-col items-center mb-10">
        <Link href="/">
          <span
            className="text-3xl font-bold tracking-tight cursor-pointer select-none"
            style={{ color: BRAND }}
          >
            OnSpot
          </span>
        </Link>
        <p className="text-[#94A3B8] text-xs mt-1.5 tracking-widest uppercase font-medium">
          Work Without Limits
        </p>
      </div>

      {/* Glass card */}
      <div
        className="relative z-10 w-full animate-fade-up"
        style={{
          maxWidth: "448px",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 20px 60px rgba(33,40,79,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
          borderRadius: "24px",
          padding: "40px",
        }}
      >
        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-6 text-[#94A3B8] text-xs text-center">
        &copy; {new Date().getFullYear()} OnSpot. All rights reserved.
      </p>
    </div>
  );
}

// ── Main page component ────────────────────────────────────────────────────
export default function PortalLogin() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { signInToPortal, setupTalentPassword, isLoading } = usePortalLogin();
  const { toast } = useToast();
  const pathname = location.split("?")[0];
  const currentSearch = typeof window === "undefined" ? "" : window.location.search;
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
    try { return new URLSearchParams(window.location.search).get("returnTo") || ""; }
    catch { return ""; }
  });

  const [selectedPortal, setSelectedPortal] = useState<PortalType | null>(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("portal");
      return v === "client" || v === "talent" ? v : null;
    } catch { return null; }
  });
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
    if (isAuthenticated && user) {
      if (user.role === "admin") { navigate("/admin/find-work"); return; }
      if (user.role === "client") { navigate(returnTo || "/hire-talent"); return; }
    }
    // Skip auto-redirect when arriving from a job application flow — the user
    // must explicitly log in so the application token can be linked correctly.
    if (applicationToken) return;
    try {
      const talentAuth = loadTalentAuth();
      if (talentAuth?.candidateId) {
        // If we arrived from a specific page (e.g. the job apply gate), send the
        // user there instead of their profile so they don't lose their place.
        navigate(returnTo || `/talent-profile/${talentAuth.candidateId}`);
      }
    } catch {
      // localStorage read failure — ignore and show login form
    }
  }, [isAuthenticated, user, applicationToken, returnTo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn() {
    if (!email || !password || !activePortal) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in your email and password." });
      return;
    }
    setPortalError("");
    let result: Awaited<ReturnType<typeof signInToPortal>>;
    try {
      result = await signInToPortal(activePortal, email, password);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sign in error", description: err?.message || "An unexpected error occurred. Please try again." });
      return;
    }
    if (!result.success) {
      if (result.requiresPasswordSetup) {
        setStep("setup-password");
        toast({ title: "Set a password", description: "This profile exists but has no password yet. Create one to continue." });
        return;
      }
      setPortalError(result.message);
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
      navigate(returnTo || "/find-work/jobs");
      return;
    }

    // If the user arrived here from a protected page (e.g. the job apply gate),
    // honour the returnTo param so they land back where they started.
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    navigate(result.redirectTo);
  }

  if (!activePortal && step === "login") {
    return <PortalChooser kind="login" />;
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
      navigate(returnTo || result.redirectTo);
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
      <CardShell>
        <button type="button" onClick={() => { setStep("login"); setSetupPassword(""); setSetupConfirm(""); }}
          className={backBtnCls} style={{ color: BRAND }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
        <h2 className="text-2xl font-bold text-[#172554] mb-1" style={{ letterSpacing: "-0.02em" }}>
          Create a Password
        </h2>
        <p className="text-[#64748B] mb-5 text-sm">
          Your profile exists but has no password yet. Set one to access the Talent Portal.
        </p>
        <div className="mb-4 px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF]">
          <p className="text-[#94A3B8] text-xs mb-0.5">Signing in as</p>
          <p className="text-[#172554] text-sm font-medium truncate">{email}</p>
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
              <p className="text-red-500 text-xs">Passwords do not match.</p>
            )}
          </div>
        </div>
        <PrimaryButton onClick={handleSetupPassword} loading={setupLoading} loadingText="Setting up…"
          disabled={!setupPassword || !setupConfirm || setupPassword !== setupConfirm || setupPassword.length < 8}>
          <span>Create Password &amp; Sign In</span> <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </CardShell>
    );
  }

  // ── Forgot Password Step ──────────────────────────────────────────────────
  if (step === "forgot-password") {
    return (
      <CardShell>
        <button type="button"
          onClick={() => { setStep("login"); setForgotEmail(""); setForgotNewPw(""); setForgotConfirm(""); }}
          className={backBtnCls} style={{ color: BRAND }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
        <h2 className="text-2xl font-bold text-[#172554] mb-1" style={{ letterSpacing: "-0.02em" }}>
          Reset Password
        </h2>
        <p className="text-[#64748B] mb-6 text-sm">
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
              <p className="text-red-500 text-xs">Passwords do not match.</p>
            )}
          </div>
        </div>
        <PrimaryButton onClick={handleForgotPassword} loading={forgotLoading} loadingText="Resetting…"
          disabled={!forgotEmail || !forgotNewPw || !forgotConfirm || forgotNewPw !== forgotConfirm}>
          <span>Reset Password</span> <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </CardShell>
    );
  }

  // ── Main Login Step ───────────────────────────────────────────────────────
  return (
    <>
      <CardShell>
        <h2 className="text-[1.625rem] font-bold text-[#172554] mb-1" style={{ letterSpacing: "-0.02em" }}>
          {activePortal === "client" ? "Client Login" : "Talent Login"}
        </h2>
        <p className="text-[#64748B] mb-4 text-sm">
          {activePortal === "client"
            ? "Sign in to manage your team and talent."
            : "Sign in to manage your profile and opportunities."}
        </p>
        <Link href={`/login${currentSearch}`}>
          <span className="mb-7 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#6D5EF7] hover:underline">
            <ArrowLeft className="h-3 w-3" /> Choose another portal
          </span>
        </Link>

        {/* Email */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="login-email" className={labelCls}>Email Address</Label>
          <Input id="login-email" name="email" type="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" className={inputCls} />
        </div>

        {/* Password */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className={labelCls}>Password</Label>
            <button type="button"
              onClick={() => { setForgotEmail(email); setStep("forgot-password"); }}
              className="text-xs font-medium transition-colors duration-200 hover:underline"
              style={{ color: BRAND }}>
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input id="login-password" name="password" type={showPassword ? "text" : "password"}
              placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" className={`${inputCls} pr-11`}
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()} />
            <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
          </div>
        </div>

        {/* Sign In Button */}
        <div className="mb-5">
          <PrimaryButton onClick={handleSignIn} loading={isLoading} loadingText="Signing in…"
            disabled={!activePortal || !email || !password}>
            <span>Sign In</span> <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        </div>
        {portalError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

        {/* Footer links */}
        <div className="text-center space-y-2">
          <p className="text-[#64748B] text-xs">
            Don&apos;t have an account?{" "}
             <Link href={`/signup/${activePortal}${currentSearch}`}>
               <span className="text-xs font-medium hover:underline transition-colors duration-200 cursor-pointer" style={{ color: BRAND }}>
                 Create Account
               </span>
             </Link>
          </p>
          <Link href="/">
            <span className="flex items-center justify-center gap-1 text-xs font-medium transition-colors duration-200 hover:underline cursor-pointer"
              style={{ color: BRAND }}>
              <ArrowLeft className="w-3 h-3" /> Back to Home
            </span>
          </Link>
        </div>
      </CardShell>

    </>
  );
}
