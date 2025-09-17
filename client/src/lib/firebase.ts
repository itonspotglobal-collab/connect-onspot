// Firebase authentication integration for OnSpot - Professional Social Login
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if config is provided
let app: any = null;
let auth: any = null;

if (import.meta.env.VITE_FIREBASE_API_KEY) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Professional Google OAuth sign-in with OnSpot integration
export const signInWithGoogle = async (userType: "client" | "talent" = "talent") => {
  if (!auth) {
    throw new Error("Firebase not configured. Please contact support.");
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Extract professional profile information
    const profileData = {
      id: user.uid,
      email: user.email || "",
      username: user.displayName || user.email?.split('@')[0] || "",
      firstName: user.displayName?.split(' ')[0] || "",
      lastName: user.displayName?.split(' ').slice(1).join(' ') || "",
      profilePicture: user.photoURL || "",
      userType: userType,
      role: userType,
      provider: "google"
    };

    return profileData;
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    
    // Provide user-friendly error messages
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("Sign-in cancelled. Please try again.");
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error("Pop-up blocked. Please allow pop-ups and try again.");
    } else {
      throw new Error("Sign-in failed. Please try again or contact support.");
    }
  }
};

// Check if Firebase is available
export const isFirebaseAvailable = () => {
  return !!auth && !!import.meta.env.VITE_FIREBASE_API_KEY;
};

// Listen to auth state changes
export const onFirebaseAuthStateChanged = (callback: (user: User | null) => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

// Sign out from Firebase
export const firebaseSignOut = async () => {
  if (!auth) return;
  await signOut(auth);
};

export { auth };