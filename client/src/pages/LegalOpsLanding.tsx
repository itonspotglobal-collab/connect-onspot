import { useState, useEffect, useRef } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Building2,
  CheckCircle2,
  Shield,
  TrendingDown,
  Clock,
  Users,
  Award,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Star,
  BarChart3,
  Zap,
  Phone,
  Mail,
  Sparkles,
  DollarSign,
  Compass,
  Settings,
  Target,
  Rocket,
  AlertTriangle,
  Timer,
  MessageCircle,
  X,
  ArrowUpRight,
  Scale,
  AlertCircle,
  Check,
  FileText,
  FileCheck,
  Folder,
  Lock,
  RotateCcw,
  GitBranch,
  CheckSquare,
} from "lucide-react";
import { HeadSEO } from "@/components/HeadSEO";
import nycSkylineImage from "@assets/40431e5288cb44250d8204c03e0ba76129ba76dfd36e01e7c40f546ab05de806_1762346626354.jpeg";
import lawyerImage from "@assets/stock_images/professional_confide_e4371db1.jpg";
import selectiveLawyerImage from "@assets/stock_images/caucasian_white_male_8dcc3295.jpg";
import usMapImage from "@assets/US_Coverage_1765189431049.png";
import usMapMockup from "@assets/US_MAP_MOCKUP_1765202588593.png";
import legalTeamImage from "@assets/OnSpot_Legal_Team_1765206051566.png";
import stabilityTargetImage from "@assets/30-DAY_STABILITY_TARGET_1765546113570.png";
import noExtraChargesImage from "@assets/NO_EXTRA_CHARGES_1765546113569.png";
import performanceTrackingImage from "@assets/PERFORMANCE_TRACKING_1765546113569.png";
import fullTransparencyImage from "@assets/FULL_TRANSPARENCY_1765546113567.png";
import stressedProfessionalImage from "@assets/WHAT_IF_YOU_DONT_PARTNER_WITH_ONSPOT_1765207999583.png";
import profitsLostImage from "@assets/Profits_1765208843745.png";

