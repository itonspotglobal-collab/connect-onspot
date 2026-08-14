import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play, Check, X, Star, Search, ArrowRight, FileText, Zap, Rocket, Users } from "lucide-react";
import { formatPublicTalentNameFromFull } from "@/lib/formatPublicTalentName";
import { Footer } from "@/components/Footer";
import jakePhoto from "@assets/Jake_1780574815787.png";
const nurPhoto = "/nur-ceo.jpeg";
const markPhoto = "/mark-apostol.png";

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
      {/*
        blendFrom matches FinalCtaSection's bottom gradient stop (C.dark3 = #4652B5)
        so the footer opens from that colour and settles into its own indigo —
        visually one continuous dark field, no visible seam.
      */}
      <Footer blendFrom="#4652B5" />
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
  const liveTalents = useMemo(() => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const all = (rawCandidates ?? []).filter((c: any) => c.availability !== "unavailable");
    // Prioritise candidates who actually have a profile photo so the card
    // always shows faces when they exist; then fill up with the rest.
    const withPhoto    = all.filter((c: any) => c.profilePhotoUrl);
    const withoutPhoto = all.filter((c: any) => !c.profilePhotoUrl);
    return [...shuffle(withPhoto), ...shuffle(withoutPhoto)].slice(0, 4);
  }, [rawCandidates]);

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
  const liveJobs = useMemo(() => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const all = (rawJobs ?? []).filter((j: any) => j.title?.toLowerCase() !== "test");
    // Featured jobs lead; within each group the order is randomised each visit.
    const featured = all.filter((j: any) => j.isFeatured);
    const regular  = all.filter((j: any) => !j.isFeatured);
    return [...shuffle(featured), ...shuffle(regular)].slice(0, 3);
  }, [rawJobs]);

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
      style={{ height: "calc(100svh - 74px)", background: slideBg(active.id), transition: "background 0.65s ease", display: "flex", flexDirection: "column" }}
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
          className="flex flex-1 min-h-0 items-center hero-slide-content"
          style={{ animation: "homeHeroIn 0.55s ease forwards", opacity: 0 }}
        >
          {active.id === "work"      && <WorkSlide      isDark={isDark} />}
          {active.id === "companies" && <CompaniesSlide isDark={isDark} />}
          {active.id === "talent"    && <TalentSlide    isDark={isDark} />}
          {active.id === "network"   && <NetworkSlide   isDark={isDark} liveTalents={liveTalents} isLoading={candidatesLoading} />}
          {active.id === "jobs"      && <JobsSlide      isDark={isDark} liveJobs={liveJobs} isLoading={jobsLoading} liveTalents={liveTalents} />}
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
      className="grid grid-cols-1 lg:grid-cols-2 items-center w-full hero-twocol"
      style={{ gap: "clamp(24px, 6vw, 88px)" }}
    >
      <div className="min-w-0">{left}</div>
      <div className="min-w-0 lg:flex lg:justify-end hero-twocol-right">{right}</div>
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
        className="font-bold tracking-tight hero-work-h1"
        style={{ fontSize: "clamp(58px, 5.6vw, 82px)", lineHeight: 0.99, letterSpacing: "-0.03em" }}
      >
        <span className="text-white">Work </span>
        <span style={{ color: C.orangeLight }}>Without</span>
        <span className="text-white"> Limits</span>
      </h1>

      <p className="mt-5 hero-subtitle" style={{ fontSize: "clamp(16px, 1.35vw, 22px)", lineHeight: 1.4, whiteSpace: "nowrap", width: "max-content", maxWidth: "100%", marginInline: "auto" }}>
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
            className="font-bold tracking-tight leading-[1.04] hero-slide-h1-sm"
            style={{ fontSize: "clamp(46px, 5.2vw, 76px)", letterSpacing: "-0.03em" }}
          >
            <span style={{ color: C.charcoal }}>Hire </span>
            <span style={{ color: C.indigo }}>Without<br />Limits.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium hero-slide-sub" style={{ fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1.45, color: C.charcoal }}>
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
      right={
        <div className="hero-mobile-device-window">
          <LaptopMockup />
        </div>
      }
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

  // Design tokens — exact match to the reference HTML
  const T = {
    purple: "#474EAD", purpleLight: "#7B81D4", purpleTint: "#EEEDFB",
    goldTint: "#FDF1DE", green: "#1D8A5A", greenTint: "#E6F5EC",
    bg2: "#F6F6FA", text: "#1D1D1F", dim: "#6E6E76", dim2: "#A1A1A8", line: "#ECECF1",
  };

  // Reference tokens (matches the HTML design file exactly)
  const R = {
    purple:       "#474EAD",
    purpleLight:  "#7B81D4",
    purpleTint:   "#EEEDFB",
    goldTint:     "#FDF1DE",
    gold:         "#F5A623",
    green:        "#1D8A5A",
    greenTint:    "#E6F5EC",
    bg2:          "#F6F6FA",
    text:         "#1D1D1F",
    textDim:      "#6E6E76",
    textDim2:     "#A1A1A8",
    line:         "#ECECF1",
  };

  return (
    <div className="hero-laptop-wrap" style={{ perspective: "1200px", width: "clamp(320px, 30vw, 420px)", flexShrink: 0 }}>
      <div
        className="relative hero-laptop-3d"
        style={{ transform: "rotateY(-9deg) rotateX(3deg)" }}
      >
        {/* Glow */}
        <div aria-hidden className="pointer-events-none absolute" style={{ inset: "-60px", background: "radial-gradient(ellipse 70% 60% at 52% 50%, rgba(71,78,173,0.30) 0%, transparent 68%)", filter: "blur(20px)", zIndex: 0 }} />
        {/* Side buttons */}
        <div aria-hidden style={{ position: "absolute", right: -5, top: "18%", width: 5, height: 30, background: "#2c2c2e", borderRadius: "0 3px 3px 0", zIndex: 2 }} />
        <div aria-hidden style={{ position: "absolute", left: -5, top: "21%", width: 5, height: 22, background: "#2c2c2e", borderRadius: "3px 0 0 3px", zIndex: 2 }} />
        <div aria-hidden style={{ position: "absolute", left: -5, top: "31%", width: 5, height: 22, background: "#2c2c2e", borderRadius: "3px 0 0 3px", zIndex: 2 }} />
        {/* iPad shell */}
        <div className="relative" style={{ zIndex: 1, background: "#1c1c1e", borderRadius: 28, padding: "22px 20px", boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)" }}>
          {/* Camera */}
          <div aria-hidden style={{ position: "absolute", top: 9, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: "#3a3a3c" }} />
          {/* Screen */}
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden" }}>
            {/* Nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px 9px", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 11, color: T.text }}>OnSpot</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.dim }}>Gentech LLC</span>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: T.purpleLight, flexShrink: 0 }} />
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: "12px 16px 14px" }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, color: T.text }}>Team dashboard</span>
                <span style={{ fontSize: 8, color: T.dim2 }}>Last 6 months</span>
              </div>
              {/* 4 stat tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 12 }}>
                {[
                  { label: "Monthly cost",     value: "$18,400", sub: "▼ 22% vs traditional", cost: true  },
                  { label: "Headcount",        value: "8",       sub: "Active members",        cost: false },
                  { label: "Avg. performance", value: "4.8/5",   sub: "Across all roles",      cost: false },
                  { label: "Retention",        value: "94%",     sub: "Team continuity",       cost: false },
                ].map((s) => (
                  <div key={s.label} style={{ background: s.cost ? T.purpleTint : T.bg2, border: s.cost ? "1px solid rgba(71,78,173,0.2)" : "none", borderRadius: 8, padding: "8px 9px" }}>
                    <p style={{ fontSize: 6, textTransform: "uppercase", letterSpacing: "0.04em", color: T.dim, marginBottom: 4 }}>{s.label}</p>
                    <p style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14, fontWeight: 800, color: s.cost ? T.purple : T.text, lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 6, color: s.cost ? T.green : T.dim2, fontWeight: s.cost ? 600 : 400, marginTop: 3 }}>{s.sub}</p>
                  </div>
                ))}
              </div>
              {/* Split */}
              <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12 }}>
                {/* Left — Team performance */}
                <div>
                  <p style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.dim, marginBottom: 8 }}>Team performance</p>
                  {TEAM.map((m) => (
                    <div key={m.i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: T.purpleTint, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 6 }}>{m.i}</div>
                        <div>
                          <p style={{ fontSize: 8, fontWeight: 600, color: T.text, lineHeight: 1 }}>{m.n}</p>
                          <p style={{ fontSize: 7, color: T.dim2, lineHeight: 1, marginTop: 2 }}>{m.r}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 7, fontWeight: 700, color: T.green, background: T.greenTint, padding: "2px 5px", borderRadius: 100 }}>{m.perf}/5</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: T.text, minWidth: 34, textAlign: "right" }}>{m.sal}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Right — Hiring + Vacant */}
                <div>
                  <p style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.dim, marginBottom: 8 }}>Hiring</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                    <div style={{ background: T.goldTint, border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: "8px 9px" }}>
                      <p style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 800, color: T.text }}>3</p>
                      <p style={{ fontSize: 7, color: T.dim, marginTop: 2, lineHeight: 1.3 }}>Open roles</p>
                    </div>
                    <div style={{ background: T.goldTint, border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: "8px 9px" }}>
                      <p style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 800, color: T.text }}>6 <span style={{ fontSize: 8, fontWeight: 600 }}>days</span></p>
                      <p style={{ fontSize: 6, color: T.dim, marginTop: 2, lineHeight: 1.3 }}>Avg. fill <span style={{ color: T.purple }}>(vs 39)</span></p>
                    </div>
                  </div>
                  <p style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.dim, marginBottom: 5 }}>Vacant roles</p>
                  {VACANT.map((v) => (
                    <div key={v.r} style={{ padding: "6px 0", borderTop: `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                        <span style={{ fontSize: 8, fontWeight: 600, color: T.text }}>{v.r}</span>
                        <span style={{ fontSize: 7, color: T.dim2 }}>{v.d}</span>
                      </div>
                      <span style={{ fontSize: 7, color: T.purple, fontWeight: 600 }}>{v.c}</span>
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
            className="font-bold tracking-tight text-white leading-[1.04] hero-slide-h1-sm"
            style={{ fontSize: "clamp(46px, 5.2vw, 76px)", letterSpacing: "-0.03em" }}
          >
            Earn{" "}
            <span style={{ color: C.orangeLight }}>Without<br />Limits.</span>
          </h1>
          <p className="mt-5 max-w-[460px] font-medium text-white hero-slide-sub" style={{ fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1.45 }}>
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
      right={
        <div className="hero-phone-window">
          <PhoneMockup />
        </div>
      }
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
  // Design tokens from reference
  const purple    = "#474EAD";
  const purpleL   = "#7B81D4";
  const gold      = "#F5A623";
  const goldTint  = "#FDF1DE";
  const green     = "#1D8A5A";
  const greenTint = "#E6F5EC";
  const bg2       = "#F6F6FA";
  const text      = "#1D1D1F";
  const textDim   = "#6E6E76";
  const textDim2  = "#A1A1A8";
  const brio      = "'Bricolage Grotesque', sans-serif";

  return (
    <div className="relative ml-auto hero-phone-wrap" style={{ width: "clamp(220px, 21vw, 265px)", maxWidth: "100%", flexShrink: 0 }}>
      {/* Indigo ambient glow — phone emerges from slide background */}
      <div aria-hidden className="pointer-events-none absolute" style={{ inset: "-70px", background: "radial-gradient(ellipse 80% 70% at 50% 46%, rgba(58,66,149,0.68) 0%, rgba(39,38,104,0.4) 48%, transparent 72%)", filter: "blur(20px)", zIndex: 0 }} />

      {/* Phone shell */}
      <div style={{ position: "relative", zIndex: 1, background: "#111114", borderRadius: 46, padding: 12, boxShadow: "0 40px 70px rgba(0,0,0,0.55)" }}>

        {/* Screen — aspect-ratio 9/19.5 derives height from width */}
        <div style={{ aspectRatio: "9/19.5", background: "#fff", borderRadius: 36, overflow: "hidden", position: "relative" }}>

          {/* Dynamic Island pill */}
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 90, height: 24, background: "#111114", borderRadius: 100, zIndex: 5 }} />

          {/* Home indicator */}
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 110, height: 4, background: "rgba(0,0,0,0.22)", borderRadius: 100, zIndex: 5 }} />

          {/* App nav — 52px top padding clears the island */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 20px 14px" }}>
            <span style={{ fontFamily: brio, fontWeight: 700, fontSize: 14, color: text }}>OnSpot</span>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: purpleL, flexShrink: 0 }} />
          </div>

          {/* App body */}
          <div style={{ padding: "6px 20px 24px" }}>

            {/* Page title */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: brio, fontSize: 19, fontWeight: 700, color: text }}>Earnings summary</div>
              <div style={{ fontSize: 12, color: textDim2, marginTop: 2 }}>Last 6 months</div>
            </div>

            {/* Total tile — gold tint */}
            <div style={{ background: goldTint, border: "1px solid rgba(245,166,35,0.25)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: textDim, marginBottom: 6 }}>Total Earned This Month</div>
              <div style={{ fontFamily: brio, fontSize: 30, fontWeight: 800, color: text }}>$3,455</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: green, background: greenTint, padding: "3px 9px", borderRadius: 100, marginTop: 6 }}>▲ 18% vs last month</div>
            </div>

            {/* Stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
              {[{ label: "Avg. rate", val: "$20/hr" }, { label: "Active clients", val: "2" }].map(s => (
                <div key={s.label} style={{ background: bg2, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: textDim, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: brio, fontSize: 18, fontWeight: 800, color: text }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Bar chart — percentage heights */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 60 }}>
                {[42, 58, 38, 70, 65, 100].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: "linear-gradient(180deg, #FFC968 0%, #F5A623 100%)", borderRadius: "4px 4px 0 0" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
                {["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map(m => (
                  <span key={m} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: textDim2 }}>{m}</span>
                ))}
              </div>
            </div>

            {/* Earnings by client */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: textDim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Earnings by client</div>
            {[
              { name: "New Tech AI",      amt: "$2,000", pct: 100 },
              { name: "John Roberts LLC", amt: "$1,455", pct:  73 },
            ].map(c => (
              <div key={c.name} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: textDim }}>{c.amt}</span>
                </div>
                <div style={{ height: 6, background: bg2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.pct}%`, background: purple, borderRadius: 3 }} />
                </div>
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
function NetworkSlide({ isDark, liveTalents, isLoading }: { isDark: boolean; liveTalents: any[]; isLoading: boolean }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="THE TALENT NETWORK" isDark={isDark} />
          <h1
            className="font-bold hero-slide-h1-sm"
            style={{ letterSpacing: "-0.035em", lineHeight: 1.02, maxWidth: 620 }}
          >
            <span className="block" style={{ fontSize: "clamp(48px, 4.5vw, 72px)", color: "#17171D" }}>
              Thousands of talents.
            </span>
            <span className="block" style={{ fontSize: "clamp(44px, 4.1vw, 66px)", color: "#4D55C7" }}>
              Ready to work.
            </span>
          </h1>
          <p className="mt-5 font-medium hero-slide-sub" style={{ fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1.3, color: C.charcoal, maxWidth: 520 }}>
            Vetted, experienced, and{" "}
            <span className="font-bold" style={{ color: C.orangeDeep }}>ready to start in days — not months.</span>
          </p>
          <p className="mt-3" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", color: C.gray, maxWidth: 500, lineHeight: 1.55 }}>
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
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    window.location.href = q ? `/hire-talent?search=${encodeURIComponent(q)}#top-matches` : "/hire-talent#top-matches";
  };

  return (
    <div className="relative hero-talent-wrap" style={{ width: "clamp(400px, 38vw, 520px)", maxWidth: "100%" }}>
      {/* Glow — pointer-events-none so it never blocks clicks */}
      <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-full" style={{ background: "radial-gradient(60% 55% at 50% 50%, rgba(75,81,184,0.12), transparent 70%)", filter: "blur(10px)" }} />
      <div
        className="relative rounded-[18px] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(75,81,184,0.18)", backdropFilter: "blur(14px)", boxShadow: "0 24px 56px rgba(75,81,184,0.12)" }}
      >
        {/* Search bar — functional: navigates to /hire-talent?search=... */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#EEEDFB" }}>
          <form onSubmit={handleSearch}>
            <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: "#F4F3FC", border: "1px solid #DDDCF4" }}>
              <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.indigoLight }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Customer support, bookkeeping, sales..."
                className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-gray-400"
                style={{ color: C.charcoal }}
              />
              {search && (
                <button type="submit" className="text-[10px] font-semibold hover:underline flex-shrink-0" style={{ color: C.indigo }}>
                  Search
                </button>
              )}
            </div>
          </form>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {["Available now", "4.5★ and up", "3+ yrs experience"].map((f) => (
              <button
                key={f}
                onClick={() => { window.location.href = `/hire-talent?search=${encodeURIComponent(f)}#top-matches`; }}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition hover:opacity-75"
                style={{ background: "rgba(75,81,184,0.1)", color: C.indigo, border: "1px solid rgba(75,81,184,0.2)" }}
              >
                {f}
              </button>
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
              <a href="/hire-talent#top-matches" className="text-[11px] font-semibold hover:underline" style={{ color: C.indigo }}>Browse talent →</a>
            </div>
          ) : (
            candidates.map((c: any) => {
              const name =
                c.displayName?.trim() ||
                formatPublicTalentNameFromFull(c.fullName) ||
                "Talent";
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
          <a href="/hire-talent#top-matches" className="text-[11px] font-semibold hover:underline" style={{ color: C.indigo }}>
            Browse all talent →
          </a>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — JOBS (dark, 2-col + roles card)
// ══════════════════════════════════════════════════════════════════════════════
function JobsSlide({ isDark, liveJobs, isLoading, liveTalents }: { isDark: boolean; liveJobs: any[]; isLoading: boolean; liveTalents: any[] }) {
  return (
    <TwoCol
      left={
        <>
          <SlideEyebrow text="FOR TALENTS" isDark={isDark} />
          <h1
            className="font-bold tracking-tight text-white hero-slide-h1-sm"
            style={{ fontSize: "clamp(46px, 4.15vw, 68px)", lineHeight: 0.98, letterSpacing: "-0.03em", maxWidth: 510 }}
          >
            Hundreds of<br />
            high-paying jobs.<br />
            <span style={{ color: C.orangeLight }}>Open right now.</span>
          </h1>
          <p className="mt-4 font-medium text-white hero-slide-sub" style={{ fontSize: "clamp(20px, 1.6vw, 27px)", lineHeight: 1.45, maxWidth: 510 }}>
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
      right={<OpenRolesCard liveJobs={liveJobs} isLoading={isLoading} liveTalents={liveTalents} />}
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

function OpenRolesCard({ liveJobs, isLoading, liveTalents }: { liveJobs: any[]; isLoading: boolean; liveTalents: any[] }) {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/find-work/jobs?search=${encodeURIComponent(q)}` : "/find-work/jobs");
  };

  // Avatar pool: candidates with photos first, then initials fallbacks
  const avatarPool = useMemo(() => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    return shuffle(liveTalents).slice(0, 6);
  }, [liveTalents]);

  return (
    <div className="relative hero-jobs-wrap" style={{ width: "clamp(400px, 37vw, 500px)", maxWidth: "100%" }}>
      {/* Glow — pointer-events-none so it never blocks clicks */}
      <div aria-hidden className="pointer-events-none absolute -inset-8 rounded-full" style={{ background: "radial-gradient(60% 55% at 50% 42%, rgba(255,174,33,0.2), transparent 65%), radial-gradient(70% 65% at 50% 60%, rgba(75,81,184,0.3), transparent 70%)", filter: "blur(10px)" }} />
      <div
        className="relative rounded-[18px] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.84)", border: "1px solid rgba(255,255,255,0.32)", backdropFilter: "blur(16px)", boxShadow: "0 40px 80px -28px rgba(5,8,30,0.55)" }}
      >
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#EDEDF2" }}>
          <form onSubmit={handleSearch}>
            <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: "#F4F3FC", border: "1px solid #DDDCF4" }}>
              <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.indigoLight }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Customer support, bookkeeping, sales..."
                className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-gray-400"
                style={{ color: C.charcoal }}
              />
              {search && (
                <button type="submit" className="text-[10px] font-semibold hover:underline flex-shrink-0" style={{ color: C.indigo }}>
                  Search
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#EDEDF2" }}>
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
            liveJobs.map((j: any, idx: number) => {
              const location = j.location || j.contractType || "Remote";
              const pay = jobPay(j);
              // Rotate avatars from the pool so each row shows different faces
              const rowAvatars = avatarPool.slice((idx * 2) % Math.max(avatarPool.length, 1), (idx * 2) % Math.max(avatarPool.length, 1) + 2);
              return (
                <Link
                  key={j.id}
                  href={`/find-work/job/${j.id}`}
                  className="block px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                >
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "start" }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: C.charcoal, overflowWrap: "anywhere" }}>{j.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>
                        {location}{pay ? ` · ${pay}` : ""}
                      </p>
                      {/* Avatar stack */}
                      {rowAvatars.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="flex -space-x-1.5">
                            {rowAvatars.map((c: any, i: number) => (
                              c.profilePhotoUrl ? (
                                <img key={i} src={c.profilePhotoUrl} alt="" className="h-5 w-5 rounded-full object-cover ring-[1.5px] ring-white flex-shrink-0" />
                              ) : (
                                <div key={i} className="h-5 w-5 rounded-full flex items-center justify-center ring-[1.5px] ring-white flex-shrink-0" style={{ background: C.indigo, fontSize: "7px", color: "white", fontWeight: 700 }}>
                                  {talentInitials((c.displayName || c.fullName || "?"))}
                                </div>
                              )
                            ))}
                          </div>
                          <span className="text-[9px]" style={{ color: C.grayLight }}>talents ready</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {j.isFeatured && (
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(255,174,33,0.18)", color: C.orangeDeep }}>Featured</span>
                      )}
                      <span className="rounded-full px-2.5 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(46,186,107,0.12)", color: "#1a7d42" }}>
                        Hiring now
                      </span>
                      <span className="rounded-full px-2.5 py-0.5 text-[9px] font-semibold border transition-colors hover:bg-[#4B51B8] hover:text-white" style={{ borderColor: C.indigo, color: C.indigo }}>
                        Apply →
                      </span>
                    </div>
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
      style={{ background: "#F2F1FF" }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-16 lg:py-24"
    >
      <div
        className="relative overflow-hidden mx-auto"
        style={{
          maxWidth: 900,
          width: "calc(100% - 0px)",
          borderRadius: 28,
          padding: "clamp(28px, 5vw, 56px) clamp(24px, 5vw, 56px) clamp(24px, 4.5vw, 50px)",
          background: "linear-gradient(180deg, #4A55BB 0%, #37358D 55%, #2E246F 100%)",
          boxShadow: "0 28px 64px -20px rgba(30,24,90,0.45), 0 8px 24px rgba(55,53,141,0.2)",
        }}
      >
        {/* Decorative oversized quotation mark */}
        <div
          aria-hidden
          className="pointer-events-none absolute select-none"
          style={{
            top: -8,
            left: -4,
            fontSize: "clamp(10rem, 16vw, 18rem)",
            lineHeight: 1,
            fontFamily: "Georgia, serif",
            color: "rgba(180,185,255,0.14)",
            userSelect: "none",
          }}
        >
          "
        </div>

        <div className="relative z-10">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-7">
            <span style={{ width: 20, height: 2, background: C.orange, display: "inline-block", flexShrink: 0 }} />
            <span className="font-bold uppercase tracking-[0.09em]" style={{ fontSize: "0.69rem", color: C.orange }}>
              Why OnSpot
            </span>
          </div>

          {/* Main quote */}
          <blockquote
            className="font-bold text-white leading-tight mb-7"
            style={{
              fontSize: "clamp(1.65rem, 3vw, 2.55rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              maxWidth: 760,
            }}
          >
            We've watched good companies get stuck choosing between{" "}
            <span style={{ color: "#FFBF4A" }}>marketplace chaos</span> and{" "}
            <span style={{ color: "#FFBF4A" }}>outsourcing overhead</span> — and good talent get squeezed by both sides of that same trade-off.
          </blockquote>

          {/* Body paragraph */}
          <p
            className="leading-relaxed"
            style={{ color: "rgba(210,213,255,0.78)", fontSize: "clamp(0.95rem, 1.4vw, 1.08rem)", lineHeight: 1.58, maxWidth: 640, marginBottom: "clamp(28px, 4vw, 38px)" }}
          >
            So we built OnSpot the way operators build things — not software developers guessing at the problem from the outside.
          </p>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.12)",
              marginBottom: "clamp(22px, 3vw, 28px)",
            }}
          />

          {/* Author row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <img
                src={nurPhoto}
                alt="Nur Laminero"
                className="flex-shrink-0 rounded-full object-cover"
                style={{
                  width: 54,
                  height: 54,
                  objectPosition: "center top",
                  border: "2px solid rgba(255,255,255,0.22)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                }}
              />
              <div>
                <p className="font-bold text-white" style={{ fontSize: "1rem" }}>Nur Laminero</p>
                <p className="font-semibold" style={{ color: C.orange, fontSize: "0.85rem" }}>Co-founder &amp; CEO</p>
              </div>
            </div>
            <Link
              href="/why-onspot/about"
              className="inline-flex items-center gap-1 font-semibold transition-opacity hover:opacity-70"
              style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.52)", whiteSpace: "nowrap" }}
            >
              About OnSpot <ArrowRight className="h-3.5 w-3.5" />
            </Link>
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

            <h2 className="mt-5 mb-8" style={{ maxWidth: 520 }}>
              <span
                className="block font-bold"
                style={{
                  fontSize: "clamp(38px, 4vw, 58px)",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.035em",
                  color: C.charcoal,
                }}
              >
                Real work, great pay,
              </span>
              <span
                className="block font-bold"
                style={{
                  fontSize: "clamp(34px, 3.6vw, 52px)",
                  fontWeight: 725,
                  lineHeight: 1.08,
                  letterSpacing: "-0.025em",
                  color: C.orangeDeep,
                  marginTop: 2,
                }}
              >
                from wherever you call home.
              </span>
            </h2>

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

  // Reuse the already-cached candidates response — no extra network request
  const { data: rawCandidates } = useQuery<any[]>({
    queryKey: ["/api/candidates"],
    queryFn: async () => {
      const r = await fetch("/api/candidates");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.items ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Randomly shuffle each time rawJobs changes; featured jobs lead
  const liveJobs: typeof STATIC_JOBS = useMemo(() => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const all = (rawJobs ?? []).filter((j: any) => j.title?.toLowerCase() !== "test");
    const featured = all.filter((j: any) => j.isFeatured);
    const regular  = all.filter((j: any) => !j.isFeatured);
    return [...shuffle(featured), ...shuffle(regular)].slice(0, 4).map((j: any) => ({
      title: j.title,
      type:  j.contractType || "Full-time",
      loc:   j.location || "Remote",
      pay:   j.budget
        ? `${j.budgetCurrency ?? "PHP"} ${j.budget}`
        : j.hourlyRateMin
          ? `USD ${j.hourlyRateMin}${j.hourlyRateMax ? ` – ${j.hourlyRateMax}` : ""}/hr`
          : "",
      id: j.id ?? null,
      isFeatured: j.isFeatured ?? false,
    }));
  }, [rawJobs]);

  const jobs = liveJobs.length >= 3 ? liveJobs : STATIC_JOBS;

  // Avatar pool for job cards — candidates with photos first
  const avatarPool: any[] = useMemo(() => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const all = rawCandidates ?? [];
    const withPhoto    = all.filter((c: any) => c.profilePhotoUrl);
    const withoutPhoto = all.filter((c: any) => !c.profilePhotoUrl);
    return [...shuffle(withPhoto), ...shuffle(withoutPhoto)].slice(0, 12);
  }, [rawCandidates]);

  return (
    <section
      style={{
        background: "linear-gradient(135deg, #18255F 0%, #222A6F 50%, #171A3E 100%)",
      }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Centered header */}
        <div className="text-center mb-14">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-5">
            <span style={{ width: 20, height: 2, background: C.orange, display: "inline-block", flexShrink: 0 }} />
            <span className="font-bold uppercase tracking-[0.09em]" style={{ fontSize: "0.69rem", color: C.orange }}>
              For Talents
            </span>
          </div>
          <h2
            className="font-bold text-white leading-tight"
            style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", letterSpacing: "-0.028em", lineHeight: 1.1 }}
          >
            Hundreds of high-paying jobs.<br />
            <span style={{ color: C.orangeLight }}>Open right now.</span>
          </h2>
          <p className="mt-5 mx-auto" style={{ color: "rgba(200,205,255,0.72)", fontSize: "clamp(0.95rem, 1.4vw, 1.08rem)", lineHeight: 1.6, maxWidth: 580 }}>
            Real roles with great companies — at rates that reflect what your work is actually worth. New jobs open every week.
          </p>
        </div>

        {/* 4 job cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {jobs.map((job, i) => {
            // Give each card a distinct 2-avatar slice from the pool
            const sliceStart = (i * 2) % Math.max(avatarPool.length, 1);
            const cardAvatars = avatarPool.slice(sliceStart, sliceStart + 2);
            return (
              <Link
                key={i}
                href={job.id ? `/jobs/${job.id}` : "/find-work/jobs"}
                className="rounded-[18px] flex flex-col"
                style={{
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  padding: "22px 22px 20px",
                  minHeight: 220,
                  transition: "transform 280ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 280ms ease, border-color 280ms ease, background 280ms ease",
                  display: "flex",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.transform = "translateY(-8px)";
                  el.style.boxShadow = "0 24px 48px rgba(58,58,248,0.28), 0 8px 20px rgba(0,0,0,0.35)";
                  el.style.borderColor = "rgba(255,255,255,0.34)";
                  el.style.background = "rgba(255,255,255,0.085)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "";
                  el.style.borderColor = "rgba(255,255,255,0.16)";
                  el.style.background = "rgba(255,255,255,0.055)";
                }}
              >
                {/* HIRING NOW badge */}
                <span
                  className="self-start rounded-full px-2.5 py-[3px] font-bold uppercase tracking-wide mb-4"
                  style={{ fontSize: "9.5px", background: "rgba(255,174,33,0.15)", color: "#FFBF4A" }}
                >
                  Hiring Now
                </span>
                {/* Title */}
                <p className="font-bold text-white leading-snug mb-2 flex-1" style={{ fontSize: "clamp(1rem, 1.5vw, 1.15rem)" }}>
                  {job.title}
                </p>
                {/* Meta */}
                <p className="mb-2.5" style={{ color: "rgba(200,205,255,0.55)", fontSize: "0.81rem" }}>
                  {job.type} · {job.loc}
                </p>
                {/* Pay */}
                {job.pay && (
                  <p className="font-bold mb-3" style={{ color: C.orangeLight, fontSize: "0.92rem" }}>
                    {job.pay}
                  </p>
                )}
                {/* Avatar stack — candidates ready for this role */}
                {cardAvatars.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex -space-x-2">
                      {cardAvatars.map((c: any, ci: number) => (
                        c.profilePhotoUrl ? (
                          <img key={ci} src={c.profilePhotoUrl} alt="" className="h-6 w-6 rounded-full object-cover flex-shrink-0" style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.15)" }} />
                        ) : (
                          <div key={ci} className="h-6 w-6 rounded-full flex items-center justify-center ring-2 flex-shrink-0" style={{ background: "rgba(75,81,184,0.7)", fontSize: "7px", color: "white", fontWeight: 700, outlineColor: "transparent", boxShadow: "0 0 0 2px rgba(255,255,255,0.15)" }}>
                            {talentInitials(c.displayName || c.fullName || "?")}
                          </div>
                        )
                      ))}
                    </div>
                    <span style={{ color: "rgba(200,205,255,0.5)", fontSize: "0.72rem" }}>
                      {cardAvatars.length}+ talents ready
                    </span>
                  </div>
                )}
                {/* CTA */}
                <span
                  className="inline-flex items-center gap-1 font-semibold mt-auto transition hover:opacity-80"
                  style={{ fontSize: "0.8rem", color: "rgba(220,224,255,0.75)" }}
                >
                  View role <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-5 text-center">
          <Link
            href="/find-work/jobs"
            className="inline-flex h-[50px] min-w-[190px] items-center justify-center rounded-full px-8 text-[15px] font-semibold transition hover:-translate-y-[1px]"
            style={{
              background: C.orange,
              color: C.indigoDeep,
              boxShadow: "0 8px 28px rgba(255,174,33,0.38)",
            }}
          >
            Browse all jobs →
          </Link>
          <p style={{ color: "rgba(200,205,255,0.5)", fontSize: "0.8rem" }}>
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
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        background: "radial-gradient(55% 40% at 50% 0%, rgba(75,81,184,0.07), transparent 55%), #FCFCFB",
      }}
      className="px-6 sm:px-10 lg:px-16 xl:px-20 py-20 lg:py-28"
    >
      {/* Keyframes injected once */}
      <style>{`
        @keyframes _card-in {
          from { opacity: 0; transform: translateY(36px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes _icon-float {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-7px); }
        }
        @keyframes _arrow-beat {
          0%, 100% { transform: translateY(-50%) scale(1);    box-shadow: 0 4px 14px rgba(255,174,33,0.45); }
          50%       { transform: translateY(-50%) scale(1.18); box-shadow: 0 8px 26px rgba(255,174,33,0.70); }
        }
        @keyframes _tagline-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes _shimmer-sweep {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes _num-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* ── Centered header ── */}
      <div className="mx-auto max-w-[680px] text-center mb-16">
        <div className="inline-flex items-center gap-2 mb-5">
          <span style={{ width: 20, height: 2, background: C.orange, display: "inline-block", flexShrink: 0 }} />
          <span className="font-bold uppercase tracking-[0.09em]" style={{ fontSize: "0.69rem", color: C.indigo }}>
            The Plan
          </span>
        </div>
        <h2
          className="font-bold leading-tight mb-4"
          style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)", letterSpacing: "-0.028em", color: C.charcoal }}
        >
          From posted to placed
        </h2>
        <p style={{ color: C.gray, fontSize: "clamp(0.95rem, 1.4vw, 1.08rem)", maxWidth: 500, marginInline: "auto", lineHeight: 1.55 }}>
          Three steps. No bidding wars, no long contracts, no hidden markups.
        </p>
      </div>

      {/* ── 3 step cards ── */}
      <div className="mx-auto" style={{ maxWidth: 1160 }}>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-7 mb-14">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isHov = hovered === i;
            return (
              <div
                key={i}
                className="relative"
                style={{
                  opacity: visible ? 1 : 0,
                  animation: visible ? `_card-in 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 160}ms both` : "none",
                }}
              >
                {/* Orange connector arrow */}
                {i < 2 && (
                  <div
                    aria-hidden
                    className="hidden md:flex absolute z-10 items-center justify-center rounded-full"
                    style={{
                      width: 38, height: 38,
                      right: -19, top: "50%",
                      background: C.orange,
                      animation: visible ? `_arrow-beat 2s ease-in-out ${i * 160 + 700}ms infinite` : "none",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <ArrowRight className="h-4 w-4" style={{ color: C.indigoDeep }} />
                  </div>
                )}

                {/* Card */}
                <div
                  className="rounded-[20px] h-full flex flex-col"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: "30px 30px 28px",
                    background: isHov
                      ? "linear-gradient(160deg, #fafbff 0%, #f4f5ff 100%)"
                      : "white",
                    border: isHov ? "1px solid #c4c8f0" : "1px solid #E2E6F0",
                    boxShadow: isHov
                      ? "0 16px 48px rgba(75,81,184,0.16), 0 2px 8px rgba(75,81,184,0.08)"
                      : "0 4px 22px rgba(75,81,184,0.07)",
                    transform: isHov ? "translateY(-6px) scale(1.012)" : "translateY(0) scale(1)",
                    transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease",
                    minHeight: 260,
                    cursor: "default",
                  }}
                >
                  {/* Icon + step number */}
                  <div className="flex items-start justify-between mb-6">
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 50, height: 50,
                        borderRadius: 13,
                        background: isHov
                          ? "linear-gradient(145deg, #6672e0 0%, #4752c4 100%)"
                          : "linear-gradient(145deg, #5560CC 0%, #3B45A8 100%)",
                        boxShadow: isHov
                          ? "0 8px 28px rgba(75,81,184,0.45)"
                          : "0 6px 18px rgba(75,81,184,0.3)",
                        transition: "box-shadow 0.3s ease, background 0.3s ease",
                        animation: visible ? `_icon-float ${2.2 + i * 0.4}s ease-in-out ${i * 200}ms infinite` : "none",
                      }}
                    >
                      <Icon className="h-[22px] w-[22px] text-white" />
                    </div>
                    <span
                      className="font-bold tabular-nums"
                      style={{
                        fontSize: "3.6rem",
                        color: isHov ? "#d0d4f5" : "#E8EAF5",
                        letterSpacing: "-0.04em",
                        lineHeight: 1,
                        transition: "color 0.3s ease",
                        animation: visible ? `_num-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 160 + 200}ms both` : "none",
                      }}
                    >
                      {step.num}
                    </span>
                  </div>

                  <h3 className="font-bold mb-2.5" style={{ fontSize: "1.12rem", color: C.charcoal }}>
                    {step.title}
                  </h3>
                  <p className="leading-relaxed flex-1" style={{ color: C.gray, fontSize: "0.95rem", lineHeight: 1.55 }}>
                    {step.body}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-4">
                    {step.links.map((l) => (
                      <Link
                        key={l.label}
                        href={l.href}
                        className="font-semibold transition hover:opacity-75"
                        style={{ fontSize: "0.875rem", color: C.indigo }}
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

        {/* ── Bottom statement ── */}
        <p
          className="text-center font-bold"
          style={{
            fontSize: "clamp(1rem, 1.4vw, 1.08rem)",
            color: C.charcoal,
            opacity: visible ? 1 : 0,
            animation: visible ? "_tagline-in 0.7s ease 640ms both" : "none",
          }}
        >
          That's it.{" "}
          <span
            style={{
              fontWeight: 800,
              background: visible
                ? "linear-gradient(90deg, #3F4698 0%, #7b82d4 30%, #FFAE21 60%, #3F4698 100%)"
                : "none",
              backgroundSize: "300% auto",
              WebkitBackgroundClip: visible ? "text" : "unset",
              WebkitTextFillColor: visible ? "transparent" : C.indigo,
              backgroundClip: visible ? "text" : "unset",
              animation: visible ? "_shimmer-sweep 3.5s linear 1.2s infinite" : "none",
              display: "inline",
            }}
          >
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
          <Link href="/terms-and-conditions" className="underline underline-offset-1 hover:opacity-70 transition">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy-policy" className="underline underline-offset-1 hover:opacity-70 transition">Privacy Policy</Link>.
        </p>
      </div>
    </section>
  );
}
