import type { RequestHandler } from "express";

export const TALENT_AUTH_USER_SQL = `SELECT u.id, u.email, u.role
           FROM candidates c
           JOIN users u ON u.id = c.user_id
          WHERE c.id = $1
         UNION ALL
         SELECT u.id, u.email, u.role
           FROM users u
          WHERE lower(u.email) = lower($2)
            AND NOT EXISTS (
              SELECT 1
                FROM candidates c
                JOIN users linked ON linked.id = c.user_id
               WHERE c.id = $1
            )
          LIMIT 1`;

export type TalentAuthUser = {
  id: string;
  email: string;
  role: string;
};

export type TalentAuthUserQuery = (
  sql: string,
  parameters: unknown[],
) => Promise<{ rows: TalentAuthUser[] }>;

export async function lookupTalentAuthUser(
  query: TalentAuthUserQuery,
  candidateId: string,
  email: string | undefined,
): Promise<TalentAuthUser | null> {
  const result = await query(TALENT_AUTH_USER_SQL, [candidateId, email]);
  return result.rows[0] ?? null;
}

type TalentIdentityCandidate = {
  id: string;
  fullName?: string | null;
  email?: string | null;
};

type TalentIdentityDependencies = {
  getCandidate: (candidateId: string) => Promise<TalentIdentityCandidate | undefined>;
  query: TalentAuthUserQuery;
};

export function createTalentIdentityHandler(
  dependencies: TalentIdentityDependencies,
): RequestHandler {
  return async (req: any, res) => {
    try {
      const talentAuth = req.talentAuth;
      if (!talentAuth?.candidateId) {
        return res.status(401).json({ error: "Talent auth required" });
      }

      const candidate = await dependencies.getCandidate(talentAuth.candidateId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const linkedUser = await lookupTalentAuthUser(
        dependencies.query,
        candidate.id,
        talentAuth.email,
      );

      return res.json({
        candidateId: candidate.id,
        userId: linkedUser?.id ?? candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
      });
    } catch {
      return res.status(500).json({ error: "Failed to verify session" });
    }
  };
}