/**
 * Regression coverage for the Admin-only recovery path used after an applicant
 * email has already been delivered but its approval transaction did not commit.
 * The endpoint must never send a second email.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ADMIN_ID = `approval-finalize-admin-${suffix}`;
const CLIENT_ID = `approval-finalize-client-${suffix}`;
const TALENT_ID = `approval-finalize-talent-${suffix}`;
const email = (role: string) => `approval-finalize-${role}-${suffix}@example.com`;
const adminToken = jwt.sign(
  { userId: ADMIN_ID, email: email("admin"), role: "admin" },
  JWT_SECRET,
  { expiresIn: "1h" },
);

let server: http.Server;
let jobId = "";
let recoverableApplicationId = "";
let staleApplicationId = "";
let recoverableRequestId = "";
let staleRequestId = "";

function request(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          Authorization: `Bearer ${adminToken}`,
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = JSON.parse(responseBody);
          } catch {
            // Keep the status assertion useful if a proxy ever returns text.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createRequestFixture(params: {
  applicationStatus: string;
  requestCurrentStatus: string;
  requestedStatus: string;
}): Promise<{ applicationId: string; requestId: string }> {
  const submission = await query(
    `INSERT INTO job_submissions
       (job_id, client_id, email, status, talent_id, applicant_name, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5, 'Recovery Talent', 'Recovery', 'Talent')
     RETURNING id`,
    [jobId, CLIENT_ID, email(`talent-${params.applicationStatus}`), params.applicationStatus, TALENT_ID],
  );
  const applicationId = submission.rows[0].id;
  const statusRequest = await query(
    `INSERT INTO application_status_change_requests
       (application_id, requested_by_user_id, requested_by_role, current_status, requested_status, status)
     VALUES ($1, $2, 'client', $3, $4, 'pending')
     RETURNING id`,
    [applicationId, CLIENT_ID, params.requestCurrentStatus, params.requestedStatus],
  );
  const requestId = statusRequest.rows[0].id;
  await query(
    `INSERT INTO job_application_emails
       (application_id, subject, body_html, sent_to, sent_by, status, is_test, status_update, status_previous)
     VALUES ($1, 'Recovery proof', '<p>Delivered</p>', $2, $3, 'sent', false, $4, $5)`,
    [applicationId, email(`talent-${params.applicationStatus}`), ADMIN_ID, params.requestedStatus, params.requestCurrentStatus],
  );
  return { applicationId, requestId };
}

describe("Admin approval finalization after a delivered email", () => {
  before(async () => {
    await query(
      `INSERT INTO users (id, email, role, password_hash)
       VALUES ($1, $2, 'admin', 'x'), ($3, $4, 'client', 'x'), ($5, $6, 'talent', 'x')`,
      [ADMIN_ID, email("admin"), CLIENT_ID, email("client"), TALENT_ID, email("talent")],
    );
    const job = await query(
      `INSERT INTO jobs
         (client_id, title, description, category, experience_level, engagement_type, status, approval_status)
       VALUES ($1, 'Approval finalize test job', 'Recovery test job', 'Technical', 'intermediate',
               'Standard', 'open', 'approved')
       RETURNING id`,
      [CLIENT_ID],
    );
    jobId = job.rows[0].id;
    ({ applicationId: recoverableApplicationId, requestId: recoverableRequestId } =
      await createRequestFixture({
        applicationStatus: "new",
        requestCurrentStatus: "new",
        requestedStatus: "under_review",
      }));
    ({ applicationId: staleApplicationId, requestId: staleRequestId } =
      await createRequestFixture({
        applicationStatus: "reviewed",
        requestCurrentStatus: "new",
        requestedStatus: "under_review",
      }));

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await query(
      `DELETE FROM notifications WHERE user_id = ANY($1::text[])`,
      [[ADMIN_ID, CLIENT_ID, TALENT_ID]],
    ).catch(() => {});
    await query(
      `DELETE FROM job_submissions WHERE id = ANY($1::text[])`,
      [[recoverableApplicationId, staleApplicationId]],
    ).catch(() => {});
    await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
    await query(
      `DELETE FROM users WHERE id = ANY($1::text[])`,
      [[ADMIN_ID, CLIENT_ID, TALENT_ID]],
    ).catch(() => {});
  });

  it("finalizes exactly once after delivery: canonical status, history, and both notifications", async () => {
    const finalized = await request("POST", `/api/admin/status-change-requests/${recoverableRequestId}/finalize`, {});
    assert.equal(finalized.status, 200, JSON.stringify(finalized.json));
    assert.equal(finalized.json.application.status, "under_review");

    const [submission, statusRequest, history, talentNotifications, clientNotifications] = await Promise.all([
      query(`SELECT status FROM job_submissions WHERE id = $1`, [recoverableApplicationId]),
      query(`SELECT status FROM application_status_change_requests WHERE id = $1`, [recoverableRequestId]),
      query(
        `SELECT id FROM job_application_status_history
          WHERE application_id = $1 AND note LIKE $2`,
        [recoverableApplicationId, `Client status request ${recoverableRequestId}:%`],
      ),
      query(
        `SELECT id, title, message, is_read, related_type, event_key FROM notifications
          WHERE user_id = $1 AND type = 'job_application_status_changed' AND related_id = $2`,
        [TALENT_ID, recoverableApplicationId],
      ),
      query(
        `SELECT id FROM notifications
          WHERE user_id = $1 AND type = 'application_status_change_approved' AND related_id = $2`,
        [CLIENT_ID, recoverableRequestId],
      ),
    ]);
    assert.equal(submission.rows[0].status, "under_review");
    assert.equal(statusRequest.rows[0].status, "approved");
    assert.equal(history.rows.length, 1, "one status-history event is required");
    assert.equal(talentNotifications.rows.length, 1, "Talent receives one notification");
    assert.equal(talentNotifications.rows[0].title, "Application Under Review");
    assert.match(talentNotifications.rows[0].message, /is now under review\./i);
    assert.equal(talentNotifications.rows[0].is_read, false);
    assert.equal(talentNotifications.rows[0].related_type, "job_submission");
    assert.match(talentNotifications.rows[0].event_key, /^job-application-status-history:/);
    assert.equal(clientNotifications.rows.length, 1, "requesting Client receives one notification");

    const retry = await request("POST", `/api/admin/status-change-requests/${recoverableRequestId}/finalize`, {});
    assert.equal(retry.status, 409, "retry must not duplicate a completed approval");
    const historyAfterRetry = await query(
      `SELECT id FROM job_application_status_history
        WHERE application_id = $1 AND note LIKE $2`,
      [recoverableApplicationId, `Client status request ${recoverableRequestId}:%`],
    );
    assert.equal(historyAfterRetry.rows.length, 1, "retry must not duplicate history");
  });

  it("cancels a stale request without changing the application", async () => {
    const stale = await request("POST", `/api/admin/status-change-requests/${staleRequestId}/finalize`, {});
    assert.equal(stale.status, 409, JSON.stringify(stale.json));

    const [submission, statusRequest, history] = await Promise.all([
      query(`SELECT status FROM job_submissions WHERE id = $1`, [staleApplicationId]),
      query(`SELECT status FROM application_status_change_requests WHERE id = $1`, [staleRequestId]),
      query(`SELECT id FROM job_application_status_history WHERE application_id = $1`, [staleApplicationId]),
    ]);
    assert.equal(submission.rows[0].status, "reviewed");
    assert.equal(statusRequest.rows[0].status, "cancelled");
    assert.equal(history.rows.length, 0, "stale approval must not create a history event");
  });

  it("records every sequential generic Admin transition even when the default note is reused", async () => {
    const defaultNote = "Status updated with applicant email sent";
    const firstUpdate = await query(
      `UPDATE job_submissions
          SET status = 'under_review', updated_at = NOW()
        WHERE id = $1 AND status = 'reviewed'
      RETURNING id`,
      [staleApplicationId],
    );
    assert.equal(firstUpdate.rows.length, 1);
    const firstHistory = await query(
      `INSERT INTO job_application_status_history
         (application_id, previous_status, new_status, note, changed_by)
       VALUES ($1, 'reviewed', 'under_review', $2, $3)
       RETURNING id`,
      [staleApplicationId, defaultNote, ADMIN_ID],
    );

    const secondUpdate = await query(
      `UPDATE job_submissions
          SET status = 'shortlisted', updated_at = NOW()
        WHERE id = $1 AND status = 'under_review'
      RETURNING id`,
      [staleApplicationId],
    );
    assert.equal(secondUpdate.rows.length, 1);
    const secondHistory = await query(
      `INSERT INTO job_application_status_history
         (application_id, previous_status, new_status, note, changed_by)
       VALUES ($1, 'under_review', 'shortlisted', $2, $3)
       RETURNING id`,
      [staleApplicationId, defaultNote, ADMIN_ID],
    );

    assert.notEqual(firstHistory.rows[0].id, secondHistory.rows[0].id);
    const history = await query(
      `SELECT id
         FROM job_application_status_history
        WHERE application_id = $1 AND note = $2`,
      [staleApplicationId, defaultNote],
    );
    assert.equal(history.rows.length, 2);
  });
});