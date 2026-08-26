/**
 * emailCompanionService.ts
 *
 * Central companion email service for non-blocking, idempotent notification emails.
 *
 * Every public function here is:
 *   - Non-throwing: errors are caught and logged; the caller's business action
 *     is never rolled back by an email failure.
 *   - Idempotent: the delivery ledger uses an atomic INSERT-first claim so
 *     concurrent retries cannot both send the same email.
 *   - Privacy-safe: applicant contact PII is never included in Client-facing
 *     notifications unless the caller explicitly resolves it.
 *
 * Delivery lifecycle:
 *   1. claimEmailDelivery() → atomically inserts a 'processing' row (or claims a
 *      'failed' retry). Returns false if already 'sent' or currently in-flight.
 *   2. Build and send the email.
 *   3. markEmailDeliveryResult() → writes the final 'sent' or 'failed' status.
 *
 * A stale 'processing' row (crash mid-send) is re-claimable after 10 minutes.
 */

import { query } from "../db.js";
import {
  sendApplicantEmail,
  isEmailServiceConfigured,
  ALLOWED_SENDERS,
} from "./microsoftGraphEmailService.js";
import {
  renderBrandedEmailLayout,
  renderApplicantEmail,
  buildEmailContext,
} from "./emailVariableResolver.js";

/** Default sender for client-facing companion emails. */
const CLIENT_SENDER = "hiretalent@onspotglobal.com";

/** Cooldown window for unread-message emails (minutes). */
export const MESSAGE_EMAIL_COOLDOWN_MINUTES = 15;

/** How long a 'processing' claim is held before another request may retry (minutes). */
const CLAIM_EXPIRY_MINUTES = 10;

// ── Internal helpers ──────────────────────────────────────────────────────────

function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBaseUrl(): string | null {
  const raw =
    process.env.PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.PUBLIC_BASE_URL ??
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : null);
  return raw ? raw.replace(/\/$/, "") : null;
}

function resolveClientPortalUrl(): string {
  const base = getBaseUrl();
  return base ? `${base}/client-profile` : "#";
}

function resolveMessagesUrl(): string {
  const base = getBaseUrl();
  return base ? `${base}/messages` : "#";
}

// ── Delivery Ledger — Atomic Claim ────────────────────────────────────────────

/**
 * Attempt to atomically claim the delivery slot for this event key.
 *
 * Returns true  when the caller should proceed to send (claim successful).
 * Returns false when:
 *   - The event was already successfully sent ('sent' status).
 *   - Another concurrent request is currently in-flight ('processing' status
 *     within the claim-expiry window).
 *
 * Fails open (returns true) on DB error so a ledger outage never silences
 * delivery permanently.
 *
 * Recovery:
 *   - A previous failure ('failed' status) is re-claimable immediately.
 *   - A stale 'processing' row (crash during send) is re-claimable after
 *     CLAIM_EXPIRY_MINUTES minutes.
 */
