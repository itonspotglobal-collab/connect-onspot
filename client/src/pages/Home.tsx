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
  Mail,
  Phone,
  MapPinIcon,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  ChevronDown,
  Settings,
  Layers,
  User,
  Building2,
  Globe,
  SlidersHorizontal,
  Briefcase,
  BadgeCheck,
  CalendarCheck,
} from "lucide-react";
import {
  SiAmazon,
  SiQuickbooks,
  SiReplit,
  SiStripe,
  SiX,
  SiThreads,
  SiTiktok,
  SiYoutube,
} from "react-icons/si";
import { Link } from "wouter";
import { useVanessa } from "@/contexts/VanessaContext";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

import FlashLogo from "../assets/logos/Flash.png";
import FutureEVLogo from "../assets/logos/FutureEV.png";
import IPSLogo from "../assets/logos/IPS.png";
import PinetechLogo from "../assets/logos/Pinetech.png";
import SafewayLogo from "../assets/logos/Safeway.png";
import VertexLogo from "../assets/logos/Vertex.png";

import KyleMendezPhoto from "@assets/Kyle_Mendez_1774430604161.jpeg";
import AlexandraLopezPhoto from "@assets/Alexandra_Lopez_1774430604160.jpg";
import AndreaPinzonPhoto from "@assets/Andrea_Pinzon_1774264095055.jpeg";
import ChristopherAlbaPhoto from "@assets/Christopher_Alba_1774264095055.jpg";
import RachelCastroPhoto from "@assets/Rachel_Caztro_1774264095056.jpg";
import AmirSinghPhoto from "@assets/Amir_Singh_1774264095055.jpg";
import JenniferDizonPhoto from "@assets/Jennifer_Dizon_1774430604160.jpg";
import AndreiLosantoPhoto from "@assets/Andrei_Losanto_1774430604160.jpg";
import FernandoPhoto from "@assets/Fernando_1773832206009.jpg";

import favicon from "../assets/logos/favic.png";
import MicrosoftLogo from "../assets/logos/microsoft.logo.png";
import GoHighLevelLogo from "../assets/logos/ghl.logo.jpeg";

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
  { name: "Microsoft", icon: MicrosoftLogo },
  { name: "Go High Level", icon: GoHighLevelLogo },
  { name: "Lindy AI", icon: Bot },
  { name: "Replit", icon: SiReplit },
  { name: "OnSpot Intelligence", icon: Zap },
  { name: "AWS", icon: SiAmazon },
  { name: "BambooHR", icon: Users },
  { name: "QuickBooks", icon: SiQuickbooks },
  { name: "Stripe", icon: SiStripe },
  { name: "More", icon: favicon },
];

const hiringModes = [
  {
    icon: Bot,
    title: "AI Assistant",
    subtitle: "Vanessa at your service",
    description:
      "Instant, intelligent automation that never sleeps. Perfect for routine tasks, scheduling, and coordination.",
    features: ["24/7 Availability", "Instant Responses", "Smart Automation"],
    gradient: "from-violet-500/20 to-blue-500/20",
    link: "#",
    cta: "Launch AI Assistant",
  },
  {
    icon: Zap,
    title: "Managed Services",
    subtitle: "Full team, zero hassle",
    description:
      "We build, train, and manage your offshore team. You focus on growth, we handle operations.",
    features: ["Dedicated Team", "Full Management", "Quality Assurance"],
    gradient: "from-blue-500/20 to-cyan-500/20",
    link: "/lead-intake",
    cta: "Get Managed Team",
  },
  {
    icon: Users,
    title: "Resourced Services",
    subtitle: "Elite talent, on-demand",
    description:
      "Handpicked professionals integrated into your workflow. Expert skills when you need them.",
    features: ["Top 5% Talent", "Flexible Scaling", "Direct Integration"],
    gradient: "from-cyan-500/20 to-violet-500/20",
    link: "/hire-talent",
    cta: "Browse Talent",
  },
];

const brandPillars = [
  {
    icon: Sparkles,
    title: "AI-First Infrastructure",
    subtitle: "Intelligent by design",
    description:
      "Every system, every workflow, enhanced by artificial intelligence. Not automation for its own sake — intelligence that amplifies human potential.",
    gradient: "from-violet-500/20 to-purple-500/20",
  },
  {
    icon: Users,
    title: "Human-Centered Culture",
    subtitle: "People, not resources",
    description:
      "Elite Filipino talent treated as partners, not headcount. We invest in their growth because your success depends on theirs.",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    icon: Zap,
    title: "Connected Ecosystem",
    subtitle: "Seamless integration",
    description:
      "Your tools, your workflow, your systems — all working in harmony. We don't disrupt, we elevate what you've already built.",
    gradient: "from-cyan-500/20 to-teal-500/20",
  },
  {
    icon: TrendingUp,
    title: "Scalable Excellence",
    subtitle: "Grow without compromise",
    description:
      "Scale from 1 to 100 without losing quality, culture, or control. The same excellence at every stage of your journey.",
    gradient: "from-purple-500/20 to-violet-500/20",
  },
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
    name: "Elad B.",
    role: "CEO/Founder, PineTech",
    transformation: "From 12-hour workdays to automated excellence",
    story:
      "The professionalism and consistency of the OnSpot team. Communication is always clear and easy, and I appreciate how they provide structured updates at the end of each day and every week. This makes it simple for me to understand the scope of work being done and stay aligned",
    photo: null,
    metric: "2x Revenue",
  },
  {
    name: "Eric M.",
    role: "Operations Director, Flash Justice",
    transformation: "From scattered processes to seamless orchestration",
    story:
      "I've worked with several outsourcing companies, but none delivered like On-Spot Global. Shane and Ria helped me build my team, stayed involved, and ensured success. Communication's great, savings exceeded expectations, and I finally feel like I'm working with a true partner.",
    photo: null,
    metric: "85% Faster",
  },
  {
    name: "Fernando C.",
    role: "CTO, Pinetech",
    transformation: "From constant firefighting to proactive innovation",
    story:
      "I'm extremely happy with the service provided by Onspot Global. Their team is professional, responsive, and reliable—always going above and beyond to make sure everything runs smoothly. The efficiency and consistency they deliver gives me complete confidence, and I truly value the partnership we've built.",
    photo: FernandoPhoto,
    metric: "99.9% Uptime",
  },
];

