/**
 * email-companion-service.test.ts
 *
 * Unit tests for emailCompanionService — exercises atomic delivery claims,
 * concurrency safety, privacy guards, XSS escaping, and non-blocking guarantees
 * without touching Graph or a real DB.
 *
 * Run with: npm test
 */

import { describe, it, before, mock } from "node:test";
import assert from "node:assert/strict";

// ── Mock: microsoftGraphEmailService ──────────────────────────────────────────

interface CapturedSend {
  to: string;
  subject: string;
  bodyHtml: string;
  senderEmail?: string;
}
let capturedSends: CapturedSend[] = [];
let configuredResult = true;
let sendShouldFail = false;

mock.module("../services/microsoftGraphEmailService.js", {
  namedExports: {
    isEmailServiceConfigured: () => configuredResult,
    sendApplicantEmail: async (args: CapturedSend) => {
      if (sendShouldFail) return { success: false as const, error: "Graph 500" };
      capturedSends.push({ ...args });
      return { success: true as const };
    },
    ALLOWED_SENDERS: {},
  },
});

// ── Mock: emailVariableResolver ───────────────────────────────────────────────

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

// ── Mock: DB (query) ──────────────────────────────────────────────────────────
//
// A single mock closure with mutable control flags avoids ERR_INVALID_STATE
// from calling mock.module() a second time after the initial registration.

type MockQueryResult = { rows: Record<string, unknown>[] };
let queryResponses: MockQueryResult[] = [];
let queryCalls: Array<[string, unknown[]]> = [];
let queryShouldThrow = false;

mock.module("../db.js", {
  namedExports: {
    query: async (sql: string, params: unknown[] = []) => {
      queryCalls.push([sql, params]);
      if (queryShouldThrow) throw new Error("simulated DB error");
      const resp = queryResponses.shift() ?? { rows: [] };
      return resp;
    },
  },
});

// Dynamic import AFTER all mocks are registered
const {
  claimEmailDelivery,
  markEmailDeliveryResult,
  isEventAlreadyDelivered,
  sendJobApprovalCompanionEmail,
  sendClientNewApplicationEmail,
  sendUnreadMessageEmail,
  resetMessageEmailCooldown,
  MESSAGE_EMAIL_COOLDOWN_MINUTES,
} = await import("../services/emailCompanionService.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetMocks() {
  capturedSends = [];
  queryResponses = [];
  queryCalls = [];
  configuredResult = true;
  queryShouldThrow = false;
  sendShouldFail = false;
}

// ── claimEmailDelivery ────────────────────────────────────────────────────────

