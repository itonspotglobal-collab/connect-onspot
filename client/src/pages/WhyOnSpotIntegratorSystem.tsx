import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Cog, 
  Target, 
  BarChart3,
  TrendingUp,
  Shield,
  Zap,
  Award,
  Users,
  Globe,
  Lightbulb,
  Settings,
  Lock,
  RefreshCw
} from "lucide-react";

export default function WhyOnSpotIntegratorSystem() {
  const systemComponents = [
    {
      icon: Target,
      title: "Strategic Planning",
      description: "Comprehensive business analysis and customized outsourcing strategy development",
      features: [
        "Business process mapping",
        "ROI optimization analysis",
        "Risk assessment and mitigation",
        "Custom implementation roadmap"
      ],
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Users,
      title: "Talent Integration",
      description: "Advanced recruitment and seamless team integration using proprietary methodologies",
      features: [
        "50k+ pre-vetted talent pool",
        "Cultural fit assessment",
        "Skills matching algorithms",
        "Team integration protocols"
      ],
      color: "from-green-500 to-green-600"
    },
    {
      icon: Cog,
      title: "Process Optimization",
      description: "Continuous improvement through data-driven process refinement and automation",
      features: [
        "Workflow automation design",
        "Performance metrics tracking",
        "Quality assurance protocols",
        "Efficiency optimization loops"
      ],
      color: "from-primary to-primary/80"
    },
    {
      icon: BarChart3,
      title: "Performance Management",
      description: "Real-time monitoring and predictive analytics for sustained excellence",
      features: [
        "Real-time dashboard monitoring",
        "Predictive performance analytics",
        "KPI accountability framework",
        "Continuous feedback systems"
      ],
      color: "from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]"
    }
  ];

  const methodologyPrinciples = [
    {
      principle: "Data-Driven Decisions",
      description: "Every recommendation is backed by comprehensive data analysis and proven methodologies",
      icon: BarChart3,
      benefit: "95% accuracy in performance predictions"
    },
    {
      principle: "Cultural Synergy",
      description: "Deep focus on cultural alignment to ensure seamless integration and collaboration",
      icon: Globe,
      benefit: "98% client satisfaction with team fit"
    },
    {
      principle: "Continuous Innovation",
      description: "Ongoing process improvement and adoption of cutting-edge outsourcing technologies",
      icon: Lightbulb,
      benefit: "30% efficiency gains year-over-year"
    },
    {
      principle: "Risk Mitigation",
      description: "Proactive identification and mitigation of potential operational and security risks",
      icon: Shield,
      benefit: "99.8% uptime across all operations"
    },
    {
      principle: "Scalable Architecture",
      description: "Systems designed to grow with your business, from startup to enterprise scale",
      icon: TrendingUp,
      benefit: "Seamless scaling to 1000+ team members"
    },
    {
      principle: "Quality Assurance",
      description: "Multi-layered quality control systems ensuring consistent service excellence",
      icon: Award,
      benefit: "ISO 27001 certified processes"
    }
  ];

  const frameworkStages = [
    {
      stage: "Discovery & Analysis",
      duration: "Week 1-2",
      activities: [
        "Business process audit",
        "Current state assessment",
        "Bottleneck identification",
        "Opportunity mapping"
      ],
      deliverable: "Comprehensive analysis report and optimization strategy"
    },
    {
      stage: "Solution Design",
      duration: "Week 2-3",
      activities: [
        "Custom solution architecture",
        "Resource planning and allocation",
        "Integration workflow design",
        "Risk assessment and mitigation"
      ],
      deliverable: "Detailed implementation blueprint and project timeline"
    },
    {
      stage: "Implementation",
      duration: "Week 3-6",
      activities: [
        "Team recruitment and onboarding",
        "System integration and testing",
        "Process deployment and monitoring",
        "Performance baseline establishment"
      ],
      deliverable: "Fully operational outsourced team and processes"
    },
    {
      stage: "Optimization",
      duration: "Ongoing",
      activities: [
        "Performance monitoring and analysis",
        "Continuous process improvement",
        "Scaling and expansion planning",
        "Innovation implementation"
      ],
      deliverable: "Continuous improvement reports and optimization recommendations"
    }
  ];

  const systemAdvantages = [
    {
      icon: Zap,
      title: "Faster Implementation",
      value: "75%",
      description: "Faster deployment compared to traditional outsourcing"
    },
    {
      icon: TrendingUp,
      title: "Higher Success Rate",
      value: "94%",
      description: "Of projects meet or exceed expected ROI targets"
    },
    {
      icon: Shield,
      title: "Risk Reduction",
      value: "89%",
      description: "Fewer operational risks and compliance issues"
    },
    {
      icon: Award,
      title: "Quality Improvement",
      value: "92%",
      description: "Improvement in service quality metrics"
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
            <Layers className="w-4 h-4" />
            The OnSpot Integrator System
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            Our Secret
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Methodology
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
            The proprietary framework that powers our success - a systematic approach to outsourcing that has delivered exceptional results for over 85 businesses
          </p>
        </div>
      </section>

      {/* System Advantages */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Our System Works</h2>
            <p className="text-xl text-muted-foreground">Proven results from our proprietary methodology</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {systemAdvantages.map((advantage, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`advantage-${index}`}>
                <CardContent className="p-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <advantage.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">{advantage.value}</div>
                  <div className="text-lg font-semibold mb-2">{advantage.title}</div>
                  <div className="text-sm text-muted-foreground">{advantage.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* System Components */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Core System Components</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Four integrated pillars that form the foundation of our outsourcing success methodology
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {systemComponents.map((component, index) => (
              <Card key={index} className="relative overflow-hidden border-none shadow-2xl hover-elevate transition-all duration-500 group" data-testid={`component-${index}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${component.color} opacity-5 group-hover:opacity-10 transition-opacity duration-500`}></div>
                <CardHeader className="relative pb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${component.color} flex items-center justify-center shadow-lg`}>
                      <component.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{component.title}</CardTitle>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{component.description}</p>
                </CardHeader>
                <CardContent className="relative">
                  <h4 className="font-semibold mb-4">Key Features</h4>
                  <ul className="space-y-3">
                    {component.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology Principles */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Guiding Principles</h2>
            <p className="text-xl text-muted-foreground">The foundational beliefs that drive our methodology</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {methodologyPrinciples.map((principle, index) => (
              <Card key={index} className="hover-elevate" data-testid={`principle-${index}`}>
                <CardContent className="p-8">
                  <div className="w-12 h-12 mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <principle.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{principle.principle}</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">{principle.description}</p>
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="text-sm font-medium text-primary">{principle.benefit}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Framework Implementation */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Implementation Framework</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our step-by-step process for deploying the Integrator System in your business
            </p>
          </div>
          
          <div className="space-y-12">
            {frameworkStages.map((stage, index) => (
              <div key={index} className="relative" data-testid={`framework-stage-${index}`}>
                {/* Connection Line */}
                {index < frameworkStages.length - 1 && (
                  <div className="absolute left-8 top-32 w-0.5 h-20 bg-gradient-to-b from-primary/50 to-transparent hidden lg:block"></div>
                )}
                
                <Card className="relative overflow-hidden border-none shadow-xl hover-elevate transition-all duration-500">
                  <CardContent className="p-10">
                    <div className="grid lg:grid-cols-3 gap-8 items-start">
                      {/* Stage Info */}
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="font-bold text-primary">{index + 1}</span>
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">{stage.stage}</h3>
                            <Badge variant="outline">{stage.duration}</Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Activities */}
                      <div>
                        <h4 className="font-semibold mb-4">Key Activities</h4>
                        <ul className="space-y-2">
                          {stage.activities.map((activity, actIndex) => (
                            <li key={actIndex} className="flex items-center gap-2 text-sm">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                              {activity}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Deliverable */}
                      <div>
                        <h4 className="font-semibold mb-4">Deliverable</h4>
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-sm">{stage.deliverable}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Experience Our Methodology Firsthand</h2>
          <p className="text-xl text-muted-foreground mb-8">
            See how the OnSpot Integrator System can transform your business operations and accelerate growth
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-request-demo">
              Request System Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-10 py-6" data-testid="button-download-framework">
              Download Framework Guide
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}