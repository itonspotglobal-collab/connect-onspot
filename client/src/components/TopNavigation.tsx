import { Link, useLocation } from "wouter";
import { LoginDialog } from "@/components/LoginDialog";
import { SignUpDialog } from "@/components/SignUpDialog";
import { useAuth } from "@/contexts/AuthContext";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

const navigationItems = [
  { title: "Hire Talent", path: "/hire-talent" },
  { title: "Get Hired", path: "/get-hired" },
  { title: "Why OnSpot", path: "/why-onspot" },
  { title: "Amazing", path: "/amazing" },
  { title: "Pricing", path: "/pricing" },
  { title: "Enterprise", path: "/enterprise" },
  { title: "Insights", path: "/insights" }
];

export function TopNavigation() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 backdrop-blur-md" style={{ 
      background: 'linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)',
      boxShadow: '0 8px 32px rgba(71, 74, 173, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
    }}>
      <div className="container flex h-16 items-center justify-between px-4 relative">
        {/* Logo */}
        <Link href="/" className="flex items-center relative z-10 hover-elevate transition-all duration-300" data-testid="logo-home">
          <img 
            src={onspotLogo} 
            alt="OnSpot" 
            className="h-8 w-auto brightness-0 saturate-100 invert drop-shadow-sm"
          />
        </Link>

        {/* Navigation Items */}
        <div className="hidden md:flex items-center space-x-2 relative z-10">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate ${
                location === item.path 
                  ? "text-white bg-white/10 border border-white/40" 
                  : "text-white/90"
              }`}
              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.title}
            </Link>
          ))}
        </div>

        {/* Auth Buttons - only show if not authenticated */}
        {!isAuthenticated && (
          <div className="flex items-center gap-3 relative z-10">
            <LoginDialog />
            <SignUpDialog />
          </div>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-white/20">
        <div className="container px-4 py-3">
          <div className="flex flex-wrap gap-2 justify-center">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`px-3 py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate min-h-[44px] flex items-center ${
                  location === item.path 
                    ? "text-white bg-white/10 border border-white/30" 
                    : "text-white/90"
                }`}
                data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}