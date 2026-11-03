import type { Express, RequestHandler } from "express";
import { serializeWorkSession } from "./clock";

type Query = (sql: string, args?: any[]) => Promise<{ rows: any[] }>;
type Connection = { query: Query; release: () => void };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Options = {
  authenticateJWT: RequestHandler; requireTalent: RequestHandler;
  requireClient: RequestHandler; requireAdmin: RequestHandler;
  getTalentBillingUserId: (req: any) => Promise<string | null>;
  query: Query; getClient: () => Promise<Connection>;
};

// The latest append-only proposal, not initial anomaly detection, starts the
// client's three-day review window. This also covers pre-existing requests.
export const CLOCK_PROPOSAL_TIME_SQL = `(SELECT max(r.created_at) FROM clock_exception_reviews r
  WHERE r.clock_session_id = cs.id AND r.action = 'proposed')`;

async function notify(client: Connection, userId: string, type: string, title: string, message: string, id: string) {
  await client.query(`INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES ($1,$2,$3,$4,$5)`, [userId, type, title, message, id]);
}

// Lock the contract before sessions/periods, matching the review serialization
// boundary. Immutable approved revision snapshots must never be reinterpreted.
async function lockContext(client: Connection, sessionId: string, talentId?: string, clientId?: string) {
  const context = await client.query(`SELECT cs.hiring_contract_id, cs.talent_id, js.client_id
    FROM clock_sessions cs JOIN hiring_contracts hc ON hc.id = cs.hiring_contract_id
    JOIN job_submissions js ON js.id = hc.submission_id WHERE cs.id = $1
    AND ($2::text IS NULL OR cs.talent_id = $2)
    AND ($3::text IS NULL OR js.client_id = $3)`,
  [sessionId, talentId ?? null, clientId ?? null]);
  if (!context.rows.length) return null;
  await client.query("SELECT id FROM hiring_contracts WHERE id = $1 FOR UPDATE", [context.rows[0].hiring_contract_id]);
  const session = await client.query(`SELECT cs.*, ${CLOCK_PROPOSAL_TIME_SQL} AS submitted_at,
    COALESCE(${CLOCK_PROPOSAL_TIME_SQL}, cs.exception_detected_at) <= now() - interval '3 days' AS escalated
    FROM clock_sessions cs WHERE cs.id = $1 FOR UPDATE`, [sessionId]);
  return { ...session.rows[0], client_id: context.rows[0].client_id };
}

async function approvedPeriodExists(client: Connection, row: any) {
  const periods = await client.query(`SELECT id FROM timesheet_periods
    WHERE hiring_contract_id = $1 AND (status = 'approved' OR approved_revision_id IS NOT NULL)
    AND ($2::timestamptz < ((period_end + 1)::timestamp AT TIME ZONE 'America/New_York'))
    AND (COALESCE($3::timestamptz, now()) > (period_start::timestamp AT TIME ZONE 'America/New_York'))
    FOR UPDATE`, [row.hiring_contract_id, row.started_at, row.ended_at]);
  return periods.rows.length > 0;
}

