// LEGAL NOTICE: This policy was provided by OnSpot and should be reviewed by
// qualified legal counsel before use in production.

import { TopNavigation } from "@/components/TopNavigation";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Scale, ArrowLeft, Info } from "lucide-react";

const LAST_UPDATED = "August 14, 2026";

function SectionHeading({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="flex items-baseline gap-3 text-base font-semibold text-[#3F4698] mb-3 mt-6 first:mt-0">
      <span className="flex-shrink-0 tabular-nums text-[#3F4698]/50 text-sm font-medium">{n}.</span>
      {title}
    </h2>
  );
}

function SubSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="pl-7 mb-3">
      <p className="text-sm font-semibold text-slate-700 mb-1">
        <span className="text-[#3F4698]/50 tabular-nums mr-2">{id}</span>
        {title}
      </p>
      <div className="text-sm leading-7 text-slate-600 pl-6">{children}</div>
    </div>
  );
}

function PlainTerms({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-7 mb-4 flex gap-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 px-4 py-3">
      <Info className="w-4 h-4 text-[#3F4698] flex-shrink-0 mt-0.5" />
      <p className="text-sm leading-6 text-[#3F4698]/80 italic">{children}</p>
    </div>
  );
}

function LegalBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-7 mb-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
      <p className="text-xs leading-6 text-slate-600 uppercase tracking-wide font-medium">{children}</p>
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="pl-7 text-sm leading-7 text-slate-600 mb-3">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-slate-100 my-6" />;
}

