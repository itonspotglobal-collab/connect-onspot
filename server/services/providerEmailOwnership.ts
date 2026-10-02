import { emailOwnershipAllowsAccess, type OwnershipQuery } from "../lib/emailOwnership";

/** Provider subject is authoritative; email-string matching is NEVER linking. */
export async function findOwnedProviderAccount(
  query: OwnershipQuery, provider: "google" | "linkedin" | "replit", subject: string,
) {
  const legacyId = provider === "replit" ? subject : `${provider}_${subject}`;
  let result = await query("SELECT to_jsonb(u) AS identity FROM users u WHERE id = $1", [legacyId]);
  if (!result.rows[0]) {
    const table = await query("SELECT to_regclass('public.auth_provider_links') AS relation");
    if (table.rows[0]?.relation) {
      result = await query(
        `SELECT to_jsonb(u) AS identity FROM auth_provider_links p
           JOIN users u ON u.id = p.user_id WHERE p.provider = $1 AND p.subject = $2`,
        [provider, subject],
      );
    }
  }
  const identity = result.rows[0]?.identity;
  if (!emailOwnershipAllowsAccess(identity)) return null;
  return {
    id: identity.id, email: identity.email, role: identity.role,
    firstName: identity.first_name, lastName: identity.last_name,
    profileImageUrl: identity.profile_image_url,
    emailVerificationRequired: identity.email_verification_required,
    emailVerifiedAt: identity.email_verified_at, emailVerifiedEmail: identity.email_verified_email,
  };
}