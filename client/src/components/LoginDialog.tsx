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
import { LogIn, Eye, EyeOff, Mail, Shield, Zap, Building, User, Users, ArrowLeft, Briefcase, Lock, CheckCircle } from "lucide-react";
import { FaGoogle, FaLinkedin } from "react-icons/fa";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

type UserType = "client" | "talent" | "admin" | null;
type LoginStep = "user-type" | "login";

export function LoginDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<LoginStep>("user-type");
  const [userType, setUserType] = useState<UserType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const resetDialog = () => {
    setCurrentStep("user-type");
    setUserType(null);
    setEmail("");
    setPassword("");
    setRememberMe(false);
  };

  // Enhanced error handling with specific messages
  const getSpecificErrorMessage = (email: string, password: string) => {
    if (!email || !email.includes('@')) {
      return {
        title: "Invalid Email Format",
        description: "Please enter a valid email address (e.g., name@example.com)"
      };
    }
    
    if (!password) {
      return {
        title: "Password Required",
        description: "Please enter your password to continue"
      };
    }
    
    if (password.length < 6) {
      return {
        title: "Password Too Short",
        description: "Password must be at least 6 characters long"
      };
    }
    
    // Check if account might not exist
    const commonDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (commonDomains.includes(domain)) {
      return {
        title: "Account Not Found",
        description: "No account found with this email. Would you like to sign up instead?"
      };
    }
    
    return {
      title: "Incorrect Credentials",
      description: "The email or password you entered is incorrect. Please try again or reset your password."
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    // Basic email format validation
    if (!email.includes('@') || !email.includes('.')) {
      toast({
        title: "Invalid Email Format",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log('🔐 Attempting login for:', email.replace(/^(.{3}).*@/, '$1***@'));
    
    try {
      // For admin users, pass null to login function since backend doesn't expect "admin" userType
      const loginUserType = userType === "admin" ? null : userType;
      const success = await login(email, password, loginUserType);
      if (success) {
        const portalType = userType === "client" ? "Client Portal" : 
                          userType === "talent" ? "Talent Portal" : "Admin Portal";
        toast({
          title: "Login Successful",
          description: `Welcome to OnSpot ${portalType}!`,
        });
        setOpen(false);
        resetDialog();
        
        // Redirect admin users to admin dashboard
        if (userType === "admin") {
          window.location.href = '/admin/dashboard';
        }
      } else {
        // Use generic message since AuthContext handles specific backend errors
        toast({
          title: "Login Failed",
          description: "Please check your email and password and try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Login error:', {
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
      } else if (error.response?.status === 401) {
        // Backend authentication error
        const errorMessage = error.response.data?.message || "Invalid email or password";
        toast({
          title: "Authentication Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (error.response?.status === 400) {
        // Backend validation error
        const errorMessage = error.response.data?.message || "Invalid login information provided";
        toast({
          title: "Validation Error",
          description: errorMessage,
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
        const errorMessage = error.response?.data?.message || error.message || "An unexpected error occurred during login";
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
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
          variant="outline" 
          className="w-40 md:w-48 h-11 text-white border-white/60 bg-black/20 font-medium hover:scale-[1.02] transition-transform"
          data-testid="button-login"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Log In
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
                  onClick={handleBackToUserType}
                  className="p-1 h-auto"
                  data-testid="button-back-login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <DialogTitle className="text-2xl">
                    {userType === "client" ? "Client Portal" : 
                     userType === "talent" ? "Talent Portal" : "Admin Portal"}
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    {userType === "client" 
                      ? "Access your client dashboard" 
                      : userType === "talent" 
                        ? "Access your talent dashboard"
                        : "Access the admin dashboard"
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
            
            {/* Admin Portal Button */}
            <div className="mt-6 flex justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSelectUserType("admin")}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-admin-login"
              >
                🔑 Admin Portal
              </Button>
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
              ) : (
                <>
                  <div className="text-center">
                    <Shield className="h-6 w-6 mx-auto text-red-600 mb-2" />
                    <p className="text-xs text-muted-foreground">System Control</p>
                  </div>
                  <div className="text-center">
                    <Users className="h-6 w-6 mx-auto text-red-600 mb-2" />
                    <p className="text-xs text-muted-foreground">User Management</p>
                  </div>
                  <div className="text-center">
                    <Lock className="h-6 w-6 mx-auto text-red-600 mb-2" />
                    <p className="text-xs text-muted-foreground">Admin Access</p>
                  </div>
                </>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
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
            <Button variant="ghost" className="p-0 h-auto text-sm hover:bg-transparent">
              Forgot password?
            </Button>
          </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={isLoading} className="w-full" data-testid="button-submit-login">
                  {isLoading ? "Signing in..." : 
                    userType === "client" ? "Access Client Portal" : 
                    userType === "talent" ? "Access Talent Portal" : "Access Admin Portal"
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