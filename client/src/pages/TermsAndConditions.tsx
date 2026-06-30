// LEGAL NOTICE: This is a draft website policy for OnSpot.
// It should be reviewed and approved by qualified legal counsel before use in production.

import { TopNavigation } from "@/components/TopNavigation";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Scale, ArrowLeft } from "lucide-react";

const LAST_UPDATED = "June 30, 2026";

const sections = [
  {
    n: 1,
    title: "About OnSpot",
    body: "OnSpot provides business support, remote talent, outsourcing, staffing, and related service solutions designed to help companies connect with qualified professionals and operational support. Our website allows users to explore services, submit inquiries, request assistance, and, where available, complete payments online.",
  },
  {
    n: 2,
    title: "Use of the Website",
    body: "You agree to use the OnSpot website only for lawful and appropriate purposes. You must not misuse the website, interfere with its functionality, attempt unauthorized access, submit false information, or use the website in a way that could harm OnSpot, its users, clients, partners, or systems.",
  },
  {
    n: 3,
    title: "Inquiry Submissions",
    body: "When you submit an inquiry through our website, you agree to provide accurate and complete information. Submission of an inquiry does not automatically create a service agreement, employment relationship, partnership, or guaranteed engagement with OnSpot. All inquiries are subject to review, validation, endorsement, and approval by the OnSpot team.",
  },
  {
    n: 4,
    title: "Endorsement and Approval",
    body: "Some service requests may require internal review or endorsement before payment or service fulfillment can proceed. OnSpot reserves the right to approve, reject, request clarification, or modify the scope of an inquiry based on business requirements, service availability, compliance considerations, or operational capacity.",
  },
  {
    n: 5,
    title: "Service Scope",
    body: "The final scope of service, pricing, timeline, deliverables, and responsibilities may be confirmed through a written agreement, proposal, invoice, email confirmation, or approved service arrangement. Any information displayed on the website is for general guidance and may not represent a final binding offer.",
  },
  {
    n: 6,
    title: "Payments",
    body: "Where online payments are available, payments may be processed in United States Dollars (USD). Payment must be completed through the approved payment method shown on the website or communicated by OnSpot. By making a payment, you confirm that you are authorized to use the selected payment method and that the billing information provided is accurate.",
  },
  {
    n: 7,
    title: "Payment Processing",
    body: "Payments may be processed through third-party payment providers such as Stripe, PayPal, bank transfer, or another authorized payment platform. OnSpot does not store complete credit card details on its servers unless expressly stated. Payment processing is subject to the terms, security policies, and privacy practices of the applicable payment provider.",
  },
  {
    n: 8,
    title: "Pricing and Currency",
    body: "Unless otherwise stated, prices, estimates, invoices, and payments related to the website inquiry flow may be presented in USD. Prices may vary depending on service requirements, scope, complexity, timeline, and other business factors.",
  },
  {
    n: 9,
    title: "Account, Portal, or System Access",
    body: "If OnSpot provides access to a portal, dashboard, account, or internal system, you are responsible for maintaining the confidentiality of your login credentials. You agree to notify OnSpot immediately if you believe your access has been compromised.",
  },
  {
    n: 10,
    title: "Intellectual Property",
    body: "All content on the OnSpot website, including text, graphics, logos, design elements, branding, software, icons, images, layouts, and other materials, is owned by or licensed to OnSpot unless otherwise stated. You may not copy, reproduce, modify, distribute, or use OnSpot materials without prior written permission.",
  },
  {
    n: 11,
    title: "User-Provided Information",
    body: "You retain responsibility for the information, documents, and materials you submit to OnSpot. By submitting information, you grant OnSpot permission to review, process, store, and use that information for purposes related to your inquiry, service request, payment, communication, and business relationship.",
  },
  {
    n: 12,
    title: "No Guarantee of Results",
    body: "While OnSpot aims to provide high-quality support and service recommendations, we do not guarantee specific business outcomes, hiring results, financial results, operational improvements, or uninterrupted service unless expressly agreed in writing.",
  },
  {
    n: 13,
    title: "Third-Party Links and Services",
    body: "The website may contain links to third-party websites, tools, platforms, or payment processors. OnSpot is not responsible for the content, security, privacy practices, or availability of third-party services.",
  },
  {
    n: 14,
    title: "Limitation of Liability",
    body: "To the fullest extent permitted by law, OnSpot shall not be liable for indirect, incidental, consequential, special, punitive, or exemplary damages arising from your use of the website, inquiry process, payment features, or services.",
  },
  {
    n: 15,
    title: "Changes to the Website or Terms",
    body: 'OnSpot may update the website, services, features, pricing, or these Terms from time to time. Updated Terms will be posted on this page with a revised "Last Updated" date. Continued use of the website means you accept the updated Terms.',
  },
  {
    n: 16,
    title: "Contact Us",
    body: "If you have questions about these Terms and Conditions, please contact OnSpot through the official contact channels provided on our website.",
  },
];

export default function TermsAndConditions() {
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
            <Scale className="w-3 h-3 mr-1.5" />
            Legal
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Terms and Conditions
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last Updated: <time dateTime="2026-06-30">{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      {/* Intro */}
      <main className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-7 sm:p-10 space-y-8">

          <p className="text-base leading-7 text-slate-600">
            Welcome to OnSpot. These Terms and Conditions govern your access to and use of the
            OnSpot website, inquiry forms, service request process, payment features, and related
            online services. By using our website or submitting an inquiry, you agree to these Terms.
          </p>

          <div className="h-px bg-slate-100" />

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.n} aria-labelledby={`section-${s.n}`}>
                <h2
                  id={`section-${s.n}`}
                  className="flex items-baseline gap-3 text-base font-semibold text-[#3F4698] mb-2"
                >
                  <span className="flex-shrink-0 tabular-nums text-[#3F4698]/50 text-sm font-medium">
                    {String(s.n).padStart(2, "0")}.
                  </span>
                  {s.title}
                </h2>
                <p className="text-sm leading-7 text-slate-600 pl-7">{s.body}</p>
              </section>
            ))}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Back link */}
          <div className="flex flex-wrap gap-4 items-center justify-between pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[#474ead] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Link>
            <div className="flex gap-4 text-sm text-slate-500">
              <Link href="/privacy-policy" className="hover:text-[#474ead] transition-colors">Privacy Policy</Link>
              <Link href="/refund-policy" className="hover:text-[#474ead] transition-colors">Refund Policy</Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
