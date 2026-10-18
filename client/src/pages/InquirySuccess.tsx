import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { authAPI } from "@/lib/api";
import { TopNavigation } from "@/components/TopNavigation";
import { ManualWisePaymentPanel, WiseObligation } from "@/components/manual-wise/ManualWisePaymentPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock3, Home, RefreshCw } from "lucide-react";
import { buildLoginReturnUrl } from "@/lib/returnTo";

export default function InquirySuccess() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const inquiryQuery = useQuery<{ inquiry: any }>({ queryKey: ["/api/inquiries", id], queryFn: async () => (await apiRequest("GET", `/api/inquiries/${id}`)).json() });
  const paymentQuery = useQuery<WiseObligation>({
    queryKey: ["/api/manual-wise/obligations", "inquiry", id],
    queryFn: () => authAPI.get(`/api/manual-wise/obligations/inquiry/${encodeURIComponent(id || "")}`),
  });
  const inquiry = inquiryQuery.data?.inquiry;
  const status = paymentQuery.data?.paymentStatus;
  const paid = status === "paid";
  const rejected = status === "rejected";
  const pending = status === "verification_pending";
  const loading = inquiryQuery.isLoading || paymentQuery.isLoading;
  if (loading) return <div className="min-h-[100dvh] bg-background"><TopNavigation /><div className="mx-auto max-w-2xl space-y-4 px-4 pt-32"><div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /><div className="h-52 animate-pulse rounded-xl bg-muted" /></div></div>;
  const authorized = Boolean(inquiry) && (paymentQuery.isSuccess || inquiry?.status === "endorsed");
  if (!authorized) return <div className="min-h-[100dvh] bg-background"><TopNavigation /><main className="mx-auto max-w-xl px-4 pt-32"><Card><CardContent className="space-y-4 p-6 text-center"><h1 className="text-xl font-semibold">Payment status unavailable</h1><p className="text-sm text-muted-foreground">Sign in using the verified email account that owns this inquiry. Payment status is private and is never inferred from a client-side confirmation.</p><Button asChild><Link href={buildLoginReturnUrl(`/inquiry/${id}/success`)}>Sign in to view payment status</Link></Button><div className="flex justify-center gap-2"><Button variant="outline" onClick={() => { inquiryQuery.refetch(); paymentQuery.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button><Button variant="ghost" onClick={() => navigate(`/inquiry/${id}/review`)}>Return to review</Button></div></CardContent></Card></main></div>;
  return <div className="min-h-[100dvh] bg-background">
    <TopNavigation />
    <header className={`px-4 pb-10 pt-28 ${paid ? "bg-emerald-50/70" : rejected ? "bg-rose-50/70" : "bg-amber-50/70"}`}>
      <div className="mx-auto max-w-2xl text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${paid ? "bg-emerald-100 text-emerald-800" : rejected ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"}`}>
          {paid ? <CheckCircle2 className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">{paid ? "Payment verified" : rejected ? "Receipt needs attention" : pending ? "Receipt received" : "Payment not submitted"}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{paid ? "An OnSpot administrator independently confirmed settlement. Your payment is recorded as paid." : rejected ? "Your submitted receipt was rejected. Review the reason below and submit corrected evidence; the payment is not marked paid." : pending ? "Your receipt is pending an independent settlement check. Uploading proof does not mean the funds have been received." : "Use the payment instructions to make the transfer, then submit the reference and receipt."}</p>
        <Badge variant="outline" className={`mt-4 ${paid ? "border-emerald-300 bg-emerald-100 text-emerald-900" : rejected ? "border-rose-300 bg-rose-100 text-rose-900" : "border-amber-300 bg-amber-100 text-amber-950"}`}>{paid ? "Paid · verified" : rejected ? "Rejected · resubmission available" : pending ? "Pending verification" : "Awaiting payment"}</Badge>
      </div>
    </header>
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">Inquiry reference</p><p className="mt-1 font-mono font-semibold">{inquiry.referenceNumber || id}</p></div>
        <div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-medium">{inquiry.fullName || "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Service</p><p className="mt-1 font-medium">{inquiry.serviceNeeded || "—"}</p></div>
        {paymentQuery.data?.history?.[0]?.rejection_reason && <div className="sm:col-span-2"><p className="text-xs text-rose-700">Rejection reason</p><p className="mt-1 text-sm text-rose-900">{paymentQuery.data.history[0].rejection_reason}</p></div>}
      </CardContent></Card>
      <ManualWisePaymentPanel category="inquiry" id={id || ""} title="Payment status and receipt history" />
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => navigate("/")}><Home className="mr-2 h-4 w-4" />Back to home</Button><Button variant="outline" onClick={() => paymentQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh status</Button></div>
      <p className="text-center text-xs text-muted-foreground">Questions? Email <a className="underline underline-offset-2" href="mailto:hello@onspotglobal.com">hello@onspotglobal.com</a>.</p>
    </main>
  </div>;
}
