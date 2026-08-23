/**
 * profile-preferences-dualwrite.test.ts
 *
 * Unit tests for the PUT /api/profiles/me dual-write logic that mirrors
 * rate fields from the onboarding form into candidates.preferences so the
 * match scorer can read them.
 *
 * Tests the pure helper `buildPreferencesUpdate` extracted from routes.ts.
 *
 * Coverage:
 *  (a) All three rate fields present → all three written to preferences
 *  (b) Only rateEngagementType present → only that field written
 *  (c) Only hourlyRate present → only rateAmount written
 *  (d) rateCurrency written alongside hourlyRate
 *  (e) Empty / null fields → nothing written (returns null)
 *  (f) rateEngagementType of "Standard" is preserved verbatim
 *  (g) rateEngagementType of "Lite" is preserved verbatim
 *  (h) Numeric hourlyRate coerced to string for JSONB consistency
 *
 * Run with:  npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildPreferencesUpdate } from "../lib/profilePreferencesUpdate.js";

describe("buildPreferencesUpdate — onboarding dual-write to candidates.preferences", () => {
  it("(a) all three fields present → all three written", () => {
    const result = buildPreferencesUpdate({
      hourlyRate: "3000",
      rateEngagementType: "Standard",
      rateCurrency: "USD",
    });
    assert.ok(result, "should return a non-null object");
    assert.equal(result.rateAmount, "3000");
    assert.equal(result.rateEngagementType, "Standard");
    assert.equal(result.rateCurrency, "USD");
  });

  it("(b) only rateEngagementType → only that field written", () => {
    const result = buildPreferencesUpdate({
      hourlyRate: null,
      rateEngagementType: "Lite",
      rateCurrency: null,
    });
    assert.ok(result, "should return a non-null object");
    assert.equal(result.rateEngagementType, "Lite");
    assert.equal(Object.keys(result).length, 1, "only one key expected");
  });

  it("(c) only hourlyRate → only rateAmount written", () => {
    const result = buildPreferencesUpdate({
      hourlyRate: "1500",
      rateEngagementType: null,
      rateCurrency: null,
    });
    assert.ok(result);
    assert.equal(result.rateAmount, "1500");
    assert.equal(Object.keys(result).length, 1);
  });

  it("(d) rateCurrency written alongside hourlyRate", () => {
    const result = buildPreferencesUpdate({
      hourlyRate: "2000",
      rateEngagementType: "",
      rateCurrency: "PHP",
    });
    assert.ok(result);
    assert.equal(result.rateAmount, "2000");
    assert.equal(result.rateCurrency, "PHP");
    assert.ok(!("rateEngagementType" in result), "empty string should not write engagement type");
  });

  it("(e) all fields empty / null → returns null (no DB update needed)", () => {
    const result = buildPreferencesUpdate({
      hourlyRate: null,
      rateEngagementType: null,
      rateCurrency: null,
    });
    assert.equal(result, null);
  });

  it("(f) 'Standard' engagement type preserved verbatim", () => {
    const result = buildPreferencesUpdate({ rateEngagementType: "Standard" });
    assert.ok(result);
    assert.equal(result.rateEngagementType, "Standard");
  });

  it("(g) 'Lite' engagement type preserved verbatim", () => {
    const result = buildPreferencesUpdate({ rateEngagementType: "Lite" });
    assert.ok(result);
    assert.equal(result.rateEngagementType, "Lite");
  });

  it("(h) numeric hourlyRate coerced to string", () => {
    const result = buildPreferencesUpdate({ hourlyRate: 50 });
    assert.ok(result);
    assert.equal(typeof result.rateAmount, "string");
    assert.equal(result.rateAmount, "50");
  });

  it("(i) result serialises to valid JSON (safe for JSONB $1 param)", () => {
    const result = buildPreferencesUpdate({
      hourlyRate: "4000",
      rateEngagementType: "Standard",
      rateCurrency: "USD",
    });
    assert.ok(result);
    const serialised = JSON.stringify(result);
    const parsed = JSON.parse(serialised);
    assert.equal(parsed.rateAmount, "4000");
    assert.equal(parsed.rateEngagementType, "Standard");
    assert.equal(parsed.rateCurrency, "USD");
  });
});
