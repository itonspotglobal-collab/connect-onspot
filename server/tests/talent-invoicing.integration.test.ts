import assert from "node:assert/strict";
import { after, it } from "node:test";
import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "node:http";
import { getClient, query } from "../db.ts";
import {
  claimDeadlineForPeriod,
  guaranteedPeriodAmount,
  halfMonthPeriod,
  trackedPeriodAmount,
  runTalentInvoiceAutomation,
} from "../routes/talentInvoices.ts";
import { registerTalentInvoiceRoutes } from "../routes/talentInvoices.ts";
import { registerContractTerminationRoutes } from "../routes/contractTerminations.ts";

const JWT_SECRET = process.env.JWT_SECRET || "test-only-secret";
const app = express();
app.use(express.json());

const apiCall = (baseUrl: string, method: string, path: string) => {
  let authorization = "";
  let payload: unknown;
  let pending: Promise<any> | null = null;
  const execute = () => {
    if (!pending) {
      pending = fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      }).then(async (response) => ({
        status: response.status,
        body: await response.json(),
      }));
    }
    return pending;
  };
  const call: any = {
    set(_name: string, value: string) {
      authorization = value;
      return call;
    },
    send(value: unknown) {
      payload = value;
      return execute();
    },
    then(resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) {
      return execute().then(resolve, reject);
    },
  };
  return call;
};

const authenticateJWT: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const claims = jwt.verify(token, JWT_SECRET) as Record<string, any>;
    if (typeof claims.candidateId === "string" && typeof claims.email === "string") {
      (req as any).user = { id: claims.candidateId, email: claims.email, role: "talent" };
      (req as any).talentAuth = { candidateId: claims.candidateId, email: claims.email };
      return next();
    }
    if (typeof claims.userId !== "string") return res.status(401).json({ error: "Unauthorized" });
    (req as any).user = { ...claims, id: claims.userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
const requireRole = (role: string): RequestHandler => (req, res, next) =>
  (req as any).user?.role === role ? next() : res.status(403).json({ error: "Forbidden" });
const requireAdminSubRole = (roles: string[]): RequestHandler => (req, res, next) => {
  const user = (req as any).user;
  return user?.role === "admin" && roles.includes(user?.subRole)
    ? next()
    : res.status(403).json({ error: "Forbidden" });
};
const getTalentBillingUserId = async (req: any): Promise<string | null> => {
  if (!req.talentAuth) return req.user?.id ?? null;
  const result = await query(
    `SELECT COALESCE(c.user_id, u.id) AS user_id
       FROM candidates c
       LEFT JOIN users u ON LOWER(u.email) = LOWER(c.email)
      WHERE c.id = $1 OR c.user_id = $1 OR LOWER(c.email) = LOWER($2)
      ORDER BY CASE WHEN c.user_id = $1 THEN 0 WHEN LOWER(c.email) = LOWER($2) THEN 1 ELSE 2 END
      LIMIT 1`,
    [req.talentAuth.candidateId, req.talentAuth.email],
  );
  return result.rows[0]?.user_id ?? null;
};

registerTalentInvoiceRoutes(app, {
  authenticateJWT,
  requireTalent: requireRole("talent"),
  requireClient: requireRole("client"),
  requireAdmin: requireRole("admin"),
  requireAdminSubRole,
  getTalentBillingUserId,
  startAutomation: false,
});
registerContractTerminationRoutes(app, {
  authenticateJWT,
  requireTalent: requireRole("talent"),
  requireClient: requireRole("client"),
  requireAdmin: requireRole("admin"),
  requireAdminSubRole,
  getTalentBillingUserId,
});

let httpServer: Server;
let userIds: string[] = [];
let candidateIds: string[] = [];
const auth = (id: string, role: string, subRole?: string) => jwt.sign(
  { userId: id, role, ...(subRole ? { subRole } : {}) },
  JWT_SECRET,
);
const talentPortalAuth = (candidateId: string, email: string) => jwt.sign(
  { candidateId, email },
  JWT_SECRET,
);
const dateInNY = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const toDate = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const addDateDays = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
const midnightInNY = (date: string) => {
  let low = Date.parse(`${date}T00:00:00Z`) - 48 * 60 * 60 * 1000;
  let high = Date.parse(`${date}T00:00:00Z`) + 48 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateInNY(new Date(middle)) >= date) high = middle;
    else low = middle;
  }
  return new Date(high);
};
const insertUser = async (id: string, role: string) => {
  await query(
    `INSERT INTO users (id, email, role, created_at, updated_at)
     VALUES ($1,$2,$3,now(),now())`,
    [id, `${id}@phase3b.test`, role],
  );
  userIds.push(id);
};
const insertCandidate = async (id: string, userId: string, email: string) => {
  await query(
    `INSERT INTO candidates (id, user_id, email, full_name, target_position, category)
     VALUES ($1,$2,$3,$4,'Integration fixture','Engineering')`,
    [id, userId, email, `Candidate ${id}`],
  );
  candidateIds.push(id);
};

type Fixture = {
  id: string;
  jobId: string;
  submissionId: string;
  offerId: string;
  clientId: string;
  talentId: string;
};

const createContract = async (params: {
  label: string;
  clientId: string;
  talentId: string;
  billingMode: "tracked" | "guaranteed";
  start: string;
  rate: number;
  deposit?: number;
  jobTitle?: string;
}): Promise<Fixture> => {
  const jobId = `${params.label}-job`;
  const submissionId = `${params.label}-submission`;
  const offerId = randomUUID();
  const id = randomUUID();
  await query(
    `INSERT INTO jobs
       (id, client_id, title, description, category, experience_level, status, time_zone, created_at, updated_at)
     VALUES ($1,$2,$3,'Integration fixture','Engineering','intermediate','open','America/New_York',now(),now())`,
     [jobId, params.clientId, params.jobTitle ?? `Fixture ${params.label}`],
  );
  await query(
    `INSERT INTO job_submissions
       (id, job_id, client_id, talent_id, applicant_name, email, status, workflow_type, initiated_by)
      VALUES ($1,$2,$3,$4,$5,$6,'hired','client_invitation','client')`,
    [submissionId, jobId, params.clientId, params.talentId, `Talent ${params.label}`, `${params.talentId}@phase3b.test`],
  );
  await query(
    `INSERT INTO offers
       (id, submission_id, status, rate, rate_currency, engagement_type, billing_mode, proposed_start_date)
     VALUES ($1,$2,'accepted',$3,'PHP',$4,$5,$6::date)`,
    [offerId, submissionId, params.rate, params.billingMode === "tracked" ? "Standard" : "Standard",
      params.billingMode, params.start],
  );
  await query(
    `INSERT INTO hiring_contracts
       (id, offer_id, submission_id, status, billing_mode, effective_start_date,
        billing_activated_at, onspot_signed_at, talent_signed_at, signing_entity)
      VALUES ($1,$2,$3,'signed',$4,$5::date,$6::timestamptz,($6::timestamptz AT TIME ZONE 'UTC'),($6::timestamptz AT TIME ZONE 'UTC'),'OnSpot Technologies Inc.')`,
    [id, offerId, submissionId, params.billingMode, params.start, new Date(`${params.start}T12:00:00Z`)],
  );
  await query(
    `INSERT INTO security_deposits (hiring_contract_id, amount, currency, status)
     VALUES ($1,$2,'PHP','held')`,
    [id, (params.deposit ?? 100000).toFixed(2)],
  );
  return { id, jobId, submissionId, offerId, clientId: params.clientId, talentId: params.talentId };
};

