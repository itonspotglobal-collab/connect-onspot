import { useState, useEffect, Fragment } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
  X,
  Users,
  Briefcase,
  Zap,
  Clock,
} from "lucide-react";
import { Footer } from "@/components/Footer";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ORG  = "#F5A020";   // golden orange accent
const NAVY = "#03071E";   // hero / dark-section background
const LAVENDER = "#EAEDF8"; // light lavender sections
const BEIGE    = "#FBF7EE"; // beige talent-testimonial section

const SLIDE_MS = 5500;

// ── Hero slides ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "email",
    eyebrow: "— WORK WITHOUT LIMITS",
    heading:
      "Some of the best teams in the world already work this way.",
    body: "The ones who refuse to keep losing good people to delay and overhead. The ones who build without limits — and the people who work with them earn without limits.",
    image: null as string | null,
  },
  {
    id: "talent",
    eyebrow: "— FOR TALENTS",
    heading: "Your rate. Your work. No one taking a cut.",
    body: "Work with global companies who value what you do. Keep every peso of what you earn — OnSpot's fee is added on top, never deducted from your pay.",
    image: "https://images.unsplash.com/photo-1600880292630-ee8a00403024?auto=format&fit=crop&w=1920&q=80",
  },
  {
    id: "company",
    eyebrow: "— FOR COMPANIES",
    heading: "The right talent, in days — not months.",
    body: "Skip the chaos and overhead. Get matched with vetted Filipino professionals who are ready to deliver — no markups, no middlemen.",
    image: "https://images.unsplash.com/photo-1573497491208-6b1acb260507?auto=format&fit=crop&w=1920&q=80",
  },
  {
    id: "platform",
    eyebrow: "— THE PLATFORM",
    heading: "One system for everything that matters.",
    body: "Match, hire, manage, and pay — all in one place. Full visibility, no hidden costs, and a team that actually shows up.",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80",
  },
  {
    id: "general",
    eyebrow: "— WORK WITHOUT LIMITS",
    heading: "Work Without Limits",
    body: "One system. Highest pay for talents at lower cost to companies.",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1920&q=80",
  },
];

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ fontFamily: "inherit" }}>
      <HeroSection />
      <ProblemSection />
      <BetterWaySection />
      <TalentTestimonialSection />
      <JobListingsSection />
      <ProcessSection />
      <EquationSection />
      <FounderQuoteSection />
      <CompanyTestimonialSection />
      <Footer />
    </div>
  );
}

// ── Reusable eyebrow label ────────────────────────────────────────────────────
function Eyebrow({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <p
      className="text-xs font-bold tracking-widest uppercase mb-4"
      style={{ color: light ? "rgba(255,255,255,0.55)" : ORG, letterSpacing: "0.12em" }}
    >
      {children}
    </p>
  );
}

