import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

export interface HiringInvoice {
  id: string;
  invoice_type: string;
  attempt_id: string;
  submission_id: string;
  job_id: string;
  invoice_number: string;
  fee_description: string;
  amount: string;
  currency: "USD";
  fee_basis: string;
  tax_treatment: "inclusive" | "exempt";
  tax_description: string;
  status: string;
  issued_at: string | null;
  due_date: string | null;
  payment_method: "manual_transfer";
  payment_recipient: string;
  payment_instructions: string;
  payment_reference: string | null;
  verified_at: string | null;
  verified_by?: string | null;
  verified_amount?: string | null;
  verified_currency?: string | null;
  verified_reference?: string | null;
  verified_recipient?: string | null;
  created_at: string;
  updated_at: string;
  job_title?: string;
  talent_name?: string;
  ready_at?: string;
  is_overdue?: boolean;
  client_name?: string;
  client_email?: string;
  client_id?: string;
  talent_id?: string;
}

export interface HiringInvoiceHistory {
  id: string;
  event: string;
  previous_status: string | null;
  new_status: string | null;
  actor_id?: string | null;
  details?: { reason?: string; [key: string]: unknown };
  created_at: string;
}

export const statusLabel: Record<string, string> = {
  issued: "Issued",
  verification_pending: "Verification pending",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  payment_failed: "Payment failed",
  refunded: "Refunded",
  invalidated: "Invalidated",
  draft: "Draft",
};

export const formatPaymentDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

export const formatPaymentAmount = (value: string, currency = "USD") =>
  `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function hiringPaymentRequest(method: string, url: string, body?: unknown) {
  const response = await apiRequest(method, url, body);
  return response.json();
}

export interface HiringPaymentErrorInfo {
  kind:
    | "job-billing"
    | "billing-policy"
    | "authorization"
    | "not-found"
    | "ineligible"
    | "identity-conflict"
    | "server"
    | "network"
    | "request";
  heading: string;
  message: string;
  missingFields: string[];
  editPath: string | null;
}

const missingFieldLabels: Record<string, string> = {
  engagementType: "Engagement type",
  billingMode: "Billing mode",
};

function safeJobEditPath(value: unknown): string | null {
  if (typeof value !== "string" || !/^\/client\/jobs\/[A-Za-z0-9_-]+\/edit$/.test(value)) {
    return null;
  }
  return value;
}

/** Convert structured API/network failures to user-safe copy; never expose raw payloads. */
export function getHiringPaymentErrorInfo(cause: unknown): HiringPaymentErrorInfo {
  const error = cause && typeof cause === "object"
    ? cause as { status?: unknown; code?: unknown; data?: unknown }
    : {};
  const status = typeof error.status === "number" ? error.status : undefined;
  const code = typeof error.code === "string" ? error.code : undefined;
  const data = error.data && typeof error.data === "object"
    ? error.data as { details?: unknown }
    : {};
  const details = data.details && typeof data.details === "object"
    ? data.details as { missingFields?: unknown; editPath?: unknown }
    : {};
  const missingFields = Array.isArray(details.missingFields)
    ? details.missingFields
        .filter((field): field is string => typeof field === "string" && field in missingFieldLabels)
        .map((field) => missingFieldLabels[field])
    : [];
  const editPath = safeJobEditPath(details.editPath);
  const base = { missingFields, editPath };

  if (code === "JOB_BILLING_CLASSIFICATION_REQUIRED") {
    return {
      ...base,
      kind: "job-billing",
      heading: "Job billing setup required",
      message: "This job needs an engagement type and billing mode before a hiring invoice can be prepared. Please complete the job's billing settings and try again.",
    };
  }
  if (code === "HIRING_BILLING_POLICY_REQUIRED") {
    return {
      ...base,
      kind: "billing-policy",
      heading: "Hiring fee policy unavailable",
      message: "A hiring fee policy has not been configured. Contact an OnSpot administrator; no fee has been assumed.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      ...base,
      kind: "authorization",
      heading: "Authorization required",
      message: status === 401
        ? "Your session may have expired. Sign in again, then retry this action."
        : "You do not have permission to prepare this hiring invoice. Contact an OnSpot administrator if you need access.",
    };
  }
  if (status === 404) {
    return {
      ...base,
      kind: "not-found",
      heading: "Application or job unavailable",
      message: "The application or job could not be found. Refresh the page and try again.",
    };
  }
  if (code === "APPLICATION_NOT_OFFER_ELIGIBLE") {
    return {
      ...base,
      kind: "ineligible",
      heading: "Application is not ready for an offer",
      message: "This application is not at an eligible stage for offer preparation. Review its current status before trying again.",
    };
  }
  if (code && (
    [
      "HIRING_INVOICE_CONFLICT",
      "HIRING_INVOICE_IDENTITY_CONFLICT",
      "HIRING_INVOICE_ATTEMPT_CONFLICT",
      "HIRING_ATTEMPT_IDENTITY_CONFLICT",
      "INVOICE_ATTEMPT_IDENTITY_CONFLICT",
    ].includes(code)
    || /(?:INVOICE|ATTEMPT).*(?:IDENTITY|CONFLICT)|(?:IDENTITY|CONFLICT).*(?:INVOICE|ATTEMPT)/.test(code)
  )) {
    return {
      ...base,
      kind: "identity-conflict",
      heading: "Invoice could not be matched",
      message: "The application and invoice details could not be safely matched. No payment status was changed. Refresh the page or contact an OnSpot administrator.",
    };
  }
  if (status !== undefined && status >= 500) {
    return {
      ...base,
      kind: "server",
      heading: "Invoice preparation unavailable",
      message: "OnSpot could not prepare the hiring invoice right now. No payment status was changed. Please try again shortly.",
    };
  }
  if (status === 409) {
    return {
      ...base,
      kind: "request",
      heading: "Request conflicts with current status",
      message: "The application or invoice changed and this request could not be completed. Refresh the page before trying again.",
    };
  }
  if (status === undefined) {
    return {
      ...base,
      kind: "network",
      heading: "Connection problem",
      message: "OnSpot could not be reached. Check your connection and try again.",
    };
  }
  return {
    ...base,
    kind: "request",
    heading: "Invoice could not be prepared",
    message: "The hiring invoice could not be prepared. Refresh the page or contact an OnSpot administrator.",
  };
}

export function HiringInvoiceStatus({ status }: { status: string }) {
  const color = status === "paid"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : ["overdue", "payment_failed", "invalidated", "refunded"].includes(status)
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : status === "verification_pending"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <Badge variant="outline" className={color}>{statusLabel[status] || status}</Badge>;
}
