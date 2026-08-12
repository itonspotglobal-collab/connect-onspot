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
        
        // localStorage flag is the fast path (same-browser sessions).
        // candidates.profileCompleted in the DB is the canonical gate for cross-device logins.
        const hasCompleted = localStorage.getItem(`onboarding_completed_${loginData.user.id}`) === 'true';
        const hasSkipped = localStorage.getItem(`onboarding_skipped_${loginData.user.id}`) === 'true';
        const needsOnboarding = isNew && !hasCompleted && !hasSkipped;

        // For talent users whose localStorage flag is absent, check the DB to see if they already
        // completed onboarding on another device. If profileCompleted = true, seed the cache and
        // update the user object so the modal doesn't flash before the update arrives.
        if (loginData.user.role === 'talent' && !hasCompleted && !hasSkipped) {
          const jwtToken = loginData.token ?? localStorage.getItem('onspot_jwt_token');
          if (jwtToken) {
            fetch('/api/candidates/me', {
              headers: { Authorization: `Bearer ${jwtToken}` },
            })
              .then((r) => r.ok ? r.json() : null)
              .then((candidate) => {
                if (candidate?.profileCompleted) {
                  localStorage.setItem(`onboarding_completed_${loginData.user.id}`, 'true');
                  setUser((prev) => prev ? { ...prev, needsOnboarding: false } : prev);
                }
              })
              .catch(() => {});
          }
        }
        
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
      
      // ── 1. Main JWT (admin / client / registered talent) ────────────────────
      const isAuth = checkIsAuthenticated();
      const storedUser = getCurrentUser();
      
      if (isAuth && storedUser) {
        console.log('🔐 JWT user found in localStorage:', storedUser);
        
        // localStorage flag is the fast check (survives page reloads within the same browser).
        // It is NOT the canonical gate — candidates.profileCompleted (DB) is.
        // We supplement below with a background DB check for returning users on a new device.
        const hasCompleted = localStorage.getItem(`onboarding_completed_${storedUser.id}`) === 'true';
        const hasSkipped = localStorage.getItem(`onboarding_skipped_${storedUser.id}`) === 'true';

        // For talent users whose localStorage flag is absent, check the DB in the background.
        // If candidates.profileCompleted = true, seed the localStorage flag so future visits
        // are fast and the ProfileOnboardingModal won't re-appear on the same device.
        if (storedUser.role === 'talent' && !hasCompleted && !hasSkipped) {
          const jwtToken = localStorage.getItem('onspot_jwt_token');
          if (jwtToken) {
            fetch('/api/candidates/me', {
              headers: { Authorization: `Bearer ${jwtToken}` },
            })
              .then((r) => r.ok ? r.json() : null)
              .then((candidate) => {
                if (candidate?.profileCompleted) {
                  // Seed the localStorage cache so subsequent refreshes don't need this fetch
                  localStorage.setItem(`onboarding_completed_${storedUser.id}`, 'true');
                  // Update the live user state so the modal disappears immediately
                  setUser((prev) => prev ? { ...prev, needsOnboarding: false } : prev);
                }
              })
              .catch(() => {});
          }
        }
        
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
          needsOnboarding: !hasCompleted && !hasSkipped && storedUser.role === 'talent'
        };
        
        setUser(mappedUser);
        setIsAuthenticated(true);
        return;
      }

      // ── 2. Talent portal token (candidate JWT) ───────────────────────────────
      // Talent users log in through the talent portal which stores a candidate JWT
      // ({ type:"candidate", candidateId, email }) under a different localStorage key.
      // AuthContext was unaware of this token, so user remained null → all
      // useTalentProfile queries were disabled (enabled: !!user?.id).
      try {
        const talentRaw = localStorage.getItem('talent_profile_token');
        if (talentRaw) {
          const parsed = JSON.parse(talentRaw) as { token?: string };
          const talentToken = parsed?.token;
          if (talentToken) {
            // Decode payload client-side (no crypto verification — just for reading claims)
            const payloadB64 = talentToken.split('.')[1];
            const payload = JSON.parse(atob(payloadB64)) as {
              type?: string;
              candidateId?: string;
              email?: string;
              exp?: number;
            };

            if (payload.type === 'candidate' && payload.email) {
              // Check expiry before hitting the network
              const nowSec = Math.floor(Date.now() / 1000);
              if (payload.exp && payload.exp < nowSec) {
                console.log('🔒 Talent token expired — clearing');
                localStorage.removeItem('talent_profile_token');
              } else {
                // Ask the backend for the backend-resolved userId (the server looks up
                // the users table by email and returns the real user row id).
                console.log('🔐 Talent portal token found — resolving user via backend...');
                const resp = await fetch('/api/profiles/me', {
                  headers: { Authorization: `Bearer ${talentToken}` },
                });

                if (resp.ok) {
                  const data = await resp.json() as { success: boolean; profile?: { userId: string; firstName?: string; lastName?: string } };
                  const resolvedId = data.profile?.userId ?? payload.candidateId;
                  if (resolvedId) {
                    const talentUser: User = {
                      id: resolvedId,
                      email: payload.email,
                      firstName: data.profile?.firstName || undefined,
                      lastName: data.profile?.lastName || undefined,
                      role: 'talent',
                      userType: 'talent',
                      authProvider: 'talent_portal',
                    };
                    console.log('✅ Talent portal user resolved:', { id: resolvedId, email: payload.email });
                    setUser(talentUser);
                    setIsAuthenticated(true);
                    return;
                  }
                } else if (resp.status === 401) {
                  // Token rejected by server — clear it
                  console.log('🔒 Talent token rejected by server — clearing');
                  localStorage.removeItem('talent_profile_token');
                }
                // For any other error (500, network) fall through to unauthenticated state
              }
            }
          }
        }
      } catch (talentErr) {
        // Don't let a malformed talent token prevent the app from loading
        console.warn('⚠️ Could not parse talent portal token:', talentErr);
      }

      // ── 3. No valid authentication found ────────────────────────────────────
      console.log('🔒 No JWT authentication found');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error refreshing JWT auth:', error);
      setError('Failed to check authentication status');
      setUser(null);
      setIsAuthenticated(false);
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