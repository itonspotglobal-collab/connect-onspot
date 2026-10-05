import type { Express, RequestHandler } from "express";
import { isInvestorGoalKey, parseInvestorGoal } from "../../shared/investorGoals";

type SettingsQuery = (text: string, values?: any[]) => Promise<{ rows: any[] }>;

/** Keep goals independent of the unchanged account-count endpoint and its cache. */
export function registerInvestorGoalRoutes(app: Express, query: SettingsQuery): void {
  app.get("/api/public/investor-goals", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await query(
        `SELECT key, value FROM platform_settings
         WHERE key IN ('investor_goal_contractors_2027', 'investor_goal_clients_2027')`,
      );
      const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
      res.json({
        contractorGoal2027: parseInvestorGoal(values.investor_goal_contractors_2027),
        clientGoal2027: parseInvestorGoal(values.investor_goal_clients_2027),
      });
    } catch (error) {
      console.error("Failed to load investor goals", error);
      res.status(503).json({ error: "Investor goals are temporarily unavailable" });
    }
  });
}

/** Apply the existing DB-backed Super Admin policy only to these new settings. */
export function guardInvestorGoalUpdates(requireSuperAdmin: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (Object.keys(req.body ?? {}).some(isInvestorGoalKey)) {
      return requireSuperAdmin(req, res, next);
    }
    next();
  };
}