// Guarantee Carousel Component - Fast, Swipeable, with Progress Dots
function GuaranteeCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const guaranteeImages = [
    { src: stabilityTargetImage, alt: "30-Day Stability Target - How to Make Your Business Self-Propelling" },
    { src: noExtraChargesImage, alt: "No Extra Charges - If it takes longer, we work for free until you're stable" },
    { src: performanceTrackingImage, alt: "Performance Tracking - Daily metrics and weekly reviews ensure we stay on target" },
    { src: fullTransparencyImage, alt: "Full Transparency - Complete visibility into our progress every step of the way" },
  ];

  const startAutoplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % guaranteeImages.length);
    }, 2500);
  };

  useEffect(() => {
    startAutoplay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const goToSlide = (index: number) => {
    setActiveIndex(index);
    startAutoplay();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipe = 50;
    if (Math.abs(distance) > minSwipe) {
      if (distance > 0) {
        setActiveIndex((prev) => (prev + 1) % guaranteeImages.length);
      } else {
        setActiveIndex((prev) => (prev - 1 + guaranteeImages.length) % guaranteeImages.length);
      }
      startAutoplay();
    }
  };

  return (
    <div className="relative">
      {/* Image Cards Container */}
      <div
        className="relative touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="carousel-guarantee"
      >
        {guaranteeImages.map((item, idx) => (
          <div
            key={idx}
            className={`${idx === 0 ? 'relative' : 'absolute inset-0'} flex items-center justify-center transition-all duration-500 ease-out ${
              idx === activeIndex
                ? "opacity-100 translate-x-0 scale-100"
                : idx < activeIndex
                ? "opacity-0 -translate-x-8 scale-95 absolute inset-0"
                : "opacity-0 translate-x-8 scale-95 absolute inset-0"
            }`}
          >
            <div className="w-full max-w-3xl mx-auto px-4">
              <img 
                src={item.src} 
                alt={item.alt}
                className="w-full h-auto rounded-2xl shadow-lg"
                loading="lazy"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Progress Dots */}
      <div className="flex justify-center gap-2 mt-6">
        {guaranteeImages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToSlide(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === activeIndex
                ? "w-8 h-2 bg-[#4353FF]"
                : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
            data-testid={`dot-guarantee-${idx}`}
          />
        ))}
      </div>

      {/* Swipe hint for mobile */}
      <p className="text-center text-xs text-gray-400 mt-3 sm:hidden">
        Swipe to explore
      </p>
    </div>
  );
}

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.warn(
    "Missing VITE_STRIPE_PUBLIC_KEY - Stripe checkout will not work",
  );
}
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

type CheckoutFormProps = {
  selectedTier: "launch" | "executive";
  onSuccess: () => void;
};

function CheckoutForm({ selectedTier, onSuccess }: CheckoutFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const res = await apiRequest("POST", "/api/legal-ops/create-trial", {
        selectedTier,
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Trial Confirmed!",
          description: "Redirecting to booking calendar...",
        });
        // Redirect to Calendly booking link
        window.location.href =
          "https://calendly.com/hello-onspotglobal/website-bookings";
      } else {
        toast({
          title: "Something went wrong",
          description: data.message || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="form-checkout"
    >
      <div className="pt-2 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-green-600" />
          <span>No payment required to start your trial.</span>
        </div>

        <Button
          type="submit"
          disabled={isProcessing}
          className="w-full touch-target"
          size="lg"
          data-testid="button-submit-payment"
        >
          {isProcessing ? "Preparing..." : "Start My 90-Day Trial →"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Book a consultation to get started.
        </p>
      </div>
    </form>
  );
}

type CheckoutWrapperProps = {
  selectedTier: "launch" | "executive";
  fullName: string;
  firmName: string;
  email: string;
  phone: string;
};

function CheckoutWrapper({
  selectedTier,
  fullName,
  firmName,
  email,
  phone,
}: CheckoutWrapperProps) {
  return (
    <CheckoutForm selectedTier={selectedTier} onSuccess={() => {}} />
  );
}

function RightFitSection() {
  const fitSectionRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    console.log("✅ RightFitSection rebuilt with unified card layout");
  }, []);

  useEffect(() => {
    const currentRef = fitSectionRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true);
          }
        });
      },
      {
        threshold: 0.25,
        rootMargin: "0px",
      },
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isInView]);

  const checklist = [
    {
      id: "volume",
      text: (
        <>
          You need dependable support without the{" "}
          <span className="font-semibold">cost, turnover, and delays</span> of
          hiring in-house
        </>
      ),
    },
    {
      id: "quality",
      text: (
        <>
          You're committed to{" "}
          <span className="font-semibold">process excellence</span> and
          measurable operational improvements
        </>
      ),
    },
    {
      id: "tech",
      text: (
        <>
          You use (or are willing to adopt){" "}
          <span className="font-semibold">
            cloud-based case management tools
          </span>
        </>
      ),
    },
    {
      id: "control",
      text: (
        <>
          You want{" "}
          <span className="font-semibold">full visibility and control</span>{" "}
          over your operations, not a black-box vendor
        </>
      ),
    },
    {
      id: "growth",
      text: (
        <>
          You're ready to{" "}
          <span className="font-semibold">invest in long-term efficiency</span>,
          not just short-term cost cuts
        </>
      ),
    },
  ];

  return (
    <section
      ref={fitSectionRef}
      className="py-24 sm:py-32 bg-gradient-to-b from-white via-slate-50/50 to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden"
    >
      <div className="container-fluid">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          {/* Header with Badge */}
          <div className="text-center mb-20 relative">
            <Badge
              className="mb-6 text-xs font-semibold px-4 py-2 border-0"
              style={{ backgroundColor: "#4353FF", color: "white" }}
              data-testid="badge-limited-intake"
            >
              Limited Intake • By Application
            </Badge>
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6 text-slate-900 dark:text-white"
              data-testid="text-right-fit-title"
            >
              Are We the Right Fit?
            </h2>
            <p
              className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto font-light"
              data-testid="text-right-fit-description"
            >
              OnSpot only partners with law firms that value precision, process,
              and performance. We're selective about who we work with because
              exceptional results require the right partnership from day one.
            </p>
          </div>

          {/* Two-column split layout */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-stretch">
            {/* LEFT: Photo Card with Gradient Overlay */}
            <div
              className="relative rounded-2xl overflow-hidden shadow-md bg-slate-100 dark:bg-slate-800"
              style={{
                minHeight: "520px",
                opacity: isInView ? 1 : 0,
                transform: isInView ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
              }}
            >
              <img
                src="/assets/rightfit-handshake.png"
                alt="Professional handshake demonstrating successful partnership"
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
              {/* Soft white overlay gradient at bottom to highlight OnSpot logo */}
              <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent pointer-events-none"></div>
            </div>

            {/* RIGHT: Unified Qualification Card */}
            <div
              style={{
                opacity: isInView ? 1 : 0,
                transform: isInView ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.7s ease-out 100ms, transform 0.7s ease-out 100ms",
              }}
              className="rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm shadow-md p-8 md:p-10 flex flex-col"
            >
              {/* Checklist Items */}
              <div className="space-y-6 flex-1">
                {checklist.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      opacity: isInView ? 1 : 0,
                      transform: isInView ? "translateX(0)" : "translateX(-12px)",
                      transition: `opacity 0.5s ease-out ${isInView ? 200 + index * 80 : 0}ms, transform 0.5s ease-out ${isInView ? 200 + index * 80 : 0}ms`,
                    }}
                    className="flex items-start gap-4"
                    data-testid={`checklist-item-${item.id}`}
                  >
                    {/* Check Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <Check
                        className="w-5 h-5"
                        style={{ color: "#4353FF" }}
                        strokeWidth={3}
                      />
                    </div>
                    {/* Text */}
                    <p className="text-base text-slate-700 dark:text-slate-200 leading-relaxed font-light">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* CTA Button - Inside card, aligned left */}
              <div className="pt-8 mt-6 border-t border-slate-200/50 dark:border-slate-700/30">
                <Button
                  onClick={() => {
                    const checkoutSection =
                      document.getElementById("checkout-section");
                    if (checkoutSection) {
                      checkoutSection.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }}
                  className="relative font-semibold text-white rounded-full px-8 shadow-md hover:shadow-lg transition-all duration-300 group"
                  style={{
                    background: "linear-gradient(135deg, #4353FF 0%, #5B6FFF 100%)",
                  }}
                  size="lg"
                  data-testid="button-apply-consultation"
                >
                  <span className="flex items-center gap-2">
                    Apply for Consultation
                    <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LegalOpsLanding() {
  const [selectedTier, setSelectedTier] = useState<"launch" | "executive">(
    "launch",
  );
  const [showCheckout, setShowCheckout] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [hasSeenPlaybookModal, setHasSeenPlaybookModal] = useState(false);
  const [showAllFAQs, setShowAllFAQs] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    firmName: "",
    email: "",
    phone: "",
  });

  const processTimelineRef = useRef<HTMLElement>(null);

  // Intersection Observer to trigger playbook modal when user scrolls past "How OnSpot Works"
  useEffect(() => {
    if (hasSeenPlaybookModal || !processTimelineRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When the section is leaving the viewport (scrolling down past it)
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            setShowPlaybookModal(true);
            setHasSeenPlaybookModal(true);
          }
        });
      },
      {
        threshold: 0,
        rootMargin: "-100px 0px 0px 0px", // Trigger when section is 100px from top
      },
    );

    observer.observe(processTimelineRef.current);

    return () => observer.disconnect();
  }, [hasSeenPlaybookModal]);

  // Booking calendar URL and helper
  const BOOKING_URL =
    "https://calendly.com/hello-onspotglobal/website-bookings";

  const openBooking = () => {
    window.open(BOOKING_URL, "_blank", "noopener,noreferrer");
  };

  // Smart scarcity slot counter - generates 3-7 slots based on current date
  // Changes daily but stays consistent throughout the day for authenticity
  const getAvailableSlots = (): number => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const month = today.getMonth();
    
    // Combine day and month to create semi-random seed
    // This creates a number that changes daily but is predictable for the same day
    const seed = (dayOfMonth * 7 + month * 13) % 5;
    
    // Return a value between 3-7 slots
    return 3 + seed;
  };

  const availableSlots = getAvailableSlots();

  const handleStartTrial = () => {
    window.location.href =
      "https://calendly.com/hello-onspotglobal/website-bookings";
  };

  const scrollToCheckout = () => {
    document
      .getElementById("checkout-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  // Enhanced JSON-LD schemas + performance optimizations for GEO targeting
  useEffect(() => {
    const addedElements: Element[] = [];

    // Helper to track elements we add
    const trackElement = (element: Element) => {
      addedElements.push(element);
      return element;
    };

    // Helper to add/track link elements
    const addLink = (
      rel: string,
      href: string,
      attrs?: Record<string, string>,
    ) => {
      // Check if this exact link already exists (check both rel AND href)
      const selector = `link[rel="${rel}"][href="${href}"]`;
      if (document.querySelector(selector)) return;

      const link = document.createElement("link");
      link.setAttribute("rel", rel);
      link.setAttribute("href", href);
      link.setAttribute("data-legalops-head", "true");
      if (attrs) {
        Object.entries(attrs).forEach(([key, val]) =>
          link.setAttribute(key, val),
        );
      }
      document.head.appendChild(trackElement(link));
    };

    // XML Sitemap & Robots (additional links not handled by HeadSEO)
    addLink("sitemap", "/sitemap.xml", { type: "application/xml" });
    addLink("robots", "/robots.txt", { type: "text/plain" });

    // Performance: Preconnect to CDNs
    addLink("preconnect", "https://fonts.googleapis.com");
    addLink("preconnect", "https://fonts.gstatic.com", {
      crossorigin: "anonymous",
    });

    // Performance: Preload critical resources (hero image)
    addLink("preload", nycSkylineImage, { as: "image", fetchpriority: "high" });

    // Clean up old LegalOps schemas
    document
      .querySelectorAll("script[data-legalops-schema]")
      .forEach((s) => s.remove());

    // JSON-LD: Organization
    const orgSchema = document.createElement("script");
    orgSchema.type = "application/ld+json";
    orgSchema.setAttribute("data-legalops-schema", "organization");
    orgSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "OnSpot",
      legalName: "OnSpot Global",
      url: "https://www.onspotglobal.com",
      logo: "https://www.onspotglobal.com/assets/onspot-logo.png",
      description: "Legal operations and managed services for law firms",
      sameAs: [
        "https://www.linkedin.com/company/onspotglobal",
        "https://www.facebook.com/onspotglobal",
        "https://twitter.com/onspotglobal",
      ],
    });
    document.head.appendChild(trackElement(orgSchema));

    // JSON-LD: ProfessionalService with multi-city serviceArea
    const serviceSchema = document.createElement("script");
    serviceSchema.type = "application/ld+json";
    serviceSchema.setAttribute("data-legalops-schema", "service");
    serviceSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "OnSpot LegalOps",
      description:
        "Legal operations and managed services for landlord-tenant law firms",
      provider: {
        "@type": "Organization",
        name: "OnSpot",
        legalName: "OnSpot Global",
      },
      serviceType: "Legal Operations Management",
      areaServed: [
        {
          "@type": "City",
          name: "New York",
          address: {
            "@type": "PostalAddress",
            addressRegion: "NY",
            addressCountry: "US",
          },
        },
        {
          "@type": "City",
          name: "Dallas",
          address: {
            "@type": "PostalAddress",
            addressRegion: "TX",
            addressCountry: "US",
          },
        },
        {
          "@type": "City",
          name: "Houston",
          address: {
            "@type": "PostalAddress",
            addressRegion: "TX",
            addressCountry: "US",
          },
        },
        {
          "@type": "City",
          name: "Austin",
          address: {
            "@type": "PostalAddress",
            addressRegion: "TX",
            addressCountry: "US",
          },
        },
        {
          "@type": "City",
          name: "Miami",
          address: {
            "@type": "PostalAddress",
            addressRegion: "FL",
            addressCountry: "US",
          },
        },
        {
          "@type": "City",
          name: "Orlando",
          address: {
            "@type": "PostalAddress",
            addressRegion: "FL",
            addressCountry: "US",
          },
        },
        {
          "@type": "City",
          name: "Tampa",
          address: {
            "@type": "PostalAddress",
            addressRegion: "FL",
            addressCountry: "US",
          },
        },
      ],
      offers: [
        {
          "@type": "Offer",
          name: "Resourced Services",
          price: "1950",
          priceCurrency: "USD",
          description:
            "Pay only for talent. OnSpot handles recruiting, vetting, and replacement.",
        },
        {
          "@type": "Offer",
          name: "Managed Services",
          price: "4950",
          priceCurrency: "USD",
          description:
            "Full operational oversight including daily management, QA, coaching, and reporting.",
        },
      ],
    });
    document.head.appendChild(trackElement(serviceSchema));

    // JSON-LD: FAQPage (mirror existing FAQs)
    const faqSchema = document.createElement("script");
    faqSchema.type = "application/ld+json";
    faqSchema.setAttribute("data-legalops-schema", "faq");
    faqSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is OnSpot LegalOps?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "OnSpot LegalOps is a specialized managed service for landlord-tenant law firms in New York, Texas, and Florida. We provide fully-managed legal operations teams that handle case intake, document preparation, court filing, and client communication—all backed by zero-escalation guarantees and instant replacement SLAs.",
          },
        },
        {
          "@type": "Question",
          name: "How much does OnSpot LegalOps cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "We offer two service models: Resourced Services at $1,950/FTE/month (talent only, you manage) and Managed Services starting at $4,950/FTE/month (full operational oversight). Both include a 90-day trial with guaranteed stability.",
          },
        },
        {
          "@type": "Question",
          name: "What locations does OnSpot LegalOps serve?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "We specialize in landlord-tenant law firms across New York (NYC), Texas (Dallas, Houston, Austin), and Florida (Miami, Orlando, Tampa). Our team understands local court procedures and filing requirements in each jurisdiction.",
          },
        },
        {
          "@type": "Question",
          name: "How quickly can I start?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Most firms are operational within 7-14 days. We provide ready-to-start talent, pre-built dashboards, and KPI templates so you can launch without delays.",
          },
        },
        {
          "@type": "Question",
          name: "What's included in Managed Services?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Managed Services includes daily operations management, quality assurance, performance coaching, weekly reporting, escalation handling, and continuous process improvement. You get complete operational oversight without managing day-to-day tasks.",
          },
        },
      ],
    });
    document.head.appendChild(trackElement(faqSchema));

    // JSON-LD: BreadcrumbList
    const breadcrumbSchema = document.createElement("script");
    breadcrumbSchema.type = "application/ld+json";
    breadcrumbSchema.setAttribute("data-legalops-schema", "breadcrumb");
    breadcrumbSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.onspotglobal.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "LegalOps",
          item: "https://www.onspotglobal.com/legalops-ny",
        },
      ],
    });
    document.head.appendChild(trackElement(breadcrumbSchema));

    // Cleanup function - remove added elements on unmount
    return () => {
      addedElements.forEach((el) => el.remove());
      document
        .querySelectorAll("script[data-legalops-schema]")
        .forEach((s) => s.remove());
      document
        .querySelectorAll("[data-legalops-head]")
        .forEach((el) => el.remove());
    };
  }, []);

  return (
    <>
      <HeadSEO
        title="LegalOps for NY, TX, FL Landlord-Tenant Law Firms | OnSpot Legal Operations"
        description="OnSpot LegalOps for landlord-tenant law firms in New York City, Dallas, Houston, Austin, Miami, Orlando, Tampa. Cut legal admin costs 70% with managed legal operations. Zero escalations. 90-day trial."
      />

      <div className="relative bg-background">
        {/* Sticky CTA Footer */}
        <div className="sticky-bottom-cta relative z-30 -mt-1 bg-gradient-to-r from-violet-500/95 to-blue-600/95 text-white py-2.5 shadow-sm border-t border-white/10" style={{ backdropFilter: 'blur(12px)' }}>
          <div className="container-fluid flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm md:text-base font-semibold text-center sm:text-left">
              Ready to replace your legal admin chaos with guaranteed stability?
            </p>
            <Button
              onClick={openBooking}
              variant="outline"
              className="w-full sm:w-auto bg-white text-violet-600 border-white hover:bg-white/90 touch-target whitespace-nowrap"
              data-testid="button-sticky-cta"
            >
              Start My LegalOps Trial →
            </Button>
          </div>
        </div>

        {/* Hero Section - Hormozi-Style Premium with OnSpot Brand Colors */}
        <section 
          className="relative overflow-visible hero-investor"
        >
          {/* Elegant Gradient Overlay for Depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none"></div>
          
          <div className="relative z-20 px-6 sm:px-8 md:px-12 lg:px-20 py-16 sm:py-20 md:py-24 lg:py-28 flex items-center min-h-screen">
            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 xl:gap-28 items-center">
              {/* Left: Editorial Content */}
              <div className="hero-fade-up space-y-6 md:space-y-8 relative">
                {/* Subtle Infrastructure Grid Texture with Radial Fade */}
                <div 
                  className="absolute -inset-8 sm:-inset-16 -z-10 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(67, 83, 255, 0.4) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(67, 83, 255, 0.4) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black 0%, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black 0%, transparent 70%)',
                    opacity: 0.04
                  }}
                ></div>
                
                {/* Authority Eyebrow - System Metadata */}
                <p 
                  className="text-[0.7rem] sm:text-xs font-medium uppercase tracking-[0.25em]"
                  style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                  data-testid="text-hero-eyebrow"
                >
                  Built from real law firm operations
                </p>

                {/* Main Headline with Asymmetrical Accent */}
                <div className="space-y-5 relative">
                  <h1
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold leading-[1.08] tracking-tight"
                    style={{ color: '#FFFFFF' }}
                    data-testid="text-hero-headline"
                  >
                    End Operational Chaos<br className="hidden sm:block" />
                    <span className="block"> Without Hiring More Staff</span>
                  </h1>
                  
                  {/* Asymmetrical Accent - Single Visual Signature */}
                  <div 
                    className="w-12 h-px"
                    style={{ backgroundColor: 'rgba(67, 83, 255, 0.6)' }}
                  ></div>
                  
                  {/* Tight Subhead - One Line */}
                  <p
                    className="text-lg sm:text-xl md:text-2xl font-normal leading-snug"
                    style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                    data-testid="text-hero-subhead"
                  >
                    Managed legal operations. 70% cost reduction. Zero escalations.
                  </p>
                </div>

                {/* Rotating Proof Line - Fade Only, Fixed Width */}
                <div className="relative h-5 overflow-hidden max-w-[34ch] sm:max-w-[40ch]">
                  <style>{`
                    @keyframes proof-fade-refined {
                      0%, 30% { opacity: 1; }
                      33%, 97% { opacity: 0; }
                      100% { opacity: 0; }
                    }
                    .proof-refined-1 { animation: proof-fade-refined 12s ease-in-out infinite; }
                    .proof-refined-2 { animation: proof-fade-refined 12s ease-in-out 4s infinite; }
                    .proof-refined-3 { animation: proof-fade-refined 12s ease-in-out 8s infinite; }
                  `}</style>
                  <p 
                    className="proof-refined-1 absolute inset-0 text-xs sm:text-sm font-normal tracking-wide whitespace-nowrap"
                    style={{ color: 'rgba(148, 163, 184, 0.65)' }}
                    data-testid="text-hero-proof-1"
                  >
                    Trusted by high-volume law firms across the U.S.
                  </p>
                  <p 
                    className="proof-refined-2 absolute inset-0 text-xs sm:text-sm font-normal tracking-wide whitespace-nowrap opacity-0"
                    style={{ color: 'rgba(148, 163, 184, 0.65)' }}
                    data-testid="text-hero-proof-2"
                  >
                    Built for firms that value process, precision, and control.
                  </p>
                  <p 
                    className="proof-refined-3 absolute inset-0 text-xs sm:text-sm font-normal tracking-wide whitespace-nowrap opacity-0"
                    style={{ color: 'rgba(148, 163, 184, 0.65)' }}
                    data-testid="text-hero-proof-3"
                  >
                    Designed to scale without operational risk.
                  </p>
                </div>
              </div>

              {/* Right: Premium Checkout Form - Minimal Glass */}
              <div
                id="checkout-section"
                className="lg:sticky lg:top-20 hero-fade-up-delay"
              >
                <div className="relative overflow-hidden bg-white/8 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl">
                  <div className="relative">
                    <div className="border-b border-white/10 px-6 sm:px-8 pt-7 pb-5">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <h2
                          className="text-lg sm:text-xl font-semibold tracking-tight"
                          style={{ color: '#FFFFFF' }}
                          data-testid="text-checkout-title"
                        >
                          Start Your 90-Day Trial
                        </h2>
                        <Badge
                          className="bg-[#4353FF] text-white font-medium text-xs px-3 py-1.5 border-0 shrink-0"
                          data-testid="badge-scarcity"
                        >
                          {availableSlots} Slots Left
                        </Badge>
                      </div>
                      <p
                        className="text-xs tracking-wide"
                        style={{ color: 'rgba(255, 255, 255, 0.55)' }}
                        data-testid="text-checkout-description"
                      >
                        No implementation cost • Cancel anytime
                      </p>
                    </div>
                    <div className="px-6 sm:px-8 py-6 space-y-4">
                      {!showCheckout ? (
                        <>
                          <div className="space-y-1.5">
                            <Label htmlFor="fullName" className="text-xs text-white/60 font-medium">Full Name *</Label>
                            <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="John Smith" required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-10 focus:border-[#4353FF]/50 focus:ring-[#4353FF]/20" data-testid="input-full-name" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="firmName" className="text-xs text-white/60 font-medium">Law Firm Name *</Label>
                            <Input id="firmName" value={formData.firmName} onChange={(e) => setFormData({...formData, firmName: e.target.value})} placeholder="Smith & Associates" required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-10 focus:border-[#4353FF]/50 focus:ring-[#4353FF]/20" data-testid="input-firm-name" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs text-white/60 font-medium">Email *</Label>
                            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john@lawfirm.com" required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-10 w-full focus:border-[#4353FF]/50 focus:ring-[#4353FF]/20" data-testid="input-email" autoComplete="email" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs text-white/60 font-medium">Phone</Label>
                            <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="(917) 555-0123" className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-10 w-full focus:border-[#4353FF]/50 focus:ring-[#4353FF]/20" data-testid="input-phone" autoComplete="tel" inputMode="tel" />
                          </div>
                          <div className="pt-3">
                            <Button
                              onClick={handleStartTrial}
                              className="w-full text-white font-semibold rounded-lg text-sm h-11 transition-all duration-200"
                              style={{ backgroundColor: "#4353FF" }}
                              disabled={!formData.fullName || !formData.firmName || !formData.email}
                              data-testid="button-continue-to-payment"
                            >
                              Start Now
                            </Button>
                          </div>
                          <p className="text-center text-xs pt-2" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                            NDA-backed • Secure • Replacement guarantee
                          </p>
                        </>
                      ) : (
                        <CheckoutWrapper
                          selectedTier={selectedTier}
                          fullName={formData.fullName}
                          firmName={formData.firmName}
                          email={formData.email}
                          phone={formData.phone}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zero Escalation Guarantee Section - Premium Carousel */}
        <section className="py-12 sm:py-16 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
          <div className="container-fluid relative z-10">
            <div className="max-w-5xl mx-auto">
              {/* Header - Confident & Concise */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-[#4353FF] rounded-2xl mb-4 shadow-lg">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h2
                  className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3"
                  data-testid="text-guarantee-title"
                >
                  Zero Escalation Guarantee
                </h2>
                <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
                  30 days to stability — or we work free until you're there.
                </p>
              </div>

              {/* Premium Glass Card Carousel with Fade */}
              <GuaranteeCarousel />
            </div>
          </div>
        </section>

        {/* Security / Confidentiality Trust Strip - Light, flows from Zero Escalation section */}
        <section className="py-6 sm:py-8 bg-white border-b border-gray-100">
          <div className="container-fluid">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-12">
                <div className="flex items-center gap-2 text-gray-400">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium">NDA-Protected</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium">Secure Access Controls</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium">Confidentiality-First</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Scale className="w-4 h-4 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium">Support Work Only — Final Sign-Off Stays With You</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Geographic Coverage Section - Full-Width Mockup Background */}
        <section className="relative min-h-[600px] md:min-h-[700px] lg:min-h-[800px] overflow-hidden">
          {/* Full-width background image */}
          <div className="absolute inset-0">
            <img 
              src={usMapMockup}
              alt="OnSpot nationwide coverage map displayed on airport billboard"
              className="w-full h-full object-cover object-center"
            />
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/40"></div>
          </div>

          <style>{`
            .region-pill-light { transition: all 200ms ease-out; }
            .region-pill-light:hover {
              background: rgba(255, 255, 255, 0.25);
              transform: translateY(-2px);
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
          `}</style>

          {/* Content overlay */}
          <div className="relative z-10 h-full flex items-center">
            <div className="container-fluid py-16 md:py-20 lg:py-24">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                {/* Left-aligned content for better readability against the map */}
                <div className="max-w-xl lg:max-w-2xl">
                  {/* Origin Statement */}
                  <p className="text-sm md:text-base font-light tracking-wide text-amber-300/80 uppercase mb-4" data-testid="text-origin-geo">
                    Founded in high-volume New York legal operations
                  </p>
                  
                  {/* Main Headline */}
                  <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
                    We're Across America
                  </h2>

                  {/* Subheadline */}
                  <p className="text-lg md:text-xl text-gray-200 font-light mb-8 max-w-lg leading-relaxed">
                    Present in key markets. Ready to serve your firm with dependable support, wherever you are.
                  </p>

                  {/* Stats Row */}
                  <div className="flex flex-wrap items-center gap-6 md:gap-8 mb-10">
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-white">5</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wide">Key Regions</div>
                    </div>
                    <div className="w-px h-12 bg-gray-600"></div>
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-white">40+</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wide">Cities</div>
                    </div>
                    <div className="w-px h-12 bg-gray-600"></div>
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-amber-400">24/7</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wide">Coverage</div>
                    </div>
                  </div>

                  {/* Region Pills */}
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                      Where We Operate
                    </p>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      <div className="region-pill-light px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span className="text-sm font-medium text-white">Tri-State</span>
                          <span className="text-xs text-gray-400">NY • NJ • CT</span>
                        </div>
                      </div>
                      <div className="region-pill-light px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span className="text-sm font-medium text-white">Texas</span>
                          <span className="text-xs text-gray-400">Dallas • Houston</span>
                        </div>
                      </div>
                      <div className="region-pill-light px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span className="text-sm font-medium text-white">Florida</span>
                          <span className="text-xs text-gray-400">Miami • Orlando</span>
                        </div>
                      </div>
                      <div className="region-pill-light px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span className="text-sm font-medium text-white">California</span>
                          <span className="text-xs text-gray-400">Bay Area • LA</span>
                        </div>
                      </div>
                      <div className="region-pill-light px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span className="text-sm font-medium text-white">Illinois</span>
                          <span className="text-xs text-gray-400">Chicago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Law Firms Come to OnSpot - Premium Grid Section */}
        <section className="relative py-16 sm:py-20 md:py-28 overflow-hidden bg-gradient-to-b from-white via-blue-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900">
          <style>{`
            .reason-card {
              transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
            }
            .reason-card:hover {
              transform: translateY(-4px);
              box-shadow: 0 20px 40px rgba(67, 83, 255, 0.15);
            }
            .reason-icon {
              transition: all 300ms ease-out;
            }
            .reason-card:hover .reason-icon {
              transform: scale(1.1);
            }
          `}
          </style>
          
          <div className="container-fluid relative z-10">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              {/* Intro */}
              <div className="text-center mb-10 sm:mb-16 space-y-3 sm:space-y-4">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">Why Law Firms Choose OnSpot</h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">Reclaim time. Reduce risk. Achieve predictability.</p>
              </div>

              {/* Reasons Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[
                  {
                    icon: Clock,
                    title: "Reclaim Attorney Time",
                    desc: "Free your lawyers from admin work to focus on billable hours and case strategy."
                  },
                  {
                    icon: TrendingDown,
                    title: "Eliminate Escalations",
                    desc: "Proactive workflows prevent missed deadlines, compliance issues, and client friction."
                  },
                  {
                    icon: CheckCircle2,
                    title: "Operational Predictability",
                    desc: "Know exactly what's happening with every case, every deadline, every client touchpoint."
                  },
                  {
                    icon: DollarSign,
                    title: "Cut Operations Costs 70%",
                    desc: "Replace local staff at $6,650/month with OnSpot teams from $1,950/month."
                  },
                  {
                    icon: Shield,
                    title: "Zero Turnover Risk",
                    desc: "Instant replacement SLAs and backup staff ensure continuity. No onboarding delays."
                  },
                  {
                    icon: Users,
                    title: "Scale Without Friction",
                    desc: "Add or reduce team size in days, not months. Grow confidently without hiring headaches."
                  }
                ].map((item, idx) => {
                  const IconComponent = item.icon;
                  return (
                    <div key={idx} className="reason-card bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-blue-100/50 dark:border-blue-500/20 rounded-2xl p-5 sm:p-6 md:p-8">
                      <div className="reason-icon w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center mb-4">
                        <IconComponent className="w-6 h-6" style={{ color: '#4353FF' }} />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <RightFitSection />

        {/* New York Law Firm Success Section */}
        <section className="py-12 sm:py-16 md:py-20 bg-white dark:bg-slate-900">
          <div className="container-fluid">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-8 sm:mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-violet-600 to-blue-600 rounded-2xl sm:rounded-3xl mb-4 sm:mb-6 shadow-2xl">
                  <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <h2
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4"
                  data-testid="text-success-title"
                >
                  New York Law Firm Success Story
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  Manhattan landlord-tenant practice rebuilds entire legal ops
                  infrastructure under crisis conditions
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-5 sm:p-6 md:p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">
                          Infrastructure Rebuild
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Complete rebuild of legal ops infrastructure under
                          crisis conditions
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-5 sm:p-6 md:p-8">
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">
                          Stabilized in Under 30 Days
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Achieved full operational stability in weeks, not months
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-5 sm:p-6 md:p-8">
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base sm:text-lg mb-1">
                          Zero Escalations
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Maintained for 12+ consecutive months after
                          stabilization
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-5 sm:p-6 md:p-8">
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base sm:text-lg mb-1">
                          72% Cost Reduction
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Sustained reduction in operational costs year over
                          year
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section - Two-Tier Hormozi Stack */}
        <section className="py-12 sm:py-16 md:py-24 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="container-fluid">
            <div className="text-center mb-8 sm:mb-12">
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4"
                data-testid="text-pricing-title"
              >
                Choose Your LegalOps System
              </h2>
              <p
                className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto"
                data-testid="text-pricing-subtitle"
              >
                Both options include our Zero Escalation Guarantee and 90-day
                trial period
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
              {/* Option A - Launch System (Most Popular) */}
              <Card
                className={`relative ${
                  selectedTier === "launch"
                    ? "border-2 border-violet-600 shadow-2xl scale-105"
                    : "hover-elevate"
                }`}
                onClick={() => setSelectedTier("launch")}
                data-testid="card-tier-launch"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    className="bg-violet-600 text-white text-sm px-4 py-1"
                    data-testid="badge-most-popular"
                  >
                    ⭐ Most Popular
                  </Badge>
                </div>
                <CardHeader className="pt-8">
                  <CardTitle
                    className="text-2xl"
                    data-testid="text-tier-launch-title"
                  >
                    Resourced Services
                  </CardTitle>
                  <CardDescription data-testid="text-tier-launch-description">
                    You manage directly — OnSpot provides pre-vetted talent
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Best for firms that already have strong internal process leadership.
                  </p>
                  <div className="pt-4">
                    <div
                      className="text-4xl font-bold"
                      data-testid="text-tier-launch-price"
                    >
                      $1,950
                      <span className="text-lg font-normal text-muted-foreground">
                        /FTE/mo
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Month-to-month, flexible terms
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Highly engaged, pre-vetted professionals
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Ready-to-start within days</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Instant replacement — no downtime
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Included dashboards & KPI templates
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Benefits, taxes, & equipment covered
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Add or reduce FTEs instantly
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">
                      One-click upgrade to Managed Services anytime
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={openBooking}
                    className="w-full touch-target"
                    size="lg"
                    variant={selectedTier === "launch" ? "default" : "outline"}
                    data-testid="button-select-launch"
                  >
                    Select Resourced Services
                  </Button>
                </CardFooter>
              </Card>

              {/* Option B - Executive Suite (Anchor) */}
              <Card
                className={`relative opacity-90 ${
                  selectedTier === "executive"
                    ? "border-2 border-blue-600 shadow-2xl"
                    : "hover-elevate"
                }`}
                onClick={() => setSelectedTier("executive")}
                data-testid="card-tier-executive"
              >
                <CardHeader>
                  <CardTitle
                    className="text-2xl"
                    data-testid="text-tier-executive-title"
                  >
                    Managed Services (Full Oversight)
                  </CardTitle>
                  <CardDescription data-testid="text-tier-executive-description">
                    OnSpot manages everything — daily operations, QA, coaching,
                    and reporting
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Ideal for firms that want performance, accountability, and zero micromanagement.
                  </p>
                  <div className="pt-4">
                    <div
                      className="text-4xl font-bold"
                      data-testid="text-tier-executive-price"
                    >
                      $3,399
                      <span className="text-lg font-normal text-muted-foreground">
                        /FTE/mo
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Limited-time onboarding rate: $2,799/mo
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      3-month minimum commitment
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">
                      Everything in Resourced Services, plus:
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Delivery Manager for daily oversight
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Pre-built Legal SOP Suite (Case intake, document
                      preparation, calendaring, CRM, client communication,
                      compliance workflows)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Weekly/monthly performance reports & dashboards
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Custom dashboard branding</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Unlimited team expansion flexibility
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={openBooking}
                    className="w-full touch-target"
                    size="lg"
                    variant={
                      selectedTier === "executive" ? "default" : "outline"
                    }
                    data-testid="button-select-executive"
                  >
                    Select Managed Services
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="text-center mt-8 text-sm text-muted-foreground space-y-3">
              <p>
                Resourced Services: 70% less than local NY paralegal
                ($6,650/mo). Managed Services: complete oversight included.
              </p>
              <p className="text-xs text-muted-foreground/80 flex items-center justify-center gap-2">
                <span>🔒 NDA-backed teams</span>
                <span className="text-muted-foreground/40">•</span>
                <span>Secure access controls</span>
                <span className="text-muted-foreground/40">•</span>
                <span>Confidentiality-first operations</span>
              </p>
            </div>
          </div>
        </section>

        {/* Dashboard Preview */}
        <section className="py-12 sm:py-16 md:py-24 bg-slate-50 dark:bg-slate-950">
          <div className="container-fluid">
            <div className="text-center mb-8 sm:mb-12 px-4">
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4"
                data-testid="text-dashboard-title"
              >
                Full Visibility Into Your Legal Operations
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Track every case, monitor performance, and ensure compliance in
                real-time
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto px-4 sm:px-0">
              <Card className="text-center hover-elevate">
                <CardHeader>
                  <BarChart3 className="h-12 w-12 text-violet-600 mx-auto mb-2" />
                  <CardTitle className="text-lg">Live Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Real-time dashboard with case volumes, turnaround times, and
                    accuracy rates
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardHeader>
                  <Users className="h-12 w-12 text-violet-600 mx-auto mb-2" />
                  <CardTitle className="text-lg">Team Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Track individual FTE productivity and quality metrics
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardHeader>
                  <Award className="h-12 w-12 text-violet-600 mx-auto mb-2" />
                  <CardTitle className="text-lg">Compliance Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Automated compliance tracking for Section 8 and NYC
                    regulations
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Execution Standards - Authoritative Operational Section */}
        <section 
          className="relative py-20 sm:py-24 md:py-32 bg-slate-950"
        >
          <div className="container-fluid relative z-10">
            <div className="max-w-4xl mx-auto">
              {/* Section Header - Authoritative */}
              <div className="mb-12 sm:mb-16 md:mb-20">
                <p 
                  className="text-xs sm:text-sm font-medium tracking-widest uppercase mb-4"
                  style={{ color: '#64748B' }}
                >
                  Execution Standards
                </p>
                <h2
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4"
                  data-testid="text-dream-outcome-title"
                >
                  What We Deliver. Every Time.
                </h2>
                <p className="text-base sm:text-lg text-slate-400 max-w-2xl">
                  These are not goals. They are non-negotiable operating standards built into every engagement.
                </p>
              </div>

              {/* Execution Standards - Vertical Anchor Layout */}
              <div className="relative">
                {/* Vertical Line Anchor */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#4353FF] via-[#4353FF]/50 to-transparent"></div>

                {/* Standards List */}
                <div className="space-y-10 sm:space-y-12 pl-8 sm:pl-12">
                  {/* Standard 1 */}
                  <div className="relative">
                    <div className="absolute -left-8 sm:-left-12 top-1 w-2 h-2 rounded-full bg-[#4353FF]"></div>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-white leading-snug">
                      Every case moves forward without delay.
                    </p>
                    <p className="text-sm sm:text-base text-slate-500 mt-2">
                      No bottlenecks. No waiting on staff. No excuses.
                    </p>
                  </div>

                  {/* Standard 2 */}
                  <div className="relative">
                    <div className="absolute -left-8 sm:-left-12 top-1 w-2 h-2 rounded-full bg-[#4353FF]"></div>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-white leading-snug">
                      Every document is delivered accurate and on time.
                    </p>
                    <p className="text-sm sm:text-base text-slate-500 mt-2">
                      QA-checked. Court-ready. Zero rework.
                    </p>
                  </div>

                  {/* Standard 3 */}
                  <div className="relative">
                    <div className="absolute -left-8 sm:-left-12 top-1 w-2 h-2 rounded-full bg-[#4353FF]"></div>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-white leading-snug">
                      Every client is informed before they ask.
                    </p>
                    <p className="text-sm sm:text-base text-slate-500 mt-2">
                      Proactive updates. Consistent communication. Trust maintained.
                    </p>
                  </div>

                  {/* Standard 4 */}
                  <div className="relative">
                    <div className="absolute -left-8 sm:-left-12 top-1 w-2 h-2 rounded-full bg-[#4353FF]"></div>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-white leading-snug">
                      Every issue is resolved without escalation.
                    </p>
                    <p className="text-sm sm:text-base text-slate-500 mt-2">
                      Problems handled internally. Your focus stays on law.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Statement - Minimal */}
              <div className="mt-16 sm:mt-20 pt-8 border-t border-slate-800">
                <p className="text-sm sm:text-base text-slate-500">
                  This is how OnSpot operates. Not aspirations — systems.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Everything Your Firm Can Offload - Service Categories */}
        <section className="py-20 sm:py-32 bg-gradient-to-b from-white to-slate-50/50 relative overflow-hidden">
          {/* Subtle background accents */}
          <div className="absolute top-20 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl"></div>

          <div className="container-fluid relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <h2
                className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6"
                style={{ color: "#1E293B" }}
                data-testid="text-offload-title"
              >
                Everything Your Firm Can Offload to OnSpot LegalOps
                <sup className="text-2xl">™</sup>
              </h2>
              <p
                className="text-xl sm:text-2xl font-light"
                style={{ color: "#64748B" }}
              >
                One team. Every function. Fully managed.
              </p>
            </div>

            {/* Service Categories Grid */}
            <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
              {/* Card 1: Document Preparation & Review */}
              <div
                className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                data-testid="card-document-prep"
              >
                <div className="mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                  >
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{ color: "#1E293B" }}
                  >
                    Document Preparation & Review
                  </h3>
                  <p
                    className="text-base font-medium mb-4"
                    style={{ color: "#4353FF" }}
                  >
                    Accurate docs, faster turnaround.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Drafting and proofreading purchase agreements, lease agreements, and closing documents</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Preparing deeds, mortgage documents, and promissory notes</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Reviewing title commitments, lien searches, and survey reports</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#64748B" }}
                  >
                    <span style={{ color: "#4353FF" }}>Outcome:</span>{" "}
                    Flawless documents, zero revision cycles.
                  </p>
                </div>
              </div>

              {/* Card 2: Transaction Coordination */}
              <div
                className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                data-testid="card-transaction-coordination"
              >
                <div className="mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                  >
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{ color: "#1E293B" }}
                  >
                    Transaction Coordination
                  </h3>
                  <p
                    className="text-base font-medium mb-4"
                    style={{ color: "#4353FF" }}
                  >
                    Every deadline tracked, every stakeholder aligned.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Tracking contract timelines (inspection, financing, closing dates)</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Coordinating with title companies, lenders, agents, and clients</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Organizing closing checklists and due diligence documents</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#64748B" }}
                  >
                    <span style={{ color: "#4353FF" }}>Outcome:</span>{" "}
                    Smooth closings, no missed deadlines.
                  </p>
                </div>
              </div>

              {/* Card 3: Title & Escrow Support */}
              <div
                className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                data-testid="card-title-escrow"
              >
                <div className="mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                  >
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{ color: "#1E293B" }}
                  >
                    Title & Escrow Support
                  </h3>
                  <p
                    className="text-base font-medium mb-4"
                    style={{ color: "#4353FF" }}
                  >
                    Clear titles, resolved exceptions, certified closings.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Ordering and reviewing title searches</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Liaising with title agents to resolve title issues</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Preparing title affidavits and clearing exceptions</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#64748B" }}
                  >
                    <span style={{ color: "#4353FF" }}>Outcome:</span>{" "}
                    Insurable titles, confident closings.
                  </p>
                </div>
              </div>

              {/* Card 4: Client File Management */}
              <div
                className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                data-testid="card-file-management"
              >
                <div className="mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                  >
                    <Folder className="w-7 h-7 text-white" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{ color: "#1E293B" }}
                  >
                    Client File Management
                  </h3>
                  <p
                    className="text-base font-medium mb-4"
                    style={{ color: "#4353FF" }}
                  >
                    Organized files, perfect compliance, audit-ready.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Organizing digital case files and transaction records</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Ensuring compliance with state bar and firm document retention standards</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Maintaining CRM entries and email logs</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#64748B" }}
                  >
                    <span style={{ color: "#4353FF" }}>Outcome:</span>{" "}
                    Complete records, ready for audits and ethics reviews.
                  </p>
                </div>
              </div>

              {/* Card 5: Client Communication & Intake */}
              <div
                className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                data-testid="card-communication-intake"
              >
                <div className="mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                  >
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{ color: "#1E293B" }}
                  >
                    Client Communication & Intake
                  </h3>
                  <p
                    className="text-base font-medium mb-4"
                    style={{ color: "#4353FF" }}
                  >
                    First impression that lasts.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Managing client intake forms and KYC requirements</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Scheduling consultations and follow-ups</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Answering routine client inquiries</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#64748B" }}
                  >
                    <span style={{ color: "#4353FF" }}>Outcome:</span>{" "}
                    Happy clients from day one.
                  </p>
                </div>
              </div>

              {/* Card 6: Billing & Admin */}
              <div
                className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                data-testid="card-billing-admin"
              >
                <div className="mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                  >
                    <DollarSign className="w-7 h-7 text-white" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{ color: "#1E293B" }}
                  >
                    Billing & Admin
                  </h3>
                  <p
                    className="text-base font-medium mb-4"
                    style={{ color: "#4353FF" }}
                  >
                    Faster invoices, better cashflow.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Time tracking and pre-billing assistance</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Invoicing and payment follow-ups</span>
                  </li>
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "#475569" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#4353FF" }}
                    />
                    <span>Calendar and inbox management for attorneys</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#64748B" }}
                  >
                    <span style={{ color: "#4353FF" }}>Outcome:</span>{" "}
                    Consistent revenue, zero admin headaches.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-16">
              <p
                className="text-lg sm:text-xl font-light mb-6"
                style={{ color: "#64748B" }}
              >
                The partner that quietly powers everything behind your success.
              </p>
              <Button
                size="lg"
                className="px-8 py-6 text-lg rounded-2xl touch-target"
                style={{
                  background:
                    "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                }}
                onClick={openBooking}
                data-testid="button-schedule-consultation"
              >
                Schedule Your LegalOps Consultation
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* Everything You Save with OnSpot LegalOps - Compact Elegant Grid */}
        <section
          className="py-12 sm:py-16 md:py-20 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 50%, #93C5FD 100%)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-white/5"></div>

          <div className="container-fluid relative z-10">
            {/* Section Header - Compact */}
            <div className="text-center mb-10 sm:mb-12 max-w-2xl mx-auto px-4">
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3"
                data-testid="text-savings-title"
              >
                Everything You Save with OnSpot LegalOps<sup className="text-base">™</sup>
              </h2>
              <p className="text-base sm:text-lg text-white/80 font-light">
                Smarter operations. Lighter overhead. Greater freedom.
              </p>
            </div>

            {/* Compact 2x3 Grid */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
              {/* Saving 1: Operating Costs */}
              <div
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 hover-elevate transition-all duration-300"
                data-testid="card-savings-costs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">70% Cost Savings</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Replace high-cost roles with trained LegalOps professionals. More margin on every case.
                    </p>
                  </div>
                </div>
              </div>

              {/* Saving 2: Hours */}
              <div
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 hover-elevate transition-all duration-300"
                data-testid="card-savings-time"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Countless Hours</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      No more managing staff or chasing documents. Focus on billable work.
                    </p>
                  </div>
                </div>
              </div>

              {/* Saving 3: Turnover */}
              <div
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 hover-elevate transition-all duration-300"
                data-testid="card-savings-turnover"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Stress & Turnover</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Managed team structure eliminates re-hiring and burnout cycles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Saving 4: Training */}
              <div
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 hover-elevate transition-all duration-300"
                data-testid="card-savings-training"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Settings className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Training Overhead</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      We handle onboarding, tools, and SOPs. Always-ready staff.
                    </p>
                  </div>
                </div>
              </div>

              {/* Saving 5: Escalations */}
              <div
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 hover-elevate transition-all duration-300"
                data-testid="card-savings-risk"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Escalation Risk</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Zero-Escalation Guarantee keeps cases compliant and on time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Saving 6: Growth */}
              <div
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 hover-elevate transition-all duration-300"
                data-testid="card-savings-growth"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Rocket className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Lost Opportunities</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Every freed hour goes into strategy and expansion. Scale, don't just survive.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom tagline - Compact */}
            <div className="text-center mt-8 sm:mt-10">
              <p className="text-base sm:text-lg text-white/80 font-light">
                Power through efficiency. Intelligence through systems.
              </p>
            </div>
          </div>
        </section>

        {/* Local Staff vs. OnSpot LegalOps Comparison - Compact Feature Grid */}
        <section className="py-12 sm:py-14 md:py-16 bg-white relative">
          <div className="container-fluid relative z-10">
            <div className="max-w-4xl mx-auto px-4">
              {/* Section Header - Minimal */}
              <div className="text-center mb-8">
                <p className="text-[#4353FF] text-xs font-semibold uppercase tracking-widest mb-2">
                  The comparison
                </p>
                <h2
                  className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2"
                  data-testid="text-comparison-title"
                >
                  Local Staff vs. OnSpot LegalOps<sup className="text-sm">™</sup>
                </h2>
                <p className="text-sm text-gray-500 max-w-lg mx-auto">
                  70% cost reduction with professional-grade execution.
                </p>
              </div>

              {/* Compact Feature Grid Table */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {/* Header Row */}
                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                  <div className="px-3 py-2 md:px-4 md:py-2.5"></div>
                  <div className="px-3 py-2 md:px-4 md:py-2.5 text-center border-l border-gray-200">
                    <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">NY Paralegal</span>
                  </div>
                  <div className="px-3 py-2 md:px-4 md:py-2.5 text-center border-l border-[#4353FF]/20 bg-[#4353FF]/5">
                    <span className="text-[10px] md:text-xs font-semibold text-[#4353FF] uppercase tracking-wide">OnSpot</span>
                  </div>
                </div>

                {/* COST ROW - Emphasized */}
                <div className="grid grid-cols-3 bg-gradient-to-r from-gray-50/50 to-[#4353FF]/5 border-b border-gray-200">
                  <div className="px-3 py-3 md:px-4 flex items-center">
                    <span className="text-xs md:text-sm font-bold text-gray-900">Monthly Cost</span>
                  </div>
                  <div className="px-3 py-3 md:px-4 text-center border-l border-gray-200 flex items-center justify-center">
                    <span className="text-sm md:text-base font-bold text-gray-600">~$6,650</span>
                  </div>
                  <div className="px-3 py-3 md:px-4 text-center border-l border-[#4353FF]/20 bg-[#4353FF]/10 flex items-center justify-center gap-1">
                    <span className="text-sm md:text-lg font-bold text-[#4353FF]">$1,950</span>
                    <span className="text-[10px] text-[#4353FF]/70 hidden sm:inline">all-in</span>
                  </div>
                </div>

                {/* Feature Rows - Compact */}
                <div className="divide-y divide-gray-100">
                  {[
                    { feature: "Hiring Time", local: "Weeks", onspot: "Days" },
                    { feature: "Replacement", local: "Disruptive", onspot: "Instant" },
                    { feature: "Benefits & Taxes", local: "Your expense", onspot: "Included" },
                    { feature: "Equipment", local: "You provide", onspot: "Included" },
                    { feature: "Performance Tracking", local: "Manual", onspot: "Dashboards" },
                    { feature: "Commitment", local: "Contract", onspot: "Month-to-month" },
                  ].map((row, idx) => (
                    <div key={idx} className="grid grid-cols-3" data-testid={`row-${row.feature.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="px-3 py-2 md:px-4 md:py-2.5 flex items-center">
                        <span className="text-xs text-gray-700">{row.feature}</span>
                      </div>
                      <div className="px-3 py-2 md:px-4 md:py-2.5 text-center border-l border-gray-100 flex items-center justify-center gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <X className="w-2 h-2 text-gray-400" />
                        </div>
                        <span className="text-xs text-gray-500">{row.local}</span>
                      </div>
                      <div className="px-3 py-2 md:px-4 md:py-2.5 text-center border-l border-[#4353FF]/10 bg-[#4353FF]/[0.02] flex items-center justify-center gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#4353FF]/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2 h-2 text-[#4353FF]" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{row.onspot}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upgrade Row */}
                <div className="grid grid-cols-3 border-t border-gray-200 bg-gray-50/50">
                  <div className="px-3 py-2.5 md:px-4 flex items-center">
                    <span className="text-xs font-medium text-gray-700">Upgrade Path</span>
                  </div>
                  <div className="px-3 py-2.5 md:px-4 text-center border-l border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-400">—</span>
                  </div>
                  <div className="px-3 py-2.5 md:px-4 text-center border-l border-[#4353FF]/10 flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-[#4353FF]" />
                    <span className="text-xs font-medium text-[#4353FF]">Managed Services</span>
                  </div>
                </div>
              </div>

              {/* Compact CTA */}
              <div className="text-center mt-6 sm:mt-8">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-6 sm:px-8 rounded-xl touch-target"
                  style={{ background: "#4353FF" }}
                  onClick={openBooking}
                  data-testid="button-comparison-cta"
                >
                  Start My 90-Day Trial
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How OnSpot LegalOps Works - Technical Process Timeline */}
        <section
          ref={processTimelineRef}
          className="py-16 sm:py-24 bg-gradient-to-br from-[#0A143C] to-[#15245A] text-white relative overflow-hidden"
        >
          {/* Grid pattern overlay for technical feel */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          ></div>

          {/* Accent lights */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
          <div className="absolute top-20 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>

          <div className="container-fluid relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4353FF]/20 border border-[#4353FF]/30 rounded-full mb-6">
                <Settings className="w-4 h-4 text-[#4353FF]" />
                <span className="text-sm font-semibold text-[#4353FF] uppercase tracking-wider">
                  The Process
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-white"
                data-testid="text-process-title"
              >
                How OnSpot LegalOps Works
              </h2>
              <p className="text-lg sm:text-xl text-[#C8D1F0] font-light">
                Your law firm's back office — rebuilt for precision, speed, and
                trust.
              </p>
            </div>

            {/* Timeline Steps with Vertical Connector */}
            <div className="max-w-5xl mx-auto relative">
              {/* Vertical timeline line */}
              <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500/50 via-cyan-500/50 to-emerald-500/50 hidden md:block"></div>

              <div className="space-y-8">
                {/* Step 1: Intake */}
                <div className="flex flex-col md:flex-row items-start gap-6 group">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 1</div>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: "#4353FF" }}>Intake & Discovery</h3>
                    <p className="text-sm text-white/80 leading-relaxed">Map workflows, uncover bottlenecks, assess integration points.</p>
                    <div className="flex items-start gap-2 pt-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#C8D1F0]"><span className="font-semibold">Clear plan</span> before deployment</p>
                    </div>
                  </div>
                </div>

                {/* Step 2: Workflow Mapping */}
                <div className="flex flex-col md:flex-row items-start gap-6 group">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <GitBranch className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 2</div>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: "#4353FF" }}>Workflow Mapping</h3>
                    <p className="text-sm text-white/80 leading-relaxed">Integrate with your tools, systems, and existing processes.</p>
                    <div className="flex items-start gap-2 pt-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#C8D1F0]"><span className="font-semibold">Seamless integration</span> with your stack</p>
                    </div>
                  </div>
                </div>

                {/* Step 3: Staffing */}
                <div className="flex flex-col md:flex-row items-start gap-6 group">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 3</div>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: "#4353FF" }}>Staffing & Training</h3>
                    <p className="text-sm text-white/80 leading-relaxed">Deploy and train your dedicated operations team on day one.</p>
                    <div className="flex items-start gap-2 pt-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#C8D1F0]"><span className="font-semibold">Experienced team</span> ready to execute</p>
                    </div>
                  </div>
                </div>

                {/* Step 4: SOP Alignment */}
                <div className="flex flex-col md:flex-row items-start gap-6 group">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <CheckSquare className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 4</div>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: "#4353FF" }}>SOP Implementation</h3>
                    <p className="text-sm text-white/80 leading-relaxed">Lock in standardized processes designed for your firm's needs.</p>
                    <div className="flex items-start gap-2 pt-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#C8D1F0]"><span className="font-semibold">Predictable execution</span> across all workflows</p>
                    </div>
                  </div>
                </div>

                {/* Step 5: QA & Reporting */}
                <div className="flex flex-col md:flex-row items-start gap-6 group">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <BarChart3 className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 5</div>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: "#4353FF" }}>QA & Reporting</h3>
                    <p className="text-sm text-white/80 leading-relaxed">Real-time dashboards, daily QA, transparent performance metrics.</p>
                    <div className="flex items-start gap-2 pt-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#C8D1F0]"><span className="font-semibold">Full visibility</span> and complete control
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 6: Grow */}
                <div className="flex flex-col md:flex-row items-start gap-6 group">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Rocket className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-[#C8D1F0] opacity-60">
                        STEP 6
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <h3
                      className="text-2xl font-bold"
                      style={{ color: "#4353FF" }}
                    >
                      Grow
                    </h3>
                    <p className="text-base text-white/90 leading-relaxed">
                      As your firm scales, your LegalOps team scales with you —
                      adding FTEs or integrating automation tools.
                    </p>
                    <div className="flex items-start gap-2 pt-2">
                      <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      </div>
                      <p className="text-sm text-[#C8D1F0]">
                        <span className="font-semibold">Outcome:</span> A
                        long-term partner that grows with your practice.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tagline */}
            <div className="text-center mt-16">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/20">
                <Sparkles className="w-5 h-5 text-[#4353FF]" />
                <p className="text-base sm:text-lg font-light text-white">
                  From Assessment to Stability — One Seamless LegalOps System.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What If You Don't Partner With OnSpot - Typography Driven */}
        <section className="py-28 sm:py-36 md:py-44 bg-slate-950">
          <div className="container-fluid">
            <div className="max-w-4xl mx-auto px-4 md:px-8">
              {/* Centered Typography */}
              <div className="text-center">
                {/* Main Headline - Scaled Up */}
                <h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-[1.1] tracking-tight"
                  data-testid="text-pain-points-title"
                >
                  What If You Don't Partner With OnSpot?
                </h2>

                {/* Tightened Body Copy */}
                <p className="text-lg sm:text-xl md:text-2xl text-slate-400 leading-relaxed max-w-3xl mx-auto font-light">
                  Rising overhead. Turnover chaos. Missed deadlines. Errors that cost reputation. Every in-house paralegal is $80K–$100K before benefits — and when they leave, knowledge leaves with them.
                </p>

                {/* Single Line Statement */}
                <p className="mt-10 text-xl sm:text-2xl text-white font-medium">
                  You grow in stress, not revenue.
                </p>

                {/* Subtle Divider */}
                <div className="w-16 h-px bg-slate-700 mx-auto my-12"></div>

                {/* Resolution */}
                <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto">
                  With OnSpot, you eliminate these risks — transforming chaos into a compliant, cost-efficient operation.
                </p>

                {/* CTA */}
                <div className="mt-12">
                  <Button
                    onClick={openBooking}
                    size="lg"
                    className="px-8 py-6 text-base rounded-xl touch-target"
                    style={{
                      background: "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                    }}
                    data-testid="button-pain-points-cta"
                  >
                    Book Free Diagnostic
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-14 sm:py-20 md:py-28 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
          {/* Subtle decorative elements */}
          <div className="absolute top-20 right-10 w-64 h-64 bg-[#4353FF]/5 rounded-full blur-3xl hidden sm:block"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl hidden sm:block"></div>

          <div className="container-fluid relative z-10">
            {/* Section Header */}
            <div className="text-center mb-10 sm:mb-16 max-w-3xl mx-auto px-4">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#4353FF]/10 border border-[#4353FF]/20 rounded-full mb-4 sm:mb-6">
                <MessageCircle
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  style={{ color: "#4353FF" }}
                />
                <span
                  className="text-xs sm:text-sm font-semibold"
                  style={{ color: "#4353FF" }}
                >
                  FAQ
                </span>
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4"
                style={{ color: "#1E293B" }}
                data-testid="text-faq-title"
              >
                Frequently Asked Questions
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-slate-600 font-light">
                Everything you need to know before outsourcing your LegalOps.
              </p>
            </div>

            {/* FAQ Accordion - Mobile Optimized */}
            <div className="max-w-4xl mx-auto px-4 sm:px-0">
              <Accordion type="single" collapsible className="space-y-2 sm:space-y-4">
                {/* FAQ 1 */}
                <AccordionItem
                  value="item-1"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-1"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    What exactly is OnSpot LegalOps™?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      OnSpot LegalOps™ is a full-service outsourcing system for
                      law firms — combining trained legal professionals,
                      structured processes, and delivery oversight.
                    </p>
                    <p className="text-xs sm:text-sm italic text-slate-500">
                      Our teams are trained specifically for legal workflows — not general virtual assistance.
                    </p>
                    <p>
                      We handle the operational side of your practice —
                      including rent demands, petitions, Section 8
                      documentation, legal research, and client coordination —
                      so your team can focus entirely on legal strategy and
                      billable work.
                    </p>
                    <p>
                      Our system is built on the{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        OnSpot 4P Operating System
                      </span>
                      : Philosophy, People, Process, and Problem Solving, which
                      guarantees consistent, measurable, and transparent
                      results.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 2 */}
                <AccordionItem
                  value="item-2"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-2"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    How does the "Resourced Services" model work?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      In the Resourced Services model, OnSpot provides you with
                      dedicated full-time legal staff (FTEs) who work directly
                      under your firm's management and follow your workflow.
                    </p>
                    <p>
                      You control day-to-day operations, while we handle
                      recruitment, onboarding, HR, payroll, and replacement.
                    </p>
                    <p>
                      We also include tools like Talent Performance Surveys
                      (TPS), Early Warning Systems, and Quarterly Account Health
                      Reviews to ensure ongoing quality and compliance.
                    </p>
                    <p>
                      If you ever want more support, you can easily upgrade to{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        Managed Services
                      </span>
                      , where OnSpot provides full operational oversight,
                      coaching, QA reviews, and reporting.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 3 */}
                <AccordionItem
                  value="item-3"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-3"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    What's the difference between "Resourced" and "Managed
                    Services"?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6"
                    style={{ color: "#475569" }}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr
                            className="border-b-2"
                            style={{ borderColor: "#E2E8F0" }}
                          >
                            <th
                              className="text-left py-3 px-4 font-semibold"
                              style={{ color: "#1E293B" }}
                            >
                              Category
                            </th>
                            <th
                              className="text-left py-3 px-4 font-semibold"
                              style={{ color: "#1E293B" }}
                            >
                              Resourced Services
                            </th>
                            <th
                              className="text-left py-3 px-4 font-semibold"
                              style={{ color: "#4353FF" }}
                            >
                              Managed Services
                            </th>
                          </tr>
                        </thead>
                        <tbody
                          className="divide-y"
                          style={{ borderColor: "#E2E8F0" }}
                        >
                          <tr>
                            <td className="py-3 px-4 font-medium">
                              Who Manages Daily Work
                            </td>
                            <td className="py-3 px-4">Your firm</td>
                            <td
                              className="py-3 px-4"
                              style={{ color: "#4353FF" }}
                            >
                              OnSpot Delivery Manager & Team Manager
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">
                              Performance Monitoring
                            </td>
                            <td className="py-3 px-4">
                              Light support (TPS every 30/60/90 days)
                            </td>
                            <td
                              className="py-3 px-4"
                              style={{ color: "#4353FF" }}
                            >
                              Full KPI tracking, QA audits, dashboards
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Reporting</td>
                            <td className="py-3 px-4">Quarterly reviews</td>
                            <td
                              className="py-3 px-4"
                              style={{ color: "#4353FF" }}
                            >
                              Weekly/monthly reports
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">
                              Team Manager
                            </td>
                            <td className="py-3 px-4">Optional/shared</td>
                            <td
                              className="py-3 px-4"
                              style={{ color: "#4353FF" }}
                            >
                              Dedicated, full-time
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Cost</td>
                            <td className="py-3 px-4">Lower, flexible</td>
                            <td
                              className="py-3 px-4"
                              style={{ color: "#4353FF" }}
                            >
                              Higher, full-service
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Best For</td>
                            <td className="py-3 px-4">
                              Firms with internal oversight
                            </td>
                            <td
                              className="py-3 px-4"
                              style={{ color: "#4353FF" }}
                            >
                              Firms seeking total hands-off operations
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 4 */}
                <AccordionItem
                  value="item-4"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-4"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    What roles can OnSpot support?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      We can deploy specialized legal support staff trained in:
                    </p>
                    <ul className="space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <CheckCircle2
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          <span className="font-semibold">
                            Landlord–Tenant workflows:
                          </span>{" "}
                          rent demands, petitions, Section 8/NYCHA processing
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          <span className="font-semibold">
                            Administrative roles:
                          </span>{" "}
                          billing, client intake, document management
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>Legal research and drafting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>Calendar and compliance coordination</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          <span className="font-semibold">
                            Digital and marketing support:
                          </span>{" "}
                          email campaigns, social proof, SEO, etc.
                        </span>
                      </li>
                    </ul>
                    <p className="pt-2">
                      Each FTE is handpicked, trained on your tools (Clio,
                      Smokeball, MyCase, etc.), and supported by our internal
                      delivery infrastructure.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 5 */}
                <AccordionItem
                  value="item-5"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-5"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    How much can my firm really save?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      On average, firms save{" "}
                      <span
                        className="font-bold text-xl sm:text-2xl"
                        style={{ color: "#4353FF" }}
                      >
                        up to 70%
                      </span>{" "}
                      compared to hiring in-house.
                    </p>
                    <p>
                      A paralegal in New York costs roughly{" "}
                      <span className="font-semibold text-red-600">
                        $6,650 per month
                      </span>{" "}
                      including benefits and overhead, whereas OnSpot LegalOps
                      staff start at{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        $1,950 per month
                      </span>{" "}
                      — fully loaded, no hidden costs.
                    </p>
                    <p>
                      Plus, you eliminate expenses like taxes, insurance,
                      hardware, office space, and turnover retraining.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* Mobile "View all FAQs" toggle - Hidden FAQs 6-13 on mobile until expanded */}
                <div className={`space-y-2 sm:space-y-4 ${showAllFAQs ? 'block' : 'hidden sm:block'}`}>
                  {/* FAQ 6 */}
                  <AccordionItem
                    value="item-6"
                    className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                    data-testid="accordion-faq-6"
                  >
                    <AccordionTrigger
                      className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                      style={{ color: "#1E293B" }}
                    >
                      How do you ensure quality and compliance?
                    </AccordionTrigger>
                    <AccordionContent
                      className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                      style={{ color: "#475569" }}
                    >
                    <p>
                      Quality is maintained through our{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        Delivery Playbook
                      </span>
                      , which includes:
                    </p>
                    <ul className="space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <Shield
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          Talent Performance Surveys (TPS) every 30/60/90 days
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          Probation checkpoints and GROW coaching for skill
                          improvement
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          Early Warning System (EWS) for client-health tracking
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          Risk Management Framework and Issue Escalation SOP
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>
                          Quarterly Account Reviews to identify improvements or
                          growth areas
                        </span>
                      </li>
                    </ul>
                    <p className="pt-2">
                      We also ensure data security, NDA compliance, and
                      confidentiality aligned with U.S. legal standards.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 7 */}
                <AccordionItem
                  value="item-7"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-7"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    How long does it take to get started?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      Most clients launch within{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        2–3 weeks
                      </span>
                      .
                    </p>
                    <p>Our implementation includes:</p>
                    <ol className="space-y-2 pl-6 list-decimal list-outside">
                      <li>
                        <span className="font-semibold">Kickoff Call</span>{" "}
                        (scope alignment & expectations)
                      </li>
                      <li>
                        <span className="font-semibold">
                          Talent Onboarding & Tech Setup
                        </span>
                      </li>
                      <li>
                        <span className="font-semibold">Training Phase</span>{" "}
                        (tools & SOPs)
                      </li>
                      <li>
                        <span className="font-semibold">Go-Live</span> (your
                        staff begins active case work)
                      </li>
                      <li>
                        <span className="font-semibold">
                          Monitoring & Performance Support
                        </span>{" "}
                        (first 90 days)
                      </li>
                    </ol>
                    <p className="pt-2">
                      By Day 90, we deliver a full{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        Handoff Summary
                      </span>
                      , confirming stability and next-step recommendations.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 8 */}
                <AccordionItem
                  value="item-8"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-8"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    What if I'm not happy with a staff member's performance?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      We make replacements{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        fast and frictionless
                      </span>
                      .
                    </p>
                    <p>
                      If a staff member underperforms, our Delivery Manager
                      initiates coaching or replacement at no additional cost.
                    </p>
                    <p>
                      All replacements are pre-vetted and trained using your
                      existing SOPs to ensure zero downtime.
                    </p>
                    <p>
                      Our{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        Zero Escalation Guarantee
                      </span>{" "}
                      ensures you'll never be left managing issues alone.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 9 */}
                <AccordionItem
                  value="item-9"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-9"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    What does "Fully Managed Upgrade" mean?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      The Managed Services upgrade adds a Delivery Manager, Team
                      Manager, and QA Lead to handle:
                    </p>
                    <ul className="space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <Target
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>Daily performance monitoring</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>Weekly check-ins with your team</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>Quality audits and dashboards</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#4353FF" }}
                        />
                        <span>Coaching and continuous improvement</span>
                      </li>
                    </ul>
                    <p className="pt-2">
                      It's ideal for firms that want a hands-off, data-driven
                      delivery model without managing staff directly.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 10 */}
                <AccordionItem
                  value="item-10"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-10"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    How does OnSpot maintain confidentiality and data security?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      All staff operate under strict NDAs, data-protection
                      policies, and secure IT infrastructure.
                    </p>
                    <p>
                      We follow best practices for client confidentiality,
                      access control, and information handling.
                    </p>
                    <p>
                      Our teams work in monitored environments with encrypted
                      communications and adhere to U.S. privacy standards —
                      ensuring your firm's data is always protected.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 11 */}
                <AccordionItem
                  value="item-11"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-11"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    Can I scale up or down easily?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      Yes —{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        scalability is built in
                      </span>
                      .
                    </p>
                    <p>
                      You can start with one full-time LegalOps specialist and
                      add more as your caseload grows.
                    </p>
                    <p>
                      Likewise, you can scale down or pause positions with
                      notice — no long-term contracts, no HR headaches.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 12 */}
                <AccordionItem
                  value="item-12"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-12"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    What makes OnSpot different from generic outsourcing
                    companies?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Award
                            className="w-4 h-4"
                            style={{ color: "#4353FF" }}
                          />
                        </div>
                        <div>
                          <span className="font-semibold block">
                            Legal-specific expertise:
                          </span>
                          <span>
                            Built for landlord–tenant and property law
                            practices.
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Settings
                            className="w-4 h-4"
                            style={{ color: "#4353FF" }}
                          />
                        </div>
                        <div>
                          <span className="font-semibold block">
                            Structured SOPs:
                          </span>
                          <span>
                            Standardized across every process for consistency.
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BarChart3
                            className="w-4 h-4"
                            style={{ color: "#4353FF" }}
                          />
                        </div>
                        <div>
                          <span className="font-semibold block">
                            Delivery oversight:
                          </span>
                          <span>
                            Even in Resourced mode, we track performance.
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield
                            className="w-4 h-4"
                            style={{ color: "#4353FF" }}
                          />
                        </div>
                        <div>
                          <span className="font-semibold block">
                            Transparency:
                          </span>
                          <span>
                            cNPS and QBR systems ensure accountability.
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Rocket
                            className="w-4 h-4"
                            style={{ color: "#4353FF" }}
                          />
                        </div>
                        <div>
                          <span className="font-semibold block">
                            Scalability:
                          </span>
                          <span>
                            Instant expansion or Managed upgrade when needed.
                          </span>
                        </div>
                      </li>
                    </ul>
                    <p
                      className="pt-4 font-medium"
                      style={{ color: "#1E293B" }}
                    >
                      In short, we don't just fill roles — we build a LegalOps
                      system that runs reliably every day.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 13 */}
                <AccordionItem
                  value="item-13"
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  data-testid="accordion-faq-13"
                >
                  <AccordionTrigger
                    className="text-sm sm:text-lg font-semibold hover:no-underline py-3 sm:py-6 text-left leading-snug sm:leading-normal"
                    style={{ color: "#1E293B" }}
                  >
                    How do I start my free consultation?
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm sm:text-base leading-snug sm:leading-relaxed pb-4 sm:pb-6 space-y-3 sm:space-y-4"
                    style={{ color: "#475569" }}
                  >
                    <p>
                      Simply click{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "#4353FF" }}
                      >
                        "Start My 90-Day Trial"
                      </span>{" "}
                      on this page.
                    </p>
                    <p>We'll schedule a 15-minute discovery call to:</p>
                    <ul className="space-y-2 pl-6 list-disc list-outside">
                      <li>Review your firm's workflow</li>
                      <li>Estimate savings and role recommendations</li>
                      <li>Outline your implementation timeline</li>
                    </ul>
                    <p className="pt-2">
                      You'll receive a custom proposal within 48 hours — no
                      commitment required.
                    </p>
                    <div className="pt-4">
                      <Button
                        size="lg"
                        className="px-8 rounded-2xl touch-target"
                        style={{
                          background:
                            "linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)",
                        }}
                        onClick={openBooking}
                        data-testid="button-faq-cta"
                      >
                        Start My 90-Day Trial
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                </div>
              </Accordion>

              {/* Mobile "View all FAQs" button - only visible on mobile when not expanded */}
              <button
                onClick={() => setShowAllFAQs(!showAllFAQs)}
                className="sm:hidden w-full mt-3 py-3 px-4 text-sm font-medium text-[#4353FF] bg-[#4353FF]/5 rounded-xl border border-[#4353FF]/20 hover-elevate transition-all duration-200 flex items-center justify-center gap-2 touch-target"
                data-testid="button-view-all-faqs"
              >
                {showAllFAQs ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Show fewer questions
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    View all 13 FAQs
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-12 sm:py-16 md:py-24 bg-gradient-to-br from-violet-600 via-blue-600 to-indigo-600 text-white">
          <div className="container-fluid text-center px-4 sm:px-6">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6"
              data-testid="text-final-cta-title"
            >
              Book Your LegalOps Diagnostic
            </h2>
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 opacity-90 max-w-2xl mx-auto">
              Only {availableSlots} slots available this month. Secure yours now.
            </p>
            <div className="flex flex-col gap-4 sm:gap-6 justify-center items-center">
              <Button
                onClick={openBooking}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-white text-violet-600 border-white hover:bg-white/90 touch-target px-6 sm:px-8"
                data-testid="button-final-cta"
              >
                Start My 90-Day LegalOps Trial →
              </Button>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-sm">
                <a
                  href="tel:1-917-801-9294"
                  className="flex items-center gap-2 hover:underline touch-target justify-center"
                >
                  <Phone className="h-4 w-4" />
                  1-917-801-9294
                </a>
                <a
                  href="mailto:jake@onspotglobal.com"
                  className="flex items-center gap-2 hover:underline touch-target justify-center"
                >
                  <Mail className="h-4 w-4" />
                  jake@onspotglobal.com
                </a>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-6 sm:mt-8 max-w-2xl mx-auto px-4">
              We support preparation, coordination, and operational execution. All filings and legal sign-offs remain with licensed professionals.
            </p>
          </div>
        </section>

        {/* Bottom Spacer for Sticky Footer */}
        <div className="h-16" />
      </div>

      {/* Operations Playbook Modal - Triggered on scroll */}
      <Dialog open={showPlaybookModal} onOpenChange={setShowPlaybookModal}>
        <DialogContent
          className="max-w-3xl p-0 overflow-hidden border-0 bg-transparent"
          style={{
            background:
              "radial-gradient(circle at 30% 50%, #4353FF 0%, #2B3FCC 35%, #1E2F9A 70%, #0A143C 100%)",
          }}
        >
          {/* Animated flowing lines SVG overlay */}
          <svg
            className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            viewBox="0 0 600 400"
            aria-hidden="true"
          >
            <path
              d="M 0,200 Q 150,150 300,200 T 600,200"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="10 5"
              className="playbook-pulse-path"
            />
            <path
              d="M 0,150 Q 200,100 400,150 T 600,150"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="8 4"
              className="playbook-pulse-path"
              style={{ animationDelay: "2s" }}
            />
            <circle
              cx="150"
              cy="150"
              r="4"
              fill="rgba(255,255,255,0.6)"
              className="playbook-node-drift-1"
            />
            <circle
              cx="300"
              cy="200"
              r="5"
              fill="rgba(255,255,255,0.7)"
              className="playbook-node-drift-2"
            />
            <circle
              cx="450"
              cy="150"
              r="4"
              fill="rgba(255,255,255,0.6)"
              className="playbook-node-drift-3"
            />
          </svg>

          {/* Content */}
          <div className="relative z-10 p-8 sm:p-12 text-center space-y-6">
            {/* Icon badge */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>

            <DialogHeader>
              <DialogTitle className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                The OnSpot Operations Playbook
              </DialogTitle>
              <DialogDescription className="text-lg sm:text-xl text-white/90 font-light pt-2">
                Our proven system that makes outsourcing effortless
              </DialogDescription>
            </DialogHeader>

            {/* Guiding message */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-3">
              <p className="text-white/95 text-base sm:text-lg">
                You've seen how OnSpot LegalOps works. Now discover the complete
                framework that powers every successful implementation.
              </p>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white/85 text-sm sm:text-base">
                  <span className="font-semibold">4P Operating System:</span>{" "}
                  Philosophy, People, Process, Problem Solving
                </p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white/85 text-sm sm:text-base">
                  <span className="font-semibold">Service Models:</span> Managed
                  & Resourced solutions
                </p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white/85 text-sm sm:text-base">
                  <span className="font-semibold">
                    Implementation Framework:
                  </span>{" "}
                  From kickoff to handoff
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                asChild
                size="lg"
                className="flex-1 px-6 py-6 text-base rounded-2xl bg-white text-[#4353FF] hover:bg-white/95 active:bg-white/90 transition-all duration-300 playbook-cta-glow touch-target"
                data-testid="button-view-playbook-modal"
              >
                <a
                  href="https://www.onspotglobal.com/operations-playbook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View the Full Playbook
                  <ChevronRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button
                onClick={() => {
                  setShowPlaybookModal(false);
                  openBooking();
                }}
                size="lg"
                variant="outline"
                className="flex-1 px-6 py-6 text-base rounded-2xl bg-white/10 text-white border-white/30 hover:bg-white/20 transition-all duration-300"
                data-testid="button-start-trial-modal"
              >
                Start My Trial Now
              </Button>
            </div>

            {/* Helper text */}
            <p className="text-white/70 text-sm pt-2">
              Not ready yet? Close this to continue exploring.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
