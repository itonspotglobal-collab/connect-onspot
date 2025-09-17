import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  CheckCircle2, 
  Star, 
  Crown, 
  Verified,
  DollarSign,
  Lock,
  Award,
  Clock,
  FileCheck,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrustBadgeProps {
  variant?: "verified" | "payment-protected" | "premium" | "quality" | "security" | "featured";
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
  animate?: boolean;
}

export function TrustBadge({ 
  variant = "verified", 
  size = "md", 
  showIcon = true, 
  showLabel = true,
  className,
  animate = false
}: TrustBadgeProps) {
  const getBadgeConfig = () => {
    switch (variant) {
      case "verified":
        return {
          icon: CheckCircle2,
          label: "OnSpot Verified",
          bgColor: "bg-green-500/10 dark:bg-green-500/20",
          textColor: "text-green-700 dark:text-green-400",
          borderColor: "border-green-200 dark:border-green-500/30",
          iconColor: "text-green-600 dark:text-green-400"
        };
      case "payment-protected":
        return {
          icon: Shield,
          label: "Payment Protected",
          bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
          textColor: "text-blue-700 dark:text-blue-400",
          borderColor: "border-blue-200 dark:border-blue-500/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        };
      case "premium":
        return {
          icon: Crown,
          label: "Premium Client",
          bgColor: "bg-gold-yellow/10 dark:bg-gold-yellow/20",
          textColor: "text-gold-yellow-foreground dark:text-gold-yellow",
          borderColor: "border-gold-yellow/30 dark:border-gold-yellow/30",
          iconColor: "text-gold-yellow dark:text-gold-yellow"
        };
      case "quality":
        return {
          icon: Star,
          label: "Top Rated",
          bgColor: "bg-yellow-500/10 dark:bg-yellow-500/20",
          textColor: "text-yellow-700 dark:text-yellow-400",
          borderColor: "border-yellow-200 dark:border-yellow-500/30",
          iconColor: "text-yellow-600 dark:text-yellow-400"
        };
      case "security":
        return {
          icon: Lock,
          label: "Secure",
          bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
          textColor: "text-purple-700 dark:text-purple-400",
          borderColor: "border-purple-200 dark:border-purple-500/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        };
      case "featured":
        return {
          icon: Award,
          label: "Featured",
          bgColor: "bg-orange-500/10 dark:bg-orange-500/20",
          textColor: "text-orange-700 dark:text-orange-400",
          borderColor: "border-orange-200 dark:border-orange-500/30",
          iconColor: "text-orange-600 dark:text-orange-400"
        };
      default:
        return {
          icon: CheckCircle2,
          label: "Verified",
          bgColor: "bg-muted/20",
          textColor: "text-muted-foreground",
          borderColor: "border-muted",
          iconColor: "text-muted-foreground"
        };
    }
  };

  const config = getBadgeConfig();
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
        animate && "animate-onspot-pulse",
        className
      )}
      data-testid={`badge-${variant}`}
    >
      {showIcon && (
        <IconComponent className={cn(sizeClasses.icon, config.iconColor)} />
      )}
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

export interface ClientVerificationBadgeProps {
  verificationLevel?: "basic" | "business" | "enterprise";
  companyName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ClientVerificationBadge({ 
  verificationLevel = "basic", 
  companyName,
  size = "md",
  className 
}: ClientVerificationBadgeProps) {
  const getVerificationConfig = () => {
    switch (verificationLevel) {
      case "enterprise":
        return {
          icon: Crown,
          label: "Enterprise Verified",
          bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
          textColor: "text-purple-700 dark:text-purple-400",
          borderColor: "border-purple-200 dark:border-purple-500/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        };
      case "business":
        return {
          icon: FileCheck,
          label: "Business Verified",
          bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
          textColor: "text-blue-700 dark:text-blue-400",
          borderColor: "border-blue-200 dark:border-blue-500/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        };
      default:
        return {
          icon: Verified,
          label: "Identity Verified",
          bgColor: "bg-green-500/10 dark:bg-green-500/20",
          textColor: "text-green-700 dark:text-green-400",
          borderColor: "border-green-200 dark:border-green-500/30",
          iconColor: "text-green-600 dark:text-green-400"
        };
    }
  };

  const config = getVerificationConfig();
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
        className
      )}
      data-testid={`badge-client-${verificationLevel}`}
    >
      <IconComponent className={cn(sizeClasses.icon, config.iconColor)} />
      <span>{companyName ? `${companyName} • ${config.label}` : config.label}</span>
    </Badge>
  );
}

export interface TrustScoreProps {
  score: number;
  maxScore?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showStars?: boolean;
  className?: string;
}

export function TrustScore({ 
  score, 
  maxScore = 5, 
  label = "Trust Score",
  size = "md",
  showStars = true,
  className 
}: TrustScoreProps) {
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return {
          container: "gap-2",
          text: "text-sm",
          stars: "gap-0.5",
          star: "h-3 w-3"
        };
      case "lg":
        return {
          container: "gap-3",
          text: "text-lg font-semibold",
          stars: "gap-1",
          star: "h-5 w-5"
        };
      default:
        return {
          container: "gap-2",
          text: "text-base font-medium",
          stars: "gap-0.5",
          star: "h-4 w-4"
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const fullStars = Math.floor(score);
  const hasHalfStar = score % 1 >= 0.5;
  const emptyStars = maxScore - Math.ceil(score);

  return (
    <div className={cn("flex items-center", sizeClasses.container, className)} data-testid="trust-score">
      {showStars && (
        <div className={cn("flex items-center", sizeClasses.stars)}>
          {/* Full stars */}
          {Array.from({ length: fullStars }).map((_, i) => (
            <Star key={`full-${i}`} className={cn(sizeClasses.star, "fill-yellow-400 text-yellow-400")} />
          ))}
          
          {/* Half star */}
          {hasHalfStar && (
            <div className="relative">
              <Star className={cn(sizeClasses.star, "text-gray-300 dark:text-gray-600")} />
              <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                <Star className={cn(sizeClasses.star, "fill-yellow-400 text-yellow-400")} />
              </div>
            </div>
          )}
          
          {/* Empty stars */}
          {Array.from({ length: emptyStars }).map((_, i) => (
            <Star key={`empty-${i}`} className={cn(sizeClasses.star, "text-gray-300 dark:text-gray-600")} />
          ))}
        </div>
      )}
      
      <div className="flex items-center gap-1">
        <span className={cn(sizeClasses.text, "text-foreground")}>{score.toFixed(1)}</span>
        <span className="text-muted-foreground">({label})</span>
      </div>
    </div>
  );
}

export interface QuickTrustIndicatorsProps {
  showPaymentProtected?: boolean;
  showVerified?: boolean;
  showTopRated?: boolean;
  showFeatured?: boolean;
  size?: "sm" | "md" | "lg";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function QuickTrustIndicators({
  showPaymentProtected = true,
  showVerified = true,
  showTopRated = false,
  showFeatured = false,
  size = "sm",
  orientation = "horizontal",
  className
}: QuickTrustIndicatorsProps) {
  const badges = [];

  if (showVerified) {
    badges.push(<TrustBadge key="verified" variant="verified" size={size} showLabel={false} />);
  }
  if (showPaymentProtected) {
    badges.push(<TrustBadge key="payment" variant="payment-protected" size={size} showLabel={false} />);
  }
  if (showTopRated) {
    badges.push(<TrustBadge key="quality" variant="quality" size={size} showLabel={false} />);
  }
  if (showFeatured) {
    badges.push(<TrustBadge key="featured" variant="featured" size={size} showLabel={false} />);
  }

  if (badges.length === 0) return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-1",
        orientation === "vertical" && "flex-col items-start",
        className
      )}
      data-testid="quick-trust-indicators"
    >
      {badges}
    </div>
  );
}