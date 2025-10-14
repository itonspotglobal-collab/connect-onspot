import { useEffect } from "react";
import { useLocation } from "wouter";

interface DomainRouterProps {
  children: React.ReactNode;
}

export function DomainRouter({ children }: DomainRouterProps) {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Skip redirect if already on the correct path
    const isAlreadyOnCorrectPath = () => {
      if (hostname.includes('connect.onspotglobal.com') && location.startsWith('/dashboard')) {
        return true;
      }
      if (hostname.includes('talent.onspotglobal.com') && location.startsWith('/talent-portal')) {
        return true;
      }
      return false;
    };
    
    // Skip if already on correct path
    if (isAlreadyOnCorrectPath()) {
      return;
    }
    
    // Domain-based routing
    if (hostname.includes('connect.onspotglobal.com')) {
      // Client portal subdomain - redirect to dashboard
      if (location === '/' || !location.startsWith('/dashboard')) {
        setLocation('/dashboard');
      }
    } else if (hostname.includes('talent.onspotglobal.com')) {
      // Talent portal subdomain - redirect to talent portal
      if (location === '/' || !location.startsWith('/talent-portal')) {
        setLocation('/talent-portal');
      }
    }
    // onspotglobal.com (main domain) stays on home page by default
  }, [location, setLocation]);
  
  return <>{children}</>;
}
