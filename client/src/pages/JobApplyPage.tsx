import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import type { Job } from "@shared/schema";
import { getPublicCompanyName } from "@/lib/jobUtils";
import { loadTalentAuth, type TalentAuthState } from "@/components/TalentLoginModal";
import { validatePhone, countryFromTimezone } from "@/lib/phoneValidation";

// ─── Main Component ────────────────────────────────────────────────────────────
export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const isTalent = user?.role === "talent";
  const isNonTalentUser = !!user && !isTalent; // client or admin

  // ── Talent Portal session (talent_profile_token) ──────────────────────────
  const [talentSession, setTalentSession] = useState<TalentAuthState | null>(null);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [candidateDocs, setCandidateDocs] = useState<any[]>([]);
  const [isLoadingTalent, setIsLoadingTalent] = useState(true);
  const [useExistingResume, setUseExistingResume] = useState(false);
  const [useExistingVideo, setUseExistingVideo] = useState(false);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);

  // ── Form submission state ─────────────────────────────────────────────────
  const [isPending, setIsPending] = useState(false);
  const [submitStep, setSubmitStep] = useState<"uploading" | "saving" | null>(null);
  const [emailMismatchError, setEmailMismatchError] = useState(false);

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

  // ── On mount: detect Talent Portal session and prefill ───────────────────
  useEffect(() => {
    const auth = loadTalentAuth();
    setTalentSession(auth);

    if (auth) {
      // Fetch candidate profile + documents in parallel
      Promise.all([
        fetch(`/api/candidates/${auth.candidateId}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/documents", {
          headers: { Authorization: `Bearer ${auth.token}` },
        }).then((r) => (r.ok ? r.json() : [])),
      ])
        .then(([candidate, docs]) => {
          if (candidate) {
            setCandidateData(candidate);

            // Derive first/last name from candidate record (prefer explicit columns)
            const firstName =
              candidate.firstName ||
              (candidate.fullName || "").split(" ").slice(0, -1).join(" ") ||
              (candidate.fullName || "").split(" ")[0] ||
              "";
            const lastName =
              candidate.lastName ||
              (candidate.fullName || "").split(" ").slice(-1)[0] ||
              "";

            setForm((prev) => ({
              ...prev,
              firstName: firstName || prev.firstName,
              lastName: lastName || prev.lastName,
              email: candidate.email || prev.email,
              phone: candidate.phone || prev.phone,
            }));
          }

          const docsArr = Array.isArray(docs) ? docs : [];
          setCandidateDocs(docsArr);

          // Pre-select existing resume
          const resumeDoc = docsArr.find((d: any) => d.type === "resume");
          if (resumeDoc) setUseExistingResume(true);

          // Pre-select existing video intro (only when job requires it)
          const videoDoc = docsArr.find((d: any) => d.type === "video_intro");
          if (videoDoc) setUseExistingVideo(true);
        })
        .catch(() => {
          // Non-fatal — user can still fill the form manually
        })
        .finally(() => setIsLoadingTalent(false));
    } else if (isTalent && user) {
      // Fallback: legacy JWT talent user without a Talent Portal token
      setForm((prev) => ({
        ...prev,
        firstName: (user as any).firstName || prev.firstName,
        lastName: (user as any).lastName || prev.lastName,
        email: user.email || prev.email,
      }));
      setIsLoadingTalent(false);
    } else {
      setIsLoadingTalent(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived helpers ───────────────────────────────────────────────────────
  const existingResumeDoc = candidateDocs.find((d) => d.type === "resume") ?? null;
  const existingVideoDoc = candidateDocs.find((d) => d.type === "video_intro") ?? null;

  /** True when this application is from a Talent Portal session. */
  const hasTalentSession = !!talentSession && !!candidateData;

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
    }, 300);
  };

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (k === "email") setEmailMismatchError(false);
    // Clear mismatch warning when user edits fields
    if (["firstName", "lastName", "email"].includes(k)) setMismatchWarning(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Validation + submission
  // ─────────────────────────────────────────────────────────────────────────

  const validate = () => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim()) {
      next.phone = "Phone number is required";
    } else {
      // Run phone validation (PH as default country hint)
      const phoneResult = validatePhone(form.phone.trim(), "PH");
      if (!phoneResult.valid) next.phone = phoneResult.error ?? "Enter a valid phone number";
    }
    setErrors(next);

    // CV / resume validation
    const hasResume = useExistingResume || (cvFile && cvState === "ready");
    if (!hasResume) {
      setCvError("CV / Resume is required");
    } else {
      setCvError(null);
    }

    // Video validation (only when job requires it)
    const hasVideo = useExistingVideo || (videoFile && videoState === "ready");
    if (requiresVideoIntro && !hasVideo) {
      setVideoError("A video introduction is required for this position");
    } else if (!requiresVideoIntro || hasVideo) {
      setVideoError(null);
    }

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
        setMismatchWarning(
          "Some details differ from your Talent profile — please double-check before submitting.",
        );
      } else {
        setMismatchWarning(null);
      }
    }

    return (
      Object.keys(next).length === 0 &&
      !!hasResume &&
      (!requiresVideoIntro || !!hasVideo)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsPending(true);
    setSubmitStep("uploading");
    setEmailMismatchError(false);
    const stepTimer = setTimeout(() => setSubmitStep("saving"), 2500);

    try {
      // Determine which auth token to send (prefer talent portal token)
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
          return;
        }
        if (err.error === "cv_upload_failed") {
          setCvError("CV upload failed — please try a different file or check your connection.");
          return;
        }
        throw new Error(err.message || err.error || "Submission failed");
      }

      const data = await res.json();

      if (data.accountAction === "already_authenticated") {
        toast({
          title: "Application submitted! 🎉",
          description: "Your application has been linked to your Talent account.",
        });
        navigate("/find-work/jobs");
      } else if (data.accountAction === "sign_in_required") {
        setSignInDialog({
          open: true,
          maskedEmail: data.maskedEmail || form.email.trim(),
          continuationToken: data.continuationToken,
        });
      } else if (data.accountAction === "account_conflict") {
        setConflictDialog(true);
      } else {
        navigate(`/talent/signup?applicationToken=${encodeURIComponent(data.continuationToken)}`);
      }
    } catch (err: any) {
      clearTimeout(stepTimer);
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPending(false);
      setSubmitStep(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading / error / guard screens
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading || isLoadingTalent) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
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
  // Gate screen: no Talent session, no legacy talent user, no non-talent user
  // Show sign-in / create account options before showing the form.
  // ─────────────────────────────────────────────────────────────────────────
  if (!talentSession && !isTalent && !isNonTalentUser) {
    const returnTo = encodeURIComponent(`/jobs/${jobId}/apply`);
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-2xl px-4 pb-10 pt-5 sm:px-6">
          {/* Back */}
          <button
            onClick={() => navigate(`/find-work/job/${jobId}`)}
            className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to job
          </button>

          {/* Job header */}
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

          {/* Gate card */}
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
              {/* Create account */}
              <Button
                className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] h-11"
                onClick={() => navigate(`/talent/signup?returnTo=${returnTo}`)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create Talent Account &amp; Apply
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Sign in */}
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
  // Main application form
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-5 sm:px-6">
        {/* Back */}
        <button
          onClick={() => navigate(`/find-work/job/${jobId}`)}
          className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to job
        </button>

        {/* Job header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Open
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {job.title}
          </h1>
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

        {/* Non-talent role warning */}
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

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
              Your Application
            </h2>

            {/* Talent session badge */}
            {(hasTalentSession || isTalent) && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-[#474ead]/8 px-3 py-2 text-sm text-[#474ead] dark:bg-[#474ead]/20 dark:text-indigo-300">
                <UserCheck className="h-4 w-4 shrink-0" />
                You are applying with your OnSpot Talent account.
              </div>
            )}

            {/* Context subtitle for unauthenticated (legacy path only) */}
            {!hasTalentSession && !isTalent && (
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Submit your application to continue.
              </p>
            )}

            {/* Identity mismatch warning */}
            {mismatchWarning && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-900/20">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800 dark:text-amber-300">{mismatchWarning}</p>
              </div>
            )}

            {/* Email mismatch error banner */}
            {emailMismatchError && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700/40 dark:bg-red-900/20">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="flex-1 text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium">Email address mismatch.</p>
                  <p className="mt-0.5">
                    You are signed in with a different email address. Sign out to apply using another account.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => navigate("/api/logout")}
                >
                  Sign Out
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* First + Last Name */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    placeholder="Maria"
                    autoComplete="given-name"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    placeholder="Santos"
                    autoComplete="family-name"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    // Lock email for authenticated talents — prevents silent email mismatch
                    readOnly={isTalent || hasTalentSession}
                    className={
                      isTalent || hasTalentSession
                        ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : ""
                    }
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="+63 912 345 6789"
                    autoComplete="tel"
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>
              </div>

              {/* ── CV / Resume ────────────────────────────────────────────────────── */}
              <div className="space-y-1.5">
                <Label>
                  CV / Resume <span className="text-red-500">*</span>
                </Label>

                {/* Case 1: Using existing profile resume */}
                {useExistingResume && existingResumeDoc ? (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-700/40 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {(existingResumeDoc.fileName || "").toLowerCase().endsWith(".pdf") ? (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        PDF
                      </span>
                    ) : (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {(existingResumeDoc.fileName || "").toLowerCase().endsWith(".docx") ? "DOCX" : "DOC"}
                      </span>
                    )}
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
                  /* Brief validating state */
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#474ead]" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Checking file…</span>
                  </div>
                ) : cvFile && cvState === "ready" ? (
                  /* Accepted state */
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-700/40 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {cvFile.type === "application/pdf" ? (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        PDF
                      </span>
                    ) : (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {cvFile.name.toLowerCase().endsWith(".docx") ? "DOCX" : "DOC"}
                      </span>
                    )}
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
                        // Offer existing resume again if available
                        if (existingResumeDoc) setUseExistingResume(true);
                      }}
                      className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1"
                      aria-label="Remove CV"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  /* Upload prompt */
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
                    {/* Offer to reuse profile resume */}
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

              {/* ── Video Introduction (conditional) ────────────────────────────── */}
              {requiresVideoIntro && (
                <div className="space-y-1.5">
                  <Label>
                    Video Introduction <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This position requires a short video introduction. Please record yourself speaking about your background and why you're a great fit.
                  </p>

                  {/* Case 1: Existing profile video */}
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
                        onClick={() => {
                          setUseExistingVideo(false);
                          setVideoFile(null);
                          setVideoState("idle");
                          setVideoError(null);
                        }}
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
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                        {videoFile.name.toLowerCase().endsWith(".webm") ? "WEBM" : videoFile.name.toLowerCase().endsWith(".mov") ? "MOV" : "MP4"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{videoFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {videoFile.size < 1024 * 1024
                            ? `${Math.round(videoFile.size / 1024)} KB`
                            : `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoFile(null);
                          setVideoState("idle");
                          setVideoError(null);
                          if (existingVideoDoc) setUseExistingVideo(true);
                        }}
                        className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1"
                        aria-label="Remove video"
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
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsVideoDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsVideoDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) processVideoFile(file);
                      }}
                    >
                      <Video className={["mb-1.5 h-5 w-5 transition-colors", isVideoDragOver ? "text-violet-600" : "text-slate-400"].join(" ")} />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {isVideoDragOver ? "Drop your video here" : "Upload your video introduction"}
                      </span>
                      <span className="mt-0.5 text-xs text-slate-400">MP4, MOV, WebM · Max 200 MB</span>
                      {existingVideoDoc && (
                        <button
                          type="button"
                          className="mt-2 text-xs text-[#474ead] hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            setUseExistingVideo(true);
                            setVideoError(null);
                          }}
                        >
                          Use video from my Talent profile instead
                        </button>
                      )}
                      <input
                        type="file"
                        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = "";
                          processVideoFile(file);
                        }}
                      />
                    </label>
                  )}

                  {videoError && <p className="text-xs text-red-500">{videoError}</p>}
                </div>
              )}

              {/* Cover Letter */}
              <div className="space-y-1.5">
                <Label htmlFor="coverLetter">Cover Letter / Message</Label>
                <Textarea
                  id="coverLetter"
                  rows={3}
                  value={form.coverLetter}
                  onChange={(e) => setField("coverLetter", e.target.value)}
                  placeholder="Tell us why you're a great fit for this role..."
                  className="min-h-[90px] resize-y"
                />
              </div>

              {/* Submit */}
              <div>
                <Button
                  type="submit"
                  disabled={isPending || isNonTalentUser}
                  className="h-10 w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {submitStep === "saving" ? "Saving application…" : "Uploading CV…"}
                    </>
                  ) : (
                    "Submit Application →"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Existing-email dialog (sign_in_required) ──────────────────────────── */}
      <Dialog
        open={signInDialog.open}
        onOpenChange={(open) => setSignInDialog((s) => ({ ...s, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Application saved — sign in to link it</DialogTitle>
            <DialogDescription>
              We found an existing Talent account for{" "}
              <strong>{signInDialog.maskedEmail}</strong>. Sign in to link your
              application to that account.
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
            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={() => {
                setSignInDialog((s) => ({ ...s, open: false }));
                navigate("/find-work/jobs");
              }}
            >
              Continue browsing jobs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Account conflict dialog ───────────────────────────────────────────── */}
      <Dialog open={conflictDialog} onOpenChange={setConflictDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account type conflict</DialogTitle>
            <DialogDescription>
              The email address you used belongs to a Client or Admin account and
              cannot be used to apply for jobs. Please use a different email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => {
                setConflictDialog(false);
                navigate(`/find-work/job/${jobId}`);
              }}
            >
              Back to job listing
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={() => {
                setConflictDialog(false);
                navigate("/find-work/jobs");
              }}
            >
              Browse jobs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
