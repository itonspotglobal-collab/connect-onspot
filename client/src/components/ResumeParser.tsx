import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Briefcase, 
  GraduationCap, 
  Award,
  MapPin,
  Mail,
  Phone,
  Loader2,
  Download,
  X,
  Eye,
  ArrowRight,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeParserProps {
  onParseComplete?: (parsedData: any) => void;
  onSkip?: () => void;
  className?: string;
}

interface ParsedData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title: string;
    location: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    year: string;
  }>;
}

export default function ResumeParser({ onParseComplete, onSkip, className }: ResumeParserProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parseStep, setParseStep] = useState<'upload' | 'parsing' | 'preview' | 'complete'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');

  // File text extraction
  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (file.type === 'text/plain') {
          resolve(result);
        } else {
          // For other file types, we'll just use the basic text content
          // In a real implementation, you might use PDF.js or mammoth.js
          resolve(result);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type === 'text/plain') {
        reader.readAsText(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  // Resume parsing mutation
  const parseMutation = useMutation({
    mutationFn: async (resumeText: string) => {
      return apiRequest('POST', '/api/resume/parse', { 
        resumeText, 
        userId: user?.id 
      });
    },
    onSuccess: (data) => {
      setParsedData(data.parsedData);
      setParseStep('preview');
      toast({
        title: "Resume Parsed Successfully!",
        description: "Your resume data has been extracted and is ready for review.",
      });
    },
    onError: (error) => {
      toast({
        title: "Parsing Failed",
        description: "Unable to parse resume. Please try again or enter information manually.",
        variant: "destructive"
      });
      setParseStep('upload');
    }
  });

  // Dropzone configuration
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setParseStep('parsing');

    try {
      const text = await extractTextFromFile(file);
      setExtractedText(text);
      parseMutation.mutate(text);
    } catch (error) {
      toast({
        title: "File Error",
        description: "Unable to read the file. Please try a different format.",
        variant: "destructive"
      });
      setParseStep('upload');
    }
  }, [parseMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleApplyData = () => {
    if (parsedData) {
      setParseStep('complete');
      onParseComplete?.(parsedData);
      toast({
        title: "Data Applied Successfully!",
        description: "Your resume data has been applied to your profile.",
      });
    }
  };

  const handleReparse = () => {
    if (extractedText) {
      setParseStep('parsing');
      parseMutation.mutate(extractedText);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  // Upload Step
  if (parseStep === 'upload') {
    return (
      <Card className={cn("w-full animate-slide-up", className)} data-testid="card-resume-parser">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            Import from Resume
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            Upload your resume and we'll automatically extract your information
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Contact Information</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Work Experience</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Skills & Technologies</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Education & Certifications</span>
            </div>
          </div>

          <Alert className="border-primary/20 bg-primary/5">
            <Sparkles className="w-4 h-4 text-primary" />
            <AlertDescription className="text-primary">
              <strong>Smart parsing:</strong> Our AI extracts key information from your resume automatically, saving you time and ensuring accuracy.
            </AlertDescription>
          </Alert>

          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            )}
            data-testid="dropzone-resume"
          >
            <input {...getInputProps()} />
            
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            
            {isDragActive ? (
              <div>
                <p className="text-lg font-medium text-primary">Drop your resume here</p>
                <p className="text-muted-foreground">Release to upload and parse</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop your resume here</p>
                <p className="text-muted-foreground mb-4">or click to browse files</p>
                <Button variant="outline" size="sm" className="hover-elevate">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Supported formats:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">PDF</Badge>
              <Badge variant="outline" className="text-xs">DOC</Badge>
              <Badge variant="outline" className="text-xs">DOCX</Badge>
              <Badge variant="outline" className="text-xs">TXT</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1 hover-elevate"
              data-testid="button-skip-resume"
            >
              Skip Resume Upload
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>🔒 Your resume is processed securely and not stored permanently</p>
            <p>Only extracted data is saved to build your OnSpot profile</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parsing Step
  if (parseStep === 'parsing') {
    return (
      <Card className={cn("w-full", className)} data-testid="card-resume-parsing">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Parsing Your Resume</h3>
              <p className="text-muted-foreground">
                Extracting your professional information using AI...
              </p>
            </div>

            {uploadedFile && (
              <div className="flex items-center justify-center gap-3 text-sm">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-medium">{uploadedFile.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </Badge>
              </div>
            )}

            <Progress value={60} className="w-full max-w-sm mx-auto" />

            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ File uploaded and processed</p>
              <p>✓ Text extracted successfully</p>
              <p>⏳ Analyzing content and structure...</p>
              <p>⏳ Extracting professional information...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preview Step
  if (parseStep === 'preview' && parsedData) {
    return (
      <Card className={cn("w-full animate-slide-up", className)} data-testid="card-resume-preview">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <CardTitle className="text-xl">Resume Parsed Successfully</CardTitle>
              <p className="text-muted-foreground">
                Review the extracted information and apply to your profile
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
              <TabsTrigger value="skills" className="text-xs">Skills</TabsTrigger>
              <TabsTrigger value="experience" className="text-xs">Experience</TabsTrigger>
              <TabsTrigger value="education" className="text-xs">Education</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm">{parsedData.personalInfo.firstName} {parsedData.personalInfo.lastName}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Professional Title</label>
                  <p className="text-sm">{parsedData.personalInfo.title || 'Not detected'}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{parsedData.personalInfo.email || 'Not detected'}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{parsedData.personalInfo.phone || 'Not detected'}</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-sm">{parsedData.personalInfo.location || 'Not detected'}</p>
                </div>
              </div>
              {parsedData.summary && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Professional Summary</label>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{parsedData.summary}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="skills" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-primary" />
                <span className="font-medium">Skills Detected ({parsedData.skills.length})</span>
              </div>
              {parsedData.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parsedData.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No skills detected. Please add them manually.</p>
              )}
            </TabsContent>

            <TabsContent value="experience" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-primary" />
                <span className="font-medium">Work Experience ({parsedData.experience.length})</span>
              </div>
              {parsedData.experience.length > 0 ? (
                <div className="space-y-4">
                  {parsedData.experience.map((exp, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="font-medium">{exp.title}</div>
                      <div className="text-sm text-muted-foreground">{exp.company}</div>
                      <div className="text-sm text-muted-foreground">{exp.duration}</div>
                      {exp.description && (
                        <p className="text-sm">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No work experience detected. Please add manually.</p>
              )}
            </TabsContent>

            <TabsContent value="education" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="font-medium">Education & Certifications</span>
              </div>
              
              {parsedData.education.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Education ({parsedData.education.length})</h4>
                  {parsedData.education.map((edu, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-1">
                      <div className="font-medium text-sm">{edu.degree}</div>
                      <div className="text-sm text-muted-foreground">{edu.institution}</div>
                      <div className="text-sm text-muted-foreground">{edu.year}</div>
                    </div>
                  ))}
                </div>
              )}

              {parsedData.certifications.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Certifications ({parsedData.certifications.length})</h4>
                  {parsedData.certifications.map((cert, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-1">
                      <div className="font-medium text-sm">{cert.name}</div>
                      <div className="text-sm text-muted-foreground">{cert.issuer}</div>
                      <div className="text-sm text-muted-foreground">{cert.year}</div>
                    </div>
                  ))}
                </div>
              )}

              {parsedData.education.length === 0 && parsedData.certifications.length === 0 && (
                <p className="text-muted-foreground text-sm">No education or certifications detected.</p>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleApplyData}
              className="flex-1 bg-success hover:bg-success/90 text-white hover-elevate"
              size="lg"
              data-testid="button-apply-resume-data"
            >
              <Download className="w-4 h-4 mr-2" />
              Apply to Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleReparse}
              className="hover-elevate"
              disabled={parseMutation.isPending}
              data-testid="button-reparse-resume"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reparse
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="hover-elevate"
              data-testid="button-skip-parsed"
            >
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Complete Step
  if (parseStep === 'complete') {
    return (
      <Card className={cn("w-full", className)} data-testid="card-resume-complete">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2 text-success">Resume Applied Successfully!</h3>
              <p className="text-muted-foreground">
                Your resume data has been successfully applied to your OnSpot profile.
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-medium text-lg">{parsedData?.skills.length || 0}</div>
                <div className="text-muted-foreground">Skills Added</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-lg">{parsedData?.experience.length || 0}</div>
                <div className="text-muted-foreground">Experiences</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-lg">{parsedData?.education.length || 0}</div>
                <div className="text-muted-foreground">Education</div>
              </div>
            </div>

            <Button 
              onClick={() => onParseComplete?.(parsedData)}
              className="bg-success hover:bg-success/90 text-white hover-elevate"
              size="lg"
              data-testid="button-continue-after-resume"
            >
              Continue Building Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}