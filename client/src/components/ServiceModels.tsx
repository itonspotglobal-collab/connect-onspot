import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, Star, Crown } from "lucide-react"

interface ServiceModelProps {
  title: string
  subtitle: string
  description: string
  features: string[]
  scaleRange: string
  outcome: string
  icon: React.ReactNode
  isPopular?: boolean
  onGetStarted?: () => void
}

function ServiceModelCard({ 
  title, 
  subtitle, 
  description, 
  features, 
  scaleRange, 
  outcome,
  icon,
  isPopular,
  onGetStarted 
}: ServiceModelProps) {
  const handleGetStarted = () => {
    console.log(`Get started with ${title} clicked`)
    onGetStarted?.()
  }

  return (
    <Card className={`relative ${isPopular ? 'border-primary shadow-lg' : ''} hover-elevate`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-1">
            <Star className="h-3 w-3 mr-1" />
            Best Value
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-2">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-muted-foreground font-medium">{subtitle}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">What You Get:</h4>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="pt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Scale Range:</span>
            <span className="text-muted-foreground">{scaleRange}</span>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-center">{outcome}</p>
          </div>
        </div>
        
        <Button 
          className="w-full" 
          variant={isPopular ? "default" : "outline"}
          onClick={handleGetStarted}
          data-testid={`button-get-started-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          Get Started
        </Button>
      </CardContent>
    </Card>
  )
}

export function ServiceModels() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl mb-2">Built for Scale, Not Stress</CardTitle>
        <p className="text-muted-foreground">
          Choose the level of support that fuels your vision
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ServiceModelCard
            title="RESOURCED"
            subtitle="You Manage"
            description="Founders who want cost savings and direct control"
            features={[
              "Flat FTE rate",
              "Best-in-class hires",
              "Dedicated account manager",
              "Standard support",
              "Direct control over operations"
            ]}
            scaleRange="1-20 FTE"
            outcome="💸 Lower costs, more control—but you handle performance"
            icon={<div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center"><Crown className="h-4 w-4 text-blue-600" /></div>}
          />
          
          <ServiceModelCard
            title="MANAGED"
            subtitle="We Manage Everything"
            description="Growth-focused leaders who want KPIs delivered without micro-managing"
            features={[
              "Everything in Resourced plus:",
              "Dedicated team manager",
              "We run your day-to-day ops",
              "Process building & 24/7 support",
              "Engagement & response management",
              "Follow-up strategy implementation",
              "KPI accountability"
            ]}
            scaleRange="5-50 FTE"
            outcome="⚡ Hands-off growth: predictable KPIs, faster scale, less stress"
            icon={<div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center"><Star className="h-4 w-4 text-green-600" /></div>}
            isPopular={true}
          />
          
          <ServiceModelCard
            title="ENTERPRISE"
            subtitle="Custom at Scale"
            description="Enterprises scaling 50+ FTEs with full customization"
            features={[
              "Everything in Managed plus:",
              "1,000+ FTE capacity",
              "Enterprise-level processes & reporting",
              "Dedicated campaign team",
              "Custom integrations",
              "Full customization"
            ]}
            scaleRange=">50 FTE"
            outcome="🏢 Enterprise-grade scalability with full customization"
            icon={<div className="h-8 w-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center"><Crown className="h-4 w-4 text-purple-600" /></div>}
          />
        </div>
      </CardContent>
    </Card>
  )
}