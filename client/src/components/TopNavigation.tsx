import { Link, useLocation } from "wouter";
import { ErrorBoundaryWrapper } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Users,
  Zap,
  Building,
  User,
  Bot,
  ArrowRight,
  CheckCircle2,
  Code,
  PenTool,
  BarChart3,
  Headphones,
  Globe,
  Camera,
  FileText,
  Star,
  Info,
  Settings,
  Layers,
  Calculator,
  LogOut,
  Loader2,
  Shield,
  Mail,
  Briefcase,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { NeuralBrain } from "@/components/NeuralBrain";
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
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";
import { VanessaChat } from "@/components/VanessaChat";

// Service definitions for mega menu
const serviceDetails = {
  managed: {
    title: "Managed Services",
    subtitle: "We manage everything",
    description:
      "Full end-to-end management with KPI accountability and 24/7 support",
    icon: Zap,
    features: [
      "Dedicated team manager",
      "24/7 support",
      "KPI accountability",
      "Process building",
    ],
    pricing: "From $200 + role rate",
    scale: "5-50 FTE",
    path: "/services/managed",
    popular: true,
  },
  resourced: {
    title: "Resourced Services",
    subtitle: "You manage",
    description:
      "Direct control with cost savings - perfect for hands-on founders",
    icon: Users,
    features: [
      "Flat FTE rate",
      "Dedicated account manager",
      "Standard support",
      "Direct control",
    ],
    pricing: "From $200 + role rate",
    scale: "1-20 FTE",
    path: "/services/resourced",
    popular: false,
  },
  enterprise: {
    title: "Enterprise Services",
    subtitle: "Custom at scale",
    description:
      "Enterprise-grade scalability with full customization for large organizations",
    icon: Building,
    features: [
      "1,000+ FTE capacity",
      "Custom integrations",
      "Enterprise reporting",
      "Dedicated campaign team",
    ],
    pricing: "Custom quote",
    scale: ">50 FTE",
    path: "/services/enterprise",
    popular: false,
  },
  humanVA: {
    title: "Human Virtual Assistant",
    subtitle: "Personal productivity",
    description:
      "Skilled human assistants for complex tasks requiring creativity and judgment",
    icon: User,
    features: [
      "Complex task handling",
      "Creative problem solving",
      "Personal attention",
      "Industry expertise",
    ],
    pricing: "From $400/month",
    scale: "1-5 VAs",
    path: "/services/human-va",
    popular: false,
  },
  aiVA: {
    title: "AI-Assistant",
    subtitle: "Automated efficiency",
    description:
      "AI-powered automation for repetitive tasks and data processing",
    icon: Bot,
    features: [
      "24/7 availability",
      "Data processing",
      "Automated workflows",
      "Cost effective",
    ],
    pricing: "From $99/month",
    scale: "Unlimited tasks",
    path: "/ai-assistant",
    popular: false,
  },
};

// Work categories for Find Work mega menu
const workCategories = {
  development: {
    title: "Development & IT",
    subtitle: "Build the digital future",
    description: "Full-stack development, mobile apps, and technical solutions",
    icon: Code,
    specialties: ["Web Development", "Mobile Apps", "AI/ML", "DevOps"],
    demand: "High",
    averageRate: "$35-65/hr",
    path: "/find-work/development",
    popular: true,
  },
  design: {
    title: "Design & Creative",
    subtitle: "Visual storytelling",
    description: "UI/UX design, branding, and creative content creation",
    icon: PenTool,
    specialties: ["UI/UX Design", "Branding", "Illustration", "Video Editing"],
    demand: "High",
    averageRate: "$25-45/hr",
    path: "/find-work/design",
    popular: true,
  },
  marketing: {
    title: "Sales & Marketing",
    subtitle: "Growth acceleration",
    description: "Digital marketing, content strategy, and sales optimization",
    icon: BarChart3,
    specialties: [
      "Digital Marketing",
      "Content Writing",
      "SEO/SEM",
      "Social Media",
    ],
    demand: "Very High",
    averageRate: "$20-40/hr",
    path: "/find-work/marketing",
    popular: false,
  },
  support: {
    title: "Admin & Support",
    subtitle: "Operational excellence",
    description:
      "Virtual assistance, customer support, and business operations",
    icon: Headphones,
    specialties: [
      "Virtual Assistant",
      "Customer Support",
      "Data Entry",
      "Project Management",
    ],
    demand: "Very High",
    averageRate: "$8-25/hr",
    path: "/find-work/support",
    popular: false,
  },
  writing: {
    title: "Writing & Translation",
    subtitle: "Global communication",
    description: "Content creation, technical writing, and language services",
    icon: Globe,
    specialties: [
      "Content Writing",
      "Technical Writing",
      "Translation",
      "Copywriting",
    ],
    demand: "High",
    averageRate: "$15-35/hr",
    path: "/find-work/writing",
    popular: false,
  },
  media: {
    title: "Audio, Video & Animation",
    subtitle: "Media production",
    description:
      "Video editing, animation, audio production, and multimedia content",
    icon: Camera,
    specialties: [
      "Video Editing",
      "Animation",
      "Audio Production",
      "3D Modeling",
    ],
    demand: "Medium",
    averageRate: "$20-50/hr",
    path: "/find-work/media",
    popular: false,
  },
};

