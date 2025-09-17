import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search,
  Filter,
  MapPin,
  Clock,
  DollarSign,
  Star,
  TrendingUp,
  Code,
  PenTool,
  BarChart3,
  Headphones,
  Globe,
  Camera,
  Briefcase,
  Calendar,
  Users,
  Building2,
  ArrowRight,
  Heart,
  Bookmark,
  CheckCircle2,
  Shield,
  Crown
} from "lucide-react";
import { TrustBadge, ClientVerificationBadge } from "@/components/TrustBadges";
import { PaymentProtectionBadge } from "@/components/PaymentProtectionBadge";
import { QualityBadge } from "@/components/QualityIndicators";

interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  type: "full-time" | "part-time" | "contract" | "freelance";
  budget: {
    min: number;
    max: number;
    type: "hourly" | "fixed";
    currency: string;
  };
  category: string;
  skills: string[];
  description: string;
  requirements: string[];
  postedAt: string;
  applicants: number;
  verified: boolean;
  urgent: boolean;
  rating: number;
  reviewCount: number;
  paymentProtected?: boolean;
  verificationLevel?: "basic" | "business" | "enterprise";
  featured?: boolean;
  responseTime?: string;
  hireRate?: number;
  totalSpent?: number;
  companySize?: "startup" | "scale-up" | "enterprise" | "fortune-500";
}

const workCategories = [
  { id: "development", name: "Development & IT", icon: Code, color: "bg-blue-500" },
  { id: "design", name: "Design & Creative", icon: PenTool, color: "bg-purple-500" },
  { id: "marketing", name: "Sales & Marketing", icon: BarChart3, color: "bg-green-500" },
  { id: "support", name: "Admin & Support", icon: Headphones, color: "bg-orange-500" },
  { id: "writing", name: "Writing & Translation", icon: Globe, color: "bg-teal-500" },
  { id: "media", name: "Audio, Video & Animation", icon: Camera, color: "bg-pink-500" },
];

