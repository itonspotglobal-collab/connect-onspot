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
import {
  getJobBadges,
  SUPPORTED_CURRENCIES,
  getCurrencySymbol,
  type SupportedCurrency,
} from "@/lib/jobUtils";
import {
  JOB_FUNCTIONS,
  ENGAGEMENT_TYPE_OPTIONS,
  WORK_SETUPS,
  COMPENSATION_TYPE,
} from "@/lib/jobConstants";
// Shared utilities re-exported so any existing callers keep working
export {
  toQuillHtml,
  isEmptyQuill,
  defaultFormData,
  jobToFormData,
  type JobFormData,
} from "@/lib/jobFormUtils";
import {
  toQuillHtml,
  isEmptyQuill,
  defaultFormData,
  jobToFormData,
  type JobFormData,
} from "@/lib/jobFormUtils";

// ─── Quill ───────────────────────────────────────────────────────────────────
const quillModules = {
  toolbar: [["bold"], [{ list: "ordered" }, { list: "bullet" }]],
};
const quillFormats = ["bold", "list", "bullet"];

// ─── Badge icons ─────────────────────────────────────────────────────────────
const BADGE_ICONS: Record<string, React.ElementType> = {
  "top-paying": Star,
  urgent: Zap,
  "multiple-slots": Layers,
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Pass null to create a new job; pass a Job to edit it */
  job: Job | null;
  onSuccess: () => void;
  /** When true, posts to /api/client/jobs instead of /api/admin/jobs */
  clientMode?: boolean;
  /** Pre-fill the company name (used in client mode) */
  defaultCompany?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function JobFormModal({ open, onClose, job, onSuccess, clientMode = false, defaultCompany }: JobFormModalProps) {
  const { toast } = useToast();
  const isEditing = job !== null;

  const baseDefault = clientMode && defaultCompany
    ? { ...defaultFormData, company: defaultCompany }
    : defaultFormData;

  const [formData, setFormData] = useState<JobFormData>(baseDefault);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});

  // Only seed/reset the form when the modal transitions from closed → open.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const base = clientMode && defaultCompany ? { ...defaultFormData, company: defaultCompany } : defaultFormData;
      setFormData(job ? jobToFormData(job) : base);
      setErrors({});
    }
    prevOpenRef.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiBase = clientMode ? "/api/client/jobs" : "/api/admin/jobs";

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", apiBase, data),
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
      apiRequest("PATCH", `${apiBase}/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting updated" });
      onSuccess();
    },
    onError: (err: any) => {
      // err.message is the API response body text thrown by apiRequest for non-2xx
      const detail = err?.message ?? "Unknown error";
      toast({ title: "Failed to update job", description: detail, variant: "destructive" });
      console.error("[JobFormModal] update failed:", detail);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Approval confirmation (create-only) ─────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const updateField = (field: keyof JobFormData, value: JobFormData[keyof JobFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const previewBadges = useMemo(
    () =>
      getJobBadges({
        salaryDisplay: formData.salaryDisplay,
        budgetCurrency: formData.currency,
        proposalCount: job?.proposalCount ?? 0,
        title: formData.title,
        location: formData.location,
        createdAt: job?.createdAt ?? new Date(),
        urgentlyHiring: formData.urgentlyHiring,
      }),
    [formData, job]
  );

  // Ensures apply links always have a protocol prefix
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof JobFormData, string>> = {};
    if (!formData.professionalRoleName.trim()) next.professionalRoleName = "Professional role name is required";
    // Note: "Confidential" is a valid company name for admin-posted jobs — do not block it.
    if (!formData.company.trim()) next.company = "Company name is required";
    if (!formData.description.trim()) next.description = "Role overview is required";
    if (!formData.jobFunction.trim()) next.jobFunction = "Function is required";
    if (!formData.engagementType?.trim()) next.engagementType = "Engagement type is required";
    if (!formData.experienceLevel) next.experienceLevel = "Experience level is required";
    // Salary is required for NEW jobs only; editing an existing job without salary is allowed
    // (admin can leave the salary field blank on an existing record and fill it in later).
    if (!isEditing && !formData.salaryDisplay.trim())
      next.salaryDisplay = "Salary is required for new jobs — enter an amount (e.g. 40,000 – 60,000)";
    if (formData.applicationMethod === "external_link" && formData.applyLink.trim()) {
      try { new URL(normalizeUrl(formData.applyLink)); }
      catch { next.applyLink = "Please enter a valid URL (e.g. https://example.com/apply)"; }
    }
    if (formData.currency === "OTHER") {
      const code = formData.customCurrencyCode.trim().toUpperCase();
      if (!code) next.customCurrencyCode = "Currency code is required when 'Other' is selected";
      else if (!/^[A-Z]{3}$/.test(code)) next.customCurrencyCode = "Enter exactly 3 letters (e.g. NZD, AED, CHF)";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: any = {
      professionalRoleName: formData.professionalRoleName.trim(),
      title: formData.professionalRoleName.trim(),
      originalRoleName: formData.originalRoleName.trim() || null,
      jobFunction: formData.jobFunction.trim(),
      company: formData.company.trim() || "OnSpot",
      location: formData.location,
      category: formData.jobFunction.trim(),
      engagementType: formData.engagementType?.trim() || "",
      experienceLevel: formData.experienceLevel,
      description: formData.description.trim(),
      jobSummary: formData.jobSummary.trim() || null,
      status: formData.status,
      budgetCurrency: formData.currency === "OTHER"
        ? (formData.customCurrencyCode.trim().toUpperCase() || "PHP")
        : formData.currency,
      customCurrencyCode: formData.currency === "OTHER"
        ? formData.customCurrencyCode.trim().toUpperCase() || null
        : null,
    };

    if (!isEditing) payload.clientId = "admin-system";
    payload.salaryDisplay = formData.salaryDisplay.trim() || null;
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

    // System requirements + tools
    if (formData.minimumInternetSpeed) payload.minimumInternetSpeed = formData.minimumInternetSpeed.trim();
    payload.systemRequirements = formData.systemRequirements.trim();
    payload.requiredToolsSoftware = formData.requiredToolsSoftware.trim() || null;
    payload.otherEquipmentRequirements = formData.otherEquipmentRequirements.trim() || null;

    // Work schedule
    payload.workDays = formData.workDays.trim() || null;
    payload.timeZone = formData.timeZone.trim() || null;
    payload.weeklyHours = formData.weeklyHours.trim() || null;
    payload.scheduleFlexibility = formData.scheduleFlexibility.trim() || null;

    // Preferred qualifications (rich text stored as single HTML string)
    payload.preferredQualifications = !isEmptyQuill(formData.preferredQualifications)
      ? formData.preferredQualifications
      : null;

    // Compensation extras
    payload.paymentFrequency = formData.paymentFrequency.trim() || null;
    payload.compensationNotes = formData.compensationNotes.trim() || null;

    // What We Offer (rich text)
    payload.whatWeOffer = !isEmptyQuill(formData.whatWeOffer) ? formData.whatWeOffer : null;

    // Application method + link
    payload.applicationMethod = formData.applicationMethod;
    if (formData.applicationMethod === "external_link") {
      payload.applyLink = formData.applyLink.trim() ? normalizeUrl(formData.applyLink) : null;
    } else {
      payload.applyLink = null;
    }

    // Featured job flag (always send so toggling is correctly persisted)
    payload.isFeatured = formData.isFeatured;

    // Urgently Hiring flag (always send so unchecking a previously set job clears it)
    payload.urgentlyHiring = formData.urgentlyHiring;

    // Resume requirement (always send so unchecking clears it)
    payload.requiresResume = formData.requiresResume;

    // Video intro requirement (always send so unchecking clears it)
    payload.requiresVideoIntro = formData.requiresVideoIntro;


    // Benefits / HMO (always send so admins can clear the value)
    payload.benefits = formData.benefits.trim() || null;

    // Compensation type (always send so admins can clear the value)
    payload.compensationType = formData.compensationType || null;

    // Additional compensation benefits
    payload.hasCommission = formData.hasCommission;
    payload.hasEquity = formData.hasEquity;

    if (isEditing && job) {
      updateMutation.mutate({ id: job.id, data: payload });
    } else {
      // Show "Submit for approval?" confirmation before creating
      setPendingPayload(payload);
      setConfirmOpen(true);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
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

          {/* ── 1. BASIC ROLE INFORMATION ──────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Basic Role Information
            </p>

            <div className="space-y-2 mb-4">
              <Label htmlFor="modal-professional-role">
                Professional Role Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-professional-role"
                value={formData.professionalRoleName}
                onChange={(e) => updateField("professionalRoleName", e.target.value)}
                placeholder="e.g. Senior Account Executive – Salesforce Solutions"
              />
              <p className="text-xs text-muted-foreground">
                The polished role title that applicants will see publicly.
              </p>
              {errors.professionalRoleName && (
                <p className="text-xs text-red-500">{errors.professionalRoleName}</p>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="modal-original-role">
                Original Role / Alternative Role
              </Label>
              <Input
                id="modal-original-role"
                value={formData.originalRoleName}
                onChange={(e) => updateField("originalRoleName", e.target.value)}
                placeholder="e.g. Account Executive / Business Development Representative"
              />
              <p className="text-xs text-muted-foreground">
                The original client title, internal title, or common alternative names.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
                <Label htmlFor="modal-job-function">
                  Function <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.jobFunction}
                  onValueChange={(v) => updateField("jobFunction", v)}
                >
                  <SelectTrigger id="modal-job-function">
                    <SelectValue placeholder="Select a function…" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_FUNCTIONS.map((fn) => (
                      <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.jobFunction && (
                  <p className="text-xs text-red-500">{errors.jobFunction}</p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-engagement-type">
                  Engagement Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.engagementType || ""}
                  onValueChange={(v) => updateField("engagementType", v)}
                >
                  <SelectTrigger id="modal-engagement-type">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGAGEMENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.engagementType && (
                  <p className="text-xs text-red-500">{errors.engagementType}</p>
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
            </div>
          </div>

          <Separator />

          {/* ── 2. ABOUT THE COMPANY ────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              About the Company
            </p>

            <div className="space-y-2 mb-4">
              <Label htmlFor="modal-company">
                Company Name or Industry <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-company"
                value={formData.company}
                onChange={(e) => updateField("company", e.target.value)}
                placeholder="e.g. OnSpot, Information Technology, Healthcare, BPO, Construction"
              />
              <p className="text-xs text-muted-foreground">
                Enter the company name or, if preferred, the industry this role belongs to.
              </p>
              {errors.company && (
                <p className="text-xs text-red-500">{errors.company}</p>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="modal-companyOverview">
                Company Description
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="modal-companyOverview"
                value={formData.companyOverview}
                onChange={(e) => updateField("companyOverview", e.target.value)}
                placeholder="Describe the company, its mission, and what makes it a great place to work..."
                className="min-h-[90px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Provide a short overview of the company, including its industry, mission, market, or work environment. Shown publicly under "About the Company" on the job details page.
              </p>
            </div>
          </div>

          <Separator />

          {/* ── 3. ABOUT THE ROLE ───────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              About the Role
            </p>

            <div className="space-y-2 mb-4">
              <Label htmlFor="modal-job-summary">
                Card Preview Summary
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional — job card only)</span>
              </Label>
              <Textarea
                id="modal-job-summary"
                value={formData.jobSummary}
                onChange={(e) => updateField("jobSummary", e.target.value)}
                placeholder="Write a short hook that appears on the public job card — 1–2 sentences max."
                className="min-h-[64px] resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown on the job card preview only — does not appear on the full job details page.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-description">
                Full Role Description <span className="text-red-500">*</span>
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(shown on the job details page)</span>
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
          </div>

          <Separator />

          {/* ── 4. KEY RESPONSIBILITIES ─────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Key Responsibilities
            </p>
            <div className="space-y-2">
              <div className="rounded-md border border-input bg-background">
                <ReactQuill
                  theme="snow"
                  value={formData.responsibilities}
                  onChange={(v) => updateField("responsibilities", v)}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="List responsibilities using bullets or numbered list..."
                  style={{ minHeight: "150px" }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use bullet or numbered lists for best readability on the public page.
              </p>
            </div>
          </div>

          <Separator />

          {/* ── 5. REQUIRED QUALIFICATIONS ──────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Required Qualifications
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="rounded-md border border-input bg-background">
                  <ReactQuill
                    theme="snow"
                    value={formData.requirements}
                    onChange={(v) => updateField("requirements", v)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="List required skills, experience, and qualifications using bullets or numbered list..."
                    style={{ minHeight: "150px" }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-tags">
                  Skill Tags
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                    (comma-separated — shown as badges on the card and job details page)
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
          </div>

          <Separator />

          {/* ── 6. PREFERRED QUALIFICATIONS ─────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Preferred Qualifications
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Optional qualifications that are beneficial but not strictly required.
            </p>
            <div className="space-y-2">
              <div className="rounded-md border border-input bg-background">
                <ReactQuill
                  theme="snow"
                  value={formData.preferredQualifications}
                  onChange={(v) => updateField("preferredQualifications", v)}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="e.g. Experience with Salesforce — Familiarity with US market — Prior remote work experience..."
                  style={{ minHeight: "130px" }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Shown on the public job page under "Preferred Qualifications". Leave blank to omit the section.
              </p>
            </div>
          </div>

          <Separator />

          {/* ── 7. CULTURAL FIT ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#474ead]" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
                Cultural Fit
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Personality traits, work habits, and values that make someone a great fit for this role. Shown on the dedicated job page.
            </p>
            <div className="space-y-2">
              <div className="rounded-md border border-input bg-background">
                <ReactQuill
                  theme="snow"
                  value={formData.culturalFit}
                  onChange={(v) => updateField("culturalFit", v)}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="e.g. Thrives in a fast-paced remote environment — Communicates proactively with clients..."
                  style={{ minHeight: "130px" }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Use bullet list for best results. If left empty, default cultural values will be shown on the public page.
              </p>
            </div>
          </div>

          <Separator />

          {/* ── 8. REQUIRED TOOLS & EQUIPMENT ───────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Required Tools &amp; Equipment
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Technical setup and equipment required to perform this role.
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
                <Label htmlFor="modal-systemReqs">System &amp; Equipment Requirements</Label>
                <Textarea
                  id="modal-systemReqs"
                  value={formData.systemRequirements}
                  onChange={(e) => updateField("systemRequirements", e.target.value)}
                  placeholder="e.g. Reliable laptop/desktop, headset, webcam, quiet professional workspace."
                  className="min-h-[72px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-toolsSoftware">
                  Required Tools / Software
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="modal-toolsSoftware"
                  value={formData.requiredToolsSoftware}
                  onChange={(e) => updateField("requiredToolsSoftware", e.target.value)}
                  placeholder="e.g. Salesforce, Slack, Google Workspace, Zoom, Asana"
                  className="min-h-[60px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-otherEquipment">
                  Other Equipment Requirements
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="modal-otherEquipment"
                  value={formData.otherEquipmentRequirements}
                  onChange={(e) => updateField("otherEquipmentRequirements", e.target.value)}
                  placeholder="e.g. Noise-cancelling headset, external monitor"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 9. WORK SCHEDULE ────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Work Schedule
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Expected working hours and schedule for this role. Leave blank to omit the section.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-workDays">Work Days</Label>
                <Input
                  id="modal-workDays"
                  value={formData.workDays}
                  onChange={(e) => updateField("workDays", e.target.value)}
                  placeholder="e.g. Monday – Friday"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-timeZone">Time Zone</Label>
                <Input
                  id="modal-timeZone"
                  value={formData.timeZone}
                  onChange={(e) => updateField("timeZone", e.target.value)}
                  placeholder="e.g. US Eastern overlap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-weeklyHours">Weekly Hours</Label>
                <Input
                  id="modal-weeklyHours"
                  value={formData.weeklyHours}
                  onChange={(e) => updateField("weeklyHours", e.target.value)}
                  placeholder="e.g. 40 hours / week"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-scheduleFlexibility">Flexibility</Label>
                <Input
                  id="modal-scheduleFlexibility"
                  value={formData.scheduleFlexibility}
                  onChange={(e) => updateField("scheduleFlexibility", e.target.value)}
                  placeholder="e.g. Set hours, remote"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 10. COMPENSATION ────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Compensation
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Enter the monthly compensation applicants will see.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="modal-currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => {
                    updateField("currency", v);
                    if (v !== "OTHER") updateField("customCurrencyCode", "");
                  }}
                >
                  <SelectTrigger id="modal-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.currency === "OTHER" && (
                <div className="space-y-2">
                  <Label htmlFor="modal-custom-currency">Currency Code</Label>
                  <Input
                    id="modal-custom-currency"
                    value={formData.customCurrencyCode}
                    onChange={(e) =>
                      updateField(
                        "customCurrencyCode",
                        e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)
                      )
                    }
                    placeholder="e.g. NZD, AED, CHF"
                    maxLength={3}
                  />
                  {errors.customCurrencyCode && (
                    <p className="text-xs text-red-500">{errors.customCurrencyCode}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="modal-salary-display">
                Monthly Compensation <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-salary-display"
                type="text"
                value={formData.salaryDisplay}
                onChange={(e) => updateField("salaryDisplay", e.target.value)}
                placeholder={`e.g. ${getCurrencySymbol(formData.currency, formData.customCurrencyCode)}40,000 or 30,000 – 50,000`}
              />
              {errors.salaryDisplay ? (
                <p className="text-xs text-red-500">{errors.salaryDisplay}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Enter the monthly amount (e.g. 40,000 or 30,000 – 50,000). "Rate TBD" and blank values are not allowed for new jobs.
                </p>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 flex items-center gap-3 mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Compensation Type: Monthly</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All jobs use monthly compensation. Annual, hourly, and project-based types are not supported.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                Monthly
              </span>
            </div>

            {previewBadges.length > 0 && (
              <div className="mb-4 p-3 rounded-md bg-muted/40 border border-border">
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
                  Top Paying (PHP): ₱50k+ budget · Multiple Slots: team/agents in title
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="modal-paymentFrequency">Payment Frequency</Label>
                <Input
                  id="modal-paymentFrequency"
                  value={formData.paymentFrequency}
                  onChange={(e) => updateField("paymentFrequency", e.target.value)}
                  placeholder="e.g. Monthly"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-compensationNotes">
                  Compensation Notes
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="modal-compensationNotes"
                  value={formData.compensationNotes}
                  onChange={(e) => updateField("compensationNotes", e.target.value)}
                  placeholder="e.g. Includes performance-based incentives"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Additional Compensation
              </p>
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
                <input
                  id="modal-has-commission"
                  type="checkbox"
                  checked={formData.hasCommission}
                  onChange={(e) => updateField("hasCommission", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-[#474ead] cursor-pointer"
                />
                <div>
                  <label htmlFor="modal-has-commission" className="text-sm font-medium cursor-pointer select-none">
                    Offers Commission
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Additional performance- or sales-based compensation may be offered.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
                <input
                  id="modal-has-equity"
                  type="checkbox"
                  checked={formData.hasEquity}
                  onChange={(e) => updateField("hasEquity", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-[#474ead] cursor-pointer"
                />
                <div>
                  <label htmlFor="modal-has-equity" className="text-sm font-medium cursor-pointer select-none">
                    Offers Equity
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    This role may include stock, ownership, or equity-based compensation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 11. WHAT WE OFFER ───────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              What We Offer
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  What We Offer
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional — shown as a list on the job page)</span>
                </Label>
                <div className="rounded-md border border-input bg-background">
                  <ReactQuill
                    theme="snow"
                    value={formData.whatWeOffer}
                    onChange={(v) => updateField("whatWeOffer", v)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="e.g. Flexible, fully remote work arrangement — Long-term engagement potential — Performance-based incentives — Professional growth opportunities..."
                    style={{ minHeight: "130px" }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Use bullet list for best results. Shown publicly under "What We Offer".
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-benefits">
                  Benefits / Perks Tags
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="modal-benefits"
                  value={formData.benefits}
                  onChange={(e) => updateField("benefits", e.target.value)}
                  placeholder="e.g. HMO upon regularization, 1 dependent, SSS, PhilHealth, Pag-IBIG, paid leave, internet allowance"
                  className="min-h-[60px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated benefit tags (HMO, allowances, leave, bonuses). Displayed as pills below the What We Offer list.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 12. JOB SUCCESS PROFILE ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#474ead]" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
                Job Success Profile
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Optional — these sections appear on the dedicated role page and are used by the AI matching system.
            </p>

            <div className="space-y-5">
              {(
                [
                  { id: "modal-roleMission", field: "roleMission", label: "Role Mission", placeholder: "What is the core purpose of this role? What does success look like..." },
                  { id: "modal-keyOutcomes", field: "keyOutcomes", label: "Key Outcomes", placeholder: "List the 3–5 measurable outcomes this role is responsible for delivering..." },
                  { id: "modal-keyResponsibilities", field: "keyResponsibilities", label: "Key Responsibilities (JSP)", placeholder: "Day-to-day responsibilities and accountabilities of this role..." },
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

            {/* Role Details — internal organisational fields */}
            <div className="mt-6 pt-5 border-t border-border/60">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Role Details (Internal)
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
          </div>

          <Separator />

          {/* ── 13. POSTING OPTIONS ─────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Posting Options
            </p>

            <div className="flex items-start gap-3 rounded-md border border-amber-200/60 bg-amber-50/40 p-3 dark:border-amber-800/30 dark:bg-amber-950/20 mb-3">
              <input
                id="modal-is-featured"
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => updateField("isFeatured", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-amber-500 cursor-pointer"
              />
              <div>
                <label htmlFor="modal-is-featured" className="text-sm font-medium cursor-pointer select-none">
                  Feature this job
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Featured jobs are highlighted on the public Find Work page and prioritized near the top of listings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3 mb-3">
              <input
                id="modal-urgently-hiring"
                type="checkbox"
                checked={formData.urgentlyHiring}
                onChange={(e) => updateField("urgentlyHiring", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-[#474ead] cursor-pointer"
              />
              <div>
                <label htmlFor="modal-urgently-hiring" className="text-sm font-medium cursor-pointer select-none">
                  Mark as Urgently Hiring
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formData.urgentlyHiring
                    ? "This job will display the Urgently Hiring badge."
                    : "This job will not display the Urgently Hiring badge."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-800/30 dark:bg-violet-950/20">
              <input
                id="modal-requires-video-intro"
                type="checkbox"
                checked={formData.requiresVideoIntro}
                onChange={(e) => updateField("requiresVideoIntro", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-violet-600 cursor-pointer"
              />
              <div>
                <label htmlFor="modal-requires-video-intro" className="text-sm font-medium cursor-pointer select-none">
                  Require Video Introduction
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formData.requiresVideoIntro
                    ? "Applicants must upload a short video introduction (MP4, MOV, or WebM · max 200 MB) to submit their application."
                    : "No video introduction required — applicants submit CV and cover letter only."}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 14. APPLICATION METHOD / STATUS ─────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Application &amp; Publishing
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Application Method</Label>
                <Select
                  value={formData.applicationMethod}
                  onValueChange={(v) => updateField("applicationMethod", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external_link">External Link</SelectItem>
                    <SelectItem value="built_in_form">Built-in Form</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.applicationMethod === "built_in_form"
                    ? "Candidates apply directly on OnSpot."
                    : "Candidates are redirected to the external URL."}
                </p>
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

            {formData.applicationMethod === "external_link" && (
              <div className="space-y-2">
                <Label htmlFor="modal-apply-link">Apply Link</Label>
                <Input
                  id="modal-apply-link"
                  value={formData.applyLink}
                  onChange={(e) => updateField("applyLink", e.target.value)}
                  placeholder="https://example.com/apply"
                />
                {errors.applyLink ? (
                  <p className="text-xs text-red-500">{errors.applyLink}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Where candidates click "Apply Now". Leave blank to disable the button.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Sticky footer with actions ───────────────────────────────────── */}
          <div className="sticky bottom-0 -mx-6 -mb-6 bg-background border-t border-border px-6 py-4 flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : isEditing
                ? "Update Job"
                : "Submit for Approval"}
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

    {/* ── Submit for approval confirmation ──────────────────────────────── */}

    <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) setConfirmOpen(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#474ead]" />
            Submit job for approval?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-300 py-1">
          This role will remain hidden from the public Find Work page until it is approved.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#474ead] text-white hover:bg-[#3d439c]"
            disabled={createMutation.isPending}
            onClick={() => {
              if (pendingPayload) {
                createMutation.mutate(pendingPayload);
                setConfirmOpen(false);
              }
            }}
          >
            {createMutation.isPending ? "Submitting…" : "Submit for Approval"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
