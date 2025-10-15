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
      // Skip if already on talent portal
      if (location.startsWith('/talent-portal')) {
        return;
      }
      
      // Talent portal subdomain - redirect to talent portal
      if (location === '/' || !location.startsWith('/talent-portal')) {
        setLocation('/talent-portal');
      }
    }
    // No auto-redirect for main domain - it serves the primary public site
  }, [location, setLocation]);
  
  return <>{children}</>;
}
