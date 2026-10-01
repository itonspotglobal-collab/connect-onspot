import type { RequestHandler } from "express";

export const CANDIDATE_ME_SQL = `SELECT c.id,
                c.display_name        AS "displayName",
                c.full_name           AS "fullName",
                c.first_name          AS "firstName",
                c.last_name           AS "lastName",
                c.email, c.phone, c.location,
                c.target_position     AS "targetPosition",
                c.headline,
                c.category,
                c.experience_years    AS "experienceYears",
                c.seniority,
                c.core_skills         AS "coreSkills",
                c.secondary_skills    AS "secondarySkills",
                c.work_history        AS "workHistory",
                c.education,
                c.preferences,
                c.summary,
                c.profile_photo_url   AS "profilePhotoUrl",
                c.resume_url          AS "resumeUrl",
                c.resume_file_name    AS "resumeFileName",
                c.linkedin_url        AS "linkedinUrl",
                c.portfolio_url       AS "portfolioUrl",
                c.profile_completed   AS "profileCompleted",
                c.culture_score       AS "cultureScore",
                c.availability,
                to_jsonb(c)->'values_answers' AS "valuesAnswers",
                to_jsonb(c) ? 'values_answers' AS "valuesAnswersAvailable",
                c.created_at          AS "createdAt",
                c.updated_at          AS "updatedAt"
          FROM candidates c
          JOIN users u
            ON u.role = 'talent'
           AND (u.id = c.user_id OR LOWER(u.email) = LOWER(c.email))
          WHERE LOWER(c.email) = LOWER($1) LIMIT 1`;

export type CandidateMeQuery = (
  sql: string,
  parameters: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

export function createCandidateMeHandler(query: CandidateMeQuery): RequestHandler {
  return async (req: any, res: any) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) return res.status(401).json({ error: "Authentication required" });
      const result = await query(CANDIDATE_ME_SQL, [userEmail]);
      if (result.rows.length === 0) return res.status(404).json({ error: "No candidate profile found" });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("GET /api/candidates/me error:", error);
      return res.status(500).json({ error: "Failed to fetch candidate" });
    }
  };
}