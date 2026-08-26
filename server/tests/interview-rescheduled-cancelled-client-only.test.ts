/**
 * interview-rescheduled-cancelled-client-only.test.ts
 *
 * Regression test: admin reschedule and admin cancellation must notify the
 * client even when no talent user is linked (talent_id IS NULL).
 *
 * This reproduces the specific bug where `clientUserId: interview.client_id`
 * received undefined because `js.client_id` was not selected in the admin
 * interview lookup query.
 *
 * Run with: npm test
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// ── Shared capture state ──────────────────────────────────────────────────────

interface CapturedSend {
  to: string;
  subject: string;
  bodyHtml: string;
  senderEmail?: string;
}
let sends: CapturedSend[] = [];
let queryCalls: Array<[string, unknown[]]> = [];

function resetCaptures() {
  sends = [];
  queryCalls = [];
}

// ── Mocks — registered before any imports of the services ────────────────────

mock.module("../services/microsoftGraphEmailService.js", {
  namedExports: {
    isEmailServiceConfigured: () => true,
    sendApplicantEmail: async (args: CapturedSend) => {
      sends.push({ ...args });
      return { success: true as const };
    },
    ALLOWED_SENDERS: {},
  },
});

mock.module("../services/emailVariableResolver.js", {
  namedExports: {
    renderBrandedEmailLayout: (html: string) => `<layout>${html}</layout>`,
    renderApplicantEmail: (
      tpl: { subject: string; bodyHtml: string },
      _ctx: unknown,
    ) => ({ subject: tpl.subject, bodyHtml: tpl.bodyHtml, unresolvedKeys: [] }),
    buildEmailContext: (vars: unknown) => vars,
  },
});

// Stub the DB: talent user lookup returns no rows (talent_id is null so
// resolveTalentRecipient will be skipped); client user lookup returns a row.
// claimEmailDelivery always returns a claimed row (proceed to send).
// markEmailDeliveryResult no-ops.
mock.module("../db.js", {
  namedExports: {
    query: async (sql: string, params: unknown[] = []) => {
      queryCalls.push([sql, params]);
      // claimEmailDelivery INSERT → return a claiming row
      if (sql.includes("INSERT INTO email_notification_deliveries")) {
        return { rows: [{ id: "claimed" }] };
      }
      // markEmailDeliveryResult UPDATE → no-op
      if (sql.includes("UPDATE email_notification_deliveries")) {
        return { rows: [] };
      }
      // Client user lookup (users table) → return client row
      if (sql.includes("FROM users")) {
        return {
          rows: [{
            email: "client@acme.com",
            first_name: "Carol",
            last_name: "Brown",
          }],
        };
      }
      // Talent lookup (candidates / users by talent_id) → no row (no talent linked)
      return { rows: [] };
    },
  },
});

// Dynamic import AFTER all mocks
const { sendInterviewRescheduledEmail, sendInterviewCancelledEmail } =
  await import("../services/interviewEmailService.js");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("admin interview reschedule — client notified when talent_id is null", () => {
  it("sends a rescheduled email to the client even when talentUserId is null", async () => {
    resetCaptures();

    await sendInterviewRescheduledEmail({
      talentUserId: null,          // ← no linked talent user
      clientUserId: "client-uuid-1",
      jobTitle: "Senior Designer",
      proposedTimes: [
        { start: "2026-09-10T09:00:00.000Z", timezone: "Asia/Singapore" },
        { start: "2026-09-11T14:00:00.000Z", timezone: "Asia/Singapore" },
      ],
      durationMinutes: 60,
      interviewType: "video",
      roundNumber: 1,
      rescheduledBy: "admin",
      interviewId: "interview-abc",
      interviewUpdatedAt: "2026-08-27T10:00:00.000Z",
    });

    // Client must receive an email
    const clientSends = sends.filter((s) => s.to === "client@acme.com");
    assert.ok(
      clientSends.length > 0,
      "client email must be sent when talentUserId is null",
    );
    const clientSend = clientSends[0];
    assert.ok(
      clientSend.subject.includes("Senior Designer"),
      "client email subject must include the job title",
    );
    assert.ok(
      clientSend.bodyHtml.toLowerCase().includes("reschedul"),
      "client email body must mention rescheduling",
    );

    // Talent must NOT receive an email (no talent linked)
    const talentSends = sends.filter((s) => s.to !== "client@acme.com");
    assert.equal(talentSends.length, 0, "no talent email should be sent when talentUserId is null");
  });

  it("sends a cancellation email to the client even when talentUserId is null", async () => {
    resetCaptures();

    await sendInterviewCancelledEmail({
      talentUserId: null,          // ← no linked talent user
      clientUserId: "client-uuid-2",
      jobTitle: "Product Manager",
      cancellationReason: "Candidate withdrew",
      interviewType: "phone",
      roundNumber: 2,
      cancelledBy: "admin",
      interviewId: "interview-xyz",
      interviewUpdatedAt: "2026-08-27T11:00:00.000Z",
    });

    const clientSends = sends.filter((s) => s.to === "client@acme.com");
    assert.ok(
      clientSends.length > 0,
      "client cancellation email must be sent when talentUserId is null",
    );
    const clientSend = clientSends[0];
    assert.ok(
      clientSend.subject.includes("Product Manager"),
      "client cancellation email subject must include the job title",
    );
    assert.ok(
      clientSend.bodyHtml.toLowerCase().includes("cancel"),
      "client cancellation email body must mention cancellation",
    );

    // Talent must NOT receive an email
    const talentSends = sends.filter((s) => s.to !== "client@acme.com");
    assert.equal(talentSends.length, 0, "no talent email when talentUserId is null and cancelledBy='admin'");
  });

  it("is non-throwing when clientUserId is null and talentUserId is null", async () => {
    resetCaptures();
    await assert.doesNotReject(() =>
      sendInterviewRescheduledEmail({
        talentUserId: null,
        clientUserId: null,
        jobTitle: "No Linked Users",
        proposedTimes: [],
        durationMinutes: null,
        rescheduledBy: "admin",
        interviewId: "interview-noop",
        interviewUpdatedAt: "2026-08-27T12:00:00.000Z",
      }),
    );
    assert.equal(sends.length, 0, "no email sent when both user IDs are null");
  });
});
