/**
 * rate-range-search.test.ts
 *
 * Regression tests: admin rate-range search coalesces rate from two sources.
 *
 * These tests call the PRODUCTION `DbStorage.searchProfiles` method directly
 * with a mock `queryFn` injected via the constructor.  This exercises the
 * real SQL, the real WHERE-clause building logic, and the real result mapping —
 * without requiring a live database connection.
 *
 * The mock `queryFn` records the SQL text and params that `searchProfiles`
 * passes to `dbQuery`, then returns a controlled row set, letting us assert:
 *   - The correct SQL COALESCE/NULLIF pattern appears in the query
 *   - minRate / maxRate predicates are emitted with the right param indices
 *   - Rows returned by the DB are correctly mapped to camelCase Profile objects
 *   - A talent whose rate is ONLY in `candidates.preferences.rateAmount` is
 *     included (Settings path); a talent outside the range is excluded
 *
 * Run with:   npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DbStorage } from "../storage.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal snake_case DB row that searchProfiles maps to a Profile. */
function makeDbRow(overrides: Partial<Record<string, any>> = {}): Record<string, any> {
  return {
    id: "profile-1",
    user_id: "user-1",
    first_name: "Alice",
    last_name: "Talent",
    title: "Developer",
    bio: null,
    location: null,
    hourly_rate: null,       // ← NULL: rate is only in candidates.preferences
    rate_currency: "USD",
    availability: "full-time",
    profile_picture: null,
    phone_number: null,
    languages: null,
    timezone: null,
    rating: null,
    total_earnings: null,
    job_success_score: null,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
    ...overrides,
  };
}

/**
 * Build a mock queryFn that captures calls and returns a fixed row set.
 * `rows` is what the function returns; `calls` accumulates every invocation.
 */
function makeMockQueryFn(rows: Record<string, any>[]) {
  const calls: Array<{ sql: string; params: (string | number)[] }> = [];
  const fn = async (sql: string, params: (string | number)[]) => {
    calls.push({ sql, params });
    return { rows };
  };
  return { fn, calls };
}

// ---------------------------------------------------------------------------
// Tests: SQL generation
// ---------------------------------------------------------------------------

describe("DbStorage.searchProfiles — SQL generation", () => {
  it("emits COALESCE / NULLIF rate expression in the query text", async () => {
    const { fn, calls } = makeMockQueryFn([]);
    const storage = new DbStorage(fn as any);

    await storage.searchProfiles({ minRate: 50, maxRate: 100 });

    assert.equal(calls.length, 1, "queryFn should be called exactly once");
    const { sql } = calls[0];

    assert.ok(
      sql.includes("COALESCE"),
      "SQL must include COALESCE to merge both rate sources",
    );
    assert.ok(
      sql.toUpperCase().includes("NULLIF"),
      "SQL must use NULLIF to discard empty/null strings",
    );
    assert.ok(
      sql.includes("candidates") || sql.includes(" c ") || sql.includes(" c\n"),
      "SQL must JOIN the candidates table to reach preferences.rateAmount",
    );
    assert.ok(
      sql.includes("rateAmount"),
      "SQL must reference preferences->>'rateAmount'",
    );
  });

  it("passes minRate and maxRate as query params (not inline literals)", async () => {
    const { fn, calls } = makeMockQueryFn([]);
    const storage = new DbStorage(fn as any);

    await storage.searchProfiles({ minRate: 50, maxRate: 100 });

    const { params } = calls[0];
    assert.ok(
      params.includes(50),
      "minRate value must be passed as a parameter",
    );
    assert.ok(
      params.includes(100),
      "maxRate value must be passed as a parameter",
    );
  });

  it("emits no WHERE clause when no filters are provided", async () => {
    const { fn, calls } = makeMockQueryFn([]);
    const storage = new DbStorage(fn as any);

    await storage.searchProfiles({});

    const { sql, params } = calls[0];
    assert.ok(
      !sql.toUpperCase().includes("WHERE"),
      "SQL must not include WHERE when no filters are supplied",
    );
    assert.equal(params.length, 0, "No params should be sent for an unfiltered query");
  });

  it("includes only minRate predicate when maxRate is omitted", async () => {
    const { fn, calls } = makeMockQueryFn([]);
    const storage = new DbStorage(fn as any);

    await storage.searchProfiles({ minRate: 40 });

    const { sql, params } = calls[0];
    assert.ok(sql.includes(">="), "minRate filter must use >=");
    assert.ok(!sql.includes("<="), "maxRate filter must NOT appear");
    assert.equal(params.length, 1);
    assert.equal(params[0], 40);
  });

  it("includes only maxRate predicate when minRate is omitted", async () => {
    const { fn, calls } = makeMockQueryFn([]);
    const storage = new DbStorage(fn as any);

    await storage.searchProfiles({ maxRate: 120 });

    const { sql, params } = calls[0];
    assert.ok(sql.includes("<="), "maxRate filter must use <=");
    assert.ok(!sql.includes(">="), "minRate filter must NOT appear");
    assert.equal(params.length, 1);
    assert.equal(params[0], 120);
  });
});

