import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play, Check, X, Star, Search, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";

// ── Design tokens (matched to screenshots) ────────────────────────────────────
const C = {
  // Hero dark slide gradient stops
  dark1:        "#272668",
  dark2:        "#3A4295",
  dark3:        "#4652B5",
  // Hero light slide bg
  lightBg:      "#FAF8F5",
  lightGlow:    "rgba(71,78,173,0.06)",
  // Brand
  indigo:       "#4B51B8",
  indigoDark:   "#383E90",
  indigoDeep:   "#272668",
  indigoLight:  "#7B81D4",
  // Orange/gold accent
  orange:       "#FFAE21",
  orangeLight:  "#FFC052",
  orangeDeep:   "#A06800",
  // Text
  charcoal:     "#17171C",
  gray:         "#6B6B76",
  grayLight:    "#9494A0",
  // Non-hero sections
  lavenderBg:   "#F1F0FF",
  warmBg:       "#FFF9EF",
  navySection:  "#0C123F",
};

const SLIDE_MS = 6000;

const SLIDES = [
  { id: "work",      theme: "dark",  eyebrow: null },
  { id: "companies", theme: "light", eyebrow: "— FOR COMPANIES" },
  { id: "talent",    theme: "dark",  eyebrow: "— FOR TALENTS" },
  { id: "network",   theme: "light", eyebrow: "— THE TALENT NETWORK" },
  { id: "jobs",      theme: "dark",  eyebrow: "— FOR TALENTS" },
] as const;

// ── Slide backgrounds ─────────────────────────────────────────────────────────
function slideBg(id: string) {
  if (id === "work")
    return `radial-gradient(ellipse at 70% 30%, rgba(70,82,181,0.55), transparent 60%), linear-gradient(150deg, ${C.dark1} 0%, ${C.dark2} 55%, ${C.dark3} 100%)`;
  if (id === "talent" || id === "jobs")
    return `radial-gradient(ellipse at 75% 20%, rgba(70,82,181,0.45), transparent 55%), radial-gradient(ellipse at 15% 80%, rgba(255,174,33,0.08), transparent 45%), linear-gradient(150deg, ${C.dark1} 0%, ${C.dark2} 60%, ${C.dark3} 100%)`;
  // light slides
  return `radial-gradient(ellipse at 85% 18%, rgba(71,78,173,0.09), transparent 50%), linear-gradient(145deg, ${C.lightBg} 0%, #f4f2ff 100%)`;
}

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

