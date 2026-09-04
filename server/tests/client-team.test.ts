import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const CLIENT_ID = `team-client-${suffix}`;
const OTHER_CLIENT_ID = `team-other-client-${suffix}`;
const EMPTY_CLIENT_ID = `team-empty-client-${suffix}`;
const TALENT_ID = `team-talent-${suffix}`;
const OTHER_TALENT_ID = `team-other-talent-${suffix}`;

const token = (userId: string) =>
  jwt.sign({ userId, email: `${userId}@test.local`, role: "client" }, JWT_SECRET, { expiresIn: "1h" });

function request(server: http.Server, authToken: string) {
  const { port } = server.address() as { port: number };
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method: "GET", path: "/api/client/team", headers: { Authorization: `Bearer ${authToken}` } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(body) }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

let server: http.Server;
let jobIds: string[] = [];
let submissionIds: string[] = [];

async function createSignedHire(clientId: string, talentId: string, title: string, status = "hired") {
  const job = await query(
    `INSERT INTO jobs (client_id, title, description, category, experience_level)
     VALUES ($1, $2, 'test', 'Engineering', 'senior') RETURNING id`,
    [clientId, title],
  );
  const jobId = job.rows[0].id as string;
  jobIds.push(jobId);
  const submission = await query(
    `INSERT INTO job_submissions
       (job_id, talent_id, client_id, applicant_name, email, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, 'Private Name', 'private@example.test', $4, 'client', 'client_invitation')
     RETURNING id`,
    [jobId, talentId, clientId, status],
  );
  const submissionId = submission.rows[0].id as string;
  submissionIds.push(submissionId);
  const offer = await query(
    `INSERT INTO offers (submission_id, engagement_type, rate, status)
      VALUES ($1, 'Standard', 1000, 'offer_accepted') RETURNING id`,
    [submissionId],
  );
  await query(
    `INSERT INTO hiring_contracts
       (offer_id, submission_id, status, talent_signed_at, onspot_signed_at)
     VALUES ($1, $2, 'signed', '2025-01-02T00:00:00.000Z', '2025-01-03T00:00:00.000Z')`,
    [offer.rows[0].id, submissionId],
  );
  return submissionId;
}

async function cleanup() {
  if (submissionIds.length) {
    await query(`DELETE FROM security_deposits WHERE hiring_contract_id IN (SELECT id FROM hiring_contracts WHERE submission_id = ANY($1::varchar[]))`, [submissionIds]);
    await query(`DELETE FROM hiring_contracts WHERE submission_id = ANY($1::varchar[])`, [submissionIds]);
    await query(`DELETE FROM offers WHERE submission_id = ANY($1::varchar[])`, [submissionIds]);
    await query(`DELETE FROM job_application_status_history WHERE application_id = ANY($1::varchar[])`, [submissionIds]);
    await query(`DELETE FROM job_submissions WHERE id = ANY($1::varchar[])`, [submissionIds]);
  }
  if (jobIds.length) await query(`DELETE FROM jobs WHERE id = ANY($1::varchar[])`, [jobIds]);
  await query(`DELETE FROM candidates WHERE user_id = ANY($1::varchar[])`, [[TALENT_ID, OTHER_TALENT_ID]]);
  await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [[CLIENT_ID, OTHER_CLIENT_ID, EMPTY_CLIENT_ID, TALENT_ID, OTHER_TALENT_ID]]);
}

describe("GET /api/client/team", () => {
  let includedSubmissionId: string;

  before(async () => {
    for (const [id, role] of [
      [CLIENT_ID, "client"], [OTHER_CLIENT_ID, "client"], [EMPTY_CLIENT_ID, "client"],
      [TALENT_ID, "talent"], [OTHER_TALENT_ID, "talent"],
    ]) {
      await query(`INSERT INTO users (id, email, role) VALUES ($1, $2, $3)`, [id, `${id}@test.local`, role]);
    }
    await query(
      `INSERT INTO candidates (user_id, full_name, display_name, email, phone)
       VALUES ($1, 'Ada Lovelace', 'Ada Lovelace', 'talent-private@example.test', '+10000000000')`,
      [TALENT_ID],
    );
    includedSubmissionId = await createSignedHire(CLIENT_ID, TALENT_ID, "Platform Engineer");
    await createSignedHire(CLIENT_ID, TALENT_ID, "Excluded Non-Hired", "offer_accepted");
    await createSignedHire(OTHER_CLIENT_ID, OTHER_TALENT_ID, "Other Client Role");

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanup();
  });

  it("includes only the authenticated client's fully signed hired formal submissions with safe null phase-one fields", async () => {
    const response = await request(server, token(CLIENT_ID));
    assert.equal(response.status, 200);
    assert.equal(response.json.teamMembers.length, 1);
    const member = response.json.teamMembers[0];
    assert.equal(member.id, includedSubmissionId);
    assert.equal(member.submissionId, includedSubmissionId);
    assert.equal(member.name, "Ada Lovelace");
    assert.equal(member.initials, "AL");
    assert.equal(member.role, "Platform Engineer");
    assert.equal(member.projectOrJobTitle, "Platform Engineer");
    assert.equal(member.contractStatus, "signed");
    assert.equal(member.status, "Active contract");
    assert.equal(member.latestActivity.type, "hired");
    assert.equal(member.latestActivity.label, "Hired");
    assert.equal(member.latestActivity.occurredAt, member.hireDate);
    for (const field of ["team", "contractEndDate", "daysUntilContractEnd", "rating", "weeklyHours", "weeklyTargetHours", "weeklyActivity"]) {
      assert.equal(member[field], null, `${field} must remain null in Phase 1`);
    }
    assert.equal("email" in member, false);
    assert.equal("phone" in member, false);
  });

  it("isolates clients and returns an empty list when no hires exist", async () => {
    const other = await request(server, token(OTHER_CLIENT_ID));
    assert.equal(other.status, 200);
    assert.equal(other.json.teamMembers.length, 1);
    assert.notEqual(other.json.teamMembers[0].id, includedSubmissionId);

    const empty = await request(server, token(EMPTY_CLIENT_ID));
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.json, { teamMembers: [] });
  });
});