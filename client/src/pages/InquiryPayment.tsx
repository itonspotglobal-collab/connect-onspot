import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Upload,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  FileText,
  AlertCircle,
  Shield,
  Clock,
} from "lucide-react";

function formatUSD(val: string | number | null | undefined) {
  if (!val) return "$0.00";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function InquiryPayment() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [paymentRef, setPaymentRef] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<{ inquiry: any }>({
    queryKey: ["/api/inquiries", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/inquiries/${id}`);
      if (!res.ok) throw new Error("Inquiry not found");
      return res.json();
    },
  });

  const inquiry = data?.inquiry;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (paymentRef.trim()) formData.append("paymentReferenceNumber", paymentRef.trim());
      if (notes.trim()) formData.append("paymentNotes", notes.trim());
      if (proofFile) formData.append("proofFile", proofFile);

      const res = await fetch(`/api/inquiries/${id}/payment-confirmation`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => navigate(`/inquiry/${id}/success`),
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProofFile(e.target.files?.[0] ?? null);
  }

  function handleSubmit() {
    setSubmitError(null);
    if (!paymentRef.trim() && !proofFile) {
      setSubmitError("Please enter a payment reference number or upload proof of payment.");
      return;
    }
    submitMutation.mutate();
  }

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

  // Already submitted confirmation → go to success
  if (inquiry?.paymentConfirmationSubmittedAt || inquiry?.paymentStatus) {
    navigate(`/inquiry/${id}/success`);
    return null;
  }

  if (!inquiry || inquiry.status === "pending_endorsement" || inquiry.status === "rejected") {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="flex flex-col items-center justify-center pt-40 gap-4 text-center px-4">
          <p className="text-slate-500">This inquiry has not been endorsed yet.</p>
          <Button onClick={() => navigate(`/inquiry/${id}/review`)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Review
          </Button>
        </div>
      </div>
    );
  }

  const amount = formatUSD(inquiry.estimatedBudget);

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#3F4698]/8 via-background to-[#5B45E8]/5 pt-28 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#3F4698]/20 bg-[#3F4698]/8 px-4 py-1.5 text-xs font-semibold text-[#3F4698] mb-6">
            <QrCode className="w-3.5 h-3.5" />
            QR Payment
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            Complete Your Payment
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            Scan the QR code below to send your payment, then upload your confirmation.
          </p>
        </div>
      </section>

      {/* Stepper */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2 text-sm overflow-x-auto">
          <div className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
            Inquiry Details
          </div>
          <div className="flex-1 h-px bg-slate-200 min-w-[12px]" />
          <div className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
            Review &amp; Endorse
          </div>
          <div className="flex-1 h-px bg-slate-200 min-w-[12px]" />
          <div className="flex items-center gap-1.5 font-semibold text-[#3F4698] whitespace-nowrap">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3F4698] text-white text-[10px] font-bold flex-shrink-0">3</span>
            Payment
          </div>
          <div className="flex-1 h-px bg-slate-200 min-w-[12px]" />
          <div className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold flex-shrink-0">4</span>
            Confirmation
          </div>
        </div>
      </div>

      {/* Content */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Summary + QR side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Order summary */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Order Summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Reference</span>
                    <span className="font-mono font-medium text-slate-800 text-right">{inquiry.referenceNumber}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-medium text-slate-800 text-right">{inquiry.fullName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Service</span>
                    <span className="font-medium text-slate-800 text-right">{inquiry.serviceNeeded}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between gap-4">
                    <span className="font-semibold text-slate-700">Amount Due (USD)</span>
                    <span className="font-bold text-lg text-[#3F4698]">{amount}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 leading-relaxed">
                  Scan the QR code to pay via Wise or any compatible payment app. Once payment is sent, enter your confirmation details below.
                </div>
              </CardContent>
            </Card>

            {/* QR code */}
            <Card className="shadow-sm">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider self-start">Scan to Pay</h2>
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <img
                    src="/wise-qr-code.png"
                    alt="OnSpot Payment QR Code"
                    width={192}
                    height={192}
                    className="w-48 h-48 object-contain rounded-lg"
                    draggable={false}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 text-center">
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  Scan with Wise or a compatible payment app
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Confirmation form */}
          <Card className="shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Submit Payment Confirmation</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Once your payment has been sent, please upload your confirmation number, reference number, or proof of payment. The OnSpot team will review your submission and contact you directly once verified.
                </p>
              </div>

              {/* Payment reference number */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Payment Reference / Confirmation Number
                </label>
                <Input
                  placeholder="e.g. T12345678 or WISE-20260630-001"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="rounded-lg border-slate-200"
                />
              </div>

              {/* File upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Proof of Payment{" "}
                  <span className="text-slate-400 font-normal">(JPG, PNG, PDF — optional if reference provided)</span>
                </label>
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-6 cursor-pointer hover-elevate"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {proofFile ? (
                    <>
                      <FileText className="w-6 h-6 text-[#3F4698]" />
                      <p className="text-sm font-medium text-slate-800">{proofFile.name}</p>
                      <p className="text-xs text-slate-400">{(proofFile.size / 1024).toFixed(0)} KB</p>
                      <button
                        type="button"
                        className="text-xs text-red-500 underline underline-offset-2 mt-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProofFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        Remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400" />
                      <p className="text-sm text-slate-500">Click to upload proof of payment</p>
                      <p className="text-xs text-slate-400">JPG, PNG, or PDF up to 10 MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Additional Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <Textarea
                  placeholder="Any additional information about your payment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-lg border-slate-200 min-h-[80px] resize-none"
                />
              </div>

              {/* Validation error */}
              {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/inquiry/${id}/review`)}
                  className="text-slate-400"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Back to Review
                </Button>
                <Button
                  type="button"
                  disabled={submitMutation.isPending}
                  onClick={handleSubmit}
                  className="w-full sm:w-auto bg-[#3F4698] hover:bg-[#474ead] text-white h-11 rounded-xl px-8 font-semibold"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Submit Payment Confirmation
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>
    </div>
  );
}
