import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import {
  ArrowLeft, Briefcase, MapPin, Loader2, ShieldAlert, UserCheck,
  LogIn, Upload, X, CheckCircle2, Video, UserPlus, AlertCircle,
  ChevronRight, Check, Pencil, FileText, Phone, Mail, User,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { getPublicCompanyName } from "@/lib/jobUtils";
import { loadTalentAuth, type TalentAuthState } from "@/components/TalentLoginModal";
import { validatePhone } from "@/lib/phoneValidation";

// ─── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = "loading" | "review" | "questions" | "resume" | "confirm" | "submitting" | "success";

interface ApplicationQuestion {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "yes_no" | "single_select" | "number";
  required: boolean;
  options?: string[];
}

interface PrefillDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  isPrimary: boolean;
  createdAt?: string;
}

interface PrefillData {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location?: string;
  };
  documents: {
    resumes: PrefillDocument[];
    selectedResumeId: string | null;
    videos: PrefillDocument[];
    selectedVideoId: string | null;
  };
  previousDefaults: { coverLetter?: string };
  job: {
    id: string;
    title: string;
    requiresResume: boolean;
    requiresVideoIntro: boolean;
    questions: ApplicationQuestion[];
  };
  readiness: {
    ready: boolean;
    missing: string[];
  };
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  steps,
  currentStep,
}: {
  steps: { key: WizardStep; label: string }[];
  currentStep: WizardStep;
}) {
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  return (
    <div className="mb-5 flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  done
                    ? "bg-[#474ead] text-white"
                    : active
                    ? "border-2 border-[#474ead] bg-white text-[#474ead] dark:bg-slate-900"
                    : "border-2 border-slate-200 bg-white text-slate-400 dark:bg-slate-900 dark:border-slate-700",
                ].join(" ")}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={[
                  "mt-1 text-[10px] font-medium leading-none whitespace-nowrap",
                  active ? "text-[#474ead]" : done ? "text-slate-500" : "text-slate-400",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  "h-0.5 flex-1 mx-1 mb-4",
                  i < currentIdx ? "bg-[#474ead]" : "bg-slate-200 dark:bg-slate-700",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── File badge ────────────────────────────────────────────────────────────────

function FileBadge({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        PDF
      </span>
    );
  if (ext === "docx")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        DOCX
      </span>
    );
  if (ext === "doc")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        DOC
      </span>
    );
  return (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      {ext.toUpperCase() || "FILE"}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isTalent = user?.role === "talent";
  const isNonTalentUser = !!user && !isTalent;

  // ── Talent Portal session ──────────────────────────────────────────────────
  const [talentSession, setTalentSession] = useState<TalentAuthState | null>(null);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [candidateDocs, setCandidateDocs] = useState<any[]>([]);
  const [isLoadingTalent, setIsLoadingTalent] = useState(true);

  // ── 1-Click Apply wizard state ────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<WizardStep>("loading");
  const [prefillData, setPrefillData] = useState<PrefillData | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [isPrefillRefreshing, setIsPrefillRefreshing] = useState(false);

  // ── Legacy single-form state ──────────────────────────────────────────────
  const [useExistingResume, setUseExistingResume] = useState(false);
  const [useExistingVideo, setUseExistingVideo] = useState(false);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);

  // ── Form submission state ─────────────────────────────────────────────────
  const [isPending, setIsPending] = useState(false);
  const [submitStep, setSubmitStep] = useState<"uploading" | "saving" | null>(null);
  const [emailMismatchError, setEmailMismatchError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── CV / resume ───────────────────────────────────────────────────────────
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvState, setCvState] = useState<"idle" | "validating" | "ready">("idle");
  const [cvError, setCvError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Video introduction ────────────────────────────────────────────────────
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoState, setVideoState] = useState<"idle" | "validating" | "ready">("idle");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoDragOver, setIsVideoDragOver] = useState(false);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [signInDialog, setSignInDialog] = useState<{
    open: boolean;
    maskedEmail: string;
    continuationToken: string;
  }>({ open: false, maskedEmail: "", continuationToken: "" });
  const [conflictDialog, setConflictDialog] = useState(false);

  // ── Form fields ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    coverLetter: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  // ── Success state ─────────────────────────────────────────────────────────
  const [successInfo, setSuccessInfo] = useState<{ jobTitle: string; submittedAt: string } | null>(null);

  // ── Load job ──────────────────────────────────────────────────────────────
  const { data: job, isLoading, isError } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}`);
      return res.json();
    },
    enabled: !!jobId,
  });

  const requiresVideoIntro = !!(job as any)?.requiresVideoIntro;

  // ── Mount: detect talent portal session ───────────────────────────────────
  useEffect(() => {
    const auth = loadTalentAuth();
    setTalentSession(auth);

    if (!auth) {
      // Non-talent paths: prefill from legacy JWT user if present
      if (isTalent && user) {
        setForm((prev) => ({
          ...prev,
          firstName: (user as any).firstName || prev.firstName,
          lastName: (user as any).lastName || prev.lastName,
          email: user.email || prev.email,
        }));
      }
      setIsLoadingTalent(false);
    }
    // If auth exists, wait for job to load before calling prefill
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prefill fetch (extracted so it can be called on initial load AND on manual refresh) ──
  const runPrefillFetch = useCallback(
    (session: typeof talentSession, currentJobId: string, isRefresh = false) => {
      if (!session) return;
      if (isRefresh) setIsPrefillRefreshing(true);

      fetch(`/api/jobs/${currentJobId}/application-prefill`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("Prefill fetch failed");
          return r.json() as Promise<PrefillData>;
        })
        .then((data) => {
          setPrefillData(data);
          const cand = data.candidate;
          setForm({
            firstName: cand.firstName || "",
            lastName: cand.lastName || "",
            email: cand.email || "",
            phone: cand.phone || "",
            coverLetter: data.previousDefaults?.coverLetter || "",
          });
          setCandidateData(cand);

          // Map documents to the shape the rest of the component expects
          const docs = [
            ...data.documents.resumes.map((d) => ({ ...d, type: "resume" })),
            ...data.documents.videos.map((d) => ({ ...d, type: "video_intro" })),
          ];
          setCandidateDocs(docs);

          if (data.documents.selectedResumeId) setUseExistingResume(true);
          if (data.documents.selectedVideoId && data.job.requiresVideoIntro) setUseExistingVideo(true);

          setWizardStep("review");
        })
        .catch(() => {
          // Prefill failed — still show wizard but without rich data
          setWizardStep("review");
        })
        .finally(() => {
          setIsLoadingTalent(false);
          if (isRefresh) setIsPrefillRefreshing(false);
        });
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── When talent session + job are both ready: call prefill API ─────────────
  useEffect(() => {
    if (!talentSession || !jobId || isLoading || !job) return;
    if (prefillData !== null || !isLoadingTalent) return; // already fetched or finished
    runPrefillFetch(talentSession, jobId, false);
  }, [talentSession, job, isLoading, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived helpers ───────────────────────────────────────────────────────
  const existingResumeDoc = candidateDocs.find((d) => d.type === "resume") ?? null;
  const existingVideoDoc = candidateDocs.find((d) => d.type === "video_intro") ?? null;

  /** True when this application is via a Talent Portal session. */
  const hasTalentSession = !!talentSession && !!candidateData;

  /** Wizard steps (computed, excluding "questions" when there are none) */
  const wizardSteps = (() => {
    const steps: { key: WizardStep; label: string }[] = [
      { key: "review", label: "Review" },
    ];
    const questions: ApplicationQuestion[] = prefillData?.job?.questions ?? [];
    if (questions.length > 0) steps.push({ key: "questions", label: "Questions" });
    steps.push({ key: "resume", label: "Resume" });
    steps.push({ key: "confirm", label: "Confirm" });
    return steps;
  })();

  const jobQuestions: ApplicationQuestion[] = prefillData?.job?.questions ?? [];
  const readinessMissing: string[] = prefillData?.readiness?.missing ?? [];

  // ─────────────────────────────────────────────────────────────────────────
  // File validation helpers
  // ─────────────────────────────────────────────────────────────────────────

  const processFile = (file: File) => {
    setCvState("validating");
    setCvError(null);
    setTimeout(() => {
      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowed.includes(file.type)) {
        setCvState("idle");
        setCvError("Please upload a PDF, DOC, or DOCX file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCvState("idle");
        setCvError("Resume must be 10 MB or smaller");
        return;
      }
      setCvFile(file);
      setCvState("ready");
      setUseExistingResume(false);
    }, 300);
  };

  const processVideoFile = (file: File) => {
    setVideoState("validating");
    setVideoError(null);
    setTimeout(() => {
      const allowedTypes = ["video/mp4", "video/quicktime", "video/webm"];
      if (!allowedTypes.includes(file.type)) {
        setVideoState("idle");
        setVideoError("Please upload an MP4, MOV, or WebM video file");
        return;
      }
      if (file.size > 200 * 1024 * 1024) {
        setVideoState("idle");
        setVideoError("Video must be 200 MB or smaller");
        return;
      }
      setVideoFile(file);
      setVideoState("ready");
      setUseExistingVideo(false);
    }, 300);
  };

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (k === "email") setEmailMismatchError(false);
    if (["firstName", "lastName", "email"].includes(k)) setMismatchWarning(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  const validateLegacyForm = () => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim()) {
      next.phone = "Phone number is required";
    } else {
      const phoneResult = validatePhone(form.phone.trim(), "PH");
      if (!phoneResult.valid) next.phone = phoneResult.error ?? "Enter a valid phone number";
    }
    setErrors(next);

    const hasResume = useExistingResume || (cvFile && cvState === "ready");
    if (!hasResume) setCvError("CV / Resume is required");
    else setCvError(null);

    const hasVideo = useExistingVideo || (videoFile && videoState === "ready");
    if (requiresVideoIntro && !hasVideo) setVideoError("A video introduction is required for this position");
    else if (!requiresVideoIntro || hasVideo) setVideoError(null);

    // Identity mismatch warning for Talent Portal users
    if (hasTalentSession && candidateData) {
      const formEmail = form.email.trim().toLowerCase();
      const candEmail = (candidateData.email || "").trim().toLowerCase();
      const formFirst = form.firstName.trim().toLowerCase();
      const candFirst = (
        candidateData.firstName ||
        (candidateData.fullName || "").split(" ").slice(0, -1).join(" ") ||
        ""
      ).trim().toLowerCase();
      const formLast = form.lastName.trim().toLowerCase();
      const candLast = (
        candidateData.lastName ||
        (candidateData.fullName || "").split(" ").slice(-1)[0] ||
        ""
      ).trim().toLowerCase();
      if (formEmail !== candEmail || formFirst !== candFirst || formLast !== candLast) {
        setMismatchWarning("Some details differ from your Talent profile — please double-check before submitting.");
      } else {
        setMismatchWarning(null);
      }
    }

    return (
      Object.keys(next).length === 0 &&
      !!hasResume &&
      (!requiresVideoIntro || !!(useExistingVideo || (videoFile && videoState === "ready")))
    );
  };

  const validateQuestions = () => {
    const errs: Record<string, string> = {};
    for (const q of jobQuestions) {
      if (q.required && !questionAnswers[q.id]?.trim()) {
        errs[q.id] = "This answer is required";
      }
    }
    setQuestionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateResume = () => {
    const hasResume = useExistingResume || (cvFile && cvState === "ready");
    if (!hasResume) {
      setCvError("CV / Resume is required");
      return false;
    }
    setCvError(null);

    if (requiresVideoIntro) {
      const hasVideo = useExistingVideo || (videoFile && videoState === "ready");
      if (!hasVideo) {
        setVideoError("A video introduction is required for this position");
        return false;
      }
      setVideoError(null);
    }
    return true;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Wizard navigation
  // ─────────────────────────────────────────────────────────────────────────

  const advanceWizard = () => {
    if (wizardStep === "review") {
      if (jobQuestions.length > 0) setWizardStep("questions");
      else setWizardStep("resume");
    } else if (wizardStep === "questions") {
      if (!validateQuestions()) return;
      setWizardStep("resume");
    } else if (wizardStep === "resume") {
      if (!validateResume()) return;
      setWizardStep("confirm");
    }
  };

  const retreatWizard = () => {
    if (wizardStep === "questions") setWizardStep("review");
    else if (wizardStep === "resume") {
      if (jobQuestions.length > 0) setWizardStep("questions");
      else setWizardStep("review");
    } else if (wizardStep === "confirm") setWizardStep("resume");
  };

  const jumpToStep = (step: WizardStep) => {
    setWizardStep(step);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Submission
  // ─────────────────────────────────────────────────────────────────────────

  const doSubmit = async () => {
    setIsPending(true);
    setSubmitError(null);
    setWizardStep("submitting");
    setSubmitStep("uploading");
    setEmailMismatchError(false);
    const stepTimer = setTimeout(() => setSubmitStep("saving"), 2500);

    try {
      const talentToken = talentSession?.token ?? null;
      const legacyToken = localStorage.getItem("onspot_jwt_token");
      const authToken = talentToken || legacyToken;

      const formData = new FormData();
      formData.append("firstName", form.firstName.trim());
      formData.append("lastName", form.lastName.trim());
      formData.append("email", form.email.trim());
      formData.append("phone", form.phone.trim());
      if (form.coverLetter.trim()) formData.append("coverLetter", form.coverLetter.trim());

      // CV: attach new file OR signal server to reuse profile resume
      if (cvFile && !useExistingResume) {
        formData.append("resume", cvFile);
      } else if (useExistingResume) {
        formData.append("useProfileResume", "true");
      }

      // Video: attach new file OR signal server to reuse profile video
      if (videoFile && !useExistingVideo) {
        formData.append("video", videoFile);
      } else if (useExistingVideo && requiresVideoIntro) {
        formData.append("useProfileVideo", "true");
      }

      // Wizard path: always append "answers" (even [] when no questions configured)
      // so the server can reliably distinguish wizard submissions (field always present)
      // from legacy form submissions (field always absent).
      // Legacy form path never sets hasTalentSession, so it never appends this field.
      if (hasTalentSession) {
        const answersArr = jobQuestions.map((q) => ({
          questionId: q.id,
          question: q.label,
          answer: questionAnswers[q.id] ?? "",
        }));
        formData.append("answers", JSON.stringify(answersArr));
      }

      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData,
      });

      clearTimeout(stepTimer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }));
        if (err.error === "email_mismatch") {
          setEmailMismatchError(true);
          setWizardStep("confirm");
          return;
        }
        if (err.error === "cv_upload_failed") {
          setCvError("CV upload failed — please try a different file or check your connection.");
          setWizardStep("resume");
          return;
        }
        throw new Error(err.message || err.error || "Submission failed");
      }

      const data = await res.json();

      if (data.accountAction === "already_authenticated") {
        // Invalidate talent applications cache so the new submission appears immediately
        queryClient.invalidateQueries({ queryKey: ["talent-applications"] });
        // Talent portal success → show in-page success screen
        setSuccessInfo({
          jobTitle: job?.title ?? "the role",
          submittedAt: new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        });
        setWizardStep("success");
      } else if (data.accountAction === "sign_in_required") {
        setSignInDialog({
          open: true,
          maskedEmail: data.maskedEmail || form.email.trim(),
          continuationToken: data.continuationToken,
        });
        setWizardStep("confirm");
      } else if (data.accountAction === "account_conflict") {
        setConflictDialog(true);
        setWizardStep("confirm");
      } else {
        navigate(`/talent/signup?applicationToken=${encodeURIComponent(data.continuationToken)}`);
      }
    } catch (err: any) {
      clearTimeout(stepTimer);
      setSubmitError(err.message || "Submission failed. Please try again.");
      setWizardStep("confirm");
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPending(false);
      setSubmitStep(null);
    }
  };

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLegacyForm()) return;
    await doSubmit();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading / error / guard screens
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading || isLoadingTalent) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="flex flex-col items-center justify-center pt-40 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
          {isLoadingTalent && talentSession && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Preparing your application…</p>
          )}
        </div>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-xl px-6 pt-24 text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Job not found</h2>
          <Button variant="outline" className="rounded-full" onClick={() => navigate("/find-work/jobs")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Browse Jobs
          </Button>
        </div>
      </div>
    );
  }

  if ((job as any).applicationMethod !== "built_in_form") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-xl px-6 pt-24 text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            This job uses an external application
          </h2>
          <p className="text-slate-500 mb-6">Please use the Apply Now link on the job listing.</p>
          <Button variant="outline" className="rounded-full" onClick={() => navigate(`/find-work/job/${jobId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> View Job
          </Button>
        </div>
      </div>
    );
  }

  if (job.status !== "open") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-xl px-6 pt-24 text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            This position is no longer accepting applications
          </h2>
          <Button variant="outline" className="rounded-full" onClick={() => navigate("/find-work/jobs")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Browse Open Roles
          </Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Gate screen (no session, no legacy talent, no non-talent user)
  // ─────────────────────────────────────────────────────────────────────────
  if (!talentSession && !isTalent && !isNonTalentUser) {
    const returnTo = encodeURIComponent(`/jobs/${jobId}/apply`);
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-2xl px-4 pb-10 pt-5 sm:px-6">
          <button
            onClick={() => navigate(`/find-work/job/${jobId}`)}
            className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to job
          </button>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Open
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {getPublicCompanyName(job as any)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location || "Remote"}
              </span>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div
              className="p-5 sm:p-6"
              style={{ background: "linear-gradient(135deg, #474ead 0%, #6366f1 100%)" }}
            >
              <p className="text-lg font-bold text-white">Apply for this position</p>
              <p className="mt-1 text-sm text-indigo-100">
                Create a free Talent account to apply. Your profile is saved so future applications are even faster.
              </p>
            </div>
            <CardContent className="space-y-3 p-5 sm:p-6">
              <Button
                className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] h-11"
                onClick={() => navigate(`/talent/signup?returnTo=${returnTo}`)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create Talent Account &amp; Apply
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              <Button
                variant="outline"
                className="w-full rounded-full h-11"
                onClick={() => navigate(`/portal-login?portal=talent&returnTo=${returnTo}`)}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Existing Account
              </Button>

              <p className="pt-1 text-center text-xs text-slate-400">
                A Talent account lets you track your applications, complete your profile, and get matched to more jobs.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resume section (shared between wizard resume step and old form)
  // ─────────────────────────────────────────────────────────────────────────

  const renderResumeSection = () => (
    <div className="space-y-1.5">
      {!hasTalentSession && (
        <Label>
          CV / Resume <span className="text-red-500">*</span>
        </Label>
      )}

      {useExistingResume && existingResumeDoc ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-700/40 dark:bg-emerald-900/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <FileBadge fileName={existingResumeDoc.fileName || ""} />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
              {existingResumeDoc.fileName || "Your resume from Talent profile"}
            </p>
            <p className="text-xs text-slate-400">From your Talent profile</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setUseExistingResume(false);
              setCvFile(null);
              setCvState("idle");
              setCvError(null);
            }}
            className="shrink-0 text-xs font-medium text-slate-400 hover:text-[#474ead] dark:hover:text-indigo-300 flex items-center gap-1"
          >
            Replace
          </button>
        </div>
      ) : cvState === "validating" ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#474ead]" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Checking file…</span>
        </div>
      ) : cvFile && cvState === "ready" ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-700/40 dark:bg-emerald-900/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <FileBadge fileName={cvFile.name} />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{cvFile.name}</p>
            <p className="text-xs text-slate-400">
              {cvFile.size < 1024 * 1024
                ? `${Math.round(cvFile.size / 1024)} KB`
                : `${(cvFile.size / (1024 * 1024)).toFixed(1)} MB`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCvFile(null);
              setCvState("idle");
              setCvError(null);
              if (existingResumeDoc) setUseExistingResume(true);
            }}
            className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ) : (
        <label
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
            isDragOver
              ? "border-[#474ead] bg-[#474ead]/10 dark:bg-[#474ead]/20"
              : "border-slate-200 bg-slate-50 hover:border-[#474ead]/40 hover:bg-[#474ead]/5 dark:border-slate-700 dark:bg-slate-800/50",
          ].join(" ")}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) processFile(file);
          }}
        >
          <Upload className={["mb-1.5 h-5 w-5 transition-colors", isDragOver ? "text-[#474ead]" : "text-slate-400"].join(" ")} />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {isDragOver ? "Drop your CV here" : "Upload your CV"}
          </span>
          <span className="mt-0.5 text-xs text-slate-400">PDF, DOC, DOCX · Max 10 MB</span>
          {existingResumeDoc && (
            <button
              type="button"
              className="mt-2 text-xs text-[#474ead] hover:underline"
              onClick={(e) => {
                e.preventDefault();
                setUseExistingResume(true);
                setCvError(null);
              }}
            >
              Use resume from my Talent profile instead
            </button>
          )}
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              processFile(file);
            }}
          />
        </label>
      )}

      {cvError && <p className="text-xs text-red-500">{cvError}</p>}
    </div>
  );

  const renderVideoSection = () => {
    if (!requiresVideoIntro) return null;
    return (
      <div className="space-y-1.5">
        {!hasTalentSession && (
          <Label>
            Video Introduction <span className="text-red-500">*</span>
          </Label>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This position requires a short video introduction.
        </p>

        {useExistingVideo && existingVideoDoc ? (
          <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-700/40 dark:bg-violet-900/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
              VIDEO
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                {existingVideoDoc.fileName || "Your video from Talent profile"}
              </p>
              <p className="text-xs text-slate-400">From your Talent profile</p>
            </div>
            <button
              type="button"
              onClick={() => { setUseExistingVideo(false); setVideoFile(null); setVideoState("idle"); setVideoError(null); }}
              className="shrink-0 text-xs font-medium text-slate-400 hover:text-[#474ead] flex items-center gap-1"
            >
              Replace
            </button>
          </div>
        ) : videoState === "validating" ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Checking file…</span>
          </div>
        ) : videoFile && videoState === "ready" ? (
          <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-700/40 dark:bg-violet-900/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
              {videoFile.name.toLowerCase().endsWith(".webm") ? "WEBM" : videoFile.name.toLowerCase().endsWith(".mov") ? "MOV" : "MP4"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{videoFile.name}</p>
            </div>
            <button
              type="button"
              onClick={() => { setVideoFile(null); setVideoState("idle"); setVideoError(null); if (existingVideoDoc) setUseExistingVideo(true); }}
              className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        ) : (
          <label
            className={[
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
              isVideoDragOver
                ? "border-violet-500 bg-violet-50/80 dark:bg-violet-900/20"
                : "border-slate-200 bg-slate-50 hover:border-violet-400/60 hover:bg-violet-50/40 dark:border-slate-700 dark:bg-slate-800/50",
            ].join(" ")}
            onDragOver={(e) => { e.preventDefault(); setIsVideoDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsVideoDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsVideoDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); setIsVideoDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) processVideoFile(file); }}
          >
            <Video className={["mb-1.5 h-5 w-5 transition-colors", isVideoDragOver ? "text-violet-600" : "text-slate-400"].join(" ")} />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {isVideoDragOver ? "Drop your video here" : "Upload your video introduction"}
            </span>
            <span className="mt-0.5 text-xs text-slate-400">MP4, MOV, WebM · Max 200 MB</span>
            {existingVideoDoc && (
              <button type="button" className="mt-2 text-xs text-[#474ead] hover:underline" onClick={(e) => { e.preventDefault(); setUseExistingVideo(true); setVideoError(null); }}>
                Use video from my Talent profile instead
              </button>
            )}
            <input
              type="file"
              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; e.target.value = ""; processVideoFile(file); }}
            />
          </label>
        )}

        {videoError && <p className="text-xs text-red-500">{videoError}</p>}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Wizard step renderers
  // ─────────────────────────────────────────────────────────────────────────

  const renderWizardReview = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Review your details</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          These details come from your Talent profile. To update them, visit{" "}
          <a href="/talent-portal/settings" className="text-[#474ead] hover:underline dark:text-indigo-400">
            Profile Settings
          </a>
          .
        </p>
      </div>

      {/* Phone missing — hard block with action path */}
      {!form.phone.trim() && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-900/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold">Phone number required to continue</p>
            <p className="mt-0.5">
              Add your phone number in{" "}
              <a
                href="/talent-portal/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline font-medium"
              >
                Profile Settings ↗
              </a>
              , then click <strong>Refresh details</strong> below to continue.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 rounded-full text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
            disabled={isPrefillRefreshing}
            onClick={() => talentSession && jobId && runPrefillFetch(talentSession, jobId, true)}
          >
            {isPrefillRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Refresh details"
            )}
          </Button>
        </div>
      )}

      {/* Non-phone missing items (resume, video) — informational, not blocking */}
      {readinessMissing.filter((m) => m !== "phone").length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="text-xs text-slate-600 dark:text-slate-400">
            <p className="font-medium">You can add these in the next steps:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {readinessMissing.includes("resume") && <li>CV / Resume</li>}
              {readinessMissing.includes("video_intro") && <li>Video introduction</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Identity fields — read-only */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <User className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Full Name</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {form.firstName} {form.lastName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Mail className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Email Address</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{form.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Phone className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Phone Number</p>
            {form.phone ? (
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{form.phone}</p>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 italic">Not set</p>
            )}
          </div>
        </div>
      </div>

      <Button
        className="w-full h-10 rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] disabled:opacity-50"
        onClick={advanceWizard}
        disabled={!form.phone.trim()}
      >
        Continue <ChevronRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );

  const renderWizardQuestions = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Job-specific questions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          The employer has a few questions for applicants.
        </p>
      </div>

      <div className="space-y-4">
        {jobQuestions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <Label htmlFor={`q-${q.id}`}>
              {q.label}
              {q.required && <span className="ml-1 text-red-500">*</span>}
            </Label>

            {q.type === "short_text" && (
              <Input
                id={`q-${q.id}`}
                value={questionAnswers[q.id] ?? ""}
                onChange={(e) => {
                  setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                  if (questionErrors[q.id]) setQuestionErrors((prev) => ({ ...prev, [q.id]: "" }));
                }}
                placeholder="Your answer"
              />
            )}

            {q.type === "long_text" && (
              <Textarea
                id={`q-${q.id}`}
                rows={3}
                value={questionAnswers[q.id] ?? ""}
                onChange={(e) => {
                  setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                  if (questionErrors[q.id]) setQuestionErrors((prev) => ({ ...prev, [q.id]: "" }));
                }}
                placeholder="Your answer"
              />
            )}

            {q.type === "yes_no" && (
              <div className="flex gap-2">
                {["Yes", "No"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setQuestionAnswers((prev) => ({ ...prev, [q.id]: opt }));
                      if (questionErrors[q.id]) setQuestionErrors((prev) => ({ ...prev, [q.id]: "" }));
                    }}
                    className={[
                      "flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      questionAnswers[q.id] === opt
                        ? "border-[#474ead] bg-[#474ead]/10 text-[#474ead] dark:bg-[#474ead]/20"
                        : "border-slate-200 text-slate-600 hover:border-[#474ead]/40 dark:border-slate-700 dark:text-slate-400",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "single_select" && q.options && (
              <div className="space-y-1.5">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setQuestionAnswers((prev) => ({ ...prev, [q.id]: opt }));
                      if (questionErrors[q.id]) setQuestionErrors((prev) => ({ ...prev, [q.id]: "" }));
                    }}
                    className={[
                      "w-full rounded-lg border px-4 py-2 text-sm text-left font-medium transition-colors",
                      questionAnswers[q.id] === opt
                        ? "border-[#474ead] bg-[#474ead]/10 text-[#474ead] dark:bg-[#474ead]/20"
                        : "border-slate-200 text-slate-600 hover:border-[#474ead]/40 dark:border-slate-700 dark:text-slate-400",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "number" && (
              <Input
                id={`q-${q.id}`}
                type="number"
                value={questionAnswers[q.id] ?? ""}
                onChange={(e) => {
                  setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                  if (questionErrors[q.id]) setQuestionErrors((prev) => ({ ...prev, [q.id]: "" }));
                }}
                placeholder="Enter a number"
              />
            )}

            {questionErrors[q.id] && (
              <p className="text-xs text-red-500">{questionErrors[q.id]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-full" onClick={retreatWizard}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 h-10 rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]" onClick={advanceWizard}>
          Continue <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderWizardResume = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your CV &amp; documents</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {useExistingResume
            ? "Your saved resume will be submitted. You can replace it with a different file if you'd like."
            : "Upload your CV to include with this application."}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            CV / Resume <span className="text-red-500">*</span>
          </p>
          {renderResumeSection()}
        </div>

        {requiresVideoIntro && (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Video Introduction <span className="text-red-500">*</span>
            </p>
            {renderVideoSection()}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-full" onClick={retreatWizard}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 h-10 rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]" onClick={advanceWizard}>
          Continue <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderWizardConfirm = () => {
    const hasResume = useExistingResume || (cvFile && cvState === "ready");
    const hasVideo = useExistingVideo || (videoFile && videoState === "ready");
    const resumeLabel = cvFile && !useExistingResume ? cvFile.name : existingResumeDoc?.fileName ?? "Profile resume";
    const videoLabel = videoFile && !useExistingVideo ? videoFile.name : existingVideoDoc?.fileName ?? "Profile video";

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Review &amp; confirm</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Double-check everything before submitting.
          </p>
        </div>

        {emailMismatchError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700/40 dark:bg-red-900/20">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs text-red-700 dark:text-red-300">
              Email address mismatch — you are signed in with a different email. Please sign out to apply with another account.
            </p>
          </div>
        )}

        {submitError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700/40 dark:bg-red-900/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs text-red-700 dark:text-red-300">{submitError}</p>
          </div>
        )}

        {/* Profile section */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Profile</p>
            <button
              type="button"
              onClick={() => jumpToStep("review")}
              className="flex items-center gap-1 text-xs text-[#474ead] hover:underline"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex gap-2 text-sm">
              <span className="text-slate-400 w-20 shrink-0">Name</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{form.firstName} {form.lastName}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-slate-400 w-20 shrink-0">Email</span>
              <span className="text-slate-800 dark:text-slate-200">{form.email}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-slate-400 w-20 shrink-0">Phone</span>
              <span className={form.phone ? "text-slate-800 dark:text-slate-200" : "text-amber-600"}>
                {form.phone || "Not provided"}
              </span>
            </div>
          </div>
        </div>

        {/* Documents section */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</p>
            <button
              type="button"
              onClick={() => jumpToStep("resume")}
              className="flex items-center gap-1 text-xs text-[#474ead] hover:underline"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex gap-2 text-sm items-center">
              <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              {hasResume ? (
                <span className="text-slate-800 dark:text-slate-200 truncate">{resumeLabel}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">No resume — add in previous step</span>
              )}
            </div>
            {requiresVideoIntro && (
              <div className="flex gap-2 text-sm items-center">
                <Video className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                {hasVideo ? (
                  <span className="text-slate-800 dark:text-slate-200 truncate">{videoLabel}</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">No video — add in previous step</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Questions section */}
        {jobQuestions.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Questions</p>
              <button
                type="button"
                onClick={() => jumpToStep("questions")}
                className="flex items-center gap-1 text-xs text-[#474ead] hover:underline"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              {jobQuestions.map((q) => (
                <div key={q.id}>
                  <p className="text-xs text-slate-400">{q.label}</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {questionAnswers[q.id] || <span className="text-amber-600">No answer</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cover letter */}
        <div className="space-y-1.5">
          <Label htmlFor="coverLetter">Cover Letter / Message <span className="text-xs text-slate-400 font-normal">(optional)</span></Label>
          <Textarea
            id="coverLetter"
            rows={3}
            value={form.coverLetter}
            onChange={(e) => setField("coverLetter", e.target.value)}
            placeholder="Tell us why you're a great fit for this role…"
            className="min-h-[90px] resize-y"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-full" onClick={retreatWizard}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button
            className="flex-1 h-10 rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] disabled:opacity-50"
            disabled={isPending}
            onClick={doSubmit}
          >
            Submit Application →
          </Button>
        </div>
      </div>
    );
  };

  const renderWizardSubmitting = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-[#474ead]" />
      <div className="text-center">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {submitStep === "saving" ? "Saving your application…" : "Uploading your CV…"}
        </p>
        <p className="text-sm text-slate-500 mt-1">This will only take a moment.</p>
      </div>
    </div>
  );

  const renderWizardSuccess = () => (
    <div className="flex flex-col items-center text-center py-10 gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Application submitted! 🎉</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          Your application for <strong className="text-slate-700 dark:text-slate-300">{successInfo?.jobTitle}</strong> was received on {successInfo?.submittedAt}.
        </p>
      </div>
      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
          onClick={() => navigate("/talent-portal/applications")}
        >
          View My Applications
        </Button>
        <Button
          variant="outline"
          className="w-full rounded-full"
          onClick={() => navigate("/find-work/jobs")}
        >
          Browse More Jobs
        </Button>
        <Button
          variant="ghost"
          className="w-full rounded-full text-slate-500"
          onClick={() => navigate(`/find-work/job/${jobId}`)}
        >
          Back to Job Listing
        </Button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Common layout wrapper
  // ─────────────────────────────────────────────────────────────────────────

  const renderJobHeader = () => (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Open
        </span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{job.title}</h1>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Briefcase className="h-4 w-4" />
          {getPublicCompanyName(job as any)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {job.location || "Remote"}
        </span>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-5 sm:px-6">

        {/* Back button — hidden on success screen */}
        {wizardStep !== "success" && (
          <button
            onClick={() => navigate(`/find-work/job/${jobId}`)}
            className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to job
          </button>
        )}

        {/* Job header — hidden during submitting/success */}
        {wizardStep !== "submitting" && wizardStep !== "success" && renderJobHeader()}

        {/* Non-talent user warning */}
        {isNonTalentUser && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-900/20">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">You are signed in with a non-Talent account.</p>
              <p className="mt-0.5">Sign out or use a Talent account to apply.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
              onClick={() => navigate("/api/logout")}
            >
              Sign Out
            </Button>
          </div>
        )}

        {/* ── Wizard path (talent session) ──────────────────────────────── */}
        {hasTalentSession ? (
          <Card>
            <CardContent className="p-5">
              {/* Talent session badge */}
              {wizardStep !== "success" && wizardStep !== "submitting" && (
                <div className="mb-4 flex items-center gap-2 rounded-md bg-[#474ead]/8 px-3 py-2 text-sm text-[#474ead] dark:bg-[#474ead]/20 dark:text-indigo-300">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  Applying with your OnSpot Talent account.
                </div>
              )}

              {/* Progress bar */}
              {wizardStep !== "loading" && wizardStep !== "submitting" && wizardStep !== "success" && (
                <ProgressBar steps={wizardSteps} currentStep={wizardStep} />
              )}

              {wizardStep === "loading" && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
                  <p className="text-sm text-slate-500">Preparing your application…</p>
                </div>
              )}
              {wizardStep === "review" && renderWizardReview()}
              {wizardStep === "questions" && renderWizardQuestions()}
              {wizardStep === "resume" && renderWizardResume()}
              {wizardStep === "confirm" && renderWizardConfirm()}
              {wizardStep === "submitting" && renderWizardSubmitting()}
              {wizardStep === "success" && renderWizardSuccess()}
            </CardContent>
          </Card>
        ) : (
          // ── Legacy / non-wizard path ─────────────────────────────────
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
                Your Application
              </h2>

              {(isTalent) && (
                <div className="mb-4 flex items-center gap-2 rounded-md bg-[#474ead]/8 px-3 py-2 text-sm text-[#474ead] dark:bg-[#474ead]/20 dark:text-indigo-300">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  You are applying with your OnSpot Talent account.
                </div>
              )}

              {!isTalent && (
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                  Submit your application to continue.
                </p>
              )}

              {mismatchWarning && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-900/20">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">{mismatchWarning}</p>
                </div>
              )}

              {emailMismatchError && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700/40 dark:bg-red-900/20">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div className="flex-1 text-sm text-red-700 dark:text-red-300">
                    <p className="font-medium">Email address mismatch.</p>
                    <p className="mt-0.5">You are signed in with a different email address. Sign out to apply using another account.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="shrink-0 border-red-300 text-red-700 hover:bg-red-100" onClick={() => navigate("/api/logout")}>
                    Sign Out
                  </Button>
                </div>
              )}

              <form onSubmit={handleLegacySubmit} className="space-y-3">
                {/* First + Last Name */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                    <Input id="firstName" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} placeholder="Maria" autoComplete="given-name" />
                    {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                    <Input id="lastName" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} placeholder="Santos" autoComplete="family-name" />
                    {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="email" type="email" value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="you@example.com" autoComplete="email"
                      readOnly={isTalent}
                      className={isTalent ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : ""}
                    />
                    {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                    <Input id="phone" type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+63 912 345 6789" autoComplete="tel" />
                    {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                  </div>
                </div>

                {renderResumeSection()}
                {renderVideoSection()}

                {/* Cover Letter */}
                <div className="space-y-1.5">
                  <Label htmlFor="coverLetter">Cover Letter / Message</Label>
                  <Textarea id="coverLetter" rows={3} value={form.coverLetter} onChange={(e) => setField("coverLetter", e.target.value)} placeholder="Tell us why you're a great fit for this role..." className="min-h-[90px] resize-y" />
                </div>

                <Button type="submit" disabled={isPending || isNonTalentUser} className="h-10 w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] disabled:opacity-50">
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{submitStep === "saving" ? "Saving application…" : "Uploading CV…"}</>
                  ) : (
                    "Submit Application →"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Existing-email dialog ──────────────────────────────────────────── */}
      <Dialog open={signInDialog.open} onOpenChange={(open) => setSignInDialog((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Application saved — sign in to link it</DialogTitle>
            <DialogDescription>
              We found an existing Talent account for <strong>{signInDialog.maskedEmail}</strong>. Sign in to link your application to that account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
              onClick={() => {
                const token = signInDialog.continuationToken;
                if (!token) {
                  toast({ variant: "destructive", title: "Session expired", description: "Please submit your application again." });
                  return;
                }
                const returnTo = encodeURIComponent(`/jobs/${jobId}/apply`);
                navigate(`/portal-login?portal=talent&applicationToken=${token}&returnTo=${returnTo}`);
                setSignInDialog((s) => ({ ...s, open: false }));
              }}
            >
              <LogIn className="mr-2 h-4 w-4" /> Sign In
            </Button>
            <Button variant="ghost" className="w-full rounded-full" onClick={() => { setSignInDialog((s) => ({ ...s, open: false })); navigate("/find-work/jobs"); }}>
              Continue browsing jobs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Account conflict dialog ───────────────────────────────────────── */}
      <Dialog open={conflictDialog} onOpenChange={setConflictDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account type conflict</DialogTitle>
            <DialogDescription>
              The email address you used belongs to a Client or Admin account and cannot be used to apply for jobs. Please use a different email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button variant="outline" className="w-full rounded-full" onClick={() => { setConflictDialog(false); navigate(`/find-work/job/${jobId}`); }}>
              Back to job listing
            </Button>
            <Button variant="ghost" className="w-full rounded-full" onClick={() => { setConflictDialog(false); navigate("/find-work/jobs"); }}>
              Browse other jobs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