export default function FindWork() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedBudget, setSelectedBudget] = useState("all");
  const [selectedJobType, setSelectedJobType] = useState("all");
  const [activeTab, setActiveTab] = useState("browse");

  // Build API query parameters from filter state
  const apiFilters = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (selectedJobType !== 'all') params.append('contractType', selectedJobType);
    
    // Convert budget range to API parameters
    if (selectedBudget !== 'all') {
      switch (selectedBudget) {
        case 'under-25':
          params.append('maxBudget', '25');
          break;
        case '25-50':
          params.append('minBudget', '25');
          params.append('maxBudget', '50');
          break;
        case '50-100':
          params.append('minBudget', '50');
          params.append('maxBudget', '100');
          break;
        case 'over-100':
          params.append('minBudget', '100');
          break;
      }
    }
    
    return params.toString();
  }, [searchQuery, selectedCategory, selectedJobType, selectedBudget]);

  // Fetch real jobs from API instead of using mock data
  const { data: jobsData = [], isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['/api/jobs/search', apiFilters],
    enabled: true, // Always enabled to show available jobs
  });

  // Fetch personalized job matches for authenticated users
  const { data: matchesData = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['/api/matches', selectedCategory !== 'all' ? selectedCategory : ''],
    enabled: !!user, // Only fetch if user is authenticated
    queryFn: () => {
      const matchParams = new URLSearchParams();
      if (selectedCategory !== 'all') matchParams.append('category', selectedCategory);
      const url = `/api/matches${matchParams.toString() ? '?' + matchParams.toString() : ''}`;
      return fetch(url).then(res => res.ok ? res.json() : []);
    }
  });

  // Transform API jobs data to match the expected Job interface
  const transformApiJob = useCallback((apiJob: any): Job => {
    const now = new Date();
    const postedDate = apiJob.createdAt ? new Date(apiJob.createdAt) : now;
    const timeAgo = Math.floor((now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let postedAtText = 'Just posted';
    if (timeAgo === 0) postedAtText = 'Today';
    else if (timeAgo === 1) postedAtText = '1 day ago';
    else if (timeAgo < 7) postedAtText = `${timeAgo} days ago`;
    else if (timeAgo < 30) postedAtText = `${Math.floor(timeAgo / 7)} weeks ago`;
    else postedAtText = `${Math.floor(timeAgo / 30)} months ago`;

    return {
      id: apiJob.id,
      title: apiJob.title,
      company: `Client ${apiJob.clientId.slice(0, 8)}`, // Anonymized for privacy
      location: "Remote", // Default for now
      type: apiJob.contractType as "full-time" | "part-time" | "contract" | "freelance",
      budget: {
        min: apiJob.hourlyRateMin ? parseFloat(apiJob.hourlyRateMin) : (apiJob.budget ? parseFloat(apiJob.budget) : 0),
        max: apiJob.hourlyRateMax ? parseFloat(apiJob.hourlyRateMax) : (apiJob.budget ? parseFloat(apiJob.budget) : 0),
        type: apiJob.contractType === 'hourly' ? 'hourly' : 'fixed',
        currency: apiJob.budgetCurrency || 'USD'
      },
      category: apiJob.category,
      skills: apiJob.skills || [], // This comes from our enhanced API
      description: apiJob.description,
      requirements: apiJob.description ? [apiJob.description.slice(0, 100) + '...'] : [], // Simplified
      postedAt: postedAtText,
      applicants: apiJob.proposalCount || 0,
      verified: true, // Assume verified for now
      urgent: timeAgo <= 1, // Mark as urgent if posted today/yesterday
      rating: 4.5, // Default rating
      reviewCount: Math.floor(Math.random() * 100) + 10, // Random for now
      paymentProtected: true,
      verificationLevel: "business" as const,
      featured: timeAgo <= 2, // Featured if very recent
      responseTime: "< 24 hours",
      hireRate: 85,
      totalSpent: 50000,
      companySize: "scale-up" as const
    };
  }, []);

  // Process the real jobs data
  const allJobs: Job[] = useMemo(() => {
    if (jobsLoading || jobsError || !jobsData) return [];
    return Array.isArray(jobsData) ? jobsData.map(transformApiJob) : [];
  }, [jobsData, jobsLoading, jobsError, transformApiJob]);

  // Jobs are now filtered on the backend via API parameters
  // Apply only local location filter since it's not in API yet
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => {
      const matchesLocation = selectedLocation === "all" || 
        (selectedLocation === "remote" && job.location.toLowerCase().includes("remote")) ||
        (selectedLocation === "us" && (job.location.includes("CA") || job.location.includes("NY")));
      
      return matchesLocation;
    });
  }, [allJobs, selectedLocation]);

  // Transform matches data for display
  const recommendedJobs: Job[] = useMemo(() => {
    if (!matchesData || !Array.isArray(matchesData)) return [];
    return matchesData.map((match: any) => transformApiJob(match.job));
  }, [matchesData, transformApiJob]);

  const getJobTypeColor = (type: string) => {
    switch (type) {
      case "full-time": return "bg-green-100 text-green-800";
      case "part-time": return "bg-blue-100 text-blue-800";
      case "contract": return "bg-purple-100 text-purple-800";
      case "freelance": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return workCategories.find(cat => cat.id === categoryId) || workCategories[0];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Find Your Next <span className="text-[hsl(var(--gold-yellow))]">Opportunity</span>
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Discover premium jobs from verified clients worldwide. Build your career with OnSpot's curated opportunities.
            </p>
            
            {/* Search Bar */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-white/60" />
                  <Input
                    placeholder="Search for jobs, skills, or companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
                    data-testid="input-job-search"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="md:w-48 bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {workCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  size="lg" 
                  className="bg-[hsl(var(--gold-yellow))] text-black hover:bg-[hsl(var(--gold-yellow)/0.9)] font-semibold"
                  data-testid="button-search-jobs"
                  disabled={jobsLoading}
                >
                  {jobsLoading ? (
                    <>
                      <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Search Jobs
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Browse Jobs
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              By Category
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
              Saved Jobs
            </TabsTrigger>
          </TabsList>

          {/* Browse Jobs Tab */}
          <TabsContent value="browse" className="space-y-6">
            {/* Recommended Jobs Section - Only show for authenticated users */}
            {user && recommendedJobs.length > 0 && (
              <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 p-6 rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-[hsl(var(--gold-yellow))]" />
                  <h2 className="text-lg font-semibold">Recommended for You</h2>
                  <Badge variant="secondary">Based on your skills</Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {recommendedJobs.slice(0, 2).map((job) => (
                    <Card key={job.id} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                {(() => {
                                  const IconComponent = getCategoryInfo(job.category).icon;
                                  return IconComponent ? <IconComponent className="w-6 h-6 text-primary" /> : null;
                                })()}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold truncate" data-testid={`job-title-${job.id}`}>
                                    {job.title}
                                  </h3>
                                  <Badge className="bg-[hsl(var(--gold-yellow))] text-black text-xs">
                                    Match
                                  </Badge>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-2">
                                  <span>{job.company}</span>
                                  <span>•</span>
                                  <span>{job.location}</span>
                                  <span>•</span>
                                  <span>{job.postedAt}</span>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-2">
                                  {job.skills.slice(0, 3).map((skill) => (
                                    <Badge key={skill} variant="outline" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))}
                                  {job.skills.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{job.skills.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2 ml-4">
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                ${job.budget.type === "hourly" 
                                  ? `${job.budget.min}-${job.budget.max}/hr` 
                                  : `${job.budget.min.toLocaleString()}`
                                }
                              </div>
                              <Badge className={`${getJobTypeColor(job.type)} text-xs`}>
                                {job.type.replace("-", " ")}
                              </Badge>
                            </div>
                            
                            <Button size="sm" data-testid={`apply-recommended-${job.id}`}>
                              Apply Now
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {matchesLoading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                    Finding your perfect matches...
                  </div>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-muted/30 p-4 rounded-lg">
              <div className="flex flex-wrap gap-4">
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Job Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Budget" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Budgets</SelectItem>
                    <SelectItem value="entry">$5-15/hr</SelectItem>
                    <SelectItem value="intermediate">$15-35/hr</SelectItem>
                    <SelectItem value="expert">$35+/hr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">{filteredJobs.length} jobs found</span>
              </div>
            </div>

            {/* Job Listings */}
            <div className="space-y-4">
              {filteredJobs.map((job) => {
                const categoryInfo = getCategoryInfo(job.category);
                
                return (
                  <Card key={job.id} className="hover-elevate transition-all duration-300 cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-10 h-10 rounded-lg ${categoryInfo.color} flex items-center justify-center`}>
                              {(() => {
                                const IconComponent = categoryInfo.icon;
                                return <IconComponent className="w-5 h-5 text-white" />;
                              })()}
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                                {job.title}
                              </h3>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="font-medium">{job.company}</span>
                                {job.verified && (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                )}
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-[hsl(var(--gold-yellow))] fill-current" />
                                  <span className="text-sm">{job.rating} ({job.reviewCount})</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{job.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{job.postedAt}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{job.applicants} proposals</span>
                            </div>
                          </div>

                          <p className="text-muted-foreground mb-4 line-clamp-2">
                            {job.description}
                          </p>

                          <div className="flex flex-wrap gap-2 mb-4">
                            {job.skills.slice(0, 5).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {job.skills.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{job.skills.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 ml-6">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              ${job.budget.type === "hourly" 
                                ? `${job.budget.min}-${job.budget.max}/hr` 
                                : `${job.budget.min.toLocaleString()}`
                              }
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {job.budget.type === "fixed" ? "Fixed price" : "Hourly rate"}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge className={getJobTypeColor(job.type)}>
                              {job.type.replace("-", " ")}
                            </Badge>
                            {job.urgent && (
                              <Badge variant="destructive" className="text-xs">
                                Urgent
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Heart className="w-4 h-4" />
                            </Button>
                            <Button size="sm" data-testid={`apply-job-${job.id}`}>
                              Apply Now
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {!jobsLoading && !jobsError && filteredJobs.length === 0 && (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
                  <Search className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Try adjusting your search criteria or browse different categories to find opportunities that match your skills.
                </p>
                <Button 
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedLocation("all");
                    setSelectedJobType("all");
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workCategories.map((category) => {
                const jobsInCategory = allJobs.filter(job => job.category === category.id);
                const averageBudget = jobsInCategory.length > 0 
                  ? Math.round(jobsInCategory.reduce((sum, job) => sum + job.budget.min, 0) / jobsInCategory.length)
                  : 0;

                return (
                  <Card key={category.id} className="hover-elevate transition-all duration-300 cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center`}>
                          {(() => {
                            const IconComponent = category.icon;
                            return <IconComponent className="w-6 h-6 text-white" />;
                          })()}
                        </div>
                        <Badge variant="secondary">{jobsInCategory.length} jobs</Badge>
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {category.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Avg. Rate:</span>
                          <div className="font-semibold">${averageBudget}/hr</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Demand:</span>
                          <div className="font-semibold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-600" />
                            High
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Latest Jobs:</span>
                        {jobsInCategory.slice(0, 2).map((job) => (
                          <div key={job.id} className="p-2 bg-muted/30 rounded text-xs">
                            <div className="font-medium truncate">{job.title}</div>
                            <div className="text-muted-foreground">{job.company} • {job.postedAt}</div>
                          </div>
                        ))}
                      </div>
                      
                      <Button 
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setActiveTab("browse");
                        }}
                        className="w-full"
                      >
                        Browse {category.name}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Saved Jobs Tab */}
          <TabsContent value="saved" className="space-y-6">
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
                <Bookmark className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No saved jobs yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Save interesting job opportunities to review them later. Click the heart icon on any job to add it to your saved list.
              </p>
              <Button 
                onClick={() => setActiveTab("browse")}
                className="mt-4"
              >
                Browse Jobs
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}