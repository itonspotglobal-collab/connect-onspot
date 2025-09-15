import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Briefcase
} from "lucide-react";

export default function WhyOnSpot() {
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
    { category: "Customer Support", icon: Phone, color: "bg-blue-100 text-blue-700" },
    { category: "Technical Support", icon: Code, color: "bg-green-100 text-green-700" },
    { category: "Back-office Support", icon: Briefcase, color: "bg-purple-100 text-purple-700" },
    { category: "Data Entry Service", icon: Target, color: "bg-orange-100 text-orange-700" },
    { category: "Virtual Assistant", icon: Users, color: "bg-pink-100 text-pink-700" },
    { category: "Sales Support", icon: TrendingUp, color: "bg-yellow-100 text-yellow-700" }
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
      <section className="relative py-20 px-4 text-center bg-gradient-to-r from-primary/10 via-primary/5 to-background overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Making Outsourcing <span className="text-primary">Easy</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Built by entrepreneurs, for entrepreneurs—OnSpot makes outsourcing easy. We deliver premium, 
            done-for-you teams that cut costs by up to 70%, unlock your time, and fuel 8X business growth.
          </p>
          <p className="text-lg text-muted-foreground mb-12">
            With OnSpot, scaling isn't stressful—it's <span className="font-semibold text-primary">effortless</span>.
          </p>
          <Button size="lg" className="text-lg px-8 py-6" data-testid="button-get-started">
            Get Started Today
          </Button>
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
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Built for Scale, Not Stress</h2>
            <p className="text-xl text-muted-foreground">
              Choose the level of support that fuels your vision
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {serviceModels.map((model, index) => (
              <Card 
                key={model.name} 
                className={`relative hover-elevate transition-all duration-300 ${model.featured ? 'border-primary shadow-lg scale-105' : ''}`}
                data-testid={`service-model-${model.name.toLowerCase()}`}
              >
                {model.featured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">BEST VALUE</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-bold">{model.name}</CardTitle>
                  <p className="text-muted-foreground">{model.subtitle}</p>
                  <p className="text-lg font-semibold text-primary mt-2">{model.pricing}</p>
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
                  <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                    <point.icon className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-red-700">{point.title}</h3>
                  <p className="text-muted-foreground mb-8">{point.description}</p>
                  
                  <div className="border-t pt-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="text-lg font-bold mb-3 text-green-700">{point.solution}</h4>
                    <p className="text-sm text-muted-foreground">{point.solutionDesc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Common Roles */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">We Make Outsourcing Easy!</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Because we love the work you hate
            </p>
            <p className="text-lg text-muted-foreground">
              Your biggest headache is our favorite work
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {commonRoles.map((role, index) => (
              <Card key={index} className="hover-elevate text-center" data-testid={`role-${index}`}>
                <CardContent className="p-6">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${role.color}`}>
                    <role.icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-medium text-sm">{role.category}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Founder Story */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto">
          <Card className="border-none shadow-xl">
            <CardContent className="p-12 text-center">
              <blockquote className="text-2xl md:text-3xl font-medium text-muted-foreground mb-8 leading-relaxed">
                "We understand your struggle with operational costs because we've been there. 
                To grow our New York businesses, we created OnSpot, and its success led our 
                friends to join us in outsourcing their people needs."
              </blockquote>
              <footer className="text-xl">
                <strong className="text-foreground">Jake Wainberg</strong>
                <span className="text-muted-foreground"> - Founder & President</span>
              </footer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* OnSpot by the Numbers */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">OnSpot by the Numbers</h2>
            <p className="text-xl text-muted-foreground">
              Proven results across clients and industries
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`stat-${index}`}>
                <CardContent className="p-8">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-4">
                    {stat.value}
                  </div>
                  <p className="text-sm text-muted-foreground leading-tight">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why the Philippines */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why the Philippines</h2>
            <p className="text-xl text-muted-foreground mb-8">
              The world's premier outsourcing destination
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold mb-6">Philippines HQ Remote Employees</h3>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Our people in the Philippines spans the entire archipelago, giving you nationwide 
                reach and reliability. With 24/7 business operations during calamities and a 90% 
                customer satisfaction index, your business never stops.
              </p>
              <div className="grid grid-cols-2 gap-6">
                {philippinesAdvantages.map((advantage, index) => (
                  <div key={index} className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">
                      {advantage.value}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {advantage.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <h4 className="text-xl font-bold mb-6">Our Vetted Talent Pool</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Over 50k vetted talent pool for our most common outsourced roles</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>All talents go through our unique Job Success Profiling System</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Start your new program in as little as 3 weeks from contract signing</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Employee Benefits */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Delivering Up to 70% Payroll Cost Savings</h2>
            <p className="text-xl text-muted-foreground">
              While you save on payroll cost, your team gets more out of their employment with OnSpot
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">Full Benefits</h3>
                <p className="text-muted-foreground">
                  Employees get full benefit package such as HMO, Insurance, Loan Facilities, 
                  Lifestyle & Wellness and more.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">Retirement Plan</h3>
                <p className="text-muted-foreground">
                  Employees get access to retirement plans that leads to employment longevity 
                  with OnSpot for your benefit.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Award className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">Above Market</h3>
                <p className="text-muted-foreground">
                  Employees get higher than market average salaries plus performance bonuses.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CEO Quote */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto">
          <Card className="border-none shadow-xl">
            <CardContent className="p-12 text-center">
              <blockquote className="text-2xl md:text-3xl font-medium text-muted-foreground mb-8 leading-relaxed">
                "We turned our operational struggles into the creation of OnSpot, helping 
                businesses like ours in New York grow and succeed with easy and efficient 
                outsourcing solutions. Join us to experience transformative success as we 
                Fuel Your Vision and run your Lean, Mean, Engine"
              </blockquote>
              <footer className="text-xl">
                <strong className="text-foreground">Nur Laminero</strong>
                <span className="text-muted-foreground"> - Chief Executive Officer</span>
              </footer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* The OnSpot Experience */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">The OnSpot Experience</h2>
            <p className="text-xl text-muted-foreground">4P System</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">PHILOSOPHY</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>What are you doing well?</p>
                  <p>What sets you apart?</p>
                  <p>What are your good qualities?</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">PEOPLE</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Where do you need to improve?</p>
                  <p>Are resources adequate?</p>
                  <p>What do others do better than you?</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <Zap className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">PROBLEM SOLVING</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>What are your goals?</p>
                  <p>Are demands shifting?</p>
                  <p>How can it be improved?</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-elevate">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
                  <Building className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold mb-4">PROCESS</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>What are the blockers you're facing?</p>
                  <p>What are factors outside of your control?</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Business?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of successful companies who have unlocked growth with OnSpot
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6" data-testid="button-start-conversation">
              Start a Conversation
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary" data-testid="button-view-pricing">
              View Pricing
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}