describe("claimEmailDelivery", () => {
  it("returns true when INSERT claims the slot (new row)", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ id: "new-claim" }] }); // RETURNING id
    const claimed = await claimEmailDelivery({
      eventKey: "key:claim-1",
      eventType: "test_event",
      recipientEmail: "a@test.com",
      recipientUserId: "u1",
      senderEmail: "s@test.com",
    });
    assert.equal(claimed, true);
    assert.equal(queryCalls.length, 1);
    assert.ok(queryCalls[0][0].includes("email_notification_deliveries"));
    assert.ok(queryCalls[0][0].includes("processing"));
  });

  it("returns false when INSERT returns no row (already sent or in-flight)", async () => {
    resetMocks();
    queryResponses.push({ rows: [] }); // no RETURNING row → already claimed
    const claimed = await claimEmailDelivery({
      eventKey: "key:claim-2",
      eventType: "test_event",
      recipientEmail: "b@test.com",
      recipientUserId: "u2",
      senderEmail: "s@test.com",
    });
    assert.equal(claimed, false);
  });

  it("fails open (returns true) when DB throws so delivery is not silenced", async () => {
    resetMocks();
    queryShouldThrow = true;
    try {
      const claimed = await claimEmailDelivery({
        eventKey: "key:claim-3",
        eventType: "test_event",
        recipientEmail: null,
        recipientUserId: "u3",
        senderEmail: "s@test.com",
      });
      assert.equal(claimed, true);
    } finally {
      queryShouldThrow = false;
    }
  });

  it("concurrent invocations — only one proceeds when second claim returns no row", async () => {
    resetMocks();
    // Simulate two concurrent calls: first wins, second gets no row back.
    let callCount = 0;
    queryResponses.push({ rows: [{ id: "first-wins" }] });  // call 1 → claimed
    queryResponses.push({ rows: [] });                       // call 2 → already claimed

    const [r1, r2] = await Promise.all([
      claimEmailDelivery({ eventKey: "key:concurrent", eventType: "e", recipientEmail: null, recipientUserId: "u", senderEmail: "s" }),
      claimEmailDelivery({ eventKey: "key:concurrent", eventType: "e", recipientEmail: null, recipientUserId: "u", senderEmail: "s" }),
    ]);

    const winners = [r1, r2].filter(Boolean).length;
    assert.equal(winners, 1, "exactly one concurrent claim should succeed");
  });

  it("failure recovery — claimEmailDelivery succeeds after a previous failure", async () => {
    resetMocks();
    // After status='failed', the DO UPDATE re-claims the slot → row returned
    queryResponses.push({ rows: [{ id: "retry-claim" }] });
    const claimed = await claimEmailDelivery({
      eventKey: "key:failed-retry",
      eventType: "test_event",
      recipientEmail: "c@test.com",
      recipientUserId: "u4",
      senderEmail: "s@test.com",
    });
    assert.equal(claimed, true, "retrying a failed delivery must be able to claim the slot");
  });
});

// ── markEmailDeliveryResult ───────────────────────────────────────────────────

describe("markEmailDeliveryResult", () => {
  it("issues an UPDATE with correct event_key and status", async () => {
    resetMocks();
    queryResponses.push({ rows: [] });
    await markEmailDeliveryResult({ eventKey: "ev:mark-1", status: "sent" });
    assert.equal(queryCalls.length, 1);
    const [sql, params] = queryCalls[0];
    assert.ok(sql.includes("UPDATE email_notification_deliveries"));
    assert.equal(params[0], "ev:mark-1");
    assert.equal(params[1], "sent");
  });

  it("is non-throwing when DB throws", async () => {
    resetMocks();
    queryShouldThrow = true;
    try {
      await assert.doesNotReject(() =>
        markEmailDeliveryResult({ eventKey: "ev:mark-2", status: "failed", error: "timeout" }),
      );
    } finally {
      queryShouldThrow = false;
    }
  });
});

// ── isEventAlreadyDelivered (read-only diagnostic) ────────────────────────────

describe("isEventAlreadyDelivered", () => {
  it("returns true when a sent row exists", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ id: "abc" }] });
    assert.equal(await isEventAlreadyDelivered("key:123"), true);
  });

  it("returns false when no row exists", async () => {
    resetMocks();
    queryResponses.push({ rows: [] });
    assert.equal(await isEventAlreadyDelivered("key:124"), false);
  });

  it("returns false (fail-open) when DB throws", async () => {
    resetMocks();
    queryShouldThrow = true;
    try {
      assert.equal(await isEventAlreadyDelivered("key:125"), false);
    } finally {
      queryShouldThrow = false;
    }
  });
});

// ── sendJobApprovalCompanionEmail ─────────────────────────────────────────────

