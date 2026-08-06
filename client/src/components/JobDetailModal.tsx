import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  MapPin,
  Star,
  Users,
  ArrowRight,
  Heart,
  CheckCircle2,
  Code,
  PenTool,
  BarChart3,
  Headphones,
  Globe,
  Camera,
  Briefcase,
  Share2,
  FileText,
  CalendarDays,
  Copy,
  Check,
  BookOpen,
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
import { getTimeAgo, getPublicCompanyName } from "@/lib/jobUtils";

const workCategories = [
  { id: "development", name: "Development & IT", icon: Code, color: "bg-blue-500" },
  { id: "design", name: "Design & Creative", icon: PenTool, color: "bg-purple-500" },
  { id: "marketing", name: "Sales & Marketing", icon: BarChart3, color: "bg-green-500" },
  { id: "support", name: "Admin & Support", icon: Headphones, color: "bg-orange-500" },
  { id: "writing", name: "Writing & Translation", icon: Globe, color: "bg-teal-500" },
  { id: "media", name: "Audio, Video & Animation", icon: Camera, color: "bg-pink-500" },
  { id: "admin", name: "Admin & Support", icon: Briefcase, color: "bg-orange-500" },
];

function getCategoryInfo(categoryId: string) {
  return workCategories.find((cat) => cat.id === categoryId) || workCategories[0];
}

function getJobTypeColor(type: string) {
  switch (type) {
    case "full-time": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "part-time": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "contract": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "freelance": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "hourly": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "fixed": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300";
  }
}

function formatContractType(type: string) {
  return type.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("-");
}

function formatExperienceLevel(level: string) {
  switch (level) {
    case "entry": return "Entry Level (0–2 years)";
    case "intermediate": return "Intermediate (2–5 years)";
    case "expert": return "Expert (5+ years)";
    default: return level;
  }
}

export interface JobDetailModalProps {
  job: {
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
    salaryDisplay?: string | null;
    responsibilities?: string[] | null;
    requirements?: string[] | null;
    skillTags?: string[] | null;
    createdAt?: string | Date | null;
    status?: string;
    applyLink?: string | null;
  };
  open: boolean;
  onClose: () => void;
  adminActions?: React.ReactNode;
  showApply?: boolean;
}

export function JobDetailModal({
  job,
  open,
  onClose,
  adminActions,
  showApply = true,
}: JobDetailModalProps) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const [canNativeShare] = useState(() => !!navigator.share);

  const categoryInfo = getCategoryInfo(job.category);
  const IconComponent = categoryInfo.icon;

  const postedAgo = getTimeAgo(job.createdAt);

  const rateDisplay = (job as any).salaryDisplay?.trim()
    || (job.hourlyRateMin && job.hourlyRateMax
        ? `₱${job.hourlyRateMin}–${job.hourlyRateMax}/month`
        : job.budget ? `₱${job.budget}` : "Rate TBD");

  const rateLabel = job.contractType === "fixed" ? "Fixed price" : "Monthly rate";
  const skills = job.skillTags || [];
  const responsibilities = job.responsibilities || [];
  const requirements = job.requirements || [];
  const jobUrl = buildJobUrl(job.id);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleCopyLink() {
    const ok = await copyToClipboard(jobUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleNativeShare() {
    await shareNative({ title: job.title, url: jobUrl, text: `Check out this job: ${job.title}` });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      aria-modal="true"
      role="dialog"
      aria-label={job.title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl bg-background border border-border">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-white leading-tight">{job.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-blue-100 font-medium text-sm">{getPublicCompanyName(job)}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-300 flex-shrink-0" />
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-300 fill-current" />
                    <span className="text-blue-100 text-xs">4.9</span>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${getJobTypeColor(job.contractType)}`}>
                    {formatContractType(job.contractType)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <div className="text-lg font-bold text-white leading-tight">{rateDisplay}</div>
                <div className="text-blue-200 text-xs">{rateLabel}</div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close job details"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors duration-200 flex-shrink-0"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 px-4 py-3">
            <Briefcase className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contract</div>
              <div className="text-sm font-semibold truncate">{formatContractType(job.contractType)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-green-500 text-sm font-bold flex-shrink-0 leading-none">₱</span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {job.contractType === "fixed" ? "Budget" : "Salary"}
              </div>
              <div className="text-sm font-semibold truncate">{rateDisplay}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Location</div>
              <div className="text-sm font-semibold truncate">{job.location || "Remote"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <CalendarDays className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Posted</div>
              <div className="text-sm font-semibold truncate">{postedAgo}</div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Skills */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs h-auto whitespace-normal break-words">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Job Description</h3>
              </div>
              <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed pl-6">
                {job.description}
              </p>
            </div>

            {/* Responsibilities */}
            {responsibilities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">Responsibilities</h3>
                </div>
                {responsibilities.length === 1 && responsibilities[0].trim().startsWith("<") ? (
                  <div
                    className="text-muted-foreground text-sm pl-6 prose-sm [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:leading-relaxed [&_li]:my-0.5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: responsibilities[0] }}
                  />
                ) : (
                  <ul className="text-muted-foreground text-sm space-y-1.5 pl-6">
                    {responsibilities.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">Skills Needed</h3>
                </div>
                {requirements.length === 1 && requirements[0].trim().startsWith("<") ? (
                  <div
                    className="text-muted-foreground text-sm pl-6 prose-sm [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:leading-relaxed [&_li]:my-0.5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: requirements[0] }}
                  />
                ) : (
                  <ul className="text-muted-foreground text-sm space-y-1.5 pl-6">
                    {requirements.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Experience */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Experience Level</h3>
              </div>
              <p className="text-muted-foreground text-sm pl-6">{formatExperienceLevel(job.experienceLevel)}</p>
            </div>

            {/* Share section */}
            <div className="rounded-md bg-muted/50 border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Share2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Share this job</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCopyLink}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>

                {canNativeShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleNativeShare}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(buildLinkedInShareUrl(jobUrl), "_blank")}
                >
                  <SiLinkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                  LinkedIn
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(buildFacebookShareUrl(jobUrl), "_blank")}
                >
                  <SiFacebook className="w-3.5 h-3.5 text-[#1877F2]" />
                  Facebook
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(buildTwitterShareUrl(jobUrl, job.title), "_blank")}
                >
                  <SiX className="w-3.5 h-3.5" />
                  X
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center gap-3 flex-wrap bg-background">
          {showApply && (
            <>
              {job.applyLink ? (
                <Button
                  onClick={() =>
                    window.open(job.applyLink!, "_blank", "noopener,noreferrer")
                  }
                >
                  Apply Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button disabled variant="outline">
                  Application link unavailable
                </Button>
              )}
              <Button variant="outline" size="icon" aria-label="Save job">
                <Heart className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Find out more — navigates to the full dedicated job page */}
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              navigate(`/jobs/${job.id}`);
            }}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Find out more
          </Button>

          {adminActions && <div className="ml-auto">{adminActions}</div>}
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
