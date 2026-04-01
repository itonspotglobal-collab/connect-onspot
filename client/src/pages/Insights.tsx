import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Calendar, Clock, Eye, Globe, TrendingUp,
  ExternalLink, Rss, ArrowRight, BookOpen, Linkedin, Youtube,
  Search, PlayCircle, Mic, LayoutGrid, Users, Briefcase,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Post } from "@shared/schema";

// ─── Navigation categories ────────────────────────────────────────────────────
const NAV_CATEGORIES = [
  { id: "View All",          label: "View All",          icon: LayoutGrid },
  { id: "CEO Insights",      label: "CEO Insights",      icon: Rss        },
  { id: "Talent Insights",   label: "Talent Insights",   icon: User       },
  { id: "Client Insights",   label: "Client Insights",   icon: Briefcase  },
  { id: "Industry Insights", label: "Industry Insights", icon: Globe      },
  { id: "Learning Centre",   label: "Learning Centre",   icon: BookOpen   },
  { id: "Podcast Videos",    label: "Podcast Videos",    icon: Mic        },
] as const;

type NavCategoryId = (typeof NAV_CATEGORIES)[number]["id"];

// ─── Cover image fallbacks by category ────────────────────────────────────────
const COVER_IMAGES: Record<string, string> = {
  "CEO Insights":        "https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=800&h=450&fit=crop",
  "Talent Insights":     "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Client Insights":     "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=450&fit=crop",
  "Industry Insights":   "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Learning Centre":     "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop",
  "Podcast Videos":      "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=450&fit=crop",
  "Global Outsourcing":  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop",
  "Technology":          "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Customer Service":    "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=800&h=450&fit=crop",
  "Industry Trends":     "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Process Optimization":"https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=450&fit=crop",
};
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop";

