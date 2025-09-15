import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, Users, Clock } from "lucide-react"

interface ROIData {
  totalCostSavings: number
  previousCosts: number
  currentCosts: number
  timeToROI: number
  teamProductivity: number
  clientSatisfaction: number
}

interface ROICalculatorProps {
  data: ROIData
  period: string
}

export function ROICalculator({ data, period }: ROICalculatorProps) {
  const roiPercentage = Math.round(((data.previousCosts - data.currentCosts) / data.previousCosts) * 100)
  
  const handleCalculateROI = () => {
    console.log('ROI calculation triggered')
  }

  return (
    <Card data-testid="card-roi-calculator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          ROI Analysis - {period}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main ROI Display */}
        <div className="text-center p-6 bg-primary/10 rounded-lg">
          <div className="text-3xl font-bold text-primary mb-2">
            {roiPercentage}%
          </div>
          <p className="text-sm text-muted-foreground">Return on Investment</p>
          <Badge variant="default" className="mt-2">
            <DollarSign className="h-3 w-3 mr-1" />
            ${data.totalCostSavings.toLocaleString()} saved
          </Badge>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-lg font-semibold text-muted-foreground">
              ${data.previousCosts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Previous Costs</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-lg font-semibold text-primary">
              ${data.currentCosts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current Costs</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">{data.timeToROI}mo</div>
            <p className="text-xs text-muted-foreground">Time to ROI</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">{data.teamProductivity}%</div>
            <p className="text-xs text-muted-foreground">Productivity</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">{data.clientSatisfaction}%</div>
            <p className="text-xs text-muted-foreground">Satisfaction</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}