import { Link, useLocation } from "wouter";
import { LoginDialog } from "@/components/LoginDialog";
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
    <nav className="sticky top-0 z-50 w-full border-b backdrop-blur" style={{ backgroundColor: '#474ead' }}>
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center" data-testid="logo-home">
          <img 
            src={onspotLogo} 
            alt="OnSpot" 
            className="h-8 w-auto brightness-0 saturate-100 invert"
            style={{ filter: 'brightness(0) saturate(100%) invert(1)' }}
          />
        </Link>

        {/* Navigation Items */}
        <div className="hidden md:flex items-center space-x-6">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`text-sm font-medium transition-colors hover:text-white ${
                location === item.path 
                  ? "text-white font-semibold" 
                  : "text-white/80"
              }`}
              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.title}
            </Link>
          ))}
        </div>

        {/* Login Button - only show if not authenticated */}
        {!isAuthenticated && <LoginDialog />}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t">
        <div className="container px-4 py-2">
          <div className="flex flex-wrap gap-4 justify-center">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`text-xs font-medium transition-colors hover:text-white ${
                  location === item.path 
                    ? "text-white font-semibold" 
                    : "text-white/80"
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