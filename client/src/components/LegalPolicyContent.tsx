// Shared legal policy content used by both the modal (InquiryPage) and the
// standalone legal pages (/terms-and-conditions, /privacy-policy).
// LEGAL NOTICE: Draft policies — review with legal counsel before production use.

import { CheckCircle2, XCircle } from "lucide-react";

// ─── Shared section renderer ────────────────────────────────────────────────

function PolicySection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`policy-section-${n}`} className="space-y-2">
      <h3
        id={`policy-section-${n}`}
        className="flex items-baseline gap-2.5 text-sm font-semibold text-[#3F4698]"
      >
        <span className="tabular-nums text-[#3F4698]/50 text-xs font-medium flex-shrink-0">
          {String(n).padStart(2, "0")}.
        </span>
        {title}
      </h3>
      <div className="pl-6 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-slate-100" />;
}

// ─── Terms and Conditions ────────────────────────────────────────────────────

const termsSections = [
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

export function TermsContent() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        Welcome to OnSpot. These Terms and Conditions govern your access to and use of the OnSpot
        website, inquiry forms, service request process, payment features, and related online
        services. By using our website or submitting an inquiry, you agree to these Terms.
      </p>
      <Divider />
      {termsSections.map((s) => (
        <PolicySection key={s.n} n={s.n} title={s.title}>
          <p>{s.body}</p>
        </PolicySection>
      ))}
    </div>
  );
}

// ─── Privacy Policy ─────────────────────────────────────────────────────────

export function PrivacyContent() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        OnSpot respects your privacy and is committed to protecting the personal information you
        share with us. This Privacy Policy explains how we collect, use, store, and protect
        information when you visit our website, submit an inquiry, use our payment flow,
        communicate with us, or access our services.
      </p>
      <Divider />

      <PolicySection n={1} title="Information We Collect">
        <p className="mb-2">
          We may collect information that you voluntarily provide through our website, inquiry
          forms, payment forms, contact forms, portal access, email communication, or other
          interactions with OnSpot. This may include:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside">
          {[
            "Full name", "Email address", "Phone number", "Company or organization name",
            "Job title or business role", "Service or product interest", "Inquiry details or notes",
            "Estimated budget", "Billing information", "Payment status and transaction references",
            "Communication history", "Any additional information you choose to provide",
          ].map((i) => <li key={i}>{i}</li>)}
        </ul>
      </PolicySection>

      <PolicySection n={2} title="Payment Information">
        <p>
          When you make a payment, your payment may be processed by a third-party payment provider.
          OnSpot may receive limited payment-related information such as payment status, transaction
          reference, amount paid, payment method type, and billing contact details. OnSpot does not
          intentionally store full credit card numbers or sensitive card authentication details
          unless clearly stated and handled through a compliant payment provider.
        </p>
      </PolicySection>

      <PolicySection n={3} title="Information Collected Automatically">
        <p className="mb-2">
          When you visit the website, certain technical information may be collected automatically,
          such as:
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          {["IP address","Browser type","Device information","Pages visited","Referring website","Date and time of visit","General usage activity","Cookies or similar technologies"].map((i) => <li key={i}>{i}</li>)}
        </ul>
        <p className="mt-2">
          This information helps us improve website performance, security, user experience, and analytics.
        </p>
      </PolicySection>

      <PolicySection n={4} title="How We Use Your Information">
        <p className="mb-2">OnSpot may use collected information to:</p>
        <ul className="list-disc list-inside space-y-0.5">
          {[
            "Review and respond to inquiries","Evaluate service requirements",
            "Endorse, approve, or process service requests","Provide quotes, proposals, or recommendations",
            "Process payments and issue confirmations","Manage client communication",
            "Improve website functionality and user experience","Maintain internal records",
            "Prevent fraud, misuse, or unauthorized activity",
            "Comply with legal, regulatory, or contractual obligations",
          ].map((i) => <li key={i}>{i}</li>)}
        </ul>
      </PolicySection>

      <PolicySection n={5} title="Inquiry and Admin Dashboard Data">
        <p>
          Information submitted through the inquiry flow may be stored in OnSpot's internal systems
          or database so the team can review submissions, track endorsement status, monitor payment
          status, manage service requests, and provide support.
        </p>
      </PolicySection>

      <PolicySection n={6} title="Sharing of Information">
        <p className="mb-2">
          OnSpot does not sell your personal information. We may share information only when necessary with:
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          {[
            "Authorized OnSpot team members",
            "Service providers that help operate our website or systems",
            "Payment processors",
            "Technology, hosting, analytics, or security providers",
            "Legal, regulatory, or compliance authorities when required",
            "Business partners or professionals involved in fulfilling your request, when appropriate",
          ].map((i) => <li key={i}>{i}</li>)}
        </ul>
      </PolicySection>

      <PolicySection n={7} title="Third-Party Services">
        <p>
          Our website may use third-party platforms for payment processing, analytics, hosting,
          communication, customer support, or other business functions. These third parties may
          process information according to their own privacy policies and security practices.
        </p>
      </PolicySection>

      <PolicySection n={8} title="Cookies and Tracking Technologies">
        <p>
          The website may use cookies or similar technologies to improve functionality, analyze
          traffic, remember preferences, and enhance user experience. You may adjust cookie settings
          through your browser, but some website features may not function properly if cookies are
          disabled.
        </p>
      </PolicySection>

      <PolicySection n={9} title="Data Security">
        <p>
          OnSpot uses reasonable administrative, technical, and organizational measures to protect
          personal information. However, no website, database, payment system, or internet
          transmission is completely secure. Users are encouraged to avoid submitting unnecessary
          sensitive information through website forms.
        </p>
      </PolicySection>

      <PolicySection n={10} title="Data Retention">
        <p>
          OnSpot retains information for as long as necessary to fulfill the purposes described in
          this Privacy Policy, including inquiry management, payment records, service delivery,
          legal compliance, dispute resolution, and business recordkeeping.
        </p>
      </PolicySection>

      <PolicySection n={11} title="Your Rights and Choices">
        <p className="mb-2">
          Depending on your location and applicable law, you may have the right to:
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          {[
            "Request access to your personal information",
            "Request correction of inaccurate information",
            "Request deletion of certain information",
            "Object to certain processing activities",
            "Withdraw consent where applicable",
            "Request information about how your data is used",
          ].map((i) => <li key={i}>{i}</li>)}
        </ul>
        <p className="mt-2">
          To exercise these rights, please contact OnSpot through the official contact channels
          provided on the website.
        </p>
      </PolicySection>

      <PolicySection n={12} title="Children's Privacy">
        <p>
          The OnSpot website and services are intended for business and professional users. We do
          not knowingly collect personal information from children.
        </p>
      </PolicySection>

      <PolicySection n={13} title="International Users">
        <p>
          If you access the website from outside the country where OnSpot or its service providers
          operate, your information may be processed in locations with different data protection
          laws. By using the website, you understand that information may be transferred and
          processed as necessary to provide services.
        </p>
      </PolicySection>

      <PolicySection n={14} title="Updates to This Privacy Policy">
        <p>
          OnSpot may update this Privacy Policy from time to time. Any updates will be posted on
          this page with a revised "Last Updated" date.
        </p>
      </PolicySection>

      <PolicySection n={15} title="Contact Us">
        <p>
          If you have questions about this Privacy Policy or how your information is handled, please
          contact OnSpot through the official contact channels provided on our website.
        </p>
      </PolicySection>
    </div>
  );
}
