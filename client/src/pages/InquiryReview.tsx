import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  FileText,
  User,
  Mail,
  Phone,
  Building2,
  DollarSign,
  Layers,
} from "lucide-react";

function formatUSD(val: string | number | null | undefined) {
  if (!val) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "endorsed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Endorsed
      </Badge>
    );
  }
  if (status === "paid") {
    return (
      <Badge className="bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1 text-xs font-semibold gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Paid
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-semibold gap-1.5">
      <Clock className="w-3.5 h-3.5" />
      Pending Endorsement
    </Badge>
  );
}

export default function InquiryReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ inquiry: any }>({
    queryKey: ["/api/inquiries", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/inquiries/${id}`);
      if (!res.ok) throw new Error("Inquiry not found");
      return res.json();
    },
  });

  const endorseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/inquiries/${id}/endorse`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Endorsement failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries", id] });
      toast({ title: "Inquiry endorsed", description: "You can now proceed to payment." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const inquiry = data?.inquiry;

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

  if (error || !inquiry) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="flex flex-col items-center justify-center pt-40 gap-4 text-center px-4">
          <p className="text-slate-500">Inquiry not found or could not be loaded.</p>
          <Button onClick={() => navigate("/inquiry")} variant="outline">
            Submit a new inquiry
          </Button>
        </div>
      </div>
    );
  }

  const isEndorsed = inquiry.status === "endorsed" || inquiry.status === "paid";

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#3F4698]/8 via-background to-[#5B45E8]/5 pt-28 pb-14 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700 mb-6">
            <FileText className="w-3.5 h-3.5" />
            Inquiry Review
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            Inquiry Received
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            Your inquiry has been received and is now pending endorsement.
          </p>
        </div>
      </section>

      {/* Steps */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Inquiry Details
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2 font-semibold text-[#3F4698]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3F4698] text-white text-[11px] font-bold">2</span>
            Review &amp; Endorse
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold">3</span>
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
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Status banner */}
          <Card className={`border-0 ${isEndorsed ? "bg-emerald-50" : "bg-amber-50"}`}>
            <CardContent className="flex items-center justify-between gap-4 p-5 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Status</p>
                <StatusBadge status={inquiry.status} />
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-0.5">Reference</p>
                <p className="font-mono font-semibold text-slate-800 text-sm">{inquiry.referenceNumber}</p>
              </div>
            </CardContent>
          </Card>

          {/* Summary card */}
          <Card className="shadow-sm">
            <CardContent className="p-7 space-y-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Inquiry Summary</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Full Name</p>
                    <p className="text-sm font-medium text-slate-800">{inquiry.fullName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Email</p>
                    <p className="text-sm font-medium text-slate-800">{inquiry.email}</p>
                  </div>
                </div>
                {inquiry.phoneNumber && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                      <p className="text-sm font-medium text-slate-800">{inquiry.phoneNumber}</p>
                    </div>
                  </div>
                )}
                {inquiry.company && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Company</p>
                      <p className="text-sm font-medium text-slate-800">{inquiry.company}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Layers className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Service Needed</p>
                    <p className="text-sm font-medium text-slate-800">{inquiry.serviceNeeded}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Estimated Budget</p>
                    <p className="text-sm font-medium text-slate-800">{formatUSD(inquiry.estimatedBudget)}</p>
                  </div>
                </div>
              </div>

              {inquiry.details && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400 mb-1.5">Notes / Details</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{inquiry.details}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!isEndorsed && (
              <Button
                onClick={() => endorseMutation.mutate()}
                disabled={endorseMutation.isPending}
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                {endorseMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Endorsing…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Approve / Endorse Inquiry</>
                )}
              </Button>
            )}

            {isEndorsed && (
              <Button
                onClick={() => navigate(`/inquiry/${id}/payment`)}
                className="bg-[#5B45E8] hover:bg-[#4f3ad4] text-white"
              >
                Proceed to Payment
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
