import type { Express, RequestHandler } from "express";
import { getClient, query } from "../db.ts";
import { rebuildDraftInvoicesForTermination } from "./talentInvoices.js";

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
const dateInZone = (instant: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const dateString = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const validDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validReason = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim() && value.trim().length <= 2000;
const BILLING_MODES = ["tracked", "guaranteed"];

export const usdOnlyTerminationFailure = (error: any) => error?.status === 400 && error?.code === "USD_ONLY"
  ? { status: 400, body: { error: error.message, code: error.code } }
  : null;

async function reopenFinalTimesheetPeriod(client: any, contractId: string, effectiveEndDate: string) {
  await client.query(
    `UPDATE timesheet_periods
        SET period_end = $2::date, status = 'open', submitted_at = NULL,
            approved_revision_id = NULL, updated_at = now()
      WHERE hiring_contract_id = $1
        AND period_start <= $2::date AND period_end >= $2::date
        AND NOT EXISTS (
          SELECT 1 FROM talent_invoices ti
           WHERE ti.hiring_contract_id = $1 AND ti.period_start = timesheet_periods.period_start
             AND ti.status = 'sent'
        )`,
    [contractId, effectiveEndDate],
  );
}

async function submitTerminationRequest(
  contractId: string,
  requesterId: string,
  requesterRole: "client" | "talent",
  effectiveEndDate: string,
  reason: string,
) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const contract = await client.query(
      `SELECT hc.id, hc.status, hc.billing_mode, hc.effective_start_date,
              hc.effective_end_date, hc.billing_activated_at
         FROM hiring_contracts hc
         JOIN job_submissions js ON js.id = hc.submission_id
        WHERE hc.id = $1
          AND ${requesterRole === "client" ? "js.client_id" : "js.talent_id"} = $2
        FOR UPDATE OF hc`,
      [contractId, requesterId],
    );
    const row = contract.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { status: 404, body: { error: "Signed contract not found" } };
    }
    if (row.status !== "signed" || !BILLING_MODES.includes(row.billing_mode)) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: "Only signed Tracked or Guaranteed contracts can be ended" } };
    }
    if (row.effective_end_date) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: "This contract already has an approved end date" } };
    }
    const firstActiveDate = row.effective_start_date
      ? dateString(row.effective_start_date)
      : row.billing_activated_at ? dateInZone(new Date(row.billing_activated_at)) : null;
    if (effectiveEndDate < dateInZone(new Date())) {
      await client.query("ROLLBACK");
      return { status: 422, body: { error: "Contract end dates cannot be backdated" } };
    }
    if (firstActiveDate && effectiveEndDate < firstActiveDate) {
      await client.query("ROLLBACK");
      return { status: 422, body: { error: "Contract end date cannot precede its effective start" } };
    }
    const inserted = await client.query(
      `INSERT INTO hiring_contract_termination_requests
         (hiring_contract_id, requester_id, requester_role, requested_effective_end_date, reason)
       VALUES ($1,$2,$3,$4::date,$5)
       RETURNING *`,
      [contractId, requesterId, requesterRole, effectiveEndDate, reason.trim()],
    );
    await client.query("COMMIT");
    return { status: 201, body: { request: inserted.rows[0] } };
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      return { status: 409, body: { error: "An open or approved termination already exists for this contract" } };
    }
    throw error;
  } finally {
    client.release();
  }
}

