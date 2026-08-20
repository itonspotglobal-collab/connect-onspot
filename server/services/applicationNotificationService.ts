import { submissionStatusLabel } from "../../shared/submissionStatuses";
import { query } from "../db";
import { storage } from "../storage";

type ClientApplicationNotificationInput = {
  submissionId: string;
  clientUserId: string | null | undefined;
  applicantDisplayName: string;
  jobTitle: string | null | undefined;
};

type TalentApplicationStatusNotificationInput = {
  submissionId: string;
  talentUserId: string | null | undefined;
  applicantEmail: string | null | undefined;
  jobTitle: string | null | undefined;
  previousStatus: string;
  newStatus: string;
};

type AdminClientStatusNotificationInput = {
  submissionId: string;
  clientName: string | null | undefined;
  talentName: string | null | undefined;
  jobTitle: string | null | undefined;
  newStatus: string;
};

/**
 * Persists the Client-facing notification emitted after a new job submission is
 * saved. job_submissions.client_id is a direct users.id foreign key, so there is
 * no profile or email lookup in this path.
 */
export async function notifyClientOfJobApplication({
  submissionId,
  clientUserId,
  applicantDisplayName,
  jobTitle,
}: ClientApplicationNotificationInput): Promise<void> {
  if (!clientUserId) {
    console.warn(
      `[application-notifications] skipped application-received notification for ${submissionId}: no client user ID`,
    );
    return;
  }

  try {
    await storage.createNotification({
      userId: clientUserId,
      type: "job_application_received",
      title: "New application received",
      message: `${applicantDisplayName} applied for ${jobTitle || "your job"}.`,
      relatedId: submissionId,
      relatedType: "job_submission",
    });
  } catch (error) {
    console.error(
      `[application-notifications] failed application-received notification for submission ${submissionId}, client ${clientUserId}:`,
      error,
    );
  }
}

/**
 * Resolves the canonical users.id used by notifications. New linked submissions
 * carry talent_id directly; legacy unlinked rows may only have an email, which is
 * intentionally a fallback rather than the primary ownership mechanism.
 */
async function resolveTalentNotificationRecipient(
  talentUserId: string | null | undefined,
  applicantEmail: string | null | undefined,
): Promise<string | null> {
  if (talentUserId) return talentUserId;
  if (!applicantEmail) return null;

  const userLookup = await query(
    `SELECT id FROM users
     WHERE lower(email) = lower($1) AND role = 'talent'
     LIMIT 1`,
    [applicantEmail],
  );
  return userLookup.rows[0]?.id ?? null;
}

/**
 * Persists a Talent-facing application status notification only for a real
 * transition. This shared helper is used for both Client and Admin changes so
 * recipient resolution and message wording cannot drift between endpoints.
 */
export async function notifyTalentOfApplicationStatusChange({
  submissionId,
  talentUserId,
  applicantEmail,
  jobTitle,
  previousStatus,
  newStatus,
}: TalentApplicationStatusNotificationInput): Promise<void> {
  if (previousStatus === newStatus) return;

  try {
    const recipientUserId = await resolveTalentNotificationRecipient(talentUserId, applicantEmail);
    if (!recipientUserId) {
      console.warn(
        `[application-notifications] skipped status notification for ${submissionId}: no linked talent user`,
      );
      return;
    }

    const roleTitle = jobTitle || "your application";
    const message =
      newStatus === "rejected"
        ? `Your application for ${roleTitle} was not selected.`
        : `Your application for ${roleTitle} is now ${submissionStatusLabel(newStatus)}.`;

    await storage.createNotification({
      userId: recipientUserId,
      type: "job_application_status_changed",
      title: "Application update",
      message,
      relatedId: submissionId,
      relatedType: "job_submission",
    });
  } catch (error) {
    console.error(
      `[application-notifications] failed status notification for submission ${submissionId}:`,
      error,
    );
  }
}

/**
 * Persists one Admin-facing notification for a Client-originated status
 * transition. The event is keyed by the canonical submission and transition
 * text so a retried request cannot create another alert.
 */
export async function notifyAdminsOfClientApplicationStatusChange({
  submissionId,
  clientName,
  talentName,
  jobTitle,
  newStatus,
}: AdminClientStatusNotificationInput): Promise<void> {
  const message = `${clientName || "A Client"} changed ${talentName || "a Talent"}'s application for ${jobTitle || "a job"} to ${submissionStatusLabel(newStatus)}.`;

  try {
    const admins = await query(`SELECT id FROM users WHERE role = 'admin'`);
    await Promise.all(
      admins.rows.map(async (admin) => {
        const existing = await query(
          `SELECT id
             FROM notifications
            WHERE user_id = $1
              AND type = 'client_application_status_changed'
              AND related_id = $2
              AND message = $3
            LIMIT 1`,
          [admin.id, submissionId, message],
        );
        if (existing.rows.length > 0) return;

        await storage.createNotification({
          userId: admin.id,
          type: "client_application_status_changed",
          title: "Client updated application",
          message,
          relatedId: submissionId,
          relatedType: "job_submission",
        });
      }),
    );
  } catch (error) {
    console.error(
      `[application-notifications] failed Client status notification for submission ${submissionId}:`,
      error,
    );
  }
}