import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Plus, Pencil, Star, Zap, Layers, Sparkles } from "lucide-react";
import type { Job } from "@shared/schema";
import { getJobBadges } from "@/lib/jobUtils";

// ─── Quill ───────────────────────────────────────────────────────────────────
const quillModules = {
  toolbar: [["bold"], [{ list: "ordered" }, { list: "bullet" }]],
};
const quillFormats = ["bold", "list", "bullet"];

export const toQuillHtml = (arr: string[] | null | undefined): string => {
  if (!arr || arr.length === 0) return "";
  if (arr.length === 1 && arr[0].trim().startsWith("<")) return arr[0];
  return "<ul>" + arr.map((item) => `<li>${item}</li>`).join("") + "</ul>";
};

export const isEmptyQuill = (html: string) =>
  !html || html === "<p><br></p>" || html.trim() === "";

// ─── Badge icons ─────────────────────────────────────────────────────────────
const BADGE_ICONS: Record<string, React.ElementType> = {
  "top-paying": Star,
  urgent: Zap,
  "multiple-slots": Layers,
};

// ─── Default / reset state ────────────────────────────────────────────────────
export const defaultFormData = {
  title: "",
  company: "OnSpot",
  location: "Remote",
  category: "support",
  contractType: "full-time",
  experienceLevel: "entry",
  jobSummary: "",
  description: "",
  budget: "",
  hourlyRateMin: "",
  hourlyRateMax: "",
  duration: "",
  status: "open",
  responsibilities: "",
  requirements: "",
  skillTags: "",
  culturalFit: "",
  // Role details
  reportingTo: "",
  division: "",
  jobCode: "",
  jobGrade: "",
  jobLevel: "",
  // Job Success Profile sections
  companyOverview: "",
  roleMission: "",
  keyOutcomes: "",
  keyResponsibilities: "",
  skillsAndCompetencies: "",
  behavioralTraits: "",
  kpis: "",
  trainingAndSupport: "",
  growthPath: "",
  // System requirements
  minimumInternetSpeed: "",
  systemRequirements: "",
};

export type JobFormData = typeof defaultFormData;

