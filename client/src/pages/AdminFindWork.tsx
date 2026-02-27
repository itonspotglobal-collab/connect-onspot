import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Plus,
  ArrowLeft,
  Briefcase,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Users,
  TrendingUp,
  CheckCircle2,
  XCircle,
  BarChart3,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { ExpandableJobCard } from "@/components/ExpandableJobCard";

const defaultFormData = {
  title: "",
  company: "OnSpot Global",
  location: "Remote",
  category: "support",
  contractType: "full-time",
  experienceLevel: "entry",
  description: "",
  hourlyRateMin: "",
  hourlyRateMax: "",
  budget: "",
  duration: "",
  status: "open",
  responsibilities: "",
  requirements: "",
  skillTags: "",
};

export default function AdminFindWork() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job posting created successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create job", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job posting updated successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update job", description: error.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/jobs/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job posting removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove job", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingJob(null);
    setShowForm(false);
  };

  const startEditing = (job: Job) => {
    setEditingJob(job);
    setFormData({
      title: job.title || "",
      company: job.company || "OnSpot Global",
      location: job.location || "Remote",
      category: job.category || "support",
      contractType: job.contractType || "full-time",
      experienceLevel: job.experienceLevel || "entry",
      description: job.description || "",
      hourlyRateMin: job.hourlyRateMin || "",
      hourlyRateMax: job.hourlyRateMax || "",
      budget: job.budget || "",
      duration: job.duration || "",
      status: job.status || "open",
      responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join("\n") : "",
      requirements: Array.isArray(job.requirements) ? job.requirements.join("\n") : "",
      skillTags: Array.isArray(job.skillTags) ? job.skillTags.join(", ") : "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      title: formData.title,
      company: formData.company,
      location: formData.location,
      category: formData.category,
      contractType: formData.contractType,
      experienceLevel: formData.experienceLevel,
      description: formData.description,
      status: formData.status,
    };

    if (!editingJob) {
      payload.clientId = "admin-system";
    }

    if (formData.hourlyRateMin) payload.hourlyRateMin = formData.hourlyRateMin;
    if (formData.hourlyRateMax) payload.hourlyRateMax = formData.hourlyRateMax;
    if (formData.budget) payload.budget = formData.budget;
    if (formData.duration) payload.duration = formData.duration;

    payload.responsibilities = formData.responsibilities
      ? formData.responsibilities.split("\n").map((s: string) => s.trim()).filter(Boolean)
      : [];
    payload.requirements = formData.requirements
      ? formData.requirements.split("\n").map((s: string) => s.trim()).filter(Boolean)
      : [];
    payload.skillTags = formData.skillTags
      ? formData.skillTags.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter((j) => j.status === "closed" || j.status === "cancelled");
  const totalProposals = jobs.reduce((sum, j) => sum + (j.proposalCount || 0), 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/find-work">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Jobs Admin</h1>
              <p className="text-muted-foreground">Manage job postings for Find Work</p>
            </div>
          </div>

          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Job
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">{openJobs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold">{closedJobs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Proposals</p>
                <p className="text-2xl font-bold">{totalProposals}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add/Edit Job Form */}
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingJob ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingJob ? "Edit Job Posting" : "Add New Job Posting"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="e.g. Customer Service Representative"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => updateField("company", e.target.value)}
                      placeholder="OnSpot Global"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select value={formData.location} onValueChange={(v) => updateField("location", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Remote">Remote</SelectItem>
                        <SelectItem value="Onsite">Onsite</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => updateField("category", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">Admin & Support</SelectItem>
                        <SelectItem value="development">Development & IT</SelectItem>
                        <SelectItem value="design">Design & Creative</SelectItem>
                        <SelectItem value="marketing">Sales & Marketing</SelectItem>
                        <SelectItem value="writing">Writing & Translation</SelectItem>
                        <SelectItem value="media">Audio, Video & Animation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experienceLevel">Experience Level</Label>
                    <Select value={formData.experienceLevel} onValueChange={(v) => updateField("experienceLevel", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Experience Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry Level</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contractType">Contract Type</Label>
                    <Select value={formData.contractType} onValueChange={(v) => updateField("contractType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRateMin">Rate Min ($)</Label>
                    <Input
                      id="hourlyRateMin"
                      type="number"
                      value={formData.hourlyRateMin}
                      onChange={(e) => updateField("hourlyRateMin", e.target.value)}
                      placeholder="8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRateMax">Rate Max ($)</Label>
                    <Input
                      id="hourlyRateMax"
                      type="number"
                      value={formData.hourlyRateMax}
                      onChange={(e) => updateField("hourlyRateMax", e.target.value)}
                      placeholder="12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Brief overview of the role and what makes it great..."
                    className="min-h-[100px]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsibilities">Responsibilities (one per line)</Label>
                    <Textarea
                      id="responsibilities"
                      value={formData.responsibilities}
                      onChange={(e) => updateField("responsibilities", e.target.value)}
                      placeholder={"Respond to customer inquiries via phone, email, and chat\nResolve product or service issues\nProcess orders and applications"}
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requirements">Skills Needed (one per line)</Label>
                    <Textarea
                      id="requirements"
                      value={formData.requirements}
                      onChange={(e) => updateField("requirements", e.target.value)}
                      placeholder={"Excellent verbal and written communication in English\nStrong problem-solving abilities\nExperience with CRM software"}
                      className="min-h-[120px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skillTags">Skill Tags (comma-separated)</Label>
                  <Input
                    id="skillTags"
                    value={formData.skillTags}
                    onChange={(e) => updateField("skillTags", e.target.value)}
                    placeholder="Customer Support, Communication, Problem Solving, CRM"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Select value={formData.duration || ""} onValueChange={(v) => updateField("duration", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="less-than-1-month">Less than 1 month</SelectItem>
                        <SelectItem value="1-3-months">1-3 months</SelectItem>
                        <SelectItem value="3-6-months">3-6 months</SelectItem>
                        <SelectItem value="6-12-months">6-12 months</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => updateField("status", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingJob ? "Update Job" : "Create Job"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Active Postings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Job Postings
            </h2>
            <Badge variant="secondary">{jobs.length} total</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No job postings yet</h3>
                <p className="text-muted-foreground mb-4">Create your first job posting to start attracting talent.</p>
                <Button onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <ExpandableJobCard
                  key={job.id}
                  job={job}
                  showApply={false}
                  adminActions={
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={job.status === "open" ? "default" : "secondary"}>
                        {job.status === "open" ? "Open" : job.status === "closed" ? "Closed" : job.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: job.id,
                            status: job.status === "open" ? "closed" : "open",
                          })
                        }
                        disabled={toggleStatusMutation.isPending}
                      >
                        {job.status === "open" ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Close
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Open
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(job)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove job posting?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the job posting "{job.title}". It will no longer appear on the Find Work page.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(job.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
