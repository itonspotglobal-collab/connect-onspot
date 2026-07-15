import { ReactNode } from "react";

interface NewUserOnboardingWrapperProps {
  children: ReactNode;
}

// The blocking auto-open onboarding modal has been replaced by an inline
// "Finish Setting Up Your Profile" CTA banner on the TalentProfile page.
// This wrapper is kept as a passthrough so existing imports continue to work.
export function NewUserOnboardingWrapper({ children }: NewUserOnboardingWrapperProps) {
  return <>{children}</>;
}
