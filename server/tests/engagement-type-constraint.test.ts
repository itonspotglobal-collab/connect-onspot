/**
 * Engagement-type constraint regression suite.
 *
 * Covers:
 *  (a) Admin can create a job with Lite
 *  (b) Admin can create a job with Standard
 *  (c) Client can create a job with Lite and Standard
 *  (d) Admin editing an existing job still works
 *  (e) Invalid engagement type returns 400 (not 500) for all write paths
 *  (f) Creating a job when the count is > 41 works — no hard cap
 *  (g) validateEngagementType helper rejects legacy / unknown values
 *  (h) The DB constraint after migration allows NULL | Lite | Standard
 *      and rejects the retired Half-Day / Full-Time labels
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import {
  registerRoutes,
  CANONICAL_ENGAGEMENT_TYPES,
  validateEngagementType,
  validateJobFormMetadata,
} from "../routes.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET  = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix      = Date.now().toString(36);
const ADMIN_ID    = `et-admin-${suffix}`;
const CLIENT_ID   = `et-client-${suffix}`;

const makeToken = (userId: string, role: "admin" | "client") =>
  jwt.sign({ userId, email: `${userId}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });

const adminToken  = makeToken(ADMIN_ID, "admin");
const clientToken = makeToken(CLIENT_ID, "client");

function request(
  server: http.Server,
  method: string,
  path: string,
  authToken: string | null,
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
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let json: any = null;
          try { json = JSON.parse(body); } catch { /* plain text on errors */ }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let server: http.Server;
const createdJobIds: string[] = [];

function trackJob(id: string) { createdJobIds.push(id); return id; }

const BASE_JOB = {
  title: "Engagement Type Test",
  professionalRoleName: "Engagement Type Test",
  description: "Testing engagement type validation",
  category: "Engineering",
  jobFunction: "Engineering",
  company: "ET Test Co",
  experienceLevel: "intermediate",
  status: "draft",
  salaryDisplay: "50,000",
};

