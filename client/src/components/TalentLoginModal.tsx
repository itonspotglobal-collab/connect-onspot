import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    const payload = JSON.parse(atob(parts[1]));
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
}

export function clearTalentAuth() {
  localStorage.removeItem(TOKEN_KEY);
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
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "set-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Enter your email and password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/talent-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_password") {
          // Works for both known-profile (profileId) and Access Portal (no profileId) flows
          setMode("set-password");
          toast({ title: "Set a password", description: "This profile exists but has no password yet. Please create one to continue." });
          return;
        }
        toast({ title: "Login failed", description: data.error || "Invalid credentials.", variant: "destructive" });
        return;
      }
      const auth: TalentAuthState = {
        token: data.token,
        candidateId: data.candidate.id,
        email: data.candidate.email,
        fullName: data.candidate.fullName || data.candidate.email,
      };
      saveTalentAuth(auth);
      onSuccess(auth);
      onClose();
      toast({ title: "Signed in", description: `Welcome back, ${auth.fullName}!` });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword() {
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
          : data.error || "Could not set password.";
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
      saveTalentAuth(auth);
      onSuccess(auth);
      onClose();
      toast({ title: "Password set", description: "You're now signed in to your profile." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setShowPw(false); setMode("login"); setEmail(""); setPassword(""); setConfirmPassword(""); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#474ead]/10">
              <Lock className="h-4 w-4 text-[#474ead]" />
            </div>
            {mode === "login" ? "Sign in to your Talent Account" : "Create a password"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {mode === "set-password" && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              This is your first time signing in. Create a password to protect your profile.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="talent-email">Email address</Label>
            <Input
              id="talent-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSetPassword())}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="talent-pw">{mode === "login" ? "Password" : "New password"}</Label>
            <div className="relative">
              <Input
                id="talent-pw"
                type={showPw ? "text" : "password"}
                placeholder={mode === "login" ? "Your password" : "Min. 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && mode === "login" && handleLogin()}
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
                type={showPw ? "text" : "password"}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {mode === "login" ? (
              <>
                <Button
                  className="flex-1 rounded-full bg-[#474ead] text-white"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
                {profileId && (
                  <Button variant="outline" className="rounded-full" onClick={() => setMode("set-password")}>
                    No password yet?
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  className="flex-1 rounded-full bg-[#474ead] text-white"
                  onClick={handleSetPassword}
                  disabled={loading}
                >
                  {loading ? "Setting…" : "Set password & sign in"}
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => setMode("login")}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
