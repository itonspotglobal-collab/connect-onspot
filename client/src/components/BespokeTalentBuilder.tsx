import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Users,
  DollarSign,
  Clock,
  Shield,
  Target,
  Download,
  Calendar,
  Globe,
  Zap,
  TrendingUp,
  Award,
  MessageSquare,
  Settings,
  FileText,
  PieChart,
  AlertTriangle
} from "lucide-react";

interface FormData {
  issues: string;
  budget: string;
  customBudget: string;
  timeline: string;
  managementType: 'onspot' | 'direct';
  timezone: string;
  security: string[];
  toolsLanguages: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface ProposalData {
  recommendedRoles: Array<{
    role: string;
    count: number;
    description: string;
    monthlyCost: number;
  }>;
  totalMonthlyCost: number;
  estimatedSavings: number;
  timeline: Array<{
    phase: string;
    duration: string;
    activities: string[];
  }>;
  risks: Array<{
    risk: string;
    mitigation: string;
  }>;
}

const BUDGET_RANGES = [
  { value: '<2k', label: 'Under $2,000', numeric: 2000 },
  { value: '2k-5k', label: '$2,000 - $5,000', numeric: 5000 },
  { value: '5k-10k', label: '$5,000 - $10,000', numeric: 10000 },
  { value: '10k+', label: '$10,000+', numeric: 15000 },
  { value: 'custom', label: 'Custom Amount', numeric: 0 }
];

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'ASAP (0-2 weeks)', description: 'Urgent need for immediate results' },
  { value: 'soon', label: 'Soon (1 month)', description: 'Important but can wait for right fit' },
  { value: 'flexible', label: 'Flexible (2-3 months)', description: 'Strategic initiative with planning time' }
];

const TIMEZONE_OPTIONS = [
  { value: 'us-east', label: 'US Eastern Time' },
  { value: 'us-central', label: 'US Central Time' },
  { value: 'us-west', label: 'US Pacific Time' },
  { value: 'europe', label: 'European Time' },
  { value: 'asia-pacific', label: 'Asia Pacific' },
  { value: 'flexible', label: 'Flexible / Asynchronous' }
];

const SECURITY_OPTIONS = [
  { value: 'nda', label: 'Non-Disclosure Agreement Required' },
  { value: 'restricted-data', label: 'Restricted Data Handling' },
  { value: 'compliance', label: 'Industry Compliance (HIPAA, SOX, etc.)' },
  { value: 'background-check', label: 'Background Check Required' }
];

