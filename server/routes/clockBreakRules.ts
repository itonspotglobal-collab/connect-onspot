import type { Express, RequestHandler } from "express";
import { contractBreakRules } from "../services/sessionPaidTime";
type Options = {
  query: (sql: string, values?: any[]) => Promise<{ rows: any[] }>;
  authenticateJWT: RequestHandler; requireAdmin?: RequestHandler;
};
export function registerBreakRuleRoutes(app: Express, options: Options) {
  const admin: RequestHandler = options.requireAdmin ?? ((req: any, res, next) =>
    req.user?.role === "admin" ? next() : res.status(403).json({ error: "Admin access required" }));
  const fields = { lunchPaid: "lunch_paid", breakPaid: "break_paid", meetingPaid: "meeting_paid",
    lunchMaxMinutes: "lunch_max_minutes", breakMaxMinutes: "break_max_minutes", breaksPerDay: "breaks_per_day" } as const;
  app.get("/api/admin/hiring-contracts/:id/break-rules", options.authenticateJWT, admin, async (req, res) => {
    try {
      const row = (await options.query("SELECT * FROM hiring_contracts WHERE id::text=$1", [req.params.id])).rows[0];
      return row ? res.json({ breakRules: contractBreakRules(row) }) : res.status(404).json({ error: "Contract not found" });
    } catch { return res.status(500).json({ error: "Failed to load break rules" }); }
  });
  app.patch("/api/admin/hiring-contracts/:id/break-rules", options.authenticateJWT, admin, async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length
      || Object.keys(body).some(key => !Object.prototype.hasOwnProperty.call(fields, key))) return res.status(422).json({ error: "Provide valid contract break rules." });
    for (const [key, value] of Object.entries(body)) {
      if (value === null) continue;
      if (key.endsWith("Paid") ? typeof value !== "boolean"
        : !Number.isInteger(value) || Number(value) < (key === "breaksPerDay" ? 0 : 1) || Number(value) > (key === "breaksPerDay" ? 100 : 1440)) {
        return res.status(422).json({ error: `Invalid ${key}.` });
      }
    }
    const keys = Object.keys(body) as (keyof typeof fields)[];
    try {
      const row = (await options.query(`UPDATE hiring_contracts SET ${keys.map((key, i) => `${fields[key]}=$${i + 2}`).join(",")}
        WHERE id::text=$1 RETURNING *`, [req.params.id, ...keys.map(key => body[key])])).rows[0];
      return row ? res.json({ breakRules: contractBreakRules(row) }) : res.status(404).json({ error: "Contract not found" });
    } catch { return res.status(500).json({ error: "Failed to save break rules" }); }
  });
}
