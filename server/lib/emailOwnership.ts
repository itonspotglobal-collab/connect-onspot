export interface OwnershipIdentity {
  email?: string | null;
  role?: string;
  email_verification_required?: boolean | null;
  email_verified_at?: unknown;
  email_verified_email?: string | null;
}

export function emailOwnershipAllowsAccess(identity: OwnershipIdentity | undefined): boolean {
  if (!identity) return false;
  // This feature covers Client/Talent, not staff authentication policy.
  if (identity.role && !["client", "talent"].includes(identity.role)) return true;
  // Only trusted persisted pre-migration rows may lack the new fields. Once the
  // additive migration is applied every row has an explicit true/false value.
  if (!Object.prototype.hasOwnProperty.call(identity, "email_verification_required")) return true;
  if (identity.email_verification_required === false) return true;
  return Boolean(identity.email_verified_at && identity.email
    && identity.email_verified_email === identity.email.trim().toLowerCase());
}

export type OwnershipQuery = (sql: string, values?: any[]) => Promise<{ rows: any[] }>;

/** Never take a verified flag from a token/browser. users is canonical for
 * linked Talent. Candidate-only state is consulted ONLY if user_id is null. */
export async function hasEmailOwnership(
  query: OwnershipQuery,
  identity: { userId?: string; candidateId?: string },
): Promise<boolean> {
  if (identity.candidateId) {
    const result = await query(
      `SELECT CASE WHEN c.user_id IS NOT NULL THEN to_jsonb(u)
                   ELSE to_jsonb(c) END AS identity
         FROM candidates c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.id = $1`, [identity.candidateId],
    );
    return emailOwnershipAllowsAccess(result.rows[0]?.identity);
  }
  const result = await query("SELECT to_jsonb(u) AS identity FROM users u WHERE id = $1", [identity.userId]);
  return emailOwnershipAllowsAccess(result.rows[0]?.identity);
}