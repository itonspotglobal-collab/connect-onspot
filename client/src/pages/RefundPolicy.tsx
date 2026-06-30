// LEGAL NOTICE: This is a draft website policy for OnSpot.
// It should be reviewed and approved by qualified legal counsel before use in production.

import { TopNavigation } from "@/components/TopNavigation";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { RotateCcw, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

const LAST_UPDATED = "June 30, 2026";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TopNavigation />

      {/* Hero */}
      <section
        className="relative pt-10 pb-8 px-6"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(139,92,246,0.08), transparent 65%), linear-gradient(to bottom, #F7F9FF, #FFFFFF 70%)",
        }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-3 rounded-full bg-[#474ead]/10 px-4 py-1 text-[#474ead] border-0 text-xs font-medium">
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Legal
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Refund Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last Updated: <time dateTime="2026-06-30">{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-7 sm:p-10 space-y-8">

          {/* Intro */}
          <p className="text-base leading-7 text-slate-600">
            This Refund Policy explains how refund requests are handled for payments made through
            the OnSpot website, inquiry flow, or approved payment channels.
          </p>

          <div className="h-px bg-slate-100" />

          {/* 1. General */}
          <Section n={1} title="General Policy">
            <p className="text-sm leading-7 text-slate-600">
              OnSpot values transparency and fairness. Refund eligibility depends on the type of
              service requested, the status of the inquiry, the stage of work completed, and the
              terms agreed between the client and OnSpot. Submitting a refund request does not
              automatically guarantee approval. Each request will be reviewed carefully by the
              OnSpot team.
            </p>
          </Section>

          {/* 2. Payments Made */}
          <Section n={2} title="Payments Made Through the Website">
            <p className="text-sm leading-7 text-slate-600">
              If you make a payment through the OnSpot website, the payment may be linked to a
              service inquiry, endorsed request, proposal, invoice, or approved engagement. Please
              review all details carefully before completing payment.
            </p>
          </Section>

          {/* 3. Eligible situations */}
          <Section n={3} title="Eligible Refund Situations">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              A refund may be considered in the following cases:
            </p>
            <ul className="space-y-2">
              {[
                "Duplicate payment was made accidentally.",
                "Payment was made for an inquiry that OnSpot later declined or could not fulfill.",
                "Payment amount was incorrect due to a verified system or billing error.",
                "The service has not yet started and the refund request is submitted within a reasonable review period.",
                "A refund is required under a written agreement between the client and OnSpot.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 4. Non-refundable */}
          <Section n={4} title="Non-Refundable Situations">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              Refunds may not be available in the following cases:
            </p>
            <ul className="space-y-2">
              {[
                "Work has already started or resources have already been allocated.",
                "The service has already been delivered, completed, or substantially performed.",
                "The client changes their mind after approval, scheduling, onboarding, or service preparation has begun.",
                "The client provided incorrect, incomplete, or misleading information.",
                "The payment relates to administrative, onboarding, processing, or setup work that has already been completed.",
                "The request is outside the agreed refund window or written service agreement.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 5. Partial */}
          <Section n={5} title="Partial Refunds">
            <p className="text-sm leading-7 text-slate-600">
              In some cases, OnSpot may approve a partial refund. Partial refunds may apply when a
              portion of the service has already been completed, resources have been assigned, or
              administrative costs have already been incurred.
            </p>
          </Section>

          {/* 6. Review process */}
          <Section n={6} title="Refund Review Process">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              To request a refund, the client must contact OnSpot using the official communication
              channels and provide:
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside pl-1">
              {[
                "Full name or company name",
                "Email address used for the inquiry",
                "Inquiry reference number",
                "Payment reference or transaction ID",
                "Payment amount",
                "Reason for the refund request",
                "Any supporting information",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm leading-7 text-slate-600 mt-3">
              OnSpot will review the request and may contact the client for clarification.
            </p>
          </Section>

          {/* 7. Processing time */}
          <Section n={7} title="Processing Time">
            <p className="text-sm leading-7 text-slate-600">
              Approved refunds will be processed through the original payment method whenever
              possible. Processing times may vary depending on the payment provider, bank, card
              issuer, or third-party platform. OnSpot is not responsible for delays caused by
              banks, card networks, or third-party payment processors.
            </p>
          </Section>

          {/* 8. Fees */}
          <Section n={8} title="Payment Processor Fees">
            <p className="text-sm leading-7 text-slate-600">
              Certain payment processor, bank, or transaction fees may be non-refundable depending
              on the policies of the third-party payment provider.
            </p>
          </Section>

          {/* 9. Cancellations */}
          <Section n={9} title="Cancellations">
            <p className="text-sm leading-7 text-slate-600">
              If a client wishes to cancel a service request before work begins, they should contact
              OnSpot as soon as possible. Cancellation eligibility and refund treatment will depend
              on the status of the inquiry, endorsement, payment, and service preparation.
            </p>
          </Section>

          {/* 10. Contact */}
          <Section n={10} title="Contact Us">
            <p className="text-sm leading-7 text-slate-600">
              For refund questions or requests, please contact OnSpot through the official contact
              channels provided on our website.
            </p>
          </Section>

          <div className="h-px bg-slate-100" />

          {/* Navigation */}
          <div className="flex flex-wrap gap-4 items-center justify-between pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[#474ead] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Link>
            <div className="flex gap-4 text-sm text-slate-500">
              <Link href="/terms-and-conditions" className="hover:text-[#474ead] transition-colors">Terms &amp; Conditions</Link>
              <Link href="/privacy-policy" className="hover:text-[#474ead] transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${n}`}>
      <h2
        id={`section-${n}`}
        className="flex items-baseline gap-3 text-base font-semibold text-[#3F4698] mb-3"
      >
        <span className="flex-shrink-0 tabular-nums text-[#3F4698]/50 text-sm font-medium">
          {String(n).padStart(2, "0")}.
        </span>
        {title}
      </h2>
      <div className="pl-7">{children}</div>
    </section>
  );
}
