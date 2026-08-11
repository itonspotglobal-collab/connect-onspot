import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ArrowRight, Check, X, Star } from "lucide-react";
import { Footer } from "@/components/Footer";

// ── Reference design tokens (exact from reference site) ───────────────────────
const C = {
  purple:       "#474EAD",
  purpleDark:   "#383E8C",
  purpleDeep:   "#2E3170",
  purpleLight:  "#7B81D4",
  lavender:     "#EEEDFB",
  lavender2:    "#E1DFF7",
  cream:        "#FDF1DE",
  gold:         "#F5A623",
  goldLight:    "#FFC968",
  goldDeep:     "#A06C00",
  charcoal:     "#15151A",
  gray700:      "#46464C",
  gray500:      "#7A7A82",
  line:         "#E9E9EF",
  navy:         "#11194F",
  navyDeep:     "#0C123F",
  navyDarkest:  "#14142B",
  lavenderSoft: "#F1F0FF",
  warmLight:    "#FFF9EF",
};

const SLIDE_MS = 6000;

// ── Slide backgrounds ─────────────────────────────────────────────────────────
const BG = {
  work:      `linear-gradient(145deg, ${C.navyDarkest} 0%, #0f0f2e 60%, #1a1050 100%)`,
  companies: `radial-gradient(circle at 82% 20%, rgba(71,78,173,0.1), transparent 45%), linear-gradient(140deg, ${C.warmLight} 0%, #f5f2ff 100%)`,
  talent:    `radial-gradient(circle at 78% 18%, rgba(71,78,173,0.4), transparent 46%), radial-gradient(circle at 12% 85%, rgba(245,166,35,0.09), transparent 42%), linear-gradient(140deg, ${C.navyDeep} 0%, #12163A 100%)`,
  network:   `radial-gradient(circle at 82% 20%, rgba(71,78,173,0.1), transparent 45%), linear-gradient(140deg, ${C.warmLight} 0%, #f0eeff 100%)`,
  jobs:      `radial-gradient(circle at 80% 15%, rgba(245,166,35,0.1), transparent 45%), radial-gradient(circle at 10% 90%, rgba(71,78,173,0.35), transparent 50%), linear-gradient(150deg, ${C.navyDeep} 0%, #0a0e2a 100%)`,
};

// ── Talent cards for network slide ────────────────────────────────────────────
const TALENT_CARDS = [
  { i: "KC", n: "Kim C.",    r: "Customer Support Specialist", sc: "4.9", yrs: "6 yrs" },
  { i: "RS", n: "Rafael S.", r: "Bookkeeper",                  sc: "4.8", yrs: "8 yrs" },
  { i: "AM", n: "Aira M.",   r: "Executive Assistant",         sc: "4.9", yrs: "5 yrs" },
  { i: "JP", n: "Jomar P.",  r: "Sales Development Rep",       sc: "4.7", yrs: "4 yrs" },
];

// ── Slides ────────────────────────────────────────────────────────────────────
const SLIDES = [
  { id: "work",      theme: "dark",  label: "Work Without Limits", eyebrow: null },
  { id: "companies", theme: "light", label: "For Companies",        eyebrow: "For Companies" },
  { id: "talent",    theme: "dark",  label: "For Talents",          eyebrow: "For Talents" },
  { id: "network",   theme: "light", label: "Talent Network",       eyebrow: "The Talent Network" },
  { id: "jobs",      theme: "dark",  label: "Open Jobs",            eyebrow: "For Talents" },
];

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div>
      <HeroSection />
      <ProblemSection />
      <BetterWaySection />
      <TalentTestimonialSection />
      <JobListingsSection />
      <ProcessSection />
      <EquationSection />
      <FounderQuoteSection />
      <CompanyTestimonialSection />
      <FinalCtaSection />
      <Footer />
    </div>
  );
}

