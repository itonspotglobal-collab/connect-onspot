import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { TermsContent, PrivacyContent, RefundContent } from "@/components/LegalPolicyContent";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
  User,
  Layers,
} from "lucide-react";

// ─── Validation ────────────────────────────────────────────────────────────────

const inquirySchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phoneNumber: z.string().optional(),
  company: z.string().optional(),
  serviceNeeded: z.string().min(3, "Please describe the service needed"),
  details: z.string().optional(),
  estimatedBudget: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v.replace(/[^0-9.]/g, "")) : undefined))
    .pipe(z.number().positive("Budget must be a positive number").optional()),
});

type InquiryFormValues = z.input<typeof inquirySchema>;

const SERVICES = [
  "Customer Support / BPO",
  "Virtual Assistant",
  "Technical Support",
  "Data Entry & Admin",
  "Software Development",
  "Digital Marketing",
  "Finance & Accounting",
  "HR & Recruitment",
  "Other",
];

const STEPS = [
  { n: 1, label: "Inquiry Details" },
  { n: 2, label: "Review & Endorse" },
  { n: 3, label: "Payment" },
  { n: 4, label: "Confirmation" },
];

// ─── Shared input className ────────────────────────────────────────────────────

const inputCls =
  "rounded-xl border-slate-200 bg-slate-50/70 focus-visible:ring-[#474ead]/40 focus-visible:border-[#474ead]/60 h-10 text-sm";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InquiryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);
  const [refundModal, setRefundModal] = useState(false);
  const [refundChecked, setRefundChecked] = useState(false);
  const pendingPayload = useRef<any>(null);

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      company: "",
      serviceNeeded: "",
      details: "",
      estimatedBudget: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inquiries", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: (data) => navigate(`/inquiry/${data.inquiry.id}/review`),
    onError: (err: Error) =>
      toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  function onSubmit(values: InquiryFormValues) {
    const payload: any = {
      fullName: values.fullName,
      email: values.email,
      phoneNumber: values.phoneNumber || undefined,
      company: values.company || undefined,
      serviceNeeded: values.serviceNeeded,
      details: values.details || undefined,
    };
    const budgetStr = form.getValues("estimatedBudget") as unknown as string;
    if (budgetStr) {
      const num = parseFloat(String(budgetStr).replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) payload.estimatedBudget = num;
    }
    // Store the payload and show the Refund Policy agreement modal
    pendingPayload.current = payload;
    setRefundChecked(false);
    setRefundModal(true);
  }

  function confirmAndSubmit() {
    if (!pendingPayload.current || !refundChecked) return;
    submitMutation.mutate({
      ...pendingPayload.current,
      refundPolicyAccepted: true,
      refundPolicyAcceptedAt: new Date().toISOString(),
    });
    setRefundModal(false);
  }

  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background:
          "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(139,92,246,0.09) 0%, rgba(224,218,255,0.18) 45%, transparent 70%), linear-gradient(to bottom, #F7F9FF 0%, #FAFBFF 40%, #FFFFFF 100%)",
      }}
    >
      <TopNavigation />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-2 pb-4 px-6 md:pt-3">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 80% 30%, rgba(99,102,241,0.05), transparent), radial-gradient(ellipse 50% 40% at 15% 60%, rgba(139,92,246,0.04), transparent)",
          }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <Badge className="mb-3 rounded-full bg-[#474ead]/10 px-4 py-1 text-[#474ead] border-0 text-xs font-medium">
            <FileText className="w-3 h-3 mr-1.5" />
            Service Inquiry
          </Badge>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl md:leading-[1.12]">
            Request Our Services
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 md:text-base max-w-xl mx-auto">
            Submit your inquiry and our team will review your requirements before
            recommending the most suitable solution for your business.
          </p>
        </div>
      </section>

      {/* ── Form + Stepper ────────────────────────────────────────────────── */}
      <section className="px-4 pb-10 sm:px-6">
        {/* max-w-6xl ≈ 1152 px — the target 1100–1200 px range */}
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/92 shadow-[0_16px_60px_rgba(71,78,173,0.09)] backdrop-blur-sm overflow-hidden">

            {/* ── Stepper — compact header row ── */}
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 sm:px-8">
              <div className="flex items-center gap-2 max-w-2xl">
                {STEPS.map((step, i) => (
                  <div key={step.n} className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        step.n === 1
                          ? "bg-[#474ead] text-white"
                          : "border border-slate-300 text-slate-400"
                      }`}
                    >
                      {step.n === 1 ? <CheckCircle2 className="w-3 h-3" /> : step.n}
                    </div>
                    <span
                      className={`text-[11px] font-medium truncate ${
                        step.n === 1 ? "text-[#474ead] font-semibold" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 h-px bg-slate-200 min-w-[8px]" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Form body ── */}
            <div className="p-5 sm:p-6 lg:p-8">
              <Form {...form}>
                <form onSubmit={(e) => e.preventDefault()} className="space-y-5">

                  {/* Contact Information */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#474ead]/10">
                        <User className="w-3 h-3 text-[#474ead]" />
                      </div>
                      <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Contact Information
                      </h2>
                    </div>

                    {/* 4-column grid on large screens, 2-col on tablet, 1-col on mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 text-sm">
                              Full Name <span className="text-[#5B45E8]">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Juan dela Cruz" className={inputCls} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 text-sm">
                              Email Address <span className="text-[#5B45E8]">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="you@company.com" type="email" className={inputCls} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 text-sm">Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 555 000 0000" className={inputCls} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 text-sm">Company / Organization</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Corp" className={inputCls} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100" />

                  {/* Service Details */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#474ead]/10">
                        <Layers className="w-3 h-3 text-[#474ead]" />
                      </div>
                      <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Service Details
                      </h2>
                    </div>

                    <div className="space-y-3">
                      {/* Service + Budget — 2 cols on desktop, full width each on mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="serviceNeeded"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 text-sm">
                                Service or Product Needed <span className="text-[#5B45E8]">*</span>
                              </FormLabel>
                              <FormControl>
                                <select
                                  {...field}
                                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#474ead]/40 focus:border-[#474ead]/60"
                                >
                                  <option value="">Select a service…</option>
                                  {SERVICES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="estimatedBudget"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 text-sm">
                                Estimated Budget (USD)
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                  <Input
                                    className={`pl-7 ${inputCls}`}
                                    placeholder="5,000"
                                    {...field}
                                    value={
                                      typeof field.value === "number"
                                        ? String(field.value)
                                        : (field.value ?? "")
                                    }
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Details — full width */}
                      <FormField
                        control={form.control}
                        name="details"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 text-sm">
                              Inquiry Details / Notes
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your requirements, timeline, team size, or any other relevant details…"
                                className="min-h-[88px] resize-y rounded-xl border-slate-200 bg-slate-50/70 focus-visible:ring-[#474ead]/40 focus-visible:border-[#474ead]/60 text-sm"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Submit row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-0">
                    <Button
                      type="button"
                      disabled={submitMutation.isPending}
                      onClick={() => form.handleSubmit(onSubmit)()}
                      className="sm:w-auto w-full bg-[#474ead] hover:bg-[#3d4399] text-white h-11 rounded-xl px-8 text-sm font-semibold shadow-[0_4px_24px_rgba(71,78,173,0.28)]"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        <>
                          Submit Inquiry
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-slate-400 sm:ml-1">
                      By submitting you agree to our{" "}
                      <button
                        type="button"
                        onClick={() => setLegalModal("terms")}
                        className="underline underline-offset-2 hover:text-[#474ead] transition-colors"
                      >
                        Terms of Service
                      </button>
                      {" "}and{" "}
                      <button
                        type="button"
                        onClick={() => setLegalModal("privacy")}
                        className="underline underline-offset-2 hover:text-[#474ead] transition-colors"
                      >
                        Privacy Policy
                      </button>.
                    </p>
                  </div>
                </form>
              </Form>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5">
            {[
              "No commitment required",
              "Response within 24 hours",
              "Tailored solutions only",
            ].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#474ead]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Refund Policy Agreement Modal ── */}
      <Dialog
        open={refundModal}
        onOpenChange={(open) => {
          if (!open) { setRefundModal(false); setRefundChecked(false); }
        }}
      >
        <DialogContent className="max-w-2xl w-full rounded-2xl p-0 overflow-hidden border border-slate-100 shadow-xl focus:outline-none">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 pr-12 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#474ead]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#474ead]" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900 leading-tight">
                  Refund Policy Agreement
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Please read and accept before submitting</p>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable policy content */}
          <div className="px-6 py-5 max-h-[52vh] overflow-y-auto">
            <RefundContent />
          </div>

          {/* Checkbox + footer */}
          <div className="px-6 pt-4 pb-5 border-t border-slate-100 bg-slate-50/60 space-y-4">
            {/* Required checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                id="refund-agree"
                checked={refundChecked}
                onCheckedChange={(v) => setRefundChecked(Boolean(v))}
                className="mt-0.5 flex-shrink-0 border-slate-300 data-[state=checked]:bg-[#474ead] data-[state=checked]:border-[#474ead]"
              />
              <span className="text-sm text-slate-700 leading-5 select-none group-hover:text-slate-900 transition-colors">
                I have read and agree to the Refund Policy.
              </span>
            </label>

            {/* Action buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="w-full sm:w-auto text-slate-500">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                size="sm"
                disabled={!refundChecked || submitMutation.isPending}
                onClick={confirmAndSubmit}
                className="w-full sm:w-auto bg-[#474ead] hover:bg-[#3d4399] text-white rounded-lg px-5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Agree and Continue"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Terms / Privacy Modals ── */}
      <Dialog open={legalModal !== null} onOpenChange={(open) => { if (!open) setLegalModal(null); }}>
        <DialogContent className="max-w-2xl w-full rounded-2xl p-0 overflow-hidden border border-slate-100 shadow-xl focus:outline-none">
          {/* Header — the built-in DialogContent X button sits at absolute top-4 right-4 */}
          <DialogHeader className="px-6 pt-5 pb-4 pr-12 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#474ead]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#474ead]" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900 leading-tight">
                  {legalModal === "terms" ? "Terms of Service" : "Privacy Policy"}
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Last Updated: June 30, 2026</p>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
            {legalModal === "terms" ? <TermsContent /> : <PrivacyContent />}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="w-full sm:w-auto text-slate-500">
                Close
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                size="sm"
                className="w-full sm:w-auto bg-[#474ead] hover:bg-[#3d4399] text-white rounded-lg px-5"
              >
                I Understand
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
