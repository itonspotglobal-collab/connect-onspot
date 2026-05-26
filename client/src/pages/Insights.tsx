import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Calendar,
  Clock,
  Eye,
  Globe,
  TrendingUp,
  ExternalLink,
  Rss,
  ArrowRight,
  BookOpen,
  Linkedin,
  Youtube,
  Search,
  PlayCircle,
  Mic,
  Users,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  X,
  Target,
  Zap,
  Award,
  PenLine,
  Menu,
  Layers,
} from "lucide-react";
import type { Post } from "@shared/schema";
import onspotLogo from "@assets/onspot-logo-new.png";
import { useReserveBottomRight } from "@/hooks/useReserveBottomRight";

// ─── Shared Case Studies data (sourced from WhyOnSpot Success Stories) ───────
const CASE_STUDIES = [
  {
    company: "TechFlow Solutions",
    industry: "Software Development",
    logo: "TS",
    challenge:
      "Overwhelmed by customer support while trying to scale development",
    solution:
      "Deployed 12 customer support specialists and 3 technical support engineers",
    results: [
      {
        metric: "Response Time",
        value: "87%",
        description: "faster response times",
      },
      {
        metric: "Customer Satisfaction",
        value: "94%",
        description: "CSAT score achieved",
      },
      {
        metric: "Cost Savings",
        value: "65%",
        description: "reduction in support costs",
      },
      {
        metric: "Team Growth",
        value: "3x",
        description: "development team scaling",
      },
    ],
    testimonial:
      "OnSpot didn't just solve our support bottleneck — they freed our entire team to focus on what we do best: building amazing software.",
    clientName: "Sarah Chen",
    clientTitle: "CTO",
    timeframe: "6 months",
    teamSize: "15 people",
    model: "Managed Services",
  },
  {
    company: "GlobalTrade Logistics",
    industry: "Logistics & Supply Chain",
    logo: "GL",
    challenge:
      "Manual processes causing delays and errors in shipment tracking",
    solution:
      "Built dedicated operations team with process automation specialists",
    results: [
      {
        metric: "Processing Speed",
        value: "78%",
        description: "faster order processing",
      },
      {
        metric: "Error Rate",
        value: "95%",
        description: "reduction in errors",
      },
      {
        metric: "Cost Efficiency",
        value: "72%",
        description: "operational cost savings",
      },
      {
        metric: "Customer Retention",
        value: "8.5x",
        description: "growth in repeat customers",
      },
    ],
    testimonial:
      "The transformation was incredible. What used to take our team days now happens in hours, with perfect accuracy.",
    clientName: "Marcus Rodriguez",
    clientTitle: "Operations Director",
    timeframe: "4 months",
    teamSize: "22 people",
    model: "Enterprise Services",
  },
  {
    company: "HealthFirst Medical",
    industry: "Healthcare Services",
    logo: "HM",
    challenge: "Administrative burden preventing focus on patient care",
    solution:
      "Deployed specialized medical administration and billing support team",
    results: [
      {
        metric: "Admin Time",
        value: "83%",
        description: "reduction in admin overhead",
      },
      {
        metric: "Revenue Cycle",
        value: "45%",
        description: "faster billing processing",
      },
      {
        metric: "Patient Satisfaction",
        value: "91%",
        description: "satisfaction rating",
      },
      {
        metric: "Staff Efficiency",
        value: "6.2x",
        description: "improvement in productivity",
      },
    ],
    testimonial:
      "OnSpot gave us back what matters most — time with our patients. Our doctors can finally focus on healing instead of paperwork.",
    clientName: "Dr. Jennifer Park",
    clientTitle: "Chief Medical Officer",
    timeframe: "8 months",
    teamSize: "18 people",
    model: "Managed Services",
  },
];

// ─── Navigation categories ────────────────────────────────────────────────────
const NAV_CATEGORIES = [
  { id: "CEO Insights", label: "CEO Insights", icon: Rss },
  { id: "Talent Insights", label: "Talent Insights", icon: User },
  { id: "Client Insights", label: "Client Insights", icon: Briefcase },
  { id: "Industry Insights", label: "Industry Insights", icon: Globe },
  { id: "Learning Centre", label: "Learning Centre", icon: BookOpen },
  { id: "Podcast Videos", label: "Podcast Videos", icon: Mic },
] as const;

// "View All" is still a valid state but has no tab; it is the default
type NavCategoryId = (typeof NAV_CATEGORIES)[number]["id"] | "View All";

// ─── Cover image fallbacks by category ────────────────────────────────────────
const COVER_IMAGES: Record<string, string> = {
  "CEO Insights":
    "https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=800&h=450&fit=crop",
  "Talent Insights":
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Client Insights":
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=450&fit=crop",
  "Industry Insights":
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Learning Centre":
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop",
  "Podcast Videos":
    "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=450&fit=crop",
  "Global Outsourcing":
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop",
  Technology:
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Customer Service":
    "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=800&h=450&fit=crop",
  "Industry Trends":
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Process Optimization":
    "https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=450&fit=crop",
};
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop";

