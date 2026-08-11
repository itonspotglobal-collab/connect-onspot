import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play, Check, X, Star, Search, ArrowRight, FileText, Zap, Rocket, Users } from "lucide-react";
import jakePhoto from "@assets/Jake_1780574815787.png";
import nurPhoto from "@assets/Nur_1780574815788.png";
import markPhoto from "@assets/Macky_1780574815788.png";

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
      <EquationSection />
      <FounderQuoteSection />
      <SplitTestimonialSection />
      <OpenJobsSection />
      <ProcessSection />
      <FinalCtaSection />

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

  // Slide 4 — real talent data from /api/candidates (same source as Hire Talent page)
  const { data: rawCandidates, isLoading: candidatesLoading } = useQuery<any[]>({
    queryKey: ["/api/candidates"],
    queryFn: async () => {
      const r = await fetch("/api/candidates");
      if (!r.ok) { console.error("[Home slide 4] candidates fetch failed", r.status); return []; }
      const d = await r.json();
      return Array.isArray(d) ? d : (d.items ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
  const liveTalents = (rawCandidates ?? [])
    .filter((c: any) => c.availability !== "unavailable")
    .sort((a: any, b: any) => {
      // Featured/active first, then by experience
      const aAvail = a.availability === "available" ? 0 : 1;
      const bAvail = b.availability === "available" ? 0 : 1;
      if (aAvail !== bAvail) return aAvail - bAvail;
      return (b.experienceYears ?? 0) - (a.experienceYears ?? 0);
    })
    .slice(0, 4);

  // Slide 5 — real job data from full search endpoint (same source as Browse Jobs)
  const { data: rawJobs, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs/search", "hero"],
    queryFn: async () => {
      const r = await fetch("/api/jobs/search?status=open&pageSize=8");
      if (!r.ok) { console.error("[Home slide 5] jobs fetch failed", r.status); return []; }
      const d = await r.json();
      return Array.isArray(d) ? d : (d.items ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
  const liveJobs = (rawJobs ?? [])
    .filter((j: any) => j.title?.toLowerCase() !== "test")
    .sort((a: any, b: any) => Number(b.isFeatured ?? 0) - Number(a.isFeatured ?? 0))
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
      style={{ minHeight: "calc(100svh - 74px)", background: slideBg(active.id), transition: "background 0.65s ease", display: "flex", flexDirection: "column" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Hero carousel"
    >
      {/* Slide content — full height flex column */}
      <div
        className="relative z-10 flex-1 w-full flex flex-col"
        style={{ maxWidth: 1180, marginInline: "auto", paddingInline: "clamp(24px, 5vw, 64px)" }}
      >
        {/* Main content area — flex-1 so it fills remaining space; centers its children */}
        <div
          key={`slide-${slide}`}
          className="flex flex-1 min-h-0 items-center"
          style={{ animation: "homeHeroIn 0.55s ease forwards", opacity: 0 }}
        >
          {active.id === "work"      && <WorkSlide      isDark={isDark} />}
          {active.id === "companies" && <CompaniesSlide isDark={isDark} />}
          {active.id === "talent"    && <TalentSlide    isDark={isDark} />}
          {active.id === "network"   && <NetworkSlide   isDark={isDark} liveTalents={liveTalents} isLoading={candidatesLoading} />}
          {active.id === "jobs"      && <JobsSlide      isDark={isDark} liveJobs={liveJobs} isLoading={jobsLoading} />}
        </div>

        {/* Controls row — natural bottom of flex column, always visible */}
        <div className="flex items-center gap-3 flex-shrink-0" style={{ paddingBottom: "clamp(20px, 4vh, 44px)" }}>
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
      className="mb-4 font-semibold uppercase tracking-[0.1em]"
      style={{ fontSize: "clamp(12px, 0.9vw, 14px)", color: isDark ? "rgba(255,255,255,0.75)" : C.indigo }}
    >
      <span className="inline-block mr-2 h-[2px] w-4 rounded align-middle" style={{ background: C.orange }} />
      {text.replace(/^— /, "")}
    </p>
  );
}

// ── Two-column slide wrapper ──────────────────────────────────────────────────
function TwoCol({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 items-center w-full"
      style={{ gap: "clamp(24px, 6vw, 88px)" }}
    >
      <div className="min-w-0">{left}</div>
      <div className="min-w-0 lg:flex lg:justify-end">{right}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — WORK (dark, centered)
// ══════════════════════════════════════════════════════════════════════════════
function WorkSlide({ isDark }: { isDark: boolean }) {
  return (
    <div className="mx-auto flex w-full flex-col items-center text-center" style={{ maxWidth: 950 }}>
      <h1
        className="font-bold tracking-tight"
        style={{ fontSize: "clamp(58px, 5.6vw, 82px)", lineHeight: 0.99, letterSpacing: "-0.03em" }}
      >
        <span className="text-white">Work </span>
        <span style={{ color: C.orangeLight }}>Without</span>
        <span className="text-white"> Limits</span>
      </h1>

      <p className="mt-5" style={{ fontSize: "clamp(16px, 1.35vw, 22px)", lineHeight: 1.4, whiteSpace: "nowrap", width: "max-content", maxWidth: "100%", marginInline: "auto" }}>
        <span className="font-semibold text-white">One system.</span>{" "}
        <span style={{ color: "rgba(199,203,242,0.8)" }}>Highest pay for talents at lower cost to companies.</span>
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
            style={{ fontSize: "clamp(46px, 5.2vw, 76px)", letterSpacing: "-0.03em" }}
          >
            <span style={{ color: C.charcoal }}>Hire </span>
            <span style={{ color: C.indigo }}>Without<br />Limits.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium" style={{ fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1.45, color: C.charcoal }}>
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
  const TEAM = [
    { i: "MR", n: "Maria R.",  r: "Customer Support Lead", perf: "4.9", sal: "$2,400" },
    { i: "JT", n: "Josh T.",   r: "Data Analyst",          perf: "4.7", sal: "$2,850" },
    { i: "AL", n: "Anna L.",   r: "Virtual Assistant",     perf: "4.8", sal: "$1,900" },
    { i: "DK", n: "David K.",  r: "Sales Associate",       perf: "4.6", sal: "$2,100" },
  ];
  const VACANT = [
    { r: "Customer Support Rep", c: "5 candidates in review", d: "Open 2 days" },
    { r: "Sales Associate",      c: "6 candidates in review", d: "Open 3 days" },
    { r: "Data Analyst",         c: "3 candidates in review", d: "Open 1 day"  },
  ];
  return (
    <div className="relative w-full" style={{ maxWidth: "clamp(440px, 40vw, 600px)" }}>
      {/* Purple glow */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-full"
        style={{ background: "radial-gradient(60% 55% at 50% 55%, rgba(75,81,184,0.18), transparent 70%)", filter: "blur(12px)" }}
      />
      {/* Laptop shell */}
      <div
        className="relative rounded-[14px] p-[10px]"
        style={{ background: "linear-gradient(170deg, #2a2a2f 0%, #18181c 100%)", border: "1.5px solid rgba(255,255,255,0.12)", boxShadow: "0 32px 64px -24px rgba(10,12,50,0.6)" }}
      >
        {/* Camera dot */}
        <div className="flex justify-center mb-1.5">
          <div className="h-[3px] w-[3px] rounded-full" style={{ background: "#3a3a3c" }} />
        </div>
        {/* Screen */}
        <div className="overflow-hidden rounded-[8px] bg-white">

          {/* Top bar */}
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "#EDEDF2" }}>
            <span className="text-[12px] font-bold" style={{ color: C.charcoal }}>OnSpot</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]" style={{ color: C.grayLight }}>Gentech LLC</span>
              <div className="h-5 w-5 rounded-full flex-shrink-0" style={{ background: C.indigoLight }} />
            </div>
          </div>

          <div className="px-4 pb-3.5 pt-2.5">
            {/* Dashboard header */}
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-[13px] font-bold" style={{ color: C.charcoal }}>Team dashboard</p>
              <p className="text-[9px]" style={{ color: C.grayLight }}>Last 6 months</p>
            </div>

            {/* 4 stat cards */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[
                { label: "MONTHLY COST",     value: "$18,400", sub: "▼ 22% vs traditional", subColor: "#2E7D32" },
                { label: "HEADCOUNT",        value: "8",       sub: "Active members",        subColor: C.gray },
                { label: "AVG. PERFORMANCE", value: "4.8/5",   sub: "Across roles",          subColor: C.gray },
                { label: "RETENTION",        value: "94%",     sub: "Continuity",            subColor: C.gray },
              ].map((s) => (
                <div key={s.label} className="rounded-[7px] px-2 py-2" style={{ background: "#EEEDFB", border: "1px solid rgba(75,81,184,0.15)" }}>
                  <p className="font-bold uppercase tracking-wide leading-tight" style={{ fontSize: "6px", color: C.indigo }}>{s.label}</p>
                  <p className="font-bold leading-tight mt-0.5" style={{ fontSize: "13px", color: C.charcoal }}>{s.value}</p>
                  <p className="mt-0.5" style={{ fontSize: "6.5px", color: s.subColor }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Team Performance */}
            <p className="font-bold uppercase tracking-wide mb-1" style={{ fontSize: "7.5px", color: C.grayLight }}>Team Performance</p>
            <div className="mb-2.5" style={{ border: "1px solid #EEEDFB", borderRadius: 7, overflow: "hidden" }}>
              {TEAM.map((m, idx) => (
                <div
                  key={m.i}
                  className="flex items-center justify-between px-2.5 py-1.5"
                  style={{ borderTop: idx > 0 ? "1px solid #EEEDFB" : "none" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-[18px] w-[18px] flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white" style={{ fontSize: "6.5px", background: C.indigo }}>{m.i}</div>
                    <div>
                      <p className="font-semibold leading-none" style={{ fontSize: "9px", color: C.charcoal }}>{m.n}</p>
                      <p className="leading-none mt-[2px]" style={{ fontSize: "7.5px", color: C.grayLight }}>{m.r}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="rounded-full px-1.5 py-[2px] font-semibold" style={{ fontSize: "7px", background: "rgba(34,197,94,0.12)", color: "#15803d" }}>★ {m.perf}</span>
                    <span className="font-semibold" style={{ fontSize: "9px", color: C.charcoal }}>{m.sal}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hiring */}
            <p className="font-bold uppercase tracking-wide mb-1" style={{ fontSize: "7.5px", color: C.grayLight }}>Hiring</p>
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              <div className="rounded-[7px] px-2.5 py-2" style={{ background: "#EEEDFB", border: "1px solid rgba(75,81,184,0.15)" }}>
                <p className="font-bold leading-none" style={{ fontSize: "16px", color: C.charcoal }}>3</p>
                <p className="font-semibold mt-0.5" style={{ fontSize: "8px", color: C.indigo }}>Open roles</p>
              </div>
              <div className="rounded-[7px] px-2.5 py-2" style={{ background: "#EEEDFB", border: "1px solid rgba(75,81,184,0.15)" }}>
                <p className="font-bold leading-none" style={{ fontSize: "16px", color: C.charcoal }}>6 <span style={{ fontSize: "9px", fontWeight: 600 }}>days</span></p>
                <p className="leading-tight mt-0.5" style={{ fontSize: "7px", color: C.grayLight }}>Avg. time-to-fill <span style={{ color: C.indigo }}>(vs 39 industry avg)</span></p>
              </div>
            </div>

            {/* Vacant Roles */}
            <p className="font-bold uppercase tracking-wide mb-1" style={{ fontSize: "7.5px", color: C.grayLight }}>Vacant Roles</p>
            <div style={{ border: "1px solid #EEEDFB", borderRadius: 7, overflow: "hidden" }}>
              {VACANT.map((v, idx) => (
                <div
                  key={v.r}
                  className="flex items-center justify-between px-2.5 py-1.5"
                  style={{ borderTop: idx > 0 ? "1px solid #EEEDFB" : "none" }}
                >
                  <div>
                    <p className="font-semibold leading-none" style={{ fontSize: "9px", color: C.charcoal }}>{v.r}</p>
                    <p className="leading-none mt-[2px]" style={{ fontSize: "7.5px", color: C.indigo }}>{v.c}</p>
                  </div>
                  <p className="flex-shrink-0 ml-2" style={{ fontSize: "7.5px", color: C.grayLight }}>{v.d}</p>
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
            style={{ fontSize: "clamp(46px, 5.2vw, 76px)", letterSpacing: "-0.03em" }}
          >
            Earn{" "}
            <span style={{ color: C.orangeLight }}>Without<br />Limits.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium text-white" style={{ fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1.45 }}>
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
  { month: "Mar", h: 35 },
  { month: "Apr", h: 52 },
  { month: "May", h: 38 },
  { month: "Jun", h: 65 },
  { month: "Jul", h: 58 },
  { month: "Aug", h: 90 },
];

function PhoneMockup() {
  return (
    <div className="relative ml-auto" style={{ width: "clamp(205px, 17vw, 235px)", maxWidth: "100%" }}>
      {/* Ambient glow */}
      <div aria-hidden className="absolute -inset-8 rounded-full" style={{ background: "radial-gradient(55% 50% at 50% 48%, rgba(255,174,33,0.14), transparent 70%)", filter: "blur(14px)" }} />

      {/* Phone shell — dark navy, tall aspect, large corners */}
      <div
        className="relative rounded-[36px] p-[8px]"
        style={{
          background: "linear-gradient(170deg, #111328 0%, #080a1a 100%)",
          border: "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 80px -16px rgba(4,6,24,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Dynamic Island — black pill notch */}
        <div className="flex justify-center pt-[7px] pb-[5px]">
          <div className="h-[7px] w-[52px] rounded-full" style={{ background: "#000" }} />
        </div>

        {/* White screen */}
        <div className="overflow-hidden rounded-[28px] bg-white">

          {/* App top bar */}
          <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-[13px] w-[13px] rounded-[3px] flex-shrink-0" style={{ background: C.orange }} />
              <span className="font-bold leading-none" style={{ fontSize: 10.5, color: C.charcoal }}>OnSpot</span>
            </div>
            <div className="h-[17px] w-[17px] rounded-full flex-shrink-0" style={{ background: "#6C63FF" }} />
          </div>

          {/* Earnings title + subtitle */}
          <div className="px-3.5 pb-1.5">
            <p className="font-bold leading-tight" style={{ fontSize: 14, color: C.charcoal }}>Earnings summary</p>
            <p className="mt-[2px]" style={{ fontSize: 9, color: C.grayLight }}>Last 6 months</p>
          </div>

          <div className="px-3.5 pb-3 space-y-1.5">
            {/* Main earnings card — cream bg, orange border */}
            <div
              className="rounded-[9px] px-3 py-2"
              style={{ background: "#FFFAF3", border: "1px solid rgba(255,174,33,0.45)" }}
            >
              <p className="uppercase tracking-wider" style={{ fontSize: 7, fontWeight: 600, color: C.grayLight }}>
                TOTAL EARNED THIS MONTH
              </p>
              <p className="font-bold leading-none mt-[3px]" style={{ fontSize: 26, color: C.charcoal }}>$3,455</p>
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 mt-[5px]"
                style={{ fontSize: 7, fontWeight: 600, paddingTop: 2, paddingBottom: 2, background: "rgba(34,197,94,0.12)", color: "#15803d" }}
              >
                ▲ 18% vs last month
              </span>
            </div>

            {/* Secondary stat cards */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "AVG. RATE",      value: "$20/hr" },
                { label: "ACTIVE\nCLIENTS", value: "2"     },
              ].map((s) => (
                <div key={s.label} className="rounded-[7px] px-2 py-1.5" style={{ background: "#F4F4F8" }}>
                  <p className="uppercase tracking-wide leading-tight whitespace-pre-line" style={{ fontSize: 6.5, fontWeight: 700, color: C.grayLight }}>{s.label}</p>
                  <p className="font-bold leading-none mt-[3px]" style={{ fontSize: 14, color: C.charcoal }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Bar chart — pixel heights so bars always render */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 62, gap: 4, padding: "0 2px" }}>
              {[
                { month: "Mar", h: 18 },
                { month: "Apr", h: 30 },
                { month: "May", h: 22 },
                { month: "Jun", h: 40 },
                { month: "Jul", h: 34 },
                { month: "Aug", h: 54 },
              ].map((b) => (
                <div key={b.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 2 }}>
                  <div style={{ width: "100%", maxWidth: 22, minWidth: 10, height: b.h, background: "#FFAE22", borderRadius: "3px 3px 0 0", flexShrink: 0 }} />
                  <span style={{ fontSize: 6, color: C.grayLight, lineHeight: 1, flexShrink: 0 }}>{b.month}</span>
                </div>
              ))}
            </div>

            {/* Earnings by client — with progress bars */}
            <div>
              <p className="uppercase tracking-wider mb-1.5" style={{ fontSize: 7, fontWeight: 700, color: C.grayLight }}>
                EARNINGS BY CLIENT
              </p>
              {[
                { n: "New Tech AI",      amt: "$2,000", pct: 92 },
                { n: "John Roberts LLC", amt: "$1,455", pct: 67 },
              ].map((c) => (
                <div key={c.n} className="mb-1.5 last:mb-0">
                  <div className="flex items-center justify-between mb-[3px]">
                    <p className="font-medium" style={{ fontSize: 9.5, color: C.charcoal }}>{c.n}</p>
                    <p className="font-semibold" style={{ fontSize: 9.5, color: C.charcoal }}>{c.amt}</p>
                  </div>
                  <div className="h-[2.5px] w-full rounded-full" style={{ background: "#EEEDFB" }}>
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: C.indigo }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — NETWORK (light, 2-col + talent list card)
// ══════════════════════════════════════════════════════════════════════════════
function NetworkSlide({ isDark, liveTalents, isLoading }: { isDark: boolean; liveTalents: any[]; isLoading: boolean }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="THE TALENT NETWORK" isDark={isDark} />
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: "clamp(46px, 4.2vw, 68px)", lineHeight: 0.98, letterSpacing: "-0.03em", color: C.charcoal, maxWidth: 500 }}
          >
            Thousands of<br />
            talents.{" "}
            <span style={{ color: C.indigo }}>Ready to<br />work.</span>
          </h1>
          <p className="mt-4 font-medium" style={{ fontSize: "clamp(20px, 1.6vw, 27px)", lineHeight: 1.45, color: C.charcoal, maxWidth: 500 }}>
            Vetted, experienced, and{" "}
            <span className="font-bold" style={{ color: C.orangeDeep }}>ready to start in days — not months.</span>
          </p>
          <p className="mt-3 leading-relaxed" style={{ fontSize: "clamp(15px, 1vw, 17px)", color: C.gray, maxWidth: 500 }}>
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
      right={<TalentListCard candidates={liveTalents} isLoading={isLoading} />}
    />
  );
}

function talentInitials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name ?? "??").slice(0, 2).toUpperCase();
}

function TalentListCard({ candidates, isLoading }: { candidates: any[]; isLoading: boolean }) {
  return (
    <div className="relative" style={{ width: "clamp(400px, 38vw, 520px)", maxWidth: "100%" }}>
      {/* Glow */}
      <div aria-hidden className="absolute -inset-6 rounded-full" style={{ background: "radial-gradient(60% 55% at 50% 50%, rgba(75,81,184,0.12), transparent 70%)", filter: "blur(10px)" }} />
      <div
        className="relative rounded-[18px] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(75,81,184,0.18)", backdropFilter: "blur(14px)", boxShadow: "0 24px 56px rgba(75,81,184,0.12)" }}
      >
        {/* Search bar (decorative — mirrors Hire Talent visual) */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#EEEDFB" }}>
          <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: "#F4F3FC", border: "1px solid #DDDCF4" }}>
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.indigoLight }} />
            <span className="text-[11px]" style={{ color: C.grayLight }}>Customer support, bookkeeping, sales...</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {["Available now", "4.5★ and up", "3+ yrs experience"].map((f) => (
              <span key={f} className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(75,81,184,0.1)", color: C.indigo, border: "1px solid rgba(75,81,184,0.2)" }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Talent rows */}
        <div className="divide-y" style={{ divideColor: "#EEEDFB" }}>
          {isLoading ? (
            // Skeleton rows — preserve card height while loading
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 flex-shrink-0 rounded-full bg-[#EEEDFB]" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-24 rounded bg-[#EEEDFB]" />
                    <div className="h-2 w-32 rounded bg-[#F4F3FC]" />
                  </div>
                </div>
                <div className="h-4 w-14 rounded-full bg-[#EEEDFB]" />
              </div>
            ))
          ) : candidates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] mb-2" style={{ color: C.gray }}>No available talent right now.</p>
              <Link href="/hire-talent" className="text-[11px] font-semibold hover:underline" style={{ color: C.indigo }}>Browse talent →</Link>
            </div>
          ) : (
            candidates.map((c: any) => {
              const name = c.fullName || c.displayName || "Talent";
              const role = c.targetPosition || c.headline || "Professional";
              const yrs  = c.experienceYears ? `${c.experienceYears} yr${c.experienceYears !== 1 ? "s" : ""}` : null;
              const isAvail = c.availability === "available" || c.availability === "Available";
              return (
                <Link
                  key={c.id}
                  href={`/talent-profile/${c.id}`}
                  className="px-4 py-3 hover:bg-[#F8F7FD] transition-colors cursor-pointer"
                  style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}
                >
                  {/* Avatar */}
                  {c.profilePhotoUrl ? (
                    <img src={c.profilePhotoUrl} alt={name} className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: C.indigo }}>
                      {talentInitials(name)}
                    </div>
                  )}
                  {/* Name / role */}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-snug truncate" style={{ color: C.charcoal }}>{name}</p>
                    <p className="text-[10px] leading-snug truncate" style={{ color: C.gray }}>
                      {role}{yrs ? ` · ${yrs}` : ""}
                    </p>
                  </div>
                  {/* Rating / availability */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {c.rating != null && (
                      <span className="text-[10px] font-semibold" style={{ color: C.charcoal }}>★ {Number(c.rating).toFixed(1)}</span>
                    )}
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold whitespace-nowrap" style={{ background: isAvail ? "rgba(46,186,107,0.12)" : "rgba(75,81,184,0.1)", color: isAvail ? "#1a7d42" : C.indigo }}>
                      {isAvail ? "Ready now" : "Open to offers"}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
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
function JobsSlide({ isDark, liveJobs, isLoading }: { isDark: boolean; liveJobs: any[]; isLoading: boolean }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="FOR TALENTS" isDark={isDark} />
          <h1
            className="font-bold tracking-tight text-white"
            style={{ fontSize: "clamp(46px, 4.15vw, 68px)", lineHeight: 0.98, letterSpacing: "-0.03em", maxWidth: 510 }}
          >
            Hundreds of<br />
            high-paying jobs.<br />
            <span style={{ color: C.orangeLight }}>Open right now.</span>
          </h1>
          <p className="mt-4 font-medium text-white" style={{ fontSize: "clamp(20px, 1.6vw, 27px)", lineHeight: 1.45, maxWidth: 510 }}>
            Real roles, real rates —{" "}
            <span className="font-bold" style={{ color: C.orangeLight }}>and new jobs opening every week.</span>
          </p>
          <p className="mt-3 leading-relaxed" style={{ fontSize: "clamp(15px, 1vw, 17px)", color: "rgba(255,255,255,0.62)", maxWidth: 510 }}>
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
      right={<OpenRolesCard liveJobs={liveJobs} isLoading={isLoading} />}
    />
  );
}

function jobPay(j: any): string | null {
  if (j.salaryDisplay) return j.salaryDisplay;
  if (j.hourlyRateMin)
    return `USD ${j.hourlyRateMin}${j.hourlyRateMax ? ` – ${j.hourlyRateMax}` : ""}/hr`;
  if (j.budget)
    return `${j.budgetCurrency ?? "PHP"} ${j.budget}`;
  return null;
}

function OpenRolesCard({ liveJobs, isLoading }: { liveJobs: any[]; isLoading: boolean }) {
  return (
    <div className="relative" style={{ width: "clamp(400px, 37vw, 500px)", maxWidth: "100%" }}>
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
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 animate-pulse">
                <div className="space-y-1.5">
                  <div className="h-3 w-36 rounded bg-gray-100" />
                  <div className="h-2 w-24 rounded bg-gray-50" />
                </div>
                <div className="h-4 w-16 rounded-full bg-gray-100 ml-3" />
              </div>
            ))
          ) : liveJobs.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[12px] mb-2" style={{ color: C.gray }}>No open roles right now.</p>
              <Link href="/find-work/jobs" className="text-[11px] font-semibold hover:underline" style={{ color: C.indigo }}>Browse all jobs →</Link>
            </div>
          ) : (
            liveJobs.map((j: any) => {
              const location = j.location || j.contractType || "Remote";
              const pay = jobPay(j);
              return (
                <Link
                  key={j.id}
                  href={`/find-work/job/${j.id}`}
                  className="px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                  style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: C.charcoal, overflowWrap: "anywhere" }}>{j.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>
                      {location}{pay ? ` · ${pay}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {j.isFeatured && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(255,174,33,0.18)", color: C.orangeDeep }}>Featured</span>
                    )}
                    <span className="rounded-full px-2.5 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(46,186,107,0.12)", color: "#1a7d42" }}>
                      Hiring now
                    </span>
                  </div>
                </Link>
              );
            })
          )}
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
// BELOW-FOLD SECTIONS
// ══════════════════════════════════════════════════════════════════════════════

// Shared section eyebrow
function SectionEyebrow({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <p
      className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: dark ? "rgba(255,255,255,0.75)" : C.indigo }}
    >
      <span className="inline-block h-[2px] w-4 flex-shrink-0 rounded" style={{ background: C.orange }} />
      {text}
    </p>
  );
}

// ── SECTION 1 — THE PROBLEM WITH OUTSOURCING TODAY ───────────────────────────
function ProblemSection() {
  return (
    <section
      style={{ background: "#F7F7FB" }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      {/* Centered header */}
      <div className="mx-auto max-w-[680px] text-center mb-16">
        <SectionEyebrow text="The Problem With Outsourcing Today" />
        <h2
          className="mt-5 font-bold leading-tight"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: C.charcoal,
          }}
        >
          Outsourcing is broken. Both<br />sides are paying for it.
        </h2>
        <p
          className="mt-5 mx-auto"
          style={{ color: C.gray, fontSize: "clamp(1rem, 1.5vw, 1.15rem)", maxWidth: 580, lineHeight: 1.6 }}
        >
          A middleman sits between you — inflating what companies pay and shrinking what talent takes home.
        </p>
      </div>

      {/* Two cards — centered, constrained */}
      <div className="mx-auto max-w-[1080px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT — dark navy */}
          <div
            className="rounded-2xl p-8 lg:p-10 flex flex-col"
            style={{ background: C.navySection }}
          >
            <p
              className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5"
              style={{ color: C.orange }}
            >
              For Companies
            </p>
            <h3
              className="font-bold leading-snug mb-7"
              style={{ fontSize: "clamp(1.3rem, 2vw, 1.65rem)", color: "white" }}
            >
              The 3 hidden costs of{" "}
              <span style={{ color: C.orangeLight }}>the old way.</span>
            </h3>
            <ul className="space-y-5 flex-1">
              {[
                ["Slow Hiring", "Months to fill a role."],
                ["Limited Access", "Great talent stays out of reach."],
                ["Invisible Overhead", "You pay for costs you never see."],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(255,80,80,0.15)" }}
                  >
                    <X className="h-3 w-3" style={{ color: "#FF6060" }} />
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.98rem", lineHeight: 1.5 }}>
                    <span className="text-white font-semibold">{title}</span> — {desc}
                  </p>
                </li>
              ))}
            </ul>
            <div
              className="mt-8 pt-7 border-t"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              <p className="text-white font-semibold mb-4" style={{ fontSize: "1rem" }}>
                OnSpot removes all three.
              </p>
              <Link
                href="/hire-talent"
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                style={{ color: C.orange }}
              >
                Hire talent <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* RIGHT — white */}
          <div
            className="rounded-2xl p-8 lg:p-10 flex flex-col"
            style={{ background: "white", border: "1px solid #E0E4F0", boxShadow: "0 4px 24px rgba(75,81,184,0.06)" }}
          >
            <p
              className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5"
              style={{ color: C.orange }}
            >
              For Talents
            </p>
            <h3
              className="font-bold leading-snug mb-7"
              style={{ fontSize: "clamp(1.3rem, 2vw, 1.65rem)", color: C.charcoal }}
            >
              The same system{" "}
              <span style={{ color: C.indigo }}>costs you too.</span>
            </h3>
            <ul className="space-y-5 flex-1">
              {[
                ["Unpaid waiting", "months to get matched."],
                ["Bidding wars", "a race to the bottom."],
                ["Hidden markups", "cuts you never agreed to."],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(200,50,50,0.08)" }}
                  >
                    <X className="h-3 w-3" style={{ color: "#C83232" }} />
                  </div>
                  <p style={{ color: C.gray, fontSize: "0.98rem", lineHeight: 1.5 }}>
                    <span className="font-semibold" style={{ color: C.charcoal }}>{title}</span> — {desc}
                  </p>
                </li>
              ))}
            </ul>
            <div
              className="mt-8 pt-7 border-t"
              style={{ borderColor: "#E8EAF0" }}
            >
              <p className="font-semibold mb-4" style={{ color: C.charcoal, fontSize: "1rem" }}>
                <Check className="inline h-4 w-4 mr-1.5" style={{ color: C.indigo }} />
                At OnSpot, you get paid{" "}
                <span style={{ color: C.orange }}>what you're worth.</span>
              </p>
              <Link
                href="/find-work/jobs"
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                style={{ color: C.orange }}
              >
                Find work <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECTION 2 — THE BETTER WAY ────────────────────────────────────────────────
function BetterWaySection() {
  return (
    <section
      style={{ background: "#F4F3FC" }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      {/* Centered header — narrow, text-centered */}
      <div className="mx-auto max-w-[600px] text-center mb-12">
        <SectionEyebrow text="The Better Way" />
        <h2
          className="mt-4 font-bold leading-tight"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: C.charcoal,
          }}
        >
          Companies pay less.<br />Talent earns more.
        </h2>
      </div>

      {/* Two pricing cards — constrained centered wrapper */}
      <div className="mx-auto mb-8" style={{ maxWidth: 960 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEFT — white */}
          <div
            className="rounded-2xl p-9 lg:p-11 flex flex-col"
            style={{ background: "white", border: "1px solid #DDE0F2", boxShadow: "0 4px 24px rgba(75,81,184,0.06)" }}
          >
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-6" style={{ color: C.grayLight }}>
              Companies Pay
            </p>
            <div className="flex items-center gap-4 mb-4">
              <span
                className="line-through font-medium"
                style={{ color: C.grayLight, fontSize: "clamp(1.2rem, 1.8vw, 1.6rem)" }}
              >
                $2,500
              </span>
              <span style={{ color: C.grayLight, fontSize: "1.2rem" }}>→</span>
              <span
                className="font-bold"
                style={{ color: C.indigo, fontSize: "clamp(2.2rem, 3.5vw, 3rem)", letterSpacing: "-0.03em" }}
              >
                $2,400
              </span>
            </div>
            <span
              className="self-start rounded-full px-3 py-1 text-xs font-semibold mb-7"
              style={{ background: "#E8F5E9", color: "#2E7D32" }}
            >
              ▼ Less than traditional outsourcing
            </span>
            <p style={{ color: C.gray, fontSize: "0.95rem", lineHeight: 1.65 }} className="flex-1">
              Same work, even better quality — without the layer of overhead traditional outsourcing adds on top.
            </p>
            <Link
              href="/hire-talent"
              className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
              style={{ color: C.orange }}
            >
              Hire talent <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* RIGHT — indigo gradient */}
          <div
            className="rounded-2xl p-9 lg:p-11 flex flex-col"
            style={{
              background: `linear-gradient(140deg, ${C.indigo} 0%, ${C.indigoDeep} 100%)`,
              boxShadow: "0 20px 48px -12px rgba(75,81,184,0.4)",
            }}
          >
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Talent Earns
            </p>
            <div className="flex items-center gap-4 mb-4">
              <span
                className="line-through font-medium"
                style={{ color: "rgba(255,255,255,0.35)", fontSize: "clamp(1.2rem, 1.8vw, 1.6rem)" }}
              >
                $1,000
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.2rem" }}>→</span>
              <span
                className="font-bold"
                style={{ color: C.orange, fontSize: "clamp(2.2rem, 3.5vw, 3rem)", letterSpacing: "-0.03em" }}
              >
                $2,000
              </span>
            </div>
            <span
              className="self-start rounded-full px-3 py-1 text-xs font-semibold mb-7"
              style={{ background: "rgba(255,174,33,0.18)", color: C.orangeLight }}
            >
              ▲ 2× what traditional outsourcing pays
            </span>
            <p style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.95rem", lineHeight: 1.65 }} className="flex-1">
              Because OnSpot's fee sits on top of the talent's rate, not carved out of it.
            </p>
            <Link
              href="/find-work/jobs"
              className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
              style={{ color: C.orange }}
            >
              Find work <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Disclaimer — centered, constrained */}
      <p
        className="mx-auto mb-8 text-center"
        style={{ color: C.grayLight, fontSize: "0.8rem", lineHeight: 1.7, maxWidth: 700 }}
      >
        Illustrative example — one role, one month. Traditional outsourcing: the company pays $2,500 and the talent keeps $1,000. OnSpot: the company pays $2,400 — the talent's full $2,000 rate plus a transparent $400 OnSpot fee.
      </p>

      {/* Bottom statement — centered, narrow, mixed emphasis */}
      <p
        className="mx-auto text-center"
        style={{ fontSize: "clamp(1rem, 1.5vw, 1.2rem)", lineHeight: 1.6, maxWidth: 520 }}
      >
        <span style={{ color: C.grayLight }}>We don't create savings by paying talent less.</span>{" "}
        <span className="font-bold" style={{ color: C.charcoal }}>We create savings by </span>
        <span className="font-bold" style={{ color: C.orange }}>taking less in between.</span>
      </p>
    </section>
  );
}

// ── SECTION 3 — THE RIGHT WAY TO OUTSOURCE ───────────────────────────────────
function EquationSection() {
  const xRows = (items: string[]) =>
    items.map((item) => (
      <li key={item} className="flex items-start gap-2.5">
        <div className="mt-0.5 flex-shrink-0 flex items-center justify-center rounded-full"
          style={{ width: 18, height: 18, background: "rgba(200,50,50,0.09)" }}>
          <X className="h-2.5 w-2.5" style={{ color: "#C83232" }} />
        </div>
        <span style={{ color: C.gray, fontSize: "0.875rem" }}>{item}</span>
      </li>
    ));

  const sideColStyle: React.CSSProperties = {
    padding: "0 40px",
    position: "relative",
    zIndex: 1,
  };

  return (
    <section
      style={{ background: "#F2F1FF" }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      {/* ── Header ── */}
      <div className="mx-auto text-center mb-14 lg:mb-16" style={{ maxWidth: 620 }}>
        <div className="inline-flex items-center gap-2 mb-5">
          <span style={{ width: 22, height: 2, background: C.orange, display: "inline-block", flexShrink: 0 }} />
          <span className="font-bold uppercase tracking-[0.09em]" style={{ fontSize: "0.69rem", color: C.indigo }}>
            The Right Way to Outsource
          </span>
        </div>
        <h2
          className="font-bold leading-tight mb-4"
          style={{ fontSize: "clamp(2.1rem, 4vw, 3.2rem)", letterSpacing: "-0.025em", color: C.charcoal }}
        >
          We changed the equation.
        </h2>
        <p className="mx-auto" style={{ color: C.gray, fontSize: "clamp(0.95rem, 1.4vw, 1.08rem)", lineHeight: 1.65, maxWidth: 500 }}>
          Everyone else makes you pick two: speed, accountability, or cost. OnSpot doesn't.
        </p>
      </div>

      {/* ── Comparison block ── */}
      <div className="mx-auto" style={{ maxWidth: 1020, marginBottom: 64 }}>

        {/* Desktop (md+): white shelf + raised center card */}
        <div className="hidden md:block" style={{ position: "relative" }}>
          {/* White background shelf — vertically centered behind side content */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0, right: 0,
              top: "50%", transform: "translateY(-50%)",
              height: 192,
              borderRadius: 20,
              background: "white",
              border: "1px solid #D8DCEE",
              boxShadow: "0 4px 28px rgba(75,81,184,0.08)",
            }}
          />

          {/* Three-column grid on top of shelf */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 352px 1fr", alignItems: "center", position: "relative" }}>

            {/* LEFT — Freelance Marketplaces */}
            <div style={sideColStyle}>
              <p className="font-bold uppercase tracking-[0.1em] mb-2" style={{ fontSize: "0.625rem", color: C.grayLight }}>
                Freelance Marketplaces
              </p>
              <p className="font-bold mb-5" style={{ color: C.charcoal, fontSize: "0.97rem" }}>
                Fast and cheap
              </p>
              <ul className="space-y-3.5">
                {xRows(["No accountability", "Race-to-the-bottom pay"])}
              </ul>
            </div>

            {/* CENTER — OnSpot raised card */}
            <div
              style={{
                position: "relative",
                zIndex: 10,
                borderRadius: 22,
                padding: "32px 36px",
                background: "linear-gradient(150deg, #4D57C7 0%, #37358D 100%)",
                boxShadow: "0 28px 64px -16px rgba(10,18,80,0.45), 0 8px 24px rgba(55,53,141,0.28)",
                border: "1px solid rgba(255,255,255,0.1)",
                minHeight: 234,
                transform: "translateY(-28px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="inline-flex items-center gap-2 mb-3">
                <span style={{ width: 18, height: 2, background: C.orange, display: "inline-block", flexShrink: 0 }} />
                <span className="font-bold uppercase tracking-[0.1em]" style={{ fontSize: "0.625rem", color: C.orange }}>
                  OnSpot
                </span>
              </div>
              <p className="font-bold text-white mb-5" style={{ fontSize: "1.1rem", lineHeight: 1.35 }}>
                Great talent. High pay. Fair cost.
              </p>
              <ul className="space-y-4 flex-1">
                {["Vetted talent, ready fast", "Accountable, managed relationships", "No overhead cost"].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{ width: 18, height: 18, background: "rgba(255,174,33,0.2)" }}>
                      <Check className="h-2.5 w-2.5" style={{ color: C.orange }} />
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT — Traditional Outsourcing */}
            <div style={sideColStyle}>
              <p className="font-bold uppercase tracking-[0.1em] mb-2" style={{ fontSize: "0.625rem", color: C.grayLight }}>
                Traditional Outsourcing
              </p>
              <p className="font-bold mb-5" style={{ color: C.charcoal, fontSize: "0.97rem" }}>
                Reliable, but heavy
              </p>
              <ul className="space-y-3.5">
                {xRows(["Slow and rigid", "Expensive overhead"])}
              </ul>
            </div>

          </div>
        </div>

        {/* Mobile/tablet stacked layout (< md) */}
        <div className="flex flex-col gap-4 md:hidden">
          <div className="rounded-2xl p-7" style={{ background: "white", border: "1px solid #D8DCEE" }}>
            <p className="font-bold uppercase tracking-[0.1em] mb-2" style={{ fontSize: "0.625rem", color: C.grayLight }}>Freelance Marketplaces</p>
            <p className="font-bold mb-5" style={{ color: C.charcoal, fontSize: "0.97rem" }}>Fast and cheap</p>
            <ul className="space-y-3.5">{xRows(["No accountability", "Race-to-the-bottom pay"])}</ul>
          </div>

          <div className="rounded-2xl p-7" style={{ background: "linear-gradient(150deg, #4D57C7 0%, #37358D 100%)", boxShadow: "0 16px 40px rgba(55,53,141,0.3)" }}>
            <div className="inline-flex items-center gap-2 mb-3">
              <span style={{ width: 18, height: 2, background: C.orange, display: "inline-block" }} />
              <span className="font-bold uppercase tracking-[0.1em]" style={{ fontSize: "0.625rem", color: C.orange }}>OnSpot</span>
            </div>
            <p className="font-bold text-white mb-5" style={{ fontSize: "1.1rem", lineHeight: 1.35 }}>Great talent. High pay. Fair cost.</p>
            <ul className="space-y-4">
              {["Vetted talent, ready fast", "Accountable, managed relationships", "No overhead cost"].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 18, height: 18, background: "rgba(255,174,33,0.2)" }}>
                    <Check className="h-2.5 w-2.5" style={{ color: C.orange }} />
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-7" style={{ background: "white", border: "1px solid #D8DCEE" }}>
            <p className="font-bold uppercase tracking-[0.1em] mb-2" style={{ fontSize: "0.625rem", color: C.grayLight }}>Traditional Outsourcing</p>
            <p className="font-bold mb-5" style={{ color: C.charcoal, fontSize: "0.97rem" }}>Reliable, but heavy</p>
            <ul className="space-y-3.5">{xRows(["Slow and rigid", "Expensive overhead"])}</ul>
          </div>
        </div>
      </div>

      {/* ── Bottom statement ── */}
      <p
        className="mx-auto text-center font-semibold"
        style={{ color: C.charcoal, fontSize: "clamp(1.05rem, 1.6vw, 1.28rem)", maxWidth: 680, lineHeight: 1.55 }}
      >
        Everyone else trades one thing for another. OnSpot doesn't trade —{" "}
        <span style={{ color: C.indigo }}>we raise the whole experience.</span>
      </p>
    </section>
  );
}

// ── SECTION 4 — WHY ONSPOT (Founder Quote) ───────────────────────────────────
function FounderQuoteSection() {
  return (
    <section
      style={{ background: "#EEEDFB" }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-20 lg:pb-28 pt-4"
    >
      <div className="mx-auto max-w-[1180px]">
        <div
          className="relative overflow-hidden rounded-2xl p-8 sm:p-12 lg:p-16"
          style={{
            background: `linear-gradient(150deg, #0D1B4B 0%, #050D2E 55%, #08123A 100%)`,
            boxShadow: "0 32px 64px -20px rgba(5,13,46,0.6)",
          }}
        >
          {/* Decorative oversized quotation mark */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-4 -left-2 select-none"
            style={{
              fontSize: "18rem",
              lineHeight: 1,
              fontFamily: "Georgia, serif",
              color: "rgba(75,81,184,0.13)",
              userSelect: "none",
            }}
          >
            "
          </div>

          <div className="relative z-10">
            <SectionEyebrow text="Why OnSpot" dark />

            <blockquote
              className="mt-6 font-bold text-white leading-snug mb-8"
              style={{
                fontSize: "clamp(1.35rem, 2.5vw, 2.1rem)",
                letterSpacing: "-0.02em",
                maxWidth: 820,
              }}
            >
              "We've watched good companies get stuck choosing between{" "}
              <span style={{ color: C.orange }}>marketplace chaos</span> and{" "}
              <span style={{ color: C.orange }}>outsourcing overhead</span> — and good talent get squeezed by both sides of that same trade-off."
            </blockquote>

            <div className="h-px mb-8" style={{ background: "rgba(255,255,255,0.08)", maxWidth: 560 }} />

            <p className="mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.52)", fontSize: "1rem", maxWidth: 660 }}>
              So we built OnSpot the way operators build things — not software developers guessing at the problem from the outside.
            </p>

            {/* Author */}
            <div className="flex items-center gap-4">
              <img
                src={nurPhoto}
                alt="Nur Lamimero"
                className="flex-shrink-0 rounded-full object-cover"
                style={{ width: 48, height: 48, objectPosition: "center top", border: "2px solid rgba(255,255,255,0.25)" }}
              />
              <div>
                <p className="font-semibold text-white" style={{ fontSize: "0.95rem" }}>Nur Lamimero</p>
                <p style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.82rem" }}>Co-founder &amp; CEO</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECTION 5 — SPLIT TESTIMONIAL ────────────────────────────────────────────


function SplitTestimonialSection() {
  return (
    <section>
      {/* TOP — dark navy, content intentionally LEFT-POSITIONED, large empty right */}
      <div
        style={{ background: C.navySection }}
        className="px-6 sm:px-10 lg:px-16 xl:px-20 py-24 lg:py-32"
      >
        <div className="mx-auto max-w-[1180px]">
          {/* Content constrained to ~45% of container width on desktop */}
          <div style={{ maxWidth: 500 }}>
            <SectionEyebrow text="For Companies" dark />

            <blockquote
              className="mt-5 font-bold text-white leading-[1.08] mb-7"
              style={{ fontSize: "clamp(2rem, 3.8vw, 3.25rem)", letterSpacing: "-0.025em", maxWidth: 460 }}
            >
              "The team you've been picturing,{" "}
              <span style={{ color: C.orangeLight }}>
                without the wait or the complexity."
              </span>
            </blockquote>

            {/* Author */}
            <div className="flex items-center gap-3 mb-7">
              <img
                src={jakePhoto}
                alt="Jake Wainberg"
                className="flex-shrink-0 rounded-full object-cover"
                style={{ width: 44, height: 44, objectPosition: "center top", border: "2px solid rgba(255,255,255,0.25)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
              />
              <div>
                <p className="font-semibold text-white" style={{ fontSize: "0.9rem" }}>Jake Wainberg</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.78rem" }}>Founder &amp; President</p>
              </div>
            </div>

            <p className="mb-9 leading-relaxed" style={{ color: "rgba(255,255,255,0.52)", fontSize: "0.97rem", maxWidth: 420 }}>
              Vetted talent, quick starts, and simpler hiring — with a transparent fee you can see. So you can just build your team.
            </p>

            {/* White filled button with indigo text + icon */}
            <Link
              href="/hire-talent"
              className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-white px-6 text-[14.5px] font-semibold transition hover:bg-white/95"
              style={{ color: C.indigo, boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}
            >
              <Users className="h-4 w-4" />
              Hire talent →
            </Link>
          </div>
        </div>
      </div>

      {/* BOTTOM — warm cream, content RIGHT-POSITIONED (~53% from left), large empty left */}
      <div
        style={{ background: "#FFF9EF" }}
        className="px-6 sm:px-10 lg:px-16 xl:px-20 py-24 lg:py-32"
      >
        <div className="mx-auto max-w-[1180px] flex justify-end">
          {/* Content block — sits on right half */}
          <div style={{ maxWidth: 480 }} className="w-full">
            <SectionEyebrow text="For Talents" />

            <blockquote
              className="mt-5 font-bold leading-[1.08] mb-7"
              style={{ fontSize: "clamp(2rem, 3.8vw, 3.25rem)", letterSpacing: "-0.025em", color: C.charcoal, maxWidth: 440 }}
            >
              "Real work, great pay,{" "}
              <span style={{ color: C.orangeDeep }}>
                from wherever you call home."
              </span>
            </blockquote>

            <p className="mb-7 leading-relaxed" style={{ color: C.gray, fontSize: "0.97rem", maxWidth: 420 }}>
              Set your rate and keep it — OnSpot's fee is added on top, never taken out of your pay. Just great clients and reliable payouts.
            </p>

            {/* Author */}
            <div className="flex items-center gap-3 mb-9">
              <img
                src={markPhoto}
                alt="Mark Apostol"
                className="flex-shrink-0 rounded-full object-cover"
                style={{ width: 44, height: 44, objectPosition: "center top", border: "2px solid rgba(0,0,0,0.1)", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
              />
              <div>
                <p className="font-semibold" style={{ color: C.charcoal, fontSize: "0.9rem" }}>Mark Apostol</p>
                <p style={{ color: C.indigo, fontSize: "0.78rem" }}>Co-founder &amp; COO</p>
              </div>
            </div>

            {/* Outlined gold/amber button */}
            <Link
              href="/find-work/jobs"
              className="inline-flex h-[46px] items-center justify-center rounded-[10px] px-6 text-[14.5px] font-semibold transition hover:bg-amber-50"
              style={{ border: `1.5px solid ${C.orangeDeep}`, color: C.orangeDeep }}
            >
              Find work →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECTION 6 — OPEN JOBS ─────────────────────────────────────────────────────
const STATIC_JOBS = [
  { title: "IT Administrator",                 type: "Full-time", loc: "Remote", pay: "USD 1,500 – 3,000/month", id: null },
  { title: "Accounting Manager",               type: "Full-time", loc: "Hybrid", pay: "USD 500/month",           id: null },
  { title: "Virtual Assistant",                type: "Full-time", loc: "Remote", pay: "PHP 8 – 12",              id: null },
  { title: "Customer Service Representative",  type: "Part-time", loc: "Onsite", pay: "USD 10 – 15",             id: null },
];

function OpenJobsSection() {
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

  const liveJobs: typeof STATIC_JOBS = (rawJobs ?? [])
    .filter((j: any) => j.title?.toLowerCase() !== "test")
    .slice(0, 4)
    .map((j: any) => ({
      title: j.title,
      type:  j.contractType || "Full-time",
      loc:   j.location || "Remote",
      pay:   j.budget
        ? `${j.budgetCurrency ?? "PHP"} ${j.budget}`
        : j.hourlyRateMin
          ? `USD ${j.hourlyRateMin}${j.hourlyRateMax ? ` – ${j.hourlyRateMax}` : ""}/hr`
          : "",
      id: j.id ?? null,
    }));

  const jobs = liveJobs.length >= 3 ? liveJobs : STATIC_JOBS;

  return (
    <section
      style={{
        background: `radial-gradient(ellipse at 50% 0%, rgba(75,81,184,0.35), transparent 65%), linear-gradient(180deg, ${C.indigoDeep} 0%, #06102E 100%)`,
      }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Centered header */}
        <div className="text-center mb-14">
          <SectionEyebrow text="For Talents" dark />
          <h2
            className="mt-4 font-bold text-white leading-tight"
            style={{ fontSize: "clamp(2rem, 3.8vw, 3.25rem)", letterSpacing: "-0.025em" }}
          >
            Hundreds of high-paying jobs.<br />
            <span style={{ color: C.orangeLight }}>Open right now.</span>
          </h2>
          <p className="mt-4 mx-auto" style={{ color: "rgba(255,255,255,0.52)", fontSize: "clamp(1rem, 1.5vw, 1.1rem)", maxWidth: 560 }}>
            Real roles with great companies — at rates that reflect what your work is actually worth. New jobs open every week.
          </p>
        </div>

        {/* 4 job cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {jobs.map((job, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 flex flex-col"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(4px)",
              }}
            >
              <span
                className="self-start rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide mb-5"
                style={{ background: "rgba(255,174,33,0.18)", color: C.orange }}
              >
                Hiring Now
              </span>
              <p className="font-semibold text-white leading-snug mb-2 flex-1" style={{ fontSize: "0.98rem" }}>
                {job.title}
              </p>
              <p className="mb-3" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>
                {job.type} · {job.loc}
              </p>
              {job.pay && (
                <p className="font-semibold mb-5" style={{ color: C.orangeLight, fontSize: "0.88rem" }}>
                  {job.pay}
                </p>
              )}
              <Link
                href={job.id ? `/jobs/${job.id}` : "/find-work/jobs"}
                className="inline-flex items-center gap-1 text-xs font-semibold mt-auto transition hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                View role <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Link
            href="/find-work/jobs"
            className="inline-flex h-[50px] min-w-[200px] items-center justify-center rounded-xl border px-8 text-[15px] font-semibold text-white transition hover:bg-white/10"
            style={{ borderColor: "rgba(255,255,255,0.3)" }}
          >
            Browse all jobs →
          </Link>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.82rem" }}>
            Set your rate. Keep your rate. OnSpot's fee is never taken out of your pay.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── SECTION 7 — THE PLAN ──────────────────────────────────────────────────────
const STEPS = [
  {
    num: "1",
    icon: FileText,
    title: "Post or apply",
    body: "Tell us what you need. Or show us what you can do.",
    links: [
      { label: "Post a role →", href: "/hire-talent" },
      { label: "Apply as talent →", href: "/find-work/jobs" },
    ],
  },
  {
    num: "2",
    icon: Zap,
    title: "Get matched",
    body: "We connect the right people, fast — no endless scrolling.",
    links: [{ label: "See how matching works →", href: "/why-onspot" }],
  },
  {
    num: "3",
    icon: Rocket,
    title: "Start working",
    body: "Show up and do the work. We handle everything else.",
    links: [{ label: "Get started →", href: "/hire-talent" }],
  },
];

function ProcessSection() {
  return (
    <section
      style={{
        background: `radial-gradient(55% 60% at 50% 0%, rgba(75,81,184,0.06), transparent 65%), #F7F7FB`,
      }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      {/* ── Centered header ── */}
      <div className="mx-auto max-w-[680px] text-center mb-14">
        <SectionEyebrow text="The Plan" />
        <h2
          className="mt-4 font-bold leading-tight mb-3"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", letterSpacing: "-0.025em", color: C.charcoal }}
        >
          From posted to placed.
        </h2>
        <p style={{ color: C.gray, fontSize: "clamp(1rem, 1.5vw, 1.1rem)", maxWidth: 460, marginInline: "auto" }}>
          Three steps. No bidding wars, no long contracts, no hidden markups.
        </p>
      </div>

      {/* ── 3 step cards — centered grid ── */}
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative">
                {/* Orange circular arrow connector between cards */}
                {i < 2 && (
                  <div
                    aria-hidden
                    className="hidden md:flex absolute -right-[14px] top-10 z-10 h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: C.orange, boxShadow: "0 4px 12px rgba(255,174,33,0.4)" }}
                  >
                    <ArrowRight className="h-3 w-3 text-white" />
                  </div>
                )}
                <div
                  className="rounded-2xl p-7 h-full flex flex-col"
                  style={{ background: "white", border: "1px solid #E0E4F0", boxShadow: "0 4px 20px rgba(75,81,184,0.06)" }}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: "rgba(75,81,184,0.1)" }}
                    >
                      <Icon className="h-5 w-5" style={{ color: C.indigo }} />
                    </div>
                    <span
                      className="font-bold tabular-nums"
                      style={{ fontSize: "3.5rem", color: "#EAECF6", letterSpacing: "-0.04em", lineHeight: 1 }}
                    >
                      {step.num}
                    </span>
                  </div>
                  <h3 className="font-bold mb-2" style={{ fontSize: "1.1rem", color: C.charcoal }}>
                    {step.title}
                  </h3>
                  <p className="leading-relaxed flex-1" style={{ color: C.gray, fontSize: "0.93rem" }}>
                    {step.body}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-4">
                    {step.links.map((l) => (
                      <Link
                        key={l.label}
                        href={l.href}
                        className="text-xs font-semibold transition hover:opacity-80"
                        style={{ color: C.orange }}
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bottom statement — centered below card group ── */}
        <p className="text-center" style={{ fontSize: "clamp(1rem, 1.4vw, 1.1rem)", color: C.charcoal, marginInline: "auto" }}>
          That's it.{" "}
          <span className="font-semibold" style={{ color: C.indigo }}>
            Most roles are filled in days, not months.
          </span>
        </p>
      </div>
    </section>
  );
}

// ── SECTION 8 — FINAL CTA ─────────────────────────────────────────────────────
function FinalCtaSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // Navigate to sign-up with email pre-filled
    window.location.href = `/signup?email=${encodeURIComponent(email.trim())}`;
  };

  return (
    <section
      style={{
        background: `radial-gradient(ellipse at 50% 20%, rgba(75,81,184,0.4), transparent 60%), linear-gradient(170deg, ${C.indigoDeep} 0%, #050D2E 55%, ${C.dark3} 100%)`,
      }}
      className="px-6 sm:px-10 py-24 lg:py-40 text-center"
    >
      <div className="mx-auto max-w-[640px]">
        {/* Eyebrow */}
        <p className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] mb-7" style={{ color: "rgba(255,255,255,0.75)" }}>
          <span aria-hidden className="inline-block h-[2px] w-4 rounded" style={{ background: C.orange }} />
          Work Without Limits
        </p>

        {/* Heading */}
        <h2
          className="font-bold text-white leading-[1.1] mb-5"
          style={{ fontSize: "clamp(1.9rem, 4.5vw, 3.25rem)", letterSpacing: "-0.025em" }}
        >
          Some of the best teams in the world already work this way.
        </h2>

        {/* Body */}
        <p className="mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.58)", fontSize: "clamp(0.95rem, 1.5vw, 1.1rem)" }}>
          The ones who wait keep losing good people to delay and overhead. The ones who don't build without limits — and the people who work with them earn without limits.
        </p>

        {/* Email input + CTA */}
        <form onSubmit={handleSubmit} className="mb-5">
          <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-[480px] mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="flex-1 rounded-xl px-5 py-3.5 text-[15px] outline-none transition"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white",
              }}
            />
            <button
              type="submit"
              className="flex-shrink-0 inline-flex h-[52px] items-center justify-center rounded-xl px-8 text-[15px] font-semibold transition hover:-translate-y-[1px]"
              style={{
                background: C.orange,
                color: C.indigoDeep,
                boxShadow: "0 8px 24px rgba(255,174,33,0.35)",
                minWidth: 160,
              }}
            >
              Get started →
            </button>
          </div>
        </form>

        {/* Looking for work */}
        <p className="mb-4" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem" }}>
          Looking for work instead?{" "}
          <Link href="/find-work/jobs" className="font-semibold underline underline-offset-2 hover:opacity-80 transition" style={{ color: "rgba(255,255,255,0.7)" }}>
            Find work →
          </Link>
        </p>

        {/* Legal */}
        <p style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.78rem" }}>
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-1 hover:opacity-70 transition">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline underline-offset-1 hover:opacity-70 transition">Privacy Policy</Link>.
        </p>
      </div>
    </section>
  );
}
