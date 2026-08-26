/**
 * interview-email-proposal.test.ts
 *
 * Smoke / regression tests for sendInterviewProposalEmail in
 * server/services/interviewEmailService.ts.
 *
 * The function is fire-and-forget — it must never throw regardless of whether
 * the email service is configured, the talent user row exists, or the
 * underlying send call succeeds.
 *
 * Coverage:
 *  (a) Missing email service — already covered by the unconfigured-guard tests
 *      in server/tests/interview-email-service-guard.test.ts (case f).
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
import { sendInterviewProposalEmail } from "../services/interviewEmailService.js";

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

const suffix = `${Date.now()}-iepr`;
const TALENT_USER_ID = `iepr-talent-${suffix}`;

// ── (b) Missing talent user row ───────────────────────────────────────────────

describe("sendInterviewProposalEmail — missing talent user row", () => {
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
    const nonExistentTalentId = "00000000-dead-beef-0000-000000000002";

    await assert.doesNotReject(
      () =>
        sendInterviewProposalEmail({
          talentUserId: nonExistentTalentId,
          jobTitle: "Product Designer",
          proposedTimes: [
            { start: "2025-09-11T09:30:00.000Z", timezone: "Europe/London" },
            { start: "2025-09-12T14:00:00.000Z", timezone: "Europe/London" },
          ],
          durationMinutes: 60,
          candidateNotes: null,
        }),
      "sendInterviewProposalEmail must not throw when talent user row is absent",
    );
  });
});

// ── (c) Happy path ────────────────────────────────────────────────────────────

describe("sendInterviewProposalEmail — happy path", () => {
  let envSnapshot: Record<EmailEnvKey, string | undefined>;

  before(async () => {
    // Insert a minimal talent user row so recipient resolution succeeds.
    await query(
      `INSERT INTO users (id, email, first_name, last_name, role)
       VALUES ($1, $2, 'Proposal', 'Talent', 'talent')
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
        sendInterviewProposalEmail({
          talentUserId: TALENT_USER_ID,
          jobTitle: "UX Lead",
          proposedTimes: [
            { start: "2025-09-15T11:00:00.000Z", timezone: "UTC" },
            { start: "2025-09-16T09:00:00.000Z", timezone: "UTC" },
            { start: "2025-09-17T14:30:00.000Z", timezone: "UTC" },
          ],
          durationMinutes: 30,
          candidateNotes: "Please bring your portfolio.",
          interviewType: "portfolio",
          roundNumber: 2,
        }),
      "sendInterviewProposalEmail must not throw when DB row exists, even if send fails",
    );
  });

  it("(c2) resolves without throwing with no notes, type, or round", async () => {
    // Exercise the fallback branches: no candidateNotes (notes section omitted),
    // no interviewType (defaults to "Interview"), no roundNumber (no round suffix).
    await assert.doesNotReject(
      () =>
        sendInterviewProposalEmail({
          talentUserId: TALENT_USER_ID,
          jobTitle: "Data Analyst",
          proposedTimes: [
            { start: "2025-09-16T15:00:00.000Z", timezone: "America/New_York" },
          ],
          durationMinutes: null,
          candidateNotes: null,
        }),
      "sendInterviewProposalEmail must not throw when optional fields are omitted",
    );
  });
});
