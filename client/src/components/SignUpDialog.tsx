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
import { UserPlus, Eye, EyeOff, Mail, Shield, Zap, Building, User, ArrowLeft, ArrowRight, Briefcase } from "lucide-react";
import { FaGoogle, FaLinkedin } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

type UserType = "client" | "talent" | null;
type SignupStep = "user-type" | "signup";

export function SignUpDialog() {
  const [open, setOpen] = useState(false);
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
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (userType === "client" && !formData.company) {
      toast({
        title: "Error",
        description: "Company name is required for client accounts",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (!agreeToTerms) {
      toast({
        title: "Error",
        description: "Please agree to the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Demo signup - in production this would call your auth API
      const accountType = userType === "client" ? "Client" : "Talent";
      toast({
        title: `Welcome to OnSpot!`,
        description: `Your ${accountType.toLowerCase()} account has been created successfully. Please check your email to verify your account.`,
      });
      setOpen(false);
      resetDialog();
      
      // Navigate user to appropriate page after signup
      if (userType === "talent") {
        setLocation("/get-hired");
      } else if (userType === "client") {
        setLocation("/hire-talent");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred during signup",
        variant: "destructive",
      });
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm" 
          className="bg-white text-[#474ead] border-0 font-semibold shadow-lg"
          data-testid="button-signup"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Sign Up
        </Button>
      </DialogTrigger>
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
              <DialogTitle className="text-2xl">Join OnSpot</DialogTitle>
              <DialogDescription className="text-base">
                Choose how you'd like to get started
              </DialogDescription>
            </>
          )}
          
          {currentStep === "signup" && (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBackToUserType}
                  className="p-1 h-auto"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <DialogTitle className="text-2xl">
                    {userType === "client" ? "Hire Talent" : "Find Work"}
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    {userType === "client" 
                      ? "Create your client account to start hiring" 
                      : "Create your talent profile to find opportunities"
                    }
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
                data-testid="card-client-signup"
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Building className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">I'm a client hiring for talent</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Build your team with vetted professionals. Scale faster, reduce costs, and focus on growth.
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
                data-testid="card-talent-signup"
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[hsl(var(--gold-yellow)/0.1)] rounded-full flex items-center justify-center group-hover:bg-[hsl(var(--gold-yellow)/0.2)] transition-colors">
                    <User className="w-8 h-8 text-[hsl(var(--gold-yellow)/0.8)]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">I'm a talent looking for work</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Join our elite network of professionals. Access premium opportunities and competitive rates.
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

        {currentStep === "signup" && (
          <>
            {/* Professional Social Signup Options */}
            <div className="space-y-3 mb-6">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {userType === "client" 
                    ? "Join thousands of companies growing with OnSpot" 
                    : "Join 50,000+ professionals building their careers"
                  }
                </p>
              </div>
              
              {isFirebaseAvailable() && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                  className="w-full h-12 border-2 hover:border-primary/50 transition-all duration-200"
                  data-testid="button-google-signup"
                >
                  <FaGoogle className="w-5 h-5 mr-3 text-red-500" />
                  <span className="font-medium">
                    Sign up with Google
                  </span>
                </Button>
              )}
              
              <Button
                type="button"
                variant="outline"
                onClick={handleLinkedInSignup}
                disabled={isLoading}
                className="w-full h-12 border-2 hover:border-primary/50 transition-all duration-200"
                data-testid="button-linkedin-signup"
              >
                <FaLinkedin className="w-5 h-5 mr-3 text-blue-600" />
                <span className="font-medium">
                  Sign up with LinkedIn
                </span>
              </Button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or create account with email</span>
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
              ) : (
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
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    placeholder="Enter your first name"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    placeholder="Enter your last name"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              {userType === "client" && (
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    placeholder="Enter your company name"
                    data-testid="input-company"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Enter your email"
                  data-testid="input-signup-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Create a password"
                    data-testid="input-signup-password"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="Confirm your password"
                  data-testid="input-confirm-password"
                />
              </div>

              {/* Terms Agreement */}
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                  data-testid="checkbox-terms"
                />
                <Label htmlFor="terms" className="text-sm leading-none">
                  I agree to the{" "}
                  <Button variant="ghost" className="p-0 h-auto text-sm underline hover:bg-transparent">
                    Terms of Service
                  </Button>
                  {" "}and{" "}
                  <Button variant="ghost" className="p-0 h-auto text-sm underline hover:bg-transparent">
                    Privacy Policy
                  </Button>
                </Label>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button type="submit" disabled={isLoading} className="w-full" data-testid="button-submit-signup">
                  {isLoading ? "Creating Account..." : 
                    userType === "client" ? "Create Client Account" : "Create Talent Profile"
                  }
                </Button>
                <Button type="button" variant="outline" onClick={handleBackToUserType}>
                  Back to Options
                </Button>
              </div>
            </form>

            <Separator className="my-4" />

            {/* Additional Options */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Already have an account?</p>
              <Button 
                variant="ghost" 
                className="p-0 h-auto text-sm font-medium hover:bg-transparent"
onClick={() => {
                  setOpen(false);
                  resetDialog();
                  // TODO: Implement login dialog integration
                }}
                data-testid="button-signin-instead"
              >
                Sign in instead
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}