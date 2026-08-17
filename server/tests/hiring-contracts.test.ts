/**
 * hiring-contracts.test.ts
 *
 * Tests for the Phase 3 hiring-contract workflow, exercising the PRODUCTION
 * routes (via registerRoutes) end-to-end plus the shared status guards.
 *
 * Coverage:
 *  (a)  'hired' and 'contract_sent' are NOT in any direct-PATCH status allowlist
 *  (a1) email-send stage guard excludes contract-workflow statuses
 *  (a2) name-reveal treats canonical 'new' as the submitted phase
 *  (b)  HTTP: unauthenticated / non-admin requests are denied even with
 *       BYPASS_ADMIN_AUTH (the contract routes never honor the bypass)
 *  (c)  HTTP: talent accepts a 'sent' offer via PATCH /api/talent/offers/:id/respond,
 *       then admin creates a contract from that offer → submission 'contract_sent'
 *  (d)  HTTP: contract creation from a non-accepted ('sent') offer → 409
 *  (e)  HTTP: duplicate active contract for the same offer → 409
 *  (f)  HTTP: one signature alone does not set 'hired'
 *  (g)  HTTP: both signatures → contract 'signed' + submission 'hired' (terminal)
 *  (h)  HTTP: a fully signed contract cannot be voided
 *  (i)  HTTP: voiding a sent contract rolls the submission back to 'offer_accepted'
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";
import {
  ADMIN_SETTABLE_STATUSES,
  CLIENT_SETTABLE_STATUSES,
  isAdminSettableStatus,
  revealedStatusesForThreshold,
} from "../../shared/submissionStatuses.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const tok = (userId: string, role: string) =>
  jwt.sign({ userId, email: `${userId}@example.com`, role }, JWT_SECRET, { expiresIn: "1h" });

function request(
  srv: http.Server,
  method: string,
  path: string,
  token?: string | null,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = srv.address() as any;
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1", port, method, path,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json: any = null;
          try { json = JSON.parse(buf); } catch {}
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Test fixtures ──────────────────────────────────────────────────────────────

const suffix = Date.now();
const ADMIN_ID = `hc-admin-${suffix}`;
const CLIENT_ID = `hc-client-${suffix}`;
const TALENT_ID = `hc-talent-${suffix}`;

let srv: http.Server;
let jobId: string;
let submissionId: string;   // main happy-path submission
let submissionId2: string;  // void-rollback submission
let offerId: string;        // 'sent' → accepted via talent endpoint
let sentOfferId: string;    // stays 'sent' (guard test)
let offerId2: string;       // second accepted offer (void test)

const adminTok = tok(ADMIN_ID, "admin");
const talentTok = tok(TALENT_ID, "talent");
const clientTok = tok(CLIENT_ID, "client");

async function createFixtures() {
  for (const [id, role] of [[ADMIN_ID, "admin"], [CLIENT_ID, "client"], [TALENT_ID, "talent"]] as const) {
    await query(`INSERT INTO users (id, email, role) VALUES ($1, $2, $3)`, [id, `${id}@test.local`, role]);
  }
  const jobRow = await query(
    `INSERT INTO jobs (client_id, title, description, category, experience_level, status)
     VALUES ($1, 'HC Test Job', 'test', 'Engineering', 'senior', 'open') RETURNING id`,
    [CLIENT_ID],
  );
  jobId = jobRow.rows[0].id;

  const makeSubmission = async () => {
    const row = await query(
      `INSERT INTO job_submissions (job_id, talent_id, client_id, applicant_name, email, status)
       VALUES ($1, $2, $3, 'HC Test Talent', 'hc-talent@test.local', 'offer_extended') RETURNING id`,
      [jobId, TALENT_ID, CLIENT_ID],
    );
    return row.rows[0].id as string;
  };
  submissionId = await makeSubmission();
  submissionId2 = await makeSubmission();

  const makeOffer = async (subId: string, status: string) => {
    const row = await query(
      `INSERT INTO offers (submission_id, engagement_type, rate, status)
       VALUES ($1, 'Full-Time', 1000, $2) RETURNING id`,
      [subId, status],
    );
    return row.rows[0].id as string;
  };
  offerId = await makeOffer(submissionId, "sent");
  sentOfferId = await makeOffer(submissionId, "sent");
  offerId2 = await makeOffer(submissionId2, "sent");
}

async function destroyFixtures() {
  await query(`DELETE FROM hiring_contracts WHERE submission_id IN ($1, $2)`, [submissionId, submissionId2]);
  await query(`DELETE FROM offers WHERE submission_id IN ($1, $2)`, [submissionId, submissionId2]);
  await query(`DELETE FROM job_application_status_history WHERE application_id IN ($1, $2)`, [submissionId, submissionId2]);
  await query(`DELETE FROM job_submissions WHERE job_id = $1`, [jobId]);
  await query(`DELETE FROM jobs WHERE id = $1`, [jobId]);
  await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [ADMIN_ID, CLIENT_ID, TALENT_ID]);
}

async function submissionStatus(id: string): Promise<string> {
  const r = await query(`SELECT status FROM job_submissions WHERE id = $1`, [id]);
  return r.rows[0].status;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("hiring-contracts workflow (production routes)", () => {
  before(async () => {
    await createFixtures();
    const app = express();
    app.use(express.json());
    srv = await registerRoutes(app);
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  });
  after(async () => {
    await destroyFixtures();
    await new Promise<void>((r) => srv.close(() => r()));
  });

  it("(a) direct-PATCH allowlists never contain contract-workflow statuses", () => {
    for (const s of ["hired", "contract_sent"]) {
      assert.ok(!ADMIN_SETTABLE_STATUSES.includes(s as any), `ADMIN_SETTABLE_STATUSES must not contain '${s}'`);
      assert.ok(!CLIENT_SETTABLE_STATUSES.includes(s as any), `CLIENT_SETTABLE_STATUSES must not contain '${s}'`);
    }
  });

  it("(a1) email-send stage updates cannot set contract-workflow statuses", () => {
    assert.equal(isAdminSettableStatus("hired"), false);
    assert.equal(isAdminSettableStatus("contract_sent"), false);
    assert.equal(isAdminSettableStatus("nonsense"), false);
    assert.equal(isAdminSettableStatus("shortlisted"), true);
    assert.equal(isAdminSettableStatus("new"), true);
  });

  it("(a2) name-reveal treats canonical 'new' as the submitted phase", () => {
    const atSubmitted = revealedStatusesForThreshold("submitted");
    assert.ok(atSubmitted.has("new"), "'new' must be revealed at the 'submitted' threshold");
    assert.ok(atSubmitted.has("submitted"), "legacy 'submitted' rows stay revealed");
    const atShortlisted = revealedStatusesForThreshold("shortlisted");
    assert.ok(!atShortlisted.has("new"));
    for (const st of ["shortlisted", "interviewing", "offer_extended", "offer_accepted", "contract_sent", "hired"]) {
      assert.ok(atShortlisted.has(st), `'${st}' must reveal at 'shortlisted' threshold`);
    }
    const atHired = revealedStatusesForThreshold("hired");
    assert.ok(atHired.has("hired"));
    assert.ok(!atHired.has("shortlisted"));
  });

  it("(b) contract routes deny unauthenticated and non-admin callers (bypass never applies)", async () => {
    // No token → 401 regardless of BYPASS_ADMIN_AUTH.
    const noTok = await request(srv, "POST", "/api/admin/hiring-contracts", null, { offerId });
    assert.equal(noTok.status, 401, JSON.stringify(noTok.json));
    // Authenticated non-admin roles → 403.
    for (const t of [talentTok, clientTok]) {
      const r = await request(srv, "POST", "/api/admin/hiring-contracts", t, { offerId });
      assert.equal(r.status, 403, JSON.stringify(r.json));
    }
    const list = await request(srv, "GET", `/api/admin/hiring-contracts?submissionId=${submissionId}`, clientTok);
    assert.equal(list.status, 403);
  });

  let contractId: string;

  it("(c) talent accepts offer via production endpoint, then admin creates contract → 'contract_sent'", async () => {
    // Talent accepts through the real offer-response route (persists 'offer_accepted').
    const accept = await request(srv, "PATCH", `/api/talent/offers/${offerId}/respond`, talentTok, { action: "accept" });
    assert.equal(accept.status, 200, JSON.stringify(accept.json));
    assert.equal(accept.json.status, "offer_accepted");
    assert.equal(await submissionStatus(submissionId), "offer_accepted");

    // Admin creates the contract from that accepted offer.
    const create = await request(srv, "POST", "/api/admin/hiring-contracts", adminTok, {
      offerId, templateRef: "standard-v1",
    });
    assert.equal(create.status, 201, JSON.stringify(create.json));
    contractId = create.json.id;
    assert.equal(create.json.status, "sent");
    assert.ok(create.json.signing_entity && create.json.signing_entity.length > 0);
    assert.equal(await submissionStatus(submissionId), "contract_sent");
  });

  it("(d) rejects contract creation from a non-accepted offer", async () => {
    const r = await request(srv, "POST", "/api/admin/hiring-contracts", adminTok, { offerId: sentOfferId });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(r.json.error, "offer_not_accepted");
  });

  it("(e) rejects a second active contract for the same offer", async () => {
    const r = await request(srv, "POST", "/api/admin/hiring-contracts", adminTok, { offerId });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(r.json.error, "active_contract_exists");
  });

  it("(f) one signature alone does not set 'hired'", async () => {
    const r = await request(srv, "PATCH", `/api/admin/hiring-contracts/${contractId}`, adminTok, { onspotSigned: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(r.json.onspot_signed_at);
    assert.equal(r.json.status, "sent");
    assert.equal(await submissionStatus(submissionId), "contract_sent");
  });

  it("(g) both signatures → contract 'signed' and submission 'hired'", async () => {
    const r = await request(srv, "PATCH", `/api/admin/hiring-contracts/${contractId}`, adminTok, { talentSigned: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(r.json.talent_signed_at);
    assert.equal(r.json.status, "signed");
    assert.equal(await submissionStatus(submissionId), "hired");
  });

  it("(h) a fully signed contract cannot be voided", async () => {
    const r = await request(srv, "PATCH", `/api/admin/hiring-contracts/${contractId}/void`, adminTok, { reason: "should fail" });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(r.json.error, "contract_signed");
    assert.equal(await submissionStatus(submissionId), "hired");
  });

  it("(i) voiding a sent contract rolls the submission back to 'offer_accepted'", async () => {
    const accept = await request(srv, "PATCH", `/api/talent/offers/${offerId2}/respond`, talentTok, { action: "accept" });
    assert.equal(accept.status, 200, JSON.stringify(accept.json));

    const create = await request(srv, "POST", "/api/admin/hiring-contracts", adminTok, { offerId: offerId2 });
    assert.equal(create.status, 201, JSON.stringify(create.json));
    assert.equal(await submissionStatus(submissionId2), "contract_sent");

    const voided = await request(srv, "PATCH", `/api/admin/hiring-contracts/${create.json.id}/void`, adminTok, { reason: "terms changed" });
    assert.equal(voided.status, 200, JSON.stringify(voided.json));
    assert.equal(voided.json.status, "void");
    assert.ok(voided.json.voided_at);
    assert.equal(voided.json.voided_reason, "terms changed");
    assert.equal(await submissionStatus(submissionId2), "offer_accepted");
  });
});