// ── 1. Hero ───────────────────────────────────────────────────────────────────
function HeroSection() {
  const [slide, setSlide] = useState(0);
  const [email, setEmail] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  // Preload images
  useEffect(() => {
    SLIDES.forEach((s) => {
      if (s.image) { const img = new Image(); img.src = s.image; }
    });
  }, []);

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const t = setTimeout(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, isPaused]);

  const prev = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % SLIDES.length);
  const active = SLIDES[slide];

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "calc(100dvh - 64px)", background: NAVY }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slide background images */}
      {SLIDES.map((s, i) =>
        s.image ? (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${s.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === slide ? 1 : 0,
              transition: "opacity 0.9s ease-in-out",
            }}
          />
        ) : null
      )}
      {/* Dark overlay */}
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: "rgba(3,7,30,0.82)" }}
      />

      {/* Slide content */}
      <div
        className="relative z-10 flex flex-col px-6 sm:px-12 lg:px-20 pt-16 sm:pt-20 pb-28"
        style={{ minHeight: "calc(100dvh - 64px)" }}
      >
        <div
          key={`hero-${slide}`}
          style={{ animation: "homeHeroIn 0.55s ease forwards", opacity: 0, maxWidth: 860 }}
        >
          {/* Eyebrow */}
          <p
            className="text-xs font-bold tracking-widest uppercase mb-6"
            style={{ color: ORG, letterSpacing: "0.14em" }}
          >
            {active.eyebrow}
          </p>

          {/* === email slide === */}
          {active.id === "email" && (
            <>
              <h1
                className="text-white font-bold leading-tight mb-5"
                style={{
                  fontSize: "clamp(2rem, 4vw, 4.2rem)",
                  letterSpacing: "-0.025em",
                  maxWidth: 820,
                }}
              >
                {active.heading}
              </h1>
              <p
                className="mb-8 leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.58)",
                  fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)",
                  maxWidth: 580,
                }}
              >
                {active.body}
              </p>
              <form
                className="flex flex-col sm:flex-row gap-3 mb-5"
                style={{ maxWidth: 460 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  window.location.href = email
                    ? `/hire-talent?email=${encodeURIComponent(email)}`
                    : "/hire-talent";
                }}
              >
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 rounded-xl px-4 py-3.5 border text-white placeholder:text-white/35 focus:outline-none focus:border-white/50 transition"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.2)",
                    fontSize: "0.95rem",
                  }}
                />
                <button
                  type="submit"
                  className="rounded-xl px-6 py-3.5 font-semibold transition hover:opacity-90 whitespace-nowrap"
                  style={{ background: ORG, color: NAVY, fontSize: "0.95rem" }}
                >
                  Get started
                </button>
              </form>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }} className="mb-2">
                Looking for work instead?{" "}
                <Link
                  href="/find-work"
                  className="underline underline-offset-4 hover:text-white transition"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                >
                  Find work →
                </Link>
              </p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" }}>
                By continuing you agree to our Terms and Privacy Policy.
              </p>
            </>
          )}

          {/* === general slide === */}
          {active.id === "general" && (
            <>
              <h1
                className="font-bold leading-tight mb-4"
                style={{
                  fontSize: "clamp(2.8rem, 5vw, 5.5rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                <span className="text-white">Work </span>
                <span style={{ color: ORG }}>Without Limits</span>
              </h1>
              <p
                className="mb-9 leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
                  maxWidth: 500,
                }}
              >
                {active.body}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/hire-talent">
                  <button
                    className="flex items-center gap-2 rounded-xl border px-7 py-3.5 font-semibold text-white transition hover:bg-white/15"
                    style={{
                      borderColor: "rgba(255,255,255,0.35)",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: "1rem",
                    }}
                  >
                    <Users className="w-4 h-4" /> Hire talent
                  </button>
                </Link>
                <Link href="/find-work">
                  <button
                    className="flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition hover:opacity-90"
                    style={{ background: ORG, color: NAVY, fontSize: "1rem" }}
                  >
                    Find work <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </>
          )}

          {/* === talent slide === */}
          {active.id === "talent" && (
            <>
              <h1
                className="text-white font-bold leading-tight mb-5"
                style={{
                  fontSize: "clamp(2rem, 3.8vw, 4rem)",
                  letterSpacing: "-0.025em",
                  maxWidth: 740,
                }}
              >
                {active.heading}
              </h1>
              <p
                className="mb-9 leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)",
                  maxWidth: 540,
                }}
              >
                {active.body}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/find-work">
                  <button
                    className="flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition hover:opacity-90"
                    style={{ background: ORG, color: NAVY, fontSize: "1rem" }}
                  >
                    <Briefcase className="w-4 h-4" /> Find work
                  </button>
                </Link>
                <Link href="/find-work/jobs">
                  <button
                    className="flex items-center gap-2 rounded-xl border px-7 py-3.5 font-semibold text-white transition hover:bg-white/15"
                    style={{
                      borderColor: "rgba(255,255,255,0.35)",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: "1rem",
                    }}
                  >
                    Browse open roles →
                  </button>
                </Link>
              </div>
            </>
          )}

          {/* === company slide === */}
          {active.id === "company" && (
            <>
              <h1
                className="text-white font-bold leading-tight mb-5"
                style={{
                  fontSize: "clamp(2rem, 3.8vw, 4rem)",
                  letterSpacing: "-0.025em",
                  maxWidth: 740,
                }}
              >
                {active.heading}
              </h1>
              <p
                className="mb-9 leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)",
                  maxWidth: 540,
                }}
              >
                {active.body}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/hire-talent">
                  <button
                    className="flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition hover:opacity-90"
                    style={{ background: ORG, color: NAVY, fontSize: "1rem" }}
                  >
                    <Users className="w-4 h-4" /> Hire talent
                  </button>
                </Link>
                <Link href="/hire-talent">
                  <button
                    className="flex items-center gap-2 rounded-xl border px-7 py-3.5 font-semibold text-white transition hover:bg-white/15"
                    style={{
                      borderColor: "rgba(255,255,255,0.35)",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: "1rem",
                    }}
                  >
                    See how it works →
                  </button>
                </Link>
              </div>
            </>
          )}

          {/* === platform slide === */}
          {active.id === "platform" && (
            <>
              <h1
                className="text-white font-bold leading-tight mb-5"
                style={{
                  fontSize: "clamp(2rem, 3.8vw, 4rem)",
                  letterSpacing: "-0.025em",
                  maxWidth: 740,
                }}
              >
                {active.heading}
              </h1>
              <p
                className="mb-9 leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)",
                  maxWidth: 540,
                }}
              >
                {active.body}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/hire-talent">
                  <button
                    className="flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition hover:opacity-90"
                    style={{ background: ORG, color: NAVY, fontSize: "1rem" }}
                  >
                    Get started <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/why-onspot">
                  <button
                    className="flex items-center gap-2 rounded-xl border px-7 py-3.5 font-semibold text-white transition hover:bg-white/15"
                    style={{
                      borderColor: "rgba(255,255,255,0.35)",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: "1rem",
                    }}
                  >
                    Learn more →
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Carousel controls ── */}
      <div
        className="absolute bottom-6 left-0 right-0 z-20 flex items-center gap-4 px-6 sm:px-12 lg:px-20"
      >
        {/* Prev */}
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-white/20 flex-shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)" }}
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>
        {/* Next */}
        <button
          onClick={next}
          aria-label="Next slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-white/20 flex-shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)" }}
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>

        {/* Slide counter */}
        <span
          className="font-semibold tabular-nums flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem" }}
        >
          <span className="text-white font-bold" style={{ fontSize: "1rem" }}>
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
                background: i === slide ? ORG : "rgba(255,255,255,0.28)",
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

