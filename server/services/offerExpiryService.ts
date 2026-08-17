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

function buildExpiryEmailHtml(portalUrl: string): string {
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

// ─── core logic ───────────────────────────────────────────────────────────────

/**
 * Find all sent offers that have passed their expiry timestamp,
 * mark them expired, and email the talent.
 */
export async function processExpiredOffers(): Promise<void> {
  // Atomically flip status to 'expired' and return the affected rows
  // (including talent email from the join with job_submissions → candidates)
  const result = await dbQuery(
    `UPDATE offers
        SET status     = 'expired',
            updated_at = NOW()
       FROM job_submissions js
      WHERE offers.submission_id = js.id
        AND offers.status        = 'sent'
        AND offers.expires_at   IS NOT NULL
        AND offers.expires_at    < NOW()
   RETURNING offers.id,
             offers.submission_id,
             offers.expires_at,
             js.email,
             js.first_name`
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
    // Insert a status-history record so admins can see the auto-expiry
    try {
      await dbQuery(
        `INSERT INTO job_application_status_history
           (application_id, previous_status, new_status, note, changed_by)
         VALUES ($1, 'offer_extended', 'offer_expired', 'Offer expired automatically', 'system')`,
        [row.submission_id]
      );
    } catch (histErr: any) {
      // Non-fatal — don't let a history write block the email
      console.warn(
        `offerExpiryService: could not write status history for submission ${row.submission_id}:`,
        histErr.message
      );
    }

    // Send expiry email
    if (!emailEnabled) {
      console.warn('offerExpiryService: email service not configured; skipping expiry email');
      continue;
    }
    if (!row.email) {
      console.warn(`offerExpiryService: no email address for offer ${row.id}; skipping`);
      continue;
    }
    if (!baseUrl) {
      console.warn('offerExpiryService: no base URL configured; skipping expiry email');
      continue;
    }

    const portalUrl = `${baseUrl}/my-applications`;
    const firstName = row.first_name ? ` ${row.first_name}` : '';
    const subject = `Your offer has expired — OnSpot Careers`;

    try {
      const emailResult = await sendApplicantEmail({
        to: row.email,
        subject,
        bodyHtml: buildExpiryEmailHtml(portalUrl),
      });

      if (emailResult.success) {
        console.log(`✅ offerExpiryService: expiry email sent to ${row.email} for offer ${row.id}`);
      } else {
        console.warn(
          `offerExpiryService: expiry email failed for ${row.email} (offer ${row.id}):`,
          emailResult.error
        );
      }
    } catch (emailErr: any) {
      console.error(
        `offerExpiryService: unexpected error sending expiry email for offer ${row.id}:`,
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
        await processExpiredOffers();
      } catch (err: any) {
        console.error('offerExpiryService: cron run failed:', err);
      }
    });

    console.log('✅ offerExpiryService: cron job started — runs at the top of every hour');

    // Run once immediately on startup to catch any backlog
    processExpiredOffers().catch(err => {
      console.error('offerExpiryService: initial expiry check failed:', err);
    });
  }
}

export const offerExpiryService = new OfferExpiryService();
