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

import WorkCompaniesPhoto from "@assets/image_1780637381322.png";
import WorkProfessionalsPhoto from "@assets/image_1780637420236.png";

import GalleryImg1 from "@assets/Team_Flow_1775045176827.png";
import GalleryImg2 from "@assets/Deep_Work_1775045176826.png";
import GalleryImg3 from "@assets/Culture_Photo_1775044319871.png";
import GalleryImg7 from "@assets/Leadership_Lifestyle_1775042849148.png";

import WhyOnSpotMainOffice from "../assets/why-onspot/why-onspot-main-office.png";
import WhyAIFirstInfrastructure from "@assets/Screenshot_2026-06-05_at_17.48.33_1780653139372.png";
import WhyHumanCenteredCulture from "@assets/Screenshot_2026-06-05_at_17.48.54_1780653139379.png";
import WhyConnectedEcosystem from "@assets/Screenshot_2026-06-05_at_17.49.53_1780653139380.png";
import WhyScalableExcellence from "@assets/Screenshot_2026-06-05_at_17.50.17_1780653139381.png";

import CollaborationThatScales from "@assets/Collaboration-that-scales_1780059195131.png";
import ExecutiveSupport from "@assets/Executive_Support_1780638507560.png";
import AlwaysConnected from "@assets/Always_Connected_1780638514689.png";
import FutureOfWork from "@assets/Built_for_the_future_of_work_1780638559714.png";
import FocusedExpertise from "@assets/Focused_expertise_1780638559714.png";
import EngineeringTalent from "@assets/Engineering_talent_1780638559714.png";
import AlignedEveryDay from "@assets/Aligned,_every_day_1780638559713.png";
import WinningTogether from "@assets/winning_together_1780638637254.png";
import CultureFirst from "@assets/Culture_first_1780638648875.png";

import NurLamineroPhoto from "@assets/Nur_1780574815788.png";
import JakeWainbergPhoto from "@assets/Jake_1780574815787.png";
import MarkApostolPhoto from "@assets/Macky_1780574815788.png";
import RenierMacalinoPhoto from "@assets/REN_1780657869137.png";
import JaelAtendidoPhoto from "@assets/Jael_1780665513434.png";
import AndreaPinzonPhoto from "@assets/Andrea_Pinzon_1774264095055.jpeg";
import ShaneRubioPhoto from "@assets/Shane_1780657863305.png";
import RachelCastroPhoto from "@assets/Rachel_Caztro_1774264095056.jpg";

const trustedBrands = [
  { name: "Flash Justice", logo: FlashLogo },
  { name: "Future Motors EV", logo: FutureEVLogo },
  { name: "IPS by Meest", logo: IPSLogo },
  { name: "Pinetech", logo: PinetechLogo },
  { name: "Safeway Moving", logo: SafewayLogo },
  { name: "Vertex Education", logo: VertexLogo },
];

