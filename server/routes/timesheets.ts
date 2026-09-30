import type { Express, RequestHandler } from "express";
import { getClient, query } from "../db.ts";

type Middleware = RequestHandler;
type Options = {
  authenticateJWT: Middleware;
  requireTalent: Middleware;
  requireClient: Middleware;
  requireAdmin: Middleware;
  requireAdminSubRole: (roles: string[]) => Middleware;
  getTalentBillingUserId: (req: any) => Promise<string | null>;
};

const ET = "America/New_York";
const dateString = (value: unknown) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid date-only value from database");
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  throw new Error("Invalid date-only value from database");
};
const dateInZone = (instant: Date, zone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const periodDates = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= 15
    ? [`${year}-${String(month).padStart(2, "0")}-01`, `${year}-${String(month).padStart(2, "0")}-15`]
    : [`${year}-${String(month).padStart(2, "0")}-16`, `${year}-${String(month).padStart(2, "0")}-${last}`];
};
const addCalendarMonth = (year: number, month: number) => {
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
};
const halfMonthPeriodsBetween = (startDate: string, endDate: string) => {
  const periods = new Set<string>();
  let [start, end] = periodDates(startDate);
  while (start <= endDate) {
    periods.add(`${start}|${end}`);
    const [, month, day] = end.split("-").map(Number);
    const [year] = end.split("-").map(Number);
    const nextStart = day === 15
      ? `${year}-${month.toString().padStart(2, "0")}-16`
      : addCalendarMonth(year, month);
    [start, end] = periodDates(nextStart);
  }
  return Array.from(periods);
};
const clipPeriodEnd = (start: string, end: string, effectiveEndDate: string | null) =>
  effectiveEndDate && effectiveEndDate < end ? effectiveEndDate : end;