// ─── Legacy category normalisation ────────────────────────────────────────────
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Global Outsourcing": "Industry Insights",
  "Industry Trends": "Industry Insights",
  Technology: "Industry Insights",
  "Customer Service": "Client Insights",
  "Process Optimization": "Learning Centre",
};

function normalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  return LEGACY_CATEGORY_MAP[trimmed] ?? trimmed;
}

// ─── Content channels ─────────────────────────────────────────────────────────
const contentChannels = [
  {
    icon: Linkedin,
    color: "bg-blue-600",
    title: "LinkedIn Articles",
    description:
      "Follow our LinkedIn page for daily outsourcing insights, leadership tips, and industry news from our expert team.",
    link: "https://www.linkedin.com/company/onspotglobal",
    buttonText: "Follow on LinkedIn",
  },
  {
    icon: Youtube,
    color: "bg-red-600",
    title: "YouTube Channel",
    description:
      "Watch in-depth tutorials, case studies, and thought leadership videos on outsourcing best practices.",
    link: "https://youtube.com/@onspotglobal",
    buttonText: "Watch on YouTube",
  },
  {
    icon: BookOpen,
    color: "bg-purple-600",
    title: "Free Resources",
    description:
      "Download our free guides, templates, and whitepapers to accelerate your outsourcing journey.",
    link: "/resources",
    buttonText: "Browse Resources",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(date: string | Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPodcast(category: string): boolean {
  return (
    category === "Podcast Videos" || category.toLowerCase().includes("podcast")
  );
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ArticleItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
  views: number;
  likes: number;
  featured: boolean;
  isEpisode: boolean;
};

function postToArticle(post: Post): ArticleItem {
  const category = normalizeCategory(post.category);
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    author: post.author || "OnSpot Team",
    date: formatDate(post.publishedAt || post.createdAt),
    readTime: post.readTime || "5 min read",
    category,
    image:
      post.coverImageUrl ||
      COVER_IMAGES[category] ||
      COVER_IMAGES[post.category] ||
      FALLBACK_IMAGE,
    views: post.views || 0,
    likes: post.likes || 0,
    featured: post.isFeatured ?? false,
    isEpisode: isPodcast(category),
  };
}

// ─── ArticleCard ──────────────────────────────────────────────────────────────
function ArticleCard({ article }: { article: ArticleItem }) {
  const [, navigate] = useLocation();
  const authorHref = `/insights?author=${encodeURIComponent(article.author)}`;
  const initials = getInitials(article.author);

  return (
    <Card
      className="overflow-hidden transition-all duration-300 group flex flex-col cursor-pointer h-full bg-white border-slate-200/80 hover-elevate"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <div className="aspect-video bg-slate-100 relative overflow-hidden flex-shrink-0">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          width={800}
          height={450}
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between">
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-wider bg-white/20 text-white border-white/30 backdrop-blur-sm"
          >
            {article.category}
          </Badge>
          {article.featured && (
            <Badge className="text-[10px] bg-amber-400 text-black border-0">
              Featured
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-5 flex flex-col flex-1 gap-3">
        <h4 className="text-base font-bold leading-snug line-clamp-2 text-slate-900 group-hover:text-[#474ead] transition-colors">
          {article.title}
        </h4>

        <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed flex-1">
          {article.excerpt ||
            "Read the full article for insights and analysis."}
        </p>

        <div className="border-t border-slate-200 pt-3 mt-auto">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <a
              href={authorHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 group/author min-w-0"
              title={`Articles by ${article.author}`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#474ead]/15 text-[#474ead] text-[10px] font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="text-xs font-semibold text-slate-600 group-hover/author:text-[#474ead] transition-colors truncate underline-offset-2 group-hover/author:underline">
                {article.author}
              </span>
            </a>

            <span className="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {article.date}
            </span>
            {article.views > 0 && (
              <span className="flex items-center gap-1 ml-auto">
                <Eye className="w-3 h-3" />
                {article.views.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PodcastCard ──────────────────────────────────────────────────────────────
function PodcastCard({ article }: { article: ArticleItem }) {
  const [, navigate] = useLocation();
  const authorHref = `/insights?author=${encodeURIComponent(article.author)}`;
  const initials = getInitials(article.author);

  return (
    <Card
      className="overflow-hidden transition-all duration-300 group cursor-pointer bg-white border-slate-200/80 hover-elevate"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="aspect-video sm:aspect-auto sm:w-44 sm:min-h-[120px] flex-shrink-0 bg-slate-100 relative overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            width={176}
            height={120}
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/40">
              <PlayCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <CardContent className="p-4 flex flex-col flex-1 gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wider self-start bg-slate-100 text-slate-600 border-slate-200"
            >
              Podcast
            </Badge>
            {article.featured && (
              <Badge className="text-[10px] bg-amber-400 text-black border-0">
                Featured
              </Badge>
            )}
          </div>

          <h4 className="text-sm font-bold line-clamp-2 text-slate-900 group-hover:text-[#474ead] transition-colors leading-snug">
            {article.title}
          </h4>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1">
            {article.excerpt ||
              "Listen to this episode for expert conversations."}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-slate-200">
            <a
              href={authorHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 group/author"
              title={`Episodes by ${article.author}`}
            >
              <span className="w-5 h-5 rounded-full bg-[#474ead]/15 text-[#474ead] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="text-xs font-semibold text-slate-600 group-hover/author:text-[#474ead] transition-colors underline-offset-2 group-hover/author:underline">
                {article.author}
              </span>
            </a>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {article.date}
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// ─── ArticleCardSkeleton ───────────────────────────────────────────────────────
function ArticleCardSkeleton() {
  return (
    <Card className="overflow-hidden flex flex-col bg-white border-slate-200">
      <Skeleton className="aspect-video bg-slate-200" />
      <CardContent className="p-5 flex flex-col gap-3">
        <Skeleton className="h-5 w-full bg-slate-200" />
        <Skeleton className="h-4 w-full bg-slate-200" />
        <Skeleton className="h-4 w-3/4 bg-slate-200" />
        <div className="border-t border-slate-200 pt-3 mt-1 flex items-center justify-between">
          <Skeleton className="h-5 w-28 bg-slate-200" />
          <Skeleton className="h-4 w-16 bg-slate-200" />
        </div>
        <Skeleton className="h-3 w-24 mt-0.5 bg-slate-200" />
      </CardContent>
    </Card>
  );
}

// ─── FeaturedCarousel ─────────────────────────────────────────────────────────
function FeaturedCarousel({ articles }: { articles: ArticleItem[] }) {
  const [, navigate] = useLocation();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = articles.length;

  const goTo = (idx: number) => setActive(((idx % total) + total) % total);

  useEffect(() => {
    if (total <= 1 || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % total);
    }, 5500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, total, active]);

  if (total === 0) return null;

  const art = articles[active];

  return (
    <>
      <style>{`
        @keyframes carousel-bar { from { width: 0% } to { width: 100% } }
        .carousel-bar { animation: carousel-bar 5.5s linear forwards; }
      `}</style>

      {/* ── Full-bleed Netflix-style hero ──────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden group select-none"
        style={{ minHeight: "clamp(520px, 62vw, 700px)" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        role="region"
        aria-label="Featured articles carousel"
      >
        {/* Background image slides — full section fill */}
        {articles.map((a, i) => (
          <div
            key={a.id}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === active ? 1 : 0, zIndex: 0 }}
            aria-hidden={i !== active}
          >
            <img
              src={a.image}
              alt=""
              className="w-full h-full object-cover object-center"
              style={{
                transform: i === active ? "scale(1)" : "scale(1.05)",
                transition: "transform 8s ease-out",
              }}
              draggable={false}
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
              }}
            />
          </div>
        ))}

        {/* Cinematic overlays */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/92 via-black/45 to-black/15 pointer-events-none" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-black/75 via-black/25 to-transparent pointer-events-none" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/30 via-transparent to-transparent pointer-events-none" />

        {/* ── Content ───────────────────────────────────────────────────── */}
        <div
          className="relative z-[2] flex flex-col justify-end h-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12"
          style={{
            paddingBottom: "clamp(28px, 3vw, 44px)",
            minHeight: "inherit",
          }}
        >
          {/* Eyebrow label */}
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-white/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/50">
              Featured Stories
            </span>
          </div>

          {/* Category + Featured badges */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold px-3 py-1 rounded-full bg-[#474ead] text-white">
              {art.category}
            </span>
            {art.featured && (
              <span className="text-[10px] uppercase tracking-[0.22em] font-semibold px-3 py-1 rounded-full bg-amber-400 text-black">
                Featured
              </span>
            )}
          </div>

          {/* Title */}
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight max-w-3xl mb-3 tracking-tight cursor-pointer"
            onClick={() => navigate(`/insights/${art.slug}`)}
          >
            {art.title}
          </h2>

          {/* Excerpt */}
          {art.excerpt && (
            <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-2xl mb-4 line-clamp-2">
              {art.excerpt}
            </p>
          )}

          {/* Meta row + CTA */}
          <div className="flex items-center gap-5 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-6 h-6 rounded-full bg-white/15 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 border border-white/20">
                {getInitials(art.author)}
              </span>
              <span className="text-white/80 font-medium">{art.author}</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Calendar className="w-3 h-3" />
              {art.date}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              {art.readTime}
            </span>
            {art.views > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Eye className="w-3 h-3" />
                {art.views.toLocaleString()}
              </span>
            )}

            {/* CTA button */}
            <button
              onClick={() => navigate(`/insights/${art.slug}`)}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 transition-all duration-200 shadow-lg"
            >
              Read Article
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* ── Prev / Next arrows ─────────────────────────────────────────── */}
        {total > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(active - 1);
              }}
              className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
              aria-label="Previous article"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(active + 1);
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
              aria-label="Next article"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* ── Slide indicators ───────────────────────────────────────────── */}
        {total > 1 && (
          <div className="absolute bottom-6 right-8 sm:right-12 z-20 flex items-center gap-2">
            {articles.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={`rounded-full transition-all duration-300 ${
                  i === active
                    ? "w-6 h-2 bg-white"
                    : "w-2 h-2 bg-white/35 hover:bg-white/65"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* ── Progress bar ───────────────────────────────────────────────── */}
        {total > 1 && !paused && (
          <div className="absolute bottom-0 left-0 right-0 z-20 h-[2px] bg-white/10">
            <div
              key={`${active}-progress`}
              className="h-full bg-white/60 carousel-bar"
            />
          </div>
        )}
      </div>
    </>
  );
}

// ─── CategoryNav ──────────────────────────────────────────────────────────────
function CategoryNav({
  selected,
  onSelect,
  searchQuery,
  onSearchChange,
  authorFilter,
  onClearAuthor,
}: {
  selected: NavCategoryId;
  onSelect: (id: NavCategoryId) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  authorFilter: string;
  onClearAuthor: () => void;
}) {
  const [, navigate] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Auto-open the search row if a query or author filter is already active
  useEffect(() => {
    if (searchQuery || authorFilter) setSearchOpen(true);
  }, []);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen)
        setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

  function toggleSearch() {
    const next = !searchOpen;
    setSearchOpen(next);
    if (next) {
      setTimeout(() => navInputRef.current?.focus(), 50);
    } else {
      onSearchChange("");
    }
  }

  // Opens the mobile panel and focuses the search input inside it
  function handleMobileSearchTap() {
    setIsMobileMenuOpen(true);
    setTimeout(() => mobileSearchRef.current?.focus(), 160);
  }

  const hasActiveSearch = !!searchQuery || !!authorFilter;

  return (
    <>
      {/* ── Mobile menu scrim — fixed, covers the whole page ──────────── */}
      {isMobileMenuOpen && (
        <div
          className="menu-scrim md:hidden"
          style={{ zIndex: 49 }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sticky nav bar ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* ── Primary nav row ───────────────────────────────────────── */}
          <div className="flex items-center h-[56px]">
            {/* ── MOBILE LEFT: Search icon tap → opens panel + focuses search ── */}
            <button
              onClick={handleMobileSearchTap}
              className="md:hidden flex items-center justify-center rounded-lg transition-colors text-white hover:bg-white/10 flex-shrink-0 relative"
              style={{ width: 44, height: 44, marginRight: 4 }}
              aria-label="Search articles"
            >
              <Search className="h-5 w-5" />
              {/* Dot indicator when a search/author filter is active */}
              {hasActiveSearch && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            {/* Logo */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center flex-shrink-0"
              aria-label="Go to OnSpot homepage"
            >
              <img
                src={onspotLogo}
                alt="OnSpot"
                className="h-7 w-auto object-contain drop-shadow-sm"
              />
            </button>

            {/* Divider — desktop only */}
            <div className="hidden md:block w-px h-5 bg-white/20 flex-shrink-0 mx-3" />

            {/* Category tabs — desktop only */}
            <div className="hidden md:flex items-center overflow-x-auto scrollbar-hide flex-1 gap-0 -mb-px">
              {NAV_CATEGORIES.map(({ id, label, icon: Icon }) => {
                const active = selected === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
                    className={`flex items-center gap-2 px-4 h-[56px] text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 flex-shrink-0 ${
                      active
                        ? "border-white text-white"
                        : "border-transparent text-white/70 hover:text-white hover:border-white/40"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Spacer — pushes right-side controls to the far end (mobile: grows; desktop: tabs container already grows) */}
            <div className="flex-1 md:hidden" />

            {/* Desktop search toggle — hidden on mobile */}
            <div className="hidden md:flex items-center flex-shrink-0 pl-2 ml-1 border-l border-white/20">
              <button
                onClick={toggleSearch}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                  searchOpen || hasActiveSearch
                    ? "text-white bg-white/15"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
                aria-label={searchOpen ? "Close search" : "Open search"}
              >
                {searchOpen ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {searchOpen ? "Close" : "Search"}
                </span>
                {hasActiveSearch && !searchOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
                )}
              </button>
            </div>

            {/* ── MOBILE RIGHT: Profile / account button ─────────────────── */}
            <button
              onClick={() => navigate("/")}
              className="md:hidden flex items-center justify-center rounded-lg transition-colors text-white hover:bg-white/10 flex-shrink-0"
              style={{ width: 44, height: 44 }}
              aria-label="Go to account"
            >
              <User className="h-5 w-5" />
            </button>

            {/* ── MOBILE RIGHT: Hamburger — opens/closes the nav drawer ──── */}
            <button
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="md:hidden flex items-center justify-center rounded-lg transition-colors text-white hover:bg-white/10 flex-shrink-0"
              style={{ width: 44, height: 44, marginLeft: 2 }}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* ── Desktop expandable search row ─────────────────────────── */}
          {searchOpen && (
            <div className="hidden md:flex pb-3 pt-1 flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                <input
                  ref={navInputRef}
                  type="text"
                  placeholder="Search by title, excerpt, author, or category…"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-white/20 bg-white/10 text-sm text-white focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 placeholder:text-white/40 transition backdrop-blur-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {authorFilter && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 text-white text-xs px-3 py-1.5 font-medium">
                    <Users className="w-3 h-3" />
                    Articles by {authorFilter}
                    <button
                      onClick={onClearAuthor}
                      className="ml-0.5 hover:text-white/60 transition-colors"
                      aria-label="Clear author filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Mobile menu panel — anchored below the sticky nav bar ───── */}
        {/*   Uses absolute + top:100% so it always positions correctly    */}
        {/*   regardless of the nav bar's actual rendered height.          */}
        <div
          className={`md:hidden absolute left-0 right-0 overflow-y-auto transition-all ${
            isMobileMenuOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          style={{
            top: "100%",
            zIndex: 50,
            transform: isMobileMenuOpen
              ? "translateY(0) scale(1)"
              : "translateY(6px) scale(0.98)",
            background: "rgba(44, 48, 114, 0.86)",
            backdropFilter: "blur(10px) saturate(110%)",
            WebkitBackdropFilter: "blur(10px) saturate(110%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.2)",
            maxHeight: "calc(100vh - 56px)",
            transitionDuration: isMobileMenuOpen ? "160ms" : "150ms",
            transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
            animation: isMobileMenuOpen
              ? "menuBreathe 4s ease-in-out 1s infinite"
              : "none",
          }}
        >
          <div className="px-4 py-6 space-y-1">
            {/* View All */}
            <button
              onClick={() => {
                onSelect("View All");
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-menu-link w-full text-left py-4 text-white font-semibold flex items-center gap-3 ${
                selected === "View All" ? "nav-glow-active" : ""
              }`}
              data-testid="mobile-insights-view-all"
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              View All
            </button>

            <div className="h-px bg-white/10" />

            {/* Category items */}
            {NAV_CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  onSelect(id);
                  setIsMobileMenuOpen(false);
                }}
                className={`mobile-menu-link w-full text-left py-4 text-white font-semibold flex items-center gap-3 ${
                  selected === id ? "nav-glow-active" : ""
                }`}
                data-testid={`mobile-insights-${id}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}

            {/* Search inside the mobile panel */}
            <div className="pt-4 mt-2 border-t border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  placeholder="Search articles…"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-white/20 bg-white/10 text-sm text-white focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 placeholder:text-white/40 transition backdrop-blur-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {authorFilter && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 text-white text-xs px-3 py-1.5 font-medium">
                    <Users className="w-3 h-3" />
                    Articles by {authorFilter}
                    <button
                      onClick={onClearAuthor}
                      className="ml-0.5 hover:text-white/60 transition-colors"
                      aria-label="Clear author filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SectionHeading ───────────────────────────────────────────────────────────
function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#474ead]" />
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-slate-500 max-w-md">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────  �───────────────────────────────────
function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-400">
      <Icon className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── HighlightCard ────────────────────────────────────────────────────────────
function HighlightCard({ article }: { article: ArticleItem }) {
  const [, navigate] = useLocation();
  return (
    <div
      className="relative overflow-hidden rounded-2xl cursor-pointer group h-full"
      style={{ minHeight: "460px" }}
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <img
        src={article.image}
        alt={article.title}
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        onError={(e) => {
          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
        }}
      />
      {/* Bottom vignette — darkens just the lower strip so the panel reads clearly */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent" />
      {/* Frosted-glass text panel — flush to the bottom edge, clipped by card's overflow-hidden */}
      <div className="absolute bottom-0 left-0 right-0">
        <div
          className="rounded-t-xl w-full"
          style={{
            background: "rgba(12, 18, 52, 0.45)",
            backdropFilter: "blur(22px) saturate(140%)",
            WebkitBackdropFilter: "blur(22px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderBottom: "none",
            boxShadow:
              "0 -4px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.10)",
            padding: "clamp(14px, 2vw, 22px) clamp(16px, 3vw, 28px)",
          }}
        >
          <span className="inline-flex self-start mb-2.5 text-[10px] uppercase tracking-[0.22em] font-semibold px-3 py-1 rounded-full bg-[#474ead] text-white">
            {article.category}
          </span>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight mb-2.5 tracking-tight">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-white/75 text-sm leading-relaxed mb-3 line-clamp-2">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 flex-wrap mb-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-6 h-6 rounded-full bg-white/15 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 border border-white/20">
                {getInitials(article.author)}
              </span>
              <span className="text-white/85 font-medium">
                {article.author}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-white/55">
              <Calendar className="w-3 h-3" /> {article.date}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/55">
              <Clock className="w-3 h-3" /> {article.readTime}
            </span>
            {article.views > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/55">
                <Eye className="w-3 h-3" /> {article.views.toLocaleString()}
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-[#7b82f0] transition-colors duration-200">
            Read Article{" "}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PanelArticleCard ─────────────────────────────────────────────────────────
function PanelArticleCard({ article }: { article: ArticleItem }) {
  const [, navigate] = useLocation();
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer group hover-elevate flex-shrink-0"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
        <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full bg-[#474ead] text-white">
          {article.category}
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-base font-bold text-slate-900 leading-tight mb-2 line-clamp-2">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {article.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {article.readTime}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── CaseStudyTeaser — pulls from shared CASE_STUDIES data ───────────────────
function CaseStudyTeaser() {
  const study = CASE_STUDIES[0]; // First featured case study
  return (
    <div
      className="flex-1 bg-gradient-to-br from-[#474ead]/10 via-white to-[#f0f4ff] border border-[#474ead]/20 rounded-2xl overflow-hidden flex flex-col"
      style={{ minHeight: "160px" }}
    >
      {/* Header strip */}
      <div className="bg-[#474ead] px-5 py-3 flex items-center gap-2">
        <Award className="w-4 h-4 text-white/80 flex-shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
          Case Study
        </span>
        <span className="ml-auto text-[10px] text-white/60">{study.model}</span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-[#474ead] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {study.logo}
            </span>
            <span className="text-sm font-bold text-slate-900">
              {study.company}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {study.challenge}
          </p>
        </div>

        {/* Top 2 result metrics */}
        <div className="grid grid-cols-2 gap-2">
          {study.results.slice(0, 2).map((r) => (
            <div
              key={r.metric}
              className="bg-white rounded-lg p-2.5 border border-slate-100 text-center"
            >
              <div className="text-lg font-bold text-[#474ead]">{r.value}</div>
              <div className="text-[10px] text-slate-500 leading-tight">
                {r.description}
              </div>
            </div>
          ))}
        </div>

        {/* Quote snippet */}
        <p className="text-xs text-slate-600 italic leading-relaxed line-clamp-2 border-l-2 border-[#474ead]/30 pl-2">
          "{study.testimonial}"
        </p>

        <a
          href="/why-onspot/case-studies"
          className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#474ead] hover:text-[#5b63d6] transition-colors"
        >
          View all success stories <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ─── EditorialSection ─────────────────────────────────────────────────────────
function EditorialSection({
  articles,
  episodes,
  isLoading,
  searchActive,
}: {
  articles: ArticleItem[];
  episodes: ArticleItem[];
  isLoading: boolean;
  searchActive: boolean;
}) {
  const GRID_LIMIT = 6;
  const [showAll, setShowAll] = useState(false);

  const highlightArticle = articles[0];
  const panelArticle = articles[1];
  const gridArticles = showAll
    ? articles.slice(2)
    : articles.slice(2, 2 + GRID_LIMIT);
  const hasMore = !showAll && articles.length > 2 + GRID_LIMIT;

  if (searchActive) {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Search results
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {articles.length} article{articles.length !== 1 ? "s" : ""} found
          </p>
        </div>
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Search} message="No articles match your search." />
        )}
        {episodes.length > 0 && (
          <section className="mb-14">
            <SectionHeading icon={Mic} title="Podcast Episodes" />
            <div className="space-y-4">
              {episodes.map((e) => (
                <PodcastCard key={e.id} article={e} />
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-8 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#474ead] mb-2">
          All Insights
        </p>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            Explore Insights.
          </h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed hidden sm:block">
            Deep dives, expert analysis, and industry perspectives — curated by
            the OnSpot team.
          </p>
        </div>
        <div className="mt-6 h-px bg-gradient-to-r from-[#474ead]/30 via-slate-200 to-transparent" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-10">
          <Skeleton
            className="rounded-2xl bg-slate-200"
            style={{ minHeight: "460px" }}
          />
          <div className="flex flex-col gap-5">
            <Skeleton className="rounded-2xl bg-slate-200 h-[268px]" />
            <Skeleton
              className="rounded-2xl bg-slate-200 flex-1"
              style={{ minHeight: "164px" }}
            />
          </div>
        </div>
      ) : highlightArticle ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-10">
          <HighlightCard article={highlightArticle} />
          <div className="flex flex-col gap-5">
            {panelArticle && <PanelArticleCard article={panelArticle} />}
            <CaseStudyTeaser />
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      ) : gridArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {gridArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : null}

      {hasMore && (
        <div className="flex justify-center mb-12">
          <button
            onClick={() => setShowAll(true)}
            className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
          >
            View all {articles.length} insights{" "}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {episodes.length > 0 && (
        <section className="mb-14">
          <SectionHeading
            icon={Mic}
            title="Podcast Episodes"
            subtitle="Conversations with outsourcing leaders, HR experts, and industry innovators."
          />
          <div className="space-y-4">
            {episodes.map((episode) => (
              <PodcastCard key={episode.id} article={episode} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ─── InsightsCTA — page-level conversion section ──────────────────────────────
const INSIGHTS_CTA_CARDS = [
  {
    title: "Hire Talent",
    copy: "Find high-performance talent matched to your needs.",
    href: "/services/resourced",
  },
  {
    title: "Managed Services",
    copy: "Deploy an operator-led delivery system with AI support.",
    href: "/services/managed",
  },
  {
    title: "Find Work",
    copy: "Discover serious opportunities faster.",
    href: "/find-work",
  },
] as const;

function InsightsCTA() {
  return (
    <section className="mb-10">
      <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 md:px-12 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-10 items-start">
          <div className="max-w-lg">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#474ead] mb-4">
              Editorial CTA
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-5">
              Turn insights into an operating advantage.
            </h2>
            <p className="text-slate-600 text-base leading-8">
              Readers who are ready to move from ideas into execution should be
              able to transition naturally into your hire talent, managed
              services, or find work journeys.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {INSIGHTS_CTA_CARDS.map(({ title, copy, href }) => (
              <a
                key={title}
                href={href}
                className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 transition-all duration-200 hover:border-[#474ead]/40 hover:bg-white"
              >
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">
                    {title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-5">{copy}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#474ead] group-hover:text-[#5b63d6] transition-colors">
                  Explore <ArrowRight className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── WeeklyNotesModal ─────────────────────────────────────────────────────────
function WeeklyNotesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close on Escape for accessibility
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            key="ceo-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[3px]"
            aria-hidden="true"
          />

          {/* Panel — slides up from bottom on mobile, springs from centre on desktop */}
          <motion.div
            key="ceo-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Weekly Notes from our CEO"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.97 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative z-10 w-full sm:max-w-[440px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl shadow-slate-900/20 overflow-hidden"
          >
            {/* Top accent line */}
            <div className="h-[3px] w-full bg-gradient-to-r from-[#2e3494] via-[#474ead] to-[#8b91f0]" />

            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-200" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#474ead]"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Content */}
            <div className="px-7 pb-8 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
              {/* Eyebrow row */}
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10">
                  <PenLine className="h-4 w-4 text-[#474ead]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#474ead]">
                    From the Desk of
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    Nur Laminero — CEO, OnSpot
                  </p>
                </div>
              </div>

              {/* Headline */}
              <h2 className="mb-3 text-[1.6rem] font-bold leading-[1.2] tracking-tight text-slate-900">
                Weekly Notes
              </h2>

              {/* Description */}
              <p className="mb-5 text-sm leading-relaxed text-slate-500">
                Raw, candid perspectives on outsourcing, growth, and the future
                of remote work — written weekly by our CEO, straight from the
                front lines.
              </p>

              {/* Divider */}
              <div className="mb-5 h-px w-full bg-slate-100" />

              {/* Value bullets */}
              <div className="mb-7 space-y-3">
                {[
                  "Behind-the-scenes thinking on how OnSpot operates",
                  "Candid views on BPO, hiring, and remote-first culture",
                  "Short, readable, and published every week",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#474ead]/50" />
                    <span className="text-sm leading-relaxed text-slate-600">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <a
                href="https://www.linkedin.com/company/onspotglobal"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#474ead] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#474ead]/25 transition-colors hover:bg-[#5b63d6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#474ead] focus-visible:ring-offset-2"
              >
                <Linkedin className="h-4 w-4" />
                Read Weekly Notes
              </a>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const CEO_POPUP_DISMISSED_KEY = "onspot_ceo_popup_dismissed";

// ─── Main component ───────────────────────────────────────────────────────────
export default function Insights() {
  // Reserve the bottom-right corner so Vanessa's launcher shifts upward
  // whenever the CEO Weekly Notes pill is (or could be) visible.
  useReserveBottomRight();

  const [location] = useLocation();
  const [selectedCategory, setSelectedCategory] =
    useState<NavCategoryId>("View All");
  const [searchQuery, setSearchQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [ceoModalOpen, setCeoModalOpen] = useState(false);
  const [ceoDismissed, setCeoDismissed] = useState(
    () => sessionStorage.getItem(CEO_POPUP_DISMISSED_KEY) === "1",
  );

  // Auto-trigger after 5 seconds — only if not already dismissed this session
  useEffect(() => {
    if (ceoDismissed) return;
    const timer = setTimeout(() => {
      if (sessionStorage.getItem(CEO_POPUP_DISMISSED_KEY) !== "1") {
        setCeoModalOpen(true);
      }
    }, 5_000);
    return () => clearTimeout(timer);
    // Run once on mount — deliberately empty dep array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCeoModalClose() {
    setCeoModalOpen(false);
    setCeoDismissed(true);
    sessionStorage.setItem(CEO_POPUP_DISMISSED_KEY, "1");
  }

  function handleReopenCeoModal() {
    sessionStorage.removeItem(CEO_POPUP_DISMISSED_KEY);
    setCeoDismissed(false);
    setCeoModalOpen(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("author");
    if (a) setAuthorFilter(decodeURIComponent(a));
  }, [location]);

  const { data, isLoading } = useQuery<{ success: boolean; posts: Post[] }>({
    queryKey: ["/api/posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const allArticles: ArticleItem[] = (data?.posts || []).map(postToArticle);

  const applySearch = (items: ArticleItem[]) =>
    items.filter((a) => {
      const matchesSearch = [a.title, a.excerpt, a.author]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());
      const matchesAuthor = authorFilter
        ? a.author.toLowerCase() === authorFilter.toLowerCase()
        : true;
      return matchesSearch && matchesAuthor;
    });

  const latestArticles = applySearch(allArticles.filter((a) => !a.isEpisode));
  const latestEpisodes = applySearch(allArticles.filter((a) => a.isEpisode));

  const CEO_AUTHORS = ["nur laminero"];

  function matchesCeo(a: ArticleItem): boolean {
    return (
      a.category.trim().toLowerCase() === "ceo insights" ||
      CEO_AUTHORS.some((name) => a.author.trim().toLowerCase().includes(name))
    );
  }

  const categoryArticles = applySearch(
    selectedCategory === "Podcast Videos"
      ? allArticles.filter((a) => a.isEpisode)
      : selectedCategory === "CEO Insights"
        ? allArticles.filter((a) => !a.isEpisode && matchesCeo(a))
        : selectedCategory === "View All"
          ? []
          : allArticles.filter(
              (a) =>
                !a.isEpisode &&
                a.category.trim().toLowerCase() ===
                  selectedCategory.trim().toLowerCase(),
            ),
  );

  const featuredArticles = latestArticles.filter((a) => a.featured);

  const isEmpty =
    selectedCategory === "View All"
      ? latestArticles.length === 0 && latestEpisodes.length === 0
      : categoryArticles.length === 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      <WeeklyNotesModal open={ceoModalOpen} onClose={handleCeoModalClose} />

      {/* Floating reopen trigger — fades in after user dismisses the popup */}
      <AnimatePresence>
        {ceoDismissed && !ceoModalOpen && (
          <motion.button
            key="ceo-reopen"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            onClick={handleReopenCeoModal}
            aria-label="Reopen CEO Weekly Notes"
            title="Weekly Notes from our CEO"
            className="fixed bottom-6 right-6 z-[8000] flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#474ead] shadow-lg shadow-slate-900/8 transition-all duration-200 hover:border-[#474ead]/25 hover:shadow-xl hover:shadow-[#474ead]/8"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#474ead]/10">
              <PenLine className="h-3 w-3 text-[#474ead]" />
            </span>
            CEO Weekly Notes
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Category navigation (top, sticky, no TopNavigation above it) ─── */}
      <CategoryNav
        selected={selectedCategory}
        onSelect={(id) => {
          setSelectedCategory(id);
          setAuthorFilter("");
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authorFilter={authorFilter}
        onClearAuthor={() => setAuthorFilter("")}
      />

      {/* ── Featured Hero Band — full-bleed Netflix-style ───────────────── */}
      {selectedCategory === "View All" &&
        !isLoading &&
        featuredArticles.length > 0 &&
        !searchQuery &&
        !authorFilter && (
          <section className="relative overflow-hidden">
            <FeaturedCarousel articles={featuredArticles} />
          </section>
        )}

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!isLoading && isEmpty && (
          <div className="text-center py-20 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-base">
              No content found.{" "}
              {searchQuery
                ? "Try a different keyword."
                : "Check back soon or select a different category."}
            </p>
          </div>
        )}

        {/* ── VIEW ALL: editorial section (featured carousel is now above) ── */}
        {selectedCategory === "View All" && (
          <EditorialSection
            articles={latestArticles}
            episodes={latestEpisodes}
            isLoading={isLoading}
            searchActive={!!(searchQuery || authorFilter)}
          />
        )}

        {/* ── PODCAST VIDEOS category ───────────────────────────────────────── */}
        {selectedCategory === "Podcast Videos" && !isLoading && (
          <section className="mb-14">
            <SectionHeading
              icon={Mic}
              title="Podcast Videos"
              subtitle="Conversations with outsourcing leaders, HR experts, and industry innovators."
            />
            {categoryArticles.length > 0 ? (
              <div className="space-y-4">
                {categoryArticles.map((article) => (
                  <PodcastCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Mic} message="No podcast episodes yet." />
            )}
          </section>
        )}

        {/* ── SPECIFIC ARTICLE CATEGORIES ───────────────────────────────────── */}
        {selectedCategory !== "View All" &&
          selectedCategory !== "Podcast Videos" && (
            <section className="mb-14">
              <SectionHeading
                icon={
                  NAV_CATEGORIES.find((c) => c.id === selectedCategory)?.icon ??
                  Globe
                }
                title={selectedCategory}
              />
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                  ))}
                </div>
              ) : categoryArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Search}
                  message={`No ${selectedCategory} articles yet. Check back soon.`}
                />
              )}
            </section>
          )}

        {/* ── Content Channels ─────────────────────────────────────────────── */}
        <section className="mb-14">
          <SectionHeading icon={TrendingUp} title="Our Content Channels" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contentChannels.map((channel, index) => (
              <div
                key={index}
                className="text-center rounded-2xl border border-slate-200 bg-white p-8 transition-all duration-300 hover-elevate"
              >
                <div
                  className={`w-14 h-14 mx-auto mb-5 rounded-2xl ${channel.color} flex items-center justify-center`}
                >
                  <channel.icon className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold mb-3 text-slate-900">
                  {channel.title}
                </h4>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  {channel.description}
                </p>
                <a
                  href={channel.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#474ead] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5b63d6]"
                >
                  {channel.buttonText}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ── Hero / title section ──────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(71,78,173,0.08),transparent_50%),radial-gradient(ellipse_at_80%_10%,rgba(142,147,255,0.06),transparent_40%)] pointer-events-none" />
            <div className="px-8 py-14 text-center relative sm:px-12 lg:px-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#474ead]/20 bg-[#474ead]/6 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#474ead]">
                Insights &amp; Resources
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-4 leading-tight">
                Outsourcing Intelligence Hub
              </h1>
              <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-8">
                Stay ahead with expert analysis, industry trends, and actionable
                insights on global outsourcing, BPO services, and workforce
                optimization.
              </p>
            </div>
          </div>
        </section>

        {/* ── Insights CTA ──────────────────────────────────────────────────── */}
        <InsightsCTA />
      </div>
    </div>
  );
}