export function registerClockAdjustmentRoutes(app: Express, options: Options) {
  const { authenticateJWT, requireTalent, requireClient, requireAdmin, getClient, query } = options;
  app.post("/api/talent/clock/exception", authenticateJWT, requireTalent, async (req: any, res) => {
    const talentId = await options.getTalentBillingUserId(req);
    if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
    const { sessionId, proposedEndAt, reason } = req.body ?? {};
    const proposed = new Date(proposedEndAt);
    if (typeof sessionId !== "string" || !uuidPattern.test(sessionId)
      || typeof proposedEndAt !== "string" || !Number.isFinite(proposed.getTime())
      || typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) {
      return res.status(422).json({ error: "A session, valid time out and reason (1–1000 characters) are required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [talentId]);
      const row = await lockContext(client, sessionId, talentId);
      if (!row) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Clock session not found" }); }
      if (!row.ended_at || ![null, "detected", "rejected"].includes(row.exception_status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Time out first. Only completed sessions without a pending or approved adjustment can be adjusted." });
      }
      if (proposed <= new Date(row.started_at) || proposed > new Date(row.ended_at)) {
        await client.query("ROLLBACK");
        return res.status(422).json({ error: "Requested time out must be after time in and no later than the recorded time out" });
      }
      if (await approvedPeriodExists(client, row)) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "An approved timesheet period cannot be adjusted" });
      }
      const updated = await client.query(`UPDATE clock_sessions SET
        exception_type = 'missed_out', exception_status = 'pending',
        exception_detected_at = COALESCE(exception_detected_at, now()),
        proposed_end_at = $2, proposal_reason = $3, approved_end_at = NULL,
        resolved_by = NULL, resolved_at = NULL, resolution_reason = NULL
        WHERE id = $1 RETURNING *`, [sessionId, proposed.toISOString(), reason.trim()]);
      await client.query(`INSERT INTO clock_exception_reviews
        (clock_session_id, action, actor_id, proposed_end_at, proposal_reason)
        VALUES ($1,'proposed',$2,$3,$4)`, [sessionId, talentId, proposed.toISOString(), reason.trim()]);
      await notify(client, row.client_id, "clock_adjustment_requested", "Time-out adjustment needs review",
        "A Talent has requested a shorter time out. Review the recorded and requested times in Timesheets.", sessionId);
      await client.query("COMMIT");
      return res.json(serializeWorkSession(updated.rows[0]));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Clock adjustment proposal failed", error);
      return res.status(500).json({ error: "Failed to submit time-out adjustment" });
    } finally { client.release(); }
  });

  const resolve = (role: "client" | "admin"): RequestHandler => async (req: any, res) => {
    const { decision, reason } = req.body ?? {};
    if (!["approve", "reject"].includes(decision)
      || (reason !== undefined && (typeof reason !== "string" || reason.trim().length > 1000))
      || (decision === "reject" && !reason?.trim())) {
      return res.status(422).json({ error: "Choose approve or reject; rejection requires a reason (maximum 1000 characters)" });
    }
    if (!uuidPattern.test(req.params.sessionId)) return res.status(404).json({ error: "Clock session not found" });
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const row = await lockContext(client, req.params.sessionId, undefined, role === "client" ? req.user.id : undefined);
      if (!row) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Clock session not found" }); }
      if (row.exception_status !== "pending" || !row.ended_at) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "There is no closed session with a pending adjustment. Talent must time out first." });
      }
      if (role === "admin" && !row.escalated) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "Awaiting client review. OnSpot can resolve after 3 days." });
      }
      if (!row.proposed_end_at || new Date(row.proposed_end_at) <= new Date(row.started_at)
        || new Date(row.proposed_end_at) > new Date(row.ended_at)) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "The requested time out is outside the recorded session" });
      }
      if (await approvedPeriodExists(client, row)) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "An approved timesheet period cannot be adjusted" });
      }
      const status = decision === "approve" ? "approved" : "rejected";
      const note = reason?.trim() || `Approved by ${role === "client" ? "client" : "OnSpot admin"}`;
      await client.query(`INSERT INTO clock_exception_reviews
        (clock_session_id,action,reviewer_id,reviewer_role,proposed_end_at,proposal_reason,decision_reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, status, req.user.id, role, row.proposed_end_at, row.proposal_reason, note]);
      const updated = await client.query(`UPDATE clock_sessions SET exception_status = $2,
        approved_end_at = CASE WHEN $2 = 'approved' THEN proposed_end_at ELSE NULL END,
        resolved_by = $3, resolved_at = now(), resolution_reason = $4 WHERE id = $1 RETURNING *`,
      [row.id, status, req.user.id, note]);
      await notify(client, row.talent_id, "clock_adjustment_resolved", `Time-out adjustment ${status}`,
        `Your time-out adjustment was ${status}. ${note}`, row.id);
      await client.query("COMMIT");
      return res.json(serializeWorkSession(updated.rows[0]));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Clock adjustment review failed", error);
      return res.status(500).json({ error: "Failed to review time-out adjustment" });
    } finally { client.release(); }
  };
  app.post("/api/client/clock/:sessionId/resolve", authenticateJWT, requireClient, resolve("client"));
  app.post("/api/admin/clock/:sessionId/resolve", authenticateJWT, requireAdmin, resolve("admin"));
  app.get("/api/admin/clock/exceptions", authenticateJWT, requireAdmin, async (_req, res) => {
    try {
      const result = await query(`SELECT cs.*, u.email AS talent_email,
        NULLIF(trim(concat_ws(' ',u.first_name,u.last_name)),'') AS talent_name, j.title AS job_title,
        ${CLOCK_PROPOSAL_TIME_SQL} AS submitted_at,
        COALESCE(${CLOCK_PROPOSAL_TIME_SQL},cs.exception_detected_at) <= now() - interval '3 days' AS escalated
        FROM clock_sessions cs JOIN users u ON u.id = cs.talent_id
        JOIN hiring_contracts hc ON hc.id = cs.hiring_contract_id
        JOIN job_submissions js ON js.id = hc.submission_id JOIN jobs j ON j.id = js.job_id
        WHERE cs.exception_status IN ('detected','pending','rejected')
        ORDER BY cs.exception_detected_at DESC NULLS LAST, cs.started_at DESC`);
      return res.json(result.rows.map(row => ({
        ...serializeWorkSession(row), status: row.exception_status, talentId: row.talent_id,
        talentName: row.talent_name, talentEmail: row.talent_email, jobTitle: row.job_title,
        submittedAt: row.submitted_at, escalated: row.escalated === true,
        canResolve: row.exception_status === "pending" && Boolean(row.ended_at) && row.escalated === true,
        approvedEndAt: row.approved_end_at, resolvedBy: row.resolved_by, resolvedAt: row.resolved_at,
      })));
    } catch (error) {
      console.error("Clock adjustment list failed", error);
      return res.status(500).json({ error: "Failed to load clock adjustments" });
    }
  });
}
