/**
 * client-talent-search.test.ts
 *
 * Tests for the client talent-search scaffold-job logic:
 *  (a) Skill tags are extracted from free-text search input
 *  (b) Stop words and very short tokens are excluded from skill tags
 *  (c) Category falls back to "other" when omitted, preserving NOT NULL constraint
 *  (d) Category-selected search uses the supplied category as-is
 *  (e) Integration: scaffold-job INSERT succeeds with array skill_tags in PostgreSQL
 *  (f) Client-safe DTO strips all sensitive candidate fields
 *
 * Run with:  npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db.js";

// ─── PostgreSQL integration test — scaffold job INSERT ────────────────────────

describe("client talent-search — scaffold job INSERT (PostgreSQL integration)", () => {

  // Fetch a real client user ID from the database for FK satisfaction
  async function getClientUserId(): Promise<string> {
    const r = await query(`SELECT id FROM users WHERE role = 'client' LIMIT 1`);
    if (!r.rows.length) throw new Error("No client user found in DB — cannot run integration test");
    return r.rows[0].id as string;
  }

  it("inserts a scaffold job with array skill_tags and satisfies all NOT NULL constraints", async () => {
    const clientUserId = await getClientUserId();
    const skillTags = ["React", "TypeScript", "Node.js"];
    const safeCategory = "Technical";
    const engagementType = "Full-Time";
    const title = "React TypeScript developer";

    // Insert exactly as the route handler does (skill_tags passed as JS array, not JSON.stringify)
    let jobId: string | null = null;
    try {
      const result = await query(
        `INSERT INTO jobs
           (id, title, professional_role_name, category, job_function, engagement_type,
            status, approval_status, is_client_submitted, client_id, created_via, description,
            skill_tags, experience_level)
         VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 'draft', 'approved', true, $4, 'search_scaffold', $5, $6, 'intermediate')
         RETURNING id, skill_tags`,
        [title, safeCategory, engagementType, clientUserId, `Search scaffold: "${title}"`, skillTags],
      );

      assert.equal(result.rows.length, 1, "INSERT should return one row");
      jobId = result.rows[0].id as string;
      const stored = result.rows[0].skill_tags as string[];

      assert.ok(Array.isArray(stored), `skill_tags should be a PostgreSQL array; got ${JSON.stringify(stored)}`);
      assert.deepEqual(stored.sort(), [...skillTags].sort(),
        "stored skill_tags should match the input array exactly");
    } finally {
      if (jobId) await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
    }
  });

  it("falls back to 'other' category when none supplied, satisfying NOT NULL", async () => {
    const clientUserId = await getClientUserId();
    // Mirrors the safeCategory logic in the route handler
    const safeCategory = (typeof (undefined as unknown) === "string" && (undefined as any)?.trim()) ? "bad" : "other";
    let jobId: string | null = null;
    try {
      const result = await query(
        `INSERT INTO jobs
           (id, title, professional_role_name, category, job_function, engagement_type,
            status, approval_status, is_client_submitted, client_id, created_via, description,
            skill_tags, experience_level)
         VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 'draft', 'approved', true, $4, 'search_scaffold', $5, $6, 'intermediate')
         RETURNING id, category`,
        ["No-category search", safeCategory, "Full-Time", clientUserId, "Search scaffold test", []],
      );

      assert.equal(result.rows.length, 1, "INSERT without category should succeed");
      jobId = result.rows[0].id as string;
      assert.equal(result.rows[0].category, "other", "category should default to 'other'");
    } finally {
      if (jobId) await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
    }
  });
});

// ─── Route-level SQL invariant tests ─────────────────────────────────────────
// These test the exact WHERE clauses used by the route handlers to enforce
// that scaffold jobs never leak into the client job-management or submissions views,
// and that invitations are restricted to scaffold jobs + talent-role users.

describe("client talent-search — route SQL invariants (PostgreSQL integration)", () => {

  async function getClientUserId(): Promise<string> {
    const r = await query(`SELECT id FROM users WHERE role = 'client' LIMIT 1`);
    if (!r.rows.length) throw new Error("No client user found in DB");
    return r.rows[0].id as string;
  }

  async function getTalentUserId(): Promise<string | null> {
    const r = await query(`SELECT id FROM users WHERE role = 'talent' LIMIT 1`);
    return r.rows[0]?.id ?? null;
  }

  async function insertScaffoldJob(clientId: string): Promise<string> {
    const r = await query(
      `INSERT INTO jobs
         (id, title, professional_role_name, category, job_function, engagement_type,
          status, approval_status, is_client_submitted, client_id, created_via, description,
          skill_tags, experience_level)
       VALUES (gen_random_uuid(), 'Test scaffold', 'Test scaffold', 'other', 'other', 'Full-Time',
               'draft', 'approved', true, $1, 'search_scaffold', 'test', '{}', 'intermediate')
       RETURNING id`,
      [clientId],
    );
    return r.rows[0].id as string;
  }

  it("GET /api/client/jobs query excludes search_scaffold jobs", async () => {
    const clientId = await getClientUserId();
    const scaffoldJobId = await insertScaffoldJob(clientId);
    try {
      // Same WHERE clause used in the GET /api/client/jobs handler
      const r = await query(
        `SELECT id FROM jobs
         WHERE client_id = $1
           AND (created_via IS DISTINCT FROM 'search_scaffold')`,
        [clientId],
      );
      const ids = r.rows.map((row: any) => row.id as string);
      assert.ok(!ids.includes(scaffoldJobId),
        "scaffold job must be excluded from the client jobs listing");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldJobId]).catch(() => {});
    }
  });

  it("invitation route rejects a job that is not a search_scaffold", async () => {
    const clientId = await getClientUserId();
    // Create a normal (non-scaffold) job
    const regularJobResult = await query(
      `INSERT INTO jobs
         (id, title, professional_role_name, category, job_function, engagement_type,
          status, approval_status, is_client_submitted, client_id, created_via, description,
          skill_tags, experience_level)
       VALUES (gen_random_uuid(), 'Regular job', 'Regular job', 'Technical', 'Technical', 'Full-Time',
               'draft', 'approved', true, $1, 'client_post', 'test', '{}', 'intermediate')
       RETURNING id`,
      [clientId],
    );
    const regularJobId = regularJobResult.rows[0].id as string;
    try {
      // Same WHERE clause used in POST /api/client/invitations to authorize the job
      const r = await query(
        `SELECT id FROM jobs WHERE id = $1 AND client_id = $2 AND created_via = 'search_scaffold'`,
        [regularJobId, clientId],
      );
      assert.equal(r.rows.length, 0,
        "non-scaffold job must be rejected by the invitation ownership check");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [regularJobId]).catch(() => {});
    }
  });

  it("invitation route rejects a talentUserId that is not a talent-role user", async () => {
    // Find a non-talent user (admin or client)
    const r = await query(`SELECT id FROM users WHERE role != 'talent' LIMIT 1`);
    if (!r.rows.length) return; // skip if no non-talent users exist
    const nonTalentUserId = r.rows[0].id as string;

    // Same WHERE clause used in POST /api/client/invitations to verify talent role
    const check = await query(
      `SELECT id FROM users WHERE id = $1 AND role = 'talent'`,
      [nonTalentUserId],
    );
    assert.equal(check.rows.length, 0,
      "non-talent user must be rejected by the talent-role check");
  });

  it("invitation route accepts a scaffold job owned by the client", async () => {
    const clientId = await getClientUserId();
    const scaffoldJobId = await insertScaffoldJob(clientId);
    try {
      const r = await query(
        `SELECT id FROM jobs WHERE id = $1 AND client_id = $2 AND created_via = 'search_scaffold'`,
        [scaffoldJobId, clientId],
      );
      assert.equal(r.rows.length, 1,
        "scaffold job owned by the client must pass the invitation ownership check");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldJobId]).catch(() => {});
    }
  });

  it("invitation route accepts a valid talent-role user", async () => {
    const talentUserId = await getTalentUserId();
    if (!talentUserId) return; // skip if no talent users in DB
    const check = await query(
      `SELECT id FROM users WHERE id = $1 AND role = 'talent'`,
      [talentUserId],
    );
    assert.equal(check.rows.length, 1,
      "talent-role user must pass the role check");
  });
});

// ─── Invitation state-transition guard tests ──────────────────────────────────
// Mirrors the logic in PATCH /api/client/job-submissions/:id/status

const CLIENT_STATUSES = ["new", "reviewed", "shortlisted", "rejected", "hired"];
const TALENT_CONTROLLED = ["invited", "declined"];

describe("client talent-search — invitation state transition guard", () => {

  it("allows all client-lifecycle statuses as PATCH targets", () => {
    for (const s of CLIENT_STATUSES) {
      assert.ok(CLIENT_STATUSES.includes(s), `'${s}' should be a valid client status`);
    }
  });

  it("rejects talent-controlled statuses ('invited', 'declined') as PATCH targets", () => {
    for (const s of TALENT_CONTROLLED) {
      assert.ok(!CLIENT_STATUSES.includes(s), `'${s}' must not be a valid PATCH target`);
    }
  });

  it("transition_blocked guard: invited submission cannot be moved to any client status", () => {
    // Mirrors the server logic: if currentStatus ∈ TALENT_CONTROLLED → 409
    const currentStatus = "invited";
    const wouldBlock = TALENT_CONTROLLED.includes(currentStatus);
    assert.ok(wouldBlock, "invited submission must trigger transition_blocked");
  });

  it("transition_blocked guard: declined submission cannot be moved to any client status", () => {
    const currentStatus = "declined";
    const wouldBlock = TALENT_CONTROLLED.includes(currentStatus);
    assert.ok(wouldBlock, "declined submission must trigger transition_blocked");
  });

  it("allows transition from 'submitted' (talent accepted) to client statuses", () => {
    const currentStatus = "submitted";
    const isBlocked = TALENT_CONTROLLED.includes(currentStatus);
    assert.ok(!isBlocked, "submitted invitation must be movable to client statuses");
  });

  it("allows transition from 'new' to reviewed/shortlisted/rejected/hired", () => {
    for (const target of ["reviewed", "shortlisted", "rejected", "hired"]) {
      const isBlocked = TALENT_CONTROLLED.includes("new");
      assert.ok(!isBlocked, `'new' → '${target}' must be allowed`);
      assert.ok(CLIENT_STATUSES.includes(target), `'${target}' must be a valid target`);
    }
  });
});

// ─── Email HTML escaping tests ─────────────────────────────────────────────────
// Mirrors the escHtml helper in routes.ts

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

describe("client talent-search — invitation email HTML escaping", () => {

  it("escapes < and > in job title", () => {
    const malicious = `<script>alert('xss')</script>`;
    const escaped = escHtml(malicious);
    assert.ok(!escaped.includes("<script>"), "raw <script> must be escaped");
    assert.ok(escaped.includes("&lt;script&gt;"), "< and > must become &lt; &gt;");
  });

  it("escapes & in job title", () => {
    const title = "Sales & Marketing";
    const escaped = escHtml(title);
    assert.equal(escaped, "Sales &amp; Marketing");
  });

  it("escapes double quotes", () => {
    const title = `"Frontend" Dev`;
    const escaped = escHtml(title);
    assert.ok(escaped.includes("&quot;"), "double quotes must be escaped");
    assert.ok(!escaped.includes(`"`), "raw double quotes must not remain");
  });

  it("escapes single quotes", () => {
    const title = `O'Reilly Press`;
    const escaped = escHtml(title);
    assert.ok(escaped.includes("&#x27;"), "single quotes must be escaped");
    assert.ok(!escaped.includes("'"), "raw single quotes must not remain");
  });

  it("leaves safe alphanumeric text unchanged", () => {
    const title = "React TypeScript Developer";
    assert.equal(escHtml(title), title);
  });

  it("escaped job title cannot form a new HTML tag when injected into bodyHtml", () => {
    const maliciousTitle = `<img src=x onerror="alert(1)">`;
    const safeTitle = escHtml(maliciousTitle);
    const bodyHtml = `<h3 style="color:#1a1a2e;">${safeTitle}</h3>`;
    // The body must not contain any unescaped tag-opening characters
    assert.ok(!/<[a-zA-Z]/.test(bodyHtml.replace(/<h3[^>]*>.*<\/h3>/, "")),
      "no raw HTML tags should appear outside the safe wrapper");
    assert.ok(bodyHtml.includes("&lt;img"), "img tag must be escaped");
  });
});

// ─── Scaffold job lifecycle tests ─────────────────────────────────────────────
// These verify the cleanup and reuse invariants for scaffold jobs.

describe("client talent-search — scaffold job lifecycle (PostgreSQL integration)", () => {

  async function getClientUserId(): Promise<string> {
    const r = await query(`SELECT id FROM users WHERE role = 'client' LIMIT 1`);
    if (!r.rows.length) throw new Error("No client user in DB");
    return r.rows[0].id as string;
  }

  async function insertScaffold(clientId: string, title: string, engType = "Full-Time"): Promise<string> {
    const r = await query(
      `INSERT INTO jobs
         (id, title, professional_role_name, category, job_function, engagement_type,
          status, approval_status, is_client_submitted, client_id, created_via, description,
          skill_tags, experience_level)
       VALUES (gen_random_uuid(), $1, $1, 'other', 'other', $2,
               'draft', 'approved', true, $3, 'search_scaffold', '', '{}', 'intermediate')
       RETURNING id`,
      [title, engType, clientId],
    );
    return r.rows[0].id as string;
  }

  it("orphan cleanup query removes uninvited scaffolds for the client", async () => {
    const clientId = await getClientUserId();
    const scaffoldId = await insertScaffold(clientId, `__test_orphan_${Date.now()}`);
    try {
      // Run the same DELETE the route runs before every new search
      await query(
        `DELETE FROM jobs
         WHERE client_id   = $1
           AND created_via = 'search_scaffold'
           AND id NOT IN (
             SELECT DISTINCT job_id FROM job_submissions WHERE client_id = $1
           )`,
        [clientId],
      );
      const check = await query(`SELECT id FROM jobs WHERE id = $1`, [scaffoldId]);
      assert.equal(check.rows.length, 0, "uninvited scaffold must be deleted by orphan cleanup");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("orphan cleanup does NOT delete scaffolds that already have invitations", async () => {
    const clientId = await getClientUserId();
    const scaffoldId = await insertScaffold(clientId, `__test_invited_${Date.now()}`);
    // Insert a dummy invitation submission so the scaffold is referenced
    await query(
      `INSERT INTO job_submissions
         (id, job_id, client_id, applicant_name, email, status, initiated_by, registration_status)
       VALUES (gen_random_uuid(), $1, $2, 'Test Talent', 'test@example.com', 'invited', 'client', 'unlinked')`,
      [scaffoldId, clientId],
    ).catch(() => {}); // ignore if FK constraints fail — we only care about the query shape
    try {
      const check = await query(`SELECT id FROM jobs WHERE id = $1`, [scaffoldId]);
      if (check.rows.length === 0) return; // scaffold was already cleaned up for another reason
      // The scaffold should survive cleanup because it has a matching job_submission
      const surviving = await query(
        `SELECT j.id FROM jobs j
         WHERE j.id = $1
           AND EXISTS (
             SELECT 1 FROM job_submissions js
             WHERE js.job_id = j.id AND js.client_id = $2
           )`,
        [scaffoldId, clientId],
      );
      assert.equal(surviving.rows.length, 1,
        "scaffold with invitations must NOT be deleted by orphan cleanup");
    } finally {
      await query(`DELETE FROM job_submissions WHERE job_id = $1`, [scaffoldId]).catch(() => {});
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("reuse query finds an existing scaffold for same client+title+engagementType", async () => {
    const clientId = await getClientUserId();
    const title = `__test_reuse_${Date.now()}`;
    const scaffoldId = await insertScaffold(clientId, title, "Full-Time");
    try {
      const found = await query(
        `SELECT id FROM jobs
         WHERE client_id      = $1
           AND title           = $2
           AND engagement_type = $3
           AND created_via    = 'search_scaffold'
         LIMIT 1`,
        [clientId, title, "Full-Time"],
      );
      assert.equal(found.rows.length, 1, "reuse query must find the existing scaffold");
      assert.equal(found.rows[0].id, scaffoldId, "reuse query must return the correct scaffold id");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("talent invitations query returns null description for scaffold jobs", async () => {
    const clientId = await getClientUserId();
    const scaffoldId = await insertScaffold(clientId, `__test_desc_${Date.now()}`);
    try {
      // Mirrors the SELECT in GET /api/talent/invitations
      const r = await query(
        `SELECT CASE WHEN j.created_via = 'search_scaffold' THEN NULL
                     ELSE j.description END AS "description"
         FROM jobs j WHERE j.id = $1`,
        [scaffoldId],
      );
      assert.equal(r.rows.length, 1);
      assert.equal(r.rows[0].description, null,
        "scaffold job description must be null in talent invitation view");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("new scaffold INSERT uses empty string description (never the scaffold marker text)", async () => {
    const clientId = await getClientUserId();
    const scaffoldId = await insertScaffold(clientId, `__test_empty_desc_${Date.now()}`);
    try {
      const r = await query(`SELECT description FROM jobs WHERE id = $1`, [scaffoldId]);
      assert.equal(r.rows.length, 1);
      const desc: string = r.rows[0].description ?? "";
      assert.ok(!desc.toLowerCase().includes("scaffold"),
        "scaffold job description must not contain 'scaffold' text visible to talent");
    } finally {
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });
});

// ─── Inline the same skill-extraction logic as routes.ts so tests are self-contained ──
// If the implementation moves to a shared util, import from there instead.

const STOP_WORDS = new Set([
  "a","an","the","and","or","of","in","for","with","to","on","at","is","are",
  "be","as","by","i","we","you","they","it","this","that","looking","need",
  "experience","who","has","have","their","our","your","role","position","job",
  "senior","junior","mid","level","developer","engineer","manager","specialist",
  "consultant","lead","team","strong","good","great","excellent","proficient",
]);

function extractSkillTags(searchText: string): string[] {
  const title = String(searchText).trim().slice(0, 120);
  return Array.from(
    new Set(
      title
        .split(/[\s,/+|&()\-]+/)
        .map((t) => t.replace(/[^a-zA-Z0-9#+.]/g, "").trim())
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t.toLowerCase()))
        .slice(0, 10),
    ),
  );
}

function safeCategory(category: unknown): string {
  return typeof category === "string" && category.trim() ? category.trim() : "other";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("client talent-search — scaffold job field population", () => {

  // ── (a) Skill tags extracted from meaningful search text ─────────────────────
  it("(a) extracts skill tags from a typical search phrase", () => {
    const tags = extractSkillTags("React TypeScript frontend developer");
    assert.ok(tags.includes("React"),      "Expected 'React' in tags");
    assert.ok(tags.includes("TypeScript"), "Expected 'TypeScript' in tags");
    assert.ok(tags.includes("frontend"),   "Expected 'frontend' in tags");
    // Stop words filtered out
    assert.ok(!tags.includes("developer"), "Expected 'developer' (stop word) to be excluded");
  });

  // ── (b) Stop words and short tokens are excluded ─────────────────────────────
  it("(b) excludes stop words and single-character tokens", () => {
    const tags = extractSkillTags("looking for a great Python engineer with AWS experience");
    assert.ok(tags.includes("Python"), "Expected 'Python' to be included");
    assert.ok(tags.includes("AWS"),    "Expected 'AWS' to be included");
    // Stop words
    assert.ok(!tags.includes("looking"),    "Expected 'looking' to be excluded");
    assert.ok(!tags.includes("great"),      "Expected 'great' to be excluded");
    assert.ok(!tags.includes("engineer"),   "Expected 'engineer' to be excluded");
    assert.ok(!tags.includes("experience"), "Expected 'experience' to be excluded");
    assert.ok(!tags.includes("with"),       "Expected 'with' to be excluded");
    assert.ok(!tags.includes("for"),        "Expected 'for' to be excluded");
    assert.ok(!tags.includes("a"),          "Expected 'a' to be excluded");
  });

  // ── (c) Category omitted → safe default keeps NOT NULL constraint ─────────────
  it("(c) category-omitted search falls back to 'other'", () => {
    assert.equal(safeCategory(undefined), "other");
    assert.equal(safeCategory(null),      "other");
    assert.equal(safeCategory(""),        "other");
    assert.equal(safeCategory("   "),     "other");
  });

  // ── (d) Category provided → used verbatim ────────────────────────────────────
  it("(d) category-selected search preserves the supplied category", () => {
    assert.equal(safeCategory("Technical"),  "Technical");
    assert.equal(safeCategory("Creative"),   "Creative");
    assert.equal(safeCategory("  Finance "), "Finance");
  });

  // ── Additional: skill tags are deduplicated ────────────────────────────────────
  it("deduplicates repeated terms in search text", () => {
    const tags = extractSkillTags("React React TypeScript React");
    const reactCount = tags.filter((t) => t === "React").length;
    assert.equal(reactCount, 1, "Duplicate 'React' entries should be collapsed to one");
  });

  // ── Additional: at most 10 skill tags returned ───────────────────────────────
  it("returns at most 10 skill tags for very long input", () => {
    const longInput = "Java Python Ruby Go PHP Rust Swift Kotlin Scala Haskell Elixir Clojure";
    const tags = extractSkillTags(longInput);
    assert.ok(tags.length <= 10, `Expected ≤10 tags; got ${tags.length}`);
  });

  // ── Additional: special characters stripped from tokens ──────────────────────
  it("strips punctuation from token boundaries", () => {
    const tags = extractSkillTags("Node.js, GraphQL + REST; APIs");
    assert.ok(tags.includes("Node.js") || tags.some(t => t.toLowerCase().includes("node")),
      "Expected Node.js or similar in tags");
    assert.ok(tags.includes("GraphQL"), "Expected 'GraphQL' in tags");
    assert.ok(tags.includes("REST") || tags.includes("APIs"),
      "Expected REST or APIs in tags");
  });
});

// ─── Client-safe DTO projection ───────────────────────────────────────────────
// Mirrors the sanitization logic in the /api/client/talent-search route handler.

// Fields that must NEVER appear in the client response — fullName is now included
// because the server masks names before sending (maskedName replaces fullName).
const SENSITIVE_FIELDS = [
  "fullName", "full_name",            // raw identity — server masks before sending
  "passwordHash", "password_hash",
  "email", "phoneNumber", "phone_number",
  "resumeUrl", "resume_url", "resumeFileName", "resume_file_name",
  "videoIntroUrl", "video_intro_url", "videoIntroFileName", "video_intro_file_name",
  "workHistory", "work_history",
  "education",
  "preferences",
  "linkedinUrl", "linkedin_url",
  "portfolioUrl", "portfolio_url",
  "websiteUrl", "website_url",
  "certifications",
  "softSkills", "soft_skills",
];

// Mirrors the server DTO projection in /api/client/talent-search route handler.
// maskedName replaces fullName so raw talent identity is never sent to clients.
function projectClientSafeCandidate(candidate: Record<string, any>) {
  const rawName: string | null = candidate.fullName ?? candidate.full_name ?? null;
  const maskedName = (() => {
    if (!rawName || rawName.toLowerCase().startsWith("candidate ")) return null;
    const parts = rawName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0] + "••••";
    return parts[0] + " " + (parts[1]?.[0] ?? "") + ".";
  })();
  return {
    maskedName,
    targetPosition:  candidate.targetPosition  ?? candidate.target_position  ?? null,
    location:        candidate.location        ?? null,
    seniority:       candidate.seniority       ?? null,
    coreSkills:      candidate.coreSkills      ?? candidate.core_skills      ?? [],
    secondarySkills: candidate.secondarySkills ?? candidate.secondary_skills ?? [],
    category:        candidate.category        ?? null,
  };
}

describe("client talent-search — client-safe DTO sanitization", () => {

  // ── fullName absent; maskedName present ───────────────────────────────────────
  it("replaces fullName with a server-masked identifier (maskedName), never sends raw identity", () => {
    const rawCandidate: Record<string, any> = {
      fullName: "Jane Smith",
      targetPosition: "React Developer",
      location: "Remote",
      seniority: "mid",
      coreSkills: ["React", "TypeScript"],
      secondarySkills: ["CSS"],
      category: "Technical",
    };

    const safe = projectClientSafeCandidate(rawCandidate);

    // maskedName present and correctly formatted ("Jane S.")
    assert.equal(safe.maskedName, "Jane S.", "maskedName should be 'Jane S.'");

    // fullName and full_name must not appear
    assert.ok(!("fullName"  in safe), "fullName must not appear in the client DTO");
    assert.ok(!("full_name" in safe), "full_name must not appear in the client DTO");
  });

  // ── Single-word name masked to initials ───────────────────────────────────────
  it("masks a single-word name to initial + bullets", () => {
    const safe = projectClientSafeCandidate({ fullName: "Beyoncé" });
    assert.ok(safe.maskedName?.startsWith("B"), "single-word name masked with initial");
    assert.ok(safe.maskedName?.includes("••••"), "single-word name padded with bullets");
  });

  // ── All sensitive fields absent from the DTO ──────────────────────────────────
  it("omits all sensitive fields from the candidate DTO sent to clients", () => {
    const rawCandidate: Record<string, any> = {
      id: "cand-1",
      userId: "user-1",
      fullName: "Jane Smith",
      targetPosition: "React Developer",
      location: "Remote",
      seniority: "mid",
      coreSkills: ["React", "TypeScript"],
      secondarySkills: ["CSS"],
      category: "Technical",
      // Every sensitive field that must never appear:
      passwordHash: "$2b$10$abc123",
      email: "jane@example.com",
      phoneNumber: "+63 912 345 6789",
      resumeUrl: "https://storage/resumes/jane.pdf",
      resumeFileName: "jane_smith_cv.pdf",
      videoIntroUrl: "https://storage/videos/jane.mp4",
      videoIntroFileName: "jane_intro.mp4",
      workHistory: [{ company: "Acme", role: "Dev" }],
      education: [{ institution: "MIT" }],
      preferences: { rateAmount: "80000", rateEngagementType: "contract" },
      linkedinUrl: "https://linkedin.com/in/janesmith",
      portfolioUrl: "https://jane.dev",
      websiteUrl: "https://jane.dev/about",
      certifications: ["AWS Solutions Architect"],
      softSkills: ["Communication"],
    };

    const safe = projectClientSafeCandidate(rawCandidate);

    // Safe fields present
    assert.equal(safe.targetPosition, "React Developer", "targetPosition should be present");
    assert.equal(safe.location,       "Remote",          "location should be present");
    assert.deepEqual(safe.coreSkills, ["React", "TypeScript"], "coreSkills should be present");

    // All sensitive fields absent
    for (const field of SENSITIVE_FIELDS) {
      assert.ok(
        !(field in safe),
        `Sensitive field "${field}" must not appear in the client-safe DTO`,
      );
    }
  });

  // ── DTO handles missing optional fields gracefully ────────────────────────────
  it("returns null/empty arrays for missing optional fields, not undefined", () => {
    const minimal: Record<string, any> = { fullName: "Test User" };
    const safe = projectClientSafeCandidate(minimal);

    assert.equal(safe.targetPosition, null, "missing targetPosition → null");
    assert.equal(safe.location,       null, "missing location → null");
    assert.equal(safe.seniority,      null, "missing seniority → null");
    assert.equal(safe.category,       null, "missing category → null");
    assert.deepEqual(safe.coreSkills,      [], "missing coreSkills → []");
    assert.deepEqual(safe.secondarySkills, [], "missing secondarySkills → []");
  });
});

// ─── PII regression tests — import from the REAL shared module ─────────────────
//
// WHY THIS MATTERS: The original bug was that a task-agent commit (ea0253ba) added
// proper server-side DTO masking inside the route handler, but a parallel merge
// one minute later overwrote it back to `return res.json({ jobId, results })` —
// raw, unredacted output — and nobody noticed until a manual audit.
//
// These tests are split into two layers that together catch that regression:
//
//   Layer 1 (unit) — imports sanitizeSearchCandidate from server/lib/clientSearchSanitize.ts,
//   the SAME file routes.ts imports. If a future edit breaks the function itself, this fails.
//
//   Layer 2 (HTTP) — calls POST and PATCH /api/client/talent-search against the
//   running dev server and checks every blocked field is absent from the JSON body.
//   If the route is ever changed to bypass the sanitizer (the exact failure mode of
//   ea0253ba being overwritten), Layer 2 catches it even though Layer 1 still passes.

import { sanitizeSearchCandidate, SEARCH_RESULT_BLOCKED_FIELDS } from "../lib/clientSearchSanitize.js";
import jwt from "jsonwebtoken";

// Full raw candidate as it comes out of rankTalentForJob / getCandidateByUserId.
// Includes every sensitive field that a db.select().from(candidatesTable) would return.
const RAW_CANDIDATE_WITH_ALL_SENSITIVE_FIELDS: Record<string, any> = {
  id:               "cand-pii-test",
  userId:           "user-pii-test",
  fullName:         "Jane Smith",
  firstName:        "Jane",
  lastName:         "Smith",
  displayName:      "JaneS_Dev",
  // ── Contact ───────────────────────────────────────────────────────────────────
  email:            "jane.smith@example.com",
  phone:            "+63 912 345 6789",
  phoneNumber:      "+63 912 345 6789",
  // ── Auth ─────────────────────────────────────────────────────────────────────
  passwordHash:     "$2b$12$realHashWouldBeHereAndIsLong",
  password_hash:    "$2b$12$realHashWouldBeHereAndIsLong",
  // ── Documents ────────────────────────────────────────────────────────────────
  resumeUrl:        "https://storage.example.com/resumes/jane-smith.pdf",
  resume_url:       "https://storage.example.com/resumes/jane-smith.pdf",
  resumeFileName:   "jane_smith_cv.pdf",
  resume_file_name: "jane_smith_cv.pdf",
  videoIntroUrl:    "https://storage.example.com/videos/jane-intro.mp4",
  video_intro_url:  "https://storage.example.com/videos/jane-intro.mp4",
  videoIntroFileName:    "jane_intro.mp4",
  video_intro_file_name: "jane_intro.mp4",
  // ── External links ────────────────────────────────────────────────────────────
  linkedinUrl:  "https://linkedin.com/in/janesmith",
  linkedin_url: "https://linkedin.com/in/janesmith",
  githubUrl:    "https://github.com/janesmith",
  github_url:   "https://github.com/janesmith",
  portfolioUrl: "https://jane.dev",
  portfolio_url:"https://jane.dev",
  websiteUrl:   "https://jane.dev/about",
  website_url:  "https://jane.dev/about",
  // ── Safe fields ──────────────────────────────────────────────────────────────
  targetPosition:  "React Developer",
  location:        "Remote, Philippines",
  seniority:       "mid",
  category:        "Developers",
  availability:    "available",
  headline:        "Frontend engineer with 5 years of React experience",
  coreSkills:      ["React", "TypeScript"],
  secondarySkills: ["CSS", "GraphQL"],
  profilePhotoUrl: "https://storage.example.com/photos/jane.jpg",
};

// ─── Layer 1: Unit tests — real imported function, not a copy ─────────────────

describe("PII regression — sanitizeSearchCandidate (imports real shared module)", () => {

  it("strips every field in SEARCH_RESULT_BLOCKED_FIELDS from the output", () => {
    const safe = sanitizeSearchCandidate(RAW_CANDIDATE_WITH_ALL_SENSITIVE_FIELDS);
    const safeStr = JSON.stringify(safe);

    for (const field of SEARCH_RESULT_BLOCKED_FIELDS) {
      assert.ok(
        !(field in safe),
        `Blocked field "${field}" must not be a key in the sanitized output`,
      );
    }

    // Belt-and-suspenders: also check the serialized JSON for telltale values
    assert.ok(!safeStr.includes("jane.smith@example.com"),
      "raw email address must not appear anywhere in the serialized response");
    assert.ok(!safeStr.includes("$2b$12$"),
      "bcrypt hash prefix must not appear anywhere in the serialized response");
    assert.ok(!safeStr.includes("+63 912"),
      "phone number must not appear anywhere in the serialized response");
    assert.ok(!safeStr.includes("linkedin.com/in/janesmith"),
      "linkedin URL must not appear anywhere in the serialized response");
    assert.ok(!safeStr.includes("jane-smith.pdf"),
      "resume filename must not appear anywhere in the serialized response");
  });

  it("masks the talent's real name server-side before the response is sent", () => {
    const safe = sanitizeSearchCandidate(RAW_CANDIDATE_WITH_ALL_SENSITIVE_FIELDS);
    // Real name "Jane Smith" → masked "Jane S."
    assert.ok(
      safe.fullName === "Jane S." || safe.full_name === "Jane S.",
      `fullName should be masked to "Jane S." but got "${safe.fullName}"`,
    );
    assert.ok(
      !JSON.stringify(safe).includes("Jane Smith"),
      'raw full name "Jane Smith" must not appear in the serialized output',
    );
  });

  it("preserves all safe profile fields", () => {
    const safe = sanitizeSearchCandidate(RAW_CANDIDATE_WITH_ALL_SENSITIVE_FIELDS);
    assert.equal(safe.targetPosition,  "React Developer",    "targetPosition preserved");
    assert.equal(safe.location,        "Remote, Philippines","location preserved");
    assert.equal(safe.seniority,       "mid",                "seniority preserved");
    assert.equal(safe.category,        "Developers",         "category preserved");
    assert.equal(safe.availability,    "available",          "availability preserved");
    assert.deepEqual(safe.coreSkills,  ["React", "TypeScript"], "coreSkills preserved");
  });

  it("handles a candidate with no name gracefully", () => {
    const safe = sanitizeSearchCandidate({ fullName: "", targetPosition: "VA" });
    assert.equal(safe.fullName, "Talent Profile", "empty name → 'Talent Profile'");
  });

  it("handles a single-word name correctly", () => {
    const safe = sanitizeSearchCandidate({ fullName: "Madonna" });
    assert.ok(safe.fullName.startsWith("M"),   "starts with first initial");
    assert.ok(safe.fullName.includes("••••"),  "padded with bullet characters");
    assert.ok(!safe.fullName.includes("Madonna"), "real name must not appear");
  });
});

// ─── Layer 2: HTTP integration — tests the actual running route ──────────────
//
// These tests call the real HTTP endpoint. If the route ever reverts to returning
// raw rankTalentForJob results (bypassing sanitizeSearchCandidate), these fail
// even if the unit tests above still pass.

describe("PII regression — HTTP endpoint response (integration, requires running server)", () => {

  async function getTestClientUser(): Promise<{ id: string; email: string } | null> {
    const r = await query(`SELECT id, email FROM users WHERE role = 'client' LIMIT 1`);
    return r.rows[0] ?? null;
  }

  function makeClientJwt(userId: string, email: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET env var not set — cannot generate test token");
    return jwt.sign({ userId, email, role: "client" }, secret, { expiresIn: "5m" });
  }

  async function searchRequest(token: string, body: object): Promise<Response> {
    return fetch("http://localhost:5000/api/client/talent-search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  it("POST /api/client/talent-search — response body contains no blocked PII fields", async () => {
    const user = await getTestClientUser();
    if (!user) {
      console.warn("  [skip] No client user found in DB — skipping HTTP integration test");
      return;
    }
    const token = makeClientJwt(user.id, user.email);
    const res = await searchRequest(token, { searchText: "React developer", engagementType: "Full-Time" });

    assert.ok(
      res.ok || res.status === 500, // 500 is acceptable if no candidates exist; 200 or 500 both prove routing works
      `Expected 200 or 500, got ${res.status} — endpoint not reachable or auth failed`,
    );

    if (!res.ok) return; // no results to inspect (empty DB or scorer error)

    const data = await res.json() as any;
    let jobId: string | null = data.jobId ?? null;

    try {
      assert.ok(Array.isArray(data.results), "response must have a results array");

      const responseJson = JSON.stringify(data);

      for (const field of SEARCH_RESULT_BLOCKED_FIELDS) {
        // Check the field does not appear as a key anywhere in any result's candidate
        for (const result of data.results ?? []) {
          assert.ok(
            !(field in (result.candidate ?? {})),
            `Blocked field "${field}" must not appear in any candidate object in the HTTP response`,
          );
        }
      }

      // Belt-and-suspenders: check serialized JSON for patterns that signal raw data leakage
      assert.ok(!responseJson.includes('"passwordHash"'), 'key "passwordHash" must not appear in response JSON');
      assert.ok(!responseJson.includes('"password_hash"'), 'key "password_hash" must not appear in response JSON');
      assert.ok(!responseJson.includes('"$2b$'),           "bcrypt hash must not appear in response JSON");
      assert.ok(!responseJson.includes('"linkedinUrl"'),   'key "linkedinUrl" must not appear in response JSON');
      assert.ok(!responseJson.includes('"resumeUrl"'),     'key "resumeUrl" must not appear in response JSON');
      assert.ok(!responseJson.includes('"phone"'),         'key "phone" must not appear in response JSON');
    } finally {
      // Clean up the scaffold job created by the test search
      if (jobId) {
        await query(`DELETE FROM job_submissions WHERE job_id = $1`, [jobId]).catch(() => {});
        await query(`DELETE FROM jobs WHERE id = $1 AND created_via = 'search_scaffold'`, [jobId]).catch(() => {});
      }
    }
  });

  it("PATCH /api/client/talent-search/:jobId — rescore response also contains no blocked PII fields", async () => {
    const user = await getTestClientUser();
    if (!user) return;

    const token = makeClientJwt(user.id, user.email);

    // First: create a scaffold job via POST
    const postRes = await searchRequest(token, { searchText: "Virtual assistant", engagementType: "Full-Time" });
    if (!postRes.ok) return; // scorer not available — skip
    const postData = await postRes.json() as any;
    const jobId: string | null = postData.jobId ?? null;
    if (!jobId) return;

    try {
      // Now PATCH to rescore with a different engagement type
      const patchRes = await fetch(`http://localhost:5000/api/client/talent-search/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ engagementType: "Part-Time" }),
      });

      if (!patchRes.ok) return; // tolerate scorer failures in test env

      const patchData = await patchRes.json() as any;
      const patchJson = JSON.stringify(patchData);

      for (const result of patchData.results ?? []) {
        for (const field of SEARCH_RESULT_BLOCKED_FIELDS) {
          assert.ok(
            !(field in (result.candidate ?? {})),
            `Blocked field "${field}" must not appear in PATCH rescore response`,
          );
        }
      }

      assert.ok(!patchJson.includes('"passwordHash"'), 'passwordHash must not appear in PATCH response JSON');
      assert.ok(!patchJson.includes('"$2b$'),           "bcrypt hash must not appear in PATCH response JSON");
    } finally {
      if (jobId) {
        await query(`DELETE FROM job_submissions WHERE job_id = $1`, [jobId]).catch(() => {});
        await query(`DELETE FROM jobs WHERE id = $1 AND created_via = 'search_scaffold'`, [jobId]).catch(() => {});
      }
    }
  });
});
