/**
 * client-job-authorization.test.ts
 *
 * Regression coverage for the guided client profile/job posting boundaries:
 *  (a) admin job creation rejects talent and admin IDs as job owners
 *  (b) talent and admin sessions cannot use client self-service routes
 *  (c) a client can load/save their profile and create/edit only their own jobs
 *
 * Run with: npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const ADMIN_ID = `client-job-admin-${suffix}`;
const CLIENT_ID = `client-job-client-${suffix}`;
const OTHER_CLIENT_ID = `client-job-other-${suffix}`;
const TALENT_ID = `client-job-talent-${suffix}`;

const token = (userId: string, role: string) =>
  jwt.sign({ userId, email: `${userId}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });

const adminToken = token(ADMIN_ID, "admin");
const clientToken = token(CLIENT_ID, "client");
const otherClientToken = token(OTHER_CLIENT_ID, "client");
const talentToken = token(TALENT_ID, "talent");

function request(
  server: http.Server,
  method: string,
  path: string,
  authToken?: string | null,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
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
            // Some unrelated routes may return plain text; keep the status useful.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const jobPayload = (clientId: string, title = "Client authorization test job") => ({
  clientId,
  title,
  description: "A job used to verify job-owner authorization.",
  category: "Technical",
  experienceLevel: "intermediate",
  engagementType: "Full-Time",
  status: "draft",
});

let server: http.Server;
let otherClientJobId: string;
let createdClientJobId: string;

async function createFixtures() {
  await query(
    `INSERT INTO users (id, email, first_name, last_name, role)
     VALUES
       ($1, $2, 'Admin', 'Tester', 'admin'),
       ($3, $4, 'Client', 'Tester', 'client'),
       ($5, $6, 'Other', 'Client', 'client'),
       ($7, $8, 'Talent', 'Tester', 'talent')`,
    [
      ADMIN_ID,
      `${ADMIN_ID}@test.example`,
      CLIENT_ID,
      `${CLIENT_ID}@test.example`,
      OTHER_CLIENT_ID,
      `${OTHER_CLIENT_ID}@test.example`,
      TALENT_ID,
      `${TALENT_ID}@test.example`,
    ],
  );

  const job = await query(
    `INSERT INTO jobs
       (client_id, title, description, category, experience_level, engagement_type, status, approval_status)
     VALUES ($1, 'Other client private job', 'Private test job', 'Technical', 'intermediate',
             'Full-Time', 'draft', 'pending')
     RETURNING id`,
    [OTHER_CLIENT_ID],
  );
  otherClientJobId = job.rows[0].id;
}

async function destroyFixtures() {
  await query(`DELETE FROM jobs WHERE id = $1`, [createdClientJobId]).catch(() => {});
  await query(`DELETE FROM jobs WHERE id = $1`, [otherClientJobId]).catch(() => {});
  await query(
    `DELETE FROM client_profiles WHERE user_id = ANY($1::text[])`,
    [[ADMIN_ID, CLIENT_ID, OTHER_CLIENT_ID, TALENT_ID]],
  ).catch(() => {});
  await query(
    `DELETE FROM users WHERE id = ANY($1::text[])`,
    [[ADMIN_ID, CLIENT_ID, OTHER_CLIENT_ID, TALENT_ID]],
  );
}

describe("client profile and job authorization (production routes)", () => {
  before(async () => {
    await createFixtures();
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await destroyFixtures();
  });

  it("rejects admin job creation for talent and admin IDs without creating a job", async () => {
    for (const rejectedOwnerId of [TALENT_ID, ADMIN_ID]) {
      const title = `Rejected owner ${rejectedOwnerId}`;
      const response = await request(server, "POST", "/api/admin/jobs", adminToken, jobPayload(rejectedOwnerId, title));

      assert.equal(response.status, 400, JSON.stringify(response.json));
      assert.equal(response.json.error, "Invalid client");
      const created = await query(`SELECT id FROM jobs WHERE title = $1`, [title]);
      assert.equal(created.rows.length, 0, "an invalid owner must not create a job");
    }
  });

  it("returns 403 to talent and admin sessions on client profile and job self-service routes", async () => {
    for (const [role, authToken] of [
      ["talent", talentToken],
      ["admin", adminToken],
    ] as const) {
      const profileGet = await request(server, "GET", "/api/client-profile/me", authToken);
      assert.equal(profileGet.status, 403, `${role} must not load a client profile`);

      const profilePut = await request(server, "PUT", "/api/client-profile/me", authToken, {
        companyName: "Unauthorized update",
      });
      assert.equal(profilePut.status, 403, `${role} must not save a client profile`);

      const jobsGet = await request(server, "GET", "/api/client/jobs", authToken);
      assert.equal(jobsGet.status, 403, `${role} must not list client jobs`);

      const jobsPost = await request(
        server,
        "POST",
        "/api/client/jobs",
        authToken,
        jobPayload(CLIENT_ID, `Unauthorized ${role} job`),
      );
      assert.equal(jobsPost.status, 403, `${role} must not create a client job`);
    }
  });

  it("lets a client load and save their profile", async () => {
    const loaded = await request(server, "GET", "/api/client-profile/me", clientToken);
    assert.equal(loaded.status, 200, JSON.stringify(loaded.json));
    assert.equal(loaded.json.userId, CLIENT_ID);

    const saved = await request(server, "PUT", "/api/client-profile/me", clientToken, {
      companyName: "Client Test Company",
      contactPerson: "Client Tester",
      email: `${CLIENT_ID}@test.example`,
      industry: "Technology",
      about: "Updated through the client self-service route.",
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.json));
    assert.equal(saved.json.companyName, "Client Test Company");
    assert.equal(saved.json.about, "Updated through the client self-service route.");
  });

  it("lets a client create and edit their own job, but not another client's job", async () => {
    const created = await request(
      server,
      "POST",
      "/api/client/jobs",
      clientToken,
      jobPayload("not-the-authenticated-client", "Client-owned job"),
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    createdClientJobId = created.json.id;
    assert.equal(created.json.clientId, CLIENT_ID);
    assert.equal(created.json.approvalStatus, "pending");
    assert.equal(created.json.isClientSubmitted, true);

    const edited = await request(server, "PATCH", `/api/client/jobs/${createdClientJobId}`, clientToken, {
      clientId: OTHER_CLIENT_ID,
      title: "Client-owned job edited",
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.json));
    assert.equal(edited.json.title, "Client-owned job edited");
    assert.equal(edited.json.clientId, CLIENT_ID);

    const otherJobGet = await request(server, "GET", `/api/client/jobs/${otherClientJobId}`, clientToken);
    assert.equal(otherJobGet.status, 404);

    const otherJobEdit = await request(server, "PATCH", `/api/client/jobs/${otherClientJobId}`, clientToken, {
      title: "Should not change",
    });
    assert.equal(otherJobEdit.status, 403);

    const otherClientList = await request(server, "GET", "/api/client/jobs", otherClientToken);
    assert.equal(otherClientList.status, 200, JSON.stringify(otherClientList.json));
    assert.ok(otherClientList.json.some((job: any) => job.id === otherClientJobId));
    assert.ok(!otherClientList.json.some((job: any) => job.id === createdClientJobId));
  });
});