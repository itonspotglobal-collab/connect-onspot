import { verifyPassword } from "../auth-utils";
import { hasEmailOwnership, type OwnershipQuery } from "./emailOwnership";

export type PasswordAuthenticationResult = "authenticated" | "verification_required" | "invalid_password";

/** The same password and ownership checks used by all password-login paths.
 * Ownership continuity never replaces password verification or changes tokens,
 * roles, stored credentials, or the signup-only verification exception. */
export async function authenticatePassword(
  query: OwnershipQuery,
  identity: { userId?: string; candidateId?: string },
  password: string,
  storedHash: string | null | undefined,
): Promise<PasswordAuthenticationResult> {
  if (!storedHash) return "invalid_password";
  if (!await hasEmailOwnership(query, identity)) return "verification_required";
  return await verifyPassword(password, storedHash) ? "authenticated" : "invalid_password";
}
