import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { authAPI, getCurrentUser, isAuthenticated as checkIsAuthenticated } from '@/lib/api';

interface User {
  id: string;
  username?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: string;
  userType?: "client" | "talent";
  authProvider?: string;
  isNewUser?: boolean;
  profileCompletion?: number;
  needsOnboarding?: boolean;
  company?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  login: (email: string, password: string, userType?: "client" | "talent" | null) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkNewUserStatus: (userId: string) => Promise<boolean>;
  redirectToOnboarding: () => void;
  enterPortal: (portalType: "client" | "talent") => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default guest user for public access
const GUEST_USER: User = {
  id: 'guest',
  email: 'guest@demo.com',
  firstName: 'Guest',
  lastName: 'User',
  role: 'client',
  userType: 'client',
  authProvider: 'public',
  company: 'Demo Company'
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  // 🔓 Public access enabled - authentication disabled
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(GUEST_USER);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(true);

  const login = async (email: string, password: string, userType: "client" | "talent" | null = "client"): Promise<boolean> => {
    // 🔓 Authentication disabled - always return success with guest user
    console.log('🔓 Login bypassed - public access mode');
    return true;
  };

  // Listen for JWT expiration events
  useEffect(() => {
    const handleJWTExpired = () => {
      console.log('🔒 JWT expired, logging out user');
      logout();
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
    };

    window.addEventListener('jwt-expired', handleJWTExpired);
    return () => {
      window.removeEventListener('jwt-expired', handleJWTExpired);
    };
  }, []);

  const logout = async (): Promise<void> => {
    // 🔓 Authentication disabled - logout does nothing
    console.log('🔓 Logout bypassed - public access mode (guest user remains)');
  };

  // Refresh authentication state from localStorage (JWT-based)
  const refreshAuth = async (): Promise<void> => {
    // 🔓 Authentication disabled - always maintain guest user
    console.log('🔓 Auth refresh bypassed - guest user maintained');
  };

  // Check if user is new (needs onboarding)
  const checkNewUserStatus = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/profiles/user/${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        // No profile found, user is new
        return true;
      }
      
      if (response.ok) {
        const profile = await response.json();
        // Consider user new if profile completion is less than 30%
        return (profile.profileCompletion || 0) < 30;
      }
      
      return false; // Default to not new if we can't determine
    } catch (error) {
      console.error('Error checking new user status:', error);
      return false;
    }
  };

  // Helper to redirect to onboarding
  const redirectToOnboarding = () => {
    // This will be handled by the UI layer through the user.needsOnboarding flag
    console.log('🚀 Redirecting to onboarding flow');
  };

  // Portal selection with role validation
  const enterPortal = async (portalType: "client" | "talent"): Promise<boolean> => {
    // 🔓 Authentication disabled - all portals accessible
    console.log(`🔓 Portal access granted (public mode) [${portalType}]`);
    return true;
  };

  // Check for authentication on mount - only once
  useEffect(() => {
    // 🔓 Public access enabled — authentication disabled
    console.log('🔓 Public access enabled — authentication disabled');
    console.log('👤 Guest user auto-authenticated:', GUEST_USER);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      user, 
      error, 
      login, 
      logout, 
      refreshAuth,
      checkNewUserStatus,
      redirectToOnboarding,
      enterPortal
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}