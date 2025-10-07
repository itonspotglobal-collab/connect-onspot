import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Star,
  Shield,
  Users,
  TrendingUp,
  CheckCircle2,
  Play,
  Clock,
  DollarSign,
  Award,
  Globe,
  Zap,
  Target,
  Crown,
  PhoneCall,
  HeadphonesIcon,
  Lock,
  FileCheck,
  UserCheck,
  Briefcase,
  Eye,
  Calendar,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { OnSpotLogo } from "@/components/OnSpotLogo";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { TrustBadge, QuickTrustIndicators } from "@/components/TrustBadges";
import {
  StatisticsBar,
  DEFAULT_MARKETPLACE_STATS,
} from "@/components/StatisticsBar";
import { ClientLogos, DEFAULT_CLIENT_LOGOS } from "@/components/ClientLogos";
import {
  PremiumFeatures,
  DEFAULT_PREMIUM_FEATURES,
} from "@/components/PremiumFeatures";
import { useTalentProfile } from "@/hooks/useTalentProfile";
import { cn } from "@/lib/utils";
import professionalWorkspaceImg from "@assets/generated_images/Professional_workspace_background_ccee2885.png";
import businessNetworkImg from "@assets/generated_images/Business_network_illustration_d2c6527c.png";
import avatarImage from "@assets/generated_images/Professional_talent_avatar_71613d75.png";

// Use imported components with their default data

// How it works steps
const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Create Profile",
    description:
      "Build your professional profile with skills, portfolio, and experience",
    icon: UserCheck,
    color: "bg-blue-500",
  },
  {
    step: 2,
    title: "Get Matched",
    description:
      "Our AI matches you with premium clients seeking your exact skills",
    icon: Target,
    color: "bg-purple-500",
  },
  {
    step: 3,
    title: "Start Earning",
    description:
      "Work on exciting projects with guaranteed payments and support",
    icon: TrendingUp,
    color: "bg-green-500",
  },
];

// Trust indicators for legitimacy
const TRUST_INDICATORS = [
  {
    icon: Shield,
    title: "Payment Protected",
    description: "100% secure payments via Stripe with escrow protection",
  },
  {
    icon: FileCheck,
    title: "Verified Clients",
    description: "All clients undergo thorough background verification",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Bank-level security with GDPR compliance",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description: "Dedicated success manager and round-the-clock help",
  },
];

// Use imported premium features from component

