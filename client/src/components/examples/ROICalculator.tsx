import { ROICalculator } from '../ROICalculator'

export default function ROICalculatorExample() {
  //todo: remove mock functionality - Using actual OnSpot metrics
  const mockData = {
    totalCostSavings: 50000000, // $50M value delivered since 2021
    previousCosts: 280000,
    currentCosts: 84000, // 70% cost savings
    timeToROI: 3, // Faster ROI with OnSpot
    teamProductivity: 85, // Employee NPS
    clientSatisfaction: 75 // Client NPS
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