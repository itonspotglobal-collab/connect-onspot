import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Calendar, CheckCircle, Building, Users, Target, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// BPO Service Categories
const SERVICE_CATEGORIES = [
  { value: 'customer_support', label: 'Customer Support', icon: '💬', description: '24/7 dedicated support teams' },
  { value: 'virtual_assistants', label: 'Virtual Assistants', icon: '👥', description: 'Executive and administrative support' },
  { value: 'technical_support', label: 'Technical Support', icon: '🔧', description: 'IT and technical assistance' },
  { value: 'back_office', label: 'Back Office Support', icon: '📊', description: 'Data entry, processing, operations' },
  { value: 'sales_marketing', label: 'Sales & Marketing', icon: '📈', description: 'Lead generation and marketing support' },
  { value: 'design_creative', label: 'Design & Creative', icon: '🎨', description: 'Graphic design and creative services' },
];

// Multi-step form schema
const leadIntakeSchema = z.object({
  // Contact Information
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().min(2, 'Job title is required'),
  
  // Company Information  
  companyName: z.string().min(2, 'Company name is required'),
  companySize: z.string().min(1, 'Please select company size'),
  industry: z.string().min(2, 'Industry is required'),
  companyWebsite: z.string().optional(),
  
  // Service Requirements
  serviceType: z.string().min(1, 'Please select service type'),
  currentChallenges: z.string().min(20, 'Please describe your current challenges (minimum 20 characters)'),
  serviceVolume: z.string().optional(),
  requiredSkills: z.array(z.string()).default([]),
  
  // Project Scope
  urgencyLevel: z.string().min(1, 'Please select urgency level'),
  budgetRange: z.string().min(1, 'Please select budget range'),
  expectedStartDate: z.string().optional(),
  teamSize: z.string().optional(),
  
  // Qualification
  hasCurrentProvider: z.boolean().default(false),
  currentProviderDetails: z.string().optional(),
  decisionMakerStatus: z.string().min(1, 'Please select your role in decision making'),
  implementationTimeline: z.string().optional(),
  
  // Additional
  additionalNotes: z.string().optional(),
});

type FormData = z.infer<typeof leadIntakeSchema>;

const STEPS = [
  { id: 1, title: 'Contact Info', icon: Users, description: 'Tell us about yourself' },
  { id: 2, title: 'Company Details', icon: Building, description: 'About your organization' },
  { id: 3, title: 'Service Needs', icon: Target, description: 'What you need help with' },
  { id: 4, title: 'Project Scope', icon: Clock, description: 'Timeline and budget' },
  { id: 5, title: 'Schedule Call', icon: Calendar, description: 'Book your consultation' },
];

