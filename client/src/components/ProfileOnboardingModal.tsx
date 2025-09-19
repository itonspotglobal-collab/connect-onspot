import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, Star, TrendingUp, Users, Award, CheckCircle2, Target, Briefcase, Shield } from "lucide-react";
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
            <DialogHeader className="relative animate-slide-up">
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 hover-elevate"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-onboarding"
              >
                <X className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent pr-8">
                  Complete Your Profile
                </DialogTitle>
              </div>
              <p className="text-muted-foreground text-lg">
                Build a compelling profile that attracts Fortune 500 companies and premium opportunities
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  <span>Increase visibility 10x</span>
                </div>
                <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>Earn 40% more</span>
                </div>
                <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
                <div className="flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  <span>Join elite network</span>
                </div>
              </div>
            </DialogHeader>
            
            <div className="mt-6">
              <ProfileOnboarding 
                mode="embedded"
                onComplete={handleComplete}
                defaultStep={1}
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t mt-6 animate-slide-up">
              <Button 
                variant="outline" 
                onClick={handleSkip}
                className="hover-elevate"
                data-testid="button-skip-onboarding"
              >
                Skip for now
              </Button>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">
                  Complete later from profile settings
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Your progress is automatically saved
                </p>
              </div>
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
    <div className="p-8 text-center animate-slide-up">
      <DialogHeader>
        <VisuallyHidden>
          <DialogTitle>Welcome to OnSpot</DialogTitle>
          <DialogDescription>
            Join the global talent marketplace trusted by Fortune 500 companies
          </DialogDescription>
        </VisuallyHidden>
      </DialogHeader>
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-onspot-pulse">
          <Star className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          Welcome to OnSpot!
        </h2>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-4">
          Join the global talent marketplace trusted by Fortune 500 companies
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>50,000+ Professionals</span>
          </div>
          <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
          <div className="flex items-center gap-1">
            <Briefcase className="w-4 h-4" />
            <span>10,000+ Success Stories</span>
          </div>
          <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span>Verified & Secure</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20 hover-elevate transition-all duration-300">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center mb-4 shadow-md">
            <Target className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-bold mb-2 text-lg">Get Discovered</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Join our curated talent pool and get matched with premium opportunities from leading companies
          </p>
          <Badge variant="secondary" className="mt-3 text-xs">
            ⚡ Instant Matches
          </Badge>
        </div>

        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-xl p-6 border border-success/20 hover-elevate transition-all duration-300">
          <div className="w-14 h-14 bg-gradient-to-br from-success to-success/80 rounded-xl flex items-center justify-center mb-4 shadow-md">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-bold mb-2 text-lg">Higher Earnings</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Complete profiles with verified skills earn 40% more than basic profiles
          </p>
          <Badge variant="secondary" className="mt-3 text-xs">
            💰 Premium Rates
          </Badge>
        </div>

        <div className="bg-gradient-to-br from-premium-gold/5 to-premium-gold/10 rounded-xl p-6 border border-premium-gold/20 hover-elevate transition-all duration-300">
          <div className="w-14 h-14 bg-gradient-to-br from-premium-gold to-premium-gold/80 rounded-xl flex items-center justify-center mb-4 shadow-md">
            <Award className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-bold mb-2 text-lg">Build Reputation</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Showcase expertise and build lasting relationships with Fortune 500 clients
          </p>
          <Badge variant="secondary" className="mt-3 text-xs">
            🏆 Elite Network
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        <Button 
          size="lg" 
          onClick={onContinue} 
          className="w-full max-w-sm h-12 btn-professional text-lg font-semibold"
          data-testid="button-start-onboarding"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Complete My Profile
        </Button>
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-skip-welcome"
          >
            I'll do this later
          </Button>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 mt-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Complete in 8-12 minutes</span>
            <div className="w-1 h-1 bg-muted-foreground rounded-full mx-2"></div>
            <Shield className="w-4 h-4 text-primary" />
            <span>100% Secure & Private</span>
          </div>
        </div>
      </div>
    </div>
  );
}