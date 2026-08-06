import { useState, useMemo } from "react";
import { ChevronDown, Search, MessageCircle, ArrowRight, Sparkles, BookOpen, Users, DollarSign, Cpu, Rocket } from "lucide-react";
import { useVanessa } from "@/contexts/VanessaContext";
import { Link } from "wouter";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: FAQItem[];
}

const categories: FAQCategory[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    icon: Rocket,
    color: "indigo",
    items: [
      {
        q: "What is OnSpot?",
        a: "OnSpot is a workforce system that connects companies with vetted, accountable talent — without the chaos of a freelance marketplace or the overhead of a traditional outsourcing firm. We match businesses with elite, pre-vetted talent — primarily from the Philippines — and wrap it with AI tools, performance management, and full operational support. Whether you need one specialist or an entire team, OnSpot makes hiring global talent simple, fast, and accountable.",
      },
      {
        q: "How does the outsourcing process work?",
        a: "It starts with a short discovery call where we understand your goals, budget, and team needs. From there, our talent team sources and screens candidates, presents shortlisted profiles, and you interview the top picks. Once selected, we handle onboarding, tooling setup, and ongoing management. Most clients are fully operational within 2–4 weeks.",
      },
      {
        q: "How long does it take to get started?",
        a: "Our average time-to-match is 72 hours for sourcing. Full onboarding — including role briefing, candidate interviews, and system setup — typically takes 1–2 weeks. For Managed Services where we build a dedicated team, expect 2–4 weeks to be fully operational.",
      },
      {
        q: "What makes OnSpot different from a staffing agency?",
        a: "Traditional staffing agencies place talent and walk away. OnSpot stays involved: we provide performance tracking, compliance oversight, payroll management, AI-powered tools like Vanessa, and regular QA reviews. We're a long-term partner in your operations — not just a recruiter.",
      },
      {
        q: "Do I need to sign a long-term contract to get started?",
        a: "No lengthy lock-ins required. We offer flexible engagement models including monthly rolling contracts, project-based engagements, and longer-term retainers. We believe in earning your business every month through results.",
      },
    ],
  },
  {
    id: "for-companies",
    label: "For Companies",
    icon: Users,
    color: "violet",
    items: [
      {
        q: "What types of roles can I outsource through OnSpot?",
        a: "OnSpot covers a wide range of roles including: Customer Support & Service Desk, Virtual Assistants & Executive Assistants, Recruitment & HR Operations, Social Media Management & Content, Bookkeeping & Finance Operations, Software Development & QA, Data Entry & Back-Office Processing, Digital Marketing & SEO, Sales Development Representatives, and more. If the role can be done remotely, we can source it.",
      },
      {
        q: "How quickly can I hire talent?",
        a: "Our pre-screened talent network allows us to present initial candidates within 24–72 hours of your role brief. Most clients complete interviews and make a hire within 5–10 business days. For more specialized or senior roles, allow 2–3 weeks for the search.",
      },
      {
        q: "Do I manage the talent directly, or does OnSpot manage them?",
        a: "That depends on the model you choose. With Resourced Services, talent integrates directly into your team and you manage them day-to-day — we handle compliance, payroll, and HR. With Managed Services, OnSpot takes full ownership of operations, performance, and team management. You set the goals; we drive the results.",
      },
      {
        q: "How is performance monitored and guaranteed?",
        a: "All OnSpot engagements include KPI tracking, daily activity reports, weekly performance reviews, and monthly QA audits. For Managed Services clients, you get a dedicated Account Manager and access to our operations dashboard. We proactively address performance issues — you're never left managing problems alone.",
      },
      {
        q: "What happens if a hire doesn't work out?",
        a: "We offer a replacement guarantee. If a placed professional isn't a fit within the first 90 days, we'll source and place a replacement at no additional fee. Beyond that period, replacements are handled swiftly at cost — typically within 2 weeks.",
      },
    ],
  },
  {
    id: "for-professionals",
    label: "For Professionals",
    icon: BookOpen,
    color: "teal",
    items: [
      {
        q: "How do I apply to work through OnSpot?",
        a: "Visit the Find Work page and complete the Candidate Matching Journey — a short, guided process that captures your skills, work preferences, experience, and culture fit. Once your profile is saved, our talent team reviews it and matches you with relevant opportunities. Strong profiles are often contacted within a few days.",
      },
      {
        q: "Is it free to join the OnSpot talent network?",
        a: "Yes — joining the talent network is completely free for professionals. There are no registration fees, placement fees, or hidden charges. OnSpot earns from the client side, not from the talent side.",
      },
      {
        q: "What types of jobs are available?",
        a: "We have roles across Customer Support, Admin & Operations, Recruitment, Accounting, Software Development, Digital Marketing, Content Creation, Social Media, Data Analytics, and more. Most roles are fully remote and offer flexible work setups.",
      },
      {
        q: "Do I need to be based in the Philippines?",
        a: "While OnSpot's primary talent pool is Philippine-based, we do place professionals from other countries for select roles. Most of our clients specifically value Filipino talent for its strong work ethic, English proficiency, and cultural alignment. Check the Find Work page for current openings and eligibility.",
      },
      {
        q: "How and when do I get paid?",
        a: "Pay is processed bi-weekly or monthly depending on your engagement type. OnSpot handles payroll through compliant local channels. Rates are agreed upfront and reflected in your contract. We also ensure all statutory contributions and benefits are properly handled.",
      },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    color: "amber",
    items: [
      {
        q: "How much does OnSpot cost?",
        a: "Pricing varies based on the model and role level. As a general guide: Resourced Services (direct talent placement) typically runs $8–$25/hour depending on the role. Managed Services (full team + operations management) is project/scope-based with a management fee on top of talent costs. Contact us for a custom quote tailored to your headcount and needs.",
      },
      {
        q: "What is the difference between Managed and Resourced services?",
        a: "Resourced Services: You get pre-vetted talent that integrates into your existing team. You manage them; OnSpot handles HR, compliance, and payroll. Best for businesses with operational capacity who need skilled staff fast.\n\nManaged Services: OnSpot builds, trains, and fully manages your offshore team. We own performance, quality, and operations. Best for businesses that want to outsource an entire function without managing it internally.",
      },
      {
        q: "Are there setup fees or hidden costs?",
        a: "No setup fees for standard Resourced placements. Managed Services may include a one-time implementation fee for large or complex team setups. All costs are disclosed upfront in your service agreement — no surprise invoices.",
      },
      {
        q: "Can I scale my team up or down?",
        a: "Yes. OnSpot is designed for flexibility. You can add headcount as your business grows or reduce during slower periods with appropriate notice periods outlined in your contract. We accommodate seasonal scaling as well.",
      },
      {
        q: "Is there a free trial or pilot option?",
        a: "We offer pilot engagements for qualified clients — typically a 30-day trial with one or two talent members at a reduced rate. This lets you validate fit before committing to a larger team. Ask our team about current pilot availability when you book a discovery call.",
      },
    ],
  },
  {
    id: "ai-tech",
    label: "AI & Technology",
    icon: Cpu,
    color: "blue",
    items: [
      {
        q: "What is Vanessa, the AI Assistant?",
        a: "Vanessa is OnSpot's AI-powered Virtual Assistant, built on OpenAI's GPT-4o. She's trained on OnSpot's knowledge base, client FAQs, service documentation, and team expertise. Vanessa can answer questions about outsourcing, help you navigate the platform, assist with job matching, and even handle scheduling. She's available 24/7 via the chat widget on every page.",
      },
      {
        q: "What integrations does OnSpot support?",
        a: "OnSpot integrates with a growing list of tools including: Microsoft 365, Go High Level (CRM), QuickBooks (accounting), AWS, Stripe (payments), BambooHR, Lindy AI, and more. Our team also supports custom integrations for enterprise clients. Ask about your specific stack during onboarding.",
      },
      {
        q: "Is my data and information secure?",
        a: "Yes. OnSpot uses industry-standard encryption for all data in transit and at rest. Client data, candidate profiles, and conversation histories are stored securely and never shared with third parties. AI conversations with Vanessa are private to your session. We are committed to full GDPR and data protection compliance.",
      },
      {
        q: "What is the AI + Human model?",
        a: "The AI + Human model is OnSpot's core philosophy: AI handles speed, scale, and pattern recognition — humans bring judgment, empathy, and accountability. Practically, this means Vanessa automates routine questions and coordination while our managers and specialists handle complex decisions, client relationships, and performance issues. Neither alone is enough; together they're superhuman.",
      },
      {
        q: "Can Vanessa be trained on my company's specific knowledge?",
        a: "Vanessa's training is continuously updated by the OnSpot team through our proprietary learning dashboard. For enterprise clients, we can configure Vanessa with client-specific context, workflows, and FAQs. Contact us to discuss custom AI assistant configurations for your team.",
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`border-b border-slate-200 last:border-0 transition-colors ${isOpen ? "bg-indigo-50/40" : ""}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 py-5 px-6 text-left transition-colors hover:bg-slate-50/80"
      >
        <span className={`text-base font-medium leading-snug ${isOpen ? "text-indigo-700" : "text-slate-800"}`}>
          {item.q}
        </span>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-indigo-500" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <p className="px-6 pb-5 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{item.a}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const { openVanessa } = useVanessa();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return categories
      .filter((cat) => activeCategory === "all" || cat.id === activeCategory)
      .map((cat) => ({
        ...cat,
        items: q
          ? cat.items.filter((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
          : cat.items,
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search, activeCategory]);

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-600",
    violet: "bg-violet-100 text-violet-600",
    teal: "bg-teal-100 text-teal-700",
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#3A3AF8] via-[#5B30F6] to-[#7F3DF4] py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
            Help Center
          </p>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-white leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 max-w-2xl mx-auto">
            Everything you need to know about OnSpot. Can't find an answer?{" "}
            <button onClick={openVanessa} className="underline underline-offset-2 text-white hover:text-white/80 transition-colors">
              Ask Vanessa
            </button>
            .
          </p>

          {/* Search */}
          <div className="mt-10 relative mx-auto max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-5 text-base text-slate-800 shadow-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
            <button
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ content */}
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-lg">No results for "{search}"</p>
            <button
              onClick={openVanessa}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Ask Vanessa instead
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filtered.map((cat) => (
              <section key={cat.id} id={cat.id}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorMap[cat.color]}`}>
                    <cat.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">{cat.label}</h2>
                </div>

                {/* Accordion */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  {cat.items.map((item, idx) => {
                    const key = `${cat.id}-${idx}`;
                    return (
                      <AccordionItem
                        key={key}
                        item={item}
                        isOpen={!!openItems[key]}
                        onToggle={() => toggleItem(key)}
                      />
                    );
                  })}
                </div>

                {/* Per-category Vanessa CTA */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={openVanessa}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ask Vanessa about {cat.label.toLowerCase()}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Still have questions CTA */}
      <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50 border-t border-slate-200 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <h2 className="mt-6 text-2xl sm:text-3xl font-semibold text-slate-900">
              Still have questions?
            </h2>
            <p className="mt-3 text-base text-slate-600 max-w-lg mx-auto">
              Vanessa is available 24/7 to answer any question about OnSpot — from pricing to process to finding your next hire.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={openVanessa}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
              >
                <Sparkles className="h-4 w-4" />
                Chat with Vanessa
              </button>
              <Link
                href="/lead-intake"
                className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700 transition-all"
              >
                Talk to a Human Expert
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
