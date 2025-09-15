import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface DashboardCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
  }
  subtitle?: string
  icon?: React.ReactNode
  className?: string
}

export function DashboardCard({ 
  title, 
  value, 
  change, 
  subtitle,
  icon,
  className 
}: DashboardCardProps) {
  const getTrendIcon = () => {
    if (!change) return null
    
    switch (change.type) {
      case 'increase':
        return <TrendingUp className="h-3 w-3" />
      case 'decrease':
        return <TrendingDown className="h-3 w-3" />
      default:
        return <Minus className="h-3 w-3" />
    }
  }

  const getTrendColor = () => {
    if (!change) return 'secondary'
    
    switch (change.type) {
      case 'increase':
        return 'default'
      case 'decrease':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <Card className={className} data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="h-4 w-4 text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-2xl font-bold" data-testid={`text-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        <div className="flex items-center gap-2 pt-1">
          {subtitle && (
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
          {change && (
            <Badge variant={getTrendColor()} className="text-xs">
              {getTrendIcon()}
              {change.value > 0 ? '+' : ''}{change.value}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}