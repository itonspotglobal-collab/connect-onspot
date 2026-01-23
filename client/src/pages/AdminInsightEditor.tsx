import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Image as ImageIcon, Save, Eye } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import type { Post } from "@shared/schema";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

type PostFormData = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  category: string;
  author: string;
  isFeatured: boolean;
  status: "draft" | "published";
};

const defaultFormData: PostFormData = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  category: "Industry Trends",
  author: "OnSpot Team",
  isFeatured: false,
  status: "draft",
};

const categories = [
  "Global Outsourcing",
  "Technology",
  "Customer Service",
  "Industry Trends",
  "Process Optimization",
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function isValidImageUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"];
  return imageExtensions.some(ext => trimmed.includes(ext)) || trimmed.includes("unsplash") || trimmed.includes("images");
}

export default function AdminInsightEditor() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEditing = !!params.id;
  
  const [formData, setFormData] = useState<PostFormData>(defaultFormData);
  const [loadedPostId, setLoadedPostId] = useState<string | null>(null);

  const { data: postResponse, isLoading: isLoadingPost } = useQuery<{ success: boolean; post: Post }>({
    queryKey: [`/api/admin/posts/${params.id}`],
    enabled: isEditing && !!params.id,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isEditing) {
      setFormData(defaultFormData);
      setLoadedPostId(null);
      return;
    }
    
    if (postResponse?.post && loadedPostId !== params.id) {
      const post = postResponse.post;
      setFormData({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content || "",
        coverImageUrl: post.coverImageUrl || "",
        category: post.category,
        author: post.author,
        isFeatured: post.isFeatured ?? false,
        status: post.status as "draft" | "published",
      });
      setLoadedPostId(params.id || null);
    }
  }, [isEditing, postResponse, params.id, loadedPostId]);

  const createMutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      return apiRequest("POST", "/api/admin/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Post created successfully" });
      setLocation("/admin/insights");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create post", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PostFormData> }) => {
      return apiRequest("PUT", `/api/admin/posts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Post updated successfully" });
      setLocation("/admin/insights");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update post", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && params.id) {
      updateMutation.mutate({ id: params.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const updateField = <K extends keyof PostFormData>(field: K, value: PostFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTitleChange = (newTitle: string) => {
    if (isEditing) {
      setFormData(prev => ({ ...prev, title: newTitle }));
    } else {
      setFormData(prev => ({
        ...prev,
        title: newTitle,
        slug: generateSlug(newTitle),
      }));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingPost) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/insights">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">
              {isEditing ? "Edit Post" : "Create New Post"}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {formData.slug && (
              <Link href={`/insights/${formData.slug}`} target="_blank">
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </Link>
            )}
            <Button 
              onClick={handleSubmit}
              disabled={isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Saving..." : (isEditing ? "Update Post" : "Publish")}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="relative w-full aspect-[21/9] bg-muted rounded-xl overflow-hidden border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
            {formData.coverImageUrl ? (
              <>
                <img 
                  src={formData.coverImageUrl} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white text-center">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Change cover image</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-3" />
                <p className="text-sm font-medium">Add a cover image</p>
                <p className="text-xs mt-1">Paste a URL below or use the Image Uploader</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="coverImageUrl" className="text-xs text-muted-foreground">Cover Image URL</Label>
              <Input
                id="coverImageUrl"
                value={formData.coverImageUrl}
                onChange={(e) => updateField("coverImageUrl", e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open('/admin/image-uploader', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Image Uploader
            </Button>
          </div>
          {formData.coverImageUrl && !isValidImageUrl(formData.coverImageUrl) && (
            <p className="text-xs text-yellow-600 -mt-6">URL may not be a valid image format.</p>
          )}

          <div className="mt-8 mb-6 space-y-3">
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Add a title..."
              className="w-full text-[32px] font-semibold leading-tight bg-transparent border-none outline-none placeholder:text-muted-foreground/40 focus:ring-0 focus:outline-none focus:border-b focus:border-muted-foreground/20 transition-colors"
              required
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>/insights/</span>
              <input
                type="text"
                id="slug"
                value={formData.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                placeholder="your-post-slug"
                className="bg-transparent border-none outline-none focus:ring-0 text-sm flex-1"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => updateField("excerpt", e.target.value)}
              placeholder="Write a brief summary of your post..."
              rows={2}
              className="resize-none"
              required
            />
          </div>

          <div className="flex justify-center w-full">
            <div className="w-full max-w-3xl">
              <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
                <RichTextEditor
                  value={formData.content}
                  onChange={(value) => updateField("content", value)}
                  placeholder="Write your article content here..."
                  linkedInStyle
                />
              </Suspense>
            </div>
          </div>

          <div className="border-t pt-8 space-y-6">
            <h2 className="text-lg font-semibold">Post Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) => updateField("author", e.target.value)}
                  placeholder="Author name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => updateField("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateField("status", value as "draft" | "published")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => updateField("isFeatured", checked)}
                />
                <Label htmlFor="isFeatured">Featured Post</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link href="/admin/insights">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit"
              disabled={isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Saving..." : (isEditing ? "Update Post" : "Create Post")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
