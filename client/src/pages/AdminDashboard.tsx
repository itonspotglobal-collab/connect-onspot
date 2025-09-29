import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { authAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ObjectUploader } from '@/components/ObjectUploader';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Users, 
  FileText, 
  UserPlus, 
  Loader2, 
  Eye, 
  Trash2,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schemas
const passwordChangeSchema = z.object({
  userId: z.string().min(1, 'User selection is required'),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

interface Resume {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  candidateEmail?: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('passwords');

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setLocation('/dashboard');
    } else if (!user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Password change form
  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      userId: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const selectedUserId = passwordForm.watch('userId');
  const isChangingOwnPassword = selectedUserId === user?.id;

  // Fetch users for password change
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const data = await authAPI.get('/api/admin/users');
      return data;
    },
    enabled: !!user && user.role === 'admin'
  });

  // Fetch resumes
  const { data: resumes = [], refetch: refetchResumes } = useQuery<Resume[]>({
    queryKey: ['/api/admin/resumes'],
    queryFn: async () => {
      const data = await authAPI.get('/api/admin/resumes');
      return data;
    },
    enabled: !!user && user.role === 'admin'
  });

  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordChangeData) => {
      const payload: any = {
        newPassword: data.newPassword
      };

      // Include current password only if changing own password
      if (isChangingOwnPassword) {
        payload.currentPassword = data.currentPassword;
      }

      return await authAPI.put(`/api/users/${data.userId}/password`, payload);
    },
    onSuccess: () => {
      toast({
        title: 'Password Updated',
        description: 'Password has been changed successfully.'
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Password Change Failed',
        description: error.response?.data?.message || 'Failed to change password',
        variant: 'destructive'
      });
    }
  });

  // Resume upload mutation
  const resumeUploadMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileUrl: string; candidateEmail?: string }) => {
      return await authAPI.post('/api/admin/resumes', data);
    },
    onSuccess: () => {
      toast({
        title: 'Resume Uploaded',
        description: 'Resume has been uploaded successfully.'
      });
      refetchResumes();
    },
    onError: (error: any) => {
      toast({
        title: 'Upload Failed',
        description: error.response?.data?.message || 'Failed to upload resume',
        variant: 'destructive'
      });
    }
  });

  // Resume deletion mutation
  const resumeDeleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await authAPI.delete(`/api/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Resume Deleted',
        description: 'Resume has been deleted successfully.'
      });
      refetchResumes();
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.response?.data?.message || 'Failed to delete resume',
        variant: 'destructive'
      });
    }
  });

  // Convert resume to talent mutation
  const convertResumeMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      return await authAPI.post(`/api/admin/convert-resume/${resumeId}`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Resume Converted',
        description: 'Resume converted to Talent profile successfully.'
      });
      refetchResumes();
    },
    onError: (error: any) => {
      toast({
        title: 'Conversion Failed',
        description: error.response?.data?.message || 'Failed to convert resume',
        variant: 'destructive'
      });
    }
  });

  // Handle file upload completion
  const handleUploadComplete = (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const candidateEmail = prompt('Enter candidate email (optional):') || undefined;
      
      resumeUploadMutation.mutate({
        fileName: file.name,
        fileUrl: file.uploadURL,
        candidateEmail
      });
    }
  };

  // Get upload parameters for ObjectUploader
  const getUploadParameters = async () => {
    const response = await authAPI.get('/api/admin/upload-parameters');
    return {
      method: 'PUT' as const,
      url: response.uploadUrl
    };
  };

  const onSubmitPasswordChange = (data: PasswordChangeData) => {
    passwordMutation.mutate(data);
  };

  // Don't render if not admin
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8" data-testid="admin-dashboard-page">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, resumes, and talent conversion
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="w-3 h-3" />
            Admin Access Required
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="passwords" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users & Passwords
          </TabsTrigger>
          <TabsTrigger value="resumes" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Resumes
          </TabsTrigger>
          <TabsTrigger value="convert" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Convert Resumes
          </TabsTrigger>
        </TabsList>

        {/* Users & Passwords Tab */}
        <TabsContent value="passwords" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Change User Password
              </CardTitle>
              <CardDescription>
                Change passwords for admin or other users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onSubmitPasswordChange)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select User</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-user">
                              <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName || user.email} ({user.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isChangingOwnPassword && (
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter current password"
                              {...field}
                              data-testid="input-current-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter new password"
                            {...field}
                            data-testid="input-new-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Confirm new password"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={passwordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    {passwordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resumes Tab */}
        <TabsContent value="resumes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Resumes
              </CardTitle>
              <CardDescription>
                Upload multiple resumes (PDF, DOCX, max 10MB each)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ObjectUploader
                maxNumberOfFiles={10}
                maxFileSize={10485760} // 10MB
                onGetUploadParameters={getUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Resume Files
              </ObjectUploader>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Uploaded Resumes
                </CardTitle>
                <CardDescription>
                  Manage uploaded resume files
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchResumes()}
                data-testid="button-refresh-resumes"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {resumes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No resumes uploaded yet
                </p>
              ) : (
                <div className="space-y-4">
                  {resumes.map((resume) => (
                    <div 
                      key={resume.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-medium">{resume.fileName}</span>
                        </div>
                        {resume.candidateEmail && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Email: {resume.candidateEmail}
                          </p>
                        )}
                        {resume.fileSize && (
                          <p className="text-sm text-muted-foreground">
                            Size: {(resume.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(resume.fileUrl, '_blank')}
                          data-testid={`button-view-resume-${resume.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = resume.fileUrl;
                            link.download = resume.fileName;
                            link.click();
                          }}
                          data-testid={`button-download-resume-${resume.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => resumeDeleteMutation.mutate(resume.id)}
                          disabled={resumeDeleteMutation.isPending}
                          data-testid={`button-delete-resume-${resume.id}`}
                        >
                          {resumeDeleteMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Convert Resumes Tab */}
        <TabsContent value="convert" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Convert Resumes to Talent
              </CardTitle>
              <CardDescription>
                Convert uploaded resumes into talent profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resumes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No resumes available for conversion. Upload resumes first.
                </p>
              ) : (
                <div className="space-y-4">
                  {resumes.map((resume) => (
                    <div 
                      key={resume.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-medium">{resume.fileName}</span>
                        </div>
                        {resume.candidateEmail && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Email: {resume.candidateEmail}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Uploaded: {new Date(resume.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(resume.fileUrl, '_blank')}
                          data-testid={`button-view-convert-resume-${resume.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          onClick={() => convertResumeMutation.mutate(resume.id)}
                          disabled={convertResumeMutation.isPending}
                          data-testid={`button-convert-resume-${resume.id}`}
                        >
                          {convertResumeMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Converting...
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Convert to Talent
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}