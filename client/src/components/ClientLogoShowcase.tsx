import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Star, 
  Users, 
  TrendingUp, 
  CheckCircle2,
  Crown,
  Award,
  Globe,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustBadge } from "@/components/TrustBadges";

export interface ClientLogo {
  id: string;
  name: string;
  logo: string;
  website?: string;
  industry?: string;
  size?: "startup" | "scale-up" | "enterprise" | "fortune-500";
  verificationLevel: "basic" | "business" | "enterprise";
  projectCount?: number;
  totalValue?: number;
  rating?: number;
  featured?: boolean;
  testimonialId?: string;
}

const defaultClients: ClientLogo[] = [
  {
    id: "1",
    name: "TechForward Solutions",
    logo: "/api/placeholder/120/60",
    website: "https://techforward.com",
    industry: "Technology",
    size: "scale-up",
    verificationLevel: "business",
    projectCount: 8,
    totalValue: 45000,
    rating: 4.9,
    featured: true
  },
  {
    id: "2",
    name: "DataDrive Analytics",
    logo: "/api/placeholder/120/60",
    website: "https://datadrive.com",
    industry: "Analytics",
    size: "enterprise",
    verificationLevel: "enterprise",
    projectCount: 12,
    totalValue: 78000,
    rating: 5.0,
    featured: true
  },
  {
    id: "3",
    name: "GrowthMax Agency",
    logo: "/api/placeholder/120/60",
    website: "https://growthmax.com",
    industry: "Marketing",
    size: "scale-up",
    verificationLevel: "business",
    projectCount: 6,
    totalValue: 32000,
    rating: 4.8,
    featured: false
  },
  {
    id: "4",
    name: "InnovateLab",
    logo: "/api/placeholder/120/60",
    website: "https://innovatelab.com",
    industry: "R&D",
    size: "enterprise",
    verificationLevel: "enterprise",
    projectCount: 15,
    totalValue: 95000,
    rating: 4.9,
    featured: true
  },
  {
    id: "5",
    name: "CloudScale Systems",
    logo: "/api/placeholder/120/60",
    website: "https://cloudscale.com",
    industry: "Cloud Computing",
    size: "fortune-500",
    verificationLevel: "enterprise",
    projectCount: 20,
    totalValue: 150000,
    rating: 5.0,
    featured: true
  },
  {
    id: "6",
    name: "NextGen Fintech",
    logo: "/api/placeholder/120/60",
    website: "https://nextgenfintech.com",
    industry: "Financial Technology",
    size: "scale-up",
    verificationLevel: "business",
    projectCount: 10,
    totalValue: 65000,
    rating: 4.7,
    featured: false
  },
  {
    id: "7",
    name: "HealthTech Innovations",
    logo: "/api/placeholder/120/60",
    website: "https://healthtech.com",
    industry: "Healthcare",
    size: "enterprise",
    verificationLevel: "enterprise",
    projectCount: 18,
    totalValue: 120000,
    rating: 4.9,
    featured: true
  },
  {
    id: "8",
    name: "EcoSmart Solutions",
    logo: "/api/placeholder/120/60",
    website: "https://ecosmart.com",
    industry: "Sustainability",
    size: "startup",
    verificationLevel: "basic",
    projectCount: 4,
    totalValue: 18000,
    rating: 4.6,
    featured: false
  }
];

export interface ClientLogoShowcaseProps {
  clients?: ClientLogo[];
  variant?: "logos" | "detailed" | "featured" | "stats";
  title?: string;
  subtitle?: string;
  showStats?: boolean;
  showVerification?: boolean;
  maxVisible?: number;
  columns?: 3 | 4 | 5 | 6;
  className?: string;
}

