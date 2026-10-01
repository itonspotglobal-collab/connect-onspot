import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Eye, EyeOff, Mail, Shield, Zap, Building, User, ArrowLeft, ArrowRight, Briefcase, Loader2 } from "lucide-react";
import { FaGoogle, FaLinkedin } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { isFirebaseAvailable } from "@/lib/firebase";
import { authAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from "@shared/passwordPolicy";
import { signupRetryDelayMs } from "@/lib/signupRetry";
import { saveTalentAuth } from "@/components/TalentLoginModal";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";
import "./SignUpDialog.css";

type UserType = "client" | "talent" | null;
type SignupStep = "user-type" | "signup";

interface SignUpDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onSignInInstead?: () => void;
  returnTo?: string;
  /** Pre-select user type and skip straight to the signup form. */
  defaultUserType?: UserType;
  /** Pre-fill the email field. */
  defaultEmail?: string;
  /** Used by route-based signup pages to return to the account-type chooser. */
  onChooseAnotherAccountType?: () => void;
  /** Render the existing signup form as a full route instead of a dark modal. */
  standalone?: boolean;
}

export function SignUpDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
  onSignInInstead,
  returnTo,
  defaultUserType,
  defaultEmail,
  onChooseAnotherAccountType,
  standalone = false,
}: SignUpDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internalOpen;

  function setOpen(value: boolean) {
    if (!isControlled) setInternalOpen(value);
    onOpenChangeProp?.(value);
  }
  const [currentStep, setCurrentStep] = useState<SignupStep>(defaultUserType ? "signup" : "user-type");
  const [userType, setUserType] = useState<UserType>(defaultUserType ?? null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: defaultEmail ?? "",
    password: "",
    confirmPassword: "",
    company: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<{ title: string; message: string } | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const submissionInFlight = useRef(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  useAuth(); // Keep context available for potential future use

  useEffect(() => {
    if (!retryAt) {
      setRetrySeconds(0);
      return;
    }
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setRetrySeconds(remaining);
      if (!remaining) setRetryAt(0);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    document.addEventListener("visibilitychange", updateRemaining);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateRemaining);
    };
  }, [retryAt]);

  const showSignupError = (title: string, message: string) => {
    // Keep failures inside the sticky footer. A transient toast can be hidden
    // by the signup dialog or missed while a phone keyboard is open.
    setSubmitError({ title, message });
  };

  const resetDialog = () => {
    setCurrentStep(defaultUserType ? "signup" : "user-type");
    setUserType(defaultUserType ?? null);
    setFormData({
      firstName: "",
      lastName: "",
      email: defaultEmail ?? "",
      password: "",
      confirmPassword: "",
      company: "",
    });
    setAgreeToTerms(false);
    setShowPassword(false);
    setSubmitError(null);
    setAccountCreated(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlight.current || retryAt > Date.now() || accountCreated) return;
    setSubmitError(null);

    // Safari/password managers can populate an input without updating React
    // state. Submit the actual form controls, not a potentially stale snapshot.
    const fields = new FormData(e.currentTarget as HTMLFormElement);
    const values = {
      firstName: String(fields.get("firstName") ?? "").trim(),
      lastName: String(fields.get("lastName") ?? "").trim(),
      email: String(fields.get("email") ?? "").trim(),
      password: String(fields.get("password") ?? ""),
      confirmPassword: String(fields.get("confirmPassword") ?? ""),
      company: String(fields.get("company") ?? "").trim(),
    };
    setFormData(values);

    if (!values.firstName || !values.lastName || !values.email || !values.password) {
      showSignupError("Missing information", "Please fill in all required fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      showSignupError("Check your email", "Please enter a valid email address, such as name@example.com.");
      return;
    }

    if (userType === "client" && !values.company) {
      showSignupError("Company required", "Company name is required for client accounts.");
      return;
    }

    if (values.password !== values.confirmPassword) {
      showSignupError("Passwords do not match", "Please enter the same password in both password fields.");
      return;
    }

    const passwordValidation = validatePasswordStrength(values.password);
    if (!passwordValidation.isValid) {
      showSignupError("Check your password", passwordValidation.errors.join(". "));
      return;
    }

    if (!agreeToTerms) {
      showSignupError("Terms required", "Please agree to the terms and conditions to continue.");
      return;
    }

    if (!userType) {
      showSignupError("Choose an account type", "Please select Client or Talent to continue.");
      return;
    }

    submissionInFlight.current = true;
    setIsLoading(true);
    let created = false;
    try {
      const signupData = {
        email: values.email,
        username: values.email.split("@")[0],
        password: values.password,
        first_name: values.firstName,
        last_name: values.lastName,
        role: userType,
        ...(userType === "client" && { company: values.company }),
      };

      const signupResponse = await authAPI.signup(signupData);
      if (signupResponse?.accountCreated || signupResponse?.success) {
        created = true;
        setAccountCreated(true);
      }

      if (signupResponse?.success) {
        const accountType = userType === "client" ? "Client" : "Talent";

        const hasTalentSession = userType !== "talent"
          || Boolean(signupResponse.talentToken && signupResponse.candidateId);
        if (signupResponse.token && signupResponse.user && hasTalentSession) {
          localStorage.setItem("onspot_jwt_token", signupResponse.token);
          localStorage.setItem("onspot_user", JSON.stringify(signupResponse.user));
          if (userType === "talent" && signupResponse.talentToken && signupResponse.candidateId) {
            saveTalentAuth({
              token: signupResponse.talentToken,
              candidateId: signupResponse.candidateId,
              email: values.email,
              fullName: `${values.firstName} ${values.lastName}`,
            });
          }

          toast({ title: "Logged In Successfully", description: `Welcome to your OnSpot ${accountType.toLowerCase()} portal!` });

          setOpen(false);
          resetDialog();

          if (userType === "talent") {
            window.location.href = "/get-hired";
          } else {
            window.location.href = returnTo || "/hire-talent";
          }
        } else {
          showSignupError("Account created", "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.");
        }
      } else if (created) {
        showSignupError("Account created", "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.");
      } else {
        showSignupError("Account creation failed", signupResponse?.message || "Failed to create account. Please try again.");
      }
    } catch (error: any) {
      const status = error.response?.status;
      const body = error.response?.data;
      const serverMessage = typeof body?.message === "string" ? body.message
        : typeof body?.error === "string" ? body.error
        : typeof body === "string" ? body : "";
      if (created || error.accountCreated || error.response?.accountCreated || body?.accountCreated
        || status === 201 || error.status === 201) {
        created = true;
        setAccountCreated(true);
        showSignupError("Account created", "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.");
      } else if (status === 429) {
        const now = Date.now();
        const delayMs = signupRetryDelayMs(error.response?.headers?.["retry-after"] ?? body?.retryAfter, now);
        setRetrySeconds(Math.ceil(delayMs / 1000));
        setRetryAt(now + delayMs);
        showSignupError("Please wait before trying again", serverMessage || "Too many signup attempts. Please wait for the timer below, then try again.");
      } else if (!error.response) {
        showSignupError("Connection problem", "Unable to connect to the server. Your details are still here. Please check your connection and try again.");
      } else if (status === 400) {
        showSignupError("Check your details", serverMessage || "Invalid signup information provided.");
      } else if (status === 409) {
        showSignupError("Account already exists", "An account with this email or username already exists. Please sign in instead, or use a different email address.");
      } else if (status >= 500) {
        showSignupError("Server error", "Our servers are experiencing issues. Your details are still here; please try again in a few moments.");
      } else {
        showSignupError("Signup failed", serverMessage || "An unexpected error occurred during signup. Please try again.");
      }
    } finally {
      submissionInFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      setOpen(false);
      window.location.href = "/api/auth/google";
    } catch (error: any) {
      toast({ title: "Google Sign-Up Failed", description: "Unable to initiate Google sign-up. Please try again.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleLinkedInSignup = async () => {
    setIsLoading(true);
    try {
      setOpen(false);
      window.location.href = "/api/auth/linkedin";
    } catch (error: any) {
      toast({ title: "LinkedIn Sign-Up Failed", description: "Unable to initiate LinkedIn sign-up. Please try again.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSelectUserType = (type: UserType) => {
    setUserType(type);
    setCurrentStep("signup");
  };

  const handleBackToUserType = () => {
    if (submissionInFlight.current || accountCreated) return;
    if (onChooseAnotherAccountType) {
      onChooseAnotherAccountType();
      return;
    }
    setCurrentStep("user-type");
    setUserType(null);
  };

  // Shared dark input style
  const darkInput = "bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-[#3A3AF8] focus-visible:border-[#3A3AF8] h-10";
  const darkLabel = "text-white/80 text-sm font-medium";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && submissionInFlight.current) return;
        setOpen(isOpen);
        if (!isOpen) resetDialog();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="default"
            className="w-40 md:w-48 h-11 bg-white text-[#474ead] border-0 font-semibold shadow-lg hover:scale-[1.02] transition-transform"
            data-testid="button-signup"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Sign Up
          </Button>
        </DialogTrigger>
      )}

      {/* p-0 + bg-transparent lets our inner div own all the styling */}
      <DialogContent
        className={[
          "p-0 border-0 bg-transparent shadow-none overflow-visible",
          !standalone && "[&>button:last-of-type]:text-white/50 [&>button:last-of-type:hover]:text-white/90 [&>button:last-of-type]:transition-colors [&>button:last-of-type]:z-10",
          currentStep === "user-type"
            ? "w-[min(680px,calc(100vw-1.5rem))] max-w-none sm:max-w-none"
            : "w-[min(520px,calc(100vw-1.5rem))] max-w-none sm:max-w-none",
        ].filter(Boolean).join(" ")}
        overlayClassName={standalone
          ? "bg-[linear-gradient(135deg,#FCFDFF_0%,#F6F8FF_20%,#EEF4FF_45%,#E7F0FF_70%,#F8F9FF_100%)]"
          : undefined}
        hideClose={standalone}
      >
        {/* Dark card — flex column with capped height + internal scroll */}
        <div
          className="flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100dvh-9rem)] rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0f0f3c 0%, #1a1a4e 40%, #1e1e55 70%, #1a1a4e 100%)",
            border: "1px solid rgba(91,124,255,0.2)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,124,255,0.1)",
          }}
        >
          {/* ── Sticky header (never scrolls away) ── */}
          <div className="shrink-0 px-6 pt-5 pb-3 pr-12 text-center">
            <div className="flex justify-center mb-2.5">
              <img src={onspotLogo} alt="OnSpot" className="h-8 w-auto" />
            </div>

            {currentStep === "user-type" && (
              <>
                <DialogTitle className="text-xl font-light text-white" style={{ letterSpacing: "-0.02em" }}>
                  Join OnSpot
                </DialogTitle>
                <DialogDescription className="text-white/50 text-sm mt-0.5">
                  Choose how you&apos;d like to get started
                </DialogDescription>
              </>
            )}

            {currentStep === "signup" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={handleBackToUserType}
                  disabled={isLoading || accountCreated}
                  aria-label="Back to account type selection"
                  className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/50 hover:text-white/90 text-sm transition-colors"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <DialogTitle className="text-xl font-light text-white" style={{ letterSpacing: "-0.02em" }}>
                  {userType === "client" ? "Hire Talent" : "Find Work"}
                </DialogTitle>
                <DialogDescription className="text-white/50 text-sm mt-0.5">
                  {userType === "client"
                    ? "Create your client account to start hiring"
                    : "Create your talent profile to find opportunities"}
                </DialogDescription>
              </div>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-4">

            {/* ── Role selection step ── */}
            {currentStep === "user-type" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Client card */}
                <button
                  type="button"
                  onClick={() => handleSelectUserType("client")}
                  className="relative flex flex-col items-center gap-2.5 rounded-xl p-4 text-center transition-all duration-200 border border-white/15 bg-white/5 hover:bg-[#3A3AF8]/20 hover:border-[#5B7CFF]/60 group"
                  data-testid="card-client-signup"
                >
                  <div className="w-11 h-11 rounded-full bg-[#3A3AF8]/15 flex items-center justify-center group-hover:bg-[#3A3AF8]/30 transition-colors">
                    <Building className="w-5 h-5 text-[#5B7CFF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">I&apos;m a client hiring for talent</h3>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Build your team with vetted professionals. Scale faster and reduce costs.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/35">
                    <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-[#5B7CFF]" />70% Savings</span>
                    <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-[#5B7CFF]" />8X Growth</span>
                  </div>
                </button>

                {/* Talent card */}
                <button
                  type="button"
                  onClick={() => handleSelectUserType("talent")}
                  className="relative flex flex-col items-center gap-2.5 rounded-xl p-4 text-center transition-all duration-200 border border-white/15 bg-white/5 hover:bg-yellow-400/10 hover:border-yellow-400/50 group"
                  data-testid="card-talent-signup"
                >
                  <div className="w-11 h-11 rounded-full bg-yellow-400/10 flex items-center justify-center group-hover:bg-yellow-400/20 transition-colors">
                    <User className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">I&apos;m a talent looking for work</h3>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Join our elite network. Access premium opportunities and competitive rates.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/35">
                    <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-yellow-400" />Premium Jobs</span>
                    <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-yellow-400" />Secure Pay</span>
                  </div>
                </button>
              </div>
            )}

            {/* ── Signup form step ── */}
            {currentStep === "signup" && (
              <>
                {/* Social signup buttons */}
                <div className="space-y-2 mb-3">
                  {isFirebaseAvailable() && (
                    <button
                      type="button"
                      onClick={handleGoogleSignup}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-3 h-10 rounded-xl border border-white/20 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid="button-google-signup"
                    >
                      <FaGoogle className="w-4 h-4 text-red-400" />
                      Sign up with Google
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLinkedInSignup}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 h-10 rounded-xl border border-white/20 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="button-linkedin-signup"
                  >
                    <FaLinkedin className="w-4 h-4 text-blue-400" />
                    Sign up with LinkedIn
                  </button>
                </div>

                {/* Divider */}
                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span
                      className="px-3 text-xs uppercase tracking-wider text-white/30"
                      style={{ background: "#1a1a4e" }}
                    >
                      Or create account with email
                    </span>
                  </div>
                </div>

                {/* Email form — id lets the sticky footer button submit it */}
                <form id="signup-form" onSubmit={handleSubmit} noValidate className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="firstName" className={darkLabel}>First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="First name"
                        autoComplete="given-name"
                        data-testid="input-first-name"
                        className={darkInput}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lastName" className={darkLabel}>Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Last name"
                        autoComplete="family-name"
                        data-testid="input-last-name"
                        className={darkInput}
                      />
                    </div>
                  </div>

                  {userType === "client" && (
                    <div className="space-y-1">
                      <Label htmlFor="company" className={darkLabel}>Company Name</Label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Your company name"
                        autoComplete="organization"
                        data-testid="input-company"
                        className={darkInput}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="email" className={darkLabel}>Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      autoComplete="email"
                      data-testid="input-signup-email"
                      className={darkInput}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="password" className={darkLabel}>Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="8–128 characters"
                        autoComplete="new-password"
                        aria-describedby="signup-password-hint"
                        data-testid="input-signup-password"
                        className={`${darkInput} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p id="signup-password-hint" className="text-xs leading-relaxed text-white/60">
                      {PASSWORD_POLICY_HINT}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirmPassword" className={darkLabel}>Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      data-testid="input-confirm-password"
                      className={darkInput}
                    />
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-red-400 text-xs">Passwords do not match.</p>
                    )}
                  </div>

                  {/* Terms */}
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="terms"
                      checked={agreeToTerms}
                      onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                      data-testid="checkbox-terms"
                      className="mt-0.5 border-white/30 data-[state=checked]:bg-[#3A3AF8] data-[state=checked]:border-[#3A3AF8]"
                    />
                    <Label htmlFor="terms" className="text-xs text-white/45 leading-relaxed cursor-pointer">
                      I agree to the{" "}
                      <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-white/65 underline hover:text-white transition-colors">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-white/65 underline hover:text-white transition-colors">
                        Privacy Policy
                      </a>
                    </Label>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* ── Sticky footer — CTA always visible, never scrolls away ── */}
          {currentStep === "signup" && (
            <div
              className="shrink-0 px-6 py-4 border-t border-white/10"
              style={{ background: "linear-gradient(to bottom, transparent, #1a1a4e 20%)" }}
            >
              {submitError && (
                <div
                  role="alert"
                  data-testid="signup-error"
                  className="mb-3 rounded-lg border border-red-300/40 bg-red-400/10 px-3 py-2 text-sm leading-snug text-red-100"
                >
                  <p className="font-semibold">{submitError.title}</p>
                  <p className="mt-1">{submitError.message}</p>
                </div>
              )}
              {/* Primary CTA — references the form by id */}
              <button
                type="submit"
                form="signup-form"
                disabled={isLoading || retrySeconds > 0 || accountCreated}
                data-testid="button-submit-signup"
                className="w-full px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)",
                  boxShadow: "0 8px 30px rgba(58,58,248,0.35)",
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating Account…
                  </>
                ) : accountCreated ? (
                  <span>Account created — sign in below</span>
                ) : retrySeconds > 0 ? (
                  <span>Try again in {Math.floor(retrySeconds / 60)}:{String(retrySeconds % 60).padStart(2, "0")}</span>
                ) : (
                  <>
                    <span>{userType === "client" ? "Create Client Account" : "Create Talent Profile"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Secondary: back + sign-in */}
              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={handleBackToUserType}
                  disabled={isLoading || accountCreated}
                  className="text-xs text-white/35 hover:text-white/65 transition-colors"
                >
                  ← Back to options
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setOpen(false);
                    resetDialog();
                    onSignInInstead?.();
                  }}
                  data-testid="button-signin-instead"
                  className="text-xs text-white/55 hover:text-white underline transition-colors"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