export async function claimEmailDelivery(opts: {
  eventKey: string;
  eventType: string;
  recipientEmail: string | null;
  recipientUserId: string | null;
  senderEmail: string;
  templateCategory?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  templateId?: string | null;
  subject?: string | null;
  bodyHtml?: string | null;
  sentBy?: string | null;
  senderName?: string | null;
  isTest?: boolean;
}): Promise<boolean> {
  try {
    const result = await query(
      `INSERT INTO email_notification_deliveries
         (event_key, event_type, recipient_email, recipient_user_id, sender_email,
          template_category, related_type, related_id, template_id, subject,
          body_html, sent_by, sender_name, is_test, status, attempted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'processing', NOW())
       ON CONFLICT (event_key) DO UPDATE
         SET status       = 'processing',
             attempted_at = NOW(),
             recipient_email = EXCLUDED.recipient_email,
             recipient_user_id = EXCLUDED.recipient_user_id,
             sender_email = EXCLUDED.sender_email,
             template_category = EXCLUDED.template_category,
             related_type = EXCLUDED.related_type,
             related_id = EXCLUDED.related_id,
             template_id = EXCLUDED.template_id,
             subject = EXCLUDED.subject,
             body_html = EXCLUDED.body_html,
             sent_by = EXCLUDED.sent_by,
             sender_name = EXCLUDED.sender_name,
             is_test = EXCLUDED.is_test
         WHERE email_notification_deliveries.status = 'failed'
            OR (
                 email_notification_deliveries.status = 'processing'
                 AND email_notification_deliveries.attempted_at
                       < NOW() - ($15 || ' minutes')::interval
               )
       RETURNING id`,
      [
        opts.eventKey,
        opts.eventType,
        opts.recipientEmail,
        opts.recipientUserId,
        opts.senderEmail,
        opts.templateCategory ?? null,
        opts.relatedType ?? null,
        opts.relatedId ?? null,
        opts.templateId ?? null,
        opts.subject ?? null,
        opts.bodyHtml ?? null,
        opts.sentBy ?? null,
        opts.senderName ?? null,
        opts.isTest ?? false,
        String(CLAIM_EXPIRY_MINUTES),
      ],
    );
    // Row returned → we own this delivery. No row → already sent or in-flight.
    return result.rows.length > 0;
  } catch (e: any) {
    // Fail open: a DB outage must not permanently suppress delivery.
    console.warn("[emailCompanionService] claimEmailDelivery failed (fail-open):", e?.message);
    return true;
  }
}

/**
 * Write the final 'sent' or 'failed' status after attempting delivery.
 * Non-throwing — a failure to update the ledger is logged but does not propagate.
 */
export async function markEmailDeliveryResult(opts: {
  eventKey: string;
  status: "sent" | "failed";
  error?: string | null;
}): Promise<void> {
  try {
    await query(
      `UPDATE email_notification_deliveries
          SET status   = $2,
              error    = $3,
              sent_at  = CASE WHEN $2 = 'sent' THEN NOW() ELSE NULL END
        WHERE event_key = $1`,
      [opts.eventKey, opts.status, opts.error ?? null],
    );
  } catch (e: any) {
    console.warn("[emailCompanionService] markEmailDeliveryResult failed (non-fatal):", e?.message);
  }
}

/**
 * Read-only check — returns true if an email with this event key was already
 * successfully delivered. Callers may use this for diagnostic purposes.
 * Fails open (returns false) so a DB hiccup never permanently silences delivery.
 */
export async function isEventAlreadyDelivered(eventKey: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM email_notification_deliveries
        WHERE event_key = $1 AND status = 'sent'
        LIMIT 1`,
      [eventKey],
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

// ── Job Approval Companion Emails ─────────────────────────────────────────────

export interface JobApprovalCompanionEmailOptions {
  jobId: string;
  jobTitle: string;
  clientUserId: string;
  newStatus: "approved" | "rejected" | "unapproved" | "pending";
  rejectionReason?: string | null;
  /** Deterministic event key from the approval transition (one UUID per real transition). */
  transitionEventKey: string;
  reviewedContent?: {
    subject: string;
    bodyHtml: string;
    templateId?: string | null;
    senderEmail?: string | null;
    sentBy?: string | null;
  };
}

export interface CompanionEmailDeliveryResult {
  status: "sent" | "failed" | "skipped";
  eventKey: string;
  error?: string | null;
}

/**
 * Send a non-blocking email to the job owner (Client) when a job approval
 * status transitions. Uses the transition event key for idempotency.
 * "pending" transitions do not send an email (informational noise for clients).
 */
export async function sendJobApprovalCompanionEmail(
  opts: JobApprovalCompanionEmailOptions,
): Promise<CompanionEmailDeliveryResult> {
  const {
    jobId,
    jobTitle,
    clientUserId,
    newStatus,
    rejectionReason,
    transitionEventKey,
    reviewedContent,
  } = opts;
  const emailEventKey = `job-approval-email:${transitionEventKey}`;
  if (newStatus === "pending" && !reviewedContent) {
    return { status: "skipped", eventKey: emailEventKey };
  }

  const requestedSender = reviewedContent?.senderEmail ?? CLIENT_SENDER;
  const senderEmail = ALLOWED_SENDERS[requestedSender] ? requestedSender : CLIENT_SENDER;
  const senderName = ALLOWED_SENDERS[senderEmail] ?? "OnSpot Hire Talent";

  if (!isEmailServiceConfigured()) {
    console.warn("[emailCompanionService] sendJobApprovalCompanionEmail: email not configured — skipping");
    return {
      status: "failed",
      eventKey: emailEventKey,
      error: "Microsoft Graph email is not configured.",
    };
  }

  try {
    // Resolve Client email first so we have the recipient before claiming the slot
    const recipientResult = await query(
      `SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`,
      [clientUserId],
    );
    if (!recipientResult.rows.length) {
      console.warn(`[emailCompanionService] sendJobApprovalCompanionEmail: no user row for client ${clientUserId} — skipping`);
      return {
        status: "failed",
        eventKey: emailEventKey,
        error: "Client account owner could not be resolved.",
      };
    }
    const clientRow = recipientResult.rows[0];
    const recipientEmail: string = clientRow.email;
    const firstName: string = clientRow.first_name ?? "there";

    let subject: string;
    let bodyHtml: string;

    if (reviewedContent) {
      subject = reviewedContent.subject;
      bodyHtml = reviewedContent.bodyHtml;
    } else {
      const safeTitle = escHtml(jobTitle);
      const portalUrl = resolveClientPortalUrl();
      let contentHtml: string;

      if (newStatus === "approved") {
        subject = `Your job post "${jobTitle}" has been approved`;
        contentHtml = `
<h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">Your job post is now live</h1>
<p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escHtml(firstName)},</p>
<p style="color:#444;font-size:15px;margin:12px 0;">
  Great news — your job post <strong>&ldquo;${safeTitle}&rdquo;</strong> has been reviewed and approved.
  It is now live and visible to talent on OnSpot.
