import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, ArrowLeft, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { Link } from "wouter";
import type { Post } from "@shared/schema";

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

// Soft validation thresholds - warnings only, don't block publishing
const VALIDATION_LIMITS = {
  title: { recommended: 80, max: 120 },
  excerpt: { recommended: 160, max: 250 },
};

// Check if URL looks like a valid image
function isValidImageUrl(url: string): boolean {
  if (!url) return true; // Empty is okay
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"];
  return imageExtensions.some(ext => trimmed.includes(ext)) || trimmed.includes("unsplash") || trimmed.includes("images");
}

// Helper component for field warnings (soft validation - does NOT block submission)
function FieldHint({ value, limits, label }: { value: string; limits: { recommended: number; max: number }; label: string }) {
  const length = value.length;
  const isWarning = length > limits.recommended && length <= limits.max;
  const isError = length > limits.max;
  
  if (length === 0) return null;
  
  return (
    <div className={`text-xs mt-1 ${isError ? "text-destructive" : isWarning ? "text-yellow-600" : "text-muted-foreground"}`}>
      {length}/{limits.recommended} chars
      {isWarning && ` (${label} may be truncated in cards)`}
      {isError && ` (exceeds recommended max of ${limits.max})`}
    </div>
  );
}

// Draft state for edit modal - fully isolated from parent/query state
// This prevents modal from closing or resetting during uploads, category changes, or refetches
type DraftPost = PostFormData & { id: string };

