import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";

import { 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Calendar as CalendarIcon, 
  Upload,
  X,
  Eye,
  EyeOff,
  Link,
  Tag,
  FileImage,
  Loader2
} from "lucide-react";

import { type PortfolioItem, type InsertPortfolioItem } from "@shared/schema";

// Portfolio form validation schema
const portfolioFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  projectUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  skills: z.array(z.string()).min(1, "Please select at least one skill"),
  completionDate: z.date().optional(),
  isPublic: z.boolean().default(true),
  imageUrls: z.array(z.string()).optional()
});

type PortfolioFormData = z.infer<typeof portfolioFormSchema>;

interface PortfolioManagementProps {
  talentId?: string;
}

export default function PortfolioManagement({ talentId }: PortfolioManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);

  const userId = talentId || user?.id;

  // Fetch portfolio items
  const { data: portfolioItems = [], isLoading, error } = useQuery<PortfolioItem[]>({
    queryKey: ['/api/talents', userId, 'portfolio'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      const response = await fetch(`/api/talents/${userId}/portfolio`);
      if (!response.ok) throw new Error('Failed to fetch portfolio');
      return response.json();
    },
    enabled: !!userId
  });

  // Fetch available skills for the form
  const { data: availableSkills = [] } = useQuery({
    queryKey: ['/api/skills'],
    queryFn: async () => {
      const response = await fetch('/api/skills');
      if (!response.ok) throw new Error('Failed to fetch skills');
      return response.json();
    }
  });

  // Form for create/edit
  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: {
      title: "",
      description: "",
      projectUrl: "",
      skills: [],
      isPublic: true,
      imageUrls: []
    }
  });

  // Create portfolio item mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertPortfolioItem) => {
      return apiRequest(`/api/portfolio`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'portfolio'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Portfolio item created successfully!"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create portfolio item"
      });
    }
  });

  // Update portfolio item mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertPortfolioItem> }) => {
      return apiRequest(`/api/portfolio/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'portfolio'] });
      setEditingItem(null);
      form.reset();
      toast({
        title: "Success",
        description: "Portfolio item updated successfully!"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update portfolio item"
      });
    }
  });

  // Delete portfolio item mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/portfolio/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'portfolio'] });
      setDeletingItemId(null);
      toast({
        title: "Success",
        description: "Portfolio item deleted successfully!"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete portfolio item"
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: PortfolioFormData) => {
    if (!userId) return;

    const portfolioData: InsertPortfolioItem = {
      talentId: userId,
      title: data.title,
      description: data.description,
      projectUrl: data.projectUrl || null,
      skills: data.skills,
      completionDate: data.completionDate || null,
      isPublic: data.isPublic,
      imageUrls: data.imageUrls || []
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: portfolioData });
    } else {
      createMutation.mutate(portfolioData);
    }
  };

  // Handle image upload
  const handleImageUpload = async () => {
    try {
      const response = await fetch('/api/object-storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `portfolio-${userId}-${Date.now()}.jpg`,
          contentType: 'image/jpeg'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, objectUrl } = await response.json();
      
      return {
        method: 'PUT' as const,
        url: uploadUrl,
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleUploadComplete = (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const newImageUrls = result.successful.map((file: any) => {
        // Extract the object URL from the upload result
        const objectUrl = file.response?.uploadURL?.split('?')[0] || file.uploadURL?.split('?')[0];
        return objectUrl;
      }).filter(Boolean);

      const currentImages = form.getValues('imageUrls') || [];
      form.setValue('imageUrls', [...currentImages, ...newImageUrls]);
      
      toast({
        title: "Success",
        description: `${newImageUrls.length} image(s) uploaded successfully!`
      });
    }
  };

  // Handle edit
  const handleEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    form.reset({
      title: item.title,
      description: item.description || "",
      projectUrl: item.projectUrl || "",
      skills: item.skills || [],
      completionDate: item.completionDate ? new Date(item.completionDate) : undefined,
      isPublic: item.isPublic ?? true,
      imageUrls: item.imageUrls || []
    });
  };

  // Remove image from form
  const removeImage = (imageUrl: string) => {
    const currentImages = form.getValues('imageUrls') || [];
    form.setValue('imageUrls', currentImages.filter(url => url !== imageUrl));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Portfolio</h2>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full rounded-t-lg" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load portfolio items.</p>
        <Button 
          variant="outline" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'portfolio'] })}
          className="mt-2"
          data-testid="button-retry-portfolio"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold" data-testid="text-portfolio-title">Portfolio</h2>
          <p className="text-muted-foreground">
            Showcase your best work to attract clients
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-portfolio">
              <Plus className="h-4 w-4 mr-2" />
              Add Portfolio Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Portfolio Item</DialogTitle>
              <DialogDescription>
                Add a new project to showcase your skills and experience
              </DialogDescription>
            </DialogHeader>
            <PortfolioForm
              form={form}
              availableSkills={availableSkills}
              onSubmit={onSubmit}
              isSubmitting={createMutation.isPending}
              onImageUpload={handleImageUpload}
              onUploadComplete={handleUploadComplete}
              onRemoveImage={removeImage}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Portfolio Grid */}
      {portfolioItems.length === 0 ? (
        <EmptyState onAddClick={() => setIsCreateDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolioItems.map((item) => (
            <PortfolioCard
              key={item.id}
              item={item}
              onEdit={() => handleEdit(item)}
              onDelete={() => setDeletingItemId(item.id)}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Portfolio Item</DialogTitle>
            <DialogDescription>
              Update your project details
            </DialogDescription>
          </DialogHeader>
          <PortfolioForm
            form={form}
            availableSkills={availableSkills}
            onSubmit={onSubmit}
            isSubmitting={updateMutation.isPending}
            onImageUpload={handleImageUpload}
            onUploadComplete={handleUploadComplete}
            onRemoveImage={removeImage}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portfolio Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this portfolio item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItemId && deleteMutation.mutate(deletingItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Portfolio Card Component
function PortfolioCard({ 
  item, 
  onEdit, 
  onDelete 
}: { 
  item: PortfolioItem; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const primaryImage = item.imageUrls?.[0];
  
  return (
    <Card className="group hover-elevate" data-testid={`card-portfolio-${item.id}`}>
      {primaryImage && (
        <div className="relative aspect-video overflow-hidden rounded-t-lg">
          <img
            src={primaryImage}
            alt={item.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            data-testid={`img-portfolio-${item.id}`}
          />
          <div className="absolute top-2 right-2">
            {item.isPublic ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Eye className="h-3 w-3 mr-1" />
                Public
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                <EyeOff className="h-3 w-3 mr-1" />
                Private
              </Badge>
            )}
          </div>
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg leading-tight" data-testid={`text-portfolio-title-${item.id}`}>
              {item.title}
            </h3>
            {item.completionDate && (
              <p className="text-sm text-muted-foreground">
                Completed {format(new Date(item.completionDate), 'MMM yyyy')}
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-portfolio-description-${item.id}`}>
            {item.description}
          </p>

          {item.skills && item.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.skills.slice(0, 3).map((skill, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {item.skills.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{item.skills.length - 3} more
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {item.projectUrl && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                data-testid={`button-view-project-${item.id}`}
              >
                <a href={item.projectUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Project
                </a>
              </Button>
            )}
            
            <div className="flex gap-1 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                data-testid={`button-edit-portfolio-${item.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
                data-testid={`button-delete-portfolio-${item.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Portfolio Form Component
function PortfolioForm({
  form,
  availableSkills,
  onSubmit,
  isSubmitting,
  onImageUpload,
  onUploadComplete,
  onRemoveImage
}: {
  form: any;
  availableSkills: any[];
  onSubmit: (data: PortfolioFormData) => void;
  isSubmitting: boolean;
  onImageUpload: () => Promise<any>;
  onUploadComplete: (result: any) => void;
  onRemoveImage: (imageUrl: string) => void;
}) {
  const watchedImages = form.watch('imageUrls') || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Title *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter project title" 
                  {...field} 
                  data-testid="input-portfolio-title"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your project, the challenges you faced, and the solutions you implemented..."
                  className="min-h-[120px]"
                  {...field}
                  data-testid="textarea-portfolio-description"
                />
              </FormControl>
              <FormDescription>
                Provide details about the project scope, your role, and key achievements
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="projectUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://example.com"
                  {...field}
                  data-testid="input-portfolio-url"
                />
              </FormControl>
              <FormDescription>
                Link to live project, GitHub repository, or demo
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="skills"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Skills Used *</FormLabel>
              <Select onValueChange={(value) => {
                if (value && !field.value.includes(value)) {
                  field.onChange([...field.value, value]);
                }
              }}>
                <SelectTrigger data-testid="select-portfolio-skills">
                  <SelectValue placeholder="Add skills used in this project" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.name}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.value.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {field.value.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {skill}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => {
                          const newSkills = field.value.filter((s: string) => s !== skill);
                          field.onChange(newSkills);
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="completionDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Completion Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-portfolio-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, 'PPP') : 'Select completion date'}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image Upload Section */}
        <div className="space-y-4">
          <FormLabel>Project Images</FormLabel>
          
          <ObjectUploader
            maxNumberOfFiles={5}
            maxFileSize={10485760} // 10MB
            onGetUploadParameters={onImageUpload}
            onComplete={onUploadComplete}
            buttonClassName="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Images
          </ObjectUploader>

          {watchedImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {watchedImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Portfolio image ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemoveImage(imageUrl)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Public Visibility</FormLabel>
                <FormDescription>
                  Make this portfolio item visible to potential clients
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-portfolio-public"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              // Close dialog logic should be handled by parent component
            }}
            data-testid="button-cancel-portfolio"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-save-portfolio"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Portfolio Item
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Empty State Component
function EmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <Card className="text-center py-12">
      <CardContent>
        <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-portfolio-title">
          No Portfolio Items Yet
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Showcase your best work to attract clients. Add your first portfolio item to get started.
        </p>
        <Button onClick={onAddClick} data-testid="button-add-first-portfolio">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Project
        </Button>
      </CardContent>
    </Card>
  );
}