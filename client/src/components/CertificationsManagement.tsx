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
import { useToast } from "@/hooks/use-toast";

import { 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Calendar as CalendarIcon, 
  Award,
  X,
  CheckCircle2,
  Clock,
  Shield,
  Star,
  Verified,
  AlertCircle,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Building,
  FileText,
  Loader2,
  Crown,
  Medal,
  Trophy,
  Sparkles,
  Globe
} from "lucide-react";

import { cn } from "@/lib/utils";
import { type Certification, type InsertCertification } from "@shared/schema";

// Certification form validation schema
const certificationFormSchema = z.object({
  name: z.string().min(3, "Certification name must be at least 3 characters"),
  issuer: z.string().min(2, "Issuer name is required"),
  credentialId: z.string().optional(),
  credentialUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
  dateIssued: z.date(),
  dateExpires: z.date().optional(),
  isVerified: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  skills: z.array(z.string()).optional()
});

type CertificationFormData = z.infer<typeof certificationFormSchema>;

interface CertificationsManagementProps {
  talentId?: string;
  mode?: "full" | "embedded";
  onCertificationAdded?: (certification: Certification) => void;
}

const CERTIFICATION_CATEGORIES = [
  { id: "technical", name: "Technical", icon: "💻", color: "bg-blue-500" },
  { id: "cloud", name: "Cloud Platforms", icon: "☁️", color: "bg-sky-500" },
  { id: "security", name: "Security", icon: "🔒", color: "bg-red-500" },
  { id: "project_management", name: "Project Management", icon: "📋", color: "bg-green-500" },
  { id: "design", name: "Design", icon: "🎨", color: "bg-purple-500" },
  { id: "data", name: "Data & Analytics", icon: "📊", color: "bg-orange-500" },
  { id: "business", name: "Business", icon: "💼", color: "bg-gray-500" },
  { id: "other", name: "Other", icon: "🏆", color: "bg-yellow-500" }
];

