import { Link, useLocation } from "wouter";
import { LoginDialog } from "@/components/LoginDialog";
import { SignUpDialog } from "@/components/SignUpDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Users, Zap, Building, User, Bot, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

// Service definitions for mega menu
const serviceDetails = {
  managed: {
    title: "Managed Services",
    subtitle: "We manage everything",
    description: "Full end-to-end management with KPI accountability and 24/7 support",
    icon: Zap,
    features: ["Dedicated team manager", "24/7 support", "KPI accountability", "Process building"],
    pricing: "From $200 + role rate",
    scale: "5-50 FTE",
    path: "/services/managed",
    popular: true
  },
  resourced: {
    title: "Resourced Services", 
    subtitle: "You manage",
    description: "Direct control with cost savings - perfect for hands-on founders",
    icon: Users,
    features: ["Flat FTE rate", "Dedicated account manager", "Standard support", "Direct control"],
    pricing: "From $200 + role rate",
    scale: "1-20 FTE",
    path: "/services/resourced",
    popular: false
  },
  enterprise: {
    title: "Enterprise Services",
    subtitle: "Custom at scale", 
    description: "Enterprise-grade scalability with full customization for large organizations",
    icon: Building,
    features: ["1,000+ FTE capacity", "Custom integrations", "Enterprise reporting", "Dedicated campaign team"],
    pricing: "Custom quote",
    scale: ">50 FTE",
    path: "/services/enterprise",
    popular: false
  },
  humanVA: {
    title: "Human Virtual Assistant",
    subtitle: "Personal productivity",
    description: "Skilled human assistants for complex tasks requiring creativity and judgment",
    icon: User,
    features: ["Complex task handling", "Creative problem solving", "Personal attention", "Industry expertise"],
    pricing: "From $400/month",
    scale: "1-5 VAs",
    path: "/services/human-va",
    popular: false
  },
  aiVA: {
    title: "AI Virtual Assistant",
    subtitle: "Automated efficiency",
    description: "AI-powered automation for repetitive tasks and data processing",
    icon: Bot,
    features: ["24/7 availability", "Data processing", "Automated workflows", "Cost effective"],
    pricing: "From $99/month",
    scale: "Unlimited tasks",
    path: "/services/ai-va",
    popular: false
  }
};

const navigationItems = [
  { title: "Hire Talent", path: "/hire-talent" },
  { title: "Why OnSpot", path: "/why-onspot" },
  { title: "Amazing", path: "/amazing" },
  { title: "Pricing", path: "/pricing" },
  { 
    title: "Services", 
    path: "/services",
    megaMenu: true,
    services: serviceDetails
  },
  { title: "Insights", path: "/insights" },
  { title: "Careers", path: "/get-hired" }
];

export function TopNavigation() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          {navigationItems.map((item) => {
            const hasMegaMenu = 'megaMenu' in item && item.megaMenu;
            const isActive = location === item.path || (hasMegaMenu && item.services && Object.values(item.services).some(service => location === service.path));
            
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
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                      activeDropdown === item.title ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {/* Mega Menu */}
                  {activeDropdown === item.title && item.services && (
                    <div 
                      className="absolute top-full left-0 mt-2 max-w-screen-lg w-[min(90vw,900px)] rounded-lg border border-white/20 backdrop-blur-md shadow-2xl z-50"
                      style={{ 
                        background: 'linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)'
                      }}
                      onMouseEnter={handleDropdownMouseEnter}
                      onMouseLeave={handleDropdownMouseLeave}
                    >
                      <div className="p-8">
                        <div className="mb-6">
                          <h3 className="text-2xl font-bold text-white mb-2">Our Services</h3>
                          <p className="text-white/80 text-sm">Choose the perfect solution for your business needs</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {Object.entries(item.services).map(([key, service]) => (
                            <Card key={key} className="relative overflow-hidden border-white/20 bg-white/10 backdrop-blur-md hover-elevate transition-all duration-300 group">
                              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <CardContent className="relative p-6">
                                <div className="flex items-start gap-4 mb-4">
                                  <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                                    <service.icon className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="text-lg font-bold text-white truncate">{service.title}</h4>
                                      {service.popular && (
                                        <Badge className="bg-yellow-500 text-black text-xs px-2 py-1 font-semibold">Popular</Badge>
                                      )}
                                    </div>
                                    <p className="text-white/70 text-sm font-medium mb-1">{service.subtitle}</p>
                                    <p className="text-white/60 text-xs leading-relaxed mb-3">{service.description}</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-3 mb-4">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-white/70">Pricing:</span>
                                      <div className="text-white font-semibold">{service.pricing}</div>
                                    </div>
                                    <div>
                                      <span className="text-white/70">Scale:</span>
                                      <div className="text-white font-semibold">{service.scale}</div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-white/70 text-xs">Key Features:</span>
                                    <ul className="mt-1 space-y-1">
                                      {service.features.slice(0, 2).map((feature, index) => (
                                        <li key={index} className="flex items-center gap-2 text-xs">
                                          <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                                          <span className="text-white/80 truncate">{feature}</span>
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
                                  <Link href={service.path} data-testid={`cta-learn-${key}`}>
                                    Learn More
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </Link>
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-white/20">
                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                              <Link href="/services" data-testid="cta-compare-services">
                                Compare All Services
                              </Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10">
                              <Link href="/contact" data-testid="cta-schedule-consultation">
                                Schedule Consultation
                              </Link>
                            </Button>
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
            {navigationItems.map((item) => {
              const hasMegaMenu = 'megaMenu' in item && item.megaMenu;
              const isActive = location === item.path || (hasMegaMenu && item.services && Object.values(item.services).some(service => location === service.path));
              
              if (hasMegaMenu) {
                return (
                  <div key={item.title} className="relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === item.title ? null : item.title)}
                      className={`px-3 py-2 text-sm font-medium transition-all duration-300 rounded-lg hover-elevate min-h-[44px] flex items-center gap-1 ${
                        isActive
                          ? "text-white bg-white/10 border border-white/30" 
                          : "text-white/90"
                      }`}
                      data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {item.title}
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                        activeDropdown === item.title ? 'rotate-180' : ''
                      }`} />
                    </button>
                    
                    {/* Mobile Services Menu */}
                    {activeDropdown === item.title && item.services && (
                      <div className="absolute top-full left-0 mt-2 w-80 rounded-lg border border-white/20 backdrop-blur-md shadow-xl z-50"
                        style={{ 
                          background: 'linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)'
                        }}
                      >
                        <div className="p-4">
                          <div className="mb-4">
                            <h3 className="text-lg font-bold text-white mb-1">Our Services</h3>
                            <p className="text-white/70 text-xs">Choose your solution</p>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(item.services).map(([key, service]) => (
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
                                      <h4 className="text-sm font-bold text-white truncate">{service.title}</h4>
                                      {service.popular && (
                                        <Badge className="bg-yellow-500 text-black text-xs px-1 py-0.5 font-semibold">Popular</Badge>
                                      )}
                                    </div>
                                    <p className="text-white/70 text-xs mb-1">{service.subtitle}</p>
                                    <p className="text-white/60 text-xs leading-relaxed">{service.description}</p>
                                  </div>
                                </div>
                              </Link>
                            ))}
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