// ══════════════════════════════════════════════════════════════════════════════
// HERO — 5-slide carousel
// ══════════════════════════════════════════════════════════════════════════════
function HeroSection() {
  const [slide, setSlide]   = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX         = useRef<number | null>(null);
  const sectionRef          = useRef<HTMLElement>(null);

  // Jobs data for slide 5 right-side card
  const { data: rawJobs } = useQuery({
    queryKey: ["/api/jobs/popular"],
    queryFn: async () => {
      const r = await fetch("/api/jobs/popular");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.items ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
  const liveJobs = (rawJobs ?? [])
    .filter((j: any) => j.title?.toLowerCase() !== "test")
    .slice(0, 3);

  const prev = useCallback(() => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setSlide(s => (s + 1) % SLIDES.length), []);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, paused, next]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  const active   = SLIDES[slide];
  const isDark   = active.theme === "dark";
  const ctrlBorder = isDark ? "rgba(255,255,255,0.28)" : `rgba(75,81,184,0.35)`;
  const ctrlBg     = isDark ? "rgba(255,255,255,0.07)" : `rgba(75,81,184,0.07)`;
  const ctrlColor   = isDark ? "#ffffff" : C.indigo;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ minHeight: 800, background: slideBg(active.id), transition: "background 0.65s ease" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Hero carousel"
    >
      {/* Slide content */}
      <div
        className="relative z-10 mx-auto flex flex-col px-6 sm:px-8 lg:px-10"
        style={{ maxWidth: 1200, minHeight: 800 }}
      >
        {/* Main content area — vertically centered with space for controls */}
        <div
          key={`slide-${slide}`}
          className="flex flex-1 flex-col justify-center py-14 pb-24"
          style={{ animation: "homeHeroIn 0.55s ease forwards", opacity: 0 }}
        >
          {active.id === "work"      && <WorkSlide      isDark={isDark} />}
          {active.id === "companies" && <CompaniesSlide isDark={isDark} />}
          {active.id === "talent"    && <TalentSlide    isDark={isDark} />}
          {active.id === "network"   && <NetworkSlide   isDark={isDark} />}
          {active.id === "jobs"      && <JobsSlide      isDark={isDark} liveJobs={liveJobs} />}
        </div>

        {/* Controls row — bottom-left inside container */}
        <div className="absolute bottom-7 left-6 sm:left-8 lg:left-10 right-0 flex items-center gap-3">
          {/* Prev */}
          <CtrlBtn onClick={prev} label="Previous slide" border={ctrlBorder} bg={ctrlBg} color={ctrlColor}>
            <ChevronLeft className="h-4 w-4" />
          </CtrlBtn>

          {/* Play/Pause */}
          <CtrlBtn onClick={() => setPaused(p => !p)} label={paused ? "Play" : "Pause"} border={ctrlBorder} bg={ctrlBg} color={ctrlColor}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </CtrlBtn>

          {/* Next */}
          <CtrlBtn onClick={next} label="Next slide" border={ctrlBorder} bg={ctrlBg} color={ctrlColor}>
            <ChevronRight className="h-4 w-4" />
          </CtrlBtn>

          {/* Counter */}
          <span className="ml-1 tabular-nums text-sm flex-shrink-0" style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(75,81,184,0.6)" }}>
            <span className="font-bold" style={{ fontSize: "1rem", color: isDark ? "white" : C.indigo }}>
              {String(slide + 1).padStart(2, "0")}
            </span>
            {" / "}
            {String(SLIDES.length).padStart(2, "0")}
          </span>

          {/* Progress indicators */}
          <div className="flex items-center gap-1.5 ml-1">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  height: 4,
                  width: i === slide ? 28 : 7,
                  borderRadius: 4,
                  background: i === slide ? C.orange : isDark ? "rgba(255,255,255,0.25)" : "rgba(75,81,184,0.22)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.35s ease",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CtrlBtn({ onClick, label, border, bg, color, children }: {
  onClick: () => void; label: string; border: string; bg: string; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition hover:opacity-80"
      style={{ border: `1px solid ${border}`, background: bg, color }}
    >
      {children}
    </button>
  );
}

function SlideEyebrow({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <p
      className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: isDark ? "rgba(255,255,255,0.75)" : C.indigo }}
    >
      <span className="inline-block mr-2 h-[2px] w-4 rounded align-middle" style={{ background: C.orange }} />
      {text.replace(/^— /, "")}
    </p>
  );
}

// ── Two-column slide wrapper ──────────────────────────────────────────────────
function TwoCol({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14 w-full">
      <div>{left}</div>
      <div className="lg:justify-self-end w-full lg:max-w-[520px]">{right}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — WORK (dark, centered)
// ══════════════════════════════════════════════════════════════════════════════
function WorkSlide({ isDark }: { isDark: boolean }) {
  return (
    <div className="mx-auto flex w-full flex-col items-center text-center" style={{ maxWidth: 860 }}>
      <h1
        className="font-bold tracking-tight"
        style={{ fontSize: "clamp(3rem, 7vw, 72px)", lineHeight: 1.04, letterSpacing: "-0.035em" }}
      >
        <span className="text-white">Work </span>
        <span style={{ color: C.orangeLight }}>Without</span>
        <span className="text-white"> Limits</span>
      </h1>

      <p className="mt-7 max-w-[560px]" style={{ fontSize: "clamp(1.05rem, 2vw, 1.25rem)", lineHeight: 1.55 }}>
        <span className="font-semibold text-white">One system.</span>{" "}
        <span style={{ color: "rgba(199,203,242,0.8)" }}>Highest pay for talents at lower cost to companies.</span>
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/hire-talent"
          className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-full bg-white px-8 text-[15.5px] font-semibold transition hover:-translate-y-[1px] hover:bg-white/95"
          style={{ color: C.indigo, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.35)" }}
        >
          Hire talent →
        </Link>
        <Link
          href="/find-work/jobs"
          className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-full px-8 text-[15.5px] font-semibold text-white transition hover:-translate-y-[1px]"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.4)", backdropFilter: "blur(8px)" }}
        >
          Find work →
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — COMPANIES (light, 2-col + laptop mockup)
// ══════════════════════════════════════════════════════════════════════════════
function CompaniesSlide({ isDark }: { isDark: boolean }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="FOR COMPANIES" isDark={isDark} />
          <h1
            className="font-bold tracking-tight leading-[1.04]"
            style={{ fontSize: "clamp(2.6rem, 5.5vw, 64px)", letterSpacing: "-0.03em" }}
          >
            <span style={{ color: C.charcoal }}>Hire </span>
            <span style={{ color: C.indigo }}>Without<br />Limits.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium" style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.25rem)", lineHeight: 1.45, color: C.charcoal }}>
            The best talents —{" "}
            <span className="font-bold" style={{ color: C.orangeDeep }}>without the outsourcing overhead.</span>
          </p>
          <p className="mt-3 max-w-[440px] leading-relaxed" style={{ fontSize: "0.95rem", color: C.gray }}>
            Build the team you need without long hiring cycles, limited local talent pools, or traditional outsourcing complexity.
          </p>
          <Link
            href="/hire-talent"
            className="mt-8 inline-flex h-[48px] min-w-[160px] items-center justify-center rounded-[10px] px-7 text-[15px] font-semibold text-white transition hover:-translate-y-[1px]"
            style={{ background: C.indigo, boxShadow: "0 8px 24px rgba(75,81,184,0.3)" }}
          >
            Hire talent →
          </Link>
        </>
      }
      right={<LaptopMockup />}
    />
  );
}

function LaptopMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      {/* Purple glow */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-full"
        style={{ background: "radial-gradient(60% 55% at 50% 55%, rgba(75,81,184,0.18), transparent 70%)", filter: "blur(12px)" }}
      />
      {/* Laptop shell */}
      <div
        className="relative rounded-[14px] p-[9px]"
        style={{ background: "linear-gradient(170deg, #2a2a2f 0%, #18181c 100%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 32px 64px -24px rgba(10,12,50,0.55)" }}
      >
        {/* Camera dot */}
        <div className="flex justify-center mb-1.5">
          <div className="h-[3px] w-[3px] rounded-full" style={{ background: "#3a3a3c" }} />
        </div>
        {/* Screen */}
        <div className="overflow-hidden rounded-[8px] bg-white">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "#EDEDF2" }}>
            <span className="text-[12px] font-bold" style={{ color: C.charcoal }}>OnSpot</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]" style={{ color: C.grayLight }}>Gentech LLC</span>
              <div className="h-5 w-5 rounded-full" style={{ background: C.indigoLight }} />
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            {/* Header */}
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[13px] font-bold" style={{ color: C.charcoal }}>Team dashboard</p>
              <p className="text-[9px]" style={{ color: C.grayLight }}>Last 6 months</p>
            </div>

            {/* 4 stat cards */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[
                { label: "MONTHLY COST", value: "$18,400", sub: "▼ 22% vs traditional", subColor: "#2E7D32" },
                { label: "HEADCOUNT",    value: "8",        sub: "Active members",        subColor: C.gray },
                { label: "AVG. PERF.",   value: "4.8/5",    sub: "Across roles",           subColor: C.gray },
                { label: "RETENTION",    value: "94%",      sub: "Continuity",             subColor: C.gray },
              ].map((s) => (
                <div key={s.label} className="rounded-[7px] px-2 py-2" style={{ background: "#EEEDFB", border: "1px solid rgba(75,81,184,0.15)" }}>
                  <p className="text-[6.5px] font-bold uppercase tracking-wide" style={{ color: C.indigo }}>{s.label}</p>
                  <p className="text-[13px] font-bold leading-tight mt-0.5" style={{ color: C.charcoal }}>{s.value}</p>
                  <p className="text-[7px] mt-0.5" style={{ color: s.subColor }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Team rows */}
            <p className="text-[8px] font-bold uppercase tracking-wide mb-1.5" style={{ color: C.grayLight }}>Team Performance</p>
            <div className="space-y-1 mb-3">
              {[
                { i: "AM", n: "Aira M.",   r: "Executive Assistant",  perf: "4.9", status: "Active" },
                { i: "RS", n: "Rafael S.", r: "Bookkeeper",           perf: "4.8", status: "Active" },
                { i: "KC", n: "Kim C.",    r: "Customer Support",     perf: "4.9", status: "Active" },
              ].map((m) => (
                <div key={m.i} className="flex items-center justify-between rounded-[6px] px-2 py-1" style={{ background: "#F7F7FB" }}>
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ background: C.indigo }}>{m.i}</div>
                    <div>
                      <p className="text-[9px] font-semibold leading-none" style={{ color: C.charcoal }}>{m.n}</p>
                      <p className="text-[7.5px]" style={{ color: C.grayLight }}>{m.r}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-semibold" style={{ color: C.indigo }}>★ {m.perf}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[7px] font-semibold" style={{ background: "rgba(75,81,184,0.12)", color: C.indigo }}>{m.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hiring / vacant rows */}
            <p className="text-[8px] font-bold uppercase tracking-wide mb-1" style={{ color: C.grayLight }}>Open Roles</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { r: "Sales Dev Rep", s: "Interviewing" },
                { r: "Data Analyst",  s: "Vacant" },
              ].map((v) => (
                <div key={v.r} className="rounded-[6px] px-2 py-1.5" style={{ background: "#F7F7FB", border: "1px dashed #D0D0DE" }}>
                  <p className="text-[9px] font-semibold" style={{ color: C.charcoal }}>{v.r}</p>
                  <p className="text-[7.5px] mt-0.5" style={{ color: v.s === "Vacant" ? "#C62828" : C.indigo }}>{v.s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Laptop base */}
      <div className="mx-auto mt-1 h-1.5 rounded-b-lg" style={{ width: "80%", background: "linear-gradient(180deg, #1c1c20, #28282d)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} />
      <div className="mx-auto h-[3px] rounded-full" style={{ width: "70%", background: "#111116" }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — TALENT (dark, 2-col + phone mockup)
// ══════════════════════════════════════════════════════════════════════════════
function TalentSlide({ isDark }: { isDark: boolean }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="FOR TALENTS" isDark={isDark} />
          <h1
            className="font-bold tracking-tight text-white leading-[1.04]"
            style={{ fontSize: "clamp(2.6rem, 5.5vw, 64px)", letterSpacing: "-0.03em" }}
          >
            Earn{" "}
            <span style={{ color: C.orangeLight }}>Without<br />Limits.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium text-white" style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.25rem)", lineHeight: 1.45 }}>
            The best clients —{" "}
            <span className="font-bold" style={{ color: C.orangeLight }}>the highest pay for the work you do.</span>
          </p>
          <p className="mt-3 max-w-[440px] leading-relaxed" style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.62)" }}>
            Work with great companies from wherever you call home, at the best rate, and get paid reliably.
          </p>
          <Link
            href="/find-work/jobs"
            className="mt-8 inline-flex h-[48px] min-w-[160px] items-center justify-center rounded-[10px] px-7 text-[15px] font-semibold transition hover:-translate-y-[1px]"
            style={{ background: C.orange, color: C.indigoDeep, boxShadow: "0 8px 24px rgba(255,174,33,0.32)" }}
          >
            Find work →
          </Link>
        </>
      }
      right={<PhoneMockup />}
    />
  );
}

// Bar chart heights for Mar–Aug
const BAR_DATA = [
  { month: "Mar", h: 40 },
  { month: "Apr", h: 55 },
  { month: "May", h: 48 },
  { month: "Jun", h: 70 },
  { month: "Jul", h: 62 },
  { month: "Aug", h: 88 },
];

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 220 }}>
      {/* Glow */}
      <div aria-hidden className="absolute -inset-8 rounded-full" style={{ background: "radial-gradient(60% 55% at 50% 45%, rgba(255,174,33,0.2), transparent 70%)", filter: "blur(8px)" }} />
      {/* Phone shell */}
      <div
        className="relative rounded-[36px] p-[7px]"
        style={{ background: "linear-gradient(165deg, #23264a 0%, #14162e 100%)", border: "1px solid rgba(255,255,255,0.13)", boxShadow: "0 40px 80px -24px rgba(5,8,30,0.7)" }}
      >
        {/* Notch */}
        <div className="flex justify-center mb-1">
          <div className="h-[4px] w-[60px] rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>
        {/* Screen */}
        <div className="overflow-hidden rounded-[30px] bg-white">
          {/* App header */}
          <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: "#F0F0F5" }}>
            <p className="text-[11px] font-bold" style={{ color: C.charcoal }}>OnSpot</p>
            <p className="text-[9px]" style={{ color: C.grayLight }}>Earnings summary · Last 6 months</p>
          </div>

          <div className="px-4 pb-4 pt-3">
            {/* Main stat */}
            <div className="rounded-[10px] p-3 mb-3" style={{ background: C.indigo }}>
              <p className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.6)" }}>Total earned this month</p>
              <p className="text-[22px] font-bold text-white leading-none mt-1">$3,455</p>
              <p className="text-[8px] font-semibold mt-1" style={{ color: C.orangeLight }}>▲ 18% vs last month</p>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {[
                { label: "AVG. RATE", value: "$20/hr" },
                { label: "ACTIVE CLIENTS", value: "2" },
              ].map((s) => (
                <div key={s.label} className="rounded-[8px] px-2.5 py-2" style={{ background: "#F7F7FB" }}>
                  <p className="text-[7px] font-bold uppercase tracking-wide" style={{ color: C.grayLight }}>{s.label}</p>
                  <p className="text-[14px] font-bold mt-0.5" style={{ color: C.charcoal }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-1.5 mb-1" style={{ height: 48 }}>
              {BAR_DATA.map((b) => (
                <div key={b.month} className="flex flex-1 flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: `${b.h}%`,
                      background: b.month === "Aug" ? C.indigo : "rgba(75,81,184,0.22)",
                    }}
                  />
                  <span className="text-[6.5px]" style={{ color: C.grayLight }}>{b.month}</span>
                </div>
              ))}
            </div>

            {/* Earnings by client */}
            <p className="text-[8px] font-bold uppercase tracking-wide mb-1.5" style={{ color: C.grayLight }}>Earnings by client</p>
            {[
              { n: "New Tech AI",      amt: "$2,000" },
              { n: "John Roberts LLC", amt: "$1,455" },
            ].map((c) => (
              <div key={c.n} className="flex items-center justify-between py-1 border-b last:border-0" style={{ borderColor: "#F0F0F5" }}>
                <p className="text-[9px] font-medium" style={{ color: C.charcoal }}>{c.n}</p>
                <p className="text-[9px] font-semibold" style={{ color: C.indigo }}>{c.amt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — NETWORK (light, 2-col + talent list card)
// ══════════════════════════════════════════════════════════════════════════════
function NetworkSlide({ isDark }: { isDark: boolean }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="THE TALENT NETWORK" isDark={isDark} />
          <h1
            className="font-bold tracking-tight leading-[1.04]"
            style={{ fontSize: "clamp(2.6rem, 5.5vw, 64px)", letterSpacing: "-0.03em", color: C.charcoal }}
          >
            Thousands of<br />
            talents.{" "}
            <span style={{ color: C.indigo }}>Ready to<br />work.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium" style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.25rem)", lineHeight: 1.45, color: C.charcoal }}>
            Vetted, experienced, and{" "}
            <span className="font-bold" style={{ color: C.orangeDeep }}>ready to start in days — not months.</span>
          </p>
          <p className="mt-3 max-w-[440px] leading-relaxed" style={{ fontSize: "0.95rem", color: C.gray }}>
            Every professional in the network is screened for skills, experience, and reliability before you ever see them — so the match is fast and the quality holds.
          </p>
          <Link
            href="/hire-talent"
            className="mt-8 inline-flex h-[48px] min-w-[180px] items-center justify-center rounded-[10px] px-7 text-[15px] font-semibold text-white transition hover:-translate-y-[1px]"
            style={{ background: C.indigo, boxShadow: "0 8px 24px rgba(75,81,184,0.3)" }}
          >
            Meet your talent →
          </Link>
        </>
      }
      right={<TalentListCard />}
    />
  );
}

const NETWORK_TALENTS = [
  { i: "KC", n: "Kim C.",    r: "Customer Support Specialist", yrs: "6 yrs", sc: "4.9" },
  { i: "RS", n: "Rafael S.", r: "Bookkeeper",                  yrs: "8 yrs", sc: "4.8" },
  { i: "AM", n: "Aira M.",   r: "Executive Assistant",         yrs: "5 yrs", sc: "4.9" },
  { i: "JP", n: "Jomar P.",  r: "Sales Development Rep",       yrs: "4 yrs", sc: "4.7" },
];

function TalentListCard() {
  return (
    <div className="relative">
      {/* Glow */}
      <div aria-hidden className="absolute -inset-6 rounded-full" style={{ background: "radial-gradient(60% 55% at 50% 50%, rgba(75,81,184,0.12), transparent 70%)", filter: "blur(10px)" }} />
      <div
        className="relative rounded-[18px] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(75,81,184,0.18)", backdropFilter: "blur(14px)", boxShadow: "0 24px 56px rgba(75,81,184,0.12)" }}
      >
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#EEEDFB" }}>
          <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: "#F4F3FC", border: "1px solid #DDDCF4" }}>
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.indigoLight }} />
            <span className="text-[11px]" style={{ color: C.grayLight }}>Customer support, bookkeeping, sales...</span>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {["Available now", "4.5★ and up", "3+ yrs experience"].map((f) => (
              <span
                key={f}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ background: "rgba(75,81,184,0.1)", color: C.indigo, border: "1px solid rgba(75,81,184,0.2)" }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Talent rows */}
        <div className="divide-y" style={{ divideColor: "#EEEDFB" }}>
          {NETWORK_TALENTS.map((t) => (
            <div key={t.i} className="flex items-center justify-between px-4 py-3 hover:bg-[#F8F7FD] transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: C.indigo }}
                >
                  {t.i}
                </div>
                <div>
                  <p className="text-[12px] font-semibold leading-snug" style={{ color: C.charcoal }}>{t.n}</p>
                  <p className="text-[10px] leading-snug" style={{ color: C.gray }}>{t.r} · {t.yrs}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-semibold" style={{ color: C.charcoal }}>★ {t.sc}</span>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(46,186,107,0.12)", color: "#1a7d42" }}>
                  Ready now
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t" style={{ borderColor: "#EEEDFB", background: "#F8F7FD" }}>
          <p className="text-[10px]" style={{ color: C.gray }}>
            <Check className="inline h-3 w-3 mr-1" style={{ color: C.indigo }} />
            Every profile is pre-vetted for skills, experience, and reliability.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — JOBS (dark, 2-col + roles card)
// ══════════════════════════════════════════════════════════════════════════════
function JobsSlide({ isDark, liveJobs }: { isDark: boolean; liveJobs: any[] }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="FOR TALENTS" isDark={isDark} />
          <h1
            className="font-bold tracking-tight text-white leading-[1.04]"
            style={{ fontSize: "clamp(2.6rem, 5.5vw, 64px)", letterSpacing: "-0.03em" }}
          >
            Hundreds of<br />
            high-paying jobs.<br />
            <span style={{ color: C.orangeLight }}>Open right now.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium text-white" style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.25rem)", lineHeight: 1.45 }}>
            Real roles, real rates —{" "}
            <span className="font-bold" style={{ color: C.orangeLight }}>and new jobs opening every week.</span>
          </p>
          <p className="mt-3 max-w-[440px] leading-relaxed" style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.62)" }}>
            Set your rate and keep it. OnSpot's fee is added on top — never taken out of your pay.
          </p>
          <Link
            href="/find-work/jobs"
            className="mt-8 inline-flex h-[48px] min-w-[180px] items-center justify-center rounded-[10px] px-7 text-[15px] font-semibold transition hover:-translate-y-[1px]"
            style={{ background: C.orange, color: C.indigoDeep, boxShadow: "0 8px 24px rgba(255,174,33,0.32)" }}
          >
            Browse all jobs →
          </Link>
        </>
      }
      right={<OpenRolesCard liveJobs={liveJobs} />}
    />
  );
}

