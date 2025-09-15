import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";

// Profile Form Schema
const profileFormSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  title: z.string().min(5, "Professional title is required"),
  bio: z.string().min(50, "Bio must be at least 50 characters"),
  location: z.string().min(2, "Location is required"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  rateCurrency: z.string().default("USD"),
  availability: z.string().default("available"),
  phoneNumber: z.string().optional(),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  timezone: z.string().default("Asia/Manila")
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface AssessmentQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "text" | "rating";
  options?: string[];
  required: boolean;
}

interface Assessment {
  id: number;
  type: string;
  title: string;
  description: string;
  questions: AssessmentQuestion[];
  duration: number;
}

interface JobApplication {
  id: string;
  jobTitle: string;
  company: string;
  status: string;
  appliedAt: string;
  salary?: number;
  salaryCurrency?: string;
}

export default function GetHired() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);

  // Form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      title: "",
      bio: "",
      location: "Manila, Philippines",
      hourlyRate: "",
      rateCurrency: "USD",
      availability: "available",
      phoneNumber: "",
      languages: ["English"],
      timezone: "Asia/Manila"
    }
  });

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user
  });

  // Fetch available skills
  const { data: skills = [] } = useQuery({
    queryKey: ["/api/skills"]
  });

  // Fetch assessments
  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"]
  });

  // Fetch job applications
  const { data: jobApplications = [] } = useQuery<JobApplication[]>({
    queryKey: ["/api/job-applications"],
    enabled: !!user
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
    enabled: !!user
  });

  // Create/Update Profile Mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return profile 
        ? apiRequest(`/api/profile/${(profile as any).id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiRequest("/api/profile", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setCurrentStep(2);
    }
  });

  // LinkedIn Connect Mutation
  const linkedinMutation = useMutation({
    mutationFn: async () => {
      // In a real app, this would initiate LinkedIn OAuth flow
      return apiRequest("/api/linkedin/connect", { method: "POST" });
    },
    onSuccess: () => {
      setIsLinkedInConnected(true);
    }
  });

  // Assessment Start Mutation
  const startAssessmentMutation = useMutation({
    mutationFn: async (assessmentId: number) => {
      return apiRequest(`/api/assessments/${assessmentId}/start`, { method: "POST" });
    }
  });

  // Calculate profile completion
  useEffect(() => {
    let completion = 0;
    const fields = form.getValues();
    
    if (fields.firstName && fields.lastName) completion += 15;
    if (fields.title) completion += 15;
    if (fields.bio && fields.bio.length >= 50) completion += 15;
    if (fields.location) completion += 10;
    if (fields.hourlyRate) completion += 10;
    if (selectedSkills.length >= 3) completion += 15;
    if (uploadedDocuments.some(d => d.type === "resume")) completion += 10;
    if (uploadedDocuments.some(d => d.type === "video_intro")) completion += 10;
    
    setProfileCompletion(completion);
  }, [form.watch(), selectedSkills, uploadedDocuments]);

  // Skills management
  const toggleSkill = (skillName: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillName)
        ? prev.filter(s => s !== skillName)
        : [...prev, skillName]
    );
  };

  // File upload handlers
  const handleResumeUpload = async () => {
    const response = await apiRequest("/api/objects/upload", { method: "POST" });
    return {
      method: "PUT" as const,
      url: response.uploadURL
    };
  };

  const handleUploadComplete = (result: any, type: string) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      setUploadedDocuments(prev => [...prev, {
        id: Math.random().toString(),
        type,
        fileName: file.name,
        fileUrl: file.uploadURL,
        createdAt: new Date().toISOString()
      }]);
    }
  };

  // Profile form submission
  const onSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Get Hired on OnSpot</h1>
              <p className="text-muted-foreground mt-2">
                Complete your profile and start landing amazing opportunities
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
      </div>

      <div className="container mx-auto px-4 py-8">
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

                    {/* Skills Selection */}
                    <div>
                      <Label className="text-base font-medium">Skills ({selectedSkills.length} selected)</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        Select skills that best represent your expertise
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(skills as any[]).slice(0, 20).map((skill: any) => (
                          <Badge
                            key={skill.id}
                            variant={selectedSkills.includes(skill.name) ? "default" : "outline"}
                            className="cursor-pointer hover-elevate"
                            onClick={() => toggleSkill(skill.name)}
                            data-testid={`skill-${skill.name.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {skill.name}
                            {selectedSkills.includes(skill.name) && <CheckCircle2 className="w-3 h-3 ml-1" />}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={profileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {profileMutation.isPending ? "Saving..." : "Save Profile & Continue"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LinkedIn Integration */}
          <TabsContent value="2" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Linkedin className="w-5 h-5" />
                  LinkedIn Profile Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isLinkedInConnected ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <Linkedin className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Connect Your LinkedIn Profile</h3>
                    <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                      Import your professional experience, education, and recommendations from LinkedIn 
                      to quickly build your OnSpot profile. This helps clients verify your background 
                      and increases your credibility.
                    </p>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Import work experience</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Verify education</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Import recommendations</span>
                        </div>
                      </div>
                      <Button 
                        onClick={() => linkedinMutation.mutate()}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-connect-linkedin"
                      >
                        <Linkedin className="w-4 h-4 mr-2" />
                        Connect with LinkedIn
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4 text-green-600">LinkedIn Connected!</h3>
                    <p className="text-muted-foreground mb-6">
                      Your LinkedIn profile has been successfully connected and verified.
                    </p>
                    <Badge variant="secondary" className="mb-4">
                      Profile Verified
                    </Badge>
                    <div className="flex justify-center gap-4">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Imported Data
                      </Button>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View LinkedIn Profile
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Upload */}
          <TabsContent value="3" className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Resume Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Resume Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    Upload your most recent resume. We'll automatically extract your experience and skills.
                  </p>
                  
                  {uploadedDocuments.filter(d => d.type === "resume").length === 0 ? (
                    <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h4 className="font-medium mb-2">Upload Your Resume</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports PDF, DOC, DOCX (Max 10MB)
                      </p>
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={10485760}
                        onGetUploadParameters={handleResumeUpload}
                        onComplete={(result) => handleUploadComplete(result, "resume")}
                      >
                        <div className="flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Upload Resume
                        </div>
                      </ObjectUploader>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {uploadedDocuments.filter(d => d.type === "resume").map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Video Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Video Introduction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    Record a 60-90 second video introducing yourself and your skills to potential clients.
                  </p>
                  
                  {uploadedDocuments.filter(d => d.type === "video_intro").length === 0 ? (
                    <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                      <Play className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h4 className="font-medium mb-2">Upload Video Introduction</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        MP4, MOV, AVI (Max 100MB, 60-90 seconds)
                      </p>
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={104857600}
                        onGetUploadParameters={handleResumeUpload}
                        onComplete={(result) => handleUploadComplete(result, "video_intro")}
                      >
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          Upload Video
                        </div>
                      </ObjectUploader>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {uploadedDocuments.filter(d => d.type === "video_intro").map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Play className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Play className="w-4 h-4 mr-1" />
                              Preview
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assessments */}
          <TabsContent value="4" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Skills & Personality Assessments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-8">
                  Complete assessments to showcase your skills and work style to potential clients.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Writing Assessment */}
                  <Card className="border-2">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Writing Assessment</h3>
                            <p className="text-sm text-muted-foreground">30 minutes</p>
                          </div>
                        </div>
                        <Badge variant="outline">Recommended</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-4">
                        Demonstrate your written communication skills through various writing exercises.
                      </p>
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Grammar & spelling</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Clarity & coherence</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Professional tone</span>
                        </div>
                      </div>
                      <Button 
                        className="w-full"
                        onClick={() => startAssessmentMutation.mutate(1)}
                        data-testid="button-start-writing-assessment"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Start Assessment
                      </Button>
                    </CardContent>
                  </Card>

                  {/* DISC Assessment */}
                  <Card className="border-2">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Brain className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">DISC Profile Assessment</h3>
                            <p className="text-sm text-muted-foreground">15 minutes</p>
                          </div>
                        </div>
                        <Badge variant="outline">Popular</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-4">
                        Discover your work style and communication preferences to help clients understand how you collaborate.
                      </p>
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Work style preferences</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Communication style</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Team collaboration</span>
                        </div>
                      </div>
                      <Button 
                        className="w-full"
                        onClick={() => startAssessmentMutation.mutate(2)}
                        data-testid="button-start-disc-assessment"
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        Start Assessment
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Completed Assessments */}
                <Separator className="my-8" />
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Completed Assessments
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Technical Skills Assessment</p>
                          <p className="text-sm text-muted-foreground">Completed on March 15, 2024</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">92%</p>
                        <p className="text-xs text-muted-foreground">Top 10%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Job Matching */}
          <TabsContent value="5" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Smart Job Matching
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">AI-Powered Job Matching</h3>
                  <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Our smart matching algorithm analyzes your skills, experience, work style, and preferences 
                    to find the perfect job opportunities for you.
                  </p>
                </div>

                {/* Matching Criteria */}
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="border-2">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <Brain className="w-6 h-6 text-blue-600" />
                      </div>
                      <h4 className="font-semibold mb-2">Skills-Based Matching</h4>
                      <p className="text-sm text-muted-foreground">
                        Matches based on your technical skills and experience level
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-2">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <h4 className="font-semibold mb-2">Compensation Matching</h4>
                      <p className="text-sm text-muted-foreground">
                        Finds opportunities that meet your rate and budget expectations
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-2">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-purple-600" />
                      </div>
                      <h4 className="font-semibold mb-2">Work Style Compatibility</h4>
                      <p className="text-sm text-muted-foreground">
                        Considers your DISC profile and communication preferences
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recommended Jobs */}
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Recommended for You
                  </h3>
                  <div className="space-y-4">
                    <Card className="border-2 border-primary/20">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-lg">Full Stack Developer</h4>
                            <p className="text-muted-foreground">Tech Startup Inc.</p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                Remote
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                $40-60/hr
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Full-time
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-primary/10 text-primary">95% Match</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          We're looking for a skilled full-stack developer to join our growing team...
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">React</Badge>
                            <Badge variant="secondary">Node.js</Badge>
                            <Badge variant="secondary">PostgreSQL</Badge>
                            <span className="text-xs text-muted-foreground">+3 more</span>
                          </div>
                          <Button size="sm" data-testid="button-apply-job">
                            Apply Now
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Application Tracking */}
          <TabsContent value="6" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Job Application Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Track all your job applications and their status in one place.
                </p>

                {/* Application Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">12</div>
                      <div className="text-sm text-muted-foreground">Total Applied</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">5</div>
                      <div className="text-sm text-muted-foreground">Under Review</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">2</div>
                      <div className="text-sm text-muted-foreground">Interviewed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">1</div>
                      <div className="text-sm text-muted-foreground">Hired</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Applications List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Recent Applications</h3>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add External Application
                    </Button>
                  </div>

                  {jobApplications.length === 0 ? (
                    <div className="text-center py-12">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h4 className="font-medium mb-2">No Applications Yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start applying to jobs to track your progress here.
                      </p>
                      <Button data-testid="button-browse-jobs">
                        Browse Available Jobs
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {jobApplications.map((application) => (
                        <Card key={application.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{application.jobTitle}</h4>
                                <p className="text-sm text-muted-foreground">{application.company}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Applied {new Date(application.appliedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge 
                                  variant={
                                    application.status === "hired" ? "default" :
                                    application.status === "interviewed" ? "secondary" :
                                    application.status === "under_review" ? "outline" : "destructive"
                                  }
                                >
                                  {application.status.replace("_", " ")}
                                </Badge>
                                {application.salary && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    ${application.salary.toLocaleString()}/year
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}