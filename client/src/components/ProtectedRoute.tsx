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
  // Authentication disabled - all routes are public
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

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute 
      requiredRole="admin" 
      fallbackPath="/dashboard"
      loadingMessage="Verifying admin access..."
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