// ── Eyebrow helper ────────────────────────────────────────────────────────────
function Eyebrow({
  text,
  dark = false,
}: {
  text: string;
  dark?: boolean;
}) {
  return (
    <p
      className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: dark ? "rgba(255,255,255,0.9)" : C.purple }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-[2px] w-4 rounded"
        style={{ background: C.gold }}
      />
      {text}
    </p>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. HERO SECTION
// ══════════════════════════════════════════════════════════════════════════════
function HeroSection() {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  const { data: rawJobs } = useQuery({
    queryKey: ["/api/jobs/search", { status: "open", page: 1 }],
    queryFn: async () => {
      const res = await fetch("/api/jobs/search?status=open&page=1&limit=3");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const heroJobs = (rawJobs ?? []).filter((j: any) => j.title?.toLowerCase() !== "test").slice(0, 3);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || hidden) return;
    const t = setTimeout(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, paused, hidden]);

  const prev = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % SLIDES.length);
  const active = SLIDES[slide];
  const isDark = active.theme === "dark";

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "calc(100dvh - 64px)", background: BG[active.id as keyof typeof BG], transition: "background 0.7s ease" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide content */}
      <div
        className="relative z-10 flex flex-col px-6 sm:px-10 lg:px-16 xl:px-20 pt-14 sm:pt-18 pb-28"
        style={{ minHeight: "calc(100dvh - 64px)" }}
      >
        <div key={`slide-${slide}`} style={{ animation: "homeHeroIn 0.5s ease forwards", opacity: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {active.id === "work" && <WorkSlide isDark={isDark} />}
          {active.id === "companies" && <CompaniesSlide isDark={isDark} />}
          {active.id === "talent" && <TalentSlide isDark={isDark} />}
          {active.id === "network" && <NetworkSlide isDark={isDark} />}
          {active.id === "jobs" && <JobsSlide isDark={isDark} heroJobs={heroJobs} />}
        </div>
      </div>

      {/* Carousel controls */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center gap-4 px-6 sm:px-10 lg:px-16 xl:px-20">
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:opacity-80 flex-shrink-0"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(71,78,173,0.3)",
            background: isDark ? "rgba(255,255,255,0.07)" : "rgba(71,78,173,0.07)",
          }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: isDark ? "white" : C.navy }} />
        </button>
        <button
          onClick={next}
          aria-label="Next slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:opacity-80 flex-shrink-0"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(71,78,173,0.3)",
            background: isDark ? "rgba(255,255,255,0.07)" : "rgba(71,78,173,0.07)",
          }}
        >
          <ChevronRight className="h-4 w-4" style={{ color: isDark ? "white" : C.navy }} />
        </button>

        {/* Counter */}
        <span className="font-semibold tabular-nums flex-shrink-0 text-sm" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(71,78,173,0.6)" }}>
          <span className="font-bold" style={{ fontSize: "1rem", color: isDark ? "white" : C.navy }}>
            {String(slide + 1).padStart(2, "0")}
          </span>
          {" / "}
          {String(SLIDES.length).padStart(2, "0")}
        </span>

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === slide ? 28 : 7,
                height: 4,
                borderRadius: 4,
                background: i === slide ? C.gold : isDark ? "rgba(255,255,255,0.25)" : "rgba(71,78,173,0.25)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.35s ease",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Slide: WORK (dark, centered) ──────────────────────────────────────────────
function WorkSlide({ isDark }: { isDark: boolean }) {
  return (
    <div className="mx-auto flex w-full flex-col items-center text-center" style={{ maxWidth: 900 }}>
      <h1
        className="font-bold tracking-tight text-white sm:whitespace-nowrap"
        style={{ fontSize: "clamp(2.4rem, 6.6vw, 6rem)", lineHeight: 1.04, letterSpacing: "-0.035em" }}
        data-testid="text-hero-headline-work"
      >
        Work{" "}
        <span style={{ color: C.goldLight }}>Without</span>
        {" "}Limits
      </h1>
      <p className="mx-auto mt-6 leading-relaxed" style={{ fontSize: "clamp(1rem, 2.2vw, 1.35rem)", color: "rgba(255,255,255,0.8)" }}>
        <span
          className="font-semibold"
          style={{
            backgroundImage: "linear-gradient(115deg, #FFFFFF 0%, #F3F1FF 38%, #C7CBF2 55%, #FFFFFF 78%, #E8E4FF 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 0 14px rgba(199,203,242,0.45))",
          }}
        >
          One system.
        </span>{" "}
        <span style={{ color: "rgba(255,255,255,0.65)" }}>Highest pay for talents at lower cost to companies.</span>
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/hire-talent"
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-white px-9 py-3.5 text-[15.5px] font-semibold transition-all duration-200 hover:-translate-y-[1px] hover:bg-white/95 sm:w-auto"
          style={{ color: C.purple, boxShadow: "0 16px 36px -12px rgba(10,10,60,0.45)" }}
          data-testid="link-hero-work-hire"
        >
          Hire talent →
        </Link>
        <Link
          href="/find-work/jobs"
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-9 py-3.5 text-[15.5px] font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] sm:w-auto"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.45)", backdropFilter: "blur(8px)" }}
          data-testid="link-hero-work-find-work"
        >
          Find work →
        </Link>
      </div>
    </div>
  );
}

