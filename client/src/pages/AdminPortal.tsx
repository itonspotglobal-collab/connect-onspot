import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Plus,
  BarChart3,
  Users,
  Eye,
  EyeOff,
  Trash2,
  MapPin,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  ChevronRight,
  LayoutDashboard
} from "lucide-react";

interface AdminJob {
  id: string;
  title: string;
  description: string;
  company: string | null;
  location: string | null;
  category: string;
  contractType: string;
  hourlyRateMin: string | null;
  hourlyRateMax: string | null;
  experienceLevel: string;
  status: string;
  proposalCount: number | null;
  createdAt: string;
}

type Section = "dashboard" | "postings" | "add-job";

export default function AdminPortal() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company: "OnSpot Global",
    location: "Remote (Philippines)",
    category: "support",
    contractType: "hourly",
    hourlyRateMin: "",
    hourlyRateMax: "",
    experienceLevel: "entry",
  });

  const { data: jobs = [], isLoading } = useQuery<AdminJob[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job posted successfully" });
      setFormData({
        title: "",
        description: "",
        company: "OnSpot Global",
        location: "Remote (Philippines)",
        category: "support",
        contractType: "hourly",
        hourlyRateMin: "",
        hourlyRateMax: "",
        experienceLevel: "entry",
      });
      setActiveSection("postings");
    },
    onError: () => {
      toast({ title: "Failed to create job", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/jobs/${id}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job status updated" });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
      toast({ title: "Job removed" });
    },
  });

  const activeJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter((j) => j.status === "closed");
  const totalProposals = jobs.reduce((sum, j) => sum + (j.proposalCount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    createJobMutation.mutate(formData);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const navItems = [
    { id: "dashboard" as Section, label: "Dashboard", icon: LayoutDashboard },
    { id: "postings" as Section, label: "Active Postings", icon: Briefcase },
    { id: "add-job" as Section, label: "Add New Job", icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen border-r bg-muted/30 p-4 space-y-2">
          <div className="px-3 py-4 mb-4">
            <h2 className="text-lg font-bold tracking-tight">Admin Portal</h2>
            <p className="text-sm text-muted-foreground">Job Management</p>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSection === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover-elevate"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {activeSection === item.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}

          <div className="mt-8 pt-4 border-t">
            <div className="px-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Open Jobs</span>
                <Badge variant="default">{activeJobs.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Closed</span>
                <Badge variant="secondary">{closedJobs.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Proposals</span>
                <Badge variant="outline">{totalProposals}</Badge>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Dashboard Section */}
          {activeSection === "dashboard" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Job Insights</h1>
                <p className="text-muted-foreground mt-1">Overview of your job board activity</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Postings</CardTitle>
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{jobs.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">All time job postings</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{activeJobs.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Currently accepting proposals</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Closed Jobs</CardTitle>
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{closedJobs.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">No longer accepting proposals</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{totalProposals}</div>
                    <p className="text-xs text-muted-foreground mt-1">Across all job postings</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Jobs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Recent Postings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading jobs...</div>
                  ) : jobs.length === 0 ? (
                    <div className="text-center py-8">
                      <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No jobs posted yet</p>
                      <Button className="mt-4" onClick={() => setActiveSection("add-job")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Post Your First Job
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {jobs.slice(0, 5).map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-3 rounded-md border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium truncate">{job.title}</h4>
                              <Badge
                                variant={job.status === "open" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {job.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {job.company || "OnSpot Global"}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {job.location || "Remote"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {job.proposalCount || 0} proposals
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {job.hourlyRateMin && job.hourlyRateMax && (
                              <span className="text-sm font-semibold text-green-600">
                                ${job.hourlyRateMin}-${job.hourlyRateMax}/hr
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Active Postings Section */}
          {activeSection === "postings" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Active Postings</h1>
                  <p className="text-muted-foreground mt-1">Manage your job listings</p>
                </div>
                <Button onClick={() => setActiveSection("add-job")}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Job
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              ) : jobs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Briefcase className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No job postings yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first job posting to get started.</p>
                    <Button onClick={() => setActiveSection("add-job")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Job
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {jobs.filter(j => j.status !== "cancelled").map((job) => (
                    <Card key={job.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{job.title}</h3>
                              <Badge variant={job.status === "open" ? "default" : "secondary"}>
                                {job.status === "open" ? "Open" : "Closed"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-4 h-4" />
                                {job.company || "OnSpot Global"}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {job.location || "Remote"}
                              </span>
                              {job.hourlyRateMin && job.hourlyRateMax && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-4 h-4" />
                                  ${job.hourlyRateMin}-${job.hourlyRateMax}/hr
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {job.proposalCount || 0} proposals
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>

                            <div className="flex flex-wrap gap-2 mt-3">
                              <Badge variant="outline" className="text-xs">{job.category}</Badge>
                              <Badge variant="outline" className="text-xs">{job.contractType}</Badge>
                              <Badge variant="outline" className="text-xs">{job.experienceLevel}</Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatusMutation.mutate(job.id)}
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
                              onClick={() => {
                                if (window.confirm("Remove this job posting?")) {
                                  deleteJobMutation.mutate(job.id);
                                }
                              }}
                              disabled={deleteJobMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add Job Section */}
          {activeSection === "add-job" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Add New Job</h1>
                <p className="text-muted-foreground mt-1">Create a new job posting for the Find Work page</p>
              </div>

              <Card>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => updateField("company", e.target.value)}
                          placeholder="OnSpot Global"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => updateField("location", e.target.value)}
                          placeholder="Remote (Philippines)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={formData.category} onValueChange={(v) => updateField("category", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="development">Development & IT</SelectItem>
                            <SelectItem value="design">Design & Creative</SelectItem>
                            <SelectItem value="marketing">Sales & Marketing</SelectItem>
                            <SelectItem value="support">Admin & Support</SelectItem>
                            <SelectItem value="writing">Writing & Translation</SelectItem>
                            <SelectItem value="media">Audio, Video & Animation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contractType">Contract Type</Label>
                        <Select value={formData.contractType} onValueChange={(v) => updateField("contractType", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="fixed">Fixed Price</SelectItem>
                            <SelectItem value="full-time">Full-time</SelectItem>
                            <SelectItem value="part-time">Part-time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="experienceLevel">Experience Level</Label>
                        <Select value={formData.experienceLevel} onValueChange={(v) => updateField("experienceLevel", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="entry">Entry Level</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="hourlyRateMin">Rate Min ($/hr)</Label>
                        <Input
                          id="hourlyRateMin"
                          type="number"
                          value={formData.hourlyRateMin}
                          onChange={(e) => updateField("hourlyRateMin", e.target.value)}
                          placeholder="8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hourlyRateMax">Rate Max ($/hr)</Label>
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
                      <Label htmlFor="description">Job Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => updateField("description", e.target.value)}
                        placeholder="Describe the role, responsibilities, and requirements..."
                        className="min-h-[200px]"
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveSection("postings")}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createJobMutation.isPending}>
                        {createJobMutation.isPending ? "Posting..." : "Post Job"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