const addCalendarDay = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};
const midnightUtc = (date: string, zone: string) => {
  // Find the first instant whose local calendar date reaches the requested
  // date. Binary search avoids offset guesses and remains correct over DST
  // transitions (including zones whose clocks change at midnight).
  let low = Date.parse(`${date}T00:00:00.000Z`) - 48 * 60 * 60 * 1000;
  let high = Date.parse(`${date}T00:00:00.000Z`) + 48 * 60 * 60 * 1000;
  if (!Number.isFinite(low) || !Number.isFinite(high)) throw new Error("Invalid calendar date");
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateInZone(new Date(middle), zone) >= date) high = middle;
    else low = middle;
  }
  return new Date(high);
};
const validTimeZone = (zone: unknown): zone is string => {
  if (typeof zone !== "string" || !zone.trim()) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); return true; } catch { return false; }
};
const validateInstant = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function registerTimesheetRoutes(app: Express, options: Options) {
  const { authenticateJWT, requireTalent, requireClient, requireAdmin, requireAdminSubRole } = options;
  const talentAuth = [authenticateJWT, requireTalent];
  const clientAuth = [authenticateJWT, requireClient];
  const adminAuth = [authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"])];

  async function ensurePeriods(contractRows: any[]) {
    const todayET = dateInZone(new Date(), ET);
    for (const contract of contractRows) {
      if (contract.billing_mode !== "tracked") continue;
      const sessions = await query(
        `SELECT started_at, COALESCE(approved_end_at, ended_at, proposed_end_at) AS effective_end
           FROM clock_sessions WHERE hiring_contract_id = $1 ORDER BY started_at`,
        [contract.id],
      );
      const endDate = contract.effective_end_date ? dateString(contract.effective_end_date) : null;
      const through = endDate && endDate < todayET ? endDate : todayET;
      const dates = new Set<string>();
      if (!endDate || todayET <= endDate) {
        const [start, end] = periodDates(through);
        dates.add(`${start}|${clipPeriodEnd(start, end, endDate)}`);
      }
      for (const session of sessions.rows) {
        const first = dateInZone(new Date(session.started_at), ET);
        if (endDate && first > endDate) continue;
        const rawLast = session.effective_end ? dateInZone(new Date(session.effective_end), ET) : todayET;
        const last = endDate && rawLast > endDate ? endDate : rawLast;
        for (const crossed of halfMonthPeriodsBetween(first, last)) {
          const [start, end] = crossed.split("|");
          dates.add(`${start}|${clipPeriodEnd(start, end, endDate)}`);
        }
      }
      for (const value of Array.from(dates)) {
        const [start, end] = value.split("|");
        await query(
          `INSERT INTO timesheet_periods (hiring_contract_id, period_start, period_end, work_timezone)
           VALUES ($1, $2::date, $3::date, $4)
           ON CONFLICT (hiring_contract_id, period_start, period_end)
           DO UPDATE SET work_timezone = EXCLUDED.work_timezone, updated_at = now()
           WHERE timesheet_periods.approved_revision_id IS NULL`,
          [contract.id, start, end, contract.time_zone],
        );
      }
    }
  }

  async function loadPeriods(scopeSql: string, scopeArgs: unknown[]) {
    const contractResult = await query(
      `SELECT hc.id, hc.billing_mode, hc.effective_end_date, j.time_zone FROM hiring_contracts hc
       JOIN job_submissions js ON js.id = hc.submission_id
       JOIN jobs j ON j.id = js.job_id
       WHERE hc.status = 'signed' AND ${scopeSql}`,
      scopeArgs,
    );
    await ensurePeriods(contractResult.rows);
    if (!contractResult.rows.length) return [];
    const ids = contractResult.rows.map((row: any) => row.id);
    const periods = await query(
      `SELECT tp.*, j.title AS job_title, js.talent_id, js.client_id,
              COALESCE(NULLIF(BTRIM(client.company), ''), NULLIF(BTRIM(CONCAT_WS(' ', client.first_name, client.last_name)), '')) AS client_name
       FROM timesheet_periods tp
       JOIN hiring_contracts hc ON hc.id = tp.hiring_contract_id
       JOIN job_submissions js ON js.id = hc.submission_id
       JOIN jobs j ON j.id = js.job_id
       LEFT JOIN users client ON client.id = js.client_id
       WHERE tp.hiring_contract_id = ANY($1::uuid[])
       ORDER BY tp.period_start DESC, tp.created_at DESC`,
      [ids],
    );
    return Promise.all(periods.rows.map(async (period: any) => serializePeriod(period)));
  }

  async function serializePeriod(period: any) {
    const approvedRevision = period.approved_revision_id
      ? await query(
        `SELECT id, work_timezone FROM timesheet_revisions WHERE id = $1`,
        [period.approved_revision_id],
      )
      : null;
    const revision = approvedRevision?.rows[0]
      ? await query(
        `SELECT rs.clock_session_id AS id, rs.started_at, rs.effective_end_at,
                rs.source, cs.ended_at, cs.exception_status
           FROM timesheet_revision_sessions rs JOIN clock_sessions cs ON cs.id = rs.clock_session_id
          WHERE rs.revision_id = $1 ORDER BY rs.started_at`,
        [period.approved_revision_id],
      )
      : null;
    const sessions = await query(
      `SELECT cs.id, cs.started_at, cs.ended_at, cs.approved_end_at, cs.exception_status,
              cs.exception_type, cs.proposed_end_at
         FROM clock_sessions cs
        WHERE cs.hiring_contract_id = $1
          AND cs.started_at < (($3::date + 1)::timestamp AT TIME ZONE '${ET}')
          AND (CASE WHEN cs.exception_status = 'approved'
                    THEN COALESCE(cs.approved_end_at, cs.ended_at)
                    ELSE COALESCE(cs.ended_at, cs.proposed_end_at, now()) END) >= ($2::date::timestamp AT TIME ZONE '${ET}')
        ORDER BY cs.started_at`,
      [period.hiring_contract_id, period.period_start, period.period_end],
    );
    const revisions = await query(
      `SELECT id, version, decision_reason AS reason, exception_approved, work_timezone, created_at
         FROM timesheet_revisions WHERE timesheet_period_id = $1 ORDER BY version`,
      [period.id],
    );
    const corrections = await query(
      `SELECT id, clock_session_id, requested_started_at, requested_end_at, reason, status,
              decision_reason, created_at, decided_at
         FROM timesheet_correction_proposals WHERE timesheet_period_id = $1 ORDER BY created_at`,
      [period.id],
    );
    const disputes = await query(
      `SELECT id, reason, status, resolution_reason, created_at, resolved_at
         FROM timesheet_disputes WHERE timesheet_period_id = $1 ORDER BY created_at`,
      [period.id],
    );
    const workTimezone = approvedRevision?.rows[0]?.work_timezone ?? period.work_timezone;
    const periodStart = midnightUtc(dateString(period.period_start), ET);
    const periodEnd = midnightUtc(addCalendarDay(dateString(period.period_end)), ET);
    const problems: string[] = [];
    if (!validTimeZone(workTimezone)) problems.push("Contract requires an explicit valid IANA work timezone for daily grouping.");
    const outputSessions = (revision?.rows ?? sessions.rows).map((row: any) => {
      const approvedException = row.source === "approved_exception" || row.exception_status === "approved";
      const unresolved = !row.source && row.exception_status && row.exception_status !== "approved";
      const rawEnd = row.effective_end_at ?? (approvedException ? row.approved_end_at : row.ended_at);
      const rawStart = new Date(row.started_at);
      const clippedStart = rawStart < periodStart ? periodStart : rawStart;
      const clippedEnd = rawEnd
        ? new Date(rawEnd) > periodEnd ? periodEnd : new Date(rawEnd)
        : null;
      const effectiveEnd = unresolved || !clippedEnd || clippedEnd <= clippedStart ? null : clippedEnd;
      const status = unresolved ? `exception_${row.exception_status}` : effectiveEnd ? "eligible" : "unresolved";
      if (status !== "eligible") problems.push(`Session ${row.id} requires explicit OnSpot Admin resolution.`);
      return {
        id: row.id, startedAt: clippedStart.toISOString(), endedAt: row.ended_at ?? null,
        effectiveEndAt: effectiveEnd?.toISOString() ?? null, status,
      };
    });
    const daySeconds = new Map<string, number>();
    if (validTimeZone(workTimezone)) {
      for (const session of outputSessions) {
        if (session.status !== "eligible" || !session.effectiveEndAt) continue;
        let cursor = new Date(session.startedAt);
        const finish = new Date(session.effectiveEndAt);
        while (cursor < finish) {
          const date = dateInZone(cursor, workTimezone);
          const next = midnightUtc(addCalendarDay(date), workTimezone);
          const boundary = next > cursor ? next : new Date(cursor.getTime() + 86400000);
          const segmentEnd = boundary < finish ? boundary : finish;
          daySeconds.set(date, (daySeconds.get(date) ?? 0) + (segmentEnd.getTime() - cursor.getTime()) / 1000);
          cursor = segmentEnd;
        }
      }
    }
    const days = Array.from(daySeconds.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, seconds]) => ({
      date, hours: Math.round(seconds / 3600 * 10000) / 10000,
    }));
    return {
      id: period.id, hiringContractId: period.hiring_contract_id,
      periodStart: dateString(period.period_start), periodEnd: dateString(period.period_end), status: period.status,
      workTimezone: workTimezone ?? null, jobTitle: period.job_title, clientName: period.client_name ?? null,
      days, totalHours: Math.round(days.reduce((sum, day) => sum + day.hours, 0) * 10000) / 10000,
      approvalBlocked: problems.length > 0, blockingIssues: Array.from(new Set(problems)),
      sessions: outputSessions,
      revisions: revisions.rows.map((row: any) => ({
        id: row.id, version: row.version, reason: row.reason,
        exceptionApproved: row.exception_approved, workTimezone: row.work_timezone, createdAt: row.created_at,
      })),
      corrections: corrections.rows.map((row: any) => ({
        id: row.id, sessionId: row.clock_session_id, requestedStartedAt: row.requested_started_at,
        requestedEndAt: row.requested_end_at, reason: row.reason, status: row.status,
        decisionReason: row.decision_reason, createdAt: row.created_at, decidedAt: row.decided_at,
      })),
      disputes: disputes.rows.map((row: any) => ({
        id: row.id, reason: row.reason, status: row.status,
        resolutionReason: row.resolution_reason, createdAt: row.created_at, resolvedAt: row.resolved_at,
      })),
    };
  }

  app.get("/api/talent/timesheets", ...talentAuth, async (req: any, res) => {
    try {
      const talentId = await options.getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
      const periods = await loadPeriods("js.talent_id = $1", [talentId]);
      return res.json({ periods });
    } catch (error) {
      console.error("GET talent timesheets failed", error);
      return res.status(500).json({ error: "Failed to load timesheets" });
    }
  });
  app.get("/api/client/timesheets", ...clientAuth, async (req: any, res) => {
    try {
      const periods = await loadPeriods("js.client_id = $1", [req.user.id]);
      return res.json({ periods });
    } catch (error) {
      console.error("GET client timesheets failed", error);
      return res.status(500).json({ error: "Failed to load timesheets" });
    }
  });
  app.get("/api/admin/timesheets", ...adminAuth, async (_req: any, res) => {
    try { return res.json({ periods: await loadPeriods("true", []) }); }
    catch (error) {
      console.error("GET admin timesheets failed", error);
      return res.status(500).json({ error: "Failed to load timesheets" });
    }
  });

  app.post("/api/talent/timesheets/:id/submit", ...talentAuth, async (req: any, res) => {
    const talentId = await options.getTalentBillingUserId(req);
    if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
         `SELECT tp.* FROM timesheet_periods tp
         JOIN hiring_contracts hc ON hc.id = tp.hiring_contract_id
         JOIN job_submissions js ON js.id = hc.submission_id
         WHERE tp.id = $1 AND js.talent_id = $2 AND hc.billing_mode = 'tracked' FOR UPDATE OF tp`,
        [req.params.id, talentId],
      );
      if (!locked.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Timesheet period not found" }); }
      if (!["open", "rejected"].includes(locked.rows[0].status)) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "Timesheet cannot be submitted in its current status" });
      }
      await client.query(`UPDATE timesheet_periods SET status = 'submitted', submitted_at = now(), updated_at = now() WHERE id = $1`, [req.params.id]);
      await client.query(`INSERT INTO timesheet_audit (timesheet_period_id, actor_id, action) VALUES ($1, $2, 'submitted')`, [req.params.id, talentId]);
      await client.query("COMMIT");
      return res.json({ period: await serializeById(req.params.id) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST talent timesheet submit failed", error);
      return res.status(500).json({ error: "Failed to submit timesheet" });
    } finally { client.release(); }
  });

  app.post("/api/talent/timesheets/:id/corrections", ...talentAuth, async (req: any, res) => {
    const talentId = await options.getTalentBillingUserId(req);
    if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
    const corrections = req.body?.corrections;
    if (!Array.isArray(corrections) || !corrections.length || corrections.length > 50) {
      return res.status(422).json({ error: "corrections must be a non-empty array of session time proposals" });
    }
    for (const item of corrections) {
      if (!item || typeof item.sessionId !== "string" || typeof item.reason !== "string" || !item.reason.trim()
        || (!item.startedAt && !item.endedAt)
        || (item.startedAt !== undefined && !validateInstant(item.startedAt))
        || (item.endedAt !== undefined && !validateInstant(item.endedAt))) {
        return res.status(422).json({ error: "Each correction requires sessionId, reason, and at least one valid startedAt/endedAt timestamp" });
      }
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const period = await client.query(
         `SELECT tp.id, tp.status FROM timesheet_periods tp
         JOIN hiring_contracts hc ON hc.id = tp.hiring_contract_id
         JOIN job_submissions js ON js.id = hc.submission_id
         WHERE tp.id = $1 AND js.talent_id = $2 AND hc.billing_mode = 'tracked' FOR UPDATE OF tp`,
        [req.params.id, talentId],
      );
      if (!period.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Timesheet period not found" }); }
      if (["approved", "disputed"].includes(period.rows[0].status)) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "Approved or disputed periods cannot accept corrections" });
      }
      for (const item of corrections) {
        const belongs = await client.query(
          `SELECT cs.id, cs.started_at, cs.ended_at FROM clock_sessions cs
           JOIN timesheet_periods tp ON tp.hiring_contract_id = cs.hiring_contract_id
           WHERE tp.id = $1 AND cs.id = $2 AND cs.talent_id = $3
             AND cs.started_at < ((tp.period_end + 1)::timestamp AT TIME ZONE '${ET}')
             AND (CASE WHEN cs.exception_status = 'approved'
                       THEN COALESCE(cs.approved_end_at, cs.ended_at)
                       ELSE COALESCE(cs.ended_at, cs.proposed_end_at, now()) END) >= (tp.period_start::timestamp AT TIME ZONE '${ET}')`,
          [req.params.id, item.sessionId, talentId],
        );
        if (!belongs.rows.length) { await client.query("ROLLBACK"); return res.status(422).json({ error: `Session ${item.sessionId} is not part of this period` }); }
        const start = item.startedAt ? validateInstant(item.startedAt) : new Date(belongs.rows[0].started_at);
        const end = item.endedAt ? validateInstant(item.endedAt) : new Date(belongs.rows[0].ended_at ?? "");
        if (start && end && end <= start) { await client.query("ROLLBACK"); return res.status(422).json({ error: `Correction for session ${item.sessionId} must end after it starts` }); }
        await client.query(
          `INSERT INTO timesheet_correction_proposals
             (timesheet_period_id, clock_session_id, requested_by, requested_started_at, requested_end_at, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.id, item.sessionId, talentId, item.startedAt ? start : null, item.endedAt ? end : null, item.reason.trim()],
        );
      }
      await client.query(
        `INSERT INTO timesheet_audit (timesheet_period_id, actor_id, action, details)
         VALUES ($1, $2, 'correction_requested', $3::jsonb)`,
        [req.params.id, talentId, JSON.stringify({ sessionIds: corrections.map((item: any) => item.sessionId) })],
      );
      await client.query("COMMIT");
      return res.json({ period: await serializeById(req.params.id) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST talent timesheet corrections failed", error);
      return res.status(500).json({ error: "Failed to submit correction proposals" });
    } finally { client.release(); }
  });

  app.post("/api/client/timesheets/:id/dispute", ...clientAuth, async (req: any, res) => {
    const reason = req.body?.reason;
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 2000) {
      return res.status(422).json({ error: "A dispute reason of up to 2000 characters is required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const own = await client.query(
         `SELECT tp.id, tp.status FROM timesheet_periods tp
         JOIN hiring_contracts hc ON hc.id = tp.hiring_contract_id
         JOIN job_submissions js ON js.id = hc.submission_id
         WHERE tp.id = $1 AND js.client_id = $2 AND hc.billing_mode = 'tracked' FOR UPDATE OF tp`,
        [req.params.id, req.user.id],
      );
      if (!own.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Timesheet period not found" }); }
      if (own.rows[0].status !== "approved") { await client.query("ROLLBACK"); return res.status(409).json({ error: "Only approved timesheets can be disputed" }); }
      await client.query(`INSERT INTO timesheet_disputes (timesheet_period_id, client_id, reason) VALUES ($1, $2, $3)`, [req.params.id, req.user.id, reason.trim()]);
      await client.query(`UPDATE timesheet_periods SET status = 'disputed', updated_at = now() WHERE id = $1`, [req.params.id]);
      await client.query(`INSERT INTO timesheet_audit (timesheet_period_id, actor_id, action, reason) VALUES ($1, $2, 'disputed', $3)`, [req.params.id, req.user.id, reason.trim()]);
      await client.query("COMMIT");
      return res.json({ period: await serializeById(req.params.id) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST client timesheet dispute failed", error);
      return res.status(500).json({ error: "Failed to dispute timesheet" });
    } finally { client.release(); }
  });

  app.post("/api/admin/timesheets/:id/review", ...adminAuth, async (req: any, res) => {
    const { decision, reason, edits, correctionDecisions } = req.body ?? {};
    if (!["approve", "reject", "edit", "exception"].includes(decision) || typeof reason !== "string" || !reason.trim()) {
      return res.status(422).json({ error: "decision (approve, reject, edit, exception) and reason are required" });
    }
    if (edits !== undefined && (!Array.isArray(edits) || edits.some((item: any) =>
      !item || typeof item.sessionId !== "string" || !validateInstant(item.startedAt) || !validateInstant(item.endedAt)))) {
      return res.status(422).json({ error: "edits must contain sessionId, valid startedAt, and valid endedAt timestamps" });
    }
    if (correctionDecisions !== undefined && (!Array.isArray(correctionDecisions) || correctionDecisions.some((item: any) =>
      !item || typeof item.correctionId !== "string" || !["approve", "reject"].includes(item.decision)))) {
      return res.status(422).json({ error: "correctionDecisions must contain correctionId and approve/reject decision" });
    }
    if (decision === "edit" && !edits?.length) return res.status(422).json({ error: "edit decision requires at least one session edit" });
    const adminId = req.user.id;
    const client = await getClient();
    try {
      await client.query("BEGIN");
       const found = await client.query(
         `SELECT tp.*, hc.effective_end_date FROM timesheet_periods tp
          JOIN hiring_contracts hc ON hc.id = tp.hiring_contract_id
          WHERE tp.id = $1 AND hc.billing_mode = 'tracked' FOR UPDATE OF tp, hc`,
         [req.params.id],
       );
      if (!found.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Timesheet period not found" }); }
      const period = found.rows[0];
      if (period.effective_end_date
        && dateString(period.period_end) === dateString(period.effective_end_date)
        && dateInZone(new Date(), ET) <= dateString(period.effective_end_date)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "The final timesheet period cannot be approved until the contract end date has passed" });
      }
      if (!["submitted", "disputed"].includes(period.status)) {
        await client.query("ROLLBACK"); return res.status(409).json({ error: "Only submitted or disputed periods can be reviewed" });
      }
      if (decision === "reject") {
        await client.query(`UPDATE timesheet_periods SET status = 'rejected', updated_at = now() WHERE id = $1`, [period.id]);
        await client.query(
          `UPDATE timesheet_disputes SET status = 'resolved', resolved_by = $2, resolution_reason = $3, resolved_at = now()
           WHERE timesheet_period_id = $1 AND status = 'open'`,
          [period.id, adminId, reason.trim()],
        );
        await client.query(`UPDATE timesheet_correction_proposals SET status = 'rejected', decided_by = $2, decision_reason = $3, decided_at = now() WHERE timesheet_period_id = $1 AND status = 'pending'`, [period.id, adminId, reason.trim()]);
        await client.query(`INSERT INTO timesheet_audit (timesheet_period_id, actor_id, action, reason) VALUES ($1, $2, 'review_rejected', $3)`, [period.id, adminId, reason.trim()]);
        await client.query("COMMIT");
        return res.json({ period: await serializeById(period.id) });
      }
      const pendingCorrections = await client.query(
        `SELECT id, clock_session_id FROM timesheet_correction_proposals
         WHERE timesheet_period_id = $1 AND status = 'pending' FOR UPDATE`,
        [period.id],
      );
      const decisionsById = new Map((correctionDecisions ?? []).map((item: any) => [item.correctionId, item]));
      for (const proposal of pendingCorrections.rows) {
        const proposalDecision = decisionsById.get(proposal.id) as any;
        if (!proposalDecision) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: `Correction ${proposal.id} needs an explicit approve/reject decision` });
        }
        if (proposalDecision.decision === "approve" && !edits?.some((item: any) => item.sessionId === proposal.clock_session_id)) {
          await client.query("ROLLBACK");
          return res.status(422).json({ error: `Approved correction ${proposal.id} requires a matching final session edit` });
        }
      }
      for (const proposalDecision of correctionDecisions ?? []) {
        const proposal = pendingCorrections.rows.find((item: any) => item.id === proposalDecision.correctionId);
        if (!proposal) {
          await client.query("ROLLBACK");
          return res.status(422).json({ error: `Correction ${proposalDecision.correctionId} is not pending in this period` });
        }
        await client.query(
          `UPDATE timesheet_correction_proposals SET status = $2, decided_by = $3,
             decision_reason = $4, decided_at = now() WHERE id = $1 AND status = 'pending'`,
          [proposal.id, proposalDecision.decision === "approve" ? "approved" : "rejected", adminId,
            typeof proposalDecision.reason === "string" && proposalDecision.reason.trim() ? proposalDecision.reason.trim() : reason.trim()],
        );
        await client.query(
          `INSERT INTO timesheet_audit (timesheet_period_id, actor_id, action, reason, details)
           VALUES ($1, $2, 'correction_decided', $3, $4::jsonb)`,
          [period.id, adminId, reason.trim(), JSON.stringify({ correctionId: proposal.id, decision: proposalDecision.decision })],
        );
      }
      const isDisputeReapproval = period.status === "disputed" && !!period.approved_revision_id;
      let timezone: string | null;
      let sourceRows: any[];
      if (isDisputeReapproval) {
        const previousRevision = await client.query(
          `SELECT work_timezone FROM timesheet_revisions WHERE id = $1`,
          [period.approved_revision_id],
        );
        timezone = previousRevision.rows[0]?.work_timezone ?? null;
        const previousSessions = await client.query(
          `SELECT clock_session_id AS id, started_at, effective_end_at, source
             FROM timesheet_revision_sessions WHERE revision_id = $1 ORDER BY started_at`,
          [period.approved_revision_id],
        );
        sourceRows = previousSessions.rows;
      } else {
        const job = await client.query(
          `SELECT j.time_zone FROM hiring_contracts hc JOIN job_submissions js ON js.id = hc.submission_id JOIN jobs j ON j.id = js.job_id WHERE hc.id = $1`,
          [period.hiring_contract_id],
        );
        timezone = job.rows[0]?.time_zone ?? null;
        const startBoundary = midnightUtc(dateString(period.period_start), ET);
        const endBoundary = midnightUtc(addCalendarDay(dateString(period.period_end)), ET);
        const sessions = await client.query(
          `SELECT * FROM clock_sessions WHERE hiring_contract_id = $1
            AND started_at < $3
            AND (CASE WHEN exception_status = 'approved'
                      THEN COALESCE(approved_end_at, ended_at)
                      ELSE COALESCE(ended_at, proposed_end_at, now()) END) >= $2
            ORDER BY started_at FOR UPDATE`,
          [period.hiring_contract_id, startBoundary, endBoundary],
        );
        sourceRows = sessions.rows;
      }
      if (!validTimeZone(timezone)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Contract requires an explicit valid IANA work timezone before timesheet approval" }); }
      const startBoundary = midnightUtc(dateString(period.period_start), ET);
      const endBoundary = midnightUtc(addCalendarDay(dateString(period.period_end)), ET);
      const editsById = new Map((edits ?? []).map((item: any) => [item.sessionId, item]));
      const eligible: Array<{ id: string; startedAt: Date; endAt: Date; source: string }> = [];
      for (const session of sourceRows) {
        const correction = editsById.get(session.id) as any;
        if (isDisputeReapproval) {
          const startedAt = correction ? validateInstant(correction.startedAt)! : new Date(session.started_at);
          const endAt = correction ? validateInstant(correction.endedAt)! : new Date(session.effective_end_at);
          if (endAt <= startedAt || startedAt >= endBoundary || endAt <= startBoundary) {
            await client.query("ROLLBACK");
            return res.status(422).json({ error: `Edited session ${session.id} does not overlap the timesheet period` });
          }
          const snapshotStart = startedAt < startBoundary ? startBoundary : startedAt;
          const snapshotEnd = endAt > endBoundary ? endBoundary : endAt;
          eligible.push({
            id: session.id, startedAt: snapshotStart, endAt: snapshotEnd,
            source: correction ? "admin_correction" : session.source,
          });
          continue;
        }
        const unresolved = session.exception_status && session.exception_status !== "approved";
        if (unresolved && (decision !== "exception" || !correction)) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: `Session ${session.id} has an unresolved missed-out/long-session anomaly; explicit exception edits are required before approval` });
        }
        let startedAt = correction ? validateInstant(correction.startedAt)! : new Date(session.started_at);
        let endAt = correction ? validateInstant(correction.endedAt)! :
          session.exception_status === "approved" ? session.approved_end_at && new Date(session.approved_end_at) :
            session.exception_status ? null : session.ended_at && new Date(session.ended_at);
        if (!endAt || endAt <= startedAt) {
          await client.query("ROLLBACK"); return res.status(409).json({ error: `Session ${session.id} has no eligible end time` });
        }
        if (startedAt >= endBoundary || endAt <= startBoundary) {
          await client.query("ROLLBACK"); return res.status(422).json({ error: `Session ${session.id} edit does not overlap the timesheet period` });
        }
        const snapshotStart = startedAt < startBoundary ? startBoundary : startedAt;
        const snapshotEnd = endAt > endBoundary ? endBoundary : endAt;
        eligible.push({ id: session.id, startedAt: snapshotStart, endAt: snapshotEnd, source: correction ? "admin_correction" : session.exception_status === "approved" ? "approved_exception" : "clock" });
      }
      for (const id of Array.from(editsById.keys())) {
        if (!sourceRows.some((session: any) => session.id === id)) {
          await client.query("ROLLBACK"); return res.status(422).json({ error: `Edited session ${id} is not part of this timesheet period` });
        }
      }
      const billableHours = Math.round(eligible.reduce(
        (seconds, item) => seconds + (item.endAt.getTime() - item.startedAt.getTime()) / 1000,
        0,
      ) / 3600 * 10000) / 10000;
      if (!(billableHours > 0)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "A timesheet must contain positive billable hours at persisted precision" });
      }
      const version = await client.query(`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM timesheet_revisions WHERE timesheet_period_id = $1`, [period.id]);
      const revision = await client.query(
        `INSERT INTO timesheet_revisions
           (timesheet_period_id, version, created_by, decision_reason, exception_approved, work_timezone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [period.id, version.rows[0].next, adminId, reason.trim(), decision === "exception", timezone],
      );
      const revisionId = revision.rows[0].id;
      if (isDisputeReapproval) {
        const editedIds = Array.from(editsById.keys());
        await client.query(
          `INSERT INTO timesheet_revision_sessions
             (revision_id, clock_session_id, started_at, effective_end_at, source)
           SELECT $1, clock_session_id, started_at, effective_end_at, source
             FROM timesheet_revision_sessions
            WHERE revision_id = $2 AND NOT (clock_session_id = ANY($3::uuid[]))`,
          [revisionId, period.approved_revision_id, editedIds],
        );
        for (const item of eligible.filter((candidate) => editsById.has(candidate.id))) {
          await client.query(
            `INSERT INTO timesheet_revision_sessions (revision_id, clock_session_id, started_at, effective_end_at, source)
             VALUES ($1, $2, $3, $4, $5)`,
            [revisionId, item.id, item.startedAt, item.endAt, item.source],
          );
        }
      } else {
        for (const item of eligible) {
          await client.query(
            `INSERT INTO timesheet_revision_sessions (revision_id, clock_session_id, started_at, effective_end_at, source)
             VALUES ($1, $2, $3, $4, $5)`,
            [revisionId, item.id, item.startedAt, item.endAt, item.source],
          );
        }
      }
      await client.query(
        `UPDATE timesheet_periods SET status = 'approved', approved_revision_id = $2, work_timezone = $3, updated_at = now() WHERE id = $1`,
        [period.id, revisionId, timezone],
      );
      await client.query(
        `UPDATE timesheet_disputes SET status = 'resolved', resolved_by = $2, resolution_reason = $3, resolved_at = now()
         WHERE timesheet_period_id = $1 AND status = 'open'`,
        [period.id, adminId, reason.trim()],
      );
      const action = decision === "exception" ? "review_exception" : "review_approved";
      await client.query(`INSERT INTO timesheet_audit (timesheet_period_id, actor_id, action, reason, details) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [period.id, adminId, action, reason.trim(), JSON.stringify({ revisionId, version: version.rows[0].next, edits: edits ?? [] })]);
      await client.query("COMMIT");
      return res.json({ period: await serializeById(period.id) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST admin timesheet review failed", error);
      return res.status(500).json({ error: "Failed to review timesheet" });
    } finally { client.release(); }
  });

  async function serializeById(id: string) {
    const result = await query(
      `SELECT tp.*, j.title AS job_title, js.talent_id, js.client_id,
              COALESCE(NULLIF(BTRIM(client.company), ''), NULLIF(BTRIM(CONCAT_WS(' ', client.first_name, client.last_name)), '')) AS client_name
         FROM timesheet_periods tp JOIN hiring_contracts hc ON hc.id = tp.hiring_contract_id
         JOIN job_submissions js ON js.id = hc.submission_id JOIN jobs j ON j.id = js.job_id
         LEFT JOIN users client ON client.id = js.client_id WHERE tp.id = $1`,
      [id],
    );
    return result.rows[0] ? serializePeriod(result.rows[0]) : null;
  }
}