// ─── Legacy category normalisation ────────────────────────────────────────────
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Global Outsourcing":   "Industry Insights",
  "Industry Trends":      "Industry Insights",
  "Technology":           "Industry Insights",
  "Customer Service":     "Client Insights",
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
    category === "Podcast Videos" ||
    category.toLowerCase().includes("podcast")
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
      className="overflow-hidden transition-all duration-300 group flex flex-col cursor-pointer h-full bg-[#080a1a]/80 border-white/10 hover-elevate"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      {/* Cover image */}
      <div className="aspect-video bg-[#040611] relative overflow-hidden flex-shrink-0">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          width={800}
          height={450}
        />
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between">
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
        <h4 className="text-base font-bold leading-snug line-clamp-2 text-white group-hover:text-[#474ead] transition-colors">
          {article.title}
        </h4>

        <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed flex-1">
          {article.excerpt || "Read the full article for insights and analysis."}
        </p>

        <div className="border-t border-white/10 pt-3 mt-auto">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <a
              href={authorHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 group/author min-w-0"
              title={`Articles by ${article.author}`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#474ead]/20 text-[#474ead] text-[10px] font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="text-xs font-semibold text-slate-300 group-hover/author:text-[#474ead] transition-colors truncate underline-offset-2 group-hover/author:underline">
                {article.author}
              </span>
            </a>

            <span className="flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
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
      className="overflow-hidden transition-all duration-300 group cursor-pointer bg-[#080a1a]/80 border-white/10 hover-elevate"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <div className="sm:w-44 flex-shrink-0 bg-[#040611] relative overflow-hidden aspect-video sm:aspect-auto">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            width={176}
            height={120}
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
              className="text-[10px] uppercase tracking-wider self-start bg-white/10 text-slate-300 border-white/10"
            >
              Podcast
            </Badge>
            {article.featured && (
              <Badge className="text-[10px] bg-amber-400 text-black border-0">
                Featured
              </Badge>
            )}
          </div>

          <h4 className="text-sm font-bold line-clamp-2 text-white group-hover:text-[#474ead] transition-colors leading-snug">
            {article.title}
          </h4>

          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed flex-1">
            {article.excerpt || "Listen to this episode for expert conversations."}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-white/10">
            <a
              href={authorHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 group/author"
              title={`Episodes by ${article.author}`}
            >
              <span className="w-5 h-5 rounded-full bg-[#474ead]/20 text-[#474ead] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="text-xs font-semibold text-slate-300 group-hover/author:text-[#474ead] transition-colors underline-offset-2 group-hover/author:underline">
                {article.author}
              </span>
            </a>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {article.date}
            </span>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
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
    <Card className="overflow-hidden flex flex-col bg-[#080a1a]/80 border-white/10">
      <Skeleton className="aspect-video bg-white/10" />
      <CardContent className="p-5 flex flex-col gap-3">
        <Skeleton className="h-5 w-full bg-white/10" />
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-4 w-3/4 bg-white/10" />
        <div className="border-t border-white/10 pt-3 mt-1 flex items-center justify-between">
          <Skeleton className="h-5 w-28 bg-white/10" />
          <Skeleton className="h-4 w-16 bg-white/10" />
        </div>
        <Skeleton className="h-3 w-24 mt-0.5 bg-white/10" />
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

  const goTo = (idx: number) =>
    setActive(((idx % total) + total) % total);

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
      {/* progress-bar keyframe */}
      <style>{`
        @keyframes carousel-bar { from { width: 0% } to { width: 100% } }
        .carousel-bar { animation: carousel-bar 5.5s linear forwards; }
      `}</style>

      <div
        className="relative w-full rounded-2xl overflow-hidden cursor-pointer group select-none"
        style={{ height: "clamp(340px, 46vw, 540px)" }}
        onClick={() => navigate(`/insights/${art.slug}`)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        role="region"
        aria-label="Featured articles carousel"
      >
        {/* ── Slides (cross-fade) ─────────────────────────────────────────── */}
        {articles.map((a, i) => (
          <div
            key={a.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === active ? 1 : 0, zIndex: i === active ? 1 : 0 }}
            aria-hidden={i !== active}
          >
            <img
              src={a.image}
              alt={a.title}
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* Overlays for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#080a1a] via-[#0d0f2d]/65 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#080a1a]/85 via-[#0d0f2d]/30 to-transparent" />
          </div>
        ))}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end px-8 pb-10 sm:px-12 sm:pb-12">
          {/* Badges */}
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
          <h2 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-semibold text-white leading-tight max-w-2xl mb-3 tracking-tight">
            {art.title}
          </h2>

          {/* Excerpt */}
          {art.excerpt && (
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl mb-5 line-clamp-2">
              {art.excerpt}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-[#474ead]/30 text-[#474ead] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {getInitials(art.author)}
              </span>
              <span className="text-slate-300 font-medium">{art.author}</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3 h-3" />
              {art.date}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {art.readTime}
            </span>
            {art.views > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Eye className="w-3 h-3" />
                {art.views.toLocaleString()}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-white group-hover:text-[#474ead] transition-colors">
              Read Article
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>

        {/* ── Arrow controls ──────────────────────────────────────────────── */}
        {total > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(active - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
              aria-label="Previous article"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(active + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
              aria-label="Next article"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* ── Dot indicators ──────────────────────────────────────────────── */}
        {total > 1 && (
          <div className="absolute bottom-5 right-8 sm:right-12 z-20 flex items-center gap-2">
            {articles.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
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

        {/* ── Progress bar ────────────────────────────────────────────────── */}
        {total > 1 && !paused && (
          <div className="absolute bottom-0 left-0 right-0 z-20 h-[2px] bg-white/10">
            <div
              key={`${active}-progress`}
              className="h-full bg-[#474ead] carousel-bar"
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
  navVisible,
}: {
  selected: NavCategoryId;
  onSelect: (id: NavCategoryId) => void;
  navVisible: boolean;
}) {
  return (
    <div
      className="sticky z-40 bg-[#0a0c22]/95 backdrop-blur-md border-b border-white/10"
      style={{
        top: navVisible ? "var(--nav-h)" : "0",
        transition: "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center overflow-x-auto scrollbar-hide -mb-px gap-0">
          {NAV_CATEGORIES.map(({ id, label, icon: Icon }) => {
            const active = selected === id;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={`
                  flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-all duration-200 flex-shrink-0
                  ${
                    active
                      ? "border-[#474ead] text-[#474ead]"
                      : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-slate-400 max-w-md">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#080a1a]/40 p-8 text-center text-slate-400">
      <Icon className="w-8 h-8 mx-auto mb-3 opacity-30" />
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
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050715]/96 via-[#050715]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050715]/72 via-[#050715]/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-7 sm:p-10">
        <span className="inline-flex self-start mb-3 text-[10px] uppercase tracking-[0.22em] font-semibold px-3 py-1 rounded-full bg-[#474ead] text-white">
          {article.category}
        </span>
        <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3 tracking-tight">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-slate-300 text-sm leading-relaxed mb-5 line-clamp-3 max-w-xl">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-4 flex-wrap mb-5">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-6 h-6 rounded-full bg-[#474ead]/30 text-[#474ead] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
              {getInitials(article.author)}
            </span>
            <span className="text-slate-300 font-medium">{article.author}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="w-3 h-3" /> {article.date}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" /> {article.readTime}
          </span>
          {article.views > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Eye className="w-3 h-3" /> {article.views.toLocaleString()}
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-[#474ead] transition-colors">
          Read Article <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
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
      className="bg-[#080a1a]/80 border border-white/10 rounded-2xl overflow-hidden cursor-pointer group hover-elevate flex-shrink-0"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <div className="relative h-44 overflow-hidden bg-[#040611]">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a1a]/70 to-transparent" />
        <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full bg-[#474ead] text-white">
          {article.category}
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-base font-bold text-white leading-tight mb-2 line-clamp-2">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {article.date}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {article.readTime}</span>
        </div>
      </div>
    </div>
  );
}

// ─── EditorialCTA ─────────────────────────────────────────────────────────────
function EditorialCTA() {
  return (
    <div className="flex-1 bg-gradient-to-br from-[#474ead]/15 via-[#0d0f2d]/80 to-[#0d0f2d] border border-[#474ead]/20 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight: "160px" }}>
      <div>
        <div className="w-10 h-10 rounded-xl bg-[#474ead]/20 flex items-center justify-center mb-4">
          <TrendingUp className="w-5 h-5 text-[#474ead]" />
        </div>
        <h4 className="text-base font-bold text-white mb-2">Stay ahead of the curve.</h4>
        <p className="text-sm text-slate-400 leading-relaxed">
          Follow OnSpot for the latest outsourcing intelligence, BPO strategies, and workforce insights.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        <a
          href="https://www.linkedin.com/company/onspotglobal"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#474ead] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b63d6] transition"
        >
          <Linkedin className="w-3.5 h-3.5" /> Follow on LinkedIn
        </a>
        <a
          href="https://youtube.com/@onspotglobal"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
        >
          <Youtube className="w-3.5 h-3.5" /> Watch on YouTube
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
  const gridArticles = showAll ? articles.slice(2) : articles.slice(2, 2 + GRID_LIMIT);
  const hasMore = !showAll && articles.length > 2 + GRID_LIMIT;

  // When searching/filtering by author, show all results as a simple grid
  if (searchActive) {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Search results</h2>
          <p className="text-sm text-slate-400 mt-1">{articles.length} article{articles.length !== 1 ? "s" : ""} found</p>
        </div>
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
            {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        ) : (
          <EmptyState icon={Search} message="No articles match your search." />
        )}
        {episodes.length > 0 && (
          <section className="mb-14">
            <SectionHeading icon={Mic} title="Podcast Episodes" />
            <div className="space-y-4">
              {episodes.map((e) => <PodcastCard key={e.id} article={e} />)}
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {/* ── Section heading ─────────────────────────────────────────────── */}
      <div className="mb-8 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#474ead] mb-2">
          All Insights
        </p>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            Explore the full knowledge base.
          </h2>
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed hidden sm:block">
            Deep dives, expert analysis, and industry perspectives — curated by the OnSpot team.
          </p>
        </div>
        {/* Thin rule */}
        <div className="mt-6 h-px bg-gradient-to-r from-[#474ead]/40 via-white/10 to-transparent" />
      </div>

      {/* ── Hero editorial row ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-10">
          <Skeleton className="rounded-2xl bg-white/10" style={{ minHeight: "460px" }} />
          <div className="flex flex-col gap-5">
            <Skeleton className="rounded-2xl bg-white/10 h-[268px]" />
            <Skeleton className="rounded-2xl bg-white/10 flex-1" style={{ minHeight: "164px" }} />
          </div>
        </div>
      ) : highlightArticle ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-10">
          <HighlightCard article={highlightArticle} />
          <div className="flex flex-col gap-5">
            {panelArticle && <PanelArticleCard article={panelArticle} />}
            <EditorialCTA />
          </div>
        </div>
      ) : null}

      {/* ── Supporting articles grid ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {Array.from({ length: 6 }).map((_, i) => <ArticleCardSkeleton key={i} />)}
        </div>
      ) : gridArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {gridArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : null}

      {/* ── View all / load more ─────────────────────────────────────────── */}
      {hasMore && (
        <div className="flex justify-center mb-12">
          <button
            onClick={() => setShowAll(true)}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-8 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            View all {articles.length} insights <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Podcast episodes ────────────────────────────────────────────── */}
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function Insights() {
  const [location] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<NavCategoryId>("View All");
  const [searchQuery, setSearchQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("author");
    if (a) setAuthorFilter(decodeURIComponent(a));
  }, [location]);

  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const delta = Math.abs(y - lastScrollY.current);
        if (delta >= 10) {
          if (y < 100) {
            setNavVisible(true);
          } else if (y > lastScrollY.current && y > 200) {
            setNavVisible(false);
          } else if (y < lastScrollY.current) {
            setNavVisible(true);
          }
          lastScrollY.current = y;
        }
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      : allArticles.filter(
          (a) =>
            !a.isEpisode &&
            a.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase()
        )
  );

  const featuredArticles = latestArticles.filter((a) => a.featured);

  const isEmpty =
    selectedCategory === "View All"
      ? latestArticles.length === 0 && latestEpisodes.length === 0
      : categoryArticles.length === 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0f2d] via-[#141656] to-[#0d0f2d]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-transparent border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(71,78,173,0.45),transparent_38%),radial-gradient(ellipse_at_80%_10%,rgba(142,147,255,0.22),transparent_32%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
            Insights &amp; Resources
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4 leading-tight">
            Outsourcing Intelligence Hub
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto mb-10 leading-8">
            Stay ahead with expert analysis, industry trends, and actionable
            insights on global outsourcing, BPO services, and workforce
            optimization.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto mb-4">
            <div className="relative p-[1px] rounded-full bg-gradient-to-r from-[#474ead]/40 via-[#474ead]/20 to-[#474ead]/40">
              <div className="flex items-center bg-[#080a1a] rounded-full px-4 py-3 backdrop-blur transition-all focus-within:ring-2 focus-within:ring-[#474ead]/40">
                <Search className="w-5 h-5 text-[#474ead]/70 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search insights, topics, or authors…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Active author filter pill */}
          {authorFilter && (
            <div className="flex justify-center mt-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#474ead]/20 border border-[#474ead]/30 text-[#474ead] text-xs px-3 py-1.5 font-medium">
                <Users className="w-3 h-3" />
                Articles by {authorFilter}
                <button
                  onClick={() => setAuthorFilter("")}
                  className="ml-1 hover:text-white transition-colors"
                  aria-label="Clear author filter"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Category navigation ────────────────────────────────────────────── */}
      <CategoryNav
        selected={selectedCategory}
        onSelect={(id) => {
          setSelectedCategory(id);
          setAuthorFilter("");
        }}
        navVisible={navVisible}
      />

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Empty / no results state */}
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

        {/* ── VIEW ALL: Featured carousel + editorial section ───────────────── */}
        {selectedCategory === "View All" && (
          <>
            {/* Featured carousel — unchanged */}
            {!isLoading && featuredArticles.length > 0 && !searchQuery && !authorFilter && (
              <section className="mb-10">
                <FeaturedCarousel articles={featuredArticles} />
              </section>
            )}

            {/* Editorial section */}
            <EditorialSection
              articles={latestArticles}
              episodes={latestEpisodes}
              isLoading={isLoading}
              searchActive={!!(searchQuery || authorFilter)}
            />
          </>
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
        {selectedCategory !== "View All" && selectedCategory !== "Podcast Videos" && (
          <section className="mb-14">
            <SectionHeading
              icon={
                NAV_CATEGORIES.find((c) => c.id === selectedCategory)?.icon ?? Globe
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
                className="text-center rounded-2xl border border-white/10 bg-[#080a1a]/80 p-8 transition-all duration-300 hover-elevate"
              >
                <div
                  className={`w-14 h-14 mx-auto mb-5 rounded-2xl ${channel.color} flex items-center justify-center`}
                >
                  <channel.icon className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold mb-3 text-white">{channel.title}</h4>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
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

        {/* ── CEO Notes CTA ────────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="rounded-2xl border border-[#474ead]/30 bg-gradient-to-r from-[#474ead]/20 via-[#474ead]/10 to-[#8e93ff]/10 p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Rss className="w-6 h-6 text-[#474ead]" />
              <h3 className="text-2xl font-bold text-white">Daily Notes from our CEO</h3>
            </div>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto leading-8">
              Get exclusive insights and thoughts from our leadership team.
              Raw, unfiltered perspectives on the future of outsourcing and
              business growth.
            </p>
            <button className="inline-flex items-center gap-2 rounded-full bg-[#474ead] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#474ead]/25 transition hover:scale-[1.02] hover:bg-[#5b63d6]">
              Subscribe to CEO Notes
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
