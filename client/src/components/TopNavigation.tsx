import { Link, useLocation } from "wouter";
import { LoginDialog } from "@/components/LoginDialog";
import { SignUpDialog } from "@/components/SignUpDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
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
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);
      
      // Only process if scroll delta is significant (prevents flicker)
      if (scrollDelta < 10) {
        ticking.current = false;
        return;
      }
      
      if (currentScrollY < 100) {
        // Always show navigation at the top
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 200) {
        // Scrolling down - hide navbar (with minimum scroll threshold)
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show navbar
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
      ticking.current = false;
    };

    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(controlNavbar);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Navigation Spacer - prevents content overlap */}
      <div className="h-16" aria-hidden="true" />
      
      <nav 
        className={`fixed top-0 z-50 w-full border-b border-white/20 backdrop-blur-md transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`} 
        style={{ 
          background: 'linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)',
          boxShadow: isVisible ? '0 8px 32px rgba(71, 74, 173, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)' : 'none'
        }}
      >
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
    </>
  );
}