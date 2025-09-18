import { 
  Crown,
  TrendingUp,
  Award,
  Globe,
  Shield,
  Users,
  Zap,
  Target,
  Star,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PremiumFeature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  highlight: string;
  benefits?: string[];
  ctaText?: string;
  featured?: boolean;
}

// Default premium features that differentiate from competitors
export const DEFAULT_PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: Crown,
    title: "Premium Client Network",
    description: "Work exclusively with Fortune 500 companies and funded startups",
    highlight: "Average project value: $15K+",
    benefits: [
      "Verified enterprise clients only",
      "Pre-funded project budgets",
      "Long-term partnership opportunities",
      "Direct access to decision makers"
    ],
    ctaText: "View Premium Clients",
    featured: true
  },
  {
    icon: TrendingUp,
    title: "Higher Earning Potential",
    description: "Earn 70% more than traditional freelancing platforms",
    highlight: "Top talents: $150/hour",
    benefits: [
      "Premium rate negotiations",
      "Performance-based bonuses",
      "Exclusive high-value projects",
      "No platform fee caps"
    ],
    ctaText: "Calculate Earnings"
  },
  {
    icon: Award,
    title: "Career Growth Support",
    description: "Professional development, skill certification, and mentorship",
    highlight: "Free upskilling programs",
    benefits: [
      "Industry certification programs",
      "1-on-1 career mentorship",
      "Skill development workshops",
      "Professional networking events"
    ],
    ctaText: "Explore Programs"
  },
  {
    icon: Globe,
    title: "Global Opportunities",
    description: "Access to international projects with remote-first companies",
    highlight: "150+ countries served",
    benefits: [
      "Multi-currency payments",
      "Timezone-flexible projects",
      "Cultural diversity programs",
      "International tax support"
    ],
    ctaText: "See Global Projects",
    featured: true
  }
];

export interface PremiumFeaturesProps {
  features?: PremiumFeature[];
  variant?: "grid" | "list" | "carousel" | "comparison";
  columns?: 2 | 3 | 4;
  showBenefits?: boolean;
  showCTAs?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  sectionBadge?: string;
}

