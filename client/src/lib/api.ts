import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

// Determine the correct API base URL based on environment
const getAPIBaseURL = (): string => {
  // Check if we're in production by looking at the current origin
  const isProduction = window.location.origin.includes("onspotglobal.com");

  if (isProduction) {
    console.log('🚀 Production API baseURL: https://connect.onspotglobal.com');
    return "https://connect.onspotglobal.com";
  }

  // Development - use environment variable or relative URLs
  const baseURL = import.meta.env.VITE_API_BASE || "";
  console.log(`🛠️ Development API baseURL: ${baseURL || 'relative URLs'}`);
  return baseURL;
};

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: getAPIBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for session cookies if needed
});

// Request interceptor to add JWT token to requests
api.interceptors.request.use(
  (config) => {
    // Get JWT token from localStorage
    const token = localStorage.getItem("onspot_jwt_token");

    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  },
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle unauthorized responses (token expired or invalid)
    if (error.response?.status === 401) {
      // Remove invalid token
      localStorage.removeItem("onspot_jwt_token");
      localStorage.removeItem("onspot_user");

      // Only redirect to login if it's not already a login/signup request
      const isAuthRequest =
        error.config?.url?.includes("/login") ||
        error.config?.url?.includes("/signup");

      if (!isAuthRequest) {
        console.warn("JWT token expired or invalid, removing from storage");
        // You can dispatch a logout action here if using a global store
        window.dispatchEvent(new CustomEvent("jwt-expired"));
      }
    }

    return Promise.reject(error);
  },
);

// Helper functions for authentication requests
export const authAPI = {
  // Login with email and password
  login: async (email: string, password: string) => {
    try {
      const response = await api.post("/login", { email, password });

      if (response.data.success && response.data.token) {
        // Store JWT token in localStorage
        localStorage.setItem("onspot_jwt_token", response.data.token);
        localStorage.setItem("onspot_user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      console.error("Login API error:", error);
      throw error;
    }
  },

  // Signup with user data
  signup: async (userData: {
    email: string;
    username?: string;
    password: string;
    first_name: string;
    last_name: string;
    role: "client" | "talent";
    company?: string;
  }) => {
    try {
      const response = await api.post("/signup", userData);
      return response.data;
    } catch (error) {
      console.error("Signup API error:", error);
      throw error;
    }
  },

  // Logout - just remove local storage (JWT is stateless)
  logout: () => {
    localStorage.removeItem("onspot_jwt_token");
    localStorage.removeItem("onspot_user");
  },

  // Profile operations with proper JWT authentication
  get: async (url: string) => {
    try {
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("AuthAPI GET error:", error);
      throw error;
    }
  },

  put: async (url: string, data: any) => {
    try {
      const response = await api.put(url, data);
      return response.data;
    } catch (error) {
      console.error("AuthAPI PUT error:", error);
      throw error;
    }
  },
};

// Export the configured axios instance for other API calls
export default api;

// Export a helper to check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem("onspot_jwt_token");
  const user = localStorage.getItem("onspot_user");
  return !!(token && user);
};

// Export a helper to get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem("onspot_user");
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error("Error parsing stored user data:", error);
      localStorage.removeItem("onspot_user");
      return null;
    }
  }
  return null;
};