describe("sendJobApprovalCompanionEmail", () => {
  it("resolves recipient first, then claims slot, then sends approved email", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "client@acme.com", first_name: "Alice" }] }); // recipient lookup
    queryResponses.push({ rows: [{ id: "c1" }] }); // claimEmailDelivery → claimed
    queryResponses.push({ rows: [] }); // markEmailDeliveryResult

    await sendJobApprovalCompanionEmail({
      jobId: "j1",
      jobTitle: "Product Designer",
      clientUserId: "u1",
      newStatus: "approved",
      transitionEventKey: "trans:001",
    });

    assert.equal(capturedSends.length, 1);
    assert.equal(capturedSends[0].to, "client@acme.com");
    assert.ok(capturedSends[0].subject.includes("approved"));
    // Privacy: email body must not include raw contact field labels
    assert.ok(!capturedSends[0].bodyHtml.includes("phone"));
  });

  it("skips silently when status is 'pending'", async () => {
    resetMocks();
    await sendJobApprovalCompanionEmail({
      jobId: "j2",
      jobTitle: "Designer",
      clientUserId: "u2",
      newStatus: "pending",
      transitionEventKey: "trans:002",
    });
    assert.equal(capturedSends.length, 0);
    assert.equal(queryCalls.length, 0);
  });

  it("skips when delivery slot cannot be claimed (concurrent/already sent)", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "c@c.com", first_name: "C" }] }); // recipient
    queryResponses.push({ rows: [] }); // claimEmailDelivery → no row (already sent)
    await sendJobApprovalCompanionEmail({
      jobId: "j3",
      jobTitle: "Engineer",
      clientUserId: "u3",
      newStatus: "approved",
      transitionEventKey: "trans:003",
    });
    assert.equal(capturedSends.length, 0);
  });

  it("two concurrent calls send exactly one email", async () => {
    resetMocks();
    // Both calls resolve recipient; only the first claim wins
    queryResponses.push({ rows: [{ email: "c@c.com", first_name: "A" }] }); // recipient call 1
    queryResponses.push({ rows: [{ id: "claim-win" }] });                   // claim call 1 → wins
    queryResponses.push({ rows: [] });                                        // mark call 1
    queryResponses.push({ rows: [{ email: "c@c.com", first_name: "A" }] }); // recipient call 2
    queryResponses.push({ rows: [] });                                        // claim call 2 → loses

    await Promise.all([
      sendJobApprovalCompanionEmail({ jobId: "jC", jobTitle: "Concurrent", clientUserId: "uC", newStatus: "approved", transitionEventKey: "trans:concurrent" }),
      sendJobApprovalCompanionEmail({ jobId: "jC", jobTitle: "Concurrent", clientUserId: "uC", newStatus: "approved", transitionEventKey: "trans:concurrent" }),
    ]);

    assert.equal(capturedSends.length, 1, "exactly one email must be sent despite two concurrent calls");
  });

  it("includes rejection reason in email body when provided", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "c@c.com", first_name: "Bob" }] });
    queryResponses.push({ rows: [{ id: "c4" }] });
    queryResponses.push({ rows: [] });

    await sendJobApprovalCompanionEmail({
      jobId: "j4",
      jobTitle: "Analyst",
      clientUserId: "u4",
      newStatus: "rejected",
      rejectionReason: "Job description too vague",
      transitionEventKey: "trans:004",
    });

    assert.ok(capturedSends[0].bodyHtml.includes("Job description too vague"));
  });

  it("HTML-escapes job title to prevent XSS", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "x@x.com", first_name: "X" }] });
    queryResponses.push({ rows: [{ id: "c5" }] });
    queryResponses.push({ rows: [] });

    await sendJobApprovalCompanionEmail({
      jobId: "j5",
      jobTitle: "<script>alert(1)</script>",
      clientUserId: "u5",
      newStatus: "approved",
      transitionEventKey: "trans:005",
    });

    const body = capturedSends[0].bodyHtml;
    assert.ok(!body.includes("<script>"), "raw <script> must not appear");
    assert.ok(body.includes("&lt;script&gt;"), "escaped form must appear");
  });

  it("marks delivery failed when Graph send fails", async () => {
    resetMocks();
    sendShouldFail = true;
    queryResponses.push({ rows: [{ email: "f@f.com", first_name: "Fail" }] });
    queryResponses.push({ rows: [{ id: "c6" }] }); // claim
    queryResponses.push({ rows: [] }); // markEmailDeliveryResult (failed)

    await sendJobApprovalCompanionEmail({
      jobId: "j6",
      jobTitle: "Test",
      clientUserId: "u6",
      newStatus: "approved",
      transitionEventKey: "trans:006",
    });

    // markEmailDeliveryResult must be called with status="failed"
    const updateCalls = queryCalls.filter(([sql]) => sql.includes("UPDATE email_notification_deliveries"));
    assert.ok(updateCalls.length > 0, "markEmailDeliveryResult must be called");
    assert.equal(updateCalls[0][1][1], "failed");
  });

  it("is non-throwing when email service is not configured", async () => {
    resetMocks();
    configuredResult = false;
    await assert.doesNotReject(() =>
      sendJobApprovalCompanionEmail({
        jobId: "j7",
        jobTitle: "T",
        clientUserId: "u7",
        newStatus: "approved",
        transitionEventKey: "trans:007",
      }),
    );
    assert.equal(capturedSends.length, 0);
  });

  it("is non-throwing when DB throws unexpectedly", async () => {
    resetMocks();
    queryShouldThrow = true;
    try {
      await assert.doesNotReject(() =>
        sendJobApprovalCompanionEmail({
          jobId: "j8",
          jobTitle: "T",
          clientUserId: "u8",
          newStatus: "rejected",
          transitionEventKey: "trans:008",
        }),
      );
    } finally {
      queryShouldThrow = false;
    }
    assert.equal(capturedSends.length, 0);
  });
});