// ── 2. Problem with outsourcing ───────────────────────────────────────────────
function ProblemSection() {
  return (
    <section style={{ background: LAVENDER }} className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>— THE PROBLEM WITH OUTSOURCING TODAY</Eyebrow>
        <h2
          className="font-bold leading-tight mb-4"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: "#0A0E2A",
            maxWidth: 700,
          }}
        >
          Outsourcing is broken. Both sides are paying for it.
        </h2>
        <p className="text-[#4A5368] mb-12" style={{ fontSize: "1.05rem", maxWidth: 560 }}>
          A middleman sits between you — inflating what companies pay and shrinking what talent takes home.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* For companies card */}
          <div className="rounded-2xl p-7 flex flex-col" style={{ background: NAVY }}>
            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: ORG, letterSpacing: "0.14em" }}
            >
              FOR COMPANIES
            </p>
            <h3
              className="font-bold text-white mb-6 leading-tight"
              style={{ fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)" }}
            >
              The 3 hidden costs of{" "}
              <span style={{ color: ORG }}>the old way.</span>
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
              <p className="text-white font-semibold mb-3" style={{ fontSize: "0.95rem" }}>
                OnSpot removes all three.
              </p>
              <Link href="/hire-talent">
                <button
                  className="flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
                  style={{ color: ORG }}
                >
                  Hire talent <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>

          {/* For talents card */}
          <div
            className="rounded-2xl p-7 flex flex-col"
            style={{ background: "white", border: "1px solid #D8DCF0" }}
          >
            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: ORG, letterSpacing: "0.14em" }}
            >
              FOR TALENTS
            </p>
            <h3
              className="font-bold mb-6 leading-tight"
              style={{ fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)", color: "#0A0E2A" }}
            >
              The same system{" "}
              <span style={{ color: ORG }}>costs you too.</span>
            </h3>
            <ul className="space-y-4 flex-1">
              {[
                ["Unpaid waiting", "months to get matched."],
                ["Bidding wars", "a race to the bottom."],
                ["Hidden markups", "cuts you never agreed to."],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <X className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(200,60,60,0.7)" }} />
                  <p style={{ color: "#4A5368", fontSize: "0.95rem" }}>
                    <span className="font-semibold" style={{ color: "#0A0E2A" }}>{title}</span> — {desc}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-7 pt-6 border-t border-[#D8DCF0]">
              <p className="font-semibold mb-3" style={{ color: "#0A0E2A", fontSize: "0.95rem" }}>
                At OnSpot, you get paid what you're worth.
              </p>
              <Link href="/find-work">
                <button
                  className="flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
                  style={{ color: ORG }}
                >
                  Find work <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 3. Better Way ─────────────────────────────────────────────────────────────
function BetterWaySection() {
  return (
    <section style={{ background: LAVENDER }} className="px-6 sm:px-12 lg:px-20 pb-20 lg:pb-28 pt-4">
      <div className="mx-auto max-w-[1100px]">
        <div
          className="h-px mb-16"
          style={{ background: "rgba(100,110,180,0.2)" }}
        />
        <Eyebrow>— THE BETTER WAY</Eyebrow>
        <h2
          className="font-bold leading-tight mb-12"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: "#0A0E2A",
          }}
        >
          Companies pay less. Talent earns more.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Companies pay */}
          <div
            className="rounded-2xl p-7"
            style={{ background: "white", border: "1px solid #D8DCF0" }}
          >
            <p
              className="text-xs font-bold tracking-widest uppercase mb-5"
              style={{ color: "#8A95B0", letterSpacing: "0.14em" }}
            >
              COMPANIES PAY
            </p>
            <div className="flex items-baseline gap-3 mb-3">
              <span
                className="line-through font-medium"
                style={{ color: "#9BA3BB", fontSize: "clamp(1.1rem, 1.6vw, 1.5rem)" }}
              >
                $2,500
              </span>
              <span
                className="font-bold"
                style={{
                  color: "#0A0E2A",
                  fontSize: "clamp(2rem, 3vw, 2.8rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                $2,400
              </span>
            </div>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "#E8F5E9", color: "#2E7D32" }}
            >
              ↓ Less than traditional outsourcing
            </span>
            <p style={{ color: "#5A6378", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Same work, even better quality — without the layer of overhead traditional outsourcing adds on top.
            </p>
            <Link href="/hire-talent">
              <button
                className="mt-5 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                style={{ color: ORG }}
              >
                Hire talent <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>

          {/* Talent earns */}
          <div className="rounded-2xl p-7" style={{ background: NAVY }}>
            <p
              className="text-xs font-bold tracking-widest uppercase mb-5"
              style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.14em" }}
            >
              TALENT EARNS
            </p>
            <div className="flex items-baseline gap-3 mb-3">
              <span
                className="line-through font-medium"
                style={{ color: "rgba(255,255,255,0.35)", fontSize: "clamp(1.1rem, 1.6vw, 1.5rem)" }}
              >
                $1,000
              </span>
              <span
                className="font-bold text-white"
                style={{
                  fontSize: "clamp(2rem, 3vw, 2.8rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                $2,000
              </span>
            </div>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "rgba(245,160,32,0.2)", color: ORG }}
            >
              ↑ Do what traditional outsourcing pays
            </span>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Because OnSpot's fee sits on top of the talent's rate, not carved out of it.
            </p>
            <Link href="/find-work">
              <button
                className="mt-5 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                style={{ color: ORG }}
              >
                Find work <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{ color: "#7A849C", fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 720 }} className="mb-6">
          Illustrative example — one use case, one credit. Traditional outsourcing: The company pays $2,500
          and the talent takes $1,000. On OnSpot, the company pays $2,400 — the talent's full $2,000 rate
          plus a transparent $400 On-Spot fee.
        </p>
        <p
          className="font-semibold leading-snug"
          style={{ color: "#0A0E2A", fontSize: "clamp(1rem, 1.4vw, 1.15rem)", maxWidth: 680 }}
        >
          We don't create savings by paying talent less. We create savings by{" "}
          <span style={{ color: ORG }}>taking less in between.</span>
        </p>
      </div>
    </section>
  );
}

// ── 4. Talent testimonial (beige) ─────────────────────────────────────────────
function TalentTestimonialSection() {
  return (
    <section style={{ background: BEIGE }} className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>— FOR TALENTS</Eyebrow>
        <blockquote
          className="font-bold leading-tight mb-6"
          style={{
            fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)",
            letterSpacing: "-0.025em",
            color: "#0A0E2A",
            maxWidth: 760,
          }}
        >
          "Real work, great pay,{" "}
          <span style={{ color: ORG }}>from wherever you call home.</span>"
        </blockquote>
        <p className="mb-8 leading-relaxed" style={{ color: "#5A6378", fontSize: "1rem", maxWidth: 540 }}>
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
            <p className="font-semibold text-sm" style={{ color: "#0A0E2A" }}>Mark Apartol</p>
            <p style={{ color: "#7A849C", fontSize: "0.8rem" }}>Co-founder &amp; COO</p>
          </div>
        </div>

        <Link href="/find-work">
          <button
            className="flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold transition hover:bg-[#0A0E2A]/5"
            style={{
              borderColor: "#0A0E2A",
              color: "#0A0E2A",
              fontSize: "0.95rem",
            }}
          >
            Find work <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </section>
  );
}

// ── 5. Job listings (dark) ────────────────────────────────────────────────────
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
    <section style={{ background: NAVY }} className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>— FOR TALENTS</Eyebrow>
        <h2
          className="font-bold leading-tight mb-4"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: "white",
            maxWidth: 680,
          }}
        >
          Hundreds of high-paying jobs.{" "}
          <span style={{ color: ORG }}>Open right now.</span>
        </h2>
        <p className="mb-10" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", maxWidth: 540 }}>
          Real roles with great companies — all roles that reflect what your work is actually worth.
          New jobs open every week.
        </p>

        {jobs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {jobs.map((job: any) => (
              <div
                key={job.id}
                className="rounded-2xl p-5 flex flex-col"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span
                  className="inline-block text-xs font-bold tracking-wider uppercase rounded-md px-2.5 py-1 mb-4 self-start"
                  style={{ background: "rgba(245,160,32,0.2)", color: ORG, letterSpacing: "0.1em" }}
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
                  <p className="font-semibold mb-4" style={{ color: ORG, fontSize: "0.9rem" }}>
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
        ) : (
          <div className="mb-10" />
        )}

        <div className="flex flex-col items-start gap-5">
          <Link href="/find-work/jobs">
            <button
              className="flex items-center gap-2 rounded-xl border px-6 py-3.5 font-semibold text-white transition hover:bg-white/10"
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

// ── 6. From posted to placed ──────────────────────────────────────────────────
function ProcessSection() {
  const steps = [
    {
      n: "1",
      icon: <Briefcase className="w-5 h-5" />,
      title: "Post or apply",
      body: "Tell us what you need. Or show us what you can do.",
      links: [
        { label: "Post a role", href: "/hire-talent" },
        { label: "Apply as talent", href: "/get-hired" },
      ],
    },
    {
      n: "2",
      icon: <Zap className="w-5 h-5" />,
      title: "Get matched",
      body: "We connect the right people, fast — no endless scrolling.",
      links: [{ label: "See how matching works", href: "/why-onspot" }],
    },
    {
      n: "3",
      icon: <Clock className="w-5 h-5" />,
      title: "Start working",
      body: "Show up and do the work. We handle everything else.",
      links: [{ label: "Get started", href: "/hire-talent" }],
    },
  ];

  return (
    <section style={{ background: "#F5F6FA" }} className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>— THE PLAN</Eyebrow>
        <h2
          className="font-bold leading-tight mb-3"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: "#0A0E2A",
          }}
        >
          From posted to placed
        </h2>
        <p className="mb-14" style={{ color: "#5A6378", fontSize: "1rem" }}>
          Three steps. No bidding wars, no long contracts, no hidden markups.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {/* Step connector line */}
              {i < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-8 left-full w-full h-px z-0"
                  style={{ background: "linear-gradient(to right, #D0D4E8, transparent)", width: "calc(100% - 2rem)" }}
                />
              )}
              <div
                className="relative z-10 rounded-2xl p-6"
                style={{ background: "white", border: "1px solid #E0E4F0" }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "rgba(58,58,248,0.1)", color: "#3A3AF8" }}
                  >
                    {step.icon}
                  </div>
                  <span
                    className="font-bold text-4xl tabular-nums"
                    style={{ color: "#E8EAF5", letterSpacing: "-0.04em" }}
                  >
                    {step.n}
                  </span>
                </div>
                <h3 className="font-bold mb-2" style={{ fontSize: "1.05rem", color: "#0A0E2A" }}>
                  {step.title}
                </h3>
                <p className="mb-5" style={{ color: "#5A6378", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {step.body}
                </p>
                <div className="flex flex-wrap gap-3">
                  {step.links.map((l) => (
                    <Link key={l.label} href={l.href}>
                      <button
                        className="text-xs font-semibold transition hover:opacity-80"
                        style={{ color: ORG }}
                      >
                        {l.label} →
                      </button>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: "#5A6378", fontSize: "0.95rem" }}>
          That's it.{" "}
          <span className="font-semibold" style={{ color: ORG }}>
            Most roles are filled in days, not months.
          </span>
        </p>
      </div>
    </section>
  );
}

// ── 7. We changed the equation ────────────────────────────────────────────────
function EquationSection() {
  return (
    <section style={{ background: LAVENDER }} className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>— THE RIGHT WAY TO OUTSOURCE</Eyebrow>
        <h2
          className="font-bold leading-tight mb-3"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
            letterSpacing: "-0.025em",
            color: "#0A0E2A",
          }}
        >
          We changed the equation.
        </h2>
        <p className="mb-12" style={{ color: "#5A6378", fontSize: "1rem", maxWidth: 560 }}>
          Everyone else makes you pick two: speed, accountability, or cost. OnSpot doesn't.
        </p>

        {/* Comparison table */}
        <div className="grid grid-cols-3 rounded-2xl overflow-hidden mb-10 text-sm">
          {/* Header row */}
          <div className="px-5 py-4" style={{ background: "#E0E4F4", borderRight: "1px solid #CBD0E8" }}>
            <p className="font-bold text-xs tracking-widest uppercase" style={{ color: "#7A849C", letterSpacing: "0.1em" }}>
              FREELANCE MARKETPLACES
            </p>
            <p className="font-semibold mt-1" style={{ color: "#5A6378", fontSize: "0.85rem" }}>
              Fast and cheap
            </p>
          </div>
          <div className="px-5 py-4 text-center" style={{ background: NAVY }}>
            <p className="font-bold text-xs tracking-widest uppercase" style={{ color: ORG, letterSpacing: "0.1em" }}>
              — ONSPOT
            </p>
            <p className="font-semibold mt-1 text-white" style={{ fontSize: "0.85rem" }}>
              Great talent. High pay. Fair cost.
            </p>
          </div>
          <div className="px-5 py-4 text-right" style={{ background: "#E0E4F4" }}>
            <p className="font-bold text-xs tracking-widest uppercase" style={{ color: "#7A849C", letterSpacing: "0.1em" }}>
              TRADITIONAL OUTSOURCING
            </p>
            <p className="font-semibold mt-1" style={{ color: "#5A6378", fontSize: "0.85rem" }}>
              Reliable, but heavy
            </p>
          </div>

          {/* Feature rows */}
          {/* Row 1 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E8ECF6", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
            <span style={{ color: "#5A6378" }}>No accountability</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} />
            <span className="text-white" style={{ fontSize: "0.9rem" }}>Vetted talent, ready fast</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E8ECF6", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: "#5A6378" }}>Slow and rigid</span>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
          {/* Row 2 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E2E6F2", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
            <span style={{ color: "#5A6378" }}>No oversight</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} />
            <span className="text-white" style={{ fontSize: "0.9rem" }}>Accountable, managed relationships</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E2E6F2", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: "#5A6378" }}>Expensive overhead</span>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
          {/* Row 3 */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#E8ECF6", borderRight: "1px solid #CBD0E8", borderTop: "1px solid #CBD0E8" }}>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
            <span style={{ color: "#5A6378" }}>Race-to-bottom pay</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#4ADE80" }} />
            <span className="text-white" style={{ fontSize: "0.9rem" }}>No overhead cost</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: "#E8ECF6", borderTop: "1px solid #CBD0E8" }}>
            <span className="text-right" style={{ color: "#5A6378" }}>Slow to start</span>
            <X className="h-4 w-4 flex-shrink-0" style={{ color: "#C0303A" }} />
          </div>
        </div>

        <p style={{ color: "#3A4055", fontSize: "1rem", maxWidth: 680 }}>
          Everyone else trades one thing for another. OnSpot doesn't trade —{" "}
          <span className="font-semibold" style={{ color: ORG }}>
            we raise the whole experience.
          </span>
        </p>
      </div>
    </section>
  );
}

