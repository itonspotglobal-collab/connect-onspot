import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  defaultFormData,
  jobToFormData,
  isEmptyQuill,
  type JobFormData,
} from "@/lib/jobFormUtils";
import { JobBasicsStep } from "@/components/job-form/JobBasicsStep";
import { JobDescriptionStep } from "@/components/job-form/JobDescriptionStep";
import { JobRequirementsStep } from "@/components/job-form/JobRequirementsStep";
import { JobReviewStep } from "@/components/job-form/JobReviewStep";
import type { Job } from "@shared/schema";

// ─── Step names ───────────────────────────────────────────────────────────────
const STEPS = ["Basics", "Description", "Requirements", "Review"] as const;

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};


// ─── Main page component ──────────────────────────────────────────────────────
export default function JobFormPage() {
  const { jobId } = useParams<{ jobId?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!jobId;

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<JobFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  // ─── Load existing job in edit mode ────────────────────────────────────────
  const { data: existingJob, isLoading: isJobLoading, isError: isJobError } = useQuery<Job>({
    queryKey: ["/api/admin/jobs", jobId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/jobs/${jobId}`);
      if (!res.ok) throw new Error(`Failed to load job (HTTP ${res.status})`);
      return res.json();
    },
    enabled: isEditing,
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => {
    if (existingJob) {
      setFormData(jobToFormData(existingJob));
      setIsDirty(false);
    }
  }, [existingJob]);


  // ─── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/jobs", data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting created — submitted for approval" });
      navigate("/admin/find-work");
    },
    onError: (err: any) =>
      toast({
        title: "Failed to create job",
        description: err.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting updated" });
      navigate("/admin/find-work");
    },
    onError: (err: any) => {
      const detail = err?.message ?? "Unknown error";
      toast({
        title: "Failed to update job",
        description: detail,
        variant: "destructive",
      });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const updateField = (field: keyof JobFormData, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Switching to Full Time: duration is irrelevant — clear it.
      if (field === "engagementType" && value === "Half-Day") {
        next.duration = "";
      }
      return next;
    });
    setIsDirty(true);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const scrollToTop = () => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (target: number) => {
    setStep(target);
    setErrors({});
    setTimeout(scrollToTop, 50);
  };

  const handleContinue = () => {
    const errs = validateStep(step, formData, isEditing);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      setTimeout(() => {
        const firstErr = document.querySelector("[data-error='true']");
        firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});
    if (step < STEPS.length - 1) {
      goToStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) goToStep(step - 1);
  };

  const handleSubmit = () => {
    // Safety guard: never submit an edit if the job record hasn't been loaded.
    // This prevents overwriting an existing job with blank default values if the
    // initial GET failed silently or the component was somehow rendered in an
    // inconsistent state.
    if (isEditing && !existingJob) {
      toast({
        title: "Cannot save — job data not loaded",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    // Run all-step validation before final submit
    const allErrors: Partial<Record<keyof JobFormData, string>> = {};
    for (let s = 0; s < 3; s++) {
      Object.assign(allErrors, validateStep(s, formData, isEditing));
    }
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Find which step has errors and go there
      for (let s = 0; s < 3; s++) {
        const stepErrors = validateStep(s, formData, isEditing);
        if (Object.keys(stepErrors).length > 0) {
          goToStep(s);
          return;
        }
      }
      return;
    }

    const payload = buildPayload(formData, isEditing);

    if (isEditing && jobId) {
      updateMutation.mutate({ id: jobId, data: payload });
    } else {
      setPendingPayload(payload);
      setConfirmOpen(true);
    }
  };

  const handleSaveAndExit = () => {
    if (isDirty) {
      setShowExitDialog(true);
    } else {
      navigate("/admin/find-work");
    }
  };

  // ─── Loading / error state ─────────────────────────────────────────────────
  if (isEditing && isJobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#474ead] border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading job details…</p>
        </div>
      </div>
    );
  }

  // If in edit mode and the fetch failed (or succeeded but returned nothing),
  // show an error screen. Never render or allow submission with blank-default state.
  if (isEditing && (isJobError || (!isJobLoading && !existingJob))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold mb-2">Couldn't load this job</p>
          <p className="text-sm text-muted-foreground mb-6">
            There was a problem fetching the job record. No changes have been made.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/admin/find-work")}>
              Back to jobs
            </Button>
            <Button
              className="bg-[#474ead] text-white hover:bg-[#3d439c]"
              onClick={() => {
                queryClient.resetQueries({ queryKey: ["/api/admin/jobs", jobId] });
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Unsaved changes dialog ── */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now they will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/admin/find-work")}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Approval confirmation dialog (create-only) ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit for approval?</DialogTitle>
            <DialogDescription>
              This job posting will be reviewed by an admin before it goes live on the job board.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#474ead] hover:bg-[#3c3f9e] text-white"
              disabled={isPending}
              onClick={() => {
                setConfirmOpen(false);
                createMutation.mutate(pendingPayload);
              }}
            >
              {isPending ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-br from-indigo-50/60 via-background to-teal-50/40 dark:from-indigo-950/20 dark:via-background dark:to-teal-950/10">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 sm:px-6 py-3.5">
            {/* Brand */}
            <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#474ead] to-teal-400 text-white font-serif italic text-base">
                O
              </div>
              <span className="hidden sm:inline">OnSpot</span>
            </div>

            {/* Title */}
            <span className="text-sm font-semibold text-muted-foreground">
              {isEditing ? "Edit Job Posting" : "Post a Job"}
            </span>

            {/* Save & exit */}
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Save &amp; exit</span>
            </button>
          </div>
        </header>

        <div
          ref={contentRef}
          className="mx-auto max-w-[760px] px-4 sm:px-6 pt-8 pb-36"
        >
          {/* Hero */}
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[#474ead] mb-2">
              {isEditing ? "Edit job posting" : "Post a job"}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-none tracking-tight mb-3">
              Let's find your <em className="italic text-[#474ead]">match.</em>
            </h1>
            <p className="text-sm text-muted-foreground max-w-[52ch]">
              Four short steps. The essentials get you posted fast — everything else is optional and helps our matching find the right people.
            </p>
          </div>

          {/* Stepper */}
          <ol className="flex gap-1.5 mb-1 list-none p-0">
            {STEPS.map((label, idx) => {
              const isDone = idx < step;
              const isActive = idx === step;
              return (
                <li
                  key={label}
                  className="flex flex-1 flex-col gap-2 cursor-pointer"
                  onClick={() => {
                    // Allow clicking back to completed steps only
                    if (idx < step) goToStep(idx);
                  }}
                >
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isDone || isActive
                        ? "bg-[#474ead]"
                        : "bg-border"
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
                        isDone
                          ? "border-[#474ead] bg-[#474ead] text-white"
                          : isActive
                            ? "border-[#474ead] text-[#474ead]"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`hidden sm:inline text-[12.5px] font-semibold ${
                        isDone
                          ? "text-[#474ead]"
                          : isActive
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Step card */}
          <div className="mt-5 rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-8">
            {step === 0 && (
              <JobBasicsStep
                formData={formData}
                updateField={updateField}
                errors={errors}
              />
            )}
            {step === 1 && (
              <JobDescriptionStep
                formData={formData}
                updateField={updateField}
                errors={errors}
              />
            )}
            {step === 2 && (
              <JobRequirementsStep
                formData={formData}
                updateField={updateField}
                errors={errors}
                isEditing={isEditing}
              />
            )}
            {step === 3 && (
              <JobReviewStep
                formData={formData}
                isEditing={isEditing}
                onGoToStep={goToStep}
                isPending={isPending}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[760px] items-center gap-3 px-4 sm:px-6 py-3.5">
            <span className="text-sm font-semibold text-muted-foreground mr-auto">
              Step <strong className="text-foreground">{step + 1}</strong> of{" "}
              {STEPS.length}
            </span>

            {step > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={isPending}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button
                className="bg-[#474ead] hover:bg-[#3c3f9e] text-white"
                onClick={handleContinue}
                disabled={isPending}
              >
                Continue
              </Button>
            ) : (
              <Button
                className="bg-[#474ead] hover:bg-[#3c3f9e] text-white"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending
                  ? isEditing
                    ? "Saving…"
                    : "Submitting…"
                  : isEditing
                    ? "Update Job"
                    : "Submit for Approval"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function validateStep(
  step: number,
  formData: JobFormData,
  isEditing: boolean
): Partial<Record<keyof JobFormData, string>> {
  const errors: Partial<Record<keyof JobFormData, string>> = {};

  if (step === 0) {
    if (!formData.professionalRoleName.trim())
      errors.professionalRoleName = "Job title is required";
    if (!formData.company.trim()) errors.company = "Company name is required";
    if (!formData.jobFunction.trim()) errors.jobFunction = "Function is required";
    if (!formData.engagementType?.trim()) errors.engagementType = "Engagement type is required";
    if (!formData.experienceLevel) errors.experienceLevel = "Experience level is required";
  }

  if (step === 1) {
    if (!formData.description.trim()) errors.description = "Role overview is required";
  }

  if (step === 2) {
    if (!isEditing && !formData.salaryDisplay.trim())
      errors.salaryDisplay =
        "Monthly compensation is required for new jobs — enter an amount (e.g. 40,000 – 60,000)";
    if (formData.currency === "OTHER") {
      const code = formData.customCurrencyCode.trim().toUpperCase();
      if (!code)
        errors.customCurrencyCode =
          "Currency code is required when 'Other' is selected";
      else if (!/^[A-Z]{3}$/.test(code))
        errors.customCurrencyCode =
          "Enter exactly 3 letters (e.g. NZD, AED, CHF)";
    }
    if (
      formData.applicationMethod === "external_link" &&
      formData.applyLink.trim()
    ) {
      try {
        new URL(normalizeUrl(formData.applyLink));
      } catch {
        errors.applyLink =
          "Please enter a valid URL (e.g. https://example.com/apply)";
      }
    }
  }

  return errors;
}

function buildPayload(formData: JobFormData, isEditing: boolean): any {
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
    budgetCurrency:
      formData.currency === "OTHER"
        ? formData.customCurrencyCode.trim().toUpperCase() || "PHP"
        : formData.currency,
    customCurrencyCode:
      formData.currency === "OTHER"
        ? formData.customCurrencyCode.trim().toUpperCase() || null
        : null,
  };

  if (!isEditing) payload.clientId = "admin-system";
  payload.salaryDisplay = formData.salaryDisplay.trim() || null;
  payload.duration = formData.duration || null;

  payload.responsibilities = !isEmptyQuill(formData.responsibilities)
    ? [formData.responsibilities]
    : [];
  payload.requirements = !isEmptyQuill(formData.requirements)
    ? [formData.requirements]
    : [];
  payload.skillTags = formData.skillTags
    ? formData.skillTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  payload.culturalFit = !isEmptyQuill(formData.culturalFit)
    ? [formData.culturalFit]
    : [];

  // Role details — always send so admins can clear existing values
  payload.reportingTo = formData.reportingTo.trim() || null;
  payload.division = formData.division.trim() || null;
  payload.jobCode = formData.jobCode.trim() || null;
  payload.jobGrade = formData.jobGrade.trim() || null;
  payload.jobLevel = formData.jobLevel.trim() || null;

  // JSP sections
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
  payload.minimumInternetSpeed = formData.minimumInternetSpeed.trim() || null;
  payload.systemRequirements = formData.systemRequirements.trim();
  payload.requiredToolsSoftware = formData.requiredToolsSoftware.trim() || null;
  payload.otherEquipmentRequirements = formData.otherEquipmentRequirements.trim() || null;

  // Work schedule
  payload.workDays = formData.workDays.trim() || null;
  payload.timeZone = formData.timeZone.trim() || null;
  payload.weeklyHours = formData.weeklyHours.trim() || null;
  payload.scheduleFlexibility = formData.scheduleFlexibility.trim() || null;

  // Preferred qualifications
  payload.preferredQualifications = !isEmptyQuill(formData.preferredQualifications)
    ? formData.preferredQualifications
    : null;

  // Compensation extras
  payload.paymentFrequency = formData.paymentFrequency.trim() || null;
  payload.compensationNotes = formData.compensationNotes.trim() || null;

  // What We Offer
  payload.whatWeOffer = !isEmptyQuill(formData.whatWeOffer)
    ? formData.whatWeOffer
    : null;

  // Application method
  payload.applicationMethod = formData.applicationMethod;
  if (formData.applicationMethod === "external_link") {
    payload.applyLink = formData.applyLink.trim()
      ? normalizeUrl(formData.applyLink)
      : null;
  } else {
    payload.applyLink = null;
  }

  // Flags
  payload.isFeatured = formData.isFeatured;
  payload.urgentlyHiring = formData.urgentlyHiring;
  payload.requiresResume = formData.requiresResume;
  payload.requiresVideoIntro = formData.requiresVideoIntro;
  payload.isCompanyConfidential = formData.isCompanyConfidential;
  payload.confidentialClientOverview =
    formData.confidentialClientOverview.trim() || null;
  payload.benefits = formData.benefits.trim() || null;
  payload.compensationType = formData.compensationType || null;
  payload.hasCommission = formData.hasCommission;
  payload.hasEquity = formData.hasEquity;

  return payload;
}
