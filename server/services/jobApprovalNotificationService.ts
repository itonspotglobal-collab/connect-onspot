import { randomUUID } from "crypto";
import { pool } from "../db";

export type JobApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "linked_to_existing"
  | "revision_needed";
type NotifiableJobApprovalStatus = "pending" | "approved" | "rejected";

export interface JobApprovalTransitionResult {
  job: any;
  previousStatus: JobApprovalStatus;
  newStatus: NotifiableJobApprovalStatus;
  transitioned: boolean;
  eventKey: string | null;
}

interface JobApprovalNotificationCopy {
  type: "job_approved" | "job_pending" | "job_rejected";
  title: string;
  message: string;
}

function normalizeApprovalStatus(value: unknown): JobApprovalStatus {
  if (
    value === "approved" ||
    value === "rejected" ||
    value === "linked_to_existing" ||
    value === "revision_needed"
  ) {
    return value;
  }
  return "pending";
}

export function buildJobApprovalNotification(
  previousStatus: JobApprovalStatus,
  newStatus: NotifiableJobApprovalStatus,
  jobTitle: string,
  rejectionReason?: string | null,
): JobApprovalNotificationCopy | null {
  if (previousStatus === newStatus) return null;

  switch (newStatus) {
    case "approved":
      return {
        type: "job_approved",
        title: "Job post approved",
        message: `Your job post “${jobTitle}” has been approved and is now live.`,
      };
    case "pending":
      return {
        type: "job_pending",
        title: "Job post moved back to review",
        message: `Your job post “${jobTitle}” has been moved back to Pending Approval and is no longer publicly visible.`,
      };
    case "rejected": {
      const reason = rejectionReason?.trim();
      return {
        type: "job_rejected",
        title: "Job post rejected",
        message: reason
          ? `Your job post “${jobTitle}” was not approved. Reason: ${reason}`
          : `Your job post “${jobTitle}” was not approved.`,
      };
    }
    default:
      return null;
  }
}

/**
 * Applies one Admin approval-status transition and creates its Client
 * notification atomically. A repeated request that finds the same status is
 * a successful no-op, while a later transition receives a new event key.
 */
export async function transitionJobApprovalStatus(input: {
  jobId: string;
  newStatus: NotifiableJobApprovalStatus;
  adminId?: string | null;
  rejectionReason?: string | null;
}): Promise<JobApprovalTransitionResult | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT *
         FROM jobs
        WHERE id = $1
        FOR UPDATE`,
      [input.jobId],
    );
    if (currentResult.rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }

    const currentJob = currentResult.rows[0];
    const previousStatus = normalizeApprovalStatus(currentJob.approval_status);
    const newStatus = input.newStatus;

    if (previousStatus === newStatus) {
      await client.query("COMMIT");
      return {
        job: currentJob,
        previousStatus,
        newStatus,
        transitioned: false,
        eventKey: null,
      };
    }

    const transitionEventKey = `job-approval-transition:${input.jobId}:${randomUUID()}`;
    let updateResult;

    if (newStatus === "approved") {
      updateResult = await client.query(
        `UPDATE jobs SET
           approval_status = 'approved',
           status = 'open',
           approved_by = $1,
           approved_at = NOW(),
           posted_at = COALESCE(posted_at, NOW()),
           rejected_by = NULL,
           rejected_at = NULL,
           rejection_reason = NULL,
           updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [input.adminId ?? null, input.jobId],
      );
    } else if (newStatus === "rejected") {
      updateResult = await client.query(
        `UPDATE jobs SET
           approval_status = 'rejected',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2,
           approved_by = NULL,
           approved_at = NULL,
           updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [input.adminId ?? null, input.rejectionReason?.trim() || null, input.jobId],
      );
    } else {
      updateResult = await client.query(
        `UPDATE jobs SET
           approval_status = 'pending',
           approved_by = NULL,
           approved_at = NULL,
           rejected_by = NULL,
           rejected_at = NULL,
           rejection_reason = NULL,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.jobId],
      );
    }

    const updatedJob = updateResult.rows[0];
    const notification = buildJobApprovalNotification(
      previousStatus,
      newStatus,
      String(updatedJob.title ?? ""),
      newStatus === "rejected" ? updatedJob.rejection_reason : null,
    );

    if (notification && updatedJob.client_id) {
      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, related_id, related_type, event_key)
         VALUES ($1, $2, $3, $4, $5, 'job', $6)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          updatedJob.client_id,
          notification.type,
          notification.title,
          notification.message,
          updatedJob.id,
          transitionEventKey,
        ],
      );
    }

    await client.query("COMMIT");
    return {
      job: updatedJob,
      previousStatus,
      newStatus,
      transitioned: true,
      eventKey: transitionEventKey,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}