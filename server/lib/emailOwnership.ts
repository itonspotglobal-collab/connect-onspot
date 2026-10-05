export interface OwnershipIdentity {
  email?: string | null;
  role?: string;
  email_verification_required?: boolean | null;
  email_verified_at?: unknown;
  email_verified_email?: string | null;
  password_hash?: string | null;
  created_at?: unknown;
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

/** Eligibility alone never grants access: the authoritative rollout ledger must
 * also prove this credential-bearing record predates email verification.
 * Do not use the signup exception flag here or manufacture inbox proof. */
function mayHaveHistoricalPasswordAccess(identity: OwnershipIdentity | undefined): boolean {
  if (!identity || (identity.role && !["client", "talent"].includes(identity.role))) return false;
  if (identity.email_verified_at != null || identity.email_verified_email != null) return false;
  if (typeof identity.created_at !== "string" || !Number.isFinite(Date.parse(identity.created_at))) return false;
  return typeof identity.password_hash === "string"
    && /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(identity.password_hash);
}

async function historicalPasswordAccess(query: OwnershipQuery, identity: OwnershipIdentity | undefined): Promise<boolean> {
  if (!mayHaveHistoricalPasswordAccess(identity)) return false;
  try {
    const ledger = await query(
      "SELECT to_regclass('public.app_schema_migrations') IS NOT NULL AS has_rollout_ledger",
    );
    if (ledger.rows[0]?.has_rollout_ledger !== true) return false;
    // A schema synchronizer can add DEFAULT true before migration 0033 runs.
    // Its NULL-only grandfathering then misses established accounts. Restore
    // that intended policy read-only, bounded by the original rollout ledger.
    // Database timestamps without time zone use UTC; compare in SQL, not the
    // server/browser's local timezone. Missing ledger evidence fails closed.
    const result = await query(
      `SELECT ($2::timestamp < applied_at AT TIME ZONE 'UTC') AS historical_password_access
         FROM app_schema_migrations WHERE id = $1`,
      ["0033_signup_email_verification", identity!.created_at],
    );
    return result.rows[0]?.historical_password_access === true;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return false;
    throw error;
  }
}

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
    const persistedIdentity = result.rows[0]?.identity;
    return emailOwnershipAllowsAccess(persistedIdentity)
      || await historicalPasswordAccess(query, persistedIdentity);
  }
  const result = await query("SELECT to_jsonb(u) AS identity FROM users u WHERE id = $1", [identity.userId]);
  const persistedIdentity = result.rows[0]?.identity;
  return emailOwnershipAllowsAccess(persistedIdentity)
    || await historicalPasswordAccess(query, persistedIdentity);
}