/**
 * interview-email-to-client.test.ts
 *
 * Smoke / regression tests for sendInterviewConfirmedEmailToClient in
 * server/services/interviewEmailService.ts.
 *
 * The function is fire-and-forget — it must never throw regardless of whether
 * the email service is configured, the client user row exists, or the
 * underlying send call succeeds.
 *
 * Coverage:
 *  (a) Missing email service — skips gracefully without touching the DB
 *  (b) Missing client user row — logs a warning and returns cleanly
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
import { sendInterviewConfirmedEmailToClient } from "../services/interviewEmailService.js";

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

function clearEmailEnv() {
  for (const key of EMAIL_ENV_KEYS) delete process.env[key];
}

/** Set all credentials needed for isEmailServiceConfigured() to return true. */
function setFakeEmailEnv() {
  process.env.MICROSOFT_TENANT_ID = "fake-tenant-id";
  process.env.MICROSOFT_CLIENT_ID = "fake-client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "fake-client-secret";
  process.env.MICROSOFT_SENDER_EMAIL = "noreply@test.example";
}

// ── Test fixture IDs ──────────────────────────────────────────────────────────

const suffix = `${Date.now()}-ietc`;
const CLIENT_USER_ID = `ietc-client-${suffix}`;
const TALENT_USER_ID = `ietc-talent-${suffix}`;

// ── (a) Missing email service ─────────────────────────────────────────────────

describe("sendInterviewConfirmedEmailToClient — missing email service", () => {
  let envSnapshot: Record<EmailEnvKey, string | undefined>;

  before(() => {
    envSnapshot = snapshotEmailEnv();
    clearEmailEnv();
  });

  after(() => {
    restoreEmailEnv(envSnapshot);
  });

  it("(a) resolves without throwing when email service is not configured", async () => {
    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmailToClient({
          clientUserId: "00000000-0000-0000-0000-000000000099",
          talentUserId: "00000000-0000-0000-0000-000000000098",
          jobTitle: "Senior Developer",
          confirmedTime: "2025-09-10T14:00:00.000Z",
          confirmedTimeZone: "America/New_York",
          durationMinutes: 45,
          meetingLink: null,
          interviewType: "technical",
          roundNumber: 1,
        }),
      "sendInterviewConfirmedEmailToClient must not throw when email service is unconfigured",
    );
  });
});

// ── (b) Missing client user row ───────────────────────────────────────────────

describe("sendInterviewConfirmedEmailToClient — missing client user row", () => {
  let envSnapshot: Record<EmailEnvKey, string | undefined>;

  before(() => {
    envSnapshot = snapshotEmailEnv();
    // Email service must appear configured so the function proceeds to the DB lookup.
    setFakeEmailEnv();
  });

  after(() => {
    restoreEmailEnv(envSnapshot);
  });

  it("(b) resolves without throwing when the client user row does not exist", async () => {
    // Use a UUID that is guaranteed not to be in the users table.
    const nonExistentClientId = "00000000-dead-beef-0000-000000000000";

    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmailToClient({
          clientUserId: nonExistentClientId,
          talentUserId: "00000000-0000-0000-0000-000000000098",
          jobTitle: "Product Designer",
          confirmedTime: "2025-09-11T09:30:00.000Z",
          confirmedTimeZone: "Europe/London",
          durationMinutes: 60,
          meetingLink: null,
        }),
      "sendInterviewConfirmedEmailToClient must not throw when client user row is absent",
    );
  });
});

// ── (c) Happy path ────────────────────────────────────────────────────────────

describe("sendInterviewConfirmedEmailToClient — happy path", () => {
  let envSnapshot: Record<EmailEnvKey, string | undefined>;

  before(async () => {
    // Insert minimal client and talent user rows so recipient resolution succeeds.
    await query(
      `INSERT INTO users (id, email, first_name, last_name, role)
       VALUES
         ($1, $2, 'Interview', 'Client', 'client'),
         ($3, $4, 'Interview', 'Talent', 'talent')
       ON CONFLICT (id) DO NOTHING`,
      [
        CLIENT_USER_ID,
        `${CLIENT_USER_ID}@test.example`,
        TALENT_USER_ID,
        `${TALENT_USER_ID}@test.example`,
      ],
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
    // Remove the test rows — notifications table may reference users so cascade.
    await query(
      `DELETE FROM notifications WHERE user_id = ANY($1::text[])`,
      [[CLIENT_USER_ID, TALENT_USER_ID]],
    ).catch(() => {});
    await query(
      `DELETE FROM users WHERE id = ANY($1::text[])`,
      [[CLIENT_USER_ID, TALENT_USER_ID]],
    ).catch(() => {});
  });

  it("(c) resolves without throwing when client and talent rows exist in the DB", async () => {
    // The function should resolve both user rows, build the email, and call
    // sendApplicantEmail.  With fake MS Graph credentials the underlying HTTP
    // call will fail, but sendApplicantEmail wraps that in { success: false }
    // and the service logs the error rather than re-throwing — so the returned
    // Promise must still resolve cleanly.
    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmailToClient({
          clientUserId: CLIENT_USER_ID,
          talentUserId: TALENT_USER_ID,
          jobTitle: "UX Lead",
          confirmedTime: "2025-09-15T11:00:00.000Z",
          confirmedTimeZone: "UTC",
          durationMinutes: 30,
          meetingLink: "https://meet.example.com/interview-abc",
          interviewType: "portfolio",
          roundNumber: 2,
        }),
      "sendInterviewConfirmedEmailToClient must not throw when DB rows exist, even if send fails",
    );
  });

  it("(c2) resolves without throwing when talent user is unknown (talent name falls back to 'The talent')", async () => {
    // Talent userId is absent from DB — the function falls back to "The talent"
    // as the display name and must still proceed and resolve.
    const unknownTalentId = "00000000-0000-0000-0000-00000000abcd";

    await assert.doesNotReject(
      () =>
        sendInterviewConfirmedEmailToClient({
          clientUserId: CLIENT_USER_ID,
          talentUserId: unknownTalentId,
          jobTitle: "Data Analyst",
          confirmedTime: "2025-09-16T15:00:00.000Z",
          confirmedTimeZone: "UTC+05:30",
          durationMinutes: null,
          meetingLink: null,
        }),
      "sendInterviewConfirmedEmailToClient must not throw when talent row is absent (fallback name used)",
    );
  });
});