</p>
<p style="margin:26px 0 20px;">
  <a href="${escHtml(portalUrl)}"
     style="background:#6d5ef7;color:#fff;padding:13px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
    View your hiring pipeline
  </a>
</p>
<p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
  Applications will appear in your OnSpot portal as candidates apply.
</p>`.trim();
      } else {
        const reasonSection = rejectionReason?.trim()
          ? `<p style="color:#444;font-size:15px;margin:12px 0;"><strong>Reason:</strong> ${escHtml(rejectionReason.trim())}</p>`
          : "";
        subject = `Your job post "${jobTitle}" requires attention`;
        contentHtml = `
<h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">Job post not approved</h1>
<p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escHtml(firstName)},</p>
<p style="color:#444;font-size:15px;margin:12px 0;">
  Your job post <strong>&ldquo;${safeTitle}&rdquo;</strong> was reviewed and could not be approved at this time.
</p>
${reasonSection}
<p style="color:#444;font-size:15px;margin:12px 0;">
  Please review any feedback, update your post, and resubmit.
  Our team is happy to help if you have questions.
</p>
<p style="margin:26px 0 20px;">
  <a href="${escHtml(portalUrl)}"
     style="background:#6d5ef7;color:#fff;padding:13px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
    Review and update your job post
  </a>
