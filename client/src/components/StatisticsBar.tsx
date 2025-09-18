import { useState, useEffect } from "react";
import { 
  Users,
  Star,
  DollarSign,
  HeadphonesIcon,
  TrendingUp,
  Shield,
  Award,
  Globe,
  Clock,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatisticItem {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  description?: string;
}

// Default marketplace statistics
export const DEFAULT_MARKETPLACE_STATS: StatisticItem[] = [
  { 
    value: "50,000+", 
    label: "Elite Talents", 
    icon: Users, 
    color: "text-blue-600 dark:text-blue-400",
    description: "Verified professionals worldwide"
  },
  { 
    value: "98%", 
    label: "Client Satisfaction", 
    icon: Star, 
    color: "text-yellow-600 dark:text-yellow-400",
    description: "Average client rating"
  },
  { 
    value: "$2M+", 
    label: "Paid Out", 
    icon: DollarSign, 
    color: "text-green-600 dark:text-green-400",
    description: "Total earnings by talents"
  },
  { 
    value: "24/7", 
    label: "Support", 
    icon: HeadphonesIcon, 
    color: "text-purple-600 dark:text-purple-400",
    description: "Dedicated success managers"
  }
];

export interface StatisticsBarProps {
  statistics?: StatisticItem[];
  variant?: "default" | "compact" | "featured";
  columns?: 2 | 3 | 4;
  showDescriptions?: boolean;
  className?: string;
  animateOnScroll?: boolean;
}

export function StatisticsBar({
  statistics = DEFAULT_MARKETPLACE_STATS,
  variant = "default",
  columns = 4,
  showDescriptions = false,
  className,
  animateOnScroll = false
}: StatisticsBarProps) {
  const getGridCols = () => {
    switch (columns) {
      case 2: return "grid-cols-2";
      case 3: return "grid-cols-1 md:grid-cols-3";
      case 4: return "grid-cols-2 md:grid-cols-4";
      default: return "grid-cols-2 md:grid-cols-4";
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case "compact":
        return {
          container: "py-8",
          stat: "text-center group space-y-2",
          icon: "h-8 w-8 mx-auto mb-1",
          value: "text-2xl font-bold text-foreground",
          label: "text-sm text-muted-foreground font-medium",
          description: "text-xs text-muted-foreground/80"
        };
      case "featured":
        return {
          container: "py-16",
          stat: "text-center group space-y-4 p-6 rounded-lg hover-elevate",
          icon: "h-16 w-16 mx-auto mb-3 p-3 bg-background rounded-lg shadow-sm",
          value: "text-4xl md:text-5xl font-bold text-foreground mb-2",
          label: "text-base text-muted-foreground font-semibold",
          description: "text-sm text-muted-foreground/80 leading-relaxed"
        };
      default:
        return {
          container: "py-12",
          stat: "text-center group space-y-3",
          icon: "h-12 w-12 mx-auto mb-2",
          value: "text-3xl md:text-4xl font-bold text-foreground mb-2",
          label: "text-sm text-muted-foreground font-medium",
          description: "text-xs text-muted-foreground/80"
        };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <div className={cn(variantClasses.container, className)}>
      <div className={cn("grid gap-6 md:gap-8", getGridCols())}>
        {statistics.map((stat, index) => (
          <div 
            key={index} 
            className={cn(
              variantClasses.stat,
              animateOnScroll && "opacity-0 translate-y-4 transition-all duration-700 delay-100"
            )}
            style={{ 
              animationDelay: animateOnScroll ? `${index * 150}ms` : undefined 
            }}
            data-testid={`statistic-${index}`}
          >
            <div className="mb-4">
              <stat.icon 
                className={cn(
                  variantClasses.icon,
                  stat.color || "text-primary"
                )} 
              />
            </div>
            <div className={variantClasses.value}>
              {stat.value}
            </div>
            <div className={variantClasses.label}>
              {stat.label}
            </div>
            {showDescriptions && stat.description && (
              <div className={variantClasses.description}>
                {stat.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface InlineStatisticsProps {
  statistics?: StatisticItem[];
  separator?: string;
  className?: string;
}

// Compact inline version for headers/footers
export function InlineStatistics({
  statistics = DEFAULT_MARKETPLACE_STATS.slice(0, 3),
  separator = "•",
  className
}: InlineStatisticsProps) {
  return (
    <div className={cn("flex items-center gap-4 text-sm", className)} data-testid="inline-statistics">
      {statistics.map((stat, index) => (
        <div key={index} className="flex items-center gap-2">
          <stat.icon className={cn("h-4 w-4", stat.color || "text-primary")} />
          <span className="font-semibold text-foreground">{stat.value}</span>
          <span className="text-muted-foreground">{stat.label}</span>
          {index < statistics.length - 1 && (
            <span className="text-muted-foreground/50 ml-2">{separator}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Animated counter hook (optional enhancement)
export function useAnimatedCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration]);
  
  return count;
}