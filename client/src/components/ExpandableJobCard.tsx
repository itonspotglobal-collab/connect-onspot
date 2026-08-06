import { useState } from "react";
import { useLocation } from "wouter";
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
import {
  getTimeAgo,
  getJobBadges,
  formatContractType,
  getPublicCompanyName,
} from "@/lib/jobUtils";

const CATEGORY_MAP = [
  { id: "development", name: "Development & IT", icon: Code, color: "bg-blue-500" },
  { id: "design", name: "Design & Creative", icon: PenTool, color: "bg-purple-500" },
  { id: "marketing", name: "Sales & Marketing", icon: BarChart3, color: "bg-green-500" },
  { id: "support", name: "Admin & Support", icon: Headphones, color: "bg-orange-500" },
  { id: "writing", name: "Writing & Translation", icon: Globe, color: "bg-teal-500" },
  { id: "media", name: "Audio, Video & Animation", icon: Camera, color: "bg-pink-500" },
  { id: "admin", name: "Admin & Support", icon: Briefcase, color: "bg-orange-500" },
];

function getCategoryInfo(categoryId: string) {
  return CATEGORY_MAP.find((c) => c.id === categoryId) || CATEGORY_MAP[0];
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
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300";
  }
}

export interface JobShape {
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
  proposalCount?: number | null;
  applyLink?: string | null;
}

export interface ExpandableJobCardProps {
  job: JobShape;
  adminActions?: React.ReactNode;
  showApply?: boolean;
}

export function ExpandableJobCard({
  job,
  adminActions,
  showApply = true,
}: ExpandableJobCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [, navigate] = useLocation();

  const categoryInfo = getCategoryInfo(job.category);
  const IconComponent = categoryInfo.icon;
  const timeAgo = getTimeAgo(job.createdAt);
  const badges = getJobBadges(job);
  const skills = job.skillTags || [];

  function handleApply(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/jobs/${job.id}/apply`);
  }

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
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <h3 className="text-xl font-bold text-white leading-tight truncate">
                    {job.title}
                  </h3>
                  {/* Badges in the header */}
                  {badges.map((b) => (
                    <span
                      key={b.key}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.className}`}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-blue-100 font-medium text-sm">
                    {getPublicCompanyName(job)}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-300 flex-shrink-0" />
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-300 fill-current" />
                    <span className="text-blue-100 text-xs">4.9</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${getJobTypeColor(job.contractType)}`}
                  >
                    {formatContractType(job.contractType)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Stat bar: Contract | Location | Posted */}
          <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
            <div className="flex items-center gap-2 px-4 py-3">
              <Briefcase className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Contract
                </div>
                <div className="text-sm font-semibold truncate">
                  {formatContractType(job.contractType)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
              <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Location
                </div>
                <div className="text-sm font-semibold truncate">
                  {job.location || "Remote"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
              <CalendarDays className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Posted
                </div>
                <div className="text-sm font-semibold truncate">{timeAgo}</div>
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
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-xs h-auto whitespace-normal break-words"
                  >
                    {skill}
                  </Badge>
                ))}
                {skills.length > 5 && (
                  <Badge
                    variant="outline"
                    className="text-xs h-auto whitespace-normal break-words"
                  >
                    +{skills.length - 5} more
                  </Badge>
                )}
              </div>
            )}

            {/* Action row */}
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalOpen(true);
                  }}
                >
                  View Details
                </Button>
                {showApply && (
                  <Button size="sm" onClick={handleApply}>
                    Apply Now
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
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
