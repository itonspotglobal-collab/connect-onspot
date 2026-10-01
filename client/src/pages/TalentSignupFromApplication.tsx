import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { saveTalentAuth } from "@/components/TalentLoginModal";
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from "@shared/passwordPolicy";
import { signupRetryDelayMs } from "@/lib/signupRetry";

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
  const checks = [
    password.length >= 8,
    password.length <= 128,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  const labels = ["", "Weak", "Weak", "Fair", "Good", "Strong", "Strong"];
  const colors = ["", "bg-red-400", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-emerald-400", "bg-emerald-400"];

  if (!password) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
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

  // Parse URL params
  const searchParams = new URLSearchParams(window.location.search);
  const applicationToken = searchParams.get("applicationToken") ?? "";
  const returnTo = searchParams.get("returnTo") ?? "";
  const talentSignInUrl = (() => {
    const params = new URLSearchParams({
      portal: "talent",
      returnTo: returnTo || "/find-best-matches",
    });
    if (applicationToken) params.set("applicationToken", applicationToken);
    return `/portal-login?${params.toString()}`;
  })();

  // ── Mode detection ────────────────────────────────────────────────────────
  // Account-first mode: user clicked "Create Talent Account & Apply" from a
  // job page. No application exists yet; jobId is encoded in returnTo.
  // Legacy continuation mode: user followed an emailed link with applicationToken.
  const isAccountFirstMode = !applicationToken && !!returnTo;

  // State machine: loading | ready | submitting | done | error | refreshing
  type Stage = "loading" | "ready" | "submitting" | "done" | "error" | "refreshing";
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorKind, setErrorKind] = useState<"expired" | "used" | "generic">("generic");
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [linkRecovery, setLinkRecovery] = useState<{ token: string; submissionId: string } | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const retryAtRef = useRef(0);
  const submissionInFlight = useRef(false);
  const accountCreatedRef = useRef(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    if (!retryAt) {
      setRetrySeconds(0);
      return;
    }
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setRetrySeconds(remaining);
      if (!remaining) {
        setRetryAt(0);
        retryAtRef.current = 0;
      }
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    document.addEventListener("visibilitychange", updateRemaining);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateRemaining);
    };
  }, [retryAt]);

  // ── Resolve mode on mount ────────────────────────────────────────────────
  useEffect(() => {
    // Account-first mode: no token needed, skip straight to the signup form
    if (isAccountFirstMode) {
      setStage("ready");
      return;
    }

    // Truly invalid link — neither mode is active
    if (!applicationToken) {
      setErrorMsg("No application token found. Please apply for a job first.");
      setStage("error");
      return;
    }

    // Legacy continuation: resolve the application token
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = (values: typeof form) => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!values.firstName.trim()) next.firstName = "First name is required";
    if (!values.lastName.trim()) next.lastName = "Last name is required";
    if (!values.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = "Enter a valid email";
    if (!values.password) next.password = "Password is required";
    else {
      const passwordResult = validatePasswordStrength(values.password);
      if (!passwordResult.isValid) next.password = passwordResult.errors.join(". ");
    }
    if (values.confirmPassword !== values.password) next.confirmPassword = "Passwords do not match";
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
        setErrorKind(data.error === "Token already used" ? "used" : "generic");
        setErrorMsg(data.error === "Token already used"
          ? "This link has already been used to create an account. Please sign in."
          : "Unable to refresh your link. Please submit a new application.");
        setStage("error");
        return;
      }
      const newUrl = `${window.location.pathname}?applicationToken=${encodeURIComponent(data.continuationToken)}`;
      window.location.replace(newUrl);
    } catch {
      setErrorKind("generic");
      setErrorMsg("Unable to refresh your link. Please check your connection and try again.");
      setStage("error");
    }
  };

  const linkApplication = async (recovery: { token: string; submissionId: string }, candidateId?: string) => {
    const linkRes = await fetch("/api/job-applications/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${recovery.token}`,
      },
      body: JSON.stringify({
        submissionId: recovery.submissionId,
        token: applicationToken,
      }),
    });
    if (!linkRes.ok) {
      const linkErr = (await linkRes.json().catch(() => ({}))) ?? {};
      const message = linkErr.error || linkErr.message || "Could not link your application. Please try again.";
      throw new Error(message);
    }

    setLinkRecovery(null);
    setSubmitError("");
    await refreshAuth();
    toast({
      title: "🎉 Account created!",
      description:
        "Your account has been created and your application has been submitted successfully. You're now signed in and can apply for more opportunities.",
      duration: 8000,
    });
    sessionStorage.setItem("onspot_new_talent_welcome", "1");
    if (candidateId) sessionStorage.setItem("onspot_talent_candidate_id", candidateId);
    navigate("/find-best-matches");
  };

  const handleLinkRetry = async () => {
    if (submissionInFlight.current || !linkRecovery) return;
    submissionInFlight.current = true;
    setStage("submitting");
    setSubmitError("");
    try {
      await linkApplication(linkRecovery);
    } catch (err: any) {
      setSubmitError(
        `Your account was created, but the application could not be linked: ${err.message || "Please try again."} You can retry linking below or sign in; your application details are still here.`,
      );
      setStage("ready");
    } finally {
      submissionInFlight.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlight.current || retryAtRef.current > Date.now() || accountCreatedRef.current) return;

    const fields = new FormData(e.currentTarget as HTMLFormElement);
    const values = {
      firstName: String(fields.get("firstName") ?? "").trim(),
      lastName: String(fields.get("lastName") ?? "").trim(),
      email: String(fields.get("email") ?? "").trim(),
      phone: String(fields.get("phone") ?? "").trim(),
      password: String(fields.get("password") ?? ""),
      confirmPassword: String(fields.get("confirmPassword") ?? ""),
    };
    setForm(values);
    setSubmitError("");
    if (!validate(values)) return;
    // Legacy mode requires prefill to be loaded
    if (!isAccountFirstMode && !prefill) return;

    submissionInFlight.current = true;
    setStage("submitting");
    let recoveryForAttempt: { token: string; submissionId: string } | null = null;
    try {
      const signupRes = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: values.firstName,
          last_name: values.lastName,
          email: values.email,
          password: values.password,
          role: "talent",
        }),
      });

      if (!signupRes.ok) {
        const err = (await signupRes.json().catch(() => ({}))) ?? {};
        if (signupRes.status === 429) {
          const now = Date.now();
          const delayMs = signupRetryDelayMs(
            signupRes.headers.get("retry-after") ?? err.retryAfter,
            now,
          );
          retryAtRef.current = now + delayMs;
          setRetryAt(retryAtRef.current);
          setRetrySeconds(Math.ceil(delayMs / 1000));
        }
        const serverMessage = err.error || err.message || "Registration failed. Please try again.";
        throw new Error(serverMessage);
      }

      // A confirmed signup response must never be posted again, even if parsing,
      // storage, or application linking fails afterward.
      accountCreatedRef.current = true;
      setAccountCreated(true);
      const signupData = await signupRes.json();
      const authToken: string | undefined = signupData.token;
      const hasTalentAuth = Boolean(signupData.talentToken && signupData.candidateId);
      if (!authToken || !signupData.user || !hasTalentAuth) {
        setSubmitError("Your account was created, but automatic sign-in could not be completed. Please sign in to continue. Your entered details are still here.");
        setStage("ready");
        return;
      }

      const fullName = `${values.firstName} ${values.lastName}`;
      recoveryForAttempt = isAccountFirstMode ? null : { token: authToken, submissionId: prefill!.submissionId };
      if (recoveryForAttempt) setLinkRecovery(recoveryForAttempt);
      localStorage.setItem("onspot_jwt_token", authToken);
      localStorage.setItem("onspot_user", JSON.stringify(signupData.user));
      saveTalentAuth({
        token: signupData.talentToken,
        candidateId: signupData.candidateId,
        email: values.email,
        fullName,
      });
      sessionStorage.setItem("onspot_new_talent_welcome", "1");
      sessionStorage.setItem("onspot_talent_candidate_id", signupData.candidateId);

      if (isAccountFirstMode) {
        toast({
          title: "🎉 Account created!",
          description: "Your Talent account is ready. Review and submit your application below.",
          duration: 6000,
        });
        navigate(returnTo);
        return;
      }

      await linkApplication(recoveryForAttempt!, signupData.candidateId);
    } catch (err: any) {
      if (accountCreatedRef.current) {
        if (recoveryForAttempt) {
          setSubmitError(
            `Your account was created, but the application could not be linked: ${err.message || "Please try again."} You can retry linking below or sign in; your application details are still here.`,
          );
        } else {
          setSubmitError("Your account was created, but automatic sign-in could not be completed. Please sign in to continue. Your entered details are still here.");
        }
      } else {
        setSubmitError(err.message || "Registration failed. Please try again.");
      }
      setStage("ready");
    } finally {
      submissionInFlight.current = false;
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
          {isAccountFirstMode ? (
            <p className="text-sm text-slate-500">
              Create a free account to review and submit your application. Takes under a minute.
            </p>
          ) : prefill?.jobTitle ? (
            <p className="text-sm text-slate-500">
              Your application for <span className="font-medium text-slate-700 dark:text-slate-300">{prefill.jobTitle}</span> is saved — create an account to track it.
            </p>
          ) : null}
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
                    name="firstName"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    autoComplete="given-name"
                    data-testid="application-signup-first-name"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    autoComplete="family-name"
                    data-testid="application-signup-last-name"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              {/* Email — editable in account-first mode, locked in legacy mode */}
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                {isAccountFirstMode ? (
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    data-testid="application-signup-email"
                  />
                ) : (
                  <>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      readOnly
                      className="bg-slate-100 dark:bg-white/5 cursor-not-allowed"
                      autoComplete="email"
                      data-testid="application-signup-email"
                    />
                    <p className="text-xs text-slate-400">Email is pre-filled from your application.</p>
                  </>
                )}
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="8–128 characters"
                  autoComplete="new-password"
                  data-testid="application-signup-password"
                />
                <p className="text-xs leading-relaxed text-slate-500">
                  {PASSWORD_POLICY_HINT}
                </p>
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
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                  autoComplete="new-password"
                  data-testid="application-signup-confirm-password"
                />
                {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>

              {/* Submit */}
              <div className="pt-2">
                {submitError && (
                  <div
                    role="alert"
                    data-testid="application-signup-error"
                    className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
                  >
                    <p>{submitError}</p>
                    {linkRecovery && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3"
                        onClick={handleLinkRetry}
                        disabled={stage === "submitting"}
                        data-testid="application-signup-retry-link"
                      >
                        {stage === "submitting" ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Linking application…</>
                        ) : (
                          "Retry linking application"
                        )}
                      </Button>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={stage === "submitting" || retrySeconds > 0 || accountCreated}
                  data-testid="application-signup-submit"
                  className="w-full rounded-full bg-[#474ead] py-2.5 text-white hover:bg-[#3d439c]"
                >
                  {stage === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : isAccountFirstMode ? (
                    "Create account & continue to application"
                  ) : accountCreated ? (
                    "Account created"
                  ) : retrySeconds > 0 ? (
                    `Try again in ${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, "0")}`
                  ) : (
                    "Create account & track my application"
                  )}
                </Button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate(talentSignInUrl)}
                    className="text-[#474ead] hover:underline"
                    data-testid="application-signup-signin"
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