// ── 8. Founder quote ──────────────────────────────────────────────────────────
function FounderQuoteSection() {
  return (
    <section style={{ background: LAVENDER }} className="px-6 sm:px-12 lg:px-20 pb-20 lg:pb-28 pt-4">
      <div className="mx-auto max-w-[1100px]">
        <div
          className="rounded-2xl p-8 sm:p-10 lg:p-14"
          style={{ background: "#0D1B4B" }}
        >
          <Eyebrow>— WHY ONSPOT</Eyebrow>
          <blockquote
            className="font-bold text-white leading-tight mb-6"
            style={{ fontSize: "clamp(1.3rem, 2.2vw, 2rem)", letterSpacing: "-0.02em", maxWidth: 780 }}
          >
            "We've watched good companies get stuck choosing between{" "}
            <span style={{ color: ORG }}>marketplace chaos</span> and{" "}
            <span style={{ color: ORG }}>outsourcing overhead</span> — and good talent get squeezed
            by both sides of that same trade-off."
          </blockquote>
          <p
            className="mb-8 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", maxWidth: 680 }}
          >
            So we built OnSpot the way operators build things — not software developers guessing at
            the problem from the outside.
          </p>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #F5A020, #E07B00)" }}
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

// ── 9. Company testimonial (dark) ─────────────────────────────────────────────
function CompanyTestimonialSection() {
  return (
    <section style={{ background: NAVY }} className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>— FOR COMPANIES</Eyebrow>
        <blockquote
          className="font-bold leading-tight mb-6"
          style={{
            fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)",
            letterSpacing: "-0.025em",
            color: "white",
            maxWidth: 760,
          }}
        >
          "The team you've been picturing,{" "}
          <span style={{ color: ORG }}>without the wait or the complexity.</span>"
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
          Vetted talent, quick starts, and simpler hiring — with a transparent fee you can see.
          So you can just build your team.
        </p>

        <Link href="/hire-talent">
          <button
            className="flex items-center gap-2 rounded-xl border px-6 py-3.5 font-semibold text-white transition hover:bg-white/10"
            style={{ borderColor: "rgba(255,255,255,0.3)", fontSize: "0.95rem" }}
          >
            <Users className="w-4 h-4" /> Hire talent
          </button>
        </Link>
      </div>
    </section>
  );
}
