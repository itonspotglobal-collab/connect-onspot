import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  FileText,
  Star,
  Info,
  Settings,
  Layers,
  Calculator,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Award
} from "lucide-react";

export default function WhyOnSpot() {
  const whyOnSpotSections = [
    {
      title: "Case Studies",
      subtitle: "Real success stories",
      description: "See how we've transformed businesses and delivered measurable results across industries",
      icon: FileText,
      highlights: ["8X Growth Stories", "ROI Case Studies", "Client Transformations"],
      path: "/why-onspot/case-studies",
      popular: true
    },
    {
      title: "Reviews",
      subtitle: "Client testimonials",
      description: "Hear directly from our clients about their OnSpot experience and results",
      icon: Star,
      highlights: ["5-Star Reviews", "Video Testimonials", "Success Metrics"],
      path: "/why-onspot/reviews",
      popular: false
    },
    {
      title: "About OnSpot",
      subtitle: "Our story & mission",
      description: "Learn about our journey, values, and what makes us different in outsourcing",
      icon: Info,
      highlights: ["Our Story", "Leadership Team", "Company Values"],
      path: "/why-onspot/about",
      popular: false
    },
    {
      title: "The OnSpot Experience",
      subtitle: "How we work",
      description: "Discover our proven 4-stage system for seamless outsourcing success",
      icon: Settings,
      highlights: ["4-Stage System", "Implementation Process", "Innovation Lab"],
      path: "/why-onspot/experience",
      popular: true
    },
    {
      title: "The OnSpot Integrator System",
      subtitle: "Our methodology",
      description: "Deep dive into our proprietary system for outsourcing excellence",
      icon: Layers,
      highlights: ["Proven Framework", "Best Practices", "Process Optimization"],
      path: "/why-onspot/integrator-system",
      popular: false
    },
    {
      title: "Value Calculator",
      subtitle: "Calculate your ROI",
      description: "Comprehensive calculator to assess your potential ROI and value return from outsourcing",
      icon: Calculator,
      highlights: ["ROI Assessment", "Cost Savings Analysis", "Value Projection"],
      path: "/why-onspot/value-calculator",
      popular: true
    }
  ];

  const keyStats = [
    { icon: TrendingUp, value: "8X", label: "Average Growth", description: "Business growth achieved by our clients" },
    { icon: CheckCircle2, value: "70%", label: "Cost Savings", description: "Average reduction in operational costs" },
    { icon: Award, value: "96%", label: "Satisfaction Rate", description: "Client satisfaction and retention" },
    { icon: Star, value: "500+", label: "Team Members", description: "Deployed across client operations" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="relative py-32 px-4 text-center overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/3 left-1/4 w-2 h-32 bg-white/20 rounded-full rotate-12 animate-pulse delay-500"></div>
          <div className="absolute bottom-1/3 right-1/4 w-2 h-24 bg-white/20 rounded-full -rotate-12 animate-pulse delay-700"></div>
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:80px_80px]" />
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Discover why OnSpot is different
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            Why Choose
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              OnSpot?
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
            Explore our proven track record, client testimonials, and the methodology that has delivered exceptional results for businesses worldwide
          </p>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {keyStats.map((stat, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`stat-${index}`}>
                <CardContent className="p-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <stat.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                  <div className="text-lg font-semibold mb-2">{stat.label}</div>
                  <div className="text-sm text-muted-foreground">{stat.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why OnSpot Sections */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Explore OnSpot</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Dive deep into what makes OnSpot the trusted choice for effortless outsourcing
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {whyOnSpotSections.map((section, index) => (
              <Card key={index} className="relative overflow-hidden hover-elevate transition-all duration-500 group h-full" data-testid={`section-${index}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="relative p-8 h-full flex flex-col">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <section.icon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold">{section.title}</h3>
                        {section.popular && (
                          <Badge className="bg-[hsl(var(--gold-yellow))] text-black text-xs px-2 py-1 font-semibold">Popular</Badge>
                        )}
                      </div>
                      <p className="text-primary font-medium text-sm mb-3">{section.subtitle}</p>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed flex-1">{section.description}</p>
                  
                  <div className="mb-6">
                    <div className="text-sm font-medium text-foreground mb-3">Key Highlights:</div>
                    <div className="flex flex-wrap gap-2">
                      {section.highlights.map((highlight, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <Button asChild className="w-full group-hover:shadow-lg transition-all duration-300">
                    <Link href={section.path} data-testid={`button-explore-${index}`}>
                      Explore
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Experience the OnSpot Difference?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join hundreds of businesses that have transformed their operations with our proven methodology
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-get-started">
              Get Started Today
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-10 py-6" data-testid="button-learn-more">
              <Link href="/why-onspot/about">
                Learn More About Us
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}