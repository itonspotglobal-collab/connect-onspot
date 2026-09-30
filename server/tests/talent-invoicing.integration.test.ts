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
  runTalentInvoiceAutomation,
} from "../routes/talentInvoices.ts";
import { registerTalentInvoiceRoutes } from "../routes/talentInvoices.ts";

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

registerTalentInvoiceRoutes(app, {
  authenticateJWT,
  requireTalent: requireRole("talent"),
  requireClient: requireRole("client"),
  requireAdmin: requireRole("admin"),
  requireAdminSubRole,
  getTalentBillingUserId: async (req) => req.user?.id ?? null,
  startAutomation: false,
});

let httpServer: Server;
let userIds: string[] = [];
const auth = (id: string, role: string, subRole?: string) => jwt.sign(
  { userId: id, role, ...(subRole ? { subRole } : {}) },
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
const insertUser = async (id: string, role: string) => {
  await query(
    `INSERT INTO users (id, email, role, created_at, updated_at)
     VALUES ($1,$2,$3,now(),now())`,
    [id, `${id}@phase3b.test`, role],
  );
  userIds.push(id);
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
}): Promise<Fixture> => {
  const jobId = `${params.label}-job`;
  const submissionId = `${params.label}-submission`;
  const offerId = randomUUID();
  const id = randomUUID();
  await query(
    `INSERT INTO jobs
       (id, client_id, title, description, category, experience_level, status, time_zone, created_at, updated_at)
     VALUES ($1,$2,$3,'Integration fixture','Engineering','intermediate','open','America/New_York',now(),now())`,
    [jobId, params.clientId, `Fixture ${params.label}`],
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