import type { OwnershipQuery } from "./emailOwnership";

/** Counts only; never print customer email addresses or authentication hashes. */
export async function signupVerificationPreflight(query: OwnershipQuery) {
  const checks: Record<string, string> = {
    duplicateUserEmails: `SELECT count(*)::int AS count FROM
      (SELECT lower(trim(email)) FROM users WHERE NULLIF(trim(email),'') IS NOT NULL
       GROUP BY lower(trim(email)) HAVING count(*) > 1) x`,
    duplicateCandidateEmails: `SELECT count(*)::int AS count FROM
      (SELECT lower(trim(email)) FROM candidates WHERE NULLIF(trim(email),'') IS NOT NULL
       GROUP BY lower(trim(email)) HAVING count(*) > 1) x`,
    candidateOnlyIdentities: "SELECT count(*)::int AS count FROM candidates WHERE user_id IS NULL",
    multipleLinkedCandidates: `SELECT count(*)::int AS count FROM
      (SELECT user_id FROM candidates WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1) x`,
    multipleLinkedProfiles: `SELECT count(*)::int AS count FROM
      (SELECT user_id FROM profiles GROUP BY user_id HAVING count(*) > 1) x`,
    passwordlessProfiles: "SELECT count(*)::int AS count FROM candidates WHERE NULLIF(password_hash,'') IS NULL",
    missingUserEmails: "SELECT count(*)::int AS count FROM users WHERE NULLIF(trim(email),'') IS NULL",
    missingCandidateEmails: "SELECT count(*)::int AS count FROM candidates WHERE NULLIF(trim(email),'') IS NULL",
    orphanedCandidateLinks: `SELECT count(*)::int AS count FROM candidates c
      LEFT JOIN users u ON u.id=c.user_id WHERE c.user_id IS NOT NULL AND u.id IS NULL`,
    mismatchedLinkedEmails: `SELECT count(*)::int AS count FROM candidates c JOIN users u ON u.id=c.user_id
      WHERE lower(trim(c.email)) IS DISTINCT FROM lower(trim(u.email))`,
  };
  const counts: Record<string, number> = {};
  for (const [name, sql] of Object.entries(checks)) counts[name] = (await query(sql)).rows[0].count;
  return counts;
}