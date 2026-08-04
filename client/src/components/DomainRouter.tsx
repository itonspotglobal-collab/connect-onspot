import { useEffect } from "react";
import { useLocation } from "wouter";

interface DomainRouterProps {
  children: React.ReactNode;
}

export function DomainRouter({ children }: DomainRouterProps) {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Only handle talent subdomain routing
    // Main domain (onspotglobal.com) shows the primary site without auto-redirect
    if (hostname.includes('talent.onspotglobal.com')) {
      // TODO: Restore Talent Dashboard routes when the final Talent Dashboard design is ready.
      // Previously this redirected to /talent-portal; now routes to the public homepage.
      if (location !== '/') {
        setLocation('/');
      }
    }
    // No auto-redirect for main domain - it serves the primary public site
  }, [location, setLocation]);
  
  return <>{children}</>;
}
