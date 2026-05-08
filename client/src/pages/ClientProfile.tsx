import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { JobFormModal } from "@/components/JobFormModal";
import { buildRateDisplay, getTimeAgo } from "@/lib/jobUtils";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Save,
  X,
  Users,
  Calendar,
} from "lucide-react";
import type { Job } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientProfile {
  id: string;
  userId: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phoneNumber: string | null;
  website: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  about: string | null;
  hiringNeeds: string | null;
  preferredRoles: string[];
  timezone: string | null;
  createdAt: string;
}

// ─── Job row inside client profile ────────────────────────────────────────────
function ClientJobRow({
  job,
  onEdit,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: {
  job: Job;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const isOpen = job.status === "open";
  const pay = buildRateDisplay(job);
  const timeAgo = getTimeAgo(job.createdAt);

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-slate-900/60 transition-shadow hover:shadow-sm">
      <div
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${
          isOpen ? "bg-emerald-400" : "bg-slate-300 dark:bg-white/20"
        }`}
      />
      <div className="flex flex-col gap-3 px-5 py-4 pl-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {job.title}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/40"
              }`}
            >
              {isOpen ? "Open" : job.status === "closed" ? "Closed" : job.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="capitalize">{job.category?.replace(/-/g, " ")}</span>
            <span className="text-slate-300 dark:text-white/20">·</span>
            <span>{job.location || "Remote"}</span>
            {pay && (
              <>
                <span className="text-slate-300 dark:text-white/20">·</span>
                <span className="font-medium text-[#474ead] dark:text-indigo-400">{pay}</span>
              </>
            )}
            <span className="text-slate-300 dark:text-white/20">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
            {(job.proposalCount ?? 0) > 0 && (
              <>
                <span className="text-slate-300 dark:text-white/20">·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {job.proposalCount} application{job.proposalCount !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onToggle} disabled={isToggling}>
            {isOpen ? (
              <><EyeOff className="w-3 h-3 mr-1.5" />Close</>
            ) : (
              <><Eye className="w-3 h-3 mr-1.5" />Reopen</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3 h-3 mr-1.5" />Edit
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/find-work/job/${job.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1.5" />View
            </a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" disabled={isDeleting}>
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove job posting?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel &ldquo;{job.title}&rdquo;. It will no longer appear on the Find Work page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── Profile field ────────────────────────────────────────────────────────────
function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ElementType;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="text-sm text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ClientProfile() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ClientProfile>>({});
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // ─── Redirect if not client ───────────────────────────────────────────────
  if (!isAuthenticated || user?.role !== "client") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Client access required
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Sign in with a client account to view your profile.
            </p>
            <Button onClick={() => navigate("/hire-talent")}>Go to Hire Talent</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Data queries ─────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery<ClientProfile>({
    queryKey: ["/api/client-profile/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client-profile/me");
      return res.json();
    },
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/client/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/jobs");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<ClientProfile>) =>
      apiRequest("PUT", "/api/client-profile/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-profile/me"] });
      toast({ title: "Profile updated" });
      setEditing(false);
    },
    onError: (err: any) =>
      toast({ title: "Failed to save profile", description: err.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/client/jobs/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
      toast({ title: "Job status updated" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" }),
  });

  const deleteJobMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/client/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
      toast({ title: "Job posting removed" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to remove job", description: err.message, variant: "destructive" }),
  });

  // ─── Edit handlers ────────────────────────────────────────────────────────
  const startEdit = () => {
    setForm({
      companyName: profile?.companyName ?? "",
      contactPerson: profile?.contactPerson ?? "",
      email: profile?.email ?? "",
      phoneNumber: profile?.phoneNumber ?? "",
      website: profile?.website ?? "",
      industry: profile?.industry ?? "",
      companySize: profile?.companySize ?? "",
      location: profile?.location ?? "",
      timezone: profile?.timezone ?? "",
      about: profile?.about ?? "",
      hiringNeeds: profile?.hiringNeeds ?? "",
    });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => updateProfileMutation.mutate(form);
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const openJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter((j) => j.status !== "open");
  const companyName = profile?.companyName || user?.company || "My Company";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060816]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#0f172a] relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#474ead]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-indigo-600/20 blur-[70px]" />

        <div className="relative mx-auto max-w-5xl px-6 pb-10 pt-8 md:px-10">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/hire-talent">
              <button className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
                Hire Talent
              </button>
            </Link>
            <span className="rounded-full bg-[#474ead]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#7c82d4]">
              Client
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#474ead]/20 border border-[#474ead]/30">
                <Building2 className="h-8 w-8 text-[#7c82d4]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  {profileLoading ? (
                    <Skeleton className="h-8 w-48 bg-white/10" />
                  ) : (
                    companyName
                  )}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {profile?.industry || "Client Account"}
                  {profile?.location && ` · ${profile.location}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-4 mr-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{openJobs.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Open</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{jobs.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Jobs</p>
                </div>
              </div>
              <Button
                onClick={() => { setEditingJob(null); setJobModalOpen(true); }}
                className="bg-[#474ead] text-white shadow-[0_4px_16px_rgba(71,78,173,0.4)] hover:bg-[#3d439c]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post a Job
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 space-y-8">

        {/* ── Profile Details Card ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#474ead]" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Company Profile
              </h2>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                  onClick={saveEdit}
                  disabled={updateProfileMutation.isPending}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {updateProfileMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ProfileField icon={Building2} label="Company" value={profile?.companyName} />
                <ProfileField icon={User} label="Contact Person" value={profile?.contactPerson} />
                <ProfileField icon={Mail} label="Email" value={profile?.email} />
                <ProfileField icon={Phone} label="Phone" value={profile?.phoneNumber} />
                <ProfileField icon={Globe} label="Website" value={profile?.website} />
                <ProfileField icon={Briefcase} label="Industry" value={profile?.industry} />
                <ProfileField icon={Users} label="Company Size" value={profile?.companySize} />
                <ProfileField icon={MapPin} label="Location" value={profile?.location} />
                <ProfileField icon={Clock} label="Timezone" value={profile?.timezone} />
                {profile?.about && (
                  <div className="sm:col-span-2">
                    <ProfileField icon={Building2} label="About" value={profile.about} />
                  </div>
                )}
                {profile?.hiringNeeds && (
                  <div className="sm:col-span-2">
                    <ProfileField icon={Briefcase} label="Hiring Needs" value={profile.hiringNeeds} />
                  </div>
                )}
                {(!profile?.companyName && !profile?.about) && (
                  <div className="sm:col-span-2 py-6 text-center text-sm text-slate-400">
                    Your profile is empty — click &ldquo;Edit Profile&rdquo; to add your company details.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: "companyName", label: "Company Name", placeholder: "Acme Corp" },
                  { key: "contactPerson", label: "Contact Person", placeholder: "Jane Smith" },
                  { key: "email", label: "Business Email", placeholder: "hello@acme.com" },
                  { key: "phoneNumber", label: "Phone Number", placeholder: "+1 555 000 0000" },
                  { key: "website", label: "Website", placeholder: "https://acme.com" },
                  { key: "industry", label: "Industry", placeholder: "Technology, Healthcare…" },
                  { key: "companySize", label: "Company Size", placeholder: "1–10, 11–50, 51–200, 200+" },
                  { key: "location", label: "Location / Country", placeholder: "New York, US" },
                  { key: "timezone", label: "Timezone", placeholder: "America/New_York" },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium">{label}</Label>
                    <Input
                      value={(form as any)[key] ?? ""}
                      onChange={field(key)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">About the Company</Label>
                  <Textarea
                    rows={3}
                    value={form.about ?? ""}
                    onChange={field("about")}
                    placeholder="Brief description of your company and what you do…"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">Hiring Needs</Label>
                  <Textarea
                    rows={2}
                    value={form.hiringNeeds ?? ""}
                    onChange={field("hiringNeeds")}
                    placeholder="What roles are you typically hiring for?"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Job Postings ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Briefcase className="h-5 w-5 text-[#474ead]" />
              Job Postings
              <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                {jobs.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {openJobs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {openJobs.length} open
                </div>
              )}
              {closedJobs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <XCircle className="h-3.5 w-3.5" />
                  {closedJobs.length} closed
                </div>
              )}
              <Button
                size="sm"
                className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                onClick={() => { setEditingJob(null); setJobModalOpen(true); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Post a Job
              </Button>
            </div>
          </div>

          {jobsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
                  <Briefcase className="h-7 w-7 text-[#474ead]" />
                </div>
                <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
                  No job postings yet
                </h3>
                <p className="mb-5 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  Post your first job to start finding talent on OnSpot.
                </p>
                <Button
                  className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                  onClick={() => { setEditingJob(null); setJobModalOpen(true); }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Post Your First Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <ClientJobRow
                  key={job.id}
                  job={job}
                  onEdit={() => { setEditingJob(job); setJobModalOpen(true); }}
                  onToggle={() =>
                    toggleStatusMutation.mutate({
                      id: job.id,
                      status: job.status === "open" ? "closed" : "open",
                    })
                  }
                  onDelete={() => deleteJobMutation.mutate(job.id)}
                  isToggling={toggleStatusMutation.isPending}
                  isDeleting={deleteJobMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer info ──────────────────────────────────────────────────── */}
        {profile?.createdAt && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pb-4">
            <Calendar className="h-3.5 w-3.5" />
            Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
          </div>
        )}
      </div>

      {/* ── Job form modal (client-scoped) ───────────────────────────────────── */}
      <JobFormModal
        open={jobModalOpen}
        onClose={() => { setJobModalOpen(false); setEditingJob(null); }}
        job={editingJob}
        onSuccess={() => { setJobModalOpen(false); setEditingJob(null); }}
        clientMode={true}
        defaultCompany={profile?.companyName || user?.company || ""}
      />
    </div>
  );
}
