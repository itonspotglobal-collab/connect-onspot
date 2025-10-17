import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  TrendingUp,
  DollarSign,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  Target,
  ArrowRight,
  Bot,
  Zap,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { SiAmazon, SiQuickbooks, SiReplit, SiStripe } from "react-icons/si";
import { Link } from "wouter";
import { VanessaChat } from "@/components/VanessaChat";

import FlashLogo from "../assets/logos/Flash.png";
import FutureEVLogo from "../assets/logos/FutureEV.png";
import IPSLogo from "../assets/logos/IPS.png";
import PinetechLogo from "../assets/logos/Pinetech.png";
import SafewayLogo from "../assets/logos/Safeway.png";
import VertexLogo from "../assets/logos/Vertex.png";

import FrederickPhoto from "../assets/logos/Frederick.png";
import AmiraPhoto from "../assets/logos/Amira.png";
import JuliePhoto from "../assets/logos/Julie.png";
import PaigePhoto from "../assets/logos/Paige.png";

const trustedBrands = [
  { name: "Flash Justice", logo: FlashLogo },
  { name: "Future Motors EV", logo: FutureEVLogo },
  { name: "IPS by Meest", logo: IPSLogo },
  { name: "Pinetech", logo: PinetechLogo },
  { name: "Safeway Moving", logo: SafewayLogo },
  { name: "Vertex Education", logo: VertexLogo },
];

const valueTiles = [
  {
    label: "AI Assistant",
    description: "24/7, integrated, fast.",
    icon: Bot,
  },
  {
    label: "Managed Services",
    description: "We run the engine.",
    icon: Zap,
  },
  {
    label: "Resourced Talent",
    description: "Elite, on-demand.",
    icon: Users,
  },
];

const integrations = [
  { name: "Microsoft", icon: null },
  { name: "Go High Level", icon: null },
  { name: "Lindy AI", icon: Bot },
  { name: "Replit", icon: SiReplit },
  { name: "OnSpot Intelligence", icon: Zap },
  { name: "AWS", icon: SiAmazon },
  { name: "BambooHR", icon: Users },
  { name: "QuickBooks", icon: SiQuickbooks },
  { name: "Stripe", icon: SiStripe },
  { name: "More", icon: null },
];

const popularSkills = [
  "Virtual Assistant",
  "Customer Service",
  "Data Entry",
  "Lead Generation",
  "Content Writing",
  "Social Media Management",
  "Graphic Design",
  "Web Development",
  "React",
  "Node.js",
  "WordPress",
  "Shopify",
  "QuickBooks",
  "SEO",
];

const onspotExperience = [
  {
    stage: "01",
    title: "Let's Implement",
    description: "We do the heavy lifting for you",
    steps: [
      "Talk to Us",
      "Design Solutions",
      "Strike a Deal",
      "Project Plan",
      "Design Framework",
      "Training",
    ],
  },
  {
    stage: "02",
    title: "Build Your Team",
    description: "Hire the right people at the right seat",
    steps: [
      "Job Description",
      "Talent Sourcing",
      "Initial Screening",
      "Top Grading",
      "Client Interview",
      "Reference Check",
    ],
  },
  {
    stage: "03",
    title: "Start Operations",
    description: "Guided by the experts",
    steps: [
      "Nesting",
      "90-Day Incubation",
      "Monthly Reviews",
      "Process Optimization",
      "Innovation Lab",
      "Grow!",
    ],
  },
  {
    stage: "04",
    title: "We Innovate Together",
    description: "People, Process, Problem-Solving",
    steps: [
      "Performance Review",
      "Idea Generation",
      "Concept Development",
      "Evaluation & Selection",
      "Implementation",
      "Monitoring",
    ],
  },
];

const testimonials = [
  {
    name: "Frederic Hill",
    role: "Founder & CEO",
    quote:
      "I just had to take a moment to express my gratitude for the outstanding service they provided. Their complete assistance and efforts were truly remarkable",
    photo: FrederickPhoto,
  },
  {
    name: "Julie Reyes",
    role: "Account Executive",
    quote:
      "Every step of the way they provided helpful advice, recommended strategies to ensure our website was optimally set up, and made sure every element was clear and concise.",
    photo: JuliePhoto,
  },
  {
    name: "Amira Santos",
    role: "Data Engineer",
    quote:
      "Excellent service and thoroughly trained professionals, and their follow-up on tickets was handled with such care and attention to detail.",
    photo: AmiraPhoto,
  },
];

