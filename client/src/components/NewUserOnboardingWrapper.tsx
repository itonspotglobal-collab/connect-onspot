import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProfileOnboardingModal from "@/components/ProfileOnboardingModal";

interface NewUserOnboardingWrapperProps {
  children: React.ReactNode;
}

export function NewUserOnboardingWrapper({ children }: NewUserOnboardingWrapperProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Only show onboarding for authenticated users who need it
    if (isAuthenticated && !isLoading && user) {
      const shouldShowOnboarding = 
        user.needsOnboarding || 
        user.isNewUser || 
        // Fallback check for users without explicit flags
        (user.userType === 'talent' && !localStorage.getItem(`onboarding_completed_${user.id}`));
      
      setShowOnboarding(shouldShowOnboarding);
      
      if (shouldShowOnboarding) {
        console.log('🚀 New user detected, showing onboarding flow:', {
          userType: user.userType,
          needsOnboarding: user.needsOnboarding,
          isNewUser: user.isNewUser,
          userId: user.id
        });
      }
    } else {
      setShowOnboarding(false);
    }
  }, [isAuthenticated, isLoading, user]);

  const handleOnboardingComplete = () => {
    console.log('✅ Onboarding completed for user:', user?.id);
    setShowOnboarding(false);
    
    // Mark onboarding as completed in localStorage
    if (user?.id) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
    }
    
    // The user will be redirected to their appropriate dashboard automatically
    // since the auth context will update and the routing logic will handle it
  };

  const handleOnboardingSkip = () => {
    console.log('⏭️ Onboarding skipped for user:', user?.id);
    setShowOnboarding(false);
    
    // Mark onboarding as skipped in localStorage
    if (user?.id) {
      localStorage.setItem(`onboarding_skipped_${user.id}`, 'true');
    }
  };

  return (
    <>
      {children}
      
      {/* Show onboarding modal for new users */}
      {showOnboarding && user && (
        <ProfileOnboardingModal 
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </>
  );
}