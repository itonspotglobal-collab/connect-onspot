import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Post } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Users,
  TrendingUp,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  Bot,
  Zap,
  Sparkles,
  Mail,
  Phone,
  MapPinIcon,
  Linkedin,
  Facebook,
  Instagram,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  SlidersHorizontal,
  Eye,
  Calendar,
  ArrowUpRight,
  User,
  BookOpen,
} from "lucide-react";
import { SiX, SiThreads, SiTiktok, SiYoutube } from "react-icons/si";
import { Link } from "wouter";
import { useVanessa } from "@/contexts/VanessaContext";
import onspotLogoCropped from "@assets/onspot-logo-cropped.png";

import FlashLogo from "../assets/logos/Flash.png";
import FutureEVLogo from "../assets/logos/FutureEV.png";
import IPSLogo from "../assets/logos/IPS.png";
import PinetechLogo from "../assets/logos/Pinetech.png";
import SafewayLogo from "../assets/logos/Safeway.png";
import VertexLogo from "../assets/logos/Vertex.png";

import WorkCompaniesPhoto from "@assets/Work_diff1_1780058152129.png";
import WorkProfessionalsPhoto from "@assets/Work_diff2_1780058152129.png";

import GalleryImg1 from "@assets/Team_Flow_1775045176827.png";
import GalleryImg2 from "@assets/Deep_Work_1775045176826.png";
import GalleryImg3 from "@assets/Culture_Photo_1775044319871.png";
import GalleryImg7 from "@assets/Leadership_Lifestyle_1775042849148.png";

import WhyOnSpotMainOffice from "../assets/why-onspot/why-onspot-main-office.png";
import WhyAIFirstInfrastructure from "@assets/AI-First_1780060255446.png";
import WhyHumanCenteredCulture from "@assets/human-centered_1780060255447.png";
import WhyConnectedEcosystem from "@assets/connected-ecosystem_1780060255447.png";
import WhyScalableExcellence from "@assets/scalable-excellence_1780060255447.png";

import CollaborationThatScales from "@assets/Collaboration-that-scales_1780059195131.png";
import ExecutiveSupport from "@assets/Executive-support_1780059195131.png";
import AlwaysConnected from "@assets/Always-connected_1780059195130.png";
import FutureOfWork from "@assets/uilt-for-the-future-of-work_1780059195132.png";
import FocusedExpertise from "@assets/Focused-expertise_1780059195132.png";
import EngineeringTalent from "@assets/Engineering-talent_1780059195131.png";
import AlignedEveryDay from "@assets/Aligned-every-day_1780059195130.png";
import WinningTogether from "@assets/Winning-together_1780059195132.png";
import CultureFirst from "@assets/Culture-first_1780059195131.png";

import KyleMendezPhoto from "@assets/Kyle_Mendez_1774430604161.jpeg";
import AlexandraLopezPhoto from "@assets/Alexandra_Lopez_1774430604160.jpg";
import AndreaPinzonPhoto from "@assets/Andrea_Pinzon_1774264095055.jpeg";
import ChristopherAlbaPhoto from "@assets/Christopher_Alba_1774264095055.jpg";
import RachelCastroPhoto from "@assets/Rachel_Caztro_1774264095056.jpg";
import AmirSinghPhoto from "@assets/Amir_Singh_1774264095055.jpg";
import JenniferDizonPhoto from "@assets/Jennifer_Dizon_1774430604160.jpg";
import AndreiLosantoPhoto from "@assets/Andrei_Losanto_1774430604160.jpg";

const trustedBrands = [
  { name: "Flash Justice", logo: FlashLogo },
  { name: "Future Motors EV", logo: FutureEVLogo },
  { name: "IPS by Meest", logo: IPSLogo },
  { name: "Pinetech", logo: PinetechLogo },
  { name: "Safeway Moving", logo: SafewayLogo },
  { name: "Vertex Education", logo: VertexLogo },
];

type CardStyle = {
  transform: string;
  zIndex: number;
  opacity: number;
};

