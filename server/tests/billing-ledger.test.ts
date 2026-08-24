import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";
import { computePeriodAmounts, computeDepositAmount } from "../lib/billing.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const ADMIN_ID = `ledger-admin-${suffix}`;
const CLIENT_ID = `ledger-client-${suffix}`;
const TALENT_ID = `ledger-talent-${suffix}`;
const adminToken = jwt.sign(
  { userId: ADMIN_ID, email: `${ADMIN_ID}@test.example`, role: "admin" },
  JWT_SECRET,
  { expiresIn: "1h" },
);

function request(server: http.Server, method: string, path: string, body?: unknown, token = adminToken) {
  const { port } = server.address() as { port: number };
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      host: "127.0.0.1", port, method, path,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode ?? 0, json });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

let server: http.Server;
let jobId: string;
let submissionId: string;
let offerId: string;
let contractId: string;
let periodId: string;
let createdPeriodId: string;
let invoiceId: string;
let depositId: string;

async function setup() {
  await query(
    `INSERT INTO users (id, email, role) VALUES
       ($1, $2, 'admin'), ($3, $4, 'client'), ($5, $6, 'talent')`,
    [ADMIN_ID, `${ADMIN_ID}@test.example`, CLIENT_ID, `${CLIENT_ID}@test.example`, TALENT_ID, `${TALENT_ID}@test.example`],
  );
  jobId = (await query(
    `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type)
     VALUES ($1, 'Ledger Test Job', 'test', 'Engineering', 'intermediate', 'open', 'Standard') RETURNING id`,
    [CLIENT_ID],
  )).rows[0].id;
  submissionId = (await query(
    `INSERT INTO job_submissions
       (job_id, client_id, talent_id, email, applicant_name, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, $4, 'Ledger Test Talent', 'hired', 'client', 'client_invitation') RETURNING id`,
    [jobId, CLIENT_ID, TALENT_ID, `${TALENT_ID}@test.example`],
  )).rows[0].id;
  offerId = (await query(
    `INSERT INTO offers (submission_id, engagement_type, rate, rate_currency, status)
     VALUES ($1, 'Standard', 40000, 'PHP', 'accepted') RETURNING id`,
    [submissionId],
  )).rows[0].id;
  contractId = (await query(
    `INSERT INTO hiring_contracts (offer_id, submission_id, status, talent_signed_at, onspot_signed_at)
     VALUES ($1, $2, 'signed', NOW(), NOW()) RETURNING id`,
    [offerId, submissionId],
  )).rows[0].id;
  const amounts = computePeriodAmounts(40000, "Standard");
  periodId = (await query(
    `INSERT INTO invoice_periods
       (hiring_contract_id, offer_id, period_start, period_end, talent_rate, talent_rate_currency,
        standard_period_hours, extended_hours, deduction_hours, hourly_equivalent,
        adjusted_talent_payout, commission_rate, client_invoice_amount, commission_earned, status)
     VALUES ($1, $2, '2026-08-01', '2026-08-31', 40000, 'PHP', $3, 0, 0, $4, $5, $6, $7, $8, 'draft')
     RETURNING id`,
    [contractId, offerId, amounts.standardPeriodHours, amounts.hourlyEquivalent, amounts.adjustedTalentPayout,
      amounts.commissionRate, amounts.clientInvoiceAmount, amounts.commissionEarned],
  )).rows[0].id;
  depositId = (await query(
    `INSERT INTO security_deposits (hiring_contract_id, amount, currency, status)
     VALUES ($1, $2, 'PHP', 'pending') RETURNING id`,
    [contractId, computeDepositAmount(40000)],
  )).rows[0].id;
}

async function teardown() {
  await query(`DELETE FROM security_deposits WHERE id = $1`, [depositId]).catch(() => {});
  await query(`DELETE FROM invoice_periods WHERE id = $1`, [createdPeriodId]).catch(() => {});
  await query(`DELETE FROM payouts WHERE period_id = $1`, [periodId]).catch(() => {});
  await query(`DELETE FROM invoices WHERE period_id = $1`, [periodId]).catch(() => {});
  await query(`DELETE FROM invoice_periods WHERE id = $1`, [periodId]).catch(() => {});
  await query(`DELETE FROM hiring_contracts WHERE id = $1`, [contractId]).catch(() => {});
  await query(`DELETE FROM offers WHERE id = $1`, [offerId]).catch(() => {});
  await query(`DELETE FROM job_submissions WHERE id = $1`, [submissionId]).catch(() => {});
  await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
  await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [[ADMIN_ID, CLIENT_ID, TALENT_ID]]).catch(() => {});
}

