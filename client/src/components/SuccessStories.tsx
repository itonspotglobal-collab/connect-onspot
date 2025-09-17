import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Users, 
  Star,
  Target,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Calendar,
  Trophy,
  Zap,
  Award,
  MapPin,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustBadge, ClientVerificationBadge } from "@/components/TrustBadges";
import { QualityScore } from "@/components/QualityIndicators";

export interface SuccessStory {
  id: string;
  title: string;
  client: {
    name: string;
    role: string;
    company: string;
    avatar?: string;
    location?: string;
    verificationLevel?: "basic" | "business" | "enterprise";
  };
  challenge: string;
  solution: string;
  outcome: string;
  metrics: {
    costSaved?: number;
    timeReduced?: number;
    qualityImprovement?: number;
    teamSize?: number;
    projectDuration?: string;
    roi?: number;
  };
  technologies?: string[];
  category: "development" | "design" | "marketing" | "support" | "content";
  featured?: boolean;
  testimonialQuote: string;
  rating: number;
  projectValue: number;
  completedDate: string;
  beforeAfter?: {
    before: string;
    after: string;
  };
}

const defaultSuccessStories: SuccessStory[] = [
  {
    id: "1",
    title: "Scaling Development Team by 300% in 30 Days",
    client: {
      name: "Sarah Mitchell",
      role: "VP of Engineering",
      company: "TechForward Solutions",
      avatar: "/api/placeholder/60/60",
      location: "San Francisco, CA",
      verificationLevel: "business"
    },
    challenge: "TechForward needed to rapidly scale their development team to meet aggressive product launch deadlines. Traditional hiring was too slow and expensive.",
    solution: "OnSpot provided 6 vetted full-stack developers within 48 hours, all with React and Node.js expertise matching their exact requirements.",
    outcome: "Successfully launched 3 products on schedule, reduced hiring costs by 65%, and established a scalable remote development process.",
    metrics: {
      costSaved: 65,
      timeReduced: 80,
      qualityImprovement: 95,
      teamSize: 6,
      projectDuration: "3 months",
      roi: 340
    },
    technologies: ["React", "Node.js", "TypeScript", "AWS", "PostgreSQL"],
    category: "development",
    featured: true,
    testimonialQuote: "OnSpot transformed our hiring process completely. We found exceptional developers within 24 hours, and the payment protection gave us complete peace of mind.",
    rating: 5,
    projectValue: 180000,
    completedDate: "2024-02-15",
    beforeAfter: {
      before: "3-month hiring process, 40% developer productivity",
      after: "48-hour team scaling, 95% developer productivity"
    }
  },
  {
    id: "2",
    title: "Building World-Class Data Science Team",
    client: {
      name: "Michael Chen",
      role: "Chief Data Officer",
      company: "DataDrive Analytics",
      avatar: "/api/placeholder/60/60",
      location: "New York, NY",
      verificationLevel: "enterprise"
    },
    challenge: "DataDrive needed specialized data scientists with ML expertise but struggled to find qualified candidates in their local market.",
    solution: "OnSpot connected them with 4 senior data scientists from the Philippines with proven ML and AI experience, all verified and payment-protected.",
    outcome: "Built a complete data science team, reduced operational costs by 70%, and accelerated their AI product development by 6 months.",
    metrics: {
      costSaved: 70,
      timeReduced: 75,
      qualityImprovement: 98,
      teamSize: 4,
      projectDuration: "6 months",
      roi: 420
    },
    technologies: ["Python", "TensorFlow", "Pandas", "AWS SageMaker", "Docker"],
    category: "development",
    featured: true,
    testimonialQuote: "The verification process at OnSpot is incredibly thorough. We've hired 4 professionals through the platform, and every single one exceeded expectations.",
    rating: 5,
    projectValue: 240000,
    completedDate: "2024-01-28",
    beforeAfter: {
      before: "6-month search, $200K+ local hiring costs",
      after: "2-week team assembly, 70% cost reduction"
    }
  },
  {
    id: "3",
    title: "Marketing Automation Revolution",
    client: {
      name: "Emily Rodriguez",
      role: "Marketing Director",
      company: "GrowthMax Agency",
      avatar: "/api/placeholder/60/60",
      location: "Austin, TX",
      verificationLevel: "business"
    },
    challenge: "GrowthMax needed marketing automation expertise to modernize their client campaigns but couldn't afford senior-level talent locally.",
    solution: "OnSpot matched them with a certified marketing automation specialist who redesigned their entire campaign infrastructure.",
    outcome: "Improved campaign performance by 250%, reduced manual work by 80%, and increased client retention to 95%.",
    metrics: {
      costSaved: 60,
      timeReduced: 80,
      qualityImprovement: 92,
      teamSize: 1,
      projectDuration: "2 months",
      roi: 280
    },
    technologies: ["HubSpot", "Salesforce", "Google Analytics", "Facebook Ads", "Zapier"],
    category: "marketing",
    featured: false,
    testimonialQuote: "OnSpot's talent quality is exceptional. We needed a specialized marketing automation expert, and they delivered exactly what we needed.",
    rating: 5,
    projectValue: 45000,
    completedDate: "2024-02-08",
    beforeAfter: {
      before: "Manual campaigns, 15% conversion rate",
      after: "Automated workflows, 38% conversion rate"
    }
  },
  {
    id: "4",
    title: "E-commerce Platform Transformation",
    client: {
      name: "David Park",
      role: "CEO",
      company: "RetailTech Innovations",
      avatar: "/api/placeholder/60/60",
      location: "Seattle, WA",
      verificationLevel: "enterprise"
    },
    challenge: "RetailTech's legacy e-commerce platform was limiting growth and needed a complete rebuild with modern architecture.",
    solution: "OnSpot assembled a team of 5 specialists including React developers, backend engineers, and a DevOps expert to rebuild their platform.",
    outcome: "Launched new platform 40% faster than estimated, improved site performance by 300%, and increased conversion rates by 180%.",
    metrics: {
      costSaved: 55,
      timeReduced: 40,
      qualityImprovement: 96,
      teamSize: 5,
      projectDuration: "4 months",
      roi: 390
    },
    technologies: ["React", "Next.js", "Node.js", "MongoDB", "AWS", "Stripe"],
    category: "development",
    featured: true,
    testimonialQuote: "OnSpot delivered a world-class development team that exceeded all our expectations. The platform transformation was flawless.",
    rating: 5,
    projectValue: 320000,
    completedDate: "2024-01-15",
    beforeAfter: {
      before: "Legacy platform, 2.3% conversion rate",
      after: "Modern React platform, 6.4% conversion rate"
    }
  }
];

