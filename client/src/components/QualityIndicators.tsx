import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Star, 
  Award, 
  Trophy, 
  Target, 
  TrendingUp,
  CheckCircle2,
  Users,
  Clock,
  ThumbsUp,
  Zap,
  Crown,
  Medal
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface QualityBadgeProps {
  variant: "top-rated" | "featured" | "premium" | "verified" | "rising" | "expert" | "pro" | "elite";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function QualityBadge({ 
  variant, 
  size = "md", 
  showLabel = true,
  className 
}: QualityBadgeProps) {
  const getQualityConfig = () => {
    switch (variant) {
      case "top-rated":
        return {
          icon: Star,
          label: "Top Rated",
          bgColor: "bg-yellow-500/10 dark:bg-yellow-500/20",
          textColor: "text-yellow-700 dark:text-yellow-400",
          borderColor: "border-yellow-200 dark:border-yellow-500/30",
          iconColor: "text-yellow-600 dark:text-yellow-400"
        };
      case "featured":
        return {
          icon: Award,
          label: "Featured",
          bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
          textColor: "text-purple-700 dark:text-purple-400",
          borderColor: "border-purple-200 dark:border-purple-500/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        };
      case "premium":
        return {
          icon: Crown,
          label: "Premium",
          bgColor: "bg-gold-yellow/10 dark:bg-gold-yellow/20",
          textColor: "text-gold-yellow-foreground dark:text-gold-yellow",
          borderColor: "border-gold-yellow/30 dark:border-gold-yellow/30",
          iconColor: "text-gold-yellow dark:text-gold-yellow"
        };
      case "verified":
        return {
          icon: CheckCircle2,
          label: "Verified Pro",
          bgColor: "bg-green-500/10 dark:bg-green-500/20",
          textColor: "text-green-700 dark:text-green-400",
          borderColor: "border-green-200 dark:border-green-500/30",
          iconColor: "text-green-600 dark:text-green-400"
        };
      case "rising":
        return {
          icon: TrendingUp,
          label: "Rising Talent",
          bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
          textColor: "text-blue-700 dark:text-blue-400",
          borderColor: "border-blue-200 dark:border-blue-500/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        };
      case "expert":
        return {
          icon: Target,
          label: "Expert Level",
          bgColor: "bg-red-500/10 dark:bg-red-500/20",
          textColor: "text-red-700 dark:text-red-400",
          borderColor: "border-red-200 dark:border-red-500/30",
          iconColor: "text-red-600 dark:text-red-400"
        };
      case "pro":
        return {
          icon: Medal,
          label: "OnSpot Pro",
          bgColor: "bg-indigo-500/10 dark:bg-indigo-500/20",
          textColor: "text-indigo-700 dark:text-indigo-400",
          borderColor: "border-indigo-200 dark:border-indigo-500/30",
          iconColor: "text-indigo-600 dark:text-indigo-400"
        };
      case "elite":
        return {
          icon: Trophy,
          label: "Elite Talent",
          bgColor: "bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20",
          textColor: "text-purple-700 dark:text-purple-400",
          borderColor: "border-purple-200 dark:border-purple-500/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        };
      default:
        return {
          icon: CheckCircle2,
          label: "Quality",
          bgColor: "bg-muted/20",
          textColor: "text-muted-foreground",
          borderColor: "border-muted",
          iconColor: "text-muted-foreground"
        };
    }
  };

  const config = getQualityConfig();
  const IconComponent = config.icon;

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return {
          badge: "px-2 py-1 text-xs gap-1",
          icon: "h-3 w-3"
        };
      case "lg":
        return {
          badge: "px-4 py-2 text-sm gap-2",
          icon: "h-5 w-5"
        };
      default:
        return {
          badge: "px-3 py-1.5 text-sm gap-1.5",
          icon: "h-4 w-4"
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center font-medium border rounded-full transition-all duration-200",
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses.badge,
        variant === "elite" && "animate-onspot-pulse",
        className
      )}
      data-testid={`badge-quality-${variant}`}
    >
      <IconComponent className={cn(sizeClasses.icon, config.iconColor)} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

export interface QualityScoreProps {
  score: number;
  maxScore?: number;
  label?: string;
  category?: string;
  showBreakdown?: boolean;
  breakdown?: {
    communication: number;
    quality: number;
    timeliness: number;
    professionalism: number;
  };
  className?: string;
}

export function QualityScore({ 
  score, 
  maxScore = 100, 
  label = "Quality Score",
  category,
  showBreakdown = false,
  breakdown,
  className 
}: QualityScoreProps) {
  const getScoreColor = () => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return "text-green-600 dark:text-green-400";
    if (percentage >= 80) return "text-blue-600 dark:text-blue-400";
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (percentage >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreLabel = () => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 95) return "Exceptional";
    if (percentage >= 90) return "Excellent";
    if (percentage >= 80) return "Very Good";
    if (percentage >= 70) return "Good";
    if (percentage >= 60) return "Satisfactory";
    return "Needs Improvement";
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{label}</h3>
          {category && (
            <p className="text-sm text-muted-foreground">{category}</p>
          )}
        </div>
        <div className="text-right">
          <div className={cn("text-3xl font-bold", getScoreColor())}>
            {score}
          </div>
          <div className="text-sm text-muted-foreground">
            {getScoreLabel()}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Progress value={(score / maxScore) * 100} className="h-3" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>{maxScore}</span>
        </div>
      </div>

      {showBreakdown && breakdown && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Score Breakdown</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Communication</span>
                <span className="font-medium">{breakdown.communication}%</span>
              </div>
              <Progress value={breakdown.communication} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Quality</span>
                <span className="font-medium">{breakdown.quality}%</span>
              </div>
              <Progress value={breakdown.quality} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Timeliness</span>
                <span className="font-medium">{breakdown.timeliness}%</span>
              </div>
              <Progress value={breakdown.timeliness} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Professionalism</span>
                <span className="font-medium">{breakdown.professionalism}%</span>
              </div>
              <Progress value={breakdown.professionalism} className="h-2" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface QualityStatsProps {
  stats: {
    totalProjects?: number;
    successRate?: number;
    avgRating?: number;
    onTimeDelivery?: number;
    clientSatisfaction?: number;
    repeatClients?: number;
  };
  compact?: boolean;
  className?: string;
}

export function QualityStats({ stats, compact = false, className }: QualityStatsProps) {
  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  const formatRating = (value: number) => value.toFixed(1);

  if (compact) {
    return (
      <div className={cn("grid grid-cols-3 gap-4 text-center", className)}>
        {stats.successRate && (
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatPercentage(stats.successRate)}
            </div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </div>
        )}
        {stats.avgRating && (
          <div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatRating(stats.avgRating)}
            </div>
            <div className="text-xs text-muted-foreground">Avg Rating</div>
          </div>
        )}
        {stats.onTimeDelivery && (
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatPercentage(stats.onTimeDelivery)}
            </div>
            <div className="text-xs text-muted-foreground">On Time</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold-yellow" />
          Quality Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.totalProjects && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-shrink-0 p-2 bg-blue-500/10 rounded-full">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-blue-700 dark:text-blue-400">
                  {stats.totalProjects.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Projects Completed</div>
              </div>
            </div>
          )}

          {stats.successRate && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-shrink-0 p-2 bg-green-500/10 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-semibold text-green-700 dark:text-green-400">
                  {formatPercentage(stats.successRate)}
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          )}

          {stats.avgRating && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-shrink-0 p-2 bg-yellow-500/10 rounded-full">
                <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <div className="font-semibold text-yellow-700 dark:text-yellow-400">
                  {formatRating(stats.avgRating)} / 5.0
                </div>
                <div className="text-sm text-muted-foreground">Average Rating</div>
              </div>
            </div>
          )}

          {stats.onTimeDelivery && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-shrink-0 p-2 bg-blue-500/10 rounded-full">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-blue-700 dark:text-blue-400">
                  {formatPercentage(stats.onTimeDelivery)}
                </div>
                <div className="text-sm text-muted-foreground">On-Time Delivery</div>
              </div>
            </div>
          )}

          {stats.clientSatisfaction && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-shrink-0 p-2 bg-purple-500/10 rounded-full">
                <ThumbsUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-semibold text-purple-700 dark:text-purple-400">
                  {formatPercentage(stats.clientSatisfaction)}
                </div>
                <div className="text-sm text-muted-foreground">Client Satisfaction</div>
              </div>
            </div>
          )}

          {stats.repeatClients && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-shrink-0 p-2 bg-green-500/10 rounded-full">
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-semibold text-green-700 dark:text-green-400">
                  {formatPercentage(stats.repeatClients)}
                </div>
                <div className="text-sm text-muted-foreground">Repeat Clients</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface QualityBadgeClusterProps {
  badges: QualityBadgeProps["variant"][];
  size?: "sm" | "md" | "lg";
  maxVisible?: number;
  className?: string;
}

export function QualityBadgeCluster({ 
  badges, 
  size = "sm", 
  maxVisible = 3,
  className 
}: QualityBadgeClusterProps) {
  const visibleBadges = badges.slice(0, maxVisible);
  const hiddenCount = badges.length - maxVisible;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {visibleBadges.map((badge, index) => (
        <QualityBadge key={`${badge}-${index}`} variant={badge} size={size} />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="px-2 py-1 text-xs">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}