import { useState } from "react";
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
import { ArrowLeft, Briefcase, MapPin, Loader2 } from "lucide-react";
import type { Job } from "@shared/schema";

// ─── Main Component ────────────────────────────────────────────────────────────
export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isPending, setIsPending] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    coverLetter: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

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
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsPending(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          coverLetter: form.coverLetter.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }));
        throw new Error(err.error || "Submission failed");
      }

      const data = await res.json();
      // Redirect to talent signup with the continuation token
      navigate(`/talent/signup?applicationToken=${encodeURIComponent(data.continuationToken)}`);
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

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
              Your Application
            </h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              After submitting you'll create your Talent account to track your application.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* First + Last Name */}
              <div className="grid gap-4 sm:grid-cols-2">
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
                    autoComplete="email"
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
    </div>
  );
}
