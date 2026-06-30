// LEGAL NOTICE: This is a draft website policy for OnSpot.
// It should be reviewed and approved by qualified legal counsel before use in production.

import { TopNavigation } from "@/components/TopNavigation";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const LAST_UPDATED = "June 30, 2026";

export default function PrivacyPolicy() {
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
            <ShieldCheck className="w-3 h-3 mr-1.5" />
            Legal
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Privacy Policy
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
            OnSpot respects your privacy and is committed to protecting the personal information you
            share with us. This Privacy Policy explains how we collect, use, store, and protect
            information when you visit our website, submit an inquiry, use our payment flow,
            communicate with us, or access our services.
          </p>

          <div className="h-px bg-slate-100" />

          {/* 1. Information we collect */}
          <Section n={1} title="Information We Collect">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              We may collect information that you voluntarily provide through our website, inquiry
              forms, payment forms, contact forms, portal access, email communication, or other
              interactions with OnSpot. This may include:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600 list-disc list-inside">
              {[
                "Full name",
                "Email address",
                "Phone number",
                "Company or organization name",
                "Job title or business role",
                "Service or product interest",
                "Inquiry details or notes",
                "Estimated budget",
                "Billing information",
                "Payment status and transaction references",
                "Communication history",
                "Any additional information you choose to provide",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          {/* 2. Payment information */}
          <Section n={2} title="Payment Information">
            <p className="text-sm leading-7 text-slate-600">
              When you make a payment, your payment may be processed by a third-party payment
              provider. OnSpot may receive limited payment-related information such as payment
              status, transaction reference, amount paid, payment method type, and billing contact
              details. OnSpot does not intentionally store full credit card numbers or sensitive
              card authentication details unless clearly stated and handled through a compliant
              payment provider.
            </p>
          </Section>

          {/* 3. Automatically collected */}
          <Section n={3} title="Information Collected Automatically">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              When you visit the website, certain technical information may be collected
              automatically, such as:
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside pl-1">
              {[
                "IP address",
                "Browser type",
                "Device information",
                "Pages visited",
                "Referring website",
                "Date and time of visit",
                "General usage activity",
                "Cookies or similar technologies",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm leading-7 text-slate-600 mt-3">
              This information helps us improve website performance, security, user experience, and
              analytics.
            </p>
          </Section>

          {/* 4. How we use */}
          <Section n={4} title="How We Use Your Information">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              OnSpot may use collected information to:
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside pl-1">
              {[
                "Review and respond to inquiries",
                "Evaluate service requirements",
                "Endorse, approve, or process service requests",
                "Provide quotes, proposals, or recommendations",
                "Process payments and issue confirmations",
                "Manage client communication",
                "Improve website functionality and user experience",
                "Maintain internal records",
                "Prevent fraud, misuse, or unauthorized activity",
                "Comply with legal, regulatory, or contractual obligations",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          {/* 5. Inquiry data */}
          <Section n={5} title="Inquiry and Admin Dashboard Data">
            <p className="text-sm leading-7 text-slate-600">
              Information submitted through the inquiry flow may be stored in OnSpot's internal
              systems or database so the team can review submissions, track endorsement status,
              monitor payment status, manage service requests, and provide support.
            </p>
          </Section>

          {/* 6. Sharing */}
          <Section n={6} title="Sharing of Information">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              OnSpot does not sell your personal information. We may share information only when
              necessary with:
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside pl-1">
              {[
                "Authorized OnSpot team members",
                "Service providers that help operate our website or systems",
                "Payment processors",
                "Technology, hosting, analytics, or security providers",
                "Legal, regulatory, or compliance authorities when required",
                "Business partners or professionals involved in fulfilling your request, when appropriate",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          {/* 7. Third-party */}
          <Section n={7} title="Third-Party Services">
            <p className="text-sm leading-7 text-slate-600">
              Our website may use third-party platforms for payment processing, analytics, hosting,
              communication, customer support, or other business functions. These third parties may
              process information according to their own privacy policies and security practices.
            </p>
          </Section>

          {/* 8. Cookies */}
          <Section n={8} title="Cookies and Tracking Technologies">
            <p className="text-sm leading-7 text-slate-600">
              The website may use cookies or similar technologies to improve functionality, analyze
              traffic, remember preferences, and enhance user experience. You may adjust cookie
              settings through your browser, but some website features may not function properly if
              cookies are disabled.
            </p>
          </Section>

          {/* 9. Security */}
          <Section n={9} title="Data Security">
            <p className="text-sm leading-7 text-slate-600">
              OnSpot uses reasonable administrative, technical, and organizational measures to
              protect personal information. However, no website, database, payment system, or
              internet transmission is completely secure. Users are encouraged to avoid submitting
              unnecessary sensitive information through website forms.
            </p>
          </Section>

          {/* 10. Retention */}
          <Section n={10} title="Data Retention">
            <p className="text-sm leading-7 text-slate-600">
              OnSpot retains information for as long as necessary to fulfill the purposes described
              in this Privacy Policy, including inquiry management, payment records, service
              delivery, legal compliance, dispute resolution, and business recordkeeping.
            </p>
          </Section>

          {/* 11. Rights */}
          <Section n={11} title="Your Rights and Choices">
            <p className="text-sm leading-7 text-slate-600 mb-3">
              Depending on your location and applicable law, you may have the right to:
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside pl-1">
              {[
                "Request access to your personal information",
                "Request correction of inaccurate information",
                "Request deletion of certain information",
                "Object to certain processing activities",
                "Withdraw consent where applicable",
                "Request information about how your data is used",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm leading-7 text-slate-600 mt-3">
              To exercise these rights, please contact OnSpot through the official contact channels
              provided on the website.
            </p>
          </Section>

          {/* 12. Children */}
          <Section n={12} title="Children's Privacy">
            <p className="text-sm leading-7 text-slate-600">
              The OnSpot website and services are intended for business and professional users. We
              do not knowingly collect personal information from children.
            </p>
          </Section>

          {/* 13. International */}
          <Section n={13} title="International Users">
            <p className="text-sm leading-7 text-slate-600">
              If you access the website from outside the country where OnSpot or its service
              providers operate, your information may be processed in locations with different data
              protection laws. By using the website, you understand that information may be
              transferred and processed as necessary to provide services.
            </p>
          </Section>

          {/* 14. Updates */}
          <Section n={14} title="Updates to This Privacy Policy">
            <p className="text-sm leading-7 text-slate-600">
              OnSpot may update this Privacy Policy from time to time. Any updates will be posted
              on this page with a revised "Last Updated" date.
            </p>
          </Section>

          {/* 15. Contact */}
          <Section n={15} title="Contact Us">
            <p className="text-sm leading-7 text-slate-600">
              If you have questions about this Privacy Policy or how your information is handled,
              please contact OnSpot through the official contact channels provided on our website.
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
              <Link href="/refund-policy" className="hover:text-[#474ead] transition-colors">Refund Policy</Link>
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