export default function Home() {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);

  // Track scroll position to determine if past hero section
  useEffect(() => {
    const handleScroll = () => {
      // Hero section is min-h-screen, so check if scrolled past viewport height
      const scrollPosition = window.scrollY;
      const heroHeight = window.innerHeight;
      setIsScrolledPastHero(scrollPosition > heroHeight * 0.8); // Trigger at 80% of hero height
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="relative overflow-hidden min-h-screen flex items-center justify-center hero-investor">
        {/* Elegant Gradient Overlay for Depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30"></div>

        {/* Subtle Animated Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full blur-3xl animate-gentle-float"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl animate-slow-spin"></div>
        </div>

        <div className="container mx-auto text-center relative z-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto space-y-8 sm:space-y-10 lg:space-y-12">
            {/* Ultra-minimal Badge */}
            <div
              className="hero-fade-up inline-flex items-center gap-2.5 text-xs sm:text-sm font-medium text-white/90 tracking-wide bg-white/5 backdrop-blur-xl px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-white/20"
              data-testid="badge-superhuman-bpo"
            >
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              Making Outsourcing Easy
            </div>

            {/* AI-First Headline */}
            <div className="space-y-3 sm:space-y-4 hero-fade-up">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.1] text-white px-2">
                AI first. Humans when it matters.
              </h1>
            </div>

            {/* Subcopy */}
            <div className="hero-fade-up-delay">
              <p className="text-lg sm:text-xl md:text-2xl text-white/70 font-light tracking-wide px-2">
                One system. Your unfair advantage.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 hero-fade-up-delay px-4">
              <Button
                size="lg"
                onClick={() => setShowVanessaChat(true)}
                className="relative group text-sm sm:text-base px-6 sm:px-8 h-auto bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all duration-300 hover-elevate rounded-2xl w-full sm:w-auto sm:min-w-[220px] py-3.5 sm:py-4 min-h-[48px]"
                data-testid="button-launch-ai"
              >
                <span className="flex items-center gap-2 justify-center">
                  Launch AI Assistant
                  <Sparkles className="w-4 sm:w-5 h-4 sm:h-5" />
                </span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 -z-10"></div>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 font-medium backdrop-blur-xl bg-white/5 rounded-2xl w-full sm:w-auto sm:min-w-[220px] py-3.5 sm:py-4 min-h-[48px]"
                asChild
                data-testid="button-get-managed-team"
              >
                <Link href="/lead-intake">Get Managed Team</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted By Section */}
      <div className="container mx-auto px-4 sm:px-6 space-y-8 sm:space-y-12">
        <div className="text-center space-y-6 sm:space-y-8">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-3 sm:mb-4">
              Trusted by
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold px-4">
              Global brands, hundreds of entrepreneurs, and thousands of
              professionals.
            </h2>
          </div>

          {/* Brand Logos Strip */}
          <div className="relative py-6 sm:py-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 sm:gap-x-12 gap-y-6 sm:gap-y-8">
              {trustedBrands.map((brand, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center"
                  data-testid={`brand-logo-${index}`}
                >
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="h-10 sm:h-12 w-auto object-contain grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Value Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12 lg:mt-16">
          {valueTiles.map((tile, index) => (
            <Card
              key={index}
              className="rounded-2xl border hover-elevate transition-all duration-200"
              data-testid={`value-tile-${index}`}
            >
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-3 sm:space-y-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <tile.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      {tile.label}
                    </p>
                    <p className="text-lg sm:text-xl font-bold">
                      {tile.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Integrations Strip */}
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">
              Integrates with
            </p>
            <span className="text-xs text-muted-foreground">and many more</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10 gap-2 sm:gap-3">
            {integrations.map((integration, index) => (
              <Card
                key={index}
                className="hover-elevate transition-all duration-200 bg-card/50 border"
                data-testid={`integration-${index}`}
              >
                <CardContent className="p-2 sm:p-3 h-10 sm:h-12 flex items-center justify-center">
                  {integration.icon ? (
                    <integration.icon className="w-5 h-5 sm:w-6 sm:h-6 text-foreground/60" />
                  ) : (
                    <span className="text-[10px] sm:text-xs font-medium text-foreground/60 text-center truncate px-1">
                      {integration.name}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Amazing Stories - Testimonials */}
      <div className="bg-stories-light pb-12 sm:pb-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center space-y-2 sm:space-y-3 mb-8 sm:mb-12 pt-12 sm:pt-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              Amazing Stories
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              Real results from real people
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-background rounded-2xl p-5 sm:p-6 hover-elevate transition-all duration-300 h-full flex flex-col"
                data-testid={`testimonial-${index}`}
              >
                <p className="text-sm sm:text-base leading-relaxed flex-grow">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3 mt-5 sm:mt-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border shadow-sm flex-shrink-0">
                    <img
                      src={testimonial.photo}
                      alt={testimonial.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8 sm:mt-12">
            <Button
              variant="outline"
              size="lg"
              className="min-h-[48px]"
              asChild
            >
              <Link href="/amazing">
                Read More Stories
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Popular Skills */}
      <div className="container mx-auto px-4 sm:px-6 space-y-8 sm:space-y-12">
        <div className="text-center space-y-3 sm:space-y-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold px-4">
            Want to Hire Talent?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            Our talent pool covers the most sought-after skills in the market
          </p>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-8">
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
              {popularSkills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="hover-elevate cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
                  data-testid={`popular-skill-${skill.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {skill}
                </Badge>
              ))}
            </div>
            <div className="text-center mt-6 sm:mt-8">
              <Button
                size="lg"
                className="min-h-[48px] w-full sm:w-auto"
                asChild
              >
                <Link href="/hire-talent">
                  <Search className="w-4 h-4 mr-2" />
                  Search All Skills
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Why OnSpot Advantage */}
      <div className="container mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="text-center space-y-2 sm:space-y-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold px-4">
            Why Outsource OnSpot
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            Discover the competitive advantages of working with OnSpot
            professionals
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card className="hover-elevate">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                <span>Strategic Location</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span>Time Zone Overlap with US:</span>
                  <Badge variant="outline">12+ hours</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>English Proficiency:</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-3 h-3 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cultural Alignment:</span>
                  <Badge variant="outline" className="text-green-600">
                    Excellent
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                <span>Cost Efficiency</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span>Average Cost Savings:</span>
                  <Badge variant="outline" className="text-green-600">
                    70%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Quality Standards:</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-3 h-3 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>ROI Timeline:</span>
                  <Badge variant="outline">30-90 days</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Call to Action */}
      <div className="container mx-auto px-4 sm:px-6">
        <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20">
          <CardContent className="p-6 sm:p-8 lg:p-10 text-center space-y-4 sm:space-y-5">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold px-2">
              Ready to Scale Your Operations?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              Join 85+ companies already saving millions with our OnSpot talent
              network. Start building your dream team today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
              <Button
                size="lg"
                className="min-h-[48px] w-full sm:w-auto"
                asChild
                data-testid="button-get-started"
              >
                <Link href="/lead-intake">
                  <Users className="w-5 h-5 mr-2" />
                  Get Started Now
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-[48px] w-full sm:w-auto"
                asChild
                data-testid="button-learn-more"
              >
                <Link href="/lead-intake">
                  <Clock className="w-5 h-5 mr-2" />
                  Schedule Consultation
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vanessa AI Assistant Chat */}
      {showVanessaChat ? (
        <VanessaChat
          isOpen={showVanessaChat}
          onClose={() => setShowVanessaChat(false)}
          isSticky={isScrolledPastHero}
        />
      ) : (
        // Minimized Chat Bubble Button (matches VanessaChat design)
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
          <Button
            size="icon"
            onClick={() => setShowVanessaChat(true)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover-elevate transition-transform hover:scale-105"
            data-testid="button-open-chat"
          >
            <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
          </Button>
        </div>
      )}
    </div>
  );
}
