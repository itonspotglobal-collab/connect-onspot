import { Link, useLocation } from "wouter";
import { AccessPortalModal } from "@/components/AccessPortalModal";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

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
    title: "AI Virtual Assistant",
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
    path: "/services/ai-va",
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
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);

      // Update scrolled state for nav-over-hero styling
      setIsScrolled(currentScrollY > 16);

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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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
    }, 150);
  };

  const handleDropdownMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
  };

  const handleDropdownMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  return (
    <>
      {/* Navigation Spacer - prevents content overlap */}
      <div className="h-16" aria-hidden="true" />

      <nav
        className={`nav-over-hero transition-transform duration-300 ease-in-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
        data-scrolled={isScrolled}
      >
        <div className="container flex h-16 items-center justify-between px-4 relative">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center relative z-10 hover-elevate transition-all duration-300"
            data-testid="logo-home"
          >
            <img
              src={onspotLogo}
              alt="OnSpot"
              className="h-8 w-auto brightness-0 saturate-100 invert drop-shadow-sm"
            />
          </Link>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-2 relative z-10">
            {navigationItems.map((item) => {
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

              if (hasMegaMenu) {
                return (
                  <div
                    key={item.title}
                    className="relative"
                    onMouseEnter={() => handleMouseEnter(item.title)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate flex items-center gap-1 ${
                        isActive
                          ? "text-white bg-white/10 border border-white/40"
                          : "text-white/90"
                      }`}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {item.title}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          activeDropdown === item.title ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Services Mega Menu */}
                    {activeDropdown === item.title && item.services && (
                      <div
                        className="fixed top-16 left-1/2 transform -translate-x-1/2 mt-2 w-[min(100vw-2rem,1400px)] rounded-lg border border-white/20 backdrop-blur-md shadow-2xl z-50 mx-4"
                        style={{
                          background: "var(--gradient-investor-hero)",
                        }}
                        onMouseEnter={handleDropdownMouseEnter}
                        onMouseLeave={handleDropdownMouseLeave}
                      >
                        <div className="p-8">
                          <div className="mb-6">
                            <h3 className="text-2xl font-bold text-white mb-2">
                              Our Services
                            </h3>
                            <p className="text-white/80 text-sm">
                              Choose the perfect solution for your business
                              needs
                            </p>
                          </div>

                          <div className="grid grid-cols-5 gap-4">
                            {Object.entries(item.services).map(
                              ([key, service]) => (
                                <Card
                                  key={key}
                                  className="relative overflow-hidden border-white/20 bg-white/10 backdrop-blur-md hover-elevate transition-all duration-300 group"
                                >
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                  <CardContent className="relative p-4">
                                    <div className="flex items-start gap-4 mb-4">
                                      <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                                        <service.icon className="w-6 h-6 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h4 className="text-lg font-bold text-white truncate">
                                            {service.title}
                                          </h4>
                                          {service.popular && (
                                            <Badge className="bg-yellow-500 text-black text-xs px-2 py-1 font-semibold">
                                              Popular
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-white/70 text-sm font-medium mb-1">
                                          {service.subtitle}
                                        </p>
                                        <p className="text-white/60 text-xs leading-relaxed mb-3">
                                          {service.description}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-3 mb-4">
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <span className="text-white/70">
                                            Pricing:
                                          </span>
                                          <div className="text-white font-semibold">
                                            {service.pricing}
                                          </div>
                                        </div>
                                        <div>
                                          <span className="text-white/70">
                                            Scale:
                                          </span>
                                          <div className="text-white font-semibold">
                                            {service.scale}
                                          </div>
                                        </div>
                                      </div>

                                      <div>
                                        <span className="text-white/70 text-xs">
                                          Key Features:
                                        </span>
                                        <ul className="mt-1 space-y-1">
                                          {service.features
                                            .slice(0, 2)
                                            .map((feature, index) => (
                                              <li
                                                key={index}
                                                className="flex items-center gap-2 text-xs"
                                              >
                                                <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                                                <span className="text-white/80 truncate">
                                                  {feature}
                                                </span>
                                              </li>
                                            ))}
                                        </ul>
                                      </div>
                                    </div>

                                    <Button
                                      asChild
                                      size="sm"
                                      className="w-full bg-white text-primary hover:bg-white/90 font-semibold transition-all duration-200 group-hover:shadow-lg"
                                    >
                                      <Link
                                        href={service.path}
                                        data-testid={`cta-learn-${key}`}
                                      >
                                        Learn More
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                      </Link>
                                    </Button>
                                  </CardContent>
                                </Card>
                              ),
                            )}
                          </div>

                          <div className="mt-8 pt-6 border-t border-white/20">
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                              <Button
                                asChild
                                size="lg"
                                className="bg-white text-primary hover:bg-white/90 font-semibold"
                              >
                                <Link
                                  href="/services"
                                  data-testid="cta-compare-services"
                                >
                                  Compare All Services
                                </Link>
                              </Button>
                              <Button
                                asChild
                                size="lg"
                                variant="outline"
                                className="border-white/50 text-white hover:bg-white/10"
                              >
                                <Link
                                  href="/contact"
                                  data-testid="cta-schedule-consultation"
                                >
                                  Schedule Consultation
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Find Work Categories Mega Menu */}
                    {activeDropdown === item.title && item.categories && (
                      <div
                        className="fixed top-16 left-1/2 transform -translate-x-1/2 mt-2 w-[min(100vw-2rem,1200px)] max-h-[calc(100vh-5rem)] rounded-lg border border-white/20 backdrop-blur-md shadow-2xl z-50 mx-4 overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)",
                        }}
                        onMouseEnter={handleDropdownMouseEnter}
                        onMouseLeave={handleDropdownMouseLeave}
                      >
                        {/* Sticky Header */}
                        <div className="sticky top-0 p-6 pb-4 border-b border-white/10 bg-gradient-to-b from-[#474ead] to-transparent backdrop-blur-sm z-10">
                          <div className="text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">
                              Find Your Perfect Opportunity
                            </h3>
                            <p className="text-white/80 text-sm max-w-2xl mx-auto">
                              Discover work that matches your skills and
                              ambitions across 6 major categories
                            </p>
                          </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto max-h-[calc(100vh-15rem)] px-6 pb-6">
                          <div className="py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                              {Object.entries(item.categories).map(
                                ([key, category]) => (
                                  <Card
                                    key={key}
                                    className="relative overflow-hidden border-white/20 bg-white/5 backdrop-blur-md hover-elevate transition-all duration-300 group hover:bg-white/10 hover:scale-[1.02] hover:shadow-2xl"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--gold-yellow)/0.1)] via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[hsl(var(--gold-yellow)/0.8)] transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>
                                    <CardContent className="relative p-6">
                                      <div className="flex items-start gap-4 mb-4">
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[hsl(var(--gold-yellow)/0.3)] to-[hsl(var(--gold-yellow)/0.1)] backdrop-blur-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                          <category.icon className="w-7 h-7 text-[hsl(var(--gold-yellow))] drop-shadow-sm" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-lg font-bold text-white truncate group-hover:text-[hsl(var(--gold-yellow)/0.95)] transition-colors duration-300">
                                              {category.title}
                                            </h4>
                                            {category.popular && (
                                              <Badge className="bg-[hsl(var(--gold-yellow))] text-black text-xs px-2 py-1 font-semibold animate-pulse">
                                                Popular
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-white/75 text-sm font-medium mb-2 group-hover:text-white/90 transition-colors duration-300">
                                            {category.subtitle}
                                          </p>
                                          <p className="text-white/60 text-xs leading-relaxed mb-3 group-hover:text-white/75 transition-colors duration-300">
                                            {category.description}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="space-y-4 mb-5">
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                          <div className="bg-white/5 rounded-lg p-3 group-hover:bg-white/10 transition-colors duration-300">
                                            <span className="text-white/70 font-medium">
                                              Market Demand
                                            </span>
                                            <div className="text-white font-bold text-sm mt-1 flex items-center gap-1">
                                              {category.demand}
                                              <div
                                                className={`w-2 h-2 rounded-full ${
                                                  category.demand ===
                                                  "Very High"
                                                    ? "bg-green-400 animate-pulse"
                                                    : category.demand === "High"
                                                      ? "bg-yellow-400"
                                                      : "bg-blue-400"
                                                }`}
                                              ></div>
                                            </div>
                                          </div>
                                          <div className="bg-white/5 rounded-lg p-3 group-hover:bg-white/10 transition-colors duration-300">
                                            <span className="text-white/70 font-medium">
                                              Rate Range
                                            </span>
                                            <div className="text-[hsl(var(--gold-yellow))] font-bold text-sm mt-1">
                                              {category.averageRate}
                                            </div>
                                          </div>
                                        </div>

                                        <div>
                                          <span className="text-white/70 text-xs font-medium mb-2 block">
                                            Top Skills in Demand:
                                          </span>
                                          <div className="flex flex-wrap gap-2">
                                            {category.specialties
                                              .slice(0, 3)
                                              .map((specialty, index) => (
                                                <Badge
                                                  key={index}
                                                  variant="outline"
                                                  className="text-xs border-[hsl(var(--gold-yellow)/0.5)] text-[hsl(var(--gold-yellow)/0.9)] hover:bg-[hsl(var(--gold-yellow)/0.1)] transition-colors duration-200"
                                                >
                                                  {specialty}
                                                </Badge>
                                              ))}
                                            {category.specialties.length >
                                              3 && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs border-white/30 text-white/60"
                                              >
                                                +
                                                {category.specialties.length -
                                                  3}{" "}
                                                more
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <Button
                                          asChild
                                          size="sm"
                                          className="flex-1 bg-[hsl(var(--gold-yellow))] text-black hover:bg-[hsl(var(--gold-yellow)/0.9)] font-bold transition-all duration-300 group-hover:shadow-xl hover:shadow-[hsl(var(--gold-yellow)/0.3)] hover:scale-105"
                                        >
                                          <Link
                                            href={category.path}
                                            data-testid={`cta-browse-${key}`}
                                          >
                                            Browse Jobs
                                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                                          </Link>
                                        </Button>
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="outline"
                                          className="px-3 border-white/30 text-white/80 hover:bg-white/10 hover:border-white/50 transition-all duration-300"
                                        >
                                          <Link
                                            href={`${category.path}?action=learn`}
                                            data-testid={`link-learn-${key}`}
                                          >
                                            Learn More
                                          </Link>
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ),
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="sticky bottom-0 p-6 pt-4 border-t border-white/10 bg-gradient-to-t from-[#474ead] to-transparent backdrop-blur-sm">
                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                              asChild
                              size="lg"
                              className="bg-[hsl(var(--gold-yellow)/0.9)] text-black hover:bg-[hsl(var(--gold-yellow))] font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                              <Link
                                href="/find-work"
                                data-testid="cta-all-jobs"
                              >
                                View All Jobs
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              size="lg"
                              variant="outline"
                              className="border-white/50 text-white hover:bg-white/10 hover:border-white/70 transition-all duration-300"
                            >
                              <Link
                                href="/get-hired"
                                data-testid="cta-create-profile"
                              >
                                Create Talent Profile
                              </Link>
                            </Button>
                          </div>

                          {/* Scroll Indicator */}
                          <div className="flex justify-center mt-3">
                            <div className="text-white/50 text-xs flex items-center gap-1">
                              <ChevronDown className="w-3 h-3 animate-bounce" />
                              Scroll to explore all categories
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Why OnSpot Mega Menu */}
                    {activeDropdown === item.title && item.whyOnSpot && (
                      <div
                        className="fixed top-16 left-1/2 transform -translate-x-1/2 mt-2 w-[min(100vw-2rem,1200px)] max-h-[calc(100vh-5rem)] rounded-lg border border-white/20 backdrop-blur-md shadow-2xl z-50 mx-4 overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)",
                        }}
                        onMouseEnter={handleDropdownMouseEnter}
                        onMouseLeave={handleDropdownMouseLeave}
                      >
                        {/* Sticky Header */}
                        <div className="sticky top-0 p-6 pb-4 border-b border-white/10 bg-gradient-to-b from-[#474ead] to-transparent backdrop-blur-sm z-10">
                          <div className="text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">
                              Why Choose OnSpot?
                            </h3>
                            <p className="text-white/80 text-sm max-w-2xl mx-auto">
                              Discover what makes OnSpot the trusted choice for
                              effortless outsourcing
                            </p>
                          </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto max-h-[calc(100vh-15rem)] px-6 pb-6">
                          <div className="py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                              {Object.entries(item.whyOnSpot).map(
                                ([key, section]) => (
                                  <Card
                                    key={key}
                                    className="relative overflow-hidden border-white/20 bg-white/5 backdrop-blur-md hover-elevate transition-all duration-300 group hover:bg-white/10 hover:scale-[1.02] hover:shadow-2xl"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/80 transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>
                                    <CardContent className="relative p-6">
                                      <div className="flex items-start gap-4 mb-4">
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                          <section.icon className="w-7 h-7 text-primary drop-shadow-sm" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-lg font-bold text-white truncate group-hover:text-primary/95 transition-colors duration-300">
                                              {section.title}
                                            </h4>
                                            {section.popular && (
                                              <Badge className="bg-primary text-white text-xs px-2 py-1 font-semibold animate-pulse">
                                                Popular
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-white/75 text-sm font-medium mb-2 group-hover:text-white/90 transition-colors duration-300">
                                            {section.subtitle}
                                          </p>
                                          <p className="text-white/60 text-xs leading-relaxed mb-3 group-hover:text-white/75 transition-colors duration-300">
                                            {section.description}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="space-y-4 mb-5">
                                        <div>
                                          <span className="text-white/70 text-xs font-medium mb-2 block">
                                            Key Highlights:
                                          </span>
                                          <div className="flex flex-wrap gap-2">
                                            {section.highlights
                                              .slice(0, 3)
                                              .map((highlight, index) => (
                                                <Badge
                                                  key={index}
                                                  variant="outline"
                                                  className="text-xs border-primary/50 text-primary/90 hover:bg-primary/10 transition-colors duration-200"
                                                >
                                                  {highlight}
                                                </Badge>
                                              ))}
                                            {section.highlights.length > 3 && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs border-white/30 text-white/60"
                                              >
                                                +{section.highlights.length - 3}{" "}
                                                more
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <Button
                                          asChild
                                          size="sm"
                                          className="flex-1 bg-primary text-white hover:bg-primary/90 font-bold transition-all duration-300 group-hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
                                        >
                                          <Link
                                            href={section.path}
                                            data-testid={`cta-explore-${key}`}
                                          >
                                            Explore
                                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                                          </Link>
                                        </Button>
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="outline"
                                          className="px-3 border-white/30 text-white/80 hover:bg-white/10 hover:border-white/50 transition-all duration-300"
                                        >
                                          <Link
                                            href={`${section.path}?action=learn`}
                                            data-testid={`link-learn-${key}`}
                                          >
                                            Learn More
                                          </Link>
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ),
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="sticky bottom-0 p-6 pt-4 border-t border-white/10 bg-gradient-to-t from-[#474ead] to-transparent backdrop-blur-sm">
                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                              asChild
                              size="lg"
                              className="bg-primary text-white hover:bg-primary/90 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                              <Link
                                href="/why-onspot/about"
                                data-testid="cta-learn-more"
                              >
                                Learn More About OnSpot
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              size="lg"
                              variant="outline"
                              className="border-white/50 text-white hover:bg-white/10 hover:border-white/70 transition-all duration-300"
                            >
                              <Link
                                href="/hire-talent"
                                data-testid="cta-get-started"
                              >
                                Get Started Today
                              </Link>
                            </Button>
                          </div>

                          {/* Scroll Indicator */}
                          <div className="flex justify-center mt-3">
                            <div className="text-white/50 text-xs flex items-center gap-1">
                              <ChevronDown className="w-3 h-3 animate-bounce" />
                              Scroll to explore all sections
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
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
              );
            })}
          </div>

          {/* Authentication Section */}
          <div className="flex items-center gap-3 relative z-10">
            {isLoading ? (
              // Loading state during authentication check
              <div
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/80"
                data-testid="auth-loading"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : isAuthenticated && user ? (
              // Authenticated user menu
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/10 border border-white/30 rounded-lg"
                    data-testid="user-menu-trigger"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={user.profileImageUrl || undefined}
                        alt={user.firstName || user.email}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {user.firstName
                          ? user.firstName.charAt(0).toUpperCase()
                          : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium">
                        {user.firstName ||
                          user.username ||
                          user.email.split("@")[0]}
                      </span>
                      <span className="text-xs text-white/70 capitalize">
                        {user.role}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={user.profileImageUrl || undefined}
                        alt={user.firstName || user.email}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {user.firstName
                          ? user.firstName.charAt(0).toUpperCase()
                          : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName || user.username || "User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Navigation based on user type */}
                  {user.role === "client" ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/dashboard"
                          className="w-full"
                          data-testid="menu-dashboard"
                        >
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/talent"
                          className="w-full"
                          data-testid="menu-find-talent"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Find Talent
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/hired-talent-portal"
                          className="w-full"
                          data-testid="menu-talent-portal"
                        >
                          <User className="w-4 h-4 mr-2" />
                          Talent Portal
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/find-work"
                          className="w-full"
                          data-testid="menu-find-work"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Find Work
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings"
                      className="w-full"
                      data-testid="menu-settings"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      setIsLoggingOut(true);
                      try {
                        await logout();
                        console.log("✅ User logged out successfully");
                      } catch (error) {
                        console.error("❌ Logout failed:", error);
                      } finally {
                        setIsLoggingOut(false);
                      }
                    }}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                    data-testid="menu-logout"
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Logging out...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Not authenticated - show access portal button
              <AccessPortalModal />
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-white/20">
          <div className="container px-4 py-3">
            <div className="flex flex-wrap gap-2 justify-center">
              {navigationItems.map((item) => {
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
                    ));

                if (hasMegaMenu) {
                  return (
                    <div key={item.title} className="relative">
                      <button
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === item.title ? null : item.title,
                          )
                        }
                        className={`px-3 py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate min-h-[44px] flex items-center gap-1 ${
                          isActive
                            ? "text-white bg-white/10 border border-white/30"
                            : "text-white/90"
                        }`}
                        data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {item.title}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            activeDropdown === item.title ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {/* Mobile Services Menu */}
                      {activeDropdown === item.title && item.services && (
                        <div
                          className="absolute top-full left-0 mt-2 w-80 rounded-lg border border-white/20 backdrop-blur-md shadow-xl z-50"
                          style={{
                            background:
                              "linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)",
                          }}
                        >
                          <div className="p-4">
                            <div className="mb-4">
                              <h3 className="text-lg font-bold text-white mb-1">
                                Our Services
                              </h3>
                              <p className="text-white/70 text-xs">
                                Choose your solution
                              </p>
                            </div>
                            <div className="space-y-3">
                              {Object.entries(item.services).map(
                                ([key, service]) => (
                                  <Link
                                    key={service.path}
                                    href={service.path}
                                    className={`block p-3 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition-all duration-200 group ${
                                      location === service.path
                                        ? "bg-white/20 border-white/40"
                                        : ""
                                    }`}
                                    onClick={() => setActiveDropdown(null)}
                                    data-testid={`mobile-service-${key}`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                        <service.icon className="w-4 h-4 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="text-sm font-bold text-white truncate">
                                            {service.title}
                                          </h4>
                                          {service.popular && (
                                            <Badge className="bg-yellow-500 text-black text-xs px-1 py-0.5 font-semibold">
                                              Popular
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-white/70 text-xs mb-1">
                                          {service.subtitle}
                                        </p>
                                        <p className="text-white/60 text-xs leading-relaxed">
                                          {service.description}
                                        </p>
                                      </div>
                                    </div>
                                  </Link>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mobile Categories Menu */}
                      {activeDropdown === item.title && item.categories && (
                        <div
                          className="absolute top-full left-0 mt-2 w-[min(90vw,400px)] max-h-[70vh] rounded-lg border border-white/20 backdrop-blur-md shadow-xl z-50 overflow-hidden"
                          style={{
                            background:
                              "linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)",
                          }}
                        >
                          {/* Mobile Header */}
                          <div className="sticky top-0 p-4 border-b border-white/10 bg-gradient-to-b from-[#474ead] to-transparent backdrop-blur-sm">
                            <div className="text-center">
                              <h3 className="text-lg font-bold text-white mb-1">
                                Find Work
                              </h3>
                              <p className="text-white/70 text-xs">
                                Discover opportunities in 6 categories
                              </p>
                            </div>
                          </div>

                          {/* Scrollable Categories */}
                          <div className="overflow-y-auto max-h-[50vh] p-4">
                            <div className="space-y-3">
                              {Object.entries(item.categories).map(
                                ([key, category]) => (
                                  <Link
                                    key={category.path}
                                    href={category.path}
                                    className={`block p-4 rounded-lg border border-white/20 bg-white/5 hover:bg-white/15 hover:border-white/40 transition-all duration-300 group hover:scale-[1.02] ${
                                      location === category.path
                                        ? "bg-white/20 border-white/40 scale-[1.02]"
                                        : ""
                                    }`}
                                    onClick={() => setActiveDropdown(null)}
                                    data-testid={`mobile-category-${key}`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--gold-yellow)/0.3)] to-[hsl(var(--gold-yellow)/0.1)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                        <category.icon className="w-5 h-5 text-[hsl(var(--gold-yellow))]" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="text-sm font-bold text-white truncate group-hover:text-[hsl(var(--gold-yellow)/0.95)] transition-colors duration-300">
                                            {category.title}
                                          </h4>
                                          {category.popular && (
                                            <Badge className="bg-[hsl(var(--gold-yellow))] text-black text-xs px-1.5 py-0.5 font-semibold animate-pulse">
                                              Hot
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-white/75 text-xs mb-2 group-hover:text-white/90 transition-colors duration-300">
                                          {category.subtitle}
                                        </p>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-[hsl(var(--gold-yellow)/0.8)] font-semibold">
                                            {category.averageRate}
                                          </span>
                                          <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                                              category.demand === "Very High"
                                                ? "bg-green-500/20 text-green-300"
                                                : category.demand === "High"
                                                  ? "bg-yellow-500/20 text-yellow-300"
                                                  : "bg-blue-500/20 text-blue-300"
                                            }`}
                                          >
                                            {category.demand} Demand
                                          </span>
                                        </div>
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
                                    </div>
                                  </Link>
                                ),
                              )}
                            </div>
                          </div>

                          {/* Mobile Footer */}
                          <div className="sticky bottom-0 p-4 border-t border-white/10 bg-gradient-to-t from-[#474ead] to-transparent backdrop-blur-sm">
                            <div className="flex gap-2">
                              <Button
                                asChild
                                size="sm"
                                className="flex-1 bg-[hsl(var(--gold-yellow))] text-black hover:bg-[hsl(var(--gold-yellow)/0.9)] font-bold"
                              >
                                <Link
                                  href="/find-work"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  All Jobs
                                </Link>
                              </Button>
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="border-white/50 text-white hover:bg-white/10"
                              >
                                <Link
                                  href="/get-hired"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  Get Started
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
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
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
