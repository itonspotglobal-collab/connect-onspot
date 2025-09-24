import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Users, 
  Target, 
  ArrowRight, 
  CheckCircle2,
  BarChart3,
  Globe,
  Star,
  Building,
  Zap,
  Award
} from "lucide-react";

export default function WhyOnSpotCaseStudies() {
  const caseStudies = [
    {
      company: "TechFlow Solutions",
      industry: "Software Development",
      logo: "TS",
      challenge: "Overwhelmed by customer support while trying to scale development",
      solution: "Deployed 12 customer support specialists and 3 technical support engineers",
      results: [
        { metric: "Response Time", value: "87%", description: "faster response times" },
        { metric: "Customer Satisfaction", value: "94%", description: "CSAT score achieved" },
        { metric: "Cost Savings", value: "65%", description: "reduction in support costs" },
        { metric: "Team Growth", value: "3x", description: "development team scaling" }
      ],
      testimonial: "OnSpot didn't just solve our support bottleneck - they freed our entire team to focus on what we do best: building amazing software.",
      clientName: "Sarah Chen",
      clientTitle: "CTO",
      timeframe: "6 months",
      teamSize: "15 people",
      model: "Managed Services"
    },
    {
      company: "GlobalTrade Logistics",
      industry: "Logistics & Supply Chain",
      logo: "GL",
      challenge: "Manual processes causing delays and errors in shipment tracking",
      solution: "Built dedicated operations team with process automation specialists",
      results: [
        { metric: "Processing Speed", value: "78%", description: "faster order processing" },
        { metric: "Error Rate", value: "95%", description: "reduction in errors" },
        { metric: "Cost Efficiency", value: "72%", description: "operational cost savings" },
        { metric: "Customer Retention", value: "8.5x", description: "growth in repeat customers" }
      ],
      testimonial: "The transformation was incredible. What used to take our team days now happens in hours, with perfect accuracy.",
      clientName: "Marcus Rodriguez",
      clientTitle: "Operations Director",
      timeframe: "4 months",
      teamSize: "22 people",
      model: "Enterprise Services"
    },
    {
      company: "HealthFirst Medical",
      industry: "Healthcare Services",
      logo: "HM",
      challenge: "Administrative burden preventing focus on patient care",
      solution: "Deployed specialized medical administration and billing support team",
      results: [
        { metric: "Admin Time", value: "83%", description: "reduction in admin overhead" },
        { metric: "Revenue Cycle", value: "45%", description: "faster billing processing" },
        { metric: "Patient Satisfaction", value: "91%", description: "satisfaction rating" },
        { metric: "Staff Efficiency", value: "6.2x", description: "improvement in productivity" }
      ],
      testimonial: "OnSpot gave us back what matters most - time with our patients. Our doctors can finally focus on healing instead of paperwork.",
      clientName: "Dr. Jennifer Park",
      clientTitle: "Chief Medical Officer",
      timeframe: "8 months",
      teamSize: "18 people",
      model: "Managed Services"
    }
  ];

  const successMetrics = [
    {
      icon: TrendingUp,
      value: "847%",
      label: "Average ROI",
      description: "Return on investment across all client engagements"
    },
    {
      icon: Clock,
      value: "21 days",
      label: "Average Setup",
      description: "From contract to fully operational team"
    },
    {
      icon: Users,
      value: "96%",
      label: "Retention Rate",
      description: "Clients who continue partnerships after first year"
    },
    {
      icon: Target,
      value: "99.2%",
      label: "SLA Achievement",
      description: "Service level agreement compliance rate"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="relative py-32 px-4 text-center overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:80px_80px]" />
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-8">
            <BarChart3 className="w-4 h-4" />
            Real Success Stories
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            Transforming
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Businesses
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
            See how OnSpot has delivered measurable growth and operational excellence for businesses across industries
          </p>
        </div>
      </section>

      {/* Success Metrics */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Proven Track Record</h2>
            <p className="text-xl text-muted-foreground">Results that speak for themselves</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {successMetrics.map((metric, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`metric-${index}`}>
                <CardContent className="p-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <metric.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">{metric.value}</div>
                  <div className="text-lg font-semibold mb-2">{metric.label}</div>
                  <div className="text-sm text-muted-foreground">{metric.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Success Stories</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Discover how OnSpot has transformed operations and accelerated growth for businesses like yours
            </p>
          </div>
          
          <div className="space-y-16">
            {caseStudies.map((study, index) => (
              <Card key={index} className="relative overflow-hidden border-none shadow-2xl hover-elevate transition-all duration-500 group" data-testid={`case-study-${index}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/10"></div>
                <CardContent className="relative p-12">
                  <div className="grid lg:grid-cols-2 gap-12 items-start">
                    {/* Company Info & Challenge */}
                    <div>
                      <div className="flex items-center gap-4 mb-8">
                        <Avatar className="w-16 h-16 border-2 border-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-lg font-bold">
                            {study.logo}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-2xl font-bold text-foreground">{study.company}</h3>
                          <p className="text-primary font-medium">{study.industry}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{study.timeframe}</span>
                            <span>•</span>
                            <span>{study.teamSize}</span>
                            <span>•</span>
                            <Badge variant="outline">{study.model}</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                            <Target className="w-5 h-5 text-destructive" />
                            The Challenge
                          </h4>
                          <p className="text-muted-foreground leading-relaxed">{study.challenge}</p>
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-primary" />
                            OnSpot Solution
                          </h4>
                          <p className="text-muted-foreground leading-relaxed">{study.solution}</p>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-6">
                          <blockquote className="text-lg text-foreground leading-relaxed italic">
                            "{study.testimonial}"
                          </blockquote>
                          <footer className="mt-4 flex items-center gap-3">
                            <div>
                              <div className="font-semibold text-foreground">{study.clientName}</div>
                              <div className="text-sm text-muted-foreground">{study.clientTitle}, {study.company}</div>
                            </div>
                          </footer>
                        </div>
                      </div>
                    </div>
                    
                    {/* Results */}
                    <div>
                      <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Award className="w-5 h-5 text-[hsl(var(--gold-yellow))]" />
                        Measurable Results
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-6">
                        {study.results.map((result, resultIndex) => (
                          <Card key={resultIndex} className="text-center hover-elevate">
                            <CardContent className="p-6">
                              <div className="text-3xl font-bold text-primary mb-2">{result.value}</div>
                              <div className="text-sm font-semibold text-foreground mb-1">{result.metric}</div>
                              <div className="text-xs text-muted-foreground">{result.description}</div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      
                      <div className="mt-8">
                        <Button className="w-full" data-testid={`button-learn-more-${index}`}>
                          View Detailed Case Study
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Write Your Success Story?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join hundreds of businesses that have transformed their operations with OnSpot
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-start-journey">
              Start Your Transformation
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-10 py-6" data-testid="button-schedule-consultation">
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}