export const TALENT_NOTIFICATION_TYPES = [
  "contract_update",
  "offer_received",
  "job_invitation",
  "job_application_status_changed",
  "interview_rescheduled",
  "interview_confirmed",
  "talent_invoice_ready",
  "new_message",
] as const;

export const CLIENT_NOTIFICATION_TYPES = [
  "contract_update",
  "offer_accepted",
  "offer_declined",
  "offer_expired",
  "job_approved",
  "job_pending",
  "job_rejected",
  "job_application_received",
  "talent_invitation_accepted",
  "interview_reschedule_proposed",
  "interview_confirmed",
  "client_application_status_changed",
  "talent_hired",
  "monthly_client_invoice",
  "hiring_invoice",
  "hiring_payment_review",
  "new_message",
] as const;

export function notificationTypesForRole(isTalent: boolean): readonly string[] {
  return isTalent ? TALENT_NOTIFICATION_TYPES : CLIENT_NOTIFICATION_TYPES;
}

export function notificationRouteForRole(
  type: string,
  role: string | null | undefined,
  existingRoute: string | null,
): string | null {
  if (type === "interview_confirmed") {
    return role === "talent" ? "/my-applications" : "/client/interviews";
  }
  if (type === "talent_invoice_ready") return "/talent/invoices";
  if (type === "monthly_client_invoice") return "/client/monthly-invoices";
  if (type === "hiring_invoice" || type === "hiring_payment_review") {
    return role === "admin" ? "/admin/ledger" : role === "client" ? "/client/billing" : null;
  }
  if (role === "admin") {
    if (type === "job_application_received") return "/admin/job-applications";
    if (
      [
        "client_application_status_changed",
        "job_pending",
        "job_approved",
        "job_rejected",
      ].includes(type)
    ) {
      return "/admin/find-work";
    }
  }
  return existingRoute;
}

/**
 * Resolve persisted internal notification URLs without ever accepting an
 * external origin, protocol-relative URL, encoded path separator, or an
 * unapproved route. Route access is narrowed by the current authenticated role.
 */
export function safeInternalNotificationRoute(
  relatedUrl: string | null | undefined,
  role: string | null | undefined,
): string | null {
  if (!relatedUrl || relatedUrl.length > 2048 || !relatedUrl.startsWith("/") || relatedUrl.startsWith("//")) return null;
  if (relatedUrl.includes("\\") || /%(?:2f|5c)/i.test(relatedUrl)) return null;

  let url: URL;
  try {
    url = new URL(relatedUrl, "https://onspot.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://onspot.invalid" || url.hash) return null;

  const paymentMatch = url.pathname.match(/^\/client\/payments\/(deposit|monthly_invoice|invoice|hiring_invoice|replenishment|inquiry)\/([A-Za-z0-9_-]{1,128})$/);
  if (paymentMatch && role === "client" && !url.search) return url.pathname;

  if (url.pathname === "/dashboard" && role === "client" && !url.search) return "/dashboard";
  if (url.pathname === "/admin/ledger" && role === "admin" && !url.search) return "/admin/ledger";
  if (url.pathname === "/my-applications" && role === "talent" && !url.search) return "/my-applications";
  if (url.pathname === "/client/jobs" && role === "client" && !url.search) return "/client/jobs";

  // buildClientApplicationUrl creates /client-profile with only these resource
  // identifiers. Do not permit arbitrary search params or nested routes.
  if (url.pathname === "/client-profile" && role === "client") {
    const allowedKeys = new Set(["jobId", "applicationId", "interviewId"]);
    const keys: string[] = [];
    const values: string[] = [];
    url.searchParams.forEach((value, key) => {
      keys.push(key);
      values.push(value);
    });
    if (keys.some((key) => !allowedKeys.has(key)) || new Set(keys).size !== keys.length) return null;
    if (values.some((value) => !/^[A-Za-z0-9_-]{1,128}$/.test(value))) return null;
    return `${url.pathname}${url.search}`;
  }
  return null;
}

interface ToastNotification {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function recentTalentInterviewProposalToasts(
  notifications: ToastNotification[],
  seenIds: ReadonlySet<string>,
  now = Date.now(),
  maxAgeMs = 5 * 60_000,
): ToastNotification[] {
  return notifications.filter((notification) => {
    if (
      notification.type !== "interview_rescheduled"
      || notification.isRead
      || seenIds.has(notification.id)
    ) {
      return false;
    }
    const createdAt = new Date(notification.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt >= 0 && now - createdAt <= maxAgeMs;
  });
}

export function applicationsFooterRouteForRole(
  role: string | null | undefined,
  isTalent: boolean,
): string {
  if (isTalent) return "/my-applications";
  return role === "admin" ? "/admin/job-applications" : "/client-profile";
}

export type ClientNotificationModalKind =
  | "invitation_acceptance"
  | "interview_reschedule";

interface InterviewScheduleSlot {
  start: string;
  timezone?: string | null;
}

interface InterviewScheduleProposal {
  proposerRole: string;
  proposedTimes: InterviewScheduleSlot[];
}

export function currentInterviewSchedule(interview: {
  proposedTimes: InterviewScheduleSlot[];
  proposals: InterviewScheduleProposal[];
}) {
  const latestProposal = interview.proposals.at(-1) ?? null;
  const previousProposal = interview.proposals.at(-2) ?? null;
  return {
    current: interview.proposedTimes[0] ?? latestProposal?.proposedTimes?.[0] ?? null,
    previous: previousProposal?.proposedTimes?.[0] ?? null,
    prefix: latestProposal?.proposerRole === "talent"
      ? "Talent proposed"
      : latestProposal?.proposerRole === "client"
        ? "Client proposed"
        : "Proposed",
  };
}

export function clientNotificationModalKind(
  type: string,
  role: string | null | undefined,
  relatedType: string | null,
  relatedId: string | null,
): ClientNotificationModalKind | null {
  if (role !== "client" || !relatedId) return null;
  if (type === "talent_invitation_accepted" && relatedType === "job_submission") {
    return "invitation_acceptance";
  }
  if (type === "interview_reschedule_proposed" && relatedType === "interview") {
    return "interview_reschedule";
  }
  return null;
}