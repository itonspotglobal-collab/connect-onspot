import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrustBadge, ClientVerificationBadge } from "@/components/TrustBadges";
import { QualityBadge } from "@/components/QualityIndicators";
import { 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Quote,
  Play,
  ExternalLink,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  companyLogo?: string;
  avatar?: string;
  location?: string;
  testimonialText: string;
  rating: number;
  projectType?: string;
  projectValue?: number;
  projectDuration?: string;
  verificationLevel?: "basic" | "business" | "enterprise";
  featured?: boolean;
  videoTestimonial?: string;
  outcomes?: {
    costSaved?: string;
    timeToHire?: string;
    satisfaction?: string;
    qualityScore?: number;
  };
  date?: string;
  category?: "client" | "talent";
}

const defaultTestimonials: Testimonial[] = [
  {
    id: "1",
    name: "Sarah Mitchell",
    role: "Head of Operations",
    company: "TechForward Solutions",
    avatar: "/api/placeholder/60/60",
    location: "San Francisco, CA",
    testimonialText: "OnSpot transformed our hiring process completely. We found an exceptional full-stack developer within 24 hours, and the payment protection gave us complete peace of mind. The quality of talent is unmatched.",
    rating: 5,
    projectType: "Full-Stack Development",
    projectValue: 15000,
    projectDuration: "3 months",
    verificationLevel: "business",
    featured: true,
    outcomes: {
      costSaved: "65%",
      timeToHire: "24 hours",
      satisfaction: "98%",
      qualityScore: 96
    },
    date: "2024-02-15",
    category: "client"
  },
  {
    id: "2",
    name: "Michael Chen",
    role: "Founder & CEO",
    company: "DataDrive Analytics",
    avatar: "/api/placeholder/60/60",
    location: "New York, NY",
    testimonialText: "The verification process at OnSpot is incredibly thorough. We've hired 5 professionals through the platform, and every single one exceeded expectations. The escrow system makes payments seamless and secure.",
    rating: 5,
    projectType: "Data Science Team",
    projectValue: 45000,
    projectDuration: "6 months",
    verificationLevel: "enterprise",
    featured: true,
    outcomes: {
      costSaved: "70%",
      timeToHire: "48 hours",
      satisfaction: "100%",
      qualityScore: 98
    },
    date: "2024-01-28",
    category: "client"
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    role: "Marketing Director",
    company: "GrowthMax Agency",
    avatar: "/api/placeholder/60/60",
    location: "Austin, TX",
    testimonialText: "OnSpot's talent quality is exceptional. We needed a specialized marketing automation expert, and they delivered exactly what we needed. The platform's guarantee system gave us confidence to invest in premium talent.",
    rating: 5,
    projectType: "Marketing Automation",
    projectValue: 12000,
    projectDuration: "2 months",
    verificationLevel: "business",
    featured: false,
    outcomes: {
      costSaved: "60%",
      timeToHire: "36 hours",
      satisfaction: "95%",
      qualityScore: 94
    },
    date: "2024-02-08",
    category: "client"
  },
  {
    id: "4",
    name: "David Kim",
    role: "Senior Full-Stack Developer",
    company: "OnSpot Verified Professional",
    avatar: "/api/placeholder/60/60",
    location: "Manila, Philippines",
    testimonialText: "OnSpot's payment protection is incredible. I've completed 12 projects with guaranteed payments and zero disputes. The client quality is fantastic - all verified businesses with real budgets and clear requirements.",
    rating: 5,
    projectType: "Web Development",
    projectValue: 8500,
    projectDuration: "1 month",
    verificationLevel: "basic",
    featured: true,
    outcomes: {
      costSaved: "100% secure payments",
      timeToHire: "Instant matching",
      satisfaction: "97%",
      qualityScore: 95
    },
    date: "2024-02-10",
    category: "talent"
  },
  {
    id: "5",
    name: "Lisa Thompson",
    role: "CTO",
    company: "InnovateLab",
    avatar: "/api/placeholder/60/60",
    location: "Seattle, WA",
    testimonialText: "We've tried other platforms, but OnSpot's verification process ensures we only work with serious, qualified professionals. The 48-hour payment guarantee gives our team peace of mind to focus on delivering quality work.",
    rating: 5,
    projectType: "Mobile App Development",
    projectValue: 28000,
    projectDuration: "4 months",
    verificationLevel: "enterprise",
    featured: false,
    outcomes: {
      costSaved: "68%",
      timeToHire: "12 hours",
      satisfaction: "99%",
      qualityScore: 97
    },
    date: "2024-01-22",
    category: "client"
  }
];