export default function TermsAndConditions() {
  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background:
          "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(139,92,246,0.09) 0%, rgba(224,218,255,0.18) 45%, transparent 70%), linear-gradient(to bottom, #F7F9FF 0%, #FAFBFF 40%, #FFFFFF 100%)",
      }}
    >
      <TopNavigation />

      <section className="relative px-6 pt-10 pb-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-3 rounded-full bg-[#474ead]/10 px-4 py-1 text-[#474ead] border-0 text-xs font-medium">
            <Scale className="w-3 h-3 mr-1.5" />
            Legal
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last Updated: <time dateTime="2026-08-14">{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-7 sm:p-10">

          {/* Intro */}
          <p className="text-base leading-7 text-slate-600 mb-4">
            Welcome to OnSpot. These Terms of Service ("Terms") form a binding agreement between you
            and <strong>OnSpot Global Corporation</strong> ("OnSpot," "we," "us," or "our"), a Delaware
            corporation. By accessing or using the OnSpot platform at{" "}
            <a href="https://onspotglobal.com" className="text-[#474ead] hover:underline">onspotglobal.com</a>{" "}
            (the "Platform"), creating an account, or otherwise using our services, you agree to be
            bound by these Terms. If you do not agree, do not use the Platform.
          </p>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
            <p className="text-sm leading-6 text-amber-800 font-medium">
              PLEASE READ SECTION 19 CAREFULLY — IT REQUIRES MOST DISPUTES BETWEEN YOU AND ONSPOT TO
              BE RESOLVED BY BINDING INDIVIDUAL ARBITRATION AND INCLUDES A WAIVER OF CLASS ACTIONS AND
              JURY TRIALS. YOU MAY OPT OUT OF ARBITRATION AS DESCRIBED IN SECTION 19.9.
            </p>
          </div>

          <Divider />

          {/* 1. Acceptance of Terms */}
          <SectionHeading n="1" title="Acceptance of Terms" />
          <SubSection id="1.1" title="Agreement to Terms">
            By creating an account, checking a box indicating acceptance, or otherwise accessing or
            using the Platform, you represent that you have read, understood, and agree to be bound by
            these Terms and our Privacy Policy, which is incorporated by reference.
          </SubSection>
          <SubSection id="1.2" title="Additional Agreements">
            Certain features — including engaging Talent through a Client account — are subject to
            additional agreements (such as a Master Service Agreement and Statement of Work). In the
            event of a conflict between these Terms and such an additional agreement, the additional
            agreement controls with respect to its specific subject matter.
          </SubSection>
          <SubSection id="1.3" title="Changes to the Platform">
            OnSpot may modify, suspend, or discontinue any part of the Platform at any time, with or
            without notice, though we will make reasonable efforts to notify Users of material changes
            affecting active engagements.
          </SubSection>

          <Divider />

          {/* 2. Definitions */}
          <SectionHeading n="2" title="Definitions" />
          <Body>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-2 border border-slate-200 font-semibold text-slate-700 w-1/3">Term</th>
                    <th className="text-left px-4 py-2 border border-slate-200 font-semibold text-slate-700">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["\"Platform\"", "The OnSpot website, web application, and related services located at onspotglobal.com and any successor domain or application."],
                    ["\"Company,\" \"OnSpot,\" \"we,\" \"us\"", "OnSpot Global Corporation, a Delaware corporation, and its affiliates."],
                    ["\"Client\"", "A user or organization that uses the Platform to discover, engage, or manage Talent."],
                    ["\"Talent\"", "An individual who uses the Platform to offer or perform services to Clients, engaged as an independent contractor as described in Section 7."],
                    ["\"User,\" \"you\"", "Any person or entity that accesses or uses the Platform, including Clients, Talent, and visitors."],
                    ["\"Content\"", "Any text, data, profiles, files, feedback, or other material submitted to or generated on the Platform."],
                    ["\"Agreement\"", "These Terms of Service, together with our Privacy Policy and any Statement of Work, Master Service Agreement, or other applicable agreement between you and OnSpot."],
                  ].map(([term, meaning]) => (
                    <tr key={term} className="even:bg-slate-50/50">
                      <td className="px-4 py-2 border border-slate-200 font-medium text-slate-700 align-top">{term}</td>
                      <td className="px-4 py-2 border border-slate-200 text-slate-600">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Body>

          <Divider />

          {/* 3. Eligibility */}
          <SectionHeading n="3" title="Eligibility" />
          <SubSection id="3.1" title="Age & Capacity">
            You must be at least 18 years old and capable of forming a binding contract to use the
            Platform. By using the Platform, you represent that you meet these requirements.
          </SubSection>
          <SubSection id="3.2" title="Authority">
            If you use the Platform on behalf of an organization, you represent that you have authority
            to bind that organization to these Terms, and "you" refers to both you and that organization.
          </SubSection>
          <SubSection id="3.3" title="Restricted Persons">
            You may not use the Platform if you are located in, or are a national or resident of, any
            country subject to comprehensive U.S. trade sanctions, or if you are listed on any U.S.
            government restricted party list, consistent with Section 22.
          </SubSection>

          <Divider />

          {/* 4. Description of the Platform */}
          <SectionHeading n="4" title="Description of the Platform" />
          <PlainTerms>
            OnSpot helps Clients find and manage Talent, and helps Talent find work. We provide the
            tools; the underlying working relationship between Client and Talent is governed by separate
            agreements.
          </PlainTerms>
          <SubSection id="4.1" title="Marketplace & Resourced Services">
            The Platform enables Clients to discover, evaluate, and engage Talent, and enables Talent
            to create profiles and be considered for opportunities. OnSpot also offers
            Technology-Enabled Resourced Services, through which OnSpot facilitates the engagement of
            independent contractor Talent on behalf of Clients under separate commercial agreements.
          </SubSection>
          <SubSection id="4.2" title="No Guarantee of Outcomes">
            OnSpot does not guarantee that Clients will find suitable Talent, that Talent will find
            work, or that any engagement will meet either party's expectations. OnSpot is not a party
            to the working relationship between Client and Talent except as expressly set forth in a
            separate signed agreement.
          </SubSection>
          <SubSection id="4.3" title="Platform Role">
            Except where OnSpot is expressly a contracting party under a separate Master Service
            Agreement or Statement of Work, OnSpot's role is limited to providing the Platform's
            discovery, communication, and administrative tools. OnSpot is not responsible for the
            quality, legality, or safety of work performed by Talent, or for a Client's compliance
            with applicable law.
          </SubSection>

          <Divider />

          {/* 5. Accounts & Registration */}
          <SectionHeading n="5" title="Accounts & Registration" />
          <SubSection id="5.1" title="Account Creation">
            You must register for an account to access most features of the Platform. You agree to
            provide accurate, current, and complete information and to keep it updated.
          </SubSection>
          <SubSection id="5.2" title="Account Security">
            You are responsible for maintaining the confidentiality of your login credentials and for
            all activity under your account. Notify us immediately at{" "}
            <a href="mailto:security@onspotglobal.com" className="text-[#474ead] hover:underline">security@onspotglobal.com</a>{" "}
            of any unauthorized use.
          </SubSection>
          <SubSection id="5.3" title="One Account">
            Each User may maintain only one active account, unless OnSpot expressly authorizes
            otherwise (for example, an organization with multiple authorized Client seats).
          </SubSection>

          <Divider />

          {/* 6. Client Terms */}
          <SectionHeading n="6" title="Client Terms" />
          <SubSection id="6.1" title="Use of the Platform">
            Clients may use the Platform to post opportunities, search for and evaluate Talent,
            communicate with Talent, and manage active engagements, subject to these Terms and any
            applicable Master Service Agreement.
          </SubSection>
          <SubSection id="6.2" title="Accuracy of Postings">
            Clients are solely responsible for the accuracy and legality of job postings,
            descriptions, and any representations made to Talent through the Platform.
          </SubSection>
          <SubSection id="6.3" title="Compliance">
            Clients are solely responsible for ensuring their use of Talent complies with applicable
            law, including labor, tax, and immigration law in the Client's and Talent's respective
            jurisdictions, and for not directing Talent in a manner inconsistent with independent
            contractor status as described in Section 7.
          </SubSection>

          <Divider />

          {/* 7. Talent Terms */}
          <SectionHeading n="7" title="Talent Terms & Independent Contractor Relationship" />
          <PlainTerms>
            If you're Talent, you're an independent contractor — not an employee of OnSpot or of any
            Client you're matched with.
          </PlainTerms>
          <SubSection id="7.1" title="Independent Contractor Status">
            Talent using the Platform, and any Talent engaged through OnSpot's resourced services,
            are independent contractors. Nothing in these Terms, or in the operation of the Platform,
            creates an employment, agency, partnership, or joint-employer relationship between Talent
            and OnSpot, or between Talent and any Client, except as may be separately and expressly
            agreed in writing.
          </SubSection>
          <SubSection id="7.2" title="No Guarantee of Work">
            OnSpot does not guarantee Talent any minimum amount of work, engagements, or income
            through the Platform.
          </SubSection>
          <SubSection id="7.3" title="Talent Responsibilities">
            Talent are solely responsible for the manner and means of performing their services
            (subject to a Client's right to direct the results of the work under any applicable
            engagement agreement), for their own tax filings and payments, and for compliance with
            applicable law in their jurisdiction.
          </SubSection>
          <SubSection id="7.4" title="Verification">
            OnSpot may perform reasonable verification of Talent-submitted information but does not
            guarantee the accuracy of any Talent profile, and does not guarantee Talent's performance,
            conduct, or qualifications to any Client.
          </SubSection>

          <Divider />

          {/* 8. Fees, Payments & Taxes */}
          <SectionHeading n="8" title="Fees, Payments & Taxes" />
          <SubSection id="8.1" title="Fees">
            Use of certain Platform features, and engagement of Talent through OnSpot's resourced
            services, is subject to fees as described on the Platform or in an applicable Statement of
            Work. OnSpot does not bill on an hourly basis for resourced engagements; billing is
            calculated in fixed Half-Day or Full-Day increments as described in the applicable
            Statement of Work.
          </SubSection>
          <SubSection id="8.2" title="Payment Processing">
            Payments may be processed through third-party payment processors. By providing payment
            information, you authorize OnSpot and its payment processors to charge the applicable fees.
          </SubSection>
          <SubSection id="8.3" title="Taxes">
            Each User is solely responsible for determining and paying any taxes applicable to their
            use of the Platform or their receipt of payment through it. OnSpot does not withhold taxes
            on behalf of Talent except where required by applicable law.
          </SubSection>
          <SubSection id="8.4" title="Refunds">
            Fees are non-refundable except as expressly stated in an applicable Statement of Work or
            as required by applicable law.
          </SubSection>

          <Divider />

          {/* 9. AI Features */}
          <SectionHeading n="9" title="AI Features & Automated Tools" />
          <PlainTerms>
            We use AI to help match Talent to Clients and speed up admin work. AI outputs are
            suggestions, not guarantees — always use your own judgment.
          </PlainTerms>
          <SubSection id="9.1" title="AI-Assisted Features">
            The Platform uses artificial intelligence and automated tools to, among other things,
            recommend candidates, summarize profiles, draft content such as job descriptions or offer
            letters, and assist with administrative workflows (collectively, "AI Features").
          </SubSection>
          <SubSection id="9.2" title="No Warranty on AI Output">
            AI Features may produce inaccurate, incomplete, or biased output. AI-generated
            recommendations, summaries, scores, and drafted content are provided for informational and
            productivity purposes only and do not constitute professional advice or a guarantee of
            suitability. You are solely responsible for reviewing and verifying any AI-generated
            output before relying on it, including for hiring, compliance, or legal purposes.
          </SubSection>
          <SubSection id="9.3" title="No Sole Reliance for Material Decisions">
            You agree not to rely solely on AI Features to make material decisions about employment,
            contracting, compensation, or legal compliance without independent human review.
          </SubSection>
          <SubSection id="9.4" title="Data Use for AI">
            OnSpot may use data submitted to the Platform to develop, train, and improve AI Features
            and other Platform functionality, in accordance with our Privacy Policy. Where required by
            applicable law, OnSpot will provide a mechanism to opt out of use of your personal data
            for model training purposes.
          </SubSection>

          <Divider />

          {/* 10. User Content */}
          <SectionHeading n="10" title="User Content & License Grant" />
          <SubSection id="10.1" title="Ownership">
            You retain ownership of Content you submit to the Platform, subject to the license granted
            below.
          </SubSection>
          <SubSection id="10.2" title="License to OnSpot">
            You grant OnSpot a worldwide, non-exclusive, royalty-free, sublicensable license to host,
            store, reproduce, modify, display, and distribute your Content solely as necessary to
            operate, provide, and improve the Platform, including displaying your profile or postings
            to other Users as intended by the Platform's functionality.
          </SubSection>
          <SubSection id="10.3" title="Your Responsibility for Content">
            You represent that you have all necessary rights to submit your Content and that it does
            not infringe any third party's rights or violate applicable law.
          </SubSection>
          <SubSection id="10.4" title="Feedback">
            If you provide suggestions or feedback about the Platform, OnSpot may use it without any
            obligation to compensate you.
          </SubSection>

          <Divider />

          {/* 11. Acceptable Use */}
          <SectionHeading n="11" title="Acceptable Use Policy" />
          <Body>
            <p className="mb-3">You agree not to:</p>
            <ul className="space-y-2 mb-4">
              {[
                "Use the Platform for any unlawful purpose or in violation of any applicable law or regulation;",
                "Misrepresent your identity, qualifications, or affiliation;",
                "Circumvent, disable, or interfere with security features of the Platform;",
                "Scrape, crawl, or use automated means to access the Platform except through a documented API with prior written consent;",
                "Upload malicious code, or attempt to gain unauthorized access to any system or data;",
                "Use the Platform to harass, discriminate against, or discriminate in hiring on any basis prohibited by applicable law;",
                "Attempt to circumvent OnSpot's role by inducing a Client and Talent introduced through the Platform to bypass agreed fee or engagement terms, where a separate agreement prohibits such circumvention;",
                "Reverse-engineer, decompile, or attempt to derive the source code of the Platform, except to the extent applicable law prohibits this restriction.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#3F4698]/40 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Body>
          <SubSection id="11.1" title="Enforcement">
            OnSpot may investigate and take appropriate action for violations of this Section,
            including removing Content, suspending or terminating accounts, and reporting to law
            enforcement.
          </SubSection>

          <Divider />

          {/* 12. Intellectual Property */}
          <SectionHeading n="12" title="Intellectual Property Rights" />
          <SubSection id="12.1" title="Platform IP">
            The Platform, including its software, design, text, graphics, logos, and underlying
            technology, is owned by OnSpot or its licensors and is protected by intellectual property
            laws. Except for the limited rights expressly granted in these Terms, no rights are
            granted to you.
          </SubSection>
          <SubSection id="12.2" title="Trademarks">
            "OnSpot" and associated logos are trademarks of OnSpot. You may not use them without
            prior written permission, except as necessary to accurately reference OnSpot's services.
          </SubSection>
          <SubSection id="12.3" title="DMCA / Copyright Complaints">
            OnSpot respects intellectual property rights and will respond to properly submitted
            notices of alleged copyright infringement under the Digital Millennium Copyright Act.
            Notices should be sent to our designated agent at{" "}
            <a href="mailto:legal@onspotglobal.com" className="text-[#474ead] hover:underline">legal@onspotglobal.com</a>,
            and should include: (a) identification of the copyrighted work; (b) identification of the
            allegedly infringing material and its location; (c) your contact information; (d) a
            statement of good-faith belief that the use is unauthorized; (e) a statement of accuracy
            under penalty of perjury; and (f) your physical or electronic signature.
          </SubSection>

          <Divider />

          {/* 13. Third-Party Services */}
          <SectionHeading n="13" title="Third-Party Services & Links" />
          <SubSection id="13.1" title="Third-Party Services">
            The Platform may contain links to or integrations with third-party websites or services
            (such as payment processors or calendar tools). OnSpot does not control and is not
            responsible for third-party services, and your use of them is subject to their own terms.
          </SubSection>

          <Divider />

          {/* 14. Privacy */}
          <SectionHeading n="14" title="Privacy" />
          <SubSection id="14.1" title="Privacy Policy">
            Our collection and use of personal data in connection with the Platform is described in
            our{" "}
            <Link href="/privacy-policy" className="text-[#474ead] hover:underline">Privacy Policy</Link>,
            which is incorporated into these Terms by reference.
          </SubSection>

          <Divider />

          {/* 15. Disclaimers */}
          <SectionHeading n="15" title="Disclaimers of Warranties" />
          <LegalBlock>
            THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND,
            WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. ONSPOT
            DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT
            ANY TALENT, CLIENT, OR AI FEATURE OUTPUT WILL MEET YOUR EXPECTATIONS OR REQUIREMENTS.
            ONSPOT DOES NOT WARRANT THE ACCURACY OR RELIABILITY OF ANY CONTENT ON THE PLATFORM,
            INCLUDING USER-SUBMITTED PROFILES AND AI-GENERATED OUTPUT.
          </LegalBlock>
          <Body>
            Some jurisdictions do not allow the exclusion of certain warranties, so some of the above
            exclusions may not apply to you.
          </Body>

          <Divider />

          {/* 16. Limitation of Liability */}
          <SectionHeading n="16" title="Limitation of Liability" />
          <LegalBlock>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ONSPOT AND ITS OFFICERS, DIRECTORS,
            EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL,
            ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM, EVEN IF ONSPOT HAS BEEN ADVISED
            OF THE POSSIBILITY OF SUCH DAMAGES.
            {"\n\n"}
            ONSPOT'S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE
            PLATFORM SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO ONSPOT IN THE TWELVE
            (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S.
            DOLLARS ($100).
            {"\n\n"}
            THESE LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY ON WHICH A CLAIM IS BASED AND
            EVEN IF A REMEDY FAILS OF ITS ESSENTIAL PURPOSE. NOTHING IN THIS SECTION LIMITS LIABILITY
            THAT CANNOT BE LIMITED UNDER APPLICABLE LAW, SUCH AS LIABILITY FOR GROSS NEGLIGENCE,
            WILLFUL MISCONDUCT, OR DEATH OR PERSONAL INJURY CAUSED BY ONSPOT'S NEGLIGENCE, WHERE
            SUCH LIMITATION IS PROHIBITED BY LAW.
          </LegalBlock>

          <Divider />

          {/* 17. Indemnification */}
          <SectionHeading n="17" title="Indemnification" />
          <SubSection id="17.1" title="Indemnification Obligation">
            You agree to defend, indemnify, and hold harmless OnSpot and its officers, directors,
            employees, and affiliates from and against any claims, liabilities, damages, losses, and
            expenses, including reasonable attorneys' fees, arising out of or in any way connected
            with: (a) your access to or use of the Platform; (b) your Content; (c) your violation of
            these Terms; or (d) your violation of any applicable law or the rights of any third party,
            including any Client's or Talent's misclassification claims arising from that party's own
            conduct.
          </SubSection>

          <Divider />

          {/* 18. Term, Suspension & Termination */}
          <SectionHeading n="18" title="Term, Suspension & Termination" />
          <SubSection id="18.1" title="Term">
            These Terms remain in effect for as long as you use the Platform or maintain an account.
          </SubSection>
          <SubSection id="18.2" title="Termination by You">
            You may stop using the Platform and close your account at any time, subject to any
            outstanding obligations under an applicable Statement of Work or Master Service Agreement.
          </SubSection>
          <SubSection id="18.3" title="Suspension & Termination by OnSpot">
            OnSpot may suspend or terminate your account or access to the Platform, with or without
            notice, if we believe you have violated these Terms, pose a security risk, or for any
            other reason at our discretion, subject to any conflicting terms in a signed Master
            Service Agreement.
          </SubSection>
          <SubSection id="18.4" title="Effect of Termination">
            Upon termination, your right to use the Platform ceases immediately. Sections of these
            Terms that by their nature should survive termination — including Sections 10, 12, 15–17,
            and 19–22 — shall survive.
          </SubSection>

          <Divider />

          {/* 19. Dispute Resolution */}
          <SectionHeading n="19" title="Dispute Resolution; Binding Arbitration; Class Action Waiver" />
          <PlainTerms>
            If we have a dispute, we agree to try to work it out directly first, and if we can't, to
            resolve it through individual arbitration rather than in court or as part of a class
            action — unless you opt out within 30 days of first agreeing to these Terms.
          </PlainTerms>
          <SubSection id="19.1" title="Informal Resolution First">
            Before filing a claim, you agree to contact OnSpot at{" "}
            <a href="mailto:legal@onspotglobal.com" className="text-[#474ead] hover:underline">legal@onspotglobal.com</a>{" "}
            and attempt in good faith to resolve the dispute informally for at least thirty (30) days.
          </SubSection>
          <SubSection id="19.2" title="Agreement to Arbitrate">
            If informal resolution fails, you and OnSpot agree that any dispute, claim, or
            controversy arising out of or relating to these Terms or the Platform shall be resolved by
            binding arbitration on an individual basis, rather than in court, except as set forth in
            Section 19.6.
          </SubSection>
          <SubSection id="19.3" title="Arbitration Provider & Rules">
            The arbitration shall be administered by the American Arbitration Association (AAA) under
            its applicable rules for consumer or commercial disputes, as appropriate. The arbitration
            shall take place in Delaware, or may be conducted remotely or via written submissions
            where permitted by the arbitration provider's rules.
          </SubSection>
          <SubSection id="19.4" title="Class Action Waiver">
            <LegalBlock>
              YOU AND ONSPOT AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN
              INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR
              REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON'S
              CLAIMS AND MAY NOT OTHERWISE PRESIDE OVER ANY FORM OF A REPRESENTATIVE OR CLASS
              PROCEEDING.
            </LegalBlock>
          </SubSection>
          <SubSection id="19.5" title="Jury Trial Waiver">
            <LegalBlock>
              YOU AND ONSPOT WAIVE ANY RIGHT TO A JURY TRIAL FOR ANY CLAIM SUBJECT TO THIS SECTION.
            </LegalBlock>
          </SubSection>
          <SubSection id="19.6" title="Exceptions">
            Notwithstanding the foregoing, either party may bring an individual action in small claims
            court, and either party may seek injunctive or other equitable relief in court to prevent
            actual or threatened infringement, misappropriation, or violation of a party's
            intellectual property or confidentiality obligations.
          </SubSection>
          <SubSection id="19.7" title="Fees">
            Payment of arbitration filing, administrative, and arbitrator fees will be governed by
            the arbitration provider's rules, except that OnSpot will pay costs where required by
            applicable law or the arbitration provider's consumer rules to make arbitration accessible.
          </SubSection>
          <SubSection id="19.8" title="Severability of Arbitration Clause">
            If the class action waiver in Section 19.4 is found unenforceable as to a particular
            claim or dispute, that claim or dispute shall proceed in court, and the remainder of this
            Section 19 shall remain in force with respect to all other claims.
          </SubSection>
          <SubSection id="19.9" title="Right to Opt Out">
            You may opt out of this arbitration agreement by sending written notice to{" "}
            <a href="mailto:legal@onspotglobal.com" className="text-[#474ead] hover:underline">legal@onspotglobal.com</a>{" "}
            within thirty (30) days of first accepting these Terms, stating your name, account email,
            and a clear statement that you wish to opt out of arbitration. If you opt out, neither
            you nor OnSpot will be required to arbitrate, but all other provisions of these Terms
            will continue to apply.
          </SubSection>

          <Divider />

          {/* 20. Governing Law */}
          <SectionHeading n="20" title="Governing Law & Venue" />
          <SubSection id="20.1" title="Governing Law">
            These Terms are governed by the laws of the State of Delaware, without regard to its
            conflict of laws principles. Subject to Section 19, any action not subject to arbitration
            shall be brought exclusively in the state or federal courts located in Delaware, and you
            consent to the personal jurisdiction of those courts.
          </SubSection>

          <Divider />

          {/* 21. Export Control */}
          <SectionHeading n="21" title="Export Control & Sanctions Compliance" />
          <SubSection id="21.1" title="Export Compliance">
            You may not use the Platform if you are subject to U.S. export control restrictions or
            comprehensive sanctions, or if such use would violate any applicable export control or
            sanctions law, including regulations administered by the U.S. Department of the
            Treasury's Office of Foreign Assets Control (OFAC) and the U.S. Department of Commerce.
          </SubSection>

          <Divider />

          {/* 22. Modifications */}
          <SectionHeading n="22" title="Modifications to These Terms" />
          <SubSection id="22.1" title="Notice of Changes">
            OnSpot may update these Terms from time to time. If we make material changes, we will
            provide notice through the Platform or by email at least 30 days before the changes take
            effect, except for changes required by law, which may take effect immediately. Continued
            use of the Platform after changes take effect constitutes acceptance of the updated Terms.
          </SubSection>

          <Divider />

          {/* 23. General Provisions */}
          <SectionHeading n="23" title="General Provisions" />
          <SubSection id="23.1" title="Entire Agreement">
            These Terms, together with our Privacy Policy and any applicable Statement of Work or
            Master Service Agreement, constitute the entire agreement between you and OnSpot regarding
            the Platform, superseding any prior agreements regarding its subject matter.
          </SubSection>
          <SubSection id="23.2" title="Severability">
            If any provision of these Terms is found unenforceable, the remaining provisions will
            remain in full force and effect, and the unenforceable provision will be modified to the
            minimum extent necessary to make it enforceable.
          </SubSection>
          <SubSection id="23.3" title="No Waiver">
            OnSpot's failure to enforce any provision of these Terms is not a waiver of its right to
            do so later.
          </SubSection>
          <SubSection id="23.4" title="Assignment">
            You may not assign these Terms without OnSpot's prior written consent. OnSpot may assign
            these Terms without restriction, including to an affiliate or successor entity as part of
            a corporate reorganization.
          </SubSection>
          <SubSection id="23.5" title="Force Majeure">
            Neither party will be liable for any failure or delay in performance due to causes beyond
            its reasonable control, including acts of God, natural disaster, war, or governmental
            action.
          </SubSection>
          <SubSection id="23.6" title="Notices">
            OnSpot may provide notices to you via the Platform, email, or other reasonable means. You
            may provide notice to OnSpot at{" "}
            <a href="mailto:legal@onspotglobal.com" className="text-[#474ead] hover:underline">legal@onspotglobal.com</a>.
          </SubSection>
          <SubSection id="23.7" title="Relationship of the Parties">
            Nothing in these Terms creates a partnership, joint venture, agency, or employment
            relationship between you and OnSpot.
          </SubSection>

          <Divider />

          {/* 24. Contact */}
          <SectionHeading n="24" title="Contact Information" />
          <Body>
            <p>Questions about these Terms can be directed to:</p>
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 space-y-1">
              <p className="font-semibold text-slate-800">OnSpot Global Corporation</p>
              <p>
                Email:{" "}
                <a href="mailto:legal@onspotglobal.com" className="text-[#474ead] hover:underline">
                  legal@onspotglobal.com
                </a>
              </p>
            </div>
          </Body>

          <Divider />

          {/* Footer links */}
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

      <Footer variant="light" />
    </div>
  );
}
