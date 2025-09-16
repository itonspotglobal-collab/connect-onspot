import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User,
  Briefcase,
  DollarSign,
  TrendingUp,
  Star,
  Award,
  MapPin,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  Play,
  CheckCircle2,
  Target,
  Calendar,
  MessageCircle,
  Bell,
  Settings,
  BarChart3,
  Filter,
  Search,
  Plus,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTalentProfile } from "@/hooks/useTalentProfile";
import ProfileOnboardingModal from "@/components/ProfileOnboardingModal";
import ProfileOnboarding from "@/components/ProfileOnboarding";

interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: number;
  salaryType: "hourly" | "fixed";
  currency: string;
  type: "full-time" | "part-time" | "contract";
  skills: string[];
  posted: string;
  matchScore: number;
}

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: "pending" | "reviewing" | "interview" | "accepted" | "rejected";
  appliedAt: string;
  lastUpdate: string;
}

interface Earning {
  id: string;
  projectTitle: string;
  client: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "processing";
  date: string;
}

export default function TalentPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [jobSearch, setJobSearch] = useState("");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  
  // Use real profile data from useTalentProfile hook
  const {
    profile,
    profileCompletion,
    isNewUser,
    hasCompletedOnboarding,
    isLoading: profileLoading
  } = useTalentProfile();

  // Show onboarding modal for new users
  useEffect(() => {
    if (user?.userType === 'talent' && isNewUser && !hasCompletedOnboarding) {
      const timer = setTimeout(() => setShowOnboardingModal(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user, isNewUser, hasCompletedOnboarding]);

  // Profile data from useTalentProfile hook, with fallbacks for display
  const displayProfile = {
    name: profile ? `${profile.firstName} ${profile.lastName}` : (user?.username || "John Doe"),
    title: profile?.title || "Professional",
    avatar: profile?.profilePicture || "",
    rating: profile?.rating ? parseFloat(profile.rating.toString()) : 0,
    reviewCount: 0, // Would come from reviews API
    location: profile?.location || "Global",
    hourlyRate: profile?.hourlyRate ? parseFloat(profile.hourlyRate.toString()) : 0,
    currency: profile?.rateCurrency || "USD",
    completedJobs: 0, // Would come from contracts API
    totalEarnings: profile?.totalEarnings ? parseFloat(profile.totalEarnings.toString()) : 0,
    profileCompletion,
    availability: profile?.availability || "available" as const,
    skills: [], // Would come from user skills API
    languages: profile?.languages || ["English"],
    responseTime: "Within 1 hour"
  };

  const mockJobOpportunities: JobOpportunity[] = [
    {
      id: "1",
      title: "Senior React Developer - E-commerce Platform",
      company: "TechStart Inc",
      location: "Remote",
      salary: 35,
      salaryType: "hourly",
      currency: "USD",
      type: "contract",
      skills: ["React", "TypeScript", "Node.js", "MongoDB"],
      posted: "2 hours ago",
      matchScore: 95
    },
    {
      id: "2", 
      title: "Full Stack Developer - Fintech App",
      company: "Financial Solutions",
      location: "Hybrid",
      salary: 4500,
      salaryType: "fixed",
      currency: "USD",
      type: "full-time",
      skills: ["React", "Python", "PostgreSQL", "AWS"],
      posted: "1 day ago",
      matchScore: 88
    },
    {
      id: "3",
      title: "Frontend Developer - Marketing Dashboard",
      company: "Marketing Pro",
      location: "Remote",
      salary: 28,
      salaryType: "hourly",
      currency: "USD",
      type: "part-time",
      skills: ["React", "TypeScript", "Tailwind", "Chart.js"],
      posted: "3 days ago",
      matchScore: 82
    }
  ];

  const mockApplications: Application[] = [
    {
      id: "1",
      jobId: "1",
      jobTitle: "Senior React Developer",
      company: "TechStart Inc",
      status: "interview",
      appliedAt: "2024-12-10",
      lastUpdate: "2024-12-13"
    },
    {
      id: "2",
      jobId: "2", 
      jobTitle: "Full Stack Developer",
      company: "Financial Solutions",
      status: "reviewing",
      appliedAt: "2024-12-08",
      lastUpdate: "2024-12-12"
    }
  ];

  const mockEarnings: Earning[] = [
    {
      id: "1",
      projectTitle: "E-commerce Website",
      client: "Digital Store Co",
      amount: 2500,
      currency: "USD",
      status: "paid",
      date: "2024-12-01"
    },
    {
      id: "2",
      projectTitle: "Mobile App Development",
      client: "App Innovations",
      amount: 1800,
      currency: "USD", 
      status: "processing",
      date: "2024-12-10"
    },
    {
      id: "3",
      projectTitle: "Website Redesign",
      client: "Creative Agency",
      amount: 3200,
      currency: "USD",
      status: "pending",
      date: "2024-12-15"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "reviewing": return "bg-blue-100 text-blue-800";
      case "interview": return "bg-purple-100 text-purple-800";
      case "accepted": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "paid": return "bg-green-100 text-green-800";
      case "processing": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredJobs = mockJobOpportunities.filter(job =>
    job.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
    job.company.toLowerCase().includes(jobSearch.toLowerCase()) ||
    job.skills.some(skill => skill.toLowerCase().includes(jobSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={displayProfile.avatar} />
                  <AvatarFallback>{displayProfile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold">{displayProfile.name}</h1>
                  <p className="text-muted-foreground">{displayProfile.title}</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-[hsl(var(--gold-yellow)/0.8)] fill-current" />
                  <span className="font-medium">{displayProfile.rating || 'N/A'}</span>
                  <span className="text-muted-foreground">({displayProfile.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{displayProfile.location}</span>
                </div>
                <Badge variant={displayProfile.availability === "available" ? "default" : "secondary"}>
                  {displayProfile.availability === "available" ? "Available" : "Busy"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {profileCompletion < 70 && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setShowOnboardingModal(true)}
                  data-testid="button-complete-profile"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Complete Profile ({profileCompletion}%)
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Bell className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="applications" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          {/* Overview Dashboard */}
          <TabsContent value="overview" className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Earnings</p>
                      <p className="text-2xl font-bold">${displayProfile.totalEarnings.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completed Jobs</p>
                      <p className="text-2xl font-bold">{displayProfile.completedJobs}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold">{displayProfile.rating || 0}/5.0</p>
                    </div>
                    <Star className="w-8 h-8 text-[hsl(var(--gold-yellow)/0.8)]" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Profile Completion</p>
                      <p className="text-2xl font-bold">{displayProfile.profileCompletion}%</p>
                    </div>
                    <User className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Completion Progress (for incomplete profiles) */}
            {profileCompletion < 100 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Complete Your Profile</h3>
                        <p className="text-sm text-muted-foreground">
                          {profileCompletion}% complete • Boost your chances of getting hired
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setShowOnboardingModal(true)}
                      data-testid="button-complete-profile-card"
                    >
                      Continue Setup
                    </Button>
                  </div>
                  <Progress value={profileCompletion} className="h-2" />
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>Get started</span>
                    <span>Profile complete</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">Application reviewed</p>
                      <p className="text-sm text-muted-foreground">TechStart Inc - Senior React Developer</p>
                    </div>
                    <span className="text-xs text-muted-foreground">2h ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">Payment received</p>
                      <p className="text-sm text-muted-foreground">$2,500 from Digital Store Co</p>
                    </div>
                    <span className="text-xs text-muted-foreground">1d ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Star className="w-5 h-5 text-[hsl(var(--gold-yellow)/0.8)]" />
                    <div className="flex-1">
                      <p className="font-medium">New review received</p>
                      <p className="text-sm text-muted-foreground">5-star rating from Creative Agency</p>
                    </div>
                    <span className="text-xs text-muted-foreground">3d ago</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Recommended for You
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mockJobOpportunities.slice(0, 2).map((job) => (
                    <div key={job.id} className="p-4 border rounded-lg hover-elevate transition-all cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold mb-1">{job.title}</h4>
                          <p className="text-sm text-muted-foreground">{job.company} • {job.location}</p>
                        </div>
                        <Badge variant="secondary">{job.matchScore}% match</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium">
                            ${job.salary}{job.salaryType === "hourly" ? "/hr" : " fixed"}
                          </span>
                        </div>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full">
                    View All Opportunities →
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Job Opportunities */}
          <TabsContent value="opportunities" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Job Opportunities</h2>
                <p className="text-muted-foreground">Discover jobs matched to your skills</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-job-search"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <Card key={job.id} className="hover-elevate transition-all cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{job.title}</h3>
                          <Badge variant="secondary">{job.matchScore}% match</Badge>
                        </div>
                        <p className="text-muted-foreground mb-3">{job.company} • {job.location}</p>
                        <div className="flex items-center gap-4 text-sm mb-4">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            <span className="font-medium">
                              ${job.salary}{job.salaryType === "hourly" ? "/hr" : " fixed"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{job.type}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Posted {job.posted}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {job.skills.map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-6">
                        <Button size="sm" data-testid={`apply-job-${job.id}`}>
                          Apply Now
                        </Button>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Applications */}
          <TabsContent value="applications" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">My Applications</h2>
                <p className="text-muted-foreground">Track your job application status</p>
              </div>
            </div>

            <div className="space-y-4">
              {mockApplications.map((application) => (
                <Card key={application.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{application.jobTitle}</h3>
                        <p className="text-muted-foreground mb-3">{application.company}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Applied {new Date(application.appliedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Updated {new Date(application.lastUpdate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(application.status)}>
                          {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Earnings */}
          <TabsContent value="earnings" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Earnings</h2>
                <p className="text-muted-foreground">Track your income and payments</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Earnings</div>
                <div className="text-3xl font-bold text-green-600">
                  ${displayProfile.totalEarnings.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {mockEarnings.map((earning) => (
                <Card key={earning.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{earning.projectTitle}</h3>
                        <p className="text-muted-foreground mb-3">{earning.client}</p>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(earning.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ${earning.amount.toLocaleString()}
                          </div>
                          <Badge className={getStatusColor(earning.status)}>
                            {earning.status.charAt(0).toUpperCase() + earning.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Profile */}
          <TabsContent value="profile" className="space-y-6">
            <ProfileOnboarding 
              mode="full"
              onComplete={() => {
                // Refresh profile data when onboarding is complete
                window.location.reload();
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile Onboarding Modal */}
      <ProfileOnboardingModal
        open={showOnboardingModal}
        onOpenChange={setShowOnboardingModal}
        onSkip={() => setShowOnboardingModal(false)}
        onComplete={() => setShowOnboardingModal(false)}
      />
    </div>
  );
}