export interface TestimonialCarouselProps {
  testimonials?: Testimonial[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showControls?: boolean;
  showIndicators?: boolean;
  showOutcomes?: boolean;
  variant?: "default" | "featured" | "compact";
  filterBy?: "client" | "talent" | "all";
  className?: string;
}

export function TestimonialCarousel({
  testimonials = defaultTestimonials,
  autoPlay = true,
  autoPlayInterval = 6000,
  showControls = true,
  showIndicators = true,
  showOutcomes = true,
  variant = "default",
  filterBy = "all",
  className
}: TestimonialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter testimonials based on filterBy prop
  const filteredTestimonials = testimonials.filter(testimonial => {
    if (filterBy === "all") return true;
    return testimonial.category === filterBy;
  });

  const totalSlides = filteredTestimonials.length;

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || totalSlides <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % totalSlides);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, totalSlides]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + totalSlides) % totalSlides);
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % totalSlides);
  };

  if (filteredTestimonials.length === 0) {
    return null;
  }

  const currentTestimonial = filteredTestimonials[currentIndex];

  if (variant === "compact") {
    return (
      <div className={cn("relative", className)}>
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={currentTestimonial.avatar} alt={currentTestimonial.name} />
                <AvatarFallback>
                  {currentTestimonial.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {Array.from({ length: currentTestimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <TrustBadge variant="verified" size="sm" showLabel={false} />
                </div>
                <p className="text-sm text-muted-foreground italic line-clamp-3">
                  "{currentTestimonial.testimonialText}"
                </p>
                <div className="mt-3">
                  <div className="font-medium text-sm">{currentTestimonial.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentTestimonial.role} at {currentTestimonial.company}
                  </div>
                </div>
              </div>
            </div>
            
            {showIndicators && totalSlides > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {filteredTestimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-200",
                      index === currentIndex 
                        ? "bg-primary" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                    data-testid={`testimonial-dot-${index}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} data-testid="testimonial-carousel">
      <Card className="hover-elevate border-2 border-dashed border-muted/50">
        <CardContent className="p-8">
          <div className="space-y-6">
            {/* Header with quote icon */}
            <div className="flex items-center justify-between">
              <Quote className="h-8 w-8 text-primary/60" />
              {currentTestimonial.featured && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Featured
                </Badge>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "h-5 w-5",
                      i < currentTestimonial.rating 
                        ? "fill-yellow-400 text-yellow-400" 
                        : "text-muted-foreground/30"
                    )} 
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {currentTestimonial.rating}.0 / 5.0
              </span>
            </div>

            {/* Testimonial text */}
            <blockquote className="text-lg leading-relaxed text-foreground">
              "{currentTestimonial.testimonialText}"
            </blockquote>

            {/* Author information */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={currentTestimonial.avatar} alt={currentTestimonial.name} />
                <AvatarFallback className="text-lg">
                  {currentTestimonial.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-lg">{currentTestimonial.name}</div>
                <div className="text-muted-foreground">
                  {currentTestimonial.role} at {currentTestimonial.company}
                </div>
                {currentTestimonial.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    {currentTestimonial.location}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {currentTestimonial.verificationLevel && (
                    <ClientVerificationBadge 
                      verificationLevel={currentTestimonial.verificationLevel}
                      size="sm"
                    />
                  )}
                  <TrustBadge variant="verified" size="sm" />
                </div>
              </div>
            </div>

            {/* Project details */}
            {currentTestimonial.projectType && (
              <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                <div className="font-medium text-sm">Project Details</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Project Type</div>
                    <div className="font-medium">{currentTestimonial.projectType}</div>
                  </div>
                  {currentTestimonial.projectValue && (
                    <div>
                      <div className="text-muted-foreground">Project Value</div>
                      <div className="font-medium">${currentTestimonial.projectValue.toLocaleString()}</div>
                    </div>
                  )}
                  {currentTestimonial.projectDuration && (
                    <div>
                      <div className="text-muted-foreground">Duration</div>
                      <div className="font-medium">{currentTestimonial.projectDuration}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Outcomes */}
            {showOutcomes && currentTestimonial.outcomes && (
              <div className="bg-green-50/50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-500/30">
                <div className="font-medium text-sm text-green-700 dark:text-green-400 mb-3">
                  Project Outcomes
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {currentTestimonial.outcomes.costSaved && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {currentTestimonial.outcomes.costSaved}
                      </div>
                      <div className="text-green-700/80 dark:text-green-400/80">Cost Saved</div>
                    </div>
                  )}
                  {currentTestimonial.outcomes.timeToHire && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {currentTestimonial.outcomes.timeToHire}
                      </div>
                      <div className="text-blue-700/80 dark:text-blue-400/80">Time to Hire</div>
                    </div>
                  )}
                  {currentTestimonial.outcomes.satisfaction && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {currentTestimonial.outcomes.satisfaction}
                      </div>
                      <div className="text-purple-700/80 dark:text-purple-400/80">Satisfaction</div>
                    </div>
                  )}
                  {currentTestimonial.outcomes.qualityScore && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {currentTestimonial.outcomes.qualityScore}
                      </div>
                      <div className="text-yellow-700/80 dark:text-yellow-400/80">Quality Score</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation controls */}
      {showControls && totalSlides > 1 && (
        <div className="flex justify-between absolute top-1/2 -translate-y-1/2 w-full px-4">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevious}
            className="rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background"
            data-testid="testimonial-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNext}
            className="rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background"
            data-testid="testimonial-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Indicators */}
      {showIndicators && totalSlides > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {filteredTestimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                index === currentIndex 
                  ? "bg-primary scale-110" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              data-testid={`testimonial-dot-${index}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface TestimonialGridProps {
  testimonials?: Testimonial[];
  columns?: 1 | 2 | 3;
  maxItems?: number;
  showOutcomes?: boolean;
  filterBy?: "client" | "talent" | "all";
  className?: string;
}

export function TestimonialGrid({
  testimonials = defaultTestimonials.slice(0, 3),
  columns = 3,
  maxItems = 6,
  showOutcomes = false,
  filterBy = "all",
  className
}: TestimonialGridProps) {
  const filteredTestimonials = testimonials
    .filter(testimonial => filterBy === "all" || testimonial.category === filterBy)
    .slice(0, maxItems);

  const getGridCols = () => {
    switch (columns) {
      case 1: return "grid-cols-1";
      case 2: return "grid-cols-1 md:grid-cols-2";
      case 3: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      default: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    }
  };

  return (
    <div className={cn("grid gap-6", getGridCols(), className)}>
      {filteredTestimonials.map((testimonial) => (
        <TestimonialCarousel
          key={testimonial.id}
          testimonials={[testimonial]}
          autoPlay={false}
          showControls={false}
          showIndicators={false}
          showOutcomes={showOutcomes}
          variant="compact"
        />
      ))}
    </div>
  );
}