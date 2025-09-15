import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Star, 
  CheckCircle2,
  MapPin,
  Clock,
  Award,
  Target,
  ArrowRight,
  Briefcase
} from "lucide-react";
import { Link } from "wouter";

const stats = [
  {
    label: "Clients Served",
    value: "40+",
    description: "Across various industries",
    icon: Users,
    color: "text-blue-600"
  },
  {
    label: "Resources Deployed",
    value: "300+",
    description: "Supporting business operations",
    icon: Target,
    color: "text-purple-600"
  },
  {
    label: "Value Delivered",
    value: "$30M+",
    description: "Estimated client value since 2021",
    icon: DollarSign,
    color: "text-green-600"
  },
  {
    label: "Client NPS Score",
    value: "80%",
    description: "Client satisfaction rating",
    icon: Star,
    color: "text-yellow-600"
  },
  {
    label: "Cost Reduction",
    value: "70%",
    description: "Payroll cost savings achieved",
    icon: TrendingUp,
    color: "text-orange-600"
  },
  {
    label: "Leadership Experience",
    value: "120+",
    description: "Years of outsourcing expertise",
    icon: Award,
    color: "text-indigo-600"
  }
];

const serviceModels = [
  {
    title: "Resourced",
    description: "Staff augmentation with vetted OnSpot talent",
    features: ["Pre-screened professionals", "Quick deployment", "Flexible scaling", "Direct management"],
    icon: Users,
    color: "bg-blue-50 dark:bg-blue-950/20 text-blue-600"
  },
  {
    title: "Managed", 
    description: "End-to-end project management with dedicated teams",
    features: ["Project oversight", "Team coordination", "Quality assurance", "Regular reporting"],
    icon: Briefcase,
    color: "bg-green-50 dark:bg-green-950/20 text-green-600"
  },
  {
    title: "Enterprise",
    description: "Strategic partnerships for large-scale operations",
    features: ["Dedicated facilities", "Custom solutions", "24/7 support", "SLA guarantees"],
    icon: Award,
    color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600"
  }
];

const popularSkills = [
  "Virtual Assistant", "Customer Service", "Data Entry", "Lead Generation",
  "Content Writing", "Social Media Management", "Graphic Design", "Web Development",
  "React", "Node.js", "WordPress", "Shopify", "QuickBooks", "SEO"
];

const onspotExperience = [
  {
    stage: "01",
    title: "Let's Implement",
    description: "We do the heavy lifting for you",
    steps: ["Talk to Us", "Design Solutions", "Strike a Deal", "Project Plan", "Design Framework", "Training"]
  },
  {
    stage: "02", 
    title: "Build Your Team",
    description: "Hire the right people at the right seat",
    steps: ["Job Description", "Talent Sourcing", "Initial Screening", "Top Grading", "Client Interview", "Reference Check"]
  },
  {
    stage: "03",
    title: "Start Operations", 
    description: "Guided by the experts",
    steps: ["Nesting", "90-Day Incubation", "Monthly Reviews", "Process Optimization", "Innovation Lab", "Grow!"]
  },
  {
    stage: "04",
    title: "We Innovate Together",
    description: "People, Process, Problem-Solving",
    steps: ["Performance Review", "Idea Generation", "Concept Development", "Evaluation & Selection", "Implementation", "Monitoring"]
  }
];

