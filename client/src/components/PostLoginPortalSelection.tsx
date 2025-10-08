import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PortalSelectionDialog } from "@/components/PortalSelectionDialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import Dashboard from "@/pages/Dashboard";
import TalentPortal from "@/pages/TalentPortal";

/**
 * Component that manages the post-login flow:
 * 1. Shows portal selection dialog after login
 * 2. Validates role and navigates to appropriate dashboard
 * 3. Prevents unauthorized portal access
 */
export function PostLoginPortalSelection() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPortalSelection, setShowPortalSelection] = useState(false);
  const [hasSelectedPortal, setHasSelectedPortal] = useState(false);

  // Check if user needs portal selection
  useEffect(() => {
    // Authentication disabled - no redirects needed
    if (!isAuthenticated || isLoading || !user) {
      return;
    }

    // Skip all redirect logic when authentication is disabled
    console.log('🔒 Portal selection disabled - public access mode');
  }, [isAuthenticated, isLoading, user, location, hasSelectedPortal, setLocation]);

  const handlePortalSelectionComplete = () => {
    if (!user) return;
    
    // Mark portal selection as completed
    const portalSelectionKey = `portal_selection_completed_${user.id}`;
    localStorage.setItem(portalSelectionKey, 'true');
    
    setShowPortalSelection(false);
    setHasSelectedPortal(true);
    
    console.log('✅ Portal selection completed for user:', user.id);
  };

  const handlePortalSelectionCancel = () => {
    // User cancelled portal selection - should not happen with current design
    // but keeping for safety
    setShowPortalSelection(false);
    console.log('❌ Portal selection cancelled');
  };

  // Show loading while authentication is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, return null (handled by parent routing)
  if (!isAuthenticated || !user) {
    return null;
  }

  // Show portal selection dialog if needed
  if (showPortalSelection) {
    return (
      <>
        <PortalSelectionDialog
          open={showPortalSelection}
          onOpenChange={(open) => {
            if (!open) {
              handlePortalSelectionComplete();
            }
          }}
        />
        {/* Backdrop content while dialog is shown */}
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <h2 className="text-2xl font-semibold">Welcome to OnSpot!</h2>
            <p className="text-muted-foreground">
              Please select your portal to continue to your dashboard.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Determine which dashboard to show based on current location and user role
  const currentPath = location;
  
  // Handle specific dashboard routes with enhanced security feedback
  if (currentPath === '/client-dashboard' || (currentPath === '/dashboard' && user.role === 'client')) {
    if (user.role !== 'client') {
      // Role mismatch - show destructive toast and redirect
      console.error(`🚫 Security: Role mismatch for client dashboard`, {
        userId: user.id,
        userRole: user.role,
        attemptedAccess: 'client-dashboard',
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Access Denied",
        description: `You don't have permission to access the client dashboard. Your account role is '${user.role}'. Please contact support if you believe this is an error.`,
        variant: "destructive",
        duration: 8000, // Longer duration for security messages
      });
      
      // Redirect to appropriate dashboard based on actual role
      const correctPath = user.role === 'talent' ? '/talent-dashboard' : 
                         user.role === 'admin' ? '/admin/dashboard' : '/';
      setLocation(correctPath);
      return null;
    }
    return <Dashboard />;
  }
  
  if (currentPath === '/talent-dashboard' || (currentPath === '/talent-portal' && user.role === 'talent')) {
    if (user.role !== 'talent') {
      // Role mismatch - show destructive toast and redirect
      console.error(`🚫 Security: Role mismatch for talent dashboard`, {
        userId: user.id,
        userRole: user.role,
        attemptedAccess: 'talent-dashboard', 
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Access Denied",
        description: `You don't have permission to access the talent dashboard. Your account role is '${user.role}'. Please contact support if you believe this is an error.`,
        variant: "destructive",
        duration: 8000, // Longer duration for security messages
      });
      
      // Redirect to appropriate dashboard based on actual role
      const correctPath = user.role === 'client' ? '/client-dashboard' : 
                         user.role === 'admin' ? '/admin/dashboard' : '/';
      setLocation(correctPath);
      return null;
    }
    return <TalentPortal />;
  }

  // Default: redirect to appropriate dashboard based on role
  const defaultPath = user.role === 'client' ? '/client-dashboard' : 
                     user.role === 'talent' ? '/talent-dashboard' :
                     user.role === 'admin' ? '/admin/dashboard' : '/';
  if (currentPath === '/' || !currentPath.startsWith('/')) {
    setLocation(defaultPath);
    return null;
  }

  // Fallback: show appropriate dashboard for the user's role
  if (user.role === 'client') return <Dashboard />;
  if (user.role === 'talent') return <TalentPortal />;
  if (user.role === 'admin') {
    // Admin users should be handled by the routing system, redirect them
    setLocation('/admin/dashboard');
    return null;
  }
  
  // Unknown role fallback
  return null;
}