const talentProfiles = [
  {
    name: "Kyle Mendez",
    role: "Recruitment Specialist",
    photo: KyleMendezPhoto,
    focalY: "15%",
  },
  {
    name: "Alexandra Lopez",
    role: "Executive Assistant",
    photo: AlexandraLopezPhoto,
    focalY: "15%",
  },
  {
    name: "Andrea Pinzon",
    role: "Virtual Assistant",
    photo: AndreaPinzonPhoto,
    focalY: "15%",
  },
  {
    name: "Christopher Alba",
    role: "Technical Support Representative",
    photo: ChristopherAlbaPhoto,
    focalY: "15%",
  },
  {
    name: "Rachel Castro",
    role: "Social Media Manager",
    photo: RachelCastroPhoto,
    focalY: "15%",
  },
  {
    name: "Amir Singh",
    role: "SEO Specialist",
    photo: AmirSinghPhoto,
    focalY: "15%",
  },
  {
    name: "Jennifer Dizon",
    role: "Customer Service Representative",
    photo: JenniferDizonPhoto,
    focalY: "15%",
  },
  {
    name: "Andrei Losanto",
    role: "Full Stack Developer",
    photo: AndreiLosantoPhoto,
    focalY: "15%",
  },
];

function TrustedLogos() {
  return (
    <div className="mt-12 sm:mt-16 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 items-center justify-items-center gap-x-10 gap-y-10">
        {trustedBrands.map(({ name, logo }) => (
          <div key={name} className="flex items-center justify-center w-full">
            <img
              src={logo}
              alt={name}
              loading="lazy"
              className="h-auto max-h-14 max-w-[180px] w-auto object-contain"
              data-testid={`brand-logo-${name.toLowerCase().replace(/\s+/g, "-")}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { openVanessa } = useVanessa();
  const [expandedFooterSection, setExpandedFooterSection] = useState<
    string | null
  >(null);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" && window.innerWidth >= 1024,
  );

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const toggleFooterSection = (section: string) => {
    setExpandedFooterSection(
      expandedFooterSection === section ? null : section,
    );
  };

  return (
    <div>
      {/* ── 1. HERO ── */}
      <div className="relative overflow-hidden flex flex-col hero-investor">
        {/* Elegant Gradient Overlay for Depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30"></div>

        {/* Subtle Animated Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full blur-3xl animate-gentle-float"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl animate-slow-spin"></div>
        </div>

        {/* Main content */}
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center relative z-20 px-4 sm:px-6 py-16 sm:py-24">
          <div className="container mx-auto text-center">
            <div className="max-w-5xl mx-auto space-y-5 sm:space-y-8 lg:space-y-12">
              {/* Badge */}
              <div
                className="hero-fade-up inline-flex items-center gap-2.5 text-sm sm:text-base font-medium text-white/85 tracking-wide bg-white/8 backdrop-blur-md px-6 py-3 rounded-full border border-white/20"
                data-testid="badge-superhuman-bpo"
              >
                <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                Work Differently
              </div>

              {/* Headline */}
              <div className="space-y-3 sm:space-y-4 hero-fade-up">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.1] text-white px-2">
                  AI first.{" "}
                  <span className="bg-gradient-to-r from-violet-300 via-blue-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
                    Humans
                  </span>{" "}
                  when it matters.
                </h1>
              </div>

              {/* Supporting statement */}
              <div className="hero-fade-up-delay mx-auto mt-8 max-w-5xl text-center">
                <span className="block text-xl sm:text-2xl md:text-3xl font-semibold tracking-wide text-white/85">
                  One System. Your unfair Advantage.
                </span>
                <span className="mt-3 block text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                  Marketplace speed, BPO quality, and a talent pool built for
                  the work AI creates — not just the work it replaces.
                </span>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 hero-fade-up-delay flex-wrap">
                <Button
                  size="lg"
                  onClick={openVanessa}
                  className="relative group text-sm sm:text-base px-6 sm:px-8 h-auto bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all duration-300 hover-elevate rounded-2xl w-full sm:w-auto sm:min-w-[200px] py-3.5 sm:py-4 min-h-[48px]"
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
                  className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 font-medium backdrop-blur-xl bg-white/5 rounded-2xl w-full sm:w-auto sm:min-w-[200px] py-3.5 sm:py-4 min-h-[48px]"
                  asChild
                  data-testid="button-get-managed-team"
                >
                  <Link href="/lead-intake">Get Managed Team</Link>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/20 text-white/85 hover:bg-white/10 hover:border-white/40 font-medium backdrop-blur-xl bg-white/[0.03] rounded-2xl w-full sm:w-auto sm:min-w-[200px] py-3.5 sm:py-4 min-h-[48px]"
                  asChild
                  data-testid="button-find-work"
                >
                  <Link href="/find-work">Find Work</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. TRUSTED BY ── */}
      <div
        className="relative overflow-hidden bg-[#f7f9ff] dark:bg-background"
        style={{ padding: "clamp(2.5rem, 6vw, 8rem) 0" }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[85%] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-violet-500/5 via-blue-500/3 to-transparent blur-sm"></div>
          <div className="h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center space-y-8 sm:space-y-12">
            <div className="space-y-4 sm:space-y-6 mx-auto">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.2em] bg-gradient-to-r from-violet-600/80 to-blue-600/80 bg-clip-text text-transparent">
                Trusted by
              </p>
              <h2
                className="font-light tracking-tight leading-tight mx-auto"
                style={{
                  fontSize: "clamp(1.75rem, 4vw, 3rem)",
                  textWrap: "balance",
                  maxWidth: "62ch",
                }}
              >
                Trusted by global brands, hundreds of entrepreneurs, and
                thousands of professionals worldwide.
              </h2>
            </div>
            <TrustedLogos />
          </div>
        </div>
      </div>

      {/* ── 3. WORK DIFFERENTLY ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f7f4ff] to-[#dff8ff] py-20 sm:py-24">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
            Work Differently
          </p>
          <p className="mx-auto mt-4 max-w-3xl text-center text-base sm:text-lg text-slate-700">
            Whether you're building a team or building a career — OnSpot works
            differently for both sides.
          </p>

          <div className="mx-auto mt-12 grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Card 1: For Companies */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">
                    For Companies
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">
                    Hire faster, smarter, and without the overhead
                  </h3>
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <Zap className="mt-1 h-5 w-5 shrink-0 text-indigo-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Days, not months
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Skip the lengthy agency cycles. Our pre-vetted talent
                      network means we match you in days — not after a six-week
                      search.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <SlidersHorizontal className="mt-1 h-5 w-5 shrink-0 text-indigo-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Flexible engagements, your way
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Contract, project-based, part-time, or full-time —
                      structure the engagement around how your team actually
                      works.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <Users className="mt-1 h-5 w-5 shrink-0 text-indigo-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Direct access, no middleman
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Work with talent directly. No layers of account managers,
                      no inflated markups — just the right person for the job.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <Globe className="mt-1 h-5 w-5 shrink-0 text-indigo-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Global reach, local expertise
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Access professionals across 50+ countries with the
                      regional know-how to hit the ground running from day one.
                    </p>
                  </div>
                </div>
              </div>

              <a
                href="/hire-talent"
                className="flex items-center justify-between border-t border-slate-200/70 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Find the right talent
                <ArrowRight className="h-4 w-4 text-indigo-500" />
              </a>
            </div>

            {/* Card 2: For Professionals */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-3 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100">
                  <Briefcase className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-500">
                    For Professionals
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">
                    Grow your career with work that keeps coming
                  </h3>
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <TrendingUp className="mt-1 h-5 w-5 shrink-0 text-teal-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      A steady pipeline of real work
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      No more chasing leads or gaps between projects. OnSpot
                      keeps your pipeline active with quality engagements
                      matched to your skills.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <Star className="mt-1 h-5 w-5 shrink-0 text-teal-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Work that builds your reputation
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Get placed with leading companies globally — the kind of
                      work that strengthens your portfolio and opens doors.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <CalendarCheck className="mt-1 h-5 w-5 shrink-0 text-teal-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Flexible on your terms
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Remote-first, with engagements structured around your
                      availability. You choose what fits your life and your
                      goals.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-slate-200/70 p-5">
                  <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-teal-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Zero gatekeeping
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      No favoritism, no opaque processes. Your skills speak for
                      themselves — we match you on merit and make sure you're
                      seen.
                    </p>
                  </div>
                </div>
              </div>

              <a
                href="/find-best-matches"
                className="flex items-center justify-between border-t border-slate-200/70 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Find your next opportunity
                <ArrowRight className="h-4 w-4 text-teal-500" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. THE SUPERHUMAN SYSTEM ── */}
      <div className="relative py-12 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none"></div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10 sm:mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              The Superhuman System
            </h2>
          </div>

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
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700 rounded-3xl scale-105`}
                ></div>

                <div className="relative bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 transition-all duration-500 group-hover:border-white/20 group-hover:bg-background/50 h-full flex flex-col items-center md:items-start">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}
                  >
                    <item.icon className="w-7 h-7 sm:w-8 sm:h-8 text-foreground" />
                  </div>

                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent text-center md:text-left">
                    {item.title}
                  </h3>

                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-center md:text-left">
                    {item.subtitle}
                  </p>

                  <div
                    className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. AI + HUMAN ADVANTAGE ── */}
      <div className="relative py-12 sm:py-24 lg:py-32 overflow-hidden mt-8 sm:mt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl opacity-60"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
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

              <div className="relative flex items-center justify-center lg:justify-end">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
                  <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/30 via-blue-500/30 to-cyan-500/30 rounded-full blur-3xl opacity-80 animate-gentle-float"></div>
                  <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/40 via-violet-500/40 to-purple-500/40 rounded-full blur-2xl opacity-70 animate-slow-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-r from-violet-400 to-blue-400 rounded-full blur-xl opacity-60"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. THE EXPERIENCE ── */}
      <div className="relative py-12 sm:py-24 lg:py-32 overflow-hidden mt-8 sm:mt-16">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-blue-600/20 to-cyan-500/20"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] bg-gradient-radial from-violet-500/30 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-gradient-radial from-blue-500/30 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              The Experience
            </h2>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              One System. Your Unfair Advantage.
            </p>
          </div>

          <div className="max-w-6xl mx-auto mt-12 sm:mt-16">
            <div className="relative bg-background/30 backdrop-blur-xl border border-white/20 rounded-3xl p-8 sm:p-12 lg:p-16">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left Column - AI Assistant */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-semibold">
                      Vanessa AI Assistant
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-violet-500/20 border border-violet-500/30 rounded-2xl rounded-tl-sm p-4">
                      <p className="text-sm text-foreground/90">
                        How can I help you scale today?
                      </p>
                    </div>
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl rounded-tr-sm p-4 ml-8">
                      <p className="text-sm text-foreground/90">
                        Find me 3 data analysts
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Dashboard & Team */}
                <div className="space-y-6">
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

                  <div className="bg-background/40 border border-white/10 rounded-2xl p-5">
                    <span className="text-sm font-semibold mb-3 block">
                      Managed Team
                    </span>
                    <div className="flex -space-x-2">
                      {talentProfiles.slice(0, 4).map((profile, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-background overflow-hidden"
                        >
                          <img
                            src={profile.photo}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-background/40 border border-white/10 rounded-2xl p-5">
                    <span className="text-sm font-semibold mb-3 block">
                      Live KPIs
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-500">98%</p>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-500">24h</p>
                        <p className="text-xs text-muted-foreground">
                          Response
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-violet-500">
                          5.0
                        </p>
                        <p className="text-xs text-muted-foreground">Rating</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -top-10 -left-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl animate-gentle-float"></div>
              <div
                className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-gentle-float"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. STATS ── */}
      <div className="relative py-12 sm:py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none"></div>
        <div className="relative z-10 w-full border-y border-white/10 bg-white/[0.04] backdrop-blur-md">
          <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 px-6 sm:px-10 lg:px-16">
            {[
              { value: "72hrs", label: "AVG. TIME TO HIRE" },
              { value: "500+", label: "GLOBAL CLIENTS" },
              { value: "98%", label: "CLIENT RETENTION" },
              { value: "2,000+", label: "TALENTS PLACED" },
              { flag: true, label: "PHILIPPINE-BASED" },
            ].map((stat, i, arr) => (
              <div
                key={stat.label}
                className={[
                  "flex min-h-[120px] flex-col items-center justify-center px-5 py-6 text-center",
                  i < arr.length - 1
                    ? "border-b border-white/10 sm:border-b-0 sm:border-r"
                    : "",
                  i === 4 ? "col-span-1 sm:col-span-2 lg:col-span-1" : "",
                ].join(" ")}
              >
                {stat.flag ? (
                  <span className="text-4xl sm:text-5xl leading-none">🇵🇭</span>
                ) : (
                  <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent leading-none">
                    {stat.value}
                  </span>
                )}
                <span className="mt-3 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 8. TRANSFORMATION STORIES ── */}
      <div className="relative py-12 sm:py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10 sm:mb-16 space-y-4">
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
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 scale-110 animate-gentle-pulse"></div>

                  <div className="relative bg-background/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 transition-all duration-700 group-hover:border-white/20 group-hover:bg-background/40 h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-white/40 transition-colors duration-500">
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-500/40">
                          <User className="w-7 h-7 lg:w-8 lg:h-8 text-slate-100/90" />
                        </div>
                        {story.photo && (
                          <img
                            src={story.photo}
                            alt={story.name}
                            className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm lg:text-base">
                          {story.name}
                        </p>
                        <p className="text-xs lg:text-sm text-muted-foreground">
                          {story.role}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6 flex-grow">
                      <p className="text-base lg:text-lg font-light leading-relaxed text-foreground/90 group-hover:text-foreground transition-colors duration-500">
                        {story.transformation}
                      </p>
                    </div>

                    <div className="mb-6">
                      <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                        {story.story}
                      </p>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Horizontal Scroll */}
            <div className="md:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div
                className="flex gap-6 pb-4"
                style={{ scrollSnapType: "x mandatory" }}
              >
                {transformationStories.map((story, index) => (
                  <div
                    key={index}
                    className="group relative flex-shrink-0 w-[85vw] max-w-[400px]"
                    style={{ scrollSnapAlign: "center" }}
                    data-testid={`story-card-mobile-${index}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-50 animate-gentle-pulse"></div>

                    <div className="relative bg-background/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 h-full flex flex-col">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-500/40">
                            <User className="w-6 h-6 text-slate-100/90" />
                          </div>
                          {story.photo && (
                            <img
                              src={story.photo}
                              alt={story.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{story.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {story.role}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4 flex-grow">
                        <p className="text-base font-light leading-relaxed text-foreground/90">
                          {story.transformation}
                        </p>
                      </div>

                      <div className="mb-5">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {story.story}
                        </p>
                      </div>

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

      {/* ── 9. THE PROOF ── */}
      <div className="relative py-12 sm:py-24 overflow-hidden mt-8 sm:mt-16">
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10 sm:mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              The Proof
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              Powered by professionals from US, Philippines, and beyond.
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              The Superhuman BPO Network.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {talentProfiles.map((profile, index) => (
              <div
                key={index}
                className="group relative cursor-pointer"
                data-testid={`talent-profile-${index}`}
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500/10 to-blue-500/10 transition-transform duration-500 group-hover:scale-105">
                  <img
                    src={profile.photo}
                    alt={profile.name}
                    width="400"
                    height="400"
                    loading="lazy"
                    className="w-full h-full object-cover sm:blur-sm sm:group-hover:blur-none opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-all duration-500"
                    style={{
                      objectPosition: `center ${profile.focalY || "15%"}`,
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                    <div className="text-white transform translate-y-0 sm:translate-y-2 sm:group-hover:translate-y-0 transition-transform duration-500">
                      <p className="font-semibold text-sm sm:text-base leading-tight">
                        {profile.name}
                      </p>
                      <p className="text-xs sm:text-sm text-white/90 mt-1">
                        {profile.role}
                      </p>
                    </div>
                  </div>

                  <div className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-blue-500/30 blur-xl rounded-2xl"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 10. CONNECTED INTELLIGENCE / INTEGRATIONS ── */}
      <div className="relative py-12 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10 sm:mb-16 space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Connected Intelligence
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight">
              Seamlessly Integrates With Your Stack
            </h2>
          </div>

          {/* Mobile Grid Layout (< md) */}
          <div className="block md:hidden max-w-lg mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-8">
              {integrations.map((integration, index) => (
                <div
                  key={index}
                  className="group"
                  data-testid={`integration-${index}`}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-blue-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div className="relative bg-background/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-500 group-hover:border-white/30 group-hover:bg-background/60">
                      <div className="flex flex-col items-center justify-center gap-2">
                        {integration.icon ? (
                          typeof integration.icon === "string" ? (
                            <img
                              src={integration.icon}
                              alt={integration.name}
                              width="32"
                              height="32"
                              loading="lazy"
                              className="w-8 h-8 object-contain opacity-90 group-hover:opacity-100 transition-all duration-300 grayscale group-hover:grayscale-0"
                            />
                          ) : (
                            <integration.icon className="w-7 h-7 text-foreground/60 group-hover:text-foreground transition-colors duration-300 grayscale group-hover:grayscale-0" />
                          )
                        ) : (
                          <div className="w-7 h-7 rounded bg-gradient-to-br from-violet-500/20 to-blue-500/20"></div>
                        )}
                        <span className="text-[9px] font-medium text-foreground/60 group-hover:text-foreground transition-colors duration-300 text-center">
                          {integration.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tablet/Desktop Circular Layout (>= md) */}
          <div className="hidden md:block relative max-w-6xl mx-auto">
            {/* Central OnSpot Core */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500 animate-gentle-pulse"></div>
                <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center border-2 border-white/20">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Integration Nodes - Circular Layout */}
            <div className="relative h-[600px] lg:h-[700px]">
              {integrations.map((integration, index) => {
                const totalItems = integrations.length;
                const angle = (index * 360) / totalItems;
                const mdRadius = 220;
                const lgRadius = 280;

                const x = Math.cos(((angle - 90) * Math.PI) / 180);
                const y = Math.sin(((angle - 90) * Math.PI) / 180);

                return (
                  <div
                    key={index}
                    className="absolute top-1/2 left-1/2 group"
                    style={{
                      transform: `translate(-50%, -50%) translate(${x * mdRadius}px, ${y * mdRadius}px)`,
                    }}
                    data-testid={`integration-${index}`}
                  >
                    <style>
                      {`
                        @media (min-width: 1024px) {
                          [data-testid="integration-${index}"] {
                            transform: translate(-50%, -50%) translate(${x * lgRadius}px, ${y * lgRadius}px);
                          }
                        }
                      `}
                    </style>

                    {/* Connection line to center */}
                    <svg
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      width={mdRadius * 2.5}
                      height={mdRadius * 2.5}
                      style={{ transform: "translate(-50%, -50%)" }}
                    >
                      <line
                        x1="50%"
                        y1="50%"
                        x2={`calc(50% - ${x * mdRadius}px)`}
                        y2={`calc(50% - ${y * mdRadius}px)`}
                        stroke="url(#lineGradient)"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                      <defs>
                        <linearGradient
                          id="lineGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop
                            offset="0%"
                            stopColor="rgb(139, 92, 246)"
                            stopOpacity="0.8"
                          />
                          <stop
                            offset="100%"
                            stopColor="rgb(59, 130, 246)"
                            stopOpacity="0.8"
                          />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Integration Node */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-blue-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                      <div className="relative bg-background/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 lg:p-5 transition-all duration-500 group-hover:border-white/30 group-hover:bg-background/60 w-20 lg:w-24">
                        <div className="flex flex-col items-center justify-center gap-2">
                          {integration.icon ? (
                            typeof integration.icon === "string" ? (
                              <img
                                src={integration.icon}
                                alt={integration.name}
                                width="32"
                                height="32"
                                loading="lazy"
                                className="w-8 h-8 object-contain opacity-90 group-hover:opacity-100 transition-all duration-300 grayscale group-hover:grayscale-0"
                              />
                            ) : (
                              <integration.icon className="w-8 h-8 text-foreground/60 group-hover:text-foreground transition-colors duration-300" />
                            )
                          ) : (
                            <div className="w-8 h-8 rounded bg-gradient-to-br from-violet-500/20 to-blue-500/20"></div>
                          )}

                          <span className="text-[10px] lg:text-xs font-medium text-foreground/60 group-hover:text-foreground transition-colors duration-300 text-center">
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
              <div
                className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-gentle-float"
                style={{ animationDelay: "2s" }}
              ></div>
            </div>
          </div>

          <div className="text-center mt-8 sm:mt-12 md:mt-16">
            <p className="text-xs sm:text-sm text-muted-foreground">
              and many more...
            </p>
          </div>
        </div>
      </div>

      {/* ── 11. CHOOSE YOUR PATH ── */}
      <div className="relative py-12 sm:py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background">
          <svg
            className="absolute inset-0 w-full h-full opacity-20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="network-pattern"
                x="0"
                y="0"
                width="100"
                height="100"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="1"
                  fill="currentColor"
                  className="text-violet-500/40"
                />
                <line
                  x1="50"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-violet-500/20"
                />
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-blue-500/20"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#network-pattern)" />
          </svg>
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-3xl animate-slow-spin"></div>
          <div
            className="absolute bottom-1/4 -right-1/4 w-[800px] h-[800px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl animate-slow-spin"
            style={{ animationDelay: "5s" }}
          ></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10 sm:mb-16 space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Choose Your Path
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
              Hire Talent, Your Way
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Select the perfect approach for your needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-7xl mx-auto">
            {hiringModes.map((mode, index) => (
              <div
                key={index}
                className="group relative"
                style={{
                  animation: `fadeInUp 0.8s ease-out ${index * 0.15}s both`,
                }}
                data-testid={`hiring-mode-${index}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700 rounded-3xl scale-110 animate-gentle-pulse`}
                ></div>

                <div className="relative bg-background/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 transition-all duration-700 group-hover:border-white/20 group-hover:bg-background/40 h-full flex flex-col group-hover:transform group-hover:scale-[1.02]">
                  <div
                    className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 mx-auto md:mx-0`}
                  >
                    <mode.icon className="w-8 h-8 lg:w-10 lg:h-10 text-foreground" />
                  </div>

                  <div className="mb-4">
                    <h3 className="text-xl lg:text-2xl font-semibold mb-2 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {mode.title}
                    </h3>
                    <p className="text-sm lg:text-base text-muted-foreground">
                      {mode.subtitle}
                    </p>
                  </div>

                  <div className="mb-6 flex-grow">
                    <p className="text-sm lg:text-base text-foreground/80 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>

                  <div className="mb-6 space-y-2">
                    {mode.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-6 border-t border-white/10">
                    <Button
                      variant={index === 0 ? "default" : "outline"}
                      className={`w-full min-h-[48px] ${index === 0 ? "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700" : ""}`}
                      onClick={mode.link === "#" ? openVanessa : undefined}
                      asChild={mode.link !== "#"}
                    >
                      {mode.link === "#" ? (
                        <span>
                          <mode.icon className="w-4 h-4 mr-2" />
                          {mode.cta}
                        </span>
                      ) : (
                        <Link href={mode.link}>
                          <mode.icon className="w-4 h-4 mr-2" />
                          {mode.cta}
                        </Link>
                      )}
                    </Button>
                  </div>

                  <div
                    className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${mode.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 12. OUR PHILOSOPHY / WHY PARTNER WITH ONSPOT ── */}
      <div className="relative py-12 sm:py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
          <div
            className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl animate-gentle-pulse"
            style={{ animationDelay: "3s" }}
          ></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12 sm:mb-20 space-y-6 max-w-4xl mx-auto">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Our Philosophy
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light tracking-tight leading-tight">
              Why Partner with{" "}
              <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent font-semibold">
                OnSpot
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              We're not just a service provider. We're architects of a future
              where AI and human brilliance work as one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 max-w-7xl mx-auto">
            {brandPillars.map((pillar, index) => (
              <div
                key={index}
                className="group relative"
                style={{
                  animation: `fadeInUp 0.8s ease-out ${index * 0.15}s both`,
                }}
                data-testid={`brand-pillar-${index}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700 rounded-3xl`}
                ></div>

                <div className="relative bg-background/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 lg:p-12 transition-all duration-700 group-hover:border-white/30 group-hover:bg-background/50 h-full flex flex-col items-center md:items-start">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}
                  >
                    <pillar.icon className="w-7 h-7 sm:w-8 sm:h-8 text-foreground" />
                  </div>

                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold mb-2 transition-all duration-500 group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-blue-600 group-hover:bg-clip-text group-hover:text-transparent text-center md:text-left">
                    {pillar.title}
                  </h3>

                  <p className="text-sm sm:text-base text-muted-foreground mb-6 text-center md:text-left">
                    {pillar.subtitle}
                  </p>

                  <p className="text-sm sm:text-base lg:text-lg text-foreground/80 leading-relaxed flex-grow">
                    {pillar.description}
                  </p>

                  <div
                    className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${pillar.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-20 sm:mt-24 max-w-4xl mx-auto space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent h-px top-1/2"></div>
              <p className="relative text-xl sm:text-2xl lg:text-3xl font-light text-foreground/90 bg-background px-8 inline-block">
                This is the future of work.
              </p>
            </div>
            <p className="text-base sm:text-lg text-muted-foreground italic">
              And we'd be honored to build it with you.
            </p>
          </div>
        </div>
      </div>

      {/* ── 13. FINAL CTA ── */}
      <div className="relative py-16 sm:py-32 lg:py-40 overflow-hidden mt-8 sm:mt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-blue-600/30 to-cyan-500/30"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-violet-500/20 via-transparent to-transparent"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-12">
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-8">
              <Button
                size="lg"
                className="min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
                onClick={openVanessa}
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

      {/* ── 14. FOOTER ── */}
      <footer className="onspot-footer relative overflow-hidden bg-[#3F4698]">
        {/* Hairline Gradient Seam with Soft Contact Shadow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[85%] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-violet-500/10 via-blue-500/5 to-transparent blur-md"></div>
          <div className="h-px bg-gradient-to-r from-transparent via-violet-400/30 through-blue-400/30 to-transparent"></div>
        </div>

        <div className="mx-auto w-full max-w-[1500px] px-6 sm:px-8 lg:px-12 xl:px-14 2xl:px-16 py-10 sm:py-12 lg:py-14">
          <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[minmax(320px,380px)_1fr] lg:gap-x-12 xl:gap-x-14 items-start">
            {/* Brand Section */}
            <div className="pb-8 lg:pb-0 border-b border-white/10 lg:border-b-0">
              <div className="space-y-6 sm:space-y-8 relative flex flex-col items-start transition-all duration-300">
                <div className="relative inline-block">
                  <img
                    src={onspotLogo}
                    alt="OnSpot"
                    className="h-8 sm:h-9 w-auto brightness-0 invert"
                    data-testid="footer-logo"
                  />
                  <div className="absolute -inset-2 bg-gradient-to-r from-violet-500/20 to-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </div>

                <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-md text-left transition-all duration-300">
                  OnSpot is a technology company and hybrid marketplace–BPO
                  delivering Philippine talent to global clients. Marketplace
                  speed, BPO quality, and AI-ready operations — in one platform.
                </p>
              </div>

              {/* Social Icons */}
              <div className="mt-8 flex flex-wrap items-center justify-start gap-3">
                <a
                  href="https://www.linkedin.com/company/onspotglobal/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-linkedin"
                >
                  <Linkedin className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
                <a
                  href="https://www.facebook.com/OnSpotGlobal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-facebook"
                >
                  <Facebook className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
                <a
                  href="https://x.com/OnSpotTribe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-x"
                >
                  <SiX className="w-4 h-4 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
                <a
                  href="https://www.threads.com/@onspotglobal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-threads"
                >
                  <SiThreads className="w-4 h-4 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
                <a
                  href="https://www.instagram.com/onspotglobal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-instagram"
                >
                  <Instagram className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
                <a
                  href="https://www.tiktok.com/@onspottribe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-tiktok"
                >
                  <SiTiktok className="w-4 h-4 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
                <a
                  href="https://www.youtube.com/@OnSpotGlobal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group"
                  data-testid="social-youtube"
                >
                  <SiYoutube className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </a>
              </div>
            </div>

            {/* Link Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[0.9fr_0.95fr_1.05fr_1.35fr] gap-y-10 gap-x-8 xl:gap-x-10">
              {/* Navigation Section */}
              <div
                className="md:space-y-6 md:border-b-0 transition-all duration-300"
                style={{
                  paddingBottom: "clamp(4px, 0.6vh, 8px)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <button
                  onClick={() => toggleFooterSection("navigation")}
                  className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left"
                  style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}
                  data-testid="footer-accordion-navigation"
                >
                  <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">
                    Navigation
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === "navigation" ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`space-y-3 transition-all duration-300 md:!opacity-100 md:!max-h-none md:!block ${
                    expandedFooterSection === "navigation"
                      ? "opacity-100 max-h-96"
                      : "opacity-0 max-h-0 overflow-hidden"
                  }`}
                  style={{
                    marginTop:
                      expandedFooterSection === "navigation" ||
                      window.innerWidth >= 768
                        ? "16px"
                        : "0",
                  }}
                >
                  <Link
                    href="/hire-talent"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-hire"
                  >
                    Hire Talent
                  </Link>
                  <Link
                    href="/lead-intake"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-managed"
                  >
                    Managed Services
                  </Link>
                  <Link
                    href="/superhuman"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-ai"
                  >
                    The Superhuman Project
                  </Link>
                  <Link
                    href="/waitlist"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-waitlist"
                  >
                    Join Waitlist
                  </Link>
                  <Link
                    href="/careers"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-careers"
                  >
                    Careers
                  </Link>
                  <Link
                    href="/powerapp"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-powerapp"
                  >
                    Powerapp
                  </Link>
                  <Link
                    href="/legal-ops"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-legal-ops"
                  >
                    LegalOps NY
                  </Link>
                  <Link
                    href="/pricing"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-pricing"
                  >
                    Pricing
                  </Link>
                </div>
              </div>

              {/* Company Section */}
              <div
                className="md:space-y-6 md:border-b-0 transition-all duration-300"
                style={{
                  paddingBottom: "clamp(4px, 0.6vh, 8px)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <button
                  onClick={() => toggleFooterSection("company")}
                  className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left"
                  style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}
                  data-testid="footer-accordion-company"
                >
                  <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">
                    Company
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === "company" ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`space-y-3 transition-all duration-300 md:!opacity-100 md:!max-h-none md:!block ${
                    expandedFooterSection === "company"
                      ? "opacity-100 max-h-96"
                      : "opacity-0 max-h-0 overflow-hidden"
                  }`}
                  style={{
                    marginTop:
                      expandedFooterSection === "company" ||
                      window.innerWidth >= 768
                        ? "16px"
                        : "0",
                  }}
                >
                  <Link
                    href="/why-onspot"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-why"
                  >
                    Why OnSpot
                  </Link>
                  <Link
                    href="/stories"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-stories"
                  >
                    Amazing Stories
                  </Link>
                  <Link
                    href="/insights"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-insights"
                  >
                    Insights
                  </Link>
                  <Link
                    href="/affiliate"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-affiliate"
                  >
                    Affiliate Marketing
                  </Link>
                  <Link
                    href="/bpo-partner"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-bpo"
                  >
                    BPO Partner
                  </Link>
                  <Link
                    href="/investors"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-investors"
                  >
                    Investors Corner
                  </Link>
                  <Link
                    href="/about"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-about"
                  >
                    About Us
                  </Link>
                  <Link
                    href="/operations-playbook"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-playbook"
                  >
                    Delivery Playbook
                  </Link>
                </div>
              </div>

              {/* New Verticals Section */}
              <div
                className="md:space-y-6 md:border-b-0 transition-all duration-300"
                style={{
                  paddingBottom: "clamp(4px, 0.6vh, 8px)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <button
                  onClick={() => toggleFooterSection("verticals")}
                  className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left"
                  style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}
                  data-testid="footer-accordion-verticals"
                >
                  <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">
                    New Verticals
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === "verticals" ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`space-y-3 transition-all duration-300 md:!opacity-100 md:!max-h-none md:!block ${
                    expandedFooterSection === "verticals"
                      ? "opacity-100 max-h-96"
                      : "opacity-0 max-h-0 overflow-hidden"
                  }`}
                  style={{
                    marginTop:
                      expandedFooterSection === "verticals" ||
                      window.innerWidth >= 768
                        ? "16px"
                        : "0",
                  }}
                >
                  <a
                    href="#"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                  >
                    AI Human-in-the-Loop
                  </a>
                  <a
                    href="#"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                  >
                    Founder Ops
                  </a>
                  <a
                    href="#"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                  >
                    Healthcare Micro-Admin
                  </a>
                  <a
                    href="#"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                  >
                    E-commerce Ops
                  </a>
                  <a
                    href="#"
                    className="block text-xs sm:text-sm font-medium text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                  >
                    View all 10 →
                  </a>
                </div>
              </div>

              {/* Connect Section */}
              <div className="md:space-y-6 transition-all duration-300 min-w-0">
                <button
                  onClick={() => toggleFooterSection("connect")}
                  className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left"
                  style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}
                  data-testid="footer-accordion-connect"
                >
                  <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">
                    Connect
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === "connect" ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`space-y-3 transition-all duration-300 md:!opacity-100 md:!max-h-none md:!block ${
                    expandedFooterSection === "connect"
                      ? "opacity-100 max-h-96"
                      : "opacity-0 max-h-0 overflow-hidden"
                  }`}
                  style={{
                    marginTop:
                      expandedFooterSection === "connect" ||
                      window.innerWidth >= 768
                        ? "16px"
                        : "0",
                  }}
                >
                  <a
                    href="mailto:hello@onspotglobal.com"
                    className="flex items-start justify-center md:justify-start gap-3 min-w-0 text-xs sm:text-sm text-white/70 hover:text-white transition-all duration-300 group"
                    data-testid="footer-email"
                  >
                    <Mail className="w-5 h-5 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
                    <span className="break-words whitespace-normal leading-snug min-w-0">
                      hello@onspotglobal.com
                    </span>
                  </a>
                  <a
                    href="tel:+1234567890"
                    className="flex items-center justify-center md:justify-start gap-3 text-xs sm:text-sm text-white/70 hover:text-white transition-all duration-300 group"
                    data-testid="footer-phone"
                  >
                    <Phone className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>1-917-801-9294</span>
                  </a>
                  <div className="flex items-start justify-center md:justify-start gap-3 text-xs sm:text-sm text-white/70">
                    <span className="break-words sm:break-normal">
                      <a
                        href="https://www.google.com/search?q=onspot+global+new+york..."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-center md:justify-start gap-3 text-xs sm:text-sm text-white/70 hover:text-white transition-all duration-300 group"
                      >
                        <MapPinIcon className="w-5 h-5 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
                        <span className="break-words sm:break-normal underline-offset-2 group-hover:underline">
                          US - 2248 Broadway, New York, 10024
                        </span>
                      </a>
                      <br />
                      <a
                        href="https://www.google.com/search?q=onspot+global+philippines&sca_esv=4acce884baa46368&rlz=1C5CHFA_enPH1014PH1014&ei=Koz4aJ3FFuuqvr0Pt66r6QI&oq=onspot+global+ph"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-center md:justify-start gap-3 text-xs sm:text-sm text-white/70 hover:text-white transition-all duration-300 group"
                      >
                        <MapPinIcon className="w-5 h-5 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-all duration-300" />
                        <span className="break-words sm:break-normal underline-offset-2 group-hover:underline">
                          PH - Unit No. 1702, 17th Floor High Street South
                          Corporate Plaza Tower 2, 11th Ave Cor 26th St,
                          Bonifacio Global City, Taguig
                        </span>
                      </a>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between text-xs sm:text-sm text-white/70">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="hover:text-white transition-colors duration-300">
                © 2025 OnSpot. All rights reserved.
              </span>
              <span className="hidden sm:inline text-white/30">·</span>
              <span className="text-[10px] sm:text-xs text-white/50">
                Powered by OnSpot Intelligence
              </span>
            </div>
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="hover:text-white transition-all duration-300 hover:translate-y-[-1px]"
                data-testid="footer-privacy"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="hover:text-white transition-all duration-300 hover:translate-y-[-1px]"
                data-testid="footer-terms"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
