/**
 * interview-email-payload.test.ts
 *
 * Payload-inspection tests for sendInterviewConfirmedEmailToClient.
 *
 * These tests assert that the email payload actually delivered to
 * sendApplicantEmail is well-formed: correct subject, resolved talent name,
 * and correct meeting-link / fallback copy.
 *
 * Why a separate file?
 *   Node's mock.module() must be called before the module-under-test is
 *   imported. Static import statements are hoisted, so this file uses a
 *   top-level dynamic import AFTER mock.module() is registered, then re-uses
 *   the captured reference throughout all test suites.
 *
 * Run with:  npm test
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db.js";

// ── Spy setup ─────────────────────────────────────────────────────────────────
//
// Capture every call to sendApplicantEmail so tests can inspect subject/body.
// mock.module() must be called before the dynamic import below.

interface CapturedEmailCall {
  to: string;
  toName?: string;
  subject: string;
  bodyHtml: string;
}

const capturedCalls: CapturedEmailCall[] = [];

mock.module("../services/microsoftGraphEmailService.js", {
  namedExports: {
    isEmailServiceConfigured: () => true,
    sendApplicantEmail: async (args: CapturedEmailCall) => {
      capturedCalls.push({ ...args });
      return { success: true };
    },
  },
});

// Dynamic import AFTER the mock is registered so the service module sees the
// mock instead of the real Microsoft Graph email service.
const { sendInterviewConfirmedEmailToClient } = await import(
  "../services/interviewEmailService.js"
);

// ── Test fixture IDs ──────────────────────────────────────────────────────────

const suffix = `${Date.now()}-iep`;
const CLIENT_USER_ID = `iep-client-${suffix}`;
const TALENT_USER_ID = `iep-talent-${suffix}`;

const CLIENT_FIRST = "Payload";
const CLIENT_LAST = "Client";
const TALENT_FIRST = "Ada";
const TALENT_LAST = "Lovelace";

// ── Fixtures ──────────────────────────────────────────────────────────────────

before(async () => {
  await query(
    `INSERT INTO users (id, email, first_name, last_name, role)
     VALUES
       ($1, $2, $3, $4, 'client'),
       ($5, $6, $7, $8, 'talent')
     ON CONFLICT (id) DO NOTHING`,
    [
      CLIENT_USER_ID,
      `${CLIENT_USER_ID}@test.example`,
      CLIENT_FIRST,
      CLIENT_LAST,
      TALENT_USER_ID,
      `${TALENT_USER_ID}@test.example`,
      TALENT_FIRST,
      TALENT_LAST,
    ],
  );
});

after(async () => {
  await query(
    `DELETE FROM notifications WHERE user_id = ANY($1::text[])`,
    [[CLIENT_USER_ID, TALENT_USER_ID]],
  ).catch(() => {});
  await query(
    `DELETE FROM users WHERE id = ANY($1::text[])`,
    [[CLIENT_USER_ID, TALENT_USER_ID]],
  ).catch(() => {});
});

// ── Helper ────────────────────────────────────────────────────────────────────

/** Drain one captured call; throws if none arrived. */
function popCall(): CapturedEmailCall {
  const call = capturedCalls.pop();
  assert.ok(call, "Expected sendApplicantEmail to have been called, but no call was captured");
  return call;
}

// ── (d) Subject line assertions ───────────────────────────────────────────────

describe("sendInterviewConfirmedEmailToClient — subject line", () => {
  it("(d1) subject contains the job title when roundNumber is not set", async () => {
    capturedCalls.length = 0;

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "Frontend Engineer",
      confirmedTime: "2025-10-01T10:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 45,
      meetingLink: null,
    });

    const call = popCall();
    assert.ok(
      call.subject.includes("Frontend Engineer"),
      `Subject should contain the job title "Frontend Engineer" — got: ${JSON.stringify(call.subject)}`,
    );
  });

  it("(d2) subject contains the job title AND round label when roundNumber is set", async () => {
    capturedCalls.length = 0;

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "Backend Engineer",
      confirmedTime: "2025-10-02T14:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 60,
      meetingLink: null,
      roundNumber: 3,
    });

    const call = popCall();
    assert.ok(
      call.subject.includes("Backend Engineer"),
      `Subject should contain the job title "Backend Engineer" — got: ${JSON.stringify(call.subject)}`,
    );
    assert.ok(
      call.subject.includes("Round 3"),
      `Subject should contain "Round 3" — got: ${JSON.stringify(call.subject)}`,
    );
  });

  it("(d3) subject does not contain HTML-escaped entities from the job title", async () => {
    capturedCalls.length = 0;

    // A title with characters that might be HTML-escaped
    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "Product Manager & Lead",
      confirmedTime: "2025-10-03T09:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 30,
      meetingLink: null,
      roundNumber: 1,
    });

    const call = popCall();
    assert.ok(
      !call.subject.includes("&amp;"),
      `Subject must not contain HTML-escaped entities — got: ${JSON.stringify(call.subject)}`,
    );
    assert.ok(
      call.subject.includes("Product Manager & Lead"),
      `Subject should include the literal job title — got: ${JSON.stringify(call.subject)}`,
    );
  });
});

