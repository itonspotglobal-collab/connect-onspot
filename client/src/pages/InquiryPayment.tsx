import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Shield,
  Loader2,
  CheckCircle2,
  Lock,
  ArrowLeft,
} from "lucide-react";

// TODO: Replace simulated payment with Stripe Elements when VITE_STRIPE_PUBLIC_KEY is configured.
// Pattern: import { loadStripe } from "@stripe/stripe-js"; const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
// Then wrap the form in <Elements stripe={stripePromise} options={{ clientSecret }}>

function formatUSD(val: string | number | null | undefined) {
  if (!val) return "$0.00";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard },
  { id: "bank", label: "Bank Transfer", icon: null },
  { id: "paypal", label: "PayPal", icon: null },
  { id: "other", label: "Other USD Method", icon: null },
];

export default function InquiryPayment() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState("card");
  const [cardFields, setCardFields] = useState({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    billingEmail: "",
  });

  const { data, isLoading } = useQuery<{ inquiry: any }>({
    queryKey: ["/api/inquiries", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/inquiries/${id}`);
      if (!res.ok) throw new Error("Inquiry not found");
      return res.json();
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/inquiries/${id}/pay`, {
        paymentMethod: PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label ?? "Credit/Debit Card",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      navigate(`/inquiry/${id}/success`);
    },
    onError: (err: Error) => {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    },
  });

  function formatCardNumber(val: string) {
    return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    return digits;
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (selectedMethod === "card") {
      if (!cardFields.cardholderName.trim()) {
        toast({ title: "Cardholder name required", variant: "destructive" });
        return;
      }
      if (cardFields.cardNumber.replace(/\s/g, "").length < 16) {
        toast({ title: "Enter a valid 16-digit card number", variant: "destructive" });
        return;
      }
      if (!cardFields.expiry.includes("/")) {
        toast({ title: "Enter a valid expiry (MM / YY)", variant: "destructive" });
        return;
      }
      if (cardFields.cvv.length < 3) {
        toast({ title: "Enter a valid CVV", variant: "destructive" });
        return;
      }
    }
    payMutation.mutate();
  }

  const inquiry = data?.inquiry;
  const amount = inquiry?.estimatedBudget ? formatUSD(inquiry.estimatedBudget) : "$0.00";

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

  if (!inquiry || inquiry.status === "pending_endorsement") {
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

  if (inquiry.status === "paid") {
    navigate(`/inquiry/${id}/success`);
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#3F4698]/8 via-background to-[#5B45E8]/5 pt-28 pb-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700 mb-6">
            <CreditCard className="w-3.5 h-3.5" />
            Secure Payment
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            Complete Your Payment
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            Your inquiry is endorsed. Complete payment to confirm your service request.
          </p>
        </div>
      </section>

      {/* Steps */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Inquiry Details
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Review &amp; Endorse
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2 font-semibold text-[#3F4698]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3F4698] text-white text-[11px] font-bold">3</span>
            Payment
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold">4</span>
            Confirmation
          </div>
        </div>
      </div>

      {/* Content */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Order summary */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Order Summary</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Service</span>
                      <span className="font-medium text-slate-800 text-right">{inquiry.serviceNeeded}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-medium text-slate-800 text-right">{inquiry.fullName}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Reference</span>
                      <span className="font-mono text-slate-800 text-right">{inquiry.referenceNumber}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Status</span>
                      <span className="font-semibold text-emerald-600">Endorsed</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between gap-4">
                      <span className="font-semibold text-slate-700">Total (USD)</span>
                      <span className="font-bold text-lg text-[#3F4698]">{amount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                <span>256-bit SSL encryption. Your payment is secure.</span>
              </div>
            </div>

            {/* Payment form */}
            <div className="lg:col-span-3">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-6">
                  {/* Method selection */}
                  <div>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Payment Method</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMethod(m.id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                            selectedMethod === m.id
                              ? "border-[#3F4698] bg-[#3F4698]/5 text-[#3F4698]"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {m.icon && <m.icon className="w-4 h-4 flex-shrink-0" />}
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card form */}
                  {selectedMethod === "card" && (
                    <form onSubmit={handlePay} className="space-y-4">
                      <div>
                        <Label htmlFor="cardholderName">Cardholder Name</Label>
                        <Input
                          id="cardholderName"
                          placeholder="Juan dela Cruz"
                          className="mt-1"
                          value={cardFields.cardholderName}
                          onChange={(e) => setCardFields((p) => ({ ...p, cardholderName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <div className="relative mt-1">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="cardNumber"
                            placeholder="1234 5678 9012 3456"
                            className="pl-10"
                            value={cardFields.cardNumber}
                            onChange={(e) =>
                              setCardFields((p) => ({ ...p, cardNumber: formatCardNumber(e.target.value) }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expiry">Expiry Date</Label>
                          <Input
                            id="expiry"
                            placeholder="MM / YY"
                            className="mt-1"
                            value={cardFields.expiry}
                            onChange={(e) =>
                              setCardFields((p) => ({ ...p, expiry: formatExpiry(e.target.value) }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="cvv">CVV</Label>
                          <Input
                            id="cvv"
                            placeholder="123"
                            className="mt-1"
                            maxLength={4}
                            value={cardFields.cvv}
                            onChange={(e) =>
                              setCardFields((p) => ({ ...p, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="billingEmail">Billing Email</Label>
                        <Input
                          id="billingEmail"
                          placeholder="you@company.com"
                          type="email"
                          className="mt-1"
                          value={cardFields.billingEmail}
                          onChange={(e) => setCardFields((p) => ({ ...p, billingEmail: e.target.value }))}
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={payMutation.isPending}
                        className="w-full bg-gradient-to-r from-[#3F4698] to-[#5B45E8] text-white h-11 mt-2"
                      >
                        {payMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                        ) : (
                          <><Lock className="w-4 h-4 mr-2" />Pay Now · {amount}</>
                        )}
                      </Button>
                    </form>
                  )}

                  {selectedMethod !== "card" && (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-5 text-center text-sm text-slate-500 space-y-4">
                      <p>
                        You've selected <strong className="text-slate-700">{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}</strong>.
                        Our team will send you payment instructions via email within 24 hours.
                      </p>
                      <Button
                        type="button"
                        onClick={handlePay}
                        disabled={payMutation.isPending}
                        className="w-full bg-gradient-to-r from-[#3F4698] to-[#5B45E8] text-white"
                      >
                        {payMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                        ) : (
                          <>Confirm &amp; Request Payment Instructions</>
                        )}
                      </Button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-slate-400 text-xs"
                    onClick={() => navigate(`/inquiry/${id}/review`)}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to Review
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
