import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Loader2,
  Home,
  FileText,
  Clock,
  Calendar,
  Hash,
  DollarSign,
  ReceiptText,
  Paperclip,
} from "lucide-react";

function formatUSD(val: string | number | null | undefined) {
  if (!val) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <div className="font-medium text-slate-800 text-sm break-words">{value}</div>
      </div>
    </div>
  );
}

export default function InquirySuccess() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ inquiry: any }>({
    queryKey: ["/api/inquiries", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/inquiries/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="w-8 h-8 animate-spin text-[#3F4698]" />
        </div>
      </div>
    );
  }

  const inquiry = data?.inquiry;

  // Gate: only show success if payment confirmation was submitted (any paymentStatus) or already paid/completed
  const isPaymentSubmitted =
    inquiry?.paymentStatus ||
    inquiry?.paymentConfirmationSubmittedAt ||
    inquiry?.status === "paid" ||
    inquiry?.status === "completed";

  if (!inquiry || !isPaymentSubmitted) {
    const target =
      inquiry?.status === "endorsed"
        ? `/inquiry/${id}/payment`
        : `/inquiry/${id}/review`;
    navigate(target);
    return null;
  }

  const paymentStatus = inquiry.paymentStatus ?? (inquiry.status === "paid" ? "verified" : "pending_verification");
  const isVerified = paymentStatus === "verified" || inquiry.status === "paid";
  const isRejected = paymentStatus === "rejected";

  const statusLabel = isVerified
    ? "Verified"
    : isRejected
    ? "Rejected — Please resubmit"
    : "Pending Verification";

  const statusColor = isVerified
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : isRejected
    ? "bg-red-100 text-red-800 border-red-200"
    : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      {/* Hero */}
      <section
        className={`pt-28 pb-14 px-4 ${
          isVerified
            ? "bg-gradient-to-br from-emerald-50 via-background to-[#5B45E8]/5"
            : isRejected
            ? "bg-gradient-to-br from-red-50 via-background to-background"
            : "bg-gradient-to-br from-[#3F4698]/6 via-background to-amber-50/40"
        }`}
      >
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div
              className={`absolute h-24 w-24 rounded-full blur-[18px] ${
                isVerified ? "bg-emerald-200/40" : isRejected ? "bg-red-200/40" : "bg-[#3F4698]/15"
              }`}
            />
            <div
              className={`absolute h-20 w-20 rounded-full border ${
                isVerified
                  ? "border-emerald-200/60 bg-emerald-50/80"
                  : isRejected
                  ? "border-red-200/60 bg-red-50/80"
                  : "border-[#3F4698]/20 bg-[#3F4698]/6"
              }`}
            />
            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg ${
                isVerified
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-200"
                  : isRejected
                  ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-200"
                  : "bg-gradient-to-br from-[#3F4698] to-[#5B45E8] shadow-[#3F4698]/30"
              }`}
            >
              {isVerified ? (
                <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2} />
              ) : (
                <Clock className="w-8 h-8 text-white" strokeWidth={2} />
              )}
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            {isVerified ? "Payment Verified" : "Payment Confirmation Submitted"}
          </h1>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            {isVerified
              ? "Your payment has been verified. Our team will be in touch within 24 hours."
              : isRejected
              ? "Your payment confirmation was not accepted. Please resubmit with correct details."
              : "Thank you. Your payment confirmation has been submitted. The OnSpot team will review your payment and contact you directly once verified."}
          </p>
        </div>
      </section>

      {/* Stepper */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2 text-sm overflow-x-auto">
          {["Inquiry Details", "Review & Endorse", "Payment"].map((label) => (
            <div key={label} className="contents">
              <div className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {label}
              </div>
              <div className="flex-1 h-px bg-emerald-200 min-w-[12px]" />
            </div>
          ))}
          <div className="flex items-center gap-1.5 font-semibold text-emerald-600 whitespace-nowrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            Confirmation
          </div>
        </div>
      </div>

      {/* Summary */}
      <section className="py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          <Card className="shadow-sm border-slate-100">
            <CardContent className="p-7 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Submission Summary</h2>
                <Badge className={`text-xs font-medium border ${statusColor}`}>
                  {statusLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <SummaryRow icon={Hash} label="Inquiry Reference" value={<span className="font-mono">{inquiry.referenceNumber}</span>} />
                <SummaryRow icon={FileText} label="Customer Name" value={inquiry.fullName} />
                <SummaryRow icon={DollarSign} label="Amount Due (USD)" value={formatUSD(inquiry.estimatedBudget)} />
                <SummaryRow
                  icon={ReceiptText}
                  label="Payment Reference"
                  value={inquiry.paymentReferenceNumber ?? <span className="text-slate-400 italic">Not provided</span>}
                />
                {inquiry.paymentProofFilename && (
                  <SummaryRow
                    icon={Paperclip}
                    label="Proof of Payment"
                    value={
                      inquiry.paymentProofUrl ? (
                        <a
                          href={inquiry.paymentProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#3F4698] underline underline-offset-2 break-all"
                        >
                          {inquiry.paymentProofFilename}
                        </a>
                      ) : (
                        inquiry.paymentProofFilename
                      )
                    }
                  />
                )}
                <SummaryRow
                  icon={Calendar}
                  label="Submitted At"
                  value={formatDate(inquiry.paymentConfirmationSubmittedAt)}
                />
              </div>

              {inquiry.paymentNotes && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400 mb-1">Your Notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{inquiry.paymentNotes}</p>
                </div>
              )}

              {isRejected && inquiry.adminPaymentNotes && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-medium text-red-600 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700 leading-relaxed">{inquiry.adminPaymentNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="flex-1 border-slate-200"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            {isRejected && (
              <Button
                onClick={() => navigate(`/inquiry/${id}/payment`)}
                className="flex-1 bg-[#3F4698] hover:bg-[#474ead] text-white"
              >
                Resubmit Payment
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-slate-400">
            Questions? Email us at{" "}
            <a
              href="mailto:hello@onspotglobal.com"
              className="text-[#3F4698] underline underline-offset-2"
            >
              hello@onspotglobal.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
