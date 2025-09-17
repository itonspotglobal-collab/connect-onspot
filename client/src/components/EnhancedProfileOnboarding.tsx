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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Download,
  Camera,
  Trash2,
  Sparkles,
  Trophy,
  TrendingUp,
  Users,
  Shield,
  Zap,
  ArrowRight,
  ChevronRight,
  Lightbulb,
  Medal,
  Crown,
  Gift
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useTalentProfile, profileFormSchema, ProfileFormData } from "@/hooks/useTalentProfile";
import LinkedInImport from "@/components/LinkedInImport";
import ResumeParser from "@/components/ResumeParser";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ProfileStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  estimatedTime: string;
  points: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  points: number;
}

interface EnhancedProfileOnboardingProps {
  mode?: "full" | "embedded";
  onComplete?: () => void;
  defaultStep?: number;
  className?: string;
}

const PROFILE_STEPS: ProfileStep[] = [
  {
    id: "import",
    title: "Auto-Import",
    description: "Import from LinkedIn or Resume",
    icon: <Download className="w-5 h-5" />,
    required: false,
    estimatedTime: "2 min",
    points: 100
  },
  {
    id: "basic",
    title: "Basic Info",
    description: "Name, title, and location",
    icon: <User className="w-5 h-5" />,
    required: true,
    estimatedTime: "3 min",
    points: 150
  },
  {
    id: "professional",
    title: "Professional",
    description: "Bio, rates, and availability",
    icon: <Briefcase className="w-5 h-5" />,
    required: true,
    estimatedTime: "5 min",
    points: 200
  },
  {
    id: "skills",
    title: "Skills",
    description: "Expertise and proficiency",
    icon: <Brain className="w-5 h-5" />,
    required: true,
    estimatedTime: "4 min",
    points: 175
  },
  {
    id: "portfolio",
    title: "Portfolio",
    description: "Showcase your work",
    icon: <Star className="w-5 h-5" />,
    required: false,
    estimatedTime: "8 min",
    points: 250
  },
  {
    id: "certifications",
    title: "Certifications",
    description: "Professional credentials",
    icon: <Award className="w-5 h-5" />,
    required: false,
    estimatedTime: "5 min",
    points: 200
  },
  {
    id: "video",
    title: "Video Intro",
    description: "Personal introduction",
    icon: <Play className="w-5 h-5" />,
    required: false,
    estimatedTime: "10 min",
    points: 300
  }
];

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_steps",
    title: "Getting Started",
    description: "Complete basic information",
    icon: <User className="w-4 h-4" />,
    unlocked: false,
    points: 50
  },
  {
    id: "skill_master",
    title: "Skill Master",
    description: "Add 5+ skills to your profile",
    icon: <Brain className="w-4 h-4" />,
    unlocked: false,
    points: 100
  },
  {
    id: "portfolio_pro",
    title: "Portfolio Pro",
    description: "Add your first portfolio item",
    icon: <Star className="w-4 h-4" />,
    unlocked: false,
    points: 150
  },
  {
    id: "certified_talent",
    title: "Certified Talent",
    description: "Add professional certifications",
    icon: <Award className="w-4 h-4" />,
    unlocked: false,
    points: 125
  },
  {
    id: "video_star",
    title: "Video Star",
    description: "Create video introduction",
    icon: <Play className="w-4 h-4" />,
    unlocked: false,
    points: 200
  },
  {
    id: "profile_complete",
    title: "Profile Complete",
    description: "Achieve 100% profile completion",
    icon: <Crown className="w-4 h-4" />,
    unlocked: false,
    points: 500
  }
];