export function PremiumFeatures({
  features = DEFAULT_PREMIUM_FEATURES,
  variant = "grid",
  columns = 2,
  showBenefits = false,
  showCTAs = false,
  className,
  title = "Why OnSpot Beats the Competition",
  subtitle = "Experience the difference of a truly premium talent marketplace",
  sectionBadge = "Premium Marketplace"
}: PremiumFeaturesProps) {
  
  const getGridCols = () => {
    switch (columns) {
      case 3: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      case 4: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
      default: return "grid-cols-1 md:grid-cols-2";
    }
  };

  if (variant === "comparison") {
    return (
      <section className={cn("py-20", className)} data-testid="premium-features-comparison">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Crown className="h-3 w-3 mr-1" />
              {sectionBadge}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {subtitle}
            </p>
          </div>

          {/* Comparison Table */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* OnSpot Column */}
              <div className="space-y-6">
                <div className="text-center">
                  <Badge className="bg-primary text-primary-foreground mb-4">
                    <Crown className="h-3 w-3 mr-1" />
                    OnSpot Premium
                  </Badge>
                  <div className="text-2xl font-bold text-foreground">The Elite Choice</div>
                </div>
                
                {features.map((feature, index) => (
                  <Card key={index} className="p-6 border-2 border-primary/20 hover-elevate">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {feature.highlight}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Competitor 1 */}
              <div className="space-y-6 opacity-60">
                <div className="text-center">
                  <div className="h-7 mb-4"></div>
                  <div className="text-2xl font-bold text-muted-foreground">Traditional Platforms</div>
                </div>
                
                <Card className="p-6 border-muted">
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">❌ Mixed client quality</div>
                    <div className="text-sm text-muted-foreground">❌ Race-to-the-bottom pricing</div>
                    <div className="text-sm text-muted-foreground">❌ High platform fees (20%+)</div>
                    <div className="text-sm text-muted-foreground">❌ Limited support</div>
                  </div>
                </Card>
              </div>

              {/* Competitor 2 */}
              <div className="space-y-6 opacity-60">
                <div className="text-center">
                  <div className="h-7 mb-4"></div>
                  <div className="text-2xl font-bold text-muted-foreground">Agency Models</div>
                </div>
                
                <Card className="p-6 border-muted">
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">❌ Limited project variety</div>
                    <div className="text-sm text-muted-foreground">❌ No direct client relationships</div>
                    <div className="text-sm text-muted-foreground">❌ Restricted earning potential</div>
                    <div className="text-sm text-muted-foreground">❌ Lengthy payment cycles</div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "list") {
    return (
      <section className={cn("py-20", className)} data-testid="premium-features-list">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-6 p-6 rounded-lg hover-elevate group">
                <div className={cn(
                  "w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0",
                  feature.featured ? "bg-gradient-to-br from-primary to-purple-600" : "bg-muted"
                )}>
                  <feature.icon className={cn(
                    "h-8 w-8",
                    feature.featured ? "text-white" : "text-primary"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                    {feature.featured && (
                      <Badge className="bg-primary text-primary-foreground">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    {feature.description}
                  </p>
                  <Badge variant="outline" className="mb-4 bg-green-500/10 text-green-700 dark:text-green-400">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {feature.highlight}
                  </Badge>
                  
                  {showBenefits && feature.benefits && (
                    <div className="grid md:grid-cols-2 gap-2 mt-4">
                      {feature.benefits.map((benefit, benefitIndex) => (
                        <div key={benefitIndex} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-muted-foreground">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showCTAs && feature.ctaText && (
                    <Button 
                      variant="ghost" 
                      className="mt-4 group-hover:bg-primary/5"
                      data-testid={`feature-cta-${index}`}
                    >
                      {feature.ctaText}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default grid variant
  return (
    <section className={cn("py-20", className)} data-testid="premium-features-grid">
      <div className="container mx-auto px-4">
        {/* Header */}
        {(title || subtitle || sectionBadge) && (
          <div className="text-center mb-16">
            {sectionBadge && (
              <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/20">
                <Crown className="h-3 w-3 mr-1" />
                {sectionBadge}
              </Badge>
            )}
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Features Grid */}
        <div className={cn("grid gap-8", getGridCols())}>
          {features.map((feature, index) => (
            <Card key={index} className={cn(
              "hover-elevate p-8 h-full",
              feature.featured && "border-2 border-primary/20 relative overflow-hidden"
            )}>
              {feature.featured && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
                  Featured
                </div>
              )}
              
              <CardContent className="p-0 space-y-4 h-full flex flex-col">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                    feature.featured 
                      ? "bg-gradient-to-br from-primary to-purple-600" 
                      : "bg-primary/10"
                  )}>
                    <feature.icon className={cn(
                      "h-6 w-6",
                      feature.featured ? "text-white" : "text-primary"
                    )} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-3">
                      {feature.description}
                    </p>
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {feature.highlight}
                    </Badge>
                  </div>
                </div>

                {showBenefits && feature.benefits && (
                  <div className="space-y-2 mt-4 flex-1">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <div key={benefitIndex} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-muted-foreground">{benefit}</span>
                      </div>
                    ))}
                  </div>
                )}

                {showCTAs && feature.ctaText && (
                  <div className="mt-6">
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      data-testid={`feature-cta-${index}`}
                    >
                      {feature.ctaText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface FeatureComparisonProps {
  onSpotFeatures: string[];
  competitorFeatures: string[];
  competitorName?: string;
  className?: string;
}

// Simplified comparison component
export function FeatureComparison({
  onSpotFeatures,
  competitorFeatures,
  competitorName = "Other Platforms",
  className
}: FeatureComparisonProps) {
  return (
    <div className={cn("grid md:grid-cols-2 gap-8", className)} data-testid="feature-comparison">
      {/* OnSpot */}
      <Card className="p-6 border-2 border-primary/20">
        <div className="text-center mb-6">
          <Badge className="bg-primary text-primary-foreground">
            <Crown className="h-3 w-3 mr-1" />
            OnSpot
          </Badge>
        </div>
        <div className="space-y-3">
          {onSpotFeatures.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Competitor */}
      <Card className="p-6 border-muted opacity-75">
        <div className="text-center mb-6">
          <Badge variant="outline">
            {competitorName}
          </Badge>
        </div>
        <div className="space-y-3">
          {competitorFeatures.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-red-500 text-sm">❌</span>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}