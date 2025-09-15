import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, MapPin, Clock } from "lucide-react"

interface TalentCardProps {
  id: string
  name: string
  role: string
  location: string
  hourlyRate: number
  rating: number
  skills: string[]
  avatarUrl?: string
  experience: string
  availability: 'available' | 'busy' | 'offline'
  onViewProfile?: (id: string) => void
  onContact?: (id: string) => void
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
  onViewProfile,
  onContact
}: TalentCardProps) {
  const getAvailabilityColor = () => {
    switch (availability) {
      case 'available':
        return 'bg-green-500'
      case 'busy':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const handleViewProfile = () => {
    console.log('View profile triggered for:', name)
    onViewProfile?.(id)
  }

  const handleContact = () => {
    console.log('Contact triggered for:', name)
    onContact?.(id)
  }

  return (
    <Card className="hover-elevate" data-testid={`card-talent-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatarUrl} alt={name} />
              <AvatarFallback>{name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div 
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getAvailabilityColor()}`}
              title={availability}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate" data-testid={`text-name-${id}`}>
              {name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {role}
            </p>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </div>
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
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{rating}</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold">${hourlyRate}</span>
            <span className="text-sm text-muted-foreground">/hr</span>
          </div>
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
          <Button 
            size="sm" 
            className="flex-1"
            onClick={handleContact}
            data-testid={`button-contact-${id}`}
          >
            Contact
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}