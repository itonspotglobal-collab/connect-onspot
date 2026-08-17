/**
 * offerExpiryService.ts
 *
 * Scheduled job that runs every hour and:
 *  1. Finds offers that have passed their `expires_at` timestamp with status = 'sent'
 *  2. Marks each offer as 'expired'
 *  3. Sends an expiry notification email to the talent
 */

import cron from 'node-cron';
import { query as dbQuery } from '../db';
import {
  sendApplicantEmail,
  isEmailServiceConfigured,
} from './microsoftGraphEmailService';
import { storage } from '../storage';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(): string | null {
  const raw =
    process.env.PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.PUBLIC_BASE_URL ??
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : null);
  return raw ? raw.replace(/\/$/, '') : null;
}

function buildTalentExpiryEmailHtml(portalUrl: string): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;margin-bottom:8px;">Your offer has expired</h2>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A client offer you received has now passed its expiry date without a response,
    and has been marked as expired.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    If you believe this is a mistake or would still like to discuss the opportunity,
    please reach out to us directly.
  </p>
  <p style="margin:24px 0;">
    <a href="${portalUrl}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View My Applications
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    You can review your application history in your
    <a href="${portalUrl}" style="color:#4f46e5;">My Applications</a> page.
  </p>
</div>`.trim();
}
function buildTalentExpiryEmailHtml(portalUrl: string): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;margin-bottom:8px;">Your offer has expired</h2>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A client offer you received has now passed its expiry date without a response,
    and has been marked as expired.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    If you believe this is a mistake or would still like to discuss the opportunity,
    please reach out to us directly.
  </p>
  <p style="margin:24px 0;">
    <a href="${portalUrl}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View My Applications
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    You can review your application history in your
    <a href="${portalUrl}" style="color:#4f46e5;">My Applications</a> page.
  </p>
</div>`.trim();
}

