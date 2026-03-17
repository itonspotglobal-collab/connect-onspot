import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  User, Calendar, Eye, Heart, Globe, TrendingUp, ExternalLink,
  Rss, ArrowRight, Bell, BookOpen, Linkedin, Youtube, Search,
} from "lucide-react";
import type { Post } from "@shared/schema";

const categories = [
  "All Articles",
  "Global Outsourcing",
  "Technology",
  "Customer Service",
  "Industry Trends",
  "Process Optimization",
];

const placeholderImages: Record<string, string> = {
  "Global Outsourcing": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop",
  "Technology": "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=450&fit=crop",
  "Customer Service": "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=800&h=450&fit=crop",
  "Industry Trends": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  "Process Optimization": "https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=450&fit=crop",
};

const contentChannels = [
  {
    icon: Linkedin,
    color: "bg-blue-600",
    title: "LinkedIn Articles",
    description: "Follow our LinkedIn page for daily outsourcing insights, leadership tips, and industry news from our expert team.",
    link: "https://www.linkedin.com/company/onspotglobal",
    buttonText: "Follow on LinkedIn",
  },
  {
    icon: Youtube,
    color: "bg-red-600",
    title: "YouTube Channel",
    description: "Watch in-depth tutorials, case studies, and thought leadership videos on outsourcing best practices.",
    link: "https://youtube.com/@onspotglobal",
    buttonText: "Watch on YouTube",
  },
  {
    icon: BookOpen,
    color: "bg-purple-600",
    title: "Free Resources",
    description: "Download our free guides, templates, and whitepapers to accelerate your outsourcing journey.",
    link: "/resources",
    buttonText: "Browse Resources",
  },
];

function formatDate(date: string | Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
};

function postToArticle(post: Post): ArticleItem {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    author: post.author,
    date: formatDate(post.publishedAt || post.createdAt),
    readTime: post.readTime || "5 min read",
    category: post.category,
    image: post.coverImageUrl || placeholderImages[post.category] || placeholderImages["Industry Trends"],
    views: post.views || 0,
    likes: post.likes || 0,
    featured: post.isFeatured ?? false,
  };
}

export default function Insights() {
  const [selectedCategory, setSelectedCategory] = useState("All Articles");
  const [searchQuery, setSearchQuery] = useState("");

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
  const featuredArticles = allArticles.filter((a) => a.featured);
  const filteredArticles =
    selectedCategory === "All Articles"
      ? allArticles
      : allArticles.filter((a) => a.category === selectedCategory);

  const finalArticles = filteredArticles.filter((a) =>
    [a.title, a.excerpt, a.author]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim())
  );

  const showLoading = isLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-primary/20 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center relative">
          <Badge variant="secondary" className="mb-4">Insights &amp; Resources</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Outsourcing Intelligence Hub
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Stay ahead with expert analysis, industry trends, and actionable insights on global outsourcing,
            BPO services, and workforce optimization.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative p-[1px] rounded-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40">
              <div className="flex items-center bg-background rounded-full px-4 py-3 shadow-sm backdrop-blur transition-all focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-md">
                <Search className="w-5 h-5 text-primary/70 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search insights, topics, or authors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Featured Articles */}
        {featuredArticles.length > 0 && selectedCategory === "All Articles" && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-8">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold">Featured Articles</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(showLoading ? [{} as ArticleItem, {} as ArticleItem] : featuredArticles.slice(0, 2)).map((article, i) => (
                showLoading ? (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="aspect-video" />
                    <CardContent className="p-6">
                      <Skeleton className="h-3 w-1/3 mb-3" />
                      <Skeleton className="h-6 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4 mb-4" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ) : (
                  <Link key={article.id} href={`/insights/${article.slug}`} className="block">
                    <Card className="overflow-hidden hover-elevate transition-all duration-300 group flex flex-col cursor-pointer h-full">
                      <div className="aspect-video bg-muted relative overflow-hidden flex-shrink-0">
                        <img
                          src={article.image}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <Badge className="absolute top-4 left-4 bg-[hsl(var(--gold-yellow)/0.9)] text-black">
                          Featured
                        </Badge>
                      </div>
                      <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 flex-wrap flex-shrink-0">
                          <User className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{article.author}</span>
                          <Separator orientation="vertical" className="h-4 flex-shrink-0" />
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{article.date}</span>
                          <Separator orientation="vertical" className="h-4 flex-shrink-0" />
                          <span className="truncate">{article.readTime}</span>
                        </div>
                        <h4 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-primary transition-colors flex-shrink-0">
                          {article.title}
                        </h4>
                        <p className="text-muted-foreground mb-4 line-clamp-3 flex-1">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center justify-between flex-shrink-0 mt-auto">
                          <Badge variant="secondary">{article.category}</Badge>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              <span>{article.views}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              <span>{article.likes}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              ))}
            </div>
          </section>
        )}

        {/* All Articles / Filtered Articles */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold">
                {selectedCategory === "All Articles" ? "Key Insights" : selectedCategory}
              </h3>
            </div>
            {selectedCategory === "All Articles" && (
              <p className="text-muted-foreground">
                Updated daily with curated fresh insights across the world of outsourcing, business, entrepreneurship and others.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {showLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-video" />
                  <CardContent className="p-6">
                    <Skeleton className="h-3 w-1/2 mb-3" />
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))
            ) : finalArticles.map((article) => (
              <Link key={article.id} href={`/insights/${article.slug}`} className="block">
                <Card className="overflow-hidden hover-elevate transition-all duration-300 group flex flex-col cursor-pointer h-full">
                  <div className="aspect-video bg-muted relative overflow-hidden flex-shrink-0">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {article.featured && (
                      <Badge className="absolute top-4 left-4 bg-[hsl(var(--gold-yellow)/0.9)] text-black">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-shrink-0">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{article.author}</span>
                      <Separator orientation="vertical" className="h-3 flex-shrink-0" />
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{article.date}</span>
                    </div>
                    <h4 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors flex-shrink-0">
                      {article.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between flex-shrink-0 mt-auto">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {article.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {article.readTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>{article.views}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          <span>{article.likes}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {!showLoading && finalArticles.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-base">No articles found. Try a different keyword or category.</p>
            </div>
          )}
        </section>

        {/* Content Channels */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-8">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h3 className="text-2xl font-bold">Our Content Channels</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contentChannels.map((channel, index) => (
              <Card key={index} className="text-center hover-elevate transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className={`w-16 h-16 mx-auto mb-6 rounded-full ${channel.color} flex items-center justify-center`}>
                    <channel.icon className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-bold mb-4">{channel.title}</h4>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {channel.description}
                  </p>
                  <Button asChild className="group-hover:shadow-lg transition-all">
                    <a href={channel.link} target="_blank" rel="noopener noreferrer">
                      {channel.buttonText}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Daily Notes from CEO */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Rss className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-bold">Daily Notes from our CEO</h3>
              </div>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Get exclusive insights and thoughts from our leadership team. Raw, unfiltered perspectives on the future of outsourcing and business growth.
              </p>
              <Button size="lg" className="bg-primary hover:bg-primary/90">
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