describe("admin billing ledger lifecycle", () => {
  before(async () => {
    await setup();
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });
  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await teardown();
  });

  it("protects the ledger and blocks payout before payment", async () => {
    assert.equal((await request(server, "GET", "/api/admin/ledger", undefined, "")).status, 401);
    assert.equal((await request(server, "POST", `/api/admin/billing-periods/${periodId}/payouts`, {})).status, 409);
  });

  it("lets admins start billing from a signed-contract queue", async () => {
    const contracts = await request(server, "GET", "/api/admin/billing-contracts");
    assert.equal(contracts.status, 200);
    const contract = contracts.json.find((row: any) => row.hiring_contract_id === contractId);
    assert.equal(contract.contract_status, "signed");
    assert.equal(contract.deposit_status, "pending");

    const created = await request(server, "POST", `/api/admin/contracts/${contractId}/billing-periods`, {
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      extendedHours: 2,
      deductionHours: 1,
      notes: "September billing cycle",
    });
    assert.equal(created.status, 201);
    createdPeriodId = created.json.id;
    assert.equal(created.json.status, "draft");
    assert.equal(Number(created.json.client_invoice_amount), computePeriodAmounts(40000, "Standard", 2, 1).clientInvoiceAmount);

    const ledger = await request(server, "GET", "/api/admin/ledger");
    assert.equal(ledger.status, 200);
    assert.ok(ledger.json.items.some((row: any) => row.id === createdPeriodId));

    await query(
      `UPDATE security_deposits
          SET status = 'drawn', drawn_at = NOW()
        WHERE id = $1`,
      [depositId],
    );
    try {
      const atRiskLedger = await request(server, "GET", "/api/admin/ledger");
      assert.equal(atRiskLedger.json.summary.deposits_at_risk, 1);
    } finally {
      await query(
        `UPDATE security_deposits
            SET status = 'pending', drawn_at = NULL
          WHERE id = $1`,
        [depositId],
      );
    }
  });

  it("reopens a void invoice for replacement and derives its client", async () => {
    const first = await request(server, "POST", `/api/admin/billing-periods/${periodId}/invoices`, {});
    assert.equal(first.status, 201);
    assert.equal(first.json.client_id, CLIENT_ID);
    assert.match(first.json.invoice_number, /^INV-\d{4}-\d{4}$/);
    assert.equal((await request(server, "PATCH", `/api/admin/invoices/${first.json.id}`, { action: "void" })).status, 200);
    assert.equal((await query(`SELECT status FROM invoice_periods WHERE id = $1`, [periodId])).rows[0].status, "ready");
    const replacement = await request(server, "POST", `/api/admin/billing-periods/${periodId}/invoices`, {});
    assert.equal(replacement.status, 201);
    invoiceId = replacement.json.id;
  });

  it("requires payment before payout scheduling and disbursement, then closes", async () => {
    assert.equal((await request(server, "POST", `/api/admin/billing-periods/${periodId}/payouts`, {})).status, 409);
    const premature = (await query(
      `INSERT INTO payouts (period_id, hiring_contract_id, talent_id, amount, currency, payout_region, payout_method, status, scheduled_at)
       VALUES ($1, $2, $3, 40000, 'PHP', 'PH', 'bank_transfer', 'scheduled', NOW()) RETURNING id`,
      [periodId, contractId, TALENT_ID],
    )).rows[0].id;
    assert.equal((await request(server, "PATCH", `/api/admin/payouts/${premature}`, { action: "disbursed", externalRef: "EARLY" })).status, 409);
    await query(`DELETE FROM payouts WHERE id = $1`, [premature]);
    assert.equal((await request(server, "PATCH", `/api/admin/invoices/${invoiceId}`, {
      action: "paid", paymentMethod: "wire", externalRef: "WIRE-001",
    })).status, 200);
    const payout = await request(server, "POST", `/api/admin/billing-periods/${periodId}/payouts`, {});
    assert.equal(payout.status, 201);
    assert.equal((await request(server, "PATCH", `/api/admin/payouts/${payout.json.id}`, {
      action: "disbursed", externalRef: "PAYOUT-001",
    })).status, 200);
    assert.equal((await query(`SELECT status FROM invoice_periods WHERE id = $1`, [periodId])).rows[0].status, "closed");
  });

  it("supports pending collection, the cure path, and strict forfeiture reason", async () => {
    const collected = await request(server, "POST", `/api/admin/contracts/${contractId}/security-deposit`, {});
    assert.equal(collected.status, 201);
    assert.equal(collected.json.status, "held");
    assert.equal((await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, {
      action: "apply",
      terminalReason: "normal_termination",
      appliedToInvoiceId: "00000000-0000-0000-0000-000000000000",
    })).status, 422);
    await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "draw" });
    assert.equal((await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "suspend" })).status, 409);
    await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "replenishment_pending" });
    await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "suspend" });
    assert.equal((await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "cure" })).json.status, "held");
    await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "draw" });
    await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "replenishment_pending" });
    await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, { action: "suspend" });
    assert.equal((await request(server, "PATCH", `/api/admin/security-deposits/${depositId}`, {
      action: "forfeit", terminalReason: "normal_termination",
    })).status, 422);
  });
});