/**
 * interview-email-to-talent.test.ts
 *
 * Smoke / regression tests for sendInterviewConfirmedEmail (talent-facing) in
 * server/services/interviewEmailService.ts.
 *
 * The function is fire-and-forget — it must never throw regardless of whether
 * the email service is configured, the talent user row exists, or the
 * underlying send call succeeds.
 *
 * Coverage:
 *  (a) Missing email service — already covered by the unconfigured-guard tests
 *      in server/tests/interview-email-service-guard.test.ts (case e).
 *  (b) Missing talent user row — logs a warning and returns cleanly
 *  (c) Happy path — resolves recipient details from the DB and attempts send;
 *      the attempt is expected to fail with fake credentials, but the function
 *      must still resolve without throwing
 *
 * How env-var manipulation works here:
 *   isEmailServiceConfigured() reads MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID,
 *   MICROSOFT_CLIENT_SECRET, and MICROSOFT_SENDER_EMAIL at call-time (not
 *   module-load-time), so we can toggle it by setting/clearing those vars
 *   within each test block.  We snapshot and restore them in after() hooks so
 *   other test files are unaffected.
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { query } from "../db.js";
import { sendInterviewConfirmedEmail } from "../services/interviewEmailService.js";

// ── Env-var helpers ───────────────────────────────────────────────────────────

const EMAIL_ENV_KEYS = [
  "MICROSOFT_TENANT_ID",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "MICROSOFT_SENDER_EMAIL",
  "APPLICATION_EMAIL_FROM",
] as const;

type EmailEnvKey = (typeof EMAIL_ENV_KEYS)[number];

function snapshotEmailEnv(): Record<EmailEnvKey, string | undefined> {
  const snap = {} as Record<EmailEnvKey, string | undefined>;
  for (const key of EMAIL_ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEmailEnv(snapshot: Record<EmailEnvKey, string | undefined>) {
  for (const key of EMAIL_ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

/** Set all credentials needed for isEmailServiceConfigured() to return true. */
function setFakeEmailEnv() {
  process.env.MICROSOFT_TENANT_ID = "fake-tenant-id";
  process.env.MICROSOFT_CLIENT_ID = "fake-client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "fake-client-secret";
  process.env.MICROSOFT_SENDER_EMAIL = "noreply@test.example";
}

// ── Test fixture IDs ──────────────────────────────────────────────────────────

const suffix = `${Date.now()}-iett`;
const TALENT_USER_ID = `iett-talent-${suffix}`;

// ── (b) Missing talent user row ───────────────────────────────────────────────

describe("sendInterviewConfirmedEmail — missing talent user row", () => {
  let envSnapshot: Record<EmailEnvKey, string | undefined>;

  before(() => {
    envSnapshot = snapshotEmailEnv();
    // Email service must appear configured so the function proceeds to the DB lookup.
    setFakeEmailEnv();
  });

  after(() => {
    restoreEmailEnv(envSnapshot);
  });

  it("(b) resolves without throwing when the talent user row does not exist", async () => {
    // Use a UUID that is guaranteed not to be in the users table.
    const nonExistentTalentId = "00000000-dead-beef-0000-000000000001";

    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmail({
          talentUserId: nonExistentTalentId,
          jobTitle: "Product Designer",
          confirmedTime: "2025-09-11T09:30:00.000Z",
          confirmedTimeZone: "Europe/London",
          durationMinutes: 60,
          meetingLink: null,
        }),
      "sendInterviewConfirmedEmail must not throw when talent user row is absent",
    );
  });
});

// ── (c) Happy path ────────────────────────────────────────────────────────────

describe("sendInterviewConfirmedEmail — happy path", () => {
  let envSnapshot: Record<EmailEnvKey, string | undefined>;

  before(async () => {
    // Insert a minimal talent user row so recipient resolution succeeds.
    await query(
      `INSERT INTO users (id, email, first_name, last_name, role)
       VALUES ($1, $2, 'Interview', 'Talent', 'talent')
       ON CONFLICT (id) DO NOTHING`,
      [TALENT_USER_ID, `${TALENT_USER_ID}@test.example`],
    );

    envSnapshot = snapshotEmailEnv();
    // Fake credentials make isEmailServiceConfigured() return true so the
    // function attempts the full recipient-resolution + send path.
    // sendApplicantEmail will fail (bad creds) but must return {success:false}
    // rather than throwing, so the outer function still resolves cleanly.
    setFakeEmailEnv();
  });

  after(async () => {
    restoreEmailEnv(envSnapshot);
    // Remove the test row — notifications table may reference users so clear it first.
    await query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [TALENT_USER_ID],
    ).catch(() => {});
    await query(
      `DELETE FROM users WHERE id = $1`,
      [TALENT_USER_ID],
    ).catch(() => {});
  });

  it("(c) resolves without throwing when the talent user row exists in the DB", async () => {
    // The function should resolve the user row, build the email, and call
    // sendApplicantEmail.  With fake MS Graph credentials the underlying HTTP
    // call will fail, but sendApplicantEmail wraps that in { success: false }
    // and the service logs the error rather than re-throwing — so the returned
    // Promise must still resolve cleanly.
    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmail({
          talentUserId: TALENT_USER_ID,
          jobTitle: "UX Lead",
          confirmedTime: "2025-09-15T11:00:00.000Z",
          confirmedTimeZone: "UTC",
          durationMinutes: 30,
          meetingLink: "https://meet.example.com/interview-abc",
          interviewType: "portfolio",
          roundNumber: 2,
        }),
      "sendInterviewConfirmedEmail must not throw when DB row exists, even if send fails",
    );
  });

  it("(c2) resolves without throwing with no meeting link, type, or round", async () => {
    // Exercise the fallback branches: no meetingLink (shows placeholder text),
    // no interviewType (defaults to "Interview"), no roundNumber (no round suffix).
    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmail({
          talentUserId: TALENT_USER_ID,
          jobTitle: "Data Analyst",
          confirmedTime: "2025-09-16T15:00:00.000Z",
          confirmedTimeZone: "America/New_York",
          durationMinutes: null,
          meetingLink: null,
        }),
      "sendInterviewConfirmedEmail must not throw when optional fields are omitted",
    );
  });
});
