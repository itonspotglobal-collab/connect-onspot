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
    submitMutation.mutate(payload);
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
      <section className="relative overflow-hidden pt-4 pb-6 px-6 md:pt-8">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 80% 30%, rgba(99,102,241,0.05), transparent), radial-gradient(ellipse 50% 40% at 15% 60%, rgba(139,92,246,0.04), transparent)",
          }}
        />

        <div className="relative mx-auto max-w-3xl text-center pb-2">
          <Badge className="mb-5 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] border-0 text-sm font-medium">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Service Inquiry
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl md:leading-[1.1]">
            Request Our Services
          </h1>

          <p className="mt-4 text-base leading-7 text-slate-500 md:text-lg max-w-2xl mx-auto">
            Submit your inquiry and our team will review your requirements before
            recommending the most suitable solution for your business.
          </p>
        </div>
      </section>

      {/* ── Form + Stepper ────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6">
        {/* max-w-6xl ≈ 1152 px — the target 1100–1200 px range */}
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/92 shadow-[0_24px_80px_rgba(71,78,173,0.11)] backdrop-blur-sm overflow-hidden">

            {/* ── Stepper — inside the card, at the top ── */}
            <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:px-10">
              <div className="flex items-center gap-2 max-w-2xl">
                {STEPS.map((step, i) => (
                  <div key={step.n} className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        step.n === 1
                          ? "bg-[#474ead] text-white"
                          : "border border-slate-300 text-slate-400"
                      }`}
                    >
                      {step.n === 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.n}
                    </div>
                    <span
                      className={`text-xs font-medium truncate ${
                        step.n === 1 ? "text-[#474ead] font-semibold" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 h-px bg-slate-200 min-w-[12px]" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Form body ── */}
            <div className="p-6 sm:p-10">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                  {/* Contact Information */}
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#474ead]/10">
                        <User className="w-3.5 h-3.5 text-[#474ead]" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-700">
                        Contact Information
                      </h2>
                    </div>

                    {/* 4-column grid on large screens, 2-col on tablet, 1-col on mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <div className="flex items-center gap-2 mb-5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#474ead]/10">
                        <Layers className="w-3.5 h-3.5 text-[#474ead]" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-700">
                        Service Details
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {/* Service + Budget — 2 cols on desktop, full width each on mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                className="min-h-[120px] resize-y rounded-xl border-slate-200 bg-slate-50/70 focus-visible:ring-[#474ead]/40 focus-visible:border-[#474ead]/60 text-sm"
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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
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
                      <span className="underline underline-offset-2 cursor-pointer">Terms of Service</span>
                      {" "}and{" "}
                      <span className="underline underline-offset-2 cursor-pointer">Privacy Policy</span>.
                    </p>
                  </div>
                </form>
              </Form>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
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
    </div>
  );
}
