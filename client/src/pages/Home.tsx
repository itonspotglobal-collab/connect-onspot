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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Mail,
  Phone,
  MapPinIcon,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  ChevronDown,
} from "lucide-react";
import { SiAmazon, SiQuickbooks, SiReplit, SiStripe } from "react-icons/si";
import { Link } from "wouter";
import { VanessaChat } from "@/components/VanessaChat";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

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

const superhumanSystem = [
  {
    title: "AI Virtual Assistant",
    subtitle: "Your superhuman work companion.",
    icon: Bot,
    gradient: "from-violet-500/20 to-blue-500/20",
  },
  {
    title: "Managed Services",
    subtitle: "AI-enhanced teams that scale with you.",
    icon: Zap,
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    title: "Resourced Services",
    subtitle: "Dedicated experts on demand.",
    icon: Sparkles,
    gradient: "from-cyan-500/20 to-violet-500/20",
  },
];

const humanStoriesData = [
  {
    name: "Frederick Ramos",
    role: "Lead DevOps at Flash Justice",
    story:
      "OnSpot isn't just a platform—it's our secret weapon. We needed a senior developer fast. Within 72 hours, they matched us with talent who hit the ground running. No handholding, no ramp-up time—just pure execution.",
    outcome:
      "Our deployment cycle improved by 40%. Our team is stronger. Our clients are happier. OnSpot doesn't just find talent—they deliver transformation.",
    photo: FrederickPhoto,
  },
  {
    name: "Amira Chen",
    role: "Founder of Future Motors EV",
    story:
      "We're building the next generation of electric vehicles—at startup speed. OnSpot gave us a competitive edge we didn't know was possible. Their managed support team became an extension of ours—adaptive, intelligent, relentless.",
    outcome:
      "We shipped features 3x faster than our competitors. OnSpot didn't just fill gaps—they gave us superpowers.",
    photo: AmiraPhoto,
  },
  {
    name: "Julie Rodriguez",
    role: "COO at IPS by Meest",
    story:
      "Scaling globally is chaos. OnSpot brought order. They connected us with professionals who not only understood logistics but anticipated our needs before we did.",
    outcome:
      "Customer satisfaction up 28%. Operations costs down 35%. OnSpot delivered more than efficiency—they delivered excellence.",
    photo: JuliePhoto,
  },
  {
    name: "Paige Mitchell",
    role: "CEO at Vertex Education",
    story:
      "Education moves fast. Innovation moves faster. OnSpot matched us with a multi-skilled team that built, launched, and optimized our platform in record time.",
    outcome:
      "Student engagement increased 65%. Churn dropped by half. OnSpot didn't just help us grow—they helped us win.",
    photo: PaigePhoto,
  },
];

