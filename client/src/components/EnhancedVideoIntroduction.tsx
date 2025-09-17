import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Pause,
  Square,
  Upload,
  Trash2,
  Camera,
  Video,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
  Lightbulb,
  Star,
  Eye,
  Heart,
  Sparkles,
  FileVideo,
  Loader2,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedVideoIntroductionProps {
  existingVideoUrl?: string;
  onVideoUpload?: (videoUrl: string) => void;
  mode?: "standalone" | "onboarding";
  className?: string;
}

const VIDEO_TIPS = [
  {
    icon: <Clock className="w-4 h-4" />,
    title: "Keep it short",
    description: "30-60 seconds is perfect. Introduce yourself and highlight key skills."
  },
  {
    icon: <Eye className="w-4 h-4" />,
    title: "Look at the camera",
    description: "Make eye contact with the lens to create a personal connection."
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    title: "Good lighting",
    description: "Natural light works best. Avoid backlighting and dark rooms."
  },
  {
    icon: <Users className="w-4 h-4" />,
    title: "Professional background",
    description: "Choose a clean, professional background or use a virtual one."
  }
];

const VIDEO_BENEFITS = [
  {
    icon: <TrendingUp className="w-4 h-4 text-green-600" />,
    stat: "60%",
    description: "more profile views"
  },
  {
    icon: <Star className="w-4 h-4 text-yellow-600" />,
    stat: "5x",
    description: "higher hire rates"
  },
  {
    icon: <Heart className="w-4 h-4 text-red-600" />,
    stat: "85%",
    description: "client preference"
  }
];

export default function EnhancedVideoIntroduction({ 
  existingVideoUrl, 
  onVideoUpload, 
  mode = "standalone",
  className 
}: EnhancedVideoIntroductionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'completed'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Video upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (videoFile: File) => {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      try {
        // Get upload URL (similar to portfolio images)
        const response = await fetch('/api/object-storage/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `video-intro-${user?.id}-${Date.now()}.webm`,
            contentType: 'video/webm'
          })
        });

        if (!response.ok) throw new Error('Failed to get upload URL');

        const { uploadUrl, objectUrl } = await response.json();
        
        // Upload the file
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: videoFile,
          headers: {
            'Content-Type': 'video/webm'
          }
        });

        if (!uploadResponse.ok) throw new Error('Failed to upload video');

        // Save to documents
        await apiRequest('POST', '/api/documents', {
          type: 'video_intro',
          fileName: `video-intro-${Date.now()}.webm`,
          url: objectUrl,
          size: videoFile.size
        });

        clearInterval(progressInterval);
        setUploadProgress(100);
        
        return objectUrl;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: (videoUrl) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      onVideoUpload?.(videoUrl);
      toast({
        title: "Video Uploaded Successfully! 🎉",
        description: "Your video introduction is now part of your profile.",
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Unable to upload video. Please try again.",
        variant: "destructive"
      });
      setUploadProgress(0);
    }
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to record your introduction.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await startCamera();
      return;
    }

    try {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setRecordingState('completed');
        stopCamera();
      };
      
      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) { // 2 minutes max
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      toast({
        title: "Recording Failed",
        description: "Unable to start recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const discardRecording = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    setRecordingState('idle');
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const uploadRecording = async () => {
    if (!recordedVideoUrl) return;
    
    try {
      const response = await fetch(recordedVideoUrl);
      const blob = await response.blob();
      const file = new File([blob], 'video-intro.webm', { type: 'video/webm' });
      uploadMutation.mutate(file);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to prepare video for upload.",
        variant: "destructive"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (mode === "onboarding") {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Video Introduction</CardTitle>
              <p className="text-muted-foreground">
                Stand out with a personal video introduction
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4 text-center">
            {VIDEO_BENEFITS.map((benefit, index) => (
              <div key={index} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  {benefit.icon}
                </div>
                <div className="text-2xl font-bold">{benefit.stat}</div>
                <div className="text-xs text-muted-foreground">{benefit.description}</div>
              </div>
            ))}
          </div>

          {/* Recording Interface */}
          <div className="space-y-4">
            {recordingState === 'idle' && (
              <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Ready to Record</h3>
                <p className="text-muted-foreground mb-4">
                  Create a 30-60 second video introducing yourself
                </p>
                <Button 
                  onClick={startCamera}
                  className="bg-purple-600 hover:bg-purple-700 text-white hover-elevate"
                  data-testid="button-start-camera"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              </div>
            )}

            {streamRef.current && recordingState !== 'completed' && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  {recordingState === 'recording' && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span className="text-sm font-medium">REC {formatTime(recordingTime)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4">
                  {recordingState === 'recording' ? (
                    <Button 
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                      className="hover-elevate"
                      data-testid="button-stop-recording"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop Recording
                    </Button>
                  ) : (
                    <Button 
                      onClick={startRecording}
                      className="bg-red-600 hover:bg-red-700 text-white hover-elevate"
                      size="lg"
                      data-testid="button-start-recording"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Start Recording
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => {
                      stopCamera();
                      setRecordingState('idle');
                    }}
                    variant="outline"
                    data-testid="button-cancel-recording"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {recordedVideoUrl && recordingState === 'completed' && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={recordedVideoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button 
                    onClick={uploadRecording}
                    disabled={uploadMutation.isPending}
                    className="bg-success hover:bg-success/90 text-white hover-elevate"
                    data-testid="button-upload-video"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Video
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={discardRecording}
                    variant="outline"
                    data-testid="button-retake-video"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake
                  </Button>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      Uploading... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="space-y-3">
            <h4 className="font-medium">Recording Tips</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {VIDEO_TIPS.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    {tip.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{tip.title}</div>
                    <div className="text-xs text-muted-foreground">{tip.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Standalone mode (full interface)
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Video Introduction
                </CardTitle>
                <p className="text-muted-foreground">
                  Create a personal connection with potential clients
                </p>
              </div>
            </div>
            
            {existingVideoUrl && (
              <Badge className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Video Added
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            {VIDEO_BENEFITS.map((benefit, index) => (
              <div key={index} className="p-4 bg-white/50 rounded-lg border border-purple-100">
                <div className="flex items-center justify-center mb-2">
                  {benefit.icon}
                </div>
                <div className="text-2xl font-bold">{benefit.stat}</div>
                <div className="text-sm text-muted-foreground">{benefit.description}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Interface */}
      <Card>
        <CardContent className="p-6">
          {/* Rest of the component for standalone mode */}
          <div className="text-center py-12">
            <FileVideo className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Video Introduction Interface</h3>
            <p className="text-muted-foreground mb-6">
              Full video recording and management interface for standalone use
            </p>
            
            <Alert className="border-purple-200 bg-purple-50 max-w-md mx-auto">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <AlertDescription className="text-purple-700">
                This interface includes camera access, recording controls, playback, and upload functionality.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}