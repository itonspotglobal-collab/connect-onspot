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
} from "lucide-react";

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
      return "bg-green-100 text-green-800";
    case "part-time":
      return "bg-blue-100 text-blue-800";
    case "contract":
      return "bg-purple-100 text-purple-800";
    case "freelance":
      return "bg-orange-100 text-orange-800";
    case "hourly":
      return "bg-green-100 text-green-800";
    case "fixed":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
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
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-lg ${categoryInfo.color} flex items-center justify-center`}
              >
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                  {job.title}
                </h3>
                <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                  <span className="font-medium">{job.company || "OnSpot"}</span>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-[hsl(var(--gold-yellow))] fill-current" />
                    <span className="text-sm">4.9</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{job.location || "Remote"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{postedAtText}</span>
              </div>
            </div>

            <p className="text-muted-foreground mb-4 line-clamp-2">
              {job.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
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

          <div className="flex flex-col items-end gap-3 ml-6">
            {expanded && (
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {rateDisplay}
                </div>
                <div className="text-sm text-muted-foreground">{rateLabel}</div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <ChevronDown
                className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[800px] opacity-100 mt-4 pt-4 border-t" : "max-h-0 opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Job Description</h4>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {job.description}
              </p>
            </div>

            {responsibilities.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Responsibilities</h4>
                <ul className="text-muted-foreground text-sm list-disc list-inside space-y-1">
                  {responsibilities.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Skills Needed</h4>
                <ul className="text-muted-foreground text-sm list-disc list-inside space-y-1">
                  {requirements.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">Experience Level</h4>
              <p className="text-muted-foreground text-sm">
                {formatExperienceLevel(job.experienceLevel)}
              </p>
            </div>

            <div className="pt-4 flex items-center gap-3 flex-wrap">
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
                </>
              )}
              {adminActions}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
