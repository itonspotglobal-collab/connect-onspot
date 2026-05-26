import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Post } from '@shared/schema';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import {
  SiX,
  SiThreads,
  SiTiktok,
  SiYoutube,
} from 'react-icons/si';
import { Link } from 'wouter';
import { useVanessa } from '@/contexts/VanessaContext';
import onspotLogo from '@assets/OnSpot Log Full Purple Blue_1757942805752.png';

import FlashLogo from '../assets/logos/Flash.png';
import FutureEVLogo from '../assets/logos/FutureEV.png';
import IPSLogo from '../assets/logos/IPS.png';
import PinetechLogo from '../assets/logos/Pinetech.png';
import SafewayLogo from '../assets/logos/Safeway.png';
import VertexLogo from '../assets/logos/Vertex.png';

const trustedBrands = [
  { name: 'Flash Justice', logo: FlashLogo },
  { name: 'Future Motors EV', logo: FutureEVLogo },
  { name: 'IPS by Meest', logo: IPSLogo },
  { name: 'Pinetech', logo: PinetechLogo },
  { name: 'Safeway Moving', logo: SafewayLogo },
  { name: 'Vertex Education', logo: VertexLogo },
];

const hiringModes = [
  {
    icon: Bot,
    title: 'AI Assistant',
    subtitle: 'Vanessa at your service',
    description:
      'Instant, intelligent automation that never sleeps. Perfect for routine tasks, scheduling, and coordination.',
    features: ['24/7 Availability', 'Instant Responses', 'Smart Automation'],
    gradient: 'from-violet-500/20 to-blue-500/20',
    link: '#',
    cta: 'Launch AI Assistant',
  },
  {
    icon: Zap,
    title: 'Managed Services',
    subtitle: 'Full team, zero hassle',
    description:
      'We build, train, and manage your offshore team. You focus on growth, we handle operations.',
    features: ['Dedicated Team', 'Full Management', 'Quality Assurance'],
    gradient: 'from-blue-500/20 to-cyan-500/20',
    link: '/lead-intake',
    cta: 'Get Managed Team',
  },
  {
    icon: Users,
    title: 'Resourced Services',
    subtitle: 'Elite talent, on-demand',
    description:
      'Handpicked professionals integrated into your workflow. Expert skills when you need them.',
    features: ['Top 5% Talent', 'Flexible Scaling', 'Direct Integration'],
    gradient: 'from-cyan-500/20 to-violet-500/20',
    link: '/hire-talent',
    cta: 'Browse Talent',
  },
];

type CardStyle = {
  transform: string;
  zIndex: number;
  opacity: number;
};

function getCardStyle(offset: number, nearOffset: number, farOffset: number): CardStyle {
  const map: Record<string, CardStyle> = {
    "0":  { transform: `translate(-50%, -50%) translateX(0px) scale(1.16)`,                                           zIndex: 50, opacity: 1    },
    "-1": { transform: `translate(-50%, -50%) translateX(-${nearOffset}px) scale(0.88) rotateY(10deg)`,               zIndex: 30, opacity: 0.72 },
    "1":  { transform: `translate(-50%, -50%) translateX(${nearOffset}px) scale(0.88) rotateY(-10deg)`,               zIndex: 30, opacity: 0.72 },
    "-2": { transform: `translate(-50%, -50%) translateX(-${farOffset}px) scale(0.72) rotateY(16deg)`,                zIndex: 10, opacity: 0.35 },
    "2":  { transform: `translate(-50%, -50%) translateX(${farOffset}px) scale(0.72) rotateY(-16deg)`,                zIndex: 10, opacity: 0.35 },
  };
  return map[String(offset)] ?? { transform: "translate(-50%,-50%) scale(0)", zIndex: 0, opacity: 0 };
}

