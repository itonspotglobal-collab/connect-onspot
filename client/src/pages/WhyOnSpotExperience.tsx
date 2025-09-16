import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Users, 
  Target, 
  Settings,
  Zap,
  BarChart3,
  Lightbulb,
  Shield,
  Award,
  Sparkles
} from "lucide-react";

export default function WhyOnSpotExperience() {
  const stages = [
    {
      stage: 1,
      title: "Let's Implement",
      subtitle: "We do the heavy lifting for you",
      description: "Our expert team handles the complete setup process, from initial consultation to framework design and training.",
      icon: Settings,
      color: "from-blue-500 to-blue-600",
      steps: [
        { name: "Talk to Us", description: "Initial consultation to understand your needs" },
        { name: "Design Solutions", description: "Custom solution architecture for your business" },
        { name: "Strike a Deal", description: "Transparent pricing and service agreement" },
        { name: "Project Plan", description: "Detailed implementation roadmap" },
        { name: "Design Framework", description: "Process and workflow design" },
        { name: "Training", description: "Team preparation and knowledge transfer" }
      ],
      duration: "1-2 weeks",
      outcome: "Complete operational framework ready for deployment"
    },
    {
      stage: 2,
      title: "Build Your Team",
      subtitle: "Hire the right people at the right seat",
      description: "Our rigorous recruitment process ensures you get top-tier talent that aligns with your culture and requirements.",
      icon: Users,
      color: "from-green-500 to-green-600",
      steps: [
        { name: "Job Description", description: "Detailed role specifications and requirements" },
        { name: "Talent Sourcing", description: "Access to 50k+ pre-vetted professionals" },
        { name: "Initial Screening", description: "Skills and cultural fit assessment" },
        { name: "Top Grading", description: "Advanced evaluation and ranking system" },
        { name: "Client Interview", description: "Final selection with your direct involvement" },
        { name: "Reference Check", description: "Thorough background and reference verification" }
      ],
      duration: "1-3 weeks",
      outcome: "Perfectly matched team members ready to start"
    },
    {
      stage: 3,
      title: "Start Operations",
      subtitle: "Guided by the experts",
      description: "Seamless launch with continuous support, monitoring, and optimization to ensure immediate productivity.",
      icon: Zap,
      color: "from-primary to-primary/80",
      steps: [
        { name: "Nesting", description: "Smooth integration into your existing workflows" },
        { name: "90-Day Incubation", description: "Intensive monitoring and support period" },
        { name: "Monthly Reviews", description: "Regular performance and progress assessments" },
        { name: "Process Optimization", description: "Continuous improvement and refinement" },
        { name: "Innovation Lab", description: "Identify new opportunities and improvements" },
        { name: "Grow!", description: "Scale operations based on success metrics" }
      ],
      duration: "3 months",
      outcome: "Fully operational team delivering measurable results"
    },
    {
      stage: 4,
      title: "We Innovate Together",
      subtitle: "People, Process, Problem-Solving",
      description: "Ongoing partnership focused on continuous improvement, innovation, and scaling your success.",
      icon: Lightbulb,
      color: "from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]",
      steps: [
        { name: "Performance Review", description: "Comprehensive evaluation of team and processes" },
        { name: "Idea Generation", description: "Collaborative innovation and improvement sessions" },
        { name: "Concept Development", description: "Transform ideas into actionable strategies" },
        { name: "Evaluation & Selection", description: "Strategic assessment of optimization opportunities" },
        { name: "Implementation", description: "Execute improvements and new processes" },
        { name: "Monitoring", description: "Track results and continuous optimization" }
      ],
      duration: "Ongoing",
      outcome: "Continuous growth and innovation partnership"
    }
  ];

  const experienceFeatures = [
    {
      icon: Shield,
      title: "Risk-Free Trial",
      description: "30-day money-back guarantee on all new engagements"
    },
    {
      icon: Clock,
      title: "Rapid Deployment",
      description: "From contract to operational in just 21 days average"
    },
    {
      icon: Target,
      title: "KPI Accountability",
      description: "Clear metrics and guaranteed performance standards"
    },
    {
      icon: Award,
      title: "Premium Support",
      description: "24/7 dedicated support and account management"
    },
    {
      icon: BarChart3,
      title: "Transparent Reporting",
      description: "Real-time dashboards and comprehensive analytics"
    },
    {
      icon: Sparkles,
      title: "Continuous Innovation",
      description: "Regular process optimization and improvement initiatives"
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
            <Settings className="w-4 h-4" />
            The OnSpot Experience
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            Your Success
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Simplified
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
            Our proven 4-stage system transforms complex outsourcing into a seamless, stress-free experience that delivers results from day one
          </p>
        </div>
      </section>

      {/* Experience Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Our Experience is Different</h2>
            <p className="text-xl text-muted-foreground">Built on years of outsourcing expertise and continuous refinement</p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6">
            {experienceFeatures.map((feature, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`feature-${index}`}>
                <CardContent className="p-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Stage System */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">The OnSpot 4-Stage System</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A systematic approach to outsourcing that eliminates guesswork and guarantees success
            </p>
          </div>
          
          <div className="space-y-20">
            {stages.map((stage, index) => (
              <div key={stage.stage} className="relative" data-testid={`stage-${stage.stage}`}>
                {/* Connection Line */}
                {index < stages.length - 1 && (
                  <div className="absolute left-8 top-32 w-0.5 h-20 bg-gradient-to-b from-primary/50 to-transparent hidden lg:block"></div>
                )}
                
                <Card className="relative overflow-hidden border-none shadow-2xl hover-elevate transition-all duration-500 group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${stage.color} opacity-5 group-hover:opacity-10 transition-opacity duration-500`}></div>
                  <CardContent className="relative p-12">
                    <div className="grid lg:grid-cols-3 gap-12 items-start">
                      {/* Stage Header */}
                      <div className="lg:col-span-1">
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${stage.color} flex items-center justify-center shadow-lg`}>
                            <stage.icon className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Stage {stage.stage}</div>
                            <h3 className="text-2xl font-bold text-foreground">{stage.title}</h3>
                            <p className="text-primary font-medium">{stage.subtitle}</p>
                          </div>
                        </div>
                        
                        <p className="text-muted-foreground mb-6 leading-relaxed">{stage.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {stage.duration}
                          </Badge>
                          <div className="text-muted-foreground">Timeline</div>
                        </div>
                      </div>
                      
                      {/* Stage Steps */}
                      <div className="lg:col-span-2">
                        <h4 className="text-lg font-semibold mb-6">Process Steps</h4>
                        <div className="grid md:grid-cols-2 gap-4 mb-8">
                          {stage.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors duration-200">
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-primary">{stepIndex + 1}</span>
                              </div>
                              <div>
                                <div className="font-medium text-foreground mb-1">{step.name}</div>
                                <div className="text-xs text-muted-foreground">{step.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Outcome */}
                        <div className="p-6 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-foreground mb-1">Expected Outcome</div>
                              <div className="text-sm text-muted-foreground">{stage.outcome}</div>
                            </div>
                          </div>
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
          <h2 className="text-4xl font-bold mb-6">Ready to Experience the Difference?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join hundreds of businesses that have transformed their operations with our proven 4-stage system
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-start-system">
              Start Your Journey
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-10 py-6" data-testid="button-learn-process">
              Learn More About Our Process
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}