const approvedRevision = async (
  contract: Fixture,
  period: { start: string; end: string },
  hours: number,
  version: number,
  talentId: string,
) => {
  const periodResult = await query(
    `INSERT INTO timesheet_periods (hiring_contract_id, period_start, period_end, work_timezone)
     VALUES ($1,$2::date,$3::date,'America/New_York')
     ON CONFLICT (hiring_contract_id, period_start, period_end)
     DO UPDATE SET updated_at = now()
     RETURNING id`,
    [contract.id, period.start, period.end],
  );
  const timesheetPeriodId = periodResult.rows[0].id;
  const revision = await query(
    `INSERT INTO timesheet_revisions
       (timesheet_period_id, version, created_by, decision_reason)
     VALUES ($1,$2,$3,'Approved integration fixture')
     RETURNING id`,
    [timesheetPeriodId, version, talentId],
  );
  const startedAt = new Date(`${period.start}T12:00:00Z`);
  const endedAt = new Date(startedAt.getTime() + hours * 60 * 60 * 1000);
  const session = await query(
    `INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at, ended_at)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [contract.id, talentId, startedAt, endedAt],
  );
  await query(
    `INSERT INTO timesheet_revision_sessions
       (revision_id, clock_session_id, started_at, effective_end_at, source)
     VALUES ($1,$2,$3,$4,'clock')`,
    [revision.rows[0].id, session.rows[0].id, startedAt, endedAt],
  );
  await query(
    `UPDATE timesheet_periods
        SET status = 'approved', approved_revision_id = $2, updated_at = now()
      WHERE id = $1`,
    [timesheetPeriodId, revision.rows[0].id],
  );
  return String(revision.rows[0].id);
};

const cleanup = async (fixtures: Fixture[]) => {
  const contractIds = fixtures.map((item) => item.id);
  if (!contractIds.length) return;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE talent_invoices DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE talent_credit_memos DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE talent_credit_memo_applications DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE talent_credit_memo_applications_v2 DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE security_deposit_replenishments DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_monthly_invoices DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_monthly_invoice_lines DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_late_guaranteed_claims DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_credit_memos DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_credit_applications DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE timesheet_revision_sessions DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE timesheet_revisions DISABLE TRIGGER ALL");
    await client.query("ALTER TABLE hiring_contract_termination_requests DISABLE TRIGGER ALL");
    await client.query(
      `DELETE FROM hiring_contract_termination_requests WHERE hiring_contract_id = ANY($1::uuid[])`,
      [contractIds],
    );
    await client.query(
      `DELETE FROM client_monthly_invoice_lines WHERE talent_invoice_id IN
        (SELECT id FROM talent_invoices WHERE hiring_contract_id = ANY($1::uuid[]))`,
      [contractIds],
    );
    await client.query(
      `DELETE FROM client_credit_applications WHERE client_credit_memo_id IN
        (SELECT id FROM client_credit_memos WHERE hiring_contract_id = ANY($1::uuid[]))`,
      [contractIds],
    );
    await client.query(`DELETE FROM client_credit_memos WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(`DELETE FROM client_late_guaranteed_claims WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(
      `DELETE FROM client_monthly_invoices WHERE client_id = ANY($1::varchar[])
        OR id IN (SELECT l.client_monthly_invoice_id FROM client_monthly_invoice_lines l
          WHERE l.talent_invoice_id IN (SELECT id FROM talent_invoices WHERE hiring_contract_id = ANY($2::uuid[])))`,
      [Array.from(new Set(fixtures.map((item) => item.clientId))), contractIds],
    );
    await client.query(
      `DELETE FROM payouts WHERE hiring_contract_id = ANY($1::uuid[])`,
      [contractIds],
    );
    await client.query(
      `DELETE FROM talent_credit_memo_applications_v2 WHERE talent_invoice_id IN
        (SELECT id FROM talent_invoices WHERE hiring_contract_id = ANY($1::uuid[]))`,
      [contractIds],
    );
    await client.query(
      `DELETE FROM talent_credit_memo_applications WHERE talent_invoice_id IN
        (SELECT id FROM talent_invoices WHERE hiring_contract_id = ANY($1::uuid[]))`,
      [contractIds],
    );
    await client.query(`DELETE FROM talent_credit_memos WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(
      `DELETE FROM guaranteed_nonperformance_claims WHERE hiring_contract_id = ANY($1::uuid[])`,
      [contractIds],
    );
    await client.query(`DELETE FROM talent_invoices WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(`DELETE FROM security_deposit_replenishments WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(`DELETE FROM security_deposits WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(
      `DELETE FROM timesheet_revision_sessions WHERE revision_id IN
        (SELECT tr.id FROM timesheet_revisions tr JOIN timesheet_periods tp ON tp.id = tr.timesheet_period_id
          WHERE tp.hiring_contract_id = ANY($1::uuid[]))`,
      [contractIds],
    );
    await client.query(
      `DELETE FROM clock_sessions WHERE hiring_contract_id = ANY($1::uuid[])`,
      [contractIds],
    );
    await client.query(
      `UPDATE timesheet_periods SET approved_revision_id = NULL
        WHERE hiring_contract_id = ANY($1::uuid[])`,
      [contractIds],
    );
    await client.query(`DELETE FROM timesheet_revisions WHERE timesheet_period_id IN
      (SELECT id FROM timesheet_periods WHERE hiring_contract_id = ANY($1::uuid[]))`, [contractIds]);
    await client.query(`DELETE FROM timesheet_periods WHERE hiring_contract_id = ANY($1::uuid[])`, [contractIds]);
    await client.query(`DELETE FROM hiring_contracts WHERE id = ANY($1::uuid[])`, [contractIds]);
    await client.query(`DELETE FROM offers WHERE id = ANY($1::uuid[])`, [fixtures.map((item) => item.offerId)]);
    await client.query(`DELETE FROM job_submissions WHERE id = ANY($1::varchar[])`, [fixtures.map((item) => item.submissionId)]);
    await client.query(`DELETE FROM jobs WHERE id = ANY($1::varchar[])`, [fixtures.map((item) => item.jobId)]);
    await client.query("ALTER TABLE talent_credit_memo_applications_v2 ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE talent_credit_memo_applications ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE talent_credit_memos ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE talent_invoices ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE security_deposit_replenishments ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_monthly_invoices ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_monthly_invoice_lines ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_late_guaranteed_claims ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_credit_memos ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE client_credit_applications ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE timesheet_revision_sessions ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE timesheet_revisions ENABLE TRIGGER ALL");
    await client.query("ALTER TABLE hiring_contract_termination_requests ENABLE TRIGGER ALL");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

after(async () => {
  if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  if (candidateIds.length) {
    await query(`DELETE FROM candidates WHERE id = ANY($1::varchar[])`, [candidateIds]).catch(() => {});
  }
  if (userIds.length) {
    await query(`DELETE FROM notifications WHERE user_id = ANY($1::varchar[])`, [userIds]).catch(() => {});
    await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [userIds]).catch(() => {});
  }
});

it("covers authenticated claims, correction credits, monthly close, deposit coverage, and tenant isolation", async () => {
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Could not start integration HTTP listener");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const api = {
    get: (path: string) => apiCall(baseUrl, "GET", path),
    post: (path: string) => apiCall(baseUrl, "POST", path),
  };

  const salt = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const ids = {
    admin: `p3b-admin-${salt}`,
    client1: `p3b-client1-${salt}`,
    client2: `p3b-client2-${salt}`,
    client3: `p3b-client3-${salt}`,
    talent1: `p3b-talent1-${salt}`,
    talent2: `p3b-talent2-${salt}`,
    talent3: `p3b-talent3-${salt}`,
  };
  for (const [key, value] of Object.entries(ids)) {
    await insertUser(value, key.startsWith("client") ? "client" : key.startsWith("talent") ? "talent" : "admin");
  }
  const tokens = {
    admin: auth(ids.admin, "admin", "talent_acquisition"),
    client1: auth(ids.client1, "client"),
    client2: auth(ids.client2, "client"),
    client3: auth(ids.client3, "client"),
    talent1: auth(ids.talent1, "talent"),
    talent2: auth(ids.talent2, "talent"),
    talent3: auth(ids.talent3, "talent"),
  };
  const historical: Fixture[] = [];
  const promptFixtures: Fixture[] = [];
  const claimFixtures: Fixture[] = [];

  try {
    const tracked = await createContract({
      label: `p3b-tracked-${salt}`, clientId: ids.client1, talentId: ids.talent1,
      billingMode: "tracked", start: "2024-01-01", rate: 1000, deposit: 1000,
    });
    historical.push(tracked);
    const janFirst = { start: "2024-01-01", end: "2024-01-15" };
    const janSecond = { start: "2024-01-16", end: "2024-01-31" };
    const febFirst = { start: "2024-02-01", end: "2024-02-15" };
    const janFirstOriginalRevision = await approvedRevision(tracked, janFirst, 80, 1, ids.talent1);
    const janSecondRevision = await approvedRevision(tracked, janSecond, 80, 1, ids.talent1);
    await approvedRevision(tracked, febFirst, 80, 1, ids.talent1);

    const guaranteed = await createContract({
      label: `p3b-guaranteed-${salt}`, clientId: ids.client2, talentId: ids.talent2,
      billingMode: "guaranteed", start: "2024-02-01", rate: 2800, deposit: 100000,
    });
    historical.push(guaranteed);

    await runTalentInvoiceAutomation(new Date("2024-02-20T17:00:00.000Z"));
    const firstInvoice = await query(
      `SELECT * FROM talent_invoices WHERE hiring_contract_id = $1
        AND period_start = '2024-01-01'::date`,
      [tracked.id],
    );
    const nextDraft = await query(
      `SELECT * FROM talent_invoices WHERE hiring_contract_id = $1
        AND period_start = '2024-01-16'::date`,
      [tracked.id],
    );
    assert.equal(firstInvoice.rows.length, 1);
    assert.equal(Number(firstInvoice.rows[0].amount), 500);
    assert.equal(toDate(firstInvoice.rows[0].payout_due_on), "2024-02-25");
    assert.equal(nextDraft.rows.length, 1);

    const unauthenticated = await api.get(`/api/talent/invoices/${firstInvoice.rows[0].id}`);
    assert.equal(unauthenticated.status, 401);
    const foreignInvoice = await api.get(`/api/talent/invoices/${firstInvoice.rows[0].id}`)
      .set("Authorization", `Bearer ${tokens.talent2}`);
    assert.equal(foreignInvoice.status, 404);
    const ownInvoice = await api.get(`/api/talent/invoices/${firstInvoice.rows[0].id}`)
      .set("Authorization", `Bearer ${tokens.talent1}`);
    assert.equal(ownInvoice.status, 200);

    const sentOriginal = await api.post(`/api/talent/invoices/${firstInvoice.rows[0].id}/send`)
      .set("Authorization", `Bearer ${tokens.talent1}`);
    assert.equal(sentOriginal.status, 200);
    assert.equal(sentOriginal.body.payoutScheduled, true);
    const originalPayout = await query(
      `SELECT * FROM payouts WHERE talent_invoice_id = $1`,
      [firstInvoice.rows[0].id],
    );
    assert.equal(originalPayout.rows.length, 1);
    assert.equal(originalPayout.rows[0].scheduled_at, null);
    assert.equal(toDate(originalPayout.rows[0].payout_due_on), "2024-02-25");
    await query(
      `UPDATE payouts SET status = 'disbursed', disbursed_at = now() WHERE id = $1`,
      [originalPayout.rows[0].id],
    );

    await approvedRevision(tracked, janFirst, 100, 2, ids.talent1);
    // A pending dispute alone must not replace an approved revision or reset the draft clock.
    await query(
      `UPDATE timesheet_periods SET status = 'disputed' WHERE hiring_contract_id = $1
        AND period_start = '2024-01-16'::date`,
      [tracked.id],
    );
    const disputedRevision = await approvedRevision(tracked, janSecond, 90, 2, ids.talent1);
    await query(
      `UPDATE timesheet_periods SET status = 'disputed', approved_revision_id = $2
        WHERE hiring_contract_id = $1 AND period_start = '2024-01-16'::date`,
      [tracked.id, janSecondRevision],
    );
    await runTalentInvoiceAutomation(new Date("2024-02-20T18:00:00.000Z"));
    let memoApps = await query(
      `SELECT app.amount FROM talent_credit_memo_applications_v2 app
        WHERE app.talent_invoice_id = $1`,
      [nextDraft.rows[0].id],
    );
    assert.equal(memoApps.rows.length, 1);
    assert.equal(Number(memoApps.rows[0].amount), 125);
    let draftDetail = await api.get(`/api/talent/invoices/${nextDraft.rows[0].id}`)
      .set("Authorization", `Bearer ${tokens.talent1}`);
    assert.equal(draftDetail.status, 200);
    assert.equal(Number(draftDetail.body.invoice.base_amount), 500);
    assert.equal(Number(draftDetail.body.invoice.credit_amount), 125);
    assert.equal(Number(draftDetail.body.invoice.amount), 625);
    assert.equal(Number(draftDetail.body.creditAdjustments[0].applied_amount), 125);
    assert.equal(disputedRevision.length > 0, true);
    const preApprovalClock = await query(
      `SELECT auto_send_at FROM talent_invoices WHERE id = $1`,
      [nextDraft.rows[0].id],
    );
    await runTalentInvoiceAutomation(new Date("2024-02-20T18:30:00.000Z"));
    const duringDisputeClock = await query(
      `SELECT auto_send_at FROM talent_invoices WHERE id = $1`,
      [nextDraft.rows[0].id],
    );
    assert.equal(
      new Date(duringDisputeClock.rows[0].auto_send_at).getTime(),
      new Date(preApprovalClock.rows[0].auto_send_at).getTime(),
    );
    await query(
      `UPDATE timesheet_periods SET status = 'approved', approved_revision_id = $2
        WHERE hiring_contract_id = $1 AND period_start = '2024-01-16'::date`,
      [tracked.id, disputedRevision],
    );
    await runTalentInvoiceAutomation(new Date("2024-02-20T19:00:00.000Z"));
    draftDetail = await api.get(`/api/talent/invoices/${nextDraft.rows[0].id}`)
      .set("Authorization", `Bearer ${tokens.talent1}`);
    assert.equal(Number(draftDetail.body.invoice.base_amount), 562.5);
    assert.equal(Number(draftDetail.body.invoice.credit_amount), 125);
    assert.equal(Number(draftDetail.body.invoice.amount), 687.5);
    const afterApprovalClock = await query(
      `SELECT auto_send_at FROM talent_invoices WHERE id = $1`,
      [nextDraft.rows[0].id],
    );
    assert.equal(
      new Date(afterApprovalClock.rows[0].auto_send_at).getTime()
        > new Date(duringDisputeClock.rows[0].auto_send_at).getTime(),
      true,
    );
    const foreignSend = await api.post(`/api/talent/invoices/${nextDraft.rows[0].id}/send`)
      .set("Authorization", `Bearer ${tokens.talent2}`);
    assert.equal(foreignSend.status, 404);
    const sentCorrected = await api.post(`/api/talent/invoices/${nextDraft.rows[0].id}/send`)
      .set("Authorization", `Bearer ${tokens.talent1}`);
    assert.equal(sentCorrected.status, 200);
    assert.equal(sentCorrected.body.payoutScheduled, false);
    assert.equal(sentCorrected.body.payoutBlock, "insufficient_held_deposit");
    assert.equal((await query(`SELECT id FROM payouts WHERE talent_invoice_id = $1`, [nextDraft.rows[0].id])).rows.length, 0);

    const deposit = await query(`SELECT id FROM security_deposits WHERE hiring_contract_id = $1`, [tracked.id]);
    const mismatchTopUp = await api.post(`/api/admin/security-deposits/${deposit.rows[0].id}/replenishments`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ amount: 187.5, currency: "USD" });
    assert.equal(mismatchTopUp.status, 409);
    const replenishment = await api.post(`/api/admin/security-deposits/${deposit.rows[0].id}/replenishments`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ amount: 187.5, currency: "PHP", reference: "phase3b integration replenishment" });
    assert.equal(replenishment.status, 201);
    assert.equal(Number(replenishment.body.replenishment.amount), 187.5);

    await runTalentInvoiceAutomation(new Date("2024-02-23T17:00:00.000Z"));
    const secondPayout = await query(`SELECT * FROM payouts WHERE talent_invoice_id = $1`, [nextDraft.rows[0].id]);
    assert.equal(secondPayout.rows.length, 1);
    assert.equal(Number(secondPayout.rows[0].amount), 687.5);
    const januaryStatement = await query(
      `SELECT * FROM client_monthly_invoices
        WHERE client_id = $1 AND invoice_month = '2024-01-01'::date`,
      [ids.client1],
    );
    assert.equal(januaryStatement.rows.length, 1);
    assert.equal(Number(januaryStatement.rows[0].subtotal), 1275);
    const januaryLines = await query(
      `SELECT talent_amount, client_amount FROM client_monthly_invoice_lines
        WHERE client_monthly_invoice_id = $1 ORDER BY talent_amount`,
      [januaryStatement.rows[0].id],
    );
    assert.deepEqual(januaryLines.rows.map((line: any) => Number(line.talent_amount)), [500, 562.5]);
    assert.equal(januaryLines.rows.reduce((sum: number, line: any) => sum + Number(line.client_amount), 0), 1275);
    await assert.rejects(
      query(
        `INSERT INTO client_monthly_invoice_lines
           (client_monthly_invoice_id, talent_invoice_id, talent_amount, commission_rate, client_amount)
         VALUES ($1,$2,0,0.2,0)`,
        [januaryStatement.rows[0].id, firstInvoice.rows[0].id],
      ),
      /only be added before the invoice is sent/,
    );
    await assert.rejects(
      query(
        `UPDATE client_monthly_invoice_lines SET client_amount = client_amount + 1
          WHERE client_monthly_invoice_id = $1`,
        [januaryStatement.rows[0].id],
      ),
      /lines are immutable/,
    );
    await assert.rejects(
      query(`DELETE FROM client_monthly_invoice_lines WHERE client_monthly_invoice_id = $1`, [januaryStatement.rows[0].id]),
      /lines are immutable/,
    );
    const clientOwnStatement = await api.get("/api/client/monthly-invoices")
      .set("Authorization", `Bearer ${tokens.client1}`);
    assert.equal(clientOwnStatement.status, 200);
    const foreignStatement = await api.get(`/api/client/monthly-invoices/${januaryStatement.rows[0].id}`)
      .set("Authorization", `Bearer ${tokens.client2}`);
    assert.equal(foreignStatement.status, 404);
    const blockedPayouts = await api.get("/api/admin/talent-invoicing/blocked")
      .set("Authorization", `Bearer ${tokens.admin}`);
    assert.equal(blockedPayouts.status, 200);
    const adminInvoices = await api.get("/api/admin/talent-invoices")
      .set("Authorization", `Bearer ${tokens.admin}`);
    assert.equal(adminInvoices.status, 200);
    assert.equal(adminInvoices.body.invoices.some((item: any) => item.id === nextDraft.rows[0].id), true);

    // Catch up every completed month only after all expected invoices for that
    // month have been sent; February and March are immutable complete statements.
    await runTalentInvoiceAutomation(new Date("2024-04-05T17:00:00.000Z"));
    const beforeClose = await query(
      `SELECT id FROM client_monthly_invoices WHERE client_id = $1
        AND invoice_month = ANY(ARRAY['2024-02-01'::date,'2024-03-01'::date])`,
      [ids.client2],
    );
    assert.equal(beforeClose.rows.length, 0);
    await runTalentInvoiceAutomation(new Date("2024-04-08T17:00:00.000Z"));
    const caughtUp = await query(
      `SELECT invoice_month, subtotal FROM client_monthly_invoices
        WHERE client_id = $1 ORDER BY invoice_month`,
      [ids.client2],
    );
    assert.deepEqual(caughtUp.rows.map((row: any) => toDate(row.invoice_month)), ["2024-02-01", "2024-03-01"]);
    assert.deepEqual(caughtUp.rows.map((row: any) => Number(row.subtotal)), [3360, 3360]);

    // Late claims on already-sent Guaranteed invoices are authenticated,
    // tenant-scoped and independent of the Talent invoice / payout ledger.
    const lateSource = await query(
      `SELECT ti.id, ti.period_start, ti.period_end, ti.amount, ti.status,
              ti.client_id, l.client_amount, i.id AS statement_id, i.subtotal AS statement_subtotal
         FROM talent_invoices ti
         JOIN client_monthly_invoice_lines l ON l.talent_invoice_id = ti.id
         JOIN client_monthly_invoices i ON i.id = l.client_monthly_invoice_id
         WHERE ti.hiring_contract_id = $1 AND ti.period_start IN (
           '2024-02-01'::date, '2024-02-16'::date, '2024-03-01'::date, '2024-03-16'::date
         )
        ORDER BY ti.period_start`,
      [guaranteed.id],
    );
    assert.equal(lateSource.rows.length, 4);
    const beforeLateTalent = lateSource.rows.map((row: any) => ({ id: row.id, amount: row.amount, status: row.status }));
    const beforeLateStatement = await query(
      `SELECT id, subtotal, status FROM client_monthly_invoices
        WHERE id = $1`,
      [lateSource.rows[0].statement_id],
    );
    const foreignLate = await api.post("/api/client/late-guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client1}`)
      .send({ talentInvoiceId: lateSource.rows[0].id, reason: "Foreign tenant attempt" });
    assert.equal(foreignLate.status, 404);
    const duplicateLateAttempts = await Promise.all([
      api.post("/api/client/late-guaranteed-claims")
        .set("Authorization", `Bearer ${tokens.client2}`)
        .send({ talentInvoiceId: lateSource.rows[0].id, reason: "Late total nonperformance claim" }),
      api.post("/api/client/late-guaranteed-claims")
        .set("Authorization", `Bearer ${tokens.client2}`)
        .send({ talentInvoiceId: lateSource.rows[0].id, reason: "Retry late claim" }),
    ]);
    assert.deepEqual(duplicateLateAttempts.map((response: any) => response.status).sort(), [201, 409]);
    const rejectedLate = await api.post("/api/client/late-guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client2}`)
      .send({ talentInvoiceId: lateSource.rows[1].id, reason: "Claim to reject" });
    assert.equal(rejectedLate.status, 201);
    const secondApprovedLate = await api.post("/api/client/late-guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client2}`)
      .send({ talentInvoiceId: lateSource.rows[2].id, reason: "Second substantiated period" });
    assert.equal(secondApprovedLate.status, 201);
    const thirdApprovedLate = await api.post("/api/client/late-guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client2}`)
      .send({ talentInvoiceId: lateSource.rows[3].id, reason: "Third substantiated period" });
    assert.equal(thirdApprovedLate.status, 201);
    const unresolvedLate = await api.get("/api/admin/late-guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.admin}`);
    assert.equal(unresolvedLate.status, 200);
    assert.equal(unresolvedLate.body.claims.length >= 2, true);
    const lateIds = (await query(
      `SELECT id, original_talent_invoice_id FROM client_late_guaranteed_claims
        WHERE original_talent_invoice_id = ANY($1::uuid[])`,
      [lateSource.rows.map((row: any) => row.id)],
    )).rows;
    const approvedLateId = lateIds.find((row: any) => row.original_talent_invoice_id === lateSource.rows[0].id).id;
    const rejectedLateId = lateIds.find((row: any) => row.original_talent_invoice_id === lateSource.rows[1].id).id;
    const secondApprovedLateId = lateIds.find((row: any) => row.original_talent_invoice_id === lateSource.rows[2].id).id;
    const thirdApprovedLateId = lateIds.find((row: any) => row.original_talent_invoice_id === lateSource.rows[3].id).id;
    const rejectedDecision = await api.post(`/api/admin/late-guaranteed-claims/${rejectedLateId}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "reject", reason: "Evidence does not substantiate nonperformance" });
    assert.equal(rejectedDecision.status, 200);
    for (const id of [approvedLateId, secondApprovedLateId, thirdApprovedLateId]) {
      const approvedDecision = await api.post(`/api/admin/late-guaranteed-claims/${id}/decision`)
        .set("Authorization", `Bearer ${tokens.admin}`)
        .send({ decision: "approve", reason: "Substantiated total nonperformance" });
      assert.equal(approvedDecision.status, 200);
    }
    const approvalRetry = await api.post(`/api/admin/late-guaranteed-claims/${approvedLateId}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "approve", reason: "Idempotent retry" });
    assert.equal(approvalRetry.status, 404);
    const lateMemos = await query(
      `SELECT id, late_claim_id, all_in_amount,
              date_trunc('month', created_at AT TIME ZONE 'America/New_York')::date AS approval_month
         FROM client_credit_memos WHERE late_claim_id = ANY($1::uuid[])
        ORDER BY created_at`,
      [[approvedLateId, secondApprovedLateId, thirdApprovedLateId]],
    );
    assert.equal(lateMemos.rows.length, 3);
    assert.deepEqual(lateMemos.rows.map((row: any) => Number(row.all_in_amount)), lateSource.rows.filter((_: any, index: number) => index !== 1).map((row: any) => Number(row.client_amount)));
    const unchangedTalent = await query(
      `SELECT id, amount, status FROM talent_invoices WHERE id = ANY($1::uuid[]) ORDER BY period_start`,
      [lateSource.rows.map((row: any) => row.id)],
    );
    assert.deepEqual(unchangedTalent.rows.map((row: any) => ({ id: row.id, amount: row.amount, status: row.status })), beforeLateTalent);
    const unchangedStatement = await query(`SELECT id, subtotal, status FROM client_monthly_invoices WHERE id = $1`, [beforeLateStatement.rows[0].id]);
    assert.deepEqual(unchangedStatement.rows[0], beforeLateStatement.rows[0]);
    // Historical catch-up must not back-date an approved 2026 Client credit to
    // 2024 merely because it creates missing historic statements.
    await runTalentInvoiceAutomation(new Date("2024-05-11T17:00:00.000Z"));
    assert.equal((await query(
      `SELECT app.id FROM client_credit_applications app
        WHERE app.client_credit_memo_id = ANY($1::uuid[])`,
      [lateMemos.rows.map((row: any) => row.id)],
    )).rows.length, 0);
    const approvalMonth = toDate(lateMemos.rows[0].approval_month);
    const [approvalYear, approvalMonthNumber] = approvalMonth.split("-").map(Number);
    const nextTwoMonths = new Date(Date.UTC(approvalYear, approvalMonthNumber + 1, 8, 17));
    await runTalentInvoiceAutomation(nextTwoMonths);
    // Newly created Talent drafts retain their 48-hour review window; close
    // the eligible Client statements after a realistic send interval.
    await runTalentInvoiceAutomation(new Date(nextTwoMonths.getTime() + 72 * 60 * 60 * 1000));
    const futureApplications = await query(
      `SELECT app.client_credit_memo_id, app.amount, i.invoice_month, i.subtotal, i.status
         FROM client_credit_applications app
         JOIN client_monthly_invoices i ON i.id = app.client_monthly_invoice_id
        WHERE app.client_credit_memo_id = ANY($1::uuid[])
        ORDER BY i.invoice_month, app.client_credit_memo_id`,
      [lateMemos.rows.map((row: any) => row.id)],
    );
    assert.equal(futureApplications.rows.length, 4);
    assert.equal(new Set(futureApplications.rows.map((row: any) => toDate(row.invoice_month))).size, 2);
    assert.deepEqual(
      Array.from(new Set(futureApplications.rows.map((row: any) => toDate(row.invoice_month)))).sort(),
      [approvalMonth, toDate(new Date(Date.UTC(approvalYear, approvalMonthNumber, 1)))],
    );
    assert.equal(futureApplications.rows.every((row: any) => toDate(row.invoice_month) >= approvalMonth), true);
    const appliedByMemo = new Map<string, number>();
    for (const app of futureApplications.rows) {
      appliedByMemo.set(app.client_credit_memo_id, (appliedByMemo.get(app.client_credit_memo_id) ?? 0) + Number(app.amount));
    }
    for (const memo of lateMemos.rows) {
      assert.equal(appliedByMemo.get(memo.id), Number(memo.all_in_amount));
    }
    const statementBalances = await query(
      `SELECT subtotal FROM client_monthly_invoices
        WHERE client_id = $1 AND invoice_month = ANY($2::date[])`,
      [ids.client2, Array.from(new Set(futureApplications.rows.map((row: any) => toDate(row.invoice_month))))],
    );
    assert.equal(statementBalances.rows.every((row: any) => Number(row.subtotal) >= 0), true);
    await runTalentInvoiceAutomation(new Date(nextTwoMonths.getTime() + 96 * 60 * 60 * 1000));
    assert.equal((await query(
      `SELECT id FROM client_credit_applications WHERE client_credit_memo_id = ANY($1::uuid[])`,
      [lateMemos.rows.map((row: any) => row.id)],
    )).rows.length, 4);

    // Reverting the approved timesheet to its original revision creates an
    // opposite signed memo; worker retries must not duplicate that reversal.
    const febSecond = { start: "2024-02-16", end: "2024-02-29" };
    await approvedRevision(tracked, febSecond, 80, 1, ids.talent1);
    await query(
      `UPDATE timesheet_periods SET approved_revision_id = $2
        WHERE hiring_contract_id = $1 AND period_start = '2024-01-01'::date`,
      [tracked.id, janFirstOriginalRevision],
    );
    await runTalentInvoiceAutomation(new Date("2024-04-09T17:00:00.000Z"));
    const correctionMemos = await query(
      `SELECT amount FROM talent_credit_memos WHERE original_invoice_id = $1 ORDER BY created_at`,
      [firstInvoice.rows[0].id],
    );
    assert.deepEqual(correctionMemos.rows.map((row: any) => Number(row.amount)), [125, -125]);
    assert.equal(correctionMemos.rows.reduce((sum: number, row: any) => sum + Number(row.amount), 0), 0);
    const reversalDraft = await query(
      `SELECT id, amount, credit_amount FROM talent_invoices
        WHERE hiring_contract_id = $1 AND period_start = '2024-02-16'::date`,
      [tracked.id],
    );
    assert.equal(reversalDraft.rows.length, 1);
    assert.equal(Number(reversalDraft.rows[0].credit_amount), -125);
    assert.equal(Number(reversalDraft.rows[0].amount), 375);
    await runTalentInvoiceAutomation(new Date("2024-04-09T18:00:00.000Z"));
    const retriedMemoCount = await query(
      `SELECT COUNT(*)::int AS count FROM talent_credit_memos WHERE original_invoice_id = $1`,
      [firstInvoice.rows[0].id],
    );
    assert.equal(retriedMemoCount.rows[0].count, 2);

    // Tear down historical fixtures before advancing automation through current
    // periods in the binary claim decision test.
    await cleanup(historical);
    historical.length = 0;

    const promptTracked = await createContract({
      label: `p3b-prompt-tracked-${salt}`, clientId: ids.client3, talentId: ids.talent2,
      billingMode: "tracked", start: "2024-02-01", rate: 1000,
    });
    const promptGuaranteed = await createContract({
      label: `p3b-prompt-guaranteed-${salt}`, clientId: ids.client2, talentId: ids.talent3,
      billingMode: "guaranteed", start: "2024-02-01", rate: 2800,
    });
    promptFixtures.push(promptTracked, promptGuaranteed);
    await approvedRevision(promptTracked, { start: "2024-02-01", end: "2024-02-15" }, 80, 1, ids.talent2);
    const beforeClaimDeadline = new Date("2024-02-16T17:00:00.000Z");
    assert.equal(beforeClaimDeadline < claimDeadlineForPeriod("2024-02-15"), true);
    await runTalentInvoiceAutomation(beforeClaimDeadline);
    const promptTrackedInvoice = await query(
      `SELECT id FROM talent_invoices WHERE hiring_contract_id = $1`,
      [promptTracked.id],
    );
    const promptGuaranteedInvoice = await query(
      `SELECT id FROM talent_invoices WHERE hiring_contract_id = $1`,
      [promptGuaranteed.id],
    );
    assert.equal(promptTrackedInvoice.rows.length, 1);
    assert.equal(promptGuaranteedInvoice.rows.length, 0);
    await cleanup(promptFixtures);
    promptFixtures.length = 0;

    const currentDate = dateInNY(new Date());
    const claimPeriod = halfMonthPeriod(currentDate);
    const approvedContract = await createContract({
      label: `p3b-approved-claim-${salt}`, clientId: ids.client1, talentId: ids.talent1,
      billingMode: "guaranteed", start: claimPeriod.start, rate: 3100, deposit: 10000,
    });
    const rejectedContract = await createContract({
      label: `p3b-rejected-claim-${salt}`, clientId: ids.client1, talentId: ids.talent3,
      billingMode: "guaranteed", start: claimPeriod.start, rate: 3100, deposit: 10000,
    });
    claimFixtures.push(approvedContract, rejectedContract);
    const firstClaim = await api.post("/api/client/guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client1}`)
      .send({ hiringContractId: approvedContract.id, periodStart: claimPeriod.start, reason: "Substantiated total nonperformance" });
    const secondClaim = await api.post("/api/client/guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client1}`)
      .send({ hiringContractId: rejectedContract.id, periodStart: claimPeriod.start, reason: "Claim not substantiated" });
    assert.equal(firstClaim.status, 201);
    assert.equal(secondClaim.status, 201);
    const foreignClaim = await api.get("/api/client/guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client2}`);
    assert.equal(foreignClaim.status, 200);
    assert.equal(foreignClaim.body.claims.length, 0);
    const contractsForClient = await api.get("/api/client/guaranteed-contracts")
      .set("Authorization", `Bearer ${tokens.client1}`);
    assert.equal(contractsForClient.status, 200);
    const contractInfo = contractsForClient.body.contracts.find((item: any) => item.id === approvedContract.id);
    assert.equal(contractInfo.jobTitle, `Fixture p3b-approved-claim-${salt}`);
    assert.equal(contractInfo.effectiveStartDate, claimPeriod.start);
    assert.equal(contractInfo.eligiblePeriods.some((period: any) => period.status === "open"), true);
    assert.equal(JSON.stringify(contractsForClient.body).includes("talent"), false);
    const foreignContractView = await api.get("/api/client/guaranteed-contracts")
      .set("Authorization", `Bearer ${tokens.client2}`);
    assert.equal(foreignContractView.body.contracts.some((item: any) => item.id === approvedContract.id), false);
    const ownClaims = await api.get("/api/client/guaranteed-claims")
      .set("Authorization", `Bearer ${tokens.client1}`);
    assert.equal(ownClaims.body.claims.length, 2);

    const partialDecision = await api.post(`/api/admin/guaranteed-claims/${firstClaim.body.claim.id}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "approve", reason: "Fully substantiated", deductionAmount: 100 });
    assert.equal(partialDecision.status, 422);
    const approvedTimelyDecision = await api.post(`/api/admin/guaranteed-claims/${firstClaim.body.claim.id}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "approve", reason: "Fully substantiated" });
    const rejectedTimelyDecision = await api.post(`/api/admin/guaranteed-claims/${secondClaim.body.claim.id}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "reject", reason: "Insufficient evidence" });
    assert.equal(approvedTimelyDecision.body.claim.status, "approved");
    assert.equal(rejectedTimelyDecision.body.claim.status, "rejected");

    const afterDeadline = new Date(claimDeadlineForPeriod(claimPeriod.end).getTime() + 60 * 60 * 1000);
    await runTalentInvoiceAutomation(afterDeadline);
    const approvedInvoice = await query(
      `SELECT id FROM talent_invoices WHERE hiring_contract_id = $1`,
      [approvedContract.id],
    );
    const rejectedInvoice = await query(
      `SELECT amount FROM talent_invoices WHERE hiring_contract_id = $1`,
      [rejectedContract.id],
    );
    assert.equal(approvedInvoice.rows.length, 0);
    assert.equal(rejectedInvoice.rows.length, 1);
    assert.equal(Number(rejectedInvoice.rows[0].amount), guaranteedPeriodAmount(3100, claimPeriod, claimPeriod.start));
  } finally {
    await cleanup(promptFixtures);
    await cleanup(claimFixtures);
    await cleanup(historical);
  }
});

it("ends signed engagements safely, preserves locked ledgers, and stops invoices at the approved final date", async () => {
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Integration listener is unavailable");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const api = {
    get: (path: string) => apiCall(baseUrl, "GET", path),
    post: (path: string) => apiCall(baseUrl, "POST", path),
  };
  const salt = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const ids = {
    admin: `term-admin-${salt}`,
    client: `term-client-${salt}`,
    foreignClient: `term-foreign-client-${salt}`,
    talent: `term-talent-${salt}`,
    foreignTalent: `term-foreign-talent-${salt}`,
    candidate: `term-candidate-${salt}`,
  };
  for (const [key, value] of Object.entries(ids)) {
    if (key === "candidate") continue;
    await insertUser(value, key.includes("client") ? "client" : key.includes("talent") ? "talent" : "admin");
  }
  const portalTalentEmail = `${ids.foreignTalent}@phase3b.test`;
  await insertCandidate(ids.candidate, ids.foreignTalent, portalTalentEmail);
  const tokens = {
    admin: auth(ids.admin, "admin", "talent_acquisition"),
    client: auth(ids.client, "client"),
    foreignClient: auth(ids.foreignClient, "client"),
    talent: auth(ids.talent, "talent"),
    foreignTalent: auth(ids.foreignTalent, "talent"),
    talentPortal: talentPortalAuth(ids.candidate, portalTalentEmail),
  };
  const fixtures: Fixture[] = [];
  const today = dateInNY(new Date());
  const effectiveEndDate = addDateDays(today, 7);
  let trackedEndDate: string | null = null;
  for (let offset = 1; offset <= 400 && !trackedEndDate; offset += 1) {
    const candidateDate = addDateDays(today, offset);
    const nextMidnight = midnightInNY(addDateDays(candidateDate, 1));
    const thisMidnight = midnightInNY(candidateDate);
    if (nextMidnight.getTime() - thisMidnight.getTime() === 23 * 60 * 60 * 1000) {
      trackedEndDate = candidateDate;
    }
  }
  assert.ok(trackedEndDate, "A future DST spring-forward date must be available within the fixture horizon");
  try {
    const guaranteed = await createContract({
      label: `term-guaranteed-${salt}`, clientId: ids.client, talentId: ids.talent,
      billingMode: "guaranteed", start: addDateDays(today, -60), rate: 3100,
    });
    fixtures.push(guaranteed);
    const tracked = await createContract({
      label: `term-tracked-${salt}`, clientId: ids.foreignClient, talentId: ids.foreignTalent,
      billingMode: "tracked", start: today, rate: 3100,
    });
    fixtures.push(tracked);
    const raceContract = await createContract({
      label: `term-race-${salt}`, clientId: ids.foreignClient, talentId: ids.foreignTalent,
      billingMode: "guaranteed", start: today, rate: 3100,
    });
    fixtures.push(raceContract);
    const pickerStart = addDateDays(trackedEndDate, 100);
    const sameTitleOne = await createContract({
      label: `term-picker-one-${salt}`, clientId: ids.client, talentId: ids.talent,
      billingMode: "guaranteed", start: pickerStart, rate: 3100,
      jobTitle: "Shared Admin Picker Title",
    });
    fixtures.push(sameTitleOne);
    const sameTitleTwo = await createContract({
      label: `term-picker-two-${salt}`, clientId: ids.foreignClient, talentId: ids.foreignTalent,
      billingMode: "guaranteed", start: pickerStart, rate: 3100,
      jobTitle: "Shared Admin Picker Title",
    });
    fixtures.push(sameTitleTwo);
    const fullGuaranteedPeriod = halfMonthPeriod(effectiveEndDate);
    const fullGuaranteedAmount = guaranteedPeriodAmount(
      3100, fullGuaranteedPeriod, addDateDays(today, -60),
    );
    const shortenedDraft = await query(
      `INSERT INTO talent_invoices
         (hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
          period_start, period_end, currency, monthly_rate, amount, base_amount,
          credit_amount, commission_rate, status, drafted_at, auto_send_at, payout_due_on)
       VALUES ($1,$2,$3,$4,'guaranteed',$5::date,$6::date,'PHP',3100,$7,$7,0,0.2000,
               'draft',now(),now() + interval '100 years',$6::date)
       RETURNING id`,
      [guaranteed.id, guaranteed.offerId, ids.talent, ids.client, fullGuaranteedPeriod.start,
        fullGuaranteedPeriod.end, fullGuaranteedAmount.toFixed(2)],
    );

    const clientActive = await api.get("/api/client/active-hiring-contracts")
      .set("Authorization", `Bearer ${tokens.client}`);
    const talentActive = await api.get("/api/talent/active-hiring-contracts")
      .set("Authorization", `Bearer ${tokens.talentPortal}`);
    const adminActive = await api.get("/api/admin/active-hiring-contracts")
      .set("Authorization", `Bearer ${tokens.admin}`);
    assert.equal(clientActive.status, 200);
    assert.equal(talentActive.status, 200);
    assert.equal(adminActive.status, 200);
    assert.deepEqual(
      adminActive.body.contracts.filter((contract: any) =>
        [guaranteed.id, tracked.id, raceContract.id, sameTitleOne.id, sameTitleTwo.id].includes(contract.id))
        .map((contract: any) => Object.keys(contract).sort()),
      Array(5).fill([
        "billing_mode", "client_email", "client_name", "effective_end_date",
        "effective_start_date", "id", "job_title", "talent_email", "talent_name",
      ]),
    );
    const sharedTitleRows = adminActive.body.contracts.filter(
      (contract: any) => contract.job_title === "Shared Admin Picker Title",
    );
    assert.deepEqual(sharedTitleRows.map((contract: any) => contract.client_email).sort(), [
      `${ids.client}@phase3b.test`, `${ids.foreignClient}@phase3b.test`,
    ].sort());
    assert.deepEqual(sharedTitleRows.map((contract: any) => contract.talent_email).sort(), [
      `${ids.talent}@phase3b.test`, `${ids.foreignTalent}@phase3b.test`,
    ].sort());
    assert.equal((await api.get("/api/admin/active-hiring-contracts")
      .set("Authorization", `Bearer ${auth(ids.admin, "admin")}`)).status, 403);
    assert.deepEqual(
      clientActive.body.contracts.filter((contract: any) => contract.id === guaranteed.id)
        .map((contract: any) => Object.keys(contract).sort()),
      [["billing_mode", "effective_end_date", "effective_start_date", "id", "job_title"]],
    );
    assert.deepEqual(
      talentActive.body.contracts.filter((contract: any) => contract.id === tracked.id)
        .map((contract: any) => contract.id).sort(),
      [tracked.id],
    );
    const foreignActive = await api.get("/api/talent/active-hiring-contracts")
      .set("Authorization", `Bearer ${tokens.talent}`);
    assert.equal(foreignActive.body.contracts.some((contract: any) => contract.id === tracked.id), false);
    const foreignClientActive = await api.get("/api/client/active-hiring-contracts")
      .set("Authorization", `Bearer ${tokens.client}`);
    assert.equal(foreignClientActive.body.contracts.some((contract: any) => contract.id === tracked.id), false);
    const preTerminationRun = new Date(midnightInNY(addDateDays(today, 3)).getTime() + 12 * 60 * 60 * 1000);
    const preTerminationSend = new Date(midnightInNY(addDateDays(today, 6)).getTime() + 12 * 60 * 60 * 1000);
    await runTalentInvoiceAutomation(preTerminationRun);
    await runTalentInvoiceAutomation(preTerminationSend);
    const snapshotLockedLedgers = async (baseline?: any) => {
      const sentInvoices = await query(
        `SELECT id, period_start, period_end, amount, status, sent_at
           FROM talent_invoices WHERE hiring_contract_id = $1 AND status = 'sent'
             AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
          ORDER BY period_start, id`,
        [guaranteed.id, baseline?.sentInvoiceIds ?? null],
      );
      const payouts = await query(
        `SELECT p.id, p.amount, p.currency, p.status, p.scheduled_at, p.disbursed_at
           FROM payouts p JOIN talent_invoices ti ON ti.id = p.talent_invoice_id
          WHERE ti.hiring_contract_id = $1
            AND ($2::uuid[] IS NULL OR p.id = ANY($2::uuid[]))
          ORDER BY p.id`,
        [guaranteed.id, baseline?.payoutIds ?? null],
      );
      const statements = await query(
        `SELECT cmi.id, cmi.invoice_month, cmi.subtotal, cmi.status,
                line.talent_amount, line.client_amount
           FROM client_monthly_invoices cmi
           JOIN client_monthly_invoice_lines line ON line.client_monthly_invoice_id = cmi.id
           JOIN talent_invoices ti ON ti.id = line.talent_invoice_id
          WHERE ti.hiring_contract_id = $1
            AND ($2::uuid[] IS NULL OR cmi.id = ANY($2::uuid[]))
          ORDER BY cmi.invoice_month, cmi.id`,
        [guaranteed.id, baseline?.statementIds ?? null],
      );
      const normalizedSentInvoices = sentInvoices.rows.map((row: any) => ({ ...row, period_start: toDate(row.period_start), period_end: toDate(row.period_end) }));
      const normalizedStatements = statements.rows.map((row: any) => ({ ...row, invoice_month: toDate(row.invoice_month) }));
      return {
        sentInvoiceIds: normalizedSentInvoices.map((row: any) => row.id),
        payoutIds: payouts.rows.map((row: any) => row.id),
        statementIds: Array.from(new Set(normalizedStatements.map((row: any) => row.id))),
        sentInvoices: normalizedSentInvoices,
        payouts: payouts.rows,
        statements: normalizedStatements,
      };
    };
    const protectedLedgersBefore = await snapshotLockedLedgers();
    assert.equal(protectedLedgersBefore.sentInvoices.length > 0, true);
    assert.equal(protectedLedgersBefore.payouts.length > 0, true);
    assert.equal(protectedLedgersBefore.statements.length > 0, true);
    const futurePeriod = halfMonthPeriod(addDateDays(fullGuaranteedPeriod.end, 1));
    const creditRevisionPeriod = await query(
      `INSERT INTO timesheet_periods
         (hiring_contract_id, period_start, period_end, work_timezone)
       VALUES ($1,$2::date,$3::date,'America/New_York') RETURNING id`,
      [tracked.id, futurePeriod.start, futurePeriod.end],
    );
    const creditRevision = await query(
      `INSERT INTO timesheet_revisions (timesheet_period_id, version, created_by, decision_reason)
       VALUES ($1,1,$2,'Credit application termination fixture') RETURNING id`,
      [creditRevisionPeriod.rows[0].id, ids.foreignTalent],
    );
    const sourceSentInvoice = protectedLedgersBefore.sentInvoices[0];
    const futureCreditMemo = await query(
      `INSERT INTO talent_credit_memos
         (original_invoice_id, corrected_revision_id, talent_id, hiring_contract_id, currency, amount)
       VALUES ($1,$2,$3,$4,'PHP',100) RETURNING id`,
      [sourceSentInvoice.id, creditRevision.rows[0].id, ids.talent, guaranteed.id],
    );
    const futureDraft = await query(
      `INSERT INTO talent_invoices
         (hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
          period_start, period_end, currency, monthly_rate, amount, base_amount,
          credit_amount, commission_rate, status, drafted_at, auto_send_at, payout_due_on)
       VALUES ($1,$2,$3,$4,'guaranteed',$5::date,$6::date,'PHP',3100,1000,1000,0,0.2000,
               'draft',now(),now() + interval '100 years',$6::date)
       RETURNING id`,
      [guaranteed.id, guaranteed.offerId, ids.talent, ids.client,
        futurePeriod.start, futurePeriod.end],
    );
    await query(
      `INSERT INTO talent_credit_memo_applications_v2 (credit_memo_id, talent_invoice_id, amount)
       VALUES ($1,$2,100)`,
      [futureCreditMemo.rows[0].id, futureDraft.rows[0].id],
    );

    const raceRequest = await api.post(`/api/client/hiring-contracts/${raceContract.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.foreignClient}`)
      .send({ effectiveEndDate, reason: "Concurrent approval and send race" });
    assert.equal(raceRequest.status, 201);
    const raceInvoice = await query(
      `INSERT INTO talent_invoices
         (hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
          period_start, period_end, currency, monthly_rate, amount, base_amount,
          credit_amount, commission_rate, status, drafted_at, auto_send_at, payout_due_on)
       VALUES ($1,$2,$3,$4,'guaranteed',$5::date,$6::date,'PHP',3100,1500,1500,0,0.2000,
               'draft',now(),now() + interval '100 years',$6::date)
       RETURNING id`,
      [raceContract.id, raceContract.offerId, ids.foreignTalent, ids.foreignClient,
        fullGuaranteedPeriod.start, fullGuaranteedPeriod.end],
    );
    const raceResults = await Promise.all([
      api.post(`/api/admin/hiring-contract-termination-requests/${raceRequest.body.request.id}/decision`)
        .set("Authorization", `Bearer ${tokens.admin}`)
        .send({ decision: "approve", reason: "Race approval" }),
      api.post(`/api/talent/invoices/${raceInvoice.rows[0].id}/send`)
        .set("Authorization", `Bearer ${tokens.foreignTalent}`),
    ]);
    assert.equal(raceResults[1].status, 200);
    assert.ok([200, 409].includes(raceResults[0].status));
    const raceState = await query(
      `SELECT hc.effective_end_date, ti.period_end, ti.status
         FROM hiring_contracts hc JOIN talent_invoices ti ON ti.hiring_contract_id = hc.id
        WHERE hc.id = $1 AND ti.id = $2`,
      [raceContract.id, raceInvoice.rows[0].id],
    );
    if (raceResults[0].status === 200) {
      assert.equal(toDate(raceState.rows[0].effective_end_date), effectiveEndDate);
      assert.equal(toDate(raceState.rows[0].period_end), effectiveEndDate);
    } else {
      assert.equal(raceState.rows[0].effective_end_date, null);
      assert.equal(toDate(raceState.rows[0].period_end), fullGuaranteedPeriod.end);
      assert.ok(fullGuaranteedPeriod.end > effectiveEndDate);
    }

    assert.equal((await api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
      .send({ effectiveEndDate, reason: "Client ending the engagement" })).status, 401);
    assert.equal((await api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.foreignClient}`)
      .send({ effectiveEndDate, reason: "Foreign tenant attempt" })).status, 404);
    assert.equal((await api.post(`/api/talent/hiring-contracts/${guaranteed.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.foreignTalent}`)
      .send({ effectiveEndDate, reason: "Foreign Talent attempt" })).status, 404);
    assert.equal((await api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.client}`)
      .send({ effectiveEndDate: "yesterday", reason: "Bad date" })).status, 422);
    assert.equal((await api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.client}`)
      .send({ effectiveEndDate: addDateDays(today, -1), reason: "Backdated request" })).status, 422);

    const concurrentRequests = await Promise.all([
      api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
        .set("Authorization", `Bearer ${tokens.client}`)
        .send({ effectiveEndDate, reason: "Client ending the engagement" }),
      api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
        .set("Authorization", `Bearer ${tokens.client}`)
        .send({ effectiveEndDate, reason: "Concurrent duplicate request" }),
    ]);
    assert.deepEqual(
      concurrentRequests.map((response: any) => response.status).sort(),
      [201, 409],
      JSON.stringify(concurrentRequests.map((response: any) => response.body)),
    );
    const approvedRequest = concurrentRequests.find((response: any) => response.status === 201).body.request;
    const clientHistory = await api.get("/api/client/hiring-contract-termination-requests")
      .set("Authorization", `Bearer ${tokens.client}`);
    assert.equal(clientHistory.status, 200);
    assert.equal(clientHistory.body.requests.some((request: any) => request.id === approvedRequest.id), true);
    assert.equal((await api.get("/api/admin/hiring-contract-termination-requests")
      .set("Authorization", `Bearer ${tokens.client}`)).status, 403);
    const queue = await api.get("/api/admin/hiring-contract-termination-requests")
      .set("Authorization", `Bearer ${tokens.admin}`);
    assert.equal(queue.body.requests.some((request: any) => request.id === approvedRequest.id), true);

    const concurrentDecisions = await Promise.all([
      api.post(`/api/admin/hiring-contract-termination-requests/${approvedRequest.id}/decision`)
        .set("Authorization", `Bearer ${tokens.admin}`)
        .send({ decision: "approve", reason: "Reviewed and approved" }),
      api.post(`/api/admin/hiring-contract-termination-requests/${approvedRequest.id}/decision`)
        .set("Authorization", `Bearer ${tokens.admin}`)
        .send({ decision: "approve", reason: "Concurrent duplicate approval" }),
    ]);
    assert.deepEqual(
      concurrentDecisions.map((response: any) => response.status).sort(),
      [200, 404],
      JSON.stringify(concurrentDecisions.map((response: any) => response.body)),
    );
    const rejectedRetry = await api.post(`/api/admin/hiring-contract-termination-requests/${approvedRequest.id}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "reject", reason: "Cannot adjudicate twice" });
    assert.equal(rejectedRetry.status, 404);
    const savedGuaranteed = await query(
      `SELECT status, billing_mode, effective_end_date, termination_reason, terminated_by
         FROM hiring_contracts WHERE id = $1`,
      [guaranteed.id],
    );
    assert.deepEqual(
      { ...savedGuaranteed.rows[0], effective_end_date: toDate(savedGuaranteed.rows[0].effective_end_date) },
      { status: "signed", billing_mode: "guaranteed", effective_end_date: effectiveEndDate,
        termination_reason: "Reviewed and approved", terminated_by: ids.admin },
    );
    const shortenedGuaranteedDraft = await query(
      `SELECT period_end, amount, status FROM talent_invoices WHERE id = $1`,
      [shortenedDraft.rows[0].id],
    );
    assert.equal(toDate(shortenedGuaranteedDraft.rows[0].period_end), effectiveEndDate);
    assert.equal(Number(shortenedGuaranteedDraft.rows[0].amount), guaranteedPeriodAmount(
      3100, { start: fullGuaranteedPeriod.start, end: effectiveEndDate }, addDateDays(today, -60),
    ));
    assert.equal(shortenedGuaranteedDraft.rows[0].status, "draft");
    assert.ok(futurePeriod.start > effectiveEndDate);
    const cancelledFutureDraft = await query(
      `SELECT period_start, period_end, status FROM talent_invoices WHERE id = $1`,
      [futureDraft.rows[0].id],
    );
    assert.equal(cancelledFutureDraft.rows[0].status, "void");
    assert.equal((await api.post(`/api/talent/invoices/${futureDraft.rows[0].id}/send`)
      .set("Authorization", `Bearer ${tokens.talent}`)).status, 409);
    const futureCreditLedger = await query(
      `SELECT
          (SELECT COUNT(*)::int FROM talent_credit_memo_applications_v2 WHERE credit_memo_id = $1) AS application_rows,
          (SELECT COALESCE(SUM(amount),0) FROM talent_credit_memo_applications_v2 WHERE credit_memo_id = $1) AS net_applied,
          (SELECT amount FROM talent_credit_memos WHERE id = $1) AS memo_amount`,
      [futureCreditMemo.rows[0].id],
    );
    assert.equal(futureCreditLedger.rows[0].application_rows, 2);
    assert.equal(Number(futureCreditLedger.rows[0].net_applied), 0);
    assert.equal(Number(futureCreditLedger.rows[0].memo_amount), 100);
    assert.equal((await api.post(`/api/client/hiring-contracts/${guaranteed.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.client}`)
      .send({ effectiveEndDate, reason: "Already ended" })).status, 409);
    await assert.rejects(
      query(`UPDATE hiring_contracts SET effective_end_date = $2::date WHERE id = $1`, [guaranteed.id, addDateDays(effectiveEndDate, 1)]),
      /termination is immutable/i,
    );

    const rejectRequest = await api.post(`/api/talent/hiring-contracts/${tracked.id}/termination-requests`)
      .set("Authorization", `Bearer ${tokens.talentPortal}`)
      .send({ effectiveEndDate: trackedEndDate, reason: "Talent asks to end the engagement" });
    assert.equal(rejectRequest.status, 201);
    const clientOpenRequests = await api.get("/api/client/hiring-contract-termination-requests")
      .set("Authorization", `Bearer ${tokens.foreignClient}`);
    assert.equal(clientOpenRequests.body.requests.some((request: any) => request.id === rejectRequest.body.request.id), true);
    assert.equal(JSON.stringify(clientOpenRequests.body).includes(`${ids.foreignTalent}@phase3b.test`), false);
    const talentHistory = await api.get("/api/talent/hiring-contract-termination-requests")
      .set("Authorization", `Bearer ${tokens.talentPortal}`);
    assert.equal(talentHistory.body.requests.some((request: any) => request.id === rejectRequest.body.request.id), true);
    assert.equal(JSON.stringify(talentHistory.body).includes("counterparty_email"), false);
    assert.equal(JSON.stringify(talentHistory.body).includes(`${ids.foreignClient}@phase3b.test`), false);
    const rejected = await api.post(`/api/admin/hiring-contract-termination-requests/${rejectRequest.body.request.id}/decision`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ decision: "reject", reason: "Requested dates require clarification" });
    assert.equal(rejected.status, 200);
    const rejectedHistory = await api.get("/api/talent/hiring-contract-termination-requests")
      .set("Authorization", `Bearer ${tokens.talentPortal}`);
    assert.equal(rejectedHistory.body.requests.find((request: any) => request.id === rejectRequest.body.request.id).status, "rejected");
    await assert.rejects(
      query(`UPDATE hiring_contract_termination_requests SET reason = 'rewritten' WHERE id = $1`, [rejectRequest.body.request.id]),
      /one immutable adjudication/i,
    );

    const naturalPeriod = halfMonthPeriod(trackedEndDate);
    const period = await query(
      `INSERT INTO timesheet_periods (hiring_contract_id, period_start, period_end, work_timezone)
       VALUES ($1,$2::date,$3::date,'America/New_York') RETURNING id`,
      [tracked.id, naturalPeriod.start, naturalPeriod.end],
    );
    const revision = await query(
      `INSERT INTO timesheet_revisions (timesheet_period_id, version, created_by, decision_reason)
       VALUES ($1,1,$2,'Pre-termination final-window approval') RETURNING id`,
      [period.rows[0].id, ids.foreignTalent],
    );
    const finalCutoff = midnightInNY(addDateDays(trackedEndDate, 1));
    const sessionStart = midnightInNY(trackedEndDate);
    const sessionAfterEnd = new Date(finalCutoff.getTime() + 3 * 60 * 60 * 1000);
    const session = await query(
      `INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at, ended_at)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [tracked.id, ids.foreignTalent, sessionStart, sessionAfterEnd],
    );
    await query(
      `INSERT INTO timesheet_revision_sessions
         (revision_id, clock_session_id, started_at, effective_end_at, source)
       VALUES ($1,$2,$3,$4,'clock')`,
      [revision.rows[0].id, session.rows[0].id, sessionStart, sessionAfterEnd],
    );
    await query(
      `UPDATE timesheet_periods SET status = 'approved', approved_revision_id = $2 WHERE id = $1`,
      [period.rows[0].id, revision.rows[0].id],
    );
    const originalTrackedAmount = trackedPeriodAmount(3100, "Standard", 26).amount;
    const trackedDraft = await query(
      `INSERT INTO talent_invoices
         (hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
          period_start, period_end, currency, monthly_rate, amount, base_amount,
          credit_amount, hours, standard_hours, hourly_equivalent, commission_rate,
          timesheet_revision_id, status, drafted_at, auto_send_at, payout_due_on)
       VALUES ($1,$2,$3,$4,'tracked',$5::date,$6::date,'PHP',3100,$7,$7,0,26,80,19.375,0.2000,
               $8,'draft',now(),now() + interval '100 years',$6::date)
       RETURNING id`,
      [tracked.id, tracked.offerId, ids.foreignTalent, ids.foreignClient,
        naturalPeriod.start, naturalPeriod.end, originalTrackedAmount.toFixed(2), revision.rows[0].id],
    );
    const directTermination = await api.post(`/api/admin/hiring-contracts/${tracked.id}/terminate`)
      .set("Authorization", `Bearer ${tokens.admin}`)
      .send({ effectiveEndDate: trackedEndDate, reason: "OnSpot approved final termination" });
    assert.equal(directTermination.status, 201);
    const shortenedTrackedDraft = await query(
      `SELECT period_start, period_end, hours, amount, base_amount, status
         FROM talent_invoices WHERE id = $1`,
      [trackedDraft.rows[0].id],
    );
    assert.equal(toDate(shortenedTrackedDraft.rows[0].period_end), trackedEndDate);
    assert.equal(Number(shortenedTrackedDraft.rows[0].hours), 23);
    assert.equal(Number(shortenedTrackedDraft.rows[0].amount), 445.63);
    assert.equal(shortenedTrackedDraft.rows[0].status, "draft");
    const reopened = await query(
      `SELECT period_end, status, approved_revision_id FROM timesheet_periods WHERE id = $1`,
      [period.rows[0].id],
    );
    assert.equal(toDate(reopened.rows[0].period_end), trackedEndDate);
    assert.equal(reopened.rows[0].status, "open");
    assert.equal(reopened.rows[0].approved_revision_id, null);
    const endedContract = await query(`SELECT status, billing_mode, effective_end_date FROM hiring_contracts WHERE id = $1`, [tracked.id]);
    assert.equal(endedContract.rows[0].status, "signed");
    assert.equal(endedContract.rows[0].billing_mode, "tracked");
    assert.equal(toDate(endedContract.rows[0].effective_end_date), trackedEndDate);

    const finalRevision = await query(
      `INSERT INTO timesheet_revisions (timesheet_period_id, version, created_by, decision_reason)
       VALUES ($1,2,$2,'Final clipped approval fixture') RETURNING id`,
      [period.rows[0].id, ids.admin],
    );
    await query(
      `INSERT INTO timesheet_revision_sessions
         (revision_id, clock_session_id, started_at, effective_end_at, source)
       VALUES ($1,$2,$3,$4,'clock')`,
      [finalRevision.rows[0].id, session.rows[0].id, sessionStart, sessionAfterEnd],
    );
    await query(
      `UPDATE timesheet_periods SET status = 'approved', approved_revision_id = $2 WHERE id = $1`,
      [period.rows[0].id, finalRevision.rows[0].id],
    );
    const afterEnd = new Date(midnightInNY(addDateDays(trackedEndDate, 4)).getTime() + 12 * 60 * 60 * 1000);
    await runTalentInvoiceAutomation(afterEnd);
    assert.deepEqual(await snapshotLockedLedgers(protectedLedgersBefore), protectedLedgersBefore);

    const guaranteedFinal = await query(
      `SELECT id, period_start, period_end, amount, base_amount, credit_amount, status
         FROM talent_invoices
        WHERE hiring_contract_id = $1 AND period_start = $2::date`,
      [guaranteed.id, halfMonthPeriod(effectiveEndDate).start],
    );
    assert.equal(guaranteedFinal.rows.length, 1);
    assert.equal(toDate(guaranteedFinal.rows[0].period_end), effectiveEndDate);
    assert.equal(Number(guaranteedFinal.rows[0].base_amount), guaranteedPeriodAmount(
      3100, { start: halfMonthPeriod(effectiveEndDate).start, end: effectiveEndDate }, today,
    ));
    assert.equal(Number(guaranteedFinal.rows[0].amount),
      Number(guaranteedFinal.rows[0].base_amount) + Number(guaranteedFinal.rows[0].credit_amount));
    assert.equal(guaranteedFinal.rows[0].status, "draft");
    const manualGuaranteedSend = await api.post(`/api/talent/invoices/${guaranteedFinal.rows[0].id}/send`)
      .set("Authorization", `Bearer ${tokens.talent}`);
    assert.equal(manualGuaranteedSend.status, 200);
    const trackedFinal = await query(
      `SELECT period_start, period_end, hours, amount, status FROM talent_invoices
        WHERE hiring_contract_id = $1 AND period_start = $2::date`,
      [tracked.id, naturalPeriod.start],
    );
    assert.equal(trackedFinal.rows.length, 1);
    assert.equal(toDate(trackedFinal.rows[0].period_end), trackedEndDate);
    assert.equal(Number(trackedFinal.rows[0].hours), 23);
    assert.equal(Number(trackedFinal.rows[0].amount), 445.63);
    const trackedInvoice = await query(
      `SELECT id FROM talent_invoices WHERE hiring_contract_id = $1 AND period_start = $2::date`,
      [tracked.id, naturalPeriod.start],
    );
    const manualTrackedSend = await api.post(`/api/talent/invoices/${trackedInvoice.rows[0].id}/send`)
      .set("Authorization", `Bearer ${tokens.talentPortal}`);
    assert.equal(manualTrackedSend.status, 200);
    const postEndCorrection = await query(
      `INSERT INTO timesheet_revisions (timesheet_period_id, version, created_by, decision_reason)
       VALUES ($1,3,$2,'Correction includes additional post-end DST time') RETURNING id`,
      [period.rows[0].id, ids.admin],
    );
    await query(
      `INSERT INTO timesheet_revision_sessions
         (revision_id, clock_session_id, started_at, effective_end_at, source)
       VALUES ($1,$2,$3,$4,'admin_correction')`,
      [postEndCorrection.rows[0].id, session.rows[0].id, sessionStart,
        new Date(finalCutoff.getTime() + 10 * 60 * 60 * 1000)],
    );
    await query(
      `UPDATE timesheet_periods SET status = 'approved', approved_revision_id = $2 WHERE id = $1`,
      [period.rows[0].id, postEndCorrection.rows[0].id],
    );
    const finalClose = new Date(midnightInNY(addDateDays(trackedEndDate, 40)).getTime() + 12 * 60 * 60 * 1000);
    await runTalentInvoiceAutomation(finalClose);
    const noPostEndMemo = await query(
      `SELECT id FROM talent_credit_memos WHERE original_invoice_id = $1`,
      [trackedInvoice.rows[0].id],
    );
    assert.equal(noPostEndMemo.rows.length, 0);
    const finalClientStatement = await query(
      `SELECT cmi.id, cmi.invoice_month, cmi.status, cmi.subtotal,
              line.talent_amount, line.client_amount
         FROM client_monthly_invoices cmi
         JOIN client_monthly_invoice_lines line ON line.client_monthly_invoice_id = cmi.id
        WHERE line.talent_invoice_id = $1`,
      [guaranteedFinal.rows[0].id],
    );
    assert.equal(finalClientStatement.rows.length, 1);
    assert.equal(finalClientStatement.rows[0].status, "sent");
    assert.ok(Number(finalClientStatement.rows[0].client_amount) > Number(guaranteedFinal.rows[0].amount));
    assert.deepEqual(await snapshotLockedLedgers(protectedLedgersBefore), protectedLedgersBefore);
    const afterEndInvoices = await query(
      `SELECT id FROM talent_invoices
        WHERE (hiring_contract_id = $1 AND period_end > $2::date AND status <> 'void')
           OR (hiring_contract_id = $3 AND period_end > $4::date AND status <> 'void')`,
      [guaranteed.id, effectiveEndDate, tracked.id, trackedEndDate],
    );
    assert.equal(afterEndInvoices.rows.length, 0);
    const fixedRequests = await query(
      `SELECT status FROM hiring_contract_termination_requests WHERE hiring_contract_id = ANY($1::uuid[])`,
      [[guaranteed.id, tracked.id]],
    );
    assert.deepEqual(fixedRequests.rows.map((row: any) => row.status).sort(), ["approved", "approved", "rejected"]);
  } finally {
    await cleanup(fixtures);
  }
});