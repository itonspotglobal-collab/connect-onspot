/**
 * Database-backed coverage for the shared service used by real application
 * submission, Client status, and Admin status routes.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db.js";
import { DbStorage } from "../storage.js";
import {
  notifyClientOfJobApplication,
  notifyAdminsOfClientApplicationStatusChange,
  notifyTalentOfApplicationStatusChange,
} from "../services/applicationNotificationService.js";

describe("job application notifications", () => {
  const storage = new DbStorage();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = (role: string) => `application-notify-${role}-${suffix}@example.com`;
  const notificationIds: string[] = [];
  let clientAId = "";
  let clientBId = "";
  let talentId = "";
  let adminId = "";
  let linkedCandidateId = "";

  before(async () => {
    const [clientA, clientB, talent, admin] = await Promise.all([
      query(
        `INSERT INTO users (email, role, password_hash) VALUES ($1, 'client', 'x') RETURNING id`,
        [email("client-a")],
      ),
      query(
        `INSERT INTO users (email, role, password_hash) VALUES ($1, 'client', 'x') RETURNING id`,
        [email("client-b")],
      ),
      query(
        `INSERT INTO users (email, role, password_hash) VALUES ($1, 'talent', 'x') RETURNING id`,
        [email("talent")],
      ),
      query(
        `INSERT INTO users (email, role, password_hash) VALUES ($1, 'admin', 'x') RETURNING id`,
        [email("admin")],
      ),
    ]);
    clientAId = clientA.rows[0].id;
    clientBId = clientB.rows[0].id;
    talentId = talent.rows[0].id;
    adminId = admin.rows[0].id;
    const candidate = await query(
      `INSERT INTO candidates (email, full_name, user_id)
       VALUES ($1, 'Linked Notification Talent', $2)
       RETURNING id`,
      [email("candidate"), talentId],
    );
    linkedCandidateId = candidate.rows[0].id;
  });

  after(async () => {
    if (notificationIds.length) {
      await query(`DELETE FROM notifications WHERE id = ANY($1::text[])`, [notificationIds]).catch(() => {});
    }
    await query(`DELETE FROM candidates WHERE id = $1`, [linkedCandidateId]).catch(() => {});
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[clientAId, clientBId, talentId, adminId]]).catch(() => {});
  });

  it("notifies only the Client who owns the job when a Talent applies", async () => {
    const submissionId = `application-received-${suffix}`;
    await notifyClientOfJobApplication({
      submissionId,
      clientUserId: clientAId,
      applicantDisplayName: "Application Test Talent",
      jobTitle: "Social Media Manager",
    });

    const clientANotifications = await storage.listNotificationsByUser(clientAId, true);
    const created = clientANotifications.find(
      (notification) =>
        notification.type === "job_application_received" &&
        notification.relatedId === submissionId,
    );
    assert.ok(created, "the owning client must receive a persisted application notification");
    assert.equal(created.relatedType, "job_submission");
    assert.equal(created.isRead, false);
    assert.match(created.message, /Application Test Talent applied for Social Media Manager/);
    notificationIds.push(created.id);

    const clientBNotifications = await storage.listNotificationsByUser(clientBId, true);
    assert.equal(
      clientBNotifications.some((notification) => notification.relatedId === submissionId),
      false,
      "another client must not receive the job owner's notification",
    );
  });

  it("notifies the linked Talent user with status-specific copy, but not same-status saves", async () => {
    const clientSubmissionId = `application-client-status-${suffix}`;
    const adminSubmissionId = `application-admin-status-${suffix}`;

    await notifyTalentOfApplicationStatusChange({
      submissionId: clientSubmissionId,
      talentUserId: talentId,
      applicantEmail: null,
      jobTitle: "Client Updated Role",
      previousStatus: "new",
      newStatus: "under_review",
    });
    await notifyTalentOfApplicationStatusChange({
      submissionId: adminSubmissionId,
      talentUserId: null,
      candidateId: linkedCandidateId,
      applicantEmail: "not-the-talent@example.com",
      jobTitle: "Admin Updated Role",
      companyName: "OnSpot Technologies Inc.",
      previousStatus: "under_review",
      newStatus: "shortlisted",
      eventKey: `status-history-${adminSubmissionId}`,
    });
    await notifyTalentOfApplicationStatusChange({
      submissionId: adminSubmissionId,
      talentUserId: null,
      candidateId: linkedCandidateId,
      applicantEmail: "not-the-talent@example.com",
      jobTitle: "Admin Updated Role",
      companyName: "OnSpot Technologies Inc.",
      previousStatus: "under_review",
      newStatus: "shortlisted",
      eventKey: `status-history-${adminSubmissionId}`,
    });
    await notifyTalentOfApplicationStatusChange({
      submissionId: adminSubmissionId,
      talentUserId: talentId,
      applicantEmail: null,
      jobTitle: "Admin Updated Role",
      previousStatus: "shortlisted",
      newStatus: "shortlisted",
    });

    const notifications = await storage.listNotificationsByUser(talentId, true);
    const clientChange = notifications.find((notification) => notification.relatedId === clientSubmissionId);
    const adminChanges = notifications.filter((notification) => notification.relatedId === adminSubmissionId);

    assert.ok(clientChange, "a Client status transition must notify the applicant");
    assert.equal(clientChange.userId, talentId, "notification must use the canonical users.id");
    assert.match(clientChange.message, /is now under review/i);
    assert.equal(adminChanges.length, 1, "a same-status save must not duplicate notifications");
    assert.equal(adminChanges[0].title, "You've Been Shortlisted");
    assert.match(adminChanges[0].message, /Admin Updated Role at OnSpot Technologies Inc. has been shortlisted/);
    notificationIds.push(clientChange.id, adminChanges[0].id);
  });

  it("skips an unlinked applicant without creating an invalid notification", async () => {
    const submissionId = `application-unlinked-status-${suffix}`;
    await notifyTalentOfApplicationStatusChange({
      submissionId,
      talentUserId: null,
      applicantEmail: `unlinked-${suffix}@example.com`,
      jobTitle: "Unlinked Role",
      previousStatus: "new",
      newStatus: "under_review",
    });

    const notifications = await query(
      `SELECT id FROM notifications
        WHERE type = 'job_application_status_changed' AND related_id = $1`,
      [submissionId],
    );
    assert.equal(notifications.rows.length, 0);
  });

  it("creates one Admin alert with the application deep-link context", async () => {
    const submissionId = `application-admin-alert-${suffix}`;
    await notifyAdminsOfClientApplicationStatusChange({
      submissionId,
      clientName: "Client Example",
      talentName: "Talent Example",
      jobTitle: "Operations Manager",
      newStatus: "shortlisted",
    });
    await notifyAdminsOfClientApplicationStatusChange({
      submissionId,
      clientName: "Client Example",
      talentName: "Talent Example",
      jobTitle: "Operations Manager",
      newStatus: "shortlisted",
    });

    const alerts = (await storage.listNotificationsByUser(adminId, true)).filter(
      (notification) =>
        notification.type === "client_application_status_changed" &&
        notification.relatedId === submissionId,
    );
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].relatedType, "job_submission");
    assert.match(alerts[0].message, /Client Example changed Talent Example's application/);
    assert.match(alerts[0].message, /Operations Manager to Shortlisted/);
    notificationIds.push(alerts[0].id);
  });
});