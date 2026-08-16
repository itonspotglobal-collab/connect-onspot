import { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  RefreshCw,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Settings,
  Search,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
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

interface JobApplication {
  id: string;
  job_id: string;
  jobTitle: string;
  jobCompany?: string;
  first_name: string;
  last_name: string;
  applicant_name: string;
  email: string;
  phone?: string;
  cover_letter?: string;
  status: string;
  registration_status: string;
  submitted_at: string;
  talent_id?: string;
  talentFirstName?: string;
  talentLastName?: string;
}

interface JobOption {
  id: string;
  title: string;
  company?: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('passwords');

  // Job Applications state
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [appJobFilter, setAppJobFilter] = useState('all');
  const [appPage, setAppPage] = useState(1);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>('');

  // TODO: Restore admin role check before production launch.

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
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch jobs for filter dropdown
  const { data: jobsData } = useQuery<{ items: JobOption[] }>({
    queryKey: ['/api/admin/jobs', { page: 1, pageSize: 200 }],
    queryFn: async () => {
      const data = await authAPI.get('/api/admin/jobs?page=1&pageSize=200');
      return data;
    },
  });
  const jobOptions: JobOption[] = jobsData?.items ?? [];

  // Fetch job applications
  const {
    data: appData,
    isFetching: appsFetching,
    refetch: refetchApps,
  } = useQuery<{ total: number; page: number; limit: number; items: JobApplication[] }>({
    queryKey: [
      '/api/admin/job-applications',
      { page: appPage, status: appStatusFilter, jobId: appJobFilter },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(appPage), limit: '25' });
      if (appStatusFilter !== 'all') params.set('status', appStatusFilter);
      if (appJobFilter !== 'all') params.set('jobId', appJobFilter);
      return await authAPI.get(`/api/admin/job-applications?${params.toString()}`);
    },
  });
  const applications = appData?.items ?? [];
  const appsTotal = appData?.total ?? 0;
  const appsTotalPages = Math.max(1, Math.ceil(appsTotal / 25));

  // Fetch resumes
  const { data: resumes = [], refetch: refetchResumes } = useQuery<Resume[]>({
    queryKey: ['/api/admin/resumes'],
    queryFn: async () => {
      const data = await authAPI.get('/api/admin/resumes');
      return Array.isArray(data) ? data : [];
    },
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

  // Update application status mutation
  const updateAppStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await authAPI.patch(`/api/admin/job-applications/${id}`, { status });
    },
    onSuccess: (_, variables) => {
      toast({ title: 'Status Updated', description: 'Application status has been updated.' });
      // Update selectedApp in-place so dialog reflects new status immediately
      setSelectedApp((prev) => prev ? { ...prev, status: variables.status } : prev);
      // Optimistically update the table row via query cache
      queryClient.setQueryData(
        ['/api/admin/job-applications', { page: appPage, status: appStatusFilter, jobId: appJobFilter }],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item: JobApplication) =>
              item.id === variables.id ? { ...item, status: variables.status } : item
            ),
          };
        }
      );
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.response?.data?.error || 'Failed to update status',
        variant: 'destructive',
      });
    },
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

  // ── Platform Settings ─────────────────────────────────────────────────────
  const { data: platformSettings, isLoading: settingsLoading } = useQuery<Record<string, string>>({
    queryKey: ['/api/admin/platform-settings'],
    queryFn: () => authAPI.get('/api/admin/platform-settings'),
  });

  const [pendingThreshold, setPendingThreshold] = useState<string | null>(null);
  const effectiveThreshold = pendingThreshold ?? platformSettings?.name_reveal_threshold ?? 'submitted';

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      authAPI.patch('/api/admin/platform-settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform-settings/public'] });
      setPendingThreshold(null);
      toast({ title: 'Settings saved', description: 'Platform settings updated successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Save failed',
        description: error.response?.data?.error || 'Failed to update settings',
        variant: 'destructive',
      });
    },
  });

  // ── Search query frequency stats ────────────────────────────────────────
  interface SearchQueryStats {
    total_recorded_searches: number;
    threshold: number;
    chips_active: boolean;
    top_queries: Array<{ query: string; count: number; last_searched_at: string }>;
  }

  const { data: searchStats, isLoading: searchStatsLoading, refetch: refetchSearchStats } =
    useQuery<SearchQueryStats>({
      queryKey: ['/api/admin/search-query-stats'],
      queryFn: () => authAPI.get('/api/admin/search-query-stats'),
    });

  const [seedInput, setSeedInput] = useState('');
  const seedMutation = useMutation({
    mutationFn: (queries: Array<{ query: string; count: number }>) =>
      authAPI.post('/api/admin/search-query-stats/seed', { queries }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/search-query-stats'] });
      setSeedInput('');
      toast({
        title: 'Queries seeded',
        description: `${data.seeded_count} quer${data.seeded_count === 1 ? 'y' : 'ies'} added. Total: ${data.total_recorded_searches}. Chips ${data.chips_active ? 'are now active ✓' : 'not yet active'}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Seed failed',
        description: error.response?.data?.error || 'Failed to seed queries',
        variant: 'destructive',
      });
    },
  });

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
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="applications" className="flex items-center gap-2" data-testid="tab-job-applications">
            <Briefcase className="w-4 h-4" />
            Job Applications
          </TabsTrigger>
          <TabsTrigger value="platform-settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Platform Settings
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
                          disabled
                          title="Resume deletion not available"
                          data-testid={`button-delete-resume-${resume.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
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

        {/* Job Applications Tab */}
        <TabsContent value="applications" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Job Applications
                </CardTitle>
                <CardDescription>
                  {appsTotal} total submission{appsTotal !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchApps()}
                data-testid="button-refresh-applications"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <Select
                  value={appStatusFilter}
                  onValueChange={(v) => { setAppStatusFilter(v); setAppPage(1); }}
                >
                  <SelectTrigger className="w-44" data-testid="filter-app-status">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={appJobFilter}
                  onValueChange={(v) => { setAppJobFilter(v); setAppPage(1); }}
                >
                  <SelectTrigger className="w-56" data-testid="filter-app-job">
                    <SelectValue placeholder="Filter by job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {jobOptions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}{j.company ? ` — ${j.company}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {appsFetching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : applications.length === 0 ? (
                <p className="text-muted-foreground text-center py-10">
                  No applications found.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Applicant</th>
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        <th className="px-4 py-3 text-left font-medium">Job</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Registration</th>
                        <th className="px-4 py-3 text-left font-medium">Submitted</th>
                        <th className="px-4 py-3 text-left font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr
                          key={app.id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => { setSelectedApp(app); setEditingStatus(''); }}
                          data-testid={`app-row-${app.id}`}
                        >
                          <td className="px-4 py-3 font-medium">{app.applicant_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{app.email}</td>
                          <td className="px-4 py-3">{app.jobTitle}</td>
                          <td className="px-4 py-3">
                            <AppStatusBadge status={app.status} />
                          </td>
                          <td className="px-4 py-3">
                            <RegStatusBadge status={app.registration_status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {new Date(app.submitted_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setEditingStatus(''); }}
                              data-testid={`button-view-app-${app.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {appsTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Page {appPage} of {appsTotalPages} ({appsTotal} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={appPage <= 1}
                      onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                      data-testid="button-apps-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={appPage >= appsTotalPages}
                      onClick={() => setAppPage((p) => Math.min(appsTotalPages, p + 1))}
                      data-testid="button-apps-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Settings Tab */}
        <TabsContent value="platform-settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Platform Settings
              </CardTitle>
              <CardDescription>
                Configure platform-wide behaviour without a code deploy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {settingsLoading ? (
                <p className="text-sm text-muted-foreground">Loading settings…</p>
              ) : (
                <div className="space-y-6 max-w-lg">
                  {/* Name-reveal threshold */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Name Reveal Threshold
                    </label>
                    <p className="text-[13px] text-muted-foreground">
                      The earliest application status at which a talent's full name becomes
                      visible to the client on client-invited submissions. All statuses at or
                      after this point will show the real name.
                    </p>
                    <Select
                      value={effectiveThreshold}
                      onValueChange={(v) => setPendingThreshold(v)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">
                          Applied — reveal when talent accepts invite
                        </SelectItem>
                        <SelectItem value="reviewed">
                          Reviewed — reveal after admin reviews
                        </SelectItem>
                        <SelectItem value="shortlisted">
                          Shortlisted — reveal only once shortlisted
                        </SelectItem>
                        <SelectItem value="hired">
                          Hired — reveal only once hired
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Current saved value:{' '}
                      <span className="font-mono font-semibold">
                        {platformSettings?.name_reveal_threshold ?? 'submitted'}
                      </span>
                    </p>
                  </div>

                  <Button
                    disabled={
                      updateSettingsMutation.isPending ||
                      pendingThreshold === null
                    }
                    onClick={() => {
                      if (pendingThreshold !== null) {
                        updateSettingsMutation.mutate({
                          name_reveal_threshold: pendingThreshold,
                        });
                      }
                    }}
                  >
                    {updateSettingsMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search Suggestion Chips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Suggestion Chips
              </CardTitle>
              <CardDescription>
                Talent-search suggestion chips switch from category fallback to real recorded queries
                once the total recorded search count reaches the threshold below. Monitor progress here
                and seed high-value queries to activate chips before organic volume accrues.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {searchStatsLoading ? (
                <p className="text-sm text-muted-foreground">Loading search stats…</p>
              ) : searchStats ? (
                <>
                  {/* Status banner */}
                  <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${searchStats.chips_active ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'}`}>
                    {searchStats.chips_active
                      ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                      : <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />}
                    <div className="text-sm">
                      {searchStats.chips_active ? (
                        <span className="font-medium text-green-800 dark:text-green-200">
                          Real query chips are active.
                        </span>
                      ) : (
                        <span className="font-medium text-amber-800 dark:text-amber-200">
                          Still on category fallback.{' '}
                          <span className="font-normal">
                            Need {searchStats.threshold - searchStats.total_recorded_searches} more
                            search{searchStats.threshold - searchStats.total_recorded_searches === 1 ? '' : 'es'} to activate real chips.
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Counters */}
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Recorded searches</p>
                      <p className="text-2xl font-bold tabular-nums">{searchStats.total_recorded_searches.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Activation threshold</p>
                      <p className="text-2xl font-bold tabular-nums">{searchStats.threshold.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Top queries table */}
                  {searchStats.top_queries.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Top recorded queries
                      </p>
                      <div className="rounded-md border divide-y text-sm">
                        {searchStats.top_queries.map((q) => (
                          <div key={q.query} className="flex items-center justify-between px-3 py-2">
                            <span className="font-mono text-xs">{q.query}</span>
                            <span className="tabular-nums text-muted-foreground">{q.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No queries recorded yet.</p>
                  )}

                  {/* Seed form */}
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Seed high-value queries</p>
                    <p className="text-[13px] text-muted-foreground">
                      Enter one query per line, optionally with a count: <code className="text-xs bg-muted rounded px-1">customer support:5</code>.
                      Seeding adds to existing counts — existing entries are not overwritten.
                    </p>
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[80px] resize-y"
                      placeholder={"customer support:5\nvirtual assistant:3\naccountant"}
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={seedMutation.isPending || !seedInput.trim()}
                      onClick={() => {
                        const lines = seedInput.split('\n').map(l => l.trim()).filter(Boolean);
                        const queries = lines.map(line => {
                          const colonIdx = line.lastIndexOf(':');
                          if (colonIdx > 0) {
                            const q = line.slice(0, colonIdx).trim();
                            const c = parseInt(line.slice(colonIdx + 1).trim(), 10);
                            return { query: q, count: isNaN(c) ? 1 : c };
                          }
                          return { query: line, count: 1 };
                        }).filter(item => item.query.length > 0);
                        if (queries.length > 0) seedMutation.mutate(queries);
                      }}
                    >
                      {seedMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Seeding…</>
                      ) : 'Seed queries'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => refetchSearchStats()}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-destructive">Failed to load search query stats.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Application Detail Dialog */}
      <Dialog
        open={!!selectedApp}
        onOpenChange={(open) => {
          if (!open) { setSelectedApp(null); setEditingStatus(''); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Application Details
            </DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Applicant</p>
                  <p>{selectedApp.applicant_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Email</p>
                  <p>{selectedApp.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Phone</p>
                  <p>{selectedApp.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Job</p>
                  <p>{selectedApp.jobTitle}{selectedApp.jobCompany ? ` — ${selectedApp.jobCompany}` : ''}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground font-medium mb-2">Application Status</p>
                  <div className="flex items-center gap-3">
                    <Select
                      value={editingStatus || selectedApp.status}
                      onValueChange={setEditingStatus}
                    >
                      <SelectTrigger className="w-44" data-testid="select-app-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="shortlisted">Shortlisted</SelectItem>
                        <SelectItem value="hired">Hired</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={
                        updateAppStatusMutation.isPending ||
                        !editingStatus ||
                        editingStatus === selectedApp.status
                      }
                      onClick={() => {
                        if (editingStatus && editingStatus !== selectedApp.status) {
                          updateAppStatusMutation.mutate({ id: selectedApp.id, status: editingStatus });
                        }
                      }}
                      data-testid="button-save-app-status"
                    >
                      {updateAppStatusMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                      ) : (
                        'Save Status'
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Registration Status</p>
                  <RegStatusBadge status={selectedApp.registration_status} />
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Submitted</p>
                  <p>{new Date(selectedApp.submitted_at).toLocaleString()}</p>
                </div>
                {selectedApp.talent_id && (
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Linked Talent</p>
                    <p>
                      {selectedApp.talentFirstName || ''} {selectedApp.talentLastName || ''}
                      {!selectedApp.talentFirstName && !selectedApp.talentLastName && selectedApp.talent_id}
                    </p>
                  </div>
                )}
              </div>
              {selectedApp.cover_letter && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Cover Letter</p>
                  <div className="bg-muted rounded-md p-4 whitespace-pre-wrap leading-relaxed">
                    {selectedApp.cover_letter}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    new: 'default',
    reviewed: 'secondary',
    shortlisted: 'secondary',
    hired: 'secondary',
    rejected: 'destructive',
  };
  const labels: Record<string, string> = {
    new: 'New',
    reviewed: 'Reviewed',
    shortlisted: 'Shortlisted',
    hired: 'Hired',
    rejected: 'Rejected',
  };
  return (
    <Badge variant={variants[status] ?? 'outline'}>
      {labels[status] ?? status}
    </Badge>
  );
}

function RegStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending_account: 'outline',
    registered: 'secondary',
  };
  const labels: Record<string, string> = {
    pending_account: 'Pending Account',
    registered: 'Registered',
  };
  return (
    <Badge variant={variants[status] ?? 'outline'}>
      {labels[status] ?? status}
    </Badge>
  );
}