// ── sendClientNewApplicationEmail ─────────────────────────────────────────────

describe("sendClientNewApplicationEmail", () => {
  it("claims slot atomically before sending; body includes display name but no contact details", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "pm@co.com", first_name: "Priya" }] }); // recipient
    queryResponses.push({ rows: [{ id: "claim-app" }] }); // claimEmailDelivery
    queryResponses.push({ rows: [] }); // markEmailDeliveryResult

    await sendClientNewApplicationEmail({
      submissionId: "sub:1",
      clientUserId: "c1",
      applicantDisplayName: "Jane D.",
      jobTitle: "Senior UX Designer",
    });

    assert.equal(capturedSends.length, 1);
    assert.equal(capturedSends[0].to, "pm@co.com");
    assert.ok(capturedSends[0].bodyHtml.includes("Jane D."));
    // Privacy: no raw email or phone in the body
    assert.ok(!capturedSends[0].bodyHtml.toLowerCase().includes("phone"));
  });

  it("is idempotent — skips on second call when claim returns no row", async () => {
    resetMocks();
    // Second call: claim returns no row (already sent)
    queryResponses.push({ rows: [{ email: "a@b.com", first_name: "A" }] });
    queryResponses.push({ rows: [] }); // claim → no row
    await sendClientNewApplicationEmail({ submissionId: "sub:2", clientUserId: "c2", applicantDisplayName: "X", jobTitle: "Y" });
    assert.equal(capturedSends.length, 0);
  });

  it("HTML-escapes applicant display name to prevent XSS", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "e@e.com", first_name: "E" }] });
    queryResponses.push({ rows: [{ id: "claim-xss" }] });
    queryResponses.push({ rows: [] });

    await sendClientNewApplicationEmail({
      submissionId: "sub:3",
      clientUserId: "c3",
      applicantDisplayName: `<img src=x onerror=alert(1)>`,
      jobTitle: "Tester",
    });

    const body = capturedSends[0].bodyHtml;
    assert.ok(!body.includes("<img"), "raw <img> must not appear");
    assert.ok(body.includes("&lt;img"), "escaped form must appear");
  });

  it("is non-throwing when email service is not configured", async () => {
    resetMocks();
    configuredResult = false;
    await assert.doesNotReject(() =>
      sendClientNewApplicationEmail({
        submissionId: "sub:4",
        clientUserId: "c4",
        applicantDisplayName: "X",
        jobTitle: "Y",
      }),
    );
  });
});

