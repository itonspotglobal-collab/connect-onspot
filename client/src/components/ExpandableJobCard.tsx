import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Clock,
  DollarSign,
  Star,
  Users,
  ArrowRight,
  Heart,
  CheckCircle2,
  ChevronDown,
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
} from "lucide-react";
import { SiLinkedin, SiFacebook } from "react-icons/si";

const workCategories = [
  {
    id: "development",
    name: "Development & IT",
    icon: Code,
    color: "bg-blue-500",
  },
  {
    id: "design",
    name: "Design & Creative",
    icon: PenTool,
    color: "bg-purple-500",
  },
  {
    id: "marketing",
    name: "Sales & Marketing",
    icon: BarChart3,
    color: "bg-green-500",
  },
  {
    id: "support",
    name: "Admin & Support",
    icon: Headphones,
    color: "bg-orange-500",
  },
  {
    id: "writing",
    name: "Writing & Translation",
    icon: Globe,
    color: "bg-teal-500",
  },
  {
    id: "media",
    name: "Audio, Video & Animation",
    icon: Camera,
    color: "bg-pink-500",
  },
  {
    id: "admin",
    name: "Admin & Support",
    icon: Briefcase,
    color: "bg-orange-500",
  },
];

function getCategoryInfo(categoryId: string) {
  return (
    workCategories.find((cat) => cat.id === categoryId) || workCategories[0]
  );
}

function getJobTypeColor(type: string) {
  switch (type) {
    case "full-time":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "part-time":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "contract":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "freelance":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "hourly":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "fixed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300";
  }
}

function formatContractType(type: string) {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

function formatExperienceLevel(level: string) {
  switch (level) {
    case "entry":
      return "Entry Level (0-2 years)";
    case "intermediate":
      return "Intermediate (2-5 years)";
    case "expert":
      return "Expert (5+ years)";
    default:
      return level;
  }
}

export interface ExpandableJobCardProps {
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
    responsibilities?: string[] | null;
    requirements?: string[] | null;
    skillTags?: string[] | null;
    createdAt?: string | Date | null;
    status?: string;
  };
  adminActions?: React.ReactNode;
  showApply?: boolean;
}

export function ExpandableJobCard({
  job,
  adminActions,
  showApply = true,
}: ExpandableJobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const categoryInfo = getCategoryInfo(job.category);
  const IconComponent = categoryInfo.icon;

  const now = new Date();
  const postedDate = job.createdAt ? new Date(job.createdAt) : now;
  const timeAgo = Math.floor(
    (now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  let postedAtText = "Today";
  if (timeAgo === 1) postedAtText = "1 day ago";
  else if (timeAgo > 1 && timeAgo < 7) postedAtText = `${timeAgo} days ago`;
  else if (timeAgo >= 7 && timeAgo < 30)
    postedAtText = `${Math.floor(timeAgo / 7)} weeks ago`;
  else if (timeAgo >= 30)
    postedAtText = `${Math.floor(timeAgo / 30)} months ago`;

  const rateDisplay =
    job.hourlyRateMin && job.hourlyRateMax
      ? `₱${job.hourlyRateMin}-${job.hourlyRateMax}/month`
      : job.budget
        ? `₱${job.budget}`
        : "Rate TBD";

  const rateLabel =
    job.contractType === "fixed" ? "Fixed price" : "Monthly rate";

  const skills = job.skillTags || [];
  const responsibilities = job.responsibilities || [];
  const requirements = job.requirements || [];

  return (
    <Card
      className="hover-elevate transition-all duration-300 cursor-pointer group"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-t-md px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
              <IconComponent className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white leading-tight truncate">
                {job.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-blue-100 font-medium text-sm">{job.company || "OnSpot"}</span>
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

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {expanded && (
              <div className="text-right">
                <div className="text-lg font-bold text-white leading-tight">{rateDisplay}</div>
                <div className="text-blue-200 text-xs">{rateLabel}</div>
              </div>
            )}
            <ChevronDown
              className={`w-5 h-5 text-blue-200 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border">
          <div className="flex items-center gap-2 px-4 py-3">
            <Briefcase className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contract</div>
              <div className="text-sm font-semibold truncate">{formatContractType(job.contractType)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Salary</div>
              <div className="text-sm font-semibold truncate">{expanded ? rateDisplay : "Expand to view"}</div>
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
              <div className="text-sm font-semibold truncate">{postedAtText}</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
            {job.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {skills.slice(0, 5).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {skills.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{skills.length - 5} more
              </Badge>
            )}
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-4 mb-4 rounded-md bg-muted/40 dark:bg-muted/20 border border-border p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-bold uppercase tracking-wide">Job Description</h4>
              </div>
              <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed pl-6">
                {job.description}
              </p>
            </div>

            {responsibilities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <h4 className="text-sm font-bold uppercase tracking-wide">Responsibilities</h4>
                </div>
                <ul className="text-muted-foreground text-sm space-y-1.5 pl-6">
                  {responsibilities.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-500" />
                  <h4 className="text-sm font-bold uppercase tracking-wide">Skills Needed</h4>
                </div>
                <ul className="text-muted-foreground text-sm space-y-1.5 pl-6">
                  {requirements.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-orange-500" />
                <h4 className="text-sm font-bold uppercase tracking-wide">Experience Level</h4>
              </div>
              <p className="text-muted-foreground text-sm pl-6">
                {formatExperienceLevel(job.experienceLevel)}
              </p>
            </div>
          </div>

          <div className="px-6 pb-5 pt-1 flex items-center gap-3 flex-wrap">
            {showApply && (
              <>
                <Button
                  onClick={() =>
                    window.open(
                      "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true",
                      "_blank",
                    )
                  }
                >
                  Apply Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" size="icon">
                  <Heart className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-2 ml-auto border-l pl-4 border-border">
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Share:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => {
                      const jobUrl = encodeURIComponent(window.location.origin + "/find-work/" + job.id);
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${jobUrl}`, "_blank");
                    }}
                  >
                    <SiLinkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => {
                      const jobUrl = encodeURIComponent(window.location.origin + "/find-work/" + job.id);
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${jobUrl}`, "_blank");
                    }}
                  >
                    <SiFacebook className="w-3.5 h-3.5 text-[#1877F2]" />
                    Facebook
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => {
                      const searchTerm = encodeURIComponent(job.title);
                      window.open(`https://bossjob.ph/jobs?search=${searchTerm}`, "_blank");
                    }}
                  >
                    <Briefcase className="w-3.5 h-3.5 text-green-600" />
                    BossJob
                  </Button>
                </div>
              </>
            )}
            {adminActions}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