// ── Slide: COMPANIES (light, 2-col) ───────────────────────────────────────────
function CompaniesSlide({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[46fr_44fr] lg:gap-16 w-full max-w-[1160px]">
      {/* Left: text */}
      <div>
        <Eyebrow text="For Companies" dark={isDark} />
        <h1
          className="mt-3 font-bold tracking-tight"
          style={{ fontSize: "clamp(2.4rem, 4.8vw, 4rem)", lineHeight: 1.05, letterSpacing: "-0.03em", color: C.charcoal }}
          data-testid="text-hero-headline-companies"
        >
          Hire{" "}
          <span style={{ color: C.purple }}>Without Limits.</span>
        </h1>
        <p className="mt-4 max-w-[500px] font-medium" style={{ fontSize: "clamp(1.1rem, 2vw, 1.45rem)", lineHeight: 1.4, color: C.charcoal }}>
          The best talents —{" "}
          <span className="font-bold" style={{ color: C.goldDeep }}>without the outsourcing overhead.</span>
        </p>
        <p className="mt-3 max-w-[460px] text-[15.5px] leading-relaxed" style={{ color: C.gray700 }}>
          Build the team you need without long hiring cycles, limited local talent pools, or traditional outsourcing complexity.
        </p>
        <div className="mt-8">
          <Link
            href="/hire-talent"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[10px] px-6 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] sm:w-auto"
            style={{ background: C.purple, boxShadow: "0 8px 20px rgba(71,78,173,0.28)" }}
            data-testid="link-hero-companies-hire"
          >
            Hire talent →
          </Link>
        </div>
      </div>

      {/* Right: dashboard mock */}
      <div className="lg:justify-self-end lg:w-full lg:max-w-[500px]">
        <div className="relative" data-testid="card-hero-companies">
          <div
            aria-hidden="true"
            className="absolute -inset-8 rounded-full"
            style={{ background: "radial-gradient(60% 55% at 50% 55%, rgba(71,78,173,0.14), transparent 70%)", filter: "blur(8px)" }}
          />
          <div
            className="relative rounded-[22px] p-[10px]"
            style={{ background: "linear-gradient(160deg, #2b2b30 0%, #1c1c1e 100%)", border: "1px solid rgba(255,255,255,0.16)", boxShadow: "0 30px 60px -28px rgba(24,28,74,0.45)" }}
          >
            {/* Top bar */}
            <div className="overflow-hidden rounded-[12px] bg-white">
              <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "#ECECF1" }}>
                <span className="text-[12px] font-bold" style={{ color: C.charcoal }}>OnSpot</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: C.gray500 }}>Gentech LLC</span>
                  <span aria-hidden="true" className="h-5 w-5 rounded-full" style={{ background: C.purpleLight }} />
                </span>
              </div>
              <div className="px-4 pb-4 pt-3">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <p className="text-[13px] font-bold" style={{ color: C.charcoal }}>Team dashboard</p>
                  <p className="text-[9px]" style={{ color: "#A1A1A8" }}>Last 6 months</p>
                </div>
                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Active", value: "12" },
                    { label: "Placed", value: "8" },
                    { label: "Roles", value: "3" },
                    { label: "Saved", value: "24%" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg px-2 py-1.5" style={{ background: "#EEEDFB", border: "1px solid rgba(71,78,173,0.2)" }}>
                      <p className="text-[7.5px] font-semibold uppercase tracking-wider" style={{ color: C.purple }}>{m.label}</p>
                      <p className="text-[14px] font-bold mt-0.5" style={{ color: C.charcoal }}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {/* Team member rows */}
                <div className="mt-3 space-y-1.5">
                  {[
                    { i: "AM", n: "Aira M.", r: "Exec. Assistant", s: "Active" },
                    { i: "RS", n: "Rafael S.", r: "Bookkeeper", s: "Active" },
                    { i: "KC", n: "Kim C.", r: "Support", s: "Starting" },
                  ].map((m) => (
                    <div key={m.i} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: "#F7F7FB" }}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: C.purple }}>{m.i}</div>
                        <div>
                          <p className="text-[10px] font-semibold leading-none" style={{ color: C.charcoal }}>{m.n}</p>
                          <p className="text-[8.5px] leading-none mt-0.5" style={{ color: C.gray500 }}>{m.r}</p>
                        </div>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[8px] font-semibold" style={{ background: "rgba(71,78,173,0.12)", color: C.purple }}>{m.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slide: TALENT (dark, 2-col) ───────────────────────────────────────────────
