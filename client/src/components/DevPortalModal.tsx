// DEV ONLY: temporary portal flow without real authentication.
// This component provides a dev-only Sign In / Sign Up modal so Client and Talent
// pages can be freely accessed during development.
// Replace with real auth integration when ready.

import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building,
  User,
  ArrowLeft,
  ArrowRight,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

// DEV ONLY: localStorage keys for temp dev user session
export const DEV_PORTAL_USER_KEY = "dev_portal_user";
export const DEV_PORTAL_ROLE_KEY = "dev_portal_role";

export function clearDevPortalSession() {
  localStorage.removeItem(DEV_PORTAL_USER_KEY);
  localStorage.removeItem(DEV_PORTAL_ROLE_KEY);
}

export function getDevPortalRole(): "client" | "talent" | null {
  const r = localStorage.getItem(DEV_PORTAL_ROLE_KEY);
  return r === "client" || r === "talent" ? r : null;
}

type ModalStep = "choice" | "signin" | "signin-portal" | "signup";
type PortalType = "client" | "talent";

interface DevPortalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevPortalModal({ open, onOpenChange }: DevPortalModalProps) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<ModalStep>("choice");
  const [showPassword, setShowPassword] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [signUpFirstName, setSignUpFirstName] = useState("");
  const [signUpLastName, setSignUpLastName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpRole, setSignUpRole] = useState<PortalType | null>(null);

  const resetModal = () => {
    setStep("choice");
    setShowPassword(false);
    setSignInEmail("");
    setSignInPassword("");
    setSignUpFirstName("");
    setSignUpLastName("");
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpRole(null);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetModal();
    onOpenChange(isOpen);
  };

  // DEV ONLY: save session to localStorage and navigate to the correct portal
  const enterPortal = (role: PortalType, name: string, email: string) => {
    localStorage.setItem(DEV_PORTAL_ROLE_KEY, role);
    localStorage.setItem(DEV_PORTAL_USER_KEY, JSON.stringify({ name, email, role }));
    onOpenChange(false);
    resetModal();
    // DEV ONLY: redirect to existing portal routes (protected route bypass handles the rest)
    if (role === "client") {
      navigate("/dashboard");
    } else {
      navigate("/talent-portal");
    }
  };

  const handleSignInContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail) return;
    // DEV ONLY: no backend auth call — advance to portal selection
    setStep("signin-portal");
  };

  const handleSignInPortalSelect = (role: PortalType) => {
    enterPortal(role, signInEmail.split("@")[0], signInEmail);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpRole || !signUpFirstName || !signUpEmail) return;
    // DEV ONLY: no backend signup call — save locally and redirect
    enterPortal(
      signUpRole,
      `${signUpFirstName} ${signUpLastName}`.trim(),
      signUpEmail,
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <div className="flex justify-center pt-2 mb-1">
          <img src={onspotLogo} alt="OnSpot" className="h-9 w-auto" />
        </div>

        {/* ── Choice: Sign In or Sign Up ──────────────────── */}
        {step === "choice" && (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl">Access Your Portal</DialogTitle>
              <DialogDescription>
                Sign in or create a new account to continue.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-2">
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => setStep("signin")}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setStep("signup")}
              >
                <UserPlus className="w-4 h-4" />
                Sign Up
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3 pb-1 leading-relaxed">
              <span className="font-medium">Client portal</span> — find and manage top outsourcing talent.
              <br />
              <span className="font-medium">Talent portal</span> — find jobs and manage your career profile.
            </p>
          </>
        )}

        {/* ── Sign In: Email + Password ────────────────────── */}
        {step === "signin" && (
          <>
            <DialogHeader>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit"
                onClick={() => setStep("choice")}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <DialogTitle>Sign In</DialogTitle>
              <DialogDescription>
                Enter your credentials to continue.
              </DialogDescription>
            </DialogHeader>
            {/* DEV ONLY: no backend auth endpoint is called */}
            <form onSubmit={handleSignInContinue} className="space-y-4 mt-1">
              <div className="space-y-1.5">
                <Label htmlFor="dev-si-email">Email</Label>
                <Input
                  id="dev-si-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-si-password">Password</Label>
                <div className="relative">
                  <Input
                    id="dev-si-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Don't have an account?{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => setStep("signup")}
              >
                Sign Up
              </button>
            </p>
          </>
        )}

        {/* ── Sign In → Portal Selection ───────────────────── */}
        {step === "signin-portal" && (
          <>
            <DialogHeader>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit"
                onClick={() => setStep("signin")}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <DialogTitle>Choose Your Portal</DialogTitle>
              <DialogDescription>
                Which portal would you like to access?
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Card
                className="cursor-pointer hover-elevate border-2 hover:border-primary/50 transition-all duration-200"
                onClick={() => handleSignInPortalSelect("client")}
              >
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
                    <Building className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">Client Portal</h3>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Find and manage top outsourcing talent.
                  </p>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover-elevate border-2 hover:border-[hsl(var(--gold-yellow)/0.5)] transition-all duration-200"
                onClick={() => handleSignInPortalSelect("talent")}
              >
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-[hsl(var(--gold-yellow)/0.1)] rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-[hsl(var(--gold-yellow)/0.8)]" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">Talent Portal</h3>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Find jobs and manage your career profile.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ── Sign Up ──────────────────────────────────────── */}
        {step === "signup" && (
          <>
            <DialogHeader>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit"
                onClick={() => setStep("choice")}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <DialogTitle>Create Account</DialogTitle>
              <DialogDescription>Tell us a bit about yourself.</DialogDescription>
            </DialogHeader>
            {/* DEV ONLY: no backend signup endpoint is called */}
            <form onSubmit={handleSignUp} className="space-y-3 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dev-su-first">First Name</Label>
                  <Input
                    id="dev-su-first"
                    placeholder="John"
                    value={signUpFirstName}
                    onChange={(e) => setSignUpFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-su-last">Last Name</Label>
                  <Input
                    id="dev-su-last"
                    placeholder="Doe"
                    value={signUpLastName}
                    onChange={(e) => setSignUpLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-su-email">Email</Label>
                <Input
                  id="dev-su-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-su-password">Password</Label>
                <div className="relative">
                  <Input
                    id="dev-su-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>I am a...</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSignUpRole("client")}
                    className={`flex flex-col items-center gap-2 rounded-md border-2 p-3 text-sm transition-all duration-200 ${
                      signUpRole === "client"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <Building className="w-5 h-5" />
                    <span className="font-medium text-xs">Client</span>
                    <span className="text-xs opacity-75 leading-tight text-center">
                      Looking for talent
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignUpRole("talent")}
                    className={`flex flex-col items-center gap-2 rounded-md border-2 p-3 text-sm transition-all duration-200 ${
                      signUpRole === "talent"
                        ? "border-[hsl(var(--gold-yellow)/0.8)] bg-[hsl(var(--gold-yellow)/0.05)] text-[hsl(var(--gold-yellow)/0.8)]"
                        : "border-border text-muted-foreground hover:border-[hsl(var(--gold-yellow)/0.4)] hover:text-foreground"
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="font-medium text-xs">Talent</span>
                    <span className="text-xs opacity-75 leading-tight text-center">
                      Looking for jobs
                    </span>
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 mt-1"
                disabled={!signUpRole}
              >
                Create Account <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Already have an account?{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => setStep("signin")}
              >
                Sign In
              </button>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
