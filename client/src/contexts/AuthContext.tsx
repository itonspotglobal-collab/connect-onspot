import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

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
      
      // Call the real email/password login API
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for session cookies
        body: JSON.stringify({ email, password })
      });
      
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        console.log('✅ Email/password login successful:', loginData);
        
        // The login API returns user data and establishes session
        const userData = loginData.user;
        const mappedUser: User = {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: userData.role,
          userType: userData.role as "client" | "talent",
          authProvider: loginData.authProvider || 'email'
        };
        
        setUser(mappedUser);
        setIsAuthenticated(true);
        
        // Check if this is a new user and handle onboarding
        const isNew = await checkNewUserStatus(userData.id);
        setUser({...mappedUser, isNewUser: isNew, needsOnboarding: isNew});
        
        return true;
      } else {
        // Handle login errors
        const errorData = await loginResponse.json();
        console.error('❌ Login failed:', errorData);
        
        if (loginResponse.status === 401) {
          setError('Invalid email or password');
        } else if (loginResponse.status === 400) {
          setError(errorData.message || 'Invalid login information');
        } else {
          setError('Login failed. Please try again.');
        }
        
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Check authentication status with backend
  const checkServerAuth = async (): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include', // Include cookies for session
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('🔐 Server authenticated user:', userData);
        return {
          id: userData.id,
          email: userData.email || '',
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: userData.role || 'client',
          userType: userData.role === 'talent' ? 'talent' : 'client',
          authProvider: userData.authProvider || 'unknown',
          isNewUser: userData.isNewUser || false,
          profileCompletion: userData.profileCompletion || 0,
          needsOnboarding: userData.needsOnboarding || false
        };
      } else if (response.status === 401) {
        console.log('🔒 No active session found');
        return null;
      } else {
        console.error('Failed to check auth status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error checking server auth:', error);
      return null;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // For server-authenticated users, call backend logout endpoint
      if (user?.authProvider !== 'email') {
        try {
          await fetch('/api/logout', {
            method: 'GET',
            credentials: 'include',
          });
        } catch (logoutError) {
          console.warn('Backend logout failed:', logoutError);
          // Continue with local cleanup even if server logout fails
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      localStorage.removeItem('onspot_user');
      setIsLoading(false);
      
      console.log('🚪 User logged out successfully');
    }
  };

  // Refresh authentication state from server
  const refreshAuth = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First, check if user is server authenticated
      const serverUser = await checkServerAuth();
      if (serverUser) {
        console.log('🔐 Server user found:', serverUser);
        setUser(serverUser);
        setIsAuthenticated(true);
        // Clear any old localStorage data
        localStorage.removeItem('onspot_user');
        return;
      }

      // Fallback to localStorage for email/password users (legacy)
      const storedUser = localStorage.getItem('onspot_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('🔒 Local storage user found:', parsedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('🔒 Error parsing stored user:', error);
          localStorage.removeItem('onspot_user');
        }
      } else {
        // No user found anywhere
        console.log('🔒 No authenticated user found');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setError('Failed to check authentication status');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is new (needs onboarding)
  const checkNewUserStatus = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/profiles/${userId}`, {
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

  // Check for authentication on mount - only once
  useEffect(() => {
    if (!initialized) {
      console.log('🔒 AuthContext: Initializing authentication...');
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
      redirectToOnboarding
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