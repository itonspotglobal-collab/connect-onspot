import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface PerformanceData {
  period: string
  productivity: number
  satisfaction: number
  costSavings: number
}

interface PerformanceChartProps {
  data: PerformanceData[]
  type?: 'line' | 'bar'
  title: string
  metric: keyof Omit<PerformanceData, 'period'>
}

export function PerformanceChart({ 
  data, 
  type = 'line', 
  title, 
  metric 
}: PerformanceChartProps) {
  const getColor = () => {
    switch (metric) {
      case 'productivity':
        return '#3b82f6' // blue
      case 'satisfaction':
        return '#10b981' // green  
      case 'costSavings':
        return '#8b5cf6' // purple
      default:
        return '#6b7280' // gray
    }
  }

  return (
    <Card data-testid={`chart-${metric}`}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'line' ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Line 
                  type="monotone" 
                  dataKey={metric} 
                  stroke={getColor()}
                  strokeWidth={2}
                  dot={{ fill: getColor(), strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Bar dataKey={metric} fill={getColor()} radius={2} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}