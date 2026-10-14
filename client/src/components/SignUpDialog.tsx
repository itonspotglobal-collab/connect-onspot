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
import { UserPlus, Eye, EyeOff, Mail, Building, User, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { FaGoogle, FaLinkedin } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { isFirebaseAvailable } from "@/lib/firebase";
import { authAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from "@shared/passwordPolicy";
import { signupRetryDelayMs } from "@/lib/signupRetry";
import { saveTalentAuth } from "@/components/TalentLoginModal";
import { SignupEmailVerification } from "@/components/SignupEmailVerification";
import { SignupPendingState, isSignupPending, signupStatus } from "@/lib/signupVerification";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";
import "./SignUpDialog.css";
import { getSafeReturnTo } from "@shared/internalRedirect";
import { AuthBackButton } from "@/components/AuthBackButton";
import { authPortalHref } from "@/lib/authBackNavigation";

type UserType = "client" | "talent" | null;
type SignupStep = "user-type" | "signup";

interface SignUpDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onSignInInstead?: (portal?: "client" | "talent") => void;
  returnTo?: string;
  /** Pre-select user type and skip straight to the signup form. */
  defaultUserType?: UserType;
  /** Pre-fill the email field. */
  defaultEmail?: string;
  /** Used by route-based signup pages to return to the account-type chooser. */
  onChooseAnotherAccountType?: () => void;
  /** Render the existing signup form as a full route instead of a dark modal. */
  standalone?: boolean;
  /** Keep the polished routed form over its still-mounted originating page. */
  modalOverlay?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
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
  modalOverlay = false,
  onCloseAutoFocus,
}: SignUpDialogProps = {}) {
  const authSearch = useSearch();
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
  const [pendingVerification, setPendingVerification] = useState<SignupPendingState | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const submissionInFlight = useRef(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  useAuth(); // Keep context available for potential future use

  useEffect(() => {
    if (!open) return;
    let active = true;
    void signupStatus().then((pending) => {
      if (active && pending) {
        setPendingVerification(pending);
        setUserType(pending.role);
        setCurrentStep("signup");
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [open]);

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
    setPendingVerification(null);
  };

  const completeVerifiedSignup = async (signupResponse: any) => {
    const accountType = pendingVerification?.role ?? userType;
    if (!accountType) {
      showSignupError("Verification complete", "Your account is active. Please use the sign-in link to continue.");
      setAccountCreated(true);
      return;
    }
    const safeReturnTo = getSafeReturnTo(signupResponse.returnTo) ??
      getSafeReturnTo(returnTo) ??
      (accountType === "talent" ? "/get-hired" : "/hire-talent");
    const hasTalentSession = accountType !== "talent"
      || Boolean(signupResponse.talentToken && signupResponse.candidateId);
    if (signupResponse.token && signupResponse.user && hasTalentSession) {
      localStorage.setItem("onspot_jwt_token", signupResponse.token);
      localStorage.setItem("onspot_user", JSON.stringify(signupResponse.user));
      if (accountType === "talent" && signupResponse.talentToken && signupResponse.candidateId) {
        saveTalentAuth({
          token: signupResponse.talentToken,
          candidateId: signupResponse.candidateId,
          email: signupResponse.user.email ?? formData.email,
          fullName: `${signupResponse.user.first_name ?? formData.firstName} ${signupResponse.user.last_name ?? formData.lastName}`.trim(),
        });
      }
      toast({ title: signupResponse.accountCreated === true ? "Account created" : "Account verified", description: `Welcome to your OnSpot ${accountType} portal.` });
      setOpen(false);
      resetDialog();
      window.location.replace(safeReturnTo);
    } else {
      setAccountCreated(true);
      showSignupError("Account created", "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.");
    }
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
    try {
      const signupData = {
        returnTo: getSafeReturnTo(returnTo) ?? undefined,
        email: values.email,
        username: values.email.split("@")[0],
        password: values.password,
        first_name: values.firstName,
        last_name: values.lastName,
        role: userType,
        ...(userType === "client" && { company: values.company }),
        ...(getSafeReturnTo(returnTo) ? { returnTo: getSafeReturnTo(returnTo)! } : {}),
      };

      const signupResponse = await authAPI.signup(signupData);
      if (isSignupPending(signupResponse)) {
        setPendingVerification(signupResponse);
        setAccountCreated(false);
        return;
      }
      if (signupResponse.httpStatus === 201) {
        setAccountCreated(true);
        try {
          await completeVerifiedSignup(signupResponse);
        } catch {
          showSignupError("Account created", "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.");
        }
        return;
      }
      showSignupError(
        "Verification required",
        "Signup did not return a pending email-verification challenge. No credentials were saved. Please try again.",
      );
    } catch (error: any) {
      const status = error.response?.status;
      const body = error.response?.data;
      if (isSignupPending(body)) {
        setPendingVerification(body);
        setAccountCreated(false);
        return;
      }
      const serverMessage = typeof body?.message === "string" ? body.message
        : typeof body?.error === "string" ? body.error
        : typeof body === "string" ? body : "";
      if (status === 429) {
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
  const darkInput = "signup-field bg-white/10 border-white/25 text-white placeholder:text-white/55 focus-visible:ring-[#8294FF] focus-visible:border-[#8294FF] h-11";
  const darkLabel = "text-white/90 text-sm font-semibold";

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
        data-signup-modal-overlay={modalOverlay || undefined}
        className={[
          "p-0 border-0 bg-transparent shadow-none overflow-visible motion-reduce:animate-none",
          !standalone && "[&>button:last-of-type]:text-white/50 [&>button:last-of-type:hover]:text-white/90 [&>button:last-of-type]:transition-colors [&>button:last-of-type]:z-10",
          currentStep === "user-type"
            ? "w-[min(680px,calc(100vw-1.5rem))] max-w-none sm:max-w-none"
            : "w-[min(520px,calc(100vw-1.5rem))] max-w-none sm:max-w-none",
        ].filter(Boolean).join(" ")}
        overlayClassName={modalOverlay ? "bg-black/45 backdrop-blur-[4px] z-[10000]" : standalone
          ? "bg-[linear-gradient(135deg,#FCFDFF_0%,#F6F8FF_20%,#EEF4FF_45%,#E7F0FF_70%,#F8F9FF_100%)]"
          : undefined}
        containerClassName={modalOverlay ? "z-[10000]" : undefined}
        closeClassName={modalOverlay
          ? "flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white opacity-100 hover:bg-white/10 focus:ring-white/70 data-[state=open]:bg-white/10 data-[state=open]:text-white"
          : undefined}
        hideClose={standalone && !modalOverlay}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {/* Dark card — flex column with capped height + internal scroll */}
        <div
          className="signup-card flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100dvh-9rem)] rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0f0f3c 0%, #1a1a4e 40%, #1e1e55 70%, #1a1a4e 100%)",
            border: "1px solid rgba(91,124,255,0.2)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,124,255,0.1)",
          }}
        >
          {/* ── Sticky header (never scrolls away) ── */}
          <div className="signup-header shrink-0 px-5 sm:px-6 pt-4 sm:pt-5 pb-3 pr-12 text-center">
            {standalone && currentStep === "signup" && (
              <div className="mb-4 flex justify-start">
                <AuthBackButton
                  href={authPortalHref("signup", authSearch)}
                  variant="dark"
                  disabled={isLoading || accountCreated}
                  testId="auth-back-to-portal"
                  onClick={modalOverlay ? event => {
                    event.preventDefault();
                    handleBackToUserType();
                  } : undefined}
                />
              </div>
            )}
            <div className="flex justify-center mb-2.5">
              <img src={onspotLogo} alt="OnSpot" className="h-8 w-auto" />
            </div>

            {currentStep === "user-type" && (
              <>
                <DialogTitle className="text-2xl font-semibold leading-tight text-white" style={{ letterSpacing: "-0.02em" }}>
                  Get started with OnSpot
                </DialogTitle>
                <DialogDescription className="text-white/75 text-sm leading-relaxed mt-2">
                  Choose how you&apos;d like to join OnSpot.
                </DialogDescription>
              </>
            )}

            {currentStep === "signup" && (
              <div className="relative">
                {!standalone && <button
                  type="button"
                  onClick={handleBackToUserType}
                  disabled={isLoading || accountCreated}
                  aria-label="Back to account type selection"
                  className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/50 hover:text-white/90 text-sm transition-colors"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>}
                <DialogTitle className="text-2xl font-semibold leading-tight text-white" style={{ letterSpacing: "-0.02em" }}>
                  {userType === "client" ? "Hire Talent" : "Find Work"}
                </DialogTitle>
                <DialogDescription className="text-white/75 text-sm leading-relaxed mt-2">
                  {userType === "client"
                    ? "Create your account and start building your remote team."
                    : "Create your profile and connect with global opportunities."}
                </DialogDescription>
              </div>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div className="signup-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-4">

            {/* ── Role selection step ── */}
            {currentStep === "user-type" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Client card */}
                <button
                  type="button"
                  onClick={() => handleSelectUserType("client")}
                  className="signup-role-card relative flex flex-col items-center gap-2.5 rounded-xl p-5 text-center transition-all duration-200 border border-white/20 bg-white/5 hover:bg-[#3A3AF8]/20 hover:border-[#8294FF]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BAAFF] group"
                  data-testid="card-client-signup"
                >
                  <div className="w-11 h-11 rounded-full bg-[#3A3AF8]/15 flex items-center justify-center group-hover:bg-[#3A3AF8]/30 transition-colors">
                    <Building className="w-5 h-5 text-[#5B7CFF]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">I&apos;m Hiring</h3>
                    <p className="text-white/75 text-sm leading-relaxed">
                      Find and manage vetted global talent for your business.
                    </p>
                  </div>
                  <span className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#B9C4FF]">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </span>
                </button>

                {/* Talent card */}
                <button
                  type="button"
                  onClick={() => handleSelectUserType("talent")}
                  className="signup-role-card relative flex flex-col items-center gap-2.5 rounded-xl p-5 text-center transition-all duration-200 border border-white/20 bg-white/5 hover:bg-yellow-400/10 hover:border-yellow-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 group"
                  data-testid="card-talent-signup"
                >
                  <div className="w-11 h-11 rounded-full bg-yellow-400/10 flex items-center justify-center group-hover:bg-yellow-400/20 transition-colors">
                    <User className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">I&apos;m Looking for Work</h3>
                    <p className="text-white/75 text-sm leading-relaxed">
                      Discover global opportunities and grow your career.
                    </p>
                  </div>
                  <span className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-yellow-200">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            )}

            {/* ── Signup form step ── */}
            {currentStep === "signup" && (
              <>
                {pendingVerification ? (
                  <SignupEmailVerification
                    pending={pendingVerification}
                    dark
                    onVerified={completeVerifiedSignup}
                    onChangeEmail={() => {
                      setPendingVerification(null);
                      setAccountCreated(false);
                      setSubmitError(null);
                    }}
                  />
                ) : <>
                {/* Social signup buttons */}
                <div className="space-y-2 mb-3">
                  {isFirebaseAvailable() && (
                    <button
                      type="button"
                      onClick={handleGoogleSignup}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-white/20 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
                    className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-white/20 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className="px-3 text-xs uppercase tracking-wider text-white/65"
                      style={{ background: "#1a1a4e" }}
                    >
                      Or create account with email
                    </span>
                  </div>
                </div>

                {/* Email form — id lets the sticky footer button submit it */}
                <form id="signup-form" onSubmit={handleSubmit} noValidate className="signup-form space-y-3">
                  <div className="signup-name-fields grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className={darkLabel}>First Name <span className="signup-required">Required</span></Label>
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
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className={darkLabel}>Last Name <span className="signup-required">Required</span></Label>
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
                    <div className="space-y-1.5">
                      <Label htmlFor="company" className={darkLabel}>Company Name <span className="signup-required">Required</span></Label>
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

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className={darkLabel}>Email <span className="signup-required">Required</span></Label>
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

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className={darkLabel}>Password <span className="signup-required">Required</span></Label>
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
                        className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-white/65 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9C4FF]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p id="signup-password-hint" className="signup-password-hint text-xs leading-relaxed text-white/80">
                      {PASSWORD_POLICY_HINT}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className={darkLabel}>Confirm Password <span className="signup-required">Required</span></Label>
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
                    <Label htmlFor="terms" className="text-sm text-white/80 leading-relaxed cursor-pointer">
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
                </>}
              </>
            )}
          </div>

          {/* ── Sticky footer — CTA always visible, never scrolls away ── */}
          {currentStep === "signup" && !pendingVerification && (
            <div
              className="signup-footer shrink-0 px-5 sm:px-6 py-4 border-t border-white/15"
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
                className="signup-submit w-full min-h-12 px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9C4FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a4e] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
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
                  className="text-xs text-white/75 hover:text-white transition-colors"
                >
                  {standalone ? "Back to Portal" : "← Back to options"}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setOpen(false);
                    resetDialog();
                    onSignInInstead?.(userType ?? undefined);
                  }}
                  data-testid="button-signin-instead"
                  className="text-xs text-white/80 hover:text-white underline transition-colors"
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
