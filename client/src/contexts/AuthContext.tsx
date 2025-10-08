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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const login = async (email: string, password: string, userType: "client" | "talent" | null = "client"): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the JWT-based authAPI
      const loginData = await authAPI.login(email, password);
      
      if (loginData.success && loginData.user) {
        console.log('✅ JWT login successful:', loginData);
        
        const mappedUser: User = {
          id: loginData.user.id,
          username: loginData.user.username,
          email: loginData.user.email,
          firstName: loginData.user.first_name,
          lastName: loginData.user.last_name,
          profileImageUrl: loginData.user.profileImageUrl,
          role: loginData.user.role,
          userType: loginData.user.role as "client" | "talent",
          authProvider: loginData.authProvider || 'jwt',
          company: loginData.user.company
        };
        
        // Check if this is a new user and handle onboarding
        const isNew = await checkNewUserStatus(loginData.user.id);
        
        // Check if onboarding was already completed or skipped
        const hasCompleted = localStorage.getItem(`onboarding_completed_${loginData.user.id}`) === 'true';
        const hasSkipped = localStorage.getItem(`onboarding_skipped_${loginData.user.id}`) === 'true';
        const needsOnboarding = isNew && !hasCompleted && !hasSkipped;
        
        // Set user with all data at once to prevent double renders
        const finalUser = {
          ...mappedUser, 
          isNewUser: isNew, 
          needsOnboarding: needsOnboarding
        };
        setUser(finalUser);
        setIsAuthenticated(true);
        
        return true;
      } else {
        setError(loginData.message || 'Login failed. Please try again.');
        return false;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle specific error responses
      if (error.response?.status === 401) {
        setError('Invalid email or password');
      } else if (error.response?.status === 400) {
        setError(error.response.data?.message || 'Invalid login information');
      } else if (error.message?.includes('Network')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
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
    try {
      setIsLoading(true);
      
      // Use JWT logout (clears localStorage)
      authAPI.logout();
      
      console.log('🚪 JWT User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setIsLoading(false);
    }
  };

  // Refresh authentication state from localStorage (JWT-based)
  const refreshAuth = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if authentication is disabled for testing
      const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "true";
      
      if (DISABLE_AUTH) {
        console.log('⚠️  AUTH DISABLED - Auto-authenticating as test admin');
        const mockUser: User = {
          id: "test-user-admin",
          username: "testadmin",
          email: "admin@onspotglobal.com",
          firstName: "Test",
          lastName: "Admin",
          role: "admin",
          userType: "client",
          authProvider: "bypass",
          company: "OnSpot Testing",
          needsOnboarding: false
        };
        setUser(mockUser);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }
      
      // Check if user has JWT token and user data in localStorage
      const isAuth = checkIsAuthenticated();
      const storedUser = getCurrentUser();
      
      if (isAuth && storedUser) {
        console.log('🔐 JWT user found in localStorage:', storedUser);
        
        // Check if onboarding was already completed or skipped
        const hasCompleted = localStorage.getItem(`onboarding_completed_${storedUser.id}`) === 'true';
        const hasSkipped = localStorage.getItem(`onboarding_skipped_${storedUser.id}`) === 'true';
        
        const mappedUser: User = {
          id: storedUser.id,
          username: storedUser.username,
          email: storedUser.email,
          firstName: storedUser.first_name || storedUser.firstName,
          lastName: storedUser.last_name || storedUser.lastName,
          profileImageUrl: storedUser.profileImageUrl,
          role: storedUser.role,
          userType: storedUser.role as "client" | "talent",
          authProvider: 'jwt',
          company: storedUser.company,
          // Only mark as needing onboarding if they haven't completed or skipped it
          needsOnboarding: !hasCompleted && !hasSkipped && storedUser.role === 'talent'
        };
        
        setUser(mappedUser);
        setIsAuthenticated(true);
      } else {
        // No valid authentication found
        console.log('🔒 No JWT authentication found');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error refreshing JWT auth:', error);
      setError('Failed to check authentication status');
      setUser(null);
      setIsAuthenticated(false);
      // Clear potentially corrupted data
      authAPI.logout();
    } finally {
      setIsLoading(false);
    }
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
    try {
      console.log(`🚪 Portal access requested [${portalType}]:`, {
        userRole: user?.role,
        requestedPortal: portalType,
        userId: user?.id
      });

      // Check if user is authenticated
      if (!isAuthenticated || !user) {
        console.error('❌ Portal access denied: User not authenticated');
        setError('Authentication required to access portal');
        return false;
      }

      // Validate role matches requested portal
      if (user.role !== portalType) {
        const errorMessage = `You do not have access to this portal. Please use your ${user.role} account.`;
        console.error(`❌ Portal access denied [${user.id}]:`, {
          userRole: user.role,
          requestedPortal: portalType,
          reason: 'Role mismatch'
        });
        
        setError(errorMessage);
        
        // Show user-friendly toast
        toast({
          title: "Access Denied",
          description: errorMessage,
          variant: "destructive",
        });
        
        return false;
      }

      // Role matches - portal access granted
      console.log(`✅ Portal access granted [${user.id}]:`, {
        userRole: user.role,
        accessedPortal: portalType
      });

      setError(null);
      return true;

    } catch (error: any) {
      console.error('Portal access error:', error);
      setError('An error occurred while accessing the portal. Please try again.');
      
      toast({
        title: "Portal Access Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      
      return false;
    }
  };

  // Check for authentication on mount - only once
  useEffect(() => {
    if (!initialized) {
      console.log('🔒 AuthContext: Initializing JWT authentication...');
      refreshAuth().finally(() => {
        setInitialized(true);
      });
    }
  }, [initialized]);

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