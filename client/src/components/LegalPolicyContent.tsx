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

// ─── Refund Policy ──────────────────────────────────────────────────────────

export function RefundContent() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        This Refund Policy explains how refund requests are handled for payments made through the
        OnSpot website, inquiry flow, or approved payment channels.
      </p>
      <Divider />

      <PolicySection n={1} title="General Policy">
        <p>
          OnSpot values transparency and fairness. Refund eligibility depends on the type of
          service requested, the status of the inquiry, the stage of work completed, and the terms
          agreed between the client and OnSpot. Submitting a refund request does not automatically
          guarantee approval. Each request will be reviewed carefully by the OnSpot team.
        </p>
      </PolicySection>

      <PolicySection n={2} title="Payments Made Through the Website">
        <p>
          If you make a payment through the OnSpot website, the payment may be linked to a service
          inquiry, endorsed request, proposal, invoice, or approved engagement. Please review all
          details carefully before completing payment.
        </p>
      </PolicySection>

      <PolicySection n={3} title="Eligible Refund Situations">
        <p className="mb-2">A refund may be considered in the following cases:</p>
        <ul className="space-y-1.5">
          {[
            "Duplicate payment was made accidentally.",
            "Payment was made for an inquiry that OnSpot later declined or could not fulfill.",
            "Payment amount was incorrect due to a verified system or billing error.",
            "The service has not yet started and the refund request is submitted within a reasonable review period.",
            "A refund is required under a written agreement between the client and OnSpot.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      </PolicySection>

      <PolicySection n={4} title="Non-Refundable Situations">
        <p className="mb-2">Refunds may not be available in the following cases:</p>
        <ul className="space-y-1.5">
          {[
            "Work has already started or resources have already been allocated.",
            "The service has already been delivered, completed, or substantially performed.",
            "The client changes their mind after approval, scheduling, onboarding, or service preparation has begun.",
            "The client provided incorrect, incomplete, or misleading information.",
            "The payment relates to administrative, onboarding, processing, or setup work that has already been completed.",
            "The request is outside the agreed refund window or written service agreement.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
              {item}
            </li>
          ))}
        </ul>
      </PolicySection>

      <PolicySection n={5} title="Partial Refunds">
        <p>
          In some cases, OnSpot may approve a partial refund. Partial refunds may apply when a
          portion of the service has already been completed, resources have been assigned, or
          administrative costs have already been incurred.
        </p>
      </PolicySection>

      <PolicySection n={6} title="Refund Review Process">
        <p className="mb-2">
          To request a refund, the client must contact OnSpot using the official communication
          channels and provide:
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          {["Full name or company name","Email address used for the inquiry","Inquiry reference number","Payment reference or transaction ID","Payment amount","Reason for the refund request","Any supporting information"].map((i) => <li key={i}>{i}</li>)}
        </ul>
        <p className="mt-2">OnSpot will review the request and may contact the client for clarification.</p>
      </PolicySection>

      <PolicySection n={7} title="Processing Time">
        <p>
          Approved refunds will be processed through the original payment method whenever possible.
          Processing times may vary depending on the payment provider, bank, card issuer, or
          third-party platform. OnSpot is not responsible for delays caused by banks, card networks,
          or third-party payment processors.
        </p>
      </PolicySection>

      <PolicySection n={8} title="Payment Processor Fees">
        <p>
          Certain payment processor, bank, or transaction fees may be non-refundable depending on
          the policies of the third-party payment provider.
        </p>
      </PolicySection>

      <PolicySection n={9} title="Cancellations">
        <p>
          If a client wishes to cancel a service request before work begins, they should contact
          OnSpot as soon as possible. Cancellation eligibility and refund treatment will depend on
          the status of the inquiry, endorsement, payment, and service preparation.
        </p>
      </PolicySection>

      <PolicySection n={10} title="Contact Us">
        <p>
          For refund questions or requests, please contact OnSpot through the official contact
          channels provided on our website.
        </p>
      </PolicySection>
    </div>
  );
}

// ─── Terms of Service ────────────────────────────────────────────────────────