export default function BespokeTalentBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    issues: '',
    budget: '',
    customBudget: '',
    timeline: '',
    managementType: 'onspot',
    timezone: '',
    security: [],
    toolsLanguages: '',
    contactName: '',
    contactEmail: '',
    contactPhone: ''
  });

  const totalSteps = 5; // Introduction + 4 main steps
  const progress = ((currentStep) / (totalSteps - 1)) * 100;

  // Generate dynamic proposal based on current form data
  const generateProposal = (): ProposalData => {
    const budgetValue = formData.budget === 'custom' 
      ? parseFloat(formData.customBudget) || 0
      : BUDGET_RANGES.find(b => b.value === formData.budget)?.numeric || 0;

    // AI-like logic to suggest roles based on issues mentioned
    const suggestedRoles = [];
    const issues = formData.issues.toLowerCase();

    if (issues.includes('customer') || issues.includes('support') || issues.includes('service')) {
      suggestedRoles.push({
        role: 'Customer Support Specialists',
        count: Math.max(1, Math.floor(budgetValue / 2000)),
        description: 'Handle customer inquiries, resolve issues, manage support tickets',
        monthlyCost: Math.min(budgetValue * 0.4, budgetValue)
      });
    }

    if (issues.includes('lead') || issues.includes('sales') || issues.includes('marketing')) {
      suggestedRoles.push({
        role: 'Sales & Marketing Specialists',
        count: Math.max(1, Math.floor(budgetValue / 2500)),
        description: 'Lead generation, sales outreach, marketing campaign management',
        monthlyCost: Math.min(budgetValue * 0.35, budgetValue)
      });
    }

    if (issues.includes('admin') || issues.includes('data') || issues.includes('process') || issues.includes('virtual')) {
      suggestedRoles.push({
        role: 'Virtual Assistants',
        count: Math.max(1, Math.floor(budgetValue / 1800)),
        description: 'Administrative tasks, data management, process optimization',
        monthlyCost: Math.min(budgetValue * 0.3, budgetValue)
      });
    }

    if (issues.includes('tech') || issues.includes('development') || issues.includes('it')) {
      suggestedRoles.push({
        role: 'Technical Support',
        count: Math.max(1, Math.floor(budgetValue / 3000)),
        description: 'Technical troubleshooting, system maintenance, user support',
        monthlyCost: Math.min(budgetValue * 0.45, budgetValue)
      });
    }

    // Default suggestion if no specific matches
    if (suggestedRoles.length === 0) {
      suggestedRoles.push({
        role: 'General Virtual Assistants',
        count: Math.max(1, Math.floor(budgetValue / 2000)),
        description: 'Flexible support across various business functions',
        monthlyCost: Math.min(budgetValue * 0.4, budgetValue)
      });
    }

    const totalMonthlyCost = suggestedRoles.reduce((sum, role) => sum + role.monthlyCost, 0);
    const estimatedSavings = Math.floor(totalMonthlyCost * 2.3); // Show 70% savings

    const timeline = [
      {
        phase: 'Discovery & Matching',
        duration: '72 hours',
        activities: [
          'Analyze your requirements in detail',
          'Source qualified candidates from our talent pool',
          'Present initial candidate profiles'
        ]
      },
      {
        phase: 'Interviews & Selection',
        duration: 'Week 1-2',
        activities: [
          'Coordinate interviews with top candidates',
          'Skills assessments and reference checks',
          'Final selection and offer negotiation'
        ]
      },
      {
        phase: 'Onboarding & Integration',
        duration: 'Week 3',
        activities: [
          'System access and security setup',
          'Process training and documentation',
          'Integration with your existing team'
        ]
      },
      {
        phase: 'Ongoing Success',
        duration: 'Month 1+',
        activities: [
          'Performance monitoring and optimization',
          'Regular check-ins and adjustments',
          'Continuous improvement initiatives'
        ]
      }
    ];

    const risks = [
      {
        risk: 'Communication barriers due to timezone differences',
        mitigation: 'Structured handoff processes and overlap hours scheduling'
      },
      {
        risk: 'Integration challenges with existing systems',
        mitigation: 'Dedicated technical onboarding and system training'
      },
      {
        risk: 'Quality consistency across team members',
        mitigation: 'Standardized processes, regular training, and performance monitoring'
      }
    ];

    return {
      recommendedRoles: suggestedRoles,
      totalMonthlyCost,
      estimatedSavings,
      timeline,
      risks
    };
  };

  const proposal = generateProposal();

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSecurityChange = (value: string, checked: boolean) => {
    if (checked) {
      updateFormData('security', [...formData.security, value]);
    } else {
      updateFormData('security', formData.security.filter(s => s !== value));
    }
  };

  const handleSubmit = () => {
    // Handle form submission - integrate with backend or show success message
    console.log('Form submitted:', formData);
    alert('Thank you! We will contact you within 24 hours with your custom proposal.');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-4xl font-bold">
                Not sure which talent you need?
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Tell us your challenges, and we'll build a custom solution for you. 
                Our experts will match the perfect team to your specific needs and budget.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <Card className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <Target className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Tailored Solutions</h3>
                  <p className="text-sm text-muted-foreground">
                    Custom team compositions based on your specific business needs
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Rapid Deployment</h3>
                  <p className="text-sm text-muted-foreground">
                    Candidate profiles in 72 hours, full team deployed in 21 days
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Proven Results</h3>
                  <p className="text-sm text-muted-foreground">
                    Up to 70% cost savings with 96% client satisfaction rate
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Button onClick={handleNext} size="lg" className="px-8 mt-8" data-testid="button-start-builder">
              Start Building My Team
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">What problems are you trying to solve?</h2>
              <p className="text-muted-foreground">
                Describe your challenges in detail. The more specific you are, the better we can help.
              </p>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <Textarea
                  placeholder="Examples:
• Our lead generation process is broken - we need more qualified prospects
• Customer support response times are too slow, customers are complaining  
• Administrative processes are chaotic, team spending too much time on data entry
• Marketing campaigns aren't converting, need better audience targeting
• Technical support tickets are overwhelming our in-house team

Tell us about your specific situation..."
                  value={formData.issues}
                  onChange={(e) => updateFormData('issues', e.target.value)}
                  className="min-h-[200px] text-base"
                  data-testid="textarea-issues"
                />
                
                <div className="mt-4 text-sm text-muted-foreground">
                  <strong>Tip:</strong> Include details about current volume, pain points, and what success looks like for you.
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">What's your ideal monthly budget?</h2>
              <p className="text-muted-foreground">
                This helps us recommend the right team size and skill level for your needs.
              </p>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {BUDGET_RANGES.map((range) => (
                    <div
                      key={range.value}
                      onClick={() => updateFormData('budget', range.value)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover-elevate ${
                        formData.budget === range.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      }`}
                      data-testid={`budget-option-${range.value}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{range.label}</span>
                        {formData.budget === range.value && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {formData.budget === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Custom Monthly Budget</label>
                    <Input
                      type="number"
                      placeholder="Enter amount in USD"
                      value={formData.customBudget}
                      onChange={(e) => updateFormData('customBudget', e.target.value)}
                      className="text-lg"
                      data-testid="input-custom-budget"
                    />
                  </div>
                )}
                
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Typical clients save up to 70% compared to in-house hiring
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">When do you need results?</h2>
              <p className="text-muted-foreground">
                Understanding your timeline helps us prioritize and plan the deployment process.
              </p>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4 mb-6">
                  {TIMELINE_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => updateFormData('timeline', option.value)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover-elevate ${
                        formData.timeline === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      }`}
                      data-testid={`timeline-option-${option.value}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        </div>
                        {formData.timeline === option.value && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      We can have candidate profiles ready in 72 hours
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Additional Considerations</h2>
              <p className="text-muted-foreground">
                Help us understand your preferences for collaboration, security, and technical requirements.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Management Style</CardTitle>
                  <CardDescription>How would you like to work with your team?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div
                      onClick={() => updateFormData('managementType', 'onspot')}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover-elevate ${
                        formData.managementType === 'onspot'
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                      data-testid="management-onspot"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${formData.managementType === 'onspot' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="font-medium">Managed by OnSpot</div>
                          <div className="text-sm text-muted-foreground">We handle team management, performance, and operations</div>
                        </div>
                      </div>
                    </div>
                    
                    <div
                      onClick={() => updateFormData('managementType', 'direct')}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover-elevate ${
                        formData.managementType === 'direct'
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                      data-testid="management-direct"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${formData.managementType === 'direct' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="font-medium">Direct Hire</div>
                          <div className="text-sm text-muted-foreground">You manage the team directly with OnSpot support</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Time Zone Preference</CardTitle>
                  <CardDescription>What time zone overlap do you prefer?</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={formData.timezone} onValueChange={(value) => updateFormData('timezone', value)}>
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue placeholder="Select preferred timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Requirements</CardTitle>
                <CardDescription>Select any security or compliance requirements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SECURITY_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.value}
                        checked={formData.security.includes(option.value)}
                        onCheckedChange={(checked) => handleSecurityChange(option.value, !!checked)}
                        data-testid={`security-${option.value}`}
                      />
                      <label htmlFor={option.value} className="text-sm font-medium cursor-pointer">
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tools & Languages</CardTitle>
                <CardDescription>Any specific tools, technologies, or languages required?</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Examples: Salesforce, HubSpot, Python, Spanish fluency, Adobe Creative Suite..."
                  value={formData.toolsLanguages}
                  onChange={(e) => updateFormData('toolsLanguages', e.target.value)}
                  className="min-h-[100px]"
                  data-testid="textarea-tools-languages"
                />
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="py-16 bg-gradient-to-br from-muted/30 via-background to-muted/30" id="bespoke-talent-builder">
      <div className="container mx-auto px-4">
        {/* Progress Indicator */}
        {currentStep > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="text-sm text-muted-foreground">
                Step {currentStep} of {totalSteps - 1}
              </div>
            </div>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden">
              <CardContent className="p-8">
                {renderStep()}
                
                {/* Navigation Buttons */}
                {currentStep > 0 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t">
                    <Button 
                      variant="outline" 
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                      data-testid="button-previous"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    
                    {currentStep < totalSteps - 1 ? (
                      <Button 
                        onClick={handleNext}
                        disabled={currentStep === 1 && !formData.issues.trim()}
                        data-testid="button-next"
                      >
                        Next
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input
                            placeholder="Your Name"
                            value={formData.contactName}
                            onChange={(e) => updateFormData('contactName', e.target.value)}
                            data-testid="input-contact-name"
                          />
                          <Input
                            type="email"
                            placeholder="Email Address"
                            value={formData.contactEmail}
                            onChange={(e) => updateFormData('contactEmail', e.target.value)}
                            data-testid="input-contact-email"
                          />
                          <Input
                            type="tel"
                            placeholder="Phone (Optional)"
                            value={formData.contactPhone}
                            onChange={(e) => updateFormData('contactPhone', e.target.value)}
                            data-testid="input-contact-phone"
                          />
                        </div>
                        
                        <div className="flex gap-3">
                          <Button 
                            onClick={handleSubmit}
                            className="flex-1"
                            disabled={!formData.contactName.trim() || !formData.contactEmail.trim()}
                            data-testid="button-submit-proposal"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Book a Call to Finalize
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => console.log('Download proposal')}
                            data-testid="button-download-proposal"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Proposal
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dynamic Proposal Preview */}
          {currentStep > 1 && (
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Your Bespoke Proposal
                  </CardTitle>
                  <CardDescription>
                    Live preview based on your inputs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Your Stated Issues */}
                  {formData.issues && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Your Challenges
                      </h4>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        {formData.issues.substring(0, 150)}
                        {formData.issues.length > 150 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  {/* Recommended Roles */}
                  {proposal.recommendedRoles.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Recommended Team
                      </h4>
                      <div className="space-y-2">
                        {proposal.recommendedRoles.map((role, index) => (
                          <div key={index} className="text-sm border-l-2 border-primary pl-3">
                            <div className="font-medium">{role.count}x {role.role}</div>
                            <div className="text-muted-foreground text-xs">{role.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing Snapshot */}
                  {formData.budget && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        Investment Overview
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Monthly Team Cost:</span>
                          <span className="font-medium">${proposal.totalMonthlyCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>vs. In-house Cost:</span>
                          <span className="font-medium">${proposal.estimatedSavings.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-medium text-green-600">
                          <span>Monthly Savings:</span>
                          <span>${(proposal.estimatedSavings - proposal.totalMonthlyCost).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline Preview */}
                  {formData.timeline && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Deployment Timeline
                      </h4>
                      <div className="space-y-2 text-sm">
                        {proposal.timeline.slice(0, 2).map((phase, index) => (
                          <div key={index} className="border-l-2 border-muted pl-3">
                            <div className="font-medium">{phase.phase}</div>
                            <div className="text-muted-foreground text-xs">{phase.duration}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Risk Mitigations */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      Risk Mitigation
                    </h4>
                    <div className="space-y-2 text-sm">
                      {proposal.risks.slice(0, 2).map((item, index) => (
                        <div key={index} className="border-l-2 border-orange-300 pl-3">
                          <div className="font-medium text-orange-600">{item.risk}</div>
                          <div className="text-muted-foreground text-xs">{item.mitigation}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Badge className="w-full justify-center py-2">
                      <Award className="w-3 h-3 mr-1" />
                      96% Client Satisfaction Rate
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}