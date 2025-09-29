import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Upload,
  FileText,
  Brain,
  MapPin,
  DollarSign,
  Phone,
  Globe,
  Clock,
  Save,
  Plus,
  X,
  Eye,
  Download,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  useTalentProfile,
  profileFormSchema,
  ProfileFormData,
} from "@/hooks/useTalentProfile";
import { Document } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function ProfileSettings() {
  const { toast } = useToast();
  const authContext = useAuth();
  const user = authContext?.user;

  const {
    profile,
    skills,
    documents,
    availableSkills,
    profileCompletion,
    isLoading,
    isUpdating,
    toggleSkill,
    updateProfile,
    updateSkills,
    getDefaultFormValues,
  } = useTalentProfile();

  const [activeSection, setActiveSection] = useState("basic");

  // Form setup with default values from existing profile
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getDefaultFormValues(),
    values: getDefaultFormValues(), // This ensures form updates when profile data loads
  });

  // Save profile data
  const onSubmit = async (data: ProfileFormData) => {
    if (!authContext?.isAuthenticated || !user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save your profile settings.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Saving Profile Settings...",
      description: "Updating your information.",
    });

    try {
      await updateProfile(data);

      // Update skills if there are any selected skills
      if (skills && skills.length > 0) {
        await updateSkills();
      }

      toast({
        title: "Profile Settings Saved!",
        description: "Your profile information has been updated successfully.",
        duration: 3000,
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Something went wrong";
      toast({
        title: "Unable to Save Settings",
        description: `${errorMessage}. Please try again.`,
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  // Remove document handler
  const removeDocument = async (documentId: string) => {
    try {
      await authAPI.delete(`/api/documents/${documentId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });

      toast({
        title: "Document Removed",
        description: "The document has been removed from your profile.",
      });
    } catch (error: any) {
      console.error("Failed to remove document:", error);
      toast({
        title: "Removal Error",
        description: "Failed to remove the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Upload complete handler
  const handleUploadComplete = async (result: any, type: string) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];

      try {
        const documentData = {
          type: type,
          fileName: file.name,
          fileUrl: file.uploadURL,
          fileSize: file.size || null,
          mimeType: file.type || null,
          isPublic: false,
          isPrimary: false,
        };

        await authAPI.post("/api/documents", documentData);
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });

        toast({
          title: "Document Uploaded",
          description: `Your ${type === "resume" ? "resume" : "video introduction"} has been uploaded successfully.`,
        });
      } catch (error: any) {
        console.error("Failed to save document:", error);
        toast({
          title: "Upload Error",
          description:
            "Document uploaded but failed to save to your profile. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-medium mb-2">Loading your settings</h3>
          <p className="text-muted-foreground">
            Please wait while we load your profile information...
          </p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: "basic", title: "Basic Information", icon: User },
    { id: "professional", title: "Professional Details", icon: Brain },
    { id: "skills", title: "Skills & Expertise", icon: FileText },
    { id: "documents", title: "Documents", icon: Upload },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile information and preferences. Keep your information
          up to date to attract better opportunities.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveSection(section.id)}
                  data-testid={`button-section-${section.id}`}
                >
                  <section.icon className="w-4 h-4 mr-2" />
                  {section.title}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Profile Completion */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Completion
                  </span>
                  <span className="text-sm font-medium">
                    {profileCompletion}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {profileCompletion >= 70
                    ? "Your profile looks great! Ready to attract opportunities."
                    : "Complete your profile to attract more clients."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              {activeSection === "basic" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Basic Information
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Update your personal information and contact details.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your first name"
                                {...field}
                                data-testid="input-first-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your last name"
                                {...field}
                                data-testid="input-last-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your phone number"
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Location
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="City, Country"
                                {...field}
                                data-testid="input-location"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Timezone
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-timezone">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Asia/Manila">
                                  Asia/Manila (GMT+8)
                                </SelectItem>
                                <SelectItem value="America/New_York">
                                  America/New_York (GMT-5)
                                </SelectItem>
                                <SelectItem value="Europe/London">
                                  Europe/London (GMT+0)
                                </SelectItem>
                                <SelectItem value="Asia/Tokyo">
                                  Asia/Tokyo (GMT+9)
                                </SelectItem>
                                <SelectItem value="Australia/Sydney">
                                  Australia/Sydney (GMT+10)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="languages"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Languages
                          </FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              {/* ✅ Display selected languages as chips */}
                              <div className="flex flex-wrap gap-2">
                                {field.value?.map((lang, index) => (
                                  <Badge
                                    key={index}
                                    variant="secondary"
                                    className="flex items-center gap-1 whitespace-nowrap"
                                  >
                                    {lang}
                                    <X
                                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                                      onClick={() => {
                                        const newLangs =
                                          field.value?.filter(
                                            (_, i) => i !== index,
                                          ) || [];
                                        field.onChange(newLangs);
                                      }}
                                    />
                                  </Badge>
                                ))}
                              </div>

                              {/* ✅ Input for adding new languages */}
                              <Input
                                placeholder="Type a language and press Enter"
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    e.currentTarget.value.trim()
                                  ) {
                                    e.preventDefault();
                                    const newLang =
                                      e.currentTarget.value.trim();

                                    // Ensure uniqueness
                                    if (!field.value?.includes(newLang)) {
                                      field.onChange([
                                        ...(field.value || []),
                                        newLang,
                                      ]);
                                    }

                                    e.currentTarget.value = "";
                                  }
                                }}
                                data-testid="input-languages"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Professional Details */}
              {activeSection === "professional" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Professional Details
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Share your professional title, bio, and rates.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Professional Title *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Full Stack Developer, Virtual Assistant"
                              {...field}
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Professional Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell clients about your experience, skills, and what makes you unique..."
                              className="min-h-32"
                              {...field}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {field.value?.length || 0} characters (minimum 50
                            characters recommended)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="hourlyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Hourly Rate
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="25"
                                {...field}
                                data-testid="input-hourly-rate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="rateCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-currency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD ($)</SelectItem>
                                <SelectItem value="PHP">PHP (₱)</SelectItem>
                                <SelectItem value="EUR">EUR (€)</SelectItem>
                                <SelectItem value="GBP">GBP (£)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="availability"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Availability</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-availability">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="available">
                                  Available Now
                                </SelectItem>
                                <SelectItem value="busy">Busy</SelectItem>
                                <SelectItem value="unavailable">
                                  Unavailable
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skills & Expertise */}
              {activeSection === "skills" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Skills & Expertise
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Select your skills to help clients find you for relevant
                      projects.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {skills?.map((skill) => (
                          <Badge
                            key={skill}
                            variant="default"
                            className="flex items-center gap-1"
                          >
                            {skill}
                            <X
                              className="w-3 h-3 cursor-pointer hover:text-destructive"
                              onClick={() => toggleSkill(skill)}
                            />
                          </Badge>
                        ))}
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          Available Skills
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {availableSkills
                            ?.filter(
                              (skill: any) => !skills?.includes(skill.name),
                            )
                            ?.map((skill: any) => (
                              <Badge
                                key={skill.id}
                                variant="outline"
                                className="cursor-pointer hover-elevate"
                                onClick={() => toggleSkill(skill.name)}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                {skill.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents */}
              {activeSection === "documents" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Documents
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Upload your resume and video introduction to showcase your
                      qualifications.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Resume Upload */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Resume / CV</Label>
                      {documents?.filter((doc) => doc.type === "resume")
                        .length > 0 ? (
                        <div className="space-y-2">
                          {documents
                            .filter((doc) => doc.type === "resume")
                            .map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="w-5 h-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">
                                      {doc.fileName}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {(doc as any).fileSize
                                        ? `${Math.round((doc as any).fileSize / 1024)} KB`
                                        : "Unknown size"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" asChild>
                                    <a
                                      href={doc.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeDocument(doc.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={10485760}
                          onGetUploadParameters={async () => ({
                            method: "PUT" as const,
                            url: "/api/object-storage/upload-url",
                          })}
                          onComplete={(result: any) =>
                            handleUploadComplete(result, "resume")
                          }
                          buttonClassName="w-full"
                        >
                          Upload Resume (PDF, DOC, DOCX - max 10MB)
                        </ObjectUploader>
                      )}
                    </div>

                    <Separator />

                    {/* Video Introduction Upload */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">
                        Video Introduction (Optional)
                      </Label>
                      {documents?.filter((doc) => doc.type === "video_intro")
                        .length > 0 ? (
                        <div className="space-y-2">
                          {documents
                            .filter((doc) => doc.type === "video_intro")
                            .map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="w-5 h-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">
                                      {doc.fileName}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {(doc as any).fileSize
                                        ? `${Math.round((doc as any).fileSize / 1024 / 1024)} MB`
                                        : "Unknown size"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" asChild>
                                    <a
                                      href={doc.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeDocument(doc.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={52428800}
                          onGetUploadParameters={async () => ({
                            method: "PUT" as const,
                            url: "/api/object-storage/upload-url",
                          })}
                          onComplete={(result: any) =>
                            handleUploadComplete(result, "video_intro")
                          }
                          buttonClassName="w-full"
                        >
                          Upload Video Introduction (MP4, MOV, AVI, WEBM - max
                          50MB)
                        </ObjectUploader>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-6">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isUpdating}
                  className="min-w-32"
                  data-testid="button-save-settings"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