const POPULAR_CERTIFICATIONS = [
  { name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", category: "cloud" },
  { name: "Certified Kubernetes Administrator", issuer: "Cloud Native Computing Foundation", category: "technical" },
  { name: "Google Cloud Professional", issuer: "Google Cloud", category: "cloud" },
  { name: "Microsoft Azure Fundamentals", issuer: "Microsoft", category: "cloud" },
  { name: "Certified Ethical Hacker", issuer: "EC-Council", category: "security" },
  { name: "PMP - Project Management Professional", issuer: "Project Management Institute", category: "project_management" },
  { name: "Scrum Master Certified", issuer: "Scrum Alliance", category: "project_management" },
  { name: "Adobe Certified Expert", issuer: "Adobe", category: "design" },
  { name: "Certified Analytics Professional", issuer: "INFORMS", category: "data" },
  { name: "Salesforce Certified Administrator", issuer: "Salesforce", category: "business" }
];

export default function CertificationsManagement({ talentId, mode = "full", onCertificationAdded }: CertificationsManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingCertification, setEditingCertification] = useState<Certification | null>(null);
  const [deletingCertificationId, setDeletingCertificationId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const userId = talentId || user?.id;

  // Fetch certifications
  const { data: certifications = [], isLoading, error } = useQuery<Certification[]>({
    queryKey: ['/api/talents', userId, 'certifications'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      const response = await fetch(`/api/talents/${userId}/certifications`);
      if (!response.ok) throw new Error('Failed to fetch certifications');
      return response.json();
    },
    enabled: !!userId
  });

  // Form setup
  const form = useForm<CertificationFormData>({
    resolver: zodResolver(certificationFormSchema),
    defaultValues: {
      name: "",
      issuer: "",
      credentialId: "",
      credentialUrl: "",
      description: "",
      dateIssued: new Date(),
      dateExpires: undefined,
      isVerified: false,
      isPublic: true,
      skills: []
    }
  });

  // Create certification mutation
  const createMutation = useMutation({
    mutationFn: async (data: CertificationFormData) => {
      return apiRequest('POST', '/api/certifications', {
        ...data,
        talentId: userId,
        dateIssued: data.dateIssued.toISOString(),
        dateExpires: data.dateExpires?.toISOString() || null
      });
    },
    onSuccess: (newCertification) => {
      queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'certifications'] });
      setIsCreateDialogOpen(false);
      setIsQuickAddOpen(false);
      form.reset();
      onCertificationAdded?.(newCertification);
      toast({
        title: "Certification Added! 🏆",
        description: "Your certification has been successfully added to your profile."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add certification. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update certification mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CertificationFormData> }) => {
      return apiRequest('PUT', `/api/certifications/${id}`, {
        ...data,
        dateIssued: data.dateIssued?.toISOString(),
        dateExpires: data.dateExpires?.toISOString() || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'certifications'] });
      setEditingCertification(null);
      form.reset();
      toast({
        title: "Updated Successfully",
        description: "Your certification has been updated."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update certification. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete certification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/certifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talents', userId, 'certifications'] });
      setDeletingCertificationId(null);
      toast({
        title: "Certification Removed",
        description: "The certification has been removed from your profile."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove certification. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: CertificationFormData) => {
    if (editingCertification) {
      updateMutation.mutate({ id: editingCertification.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (certification: Certification) => {
    setEditingCertification(certification);
    form.reset({
      name: certification.name,
      issuer: certification.issuer,
      credentialId: certification.credentialId || "",
      credentialUrl: certification.credentialUrl || "",
      description: certification.description || "",
      dateIssued: new Date(certification.dateIssued),
      dateExpires: certification.dateExpires ? new Date(certification.dateExpires) : undefined,
      isVerified: certification.isVerified,
      isPublic: certification.isPublic,
      skills: certification.skills || []
    });
    setIsCreateDialogOpen(true);
  };

  const handleQuickAdd = (popularCert: typeof POPULAR_CERTIFICATIONS[0]) => {
    form.reset({
      name: popularCert.name,
      issuer: popularCert.issuer,
      dateIssued: new Date(),
      isPublic: true,
      isVerified: false
    });
    setIsQuickAddOpen(false);
    setIsCreateDialogOpen(true);
  };

  const getCertificationIcon = (certification: Certification) => {
    if (certification.isVerified) return <Verified className="w-4 h-4 text-blue-500" />;
    if (certification.credentialUrl) return <LinkIcon className="w-4 h-4 text-green-500" />;
    return <Award className="w-4 h-4 text-muted-foreground" />;
  };

  const filteredCertifications = certifications.filter(cert => 
    selectedCategory === "all" || 
    CERTIFICATION_CATEGORIES.find(cat => cat.id === selectedCategory)?.name.toLowerCase().includes(cert.issuer.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Section */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary-dark/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  Professional Certifications
                </CardTitle>
                <p className="text-muted-foreground">
                  Showcase your expertise with verified credentials
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="hover-elevate" data-testid="button-quick-add-cert">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Quick Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Popular Certifications</DialogTitle>
                    <DialogDescription>
                      Choose from popular certifications to add quickly
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {POPULAR_CERTIFICATIONS.map((cert, index) => {
                      const category = CERTIFICATION_CATEGORIES.find(cat => cat.id === cert.category);
                      return (
                        <Card 
                          key={index}
                          className="cursor-pointer hover-elevate transition-all duration-200"
                          onClick={() => handleQuickAdd(cert)}
                          data-testid={`quick-cert-${index}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", category?.color)}>
                                <span className="text-sm">{category?.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{cert.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{cert.issuer}</div>
                                <Badge variant="outline" className="text-xs mt-1">
                                  {category?.name}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary-dark hover-elevate" data-testid="button-add-certification">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Certification
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCertification ? "Edit Certification" : "Add New Certification"}
                    </DialogTitle>
                    <DialogDescription>
                      Add professional certifications to showcase your expertise
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Certification Name *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., AWS Certified Solutions Architect" 
                                  {...field} 
                                  data-testid="input-cert-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="issuer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Issuing Organization *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., Amazon Web Services" 
                                  {...field} 
                                  data-testid="input-cert-issuer"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="credentialId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credential ID</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., AWS-ASA-123456" 
                                  {...field} 
                                  data-testid="input-credential-id"
                                />
                              </FormControl>
                              <FormDescription>
                                Optional credential identifier
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="credentialUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credential URL</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://..." 
                                  {...field} 
                                  data-testid="input-credential-url"
                                />
                              </FormControl>
                              <FormDescription>
                                Link to verify your credential
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe what this certification covers and its significance..." 
                                className="min-h-20"
                                {...field} 
                                data-testid="textarea-cert-description"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="dateIssued"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Date Issued *</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      data-testid="button-date-issued"
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                      date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dateExpires"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Expiration Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      data-testid="button-date-expires"
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>No expiration</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                Leave empty if the certification doesn't expire
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="isVerified"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <Verified className="w-4 h-4 text-blue-500" />
                                  Verified Credential
                                </FormLabel>
                                <FormDescription>
                                  Mark as verified if you have official documentation
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-verified"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isPublic"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <Globe className="w-4 h-4 text-green-500" />
                                  Public Visibility
                                </FormLabel>
                                <FormDescription>
                                  Show this certification on your public profile
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-public"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-between pt-4">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setIsCreateDialogOpen(false);
                            setEditingCertification(null);
                            form.reset();
                          }}
                          data-testid="button-cancel-cert"
                        >
                          Cancel
                        </Button>
                        
                        <Button 
                          type="submit" 
                          disabled={createMutation.isPending || updateMutation.isPending}
                          className="bg-success hover:bg-success/90 text-white hover-elevate"
                          data-testid="button-save-cert"
                        >
                          {createMutation.isPending || updateMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {editingCertification ? "Update" : "Add"} Certification
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {certifications.length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                <span>{certifications.length} certifications</span>
              </div>
              <div className="flex items-center gap-1">
                <Verified className="w-4 h-4" />
                <span>{certifications.filter(c => c.isVerified).length} verified</span>
              </div>
              <div className="flex items-center gap-1">
                <LinkIcon className="w-4 h-4" />
                <span>{certifications.filter(c => c.credentialUrl).length} with links</span>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Category Filter */}
      {certifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className="hover-elevate"
            data-testid="filter-all"
          >
            All ({certifications.length})
          </Button>
          {CERTIFICATION_CATEGORIES.map(category => {
            const count = certifications.filter(cert => 
              cert.issuer.toLowerCase().includes(category.name.toLowerCase())
            ).length;
            
            if (count === 0) return null;
            
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="hover-elevate"
                data-testid={`filter-${category.id}`}
              >
                <span className="mr-1">{category.icon}</span>
                {category.name} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* Certifications Grid */}
      {filteredCertifications.length > 0 ? (
        <div className="grid gap-4">
          {filteredCertifications.map((certification) => (
            <Card 
              key={certification.id} 
              className="hover-elevate transition-all duration-200"
              data-testid={`cert-card-${certification.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {getCertificationIcon(certification)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-lg leading-tight">
                              {certification.name}
                            </h3>
                            <p className="text-muted-foreground flex items-center gap-2 mt-1">
                              <Building className="w-4 h-4" />
                              {certification.issuer}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {certification.isVerified && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Verified className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                            {!certification.isPublic && (
                              <Badge variant="outline" className="bg-gray-50">
                                <EyeOff className="w-3 h-3 mr-1" />
                                Private
                              </Badge>
                            )}
                          </div>
                        </div>

                        {certification.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {certification.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-4 h-4" />
                            <span>Issued {format(new Date(certification.dateIssued), "MMM yyyy")}</span>
                          </div>
                          {certification.dateExpires && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Expires {format(new Date(certification.dateExpires), "MMM yyyy")}</span>
                            </div>
                          )}
                          {certification.credentialId && (
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              <span className="font-mono text-xs">{certification.credentialId}</span>
                            </div>
                          )}
                        </div>

                        {certification.credentialUrl && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(certification.credentialUrl!, '_blank')}
                              className="hover-elevate"
                              data-testid={`verify-link-${certification.id}`}
                            >
                              <ExternalLink className="w-3 h-3 mr-2" />
                              Verify Credential
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(certification)}
                      className="hover-elevate"
                      data-testid={`edit-cert-${certification.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingCertificationId(certification.id)}
                      className="hover-elevate text-destructive hover:text-destructive"
                      data-testid={`delete-cert-${certification.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Certifications Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Showcase your professional expertise by adding certifications. They help clients trust your skills and expertise.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setIsQuickAddOpen(true)}
                variant="outline"
                className="hover-elevate"
                data-testid="button-empty-quick-add"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Browse Popular Certifications
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-primary hover:bg-primary-dark hover-elevate"
                data-testid="button-empty-add-custom"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Certification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCertificationId} onOpenChange={() => setDeletingCertificationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Certification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this certification from your profile? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCertificationId && deleteMutation.mutate(deletingCertificationId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove Certification"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}