// Static fallback jobs matching the spec
const FALLBACK_JOBS = [
  { title: "IT Administrator",    location: "Remote", pay: "USD 1,500 – 3,000/mo" },
  { title: "Accounting Manager",  location: "Hybrid", pay: "USD 500/mo" },
  { title: "Virtual Assistant",   location: "Remote", pay: "PHP 8 – 12k/mo" },
];

function OpenRolesCard({ liveJobs }: { liveJobs: any[] }) {
  const jobs = liveJobs.length >= 2
    ? liveJobs.map((j: any) => ({
        title:    j.title,
        location: j.location || "Remote",
        pay:      j.budget
          ? `${j.budgetCurrency ?? "PHP"} ${j.budget}`
          : j.hourlyRateMin
            ? `USD ${j.hourlyRateMin}${j.hourlyRateMax ? ` – ${j.hourlyRateMax}` : ""}/hr`
            : null,
      }))
    : FALLBACK_JOBS;

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-8 rounded-full" style={{ background: "radial-gradient(60% 55% at 50% 42%, rgba(255,174,33,0.2), transparent 65%), radial-gradient(70% 65% at 50% 60%, rgba(75,81,184,0.3), transparent 70%)", filter: "blur(10px)" }} />
      <div
        className="relative rounded-[18px] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.84)", border: "1px solid rgba(255,255,255,0.32)", backdropFilter: "blur(16px)", boxShadow: "0 40px 80px -28px rgba(5,8,30,0.55)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "#EDEDF2" }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: C.charcoal }}>Open roles</p>
            <p className="text-[10px]" style={{ color: C.grayLight }}>Updated this week</p>
          </div>
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: "rgba(255,174,33,0.18)", color: C.orangeDeep }}>Live</span>
        </div>

        {/* Job rows */}
        <div className="divide-y" style={{ divideColor: "#F0F0F5" }}>
          {jobs.map((job, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors">
              <div>
                <p className="text-[13px] font-semibold" style={{ color: C.charcoal }}>{job.title}</p>
                <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>
                  {job.location}
                  {job.pay ? ` · ${job.pay}` : ""}
                </p>
              </div>
              <span className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-semibold ml-3" style={{ background: "rgba(46,186,107,0.12)", color: "#1a7d42" }}>
                Hiring now
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t" style={{ borderColor: "#EDEDF2" }}>
          <Link href="/find-work/jobs" className="text-[12px] font-semibold hover:underline underline-offset-2 transition" style={{ color: C.indigo }}>
            See all open jobs →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BELOW-FOLD SECTIONS (unchanged structure, updated color tokens)
// ══════════════════════════════════════════════════════════════════════════════

// Shared eyebrow for non-hero sections
function SectionEyebrow({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: dark ? "rgba(255,255,255,0.75)" : C.indigo }}>
      <span className="inline-block h-[2px] w-4 rounded" style={{ background: C.orange }} />
      {text}
    </p>
  );
}

function ProblemSection() {
  return (
    <section style={{ background: C.lavenderBg }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionEyebrow text="The Problem With Outsourcing Today" />
        <h2 className="mt-4 font-bold leading-tight mb-4" style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.charcoal, maxWidth: 700 }}>
          Outsourcing is broken. Both sides are paying for it.
        </h2>
        <p className="mb-12" style={{ color: C.gray, fontSize: "1.05rem", maxWidth: 560 }}>
          A middleman sits between you — inflating what companies pay and shrinking what talent takes home.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Companies */}
          <div className="rounded-2xl p-7 flex flex-col" style={{ background: C.navySection }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.orange }}>FOR COMPANIES</p>
            <h3 className="font-bold text-white mb-6 leading-tight" style={{ fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)" }}>
              The 3 hidden costs of <span style={{ color: C.orangeLight }}>the old way.</span>
            </h3>
            <ul className="space-y-4 flex-1">
              {[["Slow Hiring","Months to fill a role."],["Limited Access","Great talent stays out of reach."],["Invisible Overhead","You pay for costs you never see."]].map(([t,d])=>(
                <li key={t} className="flex gap-3">
                  <X className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }} />
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.95rem" }}>
                    <span className="text-white font-semibold">{t}</span> — {d}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-7 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <p className="text-white font-semibold mb-3" style={{ fontSize: "0.95rem" }}>OnSpot removes all three.</p>
              <Link href="/hire-talent" className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: C.orange }}>
                Hire talent <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          {/* Talents */}
          <div className="rounded-2xl p-7 flex flex-col" style={{ background: "white", border: "1px solid #D8DCF0" }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.orange }}>FOR TALENTS</p>
            <h3 className="font-bold mb-6 leading-tight" style={{ fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)", color: C.charcoal }}>
              The same system <span style={{ color: C.orange }}>costs you too.</span>
            </h3>
            <ul className="space-y-4 flex-1">
              {[["Unpaid waiting","months to get matched."],["Bidding wars","a race to the bottom."],["Hidden markups","cuts you never agreed to."]].map(([t,d])=>(
                <li key={t} className="flex gap-3">
                  <X className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(200,60,60,0.7)" }} />
                  <p style={{ color: C.gray, fontSize: "0.95rem" }}>
                    <span className="font-semibold" style={{ color: C.charcoal }}>{t}</span> — {d}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-7 pt-6 border-t border-[#D8DCF0]">
              <p className="font-semibold mb-3" style={{ color: C.charcoal, fontSize: "0.95rem" }}>At OnSpot, you get paid what you're worth.</p>
              <Link href="/find-work" className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: C.orange }}>
                Find work <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BetterWaySection() {
  return (
    <section style={{ background: C.lavenderBg }} className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-20 lg:pb-28 pt-4">
      <div className="mx-auto max-w-[1100px]">
        <div className="h-px mb-16" style={{ background: "rgba(100,110,180,0.2)" }} />
        <SectionEyebrow text="The Better Way" />
        <h2 className="mt-4 font-bold leading-tight mb-12" style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.charcoal }}>
          Companies pay less. Talent earns more.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl p-7" style={{ background: "white", border: "1px solid #D8DCF0" }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: "#8A95B0" }}>COMPANIES PAY</p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="line-through font-medium" style={{ color: "#9BA3BB", fontSize: "clamp(1.1rem, 1.6vw, 1.5rem)" }}>$2,500</span>
              <span className="font-bold" style={{ color: C.charcoal, fontSize: "clamp(2rem, 3vw, 2.8rem)", letterSpacing: "-0.03em" }}>$2,400</span>
            </div>
            <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-5" style={{ background: "#E8F5E9", color: "#2E7D32" }}>↓ Less than traditional outsourcing</span>
            <p style={{ color: C.gray, fontSize: "0.9rem", lineHeight: 1.6 }}>Same work, even better quality — without the layer of overhead traditional outsourcing adds on top.</p>
            <Link href="/hire-talent" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition" style={{ color: C.orange }}>
              Hire talent <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl p-7" style={{ background: C.navySection }}>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>TALENT EARNS</p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="line-through font-medium" style={{ color: "rgba(255,255,255,0.35)", fontSize: "clamp(1.1rem, 1.6vw, 1.5rem)" }}>$1,000</span>
              <span className="font-bold text-white" style={{ fontSize: "clamp(2rem, 3vw, 2.8rem)", letterSpacing: "-0.03em" }}>$2,000</span>
            </div>
            <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-5" style={{ background: "rgba(255,174,33,0.2)", color: C.orangeLight }}>↑ 2× what traditional outsourcing pays</span>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.6 }}>Because OnSpot's fee sits on top of the talent's rate, not carved out of it.</p>
            <Link href="/find-work" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition" style={{ color: C.orange }}>
              Find work <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        <p style={{ color: C.grayLight, fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 720 }} className="mb-5">
          Illustrative example — one role, one month. Traditional outsourcing: the company pays $2,500 and the talent keeps $1,000. OnSpot: the company pays $2,400 — the talent's full $2,000 rate plus a transparent $400 OnSpot fee.
        </p>
        <p className="font-semibold leading-snug" style={{ color: C.charcoal, fontSize: "clamp(1rem, 1.4vw, 1.15rem)", maxWidth: 680 }}>
          We don't create savings by paying talent less. We create savings by{" "}
          <span style={{ color: C.orange }}>taking less in between.</span>
        </p>
      </div>
    </section>
  );
}

function TalentTestimonialSection() {
  return (
    <section style={{ background: C.warmBg }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionEyebrow text="For Talents" />
        <blockquote className="mt-4 font-bold leading-tight mb-6" style={{ fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)", letterSpacing: "-0.025em", color: C.charcoal, maxWidth: 760 }}>
          "Real work. Real growth.{" "}
          <span style={{ color: C.orange }}>From wherever you call home.</span>"
        </blockquote>
        <p className="mb-8 leading-relaxed" style={{ color: C.gray, fontSize: "1rem", maxWidth: 540 }}>
          Set your rate and keep it — OnSpot's fee is added on top, never taken out of your pay. Just great clients and reliable payouts.
        </p>
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: "linear-gradient(135deg,#3A3AF8,#7F3DF4)" }}>MA</div>
          <div>
            <p className="font-semibold text-sm" style={{ color: C.charcoal }}>Mark Apartol</p>
            <p style={{ color: C.grayLight, fontSize: "0.8rem" }}>Co-founder &amp; COO</p>
          </div>
        </div>
        <Link href="/find-work" className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold transition hover:bg-black/5" style={{ borderColor: C.charcoal, color: C.charcoal, fontSize: "0.95rem" }}>
          Find work <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

function JobListingsSection() {
  const { data: rawJobs } = useQuery({
    queryKey: ["/api/jobs/popular"],
    queryFn: async () => {
      const r = await fetch("/api/jobs/popular");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.items ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
  const jobs = (rawJobs ?? []).filter((j: any) => j.title?.toLowerCase() !== "test").slice(0, 4);
  return (
    <section style={{ background: C.navySection }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionEyebrow text="For Talents" dark />
        <h2 className="mt-4 font-bold leading-tight mb-4" style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: "white", maxWidth: 680 }}>
          Hundreds of high-paying jobs. <span style={{ color: C.orangeLight }}>Open right now.</span>
        </h2>
        <p className="mb-10" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", maxWidth: 540 }}>
          Real roles with great companies — all roles that reflect what your work is actually worth. New jobs open every week.
        </p>
        {jobs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {jobs.map((job: any) => (
              <div key={job.id} className="rounded-2xl p-5 flex flex-col" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="inline-block text-[10px] font-bold tracking-wider uppercase rounded-md px-2.5 py-1 mb-4 self-start" style={{ background: "rgba(255,174,33,0.18)", color: C.orange }}>HIRING NOW</span>
                <p className="text-white font-semibold leading-snug mb-2 flex-1" style={{ fontSize: "0.95rem" }}>{job.title}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }} className="mb-3">
                  {[job.contractType, job.location].filter(Boolean).join(" · ") || "Full-time · Remote"}
                </p>
                {(job.budget || job.hourlyRateMin) && (
                  <p className="font-semibold mb-4" style={{ color: C.orange, fontSize: "0.9rem" }}>
                    {job.budget ? `${job.budgetCurrency ?? "PHP"} ${job.budget}` : `${job.budgetCurrency ?? "USD"} ${job.hourlyRateMin}${job.hourlyRateMax ? ` – ${job.hourlyRateMax}` : ""}`}
                  </p>
                )}
                <Link href={`/jobs/${job.id}`}>
                  <button className="flex items-center gap-1 text-xs font-semibold transition hover:opacity-80 mt-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
                    View role <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col items-start gap-4">
          <Link href="/find-work/jobs">
            <button className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 font-semibold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.3)", fontSize: "0.95rem" }}>
              Browse all jobs <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>Set your rate. Keep your rate. OnSpot's fee is never taken out of your pay.</p>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section style={{ background: `radial-gradient(55% 70% at 50% 0%, rgba(75,81,184,0.07), transparent 70%), #F7F7FB` }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionEyebrow text="The Plan" />
        <h2 className="mt-4 font-bold leading-tight mb-3" style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.charcoal }}>From posted to placed</h2>
        <p className="mb-14" style={{ color: C.gray, fontSize: "1rem" }}>Three steps. No bidding wars, no long contracts, no hidden markups.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { num:"1", title:"Post or apply",  text:"Tell us what you need. Or show us what you can do.",                   ctas:[{label:"Post a role →",href:"/hire-talent"},{label:"Apply as talent →",href:"/find-work/jobs"}] },
            { num:"2", title:"Get matched",    text:"We connect the right people, fast — no endless scrolling.",           ctas:[{label:"See how matching works →",href:"/why-onspot"}] },
            { num:"3", title:"Start working",  text:"Show up and do the work. We handle everything else.",                 ctas:[{label:"Get started →",href:"/hire-talent"}] },
          ].map((step, i) => (
            <div key={i} className="relative">
              {i < 2 && <div className="hidden md:block absolute top-8 left-full z-0 h-px" style={{ background: "linear-gradient(to right, #D0D4E8, transparent)", width: "calc(100% - 2rem)" }} />}
              <div className="relative z-10 rounded-2xl p-6" style={{ background: "white", border: "1px solid #E0E4F0" }}>
                <div className="flex items-start justify-between mb-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(75,81,184,0.1)", color: C.indigo }}>
                    <span className="text-lg font-bold">{step.num}</span>
                  </div>
                  <span className="font-bold text-4xl tabular-nums" style={{ color: "#E8EAF5", letterSpacing: "-0.04em" }}>{step.num}</span>
                </div>
                <h3 className="font-bold mb-2" style={{ fontSize: "1.05rem", color: C.charcoal }}>{step.title}</h3>
                <p className="mb-5" style={{ color: C.gray, fontSize: "0.9rem", lineHeight: 1.6 }}>{step.text}</p>
                <div className="flex flex-wrap gap-3">
                  {step.ctas.map(l => (
                    <Link key={l.label} href={l.href} className="text-xs font-semibold hover:opacity-80 transition" style={{ color: C.orange }}>{l.label}</Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: C.gray, fontSize: "0.95rem" }}>That's it.{" "}<span className="font-semibold" style={{ color: C.orange }}>Most roles are filled in days, not months.</span></p>
      </div>
    </section>
  );
}

function EquationSection() {
  return (
    <section style={{ background: C.lavenderBg }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionEyebrow text="The Right Way to Outsource" />
        <h2 className="mt-4 font-bold leading-tight mb-3" style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.charcoal }}>We changed the equation.</h2>
        <p className="mb-12" style={{ color: C.gray, fontSize: "1rem", maxWidth: 560 }}>Everyone else makes you pick two: speed, accountability, or cost. OnSpot doesn't.</p>
        <div className="grid grid-cols-3 rounded-2xl overflow-hidden mb-10 text-sm">
          <div className="px-5 py-4" style={{ background: "#E0E4F4", borderRight: "1px solid #CBD0E8" }}>
            <p className="font-bold text-[11px] tracking-[0.1em] uppercase" style={{ color: "#7A849C" }}>FREELANCE MARKETPLACES</p>
            <p className="font-semibold mt-1" style={{ color: C.gray, fontSize: "0.85rem" }}>Fast and cheap</p>
          </div>
          <div className="px-5 py-4 text-center" style={{ background: C.navySection }}>
            <p className="font-bold text-[11px] tracking-[0.1em] uppercase" style={{ color: C.orange }}>— ONSPOT</p>
            <p className="font-semibold mt-1 text-white" style={{ fontSize: "0.85rem" }}>Great talent. High pay. Fair cost.</p>
          </div>
          <div className="px-5 py-4 text-right" style={{ background: "#E0E4F4" }}>
            <p className="font-bold text-[11px] tracking-[0.1em] uppercase" style={{ color: "#7A849C" }}>TRADITIONAL OUTSOURCING</p>
            <p className="font-semibold mt-1" style={{ color: C.gray, fontSize: "0.85rem" }}>Reliable, but heavy</p>
          </div>
          {/* Row 1 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E8ECF6", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} /><span style={{ color: C.gray }}>No accountability</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} /><span className="text-white" style={{ fontSize: "0.9rem" }}>Vetted talent, ready fast</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E8ECF6", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: C.gray }}>Slow and rigid</span><X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
          {/* Row 2 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E2E6F2", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} /><span style={{ color: C.gray }}>No oversight</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} /><span className="text-white" style={{ fontSize: "0.9rem" }}>Accountable, managed relationships</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E2E6F2", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: C.gray }}>Expensive overhead</span><X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
          {/* Row 3 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E8ECF6", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} /><span style={{ color: C.gray }}>Race-to-bottom pay</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} /><span className="text-white" style={{ fontSize: "0.9rem" }}>No overhead cost</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E8ECF6", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: C.gray }}>Slow to start</span><X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
        </div>
        <p style={{ color: C.charcoal, fontSize: "1rem", maxWidth: 680 }}>
          Everyone else trades one thing for another. OnSpot doesn't trade —{" "}
          <span className="font-semibold" style={{ color: C.orange }}>we raise the whole experience.</span>
        </p>
      </div>
    </section>
  );
}

function FounderQuoteSection() {
  return (
    <section style={{ background: C.lavenderBg }} className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-20 lg:pb-28 pt-4">
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-2xl p-8 sm:p-10 lg:p-14" style={{ background: "#0D1B4B" }}>
          <SectionEyebrow text="Why OnSpot" dark />
          <blockquote className="mt-4 font-bold text-white leading-tight mb-6" style={{ fontSize: "clamp(1.3rem, 2.2vw, 2rem)", letterSpacing: "-0.02em", maxWidth: 780 }}>
            "We've watched good companies get stuck choosing between{" "}
            <span style={{ color: C.orangeLight }}>marketplace chaos</span> and{" "}
            <span style={{ color: C.orangeLight }}>outsourcing overhead</span> — and good talent get squeezed by both sides of that same trade-off."
          </blockquote>
          <p className="mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", maxWidth: 680 }}>
            So we built OnSpot the way operators build things — not software developers guessing at the problem from the outside.
          </p>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: `linear-gradient(135deg, ${C.orange}, #E07B00)` }}>NL</div>
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

function CompanyTestimonialSection() {
  return (
    <section style={{ background: C.navySection }} className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionEyebrow text="For Companies" dark />
        <blockquote className="mt-4 font-bold leading-tight mb-6" style={{ fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)", letterSpacing: "-0.025em", color: "white", maxWidth: 760 }}>
          "The team you've been picturing,{" "}
          <span style={{ color: C.orangeLight }}>without the wait or the complexity.</span>"
        </blockquote>
        <div className="flex items-center gap-3 mb-7">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: "linear-gradient(135deg,#3A3AF8,#5B7CFF)" }}>JS</div>
          <div>
            <p className="font-semibold text-sm text-white">John Steinberg</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" }}>Founder &amp; President</p>
          </div>
        </div>
        <p className="mb-9 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", maxWidth: 520 }}>
          Vetted talent, quick starts, and simpler hiring — with a transparent fee you can see. So you can just build your team.
        </p>
        <Link href="/hire-talent" className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 font-semibold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.3)", fontSize: "0.95rem" }}>
          Hire talent →
        </Link>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section
      style={{ background: `linear-gradient(160deg, ${C.indigoDeep} 0%, #1a0d40 50%, ${C.dark3} 100%)` }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-24 lg:py-36 text-center"
    >
      <div className="mx-auto max-w-[820px]">
        <p className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/85 mb-6">
          <span aria-hidden="true" className="inline-block h-[2px] w-4 rounded" style={{ background: C.orange }} />
          Work Without Limits
        </p>
        <h2
          className="font-bold tracking-tight text-white"
          style={{ fontSize: "clamp(1.9rem, 4.2vw, 3.125rem)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
        >
          Some of the best teams in the world already work this way.
        </h2>
        <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,0.68)" }}>
          The ones who wait keep losing good people to delay and overhead. The ones who don't build without limits — and the people who work with them earn without limits.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/hire-talent"
            className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-full bg-white px-9 text-[15.5px] font-semibold transition hover:-translate-y-[1px] hover:bg-white/95"
            style={{ color: C.indigo, boxShadow: "0 16px 36px -12px rgba(10,10,60,0.45)" }}
          >
            Hire talent →
          </Link>
          <Link
            href="/find-work/jobs"
            className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-full px-9 text-[15.5px] font-semibold text-white transition hover:-translate-y-[1px]"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(8px)" }}
          >
            Find work →
          </Link>
        </div>
      </div>
    </section>
  );
}
