import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Clock,
  Target,
  Award,
  BarChart3,
  Zap,
  ArrowRight,
  Download,
  Settings,
  Shield,
} from "lucide-react";

export default function WhyOnSpotValueCalculator() {
  // Input states
  const [currentTeamSize, setCurrentTeamSize] = useState<number>(5);
  const [avgSalary, setAvgSalary] = useState<number>(65000);
  const [benefits, setBenefits] = useState<number>(30);
  const [overhead, setOverhead] = useState<number>(25);
  const [outsourcePercentage, setOutsourcePercentage] = useState<number[]>([
    50,
  ]);
  const [location, setLocation] = useState<string>("us");
  const [department, setDepartment] = useState<string>("customer-support");
  const [growthRate, setGrowthRate] = useState<number>(20);
  const [timeHorizon, setTimeHorizon] = useState<number>(12);

  // NEW: Additional location granularity
  const [country, setCountry] = useState<string>("United States");
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState<string>("");

  // Location-based salary adjustments
  const locationMultipliers = {
    us: 1.0,
    europe: 0.85,
    australia: 0.95,
    canada: 0.85,
  };

  // Department-based OnSpot rates (annual)
  const onspotRates = {
    "customer-support": 18000,
    "technical-support": 25000,
    "virtual-assistant": 15000,
    "data-entry": 12000,
    "sales-support": 22000,
    "back-office": 20000,
    accounting: 28000,
    marketing: 24000,
    hr: 26000,
    development: 35000,
  };

  // Calculate ROI and value
  const calculations = useMemo(() => {
    const locationMultiplier =
      locationMultipliers[location as keyof typeof locationMultipliers];
    const adjustedSalary = avgSalary * locationMultiplier;
    const benefitsCost = adjustedSalary * (benefits / 100);
    const overheadCost = adjustedSalary * (overhead / 100);
    const totalCostPerEmployee = adjustedSalary + benefitsCost + overheadCost;

    const positionsToOutsource = Math.round(
      currentTeamSize * (outsourcePercentage[0] / 100),
    );
    const onspotRate = onspotRates[department as keyof typeof onspotRates];

    // Current costs
    const currentAnnualCost = currentTeamSize * totalCostPerEmployee;
    const remainingInHouseCost =
      (currentTeamSize - positionsToOutsource) * totalCostPerEmployee;

    // OnSpot costs
    const onspotAnnualCost = positionsToOutsource * (onspotRate + 2400); // base + mgmt fee
    const totalNewAnnualCost = remainingInHouseCost + onspotAnnualCost;

    // Savings and ROI
    const annualSavings = currentAnnualCost - totalNewAnnualCost;
    const savingsPercentage = (annualSavings / currentAnnualCost) * 100;
    const roi = (annualSavings / onspotAnnualCost) * 100;

    // Projections
    const totalSavings = annualSavings * (timeHorizon / 12);
    const compoundedSavings =
      annualSavings * (timeHorizon / 12) * (1 + growthRate / 100);

    // Value beyond cost savings
    const timeToValue = 21; // days
    const productivityGain = positionsToOutsource * 0.25 * totalCostPerEmployee;
    const scalabilityValue = annualSavings * 0.3;
    const riskReduction = totalCostPerEmployee * positionsToOutsource * 0.05;
    const totalValueBeyondSavings =
      productivityGain + scalabilityValue + riskReduction;
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
      scalabilityValue,
      riskReduction,
      totalValueBeyondSavings,
      totalAnnualValue,
      totalValueROI,
    };
  }, [
    currentTeamSize,
    avgSalary,
    benefits,
    overhead,
    outsourcePercentage,
    location,
    department,
    growthRate,
    timeHorizon,
  ]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

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
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full mb-8">
            <Calculator className="w-4 h-4" />
            ROI & Value Calculator
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8">
            Calculate Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Value Return
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto">
            Discover the comprehensive value and ROI you'll achieve by
            outsourcing with OnSpot
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
                    <Label htmlFor="team-size">Current Team Size</Label>
                    <Input
                      id="team-size"
                      type="number"
                      value={currentTeamSize}
                      onChange={(e) =>
                        setCurrentTeamSize(Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="avg-salary">Average Annual Salary</Label>
                    <Input
                      id="avg-salary"
                      type="number"
                      value={avgSalary}
                      onChange={(e) => setAvgSalary(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Location (Region)</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger>
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

                {/* NEW: Country, State, City */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. United States"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. California"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Los Angeles"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="department">Department/Role Type</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer-support">
                        Customer Support
                      </SelectItem>
                      <SelectItem value="technical-support">
                        Technical Support
                      </SelectItem>
                      <SelectItem value="virtual-assistant">
                        Virtual Assistant
                      </SelectItem>
                      <SelectItem value="data-entry">Data Entry</SelectItem>
                      <SelectItem value="sales-support">
                        Sales Support
                      </SelectItem>
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
                    <Label htmlFor="benefits">Benefits Cost (%)</Label>
                    <Input
                      id="benefits"
                      type="number"
                      value={benefits}
                      onChange={(e) => setBenefits(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="overhead">Overhead Cost (%)</Label>
                    <Input
                      id="overhead"
                      type="number"
                      value={overhead}
                      onChange={(e) => setOverhead(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    Positions to Outsource: {outsourcePercentage[0]}%
                  </Label>
                  <Slider
                    value={outsourcePercentage}
                    onValueChange={setOutsourcePercentage}
                    max={100}
                    step={10}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="growth-rate">
                      Expected Growth Rate (%)
                    </Label>
                    <Input
                      id="growth-rate"
                      type="number"
                      value={growthRate}
                      onChange={(e) => setGrowthRate(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time-horizon">Time Horizon (months)</Label>
                    <Input
                      id="time-horizon"
                      type="number"
                      value={timeHorizon}
                      onChange={(e) => setTimeHorizon(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results (unchanged) */}
            <div className="space-y-8">
              {/* ... keep your results and cards exactly as before ... */}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
