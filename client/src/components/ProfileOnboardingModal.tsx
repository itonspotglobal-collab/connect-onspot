import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Star, TrendingUp, Users } from "lucide-react";
import ProfileOnboarding from "./ProfileOnboarding";
import { useTalentProfile } from "@/hooks/useTalentProfile";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip?: () => void;
  onComplete?: () => void;
}

export default function ProfileOnboardingModal({
  open,
  onOpenChange,
  onSkip,
  onComplete
}: ProfileOnboardingModalProps) {
  const { user } = useAuth();
  const { profileCompletion, isNewUser } = useTalentProfile();
  const [showWelcome, setShowWelcome] = useState(true);

  // Track if user has skipped onboarding (localStorage)
  const hasSkippedOnboarding = localStorage.getItem(`onboarding_skipped_${user?.id}`) === 'true';

  const handleSkip = () => {
    if (user?.id) {
      localStorage.setItem(`onboarding_skipped_${user.id}`, 'true');
    }
    onSkip?.();
    onOpenChange(false);
  };

  const handleComplete = () => {
    if (user?.id) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
    }
    onComplete?.();
    onOpenChange(false);
  };

  // Don't show modal if user has completed onboarding or explicitly skipped
  useEffect(() => {
    const hasCompleted = localStorage.getItem(`onboarding_completed_${user?.id}`) === 'true';
    if (hasCompleted || hasSkippedOnboarding || profileCompletion >= 70) {
      onOpenChange(false);
    }
  }, [profileCompletion, user?.id, hasSkippedOnboarding, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {showWelcome ? (
          <WelcomeStep 
            onContinue={() => setShowWelcome(false)}
            onSkip={handleSkip}
          />
        ) : (
          <div className="p-6">
            <DialogHeader className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-onboarding"
              >
                <X className="w-4 h-4" />
              </Button>
              <DialogTitle className="text-2xl font-bold pr-8">
                Complete Your Profile
              </DialogTitle>
              <p className="text-muted-foreground">
                Build a compelling profile that attracts amazing opportunities
              </p>
            </DialogHeader>
            
            <div className="mt-6">
              <ProfileOnboarding 
                mode="embedded"
                onComplete={handleComplete}
                defaultStep={1}
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <Button 
                variant="outline" 
                onClick={handleSkip}
                data-testid="button-skip-onboarding"
              >
                Skip for now
              </Button>
              <p className="text-sm text-muted-foreground">
                You can complete this later from your profile settings
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface WelcomeStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

function WelcomeStep({ onContinue, onSkip }: WelcomeStepProps) {
  return (
    <div className="p-8 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Star className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Welcome to OnSpot!</h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Let's set up your professional profile to start landing amazing opportunities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
        <div className="bg-muted/30 rounded-lg p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold mb-2">Get Discovered</h3>
          <p className="text-sm text-muted-foreground">
            Complete your profile to appear in client searches and get invited to jobs
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-6">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold mb-2">Higher Earnings</h3>
          <p className="text-sm text-muted-foreground">
            Profiles with skills assessments and portfolios earn 30% more on average
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-6">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Star className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-semibold mb-2">Build Reputation</h3>
          <p className="text-sm text-muted-foreground">
            Showcase your expertise and build long-term client relationships
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Button 
          size="lg" 
          onClick={onContinue} 
          className="w-full max-w-sm"
          data-testid="button-start-onboarding"
        >
          Let's Get Started
        </Button>
        <div>
          <Button 
            variant="ghost" 
            onClick={onSkip}
            className="text-muted-foreground"
            data-testid="button-skip-welcome"
          >
            I'll do this later
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Takes about 10-15 minutes to complete
        </p>
      </div>
    </div>
  );
}