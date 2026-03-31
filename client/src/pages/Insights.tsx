import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Calendar, Clock, Eye, Globe, TrendingUp,
  ExternalLink, Rss, ArrowRight, BookOpen, Linkedin, Youtube,
  Search, PlayCircle, Mic, LayoutGrid, Users, Briefcase,
} from "lucide-react";
import type { Post } from "@shared/schema";

// ─── Navigation categories ────────────────────────────────────────────────────
const NAV_CATEGORIES = [
  { id: "View All",         label: "View All",         icon: LayoutGrid  },
  { id: "CEO Insights",     label: "CEO Insights",     icon: Rss         },
  { id: "Talent Insights",  label: "Talent Insights",  icon: User        },
  { id: "Client Insights",  label: "Client Insights",  icon: Briefcase   },
  { id: "Industry Insights",label: "Industry Insights",icon: Globe       },
  { id: "Learning Centre",  label: "Learning Centre",  icon: BookOpen    },
  { id: "Podcast Videos",   label: "Podcast Videos",   icon: Mic         },
] as const;

type NavCategoryId = (typeof NAV_CATEGORIES)[number]["id"];

// ─── Cover image fallbacks by category ────────────────────────────────────────
const COVER_IMAGES: Record<string, string> = {
  // Canonical new categories
  "CEO Insights":       "https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=800&h=450&fit=crop",
  "Talent Insights":    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Client Insights":    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=450&fit=crop",
  "Industry Insights":  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Learning Centre":    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop",
  "Podcast Videos":     "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=450&fit=crop",
  // Legacy categories (kept as fallbacks while old posts still exist in DB)
  "Global Outsourcing":  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop",
  "Technology":          "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Customer Service":    "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=800&h=450&fit=crop",
  "Industry Trends":     "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Process Optimization":"https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=450&fit=crop",
};
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop";

// ─── Legacy category normalisation ────────────────────────────────────────────
// Maps old DB category strings → canonical Insights filter tab IDs.
// Keeps existing seeded posts working without any DB migration.
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