// ── (e) Body — talent name resolution ────────────────────────────────────────

describe("sendInterviewConfirmedEmailToClient — body talent name", () => {
  it("(e1) body contains the resolved talent full name when the talent row exists", async () => {
    capturedCalls.length = 0;

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "UX Researcher",
      confirmedTime: "2025-10-04T11:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 60,
      meetingLink: null,
    });

    const call = popCall();
    const expectedName = `${TALENT_FIRST} ${TALENT_LAST}`; // "Ada Lovelace"
    assert.ok(
      call.bodyHtml.includes(expectedName),
      `Body should contain the talent name "${expectedName}" — body snippet: ${call.bodyHtml.slice(0, 500)}`,
    );
  });

  it("(e2) body does not contain the generic fallback when talent row exists", async () => {
    capturedCalls.length = 0;

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "Data Scientist",
      confirmedTime: "2025-10-05T13:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 45,
      meetingLink: null,
    });

    const call = popCall();
    // The fallback phrase "The talent" must not appear when the name resolved correctly
    assert.ok(
      !call.bodyHtml.includes(">The talent<"),
      `Body should not use the fallback "The talent" when the talent row exists — body snippet: ${call.bodyHtml.slice(0, 500)}`,
    );
  });

  it("(e3) body contains the 'The talent' fallback when talent row is absent", async () => {
    capturedCalls.length = 0;

    const unknownTalentId = "00000000-0000-0000-ffff-000000000001";

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: unknownTalentId,
      jobTitle: "Cloud Architect",
      confirmedTime: "2025-10-06T15:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 30,
      meetingLink: null,
    });

    const call = popCall();
    assert.ok(
      call.bodyHtml.includes("The talent"),
      `Body should use the "The talent" fallback when the talent row is absent — body snippet: ${call.bodyHtml.slice(0, 500)}`,
    );
  });
});

// ── (f) Body — meeting link ───────────────────────────────────────────────────

describe("sendInterviewConfirmedEmailToClient — body meeting link", () => {
  it("(f1) body includes the meeting link URL when one is supplied", async () => {
    capturedCalls.length = 0;

    const meetingLink = "https://meet.example.com/interview-xyz";

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "DevOps Engineer",
      confirmedTime: "2025-10-07T10:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 45,
      meetingLink,
    });

    const call = popCall();
    assert.ok(
      call.bodyHtml.includes(meetingLink),
      `Body should contain the meeting link URL "${meetingLink}" — body snippet: ${call.bodyHtml.slice(0, 800)}`,
    );
  });

  it("(f2) body includes fallback copy when meeting link is null", async () => {
    capturedCalls.length = 0;

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "QA Engineer",
      confirmedTime: "2025-10-08T11:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 30,
      meetingLink: null,
    });

    const call = popCall();
    // The no-link fallback copy from interviewEmailService.ts
    assert.ok(
      call.bodyHtml.includes("No meeting link has been attached yet"),
      `Body should contain the no-link fallback copy when meetingLink is null — body snippet: ${call.bodyHtml.slice(0, 800)}`,
    );
  });

  it("(f3) body does not contain fallback copy when a meeting link is supplied", async () => {
    capturedCalls.length = 0;

    await sendInterviewConfirmedEmailToClient({
      clientUserId: CLIENT_USER_ID,
      talentUserId: TALENT_USER_ID,
      jobTitle: "Site Reliability Engineer",
      confirmedTime: "2025-10-09T14:00:00.000Z",
      confirmedTimeZone: "UTC",
      durationMinutes: 60,
      meetingLink: "https://meet.example.com/interview-sre",
    });

    const call = popCall();
    assert.ok(
      !call.bodyHtml.includes("No meeting link has been attached yet"),
      `Body must not show the no-link fallback when a meeting link is supplied — body snippet: ${call.bodyHtml.slice(0, 800)}`,
    );
  });
});
