import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Loader2,
  Download,
  Home,
  FileText,
  CreditCard,
  Calendar,
  Hash,
  DollarSign,
} from "lucide-react";

function formatUSD(val: string | number | null | undefined) {
  if (!val) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InquirySuccess() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [showReceipt, setShowReceipt] = useState(false);

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

  // Gate: only show success if payment is actually confirmed
  if (!inquiry || inquiry.status !== "paid") {
    const target = inquiry?.status === "endorsed"
      ? `/inquiry/${id}/payment`
      : `/inquiry/${id}/review`;
    navigate(target);
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      {/* Hero success section */}
      <section className="bg-gradient-to-br from-emerald-50 via-background to-[#5B45E8]/5 pt-28 pb-14 px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success icon */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="absolute h-24 w-24 rounded-full bg-emerald-200/40 blur-[18px]" />
            <div className="absolute h-20 w-20 rounded-full border border-emerald-200/60 bg-emerald-50/80" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_6px_24px_rgba(16,185,129,0.40)]">
              <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            Payment Completed Successfully
          </h1>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            Thank you! Your service request has been confirmed. Our team will be in touch within 24 hours.
          </p>
        </div>
      </section>

      {/* Steps */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3 text-sm">
          {["Inquiry Details", "Review & Endorse", "Payment"].map((label) => (
            <>
              <div key={label} className="flex items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                {label}
              </div>
              <div className="flex-1 h-px bg-emerald-200" />
            </>
          ))}
          <div className="flex items-center gap-2 font-semibold text-emerald-600">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Confirmation
          </div>
        </div>
      </div>

      {/* Transaction summary */}
      <section className="py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          {inquiry && (
            <Card className="shadow-sm border-emerald-100">
              <CardContent className="p-7 space-y-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Transaction Summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Reference Number</p>
                      <p className="font-mono font-semibold text-slate-800">{inquiry.referenceNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Amount Paid (USD)</p>
                      <p className="font-semibold text-lg text-emerald-700">{formatUSD(inquiry.estimatedBudget)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Payment Method</p>
                      <p className="font-medium text-slate-800">Credit / Debit Card</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Date &amp; Time</p>
                      <p className="font-medium text-slate-800">{formatDate(inquiry.paidAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Service</p>
                      <p className="font-medium text-slate-800">{inquiry.serviceNeeded}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipt card (inline) */}
          {showReceipt && inquiry && (
            <Card className="shadow-sm bg-slate-50 border-dashed border-slate-200">
              <CardContent className="p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">OnSpot Global — Official Receipt</h3>
                  <span className="text-xs text-slate-400 font-mono">{inquiry.referenceNumber}</span>
                </div>
                <div className="border-t border-dashed border-slate-300 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{inquiry.fullName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium">{inquiry.email}</span></div>
                  {inquiry.company && <div className="flex justify-between"><span className="text-slate-500">Company</span><span className="font-medium">{inquiry.company}</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500">Service</span><span className="font-medium">{inquiry.serviceNeeded}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(inquiry.paidAt)}</span></div>
                  <div className="border-t border-dashed border-slate-300 pt-2 flex justify-between font-bold text-base">
                    <span>Total Paid</span><span className="text-emerald-700">{formatUSD(inquiry.estimatedBudget)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 text-center pt-2">
                  This is a computer-generated receipt. No signature is required.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="flex-1 border-slate-200"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <Button
              onClick={() => setShowReceipt((v) => !v)}
              className="flex-1 bg-[#3F4698] hover:bg-[#474ead] text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              {showReceipt ? "Hide Receipt" : "View Receipt"}
            </Button>
          </div>

          <p className="text-center text-xs text-slate-400">
            A confirmation email will be sent to <strong>{inquiry?.email}</strong>. Questions? Email us at{" "}
            <a href="mailto:hello@onspotglobal.com" className="text-[#3F4698] underline underline-offset-2">
              hello@onspotglobal.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
