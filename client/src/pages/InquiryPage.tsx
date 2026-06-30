import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { FileText, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

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
    onSuccess: (data) => {
      navigate(`/inquiry/${data.inquiry.id}/review`);
    },
    onError: (err: Error) => {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      });
    },
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
    const budgetStr = (form.getValues("estimatedBudget") as unknown as string);
    if (budgetStr) {
      const num = parseFloat(String(budgetStr).replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) payload.estimatedBudget = num;
    }
    submitMutation.mutate(payload);
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#3F4698]/8 via-background to-[#5B45E8]/5 pt-28 pb-14 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700 mb-6">
            <FileText className="w-3.5 h-3.5" />
            Service Inquiry
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            Submit an Inquiry
          </h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-lg mx-auto">
            Tell us what you need. We'll review your inquiry and connect you with the right team.
          </p>
        </div>
      </section>

      {/* Steps indicator */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-[#3F4698]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3F4698] text-white text-[11px] font-bold">1</span>
            Inquiry Details
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold">2</span>
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

      {/* Form */}
      <section className="py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-sm">
            <CardContent className="p-7 sm:p-9">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Contact */}
                  <div>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Contact Information</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Juan dela Cruz" {...field} />
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
                            <FormLabel>Email Address <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="you@company.com" type="email" {...field} />
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
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 555 000 0000" {...field} />
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
                            <FormLabel>Company / Organization</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Corp" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Service Details</h2>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="serviceNeeded"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service or Product Needed <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                        name="details"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inquiry Details / Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your requirements, timeline, team size, or any other relevant details…"
                                className="min-h-[120px] resize-y"
                                {...field}
                              />
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
                            <FormLabel>Estimated Budget (USD)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input
                                  className="pl-7"
                                  placeholder="5,000"
                                  {...field}
                                  value={typeof field.value === "number" ? String(field.value) : (field.value ?? "")}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full bg-[#3F4698] hover:bg-[#474ead] text-white h-11"
                      size="default"
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
                    <p className="text-center text-xs text-slate-400 mt-3">
                      By submitting you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
