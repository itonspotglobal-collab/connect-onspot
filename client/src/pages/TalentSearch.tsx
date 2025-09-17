import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  MapPin, 
  DollarSign, 
  Star, 
  Clock, 
  Filter,
  User,
  CheckCircle2,
  Briefcase,
  Users,
  Shield,
  Zap,
  Target,
  TrendingUp,
  Award,
  MessageSquare,
  FileText,
  Headphones,
  Code,
  PenTool,
  BarChart3,
  Calculator
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import BespokeTalentBuilder from "@/components/BespokeTalentBuilder";

interface Profile {
  id: string;
  userId: string;
  title?: string;
  bio?: string;
  location?: string;
  hourlyRate?: string;
  rateCurrency?: string;
  availability?: string;
  rating?: string;
  totalEarnings?: string;
  jobSuccessScore?: number;
  languages?: string[];
  profilePicture?: string;
  createdAt?: Date;
}

interface Filters {
  category: string;
  location: string;
  skills: string[];
  availability: string;
  minRate: number;
  maxRate: number;
  rating: number;
}

const SERVICE_CATEGORIES = [
  {
    title: "Customer Support",
    description: "24/7 dedicated support teams",
    icon: Headphones,
    weeklyDeployments: "50+",
    color: "bg-blue-50 text-blue-600 border-blue-200",
    href: "/hire-talent?category=customer-support"
  },
  {
    title: "Virtual Assistants", 
    description: "Executive and administrative support",
    icon: Users,
    weeklyDeployments: "40+",
    color: "bg-green-50 text-green-600 border-green-200",
    href: "/hire-talent?category=virtual-assistants"
  },
  {
    title: "Technical Support",
    description: "IT and technical assistance",
    icon: Code,
    weeklyDeployments: "30+", 
    color: "bg-purple-50 text-purple-600 border-purple-200",
    href: "/hire-talent?category=technical-support"
  },
  {
    title: "Back Office Support",
    description: "Data entry, processing, operations",
    icon: FileText,
    weeklyDeployments: "45+",
    color: "bg-orange-50 text-orange-600 border-orange-200", 
    href: "/hire-talent?category=back-office"
  },
  {
    title: "Sales & Marketing",
    description: "Lead generation and marketing support", 
    icon: BarChart3,
    weeklyDeployments: "35+",
    color: "bg-pink-50 text-pink-600 border-pink-200",
    href: "/hire-talent?category=sales-marketing"
  },
  {
    title: "Design & Creative",
    description: "Graphic design and creative services",
    icon: PenTool,
    weeklyDeployments: "25+",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
    href: "/hire-talent?category=design-creative"
  }
];

const TRUST_COMPANIES = [
  { name: "Microsoft", logo: "💼" },
  { name: "Airbnb", logo: "🏠" },
  { name: "Bissell", logo: "🧹" },
  { name: "GE", logo: "⚡" },
  { name: "Nasdaq", logo: "📈" }
];

const SUCCESS_METRICS = [
  {
    value: "500+",
    label: "Team Members Deployed",
    description: "Skilled professionals ready to work"
  },
  {
    value: "85+",
    label: "Clients Served",
    description: "Companies trusting OnSpot for growth"
  },
  {
    value: "96%",
    label: "Client Satisfaction",
    description: "Average rating from our clients"
  },
  {
    value: "21 Days",
    label: "Average Deployment",
    description: "Time from request to team start"
  }
];

const VALUE_PROPOSITIONS = [
  {
    icon: Zap,
    title: "Deploy in 21 Days",
    description: "Get your dedicated team operational in just 3 weeks with our proven deployment process."
  },
  {
    icon: Shield,
    title: "OnSpot Security Promise",
    description: "Enterprise-grade security, data protection, and complete confidentiality guaranteed."
  },
  {
    icon: Target,
    title: "70% Cost Savings",
    description: "Reduce operational costs while scaling your business with premium Filipino talent."
  },
  {
    icon: Award,
    title: "4-Stage Excellence System",
    description: "Let's Implement → Build Your Team → Start Operations → We Innovate Together"
  }
];

