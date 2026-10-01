import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { signupRetryDelayMs } from "@/lib/signupRetry";
import { queryClient } from "@/lib/queryClient";
import { decodeBase64UrlJson } from "@/lib/talentToken";

// ─── Talent Auth State ─────────────────────────────────────────────────────────

export const TOKEN_KEY = "talent_profile_token";

export interface TalentAuthState {
  token: string;
  candidateId: string;
  email: string;
  fullName: string;
}

export function loadTalentAuth(): TalentAuthState | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TalentAuthState;
    if (!parsed.token || !parsed.candidateId) return null;
    const parts = parsed.token.split(".");
    if (parts.length !== 3) return null;
    const payload = decodeBase64UrlJson<{
      type?: string;
      candidateId?: string;
      email?: string;
      exp?: number;
    }>(parts[1]);
    if (
      payload.type !== "candidate" ||
      payload.candidateId !== parsed.candidateId ||
      payload.email?.trim().toLowerCase() !== parsed.email.trim().toLowerCase()
    ) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTalentAuth(state: TalentAuthState) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("talent-auth-changed"));
}

export function clearTalentAuth() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("talent-auth-changed"));
}

type ActiveTalentUser = { id: string; email: string; role: string } | null;

/**
 * Switch the live app to a verified candidate session after the talent login
 * endpoint has confirmed the credentials. Clear a previous main-portal token
 * only at this point, so refreshAuth resolves the candidate identity instead
 * of silently restoring a stale Client/Admin user.
 */
export async function activateTalentSession(
  auth: TalentAuthState,
  refreshAuth: () => Promise<ActiveTalentUser>,
): Promise<boolean> {
  try {
    const encodedPayload = auth.token.split(".")[1];
    if (!encodedPayload) return false;
    const payload = decodeBase64UrlJson<{
      type?: string;
      candidateId?: string;
      email?: string;
      exp?: number;
    }>(encodedPayload);
    if (
      payload.type !== "candidate" ||
      payload.candidateId !== auth.candidateId ||
      payload.email?.trim().toLowerCase() !== auth.email.trim().toLowerCase() ||
      (payload.exp !== undefined && payload.exp * 1000 <= Date.now())
    ) return false;

    const previousMainToken = localStorage.getItem("onspot_jwt_token");
    const previousMainUser = localStorage.getItem("onspot_user");
    const previousTalentSession = localStorage.getItem(TOKEN_KEY);
    try {
      localStorage.removeItem("onspot_jwt_token");
      localStorage.removeItem("onspot_user");
      saveTalentAuth(auth);

      const activeUser = await refreshAuth();
      if (
        activeUser?.role.toLowerCase() === "talent" &&
        activeUser.email.trim().toLowerCase() === auth.email.trim().toLowerCase()
      ) {
        queryClient.clear();
        return true;
      }
    } catch {
      // Restore the previous portal session if candidate identity verification failed.
    }

    clearTalentAuth();
    if (previousTalentSession !== null) {
      localStorage.setItem(TOKEN_KEY, previousTalentSession);
      window.dispatchEvent(new Event("talent-auth-changed"));
    }
    if (previousMainToken !== null) localStorage.setItem("onspot_jwt_token", previousMainToken);
    if (previousMainUser !== null) localStorage.setItem("onspot_user", previousMainUser);
    await refreshAuth();
    return false;
  } catch {
    return false;
  }
}

// ─── TalentLoginModal ──────────────────────────────────────────────────────────

