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
    label: "Philippine Resources",
    value: "500+",
    description: "Vetted professionals",
    icon: Users,
    color: "text-blue-600"
  },
  {
    label: "Value Delivered",
    value: "$50M+",
    description: "Client savings achieved",
    icon: DollarSign,
    color: "text-green-600"
  },
  {
    label: "Successful Clients",
    value: "85",
    description: "Companies scaling globally",
    icon: Target,
    color: "text-purple-600"
  },
  {
    label: "Cost Reduction",
    value: "70%",
    description: "Average savings vs local hiring",
    icon: TrendingUp,
    color: "text-orange-600"
  }
];

const serviceModels = [
  {
    title: "Resourced",
    description: "Staff augmentation with vetted Philippine talent",
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

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="text-center space-y-6 py-12">
          <div className="space-y-3">
            <Badge variant="outline" className="text-sm font-medium">
              Making Outsourcing Easy
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Scale Your Business with
              <span className="text-primary block mt-2">Philippine Talent</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Connect with 500+ vetted professionals. Reduce costs by 70%. 
              Scale operations seamlessly with our proven outsourcing platform.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" asChild data-testid="button-find-talent">
              <Link href="/talent">
                <Search className="w-5 h-5 mr-2" />
                Find Talent Now
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild data-testid="button-post-job">
              <Link href="/projects">
                <Briefcase className="w-5 h-5 mr-2" />
                Post a Project
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`stat-${index}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="font-medium text-sm">{stat.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.description}</div>
                </div>
                <div className={`p-2 rounded-lg bg-muted/20 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service Models */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Our Service Models</h2>
          <p className="text-muted-foreground">
            Choose the right engagement model for your business needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {serviceModels.map((model, index) => (
            <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`service-${model.title.toLowerCase()}`}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${model.color}`}>
                    <model.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{model.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {model.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {model.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  Learn More
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Popular Skills */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">In-Demand Skills</h2>
          <p className="text-muted-foreground">
            Our talent pool covers the most sought-after skills in the market
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2">
              {popularSkills.map((skill, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="hover-elevate cursor-pointer"
                  data-testid={`popular-skill-${skill.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {skill}
                </Badge>
              ))}
            </div>
            <div className="text-center mt-6">
              <Button variant="outline" asChild>
                <Link href="/talent">
                  <Search className="w-4 h-4 mr-2" />
                  Search All Skills
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Philippines Advantage */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Why Philippine Talent?</h2>
          <p className="text-muted-foreground">
            Discover the competitive advantages of working with Filipino professionals
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
            Join 85+ companies already saving millions with our Philippine talent network. 
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