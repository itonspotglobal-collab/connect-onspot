import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { activateTalentSession, TalentAuthState } from "@/components/TalentLoginModal";
import { signupRetryDelayMs } from "@/lib/signupRetry";

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
  const signInPending = useRef(false);

  async function signInToPortal(
    portal: PortalType,
    email: string,
    password: string,
  ): Promise<PortalLoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (signInPending.current) {
      return { success: false, message: "Sign in is already in progress. Please wait." };
    }
    signInPending.current = true;
    setIsLoading(true);

    try {
      if (portal === "talent") {
        const res = await fetch("/api/talent-auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          const retryAfterMs = signupRetryDelayMs(
            res.headers.get("Retry-After")
              ?? data.retryAfter
              ?? data.retry_after
              ?? data.metadata?.retryAfter
              ?? data.metadata?.retry_after,
            Date.now(),
            15 * 60 * 1000,
          );
          return {
            success: false,
            rateLimited: true,
            retryAfter: Math.ceil(retryAfterMs / 1000),
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
            message: data.message || (data.error === "not_found"
              ? "No account was found for this portal."
              : res.status >= 500
                ? "Sign in is temporarily unavailable. Please try again."
                : res.status === 400
                  ? "Please check your email and password."
                  : "Incorrect email or password."),
          };
        }

        const candidate = data.candidate;
        const auth: TalentAuthState = {
          token: typeof data.token === "string" ? data.token : "",
          candidateId: typeof candidate?.id === "string" ? candidate.id : "",
          email: typeof candidate?.email === "string" ? candidate.email : "",
          fullName: candidate?.fullName || candidate?.email || "",
        };
        if (!auth.token || !auth.candidateId || !auth.email ||
          !await activateTalentSession(auth, refreshAuth)) {
          return { success: false, message: "We couldn't verify the signed-in Talent account. Please try again." };
        }
        return { success: true, portal: "talent", auth, redirectTo: `/talent-profile/${auth.candidateId}` };
      } else {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          const retryAfterMs = signupRetryDelayMs(
            res.headers.get("Retry-After")
              ?? data.retryAfter
              ?? data.retry_after
              ?? data.metadata?.retryAfter
              ?? data.metadata?.retry_after,
            Date.now(),
            15 * 60 * 1000,
          );
          return {
            success: false,
            rateLimited: true,
            retryAfter: Math.ceil(retryAfterMs / 1000),
            message: data.message || "Too many attempts. Please try again shortly.",
          };
        }

        if (res.ok && data.success) {
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
          return {
            success: false,
            message: data.message || (res.status >= 500
              ? "Sign in is temporarily unavailable. Please try again."
              : res.status === 400
                ? "Please check your email and password."
                : "Incorrect email or password."),
          };
        }
      }
    } catch {
      return { success: false, message: "Could not reach the server. Please try again." };
    } finally {
      signInPending.current = false;
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
        token: typeof data.token === "string" ? data.token : "",
        candidateId: data.candidate?.id || data.candidateId || "",
        email: data.candidate?.email || normalizedEmail,
        fullName: data.candidate?.fullName || normalizedEmail,
      };
      if (!auth.token || !auth.candidateId ||
        !await activateTalentSession(auth, refreshAuth)) {
        return { success: false, message: "We couldn't verify the signed-in Talent account. Please try again." };
      }
      return { success: true, auth, redirectTo: `/talent-profile/${auth.candidateId}` };
    } catch {
      return { success: false, message: "Could not reach the server. Please try again." };
    } finally {
      setIsLoading(false);
    }
  }

  return { signInToPortal, setupTalentPassword, isLoading };
}
