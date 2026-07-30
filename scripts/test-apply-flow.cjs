#!/usr/bin/env node
/**
 * E2E smoke-test: apply → signup → portal flow
 *
 * Usage (dev):
 *   BASE_URL=http://localhost:5000 node scripts/test-apply-flow.js
 *
 * Usage (production):
 *   BASE_URL=https://your-app-domain node scripts/test-apply-flow.js
 *
 * Requires DATABASE_URL in the environment so the script can verify DB state
 * after a successful link step.
 *
 * Exit codes:
 *   0  — all assertions passed
 *   1  — one or more assertions failed
 */

"use strict";

const { Pool }       = require("pg");
const { createHash } = require("crypto");

const BASE  = process.env.BASE_URL   || "http://localhost:5000";
const DB_URL = process.env.DATABASE_URL;

let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

async function fetchJSON(url, opts = {}) {
  const res  = await fetch(url, opts);
  let body;
  try { body = await res.json(); } catch { body = {}; }
  return { status: res.status, body };
}

async function run() {
  console.log(`\n🧪  apply → signup → portal E2E  (${BASE})\n`);

  // ── 0. Find an open built_in_form job ──────────────────────────────────────
  const { status: s0, body: b0 } = await fetchJSON(`${BASE}/api/jobs/search?limit=10`);
  ok("GET /api/jobs/search → 200", s0 === 200, `got ${s0}`);
  const jobs = (b0.items || []).filter(j => j.status === "open" && j.applicationMethod === "built_in_form");
  ok("At least one open built_in_form job exists", jobs.length > 0, `found ${jobs.length}`);
  if (!jobs.length) { printSummary(); return; }
  const job = jobs[0];
  console.log(`     Using job: ${job.id} — ${job.title}\n`);

  // ── 1. Submit application ──────────────────────────────────────────────────
  const email = `e2e_${Date.now()}@example.com`;
  const { status: s1, body: b1 } = await fetchJSON(`${BASE}/api/jobs/${job.id}/apply`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ firstName: "Maria", lastName: "Santos", email, phone: "+63 912 345 6789", coverLetter: "E2E test" }),
  });
  ok("POST /api/jobs/:id/apply → 201", s1 === 201, `got ${s1}: ${b1.error || ""}`);
  ok("Response includes continuationToken", !!b1.continuationToken);
  ok("Response includes applicationId",     !!b1.applicationId);
  if (s1 !== 201) { printSummary(); return; }
  const { continuationToken, applicationId } = b1;

  // ── 2. Resolve token → prefill data ───────────────────────────────────────
  const { status: s2, body: b2 } = await fetchJSON(
    `${BASE}/api/job-applications/continue/${encodeURIComponent(continuationToken)}`
  );
  ok("GET /api/job-applications/continue/:token → 200", s2 === 200, `got ${s2}: ${b2.error || ""}`);
  ok("Prefill: email matches submitted email",   b2.email?.toLowerCase() === email.toLowerCase());
  ok("Prefill: submissionId present",            !!b2.submissionId);
  ok("Prefill: jobTitle present",                !!b2.jobTitle);
  if (s2 !== 200) { printSummary(); return; }

  // ── 3. Create talent account ───────────────────────────────────────────────
  const { status: s3, body: b3 } = await fetchJSON(`${BASE}/api/signup`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ first_name: b2.firstName, last_name: b2.lastName, email, password: "TestPass123!", role: "talent" }),
  });
  ok("POST /api/signup → 201",              s3 === 201, `got ${s3}: ${b3.error || b3.message || ""}`);
  ok("Signup returns JWT token",            !!b3.token);
  ok("Signup returns user with role=talent", b3.user?.role === "talent");
  if (s3 !== 201) { printSummary(); return; }
  const authToken = b3.token;

  // ── 4. Link application to account ────────────────────────────────────────
  const { status: s4, body: b4 } = await fetchJSON(`${BASE}/api/job-applications/link`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body:    JSON.stringify({ submissionId: b2.submissionId, token: continuationToken }),
  });
  ok("POST /api/job-applications/link → 200", s4 === 200, `got ${s4}: ${b4.error || ""}`);
  ok("Link response: success=true",           b4.success === true);

  // ── 5. Verify DB state ─────────────────────────────────────────────────────
  if (DB_URL) {
    const pool = new Pool({ connectionString: DB_URL });
    try {
      const tokenHash = createHash("sha256").update(continuationToken).digest("hex");
      const [subRow, tokRow] = await Promise.all([
        pool.query("SELECT talent_id, registration_status FROM job_submissions WHERE id = $1", [b2.submissionId]),
        pool.query("SELECT used_at FROM application_tokens WHERE token_hash = $1", [tokenHash]),
      ]);
      const sub = subRow.rows[0];
      const tok = tokRow.rows[0];
      ok("job_submissions.talent_id is populated",              !!sub?.talent_id,                      `got ${sub?.talent_id}`);
      ok("job_submissions.registration_status = 'registered'",  sub?.registration_status === "registered", `got ${sub?.registration_status}`);
      ok("application_tokens.used_at is set",                   !!tok?.used_at,                        `got ${tok?.used_at}`);
    } finally {
      await pool.end();
    }
  } else {
    console.log("  ⚠️  DATABASE_URL not set — skipping DB state verification");
  }

  // ── 6. Duplicate apply → 409 ───────────────────────────────────────────────
  const { status: s6 } = await fetchJSON(`${BASE}/api/jobs/${job.id}/apply`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ firstName: "Maria", lastName: "Santos", email, phone: "+63 912 345 6789" }),
  });
  ok("Duplicate apply (same email + job) → 409", s6 === 409, `got ${s6}`);

  // ── 7. Reuse already-consumed token → 410 ─────────────────────────────────
  const { status: s7, body: b7 } = await fetchJSON(
    `${BASE}/api/job-applications/continue/${encodeURIComponent(continuationToken)}`
  );
  ok("Reuse consumed token → 410",              s7 === 410, `got ${s7}`);
  ok("410 response error = 'Token already used'", b7.error === "Token already used");

  printSummary();
}

function printSummary() {
  const total = passed + failed;
  console.log(`\n${"─".repeat(48)}`);
  console.log(`  ${passed}/${total} assertions passed${failed > 0 ? `, ${failed} FAILED` : ""}`);
  console.log(`${"─".repeat(48)}\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error("\nUnhandled error:", err.message);
  process.exit(1);
});
