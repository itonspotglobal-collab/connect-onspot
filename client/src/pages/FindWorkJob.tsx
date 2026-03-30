import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  MapPin,
  CalendarDays,
  CheckCircle2,
  Star,
  Users,
  FileText,
  Share2,
  Copy,
  Check,
  ArrowRight,
  Heart,
  Code,
  PenTool,
  BarChart3,
  Headphones,
  Globe,
  Camera,
  ExternalLink,
  Lightbulb,
  ClipboardList,
} from "lucide-react";
import { SiLinkedin, SiFacebook, SiX } from "react-icons/si";
import {
  buildJobUrl,
  buildLinkedInShareUrl,
  buildFacebookShareUrl,
  buildTwitterShareUrl,
  copyToClipboard,
  shareNative,
} from "@/lib/shareUtils";
import {
  getTimeAgo,
  getJobBadges,
  formatContractType,
  formatExperienceLevel,
  buildRateDisplay,
} from "@/lib/jobUtils";

const CATEGORY_MAP = [
  { id: "development", name: "Development & IT", icon: Code, color: "from-blue-600 to-blue-700" },
  { id: "design", name: "Design & Creative", icon: PenTool, color: "from-purple-600 to-purple-700" },
  { id: "marketing", name: "Sales & Marketing", icon: BarChart3, color: "from-green-600 to-green-700" },
  { id: "support", name: "Admin & Support", icon: Headphones, color: "from-orange-600 to-orange-700" },
  { id: "writing", name: "Writing & Translation", icon: Globe, color: "from-teal-600 to-teal-700" },
  { id: "media", name: "Audio, Video & Animation", icon: Camera, color: "from-pink-600 to-pink-700" },
  { id: "admin", name: "Admin & Support", icon: Briefcase, color: "from-orange-600 to-orange-700" },
];

function getCategoryInfo(id: string) {
  return CATEGORY_MAP.find((c) => c.id === id) || CATEGORY_MAP[0];
}

function getJobTypeColor(type: string) {
  switch (type) {
    case "full-time": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "part-time": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "contract": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300";
  }
}

interface JobData {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  category: string;
  contractType: string;
  experienceLevel: string;
  description: string;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  skillTags?: string[] | null;
  skills?: string[] | null;
  createdAt?: string | Date | null;
  status?: string;
  proposalCount?: number | null;
}

const APPLY_FORM_URL =
  "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