export default function EnhancedProfileOnboarding({ 
  mode = "full", 
  onComplete, 
  defaultStep = 0, 
  className 
}: EnhancedProfileOnboardingProps) {
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
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showImportOptions, setShowImportOptions] = useState(true);
  const [importCompleted, setImportCompleted] = useState(false);

  // Form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getDefaultFormValues()
  });

  // Reset form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset(getDefaultFormValues());
    }
  }, [profile, form, getDefaultFormValues]);

  // Calculate profile strength and achievements
  useEffect(() => {
    updateAchievements();
  }, [profile, skills, documents, profileCompletion]);

  const updateAchievements = () => {
    const updatedAchievements = achievements.map(achievement => {
      let unlocked = achievement.unlocked;
      
      switch (achievement.id) {
        case "first_steps":
          unlocked = !!(profile?.firstName && profile?.lastName && profile?.title);
          break;
        case "skill_master":
          unlocked = (skills?.length || 0) >= 5;
          break;
        case "portfolio_pro":
          // This would be checked against portfolio items when implemented
          unlocked = false;
          break;
        case "certified_talent":
          // This would be checked against certifications when implemented
          unlocked = false;
          break;
        case "video_star":
          unlocked = documents?.some(doc => doc.type === "video_intro") || false;
          break;
        case "profile_complete":
          unlocked = profileCompletion >= 100;
          break;
      }
      
      return { ...achievement, unlocked };
    });

    setAchievements(updatedAchievements);
    
    const points = updatedAchievements
      .filter(achievement => achievement.unlocked)
      .reduce((sum, achievement) => sum + achievement.points, 0);
    setTotalPoints(points);
  };

  const handleStepComplete = (stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]));
    
    // Show achievement if first time completing step
    if (!completedSteps.has(stepIndex)) {
      const step = PROFILE_STEPS[stepIndex];
      toast({
        title: "Step Completed! 🎉",
        description: `You earned ${step.points} points for completing ${step.title}`,
      });
    }
    
    if (stepIndex < PROFILE_STEPS.length - 1) {
      setCurrentStep(stepIndex + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const handleImportComplete = (importedData: any) => {
    setImportCompleted(true);
    setShowImportOptions(false);
    setCurrentStep(1); // Move to basic info step
    
    toast({
      title: "Import Successful! 🚀",
      description: "Your profile has been auto-populated. Review and complete remaining sections.",
    });
  };

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) return "completed";
    if (stepIndex === currentStep) return "current";
    if (stepIndex < currentStep) return "completed";
    return "pending";
  };

  const calculateStepProgress = (stepId: string) => {
    switch (stepId) {
      case "basic":
        return profile?.firstName && profile?.lastName && profile?.title ? 100 : 0;
      case "professional":
        return profile?.bio && profile?.hourlyRate ? 100 : 50;
      case "skills":
        return (skills?.length || 0) >= 3 ? 100 : (skills?.length || 0) * 33;
      case "portfolio":
        // Portfolio progress would be calculated here
        return 0;
      case "certifications":
        // Certifications progress would be calculated here
        return 0;
      case "video":
        return documents?.some(doc => doc.type === "video_intro") ? 100 : 0;
      default:
        return 0;
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile(data);
      if (skills && skills.length > 0) {
        await updateSkills();
      }
      
      handleStepComplete(currentStep);
    } catch (error) {
      toast({
        title: "Error updating profile",
        description: "Please try again later.",
        variant: "destructive"
      });
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

  return (
    <div className={cn("w-full", className)}>
      {mode === "full" && (
        <div className="mb-8">
          {/* Header with Progress and Achievements */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                Complete Your Profile
              </h1>
              <p className="text-muted-foreground mt-2">
                Build a compelling profile that attracts amazing opportunities
              </p>
            </div>
            
            {/* Profile Strength Indicator */}
            <div className="text-right">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-muted opacity-20"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={`${profileCompletion * 1.76} 176`}
                      className="text-primary transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{profileCompletion}%</span>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-lg">{totalPoints} pts</div>
                  <div className="text-sm text-muted-foreground">Profile Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Step Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Profile Sections</h3>
              <div className="text-sm text-muted-foreground">
                {completedSteps.size} of {PROFILE_STEPS.length} completed
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PROFILE_STEPS.map((step, index) => {
                const status = getStepStatus(index);
                const progress = calculateStepProgress(step.id);
                
                return (
                  <Card 
                    key={step.id}
                    className={cn(
                      "cursor-pointer transition-all duration-300 hover-elevate",
                      status === "current" && "ring-2 ring-primary shadow-lg",
                      status === "completed" && "bg-success/5 border-success/20"
                    )}
                    onClick={() => setCurrentStep(index)}
                    data-testid={`step-card-${step.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          status === "completed" ? "bg-success text-white" :
                          status === "current" ? "bg-primary text-white" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {status === "completed" ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{step.title}</div>
                          <div className="text-xs text-muted-foreground">{step.estimatedTime}</div>
                        </div>
                        {step.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                      
                      {status !== "pending" && (
                        <div className="space-y-1">
                          <Progress value={progress} className="h-1" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{progress}% complete</span>
                            <span className="text-primary font-medium">+{step.points} pts</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Achievement Showcase */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Achievements</h3>
              <Badge variant="secondary" className="ml-auto">
                {achievements.filter(a => a.unlocked).length} / {achievements.length}
              </Badge>
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-2">
              {achievements.map((achievement) => (
                <Card 
                  key={achievement.id}
                  className={cn(
                    "flex-shrink-0 w-48 transition-all duration-300",
                    achievement.unlocked 
                      ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-md" 
                      : "opacity-50 grayscale"
                  )}
                >
                  <CardContent className="p-4 text-center">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2",
                      achievement.unlocked 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-400 text-white" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {achievement.unlocked ? <Trophy className="w-6 h-6" /> : achievement.icon}
                    </div>
                    <div className="font-medium text-sm mb-1">{achievement.title}</div>
                    <div className="text-xs text-muted-foreground mb-2">{achievement.description}</div>
                    <div className="text-xs font-medium text-yellow-600">+{achievement.points} pts</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-8">
        {/* Step 0: Auto-Import */}
        {currentStep === 0 && showImportOptions && (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary-dark/5">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  Skip the Forms, Import Instantly
                </CardTitle>
                <p className="text-muted-foreground text-lg">
                  Save 15+ minutes by importing your professional data automatically
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <LinkedInImport 
                    onImportComplete={handleImportComplete}
                    onSkip={() => setCurrentStep(1)}
                  />
                  <ResumeParser 
                    onParseComplete={handleImportComplete}
                    onSkip={() => setCurrentStep(1)}
                  />
                </div>
                
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(1)}
                    className="hover-elevate"
                    data-testid="button-skip-import"
                  >
                    Skip Import & Fill Manually
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <Card className="animate-slide-up" data-testid="card-basic-info">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <p className="text-muted-foreground">
                    Tell us about yourself and your professional background
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
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
                          <FormLabel>Last Name *</FormLabel>
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
                        <FormLabel>Professional Title *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Senior Full-Stack Developer" 
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Manila, Philippines" 
                            {...field} 
                            data-testid="input-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setCurrentStep(0)}
                      className="hover-elevate"
                      data-testid="button-back-to-import"
                    >
                      Back to Import
                    </Button>
                    
                    <Button 
                      type="submit" 
                      disabled={isUpdating}
                      className="hover-elevate"
                      data-testid="button-continue-basic"
                    >
                      {isUpdating ? "Saving..." : "Continue"}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Professional Details */}
        {currentStep === 2 && (
          <Card className="animate-slide-up" data-testid="card-professional-details">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Professional Details</CardTitle>
                  <p className="text-muted-foreground">
                    Share your experience and what you bring to clients
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Professional Bio *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell clients about your experience, expertise, and what makes you unique..." 
                            className="min-h-32"
                            {...field} 
                            data-testid="textarea-bio"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate (USD) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="50" 
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
                      name="availability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Availability *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger data-testid="select-availability">
                              <SelectValue placeholder="Select availability" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="available">Available now</SelectItem>
                              <SelectItem value="busy">Busy</SelectItem>
                              <SelectItem value="unavailable">Unavailable</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setCurrentStep(1)}
                      className="hover-elevate"
                      data-testid="button-back-to-basic"
                    >
                      Back
                    </Button>
                    
                    <Button 
                      type="submit" 
                      disabled={isUpdating}
                      className="hover-elevate"
                      data-testid="button-continue-professional"
                    >
                      {isUpdating ? "Saving..." : "Continue"}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Skills */}
        {currentStep === 3 && (
          <Card className="animate-slide-up" data-testid="card-skills">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Skills & Expertise</CardTitle>
                  <p className="text-muted-foreground">
                    Add skills that showcase your capabilities
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {skills && skills.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Your Skills ({skills.length})</h3>
                    <Badge variant="secondary">
                      {skills.length >= 5 ? "Great!" : `Add ${5 - skills.length} more`}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {skills.map((userSkill) => (
                      <Badge key={userSkill.id} variant="default" className="text-sm py-2 px-3">
                        {userSkill.skill?.name} 
                        <span className="ml-1 opacity-70">({userSkill.level})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No Skills Added Yet</h3>
                  <p className="text-muted-foreground">Add skills to showcase your expertise</p>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-medium">Add More Skills</h4>
                {availableSkills && availableSkills.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {availableSkills.slice(0, 12).map((skill) => {
                      const isSelected = skills?.some(us => us.skillId === skill.id);
                      return (
                        <Button
                          key={skill.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleSkill(skill.id)}
                          className="justify-start hover-elevate"
                          data-testid={`skill-${skill.id}`}
                        >
                          {skill.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep(2)}
                  className="hover-elevate"
                  data-testid="button-back-to-professional"
                >
                  Back
                </Button>
                
                <Button 
                  onClick={() => handleStepComplete(3)}
                  disabled={!skills || skills.length === 0}
                  className="hover-elevate"
                  data-testid="button-continue-skills"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Portfolio */}
        {currentStep === 4 && (
          <Card className="animate-slide-up" data-testid="card-portfolio">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Portfolio & Projects</CardTitle>
                  <p className="text-muted-foreground">
                    Showcase your best work to attract clients
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Portfolio Management</h3>
                <p className="text-muted-foreground mb-4">
                  Add portfolio items to showcase your best work and attract high-value clients
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Upload project images and screenshots</p>
                  <p>✓ Add project descriptions and links</p>
                  <p>✓ Tag skills used in each project</p>
                  <p>✓ Set completion dates</p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep(3)}
                  className="hover-elevate"
                  data-testid="button-back-to-skills"
                >
                  Back
                </Button>
                
                <Button 
                  onClick={() => handleStepComplete(4)}
                  className="hover-elevate"
                  data-testid="button-continue-portfolio"
                >
                  Continue (Add Later)
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Certifications */}
        {currentStep === 5 && (
          <Card className="animate-slide-up" data-testid="card-certifications">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Professional Certifications</CardTitle>
                  <p className="text-muted-foreground">
                    Add certifications to build credibility and trust
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Certifications Management</h3>
                <p className="text-muted-foreground mb-4">
                  Add professional certifications to showcase your expertise and build trust with clients
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>🏆 Professional certifications from recognized organizations</p>
                  <p>🔗 Verification links and credential IDs</p>
                  <p>📅 Issue and expiration date tracking</p>
                  <p>✨ Verified badge for completed certifications</p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep(4)}
                  className="hover-elevate"
                  data-testid="button-back-to-portfolio"
                >
                  Back
                </Button>
                
                <Button 
                  onClick={() => handleStepComplete(5)}
                  className="hover-elevate"
                  data-testid="button-continue-certifications"
                >
                  Continue (Add Later)
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Video Introduction */}
        {currentStep === 6 && (
          <Card className="animate-slide-up" data-testid="card-video-intro">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Play className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Video Introduction</CardTitle>
                  <p className="text-muted-foreground">
                    Create a personal connection with potential clients
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {documents?.some(doc => doc.type === "video_intro") ? (
                <div className="text-center py-8 bg-success/5 border border-success/20 rounded-lg">
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                  <h3 className="font-medium text-success mb-2">Video Introduction Added!</h3>
                  <p className="text-muted-foreground">
                    Your video introduction is ready and will help you stand out to clients
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <Play className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">Video Introduction</h3>
                    <p className="text-muted-foreground mb-4">
                      Stand out from the crowd with a personal video introduction
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>🎥 30-60 second professional introduction</p>
                      <p>🎯 Tell clients about your expertise and passion</p>
                      <p>📈 Profiles with videos get 5x more client interest</p>
                      <p>💡 Tips and guidelines provided for best results</p>
                    </div>
                  </div>

                  <Alert className="border-primary/20 bg-primary/5">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <AlertDescription className="text-primary">
                      <strong>Pro Tip:</strong> Profiles with video introductions get 60% more client views and 5x higher hire rates!
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep(5)}
                  className="hover-elevate"
                  data-testid="button-back-to-certifications"
                >
                  Back
                </Button>
                
                <Button 
                  onClick={() => handleStepComplete(6)}
                  className="bg-success hover:bg-success/90 text-white hover-elevate"
                  data-testid="button-complete-profile"
                >
                  Complete Profile Setup
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Motivational Side Panel for Full Mode */}
      {mode === "full" && (
        <Card className="mt-8 bg-gradient-to-br from-success/5 to-emerald/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-success mb-2">Pro Tips for Success</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✨ Complete profiles get 10x more client views</p>
                  <p>🎯 Add a professional photo to increase trust by 40%</p>
                  <p>🚀 Video introductions boost hiring rate by 60%</p>
                  <p>💰 Detailed portfolios command 25% higher rates</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}