function TrustedLogos() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleNext = () => {
    nextSlide();
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 4000);
  };

  const handlePrev = () => {
    prevSlide();
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 4000);
  };

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

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPaused) {
      intervalRef.current = setInterval(nextSlide, 3500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, nextSlide]);

  const half = Math.floor(visibleCount / 2);
  const visibleItems = Array.from({ length: visibleCount }, (_, position) => {
    const offset = position - half;
    const logoIndex =
      (currentIndex + offset + trustedBrands.length) % trustedBrands.length;
    return {
      ...trustedBrands[logoIndex],
      logoIndex,
      offset,
      isActive: offset === 0,
    };
  });

  return (
    <div className="mt-12 w-full select-none">
      <div
        className="relative mx-auto w-full max-w-7xl px-12 sm:px-16"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Previous arrow — left side */}
        <button
          onClick={handlePrev}
          aria-label="Previous client logo"
          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition hover:shadow-lg"
        >
          <ChevronLeft className="h-4 w-4 text-slate-500" />
        </button>

        {/* Cards row */}
        <div className="flex items-center justify-center gap-3 overflow-visible py-10 sm:gap-4 lg:gap-5">
          {visibleItems.map(({ name, logo, offset, isActive }) => {
            const absOffset = Math.abs(offset);
            const cardWidth = isActive ? 268 : absOffset === 1 ? 210 : 176;
            const cardHeight = isActive ? 136 : absOffset === 1 ? 108 : 88;
            const scale = isActive ? 1 : absOffset === 1 ? 0.93 : 0.83;
            const opacity = isActive ? 1 : absOffset === 1 ? 0.78 : 0.42;
            const imgMaxH = isActive ? 64 : absOffset === 1 ? 44 : 34;
            const imgMaxW = isActive ? 196 : absOffset === 1 ? 152 : 118;

            return (
              <div
                key={`${name}-${offset}`}
                className={[
                  "flex shrink-0 items-center justify-center rounded-2xl border bg-white",
                  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isActive
                    ? "border-purple-300/70 shadow-xl"
                    : absOffset === 1
                      ? "border-slate-200/70 shadow-md"
                      : "border-slate-200/50 shadow-sm",
                ].join(" ")}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  transform: `scale(${scale})`,
                  opacity,
                  flexShrink: 0,
                  willChange: "transform, opacity",
                }}
              >
                <img
                  src={logo}
                  alt={name}
                  loading="lazy"
                  style={{
                    maxHeight: imgMaxH,
                    maxWidth: imgMaxW,
                    objectFit: "contain",
                    transition: "all 500ms",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Next arrow — right side */}
        <button
          onClick={handleNext}
          aria-label="Next client logo"
          className="absolute right-0 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition hover:shadow-lg"
        >
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Dots */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {trustedBrands.map((brand, index) => (
          <button
            key={brand.name}
            onClick={() => goTo(index)}
            aria-label={`Go to ${brand.name}`}
            className={[
              "rounded-full transition-all duration-500",
              index === currentIndex
                ? "h-2 w-5 bg-violet-500"
                : "h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400",
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
    queryKey: ["/api/posts/homepage"],
    staleTime: 2 * 60 * 1000,
  });

  // Only show posts explicitly curated for the homepage — no featured fallback
  const featuredPosts: Post[] = postsData?.posts?.slice(0, 3) ?? [];

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
              className="hero-fade-up inline-flex items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 backdrop-blur-md"
              data-testid="badge-superhuman-bpo"
            >
              <span className="text-sm font-semibold leading-snug text-white/90 sm:text-base lg:text-lg">
                AI First. Humans When it Matters.
              </span>
            </div>

            {/* Headline */}
            <div className="hero-fade-up mt-8 sm:mt-10">
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-white">
                Work{" "}
                <span className="bg-gradient-to-r from-violet-300 via-blue-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
                  Differently
                </span>
              </h1>
            </div>

            {/* Supporting copy */}
            <div className="hero-fade-up-delay mx-auto mt-8 max-w-3xl">
              <p className="text-base font-semibold leading-snug text-white/80 sm:text-lg lg:text-xl">
                One System. Your unfair Advantage.
              </p>
              <p className="mt-3 text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                The only outsourcing system built for the world that's coming
              </p>
              <p className="mt-3 text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                — not the one that's leaving.
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
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0 xl:grid-cols-[repeat(4,1fr)_auto]">
          {[
            { value: "72hrs", label: "AVG. TIME TO HIRE" },
            { value: "200+", label: "GLOBAL CLIENTS" },
            { value: "60%", label: "CLIENT COST SAVINGS" },
            { value: "2,000+", label: "TALENTS MATCHED" },
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
          {/* CTA cell — 5th column on xl, full-width row on smaller screens */}
          <div className="col-span-2 flex items-center justify-center border-t border-slate-200 px-6 py-5 md:col-span-4 md:border-l-0 md:border-t xl:col-span-1 xl:border-l xl:border-t-0">
            <a
              href="#contact"
              className="inline-flex h-[64px] min-w-[260px] w-full items-center justify-center gap-3 whitespace-nowrap rounded-[14px] border border-[#D9DDEB] bg-[#EEF0F8] px-8 text-[17px] font-semibold text-[#40499D] shadow-[0_6px_16px_rgba(63,73,157,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#E3E6F2] hover:shadow-[0_8px_18px_rgba(63,73,157,0.16)] focus:outline-none focus:ring-2 focus:ring-[#40499D]/25 focus:ring-offset-2 sm:w-auto"
            >
              <ArrowRight className="h-4 w-4" />
              Calculate your Savings
            </a>
          </div>
        </div>
      </div>

      {/* ── Spacer between stats and Insights ── */}
      <div aria-hidden="true" className="h-24 bg-[#f7f8fb] sm:h-28 lg:h-36" />

      {/* ── 2. FEATURED INSIGHTS — card grid ── */}
      <div className="bg-[#f7f8fb] py-8 sm:py-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-7 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <div className="overflow-visible leading-none">
                <h2 className="inline-block overflow-visible bg-gradient-to-r from-[#6B35F5] via-[#7C4DFF] to-[#3B82F6] bg-clip-text pb-3 pr-3 text-[clamp(64px,8vw,112px)] font-bold leading-[1.08] tracking-[-0.055em] text-transparent">
                  Insights
                </h2>
              </div>
              <p className="mt-3 text-2xl font-medium tracking-[-0.035em] leading-tight text-slate-700 sm:text-3xl lg:text-4xl">
                Ideas worth sharing.
              </p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Perspectives on customer experience, global talent, and the
                future of work.
              </p>
            </div>
            <a
              href="/insights"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              Explore all
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Editorial layout — dynamic homepage posts with static fallback */}
          {(() => {
            const staticPosts = [
              {
                id: 1,
                slug: "process-efficiency-foundation-customer-service",
                category: "PROCESS OPTIMIZATION",
                title:
                  "Process Efficiency: The Foundation of Exceptional Customer Service",
                readTime: "6 min read",
                coverImageUrl: null as string | null,
              },
              {
                id: 2,
                slug: "leveraging-ghanas-tech-talent-philippines-customer-service",
                category: "GLOBAL OUTSOURCING",
                title:
                  "Leveraging Ghana's Tech Talent and the World-Class Customer Service of the Philippines",
                readTime: "5 min read",
                coverImageUrl: null as string | null,
              },
              {
                id: 3,
                slug: "ghana-software-development-outsourcing-goldmine",
                category: "TECHNOLOGY",
                title:
                  "Ghana's Software Development Capabilities: An Untapped Goldmine for Outsourcing",
                readTime: "4 min read",
                coverImageUrl: null as string | null,
              },
            ];
            const posts =
              featuredPosts.length > 0
                ? featuredPosts.slice(0, 3)
                : staticPosts;
            const [featured, ...secondary] = posts;
            const featuredThumb = (featured as any).coverImageUrl as
              | string
              | null
              | undefined;

            return (
              <div className="grid gap-6">
                {/* Featured article */}
                <a
                  href={`/insights/${featured.slug}`}
                  className="group relative overflow-hidden rounded-[2rem] bg-slate-900 shadow-sm"
                >
                  {featuredThumb ? (
                    <img
                      src={featuredThumb}
                      alt={featured.title}
                      className="h-[250px] w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:h-[290px] lg:h-[330px]"
                    />
                  ) : (
                    <div className="h-[250px] w-full bg-gradient-to-br from-indigo-900 via-violet-900 to-slate-900 sm:h-[290px] lg:h-[330px]" />
                  )}
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  {/* Text */}
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 lg:p-7">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                      {(featured as any).category || "Insights"}
                    </span>
                    <h3 className="mt-2 max-w-4xl text-xl font-semibold leading-tight text-white sm:text-2xl lg:text-3xl">
                      {featured.title}
                    </h3>
                    <p className="mt-2 text-xs font-medium text-white/70 sm:text-sm">
                      {(featured as any).readTime || "5 min read"}
                    </p>
                  </div>
                </a>

                {/* Two smaller cards */}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {secondary.map((post) => {
                    const thumb = (post as any).coverImageUrl as
                      | string
                      | null
                      | undefined;
                    return (
                      <a
                        key={post.id}
                        href={`/insights/${post.slug}`}
                        className="group overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        {thumb ? (
                          <div className="h-28 overflow-hidden bg-slate-100 sm:h-32 lg:h-36">
                            <img
                              src={thumb}
                              alt={post.title}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                          </div>
                        ) : (
                          <div className="h-28 bg-gradient-to-br from-indigo-100 via-violet-100 to-cyan-100 sm:h-32 lg:h-36" />
                        )}
                        <div className="p-4 sm:p-5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                            {(post as any).category || "Insights"}
                          </span>
                          <h3 className="mt-2 text-base font-semibold leading-snug text-slate-950 transition-colors group-hover:text-indigo-700 sm:text-lg">
                            {post.title}
                          </h3>
                          <p className="mt-3 text-xs font-medium text-slate-500 sm:text-sm">
                            {(post as any).readTime || "5 min read"}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Talk to an expert CTA */}
          <div className="mt-10 flex justify-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_32px_rgba(79,70,229,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(79,70,229,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <ArrowRight className="h-4 w-4" />
              Talk to an expert
            </a>
          </div>
        </div>
      </div>

      {/* ── Spacer between Insights and Work Differently ── */}
      <div aria-hidden="true" className="h-20 bg-[#f7f8fb] sm:h-24 lg:h-32" />

      {/* ── 3 + 4. WORK DIFFERENTLY + TRUSTED BY (shared bg) ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#f5f3ff] via-[#f7f9ff] to-[#eafaff]">
        <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-violet-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-20 h-[520px] w-[520px] rounded-full bg-cyan-300/10 blur-3xl" />

        {/* ── 3. WORK DIFFERENTLY ── */}
        <div className="relative overflow-hidden bg-[#F6F8FF] px-6 pt-28 pb-20 sm:pt-32 sm:pb-24 lg:pt-36 lg:pb-28">
          <div className="container relative z-10 mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-[1500px] text-center mb-16 sm:mb-20">
              <p className="mb-7 text-[15px] font-bold uppercase tracking-[0.34em] text-[#4B4FC4]">
                Work Differently
              </p>
              <h2 className="mx-auto max-w-[1450px] text-center text-[clamp(40px,4.25vw,68px)] font-bold leading-[1.05] tracking-[-0.055em] text-[#050A1F]">
                <span className="block lg:whitespace-nowrap">
                  Whether you're scaling a team or growing a career
                </span>
                <span className="mt-3 block lg:whitespace-nowrap">
                  — OnSpot is built for both sides of{" "}
                  <span className="bg-gradient-to-r from-[#6B35F5] via-[#7C4DFF] to-[#3B82F6] bg-clip-text text-transparent">
                    great work.
                  </span>
                </span>
              </h2>
            </div>

            <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
              {/* Card 1: For Companies */}
              <div className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-indigo-100/80 bg-white/80 shadow-[0_20px_60px_rgba(80,80,180,0.08)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(80,80,180,0.14)]">
                {/* Image header */}
                <div className="relative h-[210px] w-full overflow-hidden sm:h-[230px] lg:h-[250px]">
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
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
                    Hire faster. Spend less.
                  </h3>

                  <div className="mt-4 flex flex-col flex-1">
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
                        className="flex items-start gap-3 border-b border-slate-200/80 py-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3F4698]/10 text-[#3F4698]">
                          {item.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {item.sub}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
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
              <div className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#2E3242] shadow-[0_24px_70px_rgba(22,26,44,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(22,26,44,0.30)]">
                {/* Image header */}
                <div className="relative h-[210px] w-full overflow-hidden sm:h-[230px] lg:h-[250px]">
                  <img
                    src={WorkProfessionalsPhoto}
                    alt="Professional remote work"
                    className="h-full w-full object-cover object-[center_45%] transition duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2E3242]/70 via-[#2E3242]/20 to-transparent" />
                  <span className="absolute bottom-4 left-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3F4698] shadow-sm backdrop-blur">
                    For professionals
                  </span>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
                    Real work. Real growth.
                  </h3>

                  <div className="mt-4 flex flex-col flex-1">
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
                        className="flex items-start gap-3 border-b border-white/10 py-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#B9B5FF]">
                          {item.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-sm text-[#CBD2E1]">
                            {item.sub}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <a
                      href="/find-best-matches"
                      className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-white/30 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
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
        <div className="relative bg-transparent pt-8 pb-20 sm:pt-10 sm:pb-24 lg:pt-12 lg:pb-28">
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            <div className="text-center space-y-10 sm:space-y-14">
              <h2
                className="mx-auto font-medium leading-[1.12] tracking-[-0.035em] text-slate-900 text-[clamp(30px,3vw,48px)]"
                style={{ textWrap: "balance", maxWidth: "58ch" }}
              >
                Trusted by global brands, hundreds of entrepreneurs, and
                thousands of professionals worldwide.
              </h2>
              <TrustedLogos />
              <div className="flex justify-center">
                <a
                  href="/find-best-matches"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-300 bg-white/80 px-7 py-3.5 text-base font-semibold text-violet-700 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-violet-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  Join 100+ companies hiring with OnSpot
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
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
          <h2 className="mx-auto mt-5 max-w-[1200px] px-6 text-center font-bold leading-[1.05] tracking-tight text-white text-[clamp(44px,6vw,96px)]">
            <span className="block">Real people. Real work.</span>
            <span className="mt-3 block text-[#B8B7FF]">Real impact.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg"></p>
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
        <p className="relative z-10 mx-auto mt-10 max-w-[1200px] px-6 text-center text-xl font-medium leading-snug tracking-[-0.025em] text-white/60 sm:text-2xl lg:whitespace-nowrap lg:text-3xl">
          Behind every workflow is a{" "}
          <span className="text-white/85">real person</span> making the work
          better.
        </p>

        {/* Meet the people CTA */}
        <div className="relative z-10 mt-8 flex justify-center">
          <a
            href="#people-behind-platform"
            className="inline-flex h-[48px] items-center justify-center gap-3 rounded-[14px] border border-white/10 bg-[#5B45E8] px-7 text-base font-semibold text-white shadow-[0_10px_24px_rgba(55,38,160,0.28)] transition-all duration-300 hover:bg-[#4B38CF] hover:-translate-y-0.5 active:bg-[#3F2FB5] focus:outline-none focus:ring-2 focus:ring-[#8E7CFF] focus:ring-offset-2 focus:ring-offset-[#17152F]"
          >
            Meet the people behind the work
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* ── 6. TRANSFORMATION STORIES ── */}
      <div className="relative overflow-hidden bg-[#F6F7FB] py-20 sm:py-28">
        <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-indigo-400/8 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-violet-400/6 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="mb-14 mx-auto w-full max-w-[1500px] px-0">
            <p className="text-[18px] font-semibold uppercase tracking-[0.22em] text-[#4B46C8] lg:text-[20px]">
              Transformations
            </p>
            <h2 className="mt-5 max-w-[1000px] text-[52px] font-semibold tracking-[-0.045em] leading-[0.96] text-slate-950 md:text-[64px] lg:text-[76px]">
              Real change. <span className="text-[#4B46C8]">Real results.</span>
            </h2>
            <p className="mt-6 max-w-[680px] text-[20px] leading-[1.45] text-[#56647A] lg:text-[22px]">
              See how OnSpot helps teams move from overloaded operations to
              intelligent, scalable outsourcing partnerships.
            </p>
          </div>

          {/* Featured card + two smaller cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
            {/* ── Featured testimonial ── */}
            <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-indigo-200/70 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-8 shadow-[0_24px_80px_rgba(49,46,129,0.24)] sm:p-10 lg:p-12">
              {/* Corner glows */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />

              {/* Decorative quote mark */}
              <span className="pointer-events-none absolute right-8 top-4 select-none font-serif text-[120px] leading-none text-white/10">
                &#8220;
              </span>

              {/* Author row + metric badge */}
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">
                      Elad B.
                    </p>
                    <p className="mt-0.5 text-sm text-white/65">
                      CEO / Founder, PineTech
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15">
                  <Zap className="h-3.5 w-3.5" />
                  40% time saved
                </span>
              </div>

              {/* Before → After */}
              <div className="relative mt-10">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                  Before
                </p>
                <h3 className="mt-1 text-2xl font-semibold leading-snug text-white sm:text-3xl">
                  12-Hour Workdays
                </h3>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/20" />
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
                    transformed into
                  </span>
                  <span className="h-px flex-1 bg-white/20" />
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                  After
                </p>
                <h3 className="mt-1 text-2xl font-semibold italic leading-snug text-violet-200 sm:text-3xl">
                  Automated Excellence
                </h3>
              </div>

              {/* Quote */}
              <p className="relative mt-6 text-base leading-relaxed text-white/75">
                "The professionalism and consistency of the OnSpot team.
                Communication is always clear, and the structured daily and
                weekly updates make it simple to stay aligned."
              </p>

              {/* Footer badge */}
              <div className="mt-auto pt-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/85 ring-1 ring-white/15">
                  <TrendingUp className="h-3 w-3" />
                  Client transformation
                </div>
              </div>
            </div>

            {/* ── Two smaller cards stacked ── */}
            <div className="grid gap-6">
              {[
                {
                  name: "Eric M.",
                  role: "Operations Director, Flash Justice",
                  metric: "3 weeks to full team",
                  before: "Scattered Processes",
                  after: "Seamless Orchestration",
                  quote:
                    "I've worked with several outsourcing companies, but none delivered like OnSpot. Shane and Ria helped me build my team, stayed involved, and ensured success. I finally feel like I'm working with a true partner.",
                },
                {
                  name: "Fernando C.",
                  role: "CTO, Pinetech",
                  metric: "24/7 coverage",
                  before: "Constant Firefighting",
                  after: "Proactive Innovation",
                  quote:
                    "OnSpot's team is professional, responsive, and reliable — always going above and beyond. The efficiency and consistency they deliver gives me complete confidence.",
                },
              ].map((story) => (
                <div
                  key={story.name}
                  className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/75 p-7 shadow-[0_18px_60px_rgba(80,80,180,0.10)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(80,80,180,0.16)] sm:p-8"
                >
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[1.75rem] bg-gradient-to-r from-indigo-500/70 via-violet-400/70 to-cyan-300/70" />

                  {/* Author row + metric */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {story.name}
                        </p>
                        <p className="text-xs text-slate-500">{story.role}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/70">
                      {story.metric}
                    </span>
                  </div>

                  {/* Transformation headline — compact horizontal */}
                  <h3 className="mt-6 text-xl font-semibold leading-snug text-slate-950 sm:text-2xl">
                    From <span className="text-slate-700">{story.before}</span>
                    <span className="mx-2 text-indigo-400">
                      <ArrowRight className="inline h-4 w-4" />
                    </span>
                    <span className="italic text-indigo-700">
                      {story.after}
                    </span>
                  </h3>

                  {/* Quote */}
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">
                    "{story.quote}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Start your transformation CTA */}
          <div className="mt-10 flex justify-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-700 to-violet-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_32px_rgba(67,56,202,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(67,56,202,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <Sparkles className="h-4 w-4" />
              Start your transformation
            </a>
          </div>
        </div>
      </div>

      {/* ── 6. WHY PARTNER / WHY ONSPOT ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#F6F4FF] via-[#F8F7FF] to-[#EEF2FF] py-24 sm:py-28">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#3F4698]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#3F4698]/5 blur-3xl" />

        <div className="container relative z-10 mx-auto max-w-[1400px] px-6 sm:px-8 lg:px-12">
          {/* Header — full-width typography, no image */}
          <div className="max-w-5xl">
            <p className="text-[18px] font-semibold uppercase tracking-[0.22em] text-[#4B46C8] lg:text-[20px]">
              Why OnSpot
            </p>
            <h2 className="mt-6 max-w-[950px] text-[54px] font-semibold tracking-[-0.05em] leading-[0.95] md:text-[68px] lg:text-[82px]">
              <span className="block text-[#070A1A]">
                Not a service provider.
              </span>
              <span className="mt-2 block italic text-[#4F46D8]">
                An architect.
              </span>
            </h2>
            <p className="mt-8 max-w-[760px] text-[20px] leading-[1.45] text-[#56647A] lg:text-[23px]">
              We design the operating layer behind modern outsourcing —
              combining AI-ready systems, vetted talent, and human
              accountability so your team can scale without losing control.
            </p>
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
                imgPosition: "center 24%",
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
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    style={(card as any).imgPosition ? { objectPosition: (card as any).imgPosition } : undefined}
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

          {/* See how it works CTA */}
          <div className="mt-10 flex justify-center">
            <a
              href="#experience"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-700 px-7 py-3.5 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-indigo-800 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              See how it works
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* ── 7. THE PROOF / TALENT PROFILES ── */}
      <div className="relative bg-white py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mb-12 sm:mb-16 text-center">
            <p className="text-base font-semibold uppercase tracking-[0.24em] text-indigo-700 sr-only sm:text-lg lg:text-xl">
              The Proof
            </p>
            <h2 className="mx-auto mt-5 max-w-[1200px] text-center text-[clamp(48px,6vw,94px)] font-semibold tracking-[-0.055em] leading-[0.98] text-slate-950">
              The{" "}
              <span className="bg-gradient-to-r from-indigo-700 via-violet-600 to-blue-500 bg-clip-text text-transparent">
                People
              </span>{" "}
              Behind the Platform
            </h2>
            <p className="mx-auto mt-6 max-w-4xl text-center text-lg leading-relaxed text-slate-600 sm:text-xl lg:text-2xl">
              <span className="block">
                Powered by professionals from the US, Philippines, and beyond.
              </span>
              <span className="block">The Superhuman BPO Network.</span>
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-[1400px] grid-cols-2 gap-5 lg:grid-cols-4">
            {[
              {
                photo: NurLamineroPhoto,
                name: "Nur Laminero",
                flag: "🇵🇭",
                role: "CEO of OnSpot",
                objectPosition: "object-[center_25%]",
                isReal: true,
                gender: "male",
              },
              {
                photo: JaelAtendidoPhoto,
                name: "Jael Atendido",
                flag: "🇵🇭",
                role: "Executive Assistant",
                objectPosition: "object-[center_8%]",
                extraScale: "scale-[2.6]",
                isReal: false,
                gender: "female",
              },
              {
                photo: JakeWainbergPhoto,
                name: "Jake Wainberg",
                flag: "🇺🇸",
                role: "Founder & President",
                objectPosition: "object-[center_20%]",
                isReal: true,
                gender: "male",
              },
              {
                photo: AndreaPinzonPhoto,
                name: "Andrea Pinzon",
                flag: "🇵🇭",
                role: "Virtual Assistant",
                objectPosition: "object-top",
                isReal: false,
                gender: "female",
              },
              {
                photo: MarkApostolPhoto,
                name: "Mark Anthony Apostol",
                flag: "🇵🇭",
                role: "Head of People",
                objectPosition: "object-[center_20%]",
                isReal: true,
                gender: "male",
              },
              {
                photo: ShaneRubioPhoto,
                name: "Shane Rubio-Limiac",
                flag: "🇵🇭",
                role: "Head of Operations",
                objectPosition: "object-[center_18%]",
                isReal: true,
                gender: "female",
              },
              {
                photo: RenierMacalinoPhoto,
                name: "Renier Macalino",
                flag: "🇵🇭",
                role: "Senior Data Analyst",
                objectPosition: "object-top",
                isReal: false,
                gender: "male",
              },
              {
                photo: RachelCastroPhoto,
                name: "Rachel Castro",
                flag: "🇵🇭",
                role: "Social Media Manager",
                objectPosition: "object-top",
                isReal: false,
                gender: "female",
              },
            ].map((person) => (
              <div
                key={person.name}
                className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"
              >
                {person.name === "Jael Atendido" ? (
                  <div className="h-full w-full overflow-hidden rounded-[inherit]">
                    <img
                      src={person.photo}
                      alt={person.name}
                      className="block h-full w-full object-cover"
                      style={{ objectPosition: "52% 43%", transform: "scale(1.55)", transformOrigin: "52% 43%" }}
                      loading="lazy"
                    />
                  </div>
                ) : person.name === "Shane Rubio-Limiac" ? (
                  <div className="h-full w-full overflow-hidden rounded-[inherit]">
                    <img
                      src={person.photo}
                      alt={person.name}
                      className="block h-full w-full object-cover"
                      style={{ objectPosition: "50% 34%", transform: "scale(0.88)", transformOrigin: "50% 34%" }}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <img
                    src={person.photo}
                    alt={person.name}
                    className={`h-full w-full object-cover transition duration-700 ${person.objectPosition}${"extraScale" in person ? ` ${(person as any).extraScale} group-hover:scale-[2.2]` : " group-hover:scale-105"}`}
                    loading="lazy"
                  />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent opacity-100 md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100" />

                {/* Name + role */}
                <div className="absolute inset-x-0 bottom-0 z-10 translate-y-0 p-5 text-white opacity-100 transition-all duration-300 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  <h3 className="text-base font-bold leading-tight text-white">
                    {person.name} <span aria-hidden="true">{person.flag}</span>
                  </h3>
                  <p className="mt-0.5 text-sm font-medium text-white/80">
                    {person.role}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <a
              href="/talent-pool"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Explore our talent network
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* ── 8. GET MATCHED FINAL CTA ── */}
      <section className="relative w-full overflow-hidden bg-[linear-gradient(110deg,#D6D8FF_0%,#C9D8F8_52%,#BCE8F2_100%)] px-6 py-24 sm:px-10 md:py-28 lg:px-16 lg:py-32">
        {/* Background glows */}
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/35 px-5 py-2.5 text-[15px] font-semibold text-[#315FCB] backdrop-blur-sm">
            <Zap className="h-4 w-4" />
            72-hour match average
          </div>

          {/* Headline */}
          <h2 className="mt-8 max-w-[900px] text-[48px] font-semibold leading-[1.02] tracking-[-0.045em] text-[#080B1C] md:text-[62px] lg:text-[72px]">
            Get matched with vetted Philippine talent in 72 hours
          </h2>

          {/* Supporting copy */}
          <p className="mt-6 max-w-[700px] text-[19px] leading-[1.5] text-[#53627A] md:text-[21px]">
            Tell us what you need. We'll line up pre-vetted candidates — no
            markups, no middlemen, no obligation.
          </p>

          {/* Primary CTA */}
          <a
            href="#contact"
            className="mt-10 inline-flex h-[60px] items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(90deg,#6F35E8_0%,#2368E8_100%)] px-8 text-[18px] font-semibold text-white shadow-[0_12px_30px_rgba(62,67,193,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(62,67,193,0.34)]"
          >
            Get matched — it's free
            <ArrowRight className="h-5 w-5" />
          </a>

          {/* Reassurance */}
          <p className="mt-4 text-[14px] text-[#66758A] md:text-[15px]">
            Takes 2 minutes · No credit card · First candidates in days
          </p>

          {/* Stats row */}
          <div className="mt-12 grid w-full max-w-[760px] grid-cols-1 gap-8 border-t border-[#66758A]/20 pt-10 sm:grid-cols-3 sm:gap-12">
            <div>
              <div className="text-[28px] font-semibold text-[#080B1C] md:text-[32px]">
                70%
              </div>
              <div className="mt-1 text-[14px] text-[#58677D] md:text-[15px]">
                cost savings
              </div>
            </div>
            <div>
              <div className="text-[28px] font-semibold text-[#080B1C] md:text-[32px]">
                50+
              </div>
              <div className="mt-1 text-[14px] text-[#58677D] md:text-[15px]">
                countries served
              </div>
            </div>
            <div>
              <div className="text-[28px] font-semibold text-[#080B1C] md:text-[32px]">
                Dedicated
              </div>
              <div className="mt-1 text-[14px] text-[#58677D] md:text-[15px]">
                never shared teams
              </div>
            </div>
          </div>

          {/* Talent link */}
          <p className="mt-10 text-[15px] text-[#56647A]">
            Looking for work instead?{" "}
            <a
              href="/find-best-matches"
              className="font-medium text-[#2C3A52] underline underline-offset-4"
            >
              Join as talent →
            </a>
          </p>
        </div>
      </section>

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
                  OnSpot is the only outsourcing system built for the world
                  that's coming—pairing AI-ready operations with world-class
                  Philippine talent to power global businesses.
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
