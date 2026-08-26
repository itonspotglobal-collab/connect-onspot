/**
 * Interview transactional email service.
 *
 * Three functions:
 *   sendInterviewConfirmedEmail          — admin directly confirms a slot (POST or PATCH admin route)
 *   sendInterviewConfirmedEmailToClient  — talent accepts a proposed slot; notifies the client
 *   sendInterviewProposalEmail           — client or admin proposes times, talent needs to pick
 *
 * All are fire-and-forget: callers `.catch()` the returned promise and log the
 * error rather than rolling back the scheduling action (consistent with the
 * status-email-retry invariant documented in .agents/memory/status-email-retry.md).
 */

import { query } from "../db.js";
import { sendApplicantEmail, isEmailServiceConfigured } from "./microsoftGraphEmailService.js";
import {
  buildEmailContext,
  renderApplicantEmail,
  renderBrandedEmailLayout,
} from "./emailVariableResolver.js";
import type { InterviewTimeSlot } from "../lib/interviewTime.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Parse a UTC fixed-offset string produced by `normalizeInterviewTimeZone`
 * (e.g. "UTC+05:30", "UTC-04:00") into total offset minutes, or return null
 * when the string is not a fixed-offset identifier.
 *
 * `Intl.DateTimeFormat` does not accept these identifiers, so callers must
 * apply the offset manually before formatting in "UTC".
 */
function parseUtcOffsetMinutes(tz: string): number | null {
  // Matches: UTC+HH:MM | UTC-HH:MM | GMT+HH:MM | GMT-HH:MM | +HH:MM | -HH:MM
  const m = tz.match(/^(?:UTC|GMT)?([+-])(\d{1,2}):(\d{2})$/i);
  if (!m) return null;
  const sign = m[1] === "+" ? 1 : -1;
  const hours = parseInt(m[2], 10);
  const mins = parseInt(m[3], 10);
  return sign * (hours * 60 + mins);
}

const DATE_FORMAT_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const DATE_FORMAT_OPTS_SHORT: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/**
 * Format an ISO timestamp for display in the given timezone.
 *
 * Handles three cases:
 *   1. IANA names ("America/New_York") — pass directly to Intl.
 *   2. Fixed UTC offsets ("UTC+05:30", "UTC-04:00") — shift the timestamp
 *      by the offset then format in "UTC" so the displayed local time matches.
 *   3. Unrecognised strings — fall back to UTC.
 *
 * Example output: "Wednesday, 3 September 2025 at 10:30 AM (America/New_York)"
 */
export function formatInterviewTime(
  isoTimestamp: string,
  timeZone: string,
  short = false,
): string {
  const tz = timeZone || "UTC";
  const date = new Date(isoTimestamp);
  const opts = short ? DATE_FORMAT_OPTS_SHORT : DATE_FORMAT_OPTS;

  // Case 1: fixed UTC offset
  const offsetMins = parseUtcOffsetMinutes(tz);
  if (offsetMins !== null) {
    const shifted = new Date(date.getTime() + offsetMins * 60_000);
    const formatted = new Intl.DateTimeFormat("en-GB", opts).format(shifted);
    // Normalise label: always "UTC+HH:MM" form
    const sign = offsetMins >= 0 ? "+" : "-";
    const absHours = String(Math.floor(Math.abs(offsetMins) / 60)).padStart(2, "0");
    const absMins = String(Math.abs(offsetMins) % 60).padStart(2, "0");
    return `${formatted} (UTC${sign}${absHours}:${absMins})`;
  }

  // Case 2: IANA or "UTC" — validate then format
  let ianaZone = tz;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: ianaZone });
  } catch {
    ianaZone = "UTC";
  }
  const formatted = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: ianaZone }).format(date);
  return `${formatted} (${ianaZone})`;
}

/** Thin wrapper kept for confirmed-time emails (long date format). */
function formatConfirmedTime(isoTimestamp: string, timeZone: string): string {
  return formatInterviewTime(isoTimestamp, timeZone, false);
}

