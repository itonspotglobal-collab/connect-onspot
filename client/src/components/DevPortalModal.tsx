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
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/lib/api";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";

// Legacy dev-session keys — kept for backward compat with any code that reads them,
// but no longer written to by this component.
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

type ModalStep = "choice" | "signin" | "signup";
type PortalType = "client" | "talent";

interface DevPortalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevPortalModal({ open, onOpenChange }: DevPortalModalProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<ModalStep>("choice");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(false);
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

  // Real sign-in: calls /api/login, stores JWT, full-page navigates by role
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) return;

    console.log("[PORTAL SIGNIN] handler reached", { email: signInEmail });
    setIsLoading(true);
    try {
      const result = await authAPI.login(signInEmail, signInPassword);
      console.log("[PORTAL SIGNIN] response", result);

      if (result.success && result.token && result.user) {
        localStorage.setItem("onspot_jwt_token", result.token);
        localStorage.setItem("onspot_user", JSON.stringify(result.user));
        console.log("[PORTAL SIGNIN] saved token", localStorage.getItem("onspot_jwt_token"));
        console.log("[PORTAL SIGNIN] saved user", localStorage.getItem("onspot_user"));

        onOpenChange(false);
        resetModal();

        if (result.user.role === "talent") {
          window.location.href = "/get-hired";
        } else {
          window.location.href = "/dashboard";
        }
      } else {
        toast({
          title: "Sign In Failed",
          description: result.message || "Invalid email or password.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[PORTAL SIGNIN] error", err);
      toast({
        title: "Sign In Failed",
        description: err.response?.data?.message || "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Real sign-up: calls /api/signup, response includes JWT token, stores it, navigates
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpRole || !signUpFirstName || !signUpEmail || !signUpPassword) return;

    console.log("[CLIENT SIGNUP FLOW] handler reached", {
      email: signUpEmail,
      role: signUpRole,
      firstName: signUpFirstName,
    });
    setIsLoading(true);
    try {
      const signupData = {
        email: signUpEmail.trim(),
        username: signUpEmail.split("@")[0],
        password: signUpPassword,
        first_name: signUpFirstName.trim(),
        last_name: signUpLastName.trim(),
        role: signUpRole,
      };

      const signupResponse = await authAPI.signup(signupData);
      console.log("[CLIENT SIGNUP FLOW] signup response", signupResponse);

      if (signupResponse.success && signupResponse.token && signupResponse.user) {
        localStorage.setItem("onspot_jwt_token", signupResponse.token);
        localStorage.setItem("onspot_user", JSON.stringify(signupResponse.user));
        console.log("[CLIENT SIGNUP FLOW] saved token", localStorage.getItem("onspot_jwt_token"));
        console.log("[CLIENT SIGNUP FLOW] saved user", localStorage.getItem("onspot_user"));

        toast({
          title: "Account Created",
          description: `Welcome to OnSpot! Logging you in...`,
        });

        onOpenChange(false);
        resetModal();

        if (signUpRole === "talent") {
          window.location.href = "/get-hired";
        } else {
          window.location.href = "/dashboard";
        }
      } else {
        toast({
          title: "Signup Failed",
          description: signupResponse.message || "Failed to create account. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[CLIENT SIGNUP FLOW] error", err);
      toast({
        title: "Signup Failed",
        description: err.response?.data?.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
            <form onSubmit={handleSignIn} className="space-y-4 mt-1">
              <div className="space-y-1.5">
                <Label htmlFor="si-email">Email</Label>
                <Input
                  id="si-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-password">Password</Label>
                <div className="relative">
                  <Input
                    id="si-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
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
              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? "Signing in…" : <>Continue <ArrowRight className="w-4 h-4" /></>}
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
            <form onSubmit={handleSignUp} className="space-y-3 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="su-first">First Name</Label>
                  <Input
                    id="su-first"
                    placeholder="John"
                    value={signUpFirstName}
                    onChange={(e) => setSignUpFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-last">Last Name</Label>
                  <Input
                    id="su-last"
                    placeholder="Doe"
                    value={signUpLastName}
                    onChange={(e) => setSignUpLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">Email</Label>
                <Input
                  id="su-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-password">Password</Label>
                <div className="relative">
                  <Input
                    id="su-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
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
                disabled={!signUpRole || isLoading}
              >
                {isLoading ? "Creating account…" : <>Create Account <ArrowRight className="w-4 h-4" /></>}
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
