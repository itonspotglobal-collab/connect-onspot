import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Clock, CheckCircle2, Zap, Shield, Target, Award,
  ChevronRight, Sparkles, LayoutGrid, UserCircle2, Flag,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PILOT_CONFIG, DEFAULT_PILOT_ID, trackPilotActivity } from "@/lib/pilotConfig";

// ─── Static data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Executive Assistants",
  "Customer Support",
  "Sales Development",
  "Marketing",
  "Operations",
  "Bookkeeping",
  "Design",
  "Recruitment",
];

const TALENT = [
  {
    name: "Executive Assistant",
    family: "Executive Assistants",
    summary: "Inbox, calendar, travel, and daily operations support for fast-moving founders and teams.",
    seniority: "Mid",
    coverage: "Full-time",
    tools: ["Google Workspace", "Notion", "Slack"],
    industry: ["SaaS", "Agency", "E-commerce"],
    problemTags: ["calendar", "inbox", "admin", "coordination", "founder support"],
  },
  {
    name: "Customer Support Specialist",
    family: "Customer Support",
    summary: "Voice, chat, and email support with strong empathy and structured customer handling.",
    seniority: "Mid",
    coverage: "Full-time",
    tools: ["Zendesk", "Intercom", "Gorgias"],
    industry: ["E-commerce", "Fintech", "SaaS"],
    problemTags: ["support", "tickets", "chat", "email", "customer service"],
  },
  {
    name: "Sales Development Representative",
    family: "Sales Development",
    summary: "Lead generation, prospecting, pipeline follow-up, and CRM discipline for growth teams.",
    seniority: "Mid",
    coverage: "Full-time",
    tools: ["HubSpot", "Apollo", "Salesforce"],
    industry: ["SaaS", "Agency", "B2B Services"],
    problemTags: ["leads", "pipeline", "outbound", "prospecting", "crm"],
  },
  {
    name: "Operations Coordinator",
    family: "Operations",
    summary: "Back-office execution, workflow coordination, SOP support, and process reliability.",
    seniority: "Mid",
    coverage: "Full-time",
    tools: ["Airtable", "ClickUp", "Sheets"],
    industry: ["Logistics", "Agency", "Healthcare"],
    problemTags: ["process", "operations", "sops", "coordination", "admin"],
  },
  {
    name: "Bookkeeper",
    family: "Bookkeeping",
    summary: "Monthly reconciliation, AP/AR support, reporting prep, and cleaner financial visibility.",
    seniority: "Senior",
    coverage: "Part-time",
    tools: ["Xero", "QuickBooks", "Excel"],
    industry: ["E-commerce", "Professional Services", "Real Estate"],
    problemTags: ["reconciliation", "books", "finance", "ap", "ar"],
  },
  {
    name: "Creative Designer",
    family: "Design",
    summary: "Ads, social creatives, decks, and brand assets built for fast-moving teams.",
    seniority: "Mid",
    coverage: "Project-based",
    tools: ["Figma", "Adobe CC", "Canva"],
    industry: ["E-commerce", "Agency", "Media"],
    problemTags: ["creative", "design", "branding", "ads", "social"],
  },
];

const DEFAULT_SUGGESTIONS = [
  "I need someone to manage my inbox and calendar daily",
  "Handle customer support for my e-commerce store",
  "Build and manage my outbound sales pipeline",
  "Keep my books clean and ready every month",
];

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  "Executive Assistants": [
    "I need help managing my inbox and calendar",
    "I want someone to organize my daily priorities",
  ],
  "Customer Support": [
    "Handle customer chats and emails for my store",
    "Improve response time and customer satisfaction",
  ],
  "Sales Development": [
    "Generate and qualify leads for my business",
    "Build a consistent outbound pipeline",
  ],
  "Marketing": [
    "Execute my marketing campaigns and reporting",
    "Manage social content and scheduling",
  ],
  "Operations": [
    "Fix and organize my internal workflows",
    "Help me build scalable processes",
  ],
  "Bookkeeping": [
    "Keep my finances clean and reconciled monthly",
    "Manage my books and financial reports",
  ],
  "Design": [
    "Create ads and visuals that convert",
    "Design assets for my brand and campaigns",
  ],
  "Recruitment": [
    "Help me hire and screen candidates fast",
    "Build a pipeline of qualified talent",
  ],
};