export function TalentLoginModal({
  profileId,
  open,
  onClose,
  onSuccess,
}: {
  profileId?: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (auth: TalentAuthState) => void;
}) {
  const { refreshAuth } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "set-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const retryUntil = useRef(0);
  const requestPending = useRef(false);

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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current || retryUntil.current > Date.now()) return;
    const formData = new FormData(event.currentTarget);
    const loginEmail = String(formData.get("email") ?? "");
    const loginPassword = String(formData.get("password") ?? "");
    if (!loginEmail.trim() || loginPassword.length === 0) {
      const message = "Enter your email and password.";
      setErrorMessage(message);
      toast({ title: "Missing fields", description: message, variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      const message = "Please enter a valid email address.";
      setErrorMessage(message);
      toast({ title: "Invalid email", description: message, variant: "destructive" });
      return;
    }
    requestPending.current = true;
    setEmail(loginEmail);
    setPassword(loginPassword);
    setErrorMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/talent-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "no_password") {
          // Works for both known-profile (profileId) and Access Portal (no profileId) flows
          setMode("set-password");
          const message = "This profile exists but has no password yet. Please create one to continue.";
          setErrorMessage("");
          toast({ title: "Set a password", description: message });
          return;
        }
        if (res.status === 429) {
          const retryAfterMs = signupRetryDelayMs(
            res.headers.get("Retry-After")
              ?? data.retryAfter
              ?? data.retry_after
              ?? data.metadata?.retryAfter
              ?? data.metadata?.retry_after,
            Date.now(),
            15 * 60 * 1000,
          );
          const seconds = Math.ceil(retryAfterMs / 1000);
          retryUntil.current = Date.now() + seconds * 1000;
          setRetrySeconds(seconds);
        }
        const message = data.message || (res.status === 429
          ? "Too many sign-in attempts. Please try again later."
          : res.status === 400
            ? "Please check your email and password."
            : res.status === 401
              ? "Incorrect email or password."
              : res.status >= 500
                ? "Sign in is temporarily unavailable. Please try again."
                : "Unable to sign in. Please try again.");
        setErrorMessage(message);
        toast({ title: "Login failed", description: message, variant: "destructive" });
        return;
      }
      const auth: TalentAuthState = {
        token: data.token,
        candidateId: data.candidate.id,
        email: data.candidate.email,
        fullName: data.candidate.fullName || data.candidate.email,
      };
      if (!await activateTalentSession(auth, refreshAuth)) {
        const message = "We couldn't verify the signed-in Talent account. Please try again.";
        setErrorMessage(message);
        toast({ title: "Account verification failed", description: message, variant: "destructive" });
        return;
      }
      onSuccess(auth);
      onClose();
      toast({ title: "Signed in", description: `Welcome back, ${auth.fullName}!` });
    } catch {
      const message = "Could not reach the server. Please try again.";
      setErrorMessage(message);
      toast({ title: "Network error", description: message, variant: "destructive" });
    } finally {
      requestPending.current = false;
      setLoading(false);
    }
  }

  async function handleSetPassword() {
    if (requestPending.current) return;
    if (!email || !password || !confirmPassword) {
      toast({ title: "Missing fields", description: "Fill in all fields.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    requestPending.current = true;
    setErrorMessage("");
    setLoading(true);
    try {
      // If we have a profileId use the old endpoint (requires candidateId); otherwise use the new email-only endpoint
      let res: Response;
      if (profileId) {
        res = await fetch("/api/talent-auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, candidateId: profileId, password }),
        });
      } else {
        res = await fetch("/api/candidates/setup-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, newPassword: password }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error === "password_exists"
          ? "A password already exists. Please sign in or use Forgot Password."
          : data.message || "Could not set password.";
        setErrorMessage(msg);
        toast({ title: "Failed", description: msg, variant: "destructive" });
        return;
      }
      // Both endpoints return token + candidate info (slightly different shapes)
      const candidateId = data.candidateId || data.candidate?.id;
      const fullName = data.candidate?.fullName || email;
      const auth: TalentAuthState = {
        token: data.token,
        candidateId,
        email,
        fullName,
      };
      if (!await activateTalentSession(auth, refreshAuth)) {
        const message = "We couldn't verify the signed-in Talent account. Please try again.";
        setErrorMessage(message);
        toast({ title: "Account verification failed", description: message, variant: "destructive" });
        return;
      }
      onSuccess(auth);
      onClose();
      toast({ title: "Password set", description: "You're now signed in to your profile." });
    } catch {
      const message = "Could not reach the server. Please try again.";
      setErrorMessage(message);
      toast({ title: "Network error", description: message, variant: "destructive" });
    } finally {
      requestPending.current = false;
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (v || requestPending.current) return;
      setShowPw(false); setMode("login"); setEmail(""); setPassword(""); setConfirmPassword(""); setErrorMessage("");
      onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#474ead]/10">
              <Lock className="h-4 w-4 text-[#474ead]" />
            </div>
            {mode === "login" ? "Sign in to your Talent Account" : "Create a password"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4 pt-2" noValidate onSubmit={(event) => {
          if (mode === "login") void handleLogin(event);
          else {
            event.preventDefault();
            void handleSetPassword();
          }
        }}>
          {mode === "set-password" && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              This is your first time signing in. Create a password to protect your profile.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="talent-email">Email address</Label>
            <Input
              id="talent-email"
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="talent-pw">{mode === "login" ? "Password" : "New password"}</Label>
            <div className="relative">
              <Input
                id="talent-pw"
                name="password"
                type={showPw ? "text" : "password"}
                required
                placeholder={mode === "login" ? "Your password" : "Min. 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === "set-password" && (
            <div className="space-y-2">
              <Label htmlFor="talent-pw-confirm">Confirm password</Label>
              <Input
                id="talent-pw-confirm"
                name="confirmPassword"
                type={showPw ? "text" : "password"}
                required
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {errorMessage && (
            <div role="alert" aria-live="assertive" data-testid="talent-login-error"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {mode === "login" ? (
              <>
                <Button
                  type="submit"
                  className="flex-1 rounded-full bg-[#474ead] text-white"
                  disabled={loading || retrySeconds > 0}
                  data-testid="button-talent-modal-login"
                >
                  {loading ? "Signing in…" : retrySeconds > 0 ? `Try again in ${retrySeconds}s` : "Sign in"}
                </Button>
                {profileId && (
                  <Button type="button" variant="outline" className="rounded-full" disabled={loading}
                    onClick={() => { setErrorMessage(""); setMode("set-password"); }}>
                    No password yet?
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  type="submit"
                  className="flex-1 rounded-full bg-[#474ead] text-white"
                  disabled={loading}
                >
                  {loading ? "Setting…" : "Set password & sign in"}
                </Button>
                <Button type="button" variant="outline" className="rounded-full" disabled={loading}
                  onClick={() => { setErrorMessage(""); setMode("login"); }}>
                  Back
                </Button>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-400">
            {profileId
              ? "Only the profile owner can sign in. Your email must match this candidate profile."
              : "Enter your registered email and password to access your Talent Account."}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
