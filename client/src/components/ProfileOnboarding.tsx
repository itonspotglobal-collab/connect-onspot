import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  User,
  Upload,
  Play,
  FileText,
  Brain,
  Target,
  CheckCircle2,
  Clock,
  Star,
  Award,
  Briefcase,
  MapPin,
  DollarSign,
  ExternalLink,
  Linkedin,
  Plus,
  X,
  Eye,
  Download
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useTalentProfile, profileFormSchema, ProfileFormData } from "@/hooks/useTalentProfile";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ProfileOnboardingProps {
  mode?: "full" | "embedded";
  onComplete?: () => void;
  defaultStep?: number;
  className?: string;
}

export default function ProfileOnboarding({ 
  mode = "full", 
  onComplete, 
  defaultStep = 1, 
  className 
}: ProfileOnboardingProps) {
  const { toast } = useToast();
  const {
    profile,
    skills,
    documents,
    availableSkills,
    profileCompletion,
    isLoading,
    isUpdating,
    toggleSkill,
    addDocument,
    removeDocument,
    updateProfile,
    updateSkills,
    uploadDocument,
    getDefaultFormValues
  } = useTalentProfile();

  const [currentStep, setCurrentStep] = useState(defaultStep);
  const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);

  // Form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getDefaultFormValues()
  });

  // Reset form when profile data loads (only when profile changes, not on every render)
  useEffect(() => {
    if (profile) {
      form.reset(getDefaultFormValues());
    }
  }, [profile, form, getDefaultFormValues]);

  // File upload handlers
  const handleResumeUpload = async () => {
    // FIXED: Use correct object storage upload URL
    return {
      method: "PUT" as const,
      url: "/api/object-storage/upload-url" // Fixed to match backend endpoint
    };
  };

  const handleUploadComplete = (result: any, type: string) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const newDocument = {
        id: Math.random().toString(),
        type: type as any,
        fileName: file.name,
        fileUrl: file.uploadURL,
        createdAt: new Date().toISOString()
      };
      addDocument(newDocument);
      uploadDocument(newDocument);
    }
  };

  // Profile form submission
  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile(data);
      if (skills && skills.length > 0) {
        await updateSkills();
      }
      
      toast({
        title: "Profile updated successfully!",
        description: "Your professional profile has been saved."
      });
      
      if (mode === "embedded" && profileCompletion >= 70) {
        onComplete?.();
      } else if (mode === "full") {
        setCurrentStep(2);
      }
    } catch (error) {
      toast({
        title: "Error updating profile",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  const handleStepComplete = (step: number) => {
    if (step < 6) {
      setCurrentStep(step + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const isCompact = mode === "embedded";
  const showTabs = mode === "full";

  return (
    <div className={cn("w-full", className)}>
      {mode === "full" && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Complete Your Profile</h1>
              <p className="text-muted-foreground mt-2">
                Build a compelling profile that attracts amazing opportunities
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-2">Profile Completion</div>
              <div className="flex items-center gap-3">
                <Progress value={profileCompletion} className="w-32" />
                <span className="text-2xl font-bold text-primary">{profileCompletion}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTabs ? (
        <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="1" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="2" className="flex items-center gap-2">
              <Linkedin className="w-4 h-4" />
              LinkedIn
            </TabsTrigger>
            <TabsTrigger value="3" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="4" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Assessments
            </TabsTrigger>
            <TabsTrigger value="5" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Matching
            </TabsTrigger>
            <TabsTrigger value="6" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Applications
            </TabsTrigger>
          </TabsList>

          {/* Profile Creation */}
          <TabsContent value="1" className="space-y-8">
            <ProfileStep 
              form={form}
              onSubmit={onSubmit}
              skills={skills || []}
              availableSkills={Array.isArray(availableSkills) ? availableSkills : []}
              toggleSkill={toggleSkill}
              isUpdating={isUpdating}
              isCompact={isCompact}
            />
          </TabsContent>

          {/* LinkedIn Connection */}
          <TabsContent value="2" className="space-y-8">
            <LinkedInStep 
              isConnected={isLinkedInConnected}
              onConnect={() => setIsLinkedInConnected(true)}
              onComplete={() => handleStepComplete(2)}
            />
          </TabsContent>

          {/* Documents Upload */}
          <TabsContent value="3" className="space-y-8">
            <DocumentsStep 
              documents={documents || []}
              onUploadComplete={handleUploadComplete}
              onRemoveDocument={removeDocument}
              onComplete={() => handleStepComplete(3)}
              onGetUploadParameters={handleResumeUpload}
            />
          </TabsContent>

          {/* Assessments */}
          <TabsContent value="4" className="space-y-8">
            <AssessmentsStep 
              onComplete={() => handleStepComplete(4)}
            />
          </TabsContent>

          {/* Matching Preferences */}
          <TabsContent value="5" className="space-y-8">
            <MatchingStep 
              onComplete={() => handleStepComplete(5)}
            />
          </TabsContent>

          {/* Job Applications */}
          <TabsContent value="6" className="space-y-8">
            <ApplicationsStep 
              onComplete={() => handleStepComplete(6)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        // Embedded mode - show condensed profile form
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Complete Your Profile</h2>
            <div className="flex items-center gap-2">
              <Progress value={profileCompletion} className="w-24" />
              <span className="text-sm font-medium">{profileCompletion}%</span>
            </div>
          </div>
          
          <ProfileStep 
            form={form}
            onSubmit={onSubmit}
            skills={skills || []}
            availableSkills={Array.isArray(availableSkills) ? availableSkills : []}
            toggleSkill={toggleSkill}
            isUpdating={isUpdating}
            isCompact={true}
          />
        </div>
      )}
    </div>
  );
}

// Profile Step Component
interface ProfileStepProps {
  form: any;
  onSubmit: (data: ProfileFormData) => void;
  skills: string[];
  availableSkills: any[];
  toggleSkill: (skill: string) => void;
  isUpdating: boolean;
  isCompact: boolean;
}

function ProfileStep({ form, onSubmit, skills, availableSkills, toggleSkill, isUpdating, isCompact }: ProfileStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Professional Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} data-testid="input-first-name" />
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Full Stack Developer" {...field} data-testid="input-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isCompact && (
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
                        data-testid="textarea-bio"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Manila, Philippines" {...field} data-testid="input-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate (USD)</FormLabel>
                    <FormControl>
                      <Input placeholder="25" type="number" {...field} data-testid="input-hourly-rate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger data-testid="select-timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Manila">Asia/Manila (PHT)</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                          <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                          <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                          <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability Status</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger data-testid="select-availability">
                          <SelectValue placeholder="Select availability" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available for work</SelectItem>
                          <SelectItem value="busy">Busy with projects</SelectItem>
                          <SelectItem value="offline">Not available</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Skills Selection */}
            <div>
              <Label className="text-base font-medium">Skills ({skills.length} selected)</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Select skills that best represent your expertise
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {availableSkills.slice(0, isCompact ? 10 : 20).map((skill: any) => (
                  <Badge
                    key={skill.id}
                    variant={skills.includes(skill.name) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate"
                    onClick={() => toggleSkill(skill.name)}
                    data-testid={`skill-${skill.name.toLowerCase().replace(' ', '-')}`}
                  >
                    {skill.name}
                    {skills.includes(skill.name) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isUpdating} data-testid="button-save-profile">
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Other step components (simplified for space)
function LinkedInStep({ isConnected, onConnect, onComplete }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Linkedin className="w-5 h-5" />
          Connect LinkedIn (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Connect your LinkedIn profile to import your professional experience and enhance your profile.
        </p>
        <div className="flex gap-4">
          <Button onClick={onConnect} disabled={isConnected}>
            {isConnected ? "Connected" : "Connect LinkedIn"}
          </Button>
          <Button variant="outline" onClick={onComplete}>
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentsStep({ documents, onUploadComplete, onRemoveDocument, onComplete, onGetUploadParameters }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Upload Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-3">Resume/CV</h3>
            <ObjectUploader
              maxFileSize={10485760}
              onGetUploadParameters={onGetUploadParameters}
              onComplete={(result) => onUploadComplete(result, 'resume')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Resume
            </ObjectUploader>
          </div>
          <div>
            <h3 className="font-medium mb-3">Video Introduction (Optional)</h3>
            <ObjectUploader
              maxFileSize={52428800}
              onGetUploadParameters={onGetUploadParameters}
              onComplete={(result) => onUploadComplete(result, 'video_intro')}
            >
              <Play className="w-4 h-4 mr-2" />
              Upload Video
            </ObjectUploader>
          </div>
        </div>
        
        <Button onClick={onComplete}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function AssessmentsStep({ onComplete }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Skills Assessments (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Take assessments to showcase your skills and increase your profile visibility.
        </p>
        <Button onClick={onComplete}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function MatchingStep({ onComplete }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Job Matching Preferences (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Set your preferences to receive better job matches.
        </p>
        <Button onClick={onComplete}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function ApplicationsStep({ onComplete }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          You're All Set!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Your profile is ready! You can now start applying to jobs and building your freelance career.
        </p>
        <Button onClick={onComplete}>
          Start Exploring Jobs
        </Button>
      </CardContent>
    </Card>
  );
}