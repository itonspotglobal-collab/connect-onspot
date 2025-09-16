import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  DollarSign, 
  Clock, 
  Target, 
  CheckCircle2, 
  Star,
  Globe,
  TrendingUp,
  Shield,
  Zap,
  Award,
  Building,
  Phone,
  Mail,
  Code,
  Heart,
  Briefcase,
  Quote,
  Sparkles,
  ArrowRight
} from "lucide-react";

export default function WhyOnSpotAbout() {
  const serviceModels = [
    {
      name: "RESOURCED",
      subtitle: "You Manage",
      pricing: "Dependent on Role + $200 for onsite",
      forWho: "Founders who want cost savings and direct control",
      features: [
        "Flat FTE rate - Best-in-class hires",
        "Dedicated account manager",
        "Standard support"
      ],
      outcome: "💸 Lower costs, more control—but you handle performance",
      scaleRange: "1-20 FTE",
      variant: "outline" as const
    },
    {
      name: "MANAGED",
      subtitle: "We Manage Everything",
      pricing: "Dependent on Role + $200 for onsite",
      forWho: "Growth-focused leaders who want KPIs delivered without micro-managing",
      features: [
        "✅ Everything in Resourced plus:",
        "Dedicated team manager",
        "We run your day-to-day ops",
        "Process building & 24/7 support",
        "Engagement & response management",
        "Follow-up strategy implementation",
        "KPI accountability"
      ],
      outcome: "⚡ Hands-off growth: predictable KPIs, faster scale, less stress",
      scaleRange: "5-50 FTE",
      variant: "default" as const,
      featured: true
    },
    {
      name: "ENTERPRISE",
      subtitle: "Custom at Scale",
      pricing: "Custom Quote",
      forWho: "Enterprises scaling 50+ FTEs with full customization",
      features: [
        "🚀 Everything in Managed plus:",
        "1,000+ FTE capacity",
        "Enterprise-level processes & reporting",
        "Dedicated campaign team",
        "Custom integrations"
      ],
      outcome: "🏢 Enterprise-grade scalability with full customization",
      scaleRange: ">50 FTE",
      variant: "outline" as const
    }
  ];

  const painPoints = [
    {
      icon: Users,
      title: "Drowning in admin and back-office work",
      description: "Endless admin and back-office tasks drain time, kill focus, and slow growth.",
      solution: "Unlock 8X growth potential",
      solutionDesc: "Unlock 8X growth potential with dedicated teams that free you to scale smarter and faster."
    },
    {
      icon: DollarSign,
      title: "Burned out team, rising cost",
      description: "Overloaded staff juggling multiple roles leads to burnout, lower productivity, and rising costs.",
      solution: "Up to 70% cost savings",
      solutionDesc: "Cut payroll expenses by up to 70% while boosting efficiency and output."
    },
    {
      icon: Clock,
      title: "Growth stalled by hiring bottlenecks",
      description: "Hiring bottlenecks stall growth, delay scaling, and drive up costs.",
      solution: "Scale a team in 21 days",
      solutionDesc: "Access to 50k+ pre-vetted talent pool across the Philippines."
    }
  ];

  const commonRoles = [
    { category: "Customer Support", icon: Phone, color: "bg-primary/10 text-primary" },
    { category: "Technical Support", icon: Code, color: "bg-muted text-muted-foreground" },
    { category: "Back-office Support", icon: Briefcase, color: "bg-primary/15 text-primary" },
    { category: "Data Entry Service", icon: Target, color: "bg-[hsl(var(--gold-yellow))]/15 text-[hsl(var(--gold-yellow))]" },
    { category: "Virtual Assistant", icon: Users, color: "bg-muted text-muted-foreground" },
    { category: "Sales Support", icon: TrendingUp, color: "bg-[hsl(var(--gold-yellow))]/20 text-[hsl(var(--gold-yellow))]" }
  ];

  const stats = [
    { value: "500+", label: "Resources deployed to support clients business operations" },
    { value: "85", label: "Clients served across various industries and service models" },
    { value: "$50M", label: "Estimated value delivered to our clients since 2021" },
    { value: "100+", label: "Standard Operating Procedures built for clients" },
    { value: "75%", label: "Client net promoter score" },
    { value: "85%", label: "Employee net promoter score" },
    { value: "15", label: "Startup businesses founded by our leadership team" },
    { value: "120+", label: "Leadership team years of experience in outsourcing" }
  ];

  const philippinesAdvantages = [
    { value: "70%", label: "labor costs savings vs US/Europe/Aus" },
    { value: "90m", label: "fluent english speakers" },
    { value: "1.8m", label: "BPO employees nationwide" },
    { value: "1m", label: "annual college graduates" },
    { value: "$39b", label: "annual outsourcing revenue" },
    { value: "92%", label: "Filipinos aligned to western culture" }
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
            Built by entrepreneurs, for entrepreneurs
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            Making Outsourcing
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Effortless
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-4xl mx-auto leading-relaxed font-light">
            We deliver premium, done-for-you teams that cut costs by up to 70%, 
            unlock your time, and fuel 8X business growth.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90 shadow-2xl" data-testid="button-get-started">
              Get Started Today
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-10 py-6 border-white/50 text-white hover:bg-white/10 backdrop-blur-sm">
              Watch Our Story
            </Button>
          </div>
          
          {/* Hero Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">70%</div>
              <div className="text-white/80 text-sm">Cost Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">8X</div>
              <div className="text-white/80 text-sm">Growth Potential</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">500+</div>
              <div className="text-white/80 text-sm">Team Members</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">85</div>
              <div className="text-white/80 text-sm">Happy Clients</div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Quote */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="text-2xl md:text-3xl font-medium text-muted-foreground mb-6">
            "Very few business tools have the power to fundamentally transform an organization - 
            <span className="text-primary font-semibold"> Outsourcing is one of them.</span>"
          </blockquote>
          <footer className="text-lg">
            <strong className="text-foreground">Michael F. Corbett</strong>
            <span className="text-muted-foreground"> - IAOP Founder and Chairman</span>
          </footer>
        </div>
      </section>

      {/* Service Models */}
      <section className="py-32 px-4 relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-32 left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-32 right-10 w-40 h-40 bg-[hsl(var(--gold-yellow))]/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-grid-black/[0.01] bg-[size:60px_60px]"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium mb-6">
              <Target className="w-4 h-4" />
              Service Models
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[hsl(var(--gold-yellow))]">
              Scale</span>, Not Stress
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Choose the level of support that fuels your vision and accelerates your growth
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {serviceModels.map((model, index) => (
              <Card 
                key={model.name} 
                className={`relative overflow-hidden border-none shadow-2xl hover-elevate transition-all duration-500 group ${
                  model.featured 
                    ? 'scale-105 transform' 
                    : 'hover:scale-105'
                }`}
                data-testid={`service-model-${model.name.toLowerCase()}`}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 ${
                  model.featured
                    ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-[hsl(var(--gold-yellow))]/10'
                    : index === 0
                    ? 'bg-gradient-to-br from-primary/15 via-primary/8 to-primary/5'
                    : 'bg-gradient-to-br from-muted/20 via-muted/10 to-foreground/5'
                }`}></div>
                
                {model.featured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)] text-[hsl(var(--gold-yellow-foreground))] shadow-lg px-4 py-2 text-sm font-bold">
                      <Star className="w-4 h-4 mr-1" />
                      BEST VALUE
                    </Badge>
                  </div>
                )}
                <CardHeader className="relative text-center pb-4 pt-8">
                  <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center ${
                    model.featured
                      ? 'bg-gradient-to-br from-primary to-[hsl(var(--gold-yellow))]'
                      : index === 0
                      ? 'bg-gradient-to-br from-primary to-primary/80'
                      : 'bg-gradient-to-br from-foreground to-muted-foreground'
                  } shadow-xl`}>
                    {model.featured ? (
                      <Zap className="w-8 h-8 text-white" />
                    ) : index === 0 ? (
                      <Users className="w-8 h-8 text-white" />
                    ) : (
                      <Building className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <CardTitle className="text-3xl font-bold mb-2">{model.name}</CardTitle>
                  <p className="text-muted-foreground text-lg">{model.subtitle}</p>
                  <div className="mt-4 p-3 bg-white/60 backdrop-blur-sm rounded-lg">
                    <p className="text-lg font-semibold text-primary">{model.pricing}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">Who It's For</h4>
                    <p className="text-sm text-muted-foreground">{model.forWho}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">What You Get</h4>
                    <ul className="space-y-2">
                      {model.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Outcome</h4>
                    <p className="text-sm font-medium text-primary">{model.outcome}</p>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Scale Range</span>
                      <Badge variant="outline">{model.scaleRange}</Badge>
                    </div>
                  </div>
                  
                  <Button 
                    variant={model.variant} 
                    className="w-full"
                    data-testid={`button-choose-${model.name.toLowerCase()}`}
                  >
                    Choose {model.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* From Chaos to Breakthroughs */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">From Chaos to Breakthroughs</h2>
            <p className="text-xl text-muted-foreground">
              Transform your biggest pain points into growth opportunities
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map((point, index) => (
              <Card key={index} className="hover-elevate" data-testid={`pain-point-${index}`}>
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
                    <point.icon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-foreground">{point.title}</h3>
                  <p className="text-muted-foreground mb-8">{point.description}</p>
                  
                  <div className="border-t pt-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[hsl(var(--gold-yellow))]/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-[hsl(var(--gold-yellow))]" />
                    </div>
                    <h4 className="text-lg font-bold mb-3 text-primary">{point.solution}</h4>
                    <p className="text-sm text-muted-foreground">{point.solutionDesc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="py-32 px-4 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/50">
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-[hsl(var(--gold-yellow))]/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium mb-6">
              <Users className="w-4 h-4" />
              Meet Our Leadership
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Visionaries Behind OnSpot</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Two entrepreneurs who turned their outsourcing struggles into solutions for businesses worldwide
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Jake Wainberg - President */}
            <Card className="relative overflow-hidden border-none shadow-2xl hover-elevate transition-all duration-500 group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-muted/10"></div>
              <CardContent className="relative p-12">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-8">
                    <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                      <AvatarImage src="" alt="Jake Wainberg" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-2xl font-bold">
                        JW
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-[hsl(var(--gold-yellow))] rounded-full flex items-center justify-center">
                      <Award className="w-4 h-4 text-[hsl(var(--gold-yellow-foreground))]" />
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Jake Wainberg</h3>
                    <p className="text-primary font-semibold text-lg">Founder & President</p>
                    <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Building className="w-4 h-4" />
                      <span>New York, USA</span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Quote className="w-8 h-8 text-primary/30 absolute -top-4 -left-4" />
                    <blockquote className="text-lg text-muted-foreground leading-relaxed italic">
                      "We understand your struggle with operational costs because we've been there. 
                      To grow our New York businesses, we created OnSpot, and its success led our 
                      friends to join us in outsourcing their people needs."
                    </blockquote>
                  </div>
                  
                  <div className="mt-8 p-4 bg-white/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">15+</div>
                        <div className="text-xs text-muted-foreground">Years Experience</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">10+</div>
                        <div className="text-xs text-muted-foreground">Businesses Founded</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Nur Laminero - CEO */}
            <Card className="relative overflow-hidden border-none shadow-2xl hover-elevate transition-all duration-500 group">
              <div className="absolute inset-0 bg-gradient-to-br from-muted/15 via-foreground/5 to-primary/5"></div>
              <CardContent className="relative p-12">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-8">
                    <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                      <AvatarImage src="" alt="Nur Laminero" />
                      <AvatarFallback className="bg-gradient-to-br from-muted-foreground to-foreground text-white text-2xl font-bold">
                        NL
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <Star className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Nur Laminero</h3>
                    <p className="text-primary font-semibold text-lg">Chief Executive Officer</p>
                    <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Globe className="w-4 h-4" />
                      <span>Manila, Philippines</span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Quote className="w-8 h-8 text-primary/30 absolute -top-4 -left-4" />
                    <blockquote className="text-lg text-muted-foreground leading-relaxed italic">
                      "With two decades in outsourcing, I've seen what works and what doesn't. 
                      OnSpot combines the best practices with genuine care for both our clients 
                      and our Filipino talent community."
                    </blockquote>
                  </div>
                  
                  <div className="mt-8 p-4 bg-white/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">20+</div>
                        <div className="text-xs text-muted-foreground">Years Experience</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">500+</div>
                        <div className="text-xs text-muted-foreground">Teams Built</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}