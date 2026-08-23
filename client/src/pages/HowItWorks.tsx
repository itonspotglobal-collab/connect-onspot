import { useState, useEffect, useRef } from "react";
import { ChevronDown, Sparkles, ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";
import { useVanessa } from "@/contexts/VanessaContext";
import NotFound from "@/pages/not-found";

// ─── Publish gate ─────────────────────────────────────────────────────────────
// This page is STAGED — it must not be publicly reachable until both of these
// dependencies have shipped to the live product:
//   1. Lite/Standard engagement-type rename
//   2. "Vetted" badge feature on Contractor profiles
//
// To preview during development, set VITE_HOW_IT_WORKS_ENABLED=true in the
// environment. Without that flag this component renders a 404, making the page
// genuinely unreachable regardless of how a visitor finds the URL.
const ENABLED = import.meta.env.VITE_HOW_IT_WORKS_ENABLED === "true";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QA {
  q: string;
  a: string | React.ReactNode;
}

interface SubGroup {
  heading?: string;
  items: QA[];
}

interface Section {
  id: string;
  label: string;
  shortLabel: string;
  groups: SubGroup[];
}

// ─── Content (verbatim from approved draft) ──────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "what-is-onspot",
    label: "What Is OnSpot",
    shortLabel: "What Is OnSpot",
    groups: [
      {
        items: [
          {
            q: "What is OnSpot?",
            a: "OnSpot is a workforce platform that connects businesses with skilled independent professionals — quickly, reliably, and without the friction of traditional hiring or outsourcing. We call it Work Without Limits: no geography, no rigid employment models, no fragmented tools.",
          },
          {
            q: "How is OnSpot different from a freelance marketplace or a BPO?",
            a: "Freelance marketplaces help you find people. Traditional outsourcing gives you a managed team but little visibility or control. OnSpot combines both — AI-matched contractors (with vetted profiles available), direct relationships, and the technology to manage the whole engagement in one place.",
          },
          {
            q: "Who is OnSpot for?",
            a: (
              <>
                Two sides:
                <ul className="mt-2 space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Clients</span> — solopreneurs, growing teams, and larger companies looking to hire remote contractors without the usual hiring cycle.</li>
                  <li><span className="font-semibold text-slate-800">Contractors</span> — independent contractors looking for real, well-paying work with reliable clients and transparent pay.</li>
                </ul>
              </>
            ),
          },
          {
            q: "What kinds of roles can I hire for (or find work in)?",
            a: "In principle, any role that can be done remotely — OnSpot isn't limited to a fixed list of job types. Today, the platform's categories include Customer Support, Virtual Assistants, Developers, Designers, Marketing Specialists, Accountants, Healthcare Professionals, Sales Representatives, Operations Specialists, and IT & Technical Support, with new categories added as the platform grows.",
          },
          {
            q: "Is OnSpot available outside the Philippines?",
            a: "The Philippines is our starting contractor pool, not a permanent limit — OnSpot's long-term goal is sourcing contractors globally.",
          },
        ],
      },
    ],
  },

  {
    id: "for-clients",
    label: "How It Works for Clients",
    shortLabel: "For Clients",
    groups: [
      {
        heading: "Getting Started",
        items: [
          {
            q: "What kinds of Client accounts does OnSpot support?",
            a: (
              <>
                Two types:
                <ul className="mt-2 space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Solopreneurs</span> — hiring as an individual, fully supported today.</li>
                  <li><span className="font-semibold text-slate-800">Companies & Organizations</span> — hiring under a company name, also fully supported today.</li>
                </ul>
                <p className="mt-2 text-slate-500 text-sm italic">Multi-user team access for Company/Organization accounts — inviting teammates, assigning roles like HR, Hiring Manager, or Finance — is coming soon. Today, one person manages the account.</p>
              </>
            ),
          },
          {
            q: "Do I need to sign anything before I can hire?",
            a: "Yes — before your first hire, you'll review and accept OnSpot's Master Service Agreement (MSA). It's a one-time step; once accepted, you won't need to do it again.",
          },
        ],
      },
      {
        heading: "The Hiring Process",
        items: [
          {
            q: "Are Contractors verified or vetted before I can hire them?",
            a: (
              <>
                Not every Contractor carries these marks — both are optional, not automatic.
                <ul className="mt-2 space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Verified</span> means OnSpot has confirmed their identity and certifications.</li>
                  <li><span className="font-semibold text-slate-800">Vetted</span> means OnSpot has gone further, reviewing their skills, experience, and work history — and requires that they're already Verified first.</li>
                </ul>
                <p className="mt-2">Look for either mark on a profile if trust signals matter for your hiring decision.</p>
              </>
            ),
          },
          {
            q: "How do I find contractors?",
            a: "Search or browse AI-matched profiles based on the role, skills, and experience you need. Every result shows a match score and a masked profile — full identity is revealed once a real interview is confirmed.",
          },
          {
            q: 'What\'s the difference between "Shortlist" and "Interview this contractor"?',
            a: (
              <>
                <ul className="space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Shortlist</span> — a lightweight way to save a promising profile for a specific role. No commitment, and the Contractor isn't notified.</li>
                  <li><span className="font-semibold text-slate-800">Interview this contractor</span> — this starts the actual hiring process: you propose an interview time, and if you haven't already, you'll complete the one-time MSA step first.</li>
                </ul>
              </>
            ),
          },
          {
            q: "How does interview scheduling work?",
            a: "You propose a time when you invite someone to interview. They can accept it, decline, or suggest a different time — the same screen handles all of it. Once a time is confirmed, you'll see their full profile and can message directly.",
          },
          {
            q: "What happens after the interview?",
            a: "If you'd like to move forward, you send an Offer with your terms. Your Contractor can accept, decline, or counter with different terms — you'll see any counter-offer and can respond.",
          },
          {
            q: "Who handles the contract?",
            a: "Once an Offer is accepted, OnSpot generates the contract. Your Contractor signs first, then OnSpot countersigns to finalize — at that point, they're officially hired.",
          },
          {
            q: "What happens once someone is hired?",
            a: "OnSpot handles billing, attendance verification, and ongoing support for the length of the engagement.",
          },
        ],
      },
      {
        heading: "Pricing",
        items: [
          {
            q: "How much does OnSpot cost?",
            a: "OnSpot charges a Service Fee of 10–20%, added on top of your Contractor's rate — never deducted from what they're paid. The exact rate depends on your engagement history and tier over time.",
          },
          {
            q: "What does the Service Fee actually cover?",
            a: (
              <ul className="space-y-0.5 list-disc list-inside">
                {[
                  "AI-powered contractor matching and search",
                  "Interview scheduling and coordination tools",
                  "Contract drafting and administration",
                  "Onboarding support for new engagements",
                  "Dedicated account management",
                  "Managed engagement oversight",
                  "Dispute and issue resolution",
                  "Performance reporting and analytics",
                  "Secure payment handling",
                  "Invoicing and billing administration",
                  "Security deposit handling",
                  "MSA and legal document administration",
                  "Identity protection and data security",
                  "In-platform messaging infrastructure",
                  "Attendance and engagement verification systems",
                  "Ongoing platform development and improvements",
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
          {
            q: "What if my Contractor works more or less than their committed hours?",
            a: "OnSpot tracks this through two mechanisms. If your Contractor works beyond their committed hours, those are logged as Extended Hours — billed at the same flat rate as their regular hours, with no overtime premium. If they work fewer hours than committed, a proportional Deduction is applied automatically against that period's invoice. Both are calculated through OnSpot's attendance and engagement verification systems and reflected in your billing without any manual adjustment on your end.",
          },
          {
            q: "Is there a security deposit?",
            a: "Yes — a refundable security deposit is collected before your Contractor's first day. It's held by OnSpot and applied against your final invoice at the end of a proper engagement (30 days' notice, no lock-in period). If a payment is ever late, the deposit can be drawn on to keep your Contractor paid on time — with an obligation to replenish it within 5 days. The deposit is never forfeited.",
          },
          {
            q: "What if I don't pay an invoice on time?",
            a: "There's a grace period before any service interruption. If payment lapses significantly, services may be suspended until the account is brought current.",
          },
        ],
      },
      {
        heading: "Support",
        items: [
          {
            q: "What if something goes wrong during an engagement?",
            a: "Reach out to your dedicated account manager, or contact hiretalent@onspotglobal.com — OnSpot can help mediate and resolve issues directly.",
          },
        ],
      },
    ],
  },

  {
    id: "for-contractors",
    label: "How It Works for Contractors",
    shortLabel: "For Contractors",
    groups: [
      {
        heading: "Getting Started",
        items: [
          {
            q: "What kinds of Contractor accounts does OnSpot support?",
            a: (
              <>
                Two types:
                <ul className="mt-2 space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Independent Contractors</span> — individuals working on their own, fully supported today.</li>
                  <li><span className="font-semibold text-slate-800">Companies & BPOs</span> — organizations bringing their own roster of contractors onto the platform, <span className="italic">coming soon</span>.</li>
                </ul>
              </>
            ),
          },
          {
            q: "How do I create a strong profile?",
            a: "Complete your profile with your skills, experience, and availability. AI resume parsing helps speed this up. The more complete your profile, the more visible you are to Clients searching for your skillset.",
          },
          {
            q: "How do I get Verified?",
            a: '"Verified" confirms your identity and credentials — you\'ll upload a government-issued ID and any relevant certifications, and OnSpot reviews them to confirm you are who you say you are. It\'s the foundation for building trust with Clients, and it\'s required before you can become Vetted.',
          },
          {
            q: "How do I get Vetted?",
            a: (
              <>
                "Vetted" goes further than Verified — it confirms your skills, experience, and work history are accurate, through OnSpot's internal review. You must be Verified first. From there, there's more than one path:
                <ul className="mt-2 space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Request it</span> — reach out to your account manager and ask for a review.</li>
                  <li><span className="font-semibold text-slate-800">Get selected</span> — OnSpot may proactively offer it to Contractors with strong performance.</li>
                  <li><span className="font-semibold text-slate-800">Reach a milestone</span> — it can also be granted automatically once you hit a tenure or engagement threshold.</li>
                </ul>
              </>
            ),
          },
          {
            q: "What's the difference between Verified and Vetted?",
            a: (
              <>
                Verified confirms <em>who you are</em> — your identity and certifications are on file and reviewed. Vetted confirms <em>how you perform</em> — your skills, experience, and work history have been reviewed by OnSpot. Verified is the foundation; Vetted is the deeper layer built on top of it.
              </>
            ),
          },
        ],
      },
      {
        heading: "Getting Matched & Hired",
        items: [
          {
            q: "How do Clients find me?",
            a: "Clients search by skill, category, and availability. Your profile stays identity-masked until a real interview is confirmed — your work history and qualifications are visible, but your name and contact details are protected until then.",
          },
          {
            q: 'What does it mean if I\'ve been "Shortlisted"?',
            a: "A Client has saved your profile for a role they're considering. You won't be notified when this happens — it's not a commitment yet, just the Client keeping track. You'll hear from them if they move forward to an actual interview invitation.",
          },
          {
            q: "How does interview scheduling work?",
            a: "When a Client invites you to interview, they'll propose a time. You can accept it, decline, or suggest a different time that works better for you — the negotiation happens right in the same flow until you both agree.",
          },
          {
            q: "When does the Client see my real name?",
            a: "Only once an interview time is actually confirmed — not before, and not just because you responded to a proposal.",
          },
        ],
      },
      {
        heading: "Offers & Pay",
        items: [
          {
            q: "How does pay work?",
            a: "You set your own rate. OnSpot's Service Fee is added on top of what the Client pays — it is never deducted from your rate. What you're offered is what you receive, in full.",
          },
          {
            q: "What are Engagement Types?",
            a: (
              <>
                OnSpot uses two flat-rate engagement types instead of hourly billing:
                <ul className="mt-2 space-y-1 list-none">
                  <li><span className="font-semibold text-slate-800">Lite</span> — 4 hours a day / 20 hours a week</li>
                  <li><span className="font-semibold text-slate-800">Standard</span> — 8 hours a day / 40 hours a week</li>
                </ul>
              </>
            ),
          },
          {
            q: "What if I work more or less than my committed hours?",
            a: "OnSpot tracks this through two mechanisms. If you work beyond your engagement's committed hours, those are logged as Extended Hours — billed at the same flat rate as your regular hours, with no premium. If you work fewer hours than committed, a proportional Deduction is applied automatically for that period. Both are calculated through OnSpot's attendance and engagement verification systems — neither requires negotiation or manual adjustment after the fact.",
          },
          {
            q: "Can I negotiate an Offer?",
            a: "Yes — if the terms don't work for you, you can counter with your own terms. The Client will see your counter and can accept, decline, or counter back.",
          },
          {
            q: "How and when do I get paid?",
            a: "Clients pay OnSpot directly, and OnSpot pays you — in full, on schedule. This protects your pay even if a Client's payment is delayed.",
          },
        ],
      },
      {
        heading: "Contracts & Ongoing Support",
        items: [
          {
            q: "Who handles my contract?",
            a: "Once you accept an Offer, OnSpot generates the contract. You sign first, then OnSpot countersigns to finalize the engagement.",
          },
          {
            q: "What support do I get once I'm hired?",
            a: "A dedicated account manager, access to Contractor Counselling, plus OnSpot Plus (group-rate savings on HMO/insurance) and OnSpot Loyalty (tenure and performance-based rewards, including better terms over time).",
          },
          {
            q: "What if my engagement ends early?",
            a: "OnSpot offers redeployment support to help you find your next opportunity.",
          },
        ],
      },
      {
        heading: "Support",
        items: [
          {
            q: "Who do I contact if I have questions or an issue?",
            a: "Reach out to your dedicated account manager, or contact findwork@onspotglobal.com any time.",
          },
        ],
      },
    ],
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({
  qa,
  itemKey,
  isOpen,
  onToggle,
}: {
  qa: QA;
  itemKey: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border-b border-slate-200 last:border-0 transition-colors duration-150 ${
        isOpen ? "bg-[#F5F4FF]" : "hover:bg-slate-50/70"
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`answer-${itemKey}`}
        className="flex w-full items-start justify-between gap-4 py-5 px-6 text-left"
      >
        <span
          className={`text-base font-medium leading-snug transition-colors ${
            isOpen ? "text-[#474EAD]" : "text-slate-800"
          }`}
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {qa.q}
        </span>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-[#474EAD]" : "text-slate-400"
          }`}
        />
      </button>
      <div
        id={`answer-${itemKey}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className="px-6 pb-5 text-sm leading-relaxed text-slate-600"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {qa.a}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HowItWorks() {
  // Hard gate — return 404 for any visitor when the publish flag is off.
  // This fires before any hooks, which is valid because ENABLED is a module-level
  // constant (never changes at runtime), so hook call count is always the same.
  if (!ENABLED) return <NotFound />;

  const { openVanessa } = useVanessa();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  const toggle = (key: string) =>
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));

  // Scrollspy: track which section is in view
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersection ratio that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.1, 0.25] }
    );

    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const navHeight = 112; // sticky nav + jump bar approx
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden py-20 sm:py-28"
        style={{
          background:
            "linear-gradient(135deg, #0C123F 0%, #272668 45%, #474EAD 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-16 right-0 h-[420px] w-[420px] rounded-full bg-[#F5A623]/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[600px] rounded-full bg-white/3 blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto px-4 sm:px-6 text-center">
          {/* Kicker */}
          <p
            className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Platform Guide
          </p>

          {/* Heading */}
          <h1
            className="mt-4 text-3xl sm:text-5xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            How It Works
          </h1>

          {/* Sub */}
          <p
            className="mt-4 text-base sm:text-lg text-white/65 max-w-2xl mx-auto"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Everything you need to know about OnSpot — for Clients and
            Contractors alike.
          </p>

          {/* Gold accent rule */}
          <div className="mt-8 mx-auto h-0.5 w-16 rounded-full bg-[#F5A623]" />
        </div>
      </div>

      {/* ── Sticky jump nav ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 scrollbar-hide">
            {SECTIONS.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-[#474EAD] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {sec.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="space-y-20 sm:space-y-28">
          {SECTIONS.map((section, sIdx) => (
            <section
              key={section.id}
              id={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
            >
              {/* Section header */}
              <div className="mb-10">
                {/* Gold accent bar */}
                <div className="mb-4 h-1 w-10 rounded-full bg-[#F5A623]" />
                <h2
                  className="text-2xl sm:text-3xl font-bold text-[#0C123F]"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  {section.label}
                </h2>
              </div>

              {/* Groups */}
              <div className="space-y-10">
                {section.groups.map((group, gIdx) => (
                  <div key={gIdx}>
                    {/* Sub-group heading */}
                    {group.heading && (
                      <h3
                        className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {group.heading}
                      </h3>
                    )}

                    {/* Accordion card */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      {group.items.map((qa, qIdx) => {
                        const key = `${sIdx}-${gIdx}-${qIdx}`;
                        return (
                          <AccordionItem
                            key={key}
                            qa={qa}
                            itemKey={key}
                            isOpen={!!openItems[key]}
                            onToggle={() => toggle(key)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ── Still have questions CTA ────────────────────────────────────── */}
      <div
        className="border-t border-slate-200 py-16 sm:py-24"
        style={{
          background:
            "linear-gradient(135deg, #F5F4FF 0%, #FFFBF0 50%, #F0F4FF 100%)",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <div className="mx-auto max-w-2xl">
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #474EAD 0%, #272668 100%)",
              }}
            >
              <MessageCircle className="h-7 w-7 text-white" />
            </div>

            <h2
              className="mt-6 text-2xl sm:text-3xl font-bold text-[#0C123F]"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              Still have questions?
            </h2>
            <p
              className="mt-3 text-base text-slate-600 max-w-lg mx-auto"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Vanessa is available 24/7 to answer anything about OnSpot —
              from pricing to process to finding your next hire.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={openVanessa}
                className="flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                style={{
                  background:
                    "linear-gradient(135deg, #474EAD 0%, #272668 100%)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <Sparkles className="h-4 w-4" />
                Chat with Vanessa
              </button>

              <Link
                href="/lead-intake"
                className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-[#474EAD] hover:text-[#474EAD] transition-all"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Talk to a Human Expert
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer variant="dark-gradient" separator />
    </div>
  );
}
