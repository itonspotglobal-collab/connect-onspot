/**
 * Production-route smoke coverage for the client invitation → talent response
 * → interview confirmation path.
 *
 * The fixtures use synthetic IDs and are removed in after(). No credentials or
 * real hiring records are used, and the test exercises registerRoutes rather
 * than a copy of the route handlers.
 *
 * Run with: npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";
import { formatInterviewTime } from "../../client/src/lib/formatInterviewTime.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();

const CLIENT_ID = `invite-smoke-client-${suffix}`;
const OTHER_CLIENT_ID = `invite-smoke-other-client-${suffix}`;
const TALENT_ID = `invite-smoke-talent-${suffix}`;
const CANDIDATE_ID = `invite-smoke-candidate-${suffix}`;
const CLIENT_CANDIDATE_ID = `invite-smoke-client-candidate-${suffix}`;
const OPEN_JOB_ID = `invite-smoke-open-${suffix}`;
const PENDING_JOB_ID = `invite-smoke-pending-${suffix}`;
const CLOSED_JOB_ID = `invite-smoke-closed-${suffix}`;
const OTHER_CLIENT_JOB_ID = `invite-smoke-other-job-${suffix}`;
const INTERVIEW_TIMEZONE = "Asia/Manila";
const INTERVIEW_TIME = "2030-08-22T09:00:00.000Z";
const FIRST_COUNTER_TIME = "2030-08-23T09:00:00.000Z";
const SECOND_COUNTER_TIME = "2030-08-24T09:00:00.000Z";
const MEETING_LINK = "https://meet.google.com/test-meeting";
const SEARCH_TERM = `TimezoneSmokeSkill${suffix}`;
const previousInvitationEmailTransport = process.env.INVITATION_EMAIL_TRANSPORT;

const clientToken = jwt.sign(
  { userId: CLIENT_ID, email: `${CLIENT_ID}@test.example`, role: "client" },
  JWT_SECRET,
  { expiresIn: "1h" },
);
const otherClientToken = jwt.sign(
  { userId: OTHER_CLIENT_ID, email: `${OTHER_CLIENT_ID}@test.example`, role: "client" },
  JWT_SECRET,
  { expiresIn: "1h" },
);
const talentToken = jwt.sign(
  { userId: TALENT_ID, email: `${TALENT_ID}@test.example`, role: "talent" },
  JWT_SECRET,
  { expiresIn: "1h" },
);
const candidateToken = jwt.sign(
  { type: "candidate", candidateId: CANDIDATE_ID, email: `${TALENT_ID}@test.example` },
  JWT_SECRET,
  { expiresIn: "1h" },
);

function request(
  server: http.Server,
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = JSON.parse(responseBody);
          } catch {
            // Keep the status code useful if an unexpected non-JSON error occurs.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function cleanup() {
  const userIds = [CLIENT_ID, OTHER_CLIENT_ID, TALENT_ID];
  const jobIds = [OPEN_JOB_ID, PENDING_JOB_ID, CLOSED_JOB_ID, OTHER_CLIENT_JOB_ID];

  await query(
    `DELETE FROM interview_proposals
      WHERE interview_id IN (
        SELECT i.id
          FROM interviews i
          JOIN job_submissions js ON js.id = i.submission_id
         WHERE js.job_id = ANY($1::varchar[])
      )`,
    [jobIds],
  ).catch(() => {});
  await query(
    `DELETE FROM interviews
      WHERE submission_id IN (
        SELECT id FROM job_submissions WHERE job_id = ANY($1::varchar[])
      )`,
    [jobIds],
  ).catch(() => {});
  await query(
    `DELETE FROM job_application_status_history
      WHERE application_id IN (
        SELECT id FROM job_submissions WHERE job_id = ANY($1::varchar[])
      )`,
    [jobIds],
  ).catch(() => {});
  await query(
    `DELETE FROM messages
      WHERE thread_id IN (
        SELECT id
          FROM message_threads
         WHERE participants && $1::text[]
      )`,
    [[CLIENT_ID, TALENT_ID]],
  ).catch(() => {});
  await query(
    `DELETE FROM message_threads WHERE participants && $1::text[]`,
    [[CLIENT_ID, TALENT_ID]],
  ).catch(() => {});
  await query(`DELETE FROM job_submissions WHERE job_id = ANY($1::varchar[])`, [jobIds]).catch(() => {});
  await query(`DELETE FROM jobs WHERE id = ANY($1::varchar[])`, [jobIds]).catch(() => {});
  await query(`DELETE FROM client_profiles WHERE user_id = ANY($1::varchar[])`, [[CLIENT_ID, OTHER_CLIENT_ID]]).catch(() => {});
  await query(`DELETE FROM profiles WHERE user_id = $1`, [TALENT_ID]).catch(() => {});
  await query(`DELETE FROM candidates WHERE id = ANY($1::varchar[])`, [[CANDIDATE_ID, CLIENT_CANDIDATE_ID]]).catch(() => {});
  await query(`DELETE FROM notifications WHERE user_id = ANY($1::varchar[])`, [userIds]).catch(() => {});
  await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [userIds]).catch(() => {});
}

async function createFixtures() {
  await cleanup();

  await query(
    `INSERT INTO users (id, email, first_name, last_name, role)
     VALUES
       ($1, $2, 'Smoke', 'Client', 'client'),
       ($3, $4, 'Smoke', 'Other Client', 'client'),
       ($5, $6, 'Smoke', 'Talent', 'talent')`,
    [
      CLIENT_ID,
      `${CLIENT_ID}@test.example`,
      OTHER_CLIENT_ID,
      `${OTHER_CLIENT_ID}@test.example`,
      TALENT_ID,
      `${TALENT_ID}@test.example`,
    ],
  );
  await query(
    `INSERT INTO client_profiles (user_id, msa_accepted_at, msa_version)
     VALUES ($1, NOW(), '2026-08-14')`,
    [CLIENT_ID],
  );
  await query(
    `INSERT INTO candidates
       (id, user_id, email, full_name, first_name, last_name, target_position,
        category, core_skills, profile_completed)
     VALUES
       ($1, $2, $3, 'Smoke Talent', 'Smoke', 'Talent', 'Timezone smoke talent',
        'Technical', $4, true),
       ($5, $6, $7, 'Smoke Client Candidate', 'Smoke', 'Client Candidate',
        'Timezone smoke decoy', 'Technical', $4, true)`,
    [
      CANDIDATE_ID,
      TALENT_ID,
      `${TALENT_ID}@test.example`,
      [SEARCH_TERM],
      CLIENT_CANDIDATE_ID,
      CLIENT_ID,
      `${CLIENT_ID}@test.example`,
    ],
  );

  await query(
    `INSERT INTO jobs
       (id, client_id, title, description, category, experience_level,
        engagement_type, status, approval_status, skill_tags)
     VALUES
       ($1, $2, 'Smoke open approved job', 'Synthetic smoke fixture', 'Technical',
        'intermediate', 'Standard', 'open', 'approved', $5),
       ($3, $2, 'Smoke pending job', 'Synthetic smoke fixture', 'Technical',
        'intermediate', 'Standard', 'open', 'pending', $5),
       ($4, $2, 'Smoke closed job', 'Synthetic smoke fixture', 'Technical',
        'intermediate', 'Standard', 'closed', 'approved', $5),
       ($6, $7, 'Smoke other-client job', 'Synthetic smoke fixture', 'Technical',
        'intermediate', 'Standard', 'open', 'approved', $5)`,
    [
      OPEN_JOB_ID,
      CLIENT_ID,
      PENDING_JOB_ID,
      CLOSED_JOB_ID,
      [SEARCH_TERM],
      OTHER_CLIENT_JOB_ID,
      OTHER_CLIENT_ID,
    ],
  );
}

describe("invitation and interview timezone production smoke path", () => {
  let server: http.Server;

  before(async () => {
    process.env.INVITATION_EMAIL_TRANSPORT = "noop";
    await createFixtures();
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    server?.close();
    await cleanup();
    if (previousInvitationEmailTransport === undefined) {
      delete process.env.INVITATION_EMAIL_TRANSPORT;
    } else {
      process.env.INVITATION_EMAIL_TRANSPORT = previousInvitationEmailTransport;
    }
  });

  it("returns only current talent accounts from the client search", async () => {
    const response = await request(server, "POST", "/api/client/talent-search", clientToken, {
      searchText: SEARCH_TERM,
      category: "Technical",
      engagementType: "Standard",
    });

    assert.equal(response.status, 200, JSON.stringify(response.json));
    const results = response.json.results as Array<{ userId: string; candidateId: string }>;
    assert.ok(results.some((result) => result.userId === TALENT_ID && result.candidateId === CANDIDATE_ID));
    assert.ok(
      !results.some((result) => result.userId === CLIENT_ID || result.candidateId === CLIENT_CANDIDATE_ID),
      "client accounts must not be returned as talent search results",
    );

    const returnedUserIds = results.map((result) => result.userId);
    if (returnedUserIds.length > 0) {
      const roles = await query(`SELECT id, role FROM users WHERE id = ANY($1::varchar[])`, [returnedUserIds]);
      assert.ok(roles.rows.every((row) => row.role === "talent"), "every returned account must have the talent role");
    }
  });

  it("requires an open approved owned job before creating an invitation", async () => {
    const readiness = await request(server, "GET", "/api/client/invitation-readiness", clientToken);
    assert.equal(readiness.status, 200, JSON.stringify(readiness.json));
    const readyJobIds = readiness.json.jobs.map((job: { id: string }) => job.id);
    assert.ok(readyJobIds.includes(OPEN_JOB_ID));
    assert.ok(readyJobIds.includes(PENDING_JOB_ID));
    assert.ok(readyJobIds.includes(CLOSED_JOB_ID));
    assert.ok(!readyJobIds.includes(OTHER_CLIENT_JOB_ID), "readiness must only expose the authenticated client's jobs");
    assert.equal(readiness.json.summary.openApprovedCount, 1);

    const pending = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }],
    });
    assert.equal(pending.status, 403, JSON.stringify(pending.json));
    assert.equal(pending.json.reason, "pending_approval");

    const closed = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: CLOSED_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }],
    });
    assert.equal(closed.status, 403, JSON.stringify(closed.json));
    assert.equal(closed.json.reason, "closed_jobs");

    const otherOwner = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: OTHER_CLIENT_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }],
    });
    assert.equal(otherOwner.status, 403, JSON.stringify(otherOwner.json));
  });

  it("propagates the selected IANA timezone through invitation, talent, and client responses", async () => {
    const invalidMeetingLink = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: OPEN_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }],
      meetingLink: "javascript:alert(1)",
    });
    assert.equal(invalidMeetingLink.status, 400, JSON.stringify(invalidMeetingLink.json));

    const invitation = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: OPEN_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }],
      meetingLink: `  ${MEETING_LINK}  `,
      interviewType: "initial",
    });
    assert.equal(invitation.status, 201, JSON.stringify(invitation.json));
    assert.ok(invitation.json.id);
    assert.equal(invitation.json.emailSent, true);
    assert.equal(invitation.json.interview.proposed_times[0].timezone, INTERVIEW_TIMEZONE);
    assert.equal(invitation.json.interview.meeting_link, MEETING_LINK);

    const pendingInvitations = await request(server, "GET", "/api/talent/invitations", talentToken);
    assert.equal(pendingInvitations.status, 200, JSON.stringify(pendingInvitations.json));
    const pendingInvitation = pendingInvitations.json.find((row: { id: string }) => row.id === invitation.json.id);
    assert.ok(pendingInvitation);
    assert.equal(pendingInvitation.proposedTimes[0].timezone, INTERVIEW_TIMEZONE);
    assert.equal(pendingInvitation.meetingLink, MEETING_LINK);

    const hiddenPendingInterviews = await request(server, "GET", "/api/talent/interviews", candidateToken);
    assert.equal(hiddenPendingInterviews.status, 200, JSON.stringify(hiddenPendingInterviews.json));
    assert.ok(
      !hiddenPendingInterviews.json.some((row: { id: string }) => row.id === invitation.json.interview.id),
      "a Client-invitation interview must remain hidden until the Role Invitation is accepted",
    );

    const accepted = await request(
      server,
      "POST",
      `/api/talent/invitations/${invitation.json.id}/respond`,
      talentToken,
      { action: "accept" },
    );
    assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
    assert.equal(accepted.json.status, "new");

    const acceptanceNotifications = await query(
      `SELECT id, user_id, type, related_id, related_type, event_key, is_read
         FROM notifications
        WHERE event_key = $1`,
      [`talent-invitation-accepted:${invitation.json.id}`],
    );
    assert.equal(acceptanceNotifications.rows.length, 1);
    assert.equal(acceptanceNotifications.rows[0].user_id, CLIENT_ID);
    assert.equal(acceptanceNotifications.rows[0].type, "talent_invitation_accepted");
    assert.equal(acceptanceNotifications.rows[0].related_id, invitation.json.id);
    assert.equal(acceptanceNotifications.rows[0].related_type, "job_submission");
    assert.equal(acceptanceNotifications.rows[0].is_read, false);

    const acceptanceDetails = await request(
      server,
      "GET",
      `/api/client/notification-details/${acceptanceNotifications.rows[0].id}`,
      clientToken,
    );
    assert.equal(acceptanceDetails.status, 200, JSON.stringify(acceptanceDetails.json));
    assert.equal(acceptanceDetails.json.talentName, "Smoke Talent");
    assert.equal(acceptanceDetails.json.jobTitle, "Smoke open approved job");
    assert.equal(acceptanceDetails.json.invitationStatus, "Accepted");
    assert.equal(acceptanceDetails.json.interview.id, invitation.json.interview.id);
    assert.equal(acceptanceDetails.json.interview.proposedTimes[0].timezone, INTERVIEW_TIMEZONE);

    const forbiddenAcceptanceDetails = await request(
      server,
      "GET",
      `/api/client/notification-details/${acceptanceNotifications.rows[0].id}`,
      otherClientToken,
    );
    assert.equal(forbiddenAcceptanceDetails.status, 404);

    const markedRead = await request(
      server,
      "PATCH",
      `/api/notifications/${acceptanceNotifications.rows[0].id}/read`,
      clientToken,
    );
    assert.equal(markedRead.status, 204, JSON.stringify(markedRead.json));
    const readState = await query(`SELECT is_read FROM notifications WHERE id = $1`, [acceptanceNotifications.rows[0].id]);
    assert.equal(readState.rows[0].is_read, true);

    const repeatedAcceptance = await request(
      server,
      "POST",
      `/api/talent/invitations/${invitation.json.id}/respond`,
      talentToken,
      { action: "accept" },
    );
    assert.equal(repeatedAcceptance.status, 409);
    const acceptanceCount = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE event_key = $1`,
      [`talent-invitation-accepted:${invitation.json.id}`],
    );
    assert.equal(acceptanceCount.rows[0].count, 1);

    const talentInterviews = await request(server, "GET", "/api/talent/interviews", candidateToken);
    assert.equal(talentInterviews.status, 200, JSON.stringify(talentInterviews.json));
    const talentInterview = talentInterviews.json.find(
      (row: { id: string }) => row.id === invitation.json.interview.id,
    );
    assert.ok(talentInterview);
    assert.equal(talentInterview.proposedTimes[0].timezone, INTERVIEW_TIMEZONE);
    assert.equal(talentInterview.meetingLink, MEETING_LINK);
    assert.equal(talentInterview.confirmedTimeZone, "UTC", "an unconfirmed interview should use the explicit UTC response default");

    const firstCounter = await request(
      server,
      "PATCH",
      `/api/talent/interviews/${invitation.json.interview.id}/respond`,
      candidateToken,
      {
        action: "counter",
        proposedTimes: [{ start: FIRST_COUNTER_TIME, timezone: INTERVIEW_TIMEZONE }],
      },
    );
    assert.equal(firstCounter.status, 200, JSON.stringify(firstCounter.json));
    assert.equal(firstCounter.json.current_proposal_owner, "client");

    const firstCounterProposal = await query(
      `SELECT id FROM interview_proposals
        WHERE interview_id = $1 AND proposer_role = 'talent' AND action = 'counter'
        ORDER BY created_at DESC LIMIT 1`,
      [invitation.json.interview.id],
    );
    const firstCounterEventKey = `interview-proposal:${firstCounterProposal.rows[0].id}`;
    const firstCounterNotifications = await query(
      `SELECT id, user_id, type, related_id, related_type
         FROM notifications WHERE event_key = $1`,
      [firstCounterEventKey],
    );
    assert.equal(firstCounterNotifications.rows.length, 1);
    assert.equal(firstCounterNotifications.rows[0].user_id, CLIENT_ID);
    assert.equal(firstCounterNotifications.rows[0].type, "interview_reschedule_proposed");
    assert.equal(firstCounterNotifications.rows[0].related_id, invitation.json.interview.id);
    assert.equal(firstCounterNotifications.rows[0].related_type, "interview");

    const counterDetails = await request(
      server,
      "GET",
      `/api/client/notification-details/${firstCounterNotifications.rows[0].id}`,
      clientToken,
    );
    assert.equal(counterDetails.status, 200, JSON.stringify(counterDetails.json));
    assert.equal(counterDetails.json.interview.currentProposalOwner, "client");
    assert.equal(
      counterDetails.json.interview.proposals.at(-1).proposedTimes[0].start,
      FIRST_COUNTER_TIME,
    );

    const staleClientAcceptance = await request(
      server,
      "PATCH",
      `/api/client/interviews/${invitation.json.interview.id}`,
      clientToken,
      {
        status: "confirmed",
        confirmedTime: INTERVIEW_TIME,
      },
    );
    assert.equal(staleClientAcceptance.status, 400);

    const clientAcceptsTalentTime = await request(
      server,
      "PATCH",
      `/api/client/interviews/${invitation.json.interview.id}`,
      clientToken,
      {
        status: "confirmed",
        confirmedTime: FIRST_COUNTER_TIME,
      },
    );
    assert.equal(clientAcceptsTalentTime.status, 200, JSON.stringify(clientAcceptsTalentTime.json));
    assert.equal(clientAcceptsTalentTime.json.status, "confirmed");
    assert.equal(new Date(clientAcceptsTalentTime.json.confirmed_time).toISOString(), FIRST_COUNTER_TIME);
    assert.equal(clientAcceptsTalentTime.json.confirmed_time_zone, INTERVIEW_TIMEZONE);

    const talentConfirmationNotification = await query(
      `SELECT COUNT(*)::int AS count
         FROM notifications
        WHERE user_id = $1 AND type = 'interview_confirmed' AND related_id = $2`,
      [TALENT_ID, invitation.json.interview.id],
    );
    assert.equal(talentConfirmationNotification.rows[0].count, 1);

    const repeatedClientAcceptance = await request(
      server,
      "PATCH",
      `/api/client/interviews/${invitation.json.interview.id}`,
      clientToken,
      { status: "confirmed", confirmedTime: FIRST_COUNTER_TIME },
    );
    assert.equal(repeatedClientAcceptance.status, 409);

    const secondInterview = await request(
      server,
      "POST",
      "/api/client/interviews",
      clientToken,
      {
        submissionId: invitation.json.id,
        interviewType: "technical",
        proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }],
        durationMinutes: 60,
        meetingLink: MEETING_LINK,
      },
    );
    assert.equal(secondInterview.status, 201, JSON.stringify(secondInterview.json));
    const secondInterviewId = secondInterview.json.id;

    const secondCounter = await request(
      server,
      "PATCH",
      `/api/talent/interviews/${secondInterviewId}/respond`,
      candidateToken,
      {
        action: "counter",
        proposedTimes: [{ start: SECOND_COUNTER_TIME, timezone: INTERVIEW_TIMEZONE }],
      },
    );
    assert.equal(secondCounter.status, 200, JSON.stringify(secondCounter.json));
    const counterNotificationCount = await query(
      `SELECT COUNT(*)::int AS count
         FROM notifications
        WHERE user_id = $1 AND type = 'interview_reschedule_proposed'
          AND related_id = $2`,
      [CLIENT_ID, secondInterviewId],
    );
    assert.equal(counterNotificationCount.rows[0].count, 1);

    const clientRepliesAgain = await request(
      server,
      "PATCH",
      `/api/client/interviews/${secondInterviewId}`,
      clientToken,
      { proposedTimes: [{ start: INTERVIEW_TIME, timezone: INTERVIEW_TIMEZONE }] },
    );
    assert.equal(clientRepliesAgain.status, 200, JSON.stringify(clientRepliesAgain.json));
    assert.equal(clientRepliesAgain.json.current_proposal_owner, "talent");
    assert.equal(clientRepliesAgain.json.status, "proposed");

    const clientCounterNotification = await query(
      `SELECT COUNT(*)::int AS count
         FROM notifications
        WHERE user_id = $1 AND type = 'interview_rescheduled' AND related_id = $2`,
      [TALENT_ID, secondInterviewId],
    );
    assert.equal(clientCounterNotification.rows[0].count, 1);

    const proposalHistory = await query(
      `SELECT proposer_role, action, proposed_times
         FROM interview_proposals
        WHERE interview_id = $1
        ORDER BY created_at ASC`,
      [secondInterviewId],
    );
    assert.ok(
      proposalHistory.rows.some((proposal: any) =>
        proposal.proposer_role === "talent"
        && proposal.action === "counter"
        && proposal.proposed_times[0].start === SECOND_COUNTER_TIME),
      "Talent proposal B must remain in immutable history after Client proposal C",
    );

    const interviewCountBeforeFinalAcceptance = await query(
      `SELECT COUNT(*)::int AS count FROM interviews WHERE submission_id = $1`,
      [invitation.json.id],
    );

    const confirmed = await request(
      server,
      "PATCH",
      `/api/talent/interviews/${secondInterviewId}/respond`,
      candidateToken,
      { action: "accept", selectedTime: INTERVIEW_TIME },
    );
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.json));
    assert.equal(confirmed.json.confirmed_time_zone, INTERVIEW_TIMEZONE);

    const confirmedTalentInterviews = await request(server, "GET", "/api/talent/interviews", candidateToken);
    assert.equal(confirmedTalentInterviews.status, 200, JSON.stringify(confirmedTalentInterviews.json));
    const confirmedTalentInterview = confirmedTalentInterviews.json.find(
      (row: { id: string }) => row.id === secondInterviewId,
    );
    assert.equal(new Date(confirmedTalentInterview.confirmedTime).toISOString(), INTERVIEW_TIME);
    assert.equal(confirmedTalentInterview.confirmedTimeZone, INTERVIEW_TIMEZONE);

    const clientInterviews = await request(
      server,
      "GET",
      `/api/client/interviews?submissionId=${encodeURIComponent(invitation.json.id)}`,
      clientToken,
    );
    assert.equal(clientInterviews.status, 200, JSON.stringify(clientInterviews.json));
    const confirmedClientInterview = clientInterviews.json.find(
      (row: { id: string }) => row.id === secondInterviewId,
    );
    assert.equal(new Date(confirmedClientInterview.confirmed_time).toISOString(), INTERVIEW_TIME);
    assert.equal(confirmedClientInterview.confirmed_time_zone, INTERVIEW_TIMEZONE);

    const interviewCountAfterFinalAcceptance = await query(
      `SELECT COUNT(*)::int AS count FROM interviews WHERE submission_id = $1`,
      [invitation.json.id],
    );
    assert.equal(
      interviewCountAfterFinalAcceptance.rows[0].count,
      interviewCountBeforeFinalAcceptance.rows[0].count,
      "accepting a proposal must not create an extra interview row",
    );

    const formatted = formatInterviewTime(INTERVIEW_TIME, INTERVIEW_TIMEZONE);
    assert.match(formatted, new RegExp(`\\(${INTERVIEW_TIMEZONE}\\)$`));
  });
});