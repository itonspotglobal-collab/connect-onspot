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
import { ArrowLeft, Briefcase, MapPin, Loader2, ShieldAlert, UserCheck, LogIn, FileText, Upload, X } from "lucide-react";
import type { Job } from "@shared/schema";
import { getPublicCompanyName } from "@/lib/jobUtils";

// ─── Main Component ────────────────────────────────────────────────────────────
export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const isTalent = user?.role === "talent";
  const isNonTalentUser = !!user && !isTalent; // client or admin

  const [isPending, setIsPending] = useState(false);
  const [emailMismatchError, setEmailMismatchError] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  // ── Dialog state ─────────────────────────────────────────────────────────────
  // sign_in_required: existing Talent email found — prompt to sign in
  const [signInDialog, setSignInDialog] = useState<{
    open: boolean;
    maskedEmail: string;
    continuationToken: string;
  }>({ open: false, maskedEmail: "", continuationToken: "" });

  // account_conflict: email belongs to a Client or Admin account
  const [conflictDialog, setConflictDialog] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    coverLetter: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  // Pre-fill from authenticated talent account
  useEffect(() => {
    if (isTalent && user) {
      setForm((prev) => ({
        ...prev,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        email: user.email || prev.email,
      }));
    }
  }, [isTalent, user]);

  const { data: job, isLoading, isError } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}`);
      return res.json();
    },
    enabled: !!jobId,
  });

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (k === "email") setEmailMismatchError(false);
  };

  const validate = () => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    setErrors(next);

    // CV validation — set/clear the separate cvError state so the error sits under the field
    if (!cvFile) {
      setCvError("CV / Resume is required");
    } else {
      setCvError(null);
    }

    return Object.keys(next).length === 0 && !!cvFile;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsPending(true);
    setEmailMismatchError(false);
    try {
      // Build multipart FormData — server expects file field "resume"
      const token = localStorage.getItem("onspot_jwt_token");
      const formData = new FormData();
      formData.append("firstName", form.firstName.trim());
      formData.append("lastName", form.lastName.trim());
      formData.append("email", form.email.trim());
      formData.append("phone", form.phone.trim());
      if (form.coverLetter.trim()) formData.append("coverLetter", form.coverLetter.trim());
      formData.append("resume", cvFile);

      // Do NOT set Content-Type — browser sets it automatically with the multipart boundary
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }));
        if (err.error === "email_mismatch") {
          setEmailMismatchError(true);
          return;
        }
        throw new Error(err.message || err.error || "Submission failed");
      }

      const data = await res.json();

      if (data.accountAction === "already_authenticated") {
        // Authenticated talent — application saved and linked immediately
        toast({
          title: "Application submitted! 🎉",
          description: "Your application has been linked to your Talent account.",
        });
        navigate("/find-work/jobs");

      } else if (data.accountAction === "sign_in_required") {
        // Application saved — email belongs to an existing Talent account
        setSignInDialog({
          open: true,
          maskedEmail: data.maskedEmail || form.email.trim(),
          continuationToken: data.continuationToken,
        });

      } else if (data.accountAction === "account_conflict") {
        // Application saved — email belongs to a Client or Admin account
        setConflictDialog(true);

      } else {
        // create_account — new email, redirect to Talent signup with continuation token
        navigate(`/talent/signup?applicationToken=${encodeURIComponent(data.continuationToken)}`);
      }
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  // ── Loading / error / guard screens ──────────────────────────────────────────

  if (isLoading) {
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

            {/* Context-aware subtitle */}
            {isTalent ? (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-[#474ead]/8 px-3 py-2 text-sm text-[#474ead] dark:bg-[#474ead]/20 dark:text-indigo-300">
                <UserCheck className="h-4 w-4 shrink-0" />
                You are applying with your OnSpot Talent account.
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Submit your application to continue.
              </p>
            )}

            {/* Email mismatch error banner */}
            {emailMismatchError && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700/40 dark:bg-red-900/20">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="flex-1 text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium">Email address mismatch.</p>
                  <p className="mt-0.5">You are signed in with a different email address. Sign out to apply using another account.</p>
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
                    readOnly={isTalent}
                    className={isTalent ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : ""}
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

              {/* CV / Resume upload (required) */}
              <div className="space-y-1.5">
                <Label>
                  CV / Resume <span className="text-red-500">*</span>
                </Label>
                {cvFile ? (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                    <FileText className="h-4 w-4 shrink-0 text-[#474ead]" />
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
                      onClick={() => { setCvFile(null); setCvError(null); }}
                      className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-[#474ead]/40 hover:bg-[#474ead]/5 dark:border-slate-700 dark:bg-slate-800/50">
                    <Upload className="mb-1.5 h-5 w-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Upload your CV</span>
                    <span className="mt-0.5 text-xs text-slate-400">PDF, DOC, DOCX · Max 10 MB</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const allowed = [
                          "application/pdf",
                          "application/msword",
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        ];
                        if (!allowed.includes(file.type)) {
                          setCvError("Please upload a PDF, DOC, or DOCX file");
                          return;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          setCvError("Resume must be 10 MB or smaller");
                          return;
                        }
                        setCvFile(file);
                        setCvError(null);
                      }}
                    />
                  </label>
                )}
                {cvError && <p className="text-xs text-red-500">{cvError}</p>}
              </div>

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
                      Submitting…
                    </>
                  ) : (
                    "Submit Application →"
                  )}
                </Button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  Required fields are marked with <span className="text-red-500">*</span>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Existing-email dialog (sign_in_required) ────────────────────────────── */}
      <Dialog
        open={signInDialog.open}
        onOpenChange={(open) => setSignInDialog((s) => ({ ...s, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-[#474ead]" />
              This email already has an account
            </DialogTitle>
            <DialogDescription className="pt-1">
              An OnSpot Talent account already exists for{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {signInDialog.maskedEmail}
              </span>
              . Sign in to link and track this application.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-3">
            {/* Primary: Sign In */}
            <Button
              className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
              onClick={() => {
                // Guard: both token and jobId must be available before navigating
                const tok = signInDialog.continuationToken;
                if (!tok) {
                  toast({ variant: "destructive", title: "Session expired", description: "Please submit your application again." });
                  setSignInDialog((s) => ({ ...s, open: false }));
                  return;
                }
                const dest = jobId ? `/jobs/${jobId}` : "/find-work/jobs";
                const token = encodeURIComponent(tok);
                const returnTo = encodeURIComponent(dest);
                navigate(`/portal-login?portal=talent&applicationToken=${token}&returnTo=${returnTo}`);
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>

            {/* Secondary: Continue Browsing */}
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => {
                setSignInDialog((s) => ({ ...s, open: false }));
                navigate("/find-work/jobs");
              }}
            >
              Continue Browsing Jobs
            </Button>

            {/* Tertiary text link */}
            <button
              type="button"
              className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => {
                setSignInDialog((s) => ({ ...s, open: false }));
                navigate(`/find-work/job/${jobId}`);
              }}
            >
              ← Back to Job Posting
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Account-conflict dialog (account_conflict) ───────────────────────────── */}
      <Dialog open={conflictDialog} onOpenChange={setConflictDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Account type conflict
            </DialogTitle>
            <DialogDescription className="pt-1">
              This email is already associated with another OnSpot account type. Please use a
              different email or contact support.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
            Your application has been saved. An OnSpot administrator can help link it to the correct
            account.
          </p>

          <div className="mt-2 flex flex-col gap-3">
            <Button
              className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
              onClick={() => {
                setConflictDialog(false);
                navigate("/find-work/jobs");
              }}
            >
              Browse Jobs
            </Button>
            <button
              type="button"
              className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => {
                setConflictDialog(false);
                navigate(`/find-work/job/${jobId}`);
              }}
            >
              ← Back to Job Posting
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
