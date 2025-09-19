import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProfileOnboardingModal from "@/components/ProfileOnboardingModal";

interface NewUserOnboardingWrapperProps {
  children: React.ReactNode;
}

export function NewUserOnboardingWrapper({ children }: NewUserOnboardingWrapperProps) {
  // Add safety check for useAuth hook
  let isAuthenticated = false;
  let isLoading = true;
  let user = null;
  
  try {
    const authContext = useAuth();
    isAuthenticated = authContext.isAuthenticated;
    isLoading = authContext.isLoading;
    user = authContext.user;
  } catch (error) {
    // Context not available yet, use defaults
    console.warn('AuthContext not available yet in NewUserOnboardingWrapper, using defaults');
  }
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Only show onboarding for authenticated users who need it
    if (isAuthenticated && !isLoading && user) {
      // Check if onboarding was already completed or skipped
      const hasCompleted = localStorage.getItem(`onboarding_completed_${user.id}`) === 'true';
      const hasSkipped = localStorage.getItem(`onboarding_skipped_${user.id}`) === 'true';
      
      const shouldShowOnboarding = 
        !hasCompleted && 
        !hasSkipped && 
        (user.needsOnboarding || user.isNewUser) &&
        user.userType === 'talent'; // Only show for talent users
      
      if (shouldShowOnboarding !== showOnboarding) {
        setShowOnboarding(shouldShowOnboarding || false);
        
        if (shouldShowOnboarding) {
          console.log('🚀 New user detected, showing onboarding flow:', {
            userType: user.userType,
            needsOnboarding: user.needsOnboarding,
            isNewUser: user.isNewUser,
            userId: user.id
          });
        }
      }
    } else {
      setShowOnboarding(false);
    }
  }, [isAuthenticated, isLoading, user, showOnboarding]);

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