export default function FindWorkJob() {
  // Works for both /jobs/:jobId and /find-work/job/:jobId
  const params = useParams<{ jobId?: string; id?: string }>();
  const jobId = params?.jobId || params?.id || "";
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const [canNativeShare] = useState(() => !!navigator.share);

  const { data: rawJob, isLoading, isError } = useQuery<JobData>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  // Normalize skillTags from either `skills` or `skillTags` depending on which endpoint populated them
  const job: JobData | undefined = rawJob
    ? {
        ...rawJob,
        skillTags: rawJob.skillTags?.length
          ? rawJob.skillTags
          : (rawJob.skills as string[] | null | undefined) ?? null,
      }
    : undefined;

  const jobUrl = job ? buildJobUrl(job.id) : "";
  const rateDisplay = job ? buildRateDisplay(job) : "";
  const timeAgo = job ? getTimeAgo(job.createdAt) : "";
  const badges = job ? getJobBadges(job) : [];
  const skills = job?.skillTags || [];
  const responsibilities = job?.responsibilities || [];
  const requirements = job?.requirements || [];
  const categoryInfo = job ? getCategoryInfo(job.category) : CATEGORY_MAP[0];
  const IconComponent = categoryInfo.icon;

  async function handleCopyLink() {
    const ok = await copyToClipboard(jobUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleNativeShare() {
    if (!job) return;
    await shareNative({ title: job.title, url: jobUrl, text: `Check out this job: ${job.title}` });
  }

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-muted-foreground text-sm">Loading job details…</p>
      </div>
    );
  }

  // ─── Error / Not found ──────────────────────────────────────────────────────
  if (isError || (!isLoading && !job)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-semibold mb-2">Job not found</h2>
          <p className="text-sm text-muted-foreground">
            This listing may have been removed or the link is invalid.
          </p>
        </div>
        <Button onClick={() => navigate("/find-work")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Browse all jobs
        </Button>
      </div>
    );
  }

  if (!job) return null;

  // ─── Full dedicated page ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

        {/* Hero / Header */}
        <div className={`bg-gradient-to-r ${categoryInfo.color} dark:opacity-90`}>
          <div className="container mx-auto px-4 py-8 max-w-5xl">
            {/* Breadcrumb */}
            <button
              onClick={() => navigate("/find-work")}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all jobs
            </button>

            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                {/* Badges */}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {badges.map((b) => (
                      <span
                        key={b.key}
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/20 text-white border border-white/30"
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/90 font-medium text-sm">
                      {job.company || "OnSpot Global"}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-green-300 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-300 fill-current" />
                    <span className="text-white/80 text-sm">4.9</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${getJobTypeColor(job.contractType)}`}
                  >
                    {formatContractType(job.contractType)}
                  </Badge>
                </div>
                {/* Key stats in hero */}
                <div className="flex flex-wrap gap-4 mt-4 text-white/90 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-base">{rateDisplay}</span>
                    <span className="text-white/60 text-xs">
                      {job.contractType === "fixed" ? "fixed" : "/month"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-white/70" />
                    {job.location || "Remote"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-white/70" />
                    Posted {timeAgo}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-white/70" />
                    {formatExperienceLevel(job.experienceLevel)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Main column ────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-8">

              {/* Skills */}
              {skills.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
                    Skills Required
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Overview */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <h2 className="text-base font-bold uppercase tracking-wide">
                    Role Overview
                  </h2>
                </div>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {job.description}
                </p>
              </div>

              {/* Responsibilities */}
              {responsibilities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ClipboardList className="w-5 h-5 text-green-500" />
                    <h2 className="text-base font-bold uppercase tracking-wide">
                      Responsibilities
                    </h2>
                  </div>
                  {responsibilities.length === 1 &&
                  responsibilities[0].trim().startsWith("<") ? (
                    <div
                      className="text-muted-foreground text-sm prose-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:leading-relaxed [&_li]:my-1 [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: responsibilities[0] }}
                    />
                  ) : (
                    <ul className="space-y-2">
                      {responsibilities.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-muted-foreground leading-relaxed">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Requirements */}
              {requirements.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-purple-500" />
                    <h2 className="text-base font-bold uppercase tracking-wide">
                      Skills & Requirements
                    </h2>
                  </div>
                  {requirements.length === 1 &&
                  requirements[0].trim().startsWith("<") ? (
                    <div
                      className="text-muted-foreground text-sm prose-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:leading-relaxed [&_li]:my-1 [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: requirements[0] }}
                    />
                  ) : (
                    <ul className="space-y-2">
                      {requirements.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 w-4 h-4 text-purple-500 flex-shrink-0" />
                          <span className="text-muted-foreground leading-relaxed">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Benefits */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-bold uppercase tracking-wide">
                    Why Join OnSpot
                  </h2>
                </div>
                <ul className="space-y-2">
                  {[
                    "Competitive salary — paid on time, every time",
                    "Work with verified international clients",
                    "Supportive team environment with growth opportunities",
                    "Remote-friendly setup with flexible scheduling",
                    "Training and upskilling support provided",
                  ].map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="text-muted-foreground leading-relaxed">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cultural Fit */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-violet-500" />
                  <h2 className="text-base font-bold uppercase tracking-wide">
                    Cultural Fit
                  </h2>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  At OnSpot, we prioritize a unique blend of creativity, innovation, and collaboration. We seek individuals who are:
                </p>
                <ul className="space-y-2">
                  {[
                    "Passionate about our company's mission and values.",
                    "Entrepreneurial-minded and willing to take risks.",
                    "Collaborative and team-oriented.",
                    "Adaptable and able to handle the fast-paced and often unpredictable nature of a startup environment.",
                    "Maintain a positive attitude and persevere through setbacks.",
                    "Demonstrate the ability to bounce back from challenges and maintain a strong work ethic.",
                    "Embrace and adapt to rapid changes and evolving processes within a startup environment.",
                    "Able to adapt to changing client needs and requirements.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                      <span className="text-muted-foreground leading-relaxed">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* How to Apply */}
              <div className="rounded-lg border border-border bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                  <h2 className="text-base font-bold uppercase tracking-wide">
                    How to Apply
                  </h2>
                </div>
                <ol className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-foreground w-4 flex-shrink-0">1.</span>
                    Click the <strong className="text-foreground">Apply Now</strong> button below.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-foreground w-4 flex-shrink-0">2.</span>
                    Fill out the application form with your details and experience.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-foreground w-4 flex-shrink-0">3.</span>
                    Our team will review your application and contact you within 48 hours.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-foreground w-4 flex-shrink-0">4.</span>
                    Qualified candidates proceed to a brief interview and onboarding.
                  </li>
                </ol>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  onClick={() => window.open(APPLY_FORM_URL, "_blank")}
                >
                  Apply for This Role
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>

              {/* Share */}
              <div className="rounded-lg border border-border bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Share this job</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyLink}>
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  {canNativeShare && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNativeShare}>
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => window.open(buildLinkedInShareUrl(jobUrl), "_blank")}
                  >
                    <SiLinkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => window.open(buildFacebookShareUrl(jobUrl), "_blank")}
                  >
                    <SiFacebook className="w-3.5 h-3.5 text-[#1877F2]" />
                    Facebook
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => window.open(buildTwitterShareUrl(jobUrl, job.title), "_blank")}
                  >
                    <SiX className="w-3.5 h-3.5" />
                    X
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Apply CTA card */}
              <Card className="border-blue-200 dark:border-blue-800 sticky top-20">
                <CardContent className="p-5 space-y-4">
                  <div>
                    <div className="text-2xl font-bold">{rateDisplay}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {job.contractType === "fixed" ? "Fixed-price project" : "Monthly salary"}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => window.open(APPLY_FORM_URL, "_blank")}
                  >
                    Apply Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <Button variant="outline" className="w-full gap-2" size="sm">
                    <Heart className="w-4 h-4" />
                    Save for Later
                  </Button>

                  <div className="pt-1 border-t border-border space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Contract</div>
                        <div className="font-medium">{formatContractType(job.contractType)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Location</div>
                        <div className="font-medium">{job.location || "Remote"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Experience</div>
                        <div className="font-medium">{formatExperienceLevel(job.experienceLevel)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Posted</div>
                        <div className="font-medium">{timeAgo}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Company / platform card */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">
                        {job.company || "OnSpot Global"}
                      </div>
                      <div className="text-xs text-muted-foreground">Verified employer</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    All roles on OnSpot are from verified clients. Payments are
                    protected and released through our secure platform.
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>

        {/* Sticky bottom CTA bar (mobile) */}
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background border-t border-border px-4 py-3 flex gap-3 z-40">
          <Button
            className="flex-1"
            onClick={() => window.open(APPLY_FORM_URL, "_blank")}
          >
            Apply Now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Save job">
            <Heart className="w-4 h-4" />
          </Button>
        </div>
        {/* Bottom padding for sticky bar on mobile */}
        <div className="h-20 lg:hidden" />
      </div>
  );
}