export function TermsContent() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        These Terms of Service form a binding agreement between you and{" "}
        <strong>OnSpot Global Corporation</strong> ("OnSpot"). By accessing or using the Platform,
        creating an account, or using our services, you agree to be bound by these Terms.
      </p>
      <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs leading-5 text-amber-800 font-medium">
        PLEASE READ SECTION 19 — IT REQUIRES MOST DISPUTES TO BE RESOLVED BY BINDING INDIVIDUAL
        ARBITRATION WITH A CLASS ACTION WAIVER. YOU MAY OPT OUT WITHIN 30 DAYS.
      </div>
      <Divider />

      <PolicySection n={1} title="Acceptance of Terms">
        <p>By creating an account or using the Platform you agree to these Terms and our Privacy Policy. Additional agreements (e.g. a Master Service Agreement) control their specific subject matter if there is a conflict.</p>
      </PolicySection>

      <PolicySection n={2} title="Definitions">
        <p><strong>"Platform"</strong> — onspotglobal.com and related services. <strong>"Client"</strong> — a user engaging Talent. <strong>"Talent"</strong> — an individual offering services as an independent contractor. <strong>"Content"</strong> — any material submitted to the Platform.</p>
      </PolicySection>

      <PolicySection n={3} title="Eligibility">
        <p>You must be at least 18 and able to form a binding contract. If acting for an organization, you represent you have authority to bind it. You may not use the Platform if subject to U.S. trade sanctions.</p>
      </PolicySection>

      <PolicySection n={4} title="Description of the Platform">
        <p>OnSpot enables Clients to discover and engage Talent, and Talent to find work. OnSpot does not guarantee outcomes and is not a party to Client–Talent working relationships except under a separate signed agreement.</p>
      </PolicySection>

      <PolicySection n={5} title="Accounts & Registration">
        <p>Provide accurate information and keep it updated. You are responsible for all activity under your account. Notify us at security@onspotglobal.com of any unauthorized use. Each User may hold only one active account.</p>
      </PolicySection>

      <PolicySection n={6} title="Client Terms">
        <p>Clients are solely responsible for the accuracy and legality of postings and for ensuring their use of Talent complies with applicable labor, tax, and immigration law.</p>
      </PolicySection>

      <PolicySection n={7} title="Talent Terms & Independent Contractor Relationship">
        <p>Talent are independent contractors — not employees of OnSpot or any Client. OnSpot does not guarantee minimum work or income. Talent are solely responsible for their tax filings and legal compliance.</p>
      </PolicySection>

      <PolicySection n={8} title="Fees, Payments & Taxes">
        <p>Fees are as described on the Platform or in a Statement of Work. Billing for resourced engagements is in Lite (4-hour) or Standard (8-hour) increments. Each User is solely responsible for their own taxes. Fees are non-refundable except as stated in a Statement of Work or required by law.</p>
      </PolicySection>

      <PolicySection n={9} title="AI Features & Automated Tools">
        <p>AI-generated recommendations, summaries, and drafted content are for informational purposes only — not professional advice. Do not rely solely on AI Features for material hiring or legal decisions. OnSpot may use Platform data to improve AI Features per our Privacy Policy.</p>
      </PolicySection>

      <PolicySection n={10} title="User Content & License Grant">
        <p>You retain ownership of Content you submit and grant OnSpot a license to host, display, and distribute it as necessary to operate the Platform. You represent you have all necessary rights to submit your Content.</p>
      </PolicySection>

      <PolicySection n={11} title="Acceptable Use Policy">
        <p>You agree not to use the Platform unlawfully, misrepresent your identity, interfere with Platform security, scrape without consent, upload malicious code, harass other users, circumvent OnSpot's engagement terms, or reverse-engineer the Platform.</p>
      </PolicySection>

      <PolicySection n={12} title="Intellectual Property Rights">
        <p>The Platform and all its content are owned by OnSpot or its licensors. "OnSpot" and associated logos are trademarks of OnSpot. DMCA copyright notices should be sent to legal@onspotglobal.com.</p>
      </PolicySection>

      <PolicySection n={13} title="Third-Party Services & Links">
        <p>The Platform may link to or integrate with third-party services. OnSpot is not responsible for those services, and your use of them is subject to their own terms.</p>
      </PolicySection>

      <PolicySection n={14} title="Privacy">
        <p>Our collection and use of personal data is described in our Privacy Policy, incorporated into these Terms by reference.</p>
      </PolicySection>

      <PolicySection n={15} title="Disclaimers of Warranties">
        <p className="uppercase text-xs leading-5 font-medium text-slate-500">
          The Platform is provided "as is" and "as available" without warranties of any kind. OnSpot
          does not warrant uninterrupted or error-free operation, or the accuracy of any content
          including AI-generated output.
        </p>
      </PolicySection>

      <PolicySection n={16} title="Limitation of Liability">
        <p className="uppercase text-xs leading-5 font-medium text-slate-500">
          OnSpot's liability is limited to the greater of amounts you paid in the prior 12 months or
          $100. OnSpot is not liable for indirect, incidental, or consequential damages.
        </p>
      </PolicySection>

      <PolicySection n={17} title="Indemnification">
        <p>You agree to defend and hold harmless OnSpot from claims arising from your use of the Platform, your Content, your violation of these Terms, or your violation of applicable law.</p>
      </PolicySection>

      <PolicySection n={18} title="Term, Suspension & Termination">
        <p>These Terms remain in effect while you use the Platform. OnSpot may suspend or terminate your access at any time. Sections 10, 12, 15–17, and 19–22 survive termination.</p>
      </PolicySection>

      <PolicySection n={19} title="Dispute Resolution; Binding Arbitration">
        <p>Before filing a claim, contact legal@onspotglobal.com for informal resolution (30 days). Unresolved disputes are settled by binding AAA arbitration in Delaware on an individual basis. Class actions and jury trials are waived. You may opt out of arbitration within 30 days of accepting these Terms by emailing legal@onspotglobal.com.</p>
      </PolicySection>

      <PolicySection n={20} title="Governing Law & Venue">
        <p>These Terms are governed by Delaware law. Non-arbitrated disputes shall be brought in state or federal courts in Delaware.</p>
      </PolicySection>

      <PolicySection n={21} title="Export Control & Sanctions Compliance">
        <p>You may not use the Platform if subject to U.S. export controls or comprehensive sanctions administered by OFAC or the U.S. Department of Commerce.</p>
      </PolicySection>

      <PolicySection n={22} title="Modifications to These Terms">
        <p>OnSpot will provide at least 30 days' notice of material changes via the Platform or email. Continued use after changes take effect constitutes acceptance.</p>
      </PolicySection>

      <PolicySection n={23} title="General Provisions">
        <p>These Terms are the entire agreement between you and OnSpot regarding the Platform. If any provision is unenforceable, the rest remains in effect. You may not assign these Terms without OnSpot's consent.</p>
      </PolicySection>

      <PolicySection n={24} title="Contact Information">
        <p>Questions about these Terms: <strong>OnSpot Global Corporation</strong> — legal@onspotglobal.com</p>
      </PolicySection>
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
