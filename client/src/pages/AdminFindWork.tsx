import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
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
  BarChart3,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Star,
  Layers,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { ExpandableJobCard } from "@/components/ExpandableJobCard";
import { getJobBadges } from "@/lib/jobUtils";

// ─── Quill config ─────────────────────────────────────────────────────────────
const quillModules = {
  toolbar: [["bold"], [{ list: "ordered" }, { list: "bullet" }]],
};
const quillFormats = ["bold", "list", "bullet"];

const toQuillHtml = (arr: string[] | null | undefined): string => {
  if (!arr || arr.length === 0) return "";
  if (arr.length === 1 && arr[0].trim().startsWith("<")) return arr[0];
  return "<ul>" + arr.map((item) => `<li>${item}</li>`).join("") + "</ul>";
};

const isEmptyQuill = (html: string) =>
  !html || html === "<p><br></p>" || html.trim() === "";

// ─── Badge icons (for the badge preview panel) ────────────────────────────────
const BADGE_ICONS: Record<string, React.ElementType> = {
  "top-paying": Star,
  urgent: Zap,
  "multiple-slots": Layers,
};

// ─── Default form state ───────────────────────────────────────────────────────
const defaultFormData = {
  title: "",
  company: "OnSpot Global",
  location: "Remote",
  category: "support",
  contractType: "full-time",
  experienceLevel: "entry",
  description: "",
  // Salary — stored in PHP (₱), shown on dedicated page and modal only
  budget: "",          // monthly fixed budget (₱)
  hourlyRateMin: "",   // monthly rate range floor (₱)
  hourlyRateMax: "",   // monthly rate range ceiling (₱)
  duration: "",
  status: "open",
  responsibilities: "",
  requirements: "",
  skillTags: "",
};

type FormData = typeof defaultFormData;