export interface SuccessStoriesProps {
  stories?: SuccessStory[];
  variant?: "grid" | "featured" | "detailed" | "carousel";
  maxStories?: number;
  showMetrics?: boolean;
  filterBy?: "development" | "design" | "marketing" | "support" | "content" | "all";
  className?: string;
}

export function SuccessStories({
  stories = defaultSuccessStories,
  variant = "grid",
  maxStories = 6,
  showMetrics = true,
  filterBy = "all",
  className
}: SuccessStoriesProps) {
  const filteredStories = stories
    .filter(story => filterBy === "all" || story.category === filterBy)
    .slice(0, maxStories);

  const getCategoryColor = (category: SuccessStory["category"]) => {
    switch (category) {
      case "development":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30";
      case "design":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30";
      case "marketing":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30";
      case "support":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-500/30";
    }
  };

  const getCategoryIcon = (category: SuccessStory["category"]) => {
    switch (category) {
      case "development":
        return <BarChart3 className="h-4 w-4" />;
      case "design":
        return <Target className="h-4 w-4" />;
      case "marketing":
        return <TrendingUp className="h-4 w-4" />;
      case "support":
        return <Users className="h-4 w-4" />;
      default:
        return <Award className="h-4 w-4" />;
    }
  };

  if (variant === "featured") {
    const featuredStory = filteredStories.find(story => story.featured) || filteredStories[0];
    if (!featuredStory) return null;

    return (
      <Card className={cn("border-2 border-dashed border-primary/30 bg-primary/5 dark:bg-primary/10", className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-gold-yellow" />
            <Badge variant="outline" className="bg-gold-yellow/10 text-gold-yellow-foreground border-gold-yellow/30">
              Featured Success Story
            </Badge>
          </div>
          <CardTitle className="text-2xl">{featuredStory.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={featuredStory.client.avatar} alt={featuredStory.client.name} />
              <AvatarFallback>
                {featuredStory.client.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-semibold text-lg">{featuredStory.client.name}</div>
              <div className="text-muted-foreground">
                {featuredStory.client.role} at {featuredStory.client.company}
              </div>
              {featuredStory.client.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {featuredStory.client.location}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                {featuredStory.client.verificationLevel && (
                  <ClientVerificationBadge 
                    verificationLevel={featuredStory.client.verificationLevel}
                    size="sm"
                  />
                )}
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{featuredStory.rating}.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          {showMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50/50 dark:bg-green-950/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {featuredStory.metrics.costSaved}%
                </div>
                <div className="text-sm text-green-700/80 dark:text-green-400/80">Cost Saved</div>
              </div>
              <div className="text-center p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {featuredStory.metrics.timeReduced}%
                </div>
                <div className="text-sm text-blue-700/80 dark:text-blue-400/80">Time Reduced</div>
              </div>
              <div className="text-center p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {featuredStory.metrics.roi}%
                </div>
                <div className="text-sm text-purple-700/80 dark:text-purple-400/80">ROI</div>
              </div>
              <div className="text-center p-4 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {featuredStory.metrics.teamSize}
                </div>
                <div className="text-sm text-yellow-700/80 dark:text-yellow-400/80">Team Size</div>
              </div>
            </div>
          )}

          {/* Testimonial quote */}
          <div className="bg-muted/20 rounded-lg p-6">
            <div className="text-4xl text-primary/60 mb-4">"</div>
            <blockquote className="text-lg italic leading-relaxed mb-4">
              {featuredStory.testimonialQuote}
            </blockquote>
            <div className="text-sm text-muted-foreground">
              — {featuredStory.client.name}, {featuredStory.client.role}
            </div>
          </div>

          {/* Technologies */}
          {featuredStory.technologies && (
            <div>
              <div className="text-sm font-medium mb-3">Technologies Used</div>
              <div className="flex flex-wrap gap-2">
                {featuredStory.technologies.map((tech) => (
                  <Badge key={tech} variant="secondary" className="text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("space-y-8", className)}>
        {filteredStories.map((story) => (
          <Card key={story.id} className="hover-elevate">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{story.title}</CardTitle>
                  <Badge variant="outline" className={cn("mb-4", getCategoryColor(story.category))}>
                    {getCategoryIcon(story.category)}
                    <span className="ml-1 capitalize">{story.category}</span>
                  </Badge>
                </div>
                {story.featured && (
                  <Badge variant="outline" className="bg-gold-yellow/10 text-gold-yellow-foreground border-gold-yellow/30">
                    Featured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={story.client.avatar} alt={story.client.name} />
                  <AvatarFallback>
                    {story.client.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{story.client.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {story.client.role} at {story.client.company}
                  </div>
                </div>
              </div>

              {/* Challenge, Solution, Outcome */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">Challenge</h4>
                  <p className="text-sm text-muted-foreground">{story.challenge}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Solution</h4>
                  <p className="text-sm text-muted-foreground">{story.solution}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Outcome</h4>
                  <p className="text-sm text-muted-foreground">{story.outcome}</p>
                </div>
              </div>

              {/* Metrics */}
              {showMetrics && (
                <div className="bg-muted/20 rounded-lg p-4">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                    {story.metrics.costSaved && (
                      <div>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">
                          {story.metrics.costSaved}%
                        </div>
                        <div className="text-xs text-muted-foreground">Cost Saved</div>
                      </div>
                    )}
                    {story.metrics.timeReduced && (
                      <div>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          {story.metrics.timeReduced}%
                        </div>
                        <div className="text-xs text-muted-foreground">Time Saved</div>
                      </div>
                    )}
                    {story.metrics.roi && (
                      <div>
                        <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                          {story.metrics.roi}%
                        </div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                      </div>
                    )}
                    {story.metrics.teamSize && (
                      <div>
                        <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                          {story.metrics.teamSize}
                        </div>
                        <div className="text-xs text-muted-foreground">Team Size</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        ${(story.projectValue / 1000).toFixed(0)}K
                      </div>
                      <div className="text-xs text-muted-foreground">Project Value</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                        {story.metrics.projectDuration}
                      </div>
                      <div className="text-xs text-muted-foreground">Duration</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quote */}
              <div className="border-l-4 border-primary/30 pl-4 bg-primary/5 dark:bg-primary/10 py-3">
                <p className="text-sm italic">"{story.testimonialQuote}"</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Default grid variant
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
      {filteredStories.map((story) => (
        <Card key={story.id} className="hover-elevate group">
          <CardHeader>
            <div className="flex items-start justify-between">
              <Badge variant="outline" className={cn("mb-2", getCategoryColor(story.category))}>
                {getCategoryIcon(story.category)}
                <span className="ml-1 capitalize">{story.category}</span>
              </Badge>
              {story.featured && (
                <Badge variant="outline" className="bg-gold-yellow/10 text-gold-yellow-foreground border-gold-yellow/30">
                  <Star className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg line-clamp-2">{story.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={story.client.avatar} alt={story.client.name} />
                <AvatarFallback className="text-xs">
                  {story.client.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-sm">{story.client.name}</div>
                <div className="text-xs text-muted-foreground">{story.client.company}</div>
              </div>
            </div>

            {/* Outcome preview */}
            <p className="text-sm text-muted-foreground line-clamp-3">{story.outcome}</p>

            {/* Key metrics */}
            {showMetrics && (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2 bg-green-50/50 dark:bg-green-950/20 rounded">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {story.metrics.costSaved}%
                  </div>
                  <div className="text-xs text-muted-foreground">Cost Saved</div>
                </div>
                <div className="p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {story.metrics.roi}%
                  </div>
                  <div className="text-xs text-muted-foreground">ROI</div>
                </div>
              </div>
            )}

            {/* Rating and project value */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{story.rating}.0</span>
              </div>
              <div className="text-sm text-muted-foreground">
                ${(story.projectValue / 1000).toFixed(0)}K project
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export interface SuccessMetricsProps {
  stories?: SuccessStory[];
  className?: string;
}

export function SuccessMetrics({ stories = defaultSuccessStories, className }: SuccessMetricsProps) {
  const totalProjects = stories.length;
  const avgCostSaved = Math.round(
    stories.reduce((sum, story) => sum + (story.metrics.costSaved || 0), 0) / totalProjects
  );
  const avgROI = Math.round(
    stories.reduce((sum, story) => sum + (story.metrics.roi || 0), 0) / totalProjects
  );
  const totalValue = stories.reduce((sum, story) => sum + story.projectValue, 0);
  const avgRating = stories.reduce((sum, story) => sum + story.rating, 0) / totalProjects;

  return (
    <Card className={cn("border-primary/20 bg-primary/5 dark:bg-primary/10", className)}>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Success Metrics Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary mb-1">
              {totalProjects}
            </div>
            <div className="text-sm text-muted-foreground">Success Stories</div>
          </div>
          
          <div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              {avgCostSaved}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Cost Saved</div>
          </div>
          
          <div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {avgROI}%
            </div>
            <div className="text-sm text-muted-foreground">Average ROI</div>
          </div>
          
          <div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
              {avgRating.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Client Rating</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              ${Math.round(totalValue / 1000)}K+
            </div>
            <div className="text-sm text-muted-foreground">Total Project Value Delivered</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}