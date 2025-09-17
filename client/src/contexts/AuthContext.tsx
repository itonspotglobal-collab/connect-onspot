import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  login: (email: string, password: string, userType?: "client" | "talent" | null) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const login = async (email: string, password: string, userType: "client" | "talent" | null = "client"): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try development login endpoint first
      const devLoginResponse = await fetch('/api/dev/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, userType })
      });
      
      if (devLoginResponse.ok) {
        const userData = await devLoginResponse.json();
        console.log('✅ Development login successful:', userData);
        
        // Set authenticated user state
        const authenticatedUser: User = {
          id: userData.user.id,
          email: userData.user.email,
          firstName: userData.user.firstName,
          lastName: userData.user.lastName,
          profileImageUrl: userData.user.profileImageUrl,
          role: userData.user.role,
          userType: userData.user.role === 'talent' ? 'talent' : 'client',
          authProvider: 'dev'
        };
        
        setUser(authenticatedUser);
        setIsAuthenticated(true);
        
        // Clear any localStorage fallback
        localStorage.removeItem('onspot_user');
        
        return true;
      }
      
      // Fallback for demo purposes - email/password simulation
      if (email && password && password !== "google-oauth" && password !== "linkedin-oauth") {
        const mockUser: User = {
          id: '1',
          username: email.split('@')[0],
          email: email,
          role: userType || 'client',
          userType: userType || 'client',
          authProvider: 'email'
        };
        setUser(mockUser);
        setIsAuthenticated(true);
        localStorage.setItem('onspot_user', JSON.stringify(mockUser));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
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
          authProvider: userData.authProvider || 'unknown'
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
      refreshAuth 
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