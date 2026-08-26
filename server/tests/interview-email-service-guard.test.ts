/**
 * interview-email-service-guard.test.ts
 *
 * Unit tests for the isEmailServiceConfigured() guard in
 * server/services/microsoftGraphEmailService.ts and its use inside
 * server/services/interviewEmailService.ts.
 *
 * Coverage:
 *  (a) isEmailServiceConfigured() returns false when all credentials absent
 *  (b) isEmailServiceConfigured() returns false when only some credentials present
 *  (c) isEmailServiceConfigured() returns true with all required env vars set
 *  (d) isEmailServiceConfigured() accepts APPLICATION_EMAIL_FROM as sender fallback
 *  (e) sendInterviewConfirmedEmail resolves without throwing when unconfigured
 *  (f) sendInterviewProposalEmail resolves without throwing when unconfigured
 *
 * Run with: npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { isEmailServiceConfigured } from "../services/microsoftGraphEmailService.js";
import {
  sendInterviewConfirmedEmail,
  sendInterviewProposalEmail,
} from "../services/interviewEmailService.js";

// Snapshot original env vars so we can restore after each test block.
const ORIGINAL_ENV = {
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID,
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  MICROSOFT_SENDER_EMAIL: process.env.MICROSOFT_SENDER_EMAIL,
  APPLICATION_EMAIL_FROM: process.env.APPLICATION_EMAIL_FROM,
};

function clearEmailEnv() {
  delete process.env.MICROSOFT_TENANT_ID;
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_SECRET;
  delete process.env.MICROSOFT_SENDER_EMAIL;
  delete process.env.APPLICATION_EMAIL_FROM;
}

function restoreEmailEnv() {
  for (const [key, val] of Object.entries(ORIGINAL_ENV)) {
    if (val === undefined) {
      delete process.env[key as keyof typeof ORIGINAL_ENV];
    } else {
      process.env[key] = val;
    }
  }
}

describe("isEmailServiceConfigured", () => {
  before(clearEmailEnv);
  after(restoreEmailEnv);

  it("(a) returns false when all credentials absent", () => {
    clearEmailEnv();
    assert.equal(isEmailServiceConfigured(), false);
  });

  it("(b) returns false when only some credentials present", () => {
    clearEmailEnv();
    process.env.MICROSOFT_TENANT_ID = "tenant-id";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    // MICROSOFT_CLIENT_SECRET and sender not set
    assert.equal(isEmailServiceConfigured(), false);
  });

  it("(c) returns true when all required env vars set (MICROSOFT_SENDER_EMAIL)", () => {
    clearEmailEnv();
    process.env.MICROSOFT_TENANT_ID = "tenant-id";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_SENDER_EMAIL = "careers@onspotglobal.com";
    assert.equal(isEmailServiceConfigured(), true);
  });

  it("(d) returns true when APPLICATION_EMAIL_FROM used as sender fallback", () => {
    clearEmailEnv();
    process.env.MICROSOFT_TENANT_ID = "tenant-id";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.APPLICATION_EMAIL_FROM = "careers@onspotglobal.com";
    // MICROSOFT_SENDER_EMAIL not set
    assert.equal(isEmailServiceConfigured(), true);
  });
});

describe("interview email service — unconfigured guard", () => {
  before(clearEmailEnv);
  after(restoreEmailEnv);

  it("(e) sendInterviewConfirmedEmail resolves without throwing when unconfigured", async () => {
    clearEmailEnv();
    // With no credentials, the guard should return early and never attempt a
    // DB query or network call — the promise must resolve cleanly.
    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmail({
          talentUserId: "00000000-0000-0000-0000-000000000001",
          jobTitle: "Test Role",
          confirmedTime: "2025-09-03T14:30:00.000Z",
          confirmedTimeZone: "UTC",
          durationMinutes: 60,
          meetingLink: null,
        }),
      "sendInterviewConfirmedEmail should not throw when email service is unconfigured",
    );
  });

  it("(f) sendInterviewProposalEmail resolves without throwing when unconfigured", async () => {
    clearEmailEnv();
    await assert.doesNotReject(
      () =>
        sendInterviewProposalEmail({
          talentUserId: "00000000-0000-0000-0000-000000000001",
          jobTitle: "Test Role",
          proposedTimes: [
            { start: "2025-09-03T14:30:00.000Z", timezone: "UTC" },
          ],
          durationMinutes: 60,
          candidateNotes: null,
        }),
      "sendInterviewProposalEmail should not throw when email service is unconfigured",
    );
  });
});
