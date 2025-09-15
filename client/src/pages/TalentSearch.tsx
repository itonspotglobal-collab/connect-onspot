import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Search, 
  MapPin, 
  DollarSign, 
  Star, 
  Clock, 
  Filter,
  User,
  CheckCircle2,
  Briefcase
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  location: string;
  skills: string[];
  availability: string;
  minRate: number;
  maxRate: number;
  rating: number;
}

const AVAILABILITY_OPTIONS = [
  { value: "all", label: "All Availability" },
  { value: "available", label: "Available Now" },
  { value: "busy", label: "Busy" },
  { value: "unavailable", label: "Not Available" }
];

const LOCATION_OPTIONS = [
  "Global", "Manila", "Cebu", "Davao", "Quezon City", "Makati", "Taguig", "Pasig", "Iloilo", "Bacolod"
];

const POPULAR_SKILLS = [
  "Virtual Assistant", "Customer Service", "Data Entry", "Lead Generation", 
  "Content Writing", "Social Media Management", "Graphic Design", "Web Development",
  "React", "Node.js", "WordPress", "Shopify", "QuickBooks", "SEO", "Google Ads"
];

export default function TalentSearch() {
  const [filters, setFilters] = useState<Filters>({
    location: "all",
    skills: [],
    availability: "all",
    minRate: 5,
    maxRate: 50,
    rating: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch profiles based on current filters
  const { data: profiles = [], isLoading, error } = useQuery<Profile[]>({
    queryKey: ["/api/profiles/search", filters],
    enabled: true // Always fetch, even with empty filters
  });

  // Fetch available skills for filter dropdown
  const { data: allSkills = [] } = useQuery<any[]>({
    queryKey: ["/api/skills"]
  });

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleSkill = (skill: string) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const clearFilters = () => {
    setFilters({
      location: "all",
      skills: [],
      availability: "all",
      minRate: 5,
      maxRate: 50,
      rating: 0
    });
    setSearchTerm("");
  };

  const getInitials = (title?: string) => {
    if (!title) return "T";
    return title.split(" ").map(word => word[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatCurrency = (amount?: string, currency?: string) => {
    if (!amount) return "Rate not specified";
    return `${currency === "PHP" ? "₱" : "$"}${amount}/hr`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">OnSpot Talent</h1>
          <p className="text-muted-foreground mt-2">
            Discover skilled professionals from our 500+ resource network
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
            Clear All
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by title, skills, or bio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-talent-search"
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
            <CardDescription>
              Refine your search to find the perfect talent match
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Location Filter */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={filters.location} onValueChange={(value) => handleFilterChange("location", value)}>
                  <SelectTrigger data-testid="select-location">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {LOCATION_OPTIONS.map(location => (
                      <SelectItem key={location} value={location}>{location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Availability Filter */}
              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Select value={filters.availability} onValueChange={(value) => handleFilterChange("availability", value)}>
                  <SelectTrigger data-testid="select-availability">
                    <SelectValue placeholder="All Availability" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Rating Filter */}
              <div className="space-y-2">
                <Label>Minimum Rating</Label>
                <Select value={filters.rating.toString()} onValueChange={(value) => handleFilterChange("rating", Number(value))}>
                  <SelectTrigger data-testid="select-rating">
                    <SelectValue placeholder="Any Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any Rating</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="4.5">4.5+ Stars</SelectItem>
                    <SelectItem value="4.8">4.8+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hourly Rate Range */}
            <div className="space-y-3">
              <Label>Hourly Rate Range: ${filters.minRate} - ${filters.maxRate}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Min Rate (${filters.minRate})</Label>
                  <Slider
                    value={[filters.minRate]}
                    onValueChange={(value) => handleFilterChange("minRate", value[0])}
                    max={100}
                    min={1}
                    step={1}
                    className="mt-2"
                    data-testid="slider-min-rate"
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Max Rate (${filters.maxRate})</Label>
                  <Slider
                    value={[filters.maxRate]}
                    onValueChange={(value) => handleFilterChange("maxRate", value[0])}
                    max={100}
                    min={1}
                    step={1}
                    className="mt-2"
                    data-testid="slider-max-rate"
                  />
                </div>
              </div>
            </div>

            {/* Skills Filter */}
            <div className="space-y-3">
              <Label>Skills ({filters.skills.length} selected)</Label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SKILLS.map(skill => (
                  <Badge
                    key={skill}
                    variant={filters.skills.includes(skill) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate"
                    onClick={() => toggleSkill(skill)}
                    data-testid={`skill-${skill.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {skill}
                    {filters.skills.includes(skill) && <CheckCircle2 className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium">
            {isLoading ? "Searching..." : `${profiles.length} Talented Professionals`}
          </h2>
          {filters.skills.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Filtered by:</span>
              {filters.skills.map(skill => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                  <button
                    onClick={() => toggleSkill(skill)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`remove-skill-${skill.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results Grid */}
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
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Search Error</h3>
              <p>There was an error loading talent profiles. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Results Found</h3>
              <p>Try adjusting your filters or search terms to find more talent.</p>
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile: Profile) => (
            <Card key={profile.id} className="hover-elevate transition-all duration-200" data-testid={`profile-${profile.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={profile.profilePicture} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(profile.title)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base leading-tight" data-testid={`profile-title-${profile.id}`}>
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
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3" data-testid={`profile-bio-${profile.id}`}>
                    {profile.bio}
                  </p>
                )}

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-primary font-medium">
                      <DollarSign className="w-3 h-3" />
                      <span data-testid={`profile-rate-${profile.id}`}>
                        {formatCurrency(profile.hourlyRate, profile.rateCurrency)}
                      </span>
                    </div>
                    {profile.availability && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className={`capitalize ${
                          profile.availability === "available" ? "text-green-600" : 
                          profile.availability === "busy" ? "text-yellow-600" : "text-gray-500"
                        }`}>
                          {profile.availability}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {profile.jobSuccessScore !== undefined && profile.jobSuccessScore > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Job Success:</span>
                      <span className="font-medium text-green-600">
                        {profile.jobSuccessScore}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" data-testid={`button-contact-${profile.id}`}>
                    <User className="w-3 h-3 mr-2" />
                    Contact
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-view-profile-${profile.id}`}>
                    View Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}