export default function AdminInsights() {
  const { toast } = useToast();
  
  // CREATE modal state - uses formData for new posts
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<PostFormData>(defaultFormData);
  
  // EDIT modal state - completely isolated from parent/query state
  // draftPost is initialized ONCE when opening and NEVER re-synced from queries
  // This is the structural fix: modal owns its own state, immune to refetches
  const [draftPost, setDraftPost] = useState<DraftPost | null>(null);
  
  // Upload state - shared between create and edit modes
  const [isUploading, setIsUploading] = useState(false);

  const { data: postsResponse, isLoading } = useQuery<{ success: boolean; posts: Post[] }>({
    queryKey: ["/api/admin/posts"],
  });

  // Upload image to Object Storage
  // Updates the appropriate state based on which modal is open (create vs edit)
  // This is a PURE FILE OPERATION - does NOT trigger save, does NOT close modal
  const handleImageUpload = async (file: File, isEditMode: boolean) => {
    // Validate file type client-side
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, WebP, or AVIF image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append("image", file);

      const response = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: uploadData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      const result = await response.json();
      const imageUrlWithCacheBust = `${result.url}?v=${Date.now()}`;
      console.log("[AdminInsights] Image uploaded:", imageUrlWithCacheBust, "isEditMode:", isEditMode);
      
      // Update the correct state based on which modal is open
      // This keeps upload decoupled from save - image is stored locally until Save is clicked
      if (isEditMode && draftPost) {
        // EDIT mode: update draftPost directly (isolated from parent state)
        setDraftPost(prev => prev ? { ...prev, coverImageUrl: imageUrlWithCacheBust } : null);
      } else {
        // CREATE mode: update createFormData
        setCreateFormData(prev => ({ ...prev, coverImageUrl: imageUrlWithCacheBust }));
      }

      toast({
        title: "Image uploaded",
        description: "Cover image ready. Click Save to apply changes.",
      });
    } catch (error: any) {
      console.error("Image upload failed:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      return apiRequest("POST", "/api/admin/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setIsCreateDialogOpen(false);
      setCreateFormData(defaultFormData);
      toast({ title: "Post created successfully" });
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
      // Close dialog and reset draft only after successful save
      setDraftPost(null);
      toast({ title: "Post updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update post", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Post deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) => {
      return apiRequest("PUT", `/api/admin/posts/${id}`, { isFeatured });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update featured status", description: error.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" }) => {
      return apiRequest("PUT", `/api/admin/posts/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[AdminInsights] Creating post with data:", { 
      ...createFormData, 
      hasCoverImage: !!createFormData.coverImageUrl
    });
    createMutation.mutate(createFormData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftPost) {
      // Submit the draft directly - it contains all current edits including image uploads
      const { id, ...payload } = draftPost;
      console.log("[AdminInsights] Updating post with data:", { 
        id, 
        coverImageUrl: payload.coverImageUrl,
        hasCoverImage: !!payload.coverImageUrl,
        category: payload.category,
      });
      updateMutation.mutate({ id, data: payload });
    }
  };

  // Open edit dialog by creating a DEEP CLONE of the post as draft
  // This draft is NEVER re-synced from queries - modal owns its own state
  const openEditDialog = (post: Post) => {
    // Create draft with deep clone - this is initialized ONCE and never overwritten
    setDraftPost({
      id: post.id,
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
  };

  // Close edit dialog - discard all changes
  const closeEditDialog = () => {
    setDraftPost(null);
  };

  const posts = postsResponse?.posts || [];
  
  // Initialize create form when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      setCreateFormData(defaultFormData);
    }
  }, [isCreateDialogOpen]);

  // NO useEffect for edit modal - draft is initialized in openEditDialog and never re-synced
  // This is the key structural fix: edit modal state is immune to query refetches

  // Helper to update create form fields
  const updateCreateField = <K extends keyof PostFormData>(field: K, value: PostFormData[K]) => {
    setCreateFormData(prev => ({ ...prev, [field]: value }));
  };
  
  // Helper to update draft fields (edit mode)
  const updateDraftField = <K extends keyof PostFormData>(field: K, value: PostFormData[K]) => {
    setDraftPost(prev => prev ? { ...prev, [field]: value } : null);
  };

  // Render form fields - uses the appropriate state based on isEditing flag
  // CREATE mode uses createFormData, EDIT mode uses draftPost
  const renderFormFields = (isEditing: boolean) => {
    // Get the current form data based on mode
    const formData = isEditing ? (draftPost || defaultFormData) : createFormData;
    const updateField = isEditing ? updateDraftField : updateCreateField;
    
    // Title change handler needs special logic for auto-slug generation
    const handleTitleChange = (newTitle: string) => {
      if (isEditing) {
        setDraftPost(prev => prev ? { ...prev, title: newTitle } : null);
      } else {
        setCreateFormData(prev => ({
          ...prev,
          title: newTitle,
          slug: generateSlug(newTitle),
        }));
      }
    };
    
    return (
      <>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              data-testid="input-post-title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
            />
            <FieldHint value={formData.title} limits={VALIDATION_LIMITS.title} label="Title" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              data-testid="input-post-slug"
              value={formData.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="excerpt">Excerpt *</Label>
          <Textarea
            id="excerpt"
            data-testid="input-post-excerpt"
            value={formData.excerpt}
            onChange={(e) => updateField("excerpt", e.target.value)}
            rows={2}
            required
          />
          <FieldHint value={formData.excerpt} limits={VALIDATION_LIMITS.excerpt} label="Excerpt" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            data-testid="input-post-content"
            value={formData.content}
            onChange={(e) => updateField("content", e.target.value)}
            rows={6}
          />
          <div className="text-xs text-muted-foreground">
            Full content is only shown on the post detail page, not in cards.
          </div>
        </div>

        {/* Cover Image Section - upload updates local state only, NOT triggering save */}
        <div className="space-y-3">
          <Label>Cover Image</Label>
          
          {/* Image Preview */}
          {formData.coverImageUrl && (
            <div className="relative w-full max-w-xs aspect-video bg-muted rounded-md overflow-hidden border">
              <img 
                src={formData.coverImageUrl} 
                alt="Cover preview" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            {/* Upload Button - type="button" prevents form submit */}
            <div className="space-y-1">
              <Label htmlFor={`imageUpload-${isEditing ? 'edit' : 'create'}`} className="text-xs text-muted-foreground">Upload Image</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => document.getElementById(`imageUpload-${isEditing ? 'edit' : 'create'}`)?.click()}
                  data-testid="button-upload-image"
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Cover Image
                    </>
                  )}
                </Button>
                {/* Hidden file input - type="button" upload handler prevents form submit */}
                <input
                  id={`imageUpload-${isEditing ? 'edit' : 'create'}`}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file, isEditing);
                      e.target.value = "";
                    }
                  }}
                  data-testid="input-image-file"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Max 5MB. JPEG, PNG, GIF, WebP, AVIF.
              </div>
            </div>

            {/* URL Input */}
            <div className="space-y-1">
              <Label htmlFor="coverImageUrl" className="text-xs text-muted-foreground">Or paste URL</Label>
              <Input
                id="coverImageUrl"
                data-testid="input-post-cover-image"
                value={formData.coverImageUrl}
                onChange={(e) => updateField("coverImageUrl", e.target.value)}
                placeholder="https://..."
              />
              {formData.coverImageUrl && !isValidImageUrl(formData.coverImageUrl) && (
                <div className="text-xs text-yellow-600">
                  URL may not be a valid image format.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Author field */}
        <div className="space-y-1">
          <Label htmlFor="author">Author</Label>
          <Input
            id="author"
            data-testid="input-post-author"
            value={formData.author}
            onChange={(e) => updateField("author", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => updateField("category", value)}
            >
              <SelectTrigger data-testid="select-post-category">
                <SelectValue />
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
              <SelectTrigger data-testid="select-post-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="isFeatured"
            data-testid="switch-post-featured"
            checked={formData.isFeatured}
            onCheckedChange={(checked) => updateField("isFeatured", checked)}
          />
          <Label htmlFor="isFeatured">Featured Post</Label>
        </div>
      </>
    );
  };

  return (
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

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-post">
                <Plus className="h-4 w-4 mr-2" />
                Create New Post
              </Button>
            </DialogTrigger>
            {/* Prevent dialog from closing on outside interactions.
                Image upload must NOT close the modal - it triggers native file picker which
                causes focus events outside the dialog. The modal should only close via
                explicit user action: Cancel or Create Post buttons. */}
            <DialogContent 
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Create New Post</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {renderFormFields(false)}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" data-testid="button-cancel">Cancel</Button>
                  </DialogClose>
                  <Button 
                    type="submit" 
                    data-testid="button-submit-post"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Saving..." : "Create Post"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
                {posts.map((post) => (
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
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        /{post.slug} • {post.category} • {post.author}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-toggle-featured-${post.id}`}
                        onClick={() => toggleFeaturedMutation.mutate({ id: post.id, isFeatured: !post.isFeatured })}
                        title={post.isFeatured ? "Remove from featured" : "Mark as featured"}
                      >
                        <Star className={`h-4 w-4 ${post.isFeatured ? "fill-yellow-500 text-yellow-500" : ""}`} />
                      </Button>

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

                      <Dialog open={draftPost?.id === post.id} onOpenChange={(open) => !open && closeEditDialog()}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-edit-${post.id}`}
                            onClick={() => openEditDialog(post)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        {/* Prevent dialog from closing on outside interactions.
                            Image upload must NOT close the modal - it triggers native file picker which
                            causes focus events outside the dialog. The modal should only close via
                            explicit user action: Cancel or Update Post buttons. */}
                        <DialogContent 
                          className="max-w-2xl max-h-[90vh] overflow-y-auto"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDownOutside={(e) => e.preventDefault()}
                          onInteractOutside={(e) => e.preventDefault()}
                          onEscapeKeyDown={(e) => e.preventDefault()}
                        >
                          <DialogHeader>
                            <DialogTitle>Edit Post</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleEditSubmit} className="space-y-4">
                            {renderFormFields(true)}
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline" data-testid="button-cancel">Cancel</Button>
                              </DialogClose>
                              <Button 
                                type="submit" 
                                data-testid="button-submit-post"
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? "Saving..." : "Update Post"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

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
                            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              data-testid="button-confirm-delete"
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-1">Note: Authentication Required</p>
          <p>This admin page is temporarily accessible without authentication. TODO: Add authentication middleware when login system is complete.</p>
        </div>
      </div>
    </div>
  );
}
