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

  before(async () => {
    const [clientA, clientB, talent] = await Promise.all([
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
    ]);
    clientAId = clientA.rows[0].id;
    clientBId = clientB.rows[0].id;
    talentId = talent.rows[0].id;
  });

  after(async () => {
    if (notificationIds.length) {
      await query(`DELETE FROM notifications WHERE id = ANY($1::text[])`, [notificationIds]).catch(() => {});
    }
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[clientAId, clientBId, talentId]]).catch(() => {});
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

  it("notifies Talent for Client and Admin status changes, but not same-status saves", async () => {
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
      talentUserId: talentId,
      applicantEmail: null,
      jobTitle: "Admin Updated Role",
      previousStatus: "under_review",
      newStatus: "shortlisted",
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
    assert.match(clientChange.message, /is now Under Review/);
    assert.equal(adminChanges.length, 1, "a same-status save must not duplicate notifications");
    assert.match(adminChanges[0].message, /is now Shortlisted/);
    notificationIds.push(clientChange.id, adminChanges[0].id);
  });
});