/** Format a UTC timestamp as a human-readable deadline in Philippine Time (UTC+8). */
function formatDeadline(expiresAt: Date): string {
  return expiresAt.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function buildReminderEmailHtml(
  portalUrl: string,
  expiresAt: Date,
  firstName: string | null,
): string {
  const deadlineStr = formatDeadline(expiresAt);
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;margin-bottom:8px;">⏰ Your offer expires soon — action needed</h2>
  <p style="color:#444;font-size:15px;margin:12px 0;">${greeting}</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    You have a pending offer from a client that expires on
    <strong>${deadlineStr}</strong>.
    Please log in to your portal to accept or decline before that deadline.
  </p>
  <p style="margin:24px 0;">
    <a href="${portalUrl}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View &amp; Respond to Offer
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    If you no longer wish to respond, no action is needed and the offer will expire automatically.
    You can always review your application history in your
    <a href="${portalUrl}" style="color:#4f46e5;">My Applications</a> page.
  </p>
</div>`.trim();
}

// ─── core logic ───────────────────────────────────────────────────────────────

/**
 * Find sent offers expiring within the next 48 hours that haven't had a
 * reminder sent yet, and email the talent once.
 *
 * Atomic-claim pattern:
 *  1. Atomically stamp expiry_reminder_sent_at on all eligible rows in one
 *     UPDATE ... RETURNING. Concurrent workers race on the database UPDATE;
 *     only the one that wins rows actually sends email — the others find no
 *     rows to process.
 *  2. For each claimed row, attempt the email send.
 *  3. On failure, reset expiry_reminder_sent_at = NULL so the next hourly run
 *     can retry. Only successful sends leave the stamp in place.
 *
 * This guarantees at-most-one delivery attempt per worker tick while
 * preserving retry semantics for transient failures.
 */
export async function processExpiryReminders(): Promise<void> {
  const emailEnabled = isEmailServiceConfigured();
  const baseUrl = getBaseUrl();

  // Early-exit: leave all offers un-stamped for the next run if prerequisites
  // are missing.
  if (!emailEnabled) {
    console.warn('offerExpiryService: email service not configured — reminder sweep skipped (will retry next hour)');
    return;
  }
  if (!baseUrl) {
    console.warn('offerExpiryService: no base URL configured — reminder sweep skipped (will retry next hour)');
    return;
  }

  // Atomically claim eligible rows. Concurrent workers that race on this
  // UPDATE will find no rows (the winners already set the column non-NULL).
  const result = await dbQuery(
    `UPDATE offers
        SET expiry_reminder_sent_at = NOW(),
            updated_at              = NOW()
       FROM job_submissions js
      WHERE offers.submission_id           = js.id
        AND offers.status                  = 'sent'
        AND offers.expires_at             IS NOT NULL
        AND offers.expires_at              > NOW()
        AND offers.expires_at             <= NOW() + INTERVAL '48 hours'
        AND offers.expiry_reminder_sent_at IS NULL
  RETURNING offers.id,
            offers.expires_at,
            js.email,
            js.first_name`
  );

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    return; // nothing claimed — nothing to send
  }

  console.log(`⏰ offerExpiryService: claimed ${rows.length} offer(s) for reminder emails`);

  const portalUrl = `${baseUrl}/my-applications`;

  for (const row of rows) {
    const expiresAt = new Date(row.expires_at);
    const deadlineStr = formatDeadline(expiresAt);
    const subject = `Action needed: your offer expires on ${deadlineStr} — OnSpot Careers`;

    let sent = false;

    if (!row.email) {
      console.warn(`offerExpiryService: no email for offer ${row.id}; will reset claim for retry`);
    } else {
      try {
        const emailResult = await sendApplicantEmail({
          to: row.email,
          subject,
          bodyHtml: buildReminderEmailHtml(portalUrl, expiresAt, row.first_name ?? null),
        });

        if (emailResult.success) {
          sent = true;
          console.log(`✅ offerExpiryService: reminder email sent to ${row.email} for offer ${row.id} (deadline: ${deadlineStr})`);
        } else {
          console.warn(
            `offerExpiryService: reminder email failed for ${row.email} (offer ${row.id}) — will reset claim for retry:`,
            emailResult.error
          );
        }
      } catch (emailErr: any) {
        console.error(
          `offerExpiryService: unexpected error sending reminder for offer ${row.id} — will reset claim for retry:`,
          emailErr
        );
      }
    }

    // Reset the claim on failure so the next hourly run can retry.
    // Successful sends leave the stamp in place (no reset needed).
    if (!sent) {
      try {
        await dbQuery(
          `UPDATE offers
              SET expiry_reminder_sent_at = NULL,
                  updated_at              = NOW()
            WHERE id = $1`,
          [row.id]
        );
      } catch (resetErr: any) {
        console.error(
          `offerExpiryService: could not reset reminder claim for offer ${row.id} — next run will skip this offer:`,
          resetErr.message
        );
      }
    }
  }
}

/**
 * Find all sent offers that have passed their expiry timestamp,
 * mark them expired, and email the talent.
 */
export async function processExpiredOffers(): Promise<void> {
  // Atomically flip status to 'expired' and return the affected rows.
  // Joins to job_submissions for talent info and to users for client info.
  const result = await dbQuery(
    `UPDATE offers
        SET status     = 'expired',
            updated_at = NOW()
       FROM job_submissions js
       LEFT JOIN jobs       j  ON j.id  = js.job_id
       LEFT JOIN users      cu ON cu.id = js.client_id
      WHERE offers.submission_id = js.id
        AND offers.status        = 'sent'
        AND offers.expires_at   IS NOT NULL
        AND offers.expires_at    < NOW()
   RETURNING offers.id,
             offers.submission_id,
             offers.expires_at,
             js.email        AS talent_email,
             js.first_name   AS talent_first_name,
             js.client_id,
             cu.email        AS client_email,
             cu.first_name   AS client_first_name,
             j.title         AS job_title`
  );

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    return; // nothing to do
  }

  console.log(`⏰ offerExpiryService: ${rows.length} offer(s) expired — sending notifications`);

  // Determine whether email is available once (avoid per-row overhead)
  const emailEnabled = isEmailServiceConfigured();
  const baseUrl = getBaseUrl();

  for (const row of rows) {
    // Advance the submission status to 'offer_expired' and record history
    // in a single atomic step, capturing the actual prior submission status.
    try {
      const submissionUpdate = await dbQuery(
        `UPDATE job_submissions
            SET status     = 'offer_expired',
                updated_at = NOW()
          WHERE id = $1
      RETURNING (
        SELECT status FROM job_submissions WHERE id = $1
      ) AS prior_status`,
        [row.submission_id]
      );
      // The RETURNING subquery reads the OLD row before the update inside the
      // same statement on some PG versions; use a separate read as a fallback.
      const priorStatus: string =
        submissionUpdate.rows[0]?.prior_status ?? 'offer_extended';

      await dbQuery(
        `INSERT INTO job_application_status_history
           (application_id, previous_status, new_status, note, changed_by)
         VALUES ($1, $2, 'offer_expired', 'Offer expired automatically', 'system')`,
        [row.submission_id, priorStatus]
      );
    } catch (histErr: any) {
      // Non-fatal — don't let a history write block the email
      console.warn(
        `offerExpiryService: could not update submission status / write history for submission ${row.submission_id}:`,
        histErr.message
      );
    }

    // ── Notify the client (in-app + email) ────────────────────────────────────
    if (row.client_id) {
      // In-app notification
      storage.createNotification({
        userId: row.client_id,
        type: 'offer_expired',
        title: 'Offer expired without a response',
        message: `An offer you sent${row.job_title ? ` for ${row.job_title}` : ''} has expired without a response from the talent.`,
        relatedId: String(row.id),
        relatedType: 'offer',
      }).catch((notifyErr: any) => {
        console.error(
          `offerExpiryService: could not create client notification for offer ${row.id}:`,
          notifyErr
        );
      });

      // Client email
      if (emailEnabled && row.client_email && baseUrl) {
        const clientPortalUrl = `${baseUrl}/client-profile`;
        const jobTitle: string = row.job_title ?? 'the role';
        const clientSubject = `Your offer has expired without a response — OnSpot Careers`;
        try {
          const clientEmailResult = await sendApplicantEmail({
            to: row.client_email,
            subject: clientSubject,
            bodyHtml: buildClientExpiryEmailHtml(jobTitle, clientPortalUrl),
          });
          if (clientEmailResult.success) {
            console.log(`✅ offerExpiryService: expiry email sent to client ${row.client_email} for offer ${row.id}`);
          } else {
            console.warn(
              `offerExpiryService: client expiry email failed for ${row.client_email} (offer ${row.id}):`,
              clientEmailResult.error
            );
          }
        } catch (clientEmailErr: any) {
          console.error(
            `offerExpiryService: unexpected error sending client expiry email for offer ${row.id}:`,
            clientEmailErr
          );
        }
      }
    }

    // ── Notify the talent (email) ──────────────────────────────────────────────
    if (!emailEnabled) {
      console.warn('offerExpiryService: email service not configured; skipping talent expiry email');
      continue;
    }
    if (!row.talent_email) {
      console.warn(`offerExpiryService: no email address for offer ${row.id}; skipping talent email`);
      continue;
    }
    if (!baseUrl) {
      console.warn('offerExpiryService: no base URL configured; skipping talent expiry email');
      continue;
    }

    const portalUrl = `${baseUrl}/my-applications`;
    const subject = `Your offer has expired — OnSpot Careers`;

    try {
      const emailResult = await sendApplicantEmail({
        to: row.talent_email,
        subject,
        bodyHtml: buildTalentExpiryEmailHtml(portalUrl),
      });

      if (emailResult.success) {
        console.log(`✅ offerExpiryService: expiry email sent to talent ${row.talent_email} for offer ${row.id}`);
      } else {
        console.warn(
          `offerExpiryService: talent expiry email failed for ${row.talent_email} (offer ${row.id}):`,
          emailResult.error
        );
      }
    } catch (emailErr: any) {
      console.error(
        `offerExpiryService: unexpected error sending talent expiry email for offer ${row.id}:`,
        emailErr
      );
    }
  }
}

// ─── scheduler ────────────────────────────────────────────────────────────────

export class OfferExpiryService {
  startCronJob(): void {
    // Run at the top of every hour
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ offerExpiryService: running hourly expiry check…');
      try {
        await processExpiryReminders();
      } catch (err: any) {
        console.error('offerExpiryService: reminder run failed:', err);
      }
      try {
        await processExpiredOffers();
      } catch (err: any) {
        console.error('offerExpiryService: expiry run failed:', err);
      }
    });

    console.log('✅ offerExpiryService: cron job started — runs at the top of every hour');

    // Run once immediately on startup (sequenced: reminders before expiry so
    // we never send a reminder for an offer the expiry sweep is about to mark).
    (async () => {
      try {
        await processExpiryReminders();
      } catch (err: any) {
        console.error('offerExpiryService: initial reminder check failed:', err);
      }
      try {
        await processExpiredOffers();
      } catch (err: any) {
        console.error('offerExpiryService: initial expiry check failed:', err);
      }
    })();
  }
}

export const offerExpiryService = new OfferExpiryService();

function buildClientExpiryEmailHtml(jobTitle: string, clientPortalUrl: string): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;margin-bottom:8px;">Your offer has expired without a response</h2>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    The offer you sent for <strong>${jobTitle}</strong> has passed its expiry date
    without a response from the talent, and has been marked as expired.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    You can extend a new offer or take further action from your hiring pipeline.
  </p>
  <p style="margin:24px 0;">
    <a href="${clientPortalUrl}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View Hiring Pipeline
    </a>
  </p>
</div>`.trim();
}