// Why OnSpot sections for mega menu
const whyOnSpotSections = {
  caseStudies: {
    title: "Case Studies",
    subtitle: "Real success stories",
    description:
      "See how we've transformed businesses and delivered measurable results",
    icon: FileText,
    highlights: [
      "8X Growth Stories",
      "ROI Case Studies",
      "Client Transformations",
      "Before/After Analysis",
    ],
    path: "/why-onspot/case-studies",
    popular: true,
  },
  reviews: {
    title: "Reviews",
    subtitle: "Client testimonials",
    description: "Hear directly from our clients about their OnSpot experience",
    icon: Star,
    highlights: [
      "5-Star Reviews",
      "Video Testimonials",
      "Success Metrics",
      "Client Feedback",
    ],
    path: "/why-onspot/reviews",
    popular: false,
  },
  about: {
    title: "About OnSpot",
    subtitle: "Our story & mission",
    description: "Learn about our journey, values, and what makes us different",
    icon: Info,
    highlights: [
      "Our Story",
      "Leadership Team",
      "Company Values",
      "Global Presence",
    ],
    path: "/why-onspot/about",
    popular: false,
  },
  experience: {
    title: "The OnSpot Experience",
    subtitle: "How we work",
    description: "Discover our proven 4-stage system for seamless outsourcing",
    icon: Settings,
    highlights: [
      "4-Stage System",
      "Implementation Process",
      "Team Building",
      "Innovation Lab",
    ],
    path: "/why-onspot/experience",
    popular: true,
  },
  integrator: {
    title: "The OnSpot Integrator System",
    subtitle: "Our methodology",
    description:
      "Deep dive into our proprietary system for outsourcing success",
    icon: Layers,
    highlights: [
      "Proven Framework",
      "Best Practices",
      "Process Optimization",
      "Continuous Improvement",
    ],
    path: "/why-onspot/integrator-system",
    popular: false,
  },
  valueCalculator: {
    title: "Value Calculator",
    subtitle: "Calculate your ROI",
    description:
      "Comprehensive calculator to assess your potential ROI and value return from outsourcing",
    icon: Calculator,
    highlights: [
      "ROI Assessment",
      "Cost Savings Analysis",
      "Value Projection",
      "Custom Scenarios",
    ],
    path: "/why-onspot/value-calculator",
    popular: true,
  },
};

const navigationItems = [
  { title: "Hire Talent", path: "/hire-talent" },
  {
    title: "Find Work",
    path: "/find-work",
    megaMenu: true,
    categories: workCategories,
  },
  {
    title: "Why OnSpot",
    path: "/why-onspot",
    megaMenu: true,
    whyOnSpot: whyOnSpotSections,
  },
  {
    title: "Solutions",
    path: "/services",
    megaMenu: true,
    services: serviceDetails,
  },
  { title: "Amazing", path: "/amazing" },
];

