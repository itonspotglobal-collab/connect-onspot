import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'client' | 'talent' | 'admin';
  fallbackPath?: string;
  loadingMessage?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  fallbackPath = '/',
  loadingMessage = 'Checking authentication...'
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Only redirect after loading is complete
    if (!isLoading) {
      if (!isAuthenticated) {
        console.log('🚫 ProtectedRoute: User not authenticated, redirecting to:', fallbackPath);
        setLocation(fallbackPath);
        return;
      }

      if (requiredRole && user?.userType !== requiredRole) {
        console.log(`🚫 ProtectedRoute: User role "${user?.userType}" doesn't match required "${requiredRole}"`);
        // Redirect based on user's actual role
        if (user?.userType === 'talent') {
          setLocation('/get-hired');
        } else {
          setLocation('/dashboard');
        }
        return;
      }

      console.log('✅ ProtectedRoute: Access granted for user:', { 
        id: user?.id, 
        role: user?.userType,
        requiredRole 
      });
    }
  }, [isAuthenticated, isLoading, user, requiredRole, fallbackPath, setLocation]);

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" data-testid="loading-authentication">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated (will be redirected in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  // Don't render children if role doesn't match (will be redirected in useEffect)
  if (requiredRole && user?.userType !== requiredRole) {
    return null;
  }

  // User is authenticated and has the required role (if any)
  return <>{children}</>;
}

// Specialized components for common use cases
export function ClientProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute 
      requiredRole="client" 
      fallbackPath="/"
      loadingMessage="Loading client portal..."
    >
      {children}
    </ProtectedRoute>
  );
}

export function TalentProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute 
      requiredRole="talent" 
      fallbackPath="/get-hired"
      loadingMessage="Loading talent portal..."
    >
      {children}
    </ProtectedRoute>
  );
}

// Generic authenticated route (any logged-in user)
export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute fallbackPath="/" loadingMessage="Verifying access...">
      {children}
    </ProtectedRoute>
  );
}