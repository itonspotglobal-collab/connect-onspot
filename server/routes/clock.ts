import type { Express, RequestHandler } from "express";
import { validWorkTimezone } from "../../shared/workTimezone";
import { TIMESHEET_HIRE_SQL, TIMESHEET_CONTEXT_SQL, timesheetDisplayContext } from "../services/timesheetEligibility";

type Query = (sql: string, args?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
type Options = {
  authenticateJWT: RequestHandler;
  requireTalent: RequestHandler;
  getTalentBillingUserId: (req: any) => Promise<string | null>;
  query: Query;
  getClient: () => Promise<{ query: Query; release: () => void }>;
};

const activeContract = `${TIMESHEET_HIRE_SQL} AND hc.status = 'signed'
  AND hc.billing_mode = 'tracked'
  AND (hc.effective_start_date IS NULL OR hc.effective_start_date <= (now() AT TIME ZONE 'America/New_York')::date)
  AND (hc.effective_end_date IS NULL OR hc.effective_end_date >= (now() AT TIME ZONE 'America/New_York')::date)`;

export function serializeWorkSession(row: any) {
  const end = row.exception_status === "approved" ? row.approved_end_at ?? row.ended_at : row.ended_at;
  const duration = end ? (new Date(end).getTime() - new Date(row.started_at).getTime()) / 1000 : null;
  return {
    id: row.id, hiringContractId: row.hiring_contract_id,
    startedAt: row.started_at, endedAt: row.ended_at ?? null,
    effectiveEndAt: end ?? null,
    durationSeconds: duration !== null && Number.isFinite(duration) && duration >= 0 ? duration : null,
    workTimezone: validWorkTimezone(row.work_timezone) ? row.work_timezone : null,
    status: row.exception_status ? `exception_${row.exception_status}`
      : row.ended_at ? "completed" : "active",
    exceptionType: row.exception_type ?? null,
    exceptionDetectedAt: row.exception_detected_at ?? null,
    proposedEndAt: row.proposed_end_at ?? null,
    proposalReason: row.proposal_reason ?? null,
  };
}

export function registerClockRoutes(app: Express, options: Options) {
  const { query, getClient, getTalentBillingUserId, authenticateJWT, requireTalent } = options;
  const auth = [authenticateJWT, requireTalent];
  app.get("/api/talent/clock", ...auth, async (req, res) => {
    try {
      const talentId = await getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
      const detector = await getClient();
      try {
        await detector.query("BEGIN");
        const detected = await detector.query(
          `UPDATE clock_sessions SET exception_type = 'missed_out', exception_status = 'detected',
            exception_detected_at = NOW()
           WHERE talent_id = $1 AND ended_at IS NULL AND exception_status IS NULL
             AND started_at < NOW() - INTERVAL '16 hours' RETURNING id`, [talentId]);
        for (const row of detected.rows) await detector.query(
          `INSERT INTO clock_exception_reviews (clock_session_id, action) VALUES ($1, 'detected')`, [row.id]);
        await detector.query("COMMIT");
      } catch (error) { await detector.query("ROLLBACK").catch(() => {}); throw error; }
      finally { detector.release(); }
      const [contracts, active, recent, clock] = await Promise.all([
        query(`SELECT hc.id, ${TIMESHEET_CONTEXT_SQL}, COALESCE(hc.work_timezone, j.time_zone) AS work_timezone,
          EXISTS (SELECT 1 FROM clock_sessions cs WHERE cs.hiring_contract_id = hc.id) AS has_sessions,
          EXISTS (SELECT 1 FROM timesheet_periods tp WHERE tp.hiring_contract_id = hc.id
            AND tp.approved_revision_id IS NOT NULL) AS has_approved_revision
          FROM hiring_contracts hc JOIN job_submissions js ON js.id = hc.submission_id
          JOIN jobs j ON j.id = js.job_id LEFT JOIN users client ON client.id = js.client_id
          LEFT JOIN users talent ON talent.id = js.talent_id
          WHERE js.talent_id = $1 AND ${activeContract} ORDER BY hc.created_at DESC`, [talentId]),
        query(`SELECT cs.*, COALESCE(hc.work_timezone, j.time_zone) AS work_timezone
          FROM clock_sessions cs JOIN hiring_contracts hc ON hc.id = cs.hiring_contract_id
          JOIN job_submissions js ON js.id = hc.submission_id JOIN jobs j ON j.id = js.job_id
          WHERE cs.talent_id = $1 AND cs.ended_at IS NULL AND cs.exception_status IS DISTINCT FROM 'approved'
          ORDER BY cs.started_at DESC LIMIT 1`, [talentId]),
        query(`SELECT cs.*, COALESCE(hc.work_timezone, j.time_zone) AS work_timezone
          FROM clock_sessions cs JOIN hiring_contracts hc ON hc.id = cs.hiring_contract_id
          JOIN job_submissions js ON js.id = hc.submission_id JOIN jobs j ON j.id = js.job_id
          WHERE cs.talent_id = $1 AND (cs.ended_at IS NOT NULL OR cs.exception_status IS NOT NULL)
          ORDER BY cs.started_at DESC LIMIT 20`, [talentId]),
        query("SELECT clock_timestamp() AS server_now"),
      ]);
      return res.json({
        serverNow: clock.rows[0].server_now,
        contracts: contracts.rows.map((row) => ({
          ...timesheetDisplayContext(row), id: row.id,
          workTimezone: validWorkTimezone(row.work_timezone) ? row.work_timezone : null,
          timezoneLocked: Boolean(row.has_approved_revision || (row.has_sessions && validWorkTimezone(row.work_timezone))),
        })),
        activeSession: active.rows[0] ? serializeWorkSession(active.rows[0]) : null,
        recentSessions: recent.rows.map(serializeWorkSession),
      });
    } catch (error) {
      console.error("GET talent clock failed", error);
      return res.status(500).json({ error: "Failed to load clock sessions" });
    }
  });

  app.put("/api/talent/clock/timezone", ...auth, async (req, res) => {
    const talentId = await getTalentBillingUserId(req);
    if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
    const { hiringContractId, workTimezone } = req.body ?? {};
    if (typeof hiringContractId !== "string" || !validWorkTimezone(workTimezone)) {
      return res.status(422).json({ error: "Select an explicit valid IANA work timezone, such as Asia/Manila." });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [talentId]);
      const contract = await client.query(
        `SELECT hc.id, COALESCE(hc.work_timezone, j.time_zone) AS work_timezone
         FROM hiring_contracts hc JOIN job_submissions js ON js.id = hc.submission_id
         JOIN jobs j ON j.id = js.job_id
         WHERE hc.id = $1 AND js.talent_id = $2 AND ${activeContract} FOR UPDATE OF hc`,
        [hiringContractId, talentId]);
      if (!contract.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Active tracked engagement not found" });
      }
      const history = await client.query(
        `SELECT EXISTS (SELECT 1 FROM clock_sessions WHERE hiring_contract_id = $1) AS has_sessions,
          EXISTS (SELECT 1 FROM timesheet_periods WHERE hiring_contract_id = $1
            AND approved_revision_id IS NOT NULL) AS has_approved_revision`, [hiringContractId]);
      const oldZone = contract.rows[0].work_timezone;
      if (oldZone !== workTimezone && (history.rows[0].has_approved_revision
        || (history.rows[0].has_sessions && validWorkTimezone(oldZone)))) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Work timezone is fixed after recorded work to preserve historical daily totals." });
      }
      await client.query("UPDATE hiring_contracts SET work_timezone = $2 WHERE id = $1", [hiringContractId, workTimezone]);
      await client.query(`UPDATE timesheet_periods SET work_timezone = $2, updated_at = now()
        WHERE hiring_contract_id = $1 AND approved_revision_id IS NULL`, [hiringContractId, workTimezone]);
      await client.query("COMMIT");
      return res.json({ hiringContractId, workTimezone });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("PUT clock timezone failed", error);
      return res.status(500).json({ error: "Failed to save work timezone" });
    } finally { client.release(); }
  });

  app.post("/api/talent/clock/in", ...auth, async (req, res) => {
    const talentId = await getTalentBillingUserId(req);
    if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
    const hiringContractId = req.body?.hiringContractId;
    if (typeof hiringContractId !== "string" || !hiringContractId.trim()) {
      return res.status(422).json({ error: "hiringContractId is required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [talentId]);
      const contract = await client.query(
        `SELECT hc.id, COALESCE(hc.work_timezone, j.time_zone) AS work_timezone
         FROM hiring_contracts hc JOIN job_submissions js ON js.id = hc.submission_id
         JOIN jobs j ON j.id = js.job_id
         WHERE hc.id = $1 AND js.talent_id = $2 AND ${activeContract} FOR UPDATE OF hc`,
        [hiringContractId, talentId]);
      if (!contract.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "No active signed tracked engagement is available for this Talent." });
      }
      const zone = contract.rows[0].work_timezone;
      if (!validWorkTimezone(zone)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Confirm a valid work timezone before clocking in." });
      }
      const open = await client.query(`SELECT id FROM clock_sessions WHERE talent_id = $1 AND ended_at IS NULL
        AND exception_status IS DISTINCT FROM 'approved' LIMIT 1 FOR UPDATE`, [talentId]);
      if (open.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "A clock session is already open or awaiting exception resolution" });
      }
      await client.query("UPDATE hiring_contracts SET work_timezone = $2 WHERE id = $1 AND work_timezone IS NULL", [hiringContractId, zone]);
      const inserted = await client.query(`INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at)
        VALUES ($1, $2, clock_timestamp()) RETURNING *`, [hiringContractId, talentId]);
      await client.query("COMMIT");
      return res.status(201).json(serializeWorkSession({ ...inserted.rows[0], work_timezone: zone }));
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23505") return res.status(409).json({ error: "A clock session is already open" });
      console.error("POST clock in failed", error);
      return res.status(500).json({ error: "Failed to start clock session" });
    } finally { client.release(); }
  });

  app.post("/api/talent/clock/out", ...auth, async (req, res) => {
    const talentId = await getTalentBillingUserId(req);
    if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [talentId]);
      const active = await client.query(`SELECT cs.*, COALESCE(hc.work_timezone, j.time_zone) AS work_timezone
        FROM clock_sessions cs JOIN hiring_contracts hc ON hc.id = cs.hiring_contract_id
        JOIN job_submissions js ON js.id = hc.submission_id JOIN jobs j ON j.id = js.job_id
        WHERE cs.talent_id = $1 AND cs.ended_at IS NULL AND cs.exception_status IS DISTINCT FROM 'approved'
        ORDER BY cs.started_at DESC LIMIT 1 FOR UPDATE OF cs`, [talentId]);
      if (!active.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "There is no active clock session to end" });
      }
      if (active.rows[0].exception_status === "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "A proposed missed-out exception must be reviewed before clocking out" });
      }
      if (active.rows[0].exception_status === null) {
        const detected = await client.query(`UPDATE clock_sessions SET exception_type = 'missed_out',
          exception_status = 'detected', exception_detected_at = NOW()
          WHERE id = $1 AND started_at < NOW() - INTERVAL '16 hours' AND exception_status IS NULL RETURNING id`, [active.rows[0].id]);
        if (detected.rows.length) await client.query(
          `INSERT INTO clock_exception_reviews (clock_session_id, action) VALUES ($1, 'detected')`, [active.rows[0].id]);
      }
      const ended = await client.query("UPDATE clock_sessions SET ended_at = clock_timestamp() WHERE id = $1 AND ended_at IS NULL RETURNING *", [active.rows[0].id]);
      await client.query("COMMIT");
      return res.json(serializeWorkSession({ ...ended.rows[0], work_timezone: active.rows[0].work_timezone }));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST clock out failed", error);
      return res.status(500).json({ error: "Failed to end clock session" });
    } finally { client.release(); }
  });
}