export default function TalentSearch() {
  const [filters, setFilters] = useState<Filters>({
    category: "all",
    location: "all", 
    skills: [],
    availability: "all",
    minRate: 5,
    maxRate: 50,
    rating: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // Fetch profiles based on current filters  
  const { data: profiles = [], isLoading, error } = useQuery<Profile[]>({
    queryKey: ["/api/profiles/search", filters],
    enabled: true
  });

  const handleSearch = () => {
    // Trigger search with current filters and search term
    console.log("Searching with:", { searchTerm, filters });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Search Section - At the top before hero */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-16 z-40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="Search for customer support, virtual assistant, technical support..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base border-2 focus:border-primary"
                  data-testid="input-hero-search"
                />
              </div>
            </div>
            
            <div className="flex gap-3 w-full lg:w-auto">
              <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="w-full lg:w-[200px] h-12">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="customer-support">Customer Support</SelectItem>
                  <SelectItem value="virtual-assistants">Virtual Assistants</SelectItem>
                  <SelectItem value="technical-support">Technical Support</SelectItem>
                  <SelectItem value="back-office">Back Office Support</SelectItem>
                  <SelectItem value="sales-marketing">Sales & Marketing</SelectItem>
                  <SelectItem value="design-creative">Design & Creative</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleSearch}
                size="lg" 
                className="px-8 h-12"
                data-testid="button-search-talent"
              >
                Search Talent
              </Button>
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <button 
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
              data-testid="button-advanced-search"
            >
              <Filter className="w-3 h-3" />
              Advanced Search
            </button>
            <span className="text-muted-foreground text-sm">•</span>
            <span className="text-sm text-muted-foreground">Popular: Virtual Assistant, Customer Service, Lead Generation</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center space-y-6 mb-12">
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Build today, scale tomorrow
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Connect with premium Filipino talent that gets your business, and deploy dedicated teams 
              that take your operations to the next level with up to 70% cost savings.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link href="/lead-intake">
                <Button size="lg" className="px-8 py-3 text-lg" data-testid="button-get-started">
                  Get Started Today
                </Button>
              </Link>
              <Link href="/why-onspot/value-calculator">
                <Button variant="outline" size="lg" className="px-8 py-3 text-lg gap-2" data-testid="button-calculate-savings">
                  <Calculator className="w-5 h-5" />
                  Calculate Your Savings
                </Button>
              </Link>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="text-center space-y-6">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Trusted by industry leaders
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {TRUST_COMPANIES.map((company, index) => (
                <div key={index} className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-2xl">{company.logo}</span>
                  <span className="font-medium">{company.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Success Metrics */}
      <div className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-3">The best talent you've never met</h2>
            <p className="text-muted-foreground">
              Customer support specialists. Virtual assistants. Technical experts. Sales professionals.
              Make the right connection and it'll transform your business.
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {SUCCESS_METRICS.map((metric, index) => (
              <div key={index} className="text-center space-y-2">
                <div className="text-3xl lg:text-4xl font-bold text-primary">{metric.value}</div>
                <div className="font-medium text-foreground">{metric.label}</div>
                <div className="text-sm text-muted-foreground">{metric.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Categories Grid */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Explore our service expertise</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Discover specialized talent across our core service areas, each designed to drive specific business outcomes.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICE_CATEGORIES.map((category, index) => (
              <Link key={index} href={category.href}>
                <Card className={`hover-elevate cursor-pointer transition-all duration-300 border-2 ${category.color}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-white shadow-sm">
                        <category.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{category.title}</h3>
                        <p className="text-muted-foreground text-sm mb-3">
                          {category.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-primary">
                            {category.weeklyDeployments} teams deployed weekly
                          </span>
                          <Button size="sm" variant="ghost" className="text-xs">
                            Explore →
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bespoke Talent Builder */}
      <BespokeTalentBuilder />

      {/* Value Propositions */}
      <div className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Build today, scale tomorrow</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We've got you covered from concept to deployment. Request your team and start receiving qualified candidates. 
              Once you've found your perfect match, we handle everything else.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUE_PROPOSITIONS.map((prop, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <prop.icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{prop.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {prop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link href="/why-onspot/about">
              <Button size="lg" variant="outline" className="px-8">
                Learn How It Works
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-16 bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your operations?</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join 85+ companies who have already deployed 500+ team members through OnSpot's proven system.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/lead-intake">
              <Button size="lg" variant="secondary" className="px-8 py-3 text-lg">
                Start Building Your Team
              </Button>
            </Link>
            <Link href="/lead-intake">
              <Button size="lg" variant="outline" className="px-8 py-3 text-lg border-white text-white hover:bg-white hover:text-primary">
                Schedule a Consultation
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Advanced Search Panel */}
      {showAdvancedSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Advanced Talent Search</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAdvancedSearch(false)}
                  data-testid="button-close-advanced-search"
                >
                  ✕
                </Button>
              </div>
              <CardDescription>
                Find the perfect talent match with detailed filtering options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Select value={filters.location} onValueChange={(value) => setFilters(prev => ({ ...prev, location: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="manila">Manila</SelectItem>
                      <SelectItem value="cebu">Cebu</SelectItem>
                      <SelectItem value="davao">Davao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Availability</label>
                  <Select value={filters.availability} onValueChange={(value) => setFilters(prev => ({ ...prev, availability: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Availability</SelectItem>
                      <SelectItem value="available">Available Now</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowAdvancedSearch(false)}>
                  Cancel
                </Button>
                <Button onClick={() => { handleSearch(); setShowAdvancedSearch(false); }}>
                  Search Talent
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Section - Only show when there are search results */}
      {(searchTerm || filters.category !== "all") && (
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">
                  {isLoading ? "Searching..." : `${profiles.length} Talented Professionals`}
                </h2>
                <p className="text-muted-foreground mt-1">
                  Ready to join your team and drive results
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setFilters(prev => ({ ...prev, category: "all" })); }}>
                Clear Search
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-muted rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4"></div>
                          <div className="h-3 bg-muted rounded w-1/2"></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : profiles.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or explore our service categories above.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map((profile: Profile) => (
                  <Card key={profile.id} className="hover-elevate transition-all duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4 mb-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={profile.profilePicture} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {profile.title?.split(" ").map(word => word[0]).join("").toUpperCase().slice(0, 2) || "T"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-base leading-tight">
                            {profile.title || "Professional"}
                          </h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {profile.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{profile.location}</span>
                              </div>
                            )}
                            {profile.rating && Number(profile.rating) > 0 && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span>{profile.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {profile.bio && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {profile.bio}
                        </p>
                      )}

                      <Separator className="my-4" />

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <DollarSign className="w-3 h-3" />
                          <span>
                            {profile.hourlyRate ? `${profile.rateCurrency === "PHP" ? "₱" : "$"}${profile.hourlyRate}/hr` : "Rate not specified"}
                          </span>
                        </div>
                        {profile.availability && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className={`capitalize text-sm ${
                              profile.availability === "available" ? "text-green-600" : 
                              profile.availability === "busy" ? "text-yellow-600" : "text-gray-500"
                            }`}>
                              {profile.availability}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">
                          <MessageSquare className="w-3 h-3 mr-2" />
                          Contact
                        </Button>
                        <Button size="sm" variant="outline">
                          View Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}