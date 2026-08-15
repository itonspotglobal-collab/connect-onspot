/**
 * candidate-media.test.ts
 *
 * Tests for resume and video upload/delete endpoints.
 * All tests exercise the PRODUCTION route handlers from
 * server/routes/candidateMedia.ts with mocked I/O boundaries
 * (storage, ACL, DB) so no live connections are required.
 *
 * Coverage:
 *  1. checkCandidateMediaAuth — JWT auth check (pure logic)
 *     a. No token → 401
 *     b. Tampered / invalid token → 401
 *     c. Token signed with the wrong secret → 401
 *     d. Candidate JWT for a DIFFERENT candidateId → 403
 *     e. Candidate JWT for the CORRECT candidateId → ok: true
 *     f. Admin JWT (wrong type/role for this endpoint) → 403 Insufficient permissions
 *     g. Talent-role JWT → talent-email-check-required (caller does DB check)
 *
 *  2. Profile completion — resume contribution (pure logic)
 *     a. Candidate row WITH resumeUrl → hasResume:true, resume item done:true
 *     b. Candidate row WITHOUT resumeUrl → hasResume:false, resume item done:false
 *     c. Uploading a resume increases the completion percentage
 *     d. Deleting a resume (resumeUrl → null) decreases the completion percentage
 *     e. Resume contributes exactly 1/total_tracked_fields to the percentage
 *
 *  3. Production route handlers (real handlers, mocked deps)
 *     a. POST /resume — mismatched candidate JWT → 403
 *     b. POST /resume — valid token, storage failure → 500 + clear error msg
 *     c. POST /resume — valid token, storage success → 200 + persists to DB
 *     d. DELETE /resume — valid token → 200 + clears DB fields
 *     e. DELETE /resume — storage delete error is non-fatal → still returns 200
 *     f. POST /video — mismatched candidate JWT → 403
 *     g. POST /video — valid token, storage failure → 500 + clear error msg
 *     h. POST /video — valid token, storage success → 200 + persists to DB
 *     i. DELETE /video — valid token → 200 + clears DB fields
 *     j. Talent-role JWT with matching DB email → 200 (DB check exercised)
 *     k. Talent-role JWT with non-matching email → 403
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import express from "express";
import multer from "multer";

// ── 1. Auth helper ────────────────────────────────────────────────────────────
import { checkCandidateMediaAuth } from "../lib/candidateMediaAuth.js";

// ── Production route factory ──────────────────────────────────────────────────
import {
  registerCandidateMediaRoutes,
  type CandidateMediaDeps,
} from "../routes/candidateMedia.js";

// ── Profile completion (pure functions) ───────────────────────────────────────
import {
  profileStrengthFromCandidate,
  buildCompletionItems,
  calcCompletionPct,
} from "../../client/src/lib/profileCompletion.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared test constants
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = "test-secret-123";
const CANDIDATE_ID = "cand-test-001";

function makeCandidateToken(candidateId: string): string {
  return jwt.sign({ type: "candidate", candidateId, email: "test@example.com" }, SECRET, { expiresIn: "1h" });
}
function makeTalentToken(email: string): string {
  return jwt.sign({ role: "talent", email, userId: "u1" }, SECRET, { expiresIn: "1h" });
}
function makeAdminToken(): string {
  return jwt.sign({ role: "admin", userId: "admin1", email: "admin@example.com" }, SECRET, { expiresIn: "1h" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — checkCandidateMediaAuth (pure logic)
// ─────────────────────────────────────────────────────────────────────────────

describe("checkCandidateMediaAuth — JWT validation", () => {
  it("(a) no Authorization header → 401", () => {
    const result = checkCandidateMediaAuth(undefined, CANDIDATE_ID, SECRET);
    assert.equal(result.ok, false);
    assert.equal((result as any).status, 401);
  });

  it("(b) tampered / invalid token string → 401", () => {
    const result = checkCandidateMediaAuth("Bearer not.a.real.jwt", CANDIDATE_ID, SECRET);
    assert.equal(result.ok, false);
    assert.equal((result as any).status, 401);
  });

  it("(c) valid JWT signed with the WRONG secret → 401", () => {
    const badToken = jwt.sign({ type: "candidate", candidateId: CANDIDATE_ID }, "wrong-secret");
    const result = checkCandidateMediaAuth(`Bearer ${badToken}`, CANDIDATE_ID, SECRET);
    assert.equal(result.ok, false);
    assert.equal((result as any).status, 401);
  });

  it("(d) candidate JWT for a DIFFERENT candidateId → 403", () => {
    const token = makeCandidateToken("cand-OTHER");
    const result = checkCandidateMediaAuth(`Bearer ${token}`, CANDIDATE_ID, SECRET);
    assert.equal(result.ok, false);
    assert.equal((result as any).status, 403);
    assert.match((result as any).error, /not authorized/i);
  });

  it("(e) candidate JWT for the CORRECT candidateId → ok: true", () => {
    const token = makeCandidateToken(CANDIDATE_ID);
    const result = checkCandidateMediaAuth(`Bearer ${token}`, CANDIDATE_ID, SECRET);
    assert.equal(result.ok, true);
  });

  it("(f) admin JWT → 403 Insufficient permissions", () => {
    const token = makeAdminToken();
    const result = checkCandidateMediaAuth(`Bearer ${token}`, CANDIDATE_ID, SECRET);
    assert.equal(result.ok, false);
    assert.equal((result as any).status, 403);
    assert.equal((result as any).error, "Insufficient permissions");
  });

  it("(g) talent-role JWT → talent-email-check-required", () => {
    const token = makeTalentToken("talent@example.com");
    const result = checkCandidateMediaAuth(`Bearer ${token}`, CANDIDATE_ID, SECRET);
    assert.equal(result.ok, false);
    assert.equal((result as any).status, 403);
    assert.equal((result as any).error, "talent-email-check-required");
    assert.equal((result as any).email, "talent@example.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — Profile completion (pure logic)
// ─────────────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Record<string, any> = {}) {
  return {
    profilePhotoUrl:  "/photo.jpg",
    displayName:      "Jane Doe",
    fullName:         "Jane Doe",
    headline:         "Frontend Engineer",
    summary:          "I build UIs",
    email:            "jane@example.com",
    location:         "Cape Town",
    coreSkills:       ["React", "TypeScript"],
    workHistory:      [{ id: "w1" }],
    education:        [{ id: "e1" }],
    preferences:      { workSetup: "remote" },
    resumeUrl:        "/objects/candidate-resumes/uuid-1",
    linkedinUrl:      "https://linkedin.com/in/jane",
    ...overrides,
  };
}

describe("Profile completion — resume contribution", () => {
  it("(a) candidate WITH resumeUrl → hasResume:true, resume item done:true", () => {
    const input = profileStrengthFromCandidate(makeCandidate({ resumeUrl: "/objects/candidate-resumes/uuid-1" }) as any);
    assert.equal(input.hasResume, true);
    const resumeItem = buildCompletionItems(input).find((i) => i.label === "Resume");
    assert.ok(resumeItem, "Resume item must be in checklist");
    assert.equal(resumeItem!.done, true);
  });

  it("(b) candidate WITHOUT resumeUrl → hasResume:false, resume item done:false", () => {
    const input = profileStrengthFromCandidate(makeCandidate({ resumeUrl: null }) as any);
    assert.equal(input.hasResume, false);
    const resumeItem = buildCompletionItems(input).find((i) => i.label === "Resume");
    assert.ok(resumeItem, "Resume item must be in checklist");
    assert.equal(resumeItem!.done, false);
  });

  it("(c) uploading a resume increases the completion percentage", () => {
    const pctBefore = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(makeCandidate({ resumeUrl: null }) as any)));
    const pctAfter  = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(makeCandidate({ resumeUrl: "/r/u2" }) as any)));
    assert.ok(pctAfter > pctBefore, `Expected % to increase: ${pctBefore}% → ${pctAfter}%`);
  });

  it("(d) deleting a resume decreases the completion percentage", () => {
    const pctBefore = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(makeCandidate({ resumeUrl: "/r/u3" }) as any)));
    const pctAfter  = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(makeCandidate({ resumeUrl: null }) as any)));
    assert.ok(pctAfter < pctBefore, `Expected % to decrease: ${pctBefore}% → ${pctAfter}%`);
  });

  it("(e) resume contributes exactly 1/N to the percentage", () => {
    const fullItems = buildCompletionItems(profileStrengthFromCandidate(makeCandidate() as any));
    const N = fullItems.length;
    const pctWith    = calcCompletionPct(fullItems);
    const pctWithout = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(makeCandidate({ resumeUrl: null }) as any)));
    assert.equal(pctWith,    100,                              "Full profile should be 100%");
    assert.equal(pctWithout, Math.round(((N - 1) / N) * 100), `Without resume should be ${Math.round(((N - 1) / N) * 100)}%`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Production route handlers, mocked deps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a test HTTP server mounting the REAL production handlers with the given
 * injectable deps.  Wraps in an http.Server listening on a random port.
 */
