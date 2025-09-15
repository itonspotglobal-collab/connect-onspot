import { ROICalculator } from '../ROICalculator'

export default function ROICalculatorExample() {
  //todo: remove mock functionality
  const mockData = {
    totalCostSavings: 145000,
    previousCosts: 280000,
    currentCosts: 135000,
    timeToROI: 6,
    teamProductivity: 91,
    clientSatisfaction: 95
  }

  return (
    <div className="p-4 max-w-md">
      <ROICalculator 
        data={mockData}
        period="Q4 2024"
      />
    </div>
  )
}