// ── sendUnreadMessageEmail ─────────────────────────────────────────────────────

describe("sendUnreadMessageEmail", () => {
  it("sends email when cooldown slot is successfully acquired", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "talent@co.com", first_name: "Tom" }] }); // recipient
    queryResponses.push({ rows: [{ id: "cd1" }] }); // cooldown slot acquired

    await sendUnreadMessageEmail({ recipientUserId: "u1", threadId: "t1", senderName: "Alice" });

    assert.equal(capturedSends.length, 1);
    assert.equal(capturedSends[0].to, "talent@co.com");
    assert.ok(capturedSends[0].subject.includes("Alice"));
    // No message body content should appear
    assert.ok(!capturedSends[0].bodyHtml.includes("message content"));
  });

  it("skips silently when within cooldown window (no row from INSERT)", async () => {
    resetMocks();
    queryResponses.push({ rows: [{ email: "u@u.com", first_name: "U" }] }); // recipient
    queryResponses.push({ rows: [] }); // cooldown → no slot (within window)

    await sendUnreadMessageEmail({ recipientUserId: "u2", threadId: "t2", senderName: "Bob" });
    assert.equal(capturedSends.length, 0);
  });

  it("resets cooldown on send failure and does not throw", async () => {
    resetMocks();
    sendShouldFail = true;
    queryResponses.push({ rows: [{ email: "u@u.com", first_name: "U" }] }); // recipient
    queryResponses.push({ rows: [{ id: "cd2" }] }); // cooldown claimed
    queryResponses.push({ rows: [] }); // DELETE cooldown on failure

    await assert.doesNotReject(() =>
      sendUnreadMessageEmail({ recipientUserId: "u3", threadId: "t3", senderName: "C" }),
    );

    // DELETE must have been called to reset the cooldown
    const deleteCalls = queryCalls.filter(
      ([sql]) => sql.includes("DELETE FROM message_email_cooldowns"),
    );
    assert.ok(deleteCalls.length > 0, "cooldown DELETE must be called after send failure");
  });

  it("is non-throwing when recipient not found", async () => {
    resetMocks();
    queryResponses.push({ rows: [] }); // no user row

    await assert.doesNotReject(() =>
      sendUnreadMessageEmail({ recipientUserId: "u4", threadId: "t4", senderName: "D" }),
    );
    assert.equal(capturedSends.length, 0);
  });

  it("is non-throwing when email service is not configured", async () => {
    resetMocks();
    configuredResult = false;
    await assert.doesNotReject(() =>
      sendUnreadMessageEmail({ recipientUserId: "u5", threadId: "t5", senderName: "E" }),
    );
  });

  it("exposes a positive cooldown constant", () => {
    assert.ok(
      typeof MESSAGE_EMAIL_COOLDOWN_MINUTES === "number" && MESSAGE_EMAIL_COOLDOWN_MINUTES > 0,
    );
  });
});

// ── resetMessageEmailCooldown ─────────────────────────────────────────────────

describe("resetMessageEmailCooldown", () => {
  it("issues a DELETE for the correct thread and user", async () => {
    resetMocks();
    queryResponses.push({ rows: [] });
    await resetMessageEmailCooldown("userId", "threadId");
    assert.equal(queryCalls.length, 1);
    const [sql, params] = queryCalls[0];
    assert.ok(sql.includes("DELETE FROM message_email_cooldowns"));
    assert.deepEqual(params, ["threadId", "userId"]);
  });

  it("is non-throwing when DB throws", async () => {
    resetMocks();
    queryShouldThrow = true;
    try {
      await assert.doesNotReject(() => resetMessageEmailCooldown("u", "t"));
    } finally {
      queryShouldThrow = false;
    }
  });
});
