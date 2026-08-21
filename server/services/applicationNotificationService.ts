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
  candidateId?: string | null | undefined;
  applicantEmail: string | null | undefined;
  jobTitle: string | null | undefined;
  companyName?: string | null | undefined;
  previousStatus: string;
  newStatus: string;
  eventKey?: string | null | undefined;
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
 * Resolves the canonical users.id used by Talent notifications. The direct
 * submission owner and a candidate's user_id are authoritative; email is only a
 * compatibility fallback for legacy submissions that predate account linking.
 */
export async function resolveTalentNotificationRecipient({
  talentUserId,
  candidateId,
  applicantEmail,
}: {
  talentUserId?: string | null;
  candidateId?: string | null;
  applicantEmail?: string | null;
}): Promise<string | null> {
  const userLookup = await query(
    `SELECT u.id
       FROM users u
       LEFT JOIN candidates c ON c.user_id = u.id
      WHERE u.role = 'talent'
        AND (
          u.id = $1
          OR c.id = $2
          OR lower(u.email) = lower($3)
          OR lower(c.email) = lower($3)
        )
      ORDER BY CASE
        WHEN u.id = $1 THEN 0
        WHEN c.id = $2 THEN 1
        WHEN lower(u.email) = lower($3) THEN 2
        ELSE 3
      END
      LIMIT 1`,
    [talentUserId ?? null, candidateId ?? null, applicantEmail ?? null],
  );
  return userLookup.rows[0]?.id ?? null;
}

/**
 * Candidate-token routes must resolve through the candidate's persisted
 * user_id. Unlike server-side delivery, they intentionally do not fall back to
 * email: a token for one candidate must never read another user's alerts.
 */
export async function resolveTalentPortalNotificationRecipient(
  candidateId: string,
): Promise<string | null> {
  const userLookup = await query(
    `SELECT u.id
       FROM candidates c
       JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
        AND u.role = 'talent'
      LIMIT 1`,
    [candidateId],
  );
  return userLookup.rows[0]?.id ?? null;
}

function applicationTarget(
  jobTitle: string | null | undefined,
  companyName: string | null | undefined,
): string {
  if (jobTitle) return companyName ? `${jobTitle} at ${companyName}` : jobTitle;
  return companyName ? `a role at ${companyName}` : "your application";
}

function applicationStatusNotificationCopy(
  jobTitle: string | null | undefined,
  companyName: string | null | undefined,
  newStatus: string,
): { title: string; message: string } {
  const target = applicationTarget(jobTitle, companyName);
  switch (newStatus) {
    case "under_review":
      return {
        title: "Application Under Review",
        message: `Your application for ${target} is now under review.`,
      };
    case "shortlisted":
      return {
        title: "You've Been Shortlisted",
        message: `Your application for ${target} has been shortlisted.`,
      };
    case "interviewing":
      return {
        title: "Interview Stage",
        message: `Your application for ${target} has moved to the interview stage.`,
      };
    case "offer_extended":
      return {
        title: "Application Update",
        message: `An offer has been extended for your application to ${target}.`,
      };
    case "offer_accepted":
      return {
        title: "Offer Accepted",
        message: `Your offer for ${target} has been marked as accepted.`,
      };
    case "offer_declined":
      return {
        title: "Offer Declined",
        message: `The offer status for your application to ${target} has been updated to declined.`,
      };
    case "rejected":
      return {
        title: "Application Update",
        message: `Your application for ${target} will not be moving forward.`,
      };
    default:
      return {
        title: "Application Status Updated",
        message: `Your application for ${target} is now ${submissionStatusLabel(newStatus).toLowerCase()}.`,
      };
  }
}

/**
 * Persists a Talent-facing application status notification only for a real
 * transition. This shared helper is used for both Client and Admin changes so
 * recipient resolution and message wording cannot drift between endpoints.
 */
export async function notifyTalentOfApplicationStatusChange({
  submissionId,
  talentUserId,
  candidateId,
  applicantEmail,
  jobTitle,
  companyName,
  previousStatus,
  newStatus,
  eventKey,
}: TalentApplicationStatusNotificationInput): Promise<void> {
  if (previousStatus === newStatus) return;

  try {
    const recipientUserId = await resolveTalentNotificationRecipient({
      talentUserId,
      candidateId,
      applicantEmail,
    });
    if (!recipientUserId) {
      console.warn(
        "[application-status] notification skipped — linked talent user not found",
        { applicationId: submissionId, candidateId: candidateId ?? null },
      );
      return;
    }

    const { title, message } = applicationStatusNotificationCopy(jobTitle, companyName, newStatus);
    const notificationEventKey =
      eventKey ?? `application-status:${submissionId}:${previousStatus}:${newStatus}`;
    const created = await query(
      `INSERT INTO notifications
         (user_id, type, title, message, related_id, related_type, event_key)
       VALUES ($1, 'job_application_status_changed', $2, $3, $4, 'job_submission', $5)
       ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [recipientUserId, title, message, submissionId, notificationEventKey],
    );
    if (!created.rows[0]?.id) return;

    console.log("[application-status] notification created", {
      applicationId: submissionId,
      oldStatus: previousStatus,
      newStatus,
      talentUserId: recipientUserId,
      notificationId: created.rows[0].id,
    });
  } catch (error) {
    console.error(
      `[application-status] failed to create status notification for ${submissionId}:`,
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