import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";

export default function AdminLogin() {
  const { login, isAuthenticated, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in as admin, go straight to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role === "admin") {
      window.location.href = "/admin/dashboard";
    }
  }, [authLoading, isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Pass null as userType — admin accounts are identified by role in the JWT, not by userType
      const success = await login(email.trim(), password, null);

      if (success) {
        // Redirect to admin dashboard — AdminProtectedRoute enforces the role
        // check server-side and will bounce non-admins to /login. We don't
        // read user.role here because the AuthContext state update is async
        // and the value may still be stale in this closure.
        window.location.href = "/admin/dashboard";
      } else {
        toast({
          title: "Login failed",
          description: "Incorrect email or password.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Blank screen while checking existing session
  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={onspotLogo} alt="OnSpot" className="h-10 w-auto" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <Lock className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Staff access</h1>
              <p className="text-xs text-gray-500">OnSpot internal only</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@onspotglobal.com"
                autoComplete="email"
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isLoading}
            >
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        {/* No footer links — this page is not discoverable by customers */}
      </div>
    </div>
  );
}
