import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogIn, Eye, EyeOff, Mail, Shield, Zap, Building, User, Users, ArrowLeft, Briefcase, Lock, CheckCircle } from "lucide-react";
import { FaGoogle, FaLinkedin } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { usePortalLogin } from "@/hooks/usePortalLogin";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";

type UserType = "client" | "talent" | null;
type LoginStep = "user-type" | "login";

interface LoginDialogProps {
  /** Pass open+onOpenChange to control the dialog externally (e.g. from a page).
   *  Omit both to use the built-in "Log In" trigger button (TopNavigation usage). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LoginDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: LoginDialogProps = {}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) controlledOnOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [currentStep, setCurrentStep] = useState<LoginStep>("user-type");
  const [userType, setUserType] = useState<UserType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const retryUntil = useRef(0);
  const signInPending = useRef(false);
  const { signInToPortal } = usePortalLogin();
  const { toast } = useToast();

  const resetDialog = () => {
    setCurrentStep("user-type");
    setUserType(null);
    setEmail("");
    setPassword("");
    setRememberMe(false);
    setLoginError("");
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInPending.current || retryUntil.current > Date.now()) return;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const loginEmail = String(formData.get("email") ?? "");
    const loginPassword = String(formData.get("password") ?? "");

    if (!loginEmail.trim() || loginPassword.length === 0 || !userType) {
      const message = "Please enter both email and password.";
      setLoginError(message);
      toast({
        title: "Missing Information",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      const message = "Please enter a valid email address.";
      setLoginError(message);
      toast({
        title: "Invalid Email Format",
        description: message,
        variant: "destructive",
      });
      return;
    }

    signInPending.current = true;
    setEmail(loginEmail);
    setPassword(loginPassword);
    setLoginError("");
    setIsLoading(true);
    try {
      const result = await signInToPortal(userType, loginEmail, loginPassword);
      if (result.success) {
        const portalType = userType === "client" ? "Client Portal" : "Talent Portal";
        toast({
          title: "Login Successful",
          description: `Welcome to OnSpot ${portalType}!`,
        });
        setOpen(false);
        resetDialog();
      } else {
        const message = result.message || "Please check your email and password and try again.";
        setLoginError(message);
        if (result.rateLimited && result.retryAfter) {
          retryUntil.current = Date.now() + result.retryAfter * 1000;
          setRetrySeconds(result.retryAfter);
        }
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
      }
    } catch {
      const message = "Could not reach the server. Please try again.";
      setLoginError(message);
      toast({ title: "Network Error", description: message, variant: "destructive" });
    } finally {
      signInPending.current = false;
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Close dialog immediately to prevent UI issues during redirect
      setOpen(false);
      // Redirect to backend Google OAuth
      window.location.href = '/api/auth/google';
    } catch (error: any) {
      toast({
        title: "Google Sign-In Failed",
        description: "Unable to initiate Google sign-in. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleLinkedInLogin = async () => {
    setIsLoading(true);
    try {
      // Close dialog immediately to prevent UI issues during redirect
      setOpen(false);
      // Redirect to backend LinkedIn OAuth
      window.location.href = '/api/auth/linkedin';
    } catch (error: any) {
      toast({
        title: "LinkedIn Sign-In Failed",
        description: "Unable to initiate LinkedIn sign-in. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSelectUserType = (type: UserType) => {
    setUserType(type);
    setCurrentStep("login");
  };

  const handleBackToUserType = () => {
    if (signInPending.current) return;
    setCurrentStep("user-type");
    setUserType(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && signInPending.current) return;
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="w-40 md:w-48 h-11 text-white border-white/60 bg-black/20 font-medium hover:scale-[1.02] transition-transform"
            data-testid="button-login"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Log In
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={currentStep === "user-type" ? "sm:max-w-4xl" : "sm:max-w-md"}>
        <DialogHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <img 
              src={onspotLogo} 
              alt="OnSpot" 
              className="h-12 w-auto"
            />
          </div>
          
          {currentStep === "user-type" && (
            <>
              <DialogTitle className="text-2xl">Welcome Back to OnSpot</DialogTitle>
              <DialogDescription className="text-base">
                Choose your portal to continue
              </DialogDescription>
            </>
          )}
          
          {currentStep === "login" && (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  type="button"
                  onClick={handleBackToUserType}
                  disabled={signInPending.current}
                  className="p-1 h-auto"
                  data-testid="button-back-login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <DialogTitle className="text-2xl">
                    {userType === "client" ? "Client Portal" : "Talent Portal"}
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    {userType === "client"
                      ? "Access your client dashboard"
                      : "Access your talent dashboard"}
                  </DialogDescription>
                </div>
              </div>
            </>
          )}
        </DialogHeader>

        {currentStep === "user-type" && (
          <div className="space-y-4">
            {/* User Type Selection */}
            <div className="grid grid-cols-2 gap-6">
              <Card 
                className="relative cursor-pointer hover-elevate transition-all duration-300 group border-2 hover:border-primary/50"
                onClick={() => handleSelectUserType("client")}
                data-testid="card-client-login"
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Building className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Client Portal</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Access your hiring dashboard, manage projects, and track performance.
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div className="text-center">
                      <Shield className="h-5 w-5 mx-auto text-primary mb-1" />
                      70% Cost Savings
                    </div>
                    <div className="text-center">
                      <Zap className="h-5 w-5 mx-auto text-primary mb-1" />
                      8X Growth
                    </div>
                    <div className="text-center">
                      <Mail className="h-5 w-5 mx-auto text-primary mb-1" />
                      24/7 Support
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="relative cursor-pointer hover-elevate transition-all duration-300 group border-2 hover:border-[hsl(var(--gold-yellow)/0.5)]"
                onClick={() => handleSelectUserType("talent")}
                data-testid="card-talent-login"
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[hsl(var(--gold-yellow)/0.1)] rounded-full flex items-center justify-center group-hover:bg-[hsl(var(--gold-yellow)/0.2)] transition-colors">
                    <User className="w-8 h-8 text-[hsl(var(--gold-yellow)/0.8)]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Talent Portal</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Access opportunities, manage your profile, and track your career growth.
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div className="text-center">
                      <Briefcase className="h-5 w-5 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-1" />
                      Premium Jobs
                    </div>
                    <div className="text-center">
                      <Shield className="h-5 w-5 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-1" />
                      Secure Payments
                    </div>
                    <div className="text-center">
                      <User className="h-5 w-5 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-1" />
                      Career Growth
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </div>
        )}

        {currentStep === "login" && (
          <>
            {/* Trust & Security Messaging */}
            <div className="bg-muted/30 rounded-lg p-4 mb-6 border">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-foreground">Fast, secure login. Your data is safe.</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  We protect your information with enterprise-grade security
                </p>
              </div>
            </div>

            {/* Professional Social Login Options */}
            <div className="space-y-3 mb-6">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Join {userType === "client" ? "thousands of companies" : "50,000+ professionals"} on OnSpot
                </p>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-12 border-2 hover:border-primary/50 transition-all duration-200"
                data-testid="button-google-login"
              >
                <FaGoogle className="w-5 h-5 mr-3 text-red-500" />
                <span className="font-medium">
                  Continue with Google
                </span>
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleLinkedInLogin}
                disabled={isLoading}
                className="w-full h-12 border-2 hover:border-primary/50 transition-all duration-200"
                data-testid="button-linkedin-login"
              >
                <FaLinkedin className="w-5 h-5 mr-3 text-blue-600" />
                <span className="font-medium">
                  Continue with LinkedIn
                </span>
              </Button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Benefits for selected user type */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y">
              {userType === "client" ? (
                <>
                  <div className="text-center">
                    <Zap className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">8X Growth</p>
                  </div>
                  <div className="text-center">
                    <Shield className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">70% Cost Savings</p>
                  </div>
                  <div className="text-center">
                    <Mail className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">24/7 Support</p>
                  </div>
                </>
              ) : userType === "talent" ? (
                <>
                  <div className="text-center">
                    <Briefcase className="h-6 w-6 mx-auto text-[hsl(var(--premium-gold))] mb-2" />
                    <p className="text-xs text-muted-foreground">Premium Jobs</p>
                  </div>
                  <div className="text-center">
                    <Shield className="h-6 w-6 mx-auto text-[hsl(var(--premium-gold))] mb-2" />
                    <p className="text-xs text-muted-foreground">Secure Payments</p>
                  </div>
                  <div className="text-center">
                    <User className="h-6 w-6 mx-auto text-[hsl(var(--premium-gold))] mb-2" />
                    <p className="text-xs text-muted-foreground">Career Growth</p>
                  </div>
                </>
              ) : null}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                data-testid="input-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                data-testid="checkbox-remember-me"
              />
              <Label htmlFor="remember" className="text-sm">Remember me</Label>
            </div>
            <Button type="button" variant="ghost" className="p-0 h-auto text-sm hover:bg-transparent">
              Forgot password?
            </Button>
          </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={isLoading || retrySeconds > 0} className="w-full" data-testid="button-submit-login">
                  {isLoading ? "Signing in..." : retrySeconds > 0 ? `Try again in ${retrySeconds}s` :
                    userType === "client" ? "Access Client Portal" : "Access Talent Portal"
                  }
                </Button>
                <Button type="button" variant="outline" onClick={handleBackToUserType} disabled={isLoading}>
                  Back to Options
                </Button>
              </div>
            </form>

            {loginError && (
              <div role="alert" aria-live="assertive" data-testid="login-dialog-error"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loginError}
              </div>
            )}

            <Separator className="my-4" />

            {/* Additional Options */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">New to OnSpot?</p>
              <Button variant="ghost" className="p-0 h-auto text-sm font-medium hover:bg-transparent">
                Contact us for a demo
              </Button>
            </div>
            {/* Security & Privacy Assurance */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Enterprise-Grade Security</h4>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <CheckCircle className="w-3 h-3" />
                      <span>256-bit SSL encryption</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <CheckCircle className="w-3 h-3" />
                      <span>GDPR & SOC 2 compliant</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <CheckCircle className="w-3 h-3" />
                      <span>Zero data sharing with third parties</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Demo: Use any email and password to log in</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}