describe("Engagement-type constraint regression", () => {
  before(async () => {
    await query(
      `INSERT INTO users (id, email, first_name, last_name, role)
       VALUES ($1, $2, 'ET', 'Admin', 'admin'),
              ($3, $4, 'ET', 'Client', 'client')`,
      [ADMIN_ID, `${ADMIN_ID}@test.example`, CLIENT_ID, `${CLIENT_ID}@test.example`],
    );
    await query(
      `INSERT INTO client_profiles (user_id, company_name, contact_person)
       VALUES ($1, 'ET Test Co', 'ET Client')
       ON CONFLICT (user_id) DO NOTHING`,
      [CLIENT_ID],
    );

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    if (createdJobIds.length > 0) {
      await query(`DELETE FROM jobs WHERE id = ANY($1::text[])`, [createdJobIds]).catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await query(`DELETE FROM client_profiles WHERE user_id = $1`, [CLIENT_ID]).catch(() => {});
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[ADMIN_ID, CLIENT_ID]]).catch(() => {});
  });

  // ── (g) Pure-function tests (no server call) ────────────────────────────────

  it("(g1) validateEngagementType: null → no error", () => {
    assert.equal(validateEngagementType(null), null);
  });
  it("(g2) validateEngagementType: undefined → no error", () => {
    assert.equal(validateEngagementType(undefined), null);
  });
  it("(g3) validateEngagementType: '' → no error (nullable column)", () => {
    assert.equal(validateEngagementType(""), null);
  });
  it("(g4) validateEngagementType: 'Lite' → no error", () => {
    assert.equal(validateEngagementType("Lite"), null);
  });
  it("(g5) validateEngagementType: 'Standard' → no error", () => {
    assert.equal(validateEngagementType("Standard"), null);
  });
  it("(g6) validateEngagementType: 'Half-Day' → error (retired label)", () => {
    const err = validateEngagementType("Half-Day");
    assert.ok(err, "Half-Day must be rejected");
    assert.equal(err!.error, "Invalid engagement type");
  });
  it("(g7) validateEngagementType: 'Full-Time' → error (retired label)", () => {
    const err = validateEngagementType("Full-Time");
    assert.ok(err, "Full-Time must be rejected");
    assert.equal(err!.error, "Invalid engagement type");
  });
  it("(g8) validateEngagementType: arbitrary string → error", () => {
    assert.ok(validateEngagementType("Hourly"), "arbitrary values must be rejected");
  });
  it("(g9) CANONICAL_ENGAGEMENT_TYPES contains exactly Lite and Standard", () => {
    assert.deepEqual([...CANONICAL_ENGAGEMENT_TYPES].sort(), ["Lite", "Standard"]);
  });
  it("(g10) structured skill metadata accepts supported experience thresholds", () => {
    assert.equal(
      validateJobFormMetadata({
        compensationDisplayType: "range",
        requiredSkills: [{ name: "Salesforce", years: "3" }],
      }),
      null,
    );
  });
  it("(g11) structured skill metadata rejects invalid display or experience values", () => {
    assert.ok(validateJobFormMetadata({ compensationDisplayType: "weekly" }));
    assert.ok(
      validateJobFormMetadata({
        requiredSkills: [{ name: "Salesforce", years: "four" }],
      }),
    );
  });

  // ── (h) DB constraint (direct SQL) ─────────────────────────────────────────

  it("(h1) DB constraint: NULL engagement_type is allowed", async () => {
    const r = await query(
      `INSERT INTO jobs (client_id, title, description, category, experience_level, status)
       VALUES ($1, $2, 'desc', 'Engineering', 'intermediate', 'draft') RETURNING id`,
      [CLIENT_ID, `ET-null-${suffix}`],
    );
    trackJob(r.rows[0].id);
    assert.equal(r.rows.length, 1);
  });
  it("(h2) DB constraint: 'Lite' is allowed", async () => {
    const r = await query(
      `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type)
       VALUES ($1, $2, 'desc', 'Engineering', 'intermediate', 'draft', 'Lite') RETURNING id`,
      [CLIENT_ID, `ET-lite-${suffix}`],
    );
    trackJob(r.rows[0].id);
    assert.equal(r.rows.length, 1);
  });
  it("(h3) DB constraint: 'Standard' is allowed", async () => {
    const r = await query(
      `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type)
       VALUES ($1, $2, 'desc', 'Engineering', 'intermediate', 'draft', 'Standard') RETURNING id`,
      [CLIENT_ID, `ET-std-${suffix}`],
    );
    trackJob(r.rows[0].id);
    assert.equal(r.rows.length, 1);
  });
  it("(h4) DB constraint: 'Full-Time' is rejected after migration", async () => {
    await assert.rejects(
      () =>
        query(
          `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type)
           VALUES ($1, $2, 'desc', 'Engineering', 'intermediate', 'draft', 'Full-Time')`,
          [CLIENT_ID, `ET-ft-${suffix}`],
        ),
      /check constraint/i,
    );
  });
  it("(h5) DB constraint: 'Half-Day' is rejected after migration", async () => {
    await assert.rejects(
      () =>
        query(
          `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type)
           VALUES ($1, $2, 'desc', 'Engineering', 'intermediate', 'draft', 'Half-Day')`,
          [CLIENT_ID, `ET-hd-${suffix}`],
        ),
      /check constraint/i,
    );
  });

  // ── (a/b) Admin create ──────────────────────────────────────────────────────

  it("(a) admin can create a job with engagementType=Lite", async () => {
    const res = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Lite",
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    assert.equal(res.json.engagementType, "Lite");
    trackJob(res.json.id);
  });

  it("(b) admin can create a job with engagementType=Standard", async () => {
    const res = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Standard",
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    assert.equal(res.json.engagementType, "Standard");
    trackJob(res.json.id);
  });

  it("(b2) admin create and edit preserve structured job requirements", async () => {
    const create = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB,
      clientId: CLIENT_ID,
      engagementType: "Standard",
      minimumEducation: "Bachelor's degree",
      requiredSkills: [{ name: "Salesforce", years: "3" }],
      requiresUsTimezoneOverlap: true,
      requiresFluentEnglish: true,
      compensationDisplayType: "starting_from",
      contractorEngagementConfirmed: true,
    });
    assert.equal(create.status, 201, JSON.stringify(create.json));
    trackJob(create.json.id);
    assert.deepEqual(create.json.requiredSkills, [{ name: "Salesforce", years: "3" }]);
    assert.equal(create.json.minimumEducation, "Bachelor's degree");
    assert.equal(create.json.requiresUsTimezoneOverlap, true);

    const update = await request(server, "PATCH", `/api/admin/jobs/${create.json.id}`, adminToken, {
      requiredSkills: [{ name: "Salesforce", years: "5" }],
      compensationDisplayType: "negotiable",
    });
    assert.equal(update.status, 200, JSON.stringify(update.json));
    assert.deepEqual(update.json.requiredSkills, [{ name: "Salesforce", years: "5" }]);
    assert.equal(update.json.compensationDisplayType, "negotiable");

    const clearSkills = await request(server, "PATCH", `/api/admin/jobs/${create.json.id}`, adminToken, {
      requiredSkills: [],
      skillTags: [],
    });
    assert.equal(clearSkills.status, 200, JSON.stringify(clearSkills.json));
    assert.deepEqual(clearSkills.json.requiredSkills, []);
    assert.deepEqual(clearSkills.json.skillTags, []);
  });

  it("(b3) admin can create with every newly optional job-form field blank", async () => {
    const res = await request(server, "POST", "/api/admin/jobs", adminToken, {
      title: "Optional field test",
      professionalRoleName: "Optional field test",
      category: "Engineering",
      jobFunction: "Engineering",
      experienceLevel: "entry",
      engagementType: "Lite",
      status: "draft",
      clientId: CLIENT_ID,
      description: "",
      company: null,
      location: null,
      duration: null,
      minimumEducation: null,
      requiredSkills: [],
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    trackJob(res.json.id);
    assert.equal(res.json.description, "");
    assert.equal(res.json.company, null);
    assert.equal(res.json.location, null);
    assert.deepEqual(res.json.requiredSkills, []);
  });

  // ── (e) Invalid → 400 ──────────────────────────────────────────────────────

  it("(e1) POST /api/admin/jobs: 'Full-Time' → 400 Invalid engagement type", async () => {
    const res = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Full-Time",
    });
    assert.equal(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(res.json)}`);
    assert.equal(res.json.error, "Invalid engagement type");
  });

  it("(e2) POST /api/admin/jobs: 'Half-Day' → 400 Invalid engagement type", async () => {
    const res = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Half-Day",
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, "Invalid engagement type");
  });

  // ── (d) Admin edit ──────────────────────────────────────────────────────────

  it("(d) admin can edit a job's engagementType to Standard", async () => {
    const create = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Lite",
    });
    assert.equal(create.status, 201, JSON.stringify(create.json));
    const jobId = trackJob(create.json.id);

    const patch = await request(server, "PATCH", `/api/admin/jobs/${jobId}`, adminToken, {
      engagementType: "Standard",
    });
    assert.equal(patch.status, 200, JSON.stringify(patch.json));
    assert.equal(patch.json.engagementType, "Standard");
  });

  it("(e3) PATCH /api/admin/jobs: invalid value → 400", async () => {
    const create = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Lite",
    });
    const jobId = trackJob(create.json.id);

    const res = await request(server, "PATCH", `/api/admin/jobs/${jobId}`, adminToken, {
      engagementType: "Half-Day",
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, "Invalid engagement type");
  });

  // ── (c) Client create ──────────────────────────────────────────────────────

  it("(c1) client can create a job with Lite via /api/client/jobs", async () => {
    const res = await request(server, "POST", "/api/client/jobs", clientToken, {
      ...BASE_JOB,
      engagementType: "Lite",
      minimumEducation: "Associate degree",
      requiredSkills: [{ name: "Customer service", years: "2" }],
      requiresFluentEnglish: true,
      compensationDisplayType: "range",
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    trackJob(res.json.id);
    assert.deepEqual(res.json.requiredSkills, [{ name: "Customer service", years: "2" }]);
    assert.equal(res.json.minimumEducation, "Associate degree");
    assert.equal(res.json.requiresFluentEnglish, true);
  });

  it("(c2) client can create a job with Standard via /api/client/jobs", async () => {
    const res = await request(server, "POST", "/api/client/jobs", clientToken, {
      ...BASE_JOB, engagementType: "Standard",
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    trackJob(res.json.id);
  });

  it("(c3) client can create with every newly optional job-form field blank", async () => {
    const res = await request(server, "POST", "/api/client/jobs", clientToken, {
      title: "Client optional field test",
      professionalRoleName: "Client optional field test",
      category: "Engineering",
      jobFunction: "Engineering",
      experienceLevel: "entry",
      engagementType: "Standard",
      status: "draft",
      description: "",
      company: null,
      location: null,
      duration: null,
      minimumEducation: null,
      requiredSkills: [],
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    trackJob(res.json.id);
    assert.equal(res.json.description, "");
    assert.equal(res.json.company, null);
    assert.equal(res.json.location, null);
    assert.deepEqual(res.json.requiredSkills, []);
  });

  it("(e4) POST /api/client/jobs: 'Full-Time' → 400 Invalid engagement type", async () => {
    const res = await request(server, "POST", "/api/client/jobs", clientToken, {
      ...BASE_JOB, engagementType: "Full-Time",
    });
    assert.equal(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(res.json)}`);
    assert.equal(res.json.error, "Invalid engagement type");
  });

  // ── (f) No job-count cap ────────────────────────────────────────────────────

  it("(f) creating a job succeeds regardless of how many jobs already exist", async () => {
    const res = await request(server, "POST", "/api/admin/jobs", adminToken, {
      ...BASE_JOB, clientId: CLIENT_ID, engagementType: "Standard",
      title: `ET no-cap test ${suffix}`,
    });
    assert.equal(
      res.status,
      201,
      `job creation must not be capped by a count limit: ${JSON.stringify(res.json)}`,
    );
    trackJob(res.json.id);
  });
});
