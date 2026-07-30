import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PrefillData {
  submissionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
}

// ─── Password strength helper ────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-emerald-400"];

  if (!password) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : "bg-slate-200 dark:bg-white/10"}`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500">{labels[score]}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TalentSignupFromApplication() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { refreshAuth } = useAuth();

  // Parse token from URL
  const searchParams = new URLSearchParams(window.location.search);
  const applicationToken = searchParams.get("applicationToken") ?? "";

  // State machine: loading | ready | submitting | done | error | refreshing | refreshed
  type Stage = "loading" | "ready" | "submitting" | "done" | "error" | "refreshing";
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorKind, setErrorKind] = useState<"expired" | "used" | "generic">("generic");
  const [prefill, setPrefill] = useState<PrefillData | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  // Resolve token on mount
  useEffect(() => {
    if (!applicationToken) {
      setErrorMsg("No application token found. Please apply for a job first.");
      setStage("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/job-applications/continue/${encodeURIComponent(applicationToken)}`);
        if (res.status === 410) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "Token already used") {
            setErrorKind("used");
            setErrorMsg("This link has already been used to create an account. Please sign in.");
          } else {
            setErrorKind("expired");
            setErrorMsg("This signup link has expired. You can request a fresh link below.");
          }
          setStage("error");
          return;
        }
        if (!res.ok) {
          setErrorKind("generic");
          setErrorMsg("This link is invalid or has expired. Please submit a new application.");
          setStage("error");
          return;
        }
        const data: PrefillData = await res.json();
        setPrefill(data);
        setForm((prev) => ({
          ...prev,
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
        }));
        setStage("ready");
      } catch {
        setErrorMsg("Unable to load your application. Please check your connection and try again.");
        setStage("error");
      }
    })();
  }, [applicationToken]);

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.password) next.password = "Password is required";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters";
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRefreshToken = async () => {
    setStage("refreshing" as any);
    try {
      const res = await fetch("/api/job-applications/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: applicationToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // If it was already used (race condition), show appropriate message
        setErrorKind(data.error === "Token already used" ? "used" : "generic");
        setErrorMsg(data.error === "Token already used"
          ? "This link has already been used to create an account. Please sign in."
          : "Unable to refresh your link. Please submit a new application.");
        setStage("error");
        return;
      }
      // Navigate to same page with the new token
      const newUrl = `${window.location.pathname}?applicationToken=${encodeURIComponent(data.continuationToken)}`;
      window.location.replace(newUrl);
    } catch {
      setErrorKind("generic");
      setErrorMsg("Unable to refresh your link. Please check your connection and try again.");
      setStage("error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !prefill) return;

    setStage("submitting");
    try {
      // 1. Create the talent account
      const signupRes = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: "talent",
        }),
      });

      if (!signupRes.ok) {
        const err = await signupRes.json().catch(() => ({ error: "Registration failed" }));
        throw new Error(err.error || err.message || "Registration failed");
      }

      const signupData = await signupRes.json();
      const authToken: string = signupData.token;

      // 2. Link the application to the new account (required — not best-effort)
      const linkRes = await fetch("/api/job-applications/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          submissionId: prefill.submissionId,
          token: applicationToken,
        }),
      });
      if (!linkRes.ok) {
        const linkErr = await linkRes.json().catch(() => ({ error: "Linking failed" }));
        throw new Error(linkErr.error || "Could not link your application to your new account. Please contact support.");
      }

      // 3. Persist auth using the app's standard localStorage contract
      localStorage.setItem("onspot_jwt_token", authToken);
      localStorage.setItem("onspot_user", JSON.stringify(signupData.user));

      // 4. Sync AuthContext so guards see the user as authenticated, then
      //    redirect to the jobs board (not directly into the portal).
      await refreshAuth();

      toast({
        title: "🎉 Account created!",
        description:
          "Your account has been created and your application has been submitted successfully. You're now signed in and can apply for more opportunities.",
        duration: 8000,
      });

      navigate("/find-work/jobs");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
      setStage("ready");
    }
  };

  // ── Render states ────────────────────────────────────────────────────────

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="flex flex-col items-center justify-center pt-40 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
          <p className="text-sm text-slate-500">Loading your application…</p>
        </div>
      </div>
    );
  }

  if (stage === "error" || (stage as any) === "refreshing") {
    const isRefreshing = (stage as any) === "refreshing";
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-lg px-6 pt-24 text-center">
          <div className="mb-4 flex justify-center">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
            {errorKind === "expired" ? "Link expired" : "Link unavailable"}
          </h2>
          <p className="mb-8 text-sm text-slate-500">{errorMsg}</p>
          <div className="flex flex-col items-center gap-3">
            {errorKind === "expired" && (
              <Button
                className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]"
                onClick={handleRefreshToken}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Getting new link…</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Get a new link</>
                )}
              </Button>
            )}
            <Button className={`rounded-full px-8 ${errorKind !== "expired" ? "bg-[#474ead] text-white hover:bg-[#3d439c]" : ""}`}
              variant={errorKind === "expired" ? "outline" : "default"}
              onClick={() => navigate("/find-work/jobs")}>
              Browse open roles
            </Button>
            <Button variant="outline" className="rounded-full px-8"
              onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // stage === "ready" | "submitting"
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#474ead]">
            Almost there
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Create your Talent account
          </h1>
          {prefill?.jobTitle && (
            <p className="text-sm text-slate-500">
              Your application for <span className="font-medium text-slate-700 dark:text-slate-300">{prefill.jobTitle}</span> is saved — create an account to track it.
            </p>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* First + Last */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    autoComplete="given-name"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    autoComplete="family-name"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              {/* Email (locked to submitted value) */}
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  readOnly
                  className="bg-slate-100 dark:bg-white/5 cursor-not-allowed"
                  autoComplete="email"
                />
                <p className="text-xs text-slate-400">Email is pre-filled from your application.</p>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                <PasswordStrength password={form.password} />
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={stage === "submitting"}
                  className="w-full rounded-full bg-[#474ead] py-2.5 text-white hover:bg-[#3d439c]"
                >
                  {stage === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    "Create account & track my application"
                  )}
                </Button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="text-[#474ead] hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