export default function Home() {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.getElementById("hero-section");
      if (heroSection) {
        const heroBottom = heroSection.getBoundingClientRect().bottom;
        setIsScrolledPastHero(heroBottom < 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased overflow-x-hidden">
      {/* Hero Section */}
      <div
        id="hero-section"
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-zinc-900 to-zinc-950 animate-pulse-slow"></div>
        
        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/30 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float-delayed"></div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 py-20 sm:py-32">
          <div className="max-w-5xl mx-auto text-center space-y-8 sm:space-y-12">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-white/80">
                AI + Human = Unstoppable
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight">
              The Superhuman System
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Built for Builders
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              We don't just outsource tasks — we deliver transformation.
              AI-powered intelligence meets Filipino excellence. Scale faster,
              build smarter, win bigger.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button
                size="lg"
                className="min-h-[56px] px-8 text-base sm:text-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto"
                asChild
                data-testid="button-hire-talent"
              >
                <Link href="/hire-talent">
                  <Search className="w-5 h-5 mr-2" />
                  Hire Elite Talent
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto border-2 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                asChild
                data-testid="button-managed-team"
              >
                <Link href="/lead-intake">
                  <Users className="w-5 h-5 mr-2" />
                  Get Managed Team
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted By Section */}
      <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white/90 mb-2">
              Trusted by Industry Leaders
            </h2>
            <p className="text-white/60">
              Companies that choose excellence choose OnSpot
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center max-w-6xl mx-auto">
            {trustedBrands.map((brand) => (
              <div
                key={brand.name}
                className="flex items-center justify-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors"
                data-testid={`brand-${brand.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-8 sm:h-10 w-auto object-contain filter brightness-0 saturate-100 invert opacity-70 hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The Superhuman System Section */}
      <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6">
              The Superhuman System
            </h2>
            <p className="text-lg text-white/70">
              Three ways to scale with intelligence. Built for speed. Designed
              for impact.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {superhumanSystem.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card
                  key={index}
                  className={`bg-gradient-to-br ${item.gradient} backdrop-blur-sm border-white/10 hover:border-white/20 transition-all hover-elevate`}
                  data-testid={`system-card-${index}`}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-violet-400" />
                    </div>
                    <CardTitle className="text-white">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-white/70">
                      {item.subtitle}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Human Stories Section */}
      <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6">
              Transformation Stories
            </h2>
            <p className="text-lg text-white/70">
              Real leaders. Real results. Real transformation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {humanStoriesData.map((story, index) => (
              <Card
                key={index}
                className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20 transition-all hover-elevate"
                data-testid={`story-card-${index}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <img
                      src={story.photo}
                      alt={story.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                    />
                    <div>
                      <CardTitle className="text-white text-lg">
                        {story.name}
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {story.role}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-white/70 italic">"{story.story}"</p>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-sm font-semibold text-violet-400 mb-2">
                      The Result:
                    </p>
                    <p className="text-white/80">{story.outcome}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* AI Assistant CTA Section */}
      <div className="bg-gradient-to-b from-zinc-950 via-violet-950/20 to-zinc-950 py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-violet-950/40 via-blue-950/40 to-zinc-950/40 backdrop-blur-sm border-violet-500/30 overflow-hidden">
              <CardContent className="p-8 sm:p-12">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 mb-4">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <span className="text-sm text-violet-300">
                        AI-Powered
                      </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                      Meet Vanessa
                      <br />
                      Your AI Business Assistant
                    </h2>
                    <p className="text-lg text-white/70 mb-6">
                      Get instant answers. Find the perfect talent. Scale your
                      business with AI-powered intelligence that never sleeps.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        size="lg"
                        className="min-h-[56px] px-8 text-base sm:text-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto"
                        onClick={() => setShowVanessaChat(true)}
                        data-testid="button-launch-ai"
                      >
                        <Bot className="w-5 h-5 mr-2" />
                        Launch AI Assistant
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto border-2 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                        asChild
                        data-testid="button-get-team"
                      >
                        <Link href="/lead-intake">
                          <Users className="w-5 h-5 mr-2" />
                          Get Managed Team
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative bg-gradient-to-b from-violet-950/20 via-blue-950/30 to-zinc-950/85 backdrop-blur-md overflow-hidden">
        {/* Multi-layer background depth - Enhanced bottom darkness */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-zinc-950/40 pointer-events-none"></div>
        
        {/* Subtle Glow Divider Line at Top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-px bg-gradient-to-r from-transparent via-[#8a63ff] through-[#5af0ff] to-transparent opacity-50 pointer-events-none"></div>
        
        {/* Animated Luminescent Top Border - Enhanced */}
        <div className="absolute top-0 left-0 right-0 h-[3px] overflow-hidden">
          <div 
            className="h-full w-full bg-gradient-to-r from-transparent via-violet-400/80 through-blue-400/80 to-transparent"
            style={{ 
              animation: 'shimmer 4s ease-in-out infinite',
              backgroundSize: '200% 100%'
            }}
          ></div>
        </div>
        
        {/* Depth Glow at Top Edge - Enhanced */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-violet-500/20 via-blue-500/15 to-transparent blur-3xl pointer-events-none"></div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-violet-400/40 to-transparent blur-sm pointer-events-none"></div>

        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto">
            {/* Brand Section - Always visible */}
            <div className="space-y-8 pb-8 border-b border-white/10 text-center md:text-left mb-8 md:mb-12">
              <div className="space-y-6 relative flex flex-col items-center md:items-start">
                <div className="relative inline-block">
                  <img
                    src={onspotLogo}
                    alt="OnSpot"
                    className="h-9 sm:h-11 w-auto filter brightness-0 saturate-100 invert opacity-90"
                    data-testid="footer-logo"
                  />
                  <div className="absolute -inset-2 bg-gradient-to-r from-violet-500/20 to-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </div>
                
                <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-md">
                  The growth engine behind modern businesses—built by entrepreneurs, for entrepreneurs. We deliver the Superhuman System. AI-first infrastructure meets people excellence. Scale your business with system and intelligence that never sleeps.
                </p>
              </div>
              
              {/* Social Icons - Floating outside */}
              <div className="flex gap-3 justify-center md:justify-start">
                <a href="#" className="relative w-11 h-11 rounded-full bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-gradient-to-br hover:from-violet-500/30 hover:to-blue-500/30 hover:border-violet-400/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group" data-testid="social-linkedin">
                  <Linkedin className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" />
                </a>
                <a href="#" className="relative w-11 h-11 rounded-full bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-gradient-to-br hover:from-violet-500/30 hover:to-blue-500/30 hover:border-violet-400/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group" data-testid="social-facebook">
                  <Facebook className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" />
                </a>
                <a href="#" className="relative w-11 h-11 rounded-full bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-gradient-to-br hover:from-violet-500/30 hover:to-blue-500/30 hover:border-violet-400/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group" data-testid="social-twitter">
                  <Twitter className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" />
                </a>
                <a href="#" className="relative w-11 h-11 rounded-full bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-gradient-to-br hover:from-violet-500/30 hover:to-blue-500/30 hover:border-violet-400/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group" data-testid="social-instagram">
                  <Instagram className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" />
                </a>
              </div>
            </div>

            {/* Mobile Accordion View (< md) */}
            <Accordion type="single" collapsible className="md:hidden space-y-0">
              {/* Navigation Accordion */}
              <AccordionItem value="navigation" className="border-b border-white/10">
                <AccordionTrigger className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide hover:no-underline py-4">
                  Navigation
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2">
                    <Link href="/hire-talent" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-hire">
                      Hire Talent
                    </Link>
                    <Link href="/lead-intake" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-managed">
                      Managed Services
                    </Link>
                    <button
                      onClick={() => setShowVanessaChat(true)}
                      className="py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center w-full"
                      data-testid="footer-link-ai"
                    >
                      AI Assistant
                    </button>
                    <Link href="/waitlist" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-waitlist">
                      Join Waitlist
                    </Link>
                    <Link href="/careers" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-careers">
                      Careers
                    </Link>
                    <Link href="/powerapp" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-powerapp">
                      Powerapp
                    </Link>
                    <Link href="/pricing" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-pricing">
                      Pricing
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Company Accordion */}
              <AccordionItem value="company" className="border-b border-white/10">
                <AccordionTrigger className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide hover:no-underline py-4">
                  Company
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2">
                    <Link href="/why-onspot" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-why">
                      Why OnSpot
                    </Link>
                    <Link href="/stories" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-stories">
                      Amazing Stories
                    </Link>
                    <Link href="/insights" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-insights">
                      Insights
                    </Link>
                    <Link href="/affiliate" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-affiliate">
                      Affiliate Marketing
                    </Link>
                    <Link href="/bpo-partner" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-bpo">
                      BPO Partner
                    </Link>
                    <Link href="/investors" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-investors">
                      Investors Corner
                    </Link>
                    <Link href="/about" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 min-h-[44px] flex items-center justify-center" data-testid="footer-link-about">
                      About Us
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Download Platform Accordion */}
              <AccordionItem value="download" className="border-b border-white/10">
                <AccordionTrigger className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide hover:no-underline py-4">
                  Download Platform
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <p className="text-sm text-white/70 leading-relaxed text-center">
                      Take OnSpot with you wherever you go. Manage projects and track progress on the move.
                    </p>
                    <div className="flex flex-col gap-3">
                      <a href="#" className="flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/[0.15] hover:bg-white/[0.06] hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:-translate-y-0.5 transition-all duration-400 group w-full" data-testid="download-ios">
                        <svg className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        <span className="text-sm font-medium text-white/70 group-hover:text-violet-300 transition-colors">App Store</span>
                      </a>
                      <a href="#" className="flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/[0.15] hover:bg-white/[0.06] hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:-translate-y-0.5 transition-all duration-400 group w-full" data-testid="download-android">
                        <svg className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                        </svg>
                        <span className="text-sm font-medium text-white/70 group-hover:text-violet-300 transition-colors">Google Play</span>
                      </a>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Connect Accordion */}
              <AccordionItem value="connect" className="border-b-0">
                <AccordionTrigger className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide hover:no-underline py-4">
                  Connect
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2">
                    <a href="mailto:hello@onspotglobal.com" className="flex items-center justify-center gap-3 py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 group min-h-[44px]" data-testid="footer-email">
                      <Mail className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                      <span>hello@onspotglobal.com</span>
                    </a>
                    <a href="tel:+1234567890" className="flex items-center justify-center gap-3 py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 group min-h-[44px]" data-testid="footer-phone">
                      <Phone className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                      <span>+1 (234) 567-890</span>
                    </a>
                    <div className="flex items-center justify-center gap-3 py-2.5 text-sm text-white/70 min-h-[44px]">
                      <MapPinIcon className="w-5 h-5 flex-shrink-0" />
                      <span>Global HQ<br />New York</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Desktop Grid View (>= md) */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Navigation Section */}
              <div className="space-y-6">
                <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide">
                  Navigation
                </h3>
                
                <div className="space-y-2">
                  <Link href="/hire-talent" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-hire">
                    Hire Talent
                  </Link>
                  <Link href="/lead-intake" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-managed">
                    Managed Services
                  </Link>
                  <button
                    onClick={() => setShowVanessaChat(true)}
                    className="py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center text-left w-full"
                    data-testid="footer-link-ai"
                  >
                    AI Assistant
                  </button>
                  <Link href="/waitlist" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-waitlist">
                    Join Waitlist
                  </Link>
                  <Link href="/careers" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-careers">
                    Careers
                  </Link>
                  <Link href="/powerapp" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-powerapp">
                    Powerapp
                  </Link>
                  <Link href="/pricing" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-pricing">
                    Pricing
                  </Link>
                </div>
              </div>

              {/* Company Section */}
              <div className="space-y-6">
                <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide">
                  Company
                </h3>
                
                <div className="space-y-2">
                  <Link href="/why-onspot" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-why">
                    Why OnSpot
                  </Link>
                  <Link href="/stories" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-stories">
                    Amazing Stories
                  </Link>
                  <Link href="/insights" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-insights">
                    Insights
                  </Link>
                  <Link href="/affiliate" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-affiliate">
                    Affiliate Marketing
                  </Link>
                  <Link href="/bpo-partner" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-bpo">
                    BPO Partner
                  </Link>
                  <Link href="/investors" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-investors">
                    Investors Corner
                  </Link>
                  <Link href="/about" className="block py-2.5 text-sm text-white/70 hover:text-violet-300 hover:translate-x-1 transition-all duration-300 min-h-[44px] flex items-center" data-testid="footer-link-about">
                    About Us
                  </Link>
                </div>
              </div>

              {/* Download Section */}
              <div className="space-y-6">
                <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide">
                  Download Platform
                </h3>
                
                <div className="space-y-4">
                  <p className="text-sm text-white/70 leading-relaxed">
                    Take OnSpot with you wherever you go. Manage projects and track progress on the move.
                  </p>
                  <div className="flex flex-col gap-3">
                    <a href="#" className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/[0.15] hover:bg-white/[0.06] hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:-translate-y-0.5 transition-all duration-400 group w-full" data-testid="download-ios">
                      <svg className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <span className="text-sm font-medium text-white/70 group-hover:text-violet-300 transition-colors">App Store</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/[0.15] hover:bg-white/[0.06] hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:-translate-y-0.5 transition-all duration-400 group w-full" data-testid="download-android">
                      <svg className="w-5 h-5 text-white/50 group-hover:text-violet-300 group-hover:scale-110 transition-all duration-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                      </svg>
                      <span className="text-sm font-medium text-white/70 group-hover:text-violet-300 transition-colors">Google Play</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Connect Section */}
              <div className="space-y-6">
                <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[#a38eff] to-[#6af0ff] bg-clip-text text-transparent tracking-wide">
                  Connect
                </h3>
                
                <div className="space-y-2">
                  <a href="mailto:hello@onspotglobal.com" className="flex items-center gap-3 py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 group min-h-[44px]" data-testid="footer-email">
                    <Mail className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>hello@onspotglobal.com</span>
                  </a>
                  <a href="tel:+1234567890" className="flex items-center gap-3 py-2.5 text-sm text-white/70 hover:text-violet-300 transition-all duration-300 group min-h-[44px]" data-testid="footer-phone">
                    <Phone className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>+1 (234) 567-890</span>
                  </a>
                  <div className="flex items-start gap-3 py-2.5 text-sm text-white/70 min-h-[44px]">
                    <MapPinIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Global HQ<br />New York</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-16 pt-8 border-t border-white/[0.12]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/70">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                  <p className="hover:text-white/90 transition-colors duration-300">© 2025 OnSpot Global. All rights reserved.</p>
                  <span className="hidden sm:inline text-white/30">·</span>
                  <p className="text-xs text-white/50">Powered by OnSpot Intelligence</p>
                </div>
                <div className="flex gap-6">
                  <Link href="/privacy" className="hover:text-violet-300 transition-all duration-300 hover:translate-y-[-1px]" data-testid="footer-privacy">
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="hover:text-violet-300 transition-all duration-300 hover:translate-y-[-1px]" data-testid="footer-terms">
                    Terms of Service
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

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