const ALL_COVERAGE = ["All", "Full-time", "Part-time", "Project-based"];
const ALL_SENIORITY = ["All", "Junior", "Mid", "Senior"];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Tell us who you need",
    body: "Start with the role, skill, or outcome you need. You can search by job title or describe the business problem you want solved.",
  },
  {
    step: "02",
    title: "Review your best matches",
    body: "See high-fit talent based on your search so you can evaluate the strongest options quickly, without wasting time on low-fit profiles.",
  },
  {
    step: "03",
    title: "Shortlist and hire with confidence",
    body: "Move from search to shortlist with clarity, then take the next step toward hiring with speed and confidence.",
  },
];

const WHY_IT_WORKS = [
  "Find stronger-fit talent based on what your business actually needs",
  "Spend less time screening and more time meeting serious candidates",
  "Stay in control with flexible search tools that help you narrow faster",
  "Move from search to shortlist faster without unnecessary complexity",
];

const BUILT_FOR_ACTION = [
  "Start with a simple search and get to relevant talent quickly.",
  "Use guided suggestions to sharpen what you need and uncover stronger matches.",
  "Refine only when needed, so the experience stays fast and focused.",
  "Take action on any device with a clean and responsive hiring experience.",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-primary"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HireTalentPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [coverage, setCoverage] = useState("All");
  const [seniority, setSeniority] = useState("All");
  const [clickedSuggestions, setClickedSuggestions] = useState<Record<string, number>>({});
  const [previewReady, setPreviewReady] = useState(false);
  const [shortlistGenerated, setShortlistGenerated] = useState(false);

  // ── localStorage persistence for suggestion click tracking ───────────────
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("onspot-hire-talent-suggestion-clicks");
      if (saved) setClickedSuggestions(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "onspot-hire-talent-suggestion-clicks",
        JSON.stringify(clickedSuggestions)
      );
    } catch {
      // ignore
    }
  }, [clickedSuggestions]);

  // ── Debounced preview readiness ──────────────────────────────────────────
  useEffect(() => {
    if (!query && coverage === "All" && seniority === "All" && activeCategory === "All") {
      setPreviewReady(false);
      return;
    }
    setPreviewReady(false);
    const timer = window.setTimeout(() => setPreviewReady(true), 650);
    return () => window.clearTimeout(timer);
  }, [query, coverage, seniority, activeCategory]);

  // ── Derived values ───────────────────────────────────────────────────────
  const searchTokens = query.toLowerCase().trim();
  const isSearching =
    query.length > 0 || activeCategory !== "All" || coverage !== "All" || seniority !== "All";

  // Suggested searches — sorted by click frequency, filtered to active category
  const suggestedSearches = useMemo(() => {
    let base = DEFAULT_SUGGESTIONS;
    if (activeCategory !== "All" && CATEGORY_SUGGESTIONS[activeCategory]) {
      base = CATEGORY_SUGGESTIONS[activeCategory];
    }
    if (query) {
      const filtered = base.filter((item) =>
        item.toLowerCase().includes(query.toLowerCase())
      );
      if (filtered.length) base = filtered;
    }
    return [...base].sort((a, b) => {
      const diff = (clickedSuggestions[b] || 0) - (clickedSuggestions[a] || 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }, [activeCategory, query, clickedSuggestions]);

  // Filtered talent list
  const filteredTalent = useMemo(() => {
    return TALENT.filter((item) => {
      const matchesQuery =
        !searchTokens ||
        item.name.toLowerCase().includes(searchTokens) ||
        item.family.toLowerCase().includes(searchTokens) ||
        item.summary.toLowerCase().includes(searchTokens) ||
        item.problemTags.some((tag) => tag.includes(searchTokens)) ||
        item.industry.some((ind) => ind.toLowerCase().includes(searchTokens)) ||
        item.tools.some((tool) => tool.toLowerCase().includes(searchTokens));

      const matchesCategory = activeCategory === "All" || item.family === activeCategory;
      const matchesCoverage = coverage === "All" || item.coverage === coverage;
      const matchesSeniority = seniority === "All" || item.seniority === seniority;

      return matchesQuery && matchesCategory && matchesCoverage && matchesSeniority;
    });
  }, [searchTokens, activeCategory, coverage, seniority]);

  const topMatches = filteredTalent.slice(0, 3);

  // Context-aware assistant label for the "Got it" prompt
  const assistantLabel = useMemo(() => {
    const lower = query.toLowerCase();
    if (lower.includes("support")) return "a Customer Support Specialist";
    if (lower.includes("sales") || lower.includes("pipeline") || lower.includes("lead"))
      return "a Sales Development Representative";
    if (lower.includes("book") || lower.includes("reconciliation") || lower.includes("finance"))
      return "a Bookkeeper";
    if (lower.includes("calendar") || lower.includes("inbox") || lower.includes("assistant"))
      return "an Executive Assistant";
    return "the right talent";
  }, [query]);

  // ── Pilot tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    trackPilotActivity("viewedHireTalent");
  }, []);

  // Scroll to #top-matches after React renders (browser's native hash scroll fires before the SPA renders)
  useEffect(() => {
    if (window.location.hash === "#top-matches") {
      const el = document.getElementById("top-matches");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      trackPilotActivity("searchedTalent");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [query]);

  // ── Navigate to Talent Pool with current search params ───────────────────
  function navigateToTalentPool() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (activeCategory !== "All") params.set("category", activeCategory);
    if (coverage !== "All") params.set("coverage", coverage);
    if (seniority !== "All") params.set("seniority", seniority);
    const qs = params.toString();
    navigate(qs ? `/talent-pool?${qs}` : "/talent-pool");
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const clearFilters = () => {
    setQuery("");
    setActiveCategory("All");
    setCoverage("All");
    setSeniority("All");
    setShortlistGenerated(false);
  };

  const handleSuggestionClick = (value: string) => {
    setQuery(value);
    setClickedSuggestions((prev) => ({ ...prev, [value]: (prev[value] || 0) + 1 }));
    setShortlistGenerated(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        {/* Radial gradient wash */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_35%),radial-gradient(circle_at_80%_0%,hsl(var(--primary)/0.07),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center lg:px-8 lg:py-24">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary" className="px-4 py-1.5 text-sm font-medium">
              Hire Talent
            </Badge>
            <Badge className="gap-1.5 rounded-full bg-[#3F4698]/10 px-4 py-1.5 text-sm font-medium text-[#3F4698] hover:bg-[#3F4698]/10">
              <Flag className="h-3.5 w-3.5" />
              {PILOT_CONFIG.brandPromise}
            </Badge>
          </div>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl lg:text-[3.5rem] lg:leading-tight">
            Hire on the spot.{" "}
            <span className="text-primary">Build with confidence.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Build teams with confidence. Manage your workforce without limits — from first search to a shortlist-ready hire.
          </p>

          {/* Search box */}
          <div className="mx-auto mt-10 max-w-3xl rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <textarea
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShortlistGenerated(false);
                  }}
                  rows={2}
                  className="min-h-[72px] flex-1 resize-none bg-transparent text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Tell us what you need… e.g. I need someone to handle customer support for my e-commerce store"
                />
                <Button className="self-end rounded-2xl shadow-md" size="sm" onClick={navigateToTalentPool}>
                  Find talent
                </Button>
              </div>

              {/* Quick-fill chips — shown only when query is empty */}
              {!query && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "Manage my inbox and calendar",
                    "Customer support for e-commerce",
                    "Outbound sales support",
                    "Monthly bookkeeping",
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => handleSuggestionClick(item)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary/25 hover:text-primary"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="rounded-2xl px-6 shadow-lg"
              onClick={navigateToTalentPool}
            >
              Hire on the spot
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-2xl px-6 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                trackPilotActivity("requestedShortlist");
                setShortlistGenerated(true);
              }}
            >
              Request a shortlist
            </Button>
            {isAuthenticated && user?.role === "client" && (
              <Button
                size="lg"
                variant="outline"
                className="rounded-2xl px-6"
                onClick={() => navigate("/client-profile")}
              >
                <UserCircle2 className="w-4 h-4 mr-2" />
                My Client Profile
              </Button>
            )}
          </div>

          {/* Trust sub-copy */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span>No long forms</span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
            <span>Shortlist-ready talent</span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
            <span>Built for fast hiring decisions</span>
          </div>
        </div>
      </section>

      {/* ── Saddleman Pilot Banner ───────────────────────────────────────── */}
      <div className="border-b border-[#3F4698]/10 bg-[#3F4698]/[0.04]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3.5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-[#3F4698]">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{PILOT_CONFIG.pilotName} Pilot</span>
              <span className="text-slate-400">·</span>
              <span className="font-medium">{PILOT_CONFIG.brandPromise}</span>
            </div>
            <p className="text-sm text-slate-500">
              {PILOT_CONFIG.clientMessage}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-[#3F4698] text-white hover:bg-[#3F4698]/90"
              onClick={navigateToTalentPool}
            >
              Continue {PILOT_CONFIG.pilotName} pilot
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-[#3F4698]/30 text-[#3F4698]"
              onClick={() => navigate(`/pilot/${DEFAULT_PILOT_ID}`)}
            >
              View pilot activity
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-[#3F4698]/30 text-[#3F4698]"
              onClick={() => {
                trackPilotActivity("requestedShortlist");
                setShortlistGenerated(true);
              }}
            >
              Request {PILOT_CONFIG.pilotName} shortlist
            </Button>
          </div>
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            How it works
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Go from need to hire in three simple steps.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            From the moment you search to the moment you shortlist, the experience is designed to help you act quickly and hire with confidence.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <Card
              key={step}
              className="hover-elevate rounded-[28px] border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition-all duration-300"
            >
              <CardContent className="p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                  {step}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Top Matches + Filters ─────────────────────────────────────────── */}
      <section id="top-matches" className="mx-auto max-w-7xl px-6 py-4 pb-16 lg:px-8">
        <Card className="rounded-[30px] border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <CardContent className="p-6 lg:p-8">

            {/* Header row */}
            <div className="flex flex-col gap-6 border-b border-slate-100 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Top matches
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                  Top talent ready for your next hire.
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <p className="max-w-xs text-sm leading-7 text-slate-600">
                  {filteredTalent.length} result{filteredTalent.length === 1 ? "" : "s"} based on your current search and filters.
                </p>
                {isSearching && (
                  <button
                    onClick={clearFilters}
                    className="shrink-0 text-sm font-semibold text-primary hover:underline underline-offset-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Category chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory("All")}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  activeCategory === "All"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-primary"
                }`}
              >
                <LayoutGrid className="h-3 w-3" />
                All roles
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-primary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Coverage + Seniority filters */}
            <div className="mt-4 flex flex-wrap gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Coverage:</span>
                {ALL_COVERAGE.map((item) => (
                  <FilterPill
                    key={item}
                    label={item}
                    active={coverage === item}
                    onClick={() => setCoverage(item)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Seniority:</span>
                {ALL_SENIORITY.map((item) => (
                  <FilterPill
                    key={item}
                    label={item}
                    active={seniority === item}
                    onClick={() => setSeniority(item)}
                  />
                ))}
              </div>
            </div>

            {/* ── Contextual assistant panel (shown when query is active) ── */}
            {query && (
              <div className="mt-6 space-y-3">
                {/* Intent confirmation */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                  <span className="font-semibold">Got it.</span> You're looking for {assistantLabel}.{" "}
                  <span className="text-slate-600">Showing best matches for your needs.</span>
                </div>

                {/* Refine panel */}
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                  <CardContent className="p-4 text-sm">
                    <p className="font-medium text-slate-800">Let's refine this quickly:</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Full-time", "Part-time", "Project-based"].map((item) => (
                        <FilterPill
                          key={item}
                          label={item}
                          active={coverage === item}
                          onClick={() => setCoverage(item)}
                        />
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Junior", "Mid", "Senior"].map((item) => (
                        <FilterPill
                          key={item}
                          label={item}
                          active={seniority === item}
                          onClick={() => setSeniority(item)}
                        />
                      ))}
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-medium text-slate-500">When do you need them?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["Immediately", "Within 2 weeks", "Flexible"].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-500">Timezone preference</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["US", "EU", "APAC", "Flexible"].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-primary/5 p-3 text-xs text-primary">
                      We can prepare a shortlist based on your inputs.
                    </div>

                    {/* Generate shortlist row */}
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">Summary:</span> {query || "Your need"}
                        {coverage !== "All" ? ` · ${coverage}` : ""}
                        {seniority !== "All" ? ` · ${seniority}` : ""}
                      </p>
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setShortlistGenerated(true)}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Generate shortlist
                      </Button>
                    </div>

                    {/* Shortlist preview */}
                    {shortlistGenerated && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">Sample candidates preview</p>
                          <p className="text-[11px] text-slate-400">
                            {previewReady ? "Preview ready" : "Loading matches…"}
                          </p>
                        </div>

                        {!previewReady ? (
                          // Skeleton state
                          <div className="space-y-2">
                            {[0, 1].map((i) => (
                              <div
                                key={i}
                                className="flex animate-pulse items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-lg bg-slate-200" />
                                  <div>
                                    <div className="h-3 w-28 rounded bg-slate-200" />
                                    <div className="mt-2 h-2.5 w-16 rounded bg-slate-100" />
                                  </div>
                                </div>
                                <div className="h-3 w-10 rounded bg-slate-200" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Actual matches
                          <div className="space-y-2">
                            {topMatches.slice(0, 2).map((role) => (
                              <div
                                key={role.name}
                                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-primary/20"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                                    {getInitials(role.name)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-slate-800">{role.name}</p>
                                    <p className="text-[11px] text-slate-500">{role.coverage}</p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-primary">Match</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Talent cards ─────────────────────────────────────────────── */}
            {topMatches.length > 0 ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {topMatches.map((role) => (
                  <div
                    key={role.name}
                    className="group rounded-[24px] border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 font-semibold text-primary">
                        {getInitials(role.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-base font-semibold text-slate-900">{role.name}</p>
                            <p className="text-xs text-slate-500">{role.family}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-primary">Available now</p>
                            <p className="text-xs text-slate-400">{role.coverage}</p>
                          </div>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-600">{role.summary}</p>

                        {/* Tool tags */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {role.tools.slice(0, 3).map((tool) => (
                            <span
                              key={tool}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            Pre-vetted by OnSpot
                          </div>
                          <button className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                            Shortlist
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                No exact match yet. Try a broader search like "customer support for e-commerce" or remove one filter.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Suggested searches ──────────────────────────────────────────── */}
        <div className="mt-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Suggested searches
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              Start with your hiring need. We'll guide you to the right talent.
            </h2>
          </div>
          <p className="max-w-md text-base leading-8 text-slate-600 md:text-right">
            Whether you know the exact role or just the outcome you want, begin with a simple search. The experience helps you quickly uncover relevant talent profiles.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {suggestedSearches.map((item) => (
            <button
              key={item}
              onClick={() => handleSuggestionClick(item)}
              className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary hover:shadow-sm"
            >
              {item}
              {(clickedSuggestions[item] || 0) > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {clickedSuggestions[item]}×
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── CTA card ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-4 pb-20 text-center lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-10 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <h2 className="text-3xl font-bold text-slate-950 md:text-4xl">
            Ready to hire the right talent?
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Tell us what you need and we'll prepare a shortlist of high-fit candidates for you, so you can move faster and hire with confidence.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="rounded-2xl px-6 shadow-lg"
              onClick={() => navigate("/lead-intake")}
            >
              Request a shortlist
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl px-6"
              onClick={() => navigate("/lead-intake")}
            >
              Talk to a hiring specialist
            </Button>
          </div>
        </div>
      </section>

      {/* ── Why it works + Built for action ──────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">

            {/* Left — dark card */}
            <div className="rounded-[28px] bg-slate-950 p-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)]">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                Why this works
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
                Everything here is built to help you take action and hire with confidence.
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {WHY_IT_WORKS.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/80"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — light card */}
            <Card className="rounded-[28px] border-slate-200">
              <CardContent className="p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Built for hiring action
                </p>
                <div className="mt-5 space-y-4">
                  {BUILT_FOR_ACTION.map((item, i) => (
                    <div
                      key={item}
                      className="flex gap-4 rounded-2xl bg-slate-50 px-4 py-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white">
                        {i + 1}
                      </div>
                      <p className="text-sm leading-7 text-slate-600">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

    </div>
  );
}
