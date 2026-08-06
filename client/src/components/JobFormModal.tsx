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
  CONTRACT_TYPE_OPTIONS,
  WORK_SETUPS,
  COMPENSATION_TYPE,
} from "@/lib/jobConstants";

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
  professionalRoleName: "",
  originalRoleName: "",
  jobFunction: "",
  category: "",
  contractType: "",
  experienceLevel: "entry",
  jobSummary: "",
  description: "",
  salaryDisplay: "",
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
  // Application link / method
  applicationMethod: "built_in_form",
  applyLink: "",
  // Featured job flag
  isFeatured: false,
  // Urgently Hiring flag (manual, not auto-calculated)
  urgentlyHiring: false,
  // Company visibility
  isCompanyConfidential: false,
  confidentialClientOverview: "",
  // Benefits / HMO
  benefits: "",
  // Compensation type — locked to monthly for all new/edited jobs
  compensationType: COMPENSATION_TYPE as "monthly",
  // Additional compensation benefits
  hasCommission: false,
  hasEquity: false,
  // Currency
  currency: "PHP",
  customCurrencyCode: "",
};

export type JobFormData = typeof defaultFormData;

// ─── Helper: seed form from an existing job ───────────────────────────────────
export function jobToFormData(job: Job): JobFormData {
  return {
    title: job.title || "",
    company: job.company || "OnSpot",
    location: job.location || "Remote",
    professionalRoleName: (job as any).professionalRoleName || job.title || "",
    originalRoleName: (job as any).originalRoleName || "",
    jobFunction: (job as any).jobFunction || job.category || "",
    category: job.category || "",
    contractType: job.contractType || "",
    experienceLevel: job.experienceLevel || "entry",
    jobSummary: (job as any).jobSummary || "",
    description: job.description || "",
    salaryDisplay: (job as any).salaryDisplay || "",
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
    // Application link / method
    applicationMethod: (job as any).applicationMethod || "built_in_form",
    applyLink: (job as any).applyLink || "",
    // Featured job flag
    isFeatured: (job as any).isFeatured ?? false,
    // Urgently Hiring flag
    urgentlyHiring: (job as any).urgentlyHiring ?? false,
    // Company visibility
    isCompanyConfidential: (job as any).isCompanyConfidential ?? false,
    confidentialClientOverview: (job as any).confidentialClientOverview || "",
    // Benefits / HMO
    benefits: (job as any).benefits || "",
    // Compensation type — always "monthly" for edited jobs going forward
    compensationType: COMPENSATION_TYPE,
    // Additional compensation benefits
    hasCommission: (job as any).hasCommission ?? false,
    hasEquity: (job as any).hasEquity ?? false,
    // Currency
    currency: (job as any).budgetCurrency || "PHP",
    customCurrencyCode: (job as any).customCurrencyCode || "",
  };
}

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
    if (!formData.contractType.trim()) next.contractType = "Contract type is required";
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
      contractType: formData.contractType.trim(),
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

    // System requirements
    if (formData.minimumInternetSpeed) payload.minimumInternetSpeed = formData.minimumInternetSpeed.trim();
    payload.systemRequirements = formData.systemRequirements.trim();

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

    // Company visibility (always send so unchecking a previously set flag clears it)
    payload.isCompanyConfidential = formData.isCompanyConfidential;
    payload.confidentialClientOverview = formData.confidentialClientOverview.trim() || null;

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

          {/* ── Section 1: Basic Information ──────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Basic Information
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="modal-company">Company</Label>
                <Input
                  id="modal-company"
                  value={formData.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  placeholder="OnSpot"
                />
                {/* Confidential toggle — shown directly under the company field */}
                <label className="flex cursor-pointer items-start gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="modal-confidential"
                    checked={formData.isCompanyConfidential}
                    onChange={(e) => updateField("isCompanyConfidential", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-[#474ead]"
                  />
                  <div>
                    <span className="text-sm font-medium leading-none">Keep company confidential</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Applicants see "Confidential Company" — the real name stays hidden.
                    </p>
                  </div>
                </label>

                {/* Confidential Client Overview — only shown when confidential is enabled */}
                {formData.isCompanyConfidential && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-900/10">
                    <Label htmlFor="modal-confidential-overview" className="text-sm font-medium">
                      Confidential Client Overview
                    </Label>
                    <Textarea
                      id="modal-confidential-overview"
                      value={formData.confidentialClientOverview}
                      onChange={(e) => updateField("confidentialClientOverview", e.target.value)}
                      placeholder="e.g. A fast-growing B2B SaaS company serving mid-market customers across North America. The team operates remotely and focuses on workflow automation and operational efficiency."
                      className="mt-2 min-h-[90px] resize-y bg-white dark:bg-white/5"
                    />
                    <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                      Provide a short anonymous overview — include industry, company size, market, and work environment. <strong>Do not include</strong> the company name, exact office location, unique products, or other identifying details.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
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
                <p className="text-xs text-muted-foreground">
                  The broad functional group for organisation and filtering.
                </p>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="modal-contract-type">
                  Contract Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.contractType}
                  onValueChange={(v) => updateField("contractType", v)}
                >
                  <SelectTrigger id="modal-contract-type">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
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

            {/* Application Method + Apply Link */}
            <div className="mt-4 space-y-4">
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
                    ? "Candidates will complete the application form directly on OnSpot."
                    : "Candidates will be redirected to the external application URL."}
                </p>
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
          </div>

          <Separator />

          {/* ── Section 2: Salary / Rate ───────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Salary / Rate
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Enter the compensation amount applicants should see, then select how the role is paid.
            </p>

            {/* Currency selector */}
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

              {/* Custom currency code — visible only when OTHER is selected */}
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

            {/* Single salary display field */}
            <div className="space-y-2">
              <Label htmlFor="modal-salary-display">
                Salary <span className="text-red-500">*</span>
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
                  Required — enter the monthly amount (e.g. 40,000 or 30,000 – 50,000). "Rate TBD" and blank values are not allowed.
                </p>
              )}
            </div>

            {/* Compensation Type — locked to Monthly */}
            <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 flex items-center gap-3">
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
                  Top Paying (PHP): ₱50k+ budget · Multiple Slots: team/agents in title
                </p>
              </div>
            )}

            {/* ── Benefits ── */}
            <div className="mt-4 space-y-2">
              <Label htmlFor="modal-benefits">
                Benefits
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="modal-benefits"
                value={formData.benefits}
                onChange={(e) => updateField("benefits", e.target.value)}
                placeholder="e.g. HMO upon regularization, 1 dependent, SSS, PhilHealth, Pag-IBIG, paid leave, internet allowance"
                className="min-h-[72px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Optional — enter the benefits available for this role. You can include HMO, government benefits, allowances, leave, bonuses, or other perks.
              </p>
            </div>

            {/* ── Feature this job toggle ── */}
            <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-200/60 bg-amber-50/40 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
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
                  Featured jobs are highlighted on the public Find Work page and are prioritized near the top of job listings.
                </p>
              </div>
            </div>

            {/* ── Urgently Hiring toggle ── */}
            <div className="mt-4 flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
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

            {/* ── Additional Compensation ── */}
            <div className="mt-4 space-y-2">
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
