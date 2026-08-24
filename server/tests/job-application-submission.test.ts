import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const suffix = Date.now();
const clientId = `application-flow-client-${suffix}`;
const talentId = `application-flow-talent-${suffix}`;
const clientEmail = `${clientId}@test.example`;
const talentEmail = `${talentId}@test.example`;
const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
const talentToken = jwt.sign(
  { userId: talentId, email: talentEmail, role: "talent" },
  jwtSecret,
  { expiresIn: "1h" },
);

let server: http.Server;
let jobId: string;
let submissionId: string;

function request(method: string, path: string, body: unknown) {
  const { port } = server.address() as { port: number };
  const data = JSON.stringify(body);
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        Authorization: `Bearer ${talentToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
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
    req.write(data);
    req.end();
  });
}

describe("canonical job application submission", () => {
  before(async () => {
    await query(
      `INSERT INTO users (id, email, role, first_name, last_name)
       VALUES ($1, $2, 'client', 'Application', 'Client'),
              ($3, $4, 'talent', 'Application', 'Talent')`,
      [clientId, clientEmail, talentId, talentEmail],
    );
    jobId = (await query(
      `INSERT INTO jobs
         (client_id, title, description, category, experience_level, status, engagement_type, application_method)
       VALUES ($1, 'Application Flow Test', 'Test job', 'Engineering', 'intermediate', 'open', 'Standard', 'built_in_form')
       RETURNING id`,
      [clientId],
    )).rows[0].id;

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    if (submissionId) {
      // The application-received email is intentionally fire-and-forget in the
      // route. Let it finish before removing the submission fixture so its
      // insert cannot race the cleanup.
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const email = await query(
          `SELECT 1 FROM job_application_emails WHERE application_id = $1 LIMIT 1`,
          [submissionId],
        ).catch(() => ({ rows: [] }));
        if (email.rows.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await query(`DELETE FROM notifications WHERE related_id = $1`, [submissionId]).catch(() => {});
      await query(`DELETE FROM application_tokens WHERE submission_id = $1`, [submissionId]).catch(() => {});
      await query(`DELETE FROM job_submissions WHERE id = $1`, [submissionId]).catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[clientId, talentId]]).catch(() => {});
  });

  it("submits the visible application flow through job_submissions", async () => {
    const response = await request("POST", `/api/jobs/${jobId}/apply`, {
      firstName: "Application",
      lastName: "Talent",
      email: talentEmail,
      phone: "+1 555 0100",
      coverLetter: "I have the relevant experience and would be excited to contribute to this role.",
      proposedBudget: "1500",
      estimatedDuration: "3 weeks",
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.success, true);
    submissionId = response.json.applicationId;
    const stored = await query(
      `SELECT talent_id, status, cover_letter
               , proposed_rate, proposed_budget, estimated_duration
         FROM job_submissions
        WHERE id = $1`,
      [submissionId],
    );
    assert.equal(stored.rows[0].talent_id, talentId);
    assert.equal(stored.rows[0].status, "new");
    assert.equal(stored.rows[0].cover_letter, "I have the relevant experience and would be excited to contribute to this role.");
    assert.equal(stored.rows[0].proposed_rate, null);
    assert.equal(Number(stored.rows[0].proposed_budget), 1500);
    assert.equal(stored.rows[0].estimated_duration, "3 weeks");
  });
});