const testimonials = [
  {
    name: "Frederic Hill",
    role: "Founder & CEO",
    quote: "I just had to take a moment to express my gratitude for the outstanding service they provided. Their complete assistance and efforts were truly remarkable"
  },
  {
    name: "Julie Kyle", 
    role: "Account Executive",
    quote: "Every step of the way they provided helpful advice, recommended strategies to ensure our website was optimally set up, and made sure every element was clear and concise."
  },
  {
    name: "Brendan Buck",
    role: "Data Engineer", 
    quote: "Excellent service and thoroughly trained professionals, and their follow-up on tickets was handled with such care and attention to detail."
  }
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="relative overflow-hidden" style={{ 
        background: `linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)` 
      }}>
        <div className="container mx-auto text-center space-y-8 py-20 px-6">
          <div className="space-y-4">
            <Badge variant="outline" className="text-sm font-medium px-4 py-2 border-white/30 text-white bg-white/10">
              Making Outsourcing Easy
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              Fuel Your Vision with
              <span className="text-white block mt-2">OnSpot</span>
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              Connect with 50,000+ vetted professionals. Reduce cost by up to 70%. 
              Scale operations seamlessly with our Performance-Driven System.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button size="lg" asChild data-testid="button-find-talent">
              <Link href="/hire-talent">
                <Search className="w-5 h-5 mr-2" />
                Find Talent Now
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild data-testid="button-get-hired">
              <Link href="/get-hired">
                <Users className="w-5 h-5 mr-2" />
                Get Hired
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">OnSpot Powers Growth for 40+ Amazing Brands</h2>
          <p className="text-muted-foreground">Proven results that speak for themselves</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`stat-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold">{stat.value}</div>
                    <div className="font-medium text-base">{stat.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.description}</div>
                  </div>
                  <div className={`p-3 rounded-lg bg-muted/20 ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* OnSpot Experience 4-Stage System */}
      <div className="bg-muted/30 py-16">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold">The OnSpot Experience 4-Stage System</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our proven methodology that delivers seamless operations and fixes your leaky buckets
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {onspotExperience.map((stage, index) => (
              <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`stage-${stage.stage}`}>
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">
                      {stage.stage}
                    </div>
                    <CardTitle className="text-xl">{stage.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {stage.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stage.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-center space-x-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Service Models */}
      <div className="container mx-auto px-6 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">Our Service Models</h2>
          <p className="text-muted-foreground">
            Choose the right engagement model for your business needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {serviceModels.map((model, index) => (
            <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`service-${model.title.toLowerCase()}`}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-lg ${model.color}`}>
                    <model.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{model.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-3">
                  {model.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {model.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-6">
                  Learn More
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Amazing Stories - Testimonials */}
      <div className="bg-muted/30 py-16">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold">Amazing Stories</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We love our people and they love us. Amazing results. Amazing stories. 
              It's not just about the numbers, it's about the feeling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`testimonial-${index}`}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="text-4xl text-primary opacity-50">"</div>
                    <p className="text-sm leading-relaxed italic">
                      {testimonial.quote}
                    </p>
                    <div className="pt-4 border-t">
                      <div className="font-medium">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild>
              <Link href="/amazing">
                Read More Amazing Stories
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Popular Skills */}
      <div className="container mx-auto px-6 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">In-Demand Skills</h2>
          <p className="text-muted-foreground">
            Our talent pool covers the most sought-after skills in the market
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="flex flex-wrap gap-3 justify-center">
              {popularSkills.map((skill, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="hover-elevate cursor-pointer px-4 py-2"
                  data-testid={`popular-skill-${skill.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {skill}
                </Badge>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button asChild>
                <Link href="/hire-talent">
                  <Search className="w-4 h-4 mr-2" />
                  Search All Skills
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Why OnSpot Advantage */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Why OnSpot Talent?</h2>
          <p className="text-muted-foreground">
            Discover the competitive advantages of working with OnSpot professionals
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <span>Strategic Location</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Time Zone Overlap with US:</span>
                  <Badge variant="outline">12+ hours</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>English Proficiency:</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cultural Alignment:</span>
                  <Badge variant="outline" className="text-green-600">Excellent</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span>Cost Efficiency</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Average Cost Savings:</span>
                  <Badge variant="outline" className="text-green-600">70%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Quality Standards:</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>ROI Timeline:</span>
                  <Badge variant="outline">30-90 days</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Call to Action */}
      <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20">
        <CardContent className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Ready to Scale Your Operations?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join 85+ companies already saving millions with our OnSpot talent network. 
            Start building your dream team today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" asChild data-testid="button-get-started">
              <Link href="/talent">
                <Users className="w-5 h-5 mr-2" />
                Get Started Now
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild data-testid="button-learn-more">
              <Link href="/services">
                <Clock className="w-5 h-5 mr-2" />
                Schedule Consultation
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}