</p>`.trim();
      }

      const rendered = renderApplicantEmail(
        { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
        buildEmailContext({ email: recipientEmail }),
      );
      subject = rendered.subject;
      bodyHtml = rendered.bodyHtml;
    }

    // Atomically claim the canonical delivery slot. Automatic and
    // composer-reviewed sends use the same transition-derived event key.
    const claimed = await claimEmailDelivery({
      eventKey: emailEventKey,
      eventType: `job_${newStatus}`,
      recipientEmail,
      recipientUserId: clientUserId,
      senderEmail,
      templateCategory: `job_${newStatus}`,
      relatedType: "job",
      relatedId: jobId,
      templateId: reviewedContent?.templateId ?? null,
      subject,
      bodyHtml,
      sentBy: reviewedContent?.sentBy ?? null,
      senderName,
      isTest: false,
    });
    if (!claimed) {
      console.log(`[emailCompanionService] sendJobApprovalCompanionEmail: delivery slot already claimed for ${emailEventKey} — skipping`);
      return { status: "skipped", eventKey: emailEventKey };
    }

    const sendResult = await sendApplicantEmail({
      to: recipientEmail,
      subject,
      bodyHtml,
      senderEmail,
    });

    await markEmailDeliveryResult({
      eventKey: emailEventKey,
      status: sendResult.success ? "sent" : "failed",
      error: sendResult.error,
    });

    if (sendResult.success) {
      console.log(
        `[emailCompanionService] Job ${newStatus} email sent to ${recipientEmail} for job "${jobTitle}"`,
      );
    } else {
      console.error(
        `[emailCompanionService] sendJobApprovalCompanionEmail failed for client ${clientUserId}:`,
        sendResult.error,
      );
    }
    return {
      status: sendResult.success ? "sent" : "failed",
      eventKey: emailEventKey,
      error: sendResult.error,
    };
  } catch (err: any) {
    console.error(
      "[emailCompanionService] sendJobApprovalCompanionEmail (non-fatal):",
      err?.message,
    );
    return {
      status: "failed",
      eventKey: emailEventKey,
      error: err?.message ?? "Unknown email delivery error",
    };
  }
}

// ── New-Application Client Email ───────────────────────────────────────────────

export interface ClientNewApplicationEmailOptions {
  submissionId: string;
  clientUserId: string;
  /** Privacy-safe display name already computed by the caller. Never includes contact details. */
  applicantDisplayName: string;
  jobTitle: string | null | undefined;
}

/**
 * Send a non-blocking email to the Client when a new application arrives.
 * No applicant contact details are ever included; only the display name.
 */
export async function sendClientNewApplicationEmail(
  opts: ClientNewApplicationEmailOptions,
): Promise<void> {
  const { submissionId, clientUserId, applicantDisplayName, jobTitle } = opts;
  const emailEventKey = `client-application-email:${submissionId}`;
  const senderEmail = CLIENT_SENDER;

  if (!isEmailServiceConfigured()) return;

  try {
    const recipientResult = await query(
      `SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`,
      [clientUserId],
    );
    if (!recipientResult.rows.length) return;

    const clientRow = recipientResult.rows[0];
    const recipientEmail: string = clientRow.email;
    const firstName: string = clientRow.first_name ?? "there";

    // Atomically claim the delivery slot
    const claimed = await claimEmailDelivery({
      eventKey: emailEventKey,
      eventType: "client_new_application",
      recipientEmail,
      recipientUserId: clientUserId,
      senderEmail,
    });
    if (!claimed) return;

    const safeApplicant = escHtml((applicantDisplayName || "A new applicant").trim());
    const safeJobTitle = jobTitle ? escHtml(jobTitle) : "your job";
    const portalUrl = resolveClientPortalUrl();
    const subject = `New application received for "${jobTitle ?? "your job"}"`;

    const contentHtml = `
<h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">New application received</h1>
<p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escHtml(firstName)},</p>
<p style="color:#444;font-size:15px;margin:12px 0;">
  <strong>${safeApplicant}</strong> has applied for <strong>${safeJobTitle}</strong>.
  Review their application in your hiring pipeline.
</p>
<p style="margin:26px 0 20px;">
  <a href="${escHtml(portalUrl)}"
     style="background:#6d5ef7;color:#fff;padding:13px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
    View application
  </a>
</p>
<p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
  Log in to the OnSpot portal to review all applications and move candidates through your pipeline.
