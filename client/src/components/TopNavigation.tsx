import { Link, useLocation } from "wouter";
import { ErrorBoundaryWrapper } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalLogin } from "@/hooks/usePortalLogin";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Users,
  Zap,
  Building,
  User,
  ArrowRight,
  Settings,
  LogOut,
  Loader2,
  Shield,
  Mail,
  Briefcase,
  Menu,
  X,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";
import { VanessaChat } from "@/components/VanessaChat";
import {
  TOKEN_KEY as TALENT_TOKEN_KEY,
  loadTalentAuth,
  saveTalentAuth,
  clearTalentAuth,
  type TalentAuthState,
} from "@/components/TalentLoginModal";
import { LoginDialog } from "@/components/LoginDialog";
import { SignUpDialog } from "@/components/SignUpDialog";

// Set to true when the Amazing page is ready to launch
const SHOW_AMAZING_NAV = false;

const navigationItems = [
  { title: "Hire Talent", path: "/hire-talent" },
  { title: "Find Work", path: "/find-work/jobs" },
  ...(SHOW_AMAZING_NAV ? [{ title: "Amazing", path: "/amazing" }] : []),
];

export function TopNavigation() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading, user, logout, refreshAuth } = useAuth();
  const { signInToPortal } = usePortalLogin();
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPortal, setShowPortal] = useState(false);

  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4 | "signin" | "signup" | "forgot">(1);
  const [selectedPortal, setSelectedPortal] = useState<
    "client" | "talent" | null
  >(null);
  const [contactForm, setContactForm] = useState({
    email: "",
    fullName: "",
    businessName: "",
    phone: "",
  });
  // DEV ONLY: auth form state — remove when real auth is implemented
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signinPortal, setSigninPortal] = useState<"client" | "talent" | null>(null);
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<"client" | "talent" | null>(null);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [signinLoading, setSigninLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [talentAuth, setTalentAuth] = useState<TalentAuthState | null>(() => loadTalentAuth());
  // Talent sign-in — password setup flow (for existing candidates without a password)
  const [signinNeedsSetup, setSigninNeedsSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [showSetupPw, setShowSetupPw] = useState(false);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);
  // DEV ONLY: forgot-password flow state — remove when real password-reset email is implemented
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<number>(navigationItems.length);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentDelayRef = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const navLinksRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Admin: submitted-application badge count ──────────────────────────────
  const { data: jobAppSummary } = useQuery<{ total: number; byStatus: Record<string, number> }>({
    queryKey: ["/api/admin/job-applications/summary"],
    queryFn: async () => {
      const token = localStorage.getItem("onspot_jwt_token");
      const res = await fetch("/api/admin/job-applications/summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!user && user.role === "admin",
    staleTime: 30_000,
  });
  const submittedCount = user?.role === "admin" ? (jobAppSummary?.byStatus?.["submitted"] ?? 0) : 0;

  // ── Profile route helpers ──────────────────────────────────────────────────
  const getProfileRoute = () => {
    if (user?.role === "client") return "/client-profile";
    if (user?.role === "admin") return "/admin/dashboard";
    if (talentAuth?.candidateId) return `/talent-profile/${talentAuth.candidateId}`;
    return "/find-best-matches";
  };
  const getProfileLabel = () => {
    if (user?.role === "client") return "Client Profile";
    if (user?.role === "admin") return "Admin Dashboard";
    return "Talent Profile";
  };
  const getProfileIcon = () => {
    if (user?.role === "client") return <Building className="w-4 h-4" />;
    if (user?.role === "admin") return <Shield className="w-4 h-4" />;
    return <User className="w-4 h-4" />;
  };

  // ── Role-based dropdown items ──────────────────────────────────────────────
  const getDropdownItems = (): { label: string; route: string; icon: React.ElementType }[] => {
    if (user?.role === "client") return [
      { label: "Client Profile", route: "/client-profile", icon: Building },
      { label: "Hire Talent",    route: "/hire-talent",    icon: Users },
      { label: "Settings",       route: "/settings",       icon: Settings },
    ];
    if (user?.role === "admin") return [
      { label: "Admin Dashboard",   route: "/admin/dashboard",          icon: Shield },
      { label: "Find Work",         route: "/admin/find-work",          icon: Briefcase },
      { label: "Job Applications",  route: "/admin/job-applications",   icon: Users },
      { label: "Email Templates",   route: "/admin/email-templates",    icon: Mail },
      { label: "Insights",          route: "/admin/insights",           icon: Eye },
      { label: "Settings",          route: "/settings",                 icon: Settings },
    ];
    // TODO: Remove these public admin links before production launch.
    // Temporary: surface admin tools in the nav without requiring a logged-in admin account.
    if (!user) return [
      { label: "Admin Dashboard",  route: "/admin/dashboard",         icon: Shield },
      { label: "Find Work",        route: "/admin/find-work",         icon: Briefcase },
      { label: "Job Applications", route: "/admin/job-applications",  icon: Users },
      { label: "Email Templates",  route: "/admin/email-templates",   icon: Mail },
      { label: "Insights",         route: "/admin/insights",          icon: Eye },
    ];
    // talent / default
    return [
      { label: "Talent Profile",       route: talentAuth ? `/talent-profile/${talentAuth.candidateId}` : "/find-best-matches", icon: User },
      { label: "Finish Profile Setup", route: "/find-best-matches", icon: CheckCircle2 },
      { label: "Find Work",            route: "/find-work/jobs",    icon: Briefcase },
      { label: "Settings",             route: "/settings",          icon: Settings },
    ];
  };

  // ── Sign-out handler ───────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      // Clear dev portal session keys
      ["dev_portal_user","dev_portal_role","dev_portal_email","dev_portal_first_name","dev_portal_last_name"].forEach(k => localStorage.removeItem(k));
      // Clear talent-specific auth token
      clearTalentAuth();
      setTalentAuth(null);
      // Clear general JWT auth
      await logout();
      toast({ title: "Signed out", description: "You have been signed out successfully." });
      navigate("/");
    } catch {
      toast({ title: "Sign out failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Talent-only sign-out (when no general JWT session)
  const handleTalentSignOut = () => {
    clearTalentAuth();
    setTalentAuth(null);
    toast({ title: "Signed out", description: "You have been signed out successfully." });
    navigate("/");
  };

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        setActiveDropdown(null);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (typeof window !== 'undefined') {
      resizeObserver.observe(document.body);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      resizeObserver.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);

      // Update scrolled state for nav-over-hero styling (add shadow)
      setIsScrolled(currentScrollY > 10);

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
        // Close mobile menu when scrolling down
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
          setActiveDropdown(null);
        }
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileMenuOpen]);

  // Priority+ pattern: ResizeObserver for adaptive navigation
  useEffect(() => {
    const handlePriorityPlus = () => {
      // Only apply Priority+ pattern for tablet range (769-1024px)
      if (window.innerWidth <= 768 || window.innerWidth > 1024) {
        setVisibleItems(navigationItems.length);
        return;
      }

      if (!navLinksRef.current || itemRefs.current.length === 0) return;

      const container = navLinksRef.current;
      const containerWidth = container.offsetWidth;
      const moreButtonWidth = 80; // Approximate width of "More ▾" button
      let totalWidth = 0;
      let visibleCount = 0;

      // Calculate how many items can fit
      for (let i = 0; i < itemRefs.current.length; i++) {
        const item = itemRefs.current[i];
        if (!item) continue;
        
        const itemWidth = item.offsetWidth + 16; // Add gap
        if (totalWidth + itemWidth + moreButtonWidth < containerWidth) {
          totalWidth += itemWidth;
          visibleCount++;
        } else {
          break;
        }
      }

      setVisibleItems(visibleCount);
    };

    const resizeObserver = new ResizeObserver(handlePriorityPlus);
    
    if (navLinksRef.current) {
      resizeObserver.observe(navLinksRef.current);
    }

    // Also handle window resize
    window.addEventListener('resize', handlePriorityPlus);
    
    // Initial calculation
    handlePriorityPlus();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handlePriorityPlus);
    };
  }, []);

  // Close More dropdown on ESC and resize
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreMenuOpen(false);
        setActiveDropdown(null);
      }
    };

    const handleResize = () => {
      setMoreMenuOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Apple-style mega menu handlers with intent delays
  const handleMouseEnter = (title: string) => {
    // Clear any pending close timeout
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }

    // If switching between mega menus, add 100ms intent delay to prevent flicker
    if (activeDropdown && activeDropdown !== title) {
      if (intentDelayRef.current) {
        clearTimeout(intentDelayRef.current);
      }
      intentDelayRef.current = setTimeout(() => {
        setActiveDropdown(title);
      }, 100);
    } else {
      // First open or re-entering same menu - instant
      if (intentDelayRef.current) {
        clearTimeout(intentDelayRef.current);
      }
      setActiveDropdown(title);
    }
  };

  const handleMouseLeave = () => {
    // Clear any pending intent delay
    if (intentDelayRef.current) {
      clearTimeout(intentDelayRef.current);
      intentDelayRef.current = null;
    }
    
    // Add 150ms delay before closing to allow user to move between nav and mega menu
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
      if (intentDelayRef.current) clearTimeout(intentDelayRef.current);
    };
  }, []);

  // Close mega menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (activeDropdown) {
        setActiveDropdown(null);
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeDropdown, isMobileMenuOpen]);

  // Close menus on Esc key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDropdown) {
          setActiveDropdown(null);
        }
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
        if (moreMenuOpen) {
          setMoreMenuOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeDropdown, isMobileMenuOpen, moreMenuOpen]);

  return (
    <>
      {/* Navigation Spacer - prevents content overlap */}
      <div style={{ height: 'var(--nav-h)' }} aria-hidden="true" />

      <nav
        ref={navRef}
        className={`nav-over-hero fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        } ${isScrolled ? "nav-scrolled" : ""}`}
        data-scrolled={isScrolled}
      >
        <div 
          className="flex items-center relative w-full"
          style={{
            height: 'var(--nav-h)',
            paddingLeft: 'clamp(32px, 2.5vw, 40px)',
            paddingRight: 'clamp(32px, 2.5vw, 40px)',
          }}
        >
          {/* Zone 1: Logo — anchored left */}
          <Link
            href="/"
            className="flex shrink-0 items-center relative z-10"
            data-testid="logo-home"
          >
            <img
              src={onspotLogo}
              alt="OnSpot"
              className="nav-logo-img"
            />
          </Link>

          {/* Zone 2: Desktop Navigation Links — pushed right toward auth */}
          <div 
            ref={navLinksRef}
            className="hidden md:flex items-center relative ml-auto"
            style={{ 
              gap: 'clamp(32px, 2.5vw, 48px)',
              marginRight: '48px',
              flexWrap: 'nowrap',
              zIndex: 101,
            }}
          >
            {navigationItems.slice(0, visibleItems).map((item, index) => {
              const hasMegaMenu = "megaMenu" in item && item.megaMenu;
              const isActive =
                location === item.path ||
                (item.path === "/hire-talent" && location === "/talent-pool") ||
                (item.path === "/find-work/jobs" &&
                  (location.startsWith("/find-work") || location.startsWith("/jobs/"))) ||
                (hasMegaMenu &&
                  item.services &&
                  Object.values(item.services).some(
                    (service) => location === service.path,
                  )) ||
                (hasMegaMenu &&
                  item.categories &&
                  location === "/find-work") ||
                (hasMegaMenu &&
                  item.whyOnSpot &&
                  Object.values(item.whyOnSpot).some(
                    (section) => location === section.path,
                  ));
              
              return (
                <div 
                  key={item.title}
                  ref={(el) => { itemRefs.current[index] = el; }}
                >
                  {hasMegaMenu ? (
                    <div className="relative">
                      <button
                        className={`nav-glow-item py-2 text-sm font-medium transition-all duration-300 rounded-lg flex items-center gap-1 whitespace-nowrap text-white ${
                          activeDropdown === item.title ? "nav-glow-active" : ""
                        }`}
                        style={{ 
                          paddingLeft: 'clamp(10px, 1.2vw, 16px)', 
                          paddingRight: 'clamp(10px, 1.2vw, 16px)',
                        }}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => navigate(item.path)}
                        onMouseEnter={() => handleMouseEnter(item.title)}
                        onFocus={() => handleMouseEnter(item.title)}
                        aria-expanded={activeDropdown === item.title}
                        aria-haspopup="true"
                        aria-label={`${item.title} menu`}
                      >
                        {item.title}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={item.path}
                      className="nav-glow-item py-2 text-sm font-medium transition-all duration-300 rounded-lg whitespace-nowrap text-white"
                      style={{ paddingLeft: 'clamp(10px, 1.2vw, 16px)', paddingRight: 'clamp(10px, 1.2vw, 16px)' }}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      onMouseEnter={() => {
                        if (activeDropdown) {
                          handleMouseLeave();
                        }
                      }}
                    >
                      {item.title}
                    </Link>
                  )}
                </div>
              );
            })}

            {/* "More ▾" button for tablet Priority+ pattern */}
            {visibleItems < navigationItems.length && window.innerWidth > 768 && window.innerWidth <= 1024 && (
              <div className="relative">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate active-elevate-2 flex items-center gap-1 text-white/90"
                  style={{ paddingLeft: 'clamp(10px, 1.2vw, 16px)', paddingRight: 'clamp(10px, 1.2vw, 16px)' }}
                  aria-expanded={moreMenuOpen}
                  data-testid="nav-more-button"
                >
                  More
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      moreMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* More Menu Scrim */}
                {moreMenuOpen && (
                  <div
                    className="menu-scrim"
                    style={{
                      zIndex: 98,
                    }}
                    onClick={() => setMoreMenuOpen(false)}
                  />
                )}

                {/* More dropdown menu - Translucent Glass Surface */}
                {moreMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-3 w-64 overflow-hidden mega-menu-panel"
                    style={{
                      background: "rgba(44, 48, 114, 0.86)",
                      backdropFilter: "blur(10px) saturate(110%)",
                      WebkitBackdropFilter: "blur(10px) saturate(110%)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "20px",
                      boxShadow: "0 24px 48px rgba(0, 0, 0, 0.2)",
                      zIndex: 100,
                    }}
                    role="menu"
                  >
                    <div className="py-3 px-2">
                      {navigationItems.slice(visibleItems).map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => setMoreMenuOpen(false)}
                          className="more-menu-link block px-4 py-3 text-sm font-semibold text-white rounded-lg"
                          style={{
                            transition: 'all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                          }}
                          role="menuitem"
                          data-testid={`more-menu-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone 3: Auth + Mobile Toggle */}
          <div 
            className="flex items-center relative z-10 flex-shrink-0"
            style={{ gap: 'clamp(8px, 1vw, 12px)' }}
          >
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
              data-testid="mobile-menu-toggle"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Access Portal / Account Dropdown */}
            {isAuthenticated && user ? (
              /* ── General JWT session (client / admin / talent via general login) ── */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative group hidden md:flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white whitespace-nowrap overflow-hidden transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)',
                      boxShadow: '0 4px 15px rgba(58, 58, 248, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    }}
                    data-testid="account-dropdown-trigger"
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                        animation: 'shimmer 2s infinite',
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-lg opacity-60 group-hover:opacity-100 blur-md transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(135deg, #3A3AF8 0%, #7F3DF4 100%)',
                        animation: 'portal-breathe 3s ease-in-out infinite',
                        zIndex: -1,
                      }}
                    />
                    <span className="relative z-10 flex items-center gap-2">
                      {getProfileIcon()}
                      {getProfileLabel()}
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {getDropdownItems().map(({ label, route, icon: Icon }) => (
                    <DropdownMenuItem key={route} onClick={() => navigate(route)} className="cursor-pointer gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1">{label}</span>
                      {label === "Job Applications" && submittedCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none min-w-[18px] h-[18px] px-1">
                          {submittedCount > 99 ? "99+" : submittedCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isLoggingOut}
                    className="cursor-pointer gap-2 text-red-500 focus:text-red-500"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    {isLoggingOut ? "Signing out…" : "Sign Out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : talentAuth ? (
              /* ── Talent-only session (talent_profile_token, no general JWT) ── */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative group hidden md:flex items-center gap-2 px-4 font-semibold text-sm text-white whitespace-nowrap overflow-hidden transition-all duration-300 hover:scale-[1.03]"
                    style={{
                      height: 44,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)',
                      boxShadow: '0 4px 15px rgba(58, 58, 248, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    }}
                    data-testid="talent-account-dropdown-trigger"
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                        animation: 'shimmer 2s infinite',
                      }}
                    />
                    <span className="relative z-10 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Talent Profile
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="p-2 max-w-[calc(100vw-24px)]"
                  style={{
                    minWidth: 214,
                    background: '#F8F8FF',
                    border: '1px solid rgba(75,81,184,0.12)',
                    borderRadius: 13,
                    boxShadow: '0 12px 30px rgba(20,25,70,0.16)',
                    zIndex: 9999,
                  }}
                >
                  {/* Header */}
                  <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(75,81,184,0.10)', marginBottom: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1E2330', lineHeight: 1.3 }} className="truncate">{talentAuth.fullName}</p>
                    <p style={{ fontSize: 12, color: '#7178A0', marginTop: 1 }} className="truncate">{talentAuth.email}</p>
                  </div>

                  {/* Navigation items */}
                  <DropdownMenuItem
                    onClick={() => navigate(`/talent-profile/${talentAuth.candidateId}`)}
                    className="cursor-pointer rounded-lg [&:hover]:bg-[#F1F2FF] [&:hover]:text-[#3F47B5] focus:bg-[#F1F2FF] focus:text-[#3F47B5]"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, fontSize: 14, color: '#1E2330', borderRadius: 8 }}
                  >
                    <User style={{ width: 17, height: 17, color: '#4B51B8', flexShrink: 0 }} />
                    Talent Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/find-work/jobs")}
                    className="cursor-pointer rounded-lg [&:hover]:bg-[#F1F2FF] [&:hover]:text-[#3F47B5] focus:bg-[#F1F2FF] focus:text-[#3F47B5]"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, fontSize: 14, color: '#1E2330', borderRadius: 8 }}
                  >
                    <Briefcase style={{ width: 17, height: 17, color: '#4B51B8', flexShrink: 0 }} />
                    Find Work
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/settings")}
                    className="cursor-pointer rounded-lg [&:hover]:bg-[#F1F2FF] [&:hover]:text-[#3F47B5] focus:bg-[#F1F2FF] focus:text-[#3F47B5]"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, fontSize: 14, color: '#1E2330', borderRadius: 8 }}
                  >
                    <Settings style={{ width: 17, height: 17, color: '#4B51B8', flexShrink: 0 }} />
                    Settings
                  </DropdownMenuItem>

                  {/* Sign Out — separated */}
                  <div style={{ borderTop: '1px solid rgba(75,81,184,0.10)', marginTop: 6, paddingTop: 6 }}>
                    <DropdownMenuItem
                      onClick={handleTalentSignOut}
                      className="cursor-pointer rounded-lg [&:hover]:bg-[#FFF1F1] [&:hover]:text-[#D84A4A] focus:bg-[#FFF1F1] focus:text-[#D84A4A]"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, fontSize: 14, color: '#C0393A', borderRadius: 8 }}
                    >
                      <LogOut style={{ width: 17, height: 17, color: '#C0393A', flexShrink: 0 }} />
                      Sign Out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* ── Not authenticated — Log In + Sign Up (text link) ── */
              <div className="hidden md:flex flex-row items-center gap-3">
                <button
                  onClick={() => { setShowPortal(true); setModalStep("signin"); }}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white/90 border border-white/25 hover:bg-white/10 hover:border-white/40 hover:text-white transition-all duration-200 whitespace-nowrap"
                  data-testid="nav-login-button"
                >
                  Log In
                </button>
                <button
                  onClick={() => { setShowPortal(true); setModalStep("signup"); }}
                  className="text-[13px] font-medium text-white/55 hover:text-white/85 transition-colors duration-200 whitespace-nowrap hover:underline"
                  data-testid="nav-signup-button"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Global Desktop Mega Menu - positioned outside nav for seamless Apple-style transitions */}
      {activeDropdown && (
        <>
          {/* Cinematic Scrim - Soft Blur & Dim */}
          <div
            className="menu-scrim"
            style={{
              zIndex: 99,
            }}
            onClick={() => setActiveDropdown(null)}
            onMouseEnter={handleMouseLeave}
          />
          
          {/* Mega Menu Panel - One Translucent Surface */}
          <div
            className="fixed left-0 right-0"
            style={{
              top: "var(--nav-h)",
              zIndex: 100,
            }}
            onMouseEnter={() => {
              if (dropdownTimeoutRef.current) {
                clearTimeout(dropdownTimeoutRef.current);
                dropdownTimeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setActiveDropdown(null);
              }
            }}
          >
            <div
              className="mega-menu-panel"
              style={{
                margin: "0 auto",
                maxWidth: "min(1200px, 92vw)",
              }}
            >
              <div className="mx-auto max-w-7xl" style={{ padding: "28px 32px" }}>
                <div className="grid grid-cols-3 gap-8" style={{ gap: "32px" }}>
                  {(() => {
                    const activeItem = navigationItems.find(item => item.title === activeDropdown);
                    if (!activeItem) return null;

                    const columns: JSX.Element[] = [];
                    
                    // Services dropdown
                    if ('services' in activeItem && activeItem.services) {
                      const serviceLinks = Object.entries(activeItem.services).map(([key, service]) => (
                        <Link
                          key={key}
                          href={service.path}
                          className="mega-menu-tile block"
                          data-testid={`dropdown-link-${key}`}
                        >
                          <h3 className="text-white font-bold text-base leading-tight mb-2">
                            {service.title}
                            <span className="mega-menu-tile-underline" />
                          </h3>
                          <p className="text-white/75 text-sm leading-relaxed">
                            {service.subtitle}
                          </p>
                        </Link>
                      ));
                      serviceLinks.forEach((link, index) => {
                        columns.push(
                          <div key={`service-${index}`} className="mega-menu-column">
                            {link}
                          </div>
                        );
                      });
                    }
                    
                    // Work categories dropdown
                    if ('categories' in activeItem && activeItem.categories) {
                      const categoryLinks = Object.entries(activeItem.categories).map(([key, category]) => (
                        <Link
                          key={key}
                          href={category.path}
                          className="mega-menu-tile block"
                          data-testid={`dropdown-link-${key}`}
                        >
                          <h3 className="text-white font-bold text-base leading-tight mb-2">
                            {category.title}
                            <span className="mega-menu-tile-underline" />
                          </h3>
                          <p className="text-white/75 text-sm leading-relaxed">
                            {category.subtitle}
                          </p>
                        </Link>
                      ));
                      categoryLinks.forEach((link, index) => {
                        columns.push(
                          <div key={`category-${index}`} className="mega-menu-column">
                            {link}
                          </div>
                        );
                      });
                    }
                    
                    // Why OnSpot dropdown
                    if ('whyOnSpot' in activeItem && activeItem.whyOnSpot) {
                      const whyLinks = Object.entries(activeItem.whyOnSpot).map(([key, section]) => (
                        <Link
                          key={key}
                          href={section.path}
                          className="mega-menu-tile block"
                          data-testid={`dropdown-link-${key}`}
                        >
                          <h3 className="text-white font-bold text-base leading-tight mb-2">
                            {section.title}
                            <span className="mega-menu-tile-underline" />
                          </h3>
                          <p className="text-white/75 text-sm leading-relaxed">
                            {section.subtitle}
                          </p>
                        </Link>
                      ));
                      whyLinks.forEach((link, index) => {
                        columns.push(
                          <div key={`why-${index}`} className="mega-menu-column">
                            {link}
                          </div>
                        );
                      });
                    }

                    return columns;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Menu Scrim - Cinematic Blur & Dim */}
      {isMobileMenuOpen && (
        <div
          className="menu-scrim md:hidden"
          style={{
            zIndex: 39,
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Panel - One Seamless Glass Surface */}
      <div
        className={`mobile-menu-panel md:hidden fixed left-0 right-0 overflow-hidden transition-all ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: 'var(--nav-h)',
          transform: isMobileMenuOpen ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
          zIndex: 40,
          background: 'rgba(44, 48, 114, 0.86)',
          backdropFilter: 'blur(10px) saturate(110%)',
          WebkitBackdropFilter: 'blur(10px) saturate(110%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
          transitionDuration: isMobileMenuOpen ? '160ms' : '150ms',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          animation: isMobileMenuOpen ? 'menuBreathe 4s ease-in-out 1s infinite' : 'none',
        }}
      >
        <div className="max-h-[calc(100vh-var(--nav-h))] overflow-y-auto px-4 py-6">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const hasMegaMenu = "megaMenu" in item && item.megaMenu;
              const isExpanded = mobileAccordionOpen === item.title;

              if (hasMegaMenu) {
                return (
                  <div key={item.title}>
                    <button
                      onClick={() => setMobileAccordionOpen(isExpanded ? null : item.title)}
                      className={`w-full py-4 px-0 text-left text-white font-semibold flex items-center justify-between rounded-lg transition-all ${
                        isExpanded ? 'nav-glow-active' : ''
                      }`}
                      style={{
                        transition: 'all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                      }}
                      data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span>{item.title}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        style={{
                          transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                        }}
                      />
                    </button>
                    
                    {/* Accordion Content - Borderless Floating Links */}
                    {isExpanded && (
                      <div 
                        className="mt-2 space-y-1 pl-4"
                        style={{
                          animation: 'fadeIn 160ms ease-out',
                        }}
                      >
                        {/* Services dropdown */}
                        {item.services && Object.entries(item.services).map(([key, service]) => (
                          <Link
                            key={key}
                            href={service.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="mobile-menu-link block py-3 text-white font-medium"
                            style={{
                              transition: 'all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                            }}
                            data-testid={`mobile-link-${key}`}
                          >
                            {service.title}
                          </Link>
                        ))}
                        
                        {/* Work categories dropdown */}
                        {item.categories && Object.entries(item.categories).map(([key, category]) => (
                          <Link
                            key={key}
                            href={category.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="mobile-menu-link block py-3 text-white font-medium"
                            style={{
                              transition: 'all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                            }}
                            data-testid={`mobile-link-${key}`}
                          >
                            {category.title}
                          </Link>
                        ))}
                        
                        {/* Why OnSpot dropdown */}
                        {item.whyOnSpot && Object.entries(item.whyOnSpot).map(([key, section]) => (
                          <Link
                            key={key}
                            href={section.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="mobile-menu-link block py-3 text-white font-medium"
                            style={{
                              transition: 'all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                            }}
                            data-testid={`mobile-link-${key}`}
                          >
                            {section.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`mobile-menu-link block py-4 text-white font-semibold ${
                    location === item.path ? "nav-glow-active" : ""
                  }`}
                  style={{
                    transition: 'all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                  }}
                  data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-white/10">
          {isAuthenticated && user ? (
            <div className="space-y-1">
              {/* Account label */}
              <p className="px-2 py-1 text-[11px] text-white/40 truncate">{user.email}</p>
              {/* Role-based nav items */}
              {getDropdownItems().map(({ label, route, icon: Icon }) => (
                <button
                  key={route}
                  onClick={() => { navigate(route); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <Icon className="w-4 h-4 shrink-0 text-white/50" />
                  {label}
                </button>
              ))}
              {/* Sign Out */}
              <button
                onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left disabled:opacity-50"
                data-testid="mobile-sign-out"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 shrink-0" />
                )}
                {isLoggingOut ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          ) : talentAuth ? (
            /* ── Talent-only mobile session ── */
            <div className="space-y-1">
              <p className="px-2 py-1 text-[11px] text-white/40 truncate">{talentAuth.fullName}</p>
              <button
                onClick={() => { navigate(`/talent-profile/${talentAuth.candidateId}`); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
              >
                <User className="w-4 h-4 shrink-0 text-white/50" />
                Talent Profile
              </button>
              <button
                onClick={() => { navigate("/find-work/jobs"); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
              >
                <Briefcase className="w-4 h-4 shrink-0 text-white/50" />
                Find Work
              </button>
              <button
                onClick={() => { handleTalentSignOut(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign Out
              </button>
            </div>
          ) : (
            /* ── Not authenticated — mobile Log In + Sign Up ── */
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPortal(true); setModalStep("signin"); setIsMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center px-4 py-3.5 rounded-lg font-bold text-base text-white/90 border border-white/25 hover:bg-white/10 transition-all duration-200"
                data-testid="mobile-login-button"
              >
                Log In
              </button>
              <button
                onClick={() => { setShowPortal(true); setModalStep("signup"); setIsMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center px-4 py-3.5 rounded-lg font-medium text-sm text-white/55 hover:text-white/85 transition-all duration-200"
                data-testid="mobile-signup-button"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Access Portal Modal - All Steps */}
      <Dialog
        open={showPortal}
        onOpenChange={(open) => {
          setShowPortal(open);
          if (!open) {
            // Reset modal state when closing
            setModalStep("signin");
            setSelectedPortal(null);
            // DEV ONLY: reset auth form state
            setSigninEmail(""); setSigninPassword(""); setSigninPortal(null);
            setSignupFirstName(""); setSignupLastName(""); setSignupEmail(""); setSignupPassword(""); setSignupRole(null);
            setShowAuthPassword(false); setShowSignupPassword(false); setShowSignupConfirm(false); setShowForgotPwd(false); setShowForgotConfirm(false);
            // Reset password setup state
            setSigninNeedsSetup(false); setSetupPassword(""); setSetupConfirmPassword(""); setShowSetupPw(false); setShowSetupConfirm(false);
          }
        }}
      >
        {/* Step 1: Cinematic Awakening Modal */}
        {modalStep === 1 ? (
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" style={{ background: 'rgba(10,10,30,0.55)' }} />
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
              style={{
                padding: 'clamp(2rem, 5vh, 4rem)',
                minHeight: '100vh',
              }}
            >
              <div 
                className="relative animate-in fade-in slide-in-from-bottom-6 duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6 my-auto"
                style={{
                  width: 'min(90%, 900px)',
                  maxHeight: '90vh',
                }}
              >
                <DialogTitle className="sr-only">
                  Superhuman BPO Awakening
                </DialogTitle>
                {/* Close Button */}
                <button
                  onClick={() => setShowPortal(false)}
                  className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-white"
                  data-testid="button-close-modal"
                >
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close</span>
                </button>
                <div
                  className="relative flex items-center justify-center rounded-2xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #0f0f3c 0%, #1a1a4e 25%, #252560 50%, #1a1a4e 75%, #0f0f3c 100%)',
                    minHeight: 'min(700px, 80vh)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                  }}
                  data-testid="modal-step-awakening"
                >
                  {/* Animated Grid Background */}
                  <div 
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(91, 124, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(91, 124, 255, 0.3) 1px, transparent 1px)',
                      backgroundSize: '50px 50px',
                      animation: 'grid-move 20s linear infinite',
                    }}
                  ></div>

                  {/* Subtle Center Pulse */}
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                    <div className="relative w-[600px] h-[600px]">
                      <div
                        className="absolute inset-[20%] rounded-full bg-gradient-to-r from-[#3A3AF8]/20 to-[#7F3DF4]/20 blur-3xl animate-pulse"
                        style={{
                          animationDuration: "4s",
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Floating Particle Effects */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-blue-400/60 rounded-full"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 3}s`,
                          boxShadow: '0 0 10px rgba(91, 124, 255, 0.8)'
                        }}
                      ></div>
                    ))}
                  </div>

                  {/* Gradient Overlay for depth */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "radial-gradient(ellipse at center, transparent 0%, rgba(15,15,60,0.4) 70%, rgba(0,0,0,0.6) 100%)",
                    }}
                  ></div>

                  {/* Content Container */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-10 px-8 py-12 max-w-3xl">
                    {/* Headline - Fade in with delay */}
                    <h1
                      className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-white animate-in fade-in slide-in-from-bottom-4 duration-1000"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        letterSpacing: "-0.02em",
                        animationDelay: "300ms",
                        animationFillMode: "backwards",
                      }}
                    >
                      The first Superhuman BPO is awakening.
                    </h1>

                    {/* Subcopy - Delayed fade in */}
                    <p
                      className="text-lg sm:text-xl md:text-2xl font-light text-white/80 animate-in fade-in slide-in-from-bottom-4 duration-1000"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        animationDelay: "800ms",
                        animationFillMode: "backwards",
                      }}
                    >
                      AI first. Humans when it matters.
                    </p>

                    {/* CTA Button with Glow Animation */}
                    <div
                      className="animate-in fade-in slide-in-from-bottom-4 duration-1000"
                      style={{
                        animationDelay: "1300ms",
                        animationFillMode: "backwards",
                      }}
                    >
                      <button
                        onClick={() => setModalStep(2)}
                        className="relative group px-10 py-5 text-lg font-semibold text-white rounded-xl overflow-hidden transition-all duration-500 hover:scale-105 shadow-lg hover:shadow-2xl"
                        style={{
                          background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)',
                          boxShadow: '0 8px 30px rgba(58, 58, 248, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                        }}
                        data-testid="button-continue-to-contact-form"
                      >
                        {/* Animated shimmer overlay */}
                        <div 
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          style={{
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                            animation: 'shimmer 2s infinite',
                          }}
                        ></div>
                        
                        {/* Breathing glow effect */}
                        <div 
                          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500"
                          style={{
                            background: 'linear-gradient(135deg, #3A3AF8 0%, #7F3DF4 100%)',
                            zIndex: -1,
                          }}
                        ></div>
                        
                        <span className="relative z-10 flex items-center gap-3">
                          <Zap className="w-5 h-5" />
                          Be the first to experience it
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                        </span>
                      </button>
                    </div>

                    {/* Sign In / Sign Up buttons + Microtext — DEV ONLY: temporary portal access */}
                    <div
                      className="flex flex-col items-center gap-4 animate-in fade-in duration-1000"
                      style={{
                        animationDelay: "1700ms",
                        animationFillMode: "backwards",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setModalStep("signin")}
                          className="relative group px-7 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-105"
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                          }}
                          data-testid="button-signin-step1"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            <LogIn className="w-4 h-4" />
                            Sign In
                          </span>
                        </button>
                        <button
                          onClick={() => setModalStep("signup")}
                          className="relative group px-7 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-105"
                          style={{
                            background: 'linear-gradient(135deg, rgba(58,58,248,0.5) 0%, rgba(127,61,244,0.5) 100%)',
                            border: '1px solid rgba(91,124,255,0.45)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 15px rgba(58,58,248,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                          }}
                          data-testid="button-signup-step1"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Sign Up
                          </span>
                        </button>
                      </div>
                      <p
                        className="text-sm text-white/40"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        Your AI-powered outsourcing revolution starts now
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : modalStep === 2 ? (
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" style={{ background: 'rgba(10,10,30,0.55)' }} />
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
              style={{
                padding: 'clamp(2rem, 5vh, 4rem)',
                minHeight: '100vh',
              }}
            >
              <div 
                className="relative animate-in fade-in slide-in-from-bottom-6 duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6 my-auto"
                style={{
                  width: 'min(90%, 900px)',
                  maxHeight: '90vh',
                }}
              >
                <DialogTitle className="sr-only">
                  Contact Information
                </DialogTitle>
                {/* Close Button */}
                <button
                  onClick={() => setShowPortal(false)}
                  className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-white"
                  data-testid="button-close-modal"
                >
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close</span>
                </button>
                <div
                  className="relative hero-investor flex items-center justify-center rounded-2xl overflow-hidden"
                  style={{
                    minHeight: 'min(650px, 80vh)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                  }}
                  data-testid="modal-step-contact-form"
                >
                  {/* Gradient Overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(15,15,60,0.45) 0%, rgba(0,0,0,0.0) 25%, rgba(0,0,0,0.0) 75%, rgba(15,15,60,0.45) 100%)",
                    }}
                  ></div>

                  {/* Subtle AI Pulse */}
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none opacity-50">
                    <div className="relative w-[400px] h-[400px]">
                      <div
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-[#3A3AF8]/15 to-[#7F3DF4]/15 blur-3xl animate-pulse"
                        style={{ animationDuration: "4s" }}
                      ></div>
                    </div>
                  </div>

                  {/* Contact Form */}
                  <div className="relative z-10 w-full px-8 py-12 max-w-2xl">
                    <div className="text-center mb-8 space-y-3">
                      <h2
                        className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white"
                        style={{
                          fontFamily: "Inter, sans-serif",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Join the Revolution
                      </h2>
                      <p
                        className="text-base sm:text-lg text-white/70"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        Be among the first to transform your business with
                        AI-powered outsourcing
                      </p>
                    </div>

                    <form
                      className="space-y-5"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const response = await fetch("/api/waitlist", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(contactForm),
                          });
                          if (response.ok) {
                            toast({
                              title: "Success!",
                              description:
                                "Thank you for your interest. We'll be in touch soon.",
                            });
                            setShowPortal(false);
                            setContactForm({
                              email: "",
                              fullName: "",
                              businessName: "",
                              phone: "",
                            });
                          } else {
                            toast({
                              title: "Error",
                              description:
                                "Failed to submit. Please try again.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Error",
                            description:
                              "Something went wrong. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      {/* Email */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="email"
                          className="text-white/90 text-sm font-medium"
                        >
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={contactForm.email}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              email: e.target.value,
                            })
                          }
                          required
                          className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12"
                          data-testid="input-contact-email"
                        />
                      </div>

                      {/* Full Name */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="fullName"
                          className="text-white/90 text-sm font-medium"
                        >
                          Full Name
                        </Label>
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="John Doe"
                          value={contactForm.fullName}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              fullName: e.target.value,
                            })
                          }
                          required
                          className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12"
                          data-testid="input-contact-fullname"
                        />
                      </div>

                      {/* Business Name */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="businessName"
                          className="text-white/90 text-sm font-medium"
                        >
                          Business Name
                        </Label>
                        <Input
                          id="businessName"
                          type="text"
                          placeholder="Your Company Inc."
                          value={contactForm.businessName}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              businessName: e.target.value,
                            })
                          }
                          className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12"
                          data-testid="input-contact-business"
                        />
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="phone"
                          className="text-white/90 text-sm font-medium"
                        >
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={contactForm.phone}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              phone: e.target.value,
                            })
                          }
                          className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12"
                          data-testid="input-contact-phone"
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full mt-6 relative group px-8 py-6 text-lg font-medium bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white border-0 hover:shadow-[0_0_40px_rgba(58,58,248,0.6)] transition-all duration-500 hover:scale-105"
                        data-testid="button-submit-contact"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          Submit
                          <CheckCircle2 className="w-5 h-5" />
                        </span>
                        <div className="absolute inset-0 rounded-md bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                      </Button>
                    </form>

                    <p
                      className="text-center text-xs text-white/40 mt-6"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Your information is secure and will never be shared
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : modalStep === "signin" ? (
          /* DEV ONLY: Sign In — dark futuristic style, no backend auth */
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" style={{ background: 'rgba(10,10,30,0.55)' }} />
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden"
              style={{ paddingTop: 'calc(72px + 24px)', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px' }}
            >
              <div
                className="relative animate-in fade-in slide-in-from-bottom-6 duration-500 flex flex-col w-full"
                style={{ maxWidth: '520px', maxHeight: 'calc(100vh - 72px - 48px)' }}
              >
                <DialogTitle className="sr-only">Sign In</DialogTitle>
                <button
                  onClick={() => setShowPortal(false)}
                  className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[#555B78]"
                >
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close</span>
                </button>
                <div
                  className="relative flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: '#C1C5DC',
                    border: '1px solid rgba(73,78,118,0.18)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
                  }}
                >
                  <div className="relative z-10 flex flex-col px-6 py-5 w-full">
                    {signinNeedsSetup ? (
                      /* ── Password Setup form (old candidate records with NULL password_hash) ── */
                      <>
                        <h2 className="text-3xl font-light text-[#17182C] mb-2" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Create a Password</h2>
                        <p className="text-[#555B78] mb-6 text-sm">Your profile exists but has no password yet. Set one now to access the Talent Portal.</p>
                        <div className="mb-5 px-4 py-3 rounded-xl border border-[rgba(73,78,118,0.24)] bg-[rgba(255,255,255,0.30)]">
                          <p className="text-[#555B78] text-xs mb-0.5">Signing in as</p>
                          <p className="text-[#17182C] text-sm font-medium truncate">{signinEmail}</p>
                        </div>
                        <div className="space-y-2 mb-4">
                          <Label className="text-[#30344F] text-sm font-medium">New Password</Label>
                          <div className="relative">
                            <Input
                              type={showSetupPw ? "text" : "password"}
                              placeholder="Minimum 8 characters"
                              value={setupPassword}
                              onChange={(e) => setSetupPassword(e.target.value)}
                              autoComplete="new-password"
                              className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12 pr-10"
                            />
                            <button type="button" onClick={() => setShowSetupPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                              {showSetupPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2 mb-2">
                          <Label className="text-[#30344F] text-sm font-medium">Confirm Password</Label>
                          <div className="relative">
                            <Input
                              type={showSetupConfirm ? "text" : "password"}
                              placeholder="Re-enter your new password"
                              value={setupConfirmPassword}
                              onChange={(e) => setSetupConfirmPassword(e.target.value)}
                              autoComplete="new-password"
                              className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12 pr-10"
                            />
                            <button type="button" onClick={() => setShowSetupConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                              {showSetupConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        {setupConfirmPassword && setupPassword !== setupConfirmPassword && (
                          <p className="text-red-400 text-xs mb-2">Passwords do not match.</p>
                        )}
                        <div className="mb-6" />
                        <button
                          onClick={async () => {
                            if (!setupPassword || !setupConfirmPassword) return;
                            if (setupPassword.length < 8) {
                              toast({ variant: "destructive", title: "Password too short", description: "Must be at least 8 characters." });
                              return;
                            }
                            if (setupPassword !== setupConfirmPassword) {
                              toast({ variant: "destructive", title: "Passwords don't match" });
                              return;
                            }
                            setSetupLoading(true);
                            try {
                              const res = await fetch("/api/candidates/setup-password", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ email: signinEmail, newPassword: setupPassword }),
                              });
                              const data = await res.json();
                              if (!res.ok) {
                                const msg = data.error === "password_exists"
                                  ? "A password is already set. Please sign in or use Forgot Password."
                                  : data.error || data.message || "Could not set password.";
                                toast({ variant: "destructive", title: "Setup failed", description: msg });
                                return;
                              }
                              const auth: TalentAuthState = {
                                token: data.token,
                                candidateId: data.candidate.id,
                                email: data.candidate.email,
                                fullName: data.candidate.fullName || data.candidate.email,
                              };
                              saveTalentAuth(auth);
                              setTalentAuth(auth);
                              setShowPortal(false);
                              setModalStep("signin");
                              setSigninNeedsSetup(false);
                              toast({ title: "Password created!", description: `Welcome, ${auth.fullName}!` });
                              navigate(`/talent-profile/${auth.candidateId}`);
                            } catch {
                              toast({ variant: "destructive", title: "Network error", description: "Could not reach the server. Please try again." });
                            } finally {
                              setSetupLoading(false);
                            }
                          }}
                          disabled={setupLoading || !setupPassword || !setupConfirmPassword || setupPassword !== setupConfirmPassword || setupPassword.length < 8}
                          className="relative group w-full px-8 py-4 text-base font-semibold text-white rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                          style={{ background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)', boxShadow: '0 8px 30px rgba(58,58,248,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {setupLoading ? "Setting up…" : <><span>Create Password & Sign In</span> <ArrowRight className="w-4 h-4" /></>}
                          </span>
                        </button>
                        <p className="text-center text-xs text-[#858BA5] mt-4">
                          <button className="text-[#555B78] hover:text-[#17182C] underline transition-colors" onClick={() => { setSigninNeedsSetup(false); setSetupPassword(""); setSetupConfirmPassword(""); }}>
                            Back to sign in
                          </button>
                        </p>
                      </>
                    ) : (
                      /* ── Normal Sign In form ── */
                      <>
                        <h2 className="text-2xl font-light text-[#17182C] mb-1" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Sign In</h2>
                        <p className="text-[#555B78] mb-3 text-sm">Welcome back to OnSpot.</p>
                        <div className="space-y-1 mb-3">
                          <Label className="text-[#30344F] text-xs font-medium">Email Address</Label>
                          <Input type="email" placeholder="you@example.com" value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} autoComplete="email" className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10" />
                        </div>
                        <div className="space-y-1 mb-2">
                          <Label className="text-[#30344F] text-xs font-medium">Password</Label>
                          <div className="relative">
                            <Input type={showAuthPassword ? "text" : "password"} placeholder="Enter your password" value={signinPassword} onChange={(e) => setSigninPassword(e.target.value)} autoComplete="off" className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10 pr-10" />
                            <button type="button" onClick={() => setShowAuthPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                              {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-end mb-3">
                          <button
                            type="button"
                            onClick={() => { setForgotEmail(signinEmail); setModalStep("forgot"); }}
                            className="text-xs text-[#3A3AF8] hover:text-[#17182C] transition-colors duration-200 underline underline-offset-2"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="mb-3">
                          <p className="text-[#30344F] text-xs font-medium mb-2">Select Your Portal</p>
                          <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setSigninPortal("client")} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${signinPortal === "client" ? 'border-2 border-[#5B7CFF] bg-[#3A3AF8]/10' : 'border border-[rgba(73,78,118,0.24)] bg-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.28)] hover:border-[rgba(73,78,118,0.40)]'}`}>
                              <Building className="w-5 h-5 text-[#30344F] shrink-0" />
                              <div className="text-left">
                                <p className="font-semibold text-[#17182C] text-xs leading-tight">Client Portal</p>
                                <p className="text-[#555B78] text-xs leading-tight">Manage talent</p>
                              </div>
                              {signinPortal === "client" && <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#5B7CFF] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                            </button>
                            <button type="button" onClick={() => setSigninPortal("talent")} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${signinPortal === "talent" ? 'border-2 border-[hsl(var(--gold-yellow)/0.8)] bg-[hsl(var(--gold-yellow)/0.12)]' : 'border border-[rgba(73,78,118,0.24)] bg-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.28)] hover:border-[rgba(73,78,118,0.40)]'}`}>
                              <User className="w-5 h-5 text-[#30344F] shrink-0" />
                              <div className="text-left">
                                <p className="font-semibold text-[#17182C] text-xs leading-tight">Talent Portal</p>
                                <p className="text-[#555B78] text-xs leading-tight">Find jobs &amp; manage profile</p>
                              </div>
                              {signinPortal === "talent" && <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[hsl(var(--gold-yellow)/0.8)] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                            </button>
                          </div>
                        </div>
                        {/* Sign In — shared logic via usePortalLogin hook */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (signinLoading || rateLimitCountdown > 0) return;
                            if (!signinEmail || !signinPassword || !signinPortal) return;
                            setSigninLoading(true);
                            try {
                              const result = await signInToPortal(signinPortal, signinEmail, signinPassword);
                              if (!result.success) {
                                if (result.requiresPasswordSetup) {
                                  setSigninNeedsSetup(true);
                                  return;
                                }
                                if (result.rateLimited) {
                                  const secs = result.retryAfter ?? 60;
                                  setRateLimitCountdown(secs);
                                  const timer = setInterval(() => {
                                    setRateLimitCountdown((prev) => {
                                      if (prev <= 1) { clearInterval(timer); return 0; }
                                      return prev - 1;
                                    });
                                  }, 1000);
                                  toast({
                                    variant: "destructive",
                                    title: "Too many attempts",
                                    description: result.message,
                                  });
                                  return;
                                }
                                toast({
                                  variant: "destructive",
                                  title: "Sign in failed",
                                  description: (
                                    <span>
                                      {result.message}{" "}
                                      <button
                                        type="button"
                                        className="underline font-semibold ml-1"
                                        onClick={() => { setForgotEmail(signinEmail); setModalStep("forgot"); }}
                                      >
                                        Forgot password?
                                      </button>
                                    </span>
                                  ) as any,
                                });
                                return;
                              }
                              if (result.portal === "talent") {
                                setTalentAuth(result.auth);
                              }
                              setSigninEmail(""); setSigninPassword(""); setSigninPortal(null);
                              setShowPortal(false); setModalStep("signin");
                              const displayName = result.portal === "talent" ? result.auth.fullName : result.displayName;
                              toast({ title: "Signed in", description: `Welcome back, ${displayName}!` });
                              navigate(result.redirectTo);
                            } finally {
                              setSigninLoading(false);
                            }
                          }}
                          disabled={signinLoading || rateLimitCountdown > 0 || !signinPortal || !signinEmail || !signinPassword}
                          className="relative group w-full px-8 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                          style={{ background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)', boxShadow: '0 8px 30px rgba(58,58,248,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {signinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {signinLoading
                              ? "Signing in…"
                              : rateLimitCountdown > 0
                                ? `Try again in ${rateLimitCountdown}s`
                                : <><span>Continue</span> <ArrowRight className="w-4 h-4" /></>}
                          </span>
                        </button>
                        <p className="text-center text-xs text-[#858BA5] mt-2.5">
                          Don't have an account?{' '}
                          <button className="text-[#555B78] hover:text-[#17182C] underline transition-colors" onClick={() => setModalStep("signup")}>Sign Up</button>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : modalStep === "signup" ? (
          /* Sign Up — compact two-column card, centered vertically, fits 1280×720 */
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" style={{ background: 'rgba(10,10,30,0.55)' }} />
            {/* Center vertically; overflow-y-auto only as a fallback for very short/zoomed viewports */}
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ paddingTop: 'calc(72px + 24px)', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px' }}>
              <div
                className="relative animate-in fade-in slide-in-from-bottom-6 duration-500 w-full my-auto"
                style={{ maxWidth: '640px' }}
              >
                <DialogTitle className="sr-only">Create Account</DialogTitle>
                {/* Card */}
                <div
                  className="relative rounded-2xl"
                  style={{
                    background: '#C1C5DC',
                    border: '1px solid rgba(73,78,118,0.18)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
                  }}
                >
                  {/* ── Header row: title + close button ── */}
                  <div className="flex items-start justify-between px-6 pt-5 pb-3">
                    <div>
                      <h2 className="text-2xl font-light text-[#17182C]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Create Account</h2>
                      <p className="text-[#555B78] text-sm mt-0.5">Join OnSpot as a Client or Talent.</p>
                    </div>
                    <button
                      onClick={() => setShowPortal(false)}
                      aria-label="Close"
                      className="ml-4 mt-1 shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[#555B78]"
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </button>
                  </div>

                  {/* ── Form body — two-column grid, no internal scroll on normal viewports ── */}
                  <div className="px-6 pb-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">

                      {/* Row 1: First Name | Last Name */}
                      <div className="space-y-1">
                        <Label className="text-[#30344F] text-xs font-medium">First Name</Label>
                        <Input placeholder="John" value={signupFirstName} onChange={(e) => setSignupFirstName(e.target.value)} className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[#30344F] text-xs font-medium">Last Name</Label>
                        <Input placeholder="Doe" value={signupLastName} onChange={(e) => setSignupLastName(e.target.value)} className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10" />
                      </div>

                      {/* Row 2: Email — full width */}
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[#30344F] text-xs font-medium">Email Address</Label>
                        <Input type="email" placeholder="you@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} autoComplete="email" className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10" />
                      </div>

                      {/* Row 3: Password | Confirm Password */}
                      <div className="space-y-1">
                        <Label className="text-[#30344F] text-xs font-medium">Password</Label>
                        <div className="relative">
                          <Input type={showSignupPassword ? "text" : "password"} placeholder="Min. 8 chars" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} autoComplete="new-password" name="new-password" className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10 pr-10" />
                          <button type="button" onClick={() => setShowSignupPassword(v => !v)} aria-label={showSignupPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                            {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[#30344F] text-xs font-medium">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            type={showSignupConfirm ? "text" : "password"}
                            placeholder="Repeat password"
                            value={signupConfirmPassword}
                            onChange={(e) => setSignupConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            name="confirm-new-password"
                            className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-10 pr-10"
                          />
                          <button type="button" onClick={() => setShowSignupConfirm(v => !v)} aria-label={showSignupConfirm ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                            {showSignupConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {signupConfirmPassword && signupPassword !== signupConfirmPassword && (
                          <p className="text-xs text-red-500 mt-0.5">Passwords do not match.</p>
                        )}
                      </div>

                      {/* Row 4: Role selector — full width, compact horizontal cards ~60px tall */}
                      <div className="col-span-2 space-y-1.5">
                        <p className="text-[#30344F] text-xs font-medium">I am a…</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" onClick={() => setSignupRole("client")} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${signupRole === "client" ? 'border-2 border-[#5B7CFF] bg-[#3A3AF8]/10' : 'border border-[rgba(73,78,118,0.24)] bg-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.28)] hover:border-[rgba(73,78,118,0.40)]'}`}>
                            <Building className="w-5 h-5 text-[#30344F] shrink-0" />
                            <div className="text-left">
                              <p className="font-semibold text-[#17182C] text-xs leading-tight">Client</p>
                              <p className="text-[#555B78] text-xs leading-tight">Hire talent</p>
                            </div>
                            {signupRole === "client" && <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#5B7CFF] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                          </button>
                          <button type="button" onClick={() => setSignupRole("talent")} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${signupRole === "talent" ? 'border-2 border-[hsl(var(--gold-yellow)/0.8)] bg-[hsl(var(--gold-yellow)/0.12)]' : 'border border-[rgba(73,78,118,0.24)] bg-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.28)] hover:border-[rgba(73,78,118,0.40)]'}`}>
                            <User className="w-5 h-5 text-[#30344F] shrink-0" />
                            <div className="text-left">
                              <p className="font-semibold text-[#17182C] text-xs leading-tight">Talent</p>
                              <p className="text-[#555B78] text-xs leading-tight">Find work</p>
                            </div>
                            {signupRole === "talent" && <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[hsl(var(--gold-yellow)/0.8)] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                          </button>
                        </div>
                      </div>

                      {/* Row 5: Create Account button — full width */}
                      <div className="col-span-2 mt-1">
                        {/* Create Account — calls POST /api/signup, creates real DB record */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!signupRole || !signupFirstName || !signupEmail || !signupPassword || !signupConfirmPassword) return;
                            if (signupPassword !== signupConfirmPassword) {
                              toast({ variant: "destructive", title: "Passwords do not match", description: "Please make sure both password fields are identical." });
                              return;
                            }
                            // Capture values at click time before any async state changes
                            const capturedEmail = signupEmail;
                            const capturedPassword = signupPassword;
                            const capturedRole = signupRole;
                            const capturedFirstName = signupFirstName;
                            const capturedLastName = signupLastName;
                            setSignupLoading(true);
                            try {
                              const res = await fetch("/api/signup", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  email: capturedEmail,
                                  password: capturedPassword,
                                  first_name: signupFirstName,
                                  last_name: signupLastName,
                                  role: capturedRole,
                                }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                // Store JWT token + user so AuthContext picks it up
                                if (data.token) {
                                  localStorage.setItem("onspot_jwt_token", data.token);
                                }
                                if (data.user) {
                                  localStorage.setItem("onspot_user", JSON.stringify(data.user));
                                }
                                // Reset all signup form states so they don't linger
                                setSignupFirstName("");
                                setSignupLastName("");
                                setSignupEmail("");
                                setSignupPassword("");
                                setSignupConfirmPassword("");
                                setSignupRole(null);
                                // Reset visibility states back to defaults
                                setShowSignupPassword(false);
                                setShowSignupConfirm(false);
                                // Pre-seed the signin email so if the user logs out and returns,
                                // their email is already filled in
                                setSigninEmail(capturedEmail);
                                setShowPortal(false);
                                setModalStep("signin");
                                // Sync AuthContext state immediately (no page reload needed)
                                await refreshAuth();
                                // Talent signup: save candidate JWT + redirect to their own profile page.
                                // The signup endpoint now creates a candidates record and issues a
                                // talent-specific JWT alongside the general one.
                                if (capturedRole === "talent" && data.talentToken && data.candidateId) {
                                  const talentAuthData: TalentAuthState = {
                                    token: data.talentToken,
                                    candidateId: data.candidateId,
                                    email: capturedEmail,
                                    fullName: `${capturedFirstName} ${capturedLastName}`.trim(),
                                  };
                                  saveTalentAuth(talentAuthData);
                                  setTalentAuth(talentAuthData);
                                }
                                if (capturedRole === "client") {
                                  navigate("/client-profile");
                                } else if (capturedRole === "talent" && data.candidateId) {
                                  navigate(`/talent-profile/${data.candidateId}`);
                                } else {
                                  navigate("/find-best-matches");
                                }
                              } else if (res.status === 409) {
                                toast({ variant: "destructive", title: "Account already exists", description: "An account with this email already exists. Please sign in instead." });
                                setSigninEmail(capturedEmail);
                                setModalStep("signin");
                              } else {
                                toast({ variant: "destructive", title: "Sign up failed", description: data.message || "Could not create account. Please try again." });
                              }
                            } catch {
                              toast({ variant: "destructive", title: "Network error", description: "Could not reach the server. Please try again." });
                            } finally {
                              setSignupLoading(false);
                            }
                          }}
                          disabled={
                            signupLoading ||
                            !signupRole ||
                            !signupFirstName ||
                            !signupEmail ||
                            !signupPassword ||
                            !signupConfirmPassword ||
                            signupPassword !== signupConfirmPassword
                          }
                          className="relative group w-full px-8 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                          style={{ background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)', boxShadow: '0 8px 30px rgba(58,58,248,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {signupLoading ? "Creating account…" : <><span>Create Account</span> <ArrowRight className="w-4 h-4" /></>}
                          </span>
                        </button>
                        <p className="text-center text-xs text-[#858BA5] mt-2.5">
                          Already have an account?{' '}
                          <button className="text-[#555B78] hover:text-[#17182C] underline transition-colors" onClick={() => setModalStep("signin")}>Sign In</button>
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : modalStep === "forgot" ? (
          /* DEV ONLY: Forgot Password step — same dark futuristic shell as signin/signup */
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" style={{ background: 'rgba(10,10,30,0.55)' }} />
            <div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
              style={{ padding: 'clamp(2rem, 5vh, 4rem)', minHeight: '100vh' }}
            >
              <div
                className="relative animate-in fade-in slide-in-from-bottom-6 duration-500 my-auto"
                style={{ width: 'min(90%, 520px)', maxHeight: '90vh' }}
              >
                <DialogTitle className="sr-only">Reset Password</DialogTitle>
                <button
                  onClick={() => setShowPortal(false)}
                  className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[#555B78]"
                >
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close</span>
                </button>
                <div
                  className="relative flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: '#C1C5DC',
                    border: '1px solid rgba(73,78,118,0.18)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
                    minHeight: 'min(560px, 80vh)',
                  }}
                >
                  <div className="relative z-10 flex flex-col px-8 py-10 w-full">
                    <button
                      onClick={() => setModalStep("signin")}
                      className="flex items-center gap-1.5 text-[#555B78] hover:text-[#17182C] text-sm mb-8 w-fit transition-colors duration-200"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to Sign In
                    </button>
                    <h2 className="text-3xl font-light text-[#17182C] mb-2" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Reset Password</h2>
                    <p className="text-[#555B78] mb-7 text-sm">Enter the email used for your account and choose a new password.</p>

                    {/* Email */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-[#30344F] text-sm font-medium">Email Address</Label>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        autoComplete="email"
                        className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12"
                      />
                    </div>

                    {/* New Password */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-[#30344F] text-sm font-medium">New Password</Label>
                      <div className="relative">
                        <Input
                          type={showForgotPwd ? "text" : "password"}
                          placeholder="Min 8 chars, upper, lower, number, symbol"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          autoComplete="new-password"
                          className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12 pr-10"
                        />
                        <button type="button" onClick={() => setShowForgotPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                          {showForgotPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2 mb-7">
                      <Label className="text-[#30344F] text-sm font-medium">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          type={showForgotConfirm ? "text" : "password"}
                          placeholder="Repeat your new password"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          className="bg-[rgba(255,255,255,0.44)] border-[rgba(73,78,118,0.20)] text-[#20223A] placeholder:text-[#858BA5] focus:border-[#7167E8] focus:ring-[#7167E8]/[0.14] h-12 pr-10"
                        />
                        <button type="button" onClick={() => setShowForgotConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA5] hover:text-[#30344F] transition-colors">
                          {showForgotConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {forgotConfirmPassword && forgotNewPassword !== forgotConfirmPassword && (
                        <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      onClick={async () => {
                        if (!forgotEmail || !forgotNewPassword || !forgotConfirmPassword) {
                          toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all fields." });
                          return;
                        }
                        if (forgotNewPassword !== forgotConfirmPassword) {
                          toast({ variant: "destructive", title: "Passwords don't match", description: "New password and confirmation must be the same." });
                          return;
                        }
                        setForgotLoading(true);
                        try {
                          const res = await fetch("/api/dev/reset-password", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPassword }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast({ title: "Password reset", description: data.message });
                            setSigninEmail(forgotEmail);
                            setForgotEmail("");
                            setForgotNewPassword("");
                            setForgotConfirmPassword("");
                            setModalStep("signin");
                          } else {
                            toast({ variant: "destructive", title: "Reset failed", description: data.message || "Could not reset password." });
                          }
                        } catch {
                          toast({ variant: "destructive", title: "Network error", description: "Please try again." });
                        } finally {
                          setForgotLoading(false);
                        }
                      }}
                      disabled={forgotLoading || !forgotEmail || !forgotNewPassword || !forgotConfirmPassword || forgotNewPassword !== forgotConfirmPassword}
                      className="relative group w-full px-8 py-4 text-base font-semibold text-white rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{ background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)', boxShadow: '0 8px 30px rgba(58,58,248,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {forgotLoading ? "Resetting…" : "Reset Password"}
                      </span>
                    </button>

                    <p className="text-center text-xs text-[#858BA5] mt-4">
                      Remembered it?{' '}
                      <button className="text-[#555B78] hover:text-[#17182C] underline transition-colors" onClick={() => setModalStep("signin")}>Sign In</button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : (
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" style={{ background: 'rgba(10,10,30,0.55)' }} />
            <div className="fixed inset-0 z-50 flex items-center justify-center pt-[100px] pb-8 px-4 overflow-y-auto">
              <div className="w-full max-w-lg sm:max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6 rounded-2xl border bg-background/95 p-8 shadow-xl backdrop-blur-md relative my-auto">
                {/* Close Button */}
                <button
                  onClick={() => setShowPortal(false)}
                  className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  data-testid="button-close-modal"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>

                {/* Step 3: Portal Selection */}
                {modalStep === 3 && (
                  <div
                    className="flex flex-col items-center space-y-8 py-8"
                    data-testid="modal-step-portal-selection"
                  >
                    <DialogHeader className="text-center space-y-4">
                      <div className="flex justify-center mb-2">
                        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 px-5 py-3">
                          <img
                            src={onspotLogo}
                            alt="OnSpot"
                            className="h-9 w-auto"
                          />
                        </div>
                      </div>
                      <DialogTitle className="text-2xl font-semibold">
                        Welcome to OnSpot
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground text-base mb-6">
                        Choose your portal to continue.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="w-full space-y-6">
                      {/* Portal Selection Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <Card
                          className="relative cursor-pointer hover-elevate hover:scale-[1.02] transition-all duration-300 group border-2 hover:border-primary/50"
                          onClick={() => {
                            setSelectedPortal("client");
                            setModalStep(4);
                          }}
                          data-testid="card-client-portal"
                        >
                          <CardContent className="p-6 sm:p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <Building className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">
                              Client Portal
                            </h3>
                            <p className="text-muted-foreground mb-4 leading-relaxed">
                              Access your hiring dashboard, manage projects, and
                              track performance.
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
                          className="relative cursor-pointer hover-elevate hover:scale-[1.02] transition-all duration-300 group border-2 hover:border-[hsl(var(--gold-yellow)/0.5)]"
                          onClick={() => {
                            setSelectedPortal("talent");
                            setSigninPortal("talent");
                            setModalStep("signin");
                          }}
                          data-testid="card-talent-portal"
                        >
                          <CardContent className="p-6 sm:p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-[hsl(var(--gold-yellow)/0.1)] rounded-full flex items-center justify-center group-hover:bg-[hsl(var(--gold-yellow)/0.2)] transition-colors">
                              <User className="w-8 h-8 text-[hsl(var(--gold-yellow)/0.8)]" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">
                              Talent Portal
                            </h3>
                            <p className="text-muted-foreground mb-4 leading-relaxed">
                              Access opportunities, manage your profile, and
                              track your career growth.
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

                      {/* Admin Portal Footer Button */}
                      <div className="mt-6 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowPortal(false);
                            window.location.href = "/admin/dashboard";
                          }}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-admin-portal"
                        >
                          🔑 Admin Portal
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Authentication Flow */}
                {modalStep === 4 && (
                  <div
                    className="flex flex-col items-center space-y-8 py-8"
                    data-testid="modal-step-authentication"
                  >
                    <DialogHeader className="text-center space-y-4">
                      <div className="flex justify-center mb-2">
                        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 px-5 py-3">
                          <img
                            src={onspotLogo}
                            alt="OnSpot"
                            className="h-9 w-auto"
                          />
                        </div>
                      </div>
                      <DialogTitle className="text-2xl font-semibold">
                        {selectedPortal === "client"
                          ? "Client Portal Access"
                          : "Talent Portal Access"}
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground text-base mb-6">
                        Please log in or create an account to continue to the{" "}
                        {selectedPortal === "client" ? "Client" : "Talent"}{" "}
                        Portal
                      </DialogDescription>
                    </DialogHeader>

                    {/* Auth Action Buttons */}
                    <div className="flex flex-col items-center gap-6 w-full">
                      <div className="flex gap-4 justify-center">
                        <LoginDialog />
                        <SignUpDialog />
                      </div>

                      <Separator className="w-full max-w-md" />

                      {/* Back button */}
                      <Button
                        variant="ghost"
                        onClick={() => setModalStep(3)}
                        data-testid="button-back-to-portal-selection"
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        ← Back to Portal Selection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogPortal>
        )}
      </Dialog>

    </>
  );
}
