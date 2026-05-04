import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, User, Clock, Heart, Eye, Share2, Copy, Check } from "lucide-react";
import { SiFacebook, SiX, SiLinkedin } from "react-icons/si";
import { apiRequest } from "@/lib/queryClient";
import type { Post } from "@shared/schema";
import { saveUserActivity } from "@/lib/userActivityMemory";
import { HeadSEO } from "@/components/HeadSEO";
import { useToast } from "@/hooks/use-toast";

const DOMAIN = "https://www.onspotglobal.com";

/** Rewrite any dev-server image URL to the production domain so HeadSEO
 *  og:image tags point to a publicly accessible URL. */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!trimmed.includes(".replit.dev") && !trimmed.includes(".worf.replit.dev")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return `${DOMAIN}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
}

const placeholderImages: Record<string, string> = {
  "Global Outsourcing": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&h=600&fit=crop",
  "Technology": "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=600&fit=crop",
  "Customer Service": "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=1200&h=600&fit=crop",
  "Industry Trends": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=600&fit=crop",
  "Process Optimization": "https://images.unsplash.com/photo-1553484771-371a605b060b?w=1200&h=600&fit=crop",
};

export default function InsightPost() {
  const { slug } = useParams<{ slug: string }>();
  const viewRecordedRef = useRef<string | null>(null);
  const [localLikes, setLocalLikes] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ success: boolean; post: Post }>({
    queryKey: ["/api/posts/slug", slug],
    queryFn: async () => {
      const res = await fetch(`/api/posts/slug/${slug}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const post = data?.post;

  const viewMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiRequest("POST", `/api/posts/${postId}/view`);
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/posts/${postId}/like`);
    },
    onSuccess: (data: { success: boolean; likes: number }) => {
      if (data.success) {
        setLocalLikes(data.likes);
      }
    },
  });

  useEffect(() => {
    if (post && viewRecordedRef.current !== post.id) {
      viewRecordedRef.current = post.id;
      viewMutation.mutate(post.id);
      saveUserActivity({
        activityType: "ArticleView",
        referenceId: post.id,
        title: post.title,
        category: post.category,
        page: "InsightPost",
      });
    }
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (post && localLikes === null) {
      setLocalLikes(post.likes || 0);
    }
  }, [post, localLikes]);

  const handleLike = () => {
    if (post) likeMutation.mutate(post.id);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // ── Sharing ──────────────────────────────────────────────────────────────
  const articleUrl = post
    ? `${DOMAIN}/insights/${post.slug}`
    : `${DOMAIN}/insights/${slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Article URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Could not copy", description: "Please copy the URL from your browser.", variant: "destructive" });
    }
  };

  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(post?.title ?? "")}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
  };

  const openShare = (url: string) => window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");

  // ── Derived SEO values ────────────────────────────────────────────────────
  const coverImage = post
    ? (normalizeImageUrl(post.coverImageUrl) || placeholderImages[post.category] || placeholderImages["Industry Trends"])
    : placeholderImages["Industry Trends"];

  const seoTitle = post
    ? `${post.title} | OnSpot Insights`
    : "Insights | OnSpot";

  const seoDescription = post?.excerpt
    ?? post?.title
    ?? "Read the latest outsourcing insights, industry trends, and expert articles on OnSpot.";

  const publishedAt = post?.publishedAt ?? post?.createdAt;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <Skeleton className="h-64 w-full mb-8 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <p className="text-muted-foreground mb-6">The article you're looking for doesn't exist.</p>
          <Link href="/insights">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Insights
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Article-specific SEO — overrides the global HeadSEO in App.tsx */}
      <HeadSEO
        title={seoTitle}
        description={seoDescription}
        ogImage={coverImage}
        ogType="article"
        canonical={articleUrl}
        articleSchema={{
          headline: post.title,
          description: seoDescription,
          image: coverImage,
          datePublished: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
          author: post.author ?? "OnSpot Editorial",
          url: articleUrl,
        }}
      />

      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/insights">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Insights
            </Button>
          </Link>

          <article>
            <header className="mb-8">
              <Badge variant="secondary" className="mb-4">
                {post.category}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {post.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(publishedAt)}
                </span>
                {post.readTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {post.readTime}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {post.views || 0} views
                </span>
              </div>
            </header>

            {/* Cover image — 16:9 aspect ratio */}
            <div className="mb-8 rounded-xl overflow-hidden aspect-video bg-muted">
              <img
                src={coverImage}
                alt={post.title}
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=675&fit=crop";
                }}
              />
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none mb-8 blog-content">
              {post.content ? (
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
              ) : (
                <p className="text-muted-foreground">{post.excerpt}</p>
              )}
            </div>

            {/* Footer: engagement + social sharing */}
            <div className="border-t pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Engagement */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLike}
                    disabled={likeMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Heart className={`h-4 w-4 ${likeMutation.isPending ? "animate-pulse" : ""}`} />
                    <span>{localLikes ?? post.likes ?? 0}</span>
                  </Button>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {post.views || 0} views
                  </span>
                </div>

                {/* Social sharing */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-1 mr-1">
                    <Share2 className="h-4 w-4" />
                    Share
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openShare(shareUrls.facebook)}
                    title="Share on Facebook"
                  >
                    <SiFacebook className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openShare(shareUrls.twitter)}
                    title="Share on X / Twitter"
                  >
                    <SiX className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openShare(shareUrls.linkedin)}
                    title="Share on LinkedIn"
                  >
                    <SiLinkedin className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    title="Copy article link"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link href="/insights">
                  <Button variant="ghost" size="sm">
                    More articles
                  </Button>
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