export default function LeadIntake() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(leadIntakeSchema),
    defaultValues: {
      hasCurrentProvider: false,
      requiredSkills: [],
    }
  });

  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fieldsToValidate);
    
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const getFieldsForStep = (step: number) => {
    switch (step) {
      case 1:
        return ['firstName', 'lastName', 'email', 'jobTitle'] as (keyof FormData)[];
      case 2:
        return ['companyName', 'companySize', 'industry'] as (keyof FormData)[];
      case 3:
        return ['serviceType', 'currentChallenges'] as (keyof FormData)[];
      case 4:
        return ['urgencyLevel', 'budgetRange', 'decisionMakerStatus'] as (keyof FormData)[];
      default:
        return [] as (keyof FormData)[];
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Build payload with snake_case field names matching database schema
      const payload = {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone_number: data.phoneNumber,
        job_title: data.jobTitle,
        company_name: data.companyName,
        company_size: data.companySize,
        industry: data.industry,
        company_website: data.companyWebsite,
        service_type: data.serviceType,
        current_challenges: data.currentChallenges,
        service_volume: data.serviceVolume,
        required_skills: data.requiredSkills,
        urgency_level: data.urgencyLevel,
        budget_range: data.budgetRange,
        expected_start_date: data.expectedStartDate,
        team_size: data.teamSize,
        has_current_provider: data.hasCurrentProvider,
        current_provider_details: data.currentProviderDetails,
        decision_maker_status: data.decisionMakerStatus,
        implementation_timeline: data.implementationTimeline,
        additional_notes: data.additionalNotes
      };

      const response = await fetch('/api/lead-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Thank you for your interest. We'll contact you within 24 hours.",
        });
        setCurrentStep(5); // Go to scheduling step
      } else {
        // Parse server error response for specific error message
        let errorMessage = "Something went wrong. Please try again.";
        try {
          const errorResponse = await response.json();
          console.error('Server error response:', errorResponse);
          errorMessage = errorResponse.message || errorResponse.error || errorMessage;
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Network or JSON parsing error:', error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Get Started with OnSpot</h1>
            <p className="text-muted-foreground">Tell us about your needs and we'll create a custom solution for you</p>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>Step {currentStep} of {STEPS.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-center space-x-4 mb-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className={`flex flex-col items-center space-y-2 ${isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-green-600 text-white' : 'bg-muted'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs font-medium">{step.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {(() => {
                  const StepIcon = STEPS[currentStep - 1].icon;
                  return <StepIcon className="w-6 h-6" />;
                })()}
                <span>{STEPS[currentStep - 1].title}</span>
              </CardTitle>
              <CardDescription>
                {STEPS[currentStep - 1].description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Step 1: Contact Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" data-testid="label-first-name">First Name *</Label>
                      <Input 
                        id="firstName"
                        data-testid="input-first-name"
                        {...form.register('firstName')}
                        placeholder="Your first name"
                        autoComplete="given-name"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="lastName" data-testid="label-last-name">Last Name *</Label>
                      <Input 
                        id="lastName"
                        data-testid="input-last-name"
                        {...form.register('lastName')}
                        placeholder="Your last name"
                        autoComplete="family-name"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email" data-testid="label-email">Business Email *</Label>
                    <Input 
                      id="email"
                      data-testid="input-email"
                      type="email"
                      {...form.register('email')}
                      placeholder="your.email@company.com"
                      autoComplete="email"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phoneNumber" data-testid="label-phone">Phone Number</Label>
                      <Input 
                        id="phoneNumber"
                        data-testid="input-phone"
                        type="tel"
                        {...form.register('phoneNumber')}
                        placeholder="+1 (555) 123-4567"
                        autoComplete="tel"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="jobTitle" data-testid="label-job-title">Job Title *</Label>
                      <Input 
                        id="jobTitle"
                        data-testid="input-job-title"
                        {...form.register('jobTitle')}
                        placeholder="CEO, Operations Manager, etc."
                        autoComplete="organization-title"
                      />
                      {form.formState.errors.jobTitle && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.jobTitle.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Company Information */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName" data-testid="label-company-name">Company Name *</Label>
                    <Input 
                      id="companyName"
                      data-testid="input-company-name"
                      {...form.register('companyName')}
                      placeholder="Your company name"
                    />
                    {form.formState.errors.companyName && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.companyName.message}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label data-testid="label-company-size">Company Size *</Label>
                      <Select onValueChange={(value) => form.setValue('companySize', value)}>
                        <SelectTrigger data-testid="select-company-size">
                          <SelectValue placeholder="Select company size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 employees</SelectItem>
                          <SelectItem value="11-50">11-50 employees</SelectItem>
                          <SelectItem value="51-200">51-200 employees</SelectItem>
                          <SelectItem value="201-500">201-500 employees</SelectItem>
                          <SelectItem value="500+">500+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.companySize && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.companySize.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="industry" data-testid="label-industry">Industry *</Label>
                      <Input 
                        id="industry"
                        data-testid="input-industry"
                        {...form.register('industry')}
                        placeholder="e.g., E-commerce, Healthcare, SaaS"
                      />
                      {form.formState.errors.industry && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.industry.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="companyWebsite" data-testid="label-website">Company Website</Label>
                    <Input 
                      id="companyWebsite"
                      data-testid="input-website"
                      {...form.register('companyWebsite')}
                      placeholder="https://yourcompany.com"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Service Requirements */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label data-testid="label-service-type">What service do you need? *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {SERVICE_CATEGORIES.map((service) => (
                        <div 
                          key={service.value}
                          className={`p-4 border rounded-lg cursor-pointer hover-elevate transition-all ${
                            form.watch('serviceType') === service.value ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                          onClick={() => form.setValue('serviceType', service.value)}
                          data-testid={`service-${service.value}`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{service.icon}</span>
                            <div>
                              <div className="font-medium">{service.label}</div>
                              <div className="text-sm text-muted-foreground">{service.description}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {form.formState.errors.serviceType && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.serviceType.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="currentChallenges" data-testid="label-challenges">What challenges are you currently facing? *</Label>
                    <Textarea 
                      id="currentChallenges"
                      data-testid="input-challenges"
                      {...form.register('currentChallenges')}
                      placeholder="Describe your current pain points, inefficiencies, or areas where you need support..."
                      rows={4}
                    />
                    {form.formState.errors.currentChallenges && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.currentChallenges.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="serviceVolume" data-testid="label-service-volume">Expected Service Volume</Label>
                    <Input 
                      id="serviceVolume"
                      data-testid="input-service-volume"
                      {...form.register('serviceVolume')}
                      placeholder="e.g., 40 hours/week, 200 calls/day, 50 tickets/day"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Project Scope */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label data-testid="label-urgency">How urgently do you need this? *</Label>
                      <Select onValueChange={(value) => form.setValue('urgencyLevel', value)}>
                        <SelectTrigger data-testid="select-urgency">
                          <SelectValue placeholder="Select urgency level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate (ASAP)</SelectItem>
                          <SelectItem value="within_month">Within 1 month</SelectItem>
                          <SelectItem value="within_quarter">Within 3 months</SelectItem>
                          <SelectItem value="planning">Just planning ahead</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.urgencyLevel && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.urgencyLevel.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label data-testid="label-budget">Monthly Budget Range *</Label>
                      <Select onValueChange={(value) => form.setValue('budgetRange', value)}>
                        <SelectTrigger data-testid="select-budget">
                          <SelectValue placeholder="Select budget range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="<5k">Less than $5,000</SelectItem>
                          <SelectItem value="5k-20k">$5,000 - $20,000</SelectItem>
                          <SelectItem value="20k-50k">$20,000 - $50,000</SelectItem>
                          <SelectItem value="50k+">$50,000+</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.budgetRange && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.budgetRange.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="teamSize" data-testid="label-team-size">How many resources do you need?</Label>
                      <Input 
                        id="teamSize"
                        data-testid="input-team-size"
                        {...form.register('teamSize')}
                        placeholder="e.g., 3-5 agents, 1 manager"
                      />
                    </div>
                    
                    <div>
                      <Label data-testid="label-decision-maker">Your role in decision making *</Label>
                      <Select onValueChange={(value) => form.setValue('decisionMakerStatus', value)}>
                        <SelectTrigger data-testid="select-decision-maker">
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="decision_maker">I make the final decision</SelectItem>
                          <SelectItem value="influencer">I influence the decision</SelectItem>
                          <SelectItem value="evaluator">I'm evaluating options</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.decisionMakerStatus && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.decisionMakerStatus.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hasCurrentProvider"
                      data-testid="checkbox-current-provider"
                      checked={form.watch('hasCurrentProvider')}
                      onCheckedChange={(checked) => form.setValue('hasCurrentProvider', !!checked)}
                    />
                    <Label htmlFor="hasCurrentProvider" className="text-sm">
                      We currently work with another outsourcing provider
                    </Label>
                  </div>
                  
                  {form.watch('hasCurrentProvider') && (
                    <div>
                      <Label htmlFor="currentProviderDetails" data-testid="label-provider-details">Tell us about your current provider</Label>
                      <Textarea 
                        id="currentProviderDetails"
                        data-testid="input-provider-details"
                        {...form.register('currentProviderDetails')}
                        placeholder="What's working/not working with your current setup?"
                        rows={3}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="additionalNotes" data-testid="label-additional-notes">Additional Notes</Label>
                    <Textarea 
                      id="additionalNotes"
                      data-testid="input-additional-notes"
                      {...form.register('additionalNotes')}
                      placeholder="Anything else you'd like us to know?"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Success/Scheduling */}
              {currentStep === 5 && (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
                    <p className="text-muted-foreground mb-4">
                      We've received your information! Ready to take the next step?
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg mb-6">
                      <p className="text-sm text-muted-foreground">
                        <strong>What's next?</strong><br/>
                        Schedule your free consultation call with our BPO experts. We'll review your requirements and prepare a custom solution proposal tailored to your needs.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <Button 
                      variant="default"
                      size="lg"
                      className="w-full"
                      onClick={() => window.open('https://calendar.app.google/your-calendar-link', '_blank')}
                      data-testid="button-schedule-call"
                    >
                      <Calendar className="w-5 h-5 mr-2" />
                      Schedule Your Free Consultation
                    </Button>
                    
                    <div className="text-sm text-muted-foreground">
                      Or our team will contact you within 24 hours
                    </div>
                    
                    <Button 
                      variant="outline"
                      onClick={() => window.location.href = '/'}
                      data-testid="button-back-home"
                    >
                      Back to Home
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
            
            {/* Navigation Buttons */}
            {currentStep < 5 && (
              <div className="flex justify-between p-6 pt-0">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  data-testid="button-prev"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                
                {currentStep < 4 ? (
                  <Button 
                    type="button"
                    onClick={nextStep}
                    data-testid="button-next"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit & Schedule Call'}
                    <Calendar className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </Card>
        </form>
      </div>
    </div>
  );
}