// ─── Copy-to-clipboard mini hook ─────────────────────────────────────────────
function useCopyLink() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  function copy(jobId: string) {
    const url = `${window.location.origin}/jobs/${jobId}`;
    navigator.clipboard?.writeText(url).catch(() => {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  }
  return { copiedId, copy };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminFindWork() {
  const { toast } = useToast();
  const { copiedId, copy } = useCopyLink();
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/jobs", data),
    onSuccess: () => { invalidate(); toast({ title: "Job posting created" }); resetForm(); },
    onError: (err: any) => toast({ title: "Failed to create job", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}`, data),
    onSuccess: () => { invalidate(); toast({ title: "Job posting updated" }); resetForm(); },
    onError: (err: any) => toast({ title: "Failed to update job", description: err.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast({ title: "Job status updated" }); },
    onError: (err: any) => toast({ title: "Failed to update status", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/jobs/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Job posting removed" }); },
    onError: (err: any) => toast({ title: "Failed to remove job", description: err.message, variant: "destructive" }),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingJob(null);
    setShowForm(false);
    setErrors({});
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
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
      budget: job.budget || "",
      hourlyRateMin: job.hourlyRateMin || "",
      hourlyRateMax: job.hourlyRateMax || "",
      duration: job.duration || "",
      status: job.status || "open",
      responsibilities: toQuillHtml(job.responsibilities as string[]),
      requirements: toQuillHtml(job.requirements as string[]),
      skillTags: Array.isArray(job.skillTags)
        ? (job.skillTags as string[]).join(", ")
        : "",
    });
    setErrors({});
    setShowForm(true);
    // Scroll to form
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  // Live badge preview based on current form values
  const previewBadges = useMemo(() =>
    getJobBadges({
      budget: formData.budget || formData.hourlyRateMax,
      hourlyRateMin: formData.hourlyRateMin,
      hourlyRateMax: formData.hourlyRateMax,
      proposalCount: editingJob?.proposalCount ?? 0,
      title: formData.title,
      location: formData.location,
      createdAt: editingJob?.createdAt ?? new Date(),
    }),
    [formData, editingJob]
  );

  // Validate required fields before submit
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.title.trim()) newErrors.title = "Job title is required";
    if (!formData.description.trim()) newErrors.description = "Role overview is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.contractType) newErrors.contractType = "Contract type is required";
    if (!formData.experienceLevel) newErrors.experienceLevel = "Experience level is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: any = {
      title: formData.title.trim(),
      company: formData.company.trim() || "OnSpot Global",
      location: formData.location,
      category: formData.category,
      contractType: formData.contractType,
      experienceLevel: formData.experienceLevel,
      description: formData.description.trim(),
      status: formData.status,
      // Always store as PHP
      budgetCurrency: "PHP",
    };

    if (!editingJob) payload.clientId = "admin-system";

    if (formData.budget) payload.budget = formData.budget;
    if (formData.hourlyRateMin) payload.hourlyRateMin = formData.hourlyRateMin;
    if (formData.hourlyRateMax) payload.hourlyRateMax = formData.hourlyRateMax;
    if (formData.duration) payload.duration = formData.duration;

    payload.responsibilities = !isEmptyQuill(formData.responsibilities)
      ? [formData.responsibilities]
      : [];
    payload.requirements = !isEmptyQuill(formData.requirements)
      ? [formData.requirements]
      : [];
    payload.skillTags = formData.skillTags
      ? formData.skillTags.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ─── Derived stats ───────────────────────────────────────────────────────────
  const openJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter((j) =>
    j.status === "closed" || j.status === "cancelled"
  );
  const totalProposals = jobs.reduce(
    (sum, j) => sum + (j.proposalCount || 0),
    0
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Link href="/find-work">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Jobs Admin</h1>
              <p className="text-muted-foreground">
                Manage job postings — changes appear instantly on the public
                Find Work page
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href="/find-work" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                View Public Page
              </a>
            </Button>
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Job
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
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
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
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
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
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
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Applications</p>
                <p className="text-2xl font-bold">{totalProposals}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Add / Edit Form ───────────────────────────────────────────────── */}
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingJob ? (
                  <Pencil className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                {editingJob ? "Edit Job Posting" : "Add New Job Posting"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">

                {/* ── Section 1: Basic Info ─────────────────────────────────── */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Basic Information
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">
                        Job Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => updateField("title", e.target.value)}
                        placeholder="e.g. Customer Service Representative"
                      />
                      {errors.title && (
                        <p className="text-xs text-red-500">{errors.title}</p>
                      )}
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Work Setup</Label>
                      <Select
                        value={formData.location}
                        onValueChange={(v) => updateField("location", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Work setup" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="Onsite">Onsite</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">
                        Category <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.category}
                        onValueChange={(v) => updateField("category", v)}
                      >
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
                      {errors.category && (
                        <p className="text-xs text-red-500">{errors.category}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="experienceLevel">
                        Experience Level <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.experienceLevel}
                        onValueChange={(v) => updateField("experienceLevel", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Experience Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entry">Entry Level</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.experienceLevel && (
                        <p className="text-xs text-red-500">{errors.experienceLevel}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="contractType">
                        Contract Type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.contractType}
                        onValueChange={(v) => updateField("contractType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Contract type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.contractType && (
                        <p className="text-xs text-red-500">{errors.contractType}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Select
                        value={formData.duration || ""}
                        onValueChange={(v) => updateField("duration", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Duration (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="less-than-1-month">Less than 1 month</SelectItem>
                          <SelectItem value="1-3-months">1–3 months</SelectItem>
                          <SelectItem value="3-6-months">3–6 months</SelectItem>
                          <SelectItem value="6-12-months">6–12 months</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => updateField("status", v)}
                      >
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
                </div>

                <Separator />

                {/* ── Section 2: Salary / Rate ─────────────────────────────── */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Salary / Rate (₱ PHP)
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Salary is shown on the dedicated role page and preview modal only — not on the job card summary.
                    Set either a fixed monthly budget <em>or</em> a min/max range.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="budget">Fixed Monthly Budget (₱)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm pointer-events-none">
                          ₱
                        </span>
                        <Input
                          id="budget"
                          type="number"
                          className="pl-7"
                          value={formData.budget}
                          onChange={(e) => updateField("budget", e.target.value)}
                          placeholder="e.g. 40000"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRateMin">Rate Range Min (₱)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm pointer-events-none">
                          ₱
                        </span>
                        <Input
                          id="hourlyRateMin"
                          type="number"
                          className="pl-7"
                          value={formData.hourlyRateMin}
                          onChange={(e) => updateField("hourlyRateMin", e.target.value)}
                          placeholder="e.g. 30000"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRateMax">Rate Range Max (₱)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm pointer-events-none">
                          ₱
                        </span>
                        <Input
                          id="hourlyRateMax"
                          type="number"
                          className="pl-7"
                          value={formData.hourlyRateMax}
                          onChange={(e) => updateField("hourlyRateMax", e.target.value)}
                          placeholder="e.g. 50000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Badge preview — live feedback based on form values */}
                  {previewBadges.length > 0 && (
                    <div className="mt-4 p-3 rounded-md bg-muted/40 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Badge preview — this job will earn:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {previewBadges.map((b) => {
                          const Icon = BADGE_ICONS[b.key];
                          return (
                            <span
                              key={b.key}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${b.className}`}
                            >
                              {Icon && <Icon className="w-3 h-3" />}
                              {b.label}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Badges are computed automatically: Top Paying (₱50k+ budget), Urgently Hiring (0 applications + posted ≤14 days), Multiple Slots Open (team/agents/positions in title).
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Section 3: Role Content ───────────────────────────────── */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Role Content
                  </p>

                  <div className="space-y-2 mb-4">
                    <Label htmlFor="description">
                      Role Overview <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Brief overview of the role and what makes it great — shown on the dedicated role page under 'Role Overview'..."
                      className="min-h-[100px]"
                    />
                    {errors.description && (
                      <p className="text-xs text-red-500">{errors.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        Responsibilities
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          (shown on dedicated page)
                        </span>
                      </Label>
                      <div className="rounded-md border border-input bg-background">
                        <ReactQuill
                          theme="snow"
                          value={formData.responsibilities}
                          onChange={(value) => updateField("responsibilities", value)}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder="List responsibilities using bullets or numbered list..."
                          style={{ minHeight: "140px" }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Skills &amp; Requirements
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          (shown on dedicated page)
                        </span>
                      </Label>
                      <div className="rounded-md border border-input bg-background">
                        <ReactQuill
                          theme="snow"
                          value={formData.requirements}
                          onChange={(value) => updateField("requirements", value)}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder="List required skills using bullets or numbered list..."
                          style={{ minHeight: "140px" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label htmlFor="skillTags">
                      Skill Tags
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                        (comma-separated — shown as badges on card and dedicated page)
                      </span>
                    </Label>
                    <Input
                      id="skillTags"
                      value={formData.skillTags}
                      onChange={(e) => updateField("skillTags", e.target.value)}
                      placeholder="Customer Support, Communication, Problem Solving, CRM"
                    />
                  </div>
                </div>

                {/* ── Form actions ──────────────────────────────────────────── */}
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending
                      ? "Saving…"
                      : editingJob
                      ? "Update Job"
                      : "Create Job"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Job Listings ──────────────────────────────────────────────────── */}
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
                <h3 className="text-lg font-semibold mb-2">
                  No job postings yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first job posting to start attracting talent.
                </p>
                <Button
                  onClick={() => { resetForm(); setShowForm(true); }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const shareUrl = `${window.location.origin}/jobs/${job.id}`;
                const badges = getJobBadges(job as any);
                return (
                  <ExpandableJobCard
                    key={job.id}
                    job={job}
                    showApply={false}
                    adminActions={
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status badge */}
                        <Badge
                          variant={job.status === "open" ? "default" : "secondary"}
                        >
                          {job.status === "open"
                            ? "Open"
                            : job.status === "closed"
                            ? "Closed"
                            : job.status}
                        </Badge>

                        {/* Application count */}
                        {(job.proposalCount ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {job.proposalCount} application{job.proposalCount !== 1 ? "s" : ""}
                          </span>
                        )}

                        {/* Auto-badges this job earns */}
                        {badges.map((b) => {
                          const Icon = BADGE_ICONS[b.key];
                          return (
                            <span
                              key={b.key}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${b.className}`}
                            >
                              {Icon && <Icon className="w-2.5 h-2.5" />}
                              {b.label}
                            </span>
                          );
                        })}

                        {/* Actions */}
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
                              <EyeOff className="w-3.5 h-3.5 mr-1" />
                              Close
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Reopen
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(job)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>

                        {/* View on public page */}
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={`/jobs/${job.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Preview
                          </a>
                        </Button>

                        {/* Copy share link */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(job.id)}
                        >
                          {copiedId === job.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy Link
                            </>
                          )}
                        </Button>

                        {/* Delete */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove job posting?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel "{job.title}". It will no
                                longer appear on the Find Work page.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(job.id)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Field reference card */}
        <Card className="mt-10">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">
              Field Reference — Public vs Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Field</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Job Card</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Dedicated Page</th>
                    <th className="text-left py-2 font-semibold text-muted-foreground">Modal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {[
                    ["title", "✅ Header", "✅ Hero", "✅ Header"],
                    ["company", "✅ Header", "✅ Hero", "✅ Header"],
                    ["location", "✅ Stat bar", "✅ Hero + sidebar", "✅ Stat bar"],
                    ["contractType", "✅ Stat bar + badge", "✅ Sidebar", "✅ Stat bar"],
                    ["experienceLevel", "—", "✅ Hero + sidebar", "✅ Stat bar"],
                    ["category", "✅ Card gradient", "✅ Hero gradient", "✅ Header gradient"],
                    ["description", "✅ Preview (2 lines)", "✅ Role Overview section", "✅ Description"],
                    ["responsibilities", "—", "✅ Full section", "✅ Full section"],
                    ["requirements / skillTags", "✅ Skill badges", "✅ Skills & Requirements", "✅ Skill badges"],
                    ["budget / hourlyRateMin/Max", "Hidden ✅", "✅ Hero + sidebar", "✅ Header"],
                    ["status", "—", "—", "—"],
                    ["proposalCount", "—", "—", "—"],
                    ["createdAt", "✅ Stat bar (relative)", "✅ Hero (relative)", "✅ Stat bar"],
                    ["Urgently Hiring badge", "✅ Auto-computed", "✅ Auto-computed", "—"],
                    ["Top Paying badge", "✅ Auto-computed", "✅ Auto-computed", "—"],
                    ["Multiple Slots badge", "✅ Auto-computed", "✅ Auto-computed", "—"],
                  ].map(([field, card, page, modal]) => (
                    <tr key={field}>
                      <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">{field}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{card}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{page}</td>
                      <td className="py-2 text-xs text-muted-foreground">{modal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
