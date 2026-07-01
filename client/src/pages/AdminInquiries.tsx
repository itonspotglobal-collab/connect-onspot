// TODO: Protect this route with admin authentication before going to production.
// Currently accessible without auth for internal testing.

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Inquiry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Search,
  Filter,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  BarChart3,
  Eye,
  Loader2,
  ArrowLeft,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  BadgeCheck,
  ShieldCheck,
  CalendarDays,
  Building2,
  Mail,
  Phone,
  StickyNote,
  Banknote,
  Receipt,
  Hash,
  Link2,
  AlertCircle,
  Paperclip,
  QrCode,
} from "lucide-react";

// ─── Derived status helpers ───────────────────────────────────────────────────

type InquiryStatus =
  | "pending_endorsement"
  | "endorsed"
  | "rejected"
  | "payment_pending"
  | "paid"
  | "completed";

function getEndorsementLabel(status: string): string {
  if (status === "rejected") return "Rejected";
  if (status === "pending_endorsement") return "Pending";
  return "Endorsed";
}

function getEndorsementColor(status: string): string {
  if (status === "rejected") return "bg-red-100 text-red-800 border-red-200";
  if (status === "pending_endorsement") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-indigo-100 text-indigo-800 border-indigo-200";
}

function getPaymentLabel(status: string, paymentStatus?: string | null): string {
  if (status === "paid") return "Paid";
  if (status === "completed") return "Completed";
  if (paymentStatus === "verified") return "Paid";
  if (paymentStatus === "pending_verification") return "For Review";
  if (paymentStatus === "rejected") return "Resubmit";
  if (status === "payment_pending") return "Pending";
  if (status === "rejected") return "N/A";
  return "Pending";
}

function getPaymentColor(status: string, paymentStatus?: string | null): string {
  if (status === "paid" || status === "completed" || paymentStatus === "verified") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (paymentStatus === "pending_verification") return "bg-amber-100 text-amber-800 border-amber-200";
  if (paymentStatus === "rejected") return "bg-red-100 text-red-800 border-red-200";
  if (status === "rejected") return "bg-gray-100 text-gray-500 border-gray-200";
  return "bg-orange-100 text-orange-800 border-orange-200";
}

function getInquiryStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_endorsement: "Submitted",
    endorsed: "Endorsed",
    rejected: "Rejected",
    payment_pending: "Payment Pending",
    paid: "Paid",
    completed: "Completed",
  };
  return map[status] ?? status;
}

function getInquiryStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending_endorsement: "bg-slate-100 text-slate-700 border-slate-200",
    endorsed: "bg-indigo-100 text-indigo-800 border-indigo-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    payment_pending: "bg-orange-100 text-orange-800 border-orange-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    completed: "bg-green-100 text-green-800 border-green-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentForm({
  inquiry,
  onDone,
}: {
  inquiry: Inquiry;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [method, setMethod] = useState(inquiry.paymentMethod ?? "manual");
  const [amount, setAmount] = useState(
    inquiry.paymentAmount ?? inquiry.estimatedBudget ?? "",
  );
  const [ref, setRef] = useState(inquiry.transactionReference ?? "");
  const [receiptUrl, setReceiptUrl] = useState(inquiry.receiptUrl ?? "");

  const paymentMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/inquiries/${inquiry.id}/payment`, {
        paymentStatus: "paid",
        paymentMethod: method,
        paymentAmount: amount ? parseFloat(String(amount)) : undefined,
        transactionReference: ref || undefined,
        receiptUrl: receiptUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ title: "Payment recorded — status set to Paid" });
      onDone();
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Record Manual Payment
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Payment Method</label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual / Bank Transfer</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="wire">Wire Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <Input
              className="pl-6 h-8 text-xs"
              placeholder="5,000"
              value={String(amount ?? "")}
              onChange={(e) => setAmount(e.target.value as any)}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Transaction / Reference Number</label>
        <Input
          className="h-8 text-xs"
          placeholder="PI-xxx, CHK-001, wire ref…"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Receipt URL (optional)</label>
        <Input
          className="h-8 text-xs"
          placeholder="https://…"
          value={receiptUrl}
          onChange={(e) => setReceiptUrl(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => paymentMutation.mutate()}
        disabled={paymentMutation.isPending}
      >
        {paymentMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
        Confirm Payment &amp; Mark as Paid
      </Button>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function InquiryDetailModal({
  inquiry,
  onClose,
}: {
  inquiry: Inquiry;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(inquiry.adminNotes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [adminPaymentNotes, setAdminPaymentNotes] = useState(inquiry.adminPaymentNotes ?? "");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const statusMutation = useMutation({
    mutationFn: ({ status, paymentMethod }: { status: string; paymentMethod?: string }) =>
      apiRequest("PATCH", `/api/inquiries/${inquiry.id}/status`, { status, paymentMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const notesMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/inquiries/${inquiry.id}/notes`, { adminNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setEditingNotes(false);
      toast({ title: "Notes saved" });
    },
    onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/inquiries/${inquiry.id}/payment/verify`, {
        adminPaymentNotes: adminPaymentNotes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ title: "Payment verified — inquiry marked as Paid" });
    },
    onError: () => toast({ title: "Failed to verify payment", variant: "destructive" }),
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/inquiries/${inquiry.id}/payment/reject`, {
        adminPaymentNotes: adminPaymentNotes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setShowRejectForm(false);
      toast({ title: "Payment confirmation rejected" });
    },
    onError: () => toast({ title: "Failed to reject payment", variant: "destructive" }),
  });

  const fmtDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) : "—";

  const fmtMoney = (v: string | null | undefined) => {
    if (!v) return "—";
    const n = parseFloat(v);
    return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const isPaid = inquiry.status === "paid" || inquiry.status === "completed";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-[#3F4698]" />
            {inquiry.referenceNumber}
            <span className="ml-1">
              <Chip label={getInquiryStatusLabel(inquiry.status)} colorClass={getInquiryStatusColor(inquiry.status)} />
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Endorsement + Payment status row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BadgeCheck className="w-3.5 h-3.5" />
              Endorsement:
              <Chip label={getEndorsementLabel(inquiry.status)} colorClass={getEndorsementColor(inquiry.status)} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
              <CreditCard className="w-3.5 h-3.5" />
              Payment:
              <Chip label={getPaymentLabel(inquiry.status, inquiry.paymentStatus)} colorClass={getPaymentColor(inquiry.status, inquiry.paymentStatus)} />
            </div>
          </div>

          {/* Customer info */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={FileText} label="Reference" value={inquiry.referenceNumber} />
              <InfoRow icon={BadgeCheck} label="Full Name" value={inquiry.fullName} />
              <InfoRow icon={Mail} label="Email" value={inquiry.email} />
              <InfoRow icon={Phone} label="Phone" value={inquiry.phoneNumber ?? "—"} />
              <InfoRow icon={Building2} label="Company" value={inquiry.company ?? "—"} />
              <InfoRow icon={CalendarDays} label="Submitted" value={fmtDate(inquiry.createdAt)} />
            </div>
          </div>

          {/* Service details */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Service Request</p>
            <p className="text-sm font-medium text-foreground mb-1">{inquiry.serviceNeeded}</p>
            {inquiry.details && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-lg p-3 text-xs">
                {inquiry.details}
              </p>
            )}
          </div>

          {/* Financial details */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Financial</p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={DollarSign} label="Estimated Budget" value={fmtMoney(inquiry.estimatedBudget)} />
              <InfoRow icon={DollarSign} label="Payment Amount" value={fmtMoney(inquiry.paymentAmount ?? inquiry.estimatedBudget)} />
              <InfoRow icon={CreditCard} label="Payment Method" value={inquiry.paymentMethod ?? "—"} />
              <InfoRow icon={Hash} label="Transaction Reference" value={inquiry.transactionReference ?? "—"} />
              <InfoRow icon={CalendarDays} label="Paid At" value={fmtDate(inquiry.paidAt)} />
              <InfoRow icon={BadgeCheck} label="Stripe PI" value={inquiry.stripePaymentIntentId ?? "—"} />
            </div>
            {inquiry.receiptUrl && (
              <a
                href={inquiry.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#3F4698] underline underline-offset-2"
              >
                <Receipt className="w-3.5 h-3.5" />
                View Receipt
              </a>
            )}
          </div>

          {/* Legal Agreements */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legal Agreements</p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow
                icon={ShieldCheck}
                label="Refund Policy Accepted"
                value={inquiry.refundPolicyAccepted ? "Yes" : "No"}
              />
              <InfoRow
                icon={CalendarDays}
                label="Accepted At"
                value={fmtDate(inquiry.refundPolicyAcceptedAt)}
              />
            </div>
          </div>

          {/* Payment Confirmation */}
          {(inquiry.paymentStatus || inquiry.paymentConfirmationSubmittedAt) && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Confirmation</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow
                  icon={QrCode}
                  label="Payment Status"
                  value={
                    inquiry.paymentStatus === "verified" ? "Verified"
                    : inquiry.paymentStatus === "rejected" ? "Rejected"
                    : "Pending Verification"
                  }
                />
                <InfoRow icon={Hash} label="Payment Reference" value={inquiry.paymentReferenceNumber ?? "—"} />
                <InfoRow
                  icon={Paperclip}
                  label="Proof Uploaded"
                  value={inquiry.paymentProofFilename ? "Yes" : "No"}
                />
                <InfoRow icon={CalendarDays} label="Submitted At" value={fmtDate(inquiry.paymentConfirmationSubmittedAt)} />
                {inquiry.paymentStatus === "verified" && (
                  <InfoRow icon={CalendarDays} label="Verified At" value={fmtDate(inquiry.paymentVerifiedAt)} />
                )}
                {inquiry.paymentStatus === "rejected" && (
                  <InfoRow icon={CalendarDays} label="Rejected At" value={fmtDate(inquiry.paymentRejectedAt)} />
                )}
              </div>

              {inquiry.paymentProofUrl && (
                <a
                  href={inquiry.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#3F4698] underline underline-offset-2"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {inquiry.paymentProofFilename ?? "View Proof"}
                </a>
              )}

              {inquiry.paymentNotes && (
                <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  <span className="font-medium">Client notes: </span>{inquiry.paymentNotes}
                </div>
              )}

              {inquiry.adminPaymentNotes && (
                <div className="mt-2 rounded-md bg-amber-50 border border-amber-100 p-2 text-xs text-amber-800">
                  <span className="font-medium">Admin notes: </span>{inquiry.adminPaymentNotes}
                </div>
              )}
            </div>
          )}

          {/* Admin actions */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Admin Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline"
                disabled={statusMutation.isPending || inquiry.status === "endorsed" || isPaid}
                onClick={() => statusMutation.mutate({ status: "endorsed" })}
              >
                <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                Endorse
              </Button>
              <Button
                size="sm" variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                disabled={statusMutation.isPending || inquiry.status === "rejected"}
                onClick={() => statusMutation.mutate({ status: "rejected" })}
              >
                <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                Reject
              </Button>
              <Button
                size="sm" variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
                disabled={statusMutation.isPending || inquiry.status === "payment_pending"}
                onClick={() => statusMutation.mutate({ status: "payment_pending" })}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Mark Payment Pending
              </Button>
              <Button
                size="sm" variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={isPaid}
                onClick={() => setShowPaymentForm(!showPaymentForm)}
              >
                <Banknote className="w-3.5 h-3.5 mr-1.5" />
                {isPaid ? "Paid" : "Record Payment"}
              </Button>
              <Button
                size="sm" variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                disabled={statusMutation.isPending || inquiry.status === "completed"}
                onClick={() => statusMutation.mutate({ status: "completed" })}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Complete
              </Button>
            </div>

            {/* QR Payment verify / reject */}
            {inquiry.paymentStatus === "pending_verification" && (
              <>
                <Button
                  size="sm" variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  disabled={verifyPaymentMutation.isPending || rejectPaymentMutation.isPending}
                  onClick={() => verifyPaymentMutation.mutate()}
                >
                  {verifyPaymentMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
                  Verify Payment
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={verifyPaymentMutation.isPending || rejectPaymentMutation.isPending}
                  onClick={() => setShowRejectForm((v) => !v)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Reject Confirmation
                </Button>
              </>
            )}

            {showPaymentForm && !isPaid && (
              <div className="mt-3 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
                <RecordPaymentForm
                  inquiry={inquiry}
                  onDone={() => setShowPaymentForm(false)}
                />
              </div>
            )}

            {showRejectForm && inquiry.paymentStatus === "pending_verification" && (
              <div className="mt-3 p-3 rounded-xl border border-red-100 bg-red-50/50 space-y-2 w-full">
                <p className="text-xs font-medium text-red-700">Rejection reason (optional)</p>
                <Input
                  className="h-8 text-xs"
                  placeholder="Reason shown to client…"
                  value={adminPaymentNotes}
                  onChange={(e) => setAdminPaymentNotes(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  disabled={rejectPaymentMutation.isPending}
                  onClick={() => rejectPaymentMutation.mutate()}
                >
                  {rejectPaymentMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Confirm Rejection
                </Button>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/inquiry/${inquiry.id}/review`}>View Review Page</Link>
            </Button>
            {(inquiry.status === "endorsed" || inquiry.status === "payment_pending") && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/inquiry/${inquiry.id}/payment`}>Payment Page</Link>
              </Button>
            )}
            {(isPaid || inquiry.paymentStatus) && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/inquiry/${inquiry.id}/success`}>Confirmation Page</Link>
              </Button>
            )}
          </div>

          {/* Admin notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <StickyNote className="w-3.5 h-3.5" />
                Admin Notes
              </p>
              {!editingNotes && (
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingNotes(true)}>
                  {inquiry.adminNotes ? "Edit" : "Add Note"}
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes…"
                  rows={3}
                  className="text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => notesMutation.mutate()} disabled={notesMutation.isPending}>
                    {notesMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNotes(inquiry.adminNotes ?? ""); setEditingNotes(false); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {inquiry.adminNotes ?? <span className="italic text-muted-foreground/50">No notes yet.</span>}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-muted/60">
            <InfoRow icon={CalendarDays} label="Submitted" value={fmtDate(inquiry.createdAt)} />
            <InfoRow icon={CalendarDays} label="Last Updated" value={fmtDate(inquiry.updatedAt)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground break-all">{value}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminInquiries() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEndorsement, setFilterEndorsement] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [selected, setSelected] = useState<Inquiry | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ inquiries: Inquiry[] }>({
    queryKey: ["/api/inquiries"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const inquiries: Inquiry[] = data?.inquiries ?? [];

  // ── Summaries ──
  const total = inquiries.length;
  const pendingEndorsement = inquiries.filter((i) => i.status === "pending_endorsement").length;
  const endorsed = inquiries.filter((i) => i.status === "endorsed").length;
  const pendingPayment = inquiries.filter((i) => i.status === "payment_pending" || (i.status === "endorsed")).length;
  const paid = inquiries.filter((i) => i.status === "paid" || i.status === "completed").length;
  const totalRevenue = inquiries
    .filter((i) => i.status === "paid" || i.status === "completed")
    .reduce((sum, i) => {
      const amt = i.paymentAmount ?? i.estimatedBudget;
      return sum + (amt ? parseFloat(amt) : 0);
    }, 0);

  // ── Filtering ──
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    const DAY = 86_400_000;

    return inquiries.filter((i) => {
      if (term) {
        const hay = `${i.fullName} ${i.email} ${i.company ?? ""} ${i.referenceNumber}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (filterEndorsement !== "all") {
        if (filterEndorsement === "pending" && i.status !== "pending_endorsement") return false;
        if (filterEndorsement === "endorsed" && !["endorsed", "payment_pending", "paid", "completed"].includes(i.status)) return false;
        if (filterEndorsement === "rejected" && i.status !== "rejected") return false;
      }
      if (filterPayment !== "all") {
        if (filterPayment === "paid" && i.status !== "paid" && i.status !== "completed") return false;
        if (filterPayment === "pending" && i.status !== "payment_pending" && i.status !== "endorsed") return false;
        if (filterPayment === "unpaid" && (i.status === "paid" || i.status === "completed")) return false;
      }
      if (filterDate !== "all" && i.createdAt) {
        const age = now - new Date(i.createdAt).getTime();
        if (filterDate === "today" && age > DAY) return false;
        if (filterDate === "week" && age > 7 * DAY) return false;
        if (filterDate === "month" && age > 30 * DAY) return false;
      }
      return true;
    });
  }, [inquiries, search, filterEndorsement, filterPayment, filterDate]);

  const fmtDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const fmtMoney = (v: string | null | undefined) => {
    if (!v) return "—";
    const n = parseFloat(v);
    return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-semibold">Failed to load inquiries</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#3F4698]/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-[#3F4698]" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">Admin — Inquiry Dashboard</h1>
              <p className="text-[11px] text-muted-foreground">Real-time data from database · {total} total records</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/inquiry">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              New Inquiry
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard icon={BarChart3}    label="Total Inquiries"    value={total}          color="bg-slate-100 text-slate-600" />
          <SummaryCard icon={Clock}        label="Pending Endorsement" value={pendingEndorsement} color="bg-amber-100 text-amber-700" />
          <SummaryCard icon={ThumbsUp}     label="Endorsed"           value={endorsed}       color="bg-indigo-100 text-indigo-700" />
          <SummaryCard icon={CreditCard}   label="Pending Payment"    value={pendingPayment} color="bg-orange-100 text-orange-700" />
          <SummaryCard icon={CheckCircle2} label="Paid / Completed"   value={paid}           color="bg-emerald-100 text-emerald-700" />
          <SummaryCard icon={DollarSign}   label="Total Revenue"
            value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
            color="bg-green-100 text-green-700" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, company, or ref ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={filterEndorsement} onValueChange={setFilterEndorsement}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Endorsement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Endorsements</SelectItem>
                  <SelectItem value="pending">Pending Endorsement</SelectItem>
                  <SelectItem value="endorsed">Endorsed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="pending">Pending Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDate} onValueChange={setFilterDate}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <CalendarDays className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterEndorsement !== "all" || filterPayment !== "all" || filterDate !== "all") && (
                <Button size="sm" variant="ghost" className="text-xs h-9"
                  onClick={() => { setSearch(""); setFilterEndorsement("all"); setFilterPayment("all"); setFilterDate("all"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3F4698]" />
              Inquiry Submissions
              <Badge variant="secondary" className="ml-1 text-xs">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading from database…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No inquiries found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {inquiries.length === 0
                    ? "No submissions yet. Share the inquiry link to get started."
                    : "Try clearing your filters."}
                </p>
                {inquiries.length === 0 && (
                  <Button size="sm" className="mt-4" asChild>
                    <Link href="/inquiry">Submit First Inquiry</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-32">Ref ID</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Service</TableHead>
                      <TableHead className="text-xs">Budget</TableHead>
                      <TableHead className="text-xs">Inquiry Status</TableHead>
                      <TableHead className="text-xs">Endorsement</TableHead>
                      <TableHead className="text-xs">Payment</TableHead>
                      <TableHead className="text-xs">Submitted</TableHead>
                      <TableHead className="text-xs w-20">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inq) => (
                      <TableRow key={inq.id} className="hover-elevate">
                        <TableCell className="font-mono text-xs text-[#3F4698] font-semibold whitespace-nowrap">
                          {inq.referenceNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-medium text-foreground">{inq.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">{inq.email}</p>
                            {inq.phoneNumber && (
                              <p className="text-[11px] text-muted-foreground">{inq.phoneNumber}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{inq.company ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[140px]">
                          <span className="line-clamp-2">{inq.serviceNeeded}</span>
                        </TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap">
                          {inq.estimatedBudget
                            ? `$${parseFloat(inq.estimatedBudget).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Chip label={getInquiryStatusLabel(inq.status)} colorClass={getInquiryStatusColor(inq.status)} />
                        </TableCell>
                        <TableCell>
                          <Chip label={getEndorsementLabel(inq.status)} colorClass={getEndorsementColor(inq.status)} />
                        </TableCell>
                        <TableCell>
                          <Chip label={getPaymentLabel(inq.status, inq.paymentStatus)} colorClass={getPaymentColor(inq.status, inq.paymentStatus)} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(inq.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => setSelected(inq)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground/60 text-center pb-2">
          All data is fetched live from PostgreSQL · Records persist across page refreshes ·{" "}
          <span className="text-amber-600 font-medium">TODO: Protect with admin auth before production.</span>
        </p>
      </div>

      {selected && (
        <InquiryDetailModal
          inquiry={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
