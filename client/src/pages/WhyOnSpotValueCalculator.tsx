import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { 
  Calculator,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  Target,
  Award,
  BarChart3,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Download,
  Settings,
  Shield
} from "lucide-react";

export default function WhyOnSpotValueCalculator() {
  // Input states
  const [currentTeamSize, setCurrentTeamSize] = useState<number>(5);
  const [avgSalary, setAvgSalary] = useState<number>(65000);
  const [benefits, setBenefits] = useState<number>(30);
  const [overhead, setOverhead] = useState<number>(25);
  const [outsourcePercentage, setOutsourcePercentage] = useState<number[]>([50]);
  const [location, setLocation] = useState<string>("us");
  const [department, setDepartment] = useState<string>("customer-support");
  const [growthRate, setGrowthRate] = useState<number>(20);
  const [timeHorizon, setTimeHorizon] = useState<number>(12);

  // Location-based salary adjustments
  const locationMultipliers = {
    us: 1.0,
    europe: 0.85,
    australia: 0.95,
    canada: 0.85
  };

  // Department-based OnSpot rates (annual)
  const onspotRates = {
    "customer-support": 18000,
    "technical-support": 25000,
    "virtual-assistant": 15000,
    "data-entry": 12000,
    "sales-support": 22000,
    "back-office": 20000,
    "accounting": 28000,
    "marketing": 24000,
    "hr": 26000,
    "development": 35000
  };

  // Calculate comprehensive ROI and value
  const calculations = useMemo(() => {
    const locationMultiplier = locationMultipliers[location as keyof typeof locationMultipliers];
    const adjustedSalary = avgSalary * locationMultiplier;
    const benefitsCost = adjustedSalary * (benefits / 100);
    const overheadCost = adjustedSalary * (overhead / 100);
    const totalCostPerEmployee = adjustedSalary + benefitsCost + overheadCost;
    
    const positionsToOutsource = Math.round(currentTeamSize * (outsourcePercentage[0] / 100));
    const onspotRate = onspotRates[department as keyof typeof onspotRates];
    
    // Current costs
    const currentAnnualCost = currentTeamSize * totalCostPerEmployee;
    const outsourcedPositionsCost = positionsToOutsource * totalCostPerEmployee;
    const remainingInHouseCost = (currentTeamSize - positionsToOutsource) * totalCostPerEmployee;
    
    // OnSpot costs
    const onspotAnnualCost = positionsToOutsource * (onspotRate + 2400); // Base rate + $200/month management fee
    const totalNewAnnualCost = remainingInHouseCost + onspotAnnualCost;
    
    // Savings and ROI
    const annualSavings = currentAnnualCost - totalNewAnnualCost;
    const savingsPercentage = (annualSavings / currentAnnualCost) * 100;
    const roi = ((annualSavings) / onspotAnnualCost) * 100;
    
    // Time horizon projections
    const totalSavings = annualSavings * (timeHorizon / 12);
    const compoundedSavings = annualSavings * (timeHorizon / 12) * (1 + growthRate / 100);
    
    // Additional value metrics
    const timeToValue = 21; // days
    const productivityGain = positionsToOutsource * 0.25 * totalCostPerEmployee; // 25% productivity increase
    const qualityImprovement = 0.15; // 15% quality improvement
    const scalabilityValue = annualSavings * 0.30; // 30% of savings from scalability
    const riskReduction = totalCostPerEmployee * positionsToOutsource * 0.05; // 5% risk reduction value
    
    // Total value beyond cost savings
    const totalValueBeyondSavings = productivityGain + scalabilityValue + riskReduction;
    const totalAnnualValue = annualSavings + totalValueBeyondSavings;
    const totalValueROI = (totalAnnualValue / onspotAnnualCost) * 100;
    
    return {
      currentAnnualCost,
      onspotAnnualCost,
      totalNewAnnualCost,
      annualSavings,
      savingsPercentage,
      roi,
      totalSavings,
      compoundedSavings,
      positionsToOutsource,
      timeToValue,
      productivityGain,
      qualityImprovement,
      scalabilityValue,
      riskReduction,
      totalValueBeyondSavings,
      totalAnnualValue,
      totalValueROI
    };
  }, [currentTeamSize, avgSalary, benefits, overhead, outsourcePercentage, location, department, growthRate, timeHorizon]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="hero-investor text-white pt-28 pb-20 px-4 text-center overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:80px_80px]" />
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-8">
            <Calculator className="w-4 h-4" />
            ROI & Value Calculator
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            Calculate Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Value Return
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
            Discover the comprehensive value and ROI you'll achieve by outsourcing with OnSpot - beyond just cost savings
          </p>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Input Form */}
            <Card className="sticky top-8 h-fit">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Settings className="w-6 h-6 text-primary" />
                  Your Current Situation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="team-size" data-testid="label-team-size">Current Team Size</Label>
                    <Input
                      id="team-size"
                      type="number"
                      value={currentTeamSize}
                      onChange={(e) => setCurrentTeamSize(Number(e.target.value))}
                      data-testid="input-team-size"
                    />
                  </div>
                  <div>
                    <Label htmlFor="avg-salary" data-testid="label-avg-salary">Average Annual Salary</Label>
                    <Input
                      id="avg-salary"
                      type="number"
                      value={avgSalary}
                      onChange={(e) => setAvgSalary(Number(e.target.value))}
                      data-testid="input-avg-salary"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location" data-testid="label-location">Location</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger data-testid="select-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="europe">Europe</SelectItem>
                      <SelectItem value="australia">Australia</SelectItem>
                      <SelectItem value="canada">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="department" data-testid="label-department">Department/Role Type</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger data-testid="select-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer-support">Customer Support</SelectItem>
                      <SelectItem value="technical-support">Technical Support</SelectItem>
                      <SelectItem value="virtual-assistant">Virtual Assistant</SelectItem>
                      <SelectItem value="data-entry">Data Entry</SelectItem>
                      <SelectItem value="sales-support">Sales Support</SelectItem>
                      <SelectItem value="back-office">Back Office</SelectItem>
                      <SelectItem value="accounting">Accounting</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="hr">Human Resources</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="benefits" data-testid="label-benefits">Benefits Cost (%)</Label>
                    <Input
                      id="benefits"
                      type="number"
                      value={benefits}
                      onChange={(e) => setBenefits(Number(e.target.value))}
                      data-testid="input-benefits"
                    />
                  </div>
                  <div>
                    <Label htmlFor="overhead" data-testid="label-overhead">Overhead Cost (%)</Label>
                    <Input
                      id="overhead"
                      type="number"
                      value={overhead}
                      onChange={(e) => setOverhead(Number(e.target.value))}
                      data-testid="input-overhead"
                    />
                  </div>
                </div>

                <div>
                  <Label data-testid="label-outsource-percentage">Positions to Outsource: {outsourcePercentage[0]}%</Label>
                  <div className="mt-2">
                    <Slider
                      value={outsourcePercentage}
                      onValueChange={setOutsourcePercentage}
                      max={100}
                      step={10}
                      className="w-full"
                      data-testid="slider-outsource-percentage"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="growth-rate" data-testid="label-growth-rate">Expected Growth Rate (%)</Label>
                    <Input
                      id="growth-rate"
                      type="number"
                      value={growthRate}
                      onChange={(e) => setGrowthRate(Number(e.target.value))}
                      data-testid="input-growth-rate"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time-horizon" data-testid="label-time-horizon">Time Horizon (months)</Label>
                    <Input
                      id="time-horizon"
                      type="number"
                      value={timeHorizon}
                      onChange={(e) => setTimeHorizon(Number(e.target.value))}
                      data-testid="input-time-horizon"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-8">
              {/* Key Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary" />
                    Your OnSpot Value Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                      <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
                      <div className="text-3xl font-bold text-primary mb-1">
                        {formatCurrency(calculations.annualSavings)}
                      </div>
                      <div className="text-sm text-muted-foreground">Annual Cost Savings</div>
                      <Badge className="mt-2 bg-green-100 text-green-800">
                        {formatPercentage(calculations.savingsPercentage)} savings
                      </Badge>
                    </div>
                    
                    <div className="text-center p-6 bg-gradient-to-br from-[hsl(var(--gold-yellow))]/10 to-[hsl(var(--gold-yellow))]/5 rounded-lg">
                      <TrendingUp className="w-8 h-8 text-[hsl(var(--gold-yellow))] mx-auto mb-2" />
                      <div className="text-3xl font-bold text-[hsl(var(--gold-yellow))] mb-1">
                        {formatPercentage(calculations.totalValueROI)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Value ROI</div>
                      <Badge className="mt-2 bg-[hsl(var(--gold-yellow))]/20 text-[hsl(var(--gold-yellow))]">
                        Beyond cost savings
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Cost Analysis Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="font-medium text-muted-foreground mb-1">Current Annual Cost</div>
                      <div className="text-xl font-bold">{formatCurrency(calculations.currentAnnualCost)}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="font-medium text-muted-foreground mb-1">New Annual Cost</div>
                      <div className="text-xl font-bold">{formatCurrency(calculations.totalNewAnnualCost)}</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="font-medium text-green-700 mb-1">Positions Outsourced</div>
                      <div className="text-xl font-bold text-green-800">{calculations.positionsToOutsource}</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="font-medium text-blue-700 mb-1">Time to Value</div>
                      <div className="text-xl font-bold text-blue-800">{calculations.timeToValue} days</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Value Beyond Savings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    Value Beyond Cost Savings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="font-medium">Productivity Gain (25%)</span>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(calculations.productivityGain)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="font-medium">Scalability Value</span>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(calculations.scalabilityValue)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <span className="font-medium">Risk Reduction</span>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(calculations.riskReduction)}</span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center font-bold">
                        <span>Total Annual Value</span>
                        <span className="text-xl text-primary">{formatCurrency(calculations.totalAnnualValue)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Projection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    {timeHorizon}-Month Projection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-gradient-to-br from-primary/5 to-muted/5 rounded-lg">
                    <div className="text-4xl font-bold text-primary mb-2">
                      {formatCurrency(calculations.compoundedSavings)}
                    </div>
                    <div className="text-muted-foreground mb-4">
                      Total projected value including {growthRate}% growth factor
                    </div>
                    <div className="flex justify-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">Base Savings</div>
                        <div className="text-muted-foreground">{formatCurrency(calculations.totalSavings)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">Growth Value</div>
                        <div className="text-muted-foreground">{formatCurrency(calculations.compoundedSavings - calculations.totalSavings)}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA */}
              <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold mb-4">Ready to Realize These Savings?</h3>
                  <p className="text-muted-foreground mb-6">
                    Start your OnSpot journey and begin seeing value in just {calculations.timeToValue} days
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" className="text-lg px-8 py-6" data-testid="button-get-started">
                      Get Started Today
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button variant="outline" size="lg" className="text-lg px-8 py-6" data-testid="button-download-report">
                      <Download className="w-5 h-5 mr-2" />
                      Download Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}