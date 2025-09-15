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
import { LogIn, Eye, EyeOff, Mail, Shield, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { OnSpotLogo } from "@/components/OnSpotLogo";

export function LoginDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

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
      const success = await login(email, password);
      if (success) {
        toast({
          title: "Success",
          description: "Welcome to OnSpot Platform!",
        });
        setOpen(false);
        setEmail("");
        setPassword("");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-login">
          <LogIn className="w-4 h-4 mr-2" />
          Log In
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <OnSpotLogo size="lg" />
          </div>
          <DialogTitle className="text-2xl">Welcome to OnSpot</DialogTitle>
          <DialogDescription className="text-base">
            Making Outsourcing Easy - Access your client portal
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
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
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
      </DialogContent>
    </Dialog>
  );
}