function getCardStyle(
  offset: number,
  nearOffset: number,
  farOffset: number,
): CardStyle {
  const map: Record<string, CardStyle> = {
    "0": {
      transform: `translate(-50%, -50%) translateX(0px) scale(1.16)`,
      zIndex: 50,
      opacity: 1,
    },
    "-1": {
      transform: `translate(-50%, -50%) translateX(-${nearOffset}px) scale(0.88) rotateY(10deg)`,
      zIndex: 30,
      opacity: 0.72,
    },
    "1": {
      transform: `translate(-50%, -50%) translateX(${nearOffset}px) scale(0.88) rotateY(-10deg)`,
      zIndex: 30,
      opacity: 0.72,
    },
    "-2": {
      transform: `translate(-50%, -50%) translateX(-${farOffset}px) scale(0.72) rotateY(16deg)`,
      zIndex: 10,
      opacity: 0.35,
    },
    "2": {
      transform: `translate(-50%, -50%) translateX(${farOffset}px) scale(0.72) rotateY(-16deg)`,
      zIndex: 10,
      opacity: 0.35,
    },
  };
  return (
    map[String(offset)] ?? {
      transform: "translate(-50%,-50%) scale(0)",
      zIndex: 0,
      opacity: 0,
    }
  );
}

function TrustedLogos() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Offsets per breakpoint
  const nearOffset = visibleCount === 5 ? 260 : visibleCount === 3 ? 190 : 0;
  const farOffset = visibleCount === 5 ? 470 : visibleCount === 3 ? 340 : 0;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % trustedBrands.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex(
      (prev) => (prev - 1 + trustedBrands.length) % trustedBrands.length,
    );
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000);
  }, []);

  const handleArrow = useCallback(
    (dir: "prev" | "next") => {
      if (dir === "next") nextSlide();
      else prevSlide();
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 3000);
    },
    [nextSlide, prevSlide],
  );

  // Resize → update visibleCount
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setVisibleCount(1);
      else if (window.innerWidth < 1024) setVisibleCount(3);
      else setVisibleCount(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Autoplay
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPaused) {
      intervalRef.current = setInterval(nextSlide, 3500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, nextSlide]);

  // Compute visible slots
  const visibleOffsets: number[] =
    visibleCount === 5
      ? [-2, -1, 0, 1, 2]
      : visibleCount === 3
        ? [-1, 0, 1]
        : [0];

  const visibleItems = visibleOffsets.map((offset) => {
    const index =
      (currentIndex + offset + trustedBrands.length) % trustedBrands.length;
    return { ...trustedBrands[index], offset, isActive: offset === 0 };
  });

  return (
    <div className="mt-10 sm:mt-14 w-full select-none">
      {/* Carousel stage */}
      <div
        className="relative mx-auto h-[220px] sm:h-[250px] w-full max-w-6xl overflow-visible"
        style={{ perspective: "1200px" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Cards */}
        {visibleItems.map(({ name, logo, offset, isActive }) => {
          const style = getCardStyle(offset, nearOffset, farOffset);
          return (
            <div
              key={name}
              className={[
                "absolute left-1/2 top-1/2 flex items-center justify-center rounded-3xl bg-white",
                "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isActive
                  ? "h-36 sm:h-40 w-[280px] sm:w-[340px] border border-purple-300/70 shadow-2xl"
                  : Math.abs(offset) === 1
                    ? "h-28 sm:h-32 w-[240px] sm:w-[300px] border border-slate-200/70 shadow-md"
                    : "h-24 sm:h-28 w-[210px] sm:w-[260px] border border-slate-200/60 shadow-sm",
              ].join(" ")}
              style={{
                ...style,
                transformStyle: "preserve-3d",
                willChange: "transform, opacity",
              }}
            >
              <img
                src={logo}
                alt={name}
                loading="lazy"
                className={[
                  "object-contain transition-all duration-700",
                  isActive
                    ? "max-h-20 max-w-[200px] sm:max-w-[230px]"
                    : Math.abs(offset) === 1
                      ? "max-h-14 max-w-[150px] sm:max-w-[170px]"
                      : "max-h-12 max-w-[120px] sm:max-w-[140px]",
                ].join(" ")}
              />
            </div>
          );
        })}

        {/* Left arrow */}
        <button
          onClick={() => handleArrow("prev")}
          aria-label="Previous logo"
          className="absolute left-2 sm:left-4 top-1/2 z-[60] -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => handleArrow("next")}
          aria-label="Next logo"
          className="absolute right-2 sm:right-4 top-1/2 z-[60] -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="mt-10 flex items-center justify-center gap-2">
        {trustedBrands.map((brand, index) => (
          <button
            key={brand.name}
            onClick={() => goTo(index)}
            aria-label={`Go to ${brand.name}`}
            className={[
              "rounded-full transition-all duration-500",
              index === currentIndex
                ? "h-2.5 w-6 bg-violet-500"
                : "h-2 w-2 bg-slate-300 hover:bg-slate-400",
            ].join(" ")}
          />
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

  const { data: postsData } = useQuery<{ success: boolean; posts: Post[] }>({
    queryKey: ["/api/posts"],
    staleTime: 5 * 60 * 1000,
  });

  const featuredPosts: Post[] = postsData?.posts
    ? [...postsData.posts]
        .sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          return (
            new Date(b.publishedAt ?? b.createdAt).getTime() -
            new Date(a.publishedAt ?? a.createdAt).getTime()
          );
        })
        .slice(0, 3)
    : [];

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

        {/* Main content — centered, occupies first viewport so stats fall below fold */}
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center relative z-20 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
            {/* Badge */}
            <div
              className="hero-fade-up inline-flex items-center gap-2.5 bg-white/8 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20"
              data-testid="badge-superhuman-bpo"
            >
              <span className="text-sm sm:text-base font-large text-white/90">
                AI First. Humans When it Matters.
              </span>
            </div>

            {/* Headline */}
            <div className="hero-fade-up mt-8 sm:mt-10">
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-white">
                Work{" "}
                <span className="bg-gradient-to-r from-violet-300 via-blue-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
                  Differently.
                </span>
              </h1>
            </div>

            {/* Supporting copy */}
            <div className="hero-fade-up-delay mx-auto mt-8 max-w-3xl">
              <p className="text-xl sm:text-2xl font-semibold tracking-wide text-white/85">
                One System. Your unfair Advantage.
              </p>
              <p className="mt-3 text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                Marketplace speed, BPO quality, and a talent pool built for the
                work AI creates
              </p>
              <p className="mt-3 text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                — not just the work it replaces.
              </p>
            </div>

            {/* CTAs */}
            <div className="hero-fade-up-delay mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                onClick={openVanessa}
                className="relative group text-sm sm:text-base px-6 sm:px-8 h-auto bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all duration-300 hover-elevate rounded-2xl w-full sm:w-auto py-3.5 min-h-[48px]"
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
                className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/30 text-white font-medium backdrop-blur-xl bg-white/5 rounded-2xl w-full sm:w-auto py-3.5 min-h-[48px]"
                asChild
                data-testid="button-get-managed-team"
              >
                <Link href="/lead-intake">Get Managed Team</Link>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/20 text-white/85 font-medium backdrop-blur-xl bg-white/[0.03] rounded-2xl w-full sm:w-auto py-3.5 min-h-[48px]"
                asChild
                data-testid="button-find-work"
              >
                <Link href="/find-work">Find Work</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip — light contrast band after hero ── */}
      <div className="relative w-full border-y border-slate-200 bg-[#F1F2F6]">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          {[
            { value: "72hrs", label: "AVG. TIME TO HIRE" },
            { value: "500+", label: "GLOBAL CLIENTS" },
            { value: "98%", label: "CLIENT RETENTION" },
            { value: "2,000+", label: "TALENTS PLACED" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex min-h-[120px] flex-col items-center justify-center px-6 py-7 text-center"
            >
              <span className="text-4xl font-bold tracking-tight text-[#3F4698] sm:text-5xl">
                {stat.value}
              </span>
              <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. FEATURED INSIGHTS — text-only list ── */}
      <div className="bg-[#FAF9F6] py-12 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr] lg:gap-16">
            {/* Left: label + heading */}
            <div className="lg:pt-2">
              <div className="flex items-center gap-4">
                <span className="h-px w-10 bg-[#3F4698]" />
                <span className="text-xs font-bold uppercase tracking-[0.32em] text-[#3F4698]">
                  Insights
                </span>
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Latest Insights
              </h2>
            </div>

            {/* Right: view all + rows */}
            <div>
              <div className="mb-4 flex items-center justify-end">
                <a
                  href="/insights"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#3F4698] transition-all hover:gap-3"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="divide-y divide-slate-200">
                {(featuredPosts.length > 0
                  ? featuredPosts.slice(0, 3)
                  : [
                      {
                        id: 1,
                        slug: "ai-operating-model",
                        category: "AI OPERATIONS",
                        title:
                          "The new operating model: AI agents and human teams",
                        readTime: "6 min read",
                      },
                      {
                        id: 2,
                        slug: "philippines-global-operations",
                        category: "TALENT",
                        title:
                          "Why the Philippines is the future of global operations",
                        readTime: "8 min read",
                      },
                      {
                        id: 3,
                        slug: "founder-playbook",
                        category: "FOUNDER OPS",
                        title:
                          "From burnout to 4-day weeks: a founder's playbook",
                        readTime: "5 min read",
                      },
                    ]
                ).map((post) => (
                  <a
                    key={post.id}
                    href={`/insights/${post.slug}`}
                    className="group grid grid-cols-1 gap-3 py-6 md:grid-cols-[220px_1fr_110px] md:items-center md:gap-6"
                  >
                    {/* Category pill — fixed height, no-wrap */}
                    <span className="inline-flex h-9 w-fit items-center justify-center whitespace-nowrap rounded-full bg-[#EEEAFE] px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3F4698]">
                      {(post as any).category || "Industry Insights"}
                    </span>
                    {/* Title */}
                    <h3 className="text-xl font-semibold leading-snug text-slate-950 transition-colors group-hover:text-[#3F4698] sm:text-2xl">
                      {post.title}
                    </h3>
                    {/* Read time */}
                    <span className="text-sm text-slate-500 md:text-right">
                      {(post as any).readTime || "5 min read"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. WORK DIFFERENTLY ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f7f4ff] to-[#dff8ff] py-20 sm:py-24">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3F4698]">
              Work differently.
            </p>
            <h2 className="mx-auto mt-4 max-w-5xl text-center text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[56px]">
              <span className="block">Whether you're scaling a team or growing a career</span>
              <span className="mt-2 block">— OnSpot is built for both sides of great work.</span>
            </h2>
          </div>

          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2 items-stretch">
            {/* Card 1: For Companies */}
            <div className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[#3F4698]/25 bg-[#F4F6FF] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              {/* Image header */}
              <div className="relative h-[260px] w-full overflow-hidden sm:h-[300px] lg:h-[320px]">
                <img
                  src={WorkCompaniesPhoto}
                  alt="Team collaboration"
                  className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#3F4698]/35 via-[#3F4698]/10 to-transparent" />
                <span className="absolute bottom-4 left-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3F4698] shadow-sm backdrop-blur">
                  For companies
                </span>
              </div>

              {/* Card body */}
              <div className="flex flex-1 flex-col p-8 sm:p-10">
                <h3 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
                  Hire faster. Spend less.
                </h3>

                <div className="mt-6 flex flex-col flex-1">
                  {[
                    {
                      icon: <Zap className="h-5 w-5" />,
                      title: "Hire in days",
                      sub: "72-hour match average",
                    },
                    {
                      icon: <SlidersHorizontal className="h-5 w-5" />,
                      title: "Hire your way",
                      sub: "Contract, project, full-time",
                    },
                    {
                      icon: <ArrowRight className="h-5 w-5" />,
                      title: "No middlemen",
                      sub: "Direct access, zero markups",
                    },
                    {
                      icon: <Globe className="h-5 w-5" />,
                      title: "50+ countries",
                      sub: "Global reach, local expertise",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex gap-4 border-b border-[#3F4698]/10 py-5"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3F4698]/10 text-[#3F4698]">
                        {item.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.sub}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6">
                  <a
                    href="/hire-talent"
                    className="flex w-full items-center justify-center rounded-full border border-[#3F4698] px-6 py-3 text-sm font-semibold text-[#3F4698] transition hover:bg-[#3F4698] hover:text-white"
                  >
                    Find the right talent →
                  </a>
                </div>
              </div>
            </div>

            {/* Card 2: For Professionals */}
            <div className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[#3F4698]/25 bg-[#F7F5FF] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              {/* Image header */}
              <div className="relative h-[260px] w-full overflow-hidden sm:h-[300px] lg:h-[320px]">
                <img
                  src={WorkProfessionalsPhoto}
                  alt="Professional remote work"
                  className="h-full w-full object-cover object-[center_45%] transition duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#3F4698]/35 via-[#3F4698]/10 to-transparent" />
                <span className="absolute bottom-4 left-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3F4698] shadow-sm backdrop-blur">
                  For professionals
                </span>
              </div>

              {/* Card body */}
              <div className="flex flex-1 flex-col p-8 sm:p-10">
                <h3 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
                  Real work. Real growth.
                </h3>

                <div className="mt-6 flex flex-col flex-1">
                  {[
                    {
                      icon: <TrendingUp className="h-5 w-5" />,
                      title: "Steady pipeline",
                      sub: "No gaps, no chasing",
                    },
                    {
                      icon: <Star className="h-5 w-5" />,
                      title: "Top global brands",
                      sub: "Builds your reputation fast",
                    },
                    {
                      icon: <Clock className="h-5 w-5" />,
                      title: "Your terms",
                      sub: "Remote, flexible schedule",
                    },
                    {
                      icon: <CheckCircle2 className="h-5 w-5" />,
                      title: "Zero gatekeeping",
                      sub: "Pure merit, open access",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex gap-4 border-b border-[#3F4698]/10 py-5"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3F4698]/10 text-[#3F4698]">
                        {item.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.sub}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6">
                  <a
                    href="/find-best-matches"
                    className="flex w-full items-center justify-center rounded-full border border-[#3F4698] px-6 py-3 text-sm font-semibold text-[#3F4698] transition hover:bg-[#3F4698] hover:text-white"
                  >
                    Find your next opportunity →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ── 4. TRUSTED BY ── */}
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
            <div className="space-y-4 sm:space-y-5 mx-auto">
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

      {/* ── 5. SUPERHUMAN NETWORK ── */}
      <div className="relative overflow-hidden bg-[#17152E] py-24 text-white">
        {/* Background glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#3F4698]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-[#3F4698]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-violet-700/10 blur-3xl" />

        {/* Header */}
        <div className="relative z-10 px-4 text-center">
          <div className="mx-auto mb-4 h-px w-10 bg-white/40" />
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/60">
            The Superhuman Network
          </p>
          <h2
            className="mx-auto mt-5 max-w-4xl font-bold tracking-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            Real people. Real work.{" "}
            <span className="text-[#B8B7FF]">Real impact.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">
            <span className="block">A global team of professionals delivering for clients around the world</span>
            <span className="mt-1 block">— every single day.</span>
          </p>
        </div>

        {/* Mosaic gallery — 9 tiles, 3-row layout, no gaps */}
        <div className="relative z-10 mx-auto mt-14 grid max-w-[1800px] grid-cols-2 gap-1.5 px-4 [grid-auto-rows:140px] md:grid-cols-12 md:[grid-auto-rows:165px] lg:[grid-auto-rows:185px]">
          {/* Tile 0 — Collaboration that scales: large left, 2 rows tall */}
          {/* md: cols 1-6, rows 1-2 */}
          <div className="group relative col-span-2 row-span-2 overflow-hidden bg-slate-800 md:col-span-6 md:row-span-2">
            <img
              src={CollaborationThatScales}
              alt="Collaboration that scales"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-4 left-4 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Collaboration that scales
            </div>
          </div>

          {/* Tile 1 — Executive Support: top-right, row 1 */}
          {/* md: cols 7-9, row 1 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={ExecutiveSupport}
              alt="Executive Support"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Executive Support
            </div>
          </div>

          {/* Tile 2 — Always Connected: top-right, row 1 */}
          {/* md: cols 10-12, row 1 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={AlwaysConnected}
              alt="Always Connected"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Always Connected
            </div>
          </div>

          {/* Tile 3 — Built for the future of work: mid-right, row 2 */}
          {/* md: cols 7-9, row 2 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={FutureOfWork}
              alt="Built for the future of work"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Built for the future of work
            </div>
          </div>

          {/* Tile 4 — Focused expertise: mid-right, row 2 */}
          {/* md: cols 10-12, row 2 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={FocusedExpertise}
              alt="Focused expertise"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Focused expertise
            </div>
          </div>

          {/* Tile 5 — Engineering talent: bottom row, col 1 */}
          {/* md: cols 1-3, row 3 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={EngineeringTalent}
              alt="Engineering talent"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Engineering talent
            </div>
          </div>

          {/* Tile 6 — Aligned, every day: bottom row, col 2 */}
          {/* md: cols 4-6, row 3 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={AlignedEveryDay}
              alt="Aligned, every day"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Aligned, every day
            </div>
          </div>

          {/* Tile 7 — Winning together: bottom row, col 3 */}
          {/* md: cols 7-9, row 3 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={WinningTogether}
              alt="Winning together"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Winning together
            </div>
          </div>

          {/* Tile 8 — Culture first: bottom row, col 4 */}
          {/* md: cols 10-12, row 3 */}
          <div className="group relative overflow-hidden bg-slate-800 md:col-span-3">
            <img
              src={CultureFirst}
              alt="Culture first"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Culture first
            </div>
          </div>
        </div>

        {/* Bottom caption */}
        <p className="relative z-10 mx-auto mt-12 max-w-xl px-4 text-center text-sm leading-relaxed text-white/40">
          Behind every workflow is a real person making the work better.
        </p>
      </div>

      {/* ── 6. TRANSFORMATION STORIES ── */}
      <div className="relative overflow-hidden bg-[#F6F7FB] py-20 sm:py-28">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#3F4698]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#3F4698]/5 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="mb-12 sm:mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#3F4698]">
              Transformations
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Real change. <span className="text-[#3F4698]">Real results.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              See how OnSpot helps teams move from overloaded operations to
              intelligent, scalable outsourcing partnerships.
            </p>
          </div>

          {/* Featured card + two smaller cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
            {/* Featured testimonial */}
            <div className="relative overflow-hidden rounded-[32px] border border-[#3F4698]/15 bg-white p-8 shadow-[0_24px_80px_rgba(63,70,152,0.12)] sm:p-10">
              {/* Large decorative quote mark */}
              <span className="pointer-events-none absolute right-8 top-6 select-none text-[120px] font-black leading-none text-[#3F4698]/5">
                "
              </span>

              {/* Author row + metric */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#3F4698]/10 text-[#3F4698]">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      Elad B.
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      CEO / Founder, PineTech
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#3F4698]/10 px-4 py-2 text-sm font-semibold text-[#3F4698]">
                  40% time saved
                </span>
              </div>

              {/* Transformation headline */}
              <h3 className="mt-8 text-2xl font-bold leading-snug text-slate-950 sm:text-3xl">
                From 12-hour workdays to{" "}
                <span className="italic text-[#3F4698]">
                  automated excellence
                </span>
              </h3>

              {/* Quote */}
              <p className="mt-5 text-base leading-relaxed text-slate-600">
                "The professionalism and consistency of the OnSpot team.
                Communication is always clear, and the structured daily and
                weekly updates make it simple to stay aligned."
              </p>

              {/* Badge */}
              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#3F4698]/20 bg-[#3F4698]/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#3F4698]">
                <TrendingUp className="h-3 w-3" />
                Client transformation
              </div>
            </div>

            {/* Two smaller cards stacked */}
            <div className="flex flex-col gap-6">
              {[
                {
                  name: "Eric M.",
                  role: "Operations Director, Flash Justice",
                  metric: "3 weeks to full team",
                  headline: "From scattered processes to",
                  highlight: "seamless orchestration",
                  quote:
                    "I've worked with several outsourcing companies, but none delivered like OnSpot. Shane and Ria helped me build my team, stayed involved, and ensured success. I finally feel like I'm working with a true partner.",
                },
                {
                  name: "Fernando C.",
                  role: "CTO, Pinetech",
                  metric: "24/7 coverage",
                  headline: "From constant firefighting to",
                  highlight: "proactive innovation",
                  quote:
                    "OnSpot's team is professional, responsive, and reliable — always going above and beyond. The efficiency and consistency they deliver gives me complete confidence.",
                },
              ].map((story) => (
                <div
                  key={story.name}
                  className="flex flex-1 flex-col rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3F4698]/10 text-[#3F4698]">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {story.name}
                        </p>
                        <p className="text-xs text-slate-500">{story.role}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#3F4698]/10 px-3 py-1 text-xs font-semibold text-[#3F4698]">
                      {story.metric}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold leading-snug text-slate-950">
                    {story.headline}{" "}
                    <span className="italic text-[#3F4698]">
                      {story.highlight}
                    </span>
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600 flex-1">
                    "{story.quote}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. WHY PARTNER / WHY ONSPOT ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#F6F4FF] via-[#F8F7FF] to-[#EEF2FF] py-24 sm:py-28">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#3F4698]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#3F4698]/5 blur-3xl" />

        <div className="container relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          {/* Top row — intro left, image right */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            {/* Left: label + headline + copy */}
            <div>
              <div className="flex items-center gap-3">
                <div className="h-px w-8 bg-[#3F4698]/50" />
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#3F4698]">
                  Why OnSpot
                </p>
              </div>
              <h2
                className="mt-4 font-bold leading-tight tracking-tight text-slate-950"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
              >
                Not a service provider.{" "}
                <span className="italic text-[#3F4698]">An architect.</span>
              </h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                We design the operating layer behind modern outsourcing —
                combining AI-ready systems, vetted talent, and human
                accountability so your team can scale without losing control.
              </p>
            </div>

            {/* Right: large image */}
            <div className="relative h-64 overflow-hidden rounded-[28px] border border-white/70 shadow-sm lg:h-72">
              <img
                src={WhyOnSpotMainOffice}
                alt="Modern professional workspace"
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#3F4698]/15 to-transparent" />
            </div>
          </div>

          {/* Four pillar cards — 2×2 grid */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              {
                icon: <Bot className="h-6 w-6" />,
                img: WhyAIFirstInfrastructure,
                imgAlt: "AI workflow and laptop",
                title: "AI-first infrastructure",
                tagline: "Intelligent by design",
                body: "Every system and workflow enhanced by intelligence that amplifies human potential — not automation for its own sake.",
              },
              {
                icon: <Users className="h-6 w-6" />,
                img: WhyHumanCenteredCulture,
                imgAlt: "Team culture",
                title: "Human-centered culture",
                tagline: "People, not resources",
                body: "Elite Filipino talent treated as partners. We invest in their growth because your success depends on it.",
              },
              {
                icon: <Globe className="h-6 w-6" />,
                img: WhyConnectedEcosystem,
                imgAlt: "Connected workflow",
                title: "Connected ecosystem",
                tagline: "Seamless integration",
                body: "Your tools, your workflow, working in harmony. We don't disrupt what you've built — we elevate it.",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                img: WhyScalableExcellence,
                imgAlt: "Scalable team",
                title: "Scalable excellence",
                tagline: "Grow without compromise",
                body: "Scale from 1 to 100 without losing quality, culture, or control. Same excellence at every stage.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group overflow-hidden rounded-[24px] border border-[#3F4698]/15 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Photo header */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-100 sm:h-48">
                  <img
                    src={card.img}
                    alt={card.imgAlt}
                    className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>

                {/* Card body with floating icon badge */}
                <div className="relative px-8 pb-8 pt-10">
                  <div className="absolute -top-5 left-8 z-20 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEEAFE] text-[#3F4698] shadow-sm ring-4 ring-white">
                    {card.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-[#3F4698]">
                    {card.tagline}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {card.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 7. THE PROOF / TALENT PROFILES ── */}
      <div className="relative bg-white py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mb-12 sm:mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3F4698]">
              The Proof
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mx-auto max-w-2xl">
              The people behind the platform.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-500 mx-auto max-w-xl">
              Powered by professionals from the US, Philippines, and beyond. The
              Superhuman BPO Network.
            </p>
          </div>

          <div className="mx-auto mt-20 grid w-full max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                photo: KyleMendezPhoto,
                name: "Kyle Mendez",
                flag: "🇵🇭",
                role: "Senior Data Analyst",
              },
              {
                photo: AlexandraLopezPhoto,
                name: "Alexandra Lopez",
                flag: "🇵🇭",
                role: "CX & Operations Lead",
              },
              {
                photo: AndreaPinzonPhoto,
                name: "Andrea Pinzon",
                flag: "🇵🇭",
                role: "Virtual Assistant",
              },
              {
                photo: ChristopherAlbaPhoto,
                name: "Christopher Alba",
                flag: "🇵🇭",
                role: "Technical Support",
              },
              {
                photo: RachelCastroPhoto,
                name: "Rachel Castro",
                flag: "🇵🇭",
                role: "Social Media Manager",
              },
              {
                photo: AmirSinghPhoto,
                name: "Amir Singh",
                flag: "🇺🇸",
                role: "SEO Specialist",
              },
              {
                photo: JenniferDizonPhoto,
                name: "Jennifer Dizon",
                flag: "🇵🇭",
                role: "Customer Service",
              },
              {
                photo: AndreiLosantoPhoto,
                name: "Andrei Losanto",
                flag: "🇵🇭",
                role: "Full Stack Developer",
              },
            ].map((person) => (
              <div
                key={person.name}
                className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Photo — full-color, no filter */}
                <img
                  src={person.photo}
                  alt={person.name}
                  className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent opacity-100 md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100" />

                {/* Name + role — always visible mobile, hover-only desktop */}
                <div className="absolute inset-x-0 bottom-0 z-10 translate-y-0 p-5 text-white opacity-100 transition-all duration-300 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  <h3 className="text-base font-bold text-white leading-tight">
                    {person.name} <span aria-hidden="true">{person.flag}</span>
                  </h3>
                  <p className="mt-0.5 text-sm font-medium text-white/80">
                    {person.role}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/talent-pool"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#3F4698]/50 hover:text-[#3F4698] hover:shadow-md"
            >
              Browse all talent
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 8. FINAL CTA ── */}
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
                <img
                  src={onspotLogoCropped}
                  alt="OnSpot"
                  className="block h-auto w-[160px] sm:w-[175px] lg:w-[190px] object-contain"
                  data-testid="footer-logo"
                />

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
                className="md:space-y-6 transition-all duration-300"
                style={{
                  paddingBottom: "clamp(4px, 0.6vh, 8px)",
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
                  <Link
                    href="/faq"
                    className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300"
                    data-testid="footer-link-faq"
                  >
                    FAQ
                  </Link>
                </div>
              </div>

              {/* Company Section */}
              <div
                className="md:space-y-6 transition-all duration-300"
                style={{
                  paddingBottom: "clamp(4px, 0.6vh, 8px)",
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
                className="md:space-y-6 transition-all duration-300"
                style={{
                  paddingBottom: "clamp(4px, 0.6vh, 8px)",
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
