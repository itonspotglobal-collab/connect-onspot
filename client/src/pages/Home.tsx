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
    subtitle: "Human expertise powered by intelligent systems.",
    icon: Users,
    gradient: "from-cyan-500/20 to-violet-500/20",
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

const transformationStories = [
  {
    name: "Frederic Hill",
    role: "Founder & CEO, Vertex Education",
    transformation: "From 12-hour workdays to automated excellence",
    story:
      "AI handled routine tasks. Our team focused on strategy. Revenue doubled in 6 months.",
    photo: FrederickPhoto,
    metric: "2x Revenue",
  },
  {
    name: "Julie Reyes",
    role: "Operations Director, Flash Justice",
    transformation: "From scattered processes to seamless orchestration",
    story:
      "Vanessa AI coordinated our remote team. Human expertise met intelligent automation. Efficiency soared.",
    photo: JuliePhoto,
    metric: "85% Faster",
  },
  {
    name: "Amira Santos",
    role: "CTO, Pinetech",
    transformation: "From constant firefighting to proactive innovation",
    story:
      "AI monitors, predicts, and prevents. Our engineers build the future. Downtime became a memory.",
    photo: AmiraPhoto,
    metric: "99.9% Uptime",
  },
];

const talentProfiles = [
  {
    name: "Maria Santos",
    skill: "Customer Success",
    photo: FrederickPhoto,
  },
  {
    name: "Carlos Rivera",
    skill: "Data Analytics",
    photo: AmiraPhoto,
  },
  {
    name: "Sofia Reyes",
    skill: "Executive Assistant",
    photo: JuliePhoto,
  },
  {
    name: "Miguel Torres",
    skill: "Lead Generation",
    photo: PaigePhoto,
  },
  {
    name: "Ana Flores",
    skill: "Content Writing",
    photo: FrederickPhoto,
  },
  {
    name: "Diego Cruz",
    skill: "DevOps Engineer",
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

      {/* Trusted By Section - AI-Inspired Minimalist Design */}
      <div className="relative overflow-hidden -mt-32 pt-32 pb-24 sm:pb-32">
        {/* Seamless Gradient Blend from Hero */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background"></div>
        
        {/* Subtle AI Glow Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-violet-500/20 to-transparent rounded-full blur-3xl animate-gentle-float"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-radial from-blue-500/15 to-transparent rounded-full blur-3xl animate-slow-spin"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center space-y-12 sm:space-y-16">
            {/* Sleek Typography */}
            <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.2em] bg-gradient-to-r from-violet-600/80 to-blue-600/80 bg-clip-text text-transparent">
                Trusted by
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light tracking-tight leading-tight px-4">
                Global brands, hundreds of entrepreneurs,
                <br className="hidden sm:block" />
                <span className="font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  and thousands of professionals.
                </span>
              </h2>
            </div>

            {/* Floating Logo Grid with Glow Effects */}
            <div className="relative py-8 sm:py-12">
              {/* Shimmer overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none"></div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 sm:gap-10 lg:gap-12 items-center justify-items-center">
                {trustedBrands.map((brand, index) => (
                  <div
                    key={index}
                    className="group relative flex items-center justify-center"
                    style={{
                      animation: `float ${3 + index * 0.3}s ease-in-out infinite`,
                      animationDelay: `${index * 0.15}s`,
                    }}
                    data-testid={`brand-logo-${index}`}
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-blue-500/20 blur-xl rounded-full scale-150"></div>
                    </div>
                    
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="h-12 sm:h-14 lg:h-16 w-auto object-contain grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 relative z-10 filter group-hover:brightness-110 group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Superhuman System - Cinematic Apple-style Cards */}
      <div className="relative py-24 sm:py-32 overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none"></div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          {/* Section Title */}
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              The Superhuman System
            </h2>
          </div>

          {/* Glassmorphic Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto">
            {superhumanSystem.map((item, index) => (
              <div
                key={index}
                className="group relative"
                style={{
                  animation: `fadeInUp 0.8s ease-out ${index * 0.15}s both`,
                }}
                data-testid={`superhuman-card-${index}`}
              >
                {/* Floating glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700 rounded-3xl scale-105`}></div>
                
                {/* Glass card */}
                <div className="relative bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 transition-all duration-500 group-hover:border-white/20 group-hover:bg-background/50 h-full flex flex-col">
                  {/* Icon with gradient background */}
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                    <item.icon className="w-7 h-7 sm:w-8 sm:h-8 text-foreground" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    {item.title}
                  </h3>
                  
                  {/* Subtitle */}
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {item.subtitle}
                  </p>
                  
                  {/* Subtle bottom glow line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI + Human Advantage Philosophy Section */}
      <div className="relative py-24 sm:py-32 lg:py-40 overflow-hidden">
        {/* Luminous gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl opacity-60"></div>
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Typography */}
              <div className="text-center lg:text-left space-y-6 sm:space-y-8">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="block bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                    AI + Human
                  </span>
                  <span className="block bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                    Advantage
                  </span>
                </h2>
                
                <div className="space-y-4">
                  <p className="text-lg sm:text-xl lg:text-2xl font-light text-foreground/90 leading-relaxed">
                    The perfect symbiosis of automation and empathy.
                  </p>
                  <p className="text-base sm:text-lg text-muted-foreground font-light leading-relaxed">
                    Intelligence that never sleeps.
                    <br />
                    Humanity that always understands.
                  </p>
                </div>
              </div>

              {/* Abstract gradient shape */}
              <div className="relative flex items-center justify-center lg:justify-end">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
                  {/* Luminous swirl effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/30 via-blue-500/30 to-cyan-500/30 rounded-full blur-3xl opacity-80 animate-gentle-float"></div>
                  <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/40 via-violet-500/40 to-purple-500/40 rounded-full blur-2xl opacity-70 animate-slow-spin"></div>
                  
                  {/* Center glow */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-r from-violet-400 to-blue-400 rounded-full blur-xl opacity-60"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations - Neural Grid */}
      <div className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          {/* Section Title */}
          <div className="text-center mb-16 sm:mb-20 space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Connected Intelligence
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight">
              Seamlessly Integrates With Your Stack
            </h2>
          </div>

          {/* Neural Grid Container */}
          <div className="relative max-w-6xl mx-auto">
            {/* Central OnSpot Core */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="relative group">
                {/* Pulsing glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500 animate-gentle-pulse"></div>
                
                {/* Core circle */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center border-2 border-white/20">
                  <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Integration Nodes - Circular Layout */}
            <div className="relative h-[500px] sm:h-[600px] lg:h-[700px]">
              {integrations.map((integration, index) => {
                const totalItems = integrations.length;
                const angle = (index * 360) / totalItems;
                const radius = 180; // Base radius for mobile
                const smRadius = 220; // Tablet
                const lgRadius = 280; // Desktop
                
                // Calculate positions for different screen sizes
                const x = Math.cos((angle - 90) * Math.PI / 180);
                const y = Math.sin((angle - 90) * Math.PI / 180);

                return (
                  <div
                    key={index}
                    className="absolute top-1/2 left-1/2 group"
                    style={{
                      transform: `translate(-50%, -50%) translate(calc(${x * radius}px), calc(${y * radius}px))`,
                    }}
                    data-testid={`integration-${index}`}
                  >
                    {/* Connection line to center */}
                    <svg
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      width={radius * 2.5}
                      height={radius * 2.5}
                      style={{
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <line
                        x1="50%"
                        y1="50%"
                        x2={`calc(50% - ${x * radius}px)`}
                        y2={`calc(50% - ${y * radius}px)`}
                        stroke="url(#lineGradient)"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Integration Node */}
                    <div className="relative">
                      {/* Hover glow */}
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-blue-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-150"></div>
                      
                      {/* Glass card */}
                      <div className="relative bg-background/40 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 transition-all duration-500 group-hover:border-white/30 group-hover:bg-background/60 min-w-[80px] sm:min-w-[100px] lg:min-w-[120px]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          {integration.icon ? (
                            <integration.icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-foreground/60 group-hover:text-foreground transition-colors duration-300 grayscale group-hover:grayscale-0" />
                          ) : (
                            <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 rounded bg-gradient-to-br from-violet-500/20 to-blue-500/20"></div>
                          )}
                          <span className="text-[9px] sm:text-[10px] lg:text-xs font-medium text-foreground/60 group-hover:text-foreground transition-colors duration-300 text-center">
                            {integration.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl animate-gentle-float"></div>
              <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-gentle-float" style={{ animationDelay: '2s' }}></div>
            </div>
          </div>

          {/* Bottom text */}
          <div className="text-center mt-12 sm:mt-16">
            <p className="text-xs sm:text-sm text-muted-foreground">
              and many more...
            </p>
          </div>
        </div>
      </div>

      {/* Transformation Stories - Cinematic Gallery */}
      <div className="relative py-24 sm:py-32 lg:py-40 overflow-hidden">
        {/* Ethereal background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          {/* Section Title */}
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Transformation Stories
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              Human Achievements
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Powered by Intelligence
            </p>
          </div>

          {/* Story Cards - Horizontal Scroll on Mobile, Grid on Desktop */}
          <div className="relative">
            {/* Desktop Grid */}
            <div className="hidden md:grid md:grid-cols-3 gap-8 lg:gap-12 max-w-7xl mx-auto">
              {transformationStories.map((story, index) => (
                <div
                  key={index}
                  className="group relative"
                  style={{
                    animation: `fadeInUp 0.8s ease-out ${index * 0.2}s both`,
                  }}
                  data-testid={`story-card-${index}`}
                >
                  {/* Breathing glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 scale-110 animate-gentle-pulse"></div>
                  
                  {/* Glass Story Card */}
                  <div className="relative bg-background/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 transition-all duration-700 group-hover:border-white/20 group-hover:bg-background/40 h-full flex flex-col">
                    {/* Profile */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-white/40 transition-colors duration-500">
                        <img
                          src={story.photo}
                          alt={story.name}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                        />
                        {/* Photo glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm lg:text-base">{story.name}</p>
                        <p className="text-xs lg:text-sm text-muted-foreground">{story.role}</p>
                      </div>
                    </div>

                    {/* Transformation Title */}
                    <div className="mb-6 flex-grow">
                      <p className="text-base lg:text-lg font-light leading-relaxed text-foreground/90 group-hover:text-foreground transition-colors duration-500">
                        {story.transformation}
                      </p>
                    </div>

                    {/* Story */}
                    <div className="mb-6">
                      <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                        {story.story}
                      </p>
                    </div>

                    {/* Metric Badge */}
                    <div className="mt-auto pt-6 border-t border-white/10">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-white/10 group-hover:border-white/20 transition-colors duration-500">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        <span className="text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                          {story.metric}
                        </span>
                      </div>
                    </div>

                    {/* Bottom glow line */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Horizontal Scroll */}
            <div className="md:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-6 pb-4" style={{ scrollSnapType: 'x mandatory' }}>
                {transformationStories.map((story, index) => (
                  <div
                    key={index}
                    className="group relative flex-shrink-0 w-[85vw] max-w-[400px]"
                    style={{ scrollSnapAlign: 'center' }}
                    data-testid={`story-card-mobile-${index}`}
                  >
                    {/* Breathing glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-50 animate-gentle-pulse"></div>
                    
                    {/* Glass Story Card */}
                    <div className="relative bg-background/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 h-full flex flex-col">
                      {/* Profile */}
                      <div className="flex items-center gap-3 mb-5">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                          <img
                            src={story.photo}
                            alt={story.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{story.name}</p>
                          <p className="text-xs text-muted-foreground">{story.role}</p>
                        </div>
                      </div>

                      {/* Transformation Title */}
                      <div className="mb-4 flex-grow">
                        <p className="text-base font-light leading-relaxed text-foreground/90">
                          {story.transformation}
                        </p>
                      </div>

                      {/* Story */}
                      <div className="mb-5">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {story.story}
                        </p>
                      </div>

                      {/* Metric Badge */}
                      <div className="mt-auto pt-5 border-t border-white/10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-white/10">
                          <Sparkles className="w-4 h-4 text-violet-500" />
                          <span className="text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                            {story.metric}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16 sm:mt-20">
            <Button
              variant="outline"
              size="lg"
              className="min-h-[56px] px-8 text-base border-2 bg-background/50 backdrop-blur-sm hover:bg-background/80"
              asChild
            >
              <Link href="/amazing">
                Explore More Transformations
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

      {/* The Experience — One System. Your Unfair Advantage */}
      <div className="relative py-24 sm:py-32 lg:py-40 overflow-hidden">
        {/* Gradient glow background */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-blue-600/20 to-cyan-500/20"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] bg-gradient-radial from-violet-500/30 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-gradient-radial from-blue-500/30 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          {/* Title */}
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              The Experience
            </h2>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              One System. Your Unfair Advantage.
            </p>
          </div>

          {/* OnSpot Connect Interface Mockup */}
          <div className="max-w-6xl mx-auto">
            <div className="relative bg-background/30 backdrop-blur-xl border border-white/20 rounded-3xl p-8 sm:p-12 lg:p-16">
              {/* Glowing wireframe interface */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left Column - AI Assistant */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-semibold">Vanessa AI Assistant</span>
                  </div>
                  <div className="space-y-3">
                    {/* Chat bubbles */}
                    <div className="bg-violet-500/20 border border-violet-500/30 rounded-2xl rounded-tl-sm p-4">
                      <p className="text-sm text-foreground/90">How can I help you scale today?</p>
                    </div>
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl rounded-tr-sm p-4 ml-8">
                      <p className="text-sm text-foreground/90">Find me 3 data analysts</p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Dashboard & Team */}
                <div className="space-y-6">
                  {/* Task Flow */}
                  <div className="bg-background/40 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold">Task Flow</span>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full w-3/4"></div>
                      <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full w-1/2"></div>
                    </div>
                  </div>

                  {/* Managed Team */}
                  <div className="bg-background/40 border border-white/10 rounded-2xl p-5">
                    <span className="text-sm font-semibold mb-3 block">Managed Team</span>
                    <div className="flex -space-x-2">
                      {talentProfiles.slice(0, 4).map((profile, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-background overflow-hidden"
                        >
                          <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KPI Dashboard */}
                  <div className="bg-background/40 border border-white/10 rounded-2xl p-5">
                    <span className="text-sm font-semibold mb-3 block">Live KPIs</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-500">98%</p>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-500">24h</p>
                        <p className="text-xs text-muted-foreground">Response</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-violet-500">5.0</p>
                        <p className="text-xs text-muted-foreground">Rating</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative glow elements */}
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl animate-gentle-float"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-gentle-float" style={{ animationDelay: "1s" }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* The Proof — Global Talent, Human Excellence */}
      <div className="relative py-24 sm:py-32 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          {/* Title */}
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              The Proof
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              Powered by professionals from the Philippines and beyond.
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              The Superhuman BPO Network.
            </p>
          </div>

          {/* Talent Profiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {talentProfiles.map((profile, index) => (
              <div
                key={index}
                className="group relative"
                data-testid={`talent-profile-${index}`}
              >
                {/* Profile Image - blurred initially */}
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500/10 to-blue-500/10">
                  <img
                    src={profile.photo}
                    alt={profile.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 blur-sm group-hover:blur-none opacity-60 group-hover:opacity-100 transition-all duration-500"
                  />
                  
                  {/* Overlay - reveals on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                    <div className="text-white">
                      <p className="font-semibold text-sm">{profile.name}</p>
                      <p className="text-xs text-white/80">{profile.skill}</p>
                    </div>
                  </div>

                  {/* Glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-blue-500/20 blur-xl"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The Call — Ready to Become Superhuman */}
      <div className="relative py-32 sm:py-40 lg:py-48 overflow-hidden">
        {/* Full-screen gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-blue-600/30 to-cyan-500/30"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-violet-500/20 via-transparent to-transparent"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-12">
            {/* Main heading */}
            <div className="space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                <span className="block">Ready to Become</span>
                <span className="block bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                  Superhuman?
                </span>
              </h2>
              
              <div className="space-y-4 max-w-2xl mx-auto">
                <p className="text-lg sm:text-xl lg:text-2xl font-light text-foreground/90">
                  AI first. Humans when it matters.
                </p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-semibold">
                  Join the Superhuman Revolution.
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-8">
              <Button
                size="lg"
                className="min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
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
