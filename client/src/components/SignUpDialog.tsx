import { useState } from "react";
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
import { UserPlus, Eye, EyeOff, Mail, Shield, Zap, Building, User, ArrowLeft, ArrowRight, Briefcase, Loader2 } from "lucide-react";
import { FaGoogle, FaLinkedin } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { isFirebaseAvailable } from "@/lib/firebase";
import { authAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

type UserType = "client" | "talent" | null;
type SignupStep = "user-type" | "signup";

interface SignUpDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onSignInInstead?: () => void;
}

export function SignUpDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
  onSignInInstead,
}: SignUpDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internalOpen;

  function setOpen(value: boolean) {
    if (!isControlled) setInternalOpen(value);
    onOpenChangeProp?.(value);
  }
  const [currentStep, setCurrentStep] = useState<SignupStep>("user-type");
  const [userType, setUserType] = useState<UserType>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    company: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  useAuth(); // Keep context available for potential future use

  const resetDialog = () => {
    setCurrentStep("user-type");
    setUserType(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      company: "",
    });
    setAgreeToTerms(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic required field validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (userType === "client" && !formData.company) {
      toast({
        title: "Company Required",
        description: "Company name is required for client accounts",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please check and try again.",
        variant: "destructive",
      });
      return;
    }

    // Frontend password validation
    if (formData.password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    if (!agreeToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions to continue",
        variant: "destructive",
      });
      return;
    }

    // Ensure userType is not null before proceeding
    if (!userType) {
      toast({
        title: "Account Type Required",
        description: "Please select an account type (Client or Talent) to continue",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Call the real signup API with correct snake_case field names as required by backend
      const signupData = {
        email: formData.email.trim(),
        username: formData.email.split('@')[0], // Generate username from email
        password: formData.password,
        first_name: formData.firstName.trim(),   // snake_case as required by backend API
        last_name: formData.lastName.trim(),     // snake_case as required by backend API
        role: userType, // Now TypeScript knows this is "client" | "talent"
        ...(userType === "client" && { company: formData.company.trim() })
      };

      console.log('🚀 Sending signup request with data:', {
        ...signupData,
        password: '[REDACTED]' // Don't log password
      });

      // Step 1: First call signup API using authAPI for proper URL configuration
      console.log('🚀 Step 1: Calling signup API...');
      const signupResponse = await authAPI.signup(signupData);
      
      if (signupResponse.success) {
        const accountType = userType === "client" ? "Client" : "Talent";
        console.log('✅ Step 1 complete: Signup successful', signupResponse);
        
        toast({
          title: `Welcome to OnSpot!`,
          description: `Your ${accountType.toLowerCase()} account has been created successfully! Logging you in...`,
        });
        
        // Step 2: The signup response now includes a JWT token directly.
        // Store it the same way authAPI.login() does, then navigate.
        // Full-page reload lets AuthContext re-initialize from localStorage
        // cleanly — no React state race conditions with any ProtectedRoute.
        if (signupResponse.token && signupResponse.user) {
          console.log('✅ Step 2: Token received from signup, storing...');
          localStorage.setItem("onspot_jwt_token", signupResponse.token);
          localStorage.setItem("onspot_user", JSON.stringify(signupResponse.user));

          toast({
            title: "Logged In Successfully",
            description: `Welcome to your OnSpot ${accountType.toLowerCase()} portal!`,
          });

          setOpen(false);
          resetDialog();

          // Client → public client profile page (no auth guard, loads immediately)
          // Talent → /get-hired (public route, renders TalentPortal when authenticated)
          if (userType === "talent") {
            window.location.href = "/get-hired";
          } else {
            window.location.href = "/client-profile";
          }
        } else {
          console.error('❌ Step 2 failed: Signup response missing token', signupResponse);
          toast({
            title: "Auto-Login Failed",
            description: "Account created successfully. Please log in manually to continue.",
            variant: "destructive",
          });
        }
      } else {
        // Show specific error message from backend
        const errorMessage = signupResponse.message || "Failed to create account. Please try again.";
        console.error('❌ Step 1 failed: Signup failed:', {
          message: signupResponse.message,
          response: signupResponse
        });
        
        toast({
          title: "Account Creation Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("❌ Signup error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Handle different types of errors with specific messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast({
          title: "Network Error",
          description: "Unable to connect to the server. Please check your connection and try again.",
          variant: "destructive",
        });
      } else if (error.response?.status === 400) {
        // Backend validation error
        const errorMessage = error.response.data?.message || "Invalid signup information provided";
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (error.response?.status === 409) {
        // Conflict error (user already exists)
        toast({
          title: "Account Already Exists",
          description: "An account with this email already exists. Please log in instead.",
          variant: "destructive",
        });
      } else if (error.response?.status >= 500) {
        // Server error
        toast({
          title: "Server Error",
          description: "Our servers are experiencing issues. Please try again in a few moments.",
          variant: "destructive",
        });
      } else {
        // Generic error with backend message if available
        const errorMessage = error.response?.data?.message || error.message || "An unexpected error occurred during signup";
        toast({
          title: "Signup Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      // Close dialog immediately to prevent UI issues during redirect
      setOpen(false);
      // Redirect to backend Google OAuth
      window.location.href = '/api/auth/google';
    } catch (error: any) {
      toast({
        title: "Google Sign-Up Failed",
        description: "Unable to initiate Google sign-up. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleLinkedInSignup = async () => {
    setIsLoading(true);
    try {
      // Close dialog immediately to prevent UI issues during redirect
      setOpen(false);
      // Redirect to backend LinkedIn OAuth
      window.location.href = '/api/auth/linkedin';
    } catch (error: any) {
      toast({
        title: "LinkedIn Sign-Up Failed",
        description: "Unable to initiate LinkedIn sign-up. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSelectUserType = (type: UserType) => {
    setUserType(type);
    setCurrentStep("signup");
  };

  const handleBackToUserType = () => {
    setCurrentStep("user-type");
    setUserType(null);
  };

  // Shared dark input style matching the login page
  const darkInput = "bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-[#3A3AF8] focus-visible:border-[#3A3AF8] h-11";
  const darkLabel = "text-white/80 text-sm font-medium";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
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
          "[&>button:last-of-type]:text-white/50 [&>button:last-of-type:hover]:text-white/90 [&>button:last-of-type]:transition-colors [&>button:last-of-type]:z-10",
          currentStep === "user-type"
            ? "w-[min(720px,calc(100vw-2rem))] max-w-none sm:max-w-none"
            : "w-[min(520px,calc(100vw-2rem))] max-w-none sm:max-w-none",
        ].join(" ")}
      >
        {/* Dark card — flex column with capped height + internal scroll */}
        <div
          className="flex flex-col max-h-[calc(100dvh-2rem)] rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0f0f3c 0%, #1a1a4e 40%, #1e1e55 70%, #1a1a4e 100%)",
            border: "1px solid rgba(91,124,255,0.2)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,124,255,0.1)",
          }}
        >
          {/* ── Sticky header (never scrolls away) ── */}
          <div className="shrink-0 px-6 pt-6 pb-4 pr-12 text-center">
            <div className="flex justify-center mb-3">
              <img src={onspotLogo} alt="OnSpot" className="h-10 w-auto" />
            </div>

            {currentStep === "user-type" && (
              <>
                <DialogTitle
                  className="text-2xl font-light text-white"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Join OnSpot
                </DialogTitle>
                <DialogDescription className="text-white/50 text-sm mt-1">
                  Choose how you&apos;d like to get started
                </DialogDescription>
              </>
            )}

            {currentStep === "signup" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={handleBackToUserType}
                  aria-label="Back to account type selection"
                  className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/50 hover:text-white/90 text-sm transition-colors"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <DialogTitle
                  className="text-2xl font-light text-white"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {userType === "client" ? "Hire Talent" : "Find Work"}
                </DialogTitle>
                <DialogDescription className="text-white/50 text-sm mt-1">
                  {userType === "client"
                    ? "Create your client account to start hiring"
                    : "Create your talent profile to find opportunities"}
                </DialogDescription>
              </div>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">

            {/* ── Role selection step ── */}
            {currentStep === "user-type" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client card */}
                <button
                  type="button"
                  onClick={() => handleSelectUserType("client")}
                  className="relative flex flex-col items-center gap-3 rounded-xl p-5 text-center transition-all duration-200 border border-white/15 bg-white/5 hover:bg-[#3A3AF8]/20 hover:border-[#5B7CFF]/60 group"
                  data-testid="card-client-signup"
                >
                  <div className="w-14 h-14 rounded-full bg-[#3A3AF8]/15 flex items-center justify-center group-hover:bg-[#3A3AF8]/30 transition-colors">
                    <Building className="w-7 h-7 text-[#5B7CFF]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">I&apos;m a client hiring for talent</h3>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Build your team with vetted professionals. Scale faster, reduce costs, and focus on growth.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 w-full text-xs text-white/35">
                    <div className="text-center">
                      <Shield className="h-4 w-4 mx-auto text-[#5B7CFF] mb-1" />
                      70% Savings
                    </div>
                    <div className="text-center">
                      <Zap className="h-4 w-4 mx-auto text-[#5B7CFF] mb-1" />
                      8X Growth
                    </div>
                    <div className="text-center">
                      <Mail className="h-4 w-4 mx-auto text-[#5B7CFF] mb-1" />
                      24/7 Support
                    </div>
                  </div>
                </button>

                {/* Talent card */}
                <button
                  type="button"
                  onClick={() => handleSelectUserType("talent")}
                  className="relative flex flex-col items-center gap-3 rounded-xl p-5 text-center transition-all duration-200 border border-white/15 bg-white/5 hover:bg-yellow-400/10 hover:border-yellow-400/50 group"
                  data-testid="card-talent-signup"
                >
                  <div className="w-14 h-14 rounded-full bg-yellow-400/10 flex items-center justify-center group-hover:bg-yellow-400/20 transition-colors">
                    <User className="w-7 h-7 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">I&apos;m a talent looking for work</h3>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Join our elite network of professionals. Access premium opportunities and competitive rates.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 w-full text-xs text-white/35">
                    <div className="text-center">
                      <Briefcase className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
                      Premium Jobs
                    </div>
                    <div className="text-center">
                      <Shield className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
                      Secure Pay
                    </div>
                    <div className="text-center">
                      <User className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
                      Career Growth
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* ── Signup form step ── */}
            {currentStep === "signup" && (
              <>
                {/* Social signup buttons */}
                <div className="space-y-2 mb-5">
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
                <div className="relative mb-5">
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

                {/* Email form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className={darkLabel}>First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        placeholder="First name"
                        autoComplete="given-name"
                        data-testid="input-first-name"
                        className={darkInput}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className={darkLabel}>Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        placeholder="Last name"
                        autoComplete="family-name"
                        data-testid="input-last-name"
                        className={darkInput}
                      />
                    </div>
                  </div>

                  {userType === "client" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="company" className={darkLabel}>Company Name</Label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                        placeholder="Your company name"
                        autoComplete="organization"
                        data-testid="input-company"
                        className={darkInput}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className={darkLabel}>Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="you@example.com"
                      autoComplete="email"
                      data-testid="input-signup-email"
                      className={darkInput}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className={darkLabel}>Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="Min 8 characters"
                        autoComplete="new-password"
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
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className={darkLabel}>Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
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
                      <button type="button" className="text-white/65 underline hover:text-white transition-colors">
                        Terms of Service
                      </button>
                      {" "}and{" "}
                      <button type="button" className="text-white/65 underline hover:text-white transition-colors">
                        Privacy Policy
                      </button>
                    </Label>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    data-testid="button-submit-signup"
                    className="w-full px-6 py-3.5 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)",
                      boxShadow: "0 8px 30px rgba(58,58,248,0.35)",
                    }}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account…</>
                    ) : (
                      <><span>{userType === "client" ? "Create Client Account" : "Create Talent Profile"}</span><ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>

                  {/* Back link */}
                  <button
                    type="button"
                    onClick={handleBackToUserType}
                    className="w-full text-center text-xs text-white/35 hover:text-white/65 transition-colors py-0.5"
                  >
                    Back to Options
                  </button>
                </form>

                {/* Footer — sign in link */}
                <div className="text-center mt-5 pt-4 border-t border-white/10">
                  <p className="text-xs text-white/35 mb-1">Already have an account?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      resetDialog();
                      onSignInInstead?.();
                    }}
                    data-testid="button-signin-instead"
                    className="text-xs text-white/55 hover:text-white underline transition-colors"
                  >
                    Sign in instead
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}