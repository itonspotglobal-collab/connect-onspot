import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Eye, EyeOff, Mail, Shield, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

export function SignUpDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      toast({
        title: "Welcome to OnSpot!",
        description: "Your account has been created successfully. Please check your email to verify your account.",
      });
      setOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setAgreeToTerms(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" data-testid="button-signup">
          <UserPlus className="w-4 h-4 mr-2" />
          Sign Up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <img 
              src={onspotLogo} 
              alt="OnSpot" 
              className="h-12 w-auto"
            />
          </div>
          <DialogTitle className="text-2xl">Join OnSpot</DialogTitle>
          <DialogDescription className="text-base">
            Start your journey to effortless outsourcing
          </DialogDescription>
        </DialogHeader>

        {/* Quick Benefits */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y">
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
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>

        <Separator className="my-4" />

        {/* Additional Options */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Already have an account?</p>
          <Button variant="ghost" className="p-0 h-auto text-sm font-medium hover:bg-transparent">
            Sign in instead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}