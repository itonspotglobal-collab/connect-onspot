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
