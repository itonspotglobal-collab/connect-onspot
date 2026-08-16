/**
 * pii-flag-messages.test.ts
 *
 * Unit tests for PII detection in message content.
 *
 * Coverage:
 *  (a) Phone number match → containsPii returns true
 *  (b) Email address match → containsPii returns true
 *  (c) Clean message → containsPii returns false
 *  (d) containsPii never throws on unusual / empty input
 *  (e) Long strings are evaluated within a strict time budget (DoS guard)
 *  (f) All PII_PATTERNS are valid compiled RegExp instances
 *
 * Run with:  npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { containsPii, PII_PATTERNS } from "../lib/piiPatterns.js";

// ─────────────────────────────────────────────────────────────────────────────
// (a) Phone number detection
// ─────────────────────────────────────────────────────────────────────────────

describe("containsPii — phone numbers", () => {
  const cases = [
    { label: "international E.164", text: "Call me at +63 912 345 6789" },
    { label: "Philippine mobile no separator", text: "My number is 09123456789" },
    { label: "Philippine mobile with dashes", text: "Reach me: 0912-345-6789" },
    { label: "Philippine mobile with spaces", text: "0912 345 6789 is my number" },
    { label: "US style with dots", text: "Try 912.345.6789 anytime" },
    { label: "US style with hyphens", text: "My direct line: 912-345-6789" },
    { label: "long run of digits", text: "0917234567890" },
    { label: "international with country code", text: "+1-800-555-0100" },
  ];

  for (const { label, text } of cases) {
    it(`flags: ${label}`, () => {
      assert.strictEqual(containsPii(text), true, `Expected PII in: "${text}"`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) Email address detection
// ─────────────────────────────────────────────────────────────────────────────

describe("containsPii — email addresses", () => {
  const cases = [
    { label: "simple email", text: "Email me at john@example.com" },
    { label: "email with subdomain", text: "Send to jane.doe@mail.company.org" },
    { label: "email with plus addressing", text: "Use alice+test@gmail.com" },
    { label: "email mid-sentence", text: "My work contact is bob@acme.io please use it" },
  ];

  for (const { label, text } of cases) {
    it(`flags: ${label}`, () => {
      assert.strictEqual(containsPii(text), true, `Expected PII in: "${text}"`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) Clean messages — no false positives on normal chat
// ─────────────────────────────────────────────────────────────────────────────

describe("containsPii — clean messages (no flag)", () => {
  const cases = [
    { label: "greeting", text: "Hello! How are you doing today?" },
    { label: "project discussion", text: "I have reviewed the brief and I think we can start Monday." },
    { label: "short number in context", text: "I need 3 revisions please." },
    { label: "year reference", text: "This campaign runs from 2024 to 2025." },
    { label: "empty string", text: "" },
  ];

  for (const { label, text } of cases) {
    it(`no flag: ${label}`, () => {
      assert.strictEqual(containsPii(text), false, `Unexpected PII flag in: "${text}"`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) containsPii never throws regardless of input
// ─────────────────────────────────────────────────────────────────────────────

describe("containsPii — robustness", () => {
  it("handles empty string without throwing", () => {
    assert.doesNotThrow(() => containsPii(""));
  });

  it("handles unicode / emoji without throwing", () => {
    assert.doesNotThrow(() => containsPii("Great work 🎉 こんにちは 你好"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) Performance — long strings must be evaluated within a strict budget
//     This guards against regex DoS when the message field receives large input.
// ─────────────────────────────────────────────────────────────────────────────

describe("containsPii — performance guard", () => {
  /** Maximum allowed wall-clock time for a single containsPii call (ms). */
  const BUDGET_MS = 50;

  it(`evaluates a 100 KB non-matching string in under ${BUDGET_MS}ms`, () => {
    const longText = "a".repeat(100_000); // purely alphabetic, no PII
    const start = Date.now();
    const result = containsPii(longText);
    const elapsed = Date.now() - start;
    assert.strictEqual(result, false, "Clean 100 KB string should not be flagged");
    assert.ok(
      elapsed < BUDGET_MS,
      `containsPii took ${elapsed}ms on 100 KB input — exceeds ${BUDGET_MS}ms budget (DoS risk)`,
    );
  });

  it(`evaluates a 100 KB string with an email near the start in under ${BUDGET_MS}ms`, () => {
    const withEmail = "user@example.com " + "x".repeat(99_000);
    const start = Date.now();
    const result = containsPii(withEmail);
    const elapsed = Date.now() - start;
    assert.strictEqual(result, true, "Email at start of long string should be flagged");
    assert.ok(
      elapsed < BUDGET_MS,
      `containsPii took ${elapsed}ms — exceeds ${BUDGET_MS}ms budget`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) PII_PATTERNS are all valid RegExp instances
// ─────────────────────────────────────────────────────────────────────────────

describe("PII_PATTERNS — validity", () => {
  it("exports an array of compiled RegExp objects", () => {
    assert.ok(Array.isArray(PII_PATTERNS), "PII_PATTERNS should be an array");
    assert.ok(PII_PATTERNS.length > 0, "PII_PATTERNS should not be empty");
    for (const pattern of PII_PATTERNS) {
      assert.ok(pattern instanceof RegExp, `Expected RegExp, got: ${pattern}`);
    }
  });
});
