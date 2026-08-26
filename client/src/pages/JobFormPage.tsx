import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type JobFormMode = "admin" | "client";

interface JobFormPageProps {
  mode?: JobFormMode;
}

interface ClientOption {
  id: string;
  email: string;
  company_name: string | null;
}

interface ClientCompanyProfile {
  companyName?: string | null;
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function JobFormPage({ mode = "admin" }: JobFormPageProps) {
  const { jobId } = useParams<{ jobId?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!jobId;
  const isClientMode = mode === "client";
  const apiBase = isClientMode ? "/api/client/jobs" : "/api/admin/jobs";
  const returnPath = isClientMode ? "/client-profile" : "/admin/find-work";

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<JobFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSelectionError, setClientSelectionError] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);

  // ─── Load existing job in edit mode ────────────────────────────────────────
  const { data: existingJob, isLoading: isJobLoading, isError: isJobError } = useQuery<Job>({
    queryKey: [apiBase, jobId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiBase}/${jobId}`);
      if (!res.ok) throw new Error(`Failed to load job (HTTP ${res.status})`);
      return res.json();
    },
    enabled: isEditing,
    staleTime: 0,
    retry: 2,
  });
  const isExistingDraft = existingJob?.status === "draft";

  useEffect(() => {
    if (existingJob) {
      setFormData(jobToFormData(existingJob));
      const savedStep = Number((existingJob as any).draftStep ?? (existingJob as any).draft_step);
      if (existingJob.status === "draft" && Number.isInteger(savedStep) && savedStep >= 0 && savedStep < STEPS.length) {
        setStep(savedStep);
      }
      setIsDirty(false);
    }
  }, [existingJob]);

  // Admins must choose the client that will own a newly created job. The API
  // validates this server-side; the page keeps the old modal's required selector.
  const { data: clientOptions = [] } = useQuery<ClientOption[]>({
    queryKey: ["/api/admin/jobs/client-options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs/client-options");
      if (!res.ok) throw new Error("Failed to load client options");
      return res.json();
    },
    enabled: !isClientMode && !isEditing,
    staleTime: 60_000,
  });

  // Client creation keeps the legacy modal's company prefill. Edit mode always
  // uses the job's saved company, and a user-entered value is never overwritten.
  const { data: clientProfile } = useQuery<ClientCompanyProfile>({
    queryKey: ["/api/client-profile/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client-profile/me");
      if (!res.ok) throw new Error("Failed to load client profile");
      return res.json();
    },
    enabled: isClientMode && !isEditing,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const companyName = clientProfile?.companyName?.trim();
    if (
      isClientMode &&
      !isEditing &&
      !isDirty &&
      companyName &&
      formData.company === defaultFormData.company
    ) {
      setFormData((previous) => ({ ...previous, company: companyName }));
    }
  }, [clientProfile, formData.company, isClientMode, isDirty, isEditing]);


  // ─── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", apiBase, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting created — submitted for approval" });
      navigate(returnPath);
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
      apiRequest("PATCH", `${apiBase}/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting updated" });
      navigate(returnPath);
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
      return { ...prev, [field]: value };
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
    if (step === 0 && !isClientMode && !isEditing && !selectedClientId) {
      setClientSelectionError("Please select the client this job is for");
      return;
    }
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

    if (!isClientMode && !isEditing && !selectedClientId) {
      setClientSelectionError("Please select the client this job is for");
      goToStep(0);
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

    const payload = buildPayload({
      ...formData,
      // A completed draft enters the same pending approval workflow as a
      // normally submitted posting. The server keeps the same job row.
      status: isExistingDraft ? "open" : formData.status,
      draftStep: null,
    } as JobFormData);
    if (!isClientMode && !isEditing) payload.clientId = selectedClientId;

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
      navigate(returnPath);
    }
  };

  const hasMeaningfulDraftData = () => {
    const ignored = new Set(["", "Remote", "entry", "range", "PHP", "open", "draft"]);
    return Object.entries(formData).some(([key, value]) => {
      if (key === "status" || key === "title" || key === "category" || key === "skillTags") {
        // These are represented by the canonical form fields below.
        return false;
      }
      if (typeof value === "string") return value.trim() !== "" && !ignored.has(value.trim());
      if (Array.isArray(value)) return value.length > 0;
      return value === true || (typeof value === "number" && value !== 0);
    }) ||
      Boolean(formData.professionalRoleName.trim() || formData.jobFunction.trim() || formData.company.trim() ||
        formData.description.trim() || formData.skillTags.trim());
  };

  const saveDraftAndExit = () => {
    if (!hasMeaningfulDraftData()) {
      setShowExitDialog(false);
      toast({
        title: "Nothing to save yet",
        description: "Enter some job details before saving a draft.",
      });
      return;
    }
    if (!isClientMode && !isEditing && !selectedClientId) {
      setShowExitDialog(false);
      setClientSelectionError("Please select the client this job is for");
      goToStep(0);
      return;
    }

    const payload = buildPayload({ ...formData, status: "draft", draftStep: step } as JobFormData);
    if (!isClientMode && !isEditing) payload.clientId = selectedClientId;
    if (isEditing && jobId) {
      updateMutation.mutate({ id: jobId, data: payload });
    } else {
      createMutation.mutate(payload);
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
            <Button variant="outline" onClick={() => navigate(returnPath)}>
              Back to jobs
            </Button>
            <Button
              className="bg-[#474ead] text-white hover:bg-[#3d439c]"
              onClick={() => {
                queryClient.resetQueries({ queryKey: [apiBase, jobId] });
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
      {/* ── Unsaved changes / draft dialog ── */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isExistingDraft ? "Save changes before leaving?" : "Save this job as a draft?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isExistingDraft
                ? "Your changes can be saved to this draft before you return to the jobs dashboard."
                : "Your progress will be saved and you can finish this job posting later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            {isExistingDraft ? (
              <>
                <AlertDialogAction
                  className="bg-muted text-foreground hover:bg-muted/80"
                  onClick={() => navigate(returnPath)}
                >
                  Discard Changes
                </AlertDialogAction>
                <AlertDialogAction onClick={saveDraftAndExit}>
                  Save &amp; Exit
                </AlertDialogAction>
              </>
            ) : (
              <>
                <AlertDialogAction
                  className="bg-muted text-foreground hover:bg-muted/80"
                  onClick={() => navigate(returnPath)}
                >
                  Discard
                </AlertDialogAction>
                <AlertDialogAction onClick={saveDraftAndExit}>
                  Save Draft &amp; Exit
                </AlertDialogAction>
              </>
            )}
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
          <div className="relative mx-auto flex max-w-[1080px] items-center px-4 sm:px-6 py-3.5">
            <span className="w-full text-center text-sm font-semibold text-muted-foreground">
              {isEditing ? "Edit Job Posting" : "Post a Job"}
            </span>

            {/* Save & exit */}
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="absolute right-4 sm:right-6 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
              <>
                {!isClientMode && !isEditing && (
                  <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
                    <h3 className="text-base font-bold leading-tight text-foreground">
                      Post on behalf of
                      <span className="ml-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#474ead]">
                        Admin only
                      </span>
                    </h3>
                    <Label htmlFor="admin-client-select" className="mt-3 block text-sm font-semibold">
                      Post on behalf of <span className="text-red-500">*</span>
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select the client that will own this job posting.
                    </p>
                    <Select
                      value={selectedClientId}
                      onValueChange={(value) => {
                        setSelectedClientId(value);
                        setClientSelectionError("");
                      }}
                    >
                      <SelectTrigger
                        id="admin-client-select"
                        className={`mt-3 ${clientSelectionError ? "border-red-500" : ""}`}
                      >
                        <SelectValue placeholder="Select a client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientOptions.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.company_name
                              ? `${client.company_name} — ${client.email}`
                              : client.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {clientSelectionError && (
                      <p className="mt-1.5 text-xs text-red-500">{clientSelectionError}</p>
                    )}
                  </div>
                )}
                <JobBasicsStep
                  formData={formData}
                  updateField={updateField}
                  errors={errors}
                />
              </>
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
              />
            )}
            {step === 3 && (
              <JobReviewStep
                formData={formData}
                updateField={updateField}
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
    if (!formData.jobFunction.trim()) errors.jobFunction = "Function is required";
    if (!formData.engagementType?.trim()) errors.engagementType = "An Engagement Type (Lite or Standard) must be set before publishing a job.";
    if (!formData.experienceLevel) errors.experienceLevel = "Experience level is required";
  }

  return errors;
}

function buildPayload(formData: JobFormData): any {
  const payload: Record<string, unknown> = {
    professionalRoleName: formData.professionalRoleName.trim(),
    title: formData.professionalRoleName.trim(),
    jobFunction: formData.jobFunction.trim(),
    company: formData.company.trim() || null,
    location: formData.location || null,
    category: formData.jobFunction.trim(),
    engagementType: formData.engagementType?.trim() || "",
    experienceLevel: formData.experienceLevel,
    description: isEmptyQuill(formData.description) ? "" : formData.description.trim(),
    status: formData.status,
    draftStep: (formData as any).draftStep ?? null,
    duration: formData.duration || null,
    minimumEducation: formData.minimumEducation.trim() || null,
    requiredSkills: formData.requiredSkills.filter((skill) => skill.name.trim()),
    skillTags: formData.requiredSkills.filter((skill) => skill.name.trim()).map((skill) => skill.name.trim()),
    requiresUsTimezoneOverlap: formData.requiresUsTimezoneOverlap,
    requiresFluentEnglish: formData.requiresFluentEnglish,
    budgetCurrency: formData.currency || "PHP",
    salaryDisplay: formData.salaryDisplay.trim() || null,
    compensationDisplayType: formData.compensationDisplayType,
    contractorEngagementConfirmed: formData.contractorEngagementConfirmed,
    isCompanyConfidential: formData.isCompanyConfidential,
  };

  // These are the only optional company descriptions represented by the new
  // form. All other legacy fields are intentionally omitted so PATCH does not
  // erase data that a user can no longer see or edit.
  if (formData.isCompanyConfidential) {
    payload.confidentialClientOverview = formData.confidentialClientOverview.trim() || null;
  } else {
    payload.companyOverview = formData.companyOverview.trim() || null;
  }

  return payload;
}
