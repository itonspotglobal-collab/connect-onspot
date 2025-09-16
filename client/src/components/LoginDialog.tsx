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
import { LogIn, Eye, EyeOff, Mail, Shield, Zap, Building, User, ArrowLeft, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

type UserType = "client" | "talent" | null;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email, password, userType);
      if (success) {
        const portalType = userType === "client" ? "Client Portal" : "Talent Portal";
        toast({
          title: "Success",
          description: `Welcome to OnSpot ${portalType}!`,
        });
        setOpen(false);
        resetDialog();
      } else {
        toast({
          title: "Login Failed",
          description: "Please check your credentials and try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred during login",
        variant: "destructive",
      });
    } finally {
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
          size="sm" 
          className="text-white border-white/60 bg-black/20 font-medium"
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
                    {userType === "client" ? "Client Portal" : "Talent Portal"}
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    {userType === "client" 
                      ? "Access your client dashboard" 
                      : "Access your talent dashboard"
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
          </div>
        )}

        {currentStep === "login" && (
          <>
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
                    <Briefcase className="h-6 w-6 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-2" />
                    <p className="text-xs text-muted-foreground">Premium Jobs</p>
                  </div>
                  <div className="text-center">
                    <Shield className="h-6 w-6 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-2" />
                    <p className="text-xs text-muted-foreground">Secure Payments</p>
                  </div>
                  <div className="text-center">
                    <User className="h-6 w-6 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-2" />
                    <p className="text-xs text-muted-foreground">Career Growth</p>
                  </div>
                </>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
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
                    userType === "client" ? "Access Client Portal" : "Access Talent Portal"
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
            <div className="text-center text-sm text-muted-foreground">
              <p>Demo: Use any email and password to log in</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}