function buildServer(deps: CandidateMediaDeps): Promise<http.Server> {
  return new Promise((resolve) => {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });
    registerCandidateMediaRoutes(app, upload, deps);
    const srv = http.createServer(app);
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function stopServer(srv: http.Server): Promise<void> {
  return new Promise((resolve) => srv.close(() => resolve()));
}

/** Minimal mock deps — override individual fields per test as needed. */
function baseDeps(overrides: Partial<CandidateMediaDeps> = {}): CandidateMediaDeps {
  return {
    jwtSecret: SECRET,
    // DB query: by default return a row for CANDIDATE_ID so DELETE routes find it
    dbQuery: async (_sql, _params) => ({ rows: [{ resumeUrl: null, videoIntroUrl: null }] }),
    updateCandidate: async (_id, _updates) => ({}),
    saveToStorage: async (_subdir, _buf, _mime, _name) => `/objects/test-storage/${Date.now()}`,
    deleteFromStorage: async (_url) => {},
    ...overrides,
  };
}

/** Helper: make a multipart/form-data POST request using Node's built-in http module. */
function multipartPost(
  srv: http.Server,
  path: string,
  authHeader: string,
  fieldName: string,
  fileName: string,
  mimeType: string,
  content: Buffer,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const boundary = "----TestBound" + Math.random().toString(16).slice(2);
    const CRLF = "\r\n";
    const head = `--${boundary}${CRLF}Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`;
    const tail = `${CRLF}--${boundary}--${CRLF}`;
    const body = Buffer.concat([Buffer.from(head), content, Buffer.from(tail)]);

    const addr = srv.address() as { port: number };
    const req = http.request({
      hostname: "127.0.0.1", port: addr.port, path, method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode!, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode!, body: raw }); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** Helper: make a DELETE request. */
function del(
  srv: http.Server,
  path: string,
  authHeader: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = srv.address() as { port: number };
    const req = http.request({
      hostname: "127.0.0.1", port: addr.port, path, method: "DELETE",
      headers: { Authorization: authHeader },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode!, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode!, body: raw }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const PDF = Buffer.from("%PDF-1.4 fake content");
const VIDEO = Buffer.from("fake-video-bytes");

describe("Production route handlers — real handlers, mocked deps", () => {
  // ── (a) POST /resume — mismatched JWT → 403 ─────────────────────────────────
  it("(a) POST /resume with mismatched candidate JWT → 403", async () => {
    const srv = await buildServer(baseDeps());
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeCandidateToken("cand-DIFFERENT")}`,
        "resume", "cv.pdf", "application/pdf", PDF,
      );
      assert.equal(status, 403, `body: ${JSON.stringify(body)}`);
      assert.ok(body.error, "Must include error field");
    } finally { await stopServer(srv); }
  });

  // ── (b) POST /resume — storage failure → 500 ────────────────────────────────
  it("(b) POST /resume with valid token but storage failure → 500 + clear error", async () => {
    const srv = await buildServer(baseDeps({
      saveToStorage: async () => { throw new Error("Storage unavailable: simulated failure"); },
    }));
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
        "resume", "cv.pdf", "application/pdf", PDF,
      );
      assert.equal(status, 500, `body: ${JSON.stringify(body)}`);
      assert.ok(typeof body.error === "string" && body.error.length > 0,
        `body.error must be non-empty string; got: ${JSON.stringify(body)}`);
      assert.ok(!body.error.includes("at Object."),
        "Error message must not expose a stack trace");
    } finally { await stopServer(srv); }
  });

  // ── (c) POST /resume — success → 200 + DB updated ──────────────────────────
  it("(c) POST /resume — success → 200, resumeUrl and resumeFileName returned", async () => {
    const updates: Record<string, any>[] = [];
    const srv = await buildServer(baseDeps({
      updateCandidate: async (_id, u) => { updates.push(u); return {}; },
    }));
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
        "resume", "mycv.pdf", "application/pdf", PDF,
      );
      assert.equal(status, 200, `body: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(typeof body.resumeUrl === "string" && body.resumeUrl.length > 0,
        "Response must include resumeUrl");
      assert.equal(body.resumeFileName, "mycv.pdf");
      // Verify persistence was called with correct fields
      assert.equal(updates.length, 1, "updateCandidate must be called exactly once");
      assert.ok(updates[0].resumeUrl, "resumeUrl must be persisted");
      assert.equal(updates[0].resumeFileName, "mycv.pdf");
    } finally { await stopServer(srv); }
  });

  // ── (d) DELETE /resume — success → 200 + DB cleared ────────────────────────
  it("(d) DELETE /resume — success → 200, DB fields cleared to null", async () => {
    const updates: Record<string, any>[] = [];
    const srv = await buildServer(baseDeps({
      dbQuery: async () => ({ rows: [{ resumeUrl: "/objects/candidate-resumes/old-id" }] }),
      updateCandidate: async (_id, u) => { updates.push(u); return {}; },
    }));
    try {
      const { status, body } = await del(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
      );
      assert.equal(status, 200, `body: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.equal(updates.length, 1);
      assert.equal(updates[0].resumeUrl,     null, "resumeUrl must be cleared to null");
      assert.equal(updates[0].resumeFileName, null, "resumeFileName must be cleared to null");
    } finally { await stopServer(srv); }
  });

  // ── (e) DELETE /resume — storage delete error is non-fatal ──────────────────
  it("(e) DELETE /resume — storage error is non-fatal, still returns 200", async () => {
    const updates: Record<string, any>[] = [];
    const srv = await buildServer(baseDeps({
      dbQuery: async () => ({ rows: [{ resumeUrl: "/objects/candidate-resumes/old-id" }] }),
      updateCandidate: async (_id, u) => { updates.push(u); return {}; },
      deleteFromStorage: async () => { throw new Error("Object store offline"); },
    }));
    try {
      const { status, body } = await del(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
      );
      // Non-fatal: DB record must still be cleared even when object delete fails
      assert.equal(status, 200, `Expected 200 even on storage delete error; body: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.equal(updates.length, 1, "updateCandidate must still be called");
      assert.equal(updates[0].resumeUrl, null);
    } finally { await stopServer(srv); }
  });

  // ── (f) POST /video — mismatched JWT → 403 ──────────────────────────────────
  it("(f) POST /video with mismatched candidate JWT → 403", async () => {
    const srv = await buildServer(baseDeps());
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/video`,
        `Bearer ${makeCandidateToken("cand-DIFFERENT")}`,
        "video", "intro.mp4", "video/mp4", VIDEO,
      );
      assert.equal(status, 403, `body: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    } finally { await stopServer(srv); }
  });

  // ── (g) POST /video — storage failure → 500 ─────────────────────────────────
  it("(g) POST /video with valid token but storage failure → 500 + clear error", async () => {
    const srv = await buildServer(baseDeps({
      saveToStorage: async () => { throw new Error("Storage unavailable: simulated failure"); },
    }));
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/video`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
        "video", "intro.webm", "video/webm", VIDEO,
      );
      assert.equal(status, 500, `body: ${JSON.stringify(body)}`);
      assert.ok(typeof body.error === "string" && body.error.length > 0);
      assert.ok(!body.error.includes("at Object."), "Error must not expose stack trace");
    } finally { await stopServer(srv); }
  });

  // ── (h) POST /video — success → 200 + DB updated ────────────────────────────
  it("(h) POST /video — success → 200, videoIntroUrl and videoIntroFileName returned", async () => {
    const updates: Record<string, any>[] = [];
    const srv = await buildServer(baseDeps({
      updateCandidate: async (_id, u) => { updates.push(u); return {}; },
    }));
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/video`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
        "video", "intro.webm", "video/webm", VIDEO,
      );
      assert.equal(status, 200, `body: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(typeof body.videoIntroUrl === "string" && body.videoIntroUrl.length > 0,
        "Response must include videoIntroUrl");
      assert.equal(body.videoIntroFileName, "intro.webm");
      assert.equal(updates.length, 1, "updateCandidate must be called exactly once");
      assert.ok(updates[0].videoIntroUrl, "videoIntroUrl must be persisted");
      assert.equal(updates[0].videoIntroFileName, "intro.webm");
    } finally { await stopServer(srv); }
  });

  // ── (i) DELETE /video — success → 200 + DB cleared ──────────────────────────
  it("(i) DELETE /video — success → 200, DB fields cleared to null", async () => {
    const updates: Record<string, any>[] = [];
    const srv = await buildServer(baseDeps({
      dbQuery: async () => ({ rows: [{ videoIntroUrl: "/objects/candidate-videos/old-id" }] }),
      updateCandidate: async (_id, u) => { updates.push(u); return {}; },
    }));
    try {
      const { status, body } = await del(
        srv, `/api/candidates/${CANDIDATE_ID}/video`,
        `Bearer ${makeCandidateToken(CANDIDATE_ID)}`,
      );
      assert.equal(status, 200, `body: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.equal(updates.length, 1);
      assert.equal(updates[0].videoIntroUrl,      null, "videoIntroUrl must be cleared to null");
      assert.equal(updates[0].videoIntroFileName,  null, "videoIntroFileName must be cleared to null");
    } finally { await stopServer(srv); }
  });

  // ── (j) Talent-role JWT with matching DB email → 200 ────────────────────────
  it("(j) Talent-role JWT with matching DB email → 200 (DB check is exercised)", async () => {
    const talentEmail = "talent@example.com";
    const updates: Record<string, any>[] = [];
    const srv = await buildServer(baseDeps({
      // DB returns a row → email matches → authorized
      dbQuery: async (_sql, params) => {
        // Auth check: params[0] = candidateId, params[1] = email
        if (params[1]) return { rows: [{ id: CANDIDATE_ID }] };
        return { rows: [] };
      },
      updateCandidate: async (_id, u) => { updates.push(u); return {}; },
    }));
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeTalentToken(talentEmail)}`,
        "resume", "cv.pdf", "application/pdf", PDF,
      );
      assert.equal(status, 200, `body: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
    } finally { await stopServer(srv); }
  });

  // ── (k) Talent-role JWT with non-matching email → 403 ───────────────────────
  it("(k) Talent-role JWT with non-matching email → 403 (DB check returns no rows)", async () => {
    const srv = await buildServer(baseDeps({
      // DB returns no rows → email does not match → not authorized
      dbQuery: async () => ({ rows: [] }),
    }));
    try {
      const { status, body } = await multipartPost(
        srv, `/api/candidates/${CANDIDATE_ID}/resume`,
        `Bearer ${makeTalentToken("other@example.com")}`,
        "resume", "cv.pdf", "application/pdf", PDF,
      );
      assert.equal(status, 403, `body: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    } finally { await stopServer(srv); }
  });
});
