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
  user: User | null;
  login: (email: string, password: string, userType?: "client" | "talent" | null) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string, userType: "client" | "talent" | null = "client"): Promise<boolean> => {
    try {
      // For demo purposes, still simulate email/password login
      // In production, this would call your auth API
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
        
        // Navigate to appropriate portal based on user type
        if (userType === 'talent') {
          window.location.href = '/get-hired';
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  // Check OAuth authentication status with backend
  const checkOAuthAuth = async (): Promise<User | null> => {
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
        console.log('🔐 OAuth user authenticated:', userData);
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
        // Not authenticated
        return null;
      } else {
        console.error('Failed to check auth status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error checking OAuth auth:', error);
      return null;
    }
  };

  const logout = async () => {
    try {
      // For OAuth users, call backend logout endpoint
      if (user?.authProvider !== 'email') {
        await fetch('/api/logout', {
          method: 'GET',
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('onspot_user');
    }
  };

  // Check for authentication on mount (both OAuth and local storage)
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔒 AuthContext: Initializing authentication...');
      
      // First, check if user is OAuth authenticated
      const oauthUser = await checkOAuthAuth();
      if (oauthUser) {
        console.log('🔐 OAuth user found:', oauthUser);
        setUser(oauthUser);
        setIsAuthenticated(true);
        // Clear any old localStorage data
        localStorage.removeItem('onspot_user');
        return;
      }

      // Fallback to localStorage for email/password users
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
      }
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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