function TalentSlide({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[46fr_44fr] lg:gap-16 w-full max-w-[1160px]">
      {/* Left: text */}
      <div>
        <Eyebrow text="For Talents" dark={isDark} />
        <h1
          className="mt-3 font-bold tracking-tight text-white"
          style={{ fontSize: "clamp(2.4rem, 4.8vw, 4rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
          data-testid="text-hero-headline-talent"
        >
          Earn{" "}
          <span style={{ color: C.goldLight }}>Without Limits.</span>
        </h1>
        <p className="mt-4 max-w-[500px] font-medium text-white" style={{ fontSize: "clamp(1.1rem, 2vw, 1.45rem)", lineHeight: 1.4 }}>
          The best clients —{" "}
          <span className="font-bold" style={{ color: C.goldLight }}>the highest pay for the work you do.</span>
        </p>
        <p className="mt-3 max-w-[440px] text-[15.5px] leading-relaxed text-white/75">
          Work with great companies from wherever you call home, at the best rate, and get paid reliably.
        </p>
        <div className="mt-8">
          <Link
            href="/find-work/jobs"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[10px] border px-6 py-3 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-[1px] sm:w-auto"
            style={{ background: C.gold, borderColor: C.gold, color: C.purpleDeep, boxShadow: "0 8px 20px rgba(245,166,35,0.28)" }}
            data-testid="link-hero-talent-find-work"
          >
            Find work →
          </Link>
        </div>
      </div>

      {/* Right: phone mockup */}
      <div className="lg:justify-self-end lg:w-full lg:max-w-[440px]">
        <div className="relative mx-auto w-fit" data-testid="card-hero-talent">
          <div
            aria-hidden="true"
            className="absolute -inset-10 rounded-full"
            style={{ background: "radial-gradient(60% 55% at 50% 45%, rgba(245,166,35,0.18), transparent 70%)", filter: "blur(6px)" }}
          />
          <div
            className="relative w-[220px] sm:w-[248px] rounded-[36px] p-[8px]"
            style={{ background: "linear-gradient(160deg, #23264a 0%, #14162e 100%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 40px 80px -30px rgba(5,8,30,0.75)" }}
          >
            <div className="relative overflow-hidden rounded-[30px]" style={{ background: "#FFFFFF" }}>
              {/* App header */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#F0F0F5" }}>
                <p className="text-[11px] font-bold" style={{ color: C.charcoal }}>OnSpot Talent</p>
                <p className="text-[9px] mt-0.5" style={{ color: C.gray500 }}>Your earnings dashboard</p>
              </div>
              {/* Earnings card */}
              <div className="px-4 py-3">
                <div className="rounded-xl p-3 mb-2" style={{ background: C.purple }}>
                  <p className="text-[8px] font-semibold text-white/60 uppercase tracking-wider">This month</p>
                  <p className="text-[22px] font-bold text-white leading-none mt-1">$2,000</p>
                  <p className="text-[8px] text-white/60 mt-0.5">Full rate — nothing deducted</p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Platform fee", note: "Paid by client", val: "+$0" },
                    { label: "Your rate", note: "As agreed", val: "$2,000" },
                    { label: "Status", note: "", val: "✓ Paid" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-medium" style={{ color: C.charcoal }}>{r.label}</p>
                        {r.note && <p className="text-[8px]" style={{ color: C.gray500 }}>{r.note}</p>}
                      </div>
                      <p className="text-[10px] font-semibold" style={{ color: r.val.startsWith("+") ? "#2E7D32" : r.val === "✓ Paid" ? C.purple : C.charcoal }}>{r.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slide: NETWORK (light, 2-col) ─────────────────────────────────────────────
function NetworkSlide({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[46fr_44fr] lg:gap-16 w-full max-w-[1160px]">
      {/* Left: text */}
      <div>
        <Eyebrow text="The Talent Network" dark={isDark} />
        <h1
          className="mt-3 font-bold tracking-tight"
          style={{ fontSize: "clamp(2.4rem, 4.8vw, 4rem)", lineHeight: 1.05, letterSpacing: "-0.03em", color: C.charcoal }}
          data-testid="text-hero-headline-network"
        >
          Thousands of talents.{" "}
          <span style={{ color: C.purple }}>Ready to work.</span>
        </h1>
        <p className="mt-4 max-w-[500px] font-medium" style={{ fontSize: "clamp(1.1rem, 2vw, 1.45rem)", lineHeight: 1.4, color: C.charcoal }}>
          Vetted, experienced, and{" "}
          <span className="font-bold" style={{ color: C.goldDeep }}>ready to start in days — not months.</span>
        </p>
        <p className="mt-3 max-w-[460px] text-[15.5px] leading-relaxed" style={{ color: C.gray700 }}>
          Every professional in the network is screened for skills, experience, and reliability before you ever see them — so the match is fast and the quality holds.
        </p>
        <div className="mt-8">
          <Link
            href="/hire-talent"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[10px] px-6 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] sm:w-auto"
            style={{ background: C.purple, boxShadow: "0 8px 20px rgba(71,78,173,0.28)" }}
            data-testid="link-hero-network-hire"
          >
            Hire talent →
          </Link>
        </div>
      </div>

      {/* Right: talent cards */}
      <div className="lg:justify-self-end lg:w-full lg:max-w-[420px]" data-testid="card-hero-network">
        <div className="grid grid-cols-2 gap-3">
          {TALENT_CARDS.map((t) => (
            <div
              key={t.i}
              className="rounded-[14px] p-3.5"
              style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(71,78,173,0.15)", backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(71,78,173,0.08)" }}
            >
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white mb-2" style={{ background: C.purple }}>
                {t.i}
              </div>
              <p className="text-[11px] font-bold leading-tight" style={{ color: C.charcoal }}>{t.n}</p>
              <p className="text-[9.5px] leading-snug mt-0.5" style={{ color: C.gray500 }}>{t.r}</p>
              <div className="flex items-center gap-1 mt-2">
                <Star className="h-2.5 w-2.5" style={{ color: C.gold, fill: C.gold }} />
                <span className="text-[9px] font-semibold" style={{ color: C.charcoal }}>{t.sc}</span>
                <span className="text-[9px]" style={{ color: C.gray500 }}>· {t.yrs}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Slide: JOBS (dark, 2-col) ─────────────────────────────────────────────────
function JobsSlide({ isDark, heroJobs }: { isDark: boolean; heroJobs: any[] }) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[46fr_44fr] lg:gap-16 w-full max-w-[1160px]">
      {/* Left: text */}
      <div>
        <Eyebrow text="For Talents" dark={isDark} />
        <h1
          className="mt-3 font-bold tracking-tight text-white"
          style={{ fontSize: "clamp(2.4rem, 4.8vw, 4rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
          data-testid="text-hero-headline-jobs"
        >
          Hundreds of high-paying jobs.{" "}
          <span style={{ color: C.goldLight }}>Open right now.</span>
        </h1>
        <p className="mt-4 max-w-[500px] font-medium text-white" style={{ fontSize: "clamp(1.1rem, 2vw, 1.45rem)", lineHeight: 1.4 }}>
          Real roles, real rates —{" "}
          <span className="font-bold" style={{ color: C.goldLight }}>and new jobs opening every week.</span>
        </p>
        <p className="mt-3 max-w-[440px] text-[15.5px] leading-relaxed text-white/75">
          Set your rate and keep it. OnSpot's fee is added on top — never taken out of your pay.
        </p>
        <div className="mt-8">
          <Link
            href="/find-work/jobs"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[10px] border px-6 py-3 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-[1px] sm:w-auto"
            style={{ background: C.gold, borderColor: C.gold, color: C.purpleDeep, boxShadow: "0 8px 20px rgba(245,166,35,0.28)" }}
            data-testid="link-hero-jobs-browse"
          >
            Browse all jobs →
          </Link>
        </div>
      </div>

      {/* Right: job cards */}
      <div className="lg:justify-self-end lg:w-full lg:max-w-[460px]" data-testid="card-hero-jobs">
        <div
          className="relative overflow-hidden rounded-[18px]"
          style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(14px)", boxShadow: "0 40px 80px -30px rgba(5,8,30,0.6)" }}
        >
          <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "#ECECF1" }}>
            <span className="text-[13px] font-bold" style={{ color: C.charcoal }}>Open Roles</span>
            <Link href="/find-work/jobs" className="text-[11px] font-semibold underline-offset-4 hover:underline" style={{ color: C.goldLight }}>
              See all →
            </Link>
          </div>
          <div className="divide-y" style={{ divideColor: "#F0F0F5" }}>
            {heroJobs.length > 0 ? heroJobs.map((job: any) => (
              <Link href={`/jobs/${job.id}`} key={job.id}>
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F7F7FB] transition-colors cursor-pointer">
                  <div>
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: C.charcoal }}>{job.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.gray500 }}>
                      {[job.contractType, job.location].filter(Boolean).join(" · ") || "Full-time · Remote"}
                    </p>
                  </div>
                  {(job.budget || job.hourlyRateMin) && (
                    <span className="text-[11px] font-bold ml-3 flex-shrink-0" style={{ color: C.gold }}>
                      {job.budget ? `${job.budgetCurrency ?? "PHP"} ${job.budget}` : `$${job.hourlyRateMin}/hr`}
                    </span>
                  )}
                </div>
              </Link>
            )) : (
              <div className="px-5 py-4 text-center text-[12px]" style={{ color: C.gray500 }}>New roles posted weekly</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. PROBLEM SECTION
// ══════════════════════════════════════════════════════════════════════════════
function ProblemSection() {
  return (
    <section style={{ background: C.lavenderSoft }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow text="The Problem With Outsourcing Today" />
        <h2
          className="mt-4 font-bold leading-tight mb-4"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.navyDarkest, maxWidth: 700 }}
        >
          Outsourcing is broken. Both sides are paying for it.
        </h2>
        <p className="mb-12" style={{ color: C.gray700, fontSize: "1.05rem", maxWidth: 560 }}>
          A middleman sits between you — inflating what companies pay and shrinking what talent takes home.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Companies card */}
          <div className="rounded-2xl p-7 flex flex-col" style={{ background: C.navy }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.gold }}>FOR COMPANIES</p>
            <h3 className="font-bold text-white mb-6 leading-tight" style={{ fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)" }}>
              The 3 hidden costs of{" "}
              <span style={{ color: C.goldLight }}>the old way.</span>
            </h3>
            <ul className="space-y-4 flex-1">
              {[
                ["Slow Hiring", "Months to fill a role."],
                ["Limited Access", "Great talent stays out of reach."],
                ["Invisible Overhead", "You pay for costs you never see."],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <X className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }} />
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.95rem" }}>
                    <span className="text-white font-semibold">{title}</span> — {desc}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-7 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <p className="text-white font-semibold mb-3" style={{ fontSize: "0.95rem" }}>OnSpot removes all three.</p>
              <Link href="/hire-talent" className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: C.gold }}>
                Hire talent <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Talents card */}
          <div className="rounded-2xl p-7 flex flex-col" style={{ background: "white", border: "1px solid #D8DCF0" }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.gold }}>FOR TALENTS</p>
            <h3 className="font-bold mb-6 leading-tight" style={{ fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)", color: C.navyDarkest }}>
              The same system{" "}
              <span style={{ color: C.gold }}>costs you too.</span>
            </h3>
            <ul className="space-y-4 flex-1">
              {[
                ["Unpaid waiting", "months to get matched."],
                ["Bidding wars", "a race to the bottom."],
                ["Hidden markups", "cuts you never agreed to."],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <X className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(200,60,60,0.7)" }} />
                  <p style={{ color: C.gray700, fontSize: "0.95rem" }}>
                    <span className="font-semibold" style={{ color: C.navyDarkest }}>{title}</span> — {desc}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-7 pt-6 border-t border-[#D8DCF0]">
              <p className="font-semibold mb-3" style={{ color: C.navyDarkest, fontSize: "0.95rem" }}>At OnSpot, you get paid what you're worth.</p>
              <Link href="/find-work" className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: C.gold }}>
                Find work <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. BETTER WAY SECTION
// ══════════════════════════════════════════════════════════════════════════════
function BetterWaySection() {
  return (
    <section style={{ background: C.lavenderSoft }} className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-20 lg:pb-28 pt-4">
      <div className="mx-auto max-w-[1100px]">
        <div className="h-px mb-16" style={{ background: "rgba(100,110,180,0.2)" }} />
        <Eyebrow text="The Better Way" />
        <h2
          className="mt-4 font-bold leading-tight mb-12"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.navyDarkest }}
        >
          Companies pay less. Talent earns more.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Companies pay */}
          <div className="rounded-2xl p-7" style={{ background: "white", border: "1px solid #D8DCF0" }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: "#8A95B0" }}>COMPANIES PAY</p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="line-through font-medium" style={{ color: "#9BA3BB", fontSize: "clamp(1.1rem, 1.6vw, 1.5rem)" }}>$2,500</span>
              <span className="font-bold" style={{ color: C.navyDarkest, fontSize: "clamp(2rem, 3vw, 2.8rem)", letterSpacing: "-0.03em" }}>$2,400</span>
            </div>
            <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-5" style={{ background: "#E8F5E9", color: "#2E7D32" }}>
              ↓ Less than traditional outsourcing
            </span>
            <p style={{ color: C.gray500, fontSize: "0.9rem", lineHeight: 1.6 }}>
              Same work, even better quality — without the layer of overhead traditional outsourcing adds on top.
            </p>
            <Link href="/hire-talent" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: C.gold }}>
              Hire talent <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Talent earns */}
          <div className="rounded-2xl p-7" style={{ background: C.navy }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>TALENT EARNS</p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="line-through font-medium" style={{ color: "rgba(255,255,255,0.35)", fontSize: "clamp(1.1rem, 1.6vw, 1.5rem)" }}>$1,000</span>
              <span className="font-bold text-white" style={{ fontSize: "clamp(2rem, 3vw, 2.8rem)", letterSpacing: "-0.03em" }}>$2,000</span>
            </div>
            <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-5" style={{ background: "rgba(245,166,35,0.2)", color: C.goldLight }}>
              ↑ 2× what traditional outsourcing pays
            </span>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Because OnSpot's fee sits on top of the talent's rate, not carved out of it.
            </p>
            <Link href="/find-work" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: C.gold }}>
              Find work <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <p style={{ color: C.gray500, fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 720 }} className="mb-5">
          Illustrative example — one role, one month. Traditional outsourcing: the company pays $2,500 and the talent keeps $1,000. OnSpot: the company pays $2,400 — the talent's full $2,000 rate plus a transparent $400 OnSpot fee.
        </p>
        <p className="font-semibold leading-snug" style={{ color: C.navyDarkest, fontSize: "clamp(1rem, 1.4vw, 1.15rem)", maxWidth: 680 }}>
          We don't create savings by paying talent less. We create savings by{" "}
          <span style={{ color: C.gold }}>taking less in between.</span>
        </p>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. TALENT TESTIMONIAL
