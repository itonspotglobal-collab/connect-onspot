import { PerformanceChart } from '../PerformanceChart'

export default function PerformanceChartExample() {
  //todo: remove mock functionality
  const mockData = [
    { period: 'Jan', productivity: 78, satisfaction: 85, costSavings: 12000 },
    { period: 'Feb', productivity: 82, satisfaction: 88, costSavings: 15000 },
    { period: 'Mar', productivity: 79, satisfaction: 86, costSavings: 18000 },
    { period: 'Apr', productivity: 85, satisfaction: 91, costSavings: 22000 },
    { period: 'May', productivity: 88, satisfaction: 93, costSavings: 25000 },
    { period: 'Jun', productivity: 91, satisfaction: 95, costSavings: 28000 }
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
      <PerformanceChart
        data={mockData}
        type="line"
        title="Team Productivity"
        metric="productivity"
      />
      <PerformanceChart
        data={mockData}
        type="line"
        title="Client Satisfaction"
        metric="satisfaction"
      />
      <PerformanceChart
        data={mockData}
        type="bar"
        title="Monthly Savings"
        metric="costSavings"
      />
    </div>
  )
}