export function ClientLogoShowcase({
  clients = defaultClients,
  variant = "logos",
  title = "Trusted by Leading Companies",
  subtitle = "Join 300+ companies building amazing teams through OnSpot",
  showStats = false,
  showVerification = true,
  maxVisible = 8,
  columns = 4,
  className
}: ClientLogoShowcaseProps) {
  const visibleClients = clients.slice(0, maxVisible);
  const featuredClients = clients.filter(client => client.featured);

  const getClientSizeIcon = (size: ClientLogo["size"]) => {
    switch (size) {
      case "fortune-500":
        return <Crown className="h-4 w-4 text-gold-yellow" />;
      case "enterprise":
        return <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "scale-up":
        return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSizeLabel = (size: ClientLogo["size"]) => {
    switch (size) {
      case "fortune-500": return "Fortune 500";
      case "enterprise": return "Enterprise";
      case "scale-up": return "Scale-up";
      default: return "Startup";
    }
  };

  const getGridCols = () => {
    switch (columns) {
      case 3: return "grid-cols-2 md:grid-cols-3";
      case 4: return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
      case 5: return "grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
      case 6: return "grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
      default: return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    }
  };

  if (variant === "logos") {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        
        <div className={cn("grid gap-4", getGridCols())}>
          {visibleClients.map((client) => (
            <Card 
              key={client.id} 
              className="hover-elevate group cursor-pointer transition-all duration-200"
              data-testid={`client-logo-${client.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-24 h-12 bg-muted/20 rounded flex items-center justify-center overflow-hidden">
                    <img 
                      src={client.logo} 
                      alt={`${client.name} logo`}
                      className="max-w-full max-h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="text-xs font-medium text-muted-foreground px-2 text-center">${client.name}</div>`;
                        }
                      }}
                    />
                  </div>
                  
                  <div className="text-center">
                    <div className="font-medium text-sm">{client.name}</div>
                    {client.industry && (
                      <div className="text-xs text-muted-foreground">{client.industry}</div>
                    )}
                  </div>
                  
                  {showVerification && (
                    <div className="flex items-center gap-1">
                      <TrustBadge 
                        variant={client.verificationLevel === "enterprise" ? "premium" : "verified"} 
                        size="sm" 
                        showLabel={false} 
                      />
                      {getClientSizeIcon(client.size)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {showStats && (
          <div className="text-center">
            <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {clients.length}+
                </div>
                <div className="text-sm text-muted-foreground">Trusted Clients</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(clients.reduce((sum, client) => sum + (client.rating || 0), 0) / clients.length * 10) / 10}
                </div>
                <div className="text-sm text-muted-foreground">Avg Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${Math.round(clients.reduce((sum, client) => sum + (client.totalValue || 0), 0) / 1000)}K+
                </div>
                <div className="text-sm text-muted-foreground">Projects Value</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "featured") {
    return (
      <div className={cn("space-y-8", className)}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Award className="h-6 w-6 text-gold-yellow" />
            <h2 className="text-2xl font-bold">Featured Success Stories</h2>
          </div>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredClients.slice(0, 6).map((client) => (
            <Card key={client.id} className="hover-elevate group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-20 h-10 bg-muted/20 rounded flex items-center justify-center">
                    <img 
                      src={client.logo} 
                      alt={`${client.name} logo`}
                      className="max-w-full max-h-full object-contain opacity-80"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="text-xs font-medium text-muted-foreground">${client.name}</div>`;
                        }
                      }}
                    />
                  </div>
                  <Badge variant="outline" className="bg-gold-yellow/10 text-gold-yellow-foreground border-gold-yellow/30">
                    Featured
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold">{client.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{client.industry}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        {getClientSizeIcon(client.size)}
                        <span>{getSizeLabel(client.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Projects</div>
                      <div className="font-semibold">{client.projectCount}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Value</div>
                      <div className="font-semibold">${(client.totalValue || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{client.rating}</span>
                    </div>
                    <TrustBadge 
                      variant={client.verificationLevel === "enterprise" ? "premium" : "verified"} 
                      size="sm" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "stats") {
    const totalProjects = clients.reduce((sum, client) => sum + (client.projectCount || 0), 0);
    const totalValue = clients.reduce((sum, client) => sum + (client.totalValue || 0), 0);
    const avgRating = clients.reduce((sum, client) => sum + (client.rating || 0), 0) / clients.length;
    const enterpriseClients = clients.filter(client => client.size === "enterprise" || client.size === "fortune-500").length;

    return (
      <Card className={cn("border-primary/20 bg-primary/5 dark:bg-primary/10", className)}>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Client Success Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-primary mb-1">
                {clients.length}+
              </div>
              <div className="text-sm text-muted-foreground">Active Clients</div>
            </div>
            
            <div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                {totalProjects}+
              </div>
              <div className="text-sm text-muted-foreground">Projects Completed</div>
            </div>
            
            <div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                ${Math.round(totalValue / 1000)}K+
              </div>
              <div className="text-sm text-muted-foreground">Total Project Value</div>
            </div>
            
            <div>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                {avgRating.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Average Rating</div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-gold-yellow" />
                <span>{enterpriseClients} Enterprise Clients</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>100% Payment Protected</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleClients.map((client) => (
          <Card key={client.id} className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-muted/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src={client.logo} 
                    alt={`${client.name} logo`}
                    className="max-w-full max-h-full object-contain opacity-80"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="text-xs font-medium text-muted-foreground text-center">${client.name}</div>`;
                      }
                    }}
                  />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{client.name}</h3>
                      <div className="text-sm text-muted-foreground">{client.industry}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {client.rating && (
                        <>
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{client.rating}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <div className="text-muted-foreground">Projects</div>
                      <div className="font-medium">{client.projectCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Value</div>
                      <div className="font-medium">${(client.totalValue || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {getClientSizeIcon(client.size)}
                      <span className="text-xs text-muted-foreground">{getSizeLabel(client.size)}</span>
                    </div>
                    <TrustBadge 
                      variant={client.verificationLevel === "enterprise" ? "premium" : "verified"} 
                      size="sm" 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}