/** Returns 1–2 uppercase initials from an author name. Fallback: "?" */
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
  // Normalise legacy DB category values to canonical Insights filter tab IDs.
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
      className="overflow-hidden hover-elevate transition-all duration-300 group flex flex-col cursor-pointer h-full"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      {/* Cover image */}
      <div className="aspect-video bg-muted relative overflow-hidden flex-shrink-0">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          width={800}
          height={450}
        />
        {/* Category badge over image */}
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
        {/* Title — most prominent element */}
        <h4 className="text-base font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </h4>

        {/* Synopsis / excerpt — secondary */}
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed flex-1">
          {article.excerpt || "Read the full article for insights and analysis."}
        </p>

        {/* Divider */}
        <div className="border-t border-border/60 pt-3 mt-auto">
          {/* Author row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Author with avatar initial */}
            <a
              href={authorHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 group/author min-w-0"
              title={`Articles by ${article.author}`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="text-xs font-semibold text-foreground group-hover/author:text-primary transition-colors truncate underline-offset-2 group-hover/author:underline">
                {article.author}
              </span>
            </a>

            {/* Read time */}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>

          {/* Date + views */}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
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
      className="overflow-hidden hover-elevate transition-all duration-300 group cursor-pointer"
      onClick={() => navigate(`/insights/${article.slug}`)}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <div className="sm:w-44 flex-shrink-0 bg-muted relative overflow-hidden aspect-video sm:aspect-auto">
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
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider self-start">
              Podcast
            </Badge>
            {article.featured && (
              <Badge className="text-[10px] bg-amber-400 text-black border-0">
                Featured
              </Badge>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-bold line-clamp-2 group-hover:text-primary transition-colors leading-snug">
            {article.title}
          </h4>

          {/* Synopsis */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
            {article.excerpt || "Listen to this episode for expert conversations."}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-border/60">
            <a
              href={authorHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 group/author"
              title={`Episodes by ${article.author}`}
            >
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="text-xs font-semibold text-foreground group-hover/author:text-primary transition-colors underline-offset-2 group-hover/author:underline">
                {article.author}
              </span>
            </a>
            <span className="text-border text-xs">·</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {article.date}
            </span>
            <span className="text-border text-xs">·</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
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
    <Card className="overflow-hidden flex flex-col">
      <Skeleton className="aspect-video" />
      <CardContent className="p-5 flex flex-col gap-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="border-t border-border/60 pt-3 mt-1 flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-24 mt-0.5" />
      </CardContent>
    </Card>
  );
}

// ─── CategoryNav ──────────────────────────────────────────────────────────────
// Sticky below the fixed TopNavigation using var(--nav-h)
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
      className="sticky z-40 bg-background border-b border-border/60 shadow-sm"
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
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground max-w-md">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Insights() {
  const [location] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<NavCategoryId>("View All");
  const [searchQuery, setSearchQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");

  // Read ?author= from the URL on mount / navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("author");
    if (a) setAuthorFilter(decodeURIComponent(a));
  }, [location]);

  // ─── Mirror TopNavigation hide-on-scroll so CategoryNav top syncs with it ───
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

  // ─── Data fetching ──────────────────────────────────────────────────────────
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

  // ─── Filter helpers ─────────────────────────────────────────────────────────
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

  // Non-podcast articles
  const latestArticles = applySearch(allArticles.filter((a) => !a.isEpisode));
  // Podcast episodes
  const latestEpisodes = applySearch(allArticles.filter((a) => a.isEpisode));

  // ─── CEO Insights: match by category OR by CEO author name ─────────────────
  // Posts by the CEO are stored under their actual category (e.g. "Industry
  // Trends"), not under "CEO Insights", so we match on author name as well.
  const CEO_AUTHORS = ["nur laminero"];

  function matchesCeo(a: ArticleItem): boolean {
    return (
      a.category.trim().toLowerCase() === "ceo insights" ||
      CEO_AUTHORS.some((name) => a.author.trim().toLowerCase().includes(name))
    );
  }

  // Articles for a specific non-"View All" category
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
    <div className="min-h-screen bg-background">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-primary/20 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center relative">
          <Badge variant="secondary" className="mb-4">
            Insights &amp; Resources
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Outsourcing Intelligence Hub
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Stay ahead with expert analysis, industry trends, and actionable
            insights on global outsourcing, BPO services, and workforce
            optimization.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto mb-4">
            <div className="relative p-[1px] rounded-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40">
              <div className="flex items-center bg-background rounded-full px-4 py-3 shadow-sm backdrop-blur transition-all focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-md">
                <Search className="w-5 h-5 text-primary/70 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search insights, topics, or authors…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Active author filter pill */}
          {authorFilter && (
            <div className="flex justify-center mt-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs px-3 py-1.5 font-medium">
                <Users className="w-3 h-3" />
                Articles by {authorFilter}
                <button
                  onClick={() => setAuthorFilter("")}
                  className="ml-1 hover:text-foreground transition-colors"
                  aria-label="Clear author filter"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Category navigation (sticky, synced with TopNavigation scroll) ── */}
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
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-base">
              No content found.{" "}
              {searchQuery
                ? "Try a different keyword."
                : "Check back soon or select a different category."}
            </p>
          </div>
        )}

        {/* ── VIEW ALL: Featured + Articles + Podcasts ─────────────────────── */}
        {selectedCategory === "View All" && (
          <>
            {/* Featured articles (only when not filtering by search/author) */}
            {!isLoading && featuredArticles.length > 0 && !searchQuery && !authorFilter && (
              <section className="mb-14">
                <SectionHeading icon={TrendingUp} title="Featured Articles" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredArticles.slice(0, 2).map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

            {/* Latest Articles section */}
            <section className="mb-14">
              <SectionHeading
                icon={Globe}
                title="Latest Articles"
                subtitle="Updated regularly with curated insights on outsourcing, business, and workforce management."
              />
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                  ))}
                </div>
              ) : latestArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {latestArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Globe className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No articles published yet.</p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Latest Podcast Episodes section */}
            <section className="mb-14">
              <SectionHeading
                icon={Mic}
                title="Latest Podcast Episodes"
                subtitle="Conversations with outsourcing leaders, HR experts, and industry innovators."
              />
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <div className="flex">
                        <Skeleton className="w-44 h-28 flex-shrink-0" />
                        <CardContent className="flex-1 p-4 space-y-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : latestEpisodes.length > 0 ? (
                <div className="space-y-4">
                  {latestEpisodes.map((article) => (
                    <PodcastCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Mic className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Podcast episodes coming soon.</p>
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}

        {/* ── PODCAST VIDEOS category ──────────────────────────────────────── */}
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
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Mic className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No podcast episodes yet.</p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* ── SPECIFIC ARTICLE CATEGORIES (CEO, Talent, Client, Industry, Learning) */}
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
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No {selectedCategory} articles yet. Check back soon.</p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* ── Content Channels ─────────────────────────────────────────────── */}
        <section className="mb-14">
          <SectionHeading icon={TrendingUp} title="Our Content Channels" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contentChannels.map((channel, index) => (
              <Card
                key={index}
                className="text-center hover-elevate transition-all duration-300 group"
              >
                <CardContent className="p-8">
                  <div
                    className={`w-14 h-14 mx-auto mb-5 rounded-full ${channel.color} flex items-center justify-center`}
                  >
                    <channel.icon className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-lg font-bold mb-3">{channel.title}</h4>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    {channel.description}
                  </p>
                  <Button asChild>
                    <a
                      href={channel.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {channel.buttonText}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── CEO Notes CTA ────────────────────────────────────────────────── */}
        <section className="mb-10">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Rss className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-bold">Daily Notes from our CEO</h3>
              </div>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Get exclusive insights and thoughts from our leadership team.
                Raw, unfiltered perspectives on the future of outsourcing and
                business growth.
              </p>
              <Button size="lg">
                Subscribe to CEO Notes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
