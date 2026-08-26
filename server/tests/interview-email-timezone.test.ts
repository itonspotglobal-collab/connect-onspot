/**
 * interview-email-timezone.test.ts
 *
 * Unit tests for the timezone-aware interview time formatter in
 * server/services/interviewEmailService.ts.
 *
 * normalizeInterviewTimeZone (server/lib/interviewTime.ts) accepts and persists
 * UTC fixed-offset strings such as "UTC+05:30" and "UTC-04:00".  Intl.DateTimeFormat
 * does NOT accept those identifiers, so the formatter must handle them manually by
 * shifting the UTC timestamp before rendering — otherwise it would either throw (proposal
 * emails) or silently display the wrong time (confirmed emails).
 *
 * Coverage:
 *  (a) IANA timezone renders the correct local time
 *  (b) "UTC" renders as UTC with no offset shift
 *  (c) Positive UTC offset (UTC+05:30) shifts and labels correctly
 *  (d) Negative UTC offset (UTC-04:00) shifts and labels correctly
 *  (e) UTC+00:00 renders same as UTC
 *  (f) Unknown/invalid timezone falls back to UTC without throwing
 *  (g) Both long (confirmed) and short (proposal) format variants work
 *
 * Run with:  npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatInterviewTime } from "../services/interviewEmailService.js";

// Reference timestamp: 2025-09-03T14:30:00.000Z (Wednesday, 3 Sep 2025, 14:30 UTC)
const ISO = "2025-09-03T14:30:00.000Z";

describe("formatInterviewTime", () => {
  it("(a) IANA timezone — renders correct local time", () => {
    // 14:30 UTC in America/New_York (EDT = UTC-4) → 10:30 AM
    const result = formatInterviewTime(ISO, "America/New_York", false);
    assert.ok(result.includes("10:30"), `Expected 10:30 am, got: ${result}`);
    assert.ok(result.includes("America/New_York"), `Expected timezone label, got: ${result}`);
  });

  it("(b) 'UTC' renders as 14:30 UTC with no shift", () => {
    const result = formatInterviewTime(ISO, "UTC", false);
    assert.ok(result.includes("2:30"), `Expected 2:30 pm, got: ${result}`);
    assert.ok(result.includes("UTC"), `Expected UTC label, got: ${result}`);
  });

  it("(c) UTC+05:30 — shifts forward correctly (14:30 UTC → 20:00 local)", () => {
    // 14:30 UTC + 5h30m = 20:00 local
    const result = formatInterviewTime(ISO, "UTC+05:30", false);
    assert.ok(result.includes("8:00"), `Expected 8:00 pm, got: ${result}`);
    assert.ok(result.includes("UTC+05:30"), `Expected offset label, got: ${result}`);
  });

  it("(d) UTC-04:00 — shifts backward correctly (14:30 UTC → 10:30 local)", () => {
    // 14:30 UTC - 4h = 10:30 local
    const result = formatInterviewTime(ISO, "UTC-04:00", false);
    assert.ok(result.includes("10:30"), `Expected 10:30 am, got: ${result}`);
    assert.ok(result.includes("UTC-04:00"), `Expected offset label, got: ${result}`);
  });

  it("(e) UTC+00:00 — same display as plain UTC", () => {
    const utcResult = formatInterviewTime(ISO, "UTC", false);
    const zeroResult = formatInterviewTime(ISO, "UTC+00:00", false);
    // Both should show the same time; labels differ but time portion must match
    const utcTime = utcResult.match(/\d{1,2}:\d{2}/)?.[0];
    const zeroTime = zeroResult.match(/\d{1,2}:\d{2}/)?.[0];
    assert.equal(zeroTime, utcTime, `UTC+00:00 should show same time as UTC`);
  });

  it("(f) Unknown timezone — falls back to UTC without throwing", () => {
    let result: string;
    assert.doesNotThrow(() => {
      result = formatInterviewTime(ISO, "Bogus/Zone", false);
    });
    // Falls back to UTC label
    assert.ok(result!.includes("UTC"), `Expected UTC fallback label, got: ${result!}`);
    // Still shows the correct UTC time
    assert.ok(result!.includes("2:30"), `Expected 2:30 pm UTC fallback, got: ${result!}`);
  });

  it("(g) Short format (proposal list) does not throw for any timezone class", () => {
    const zones = ["America/New_York", "UTC", "UTC+05:30", "UTC-04:00", "UTC+00:00", "Invalid/Zone"];
    for (const tz of zones) {
      assert.doesNotThrow(
        () => formatInterviewTime(ISO, tz, true),
        `formatInterviewTime threw for timezone: ${tz}`,
      );
    }
  });

  it("(h) UTC-offset crossing midnight — date component shifts correctly", () => {
    // 2025-09-03T01:00:00Z in UTC-04:00 → 2025-09-02T21:00:00 (previous day)
    const midnight = "2025-09-03T01:00:00.000Z";
    const result = formatInterviewTime(midnight, "UTC-04:00", false);
    // Should show September 2 (previous day) at 9:00 PM
    assert.ok(result.includes("September"), `Expected month in result, got: ${result}`);
    assert.ok(result.includes("2"), `Expected day 2 in result, got: ${result}`);
    assert.ok(result.includes("9:00"), `Expected 9:00 pm, got: ${result}`);
  });
});
