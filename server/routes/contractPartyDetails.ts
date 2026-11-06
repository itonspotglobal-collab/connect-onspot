import type { Express, RequestHandler } from "express";
import { talentPartyColumns, talentPartySchema, partyDetailsFromRow } from "../../shared/contractPartyDetails";

type Query = (sql: string, params: any[]) => Promise<{ rows: any[] }>;
export function registerContractPartyDetails(app: Express, authenticate: RequestHandler, query: Query) {
  const path = "/api/candidates/:id/contract-party-details";
  const ownership = `id = $1 AND (user_id = $2 OR
    (user_id IS NULL AND lower(email) = lower($3)))`;
  const identity = (req: any) => [req.params.id, req.user.id, req.user.email ?? ""];
  const columns = Object.values(talentPartyColumns).join(", ");
  app.get(path, authenticate, async (req: any, res) => {
    if (req.user?.role !== "talent") return res.status(403).json({ error: "Talent owner access required" });
    try {
      const result = await query(`SELECT ${columns} FROM candidates WHERE ${ownership} LIMIT 1`, identity(req));
      if (!result.rows[0]) return res.status(404).json({ error: "Profile not found" });
      return res.json(partyDetailsFromRow(result.rows[0], talentPartyColumns));
    } catch {
      return res.status(500).json({ error: "Unable to load private contract details" });
    }
  });
  app.patch(path, authenticate, async (req: any, res) => {
    if (req.user?.role !== "talent") return res.status(403).json({ error: "Talent owner access required" });
    const parsed = talentPartySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid contract details. Enter text fields and only four tax-ID digits." });
    const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
    if (!fields.length) return res.status(400).json({ error: "No fields provided" });
    try {
      const params: any[] = identity(req);
      const sets = fields.map(([key, value]) => {
        params.push(value);
        return `${talentPartyColumns[key as keyof typeof talentPartyColumns]} = $${params.length}`;
      });
      const result = await query(`UPDATE candidates SET ${sets.join(", ")}, updated_at = NOW()
        WHERE ${ownership} RETURNING ${columns}`, params);
      if (!result.rows[0]) return res.status(404).json({ error: "Profile not found" });
      return res.json(partyDetailsFromRow(result.rows[0], talentPartyColumns));
    } catch {
      return res.status(500).json({ error: "Unable to save private contract details" });
    }
  });
}
