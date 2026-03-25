import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Star,
  CheckCircle2,
  Code,
  PenTool,
  BarChart3,
  Headphones,
  Globe,
  Camera,
  Briefcase,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { JobDetailModal } from "@/components/JobDetailModal";

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
  const [modalOpen, setModalOpen] = useState(false);

  const categoryInfo = getCategoryInfo(job.category);
  const IconComponent = categoryInfo.icon;

  const now = new Date();
  const postedDate = job.createdAt ? new Date(job.createdAt) : now;
  const timeAgo = Math.floor((now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));
  const getTimeAgoText = (days: number) => {
    if (days <= 0) return "Today";
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`;
  };

  const rateDisplay =
    job.hourlyRateMin && job.hourlyRateMax
      ? `₱${job.hourlyRateMin}–${job.hourlyRateMax}/month`
      : job.budget
        ? `₱${job.budget}`
        : "Rate TBD";

  const skills = job.skillTags || [];

  return (
    <>
      <Card
        className="hover-elevate transition-all duration-300 cursor-pointer group"
        onClick={() => setModalOpen(true)}
      >
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-t-md px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-white leading-tight truncate">{job.title}</h3>
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
            <div className="flex-shrink-0 text-right">
              <div className="text-base font-bold text-white leading-tight">{rateDisplay}</div>
              <div className="text-blue-200 text-xs mt-0.5">
                {job.contractType === "fixed" ? "Fixed price" : "Monthly rate"}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border">
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
                <div className="text-sm font-semibold truncate">{getTimeAgoText(timeAgo)}</div>
              </div>
            </div>
          </div>

          {/* Preview body */}
          <div className="px-6 py-4">
            <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
              {job.description}
            </p>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {skills.slice(0, 5).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs h-auto whitespace-normal break-words">
                    {skill}
                  </Badge>
                ))}
                {skills.length > 5 && (
                  <Badge variant="outline" className="text-xs h-auto whitespace-normal break-words">
                    +{skills.length - 5} more
                  </Badge>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
              >
                View Details
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
              {adminActions && (
                <div onClick={(e) => e.stopPropagation()}>{adminActions}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <JobDetailModal
        job={job}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        adminActions={adminActions}
        showApply={showApply}
      />
    </>
  );
}
