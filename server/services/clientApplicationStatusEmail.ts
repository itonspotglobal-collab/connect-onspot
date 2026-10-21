// tsx otherwise resolves the legacy db.js sibling in development, whereas the
// production bundle resolves db.ts. The new ledger export lives in TypeScript.
import { applicantEmailLedgerQuery as query } from "../db.ts";
import { CLIENT_STATUS_TEMPLATE_STAGES } from "../../shared/submissionStatuses";
import { buildEmailContext, renderApplicantEmail } from "./emailVariableResolver";
import { ALLOWED_SENDERS, sendApplicantEmail } from "./microsoftGraphEmailService";

function blocked(message: string, status = 409): never {
  throw Object.assign(new Error(message), { status, clientSafe: true });
}

/**
 * Durable delivery preparation for the existing status-with-email handler.
 * The caller holds the application row (NO KEY UPDATE) and its existing
 * status-email advisory lock. Independent ledger writes survive rollback of
 * the status/history transaction. Never expose this ledger to Client responses.
 */
export async function deliverClientApplicationStatusEmail(options: {
  dbClient: { query: (sql: string, params?: any[]) => Promise<any> };
  application: any;
  actorId: string;
  operationId: string;
  target: string;
  expectedStatus: string;
  expectedVersion: string;
}) {
  const { dbClient, application: app, actorId, operationId, target, expectedStatus, expectedVersion } = options;
  let ledger = (await query("SELECT * FROM job_application_emails WHERE id = $1", [operationId])).rows[0];
  if (ledger && (ledger.application_id !== app.id || ledger.sent_by !== actorId ||
      ledger.status_update !== target || ledger.status_previous !== expectedStatus ||
      ledger.status_source_version !== expectedVersion)) {
    blocked("This update identifier belongs to a different transition. Refresh the application.");
  }
  if (ledger?.status_completed_at) return { ledger, alreadyCompleted: true };
  if (app.status !== expectedStatus || app.status_version !== expectedVersion) {
    blocked("The application has changed. Refresh it before changing its status.");
  }
  // A reload/new request ID must also find a previously delivered transition.
  const pending = (await query(
    `SELECT * FROM job_application_emails
     WHERE application_id = $1 AND status_source_version IS NOT NULL
       AND status_completed_at IS NULL AND status IN ('sending','sent','delivery_unknown')
     ORDER BY created_at LIMIT 1`, [app.id],
  )).rows[0];
  if (pending) {
    if (pending.status_update !== target || pending.status_previous !== expectedStatus ||
        pending.status_source_version !== expectedVersion || pending.sent_by !== actorId) {
      blocked("An earlier status email needs recovery. Retry its original status or ask an administrator to review email history.");
    }
    ledger = pending;
  }
  if (ledger?.status === "sent") return { ledger, alreadyCompleted: false };
  if (ledger && ["sending", "delivery_unknown"].includes(ledger.status)) {
    blocked("Email delivery could not be confirmed. An administrator must check the email history before any resend.");
  }

  const stage = CLIENT_STATUS_TEMPLATE_STAGES[target];
  const templates = await dbClient.query(
    `SELECT id, subject, body_html FROM applicant_email_templates
     WHERE stage = $1 AND is_published = true AND is_archived = false AND is_default = true`,
    [stage],
  );
  if (templates.rows.length !== 1) {
    blocked(`Automatic ${target.replaceAll("_", " ")} email is unavailable. Ask an administrator to publish exactly one default template for stage "${stage}".`, 422);
  }
  const template = templates.rows[0];
  if (!template.subject?.trim() || !template.body_html?.trim()) {
    blocked("The status email template is empty. Ask an administrator to repair it.", 422);
  }
  const rendered = renderApplicantEmail({
    subject: template.subject, bodyHtml: template.body_html,
  }, buildEmailContext({
    firstName: app.first_name, lastName: app.last_name, applicantName: app.applicant_name,
    email: app.email, phone: app.phone, jobTitle: app.job_title, jobCompany: app.job_company,
    jobLocation: app.job_location, status: target, previousStatus: app.status, newStatus: target,
    applicationId: app.id, jobPostingId: app.job_id, submittedAt: app.submitted_at,
  }));
  if (rendered.unresolvedKeys.length || !rendered.subject.trim() || !rendered.bodyHtml.trim()) {
    blocked("The status email template contains unresolved variables or empty content. Ask an administrator to repair it.", 422);
  }
  // Preserve the existing status-email workflow's sender, never accept a Client
  // supplied recipient, sender, template or HTML.
  const senderEmail = "careers@onspotglobal.com";
  const start = JSON.stringify([{ at: new Date().toISOString(), state: "sending" }]);
  if (ledger) {
    ledger = (await query(
      `UPDATE job_application_emails SET status='sending', template_id=$2, subject=$3,
         body_html=$4, error_message=NULL, delivery_attempts=delivery_attempts || $5::jsonb
       WHERE id=$1 AND status='failed' RETURNING *`,
      [ledger.id, template.id, rendered.subject, rendered.bodyHtml, start],
    )).rows[0];
    if (!ledger) blocked("This email attempt can no longer be retried.");
  } else {
    ledger = (await query(
      `INSERT INTO job_application_emails
       (id,application_id,template_id,subject,body_html,sent_to,sent_by,sender_email,sender_name,
        status,is_test,status_update,status_previous,status_note,status_source_version,delivery_attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sending',false,$10,$11,
         'Status updated by Client with automatic applicant email',$12,$13::jsonb) RETURNING *`,
      [operationId, app.id, template.id, rendered.subject, rendered.bodyHtml, app.email, actorId,
        senderEmail, ALLOWED_SENDERS[senderEmail], target, app.status, expectedVersion, start],
    )).rows[0];
  }
  const result = await sendApplicantEmail({
    to: ledger.sent_to, subject: ledger.subject, bodyHtml: ledger.body_html, senderEmail,
  });
  const outcome = result.success ? "sent" : result.deliveryState === "unknown" ? "delivery_unknown" : "failed";
  // If this write fails, the durable 'sending' marker prohibits an unsafe resend.
  ledger = (await query(
    `UPDATE job_application_emails SET status=$2, error_message=$3, sent_at=NOW(),
      delivery_attempts=delivery_attempts || $4::jsonb WHERE id=$1 RETURNING *`,
    [ledger.id, outcome, result.success ? null : result.error || "Email delivery failed",
      JSON.stringify([{ at: new Date().toISOString(), state: outcome,
        ...(!result.success ? { error: result.error || "Email delivery failed" } : {}) }])],
  )).rows[0];
  if (!result.success) {
    blocked(outcome === "delivery_unknown"
      ? "Email delivery could not be confirmed. The status was not changed. Ask an administrator to check email history before retrying."
      : "The status email could not be sent. The application status is unchanged; you can retry this update.", 502);
  }
  return { ledger, alreadyCompleted: false };
}
