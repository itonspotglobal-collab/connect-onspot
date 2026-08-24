/**
 * Production billing-view route coverage.
 *
 * Verifies that a standard talent user does not need a candidates row, while
 * a candidate-portal JWT is mapped through candidates.user_id. Each identity
 * must only receive its own payout records.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const CLIENT_ID = "billing-view-client";
const DIRECT_TALENT_ID = "billing-view-direct-talent";
const LINKED_TALENT_ID = "billing-view-linked-talent";
const DIRECT_JOB_ID = "billing-view-direct-job";
const LINKED_JOB_ID = "billing-view-linked-job";
const CANDIDATE_ID = "billing-view-candidate";

const standardToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, role: "talent" }, JWT_SECRET, { expiresIn: "1h" });
const candidateToken = jwt.sign(
  { type: "candidate", candidateId: CANDIDATE_ID, email: `${LINKED_TALENT_ID}@test.local` },
  JWT_SECRET,
  { expiresIn: "1h" },
);

function request(
  server: http.Server,
  path: string,
  token: string,
): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = JSON.parse(body);
          } catch {
            // Preserve a useful assertion body for unexpected responses.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function createPayoutFixture(
  talentId: string,
  jobId: string,
  amount: string,
): Promise<{ submissionId: string; offerId: string; contractId: string }> {
  const job = await query(
    `INSERT INTO jobs (id, client_id, title, description, category, experience_level, status, engagement_type)
     VALUES ($1, $2, $3, 'billing view test', 'Engineering', 'senior', 'open', 'Standard')
     RETURNING id`,
    [jobId, CLIENT_ID, `Billing view ${talentId}`],
  );
  const submission = await query(
    `INSERT INTO job_submissions
       (job_id, talent_id, client_id, applicant_name, email, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, 'Billing View Talent', $4, 'hired', 'client', 'client_invitation')
     RETURNING id`,
    [job.rows[0].id, talentId, CLIENT_ID, `${talentId}@test.local`],
  );
  const offer = await query(
    `INSERT INTO offers (submission_id, engagement_type, rate, status)
     VALUES ($1, 'Standard', 1000, 'accepted')
     RETURNING id`,
    [submission.rows[0].id],
  );
  const contract = await query(
    `INSERT INTO hiring_contracts (offer_id, submission_id, template_ref, status)
     VALUES ($1, $2, 'billing-view-test', 'signed')
     RETURNING id`,
    [offer.rows[0].id, submission.rows[0].id],
  );
  await query(
    `INSERT INTO payouts (hiring_contract_id, talent_id, amount, currency, status, scheduled_at)
     VALUES ($1, $2, $3, 'PHP', 'scheduled', NOW() + interval '7 days')`,
    [contract.rows[0].id, talentId, amount],
  );
  return {
    submissionId: submission.rows[0].id,
    offerId: offer.rows[0].id,
    contractId: contract.rows[0].id,
  };
}

describe("production billing views", () => {
  let server: http.Server;
  let directFixture: { submissionId: string; offerId: string; contractId: string };
  let linkedFixture: { submissionId: string; offerId: string; contractId: string };

  before(async () => {
    await query(`DELETE FROM payouts WHERE hiring_contract_id IN (
      SELECT id FROM hiring_contracts WHERE template_ref = 'billing-view-test'
    )`);
    await query(`DELETE FROM hiring_contracts WHERE template_ref = 'billing-view-test'`);
    await query(`DELETE FROM offers WHERE submission_id IN (
      SELECT id FROM job_submissions WHERE job_id IN ($1, $2)
    )`, [DIRECT_JOB_ID, LINKED_JOB_ID]);
    await query(`DELETE FROM job_submissions WHERE job_id IN ($1, $2)`, [DIRECT_JOB_ID, LINKED_JOB_ID]);
    await query(`DELETE FROM jobs WHERE id IN ($1, $2)`, [DIRECT_JOB_ID, LINKED_JOB_ID]);
    await query(`DELETE FROM candidates WHERE id = $1`, [CANDIDATE_ID]);
    await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [
      CLIENT_ID,
      DIRECT_TALENT_ID,
      LINKED_TALENT_ID,
    ]);

    await query(
      `INSERT INTO users (id, email, role, first_name, last_name)
       VALUES ($1, $2, 'client', 'Billing', 'Client'),
              ($3, $4, 'talent', 'Direct', 'Talent'),
              ($5, $6, 'talent', 'Linked', 'Talent')`,
      [
        CLIENT_ID,
        `${CLIENT_ID}@test.local`,
        DIRECT_TALENT_ID,
        `${DIRECT_TALENT_ID}@test.local`,
        LINKED_TALENT_ID,
        `${LINKED_TALENT_ID}@test.local`,
      ],
    );
    await query(
      `INSERT INTO candidates (id, user_id, email, full_name)
       VALUES ($1, $2, $3, 'Linked Billing Talent')`,
      [CANDIDATE_ID, LINKED_TALENT_ID, `${LINKED_TALENT_ID}@test.local`],
    );
    directFixture = await createPayoutFixture(DIRECT_TALENT_ID, DIRECT_JOB_ID, "111.00");
    linkedFixture = await createPayoutFixture(LINKED_TALENT_ID, LINKED_JOB_ID, "222.00");

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    server?.close();
    await query(`DELETE FROM payouts WHERE hiring_contract_id IN ($1, $2)`, [
      directFixture?.contractId,
      linkedFixture?.contractId,
    ]);
    await query(`DELETE FROM hiring_contracts WHERE id IN ($1, $2)`, [
      directFixture?.contractId,
      linkedFixture?.contractId,
    ]);
    await query(`DELETE FROM offers WHERE id IN ($1, $2)`, [
      directFixture?.offerId,
      linkedFixture?.offerId,
    ]);
    await query(`DELETE FROM job_submissions WHERE id IN ($1, $2)`, [
      directFixture?.submissionId,
      linkedFixture?.submissionId,
    ]);
    await query(`DELETE FROM jobs WHERE id IN ($1, $2)`, [DIRECT_JOB_ID, LINKED_JOB_ID]);
    await query(`DELETE FROM candidates WHERE id = $1`, [CANDIDATE_ID]);
    await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [
      CLIENT_ID,
      DIRECT_TALENT_ID,
      LINKED_TALENT_ID,
    ]);
  });

  it("lets a standard talent user view payouts without a candidate row", async () => {
    const response = await request(
      server,
      "/api/talent/payouts",
      standardToken(DIRECT_TALENT_ID, `${DIRECT_TALENT_ID}@test.local`),
    );
    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.deepEqual(response.json.map((payout: any) => payout.amount), ["111.00"]);
  });

  it("maps a candidate-portal token and isolates it from another talent's payouts", async () => {
    const response = await request(server, "/api/talent/payouts", candidateToken);
    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.deepEqual(response.json.map((payout: any) => payout.amount), ["222.00"]);
    assert.ok(!JSON.stringify(response.json).includes("111.00"));
    assert.ok(!("commission_rate" in (response.json[0] ?? {})));
    assert.ok(!("commission_earned" in (response.json[0] ?? {})));
  });
});