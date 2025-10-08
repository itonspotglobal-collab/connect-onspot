import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Clock } from "lucide-react";
import {
  TrustBadge,
  TrustScore,
  QuickTrustIndicators,
} from "@/components/TrustBadges";
import { QualityBadge, QualityStats } from "@/components/QualityIndicators";

interface TalentCardProps {
  id: string;
  name: string;
  role: string;
  location: string;
  hourlyRate: number;
  rating: number;
  skills: string[];
  avatarUrl?: string;
  experience: string;
  availability: "available" | "busy" | "offline";
  verified?: boolean;
  featured?: boolean;
  topRated?: boolean;
  paymentProtected?: boolean;
  qualityScore?: number;
  successRate?: number;
  onTimeDelivery?: number;
  totalProjects?: number;
  onViewProfile?: (id: string) => void;
  onContact?: (id: string) => void;
}

export function TalentCard({
  id,
  name,
  role,
  location,
  hourlyRate,
  rating,
  skills,
  avatarUrl,
  experience,
  availability,
  verified = true,
  featured = false,
  topRated = false,
  paymentProtected = true,
  qualityScore = 92,
  successRate = 98,
  onTimeDelivery = 95,
  totalProjects = 24,
  onViewProfile,
  onContact,
}: TalentCardProps) {
  const getAvailabilityColor = () => {
    switch (availability) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleViewProfile = () => {
    console.log("View profile triggered for:", name);
    onViewProfile?.(id);
  };

  const handleContact = () => {
    console.log("Contact triggered for:", name);
    onContact?.(id);
  };

  return (
    <Card className="hover-elevate" data-testid={`card-talent-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatarUrl} alt={name} />
              <AvatarFallback>
                {name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getAvailabilityColor()}`}
              title={availability}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3
                className="font-semibold truncate"
                data-testid={`text-name-${id}`}
              >
                {name}
              </h3>
              <QuickTrustIndicators
                showVerified={verified}
                showTopRated={topRated}
                showFeatured={featured}
                size="sm"
              />
            </div>
            <p className="text-sm text-muted-foreground truncate">{role}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"></div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {experience}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-3">
          <TrustScore
            score={rating}
            maxScore={5}
            label={`${rating} (${totalProjects} projects)`}
            size="sm"
            showStars={true}
          />
        </div>

        {/* Quality indicators */}
        <div className="grid grid-cols-3 gap-2 text-center mb-3 p-2 bg-muted/20 rounded-lg">
          <div>
            <div className="text-sm font-semibold text-green-600 dark:text-green-400">
              {successRate}%
            </div>
            <div className="text-xs text-muted-foreground">Performance</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {onTimeDelivery}%
            </div>
            <div className="text-xs text-muted-foreground">Attendance</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
              {qualityScore}
            </div>
            <div className="text-xs text-muted-foreground">Quality</div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {verified && <TrustBadge variant="verified" size="sm" />}
          {topRated && <QualityBadge variant="top-rated" size="sm" />}
          {featured && <QualityBadge variant="featured" size="sm" />}
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
          {skills.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{skills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleViewProfile}
            data-testid={`button-view-profile-${id}`}
          >
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