export function TopNavigation() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPortal, setSelectedPortal] = useState<
    "client" | "talent" | null
  >(null);
  const [contactForm, setContactForm] = useState({
    email: "",
    fullName: "",
    businessName: "",
    phone: "",
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<number>(navigationItems.length);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const navLinksRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // Dropdown handlers
  const handleMouseEnter = (title: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(title);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 300);
  };

  const handleDropdownMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
  };

  const handleDropdownMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

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
          className="mx-auto flex items-center justify-between relative"
          style={{
            height: 'var(--nav-h)',
            paddingLeft: 'clamp(16px, 4vw, 24px)',
            paddingRight: 'clamp(16px, 4vw, 24px)',
            maxWidth: 'min(1200px, 92vw)',
            width: '100%',
          }}
        >
          {/* Zone 1: Logo */}
          <Link
            href="/"
            className="flex items-center relative z-10 hover-elevate transition-all duration-300 flex-shrink-0"
            data-testid="logo-home"
          >
            <img
              src={onspotLogo}
              alt="OnSpot"
              className="h-8 w-auto brightness-0 saturate-100 invert drop-shadow-sm"
            />
          </Link>

          {/* Zone 2: Desktop Navigation Links (centered) */}
          <div 
            ref={navLinksRef}
            className="hidden md:flex items-center relative z-10 flex-1 justify-center"
            style={{ 
              gap: 'clamp(8px, 1.2vw, 16px)',
              flexWrap: 'nowrap',
            }}
          >
            {navigationItems.slice(0, visibleItems).map((item, index) => {
              const hasMegaMenu = "megaMenu" in item && item.megaMenu;
              const isActive =
                location === item.path ||
                (hasMegaMenu &&
                  item.services &&
                  Object.values(item.services).some(
                    (service) => location === service.path,
                  )) ||
                (hasMegaMenu &&
                  item.categories &&
                  Object.values(item.categories).some(
                    (category) => location === category.path,
                  )) ||
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
                    <div 
                      onMouseEnter={() => handleMouseEnter(item.title)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <button
                        className={`py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate flex items-center gap-1 whitespace-nowrap ${
                          isActive || activeDropdown === item.title
                            ? "text-white bg-white/10 border border-white/40"
                            : "text-white/90"
                        }`}
                        style={{ paddingLeft: 'clamp(10px, 1.2vw, 16px)', paddingRight: 'clamp(10px, 1.2vw, 16px)' }}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {item.title}
                        <ChevronDown className="h-3 w-3" />
                      </button>

                      {/* Desktop Mega Menu Dropdown */}
                      {activeDropdown === item.title && (
                        <>
                          {/* Page Scrim - dims background content */}
                          <div
                            className="fixed inset-0 bg-black/30 dark:bg-black/50"
                            style={{
                              zIndex: 99,
                              animation: "fadeIn 160ms ease-out",
                            }}
                            onMouseEnter={handleDropdownMouseLeave}
                          />
                          
                          {/* Mega Menu Panel */}
                          <div
                            className="absolute left-0 right-0 overflow-visible"
                            style={{
                              top: "100%",
                              paddingTop: "8px",
                              marginTop: "-8px",
                              zIndex: 100,
                            }}
                            onMouseEnter={handleDropdownMouseEnter}
                            onMouseLeave={handleDropdownMouseLeave}
                          >
                            <div
                              style={{
                                background: "rgba(44, 48, 114, 0.86)",
                                backdropFilter: "blur(24px)",
                                WebkitBackdropFilter: "blur(24px)",
                                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.08)",
                                borderRadius: "20px",
                                animation: "megaMenuIn 160ms ease-out",
                              }}
                            >
                            <div className="mx-auto max-w-7xl" style={{ padding: "32px" }}>
                              <div className="grid grid-cols-3 gap-8">
                                {/* Services dropdown */}
                                {item.services && Object.entries(item.services).map(([key, service]) => (
                                  <Link
                                    key={key}
                                    href={service.path}
                                    className="group block relative"
                                    style={{
                                      padding: "28px",
                                      borderRadius: "20px",
                                      background: "rgba(44, 48, 114, 0.72)",
                                      border: "1px solid rgba(255, 255, 255, 0.12)",
                                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                                      transition: "all 160ms ease-out",
                                    }}
                                    data-testid={`dropdown-link-${key}`}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = "translateY(-4px)";
                                      e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.18)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = "translateY(0)";
                                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.12)";
                                    }}
                                  >
                                    <h3 className="text-white font-bold text-base leading-tight mb-2 relative inline-block">
                                      {service.title}
                                      <span 
                                        className="absolute bottom-0 left-0 h-0.5 bg-white/80 transition-all duration-160"
                                        style={{
                                          width: "0",
                                        }}
                                        ref={(el) => {
                                          if (el) {
                                            const parent = el.parentElement?.parentElement;
                                            parent?.addEventListener('mouseenter', () => {
                                              el.style.width = '100%';
                                            });
                                            parent?.addEventListener('mouseleave', () => {
                                              el.style.width = '0';
                                            });
                                          }
                                        }}
                                      />
                                    </h3>
                                    <p className="text-white/75 text-sm leading-relaxed">
                                      {service.subtitle}
                                    </p>
                                  </Link>
                                ))}
                                
                                {/* Work categories dropdown */}
                                {item.categories && Object.entries(item.categories).map(([key, category]) => (
                                  <Link
                                    key={key}
                                    href={category.path}
                                    className="group block relative"
                                    style={{
                                      padding: "28px",
                                      borderRadius: "20px",
                                      background: "rgba(44, 48, 114, 0.72)",
                                      border: "1px solid rgba(255, 255, 255, 0.12)",
                                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                                      transition: "all 160ms ease-out",
                                    }}
                                    data-testid={`dropdown-link-${key}`}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = "translateY(-4px)";
                                      e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.18)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = "translateY(0)";
                                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.12)";
                                    }}
                                  >
                                    <h3 className="text-white font-bold text-base leading-tight mb-2 relative inline-block">
                                      {category.title}
                                      <span 
                                        className="absolute bottom-0 left-0 h-0.5 bg-white/80 transition-all duration-160"
                                        style={{
                                          width: "0",
                                        }}
                                        ref={(el) => {
                                          if (el) {
                                            const parent = el.parentElement?.parentElement;
                                            parent?.addEventListener('mouseenter', () => {
                                              el.style.width = '100%';
                                            });
                                            parent?.addEventListener('mouseleave', () => {
                                              el.style.width = '0';
                                            });
                                          }
                                        }}
                                      />
                                    </h3>
                                    <p className="text-white/75 text-sm leading-relaxed">
                                      {category.subtitle}
                                    </p>
                                  </Link>
                                ))}
                                
                                {/* Why OnSpot dropdown */}
                                {item.whyOnSpot && Object.entries(item.whyOnSpot).map(([key, section]) => (
                                  <Link
                                    key={key}
                                    href={section.path}
                                    className="group block relative"
                                    style={{
                                      padding: "28px",
                                      borderRadius: "20px",
                                      background: "rgba(44, 48, 114, 0.72)",
                                      border: "1px solid rgba(255, 255, 255, 0.12)",
                                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                                      transition: "all 160ms ease-out",
                                    }}
                                    data-testid={`dropdown-link-${key}`}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = "translateY(-4px)";
                                      e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.18)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = "translateY(0)";
                                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.12)";
                                    }}
                                  >
                                    <h3 className="text-white font-bold text-base leading-tight mb-2 relative inline-block">
                                      {section.title}
                                      <span 
                                        className="absolute bottom-0 left-0 h-0.5 bg-white/80 transition-all duration-160"
                                        style={{
                                          width: "0",
                                        }}
                                        ref={(el) => {
                                          if (el) {
                                            const parent = el.parentElement?.parentElement;
                                            parent?.addEventListener('mouseenter', () => {
                                              el.style.width = '100%';
                                            });
                                            parent?.addEventListener('mouseleave', () => {
                                              el.style.width = '0';
                                            });
                                          }
                                        }}
                                      />
                                    </h3>
                                    <p className="text-white/75 text-sm leading-relaxed">
                                      {section.subtitle}
                                    </p>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={item.path}
                      className={`py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate whitespace-nowrap ${
                        location === item.path
                          ? "text-white bg-white/10 border border-white/40"
                          : "text-white/90"
                      }`}
                      style={{ paddingLeft: 'clamp(10px, 1.2vw, 16px)', paddingRight: 'clamp(10px, 1.2vw, 16px)' }}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
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
                  className="py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate flex items-center gap-1 text-white/90"
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

                {/* More dropdown menu */}
                {moreMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-3 w-64 overflow-hidden"
                    style={{
                      background: "rgba(44, 48, 114, 0.86)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      boxShadow: "0 24px 64px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.08)",
                      borderRadius: "20px",
                      zIndex: 100,
                      animation: "megaMenuIn 160ms ease-out",
                    }}
                    role="menu"
                  >
                    <div className="py-3">
                      {navigationItems.slice(visibleItems).map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          className="block px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all duration-160"
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

          {/* Zone 3: Access Portal CTA (right) */}
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

            {/* Access Portal Button - Intelligent Design */}
            <button
              onClick={() => setShowPortal(true)}
              className="relative group hidden md:flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white whitespace-nowrap overflow-hidden transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)',
                boxShadow: '0 4px 15px rgba(58, 58, 248, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
              data-testid="access-portal-button"
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
                className="absolute inset-0 rounded-lg opacity-60 group-hover:opacity-100 blur-md transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(135deg, #3A3AF8 0%, #7F3DF4 100%)',
                  animation: 'portal-breathe 3s ease-in-out infinite',
                  zIndex: -1,
                }}
              ></div>
              
              <span className="relative z-10 flex items-center gap-2">
                <Zap className="w-4 h-4 animate-pulse" />
                Access Portal
              </span>
            </button>
          </div>
        </div>

      {/* Mobile Menu Panel - slide down with transform/opacity */}
      <div
        className={`mobile-menu-panel md:hidden fixed left-0 right-0 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] backdrop-blur-md border-t border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: 'var(--nav-h)',
          transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(-100%)',
          zIndex: 40,
        }}
      >
        <div className="max-h-[calc(100vh-var(--nav-h))] overflow-y-auto px-4 py-6">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const hasMegaMenu = "megaMenu" in item && item.megaMenu;
              const isExpanded = mobileAccordionOpen === item.title;

              if (hasMegaMenu) {
                return (
                  <div key={item.title} className="border-b border-white/10 pb-2">
                    <button
                      onClick={() => setMobileAccordionOpen(isExpanded ? null : item.title)}
                      className="w-full py-3 px-4 text-left text-white font-medium flex items-center justify-between hover:bg-white/10 rounded-lg transition-colors"
                      data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span>{item.title}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    
                    {/* Accordion Content */}
                    {isExpanded && (
                      <div 
                        className="mt-2 space-y-2 rounded-xl p-4 border border-white/20 shadow-lg backdrop-blur-sm"
                        style={{
                          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)'
                        }}
                      >
                        {/* Services dropdown */}
                        {item.services && Object.entries(item.services).map(([key, service]) => (
                          <Link
                            key={key}
                            href={service.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block py-3 px-4 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 rounded-lg text-base transition-all duration-200 font-semibold shadow-md border border-white/10"
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
                            className="block py-3 px-4 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 rounded-lg text-base transition-all duration-200 font-semibold shadow-md border border-white/10"
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
                            className="block py-3 px-4 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 rounded-lg text-base transition-all duration-200 font-semibold shadow-md border border-white/10"
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
                  className={`block py-3 px-4 text-white font-medium hover:bg-white/10 rounded-lg transition-colors ${
                    location === item.path ? "bg-white/10" : ""
                  }`}
                  data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => { setShowPortal(true); setIsMobileMenuOpen(false); }}
            className="relative group w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-bold text-base text-white overflow-hidden transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 50%, #7F3DF4 100%)',
              boxShadow: '0 6px 20px rgba(58, 58, 248, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
            }}
            data-testid="mobile-access-portal"
          >
            {/* Animated shimmer overlay */}
            <div 
              className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                animation: 'shimmer 2s infinite',
              }}
            ></div>
            
            {/* Breathing glow effect */}
            <div 
              className="absolute inset-0 rounded-lg opacity-70 blur-lg transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, #3A3AF8 0%, #7F3DF4 100%)',
                animation: 'portal-breathe 3s ease-in-out infinite',
                zIndex: -1,
              }}
            ></div>
            
            <span className="relative z-10 flex items-center gap-2">
              <Zap className="w-5 h-5 animate-pulse" />
              Access Portal
            </span>
          </button>
        </div>
      </div>

      {/* Access Portal Modal - All Steps */}
      <Dialog
        open={showPortal}
        onOpenChange={(open) => {
          setShowPortal(open);
          if (!open) {
            // Reset modal state when closing
            setModalStep(1);
            setSelectedPortal(null);
          }
        }}
      >
        {/* Step 1: Cinematic Awakening Modal */}
        {modalStep === 1 ? (
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" />
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

                    {/* Microtext */}
                    <p
                      className="text-sm text-white/40 animate-in fade-in duration-1000"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        animationDelay: "1700ms",
                        animationFillMode: "backwards",
                      }}
                    >
                      Your AI-powered outsourcing revolution starts now
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : modalStep === 2 ? (
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" />
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
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] focus:ring-[#3A3AF8]/50 backdrop-blur-sm h-12"
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
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] focus:ring-[#3A3AF8]/50 backdrop-blur-sm h-12"
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
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] focus:ring-[#3A3AF8]/50 backdrop-blur-sm h-12"
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
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#3A3AF8] focus:ring-[#3A3AF8]/50 backdrop-blur-sm h-12"
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
        ) : (
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" />
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
                        <img
                          src={onspotLogo}
                          alt="OnSpot"
                          className="h-12 w-auto"
                        />
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
                            setModalStep(4);
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
                        <img
                          src={onspotLogo}
                          alt="OnSpot"
                          className="h-12 w-auto"
                        />
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
    </nav>
    </>
  );
}

// Placeholder component - to be implemented properly later
function LoginDialog() {
  return (
    <Button variant="default" size="lg" data-testid="button-login">
      Log In
    </Button>
  );
}

// Placeholder component - to be implemented properly later
function SignUpDialog() {
  return (
    <Button variant="outline" size="lg" data-testid="button-signup">
      Sign Up
    </Button>
  );
}
