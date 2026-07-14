import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { usePortalLogin, PortalType } from "@/hooks/usePortalLogin";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowRight, Building, User, ArrowLeft } from "lucide-react";

type PageStep = "login" | "setup-password" | "forgot-password";

// ── Card shell — defined at module level so it is never recreated on re-render ──
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #07071f 0%, #0d0d30 30%, #13133d 60%, #0d0d30 80%, #07071f 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(91,124,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(91,124,255,0.3) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
      {/* Glow orb */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #3A3AF8 0%, #7F3DF4 50%, transparent 80%)" }}
        />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <Link href="/">
          <span
            className="text-3xl font-bold tracking-tight cursor-pointer select-none"
            style={{
              background: "linear-gradient(135deg, #5B7CFF 0%, #9B7FFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            OnSpot
          </span>
        </Link>
        <p className="text-white/40 text-xs mt-1 tracking-widest uppercase">Global Outsourcing Platform</p>
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f0f3c 0%, #1a1a4e 40%, #1e1e55 70%, #1a1a4e 100%)",
          border: "1px solid rgba(91,124,255,0.2)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,124,255,0.1)",
        }}
      >
        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-6 text-white/30 text-xs text-center">
        &copy; {new Date().getFullYear()} OnSpot Global. All rights reserved.
      </p>
    </div>
  );
}

