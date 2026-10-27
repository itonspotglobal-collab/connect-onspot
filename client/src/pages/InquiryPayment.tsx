import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { buildLoginReturnUrl } from "@/lib/returnTo";

function amount(value: string | number | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number) : "—";
}

export default function InquiryPayment() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const inquiryQuery = useQuery<{ inquiry: any }>({
    queryKey: ["/api/inquiries", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/inquiries/${id}`);
      return response.json();
    },
  });
  const inquiry = inquiryQuery.data?.inquiry;
  if (inquiryQuery.isLoading) return <div className="min-h-[100dvh] bg-background"><TopNavigation /><div className="mx-auto max-w-3xl space-y-4 px-4 pt-32"><div className="h-8 w-1/2 animate-pulse rounded bg-muted" /><div className="h-56 animate-pulse rounded-xl bg-muted" /></div></div>;
  if (inquiryQuery.isError || !inquiry) return <div className="min-h-[100dvh] bg-background"><TopNavigation /><main className="mx-auto max-w-xl px-4 pt-32"><Card><CardContent className="space-y-4 p-6 text-center"><h1 className="text-xl font-semibold">Inquiry unavailable</h1><p className="text-sm text-muted-foreground">Sign in using the verified email account that owns this inquiry. Payment details are only available to that account.</p><Button asChild><Link href={buildLoginReturnUrl(`/inquiry/${id}/payment`)}>Sign in to continue</Link></Button><Button variant="outline" onClick={() => navigate(`/inquiry/${id}/review`)}><ArrowLeft className="mr-2 h-4 w-4" />Back to inquiry review</Button><Button variant="ghost" onClick={() => inquiryQuery.refetch()}>Retry inquiry</Button></CardContent></Card></main></div>;
  if (["pending_endorsement", "rejected"].includes(inquiry.status)) return <div className="min-h-[100dvh] bg-background"><TopNavigation /><main className="mx-auto max-w-xl px-4 pt-32 text-center"><p className="mb-4 text-muted-foreground">This inquiry has not been endorsed yet.</p><Button variant="outline" onClick={() => navigate(`/inquiry/${id}/review`)}><ArrowLeft className="mr-2 h-4 w-4" />Back to Review</Button></main></div>;
  return <div className="min-h-[100dvh] bg-background">
    <TopNavigation />
    <header className="border-b bg-primary/[0.035] px-4 pb-8 pt-28">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> Endorsed inquiry</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Complete your payment</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Send funds externally using the confirmed instructions, then submit your Wise transfer reference and receipt for independent review.</p>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-card p-3 text-xs sm:text-sm">
        {["Inquiry details", "Review & endorse", "Payment", "Confirmation"].map((step, index) => <div key={step} className={`flex shrink-0 items-center gap-2 ${index === 2 ? "font-semibold text-primary" : "text-muted-foreground"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${index < 2 ? "bg-emerald-100 text-emerald-800" : index === 2 ? "bg-primary text-primary-foreground" : "border"}`}>{index < 2 ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>{step}</div>)}
      </div>
      <Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">Inquiry reference</p><p className="mt-1 font-mono font-semibold">{inquiry.referenceNumber || id}</p></div>
        <div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-medium">{inquiry.fullName || "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Service</p><p className="mt-1 font-medium">{inquiry.serviceNeeded || "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Original estimate</p><p className="mt-1 text-lg font-semibold">{amount(inquiry.estimatedBudget)}</p></div>
      </CardContent></Card>
       <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
         <div><p className="font-semibold">Continue to payment</p><p className="mt-1 max-w-lg text-sm text-muted-foreground">Review the authorized amount and transfer instructions, then submit your receipt for independent settlement review.</p></div>
         <Button asChild className="min-h-11 shrink-0"><Link href={`/client/payments/inquiry/${encodeURIComponent(id || "")}`}>Open secure checkout</Link></Button>
       </CardContent></Card>
      <div className="flex justify-start"><Button variant="ghost" onClick={() => navigate(`/inquiry/${id}/review`)}><ArrowLeft className="mr-2 h-4 w-4" />Back to review</Button></div>
    </main>
  </div>;
}
