import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { saveTalentAuth, TalentAuthState } from "@/components/TalentLoginModal";

export type PortalType = "client" | "talent";

export type PortalLoginResult =
  | { success: true; portal: "client"; displayName: string; redirectTo: string }
  | { success: true; portal: "talent"; auth: TalentAuthState; redirectTo: string }
  | { success: false; requiresPasswordSetup?: boolean; email?: string; rateLimited?: boolean; retryAfter?: number; message: string };

export type PasswordSetupResult =
  | { success: true; auth: TalentAuthState; redirectTo: string }
  | { success: false; message: string };

export function usePortalLogin() {
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  async function signInToPortal(
    portal: PortalType,
    email: string,
    password: string,
  ): Promise<PortalLoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    setIsLoading(true);

    if (import.meta.env.DEV) {
      console.log("[PORTAL LOGIN]", {
        portal,
        normalizedEmail,
        endpoint: portal === "client" ? "/api/login" : "/api/talent-auth/login",
      });
    }

    try {
      if (portal === "talent") {
        const res = await fetch("/api/talent-auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
        const data = await res.json();

        if (res.status === 429) {
          const retryAfter = data.retryAfter ?? Number(res.headers.get("Retry-After") ?? 900);
          return {
            success: false,
            rateLimited: true,
            retryAfter,
            message: data.message || "Too many attempts. Please try again shortly.",
          };
        }

        if (!res.ok) {
          if (data.error === "no_password" || data.requiresPasswordSetup) {
            return {
              success: false,
              requiresPasswordSetup: true,
              email: normalizedEmail,
              message: "This Talent profile needs a password setup before signing in.",
            };
          }
          if (data.error === "client_account") {
            return { success: false, message: "This is a Client account. Please use the Client Portal." };
          }
          return {
            success: false,
            message: data.error === "not_found"
              ? "No account was found for this portal."
              : "Incorrect email or password.",
          };
        }

        const auth: TalentAuthState = {
          token: data.token,
          candidateId: data.candidate.id,
          email: data.candidate.email,
          fullName: data.candidate.fullName || data.candidate.email,
        };
        saveTalentAuth(auth);
        return { success: true, portal: "talent", auth, redirectTo: `/talent-profile/${auth.candidateId}` };
      } else {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
        const data = await res.json();

        if (res.status === 429) {
          const retryAfter = data.retryAfter ?? Number(res.headers.get("Retry-After") ?? 900);
          return {
            success: false,
            rateLimited: true,
            retryAfter,
            message: data.message || "Too many attempts. Please try again shortly.",
          };
        }

        if (data.success) {
          const role = (data.user?.role ?? "").toLowerCase();
          if (role === "talent") {
            return { success: false, message: "This is a Talent account. Please use the Talent Portal." };
          }
          localStorage.setItem("onspot_jwt_token", data.token);
          localStorage.setItem("onspot_user", JSON.stringify(data.user));
          await refreshAuth();
          const displayName = data.user?.first_name || data.user?.email || "back";
          const redirectTo = role === "admin" ? "/admin/find-work" : "/hire-talent";
          return { success: true, portal: "client", displayName, redirectTo };
        } else {
          if (data.error === "talent_account") {
            return { success: false, message: "This is a Talent account. Please use the Talent Portal." };
          }
          return { success: false, message: data.message || "Incorrect email or password." };
        }
      }
    } catch {
      return { success: false, message: "Could not reach the server. Please try again." };
    } finally {
      setIsLoading(false);
    }
  }

  async function setupTalentPassword(
    email: string,
    newPassword: string,
  ): Promise<PasswordSetupResult> {
    const normalizedEmail = email.trim().toLowerCase();
    setIsLoading(true);
    try {
      const res = await fetch("/api/candidates/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "password_exists"
            ? "A password is already set. Please sign in or reset your password."
            : data.error || data.message || "Could not set password.";
        return { success: false, message: msg };
      }
      const auth: TalentAuthState = {
        token: data.token,
        candidateId: data.candidate?.id || data.candidateId,
        email: data.candidate?.email || normalizedEmail,
        fullName: data.candidate?.fullName || normalizedEmail,
      };
      saveTalentAuth(auth);
      return { success: true, auth, redirectTo: `/talent-profile/${auth.candidateId}` };
    } catch {
      return { success: false, message: "Could not reach the server. Please try again." };
    } finally {
      setIsLoading(false);
    }
  }

  return { signInToPortal, setupTalentPassword, isLoading };
}