// ══════════════════════════════════════════════════════════════════════════════
function TalentTestimonialSection() {
  return (
    <section style={{ background: C.warmLight }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow text="For Talents" />
        <blockquote
          className="mt-4 font-bold leading-tight mb-6"
          style={{ fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)", letterSpacing: "-0.025em", color: C.navyDarkest, maxWidth: 760 }}
        >
          "Real work. Real growth.{" "}
          <span style={{ color: C.gold }}>From wherever you call home.</span>"
        </blockquote>
        <p className="mb-8 leading-relaxed" style={{ color: C.gray700, fontSize: "1rem", maxWidth: 540 }}>
          Set your rate and keep it — OnSpot's fee is added on top, never taken out of your pay.
          Just great clients and reliable payouts.
        </p>

        <div className="flex items-center gap-3 mb-8">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #3A3AF8, #7F3DF4)" }}
          >
            MA
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: C.navyDarkest }}>Mark Apartol</p>
            <p style={{ color: C.gray500, fontSize: "0.8rem" }}>Co-founder &amp; COO</p>
          </div>
        </div>

        <Link
          href="/find-work"
          className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold transition hover:bg-black/5"
          style={{ borderColor: C.navyDarkest, color: C.navyDarkest, fontSize: "0.95rem" }}
        >
          Find work <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. JOB LISTINGS
// ══════════════════════════════════════════════════════════════════════════════
function JobListingsSection() {
  const { data: rawJobs } = useQuery({
    queryKey: ["/api/jobs/popular"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/popular");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const jobs = (rawJobs ?? []).filter((j: any) => j.title?.toLowerCase() !== "test").slice(0, 4);

  return (
    <section style={{ background: C.navyDeep }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow text="For Talents" dark />
        <h2
          className="mt-4 font-bold leading-tight mb-4"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: "white", maxWidth: 680 }}
        >
          Hundreds of high-paying jobs.{" "}
          <span style={{ color: C.goldLight }}>Open right now.</span>
        </h2>
        <p className="mb-10" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", maxWidth: 540 }}>
          Real roles with great companies — all roles that reflect what your work is actually worth. New jobs open every week.
        </p>

        {jobs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {jobs.map((job: any) => (
              <div
                key={job.id}
                className="rounded-2xl p-5 flex flex-col"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span
                  className="inline-block text-[10px] font-bold tracking-wider uppercase rounded-md px-2.5 py-1 mb-4 self-start"
                  style={{ background: "rgba(245,166,35,0.18)", color: C.gold, letterSpacing: "0.1em" }}
                >
                  HIRING NOW
                </span>
                <p className="text-white font-semibold leading-snug mb-2 flex-1" style={{ fontSize: "0.95rem" }}>
                  {job.title}
                </p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }} className="mb-3">
                  {[job.contractType, job.location].filter(Boolean).join(" · ") || "Full-time · Remote"}
                </p>
                {(job.budget || job.hourlyRateMin || job.hourlyRateMax) && (
                  <p className="font-semibold mb-4" style={{ color: C.gold, fontSize: "0.9rem" }}>
                    {job.budget
                      ? `${job.budgetCurrency ?? "PHP"} ${job.budget}`
                      : `${job.budgetCurrency ?? "USD"} ${job.hourlyRateMin}${job.hourlyRateMax ? ` – ${job.hourlyRateMax}` : ""}`}
                  </p>
                )}
                <Link href={`/jobs/${job.id}`}>
                  <button
                    className="flex items-center gap-1 text-xs font-semibold transition hover:opacity-80 mt-auto"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    View role <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col items-start gap-4">
          <Link href="/find-work/jobs">
            <button
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 font-semibold text-white transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.3)", fontSize: "0.95rem" }}
            >
              Browse all jobs <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>
            Set your rate. Keep your rate. OnSpot's fee is never taken out of your pay.
          </p>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. PROCESS — From posted to placed
// ══════════════════════════════════════════════════════════════════════════════
function ProcessSection() {
  return (
    <section
      aria-label="How OnSpot works"
      style={{ background: `radial-gradient(55% 70% at 50% 0%, rgba(71,78,173,0.07), transparent 70%), #F7F7FB` }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow text="The Plan" />
        <h2
          className="mt-4 font-bold leading-tight mb-3"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.navyDarkest }}
        >
          From posted to placed
        </h2>
        <p className="mb-14" style={{ color: C.gray700, fontSize: "1rem" }}>
          Three steps. No bidding wars, no long contracts, no hidden markups.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              num: "1",
              title: "Post or apply",
              text: "Tell us what you need. Or show us what you can do.",
              ctas: [
                { label: "Post a role →", href: "/hire-talent" },
                { label: "Apply as talent →", href: "/find-work/jobs" },
              ],
            },
            {
              num: "2",
              title: "Get matched",
              text: "We connect the right people, fast — no endless scrolling.",
              ctas: [{ label: "See how matching works →", href: "/why-onspot" }],
            },
            {
              num: "3",
              title: "Start working",
              text: "Show up and do the work. We handle everything else.",
              ctas: [{ label: "Get started →", href: "/hire-talent" }],
            },
          ].map((step, i) => (
            <div key={i} className="relative">
              {i < 2 && (
                <div
                  className="hidden md:block absolute top-8 left-full z-0 h-px"
                  style={{ background: "linear-gradient(to right, #D0D4E8, transparent)", width: "calc(100% - 2rem)" }}
                />
              )}
              <div className="relative z-10 rounded-2xl p-6" style={{ background: "white", border: "1px solid #E0E4F0" }}>
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: `rgba(71,78,173,0.1)`, color: C.purple }}
                  >
                    <span className="text-lg font-bold">{step.num}</span>
                  </div>
                  <span className="font-bold text-4xl tabular-nums" style={{ color: "#E8EAF5", letterSpacing: "-0.04em" }}>
                    {step.num}
                  </span>
                </div>
                <h3 className="font-bold mb-2" style={{ fontSize: "1.05rem", color: C.navyDarkest }}>{step.title}</h3>
                <p className="mb-5" style={{ color: C.gray700, fontSize: "0.9rem", lineHeight: 1.6 }}>{step.text}</p>
                <div className="flex flex-wrap gap-3">
                  {step.ctas.map((l) => (
                    <Link key={l.label} href={l.href} className="text-xs font-semibold transition hover:opacity-80" style={{ color: C.gold }}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: C.gray700, fontSize: "0.95rem" }}>
          That's it.{" "}
          <span className="font-semibold" style={{ color: C.gold }}>
            Most roles are filled in days, not months.
          </span>
        </p>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. EQUATION — We changed the equation
// ══════════════════════════════════════════════════════════════════════════════
function EquationSection() {
  return (
    <section style={{ background: C.lavenderSoft }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow text="The Right Way to Outsource" />
        <h2
          className="mt-4 font-bold leading-tight mb-3"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.navyDarkest }}
        >
          We changed the equation.
        </h2>
        <p className="mb-12" style={{ color: C.gray700, fontSize: "1rem", maxWidth: 560 }}>
          Everyone else makes you pick two: speed, accountability, or cost. OnSpot doesn't.
        </p>

        {/* 3-column comparison table */}
        <div className="grid grid-cols-3 rounded-2xl overflow-hidden mb-10 text-sm">
          {/* Header */}
          <div className="px-5 py-4" style={{ background: "#E0E4F4", borderRight: "1px solid #CBD0E8" }}>
            <p className="font-bold text-[11px] tracking-[0.1em] uppercase" style={{ color: "#7A849C" }}>FREELANCE MARKETPLACES</p>
            <p className="font-semibold mt-1" style={{ color: C.gray500, fontSize: "0.85rem" }}>Fast and cheap</p>
          </div>
          <div className="px-5 py-4 text-center" style={{ background: C.navyDeep }}>
            <p className="font-bold text-[11px] tracking-[0.1em] uppercase" style={{ color: C.gold }}>— ONSPOT</p>
            <p className="font-semibold mt-1 text-white" style={{ fontSize: "0.85rem" }}>Great talent. High pay. Fair cost.</p>
          </div>
          <div className="px-5 py-4 text-right" style={{ background: "#E0E4F4" }}>
            <p className="font-bold text-[11px] tracking-[0.1em] uppercase" style={{ color: "#7A849C" }}>TRADITIONAL OUTSOURCING</p>
            <p className="font-semibold mt-1" style={{ color: C.gray500, fontSize: "0.85rem" }}>Reliable, but heavy</p>
          </div>

          {/* Row 1 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E8ECF6", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
            <span style={{ color: C.gray700 }}>No accountability</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} />
            <span className="text-white" style={{ fontSize: "0.9rem" }}>Vetted talent, ready fast</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E8ECF6", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: C.gray700 }}>Slow and rigid</span>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>

          {/* Row 2 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E2E6F2", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
            <span style={{ color: C.gray700 }}>No oversight</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} />
            <span className="text-white" style={{ fontSize: "0.9rem" }}>Accountable, managed relationships</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E2E6F2", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: C.gray700 }}>Expensive overhead</span>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>

          {/* Row 3 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E8ECF6", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
            <span style={{ color: C.gray700 }}>Race-to-bottom pay</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} />
            <span className="text-white" style={{ fontSize: "0.9rem" }}>No overhead cost</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E8ECF6", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: C.gray700 }}>Slow to start</span>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
        </div>

        <p style={{ color: C.navyDarkest, fontSize: "1rem", maxWidth: 680 }}>
          Everyone else trades one thing for another. OnSpot doesn't trade —{" "}
          <span className="font-semibold" style={{ color: C.gold }}>
            we raise the whole experience.
          </span>
        </p>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. FOUNDER QUOTE
// ══════════════════════════════════════════════════════════════════════════════
function FounderQuoteSection() {
  return (
    <section style={{ background: C.lavenderSoft }} className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-20 lg:pb-28 pt-4">
      <div className="mx-auto max-w-[1100px]">
        <div
          className="rounded-2xl p-8 sm:p-10 lg:p-14"
          style={{ background: "#0D1B4B" }}
        >
          <Eyebrow text="Why OnSpot" dark />
          <blockquote
            className="mt-4 font-bold text-white leading-tight mb-6"
            style={{ fontSize: "clamp(1.3rem, 2.2vw, 2rem)", letterSpacing: "-0.02em", maxWidth: 780 }}
          >
            "We've watched good companies get stuck choosing between{" "}
            <span style={{ color: C.goldLight }}>marketplace chaos</span> and{" "}
            <span style={{ color: C.goldLight }}>outsourcing overhead</span> — and good talent get squeezed by both sides of that same trade-off."
          </blockquote>
          <p className="mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", maxWidth: 680 }}>
            So we built OnSpot the way operators build things — not software developers guessing at the problem from the outside.
          </p>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${C.gold}, #E07B00)` }}
            >
              NL
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Nur Lantmann</p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" }}>Co-founder &amp; CEO</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. COMPANY TESTIMONIAL
// ══════════════════════════════════════════════════════════════════════════════
function CompanyTestimonialSection() {
  return (
    <section style={{ background: C.navyDeep }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow text="For Companies" dark />
        <blockquote
          className="mt-4 font-bold leading-tight mb-6"
          style={{ fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)", letterSpacing: "-0.025em", color: "white", maxWidth: 760 }}
        >
          "The team you've been picturing,{" "}
          <span style={{ color: C.goldLight }}>without the wait or the complexity.</span>"
        </blockquote>

        <div className="flex items-center gap-3 mb-7">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #3A3AF8, #5B7CFF)" }}
          >
            JS
          </div>
          <div>
            <p className="font-semibold text-sm text-white">John Steinberg</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" }}>Founder &amp; President</p>
          </div>
        </div>

        <p className="mb-9 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", maxWidth: 520 }}>
          Vetted talent, quick starts, and simpler hiring — with a transparent fee you can see. So you can just build your team.
        </p>

        <Link
          href="/hire-talent"
          className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 font-semibold text-white transition hover:bg-white/10"
          style={{ borderColor: "rgba(255,255,255,0.3)", fontSize: "0.95rem" }}
        >
          Hire talent →
        </Link>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. FINAL CTA
// ══════════════════════════════════════════════════════════════════════════════
function FinalCtaSection() {
  return (
    <section
      style={{ background: `linear-gradient(160deg, ${C.navyDarkest} 0%, #1a0d40 50%, ${C.navyDeep} 100%)` }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-24 lg:py-36 text-center"
    >
      <div className="mx-auto max-w-[820px]">
        <p
          className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/85 mb-6"
        >
          <span aria-hidden="true" className="inline-block h-[2px] w-4 rounded" style={{ background: C.gold }} />
          Work Without Limits
        </p>
        <h2
          className="font-bold tracking-tight text-white"
          style={{ fontSize: "clamp(1.9rem, 4.2vw, 3.125rem)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
          data-testid="text-final-cta-headline"
        >
          Some of the best teams in the world already work this way.
        </h2>
        <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-relaxed text-white/70">
          The ones who wait keep losing good people to delay and overhead. The ones who don't build without limits — and the people who work with them earn without limits.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/hire-talent"
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-white px-9 py-3.5 text-[15.5px] font-semibold transition-all duration-200 hover:-translate-y-[1px] hover:bg-white/95 sm:w-auto"
            style={{ color: C.purple, boxShadow: "0 16px 36px -12px rgba(10,10,60,0.45)" }}
          >
            Hire talent →
          </Link>
          <Link
            href="/find-work/jobs"
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-9 py-3.5 text-[15.5px] font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] sm:w-auto"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(8px)" }}
          >
            Find work →
          </Link>
        </div>
      </div>
    </section>
  );
}
