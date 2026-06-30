import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Shield,
  Loader2,
  CheckCircle2,
  Lock,
  ArrowLeft,
  AlertCircle,
  Mail,
} from "lucide-react";

// Stripe initialisation — mirrors the existing LegalOps pattern.
// stripePromise is null when VITE_STRIPE_PUBLIC_KEY is not configured;
// in that case we render a "contact us" fallback instead of the payment form.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.warn("Missing VITE_STRIPE_PUBLIC_KEY - Stripe checkout will not work");
}
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatUSD(val: string | number | null | undefined) {
  if (!val) return "$0.00";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ─────────────────────────────────────────────────────────────
// Inner checkout form (rendered inside <Elements> provider)
// ─────────────────────────────────────────────────────────────
type CheckoutFormProps = {
  inquiryId: string;
  paymentIntentId: string;
  amount: string;
  onSuccess: () => void;
};

function CheckoutForm({ inquiryId, paymentIntentId, amount, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      // 1. Confirm payment with Stripe (no redirect — handled in-page)
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (stripeError) {
        toast({
          title: "Payment failed",
          description: stripeError.message ?? "Your card was declined.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status !== "succeeded") {
        toast({
          title: "Payment incomplete",
          description: `Payment status: ${paymentIntent?.status}. Please try again.`,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // 2. Verify with backend and mark inquiry as paid
      const res = await apiRequest("PATCH", `/api/inquiries/${inquiryId}/paid`, {
        paymentIntentId: paymentIntent.id,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to record payment");
      }

      onSuccess();
    } catch (err: any) {
      toast({
        title: "Error recording payment",
        description: err.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stripe's PaymentElement renders card + wallet fields */}
      <PaymentElement
        options={{
          layout: "tabs",
          fields: { billingDetails: { email: "auto", name: "auto" } },
        }}
      />

      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full bg-gradient-to-r from-[#3F4698] to-[#5B45E8] text-white h-11"
      >
        {isProcessing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
        ) : (
          <><Lock className="w-4 h-4 mr-2" />Pay Securely · {amount}</>
        )}
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// No-key fallback UI (shown when VITE_STRIPE_PUBLIC_KEY is absent)
// ─────────────────────────────────────────────────────────────
function PaymentNotConfigured() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-3 text-center">
      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
      <h3 className="font-semibold text-slate-800">Online payment is being set up</h3>
      <p className="text-sm text-slate-600 leading-relaxed">
        Our secure payment system is currently being configured. To complete your payment, please contact us directly and reference your inquiry number.
      </p>
      <a
        href="mailto:hello@onspotglobal.com"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3F4698] hover:underline"
      >
        <Mail className="w-4 h-4" />
        hello@onspotglobal.com
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────
export default function InquiryPayment() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>("");
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ inquiry: any }>({
    queryKey: ["/api/inquiries", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/inquiries/${id}`);
      if (!res.ok) throw new Error("Inquiry not found");
      return res.json();
    },
  });

  const inquiry = data?.inquiry;

  // Create a PaymentIntent as soon as the inquiry is loaded and endorsed
  useEffect(() => {
    if (!inquiry || inquiry.status !== "endorsed" || !stripePromise) return;
    if (clientSecret) return; // already fetched

    setIntentLoading(true);
    setIntentError(null);

    apiRequest("POST", "/api/payments", { inquiryId: id })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? json.error ?? "Payment setup failed");
        setClientSecret(json.clientSecret);
        setPaymentIntentId(json.paymentIntentId);
      })
      .catch((err: Error) => {
        setIntentError(err.message);
        toast({ title: "Payment setup failed", description: err.message, variant: "destructive" });
      })
      .finally(() => setIntentLoading(false));
  }, [inquiry, id, clientSecret, toast]);

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

  const amount = formatUSD(inquiry.estimatedBudget);

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
                <span>256-bit TLS encryption. Payments processed by Stripe.</span>
              </div>
            </div>

            {/* Payment form */}
            <div className="lg:col-span-3">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Payment Details</h2>

                  {/* No Stripe key configured */}
                  {!stripePromise && <PaymentNotConfigured />}

                  {/* Stripe key present but intent still loading */}
                  {stripePromise && intentLoading && (
                    <div className="flex items-center justify-center py-10 gap-3 text-slate-500 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-[#3F4698]" />
                      Setting up secure payment…
                    </div>
                  )}

                  {/* Intent error */}
                  {stripePromise && !intentLoading && intentError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                      <p className="text-sm font-medium text-red-700">{intentError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIntentError(null);
                          setClientSecret(null);
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  )}

                  {/* Stripe Elements payment form */}
                  {stripePromise && clientSecret && !intentError && (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: "stripe",
                          variables: {
                            colorPrimary: "#3F4698",
                            borderRadius: "6px",
                            fontFamily: "Inter, system-ui, sans-serif",
                          },
                        },
                      }}
                    >
                      <CheckoutForm
                        inquiryId={id!}
                        paymentIntentId={paymentIntentId}
                        amount={amount}
                        onSuccess={() => navigate(`/inquiry/${id}/success`)}
                      />
                    </Elements>
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