function TrustedLogos() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Offsets per breakpoint
  const nearOffset = visibleCount === 5 ? 260 : visibleCount === 3 ? 190 : 0;
  const farOffset  = visibleCount === 5 ? 470 : visibleCount === 3 ? 340 : 0;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % trustedBrands.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + trustedBrands.length) % trustedBrands.length);
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000);
  }, []);

  const handleArrow = useCallback((dir: "prev" | "next") => {
    if (dir === "next") nextSlide(); else prevSlide();
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000);
  }, [nextSlide, prevSlide]);

  // Resize → update visibleCount
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640)  setVisibleCount(1);
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, nextSlide]);

  // Compute visible slots
  const visibleOffsets: number[] =
    visibleCount === 5 ? [-2, -1, 0, 1, 2] :
    visibleCount === 3 ? [-1, 0, 1] :
    [0];

  const visibleItems = visibleOffsets.map((offset) => {
    const index = (currentIndex + offset + trustedBrands.length) % trustedBrands.length;
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

      {/* ── 2b. FEATURED INSIGHTS ── */}
      {featuredPosts.length > 0 && (
        <div className="relative bg-slate-50 py-20 sm:py-28">
          <div className="container mx-auto px-4 sm:px-6">
            {/* Section header */}
            <div className="mb-10 sm:mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
                Latest Insights
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-slate-900">
                Featured insights from OnSpot.
              </h2>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main featured card — spans 2 cols on desktop */}
              {featuredPosts[0] && (() => {
                const post = featuredPosts[0];
                const dateStr = post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null;
                return (
                  <a
                    href={`/insights/${post.slug}`}
                    className="group relative col-span-1 lg:col-span-2 block overflow-hidden rounded-3xl shadow-md hover:shadow-2xl transition-shadow duration-500"
                  >
                    {/* Image or gradient placeholder */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700">
                      {post.coverImageUrl && (
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      {/* Dark wash overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/10" />
                    </div>

                    {/* Content overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                      <span className="inline-flex rounded-full bg-indigo-500/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        {post.category || "Industry Insights"}
                      </span>
                      <h3 className="mt-4 text-xl sm:text-2xl lg:text-3xl font-bold leading-tight text-white line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="mt-3 text-sm sm:text-base leading-relaxed text-white/75 line-clamp-2">
                        {post.excerpt}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-white/60">
                        {post.author && <span>{post.author}</span>}
                        {dateStr && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dateStr}
                          </span>
                        )}
                        {post.readTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.readTime}
                          </span>
                        )}
                        {(post.views ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {post.views?.toLocaleString()} views
                          </span>
                        )}
                      </div>
                      <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:text-white/80 transition-colors">
                        Read Article
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </div>
                  </a>
                );
              })()}

              {/* Side cards — stack vertically */}
              <div className="col-span-1 flex flex-col gap-6">
                {featuredPosts.slice(1, 3).map((post) => {
                  const dateStr = post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : null;
                  return (
                    <a
                      key={post.id}
                      href={`/insights/${post.slug}`}
                      className="group relative flex-1 block overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-500 min-h-[200px]"
                    >
                      {/* Image or gradient placeholder */}
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-blue-700 to-cyan-700">
                        {post.coverImageUrl && (
                          <img
                            src={post.coverImageUrl}
                            alt={post.title}
                            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/10" />
                      </div>

                      {/* Content */}
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <span className="inline-flex rounded-full bg-indigo-500/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                          {post.category || "Insights"}
                        </span>
                        <h4 className="mt-2.5 text-base font-bold leading-snug text-white line-clamp-2">
                          {post.title}
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/60">
                          {post.author && <span>{post.author}</span>}
                          {dateStr && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {dateStr}
                            </span>
                          )}
                          {post.readTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {post.readTime}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
                          Read Article
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* View all link */}
            <div className="mt-10 text-center">
              <a
                href="/insights"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md"
              >
                View all insights
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

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

          <div className="mx-auto mt-12 grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Card 1: For Companies */}
            <div className="rounded-3xl border border-indigo-400/70 bg-indigo-50/60 p-8 sm:p-10 shadow-sm backdrop-blur-md flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
                For companies
              </p>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">
                Hire faster. Spend less.
              </h3>

              <div className="mt-8 flex flex-col gap-7 flex-1">
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Days, not months</p>
                    <p className="mt-1 text-sm text-slate-600">72-hour match average</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                    <SlidersHorizontal className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Hire your way</p>
                    <p className="mt-1 text-sm text-slate-600">Contract, project, full-time</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Skip the middlemen</p>
                    <p className="mt-1 text-sm text-slate-600">Direct, no markups</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                    <Globe className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">50+ countries</p>
                    <p className="mt-1 text-sm text-slate-600">Global reach, local expertise</p>
                  </div>
                </div>
              </div>

              <a
                href="/hire-talent"
                className="mt-10 flex w-full items-center justify-center rounded-full border border-indigo-500 px-6 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-500 hover:text-white"
              >
                Find the right talent →
              </a>
            </div>

            {/* Card 2: For Professionals */}
            <div className="rounded-3xl border border-teal-600/60 bg-teal-50/60 p-8 sm:p-10 shadow-sm backdrop-blur-md flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                For professionals
              </p>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">
                Real work. Real growth.
              </h3>

              <div className="mt-8 flex flex-col gap-7 flex-1">
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Steady pipeline</p>
                    <p className="mt-1 text-sm text-slate-600">No gaps, no chasing</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                    <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Top global brands</p>
                    <p className="mt-1 text-sm text-slate-600">Builds your reputation</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Your terms</p>
                    <p className="mt-1 text-sm text-slate-600">Remote, your schedule</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Pure merit</p>
                    <p className="mt-1 text-sm text-slate-600">No gatekeepers, no politics</p>
                  </div>
                </div>
              </div>

              <a
                href="/find-best-matches"
                className="mt-10 flex w-full items-center justify-center rounded-full border border-teal-600 px-6 py-3 text-sm font-semibold text-teal-700 transition hover:bg-teal-600 hover:text-white"
              >
                Find your next opportunity →
              </a>
            </div>
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
