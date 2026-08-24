import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { trackPilotActivity } from "@/lib/pilotConfig";
import { 
  Briefcase, 
  DollarSign, 
  Clock, 
  MapPin, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { type Job } from "@shared/schema";

interface JobApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  onSuccess?: () => void;
}

// The modal keeps its compact legacy form, but submits through the canonical
// job application endpoint.
const applicationFormSchema = z.object({
  coverLetter: z.string()
    .min(50, "Cover letter must be at least 50 characters")
    .max(2000, "Cover letter must be less than 2000 characters"),
  proposedRate: z.coerce.number()
    .min(1, "Rate must be greater than $0")
    .max(1000, "Rate cannot exceed $1000/hour")
    .optional(),
  proposedBudget: z.coerce.number()
    .min(10, "Budget must be at least $10")
    .max(100000, "Budget cannot exceed $100,000")
    .optional(),
  estimatedDuration: z.string()
    .max(200, "Duration description must be less than 200 characters")
    .optional(),
  phone: z.string()
    .min(3, "Phone number is required"),
});

type ApplicationFormData = z.infer<typeof applicationFormSchema>;

export default function JobApplicationModal({ 
  open, 
  onOpenChange, 
  job, 
  onSuccess 
}: JobApplicationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      coverLetter: "",
      proposedRate: undefined,
      proposedBudget: undefined,
      estimatedDuration: "",
      phone: "",
    },
  });

  // Submit through the canonical job-application flow. The old proposals API
  // was retired; this route creates the linked job_submission record.
  const submitApplication = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      if (!job || !user) {
        throw new Error("Missing job or user information");
      }

      const token = localStorage.getItem("onspot_jwt_token") || (() => {
        try {
          const raw = localStorage.getItem("talent_profile_token");
          return raw ? (JSON.parse(raw) as { token?: string }).token || null : null;
        } catch {
          return null;
        }
      })();
      const formData = new FormData();
      const firstName = user.firstName?.trim() || "OnSpot";
      const lastName = user.lastName?.trim() || "Talent";
      formData.set("firstName", firstName);
      formData.set("lastName", lastName);
      formData.set("email", user.email);
      formData.set("phone", data.phone.trim());
      formData.set("coverLetter", data.coverLetter.trim());
      if (job.engagementType === "Lite" && data.proposedRate !== undefined) {
        formData.set("proposedRate", String(data.proposedRate));
      }
      if (job.engagementType === "Standard" && data.proposedBudget !== undefined) {
        formData.set("proposedBudget", String(data.proposedBudget));
      }
      if (data.estimatedDuration) {
        formData.set("estimatedDuration", data.estimatedDuration.trim());
      }

      const response = await fetch(`/api/jobs/${job.id}/apply`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }
      return response.json();
    },
    onSuccess: () => {
      trackPilotActivity("appliedToJob");
      // Invalidate queries to refresh job data and applications
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/search'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['talent-applications'] });
      }
      
      toast({
        title: "Application submitted successfully!",
        description: "Your application has been sent to the client. You'll be notified of any updates.",
      });

      // Reset form and close modal
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Application submission failed:', error);
      
      let title = "Application failed";
      let description = "There was an error submitting your application. Please try again.";
      
      // Handle specific HTTP status error cases (from apiRequest error format)
      if (error.message.includes('409:')) {
        title = "Already Applied";
        description = "You have already submitted an application for this job.";
      } else if (error.message.includes('401:')) {
        title = "Authentication Required";
        description = "Please log in to submit an application.";
        // Redirect to login after showing toast
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 2000);
      } else if (error.message.includes('400:') && error.message.includes('Validation')) {
        title = "Validation Error";
        description = "Please check your form inputs and try again.";
      }
      
      toast({
        variant: "destructive",
        title,
        description,
      });
    },
  });

  const onSubmit = async (data: ApplicationFormData) => {
    if (!job || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please make sure you're logged in and try again.",
      });
      return;
    }

    // Validate contract-specific fields
    if (job.engagementType === 'Lite' && (data.proposedRate === undefined || data.proposedRate === null)) {
      form.setError('proposedRate', {
        type: 'required',
        message: 'Rate expectation is required for Lite roles'
      });
      return;
    }

    if (job.engagementType === 'Standard' && (data.proposedBudget === undefined || data.proposedBudget === null)) {
      form.setError('proposedBudget', {
        type: 'required', 
        message: 'Proposed budget is required for Standard roles'
      });
      return;
    }

    // Use mutation's isPending state instead of local state
    await submitApplication.mutateAsync(data);
  };

  const formatBudgetRange = (job: Job) => {
    const budget = job.budget ? parseFloat(job.budget.toString()) : 0;
    return budget ? `$${budget.toLocaleString()} ${job.budgetCurrency || 'USD'}` : 'Budget negotiable';
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Apply for Job
          </DialogTitle>
          <DialogDescription>
            Submit your proposal for this opportunity. Make sure to highlight your relevant experience.
          </DialogDescription>
        </DialogHeader>

        {/* Job Summary */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-lg">{job.title}</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>{formatBudgetRange(job)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{job.engagementType}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>Remote</span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {job.experienceLevel} level
          </Badge>
          {job.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {job.description}
            </p>
          )}
        </div>

        <Separator />

        {/* Application Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Cover Letter */}
          <div className="space-y-2">
            <Label htmlFor="coverLetter" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Cover Letter *
            </Label>
            <Textarea
              id="coverLetter"
              placeholder="Explain why you're the perfect fit for this job. Include relevant experience, skills, and how you plan to approach this project..."
              className="min-h-[150px] resize-none"
              data-testid="textarea-cover-letter"
              {...form.register('coverLetter')}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {form.formState.errors.coverLetter?.message && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {form.formState.errors.coverLetter.message}
                  </span>
                )}
              </span>
              <span>{form.watch('coverLetter')?.length || 0}/2000</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="application-phone">Phone *</Label>
            <Input
              id="application-phone"
              type="tel"
              placeholder="+1 555 123 4567"
              data-testid="input-application-phone"
              {...form.register('phone')}
            />
            {form.formState.errors.phone && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {form.formState.errors.phone.message}
              </p>
            )}
          </div>

          {/* Rate/Budget Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.engagementType === 'Lite' ? (
              <div className="space-y-2">
                <Label htmlFor="proposedRate">Your Rate Expectation *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="proposedRate"
                    type="number"
                    step="0.01"
                    min="1"
                    max="1000"
                    placeholder="25.00"
                    className="pl-9"
                    data-testid="input-proposed-rate"
                    {...form.register('proposedRate', { valueAsNumber: true })}
                  />
                </div>
                {form.formState.errors.proposedRate && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {form.formState.errors.proposedRate.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Client budget: {formatBudgetRange(job)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="proposedBudget">Your Proposed Budget * (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="proposedBudget"
                    type="number"
                    step="0.01"
                    min="10"
                    max="100000"
                    placeholder="1500.00"
                    className="pl-9"
                    data-testid="input-proposed-budget"
                    {...form.register('proposedBudget', { valueAsNumber: true })}
                  />
                </div>
                {form.formState.errors.proposedBudget && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {form.formState.errors.proposedBudget.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Client budget: {formatBudgetRange(job)}
                </p>
              </div>
            )}

            {/* Estimated Duration */}
            <div className="space-y-2">
              <Label htmlFor="estimatedDuration">Estimated Duration</Label>
              <Input
                id="estimatedDuration"
                placeholder="e.g., 2-3 weeks, 1 month, etc."
                data-testid="input-estimated-duration"
                {...form.register('estimatedDuration')}
              />
              {form.formState.errors.estimatedDuration && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {form.formState.errors.estimatedDuration.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Help the client understand your timeline
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={submitApplication.isPending}
              data-testid="button-cancel-application"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitApplication.isPending}
              data-testid="button-submit-application"
            >
              {submitApplication.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Tips */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Tips for a successful application:</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Personalize your cover letter to the specific job requirements</li>
            <li>• Highlight relevant experience and past work examples</li>
            <li>• Be realistic with your timeline and budget estimates</li>
            <li>• Ask clarifying questions if anything is unclear</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}