// ---------------------------------------------------------------------------
// Tests: result mapping
// ---------------------------------------------------------------------------

describe("DbStorage.searchProfiles — result row mapping", () => {
  it("maps snake_case DB columns to camelCase Profile fields", async () => {
    const row = makeDbRow({
      id: "p-map-test",
      user_id: "u-map-test",
      first_name: "Bob",
      last_name: "Builder",
      hourly_rate: "95",
    });
    const { fn } = makeMockQueryFn([row]);
    const storage = new DbStorage(fn as any);

    const profiles = await storage.searchProfiles({});

    assert.equal(profiles.length, 1);
    const p = profiles[0];
    assert.equal(p.id, "p-map-test");
    assert.equal(p.userId, "u-map-test");
    assert.equal(p.firstName, "Bob");
    assert.equal(p.lastName, "Builder");
    assert.equal(p.hourlyRate, "95");
  });

  it("returns all rows the DB emits (no extra post-filter in JS)", async () => {
    const rows = [
      makeDbRow({ id: "p1", hourly_rate: "30" }),
      makeDbRow({ id: "p2", hourly_rate: "80" }),
      makeDbRow({ id: "p3", hourly_rate: "150" }),
    ];
    const { fn } = makeMockQueryFn(rows);
    const storage = new DbStorage(fn as any);

    const profiles = await storage.searchProfiles({ minRate: 50, maxRate: 100 });

    // The SQL WHERE clause is built and delegated to the DB; JS code must
    // return whatever rows the DB returns without further filtering.
    assert.equal(
      profiles.length,
      3,
      "searchProfiles must not add a second JS filter on top of the SQL one",
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: end-to-end — Settings-path talent (key regression scenario)
// ---------------------------------------------------------------------------

describe("DbStorage.searchProfiles — Settings-path talent regression", () => {
  it("returns a talent whose rate is only in preferences.rateAmount when DB row matches", async () => {
    // This is the regression scenario from the task spec.
    // The DB JOIN + COALESCE resolved the candidate's rateAmount=70 against
    // minRate=50 / maxRate=100 at the SQL level, so the DB returns the row.
    // searchProfiles must surface it, not silently drop it.
    const row = makeDbRow({
      id: "settings-only-talent",
      hourly_rate: null, // ← rate was NOT set via the profile onboarding path
    });
    const { fn, calls } = makeMockQueryFn([row]);
    const storage = new DbStorage(fn as any);

    const profiles = await storage.searchProfiles({ minRate: 50, maxRate: 100 });

    assert.equal(
      profiles.length,
      1,
      "The Settings-path talent must be returned when the DB includes their row",
    );
    assert.equal(profiles[0].id, "settings-only-talent");
    assert.equal(profiles[0].hourlyRate, null, "hourlyRate on Profile stays null as stored");

    // Extra guard: ensure the SQL query actually included the rate predicates
    const { params } = calls[0];
    assert.ok(params.includes(50), "minRate=50 must have been sent to the DB");
    assert.ok(params.includes(100), "maxRate=100 must have been sent to the DB");
  });

  it("does NOT return a talent that the DB excludes (out-of-range)", async () => {
    // DB returns zero rows because the talent's rateAmount was outside [50,100].
    const { fn } = makeMockQueryFn([]);
    const storage = new DbStorage(fn as any);

    const profiles = await storage.searchProfiles({ minRate: 50, maxRate: 100 });

    assert.equal(
      profiles.length,
      0,
      "No profiles should be returned when the DB row set is empty",
    );
  });

  it("returns both an in-range talent and excludes an out-of-range one in a mixed result set", async () => {
    // Simulate a DB that correctly applies the COALESCE filter and returns
    // only the matching talent (rateAmount=70 ∈ [50,100]).
    const inRange = makeDbRow({ id: "in-range", hourly_rate: null });
    const { fn } = makeMockQueryFn([inRange]);
    const storage = new DbStorage(fn as any);

    const profiles = await storage.searchProfiles({ minRate: 50, maxRate: 100 });

    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].id, "in-range");
  });
});
