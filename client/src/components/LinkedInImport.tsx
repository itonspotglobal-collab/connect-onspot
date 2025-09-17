import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Linkedin, 
  CheckCircle2, 
  Download, 
  User, 
  Briefcase, 
  GraduationCap, 
  Award,
  MapPin,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Link as LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkedInImportProps {
  onImportComplete?: (importedData: any) => void;
  onSkip?: () => void;
  className?: string;
}

interface LinkedInStatus {
  isConnected: boolean;
  lastSync: string | null;
  profileUrl: string | null;
}

interface LinkedInProfile {
  profileData: {
    firstName: string;
    lastName: string;
    headline: string;
    summary: string;
    location: string;
    profilePictureUrl: string | null;
    skills: string[];
    experience: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }>;
    education: Array<{
      degree: string;
      school: string;
      year: string;
    }>;
  };
  lastSync: string;
}

export default function LinkedInImport({ onImportComplete, onSkip, className }: LinkedInImportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importStep, setImportStep] = useState<'connect' | 'preview' | 'importing' | 'complete'>('connect');
  const [previewData, setPreviewData] = useState<any>(null);

  // Fetch LinkedIn connection status
  const { data: linkedinStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<LinkedInStatus>({
    queryKey: ['/api/linkedin/status', user?.id],
    enabled: !!user?.id
  });

  // LinkedIn connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/linkedin/connect', { userId: user?.id });
    },
    onSuccess: (data) => {
      if (data.status === 'connected' || data.status === 'already_connected') {
        setImportStep('preview');
        setPreviewData(data.linkedinProfile);
        refetchStatus();
        toast({
          title: "LinkedIn Connected Successfully!",
          description: "Your LinkedIn profile data is ready to import.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: "Unable to connect to LinkedIn. Please try again.",
        variant: "destructive"
      });
    }
  });

  // LinkedIn import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/linkedin/import-profile', { userId: user?.id });
    },
    onSuccess: (data) => {
      setImportStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/user', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'skills'] });
      
      toast({
        title: "Profile Imported Successfully!",
        description: `Imported ${data.importedData.skills} skills and professional information.`,
      });
      
      onImportComplete?.(data.importedData);
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Unable to import LinkedIn data. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const handleImport = () => {
    setImportStep('importing');
    importMutation.mutate();
  };

  const handleSkip = () => {
    onSkip?.();
  };

  if (statusLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Checking LinkedIn connection...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connection Step
  if (importStep === 'connect' && !linkedinStatus?.isConnected) {
    return (
      <Card className={cn("w-full animate-slide-up", className)} data-testid="card-linkedin-import">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0077B5] to-[#005885] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Linkedin className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#0077B5] to-[#005885] bg-clip-text text-transparent">
            Import from LinkedIn
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            Skip the forms and import your professional profile instantly
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Basic Information</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Work Experience</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Skills & Expertise</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Education</span>
            </div>
          </div>

          <Alert className="border-[#0077B5]/20 bg-[#0077B5]/5">
            <Sparkles className="w-4 h-4 text-[#0077B5]" />
            <AlertDescription className="text-[#0077B5]">
              <strong>Save 15+ minutes:</strong> Import your complete professional profile with one click instead of filling out lengthy forms.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="flex-1 bg-[#0077B5] hover:bg-[#005885] text-white hover-elevate"
              size="lg"
              data-testid="button-connect-linkedin"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Linkedin className="w-4 h-4 mr-2" />
                  Connect LinkedIn
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1 sm:flex-none hover-elevate"
              data-testid="button-skip-linkedin"
            >
              Skip for now
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>🔒 Your LinkedIn data is secure and only used to populate your OnSpot profile</p>
            <p>We never post to your LinkedIn account or contact your connections</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preview Step
  if (importStep === 'preview' && previewData) {
    const profileData = previewData.profileData;
    
    return (
      <Card className={cn("w-full animate-slide-up", className)} data-testid="card-linkedin-preview">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <CardTitle className="text-xl">LinkedIn Data Ready</CardTitle>
              <p className="text-muted-foreground">
                Review and import your professional information
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Preview Data */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <User className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium">Personal Information</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{profileData.firstName} {profileData.lastName}</strong><br />
                  {profileData.headline}<br />
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {profileData.location}
                </p>
              </div>
            </div>

            {profileData.summary && (
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <User className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium">Professional Summary</h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                    {profileData.summary}
                  </p>
                </div>
              </div>
            )}

            {profileData.skills && profileData.skills.length > 0 && (
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <Award className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium">Skills ({profileData.skills.length})</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profileData.skills.slice(0, 8).map((skill: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {profileData.skills.length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{profileData.skills.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {profileData.experience && profileData.experience.length > 0 && (
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <Briefcase className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium">Work Experience ({profileData.experience.length})</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Latest: {profileData.experience[0]?.title} at {profileData.experience[0]?.company}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Last synced: {new Date(previewData.lastSync).toLocaleDateString()}</span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetchStatus()}
              className="hover-elevate"
              data-testid="button-refresh-linkedin"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleImport}
              className="flex-1 bg-success hover:bg-success/90 text-white hover-elevate"
              size="lg"
              data-testid="button-import-linkedin"
            >
              <Download className="w-4 h-4 mr-2" />
              Import to OnSpot Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1 sm:flex-none hover-elevate"
              data-testid="button-skip-import"
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Importing Step
  if (importStep === 'importing') {
    return (
      <Card className={cn("w-full", className)} data-testid="card-linkedin-importing">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Importing Your Profile</h3>
              <p className="text-muted-foreground">
                Mapping your LinkedIn data to your OnSpot profile...
              </p>
            </div>

            <Progress value={75} className="w-full max-w-sm mx-auto" />

            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ Personal information imported</p>
              <p>✓ Skills and expertise mapped</p>
              <p>⏳ Experience and education processing...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Complete Step
  if (importStep === 'complete') {
    return (
      <Card className={cn("w-full", className)} data-testid="card-linkedin-complete">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2 text-success">Import Complete!</h3>
              <p className="text-muted-foreground">
                Your LinkedIn data has been successfully imported to your OnSpot profile.
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-medium text-lg">85%</div>
                <div className="text-muted-foreground">Profile Complete</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-lg">12</div>
                <div className="text-muted-foreground">Skills Added</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-lg">3</div>
                <div className="text-muted-foreground">Experiences</div>
              </div>
            </div>

            <Button 
              onClick={() => onImportComplete?.({})}
              className="bg-success hover:bg-success/90 text-white hover-elevate"
              size="lg"
              data-testid="button-continue-profile"
            >
              Continue Building Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Already Connected State
  if (linkedinStatus?.isConnected) {
    return (
      <Card className={cn("w-full", className)} data-testid="card-linkedin-connected">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#0077B5]/10 rounded-lg flex items-center justify-center">
              <Linkedin className="w-6 h-6 text-[#0077B5]" />
            </div>
            <div>
              <CardTitle className="text-lg">LinkedIn Connected</CardTitle>
              <p className="text-muted-foreground text-sm">
                Your LinkedIn profile is connected and ready to import
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profile URL:</span>
            <div className="flex items-center gap-2">
              <LinkIcon className="w-3 h-3" />
              <span className="font-mono text-xs">{linkedinStatus.profileUrl}</span>
            </div>
          </div>
          
          {linkedinStatus.lastSync && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last synced:</span>
              <span>{new Date(linkedinStatus.lastSync).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={() => setImportStep('preview')}
              className="flex-1 bg-[#0077B5] hover:bg-[#005885] text-white hover-elevate"
              data-testid="button-import-now"
            >
              <Download className="w-4 h-4 mr-2" />
              Import Now
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="hover-elevate"
              data-testid="button-skip-connected"
            >
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}