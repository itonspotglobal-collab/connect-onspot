/**
 * Shared FindWork calendar operations. App-only Graph authentication is reused;
 * no delegated Admin account, browser token, or personal organizer is involved.
 */
import { createHash } from "node:crypto";
import { getMicrosoftGraphAccessToken } from "./microsoftGraphEmailService";
import { FORMAL_PIPELINE_PREDICATE } from "./formalPipelineGuard";

export class FindWorkCalendarError extends Error {
  constructor(public code: string, message: string, public status = 502) {
    super(message);
  }
}

export function findWorkMailbox(env: NodeJS.ProcessEnv = process.env): string {
  // The Talent verification sender is already the configured FindWork identity.
  // Do not silently substitute the generic Careers sender or an Admin's mailbox.
  const mailbox = (env.MICROSOFT_FINDWORK_MAILBOX || env.TALENT_VERIFICATION_EMAIL_FROM || "").trim();
  if (!mailbox || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mailbox)) {
    throw new FindWorkCalendarError("graph_configuration_missing",
      "Configure the shared FindWork mailbox and Microsoft Graph application credentials.", 503);
  }
  if (!env.MICROSOFT_TENANT_ID || !env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new FindWorkCalendarError("graph_configuration_missing",
      "Microsoft Graph application credentials are not configured.", 503);
  }
  return mailbox;
}

export function findWorkCalendarConfigured(): boolean {
  try { findWorkMailbox(); return true; } catch { return false; }
}

export async function graphCalendarRequest(
  path: string, init: RequestInit = {}, transport: typeof fetch = fetch,
): Promise<any> {
  let token: string;
  try { token = await getMicrosoftGraphAccessToken(); }
  catch {
    throw new FindWorkCalendarError("graph_authentication_failed",
      "Microsoft Graph application authentication failed. Check the tenant application configuration.", 503);
  }
  let response: globalThis.Response;
  try {
    response = await transport(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new FindWorkCalendarError("calendar_event_failure",
      "The Outlook calendar could not be reached. Retry the request; the interview was not confirmed.");
  }
  if (!response.ok) {
    // Never log/return raw provider errors: they can contain addresses and IDs.
    const code = response.status === 401 || response.status === 403 ? "mailbox_inaccessible"
      : response.status === 404 ? "calendar_unavailable" : "calendar_event_failure";
    throw new FindWorkCalendarError(code,
      code === "mailbox_inaccessible"
        ? "The Graph application cannot access the shared FindWork mailbox. Check Exchange calendar permissions and mailbox scope."
        : code === "calendar_unavailable" ? "The shared FindWork calendar or existing event is unavailable."
          : "Outlook did not complete the calendar operation. The interview change was not saved.");
  }
  return response.status === 204 ? null : response.json();
}

type CalendarDb = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };

/**
 * Called inside the interview mutation transaction, before COMMIT/notifications.
 * Callers hold the interview/submission lock. Native proposal turns, authorization,
 * conflict checks, and state changes are not replaced by calendar logic.
 *
 * A stable Graph transactionId survives a rolled-back first INSERT, unlike a
 * randomly generated interview UUID. Subsequent updates PATCH the stored event.
 */