// ─── Helper: seed form from an existing job ───────────────────────────────────
export function jobToFormData(job: Job): JobFormData {
  return {
    title: job.title || "",
    company: job.company || "OnSpot",
    location: job.location || "Remote",
    category: job.category || "support",
    contractType: job.contractType || "full-time",
    experienceLevel: job.experienceLevel || "entry",
    jobSummary: (job as any).jobSummary || "",
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
    culturalFit: toQuillHtml(job.culturalFit as string[]),
    // Role details
    reportingTo: (job as any).reportingTo || "",
    division: (job as any).division || "",
    jobCode: (job as any).jobCode || "",
    jobGrade: (job as any).jobGrade || "",
    jobLevel: (job as any).jobLevel || "",
    // JSP sections
    companyOverview: (job as any).companyOverview || "",
    roleMission: (job as any).roleMission || "",
    keyOutcomes: (job as any).keyOutcomes || "",
    keyResponsibilities: (job as any).keyResponsibilities || "",
    skillsAndCompetencies: (job as any).skillsAndCompetencies || "",
    behavioralTraits: (job as any).behavioralTraits || "",
    kpis: (job as any).kpis || "",
    trainingAndSupport: (job as any).trainingAndSupport || "",
    growthPath: (job as any).growthPath || "",
    // System requirements
    minimumInternetSpeed: (job as any).minimumInternetSpeed || "",
    systemRequirements: (job as any).systemRequirements || "",
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Pass null to create a new job; pass a Job to edit it */
  job: Job | null;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function JobFormModal({ open, onClose, job, onSuccess }: JobFormModalProps) {
  const { toast } = useToast();
  const isEditing = job !== null;

  const [formData, setFormData] = useState<JobFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});

  // Only seed/reset the form when the modal transitions from closed → open.
  // Using a ref prevents parent re-renders (which may produce a new `job`
  // object reference with the same data) from wiping user input mid-session.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setFormData(job ? jobToFormData(job) : defaultFormData);
      setErrors({});
    }
    prevOpenRef.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/jobs", data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting created" });
      onSuccess();
    },
    onError: (err: any) =>
      toast({ title: "Failed to create job", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting updated" });
      onSuccess();
    },
    onError: (err: any) =>
      toast({ title: "Failed to update job", description: err.message, variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const updateField = (field: keyof JobFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const previewBadges = useMemo(
    () =>
      getJobBadges({
        budget: formData.budget || formData.hourlyRateMax,
        hourlyRateMin: formData.hourlyRateMin,
        hourlyRateMax: formData.hourlyRateMax,
        proposalCount: job?.proposalCount ?? 0,
        title: formData.title,
        location: formData.location,
        createdAt: job?.createdAt ?? new Date(),
      }),
    [formData, job]
  );

  const validate = (): boolean => {
    const next: Partial<Record<keyof JobFormData, string>> = {};
    if (!formData.title.trim()) next.title = "Job title is required";
    if (!formData.description.trim()) next.description = "Role overview is required";
    if (!formData.category) next.category = "Category is required";
    if (!formData.contractType) next.contractType = "Contract type is required";
    if (!formData.experienceLevel) next.experienceLevel = "Experience level is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: any = {
      title: formData.title.trim(),
      company: formData.company.trim() || "OnSpot",
      location: formData.location,
      category: formData.category,
      contractType: formData.contractType,
      experienceLevel: formData.experienceLevel,
      description: formData.description.trim(),
      jobSummary: formData.jobSummary.trim() || null,
      status: formData.status,
      budgetCurrency: "PHP",
    };

    if (!isEditing) payload.clientId = "admin-system";
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
    payload.culturalFit = !isEmptyQuill(formData.culturalFit)
      ? [formData.culturalFit]
      : [];

    // Role details (text fields — omit if empty)
    if (formData.reportingTo) payload.reportingTo = formData.reportingTo.trim();
    if (formData.division) payload.division = formData.division.trim();
    if (formData.jobCode) payload.jobCode = formData.jobCode.trim();
    if (formData.jobGrade) payload.jobGrade = formData.jobGrade.trim();
    if (formData.jobLevel) payload.jobLevel = formData.jobLevel.trim();

    // JSP sections (plain text — always include so edits can clear values)
    payload.companyOverview = formData.companyOverview.trim();
    payload.roleMission = formData.roleMission.trim();
    payload.keyOutcomes = formData.keyOutcomes.trim();
    payload.keyResponsibilities = formData.keyResponsibilities.trim();
    payload.skillsAndCompetencies = formData.skillsAndCompetencies.trim();
    payload.behavioralTraits = formData.behavioralTraits.trim();
    payload.kpis = formData.kpis.trim();
    payload.trainingAndSupport = formData.trainingAndSupport.trim();
    payload.growthPath = formData.growthPath.trim();

    // System requirements
    if (formData.minimumInternetSpeed) payload.minimumInternetSpeed = formData.minimumInternetSpeed.trim();
    payload.systemRequirements = formData.systemRequirements.trim();

    if (isEditing && job) {
      updateMutation.mutate({ id: job.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {isEditing ? (
                <Pencil className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Plus className="w-5 h-5 text-muted-foreground" />
              )}
              {isEditing ? "Edit Job Posting" : "Add New Job Posting"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? `Editing: ${job?.title}`
                : "Fill in the details below to create a new job posting."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8">

          {/* ── Section 1: Basic Information ──────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Basic Information
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-title">
                  Job Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="modal-title"
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g. Customer Service Representative"
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-company">Company</Label>
                <Input
                  id="modal-company"
                  value={formData.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  placeholder="OnSpot"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Work Setup</Label>
                <Select
                  value={formData.location}
                  onValueChange={(v) => updateField("location", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Onsite">Onsite</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => updateField("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>
                  Experience Level <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.experienceLevel}
                  onValueChange={(v) => updateField("experienceLevel", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>
                  Contract Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.contractType}
                  onValueChange={(v) => updateField("contractType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Duration</Label>
                <Select
                  value={formData.duration || ""}
                  onValueChange={(v) => updateField("duration", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
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
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => updateField("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
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

          {/* ── Section 2: Salary / Rate ───────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Salary / Rate (₱ PHP)
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Shown on the dedicated role page and preview modal only — not on
              the job card summary. Set a fixed budget <em>or</em> a min/max
              range.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  { id: "modal-budget", field: "budget", label: "Fixed Monthly Budget (₱)", placeholder: "e.g. 40000" },
                  { id: "modal-rateMin", field: "hourlyRateMin", label: "Rate Range Min (₱)", placeholder: "e.g. 30000" },
                  { id: "modal-rateMax", field: "hourlyRateMax", label: "Rate Range Max (₱)", placeholder: "e.g. 50000" },
                ] as const
              ).map(({ id, field, label, placeholder }) => (
                <div className="space-y-2" key={field}>
                  <Label htmlFor={id}>{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm pointer-events-none">
                      ₱
                    </span>
                    <Input
                      id={id}
                      type="number"
                      className="pl-7"
                      value={formData[field]}
                      onChange={(e) => updateField(field, e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                </div>
              ))}
            </div>

            {previewBadges.length > 0 && (
              <div className="mt-4 p-3 rounded-md bg-muted/40 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Badges this job will earn:
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
                  Top Paying: ₱50k+ budget · Urgently Hiring: 0 applications + posted ≤14 days · Multiple Slots: team/agents in title
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Section 3: Role Content ────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Role Content
            </p>

            {/* ── Job Summary (card preview) ───────────────────────────── */}
            <div className="space-y-2 mb-5">
              <Label htmlFor="modal-job-summary">
                Card Preview Summary
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="modal-job-summary"
                value={formData.jobSummary}
                onChange={(e) => updateField("jobSummary", e.target.value)}
                placeholder="Write a short hook that appears on the public job card — 1–2 sentences max."
                className="min-h-[64px] resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                This short summary is shown on the public job card preview only. It will not appear in the full job details page.
              </p>
            </div>

            {/* ── Full Description ─────────────────────────────────────── */}
            <div className="space-y-2 mb-5">
              <Label htmlFor="modal-description">
                Full Role Description <span className="text-red-500">*</span>
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                  (shown on the full job details page)
                </span>
              </Label>
              <Textarea
                id="modal-description"
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Brief overview of the role and what makes it great..."
                className="min-h-[90px]"
              />
              {errors.description && (
                <p className="text-xs text-red-500">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Responsibilities
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                    (dedicated page)
                  </span>
                </Label>
                <div className="rounded-md border border-input bg-background">
                  <ReactQuill
                    theme="snow"
                    value={formData.responsibilities}
                    onChange={(v) => updateField("responsibilities", v)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="List responsibilities using bullets or numbered list..."
                    style={{ minHeight: "130px" }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Skills &amp; Requirements
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                    (dedicated page)
                  </span>
                </Label>
                <div className="rounded-md border border-input bg-background">
                  <ReactQuill
                    theme="snow"
                    value={formData.requirements}
                    onChange={(v) => updateField("requirements", v)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="List required skills using bullets or numbered list..."
                    style={{ minHeight: "130px" }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="modal-tags">
                Skill Tags
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                  (comma-separated — shown as badges on card and dedicated page)
                </span>
              </Label>
              <Input
                id="modal-tags"
                value={formData.skillTags}
                onChange={(e) => updateField("skillTags", e.target.value)}
                placeholder="Customer Support, Communication, Problem Solving, CRM"
              />
            </div>
          </div>

          <Separator />

          {/* ── Section 4: Cultural Fit ────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#474ead]" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
                Cultural Fit
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Describe the personality traits, work habits, and values that make someone a great fit for this role. Shown on the dedicated job page.
            </p>
            <div className="space-y-2">
              <Label>
                Cultural Fit Bullets
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                  (dedicated page — use bullet list for best results)
                </span>
              </Label>
              <div className="rounded-md border border-input bg-background">
                <ReactQuill
                  theme="snow"
                  value={formData.culturalFit}
                  onChange={(v) => updateField("culturalFit", v)}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="e.g. Thrives in a fast-paced remote environment&#10;Communicates proactively with clients..."
                  style={{ minHeight: "130px" }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                If left empty, a set of default cultural values will be shown on the public page.
              </p>
            </div>
          </div>

          <Separator />

          {/* ── Section 5: Role Details ─────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Role Details
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Organisational context for this role — used internally and on the dedicated job page.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-reportingTo">Reporting To</Label>
                <Input
                  id="modal-reportingTo"
                  value={formData.reportingTo}
                  onChange={(e) => updateField("reportingTo", e.target.value)}
                  placeholder="e.g. Team Manager"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-division">Division</Label>
                <Input
                  id="modal-division"
                  value={formData.division}
                  onChange={(e) => updateField("division", e.target.value)}
                  placeholder="e.g. Delivery"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-jobCode">Job Code</Label>
                <Input
                  id="modal-jobCode"
                  value={formData.jobCode}
                  onChange={(e) => updateField("jobCode", e.target.value)}
                  placeholder="e.g. CSR-LTS-DEL-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-jobGrade">Job Grade</Label>
                <Input
                  id="modal-jobGrade"
                  value={formData.jobGrade}
                  onChange={(e) => updateField("jobGrade", e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-jobLevel">Job Level</Label>
                <Input
                  id="modal-jobLevel"
                  value={formData.jobLevel}
                  onChange={(e) => updateField("jobLevel", e.target.value)}
                  placeholder="e.g. P13"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Section 6: Job Success Profile ──────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#474ead]" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
                Job Success Profile
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Complete the Job Success Profile sections below. These appear on the dedicated role page and are used by the AI matching system.
            </p>

            <div className="space-y-5">
              {(
                [
                  { id: "modal-companyOverview", field: "companyOverview", label: "Company Overview", placeholder: "Describe the company, its mission, and what makes it a great place to work..." },
                  { id: "modal-roleMission", field: "roleMission", label: "Role Mission", placeholder: "What is the core purpose of this role? What does success look like..." },
                  { id: "modal-keyOutcomes", field: "keyOutcomes", label: "Key Outcomes", placeholder: "List the 3–5 measurable outcomes this role is responsible for delivering..." },
                  { id: "modal-keyResponsibilities", field: "keyResponsibilities", label: "Key Responsibilities", placeholder: "Day-to-day responsibilities and accountabilities of this role..." },
                  { id: "modal-skillsAndCompetencies", field: "skillsAndCompetencies", label: "Skills & Competencies", placeholder: "Core skills, technical knowledge, and professional competencies required..." },
                  { id: "modal-behavioralTraits", field: "behavioralTraits", label: "Behavioral Traits", placeholder: "Personality traits and working style that set top performers apart in this role..." },
                  { id: "modal-kpis", field: "kpis", label: "Key Performance Indicators (KPIs)", placeholder: "How will performance be measured? List KPIs and targets..." },
                  { id: "modal-trainingAndSupport", field: "trainingAndSupport", label: "Training & Support", placeholder: "What onboarding, training, and ongoing support does this role receive..." },
                  { id: "modal-growthPath", field: "growthPath", label: "Growth Path", placeholder: "What career progression or advancement opportunities are available..." },
                ] as const
              ).map(({ id, field, label, placeholder }) => (
                <div className="space-y-2" key={field}>
                  <Label htmlFor={id}>{label}</Label>
                  <Textarea
                    id={id}
                    value={formData[field]}
                    onChange={(e) => updateField(field, e.target.value)}
                    placeholder={placeholder}
                    className="min-h-[90px] resize-y"
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Section 7: System Requirements ──────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              System Requirements
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Technical setup required by the candidate to perform this role remotely.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modal-internetSpeed">Minimum Internet Speed</Label>
                <Input
                  id="modal-internetSpeed"
                  value={formData.minimumInternetSpeed}
                  onChange={(e) => updateField("minimumInternetSpeed", e.target.value)}
                  placeholder="e.g. 50 Mbps minimum"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-systemReqs">System Requirements</Label>
                <Textarea
                  id="modal-systemReqs"
                  value={formData.systemRequirements}
                  onChange={(e) => updateField("systemRequirements", e.target.value)}
                  placeholder="e.g. Stable internet connection, quiet workspace, headset, and laptop/desktop suitable for remote work."
                  className="min-h-[80px] resize-y"
                />
              </div>
            </div>
          </div>

          {/* ── Sticky footer with actions ───────────────────────────────────── */}
          <div className="sticky bottom-0 -mx-6 -mb-6 bg-background border-t border-border px-6 py-4 flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : isEditing
                ? "Update Job"
                : "Create Job"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            {isEditing && job && (
              <a
                href={`/find-work/job/${job.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Preview public page
              </a>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