/** Lookup talent email + display name from the users table. */
async function resolveTalentRecipient(
  talentUserId: string,
): Promise<{ email: string; firstName: string | null; lastName: string | null } | null> {
  const result = await query(
    `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [talentUserId],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { email: row.email, firstName: row.first_name ?? null, lastName: row.last_name ?? null };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface InterviewConfirmedEmailOptions {
  talentUserId: string;
  jobTitle: string;
  confirmedTime: string;        // ISO timestamp
  confirmedTimeZone: string;    // IANA timezone, e.g. "America/New_York"
  durationMinutes: number | null;
  meetingLink: string | null;
  interviewType?: string;
  roundNumber?: number | null;
}

/**
 * Send a "your interview is confirmed" email to the talent.
 * Called fire-and-forget from admin confirm paths.
 */
export async function sendInterviewConfirmedEmail(
  opts: InterviewConfirmedEmailOptions,
): Promise<void> {
  if (!isEmailServiceConfigured()) {
    console.warn(
      `[interviewEmailService] sendInterviewConfirmedEmail: email service not configured (Microsoft 365 credentials missing) — skipping for talent ${opts.talentUserId}`,
    );
    return;
  }

  const recipient = await resolveTalentRecipient(opts.talentUserId);
  if (!recipient) {
    console.warn(
      `[interviewEmailService] sendInterviewConfirmedEmail: no user row for talent ${opts.talentUserId} — skipping`,
    );
    return;
  }

  const firstName = recipient.firstName ?? "there";
  const fullName = [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || undefined;
  const safeJobTitle = escapeHtml(opts.jobTitle);
  const formattedTime = formatConfirmedTime(opts.confirmedTime, opts.confirmedTimeZone);
  const safeTime = escapeHtml(formattedTime);
  const duration = opts.durationMinutes ? `${opts.durationMinutes} minutes` : "approx. 60 minutes";
  const typeLabel = opts.interviewType
    ? opts.interviewType.charAt(0).toUpperCase() + opts.interviewType.slice(1)
    : "Interview";
  const round = opts.roundNumber ? ` (Round ${opts.roundNumber})` : "";

  const meetingSection = opts.meetingLink
    ? `
  <p style="color:#444;font-size:15px;margin:12px 0;">
    <strong>Meeting link:</strong>
    <a href="${escapeHtml(opts.meetingLink)}" style="color:#6d5ef7;">${escapeHtml(opts.meetingLink)}</a>
  </p>`
    : `
  <p style="color:#6b7280;font-size:13px;margin:12px 0;">
    A meeting link will be shared with you shortly if one has not already been provided.
  </p>`;

  const contentHtml = `
  <h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">
    Your interview is confirmed
  </h1>
  <p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escapeHtml(firstName)},</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    Great news — your <strong>${escapeHtml(typeLabel)} interview${round}</strong> for
    <strong>${safeJobTitle}</strong> has been confirmed.
  </p>
  <table role="presentation" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;width:100%;border-spacing:0;">
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">Date &amp; Time</td>
      <td style="padding:6px 0;color:#25283d;font-size:15px;font-weight:600;">${safeTime}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">Duration</td>
      <td style="padding:6px 0;color:#25283d;font-size:15px;">${escapeHtml(duration)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">Role</td>
      <td style="padding:6px 0;color:#25283d;font-size:15px;">${safeJobTitle}</td>
    </tr>
  </table>
  ${meetingSection}
  <p style="color:#444;font-size:15px;margin:20px 0 8px;">
    <strong>Add to your calendar:</strong> Copy the date and time above into your preferred
    calendar app so you don&apos;t miss it.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    If you have any questions or need to make changes, please reply to this email or
    contact us through the OnSpot portal.
  </p>
  <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">
    Good luck with your interview — we&apos;re rooting for you!
  </p>
`.trim();

  const subject = `Interview confirmed: ${opts.jobTitle}${round}`;

  const rendered = renderApplicantEmail(
    { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
    buildEmailContext({
      applicantName: fullName,
      email: recipient.email,
      jobTitle: opts.jobTitle,
    }),
  );

  const result = await sendApplicantEmail({
    to: recipient.email,
    toName: fullName,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  });

  if (!result.success) {
    console.error(
      `[interviewEmailService] sendInterviewConfirmedEmail failed for talent ${opts.talentUserId}:`,
      result.error,
    );
  } else {
    console.log(
      `[interviewEmailService] Interview confirmation email sent to ${recipient.email} for job "${opts.jobTitle}"`,
    );
  }
}

// ── Client confirmation email (talent accepted a slot) ────────────────────────

export interface InterviewConfirmedEmailToClientOptions {
  clientUserId: string;
  talentUserId: string;   // resolved to name only; never exposed to client
  jobTitle: string;
  confirmedTime: string;        // ISO timestamp
  confirmedTimeZone: string;    // IANA or UTC-offset timezone
  durationMinutes: number | null;
  meetingLink: string | null;
  interviewType?: string;
  roundNumber?: number | null;
}

/**
 * Send a "the talent has confirmed their interview time" email to the client.
 * Called fire-and-forget after talent accepts via PATCH /api/talent/interviews/:id/respond.
 */
export async function sendInterviewConfirmedEmailToClient(
  opts: InterviewConfirmedEmailToClientOptions,
): Promise<void> {
  if (!isEmailServiceConfigured()) {
    console.warn(
      `[interviewEmailService] sendInterviewConfirmedEmailToClient: email service not configured — skipping for client ${opts.clientUserId}`,
    );
    return;
  }

  // Resolve client recipient
  const clientResult = await query(
    `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [opts.clientUserId],
  );
  if (!clientResult.rows.length) {
    console.warn(
      `[interviewEmailService] sendInterviewConfirmedEmailToClient: no user row for client ${opts.clientUserId} — skipping`,
    );
    return;
  }
  const clientRow = clientResult.rows[0];
  const clientEmail: string = clientRow.email;
  const clientFirstName: string = clientRow.first_name ?? "there";
  const clientFullName: string =
    [clientRow.first_name, clientRow.last_name].filter(Boolean).join(" ") || undefined!;

  // Resolve talent display name
  const talentResult = await query(
    `SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [opts.talentUserId],
  );
  const talentRow = talentResult.rows[0];
  const talentName: string = talentRow
    ? [talentRow.first_name, talentRow.last_name].filter(Boolean).join(" ") || "The talent"
    : "The talent";

  const safeJobTitle = escapeHtml(opts.jobTitle);
  const formattedTime = formatConfirmedTime(opts.confirmedTime, opts.confirmedTimeZone);
  const safeTime = escapeHtml(formattedTime);
  const duration = opts.durationMinutes ? `${opts.durationMinutes} minutes` : "approx. 60 minutes";
  const typeLabel = opts.interviewType
    ? opts.interviewType.charAt(0).toUpperCase() + opts.interviewType.slice(1)
    : "Interview";
  const round = opts.roundNumber ? ` (Round ${opts.roundNumber})` : "";

  const meetingSection = opts.meetingLink
    ? `
  <p style="color:#444;font-size:15px;margin:12px 0;">
    <strong>Meeting link:</strong>
    <a href="${escapeHtml(opts.meetingLink)}" style="color:#6d5ef7;">${escapeHtml(opts.meetingLink)}</a>
  </p>`
    : `
  <p style="color:#6b7280;font-size:13px;margin:12px 0;">
    No meeting link has been attached yet — add one through the OnSpot portal if needed.
  </p>`;

  const contentHtml = `
  <h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">
    Interview time confirmed
  </h1>
  <p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escapeHtml(clientFirstName)},</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    <strong>${escapeHtml(talentName)}</strong> has confirmed their
    <strong>${escapeHtml(typeLabel)} interview${round}</strong> for
    <strong>${safeJobTitle}</strong>.
  </p>
  <table role="presentation" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;width:100%;border-spacing:0;">
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">Date &amp; Time</td>
      <td style="padding:6px 0;color:#25283d;font-size:15px;font-weight:600;">${safeTime}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">Duration</td>
      <td style="padding:6px 0;color:#25283d;font-size:15px;">${escapeHtml(duration)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">Role</td>
      <td style="padding:6px 0;color:#25283d;font-size:15px;">${safeJobTitle}</td>
    </tr>
  </table>
  ${meetingSection}
  <p style="color:#444;font-size:15px;margin:20px 0 8px;">
    You can view full interview details in the <strong>OnSpot portal</strong>.
  </p>
  <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">
    If you need to make any changes, please do so through the portal as soon as possible.
  </p>
`.trim();

  const subject = `Interview confirmed: ${opts.jobTitle}${round}`;

  const rendered = renderApplicantEmail(
    { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
    buildEmailContext({
      applicantName: clientFullName,
      email: clientEmail,
      jobTitle: opts.jobTitle,
    }),
  );

  const result = await sendApplicantEmail({
    to: clientEmail,
    toName: clientFullName,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  });

  if (!result.success) {
    console.error(
      `[interviewEmailService] sendInterviewConfirmedEmailToClient failed for client ${opts.clientUserId}:`,
      result.error,
    );
  } else {
    console.log(
      `[interviewEmailService] Interview confirmation email sent to client ${clientEmail} for job "${opts.jobTitle}"`,
    );
  }
}

// ── Client counter-proposal notification email ────────────────────────────────

export interface InterviewCounterEmailToClientOptions {
  clientUserId: string;
  talentUserId: string;   // resolved to display name only
  jobTitle: string;
  proposedTimes: InterviewTimeSlot[];
  durationMinutes: number | null;
  interviewType?: string;
  roundNumber?: number | null;
}

/**
 * Send a "talent has proposed alternative interview times — please respond"
 * email to the client.
 * Called fire-and-forget from the counter branch of
 * PATCH /api/talent/interviews/:id/respond.
 */
export async function sendInterviewCounterEmailToClient(
  opts: InterviewCounterEmailToClientOptions,
): Promise<void> {
  if (!isEmailServiceConfigured()) {
    console.warn(
      `[interviewEmailService] sendInterviewCounterEmailToClient: email service not configured — skipping for client ${opts.clientUserId}`,
    );
    return;
  }

  // Resolve client recipient
  const clientResult = await query(
    `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [opts.clientUserId],
  );
  if (!clientResult.rows.length) {
    console.warn(
      `[interviewEmailService] sendInterviewCounterEmailToClient: no user row for client ${opts.clientUserId} — skipping`,
    );
    return;
  }
  const clientRow = clientResult.rows[0];
  const clientEmail: string = clientRow.email;
  const clientFirstName: string = clientRow.first_name ?? "there";
  const clientFullName: string =
    [clientRow.first_name, clientRow.last_name].filter(Boolean).join(" ") || undefined!;

  // Resolve talent display name
  const talentResult = await query(
    `SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [opts.talentUserId],
  );
  const talentRow = talentResult.rows[0];
  const talentName: string = talentRow
    ? [talentRow.first_name, talentRow.last_name].filter(Boolean).join(" ") || "The talent"
    : "The talent";

  const safeJobTitle = escapeHtml(opts.jobTitle);
  const typeLabel = opts.interviewType
    ? opts.interviewType.charAt(0).toUpperCase() + opts.interviewType.slice(1)
    : "Interview";
  const round = opts.roundNumber ? ` (Round ${opts.roundNumber})` : "";
  const duration = opts.durationMinutes ? `${opts.durationMinutes} minutes` : null;

  const timeRows = opts.proposedTimes
    .slice(0, 10)
    .map((slot, i) => {
      const label = formatInterviewTime(slot.start, slot.timezone || "UTC", true);
      return `<li style="margin:4px 0;color:#25283d;font-size:15px;">Option ${i + 1}: ${escapeHtml(label)}</li>`;
    })
    .join("\n");

  const durationLine = duration
    ? `<p style="color:#444;font-size:15px;margin:8px 0;"><strong>Duration:</strong> ${escapeHtml(duration)}</p>`
    : "";

  const contentHtml = `
  <h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">
    Talent has proposed alternative interview times
  </h1>
  <p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escapeHtml(clientFirstName)},</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    <strong>${escapeHtml(talentName)}</strong> was unable to make the originally proposed times for their
    <strong>${escapeHtml(typeLabel)} interview${round}</strong> for
    <strong>${safeJobTitle}</strong>, and has suggested the following alternative slots.
    Please log in to the OnSpot portal to confirm or respond.
  </p>
  <p style="color:#25283d;font-size:15px;font-weight:600;margin:20px 0 8px;">Proposed alternative times (UTC)</p>
  <ul style="margin:0;padding-left:20px;">
    ${timeRows}
  </ul>
  ${durationLine}
  <p style="color:#444;font-size:15px;margin:20px 0 8px;">
    Log in to the <strong>OnSpot portal</strong> to accept one of these times or propose alternatives.
  </p>
  <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
    If you have any questions, contact us through the portal.
  </p>
`.trim();

  const subject = `Interview rescheduled: ${opts.jobTitle}${round} — talent proposed new times`;

  const rendered = renderApplicantEmail(
    { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
    buildEmailContext({
      applicantName: clientFullName,
      email: clientEmail,
      jobTitle: opts.jobTitle,
    }),
  );

  const result = await sendApplicantEmail({
    to: clientEmail,
    toName: clientFullName,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  });

  if (!result.success) {
    console.error(
      `[interviewEmailService] sendInterviewCounterEmailToClient failed for client ${opts.clientUserId}:`,
      result.error,
    );
  } else {
    console.log(
      `[interviewEmailService] Interview counter-proposal email sent to client ${clientEmail} for job "${opts.jobTitle}"`,
    );
  }
}

export interface InterviewProposalEmailOptions {
  talentUserId: string;
  jobTitle: string;
  proposedTimes: InterviewTimeSlot[];
  durationMinutes: number | null;
  candidateNotes: string | null;
  interviewType?: string;
  roundNumber?: number | null;
  proposerRole?: "admin" | "client";
}

/**
 * Send a "you have a new interview proposal — please pick a time" email to the talent.
 * Called fire-and-forget from the client (and admin non-direct-confirm) propose paths.
 */
export async function sendInterviewProposalEmail(
  opts: InterviewProposalEmailOptions,
): Promise<void> {
  if (!isEmailServiceConfigured()) {
    console.warn(
      `[interviewEmailService] sendInterviewProposalEmail: email service not configured (Microsoft 365 credentials missing) — skipping for talent ${opts.talentUserId}`,
    );
    return;
  }

  const recipient = await resolveTalentRecipient(opts.talentUserId);
  if (!recipient) {
    console.warn(
      `[interviewEmailService] sendInterviewProposalEmail: no user row for talent ${opts.talentUserId} — skipping`,
    );
    return;
  }

  const firstName = recipient.firstName ?? "there";
  const fullName = [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || undefined;
  const safeJobTitle = escapeHtml(opts.jobTitle);
  const typeLabel = opts.interviewType
    ? opts.interviewType.charAt(0).toUpperCase() + opts.interviewType.slice(1)
    : "Interview";
  const round = opts.roundNumber ? ` (Round ${opts.roundNumber})` : "";
  const duration = opts.durationMinutes ? `${opts.durationMinutes} minutes` : null;

  // Format proposed times in a readable list, using each slot's stored timezone when available
  const timeRows = opts.proposedTimes
    .slice(0, 10)
    .map((slot, i) => {
      const label = formatInterviewTime(slot.start, slot.timezone || "UTC", true);
      return `<li style="margin:4px 0;color:#25283d;font-size:15px;">Option ${i + 1}: ${escapeHtml(label)}</li>`;
    })
    .join("\n");

  const durationLine = duration
    ? `<p style="color:#444;font-size:15px;margin:8px 0;"><strong>Duration:</strong> ${escapeHtml(duration)}</p>`
    : "";

  const notesSection =
    opts.candidateNotes?.trim()
      ? `<p style="color:#444;font-size:15px;margin:12px 0;"><strong>Notes from the interviewer:</strong><br>${escapeHtml(opts.candidateNotes.trim())}</p>`
      : "";

  const contentHtml = `
  <h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">
    You have a new interview proposal
  </h1>
  <p style="color:#444;font-size:15px;margin:12px 0;">Hi ${escapeHtml(firstName)},</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A <strong>${escapeHtml(typeLabel)} interview${round}</strong> has been proposed for
    <strong>${safeJobTitle}</strong>. Please review the available time slots and confirm
    your preferred option through the OnSpot portal.
  </p>
  <p style="color:#25283d;font-size:15px;font-weight:600;margin:20px 0 8px;">Proposed time slots (UTC)</p>
  <ul style="margin:0;padding-left:20px;">
    ${timeRows}
  </ul>
  ${durationLine}
  ${notesSection}
  <p style="color:#444;font-size:15px;margin:20px 0 8px;">
    Log in to the OnSpot Talent Portal to confirm your preferred time.
  </p>
  <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
    If you weren&apos;t expecting this, contact us through the portal.
  </p>
`.trim();

  const subject = `Interview proposed: ${opts.jobTitle}${round} — please confirm a time`;

  const rendered = renderApplicantEmail(
    { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
    buildEmailContext({
      applicantName: fullName,
      email: recipient.email,
      jobTitle: opts.jobTitle,
    }),
  );

  const result = await sendApplicantEmail({
    to: recipient.email,
    toName: fullName,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  });

  if (!result.success) {
    console.error(
      `[interviewEmailService] sendInterviewProposalEmail failed for talent ${opts.talentUserId}:`,
      result.error,
    );
  } else {
    console.log(
      `[interviewEmailService] Interview proposal email sent to ${recipient.email} for job "${opts.jobTitle}"`,
    );
  }
}
