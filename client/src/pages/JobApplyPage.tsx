import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  CheckCircle2,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import type { Job } from "@shared/schema";

// ─── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ jobTitle, onBack }: { jobTitle: string; onBack: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Application Submitted!
      </h2>
      <p className="mb-1 text-slate-600 dark:text-slate-300">
        Your application for <span className="font-semibold">{jobTitle}</span> has been received.
      </p>
      <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
        Our team will review your application and reach out within 3 business days.
      </p>
      <Button variant="outline" className="rounded-full px-6" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Jobs
      </Button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [submitted, setSubmitted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    applicantName: "",
    email: "",
    phone: "",
    location: "",
    portfolioUrl: "",
    coverLetter: "",
    expectedSalary: "",
    availability: "",
  });
  const [errors, setErrors] = useState<Partial<typeof form & { resume: string }>>({});

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
  };

  const validate = () => {
    const next: Partial<typeof form & { resume: string }> = {};
    if (!form.applicantName.trim()) next.applicantName = "Full name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    if (!resumeFile) next.resume = "Resume is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      setErrors((p) => ({ ...p, resume: "Only PDF or Word documents are allowed" }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((p) => ({ ...p, resume: "File too large — max 10 MB" }));
      return;
    }
    setResumeFile(file);
    setErrors((p) => ({ ...p, resume: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsPending(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v.trim()) fd.append(k, v.trim()); });
      if (resumeFile) fd.append("resume", resumeFile);

      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }));
        throw new Error(err.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

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
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
        {/* Back */}
        <button
          onClick={() => navigate(`/find-work/job/${jobId}`)}
          className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to job
        </button>

        {/* Job header */}
        <div className="mb-8">
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
              {job.company || "OnSpot Global"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {job.location || "Remote"}
            </span>
          </div>
        </div>

        {submitted ? (
          <SuccessScreen jobTitle={job.title} onBack={() => navigate("/find-work/jobs")} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">
                Your Application
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="applicantName">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="applicantName"
                    value={form.applicantName}
                    onChange={(e) => setField("applicantName", e.target.value)}
                    placeholder="e.g. Maria Santos"
                  />
                  {errors.applicantName && <p className="text-xs text-red-500">{errors.applicantName}</p>}
                </div>

                {/* Email + Phone */}
                <div className="grid gap-4 sm:grid-cols-2">
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
                    />
                    {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <Label htmlFor="location">Current Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) => setField("location", e.target.value)}
                    placeholder="e.g. Manila, Philippines"
                  />
                </div>

                {/* Resume Upload */}
                <div className="space-y-1.5">
                  <Label>
                    Resume <span className="text-red-500">*</span>
                  </Label>
                  {resumeFile ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-800/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                          {resumeFile.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(resumeFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="shrink-0 rounded-full p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-6 py-8 text-center transition-colors hover:border-[#474ead]/40 hover:bg-[#474ead]/5 dark:border-white/10 dark:hover:border-[#474ead]/40"
                    >
                      <Upload className="h-6 w-6 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Click to upload your resume
                      </span>
                      <span className="text-xs text-slate-400">PDF or Word · max 10 MB</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {errors.resume && <p className="text-xs text-red-500">{errors.resume}</p>}
                </div>

                {/* Portfolio / LinkedIn */}
                <div className="space-y-1.5">
                  <Label htmlFor="portfolioUrl">Portfolio / LinkedIn URL</Label>
                  <Input
                    id="portfolioUrl"
                    value={form.portfolioUrl}
                    onChange={(e) => setField("portfolioUrl", e.target.value)}
                    placeholder="https://linkedin.com/in/yourname"
                  />
                </div>

                {/* Cover Letter */}
                <div className="space-y-1.5">
                  <Label htmlFor="coverLetter">Cover Letter / Message</Label>
                  <Textarea
                    id="coverLetter"
                    rows={5}
                    value={form.coverLetter}
                    onChange={(e) => setField("coverLetter", e.target.value)}
                    placeholder="Tell us why you're a great fit for this role..."
                    className="resize-none"
                  />
                </div>

                {/* Expected Salary + Availability */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="expectedSalary">Expected Salary</Label>
                    <Input
                      id="expectedSalary"
                      value={form.expectedSalary}
                      onChange={(e) => setField("expectedSalary", e.target.value)}
                      placeholder="e.g. ₱40,000 / month"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="availability">Availability</Label>
                    <Input
                      id="availability"
                      value={form.availability}
                      onChange={(e) => setField("availability", e.target.value)}
                      placeholder="e.g. Immediate, 2 weeks notice"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-full bg-[#474ead] py-2.5 text-white hover:bg-[#3d439c]"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Required fields are marked with <span className="text-red-500">*</span>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