export function registerContractTerminationRoutes(app: Express, options: Options) {
  const { authenticateJWT, requireTalent, requireClient, requireAdmin, requireAdminSubRole } = options;
  const clientAuth = [authenticateJWT, requireClient];
  const talentAuth = [authenticateJWT, requireTalent];
  const adminAuth = [authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"])];

  const registerRequesterRoutes = (role: "client" | "talent") => {
    const auth = role === "client" ? clientAuth : talentAuth;
    const basePath = `/api/${role}/hiring-contract-termination-requests`;
    app.get(basePath, ...auth, async (req: any, res) => {
      try {
        const ownerId = role === "client" ? req.user?.id : await options.getTalentBillingUserId(req);
        if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
        const result = await query(
          `SELECT r.id, r.hiring_contract_id, r.requester_role, r.requested_effective_end_date,
                  r.reason, r.status, r.decision_reason, r.decided_at,
                  r.approved_effective_end_date, r.created_at,
                  hc.billing_mode, hc.effective_start_date, hc.effective_end_date,
                  j.title AS job_title
             FROM hiring_contract_termination_requests r
             JOIN hiring_contracts hc ON hc.id = r.hiring_contract_id
             JOIN job_submissions js ON js.id = hc.submission_id
             JOIN jobs j ON j.id = js.job_id
            WHERE js.${role === "client" ? "client_id" : "talent_id"} = $1
            ORDER BY r.created_at DESC`,
          [ownerId],
        );
        return res.json({ requests: result.rows });
      } catch (error) {
        console.error(`GET ${basePath} failed`, error);
        return res.status(500).json({ error: "Failed to load contract termination requests" });
      }
    });
    app.post(`/api/${role}/hiring-contracts/:id/termination-requests`, ...auth, async (req: any, res) => {
      const { effectiveEndDate, reason } = req.body ?? {};
      if (!validDateOnly(effectiveEndDate) || !validReason(reason)) {
        return res.status(422).json({ error: "effectiveEndDate and a reason up to 2000 characters are required" });
      }
      try {
        const ownerId = role === "client" ? req.user?.id : await options.getTalentBillingUserId(req);
        if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
        const result = await submitTerminationRequest(
          req.params.id, ownerId, role, effectiveEndDate, reason,
        );
        return res.status(result.status).json(result.body);
      } catch (error) {
        console.error(`POST /api/${role}/hiring-contracts/:id/termination-requests failed`, error);
        return res.status(500).json({ error: "Failed to submit contract termination request" });
      }
    });
  };
  const getActiveContracts = (role: "client" | "talent") => {
    const auth = role === "client" ? clientAuth : talentAuth;
    app.get(`/api/${role}/active-hiring-contracts`, ...auth, async (req: any, res) => {
      try {
        const ownerId = role === "client" ? req.user?.id : await options.getTalentBillingUserId(req);
        if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
        const result = await query(
          `SELECT hc.id, j.title AS job_title, hc.billing_mode,
                  hc.effective_start_date, hc.effective_end_date
             FROM hiring_contracts hc
             JOIN job_submissions js ON js.id = hc.submission_id
             JOIN jobs j ON j.id = js.job_id
            WHERE js.${role === "client" ? "client_id" : "talent_id"} = $1
              AND hc.status = 'signed'
              AND hc.billing_mode IN ('tracked', 'guaranteed')
              AND (hc.effective_end_date IS NULL
                OR hc.effective_end_date >= (now() AT TIME ZONE '${ET}')::date)
            ORDER BY j.title, hc.id`,
          [ownerId],
        );
        return res.json({ contracts: result.rows });
      } catch (error) {
        console.error(`GET /api/${role}/active-hiring-contracts failed`, error);
        return res.status(500).json({ error: "Failed to load active hiring contracts" });
      }
    });
  };
  registerRequesterRoutes("client");
  registerRequesterRoutes("talent");
  getActiveContracts("client");
  getActiveContracts("talent");

  app.get("/api/admin/active-hiring-contracts", ...adminAuth, async (_req: any, res) => {
    try {
      const result = await query(
        `SELECT hc.id, j.title AS job_title, hc.billing_mode,
                hc.effective_start_date, hc.effective_end_date,
                COALESCE(
                  NULLIF(BTRIM(cp.company_name), ''),
                  NULLIF(BTRIM(client.company), ''),
                  NULLIF(BTRIM(CONCAT_WS(' ', client.first_name, client.last_name)), '')
                ) AS client_name,
                client.email AS client_email,
                COALESCE(
                  NULLIF(BTRIM(CONCAT_WS(' ', talent.first_name, talent.last_name)), ''),
                  NULLIF(BTRIM(talent.username), '')
                ) AS talent_name,
                talent.email AS talent_email
           FROM hiring_contracts hc
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
           JOIN users client ON client.id = js.client_id
           JOIN users talent ON talent.id = js.talent_id
           LEFT JOIN client_profiles cp ON cp.user_id = js.client_id
          WHERE hc.status = 'signed'
            AND hc.billing_mode IN ('tracked', 'guaranteed')
            AND (hc.effective_end_date IS NULL
              OR hc.effective_end_date >= (now() AT TIME ZONE '${ET}')::date)
          ORDER BY j.title, hc.id`,
      );
      return res.json({ contracts: result.rows });
    } catch (error) {
      console.error("GET /api/admin/active-hiring-contracts failed", error);
      return res.status(500).json({ error: "Failed to load active hiring contracts" });
    }
  });

  app.get("/api/admin/hiring-contract-termination-requests", ...adminAuth, async (req: any, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "open";
    if (!["open", "approved", "rejected", "all"].includes(status)) {
      return res.status(422).json({ error: "status must be open, approved, rejected, or all" });
    }
    try {
      const result = await query(
        `SELECT r.*, hc.billing_mode, hc.effective_start_date, hc.effective_end_date,
                js.client_id, js.talent_id, j.title AS job_title,
                requester.email AS requester_email, client_user.email AS client_email,
                talent.email AS talent_email
           FROM hiring_contract_termination_requests r
           JOIN hiring_contracts hc ON hc.id = r.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
           JOIN users requester ON requester.id = r.requester_id
           JOIN users client_user ON client_user.id = js.client_id
           JOIN users talent ON talent.id = js.talent_id
          WHERE $1 = 'all' OR r.status = $1
          ORDER BY r.created_at`,
        [status],
      );
      return res.json({ requests: result.rows });
    } catch (error) {
      console.error("GET admin contract termination requests failed", error);
      return res.status(500).json({ error: "Failed to load contract termination requests" });
    }
  });

  const approveTermination = async (
    client: any,
    contract: any,
    effectiveEndDate: string,
    reason: string,
  ) => {
    if (contract.status !== "signed" || !BILLING_MODES.includes(contract.billing_mode)) {
      return { status: 409, body: { error: "Only signed Tracked or Guaranteed contracts can be ended" } };
    }
    if (contract.effective_end_date) {
      return { status: 409, body: { error: "This contract already has an approved end date" } };
    }
    const today = dateInZone(new Date());
    const startDate = contract.effective_start_date
      ? dateString(contract.effective_start_date)
      : contract.billing_activated_at ? dateInZone(new Date(contract.billing_activated_at)) : null;
    if (effectiveEndDate < today) {
      return { status: 422, body: { error: "Contract end dates cannot be backdated" } };
    }
    if (startDate && effectiveEndDate < startDate) {
      return { status: 422, body: { error: "Contract end date cannot precede its effective start" } };
    }
    const invoicesAfterEnd = await client.query(
      `SELECT id, period_start, period_end FROM talent_invoices
        WHERE hiring_contract_id = $1
          AND status = 'sent'
          AND period_end > $2::date
        LIMIT 1`,
      [contract.id, effectiveEndDate],
    );
    if (invoicesAfterEnd.rows.length) {
      return { status: 409, body: { error: "A future Talent invoice exists beyond this end date; resolve it before approving termination" } };
    }
    return null;
  };

  app.post("/api/admin/hiring-contract-termination-requests/:id/decision", ...adminAuth, async (req: any, res) => {
    const { decision, reason } = req.body ?? {};
    if (!["approve", "reject"].includes(decision) || !validReason(reason)) {
      return res.status(422).json({ error: "decision (approve or reject) and reason are required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        `SELECT r.*, hc.status AS contract_status, hc.billing_mode,
                hc.effective_start_date, hc.effective_end_date, hc.billing_activated_at
           FROM hiring_contract_termination_requests r
           JOIN hiring_contracts hc ON hc.id = r.hiring_contract_id
          WHERE r.id = $1 FOR UPDATE OF r, hc`,
        [req.params.id],
      );
      const request = found.rows[0];
      if (!request || request.status !== "open") {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Open contract termination request not found" });
      }
      if (decision === "approve") {
        const invalid = await approveTermination(
          client,
          { ...request, id: request.hiring_contract_id, status: request.contract_status },
          dateString(request.requested_effective_end_date),
          reason.trim(),
        );
        if (invalid) {
          await client.query("ROLLBACK");
          return res.status(invalid.status).json(invalid.body);
        }
        const endDate = dateString(request.requested_effective_end_date);
        await client.query(
          `UPDATE hiring_contracts
              SET effective_end_date = $2::date, termination_reason = $3,
                  terminated_by = $4, terminated_at = now(), updated_at = now()
            WHERE id = $1`,
          [request.hiring_contract_id, endDate, reason.trim(), req.user.id],
        );
        await rebuildDraftInvoicesForTermination(client, request.hiring_contract_id, endDate);
        await client.query(
          `UPDATE hiring_contract_termination_requests
              SET status = 'approved', decision_reason = $2, decided_by = $3,
                  decided_at = now(), approved_effective_end_date = $4::date
            WHERE id = $1 AND status = 'open'`,
          [request.id, reason.trim(), req.user.id, endDate],
        );
        if (request.billing_mode === "tracked") {
          await reopenFinalTimesheetPeriod(client, request.hiring_contract_id, endDate);
        }
      } else {
        await client.query(
          `UPDATE hiring_contract_termination_requests
              SET status = 'rejected', decision_reason = $2, decided_by = $3, decided_at = now()
            WHERE id = $1 AND status = 'open'`,
          [request.id, reason.trim(), req.user.id],
        );
      }
      await client.query("COMMIT");
      return res.json({ requestId: request.id, status: decision === "approve" ? "approved" : "rejected" });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => {});
      const usdOnlyFailure = usdOnlyTerminationFailure(error);
      if (usdOnlyFailure) return res.status(usdOnlyFailure.status).json(usdOnlyFailure.body);
      if (error.code === "terminationDraftUnrebuildable"
        || error.code === "terminationDraftCreditConflict"
        || error.code === "terminationDraftInvalidContract") {
        return res.status(409).json({ error: error.message });
      }
      if (error.code === "23505") return res.status(409).json({ error: "This contract already has an approved termination" });
      console.error("POST admin contract termination decision failed", error);
      return res.status(500).json({ error: "Failed to decide contract termination request" });
    } finally {
      client.release();
    }
  });

  app.post("/api/admin/hiring-contracts/:id/terminate", ...adminAuth, async (req: any, res) => {
    const { effectiveEndDate, reason } = req.body ?? {};
    if (!validDateOnly(effectiveEndDate) || !validReason(reason)) {
      return res.status(422).json({ error: "effectiveEndDate and a reason up to 2000 characters are required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        `SELECT id, status, billing_mode, effective_start_date, effective_end_date, billing_activated_at
           FROM hiring_contracts WHERE id = $1 FOR UPDATE`,
        [req.params.id],
      );
      const contract = found.rows[0];
      if (!contract) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Signed contract not found" });
      }
      const openRequest = await client.query(
        `SELECT id FROM hiring_contract_termination_requests
          WHERE hiring_contract_id = $1 AND status = 'open' LIMIT 1`,
        [contract.id],
      );
      if (openRequest.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Adjudicate or reject the open termination request before using direct termination" });
      }
      const invalid = await approveTermination(
        client, contract, effectiveEndDate, reason.trim(),
      );
      if (invalid) {
        await client.query("ROLLBACK");
        return res.status(invalid.status).json(invalid.body);
      }
      const request = await client.query(
        `INSERT INTO hiring_contract_termination_requests
           (hiring_contract_id, requester_id, requester_role, requested_effective_end_date,
            reason, status, decision_reason, decided_by, decided_at, approved_effective_end_date)
         VALUES ($1,$2,'admin',$3::date,$4,'approved',$4,$2,now(),$3::date)
         RETURNING id`,
        [contract.id, req.user.id, effectiveEndDate, reason.trim()],
      );
      await client.query(
        `UPDATE hiring_contracts
            SET effective_end_date = $2::date, termination_reason = $3,
                terminated_by = $4, terminated_at = now(), updated_at = now()
          WHERE id = $1`,
        [contract.id, effectiveEndDate, reason.trim(), req.user.id],
      );
      await rebuildDraftInvoicesForTermination(client, contract.id, effectiveEndDate);
      if (contract.billing_mode === "tracked") {
        await reopenFinalTimesheetPeriod(client, contract.id, effectiveEndDate);
      }
      await client.query("COMMIT");
      return res.status(201).json({
        termination: {
          requestId: request.rows[0].id,
          hiringContractId: contract.id,
          effectiveEndDate,
          reason: reason.trim(),
        },
      });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => {});
      const usdOnlyFailure = usdOnlyTerminationFailure(error);
      if (usdOnlyFailure) return res.status(usdOnlyFailure.status).json(usdOnlyFailure.body);
      if (error.code === "terminationDraftUnrebuildable"
        || error.code === "terminationDraftCreditConflict"
        || error.code === "terminationDraftInvalidContract") {
        return res.status(409).json({ error: error.message });
      }
      if (error.code === "23505") return res.status(409).json({ error: "This contract already has an open or approved termination" });
      console.error("POST admin contract termination failed", error);
      return res.status(500).json({ error: "Failed to terminate contract" });
    } finally {
      client.release();
    }
  });
}