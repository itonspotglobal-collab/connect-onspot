/**
 * client-job-authorization.test.ts
 *
 * Regression coverage for the guided client profile/job posting boundaries:
 *  (a) admin job creation rejects talent and admin IDs as job owners
 *  (b) talent and admin sessions cannot use client self-service routes
 *  (c) a client can load/save their profile and create/edit only their own jobs
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

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const ADMIN_ID = `client-job-admin-${suffix}`;
const CLIENT_ID = `client-job-client-${suffix}`;
const OTHER_CLIENT_ID = `client-job-other-${suffix}`;
const TALENT_ID = `client-job-talent-${suffix}`;
const PENDING_JOB_ID = `client-job-pending-${suffix}`;
const READY_JOB_ID = `client-job-ready-${suffix}`;
const REVISION_JOB_ID = `client-job-revision-${suffix}`;
const SCAFFOLD_JOB_ID = `client-job-scaffold-${suffix}`;
const APPROVAL_NOTIFICATION_JOB_ID = `client-job-approval-notification-${suffix}`;
const REJECTION_NOTIFICATION_JOB_ID = `client-job-rejection-notification-${suffix}`;
const CANDIDATE_ID = `client-job-candidate-${suffix}`;

const token = (userId: string, role: string) =>
  jwt.sign({ userId, email: `${userId}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });

const adminToken = token(ADMIN_ID, "admin");
const clientToken = token(CLIENT_ID, "client");
const otherClientToken = token(OTHER_CLIENT_ID, "client");
const talentToken = token(TALENT_ID, "talent");

function request(
  server: http.Server,
  method: string,
  path: string,
  authToken?: string | null,
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
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
            // Some unrelated routes may return plain text; keep the status useful.
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

const jobPayload = (clientId: string, title = "Client authorization test job") => ({
  clientId,
  title,
  description: "A job used to verify job-owner authorization.",
  category: "Technical",
  experienceLevel: "intermediate",
  engagementType: "Standard",
  status: "draft",
});

let server: http.Server;
let otherClientJobId: string;
let createdClientJobId: string;

async function createFixtures() {
  await query(
    `INSERT INTO users (id, email, first_name, last_name, role)
     VALUES
       ($1, $2, 'Admin', 'Tester', 'admin'),
       ($3, $4, 'Client', 'Tester', 'client'),
       ($5, $6, 'Other', 'Client', 'client'),
       ($7, $8, 'Talent', 'Tester', 'talent')`,
    [
      ADMIN_ID,
      `${ADMIN_ID}@test.example`,
      CLIENT_ID,
      `${CLIENT_ID}@test.example`,
      OTHER_CLIENT_ID,
      `${OTHER_CLIENT_ID}@test.example`,
      TALENT_ID,
      `${TALENT_ID}@test.example`,
    ],
  );

  const job = await query(
    `INSERT INTO jobs
       (client_id, title, description, category, experience_level, engagement_type, status, approval_status)
     VALUES ($1, 'Other client private job', 'Private test job', 'Technical', 'intermediate',
             'Standard', 'draft', 'pending')
     RETURNING id`,
    [OTHER_CLIENT_ID],
  );
  otherClientJobId = job.rows[0].id;

  await query(
    `INSERT INTO jobs
       (id, client_id, title, description, category, experience_level, engagement_type,
        status, approval_status, created_via)
     VALUES
       ($1, $2, 'Pending approval job', 'Pending test job', 'Technical', 'intermediate',
        'Standard', 'open', 'pending', 'manual'),
       ($3, $2, 'Approved invitation job', 'Approved test job', 'Technical', 'intermediate',
        'Standard', 'open', 'approved', 'manual'),
        ($4, $2, 'Revision-needed job', 'Revision-needed test job', 'Technical', 'intermediate',
         'Standard', 'open', 'revision_needed', 'manual'),
       ($5, $2, 'Search placeholder', 'Scaffold test job', 'Technical', 'intermediate',
        'Standard', 'closed', 'pending', 'search_scaffold'),
       ($6, $2, 'Approval notification job', 'Notification test job', 'Technical', 'intermediate',
        'Standard', 'open', 'pending', 'manual'),
       ($7, $2, 'Rejection notification job', 'Rejected notification test job', 'Technical', 'intermediate',
        'Standard', 'open', 'pending', 'manual')`,
      [
        PENDING_JOB_ID,
        CLIENT_ID,
        READY_JOB_ID,
        REVISION_JOB_ID,
        SCAFFOLD_JOB_ID,
        APPROVAL_NOTIFICATION_JOB_ID,
        REJECTION_NOTIFICATION_JOB_ID,
      ],
  );
  await query(
    `INSERT INTO candidates
       (id, user_id, full_name, first_name, last_name, target_position, category)
      VALUES ($1, $2, 'John Benedict Acosta', 'John Benedict', 'Acosta', 'Engineer', 'Technical')`,
    [CANDIDATE_ID, TALENT_ID],
  );
}

async function destroyFixtures() {
  await query(`DELETE FROM jobs WHERE id = $1`, [createdClientJobId]).catch(() => {});
  await query(`DELETE FROM jobs WHERE id = $1`, [otherClientJobId]).catch(() => {});
  await query(`DELETE FROM client_talent_favorites WHERE client_id = $1 OR talent_id = $1`, [CLIENT_ID]).catch(() => {});
  await query(`DELETE FROM job_submissions WHERE client_id = $1`, [CLIENT_ID]).catch(() => {});
  await query(
    `DELETE FROM notifications WHERE user_id = ANY($1::text[])`,
    [[ADMIN_ID, CLIENT_ID, OTHER_CLIENT_ID, TALENT_ID]],
  ).catch(() => {});
  await query(`DELETE FROM candidates WHERE id = $1`, [CANDIDATE_ID]).catch(() => {});
  await query(
    `DELETE FROM jobs WHERE id = ANY($1::text[])`,
    [[
      PENDING_JOB_ID,
      READY_JOB_ID,
      REVISION_JOB_ID,
      SCAFFOLD_JOB_ID,
      APPROVAL_NOTIFICATION_JOB_ID,
      REJECTION_NOTIFICATION_JOB_ID,
    ]],
  ).catch(() => {});
  await query(
    `DELETE FROM client_profiles WHERE user_id = ANY($1::text[])`,
    [[ADMIN_ID, CLIENT_ID, OTHER_CLIENT_ID, TALENT_ID]],
  ).catch(() => {});
  await query(
    `DELETE FROM users WHERE id = ANY($1::text[])`,
    [[ADMIN_ID, CLIENT_ID, OTHER_CLIENT_ID, TALENT_ID]],
  );
}

describe("client profile and job authorization (production routes)", () => {
  before(async () => {
    await createFixtures();
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await destroyFixtures();
  });

  it("rejects admin job creation for talent and admin IDs without creating a job", async () => {
    for (const rejectedOwnerId of [TALENT_ID, ADMIN_ID]) {
      const title = `Rejected owner ${rejectedOwnerId}`;
      const response = await request(server, "POST", "/api/admin/jobs", adminToken, jobPayload(rejectedOwnerId, title));

      assert.equal(response.status, 400, JSON.stringify(response.json));
      assert.equal(response.json.error, "Invalid client");
      const created = await query(`SELECT id FROM jobs WHERE title = $1`, [title]);
      assert.equal(created.rows.length, 0, "an invalid owner must not create a job");
    }
  });

  it("returns 403 to talent and admin sessions on client profile and job self-service routes", async () => {
    for (const [role, authToken] of [
      ["talent", talentToken],
      ["admin", adminToken],
    ] as const) {
      const profileGet = await request(server, "GET", "/api/client-profile/me", authToken);
      assert.equal(profileGet.status, 403, `${role} must not load a client profile`);

      const profilePut = await request(server, "PUT", "/api/client-profile/me", authToken, {
        companyName: "Unauthorized update",
      });
      assert.equal(profilePut.status, 403, `${role} must not save a client profile`);

      const jobsGet = await request(server, "GET", "/api/client/jobs", authToken);
      assert.equal(jobsGet.status, 403, `${role} must not list client jobs`);

      const jobsPost = await request(
        server,
        "POST",
        "/api/client/jobs",
        authToken,
        jobPayload(CLIENT_ID, `Unauthorized ${role} job`),
      );
      assert.equal(jobsPost.status, 403, `${role} must not create a client job`);
    }
  });

  it("lets a client load and save their profile", async () => {
    const loaded = await request(server, "GET", "/api/client-profile/me", clientToken);
    assert.equal(loaded.status, 200, JSON.stringify(loaded.json));
    assert.equal(loaded.json.userId, CLIENT_ID);

    const saved = await request(server, "PUT", "/api/client-profile/me", clientToken, {
      companyName: "Client Test Company",
      contactPerson: "Client Tester",
      email: `${CLIENT_ID}@test.example`,
      industry: "Technology",
      about: "Updated through the client self-service route.",
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.json));
    assert.equal(saved.json.companyName, "Client Test Company");
    assert.equal(saved.json.about, "Updated through the client self-service route.");
  });

  it("keeps approval pending in the client response and blocks non-approved jobs from public routes", async () => {
    const clientJobs = await request(server, "GET", "/api/client/jobs", clientToken);
    assert.equal(clientJobs.status, 200, JSON.stringify(clientJobs.json));
    const pendingJob = clientJobs.json.find((job: any) => job.id === PENDING_JOB_ID);
    assert.equal(pendingJob?.status, "open");
    assert.equal(pendingJob?.approval_status, "pending");
    assert.equal(pendingJob?.approvalStatus, undefined, "the client route returns PostgreSQL's snake-case field");

    const publicSearch = await request(server, "GET", "/api/jobs/search?status=open");
    assert.equal(publicSearch.status, 200, JSON.stringify(publicSearch.json));
    const publicIds = publicSearch.json.items.map((job: any) => job.id);
    assert.equal(publicIds.includes(PENDING_JOB_ID), false, "pending jobs must not be publicly searchable");
    assert.equal(publicIds.includes(REVISION_JOB_ID), false, "non-approved jobs must not be publicly searchable");
    assert.equal(publicIds.includes(READY_JOB_ID), true, "approved open jobs remain publicly searchable");

    const pendingDetail = await request(server, "GET", `/api/jobs/${PENDING_JOB_ID}`);
    assert.equal(pendingDetail.status, 404, JSON.stringify(pendingDetail.json));
    const approvedDetail = await request(server, "GET", `/api/jobs/${READY_JOB_ID}`);
    assert.equal(approvedDetail.status, 200, JSON.stringify(approvedDetail.json));
  });

  it("searches talent only against an owned approved job and returns sanitized results", async () => {
    const search = await request(
      server,
      "POST",
      `/api/client/jobs/${READY_JOB_ID}/talent-search`,
      clientToken,
      { searchText: "engineer" },
    );
    assert.equal(search.status, 200, JSON.stringify(search.json));
    assert.ok(Array.isArray(search.json.results));
    const talent = search.json.results.find((result: any) => result.userId === TALENT_ID);
    assert.ok(talent, "the linked talent fixture should appear in the job-specific search");
    assert.equal(talent.candidate.maskedName, "John A.");
    assert.equal(talent.candidate.fullName, "John A.");
    assert.equal(talent.candidate.full_name, "John A.");
    assert.equal(JSON.stringify(talent.candidate).includes("John Benedict"), false);
    assert.equal(JSON.stringify(talent.candidate).includes("Acosta"), false);
    for (const blockedField of [
      "email", "phone", "phoneNumber", "resumeUrl", "linkedinUrl",
      "githubUrl", "portfolioUrl", "websiteUrl", "videoIntroUrl",
       "firstName", "lastName", "userId",
    ]) {
      assert.equal(
        Object.hasOwn(talent.candidate, blockedField),
        false,
        `job-specific search must not expose ${blockedField}`,
      );
    }
    assert.ok(Array.isArray(search.json.invitedTalentIds));

    for (const searchText of ["john", "JOHN", "  John  "]) {
      const nameSearch = await request(
        server,
        "POST",
        `/api/client/jobs/${READY_JOB_ID}/talent-search`,
        clientToken,
        { searchText },
      );
      assert.equal(nameSearch.status, 200, JSON.stringify(nameSearch.json));
      assert.ok(
        nameSearch.json.results.some((result: any) => result.userId === TALENT_ID),
        `${JSON.stringify(searchText)} should match the sanitized partial name`,
      );
    }

    const unknownSearch = await request(
      server,
      "POST",
      `/api/client/jobs/${READY_JOB_ID}/talent-search`,
      clientToken,
      { searchText: "definitely-no-such-talent-term" },
    );
    assert.equal(unknownSearch.status, 200, JSON.stringify(unknownSearch.json));
    assert.deepEqual(unknownSearch.json.results, []);

    const foreignJob = await request(
      server,
      "POST",
      `/api/client/jobs/${READY_JOB_ID}/talent-search`,
      otherClientToken,
      {},
    );
    assert.equal(foreignJob.status, 403, JSON.stringify(foreignJob.json));

    const pendingJob = await request(
      server,
      "POST",
      `/api/client/jobs/${PENDING_JOB_ID}/talent-search`,
      clientToken,
      {},
    );
    assert.equal(pendingJob.status, 400, JSON.stringify(pendingJob.json));

    const scaffoldJob = await request(
      server,
      "POST",
      `/api/client/jobs/${SCAFFOLD_JOB_ID}/talent-search`,
      clientToken,
      {},
    );
    assert.equal(scaffoldJob.status, 400, JSON.stringify(scaffoldJob.json));
  });

  it("persists private favorites without creating hiring-pipeline side effects", async () => {
    const deniedTalent = await request(server, "GET", "/api/client/favorites", talentToken);
    assert.equal(deniedTalent.status, 403, "talent sessions must not read client favorites");

    const initial = await request(server, "GET", "/api/client/favorites", clientToken);
    assert.equal(initial.status, 200, JSON.stringify(initial.json));
    assert.ok(Array.isArray(initial.json.favorites));
    assert.ok(!initial.json.favorites.some((favorite: any) => favorite.talentId === TALENT_ID));

    const submissionBaseline = await query(
      `SELECT COUNT(*)::int AS count FROM job_submissions WHERE client_id = $1 AND talent_id = $2`,
      [CLIENT_ID, TALENT_ID],
    );
    const notificationBaseline = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`,
      [TALENT_ID],
    );

    const favorite = await request(server, "POST", "/api/client/favorites", clientToken, {
      talentUserId: TALENT_ID,
    });
    assert.equal(favorite.status, 201, JSON.stringify(favorite.json));
    assert.equal(favorite.json.talentId, TALENT_ID);
    assert.equal(favorite.json.alreadyFavorited, false);

    const duplicate = await request(server, "POST", "/api/client/favorites", clientToken, {
      talentUserId: TALENT_ID,
    });
    assert.equal(duplicate.status, 200, JSON.stringify(duplicate.json));
    assert.equal(duplicate.json.alreadyFavorited, true);

    const list = await request(server, "GET", "/api/client/favorites", clientToken);
    assert.equal(list.status, 200, JSON.stringify(list.json));
    assert.equal(list.json.favorites.filter((item: any) => item.talentId === TALENT_ID).length, 1);

    const otherClientList = await request(server, "GET", "/api/client/favorites", otherClientToken);
    assert.equal(otherClientList.status, 200, JSON.stringify(otherClientList.json));
    assert.ok(!otherClientList.json.favorites.some((item: any) => item.talentId === TALENT_ID));
    const otherClientDelete = await request(
      server,
      "DELETE",
      `/api/client/favorites/${encodeURIComponent(TALENT_ID)}`,
      otherClientToken,
    );
    assert.equal(otherClientDelete.status, 404, "a different client cannot remove this favorite");

    const submissionAfterFavorite = await query(
      `SELECT COUNT(*)::int AS count FROM job_submissions WHERE client_id = $1 AND talent_id = $2`,
      [CLIENT_ID, TALENT_ID],
    );
    const notificationAfterFavorite = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`,
      [TALENT_ID],
    );
    assert.equal(
      submissionAfterFavorite.rows[0].count,
      submissionBaseline.rows[0].count,
      "a favorite must not create an application, shortlist, or invitation",
    );
    assert.equal(
      notificationAfterFavorite.rows[0].count,
      notificationBaseline.rows[0].count,
      "a favorite must not notify talent",
    );

    const removed = await request(
      server,
      "DELETE",
      `/api/client/favorites/${encodeURIComponent(TALENT_ID)}`,
      clientToken,
    );
    assert.equal(removed.status, 204, JSON.stringify(removed.json));
    const afterRemoval = await request(server, "GET", "/api/client/favorites", clientToken);
    assert.equal(afterRemoval.status, 200, JSON.stringify(afterRemoval.json));
    assert.ok(!afterRemoval.json.favorites.some((item: any) => item.talentId === TALENT_ID));
  });

  it("lets a client create and edit their own job, but not another client's job", async () => {
    const created = await request(
      server,
      "POST",
      "/api/client/jobs",
      clientToken,
      jobPayload("not-the-authenticated-client", "Client-owned job"),
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    createdClientJobId = created.json.id;
    assert.equal(created.json.clientId, CLIENT_ID);
    assert.equal(created.json.approvalStatus, "pending");
    assert.equal(created.json.isClientSubmitted, true);

    const edited = await request(server, "PATCH", `/api/client/jobs/${createdClientJobId}`, clientToken, {
      clientId: OTHER_CLIENT_ID,
      title: "Client-owned job edited",
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.json));
    assert.equal(edited.json.title, "Client-owned job edited");
    assert.equal(edited.json.clientId, CLIENT_ID);

    const otherJobGet = await request(server, "GET", `/api/client/jobs/${otherClientJobId}`, clientToken);
    assert.equal(otherJobGet.status, 404);

    const otherJobEdit = await request(server, "PATCH", `/api/client/jobs/${otherClientJobId}`, clientToken, {
      title: "Should not change",
    });
    assert.equal(otherJobEdit.status, 403);

    const otherClientList = await request(server, "GET", "/api/client/jobs", otherClientToken);
    assert.equal(otherClientList.status, 200, JSON.stringify(otherClientList.json));
    assert.ok(otherClientList.json.some((job: any) => job.id === otherClientJobId));
    assert.ok(!otherClientList.json.some((job: any) => job.id === createdClientJobId));
  });

  it("reports a pending job instead of treating it as no jobs, including first-invite Terms status", async () => {
    // Hide the separate approved fixture so this test exercises the pending
    // branch. A client with both kinds of jobs is correctly "ready".
    await query(`UPDATE jobs SET status = 'closed' WHERE id = $1`, [READY_JOB_ID]);
    try {
      const readiness = await request(server, "GET", "/api/client/invitation-readiness", clientToken);

      assert.equal(readiness.status, 200, JSON.stringify(readiness.json));
      assert.equal(readiness.json.summary.state, "pending_approval");
      assert.ok(readiness.json.summary.pendingApprovalCount >= 1);
      assert.ok(readiness.json.summary.scaffoldJobsCount >= 1);
      assert.equal(readiness.json.msa.required, true);
      assert.equal(readiness.json.msa.termsUrl, "/terms-and-conditions");
      assert.match(readiness.json.msa.termsUrl, /^\/terms-and-conditions$/);
      assert.ok(
        readiness.json.jobs.every((job: any) => job.created_via !== "search_scaffold"),
        "scaffold rows must remain hidden from the picker jobs",
      );

      const msaStatus = await request(server, "GET", "/api/client/msa-status", clientToken);
      assert.equal(msaStatus.status, 200, JSON.stringify(msaStatus.json));
      assert.equal(msaStatus.json.termsUrl, "/terms-and-conditions");
    } finally {
      await query(`UPDATE jobs SET status = 'open' WHERE id = $1`, [READY_JOB_ID]);
    }
  });

  it("keeps server errors authoritative for pending jobs and first-invite MSA", async () => {
    const proposedTimes = [{ start: "2030-01-01T10:00:00.000Z", timezone: "UTC" }];
    const pendingInvite = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes,
    });
    assert.equal(pendingInvite.status, 403, JSON.stringify(pendingInvite.json));
    assert.equal(pendingInvite.json.error, "job_not_invitable");
    assert.equal(pendingInvite.json.reason, "pending_approval");

    const firstInvite = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: READY_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes,
    });
    assert.equal(firstInvite.status, 428, JSON.stringify(firstInvite.json));
    assert.equal(firstInvite.json.error, "msa_required");
    assert.equal(firstInvite.json.termsUrl, "/terms-and-conditions");
  });

  it("persists silent role shortlists, keeps them out of talent applications, and promotes them without duplicates", async () => {
    const notificationBaseline = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`,
      [TALENT_ID],
    );
    assert.equal(notificationBaseline.rows[0].count, 0);

    const shortlist = await request(server, "POST", "/api/client/shortlists", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
    });
    assert.equal(shortlist.status, 201, JSON.stringify(shortlist.json));

    const duplicate = await request(server, "POST", "/api/client/shortlists", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
    });
    assert.equal(duplicate.status, 200, JSON.stringify(duplicate.json));
    assert.equal(duplicate.json.alreadyShortlisted, true);

    const list = await request(server, "GET", "/api/client/shortlists", clientToken);
    assert.equal(list.status, 200, JSON.stringify(list.json));
    const saved = list.json.shortlists.find((row: any) => row.id === shortlist.json.id);
    assert.ok(saved);
    assert.equal(saved.jobStatus, "open");
    assert.equal(saved.approvalStatus, "pending");

    const afterShortlistNotifications = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`,
      [TALENT_ID],
    );
    assert.equal(afterShortlistNotifications.rows[0].count, 0, "a silent shortlist must not notify talent");

    const talentApplications = await request(server, "GET", "/api/talent/applications", talentToken);
    assert.equal(talentApplications.status, 200, JSON.stringify(talentApplications.json));
    assert.ok(!talentApplications.json.some((application: any) => application.id === shortlist.json.id));

    const genericMessage = await request(server, "POST", "/api/message-threads", clientToken, {
      participants: [CLIENT_ID, TALENT_ID],
    });
    assert.equal(genericMessage.status, 403, JSON.stringify(genericMessage.json));
    const applicationMessage = await request(
      server,
      "POST",
      `/api/applications/${shortlist.json.id}/message-thread`,
      clientToken,
    );
    assert.equal(applicationMessage.status, 403, JSON.stringify(applicationMessage.json));

    const directInterview = await request(server, "POST", "/api/client/interviews", clientToken, {
      submissionId: shortlist.json.id,
      proposedTimes: [{ start: "2030-01-01T10:00:00.000Z", timezone: "UTC" }],
    });
    assert.notEqual(directInterview.status, 201, JSON.stringify(directInterview.json));
    const shortlistAfterInterview = await query(
      `SELECT status FROM job_submissions WHERE id = $1`,
      [shortlist.json.id],
    );
    assert.equal(shortlistAfterInterview.rows[0].status, "shortlisted");
    const interviewRows = await query(`SELECT id FROM interviews WHERE submission_id = $1`, [shortlist.json.id]);
    assert.equal(interviewRows.rows.length, 0);

    const adminApplications = await request(
      server,
      "GET",
      `/api/admin/job-applications?jobId=${encodeURIComponent(PENDING_JOB_ID)}`,
      adminToken,
    );
    assert.equal(adminApplications.status, 200, JSON.stringify(adminApplications.json));
    assert.ok(!adminApplications.json.items.some((application: any) => application.id === shortlist.json.id));
    const adminDetail = await request(server, "GET", `/api/admin/job-applications/${shortlist.json.id}`, adminToken);
    assert.equal(adminDetail.status, 404, JSON.stringify(adminDetail.json));

    const clientSubmissions = await request(server, "GET", "/api/client/job-submissions", clientToken);
    assert.equal(clientSubmissions.status, 200, JSON.stringify(clientSubmissions.json));
    assert.ok(!clientSubmissions.json.some((submission: any) => submission.id === shortlist.json.id));
    const clientSubmissionDetail = await request(server, "GET", `/api/client/job-submissions/${shortlist.json.id}`, clientToken);
    assert.equal(clientSubmissionDetail.status, 404, JSON.stringify(clientSubmissionDetail.json));
    const shortlistStatusRequest = await request(
      server,
      "POST",
      `/api/client/job-submissions/${shortlist.json.id}/status-change-requests`,
      clientToken,
      { requestedStatus: "shortlisted", reason: "Should not be possible for a silent shortlist" },
    );
    assert.notEqual(shortlistStatusRequest.status, 201, JSON.stringify(shortlistStatusRequest.json));

    await query(`UPDATE jobs SET approval_status = 'rejected' WHERE id = $1`, [PENDING_JOB_ID]);
    const rejectedList = await request(server, "GET", "/api/client/shortlists", clientToken);
    assert.equal(rejectedList.status, 200, JSON.stringify(rejectedList.json));
    const rejectedSaved = rejectedList.json.shortlists.find((row: any) => row.id === shortlist.json.id);
    assert.equal(rejectedSaved.approvalStatus, "rejected");

    const revisionShortlist = await request(server, "POST", "/api/client/shortlists", clientToken, {
      jobId: REVISION_JOB_ID,
      talentUserId: TALENT_ID,
    });
    assert.equal(revisionShortlist.status, 201, JSON.stringify(revisionShortlist.json));
    const pickerReadiness = await request(server, "GET", "/api/client/invitation-readiness", clientToken);
    assert.equal(pickerReadiness.status, 200, JSON.stringify(pickerReadiness.json));
    const pickerRows = pickerReadiness.json.jobs.filter(
      (job: any) => [PENDING_JOB_ID, REVISION_JOB_ID].includes(job.id),
    );
    assert.deepEqual(
      new Map(pickerRows.map((job: any) => [job.id, job.approval_status])),
      new Map([
        [PENDING_JOB_ID, "rejected"],
        [REVISION_JOB_ID, "revision_needed"],
      ]),
      "non-approved open roles must remain available to the shortlist picker",
    );
    assert.equal(pickerRows.every((job: any) => job.status === "open"), true);

    const rejectedInterview = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: "2030-01-01T10:00:00.000Z", timezone: "UTC" }],
    });
    assert.equal(rejectedInterview.status, 403, JSON.stringify(rejectedInterview.json));
    assert.equal(rejectedInterview.json.reason, "not_approved");
    const revisionInterview = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: REVISION_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: "2030-01-01T10:00:00.000Z", timezone: "UTC" }],
    });
    assert.equal(revisionInterview.status, 403, JSON.stringify(revisionInterview.json));
    assert.equal(revisionInterview.json.reason, "not_approved");

    const nonApprovedList = await request(server, "GET", "/api/client/shortlists", clientToken);
    assert.equal(nonApprovedList.status, 200, JSON.stringify(nonApprovedList.json));
    const nonApprovedRows = nonApprovedList.json.shortlists.filter(
      (row: any) => [shortlist.json.id, revisionShortlist.json.id].includes(row.id),
    );
    assert.equal(nonApprovedRows.length, 2);
    assert.deepEqual(
      new Map(nonApprovedRows.map((row: any) => [row.id, row.approvalStatus])),
      new Map([
        [shortlist.json.id, "rejected"],
        [revisionShortlist.json.id, "revision_needed"],
      ]),
    );

    const afterBlockedInterviews = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`,
      [TALENT_ID],
    );
    assert.equal(afterBlockedInterviews.rows[0].count, 0, "blocked interviews must not notify talent");

    await query(`UPDATE jobs SET approval_status = 'approved' WHERE id = $1`, [PENDING_JOB_ID]);

    const acceptance = await request(server, "POST", "/api/client/msa-acceptance", clientToken, { accepted: true });
    assert.equal(acceptance.status, 200, JSON.stringify(acceptance.json));
    const invitation = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: "2030-01-01T10:00:00.000Z", timezone: "UTC" }],
    });
    assert.equal(invitation.status, 201, JSON.stringify(invitation.json));
    assert.equal(invitation.json.invitationCreated, true);
    assert.equal(invitation.json.notificationCreated, true);
    assert.equal(invitation.json.emailSent, true);

    const rows = await query(
      `SELECT workflow_type, status FROM job_submissions
        WHERE id = $1`,
      [shortlist.json.id],
    );
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].workflow_type, "client_invitation");
    assert.equal(rows.rows[0].status, "invited");
    const submissionCount = await query(
      `SELECT COUNT(*)::int AS count
         FROM job_submissions
        WHERE client_id = $1 AND job_id = $2 AND talent_id = $3`,
      [CLIENT_ID, PENDING_JOB_ID, TALENT_ID],
    );
    assert.equal(submissionCount.rows[0].count, 1, "promotion must reuse the shortlist submission");
    const interviewCount = await query(`SELECT COUNT(*)::int AS count FROM interviews WHERE submission_id = $1`, [shortlist.json.id]);
    assert.equal(interviewCount.rows[0].count, 1);

    const pendingClientSubmissions = await request(server, "GET", "/api/client/job-submissions", clientToken);
    assert.equal(pendingClientSubmissions.status, 200, JSON.stringify(pendingClientSubmissions.json));
    const pendingSubmission = pendingClientSubmissions.json.find((submission: any) => submission.id === shortlist.json.id);
    assert.equal(pendingSubmission?.applicantName, "John A.");
    assert.equal(pendingSubmission?.applicant_name, "John A.");
    assert.equal(JSON.stringify(pendingSubmission).includes("John Benedict"), false);
    assert.equal(JSON.stringify(pendingSubmission).includes("Acosta"), false);

    const duplicateInvite = await request(server, "POST", "/api/client/invitations", clientToken, {
      jobId: PENDING_JOB_ID,
      talentUserId: TALENT_ID,
      proposedTimes: [{ start: "2030-01-02T10:00:00.000Z", timezone: "UTC" }],
    });
    assert.equal(duplicateInvite.status, 409, JSON.stringify(duplicateInvite.json));
    const finalNotifications = await query(
      `SELECT user_id, type, title, message, related_id, is_read
         FROM notifications
        WHERE user_id = $1 AND type = 'job_invitation'`,
      [TALENT_ID],
    );
    assert.equal(finalNotifications.rows.length, 1, "a successful formal invitation must notify talent exactly once");
    assert.equal(finalNotifications.rows[0].user_id, TALENT_ID);
    assert.equal(finalNotifications.rows[0].title, "You've been invited to apply");
    assert.match(finalNotifications.rows[0].message, /Pending approval job/);
    assert.equal(finalNotifications.rows[0].related_id, invitation.json.id);
    assert.equal(finalNotifications.rows[0].is_read, false);
  });

  it("notifies only the owning client for each real approval transition", async () => {
    const approval = await request(
      server,
      "POST",
      `/api/admin/jobs/${APPROVAL_NOTIFICATION_JOB_ID}/approve`,
      adminToken,
    );
    assert.equal(approval.status, 200, JSON.stringify(approval.json));
    assert.equal(approval.json.approval_status, "approved");

    const notificationRows = await query(
      `SELECT user_id, type, title, message, related_id, related_type, event_key, is_read
         FROM notifications
        WHERE related_id = $1
        ORDER BY created_at ASC, id ASC`,
      [APPROVAL_NOTIFICATION_JOB_ID],
    );
    assert.equal(notificationRows.rows.length, 1, "one approval notification must be persisted");
    assert.deepEqual({ ...notificationRows.rows[0], event_key: undefined }, {
      user_id: CLIENT_ID,
      type: "job_approved",
      title: "Job post approved",
      message: "Your job post “Approval notification job” has been approved and is now live.",
      related_id: APPROVAL_NOTIFICATION_JOB_ID,
      related_type: "job",
      event_key: undefined,
      is_read: false,
    });
    assert.match(
      notificationRows.rows[0].event_key,
      new RegExp(`^job-approval-transition:${APPROVAL_NOTIFICATION_JOB_ID}:`),
    );

    const ownerUnread = await request(
      server,
      "GET",
      `/api/users/${CLIENT_ID}/notifications?unread_only=true`,
      clientToken,
    );
    assert.equal(ownerUnread.status, 200, JSON.stringify(ownerUnread.json));
    assert.ok(
      ownerUnread.json.some((notification: any) => notification.relatedId === APPROVAL_NOTIFICATION_JOB_ID),
      "the owning client must receive the unread notification through the existing endpoint",
    );

    const otherClientUnread = await request(
      server,
      "GET",
      `/api/users/${OTHER_CLIENT_ID}/notifications?unread_only=true`,
      otherClientToken,
    );
    assert.equal(otherClientUnread.status, 200, JSON.stringify(otherClientUnread.json));
    assert.equal(
      otherClientUnread.json.some((notification: any) => notification.relatedId === APPROVAL_NOTIFICATION_JOB_ID),
      false,
      "another client must not receive job status notifications",
    );

    const repeatedApproval = await request(
      server,
      "POST",
      `/api/admin/jobs/${APPROVAL_NOTIFICATION_JOB_ID}/approve`,
      adminToken,
    );
    assert.equal(repeatedApproval.status, 200, JSON.stringify(repeatedApproval.json));
    const afterRepeatedApproval = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE related_id = $1`,
      [APPROVAL_NOTIFICATION_JOB_ID],
    );
    assert.equal(afterRepeatedApproval.rows[0].count, 1, "an already-approved job must not create another event");

    const unapprove = await request(
      server,
      "POST",
      `/api/admin/jobs/${APPROVAL_NOTIFICATION_JOB_ID}/pending`,
      adminToken,
    );
    assert.equal(unapprove.status, 200, JSON.stringify(unapprove.json));
    assert.equal(unapprove.json.approval_status, "pending");

    const repeatedUnapprove = await request(
      server,
      "POST",
      `/api/admin/jobs/${APPROVAL_NOTIFICATION_JOB_ID}/pending`,
      adminToken,
    );
    assert.equal(repeatedUnapprove.status, 200, JSON.stringify(repeatedUnapprove.json));
    const afterUnapprove = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE related_id = $1`,
      [APPROVAL_NOTIFICATION_JOB_ID],
    );
    assert.equal(afterUnapprove.rows[0].count, 2, "approved → pending must create one new event");

    const approveAgain = await request(
      server,
      "POST",
      `/api/admin/jobs/${APPROVAL_NOTIFICATION_JOB_ID}/approve`,
      adminToken,
    );
    assert.equal(approveAgain.status, 200, JSON.stringify(approveAgain.json));
    const approvalHistory = await query(
      `SELECT type, event_key
         FROM notifications
        WHERE related_id = $1
        ORDER BY created_at ASC, id ASC`,
      [APPROVAL_NOTIFICATION_JOB_ID],
    );
    assert.deepEqual(
      approvalHistory.rows.map((row: any) => row.type),
      ["job_approved", "job_pending", "job_approved"],
    );
    assert.equal(
      new Set(approvalHistory.rows.map((row: any) => row.event_key)).size,
      3,
      "each real transition must have its own event key",
    );
  });

  it("notifies every supported rejection and re-approval transition with the safe reason", async () => {
    const rejection = await request(
      server,
      "POST",
      `/api/admin/jobs/${REJECTION_NOTIFICATION_JOB_ID}/reject`,
      adminToken,
      { rejectionReason: "Needs more detail" },
    );
    assert.equal(rejection.status, 200, JSON.stringify(rejection.json));
    assert.equal(rejection.json.approval_status, "rejected");
    const firstRejection = await query(
      `SELECT type, title, message, is_read
         FROM notifications
        WHERE related_id = $1`,
      [REJECTION_NOTIFICATION_JOB_ID],
    );
    assert.deepEqual(firstRejection.rows, [{
      type: "job_rejected",
      title: "Job post rejected",
      message: "Your job post “Rejection notification job” was not approved. Reason: Needs more detail",
      is_read: false,
    }]);

    const repeatedRejection = await request(
      server,
      "POST",
      `/api/admin/jobs/${REJECTION_NOTIFICATION_JOB_ID}/reject`,
      adminToken,
      { rejectionReason: "Needs more detail" },
    );
    assert.equal(repeatedRejection.status, 200, JSON.stringify(repeatedRejection.json));

    const reapproved = await request(
      server,
      "POST",
      `/api/admin/jobs/${REJECTION_NOTIFICATION_JOB_ID}/approve`,
      adminToken,
    );
    assert.equal(reapproved.status, 200, JSON.stringify(reapproved.json));

    const rejectedAgain = await request(
      server,
      "POST",
      `/api/admin/jobs/${REJECTION_NOTIFICATION_JOB_ID}/reject`,
      adminToken,
      { rejectionReason: "Please revise the job details" },
    );
    assert.equal(rejectedAgain.status, 200, JSON.stringify(rejectedAgain.json));

    const movedBackToPending = await request(
      server,
      "POST",
      `/api/admin/jobs/${REJECTION_NOTIFICATION_JOB_ID}/pending`,
      adminToken,
    );
    assert.equal(movedBackToPending.status, 200, JSON.stringify(movedBackToPending.json));

    const approvedAfterPending = await request(
      server,
      "POST",
      `/api/admin/jobs/${REJECTION_NOTIFICATION_JOB_ID}/approve`,
      adminToken,
    );
    assert.equal(approvedAfterPending.status, 200, JSON.stringify(approvedAfterPending.json));

    const history = await query(
      `SELECT type, message, event_key
         FROM notifications
        WHERE related_id = $1
        ORDER BY created_at ASC, id ASC`,
      [REJECTION_NOTIFICATION_JOB_ID],
    );
    assert.deepEqual(
      history.rows.map((row: any) => row.type),
      ["job_rejected", "job_approved", "job_rejected", "job_pending", "job_approved"],
    );
    assert.equal(
      history.rows[2].message,
      "Your job post “Rejection notification job” was not approved. Reason: Please revise the job details",
    );
    assert.equal(new Set(history.rows.map((row: any) => row.event_key)).size, 5);
  });
});