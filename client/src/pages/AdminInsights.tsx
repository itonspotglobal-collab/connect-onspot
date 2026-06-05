import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, ArrowLeft, Home, ChevronUp, ChevronDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Post } from "@shared/schema";

const MAX_HOMEPAGE = 3;

function invalidatePosts() {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
  queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
  queryClient.invalidateQueries({ queryKey: ["/api/posts/homepage"] });
}

export default function AdminInsights() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: postsResponse, isLoading } = useQuery<{ success: boolean; posts: Post[] }>({
    queryKey: ["/api/admin/posts"],
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/posts/${id}`),
    onSuccess: () => { invalidatePosts(); toast({ title: "Post deleted successfully" }); },
    onError: (error: any) => toast({ title: "Failed to delete post", description: error.message, variant: "destructive" }),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      apiRequest("PUT", `/api/admin/posts/${id}`, { isFeatured }),
    onSuccess: () => invalidatePosts(),
    onError: (error: any) => toast({ title: "Failed to update featured status", description: error.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" }) =>
      apiRequest("PUT", `/api/admin/posts/${id}`, { status }),
    onSuccess: () => invalidatePosts(),
    onError: (error: any) => toast({ title: "Failed to update status", description: error.message, variant: "destructive" }),
  });

  const toggleHomepageMutation = useMutation({
    mutationFn: async ({ id, showOnHomepage, homepageOrder }: { id: string; showOnHomepage: boolean; homepageOrder?: number | null }) =>
      apiRequest("PUT", `/api/admin/posts/${id}`, { showOnHomepage, homepageOrder: homepageOrder ?? null }),
    onSuccess: () => invalidatePosts(),
    onError: (error: any) => toast({ title: "Failed to update homepage status", description: error.message, variant: "destructive" }),
  });

  const reorderHomepageMutation = useMutation({
    mutationFn: async ({ id, homepageOrder }: { id: string; homepageOrder: number }) =>
      apiRequest("PUT", `/api/admin/posts/${id}`, { homepageOrder }),
    onSuccess: () => invalidatePosts(),
    onError: (error: any) => toast({ title: "Failed to reorder", description: error.message, variant: "destructive" }),
  });

  const posts = postsResponse?.posts || [];

  // Homepage-selected posts, sorted by order
  const homepagePosts = posts
    .filter((p) => p.showOnHomepage && p.status === "published")
    .sort((a, b) => ((a as any).homepageOrder ?? 99) - ((b as any).homepageOrder ?? 99));

  const homepageCount = homepagePosts.length;

  function handleToggleHomepage(post: Post) {
    const isOn = (post as any).showOnHomepage;
    if (!isOn) {
      if (homepageCount >= MAX_HOMEPAGE) {
        toast({
          title: "Homepage limit reached",
          description: `Only ${MAX_HOMEPAGE} Insights posts can be shown on the homepage. Remove one first.`,
          variant: "destructive",
        });
        return;
      }
      if (post.status !== "published") {
        toast({
          title: "Post must be published",
          description: "Only published posts can be shown on the homepage.",
          variant: "destructive",
        });
        return;
      }
      // Assign the next available order slot
      const usedOrders = homepagePosts.map((p) => (p as any).homepageOrder ?? 99);
      let nextOrder = 1;
      while (usedOrders.includes(nextOrder)) nextOrder++;
      toggleHomepageMutation.mutate({ id: post.id, showOnHomepage: true, homepageOrder: nextOrder });
    } else {
      toggleHomepageMutation.mutate({ id: post.id, showOnHomepage: false, homepageOrder: null });
    }
  }

  function handleMoveOrder(post: Post, direction: "up" | "down") {
    const currentOrder = (post as any).homepageOrder ?? 99;
    const sorted = [...homepagePosts];
    const idx = sorted.findIndex((p) => p.id === post.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapPost = sorted[swapIdx];
    const swapOrder = (swapPost as any).homepageOrder ?? 99;
    reorderHomepageMutation.mutate({ id: post.id, homepageOrder: swapOrder });
    reorderHomepageMutation.mutate({ id: swapPost.id, homepageOrder: currentOrder });
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/insights">
                <Button variant="ghost" size="icon" data-testid="button-back-to-insights">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Insights Admin</h1>
                <p className="text-muted-foreground">Manage blog posts and articles</p>
              </div>
            </div>
            <Button
              data-testid="button-create-post"
              onClick={() => setLocation("/admin/insights/create")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Post
            </Button>
          </div>

          {/* Homepage selection summary */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Home className="h-4 w-4 text-indigo-600" />
                Homepage Insights
                <Badge variant={homepageCount >= MAX_HOMEPAGE ? "default" : "secondary"} className="ml-1">
                  {homepageCount} / {MAX_HOMEPAGE}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {homepagePosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No posts selected for the homepage. Click the <Home className="inline h-3 w-3" /> icon on a published post to add it.
                </p>
              ) : (
                <ol className="space-y-2">
                  {homepagePosts.map((post, idx) => (
                    <li key={post.id} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate font-medium">{post.title}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(post, "up")}
                          className="h-6 w-6"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === homepagePosts.length - 1}
                          onClick={() => handleMoveOrder(post, "down")}
                          className="h-6 w-6"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Posts ({posts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No posts yet. Create your first post to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => {
                    const isOnHomepage = !!(post as any).showOnHomepage;
                    const hpOrder = (post as any).homepageOrder;
                    return (
                      <div
                        key={post.id}
                        className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg"
                        data-testid={`row-post-${post.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{post.title}</h3>
                            <Badge variant={post.status === "published" ? "default" : "secondary"}>
                              {post.status}
                            </Badge>
                            {post.isFeatured && (
                              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                <Star className="h-3 w-3 mr-1" />
                                Featured
                              </Badge>
                            )}
                            {isOnHomepage && (
                              <Badge variant="outline" className="border-indigo-500 text-indigo-600">
                                <Home className="h-3 w-3 mr-1" />
                                Homepage {hpOrder ? `#${hpOrder}` : ""}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            /{post.slug} • {post.category} • {post.author}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Homepage toggle */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-toggle-homepage-${post.id}`}
                                onClick={() => handleToggleHomepage(post)}
                                disabled={toggleHomepageMutation.isPending}
                              >
                                <Home
                                  className={`h-4 w-4 ${isOnHomepage ? "fill-indigo-500 text-indigo-500" : ""}`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isOnHomepage ? "Remove from Homepage" : "Show on Homepage"}
                            </TooltipContent>
                          </Tooltip>

                          {/* Featured toggle */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-toggle-featured-${post.id}`}
                                onClick={() => toggleFeaturedMutation.mutate({ id: post.id, isFeatured: !post.isFeatured })}
                                title={post.isFeatured ? "Remove from featured" : "Mark as featured"}
                              >
                                <Star className={`h-4 w-4 ${post.isFeatured ? "fill-yellow-500 text-yellow-500" : ""}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {post.isFeatured ? "Remove from Featured" : "Mark as Featured"}
                            </TooltipContent>
                          </Tooltip>

                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-toggle-status-${post.id}`}
                            onClick={() => toggleStatusMutation.mutate({
                              id: post.id,
                              status: post.status === "published" ? "draft" : "published"
                            })}
                            title={post.status === "published" ? "Unpublish" : "Publish"}
                          >
                            {post.status === "published" ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-edit-${post.id}`}
                            onClick={() => setLocation(`/admin/insights/${post.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-${post.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Post</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{post.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(post.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