export default function TalentPortal() {
  const { user } = useAuth();
  // Use real profile data from useTalentProfile hook
  const {
    profile,
    profileCompletion,
    isNewUser,
    hasCompletedOnboarding,
    isLoading: profileLoading,
  } = useTalentProfile();

  // Note: Onboarding modal is now handled globally by NewUserOnboardingWrapper
  // Removed duplicate modal logic that was causing the modal to appear twice

  // Handle authenticated user navigation
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (user) {
      // Profile completion is now handled by NewUserOnboardingWrapper
      // Just scroll to opportunities for authenticated users
      const opportunitiesSection = document.getElementById("opportunities");
      if (opportunitiesSection) {
        opportunitiesSection.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Not authenticated, trigger sign up flow
      setLocation("/get-hired");
    }
  };

  const handleFindProjects = () => {
    if (user) {
      const opportunitiesSection = document.getElementById("opportunities");
      if (opportunitiesSection) {
        opportunitiesSection.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      setLocation("/get-hired");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-primary/5 via-background to-muted/10 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* Hero Image */}
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-30 lg:opacity-60">
          <img
            src={professionalWorkspaceImg}
            alt="Professional workspace"
            className="w-full h-full object-cover"
            loading="lazy"
            data-testid="hero-background-image"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/20 to-background"></div>
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl">
            {/* OnSpot Branding */}
            <div className="mb-8" data-testid="hero-branding">
              <OnSpotLogo
                size="lg"
                className="mb-4"
                data-testid="onspot-logo"
              />
              <div
                className="flex items-center gap-3 mb-6"
                data-testid="hero-badges"
              >
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 px-4 py-1"
                  data-testid="badge-elite-network"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  Elite Talent Network
                </Badge>
                <QuickTrustIndicators
                  size="sm"
                  data-testid="quick-trust-indicators"
                />
              </div>
            </div>

            {/* Value Proposition */}
            <div className="space-y-6 mb-12">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight">
                Join <span className="text-primary">50,000+ Elite</span>
                <br />
                <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Talents Earning
                </span>
                <br />
                <span className="text-foreground">Premium Rates</span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl">
                Access exclusive opportunities with verified Fortune 500
                clients. Guaranteed payments, premium rates, and career growth
                support.
              </p>
            </div>

            {/* Primary CTA Section */}
            <div className="space-y-6 mb-12">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="text-lg group"
                  onClick={handleGetStarted}
                  data-testid="button-get-started"
                >
                  <span>Start Earning Today</span>
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg"
                  onClick={handleFindProjects}
                  data-testid="button-find-projects"
                >
                  <Eye className="mr-2 h-5 w-5" />
                  Browse Premium Projects
                </Button>
              </div>

              {/* Trust Indicators Below CTA */}
              <div
                className="flex items-center gap-6 text-sm text-muted-foreground"
                data-testid="trust-indicators-cta"
              >
                <div
                  className="flex items-center gap-2"
                  data-testid="indicator-free-join"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Free to join</span>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="indicator-payment-protected"
                >
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>Payment protected</span>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="indicator-quick-match"
                >
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>Get matched in 24hrs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-14 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Start Earning in 3 Simple Steps
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join the elite network of verified professionals earning premium
              rates
            </p>
          </div>

          <div
            className="grid md:grid-cols-3 gap-8"
            data-testid="how-it-works-steps"
          >
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <div
                key={index}
                className="relative group"
                data-testid={`step-${index + 1}`}
              >
                <Card
                  className="hover-elevate text-center p-8 h-full"
                  data-testid={`step-card-${index + 1}`}
                >
                  <CardContent className="p-0 space-y-6">
                    <div className="relative">
                      <div
                        className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                          step.color,
                        )}
                      >
                        <step.icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                        {step.step}
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>

                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>

                {/* Connection Arrow for Desktop */}
                {index < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ChevronRight className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="text-lg"
              data-testid="button-join-onspot"
            >
              Join OnSpot Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Talent Performance Showcase */}
      <section className="py-20 bg-muted/30" id="talent-showcase">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Talent Performance Showcase
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Meet top-performing professionals delivering exceptional results through OnSpot.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Maria Santos",
                role: "Senior Full Stack Developer",
                avatar: avatarImage,
                metrics: [
                  { label: "Client Satisfaction", value: "98%" },
                  { label: "Projects Delivered", value: "24" },
                  { label: "Avg. Rating", value: "4.9/5" },
                ],
              },
              {
                name: "Carlos Reyes",
                role: "Customer Support Specialist",
                avatar: avatarImage,
                metrics: [
                  { label: "Response Time", value: "1.2 min" },
                  { label: "Resolution Rate", value: "96%" },
                  { label: "Client NPS", value: "9.4" },
                ],
              },
              {
                name: "Ana Dela Cruz",
                role: "Virtual Assistant",
                avatar: avatarImage,
                metrics: [
                  { label: "Tasks Completed", value: "150+" },
                  { label: "Reliability", value: "99%" },
                  { label: "Avg. Feedback", value: "4.8/5" },
                ],
              },
            ].map((talent, i) => (
              <Card key={i} className="hover-elevate transition-all duration-300" data-testid={`talent-card-${i + 1}`}>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={talent.avatar} alt={talent.name} />
                    <AvatarFallback>{talent.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{talent.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{talent.role}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {talent.metrics.map((m, j) => (
                    <div key={j} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-semibold text-foreground">{m.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Client Logos Section - Social Proof */}
      <ClientLogos
        logos={DEFAULT_CLIENT_LOGOS}
        variant="default"
        maxLogos={8}
        className="border-y"
      />

      {/* Statistics Bar */}
      <section className="bg-muted/30">
        <div className="container mx-auto px-4">
          <StatisticsBar
            statistics={DEFAULT_MARKETPLACE_STATS}
            variant="default"
            columns={4}
            showDescriptions={false}
            animateOnScroll={false}
          />
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Built on Trust & Security
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your success and security are our top priorities
            </p>
          </div>

          <div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
            data-testid="trust-indicators-grid"
          >
            {TRUST_INDICATORS.map((indicator, index) => (
              <Card
                key={index}
                className="hover-elevate text-center p-6"
                data-testid={`trust-card-${index + 1}`}
              >
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                    <indicator.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {indicator.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {indicator.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Features Section */}
      <PremiumFeatures
        features={DEFAULT_PREMIUM_FEATURES}
        variant="grid"
        columns={2}
        showBenefits={false}
        showCTAs={false}
        className="bg-background"
        title="Why OnSpot Beats the Competition"
        subtitle="Experience the difference of a truly premium talent marketplace"
        sectionBadge="Premium Marketplace"
      />

      {/* Testimonials Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Success Stories from Our Talent
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See how OnSpot transformed careers and increased earnings
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <TestimonialCarousel
              filterBy="talent"
              showOutcomes={true}
              variant="featured"
              autoPlayInterval={8000}
            />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-purple-500/10">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Ready to Join the Elite?
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed">
              Start your journey with OnSpot today. Join thousands of successful
              professionals earning premium rates with verified, high-quality
              clients.
            </p>

            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="text-lg group"
                  onClick={handleGetStarted}
                  data-testid="button-final-cta"
                >
                  <span>Get Started - It's Free</span>
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg"
                  onClick={() => (window.location.href = "tel:+1-555-ONSPOT")}
                  data-testid="button-speak-expert"
                >
                  <PhoneCall className="mr-2 h-5 w-5" />
                  Speak with an Expert
                </Button>
              </div>

              <div
                className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground"
                data-testid="final-trust-indicators"
              >
                <div
                  className="flex items-center gap-2"
                  data-testid="indicator-no-fees"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No setup fees</span>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="indicator-guaranteed-payments"
                >
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>Guaranteed payments</span>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="indicator-join-talent"
                >
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Join 50,000+ talents</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