// ── Main page component ─────────────────────────────────────────────────────
export default function PortalLogin() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { signInToPortal, setupTalentPassword, isLoading } = usePortalLogin();
  const { toast } = useToast();

  // Query params read once at mount via useState initialiser — never updates the URL
  const [selectedPortal, setSelectedPortal] = useState<PortalType | null>(() => {
    const v = new URLSearchParams(window.location.search).get("portal");
    return v === "client" || v === "talent" ? v : null;
  });
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get("email") || "");

  const [step, setStep] = useState<PageStep>("login");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  // Redirect already-authenticated users (runs once on mount)
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") { navigate("/admin/find-work"); return; }
      if (user.role === "client") { navigate("/client-profile"); return; }
    }
    const talentAuth = loadTalentAuth();
    if (talentAuth?.candidateId) {
      navigate(`/talent-profile/${talentAuth.candidateId}`);
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn() {
    if (!email || !password || !selectedPortal) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in your email, password, and select a portal." });
      return;
    }
    const result = await signInToPortal(selectedPortal, email, password);
    if (!result.success) {
      if (result.requiresPasswordSetup) {
        setStep("setup-password");
        toast({ title: "Set a password", description: "This profile exists but has no password yet. Create one to continue." });
        return;
      }
      toast({ variant: "destructive", title: "Sign in failed", description: result.message });
      return;
    }
    const displayName = result.portal === "talent" ? result.auth.fullName : result.displayName;
    toast({ title: "Signed in", description: `Welcome back, ${displayName}!` });
    navigate(result.redirectTo);
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
      navigate(result.redirectTo);
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail || !forgotNewPw || !forgotConfirm) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all fields." });
      return;
    }
    if (forgotNewPw !== forgotConfirm) {
      toast({ variant: "destructive", title: "Passwords don't match" });
      return;
    }
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
        <div className="px-8 py-10">
          <button
            type="button"
            onClick={() => { setStep("login"); setSetupPassword(""); setSetupConfirm(""); }}
            className="flex items-center gap-1.5 text-white/60 hover:text-white/90 text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </button>
          <h2 className="text-3xl font-light text-white mb-2" style={{ letterSpacing: "-0.02em" }}>
            Create a Password
          </h2>
          <p className="text-white/60 mb-6 text-sm">
            Your profile exists but has no password yet. Set one now to access the Talent Portal.
          </p>
          <div className="mb-4 px-4 py-3 rounded-xl border border-white/20 bg-white/5">
            <p className="text-white/50 text-xs mb-0.5">Signing in as</p>
            <p className="text-white text-sm font-medium truncate">{email}</p>
          </div>
          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">New Password</Label>
              <div className="relative">
                <Input
                  id="setup-password"
                  name="new-password"
                  type={showSetupPw ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  autoComplete="new-password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSetupPw(v => !v)}
                  aria-label={showSetupPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors"
                >
                  {showSetupPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">Confirm Password</Label>
              <Input
                id="setup-confirm"
                name="confirm-password"
                type={showSetupPw ? "text" : "password"}
                placeholder="Re-enter your new password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                autoComplete="new-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12"
                onKeyDown={(e) => e.key === "Enter" && handleSetupPassword()}
              />
              {setupConfirm && setupPassword !== setupConfirm && (
                <p className="text-red-400 text-xs">Passwords do not match.</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSetupPassword}
            disabled={setupLoading || !setupPassword || !setupConfirm || setupPassword !== setupConfirm || setupPassword.length < 8}
            className="w-full px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)", boxShadow: "0 8px 30px rgba(58,58,248,0.35)" }}
          >
            {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {setupLoading ? "Setting up…" : <><span>Create Password &amp; Sign In</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </CardShell>
    );
  }

  // ── Forgot Password Step ──────────────────────────────────────────────────
  if (step === "forgot-password") {
    return (
      <CardShell>
        <div className="px-8 py-10">
          <button
            type="button"
            onClick={() => { setStep("login"); setForgotEmail(""); setForgotNewPw(""); setForgotConfirm(""); }}
            className="flex items-center gap-1.5 text-white/60 hover:text-white/90 text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </button>
          <h2 className="text-3xl font-light text-white mb-2" style={{ letterSpacing: "-0.02em" }}>
            Reset Password
          </h2>
          <p className="text-white/60 mb-7 text-sm">
            Enter your registered email and choose a new password.
          </p>
          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">Email Address</Label>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                autoComplete="email"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">New Password</Label>
              <div className="relative">
                <Input
                  id="forgot-new-password"
                  name="new-password"
                  type={showForgotPw ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={forgotNewPw}
                  onChange={(e) => setForgotNewPw(e.target.value)}
                  autoComplete="new-password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowForgotPw(v => !v)}
                  aria-label={showForgotPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors"
                >
                  {showForgotPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">Confirm New Password</Label>
              <Input
                id="forgot-confirm"
                name="confirm-password"
                type={showForgotPw ? "text" : "password"}
                placeholder="Repeat your new password"
                value={forgotConfirm}
                onChange={(e) => setForgotConfirm(e.target.value)}
                autoComplete="new-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12"
                onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
              />
              {forgotConfirm && forgotNewPw !== forgotConfirm && (
                <p className="text-red-400 text-xs">Passwords do not match.</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={forgotLoading || !forgotEmail || !forgotNewPw || !forgotConfirm || forgotNewPw !== forgotConfirm}
            className="w-full px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)", boxShadow: "0 8px 30px rgba(58,58,248,0.35)" }}
          >
            {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {forgotLoading ? "Resetting…" : <><span>Reset Password</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </CardShell>
    );
  }

  // ── Main Login Step ───────────────────────────────────────────────────────
  return (
    <CardShell>
      <div className="px-8 py-10">
        <h2 className="text-3xl font-light text-white mb-1" style={{ letterSpacing: "-0.02em" }}>
          Welcome back
        </h2>
        <p className="text-white/60 mb-8 text-sm">Sign in to your OnSpot account.</p>

        {/* Email */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="login-email" className="text-white/90 text-sm font-medium">Email Address</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12"
          />
        </div>

        {/* Password */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-white/90 text-sm font-medium">Password</Label>
            <button
              type="button"
              onClick={() => { setForgotEmail(email); setStep("forgot-password"); }}
              className="text-xs text-white/50 hover:text-white/80 transition-colors underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] h-12 pr-10"
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Portal Selection */}
        <div className="mb-6">
          <p className="text-white/80 text-sm font-medium mb-3">Choose your portal</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Client */}
            <button
              type="button"
              onClick={() => setSelectedPortal("client")}
              className={`relative flex flex-col items-center gap-2 rounded-xl p-4 text-sm transition-all duration-200 text-left ${
                selectedPortal === "client"
                  ? "border-2 border-[#5B7CFF] bg-[#3A3AF8]/20"
                  : "border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
              }`}
            >
              <Building className="w-6 h-6 text-[#5B7CFF]" />
              <span className="text-white font-medium text-center">Client</span>
              <span className="text-white/50 text-xs leading-tight text-center">
                Find and manage top outsourcing talent.
              </span>
              {selectedPortal === "client" && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#5B7CFF] flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {/* Talent */}
            <button
              type="button"
              onClick={() => setSelectedPortal("talent")}
              className={`relative flex flex-col items-center gap-2 rounded-xl p-4 text-sm transition-all duration-200 text-left ${
                selectedPortal === "talent"
                  ? "border-2 border-[hsl(var(--gold-yellow)/0.8)] bg-[hsl(var(--gold-yellow)/0.1)]"
                  : "border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
              }`}
            >
              <User className="w-6 h-6 text-yellow-400" />
              <span className="text-white font-medium text-center">Talent</span>
              <span className="text-white/50 text-xs leading-tight text-center">
                Find jobs and manage your career profile.
              </span>
              {selectedPortal === "talent" && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Sign In Button */}
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isLoading || !selectedPortal || !email || !password}
          className="w-full px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mb-5"
          style={{
            background: "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)",
            boxShadow: "0 8px 30px rgba(58,58,248,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isLoading ? "Signing in…" : <><span>Sign In</span> <ArrowRight className="w-4 h-4" /></>}
        </button>

        {/* Footer links */}
        <div className="text-center space-y-2">
          <p className="text-white/40 text-xs">
            Don&apos;t have an account?{" "}
            <Link href="/">
              <span
                className="text-white/60 hover:text-white underline transition-colors cursor-pointer"
                onClick={() => { sessionStorage.setItem("openAccessPortal", "signup"); }}
              >
                Create Account
              </span>
            </Link>
          </p>
          <p className="text-white/40 text-xs">
            <Link href="/">
              <span className="text-white/50 hover:text-white/80 transition-colors cursor-pointer flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to Home
              </span>
            </Link>
          </p>
        </div>
      </div>
    </CardShell>
  );
}
