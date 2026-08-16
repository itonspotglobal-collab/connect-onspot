/**
 * Regression tests: confidential job company-name search guard
 *
 * These tests verify that searching by a real company name does NOT surface
 * jobs whose `isCompanyConfidential` flag is set to true.
 *
 * Both the MemStorage path and the DatabaseStorage path use the same filter
 * logic (in-process JS filter over the result set), so testing that logic
 * directly is sufficient to guard both environments including Neon (production).
 *
 * If you ever move this logic to raw SQL or a full-text index, you MUST add a
 * corresponding integration test against the real DB to preserve this guarantee.
 *
 * Run with:   npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySearchFilter } from "../lib/jobSearchFilter.js";

// ---------------------------------------------------------------------------
// Minimal Job shape needed by the filter
// ---------------------------------------------------------------------------
interface MinimalJob {
  id: string;
  title: string;
  description: string;
  category: string;
  company: string | null;
  isCompanyConfidential: boolean;
  approvalStatus: string | null;
  status: string;
  contractType: string;
  experienceLevel: string;
  budget: string | null;
}

// applySearchFilter imported from the real production module — not a copy.
// If the production filter ever changes, this test will exercise the updated logic automatically.

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const CONFIDENTIAL_COMPANY = "AcmeSecretCorp";
const PUBLIC_COMPANY = "OpenPublicInc";

function makeJob(overrides: Partial<MinimalJob> & { id: string }): MinimalJob {
  return {
    title: "Software Engineer",
    description: "We are looking for an engineer",
    category: "Development",
    company: PUBLIC_COMPANY,
    isCompanyConfidential: false,
    approvalStatus: "approved",
    status: "open",
    contractType: "full_time",
    experienceLevel: "mid",
    budget: null,
    ...overrides,
  };
}

const confidentialJob = makeJob({
  id: "job-confidential",
  company: CONFIDENTIAL_COMPANY,
  isCompanyConfidential: true,
  title: "Senior Analyst",
  description: "Role at a leading firm",
  category: "Finance",
});

const publicJob = makeJob({
  id: "job-public",
  company: PUBLIC_COMPANY,
  isCompanyConfidential: false,
  title: "Marketing Manager",
  description: "Grow our brand",
  category: "Marketing",
});

const allJobs = [confidentialJob, publicJob];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Confidential job — company name search guard", () => {
  it("searching the exact confidential company name returns NO results", () => {
    const results = applySearchFilter(allJobs, CONFIDENTIAL_COMPANY);
    const ids = results.map(j => j.id);
    assert.ok(
      !ids.includes("job-confidential"),
      `Confidential job must not appear when searching "${CONFIDENTIAL_COMPANY}"`
    );
  });

  it("searching a substring of the confidential company name returns NO results", () => {
    const results = applySearchFilter(allJobs, "AcmeSecret");
    assert.ok(
      !results.some(j => j.id === "job-confidential"),
      "Confidential job must not appear for partial company name match"
    );
  });

  it("searching by confidential company name (case-insensitive) returns NO results", () => {
    const results = applySearchFilter(allJobs, "acmesecretcorp");
    assert.ok(
      !results.some(j => j.id === "job-confidential"),
      "Company name search is case-insensitive and must still be blocked for confidential jobs"
    );
  });

  it("confidential job IS returned when query matches title", () => {
    const results = applySearchFilter(allJobs, "Senior Analyst");
    assert.ok(
      results.some(j => j.id === "job-confidential"),
      "Confidential job should still appear when its title matches the query"
    );
  });

  it("confidential job IS returned when query matches description", () => {
    const results = applySearchFilter(allJobs, "leading firm");
    assert.ok(
      results.some(j => j.id === "job-confidential"),
      "Confidential job should still appear when its description matches the query"
    );
  });

  it("confidential job IS returned when query matches category", () => {
    const results = applySearchFilter(allJobs, "Finance");
    assert.ok(
      results.some(j => j.id === "job-confidential"),
      "Confidential job should still appear when its category matches the query"
    );
  });

  it("public job IS returned when its company name matches the query", () => {
    const results = applySearchFilter(allJobs, PUBLIC_COMPANY);
    assert.ok(
      results.some(j => j.id === "job-public"),
      "Non-confidential job must appear when its company name matches"
    );
  });

  it("empty query returns all jobs", () => {
    // Empty string — the production code only enters the filter block when q is
    // truthy, but defensively verify the filter itself is a no-op for ''.
    const results = applySearchFilter(allJobs, "");
    // Every job matches (every string includes "")
    assert.equal(results.length, allJobs.length);
  });
});