export async function synchronizeFindWorkInterview(
  tx: CalendarDb, interviewId: string, forceAdminCalendar = false,
  transport: typeof fetch = fetch,
): Promise<any> {
  const result = await tx.query(
     `SELECT i.*, j.title AS job_title, js.applicant_name, js.first_name, js.last_name,
             js.status AS submission_status,
            talent.email AS talent_email, creator.email AS admin_email, creator.role AS creator_role
       FROM interviews i
       JOIN job_submissions js ON js.id = i.submission_id
       JOIN jobs j ON j.id = js.job_id
       JOIN users talent ON talent.id = js.talent_id AND talent.role = 'talent'
       JOIN users creator ON creator.id = i.created_by
       WHERE i.id = $1 AND js.${FORMAL_PIPELINE_PREDICATE} FOR UPDATE OF i, js`,
    [interviewId],
  );
  const interview = result.rows[0];
  if (!interview) throw new FindWorkCalendarError("calendar_applicant_missing",
    "The interview must be linked to an authenticated Talent account.", 409);
  const managed = forceAdminCalendar || interview.calendar_managed ||
    interview.creator_role === "admin" || Boolean(interview.calendar_event_id);
  if (interview.status === "completed") return interview; // Keep completed calendar history.
   if (["proposed", "rescheduled", "confirmed"].includes(interview.status) &&
       !["new", "under_review", "reviewed", "shortlisted", "interviewing"].includes(interview.submission_status)) {
     throw new FindWorkCalendarError("submission_not_interviewable", "This application has already moved beyond interviewing.", 409);
   }
   if (!managed) return interview; // Preserve Client-led proposals, not terminal-stage mutations.
  if (interview.status !== "confirmed" && !interview.calendar_event_id) return interview;

  const mailbox = findWorkMailbox();
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext('findwork:shared_calendar'))`);
  const base = `/users/${encodeURIComponent(mailbox)}`;
   let existingId = interview.calendar_event_id;
  if (interview.status !== "confirmed") {
    // A proposal/reschedule is not a confirmed appointment. Cancel the old event
    // (rather than leaving a stale invitation) before saving the new proposal.
     const accessible = await graphCalendarRequest(`${base}/calendar?$select=id`, {}, transport);
     if (!accessible?.id) throw new FindWorkCalendarError("calendar_unavailable", "The shared FindWork calendar is unavailable.");
     try {
      await graphCalendarRequest(`${base}/events/${encodeURIComponent(existingId)}`,
        { method: "DELETE" }, transport);
    } catch (err) {
      // Idempotent DELETE: a previously removed event is already cancelled.
      if (!(err instanceof FindWorkCalendarError) || err.code !== "calendar_unavailable") throw err;
    }
    const cancelled = await tx.query(
      `UPDATE interviews SET calendar_event_id = NULL, calendar_managed = TRUE WHERE id = $1 RETURNING *`,
      [interviewId],
    );
    return cancelled.rows[0];
  }

   const start = new Date(interview.confirmed_time);
  const duration = Number(interview.duration_minutes ?? 60);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now() ||
      !Number.isInteger(duration) || duration < 15 || duration > 240) {
    throw new FindWorkCalendarError("invalid_calendar_time", "Choose a valid future interview time and duration.", 400);
  }
  const calendar = await graphCalendarRequest(`${base}/calendar?$select=id,allowedOnlineMeetingProviders`, {}, transport);
  if (!calendar?.id) throw new FindWorkCalendarError("calendar_unavailable", "The shared FindWork calendar is unavailable.");
  const end = new Date(start.getTime() + duration * 60_000);
   const history = await tx.query(`SELECT COUNT(*)::integer AS count FROM interview_proposals WHERE interview_id = $1`, [interviewId]);
   const transactionId = createHash("sha256").update(
     `onspot:${interview.submission_id}:${interview.round_number}:${start.toISOString()}:${history.rows[0].count}`,
   ).digest("hex");
  const occupied = await graphCalendarRequest(
     `${base}/calendarView?startDateTime=${encodeURIComponent(start.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}&$select=id,showAs,isCancelled,transactionId&$top=100`,
    {}, transport,
  );
  if (!Array.isArray(occupied?.value) || occupied["@odata.nextLink"]) {
    throw new FindWorkCalendarError("calendar_unavailable", "Outlook availability could not be verified.");
  }
   // Recover an event created by a previous request whose response/DB commit
   // failed. It must not be mistaken for somebody else's busy appointment.
   if (!existingId) {
     const recovered = occupied.value.find((event: any) => !event.isCancelled && event.transactionId === transactionId);
     if (recovered?.id) existingId = recovered.id;
   }
  if (occupied.value.some((event: any) => event.id !== existingId && !event.isCancelled && event.showAs !== "free")) {
    throw new FindWorkCalendarError("calendar_time_conflict", "The shared FindWork calendar is busy at that time. Choose another slot.", 409);
  }
  const name = interview.applicant_name || [interview.first_name, interview.last_name].filter(Boolean).join(" ") || "Talent";
  const attendees = new Map<string, string>();
  attendees.set(String(interview.talent_email).toLowerCase(), name);
  if (interview.creator_role === "admin" && interview.admin_email) {
    attendees.set(String(interview.admin_email).toLowerCase(), "OnSpot interviewer");
  }
  if (interview.calendar_interviewer_id) {
    const records = await tx.query(`SELECT name, calendar_email FROM admin_interviewers WHERE id = $1`,
      [interview.calendar_interviewer_id]);
    let interviewer = records.rows[0];
    if (!interviewer && process.env.ONSPOT_INTERVIEWERS_JSON) {
      try {
        const configured = JSON.parse(process.env.ONSPOT_INTERVIEWERS_JSON);
        const entry = Array.isArray(configured) ? configured.find((item: any) => item.id === interview.calendar_interviewer_id) : null;
        if (entry) interviewer = { name: entry.name, calendar_email: entry.calendarEmail };
      } catch { /* Configuration validation is performed by the interviewer service. */ }
    }
    if (interviewer?.calendar_email) attendees.set(interviewer.calendar_email.toLowerCase(), interviewer.name);
  }
  attendees.delete(mailbox.toLowerCase()); // The shared mailbox is the organizer.
  const body: any = {
    subject: `${interview.job_title} — ${interview.interview_type} interview with ${name}`,
    body: { contentType: "text", content: [
      `OnSpot interview for ${interview.job_title}`,
      `Applicant: ${name}`,
      `Duration: ${duration} minutes`,
      `Display timezone: ${interview.confirmed_time_zone || "UTC"}`,
      interview.candidate_notes || "",
      interview.meeting_link ? `Join: ${interview.meeting_link}` : "",
    ].filter(Boolean).join("\n") },
    start: { dateTime: start.toISOString().replace("Z", ""), timeZone: "UTC" },
    end: { dateTime: new Date(start.getTime() + duration * 60_000).toISOString().replace("Z", ""), timeZone: "UTC" },
    attendees: Array.from(attendees).map(([address, attendeeName]) => ({
      emailAddress: { address, name: attendeeName }, type: "required",
    })),
  };
  if (!existingId) {
     body.transactionId = transactionId;
    if (!interview.meeting_link && calendar.allowedOnlineMeetingProviders?.includes("teamsForBusiness")) {
      body.isOnlineMeeting = true;
      body.onlineMeetingProvider = "teamsForBusiness";
    }
  }
  const event = await graphCalendarRequest(
    existingId ? `${base}/events/${encodeURIComponent(existingId)}` : `${base}/events`,
    { method: existingId ? "PATCH" : "POST", body: JSON.stringify(body) }, transport,
  );
   if (typeof event?.id !== "string" || !event.id.trim()) throw new FindWorkCalendarError("calendar_event_failure",
    "Outlook did not return an event reference. The interview was not confirmed.");
  const saved = await tx.query(
    `UPDATE interviews SET calendar_event_id = $2, calendar_managed = TRUE,
             meeting_link = COALESCE(meeting_link, $3) WHERE id = $1 RETURNING *`,
    [interviewId, event.id, event.onlineMeeting?.joinUrl || null],
  );
  return saved.rows[0];
}
