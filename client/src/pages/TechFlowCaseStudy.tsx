import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  TrendingUp, 
  Clock, 
  Users, 
  Target, 
  ArrowLeft, 
  CheckCircle2,
  BarChart3,
  Globe,
  Building,
  Zap,
  Award,
  ChevronRight,
  Shield,
  HeartHandshake,
  ArrowRight,
  Star
} from "lucide-react";
import { Link } from "wouter";

export default function TechFlowCaseStudy() {
  const caseStudyData = {
    company: "TechFlow Solutions",
    industry: "Software Development",
    logo: "TS",
    executiveSummary: "A prominent software development company sought to enhance operational efficiency while scaling their development team. Facing challenges in managing customer support demands that were overwhelming their technical resources, TechFlow Solutions partnered with OnSpot Global. This case study details how OnSpot's tailored outsourcing solution deployed a dedicated team of Customer Service Representatives and Technical Support Engineers to transform their operations.",
    
    objectives: [
      "Outsource specialized customer support team to reduce burden on developers",
      "Improve response times and customer satisfaction scores", 
      "Enable development team to focus on core product development",
      "Scale support operations without hiring internal staff"
    ],
    
    challenges: [
      "Development team spending 40% of time on customer support issues",
      "Slow response times affecting customer satisfaction",
      "Difficulty scaling support with rapid user growth",
      "Need for technical expertise in support team"
    ],
    
    implementation: {
      duration: "6 months",
      teamSize: "15 people", 
      model: "Managed Services",
      timeline: [
        { phase: "Kickoff & Planning", duration: "Week 1", description: "Stakeholder alignment and requirement gathering" },
        { phase: "Team Recruitment", duration: "Weeks 2-4", description: "Hiring and vetting of specialized support staff" },
        { phase: "Training & Integration", duration: "Weeks 5-8", description: "Comprehensive product and process training" },
        { phase: "Pilot Launch", duration: "Weeks 9-12", description: "Gradual rollout with monitoring and optimization" },
        { phase: "Full Operations", duration: "Weeks 13+", description: "Complete support operations transfer" }
      ]
    },
    
    solutions: [
      {
        title: "Dedicated Support Team",
        description: "Deployed 12 customer service specialists and 3 technical support engineers with software development backgrounds"
      },
      {
        title: "24/7 Coverage Model", 
        description: "Implemented round-the-clock support coverage across multiple time zones"
      },
      {
        title: "Technical Escalation Process",
        description: "Created streamlined process for escalating complex technical issues to development team"
      },
      {
        title: "Knowledge Base Development",
        description: "Built comprehensive documentation and self-service resources for customers"
      }
    ],
    
    results: [
      { metric: "Response Time", value: "87%", description: "faster response times", trend: "up" },
      { metric: "Customer Satisfaction", value: "94%", description: "CSAT score achieved", trend: "up" },
      { metric: "Cost Savings", value: "65%", description: "reduction in support costs", trend: "up" },
      { metric: "Team Growth", value: "3x", description: "development team scaling", trend: "up" },
      { metric: "Ticket Resolution", value: "78%", description: "first-contact resolution", trend: "up" },
      { metric: "Developer Productivity", value: "92%", description: "time now on development", trend: "up" }
    ],
    
    testimonial: {
      quote: "OnSpot didn't just solve our support bottleneck - they freed our entire team to focus on what we do best: building amazing software. The transformation has been incredible.",
      author: "Sarah Chen",
      title: "CTO",
      company: "TechFlow Solutions"
    },
    
    keyLearnings: [
      "Early stakeholder alignment reduced implementation time by 40%",
      "Investing in comprehensive training paid dividends in quality outcomes", 
      "Regular performance monitoring ensured continuous improvement",
      "Cultural integration was as important as technical training"
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <section className="relative py-16 px-4 bg-gradient-to-br from-primary/10 to-background">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/why-onspot/case-studies">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                Back to Case Studies
              </Button>
            </Link>
          </div>
          
          <div className="flex items-start gap-6 mb-8">
            <Avatar className="w-20 h-20 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-2xl font-bold">
                {caseStudyData.logo}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{caseStudyData.company}</h1>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                  {caseStudyData.industry}
                </Badge>
              </div>
              <div className="flex items-center gap-6 text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{caseStudyData.implementation.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{caseStudyData.implementation.teamSize}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>{caseStudyData.implementation.model}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8 px-4 border-b">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="#executive-summary" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              Executive Summary <ChevronRight className="w-3 h-3" />
            </a>
            <a href="#challenges" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              Challenges <ChevronRight className="w-3 h-3" />
            </a>
            <a href="#implementation" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              Implementation <ChevronRight className="w-3 h-3" />
            </a>
            <a href="#solutions" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              Solutions <ChevronRight className="w-3 h-3" />
            </a>
            <a href="#results" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              Results <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">
        {/* Executive Summary */}
        <section id="executive-summary">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
            Executive Summary
          </h2>
          <Card className="hover-elevate">
            <CardContent className="p-8">
              <p className="text-lg leading-relaxed text-muted-foreground">
                {caseStudyData.executiveSummary}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Background & Objectives */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
            Background & Objectives
          </h2>
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Client Objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {caseStudyData.objectives.map((objective, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{objective}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-destructive" />
                  Key Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {caseStudyData.challenges.map((challenge, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-destructive mt-2.5 flex-shrink-0"></div>
                      <span className="text-muted-foreground">{challenge}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Implementation Journey */}
        <section id="implementation">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
            Implementation Journey
          </h2>
          <Card className="hover-elevate">
            <CardContent className="p-8">
              <div className="space-y-6">
                {caseStudyData.implementation.timeline.map((phase, index) => (
                  <div key={index} className="flex gap-6 relative">
                    {/* Timeline connector */}
                    {index < caseStudyData.implementation.timeline.length - 1 && (
                      <div className="absolute left-4 top-8 w-0.5 h-16 bg-border"></div>
                    )}
                    
                    {/* Timeline dot */}
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 z-10">
                      {index + 1}
                    </div>
                    
                    {/* Timeline content */}
                    <div className="flex-1 pb-8">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{phase.phase}</h3>
                        <Badge variant="outline">{phase.duration}</Badge>
                      </div>
                      <p className="text-muted-foreground">{phase.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Solutions Provided */}
        <section id="solutions">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
            Solutions Provided
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {caseStudyData.solutions.map((solution, index) => (
              <Card key={index} className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    {solution.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{solution.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Results & Impact */}
        <section id="results">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">5</div>
            Results & Impact
          </h2>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
            {caseStudyData.results.map((result, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`result-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="text-4xl font-bold text-primary">{result.value}</div>
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="text-sm font-semibold text-foreground mb-1">{result.metric}</div>
                  <div className="text-xs text-muted-foreground">{result.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Client Testimonial */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 hover-elevate">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <blockquote className="text-xl text-foreground leading-relaxed italic mb-4">
                    "{caseStudyData.testimonial.quote}"
                  </blockquote>
                  <footer className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                        {caseStudyData.testimonial.author.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-foreground">{caseStudyData.testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">
                        {caseStudyData.testimonial.title}, {caseStudyData.testimonial.company}
                      </div>
                    </div>
                  </footer>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Key Learnings */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">6</div>
            Key Learnings
          </h2>
          <Card className="hover-elevate">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-6">
                {caseStudyData.keyLearnings.map((learning, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-[hsl(var(--gold-yellow))] mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{learning}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Conclusion */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">7</div>
            Conclusion
          </h2>
          <Card className="bg-gradient-to-br from-muted/50 to-background hover-elevate">
            <CardContent className="p-8">
              <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                This case study exemplifies how a strategic partnership with OnSpot Global enabled TechFlow Solutions to overcome significant operational challenges and achieve remarkable improvements in efficiency and customer satisfaction. By providing a tailored, managed service model, OnSpot successfully integrated a dedicated support team that not only streamlined customer service operations but also freed the development team to focus on their core mission of building exceptional software.
              </p>
              <p className="text-lg leading-relaxed text-muted-foreground">
                The success with TechFlow Solutions serves as a model for operational excellence for other software companies facing similar challenges. It demonstrates that strategic outsourcing, when executed with precision and a commitment to quality, can fundamentally transform an organization's operational landscape while driving measurable business results.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready for Your Transformation?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Let OnSpot help you achieve similar results for your business
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-start-transformation">
              Start Your Journey
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