</p>`.trim();

    const rendered = renderApplicantEmail(
      { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
      buildEmailContext({ email: recipientEmail }),
    );

    const sendResult = await sendApplicantEmail({
      to: recipientEmail,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      senderEmail,
    });

    await markEmailDeliveryResult({
      eventKey: emailEventKey,
      status: sendResult.success ? "sent" : "failed",
      error: sendResult.error,
    });

    if (sendResult.success) {
      console.log(
        `[emailCompanionService] New-application email sent to ${recipientEmail} for submission ${submissionId}`,
      );
    } else {
      console.warn(
        `[emailCompanionService] sendClientNewApplicationEmail failed for client ${clientUserId}:`,
        sendResult.error,
      );
    }
  } catch (err: any) {
    console.error("[emailCompanionService] sendClientNewApplicationEmail (non-fatal):", err?.message);
  }
}

// ── Chat Unread Email ──────────────────────────────────────────────────────────

export interface UnreadMessageEmailOptions {
  recipientUserId: string;
  threadId: string;
  /** Resolved display name of the sender — never contact PII. */
  senderName: string;
}

/**
 * Send one unread-message email per recipient/thread within the cooldown window.
 * Uses the message_email_cooldowns table for atomic deduplication (separate from
 * the general ledger because the cooldown resets on read).
 *
 * - No message body is ever included.
 * - Delivery is reset when the thread is read via resetMessageEmailCooldown().
 * - Graph or send failure resets the cooldown so the next message can retry.
 */
export async function sendUnreadMessageEmail(opts: UnreadMessageEmailOptions): Promise<void> {
  const { recipientUserId, threadId, senderName } = opts;

  if (!isEmailServiceConfigured()) return;

  try {
    // Resolve recipient
    const recipientResult = await query(
      `SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`,
      [recipientUserId],
    );
    if (!recipientResult.rows.length) return;
    const recipientRow = recipientResult.rows[0];
    const recipientEmail: string = recipientRow.email;
    const firstName: string = recipientRow.first_name ?? "there";

    // Atomic cooldown claim: only proceeds when no email was sent within the window.
    const cooldownResult = await query(
      `INSERT INTO message_email_cooldowns (thread_id, user_id, email_sent_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET email_sent_at = NOW(),
             updated_at    = NOW()
         WHERE message_email_cooldowns.email_sent_at
               < NOW() - ($3 || ' minutes')::interval
       RETURNING id`,
      [threadId, recipientUserId, String(MESSAGE_EMAIL_COOLDOWN_MINUTES)],
    );

    // No row returned = within cooldown window → skip silently
    if (!cooldownResult.rows.length) return;

    const safeSender = escHtml((senderName || "Someone").trim());
    const messagesUrl = resolveMessagesUrl();
    const subject = `New message from ${(senderName || "someone").trim()} on OnSpot`;

    const contentHtml = `
<h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">You have a new message</h1>
<p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escHtml(firstName)},</p>
<p style="color:#444;font-size:15px;margin:12px 0;">
  <strong>${safeSender}</strong> sent you a message on OnSpot. Log in to view and reply.
</p>
<p style="margin:26px 0 20px;">
  <a href="${escHtml(messagesUrl)}"
     style="background:#6d5ef7;color:#fff;padding:13px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
    View message
  </a>
</p>
<p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
  You&apos;ll receive at most one email notification per conversation every
  ${MESSAGE_EMAIL_COOLDOWN_MINUTES} minutes.
</p>`.trim();

    const rendered = renderApplicantEmail(
      { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
      buildEmailContext({ email: recipientEmail }),
    );

    const senderEmail = ALLOWED_SENDERS[CLIENT_SENDER]
      ? CLIENT_SENDER
      : process.env.MICROSOFT_SENDER_EMAIL || process.env.APPLICATION_EMAIL_FROM || CLIENT_SENDER;

    const sendResult = await sendApplicantEmail({
      to: recipientEmail,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      senderEmail,
    });

    if (!sendResult.success) {
      // Reset cooldown on failure so the next message can trigger a retry.
      await query(
        `DELETE FROM message_email_cooldowns WHERE thread_id = $1 AND user_id = $2`,
        [threadId, recipientUserId],
      ).catch(() => {});
      console.warn(
        `[emailCompanionService] sendUnreadMessageEmail failed for ${recipientEmail}:`,
        sendResult.error,
      );
    } else {
      console.log(
        `[emailCompanionService] Unread message email sent to ${recipientEmail} for thread ${threadId}`,
      );
    }
  } catch (err: any) {
    console.error("[emailCompanionService] sendUnreadMessageEmail (non-fatal):", err?.message);
  }
}

/**
 * Reset the cooldown when a user reads a thread so their next unread message
 * is eligible for a fresh email. Called by the mark-read route.
 */
export async function resetMessageEmailCooldown(
  userId: string,
  threadId: string,
): Promise<void> {
  try {
    await query(
      `DELETE FROM message_email_cooldowns WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    );
  } catch (err: any) {
    console.warn("[emailCompanionService] resetMessageEmailCooldown (non-fatal):", err?.message);
  }
}
